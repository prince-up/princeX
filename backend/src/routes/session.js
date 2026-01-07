const express = require('express');
const { body } = require('express-validator');
const sessionController = require('../controllers/sessionController');
const { validate } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/session/instant
 * @desc    Create instant session with QR
 * @access  Private
 */
router.post(
  '/instant',
  authenticate,
  [
    body('deviceId').isMongoId(),
    body('permissions').optional().isObject(),
    validate,
  ],
  sessionController.createInstantSession
);

/**
 * @route   POST /api/session/join
 * @desc    Join session via token
 * @access  Private
 */
router.post(
  '/join',
  authenticate,
  [
    body('sessionToken').notEmpty(),
    body('deviceId').isMongoId(),
    validate,
  ],
  sessionController.joinSession
);

/**
 * @route   POST /api/session/permanent
 * @desc    Connect to permanent device
 * @access  Private
 */
router.post(
  '/permanent',
  authenticate,
  [
    body('ownerDeviceId').isMongoId(),
    body('deviceId').isMongoId(),
    validate,
  ],
  sessionController.connectToPermanentDevice
);

/**
 * @route   DELETE /api/session/:sessionId
 * @desc    End session
 * @access  Private
 */
router.delete('/:sessionId', authenticate, sessionController.endSession);

/**
 * @route   GET /api/session/active
 * @desc    Get active sessions
 * @access  Private
 */
router.get('/active', authenticate, sessionController.getActiveSessions);

module.exports = router;
