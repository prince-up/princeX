const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionToken: {
    type: String,
    required: [true, 'Session token is required'],
    unique: true,
    index: true,
  },
  sessionType: {
    type: String,
    enum: ['instant', 'permanent'],
    required: [true, 'Session type is required'],
  },
  
  // Owner details
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Owner ID is required'],
    index: true,
  },
  ownerDeviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: [true, 'Owner device ID is required'],
  },
  
  // Controller details
  controllerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  controllerDeviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
  },
  
  // Permissions
  permissions: {
    viewOnly: {
      type: Boolean,
      default: false,
    },
    mouseControl: {
      type: Boolean,
      default: true,
    },
    keyboardControl: {
      type: Boolean,
      default: true,
    },
  },
  
  // Lifecycle
  status: {
    type: String,
    enum: ['pending', 'active', 'ended', 'expired'],
    default: 'pending',
    index: true,
  },
  expiresAt: {
    type: Date,
    index: true,
  },
  startedAt: {
    type: Date,
  },
  endedAt: {
    type: Date,
  },
  
  // Metadata
  qrCode: {
    type: String, // Data URL
  },
  socketRoomId: {
    type: String,
    required: true,
  },
}, {
  timestamps: true,
});

// TTL index for auto-deletion of expired sessions (5 minutes after expiry)
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 300 });

// Method to check if session is valid
sessionSchema.methods.isValid = function() {
  if (this.status === 'ended' || this.status === 'expired') {
    return false;
  }
  
  if (this.expiresAt && new Date() > this.expiresAt) {
    this.status = 'expired';
    this.save();
    return false;
  }
  
  return true;
};

// Method to start session
sessionSchema.methods.startSession = function(controllerId, controllerDeviceId) {
  this.controllerId = controllerId;
  this.controllerDeviceId = controllerDeviceId;
  this.status = 'active';
  this.startedAt = Date.now();
  return this.save();
};

// Method to end session
sessionSchema.methods.endSession = function() {
  this.status = 'ended';
  this.endedAt = Date.now();
  return this.save();
};

// Indexes
sessionSchema.index({ sessionToken: 1 });
sessionSchema.index({ ownerId: 1 });
sessionSchema.index({ controllerId: 1 });
sessionSchema.index({ status: 1 });

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
