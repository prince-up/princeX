require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/princex',
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  sessionExpiryMinutes: parseInt(process.env.SESSION_EXPIRY_MINUTES) || 10,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  turnServer: {
    url: process.env.TURN_SERVER_URL || 'stun:stun.l.google.com:19302',
    username: process.env.TURN_USERNAME || '',
    password: process.env.TURN_PASSWORD || '',
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};
