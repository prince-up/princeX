const { TrustedAccess, User, Device, AuditLog } = require('../models');
const logger = require('../utils/logger');

/**
 * Add trusted email for permanent access
 */
const addTrustedEmail = async (req, res) => {
  try {
    const { controllerEmail, deviceId, permissions } = req.body;

    // Verify device belongs to user
    const device = await Device.findOne({ _id: deviceId, userId: req.userId });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Check if already trusted
    const existing = await TrustedAccess.findOne({
      ownerId: req.userId,
      controllerEmail: controllerEmail.toLowerCase(),
    });

    if (existing) {
      return res.status(400).json({ error: 'Email already trusted' });
    }

    // Check if controller is registered (optional - can trust unregistered emails)
    const controller = await User.findOne({ email: controllerEmail.toLowerCase() });

    // Create trusted access
    const trustedAccess = await TrustedAccess.create({
      ownerId: req.userId,
      ownerDeviceId: deviceId,
      controllerEmail: controllerEmail.toLowerCase(),
      controllerId: controller?._id,
      permissions: permissions || {},
    });

    // Audit log
    await AuditLog.log({
      userId: req.userId,
      deviceId,
      eventType: 'trust_added',
      eventData: { controllerEmail },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      message: 'Trusted email added successfully',
      trustedAccess,
    });
  } catch (error) {
    logger.error(`Add trusted email error: ${error.message}`);
    res.status(500).json({ error: 'Failed to add trusted email' });
  }
};

/**
 * Get trusted emails for user's devices
 */
const getTrustedEmails = async (req, res) => {
  try {
    const trustedList = await TrustedAccess.find({
      ownerId: req.userId,
      isActive: true,
    })
      .populate('ownerDeviceId', 'deviceName')
      .populate('controllerId', 'email fullName');

    res.json({ trustedList });
  } catch (error) {
    logger.error(`Get trusted emails error: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch trusted emails' });
  }
};

/**
 * Revoke trusted access
 */
const revokeTrustedAccess = async (req, res) => {
  try {
    const { trustId } = req.params;

    const trustedAccess = await TrustedAccess.findOne({
      _id: trustId,
      ownerId: req.userId,
    });

    if (!trustedAccess) {
      return res.status(404).json({ error: 'Trusted access not found' });
    }

    await trustedAccess.revoke();

    // Audit log
    await AuditLog.log({
      userId: req.userId,
      eventType: 'trust_revoked',
      eventData: { controllerEmail: trustedAccess.controllerEmail },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ message: 'Access revoked successfully' });
  } catch (error) {
    logger.error(`Revoke access error: ${error.message}`);
    res.status(500).json({ error: 'Failed to revoke access' });
  }
};

/**
 * Get available devices for controller (based on trusted access)
 */
const getAvailableDevices = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    // Find all trusted relationships
    const trustedList = await TrustedAccess.find({
      $or: [
        { controllerEmail: user.email },
        { controllerId: req.userId },
      ],
      isActive: true,
    }).populate({
      path: 'ownerDeviceId',
      populate: { path: 'userId', select: 'email fullName' },
    });

    // Filter online devices
    const availableDevices = trustedList
      .map(trust => ({
        trustId: trust._id,
        device: trust.ownerDeviceId,
        owner: trust.ownerDeviceId?.userId,
        permissions: trust.permissions,
        lastUsed: trust.lastUsedAt,
      }))
      .filter(item => item.device?.isOnline);

    res.json({ availableDevices });
  } catch (error) {
    logger.error(`Get available devices error: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch available devices' });
  }
};

module.exports = {
  addTrustedEmail,
  getTrustedEmails,
  revokeTrustedAccess,
  getAvailableDevices,
};
