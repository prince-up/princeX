const mongoose = require('mongoose');

const trustedAccessSchema = new mongoose.Schema({
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
  controllerEmail: {
    type: String,
    required: [true, 'Controller email is required'],
    lowercase: true,
    trim: true,
    index: true,
  },
  controllerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  
  // Permissions
  permissions: {
    autoApprove: {
      type: Boolean,
      default: false,
    },
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
  
  isActive: {
    type: Boolean,
    default: true,
  },
  lastUsedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Compound unique index to prevent duplicate trusted relationships
trustedAccessSchema.index({ ownerId: 1, controllerEmail: 1 }, { unique: true });

// Method to revoke access
trustedAccessSchema.methods.revoke = function() {
  this.isActive = false;
  return this.save();
};

// Method to update last used timestamp
trustedAccessSchema.methods.markUsed = function() {
  this.lastUsedAt = Date.now();
  return this.save();
};

// Indexes
trustedAccessSchema.index({ ownerId: 1, ownerDeviceId: 1 });
trustedAccessSchema.index({ controllerEmail: 1 });
trustedAccessSchema.index({ controllerId: 1 });

const TrustedAccess = mongoose.model('TrustedAccess', trustedAccessSchema);

module.exports = TrustedAccess;
