const QRCode = require('qrcode');
const logger = require('./logger');

/**
 * Generate QR code as data URL
 * @param {String} data - Data to encode in QR
 * @returns {Promise<String>} QR code data URL
 */
const generateQRCode = async (data) => {
  try {
    const qrDataURL = await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 2,
    });
    return qrDataURL;
  } catch (error) {
    logger.error(`QR generation error: ${error.message}`);
    throw new Error('Failed to generate QR code');
  }
};

module.exports = {
  generateQRCode,
};
