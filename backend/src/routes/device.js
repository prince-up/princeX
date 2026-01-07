const express = require('express');
const { body } = require('express-validator');
const deviceController = require('../controllers/deviceController');
const { validate } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/device/register
 * @desc    Register or update device
 * @access  Private
 */
router.post(
  '/register',
  authenticate,
  [
    body('deviceFingerprint').notEmpty(),
    body('deviceName').notEmpty().trim(),
    body('userAgent').notEmpty(),
    validate,
  ],
  deviceController.registerDevice
);

/**
 * @route   GET /api/device/list
 * @desc    Get user's devices
 * @access  Private
 */
router.get('/list', authenticate, deviceController.getUserDevices);

/**
 * @route   PATCH /api/device/:deviceId/status
 * @desc    Update device status
 * @access  Private
 */
router.patch(
  '/:deviceId/status',
  authenticate,
  [
    body('isOnline').isBoolean(),
    validate,
  ],
  deviceController.updateDeviceStatus
);

module.exports = router;
