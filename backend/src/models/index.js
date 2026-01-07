// Export all models from a single file for cleaner imports
module.exports = {
  User: require('./User'),
  Device: require('./Device'),
  Session: require('./Session'),
  TrustedAccess: require('./TrustedAccess'),
  AuditLog: require('./AuditLog'),
};
