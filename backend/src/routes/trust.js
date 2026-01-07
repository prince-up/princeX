const express = require('express');
const { body } = require('express-validator');
const trustController = require('../controllers/trustController');
const { validate } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/trust/add
 * @desc    Add trusted email
 * @access  Private
 */
router.post(
  '/add',
  authenticate,
  [
    body('controllerEmail').isEmail().normalizeEmail(),
    body('deviceId').isMongoId(),
    body('permissions').optional().isObject(),
    validate,
  ],
  trustController.addTrustedEmail
);

/**
 * @route   GET /api/trust/list
 * @desc    Get trusted emails
 * @access  Private
 */
router.get('/list', authenticate, trustController.getTrustedEmails);

/**
 * @route   DELETE /api/trust/:trustId
 * @desc    Revoke trusted access
 * @access  Private
 */
router.delete('/:trustId', authenticate, trustController.revokeTrustedAccess);

/**
 * @route   GET /api/trust/available-devices
 * @desc    Get available devices for controller
 * @access  Private
 */
router.get('/available-devices', authenticate, trustController.getAvailableDevices);

module.exports = router;
