const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
  },
  
  eventType: {
    type: String,
    enum: [
      'session_created',
      'session_joined',
      'session_started',
      'session_ended',
      'trust_added',
      'trust_revoked',
      'login',
      'logout',
      'permission_changed',
      'error',
    ],
    required: [true, 'Event type is required'],
    index: true,
  },
  
  eventData: {
    type: mongoose.Schema.Types.Mixed, // Flexible for different event types
    default: {},
  },
  
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'info',
  },
  
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// TTL index for automatic log cleanup after 90 days
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

// Static method to create log entry
auditLogSchema.statics.log = async function(logData) {
  try {
    return await this.create(logData);
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - logging failures shouldn't break the app
  }
};

// Indexes
auditLogSchema.index({ sessionId: 1 });
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ eventType: 1 });
auditLogSchema.index({ timestamp: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
