const QRCode = require('qrcode');

/**
 * Generate QR code for a queue
 * @param {string} queueId - The queue ID
 * @param {string} baseUrl - Base URL of the application
 * @returns {Promise<string>} Base64 encoded QR code image
 */
async function generateQueueQR(queueId, baseUrl = 'http://localhost:3000') {
  try {
    const queueUrl = `${baseUrl}/queue/${queueId}`;
    
    const qrCodeDataURL = await QRCode.toDataURL(queueUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    });
    
    return qrCodeDataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate QR code as SVG string
 * @param {string} queueId - The queue ID
 * @param {string} baseUrl - Base URL of the application
 * @returns {Promise<string>} SVG string
 */
async function generateQueueQRSVG(queueId, baseUrl = 'http://localhost:3000') {
  try {
    const queueUrl = `${baseUrl}/queue/${queueId}`;
    
    const qrCodeSVG = await QRCode.toString(queueUrl, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    });
    
    return qrCodeSVG;
  } catch (error) {
    console.error('Error generating QR code SVG:', error);
    throw new Error('Failed to generate QR code SVG');
  }
}

module.exports = {
  generateQueueQR,
  generateQueueQRSVG
}; 