const { v4: uuidv4 } = require('uuid');
const { Session, Device, AuditLog, TrustedAccess } = require('../models');
const { generateQRCode } = require('../utils/qr');
const logger = require('../utils/logger');
const config = require('../config/env');

/**
 * Create instant session with QR code
 */
const createInstantSession = async (req, res) => {
  try {
    const { deviceId, permissions } = req.body;

    // Verify device belongs to user
    const device = await Device.findOne({ _id: deviceId, userId: req.userId });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Generate session token
    const sessionToken = `inst_${uuidv4()}`;
    const socketRoomId = `room_${uuidv4()}`;
    
    // Calculate expiry
    const expiresAt = new Date(Date.now() + config.sessionExpiryMinutes * 60000);

    // Generate QR code (encode session token)
    const qrCode = await generateQRCode(sessionToken);

    // Create session
    const session = await Session.create({
      sessionToken,
      sessionType: 'instant',
      ownerId: req.userId,
      ownerDeviceId: deviceId,
      permissions: permissions || {},
      expiresAt,
      qrCode,
      socketRoomId,
    });

    // Audit log
    await AuditLog.log({
      sessionId: session._id,
      userId: req.userId,
      deviceId,
      eventType: 'session_created',
      eventData: { sessionType: 'instant', expiresAt },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      session: {
        id: session._id,
        sessionToken,
        qrCode,
        expiresAt,
        socketRoomId,
        permissions: session.permissions,
      },
    });
  } catch (error) {
    logger.error(`Session creation error: ${error.message}`);
    res.status(500).json({ error: 'Failed to create session' });
  }
};

/**
 * Join session (controller scans QR or uses link)
 */
const joinSession = async (req, res) => {
  try {
    const { sessionToken, deviceId } = req.body;

    // Find session
    const session = await Session.findOne({ sessionToken })
      .populate('ownerId', 'email fullName')
      .populate('ownerDeviceId', 'deviceName');

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if valid
    if (!session.isValid()) {
      return res.status(400).json({ error: 'Session expired or invalid' });
    }

    // Verify device belongs to user
    const device = await Device.findOne({ _id: deviceId, userId: req.userId });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Start session
    await session.startSession(req.userId, deviceId);

    // Audit log
    await AuditLog.log({
      sessionId: session._id,
      userId: req.userId,
      deviceId,
      eventType: 'session_joined',
      eventData: { sessionToken },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      session: {
        id: session._id,
        socketRoomId: session.socketRoomId,
        owner: session.ownerId,
        ownerDevice: session.ownerDeviceId,
        permissions: session.permissions,
      },
    });
  } catch (error) {
    logger.error(`Session join error: ${error.message}`);
    res.status(500).json({ error: 'Failed to join session' });
  }
};

/**
 * End session
 */
const endSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Verify user is owner or controller
    if (!session.ownerId.equals(req.userId) && !session.controllerId?.equals(req.userId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await session.endSession();

    // Audit log
    await AuditLog.log({
      sessionId: session._id,
      userId: req.userId,
      eventType: 'session_ended',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ message: 'Session ended successfully' });
  } catch (error) {
    logger.error(`Session end error: ${error.message}`);
    res.status(500).json({ error: 'Failed to end session' });
  }
};

/**
 * Get active sessions for user
 */
const getActiveSessions = async (req, res) => {
  try {
    const sessions = await Session.find({
      $or: [
        { ownerId: req.userId },
        { controllerId: req.userId },
      ],
      status: 'active',
    })
      .populate('ownerId', 'email fullName')
      .populate('controllerId', 'email fullName')
      .populate('ownerDeviceId', 'deviceName')
      .populate('controllerDeviceId', 'deviceName');

    res.json({ sessions });
  } catch (error) {
    logger.error(`Get sessions error: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
};

/**
 * Connect to permanent access device
 */
const connectToPermanentDevice = async (req, res) => {
  try {
    const { ownerDeviceId } = req.body;

    // Verify trusted access
    const user = await User.findById(req.userId);
    const trustedAccess = await TrustedAccess.findOne({
      ownerDeviceId,
      $or: [
        { controllerEmail: user.email },
        { controllerId: req.userId },
      ],
      isActive: true,
    });

    if (!trustedAccess) {
      return res.status(403).json({ error: 'Access not authorized' });
    }

    // Check if device is online
    const ownerDevice = await Device.findById(ownerDeviceId);
    if (!ownerDevice || !ownerDevice.isOnline) {
      return res.status(400).json({ error: 'Device is offline' });
    }

    // Get controller device
    const { deviceId } = req.body;
    const controllerDevice = await Device.findOne({ _id: deviceId, userId: req.userId });
    if (!controllerDevice) {
      return res.status(404).json({ error: 'Controller device not found' });
    }

    // Create permanent session
    const sessionToken = `perm_${uuidv4()}`;
    const socketRoomId = `room_${uuidv4()}`;

    const session = await Session.create({
      sessionToken,
      sessionType: 'permanent',
      ownerId: trustedAccess.ownerId,
      ownerDeviceId,
      controllerId: req.userId,
      controllerDeviceId: deviceId,
      permissions: trustedAccess.permissions,
      socketRoomId,
      status: 'pending', // Needs owner approval unless autoApprove is true
    });

    if (trustedAccess.permissions.autoApprove) {
      session.status = 'active';
      session.startedAt = Date.now();
      await session.save();
    }

    // Update trusted access usage
    await trustedAccess.markUsed();

    // Audit log
    await AuditLog.log({
      sessionId: session._id,
      userId: req.userId,
      deviceId,
      eventType: 'session_created',
      eventData: { sessionType: 'permanent', ownerDeviceId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      session: {
        id: session._id,
        socketRoomId: session.socketRoomId,
        status: session.status,
        permissions: session.permissions,
      },
    });
  } catch (error) {
    logger.error(`Permanent connect error: ${error.message}`);
    res.status(500).json({ error: 'Failed to connect' });
  }
};

module.exports = {
  createInstantSession,
  joinSession,
  endSession,
  getActiveSessions,
  connectToPermanentDevice,
};
