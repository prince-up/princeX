const { User, Device, AuditLog } = require('../models');
const { generateToken } = require('../utils/jwt');
const logger = require('../utils/logger');

/**
 * Register new user
 */
const register = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      fullName,
    });

    // Create audit log
    await AuditLog.log({
      userId: user._id,
      eventType: 'login',
      eventData: { action: 'register' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      severity: 'info',
    });

    // Generate JWT
    const token = generateToken({ userId: user._id });

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: user.toSafeObject(),
    });
  } catch (error) {
    logger.error(`Registration error: ${error.message}`);
    res.status(500).json({ error: 'Registration failed' });
  }
};

/**
 * Login user
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user (include password for comparison)
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create audit log
    await AuditLog.log({
      userId: user._id,
      eventType: 'login',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      severity: 'info',
    });

    // Generate JWT
    const token = generateToken({ userId: user._id });

    res.json({
      message: 'Login successful',
      token,
      user: user.toSafeObject(),
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    res.status(500).json({ error: 'Login failed' });
  }
};

/**
 * Get current user profile
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('devices');
    res.json({ user: user.toSafeObject() });
  } catch (error) {
    logger.error(`Profile fetch error: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

/**
 * Logout (client-side token removal, server-side audit log)
 */
const logout = async (req, res) => {
  try {
    await AuditLog.log({
      userId: req.userId,
      eventType: 'logout',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      severity: 'info',
    });

    res.json({ message: 'Logout successful' });
  } catch (error) {
    logger.error(`Logout error: ${error.message}`);
    res.status(500).json({ error: 'Logout failed' });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  logout,
};
