const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  deviceFingerprint: {
    type: String,
    required: [true, 'Device fingerprint is required'],
    unique: true,
    index: true,
  },
  deviceName: {
    type: String,
    required: true,
    trim: true,
  },
  userAgent: {
    type: String,
    required: true,
  },
  lastActive: {
    type: Date,
    default: Date.now,
    index: true,
  },
  isOnline: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Update lastActive timestamp
deviceSchema.methods.updateActivity = function() {
  this.lastActive = Date.now();
  this.isOnline = true;
  return this.save();
};

// Set device offline
deviceSchema.methods.setOffline = function() {
  this.isOnline = false;
  return this.save();
};

// Indexes
deviceSchema.index({ userId: 1 });
deviceSchema.index({ deviceFingerprint: 1 });
deviceSchema.index({ lastActive: -1 });

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;
