const { Device, AuditLog } = require('../models');
const logger = require('../utils/logger');

/**
 * Register or update device
 */
const registerDevice = async (req, res) => {
  try {
    const { deviceFingerprint, deviceName, userAgent } = req.body;

    // Check if device exists
    let device = await Device.findOne({ deviceFingerprint });

    if (device) {
      // Update existing device
      device.userId = req.userId;
      device.deviceName = deviceName;
      device.userAgent = userAgent;
      await device.updateActivity();
    } else {
      // Create new device
      device = await Device.create({
        userId: req.userId,
        deviceFingerprint,
        deviceName,
        userAgent,
        isOnline: true,
      });

      // Add device to user's devices array
      await User.findByIdAndUpdate(req.userId, {
        $addToSet: { devices: device._id },
      });
    }

    res.json({
      message: 'Device registered successfully',
      device,
    });
  } catch (error) {
    logger.error(`Device registration error: ${error.message}`);
    res.status(500).json({ error: 'Failed to register device' });
  }
};

/**
 * Get user's devices
 */
const getUserDevices = async (req, res) => {
  try {
    const devices = await Device.find({ userId: req.userId }).sort({ lastActive: -1 });
    res.json({ devices });
  } catch (error) {
    logger.error(`Get devices error: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
};

/**
 * Update device online status
 */
const updateDeviceStatus = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { isOnline } = req.body;

    const device = await Device.findOne({ _id: deviceId, userId: req.userId });
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    if (isOnline) {
      await device.updateActivity();
    } else {
      await device.setOffline();
    }

    res.json({ message: 'Device status updated', device });
  } catch (error) {
    logger.error(`Update device status error: ${error.message}`);
    res.status(500).json({ error: 'Failed to update device status' });
  }
};

module.exports = {
  registerDevice,
  getUserDevices,
  updateDeviceStatus,
};
