const PDFDocument = require('pdfkit');
const { generateQueueQR } = require('./qrGenerator');

/**
 * Generate a QR code poster PDF for a merchant's queue
 * @param {Object} options - Configuration options
 * @param {string} options.merchantName - The merchant's business name
 * @param {string} options.queueId - The queue ID
 * @param {string} options.queueUrl - The full URL to the queue
 * @param {string} options.baseUrl - Base URL of the application
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateQRPosterPDF(options) {
  const {
    merchantName,
    queueId,
    queueUrl,
    baseUrl = 'https://queue.storehub.com'
  } = options;

  return new Promise(async (resolve, reject) => {
    try {
      // Create a new PDF document (A4 size)
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `${merchantName} - Queue QR Code`,
          Author: 'StoreHub Queue Management System',
          Subject: 'Queue QR Code for Customer Access',
          Creator: 'StoreHub'
        }
      });

      // Collect the PDF chunks
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Set up the page dimensions
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const centerX = pageWidth / 2;

      // Add a subtle background gradient effect
      doc.rect(0, 0, pageWidth, 150)
         .fill('#f8f9fa');

      // Add merchant name as header
      doc.fontSize(36)
         .fillColor('#333333')
         .font('Helvetica-Bold')
         .text(merchantName, 50, 60, {
           align: 'center',
           width: pageWidth - 100
         });

      // Add a decorative line
      doc.moveTo(centerX - 100, 120)
         .lineTo(centerX + 100, 120)
         .lineWidth(2)
         .stroke('#ff8c00');

      // Add instruction text
      doc.fontSize(20)
         .fillColor('#666666')
         .font('Helvetica')
         .text('Join Our Queue', 50, 180, {
           align: 'center',
           width: pageWidth - 100
         });

      // Generate QR code
      const qrCodeDataURL = await generateQueueQR(queueId, baseUrl);
      const qrCodeBuffer = Buffer.from(qrCodeDataURL.split(',')[1], 'base64');

      // Add QR code to PDF (centered, large size)
      const qrSize = 300;
      const qrX = (pageWidth - qrSize) / 2;
      const qrY = 240;
      
      // Add a white background with shadow effect for QR code
      doc.rect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20)
         .fill('#ffffff')
         .stroke('#e0e0e0');

      doc.image(qrCodeBuffer, qrX, qrY, {
        width: qrSize,
        height: qrSize
      });

      // Add scan instruction
      doc.fontSize(18)
         .fillColor('#333333')
         .font('Helvetica-Bold')
         .text('Scan with your phone camera', 50, qrY + qrSize + 30, {
           align: 'center',
           width: pageWidth - 100
         });

      // Add steps
      const stepsY = qrY + qrSize + 80;
      doc.fontSize(14)
         .fillColor('#666666')
         .font('Helvetica');

      const steps = [
        '1. Open your phone\'s camera',
        '2. Point at the QR code above',
        '3. Tap the notification to join the queue',
        '4. Get notified when your table is ready!'
      ];

      steps.forEach((step, index) => {
        doc.text(step, 100, stepsY + (index * 25), {
          width: pageWidth - 200
        });
      });

      // Add URL as text (fallback option)
      doc.fontSize(12)
         .fillColor('#999999')
         .text('Or visit:', 50, pageHeight - 150, {
           align: 'center',
           width: pageWidth - 100
         });

      doc.fontSize(14)
         .fillColor('#667eea')
         .font('Helvetica-Bold')
         .text(queueUrl, 50, pageHeight - 130, {
           align: 'center',
           width: pageWidth - 100,
           link: queueUrl,
           underline: true
         });

      // Add footer
      doc.fontSize(10)
         .fillColor('#999999')
         .font('Helvetica')
         .text('Powered by StoreHub Queue Management System', 50, pageHeight - 80, {
           align: 'center',
           width: pageWidth - 100
         });

      // Add print optimization hint
      doc.fontSize(8)
         .fillColor('#cccccc')
         .text('Best printed in color on white paper', 50, pageHeight - 60, {
           align: 'center',
           width: pageWidth - 100
         });

      // Finalize the PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate a simple QR code PDF (minimal design)
 * @param {Object} options - Configuration options
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateSimpleQRPDF(options) {
  const {
    merchantName,
    queueId,
    queueUrl,
    baseUrl = 'https://queue.storehub.com'
  } = options;

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 30
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const centerX = pageWidth / 2;

      // Simple header
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .text(merchantName, 30, 30, {
           align: 'center',
           width: pageWidth - 60
         });

      doc.fontSize(16)
         .font('Helvetica')
         .text('Scan to Join Queue', 30, 70, {
           align: 'center',
           width: pageWidth - 60
         });

      // Generate and add QR code
      const qrCodeDataURL = await generateQueueQR(queueId, baseUrl);
      const qrCodeBuffer = Buffer.from(qrCodeDataURL.split(',')[1], 'base64');

      const qrSize = 400;
      const qrX = (pageWidth - qrSize) / 2;
      
      doc.image(qrCodeBuffer, qrX, 120, {
        width: qrSize,
        height: qrSize
      });

      // URL
      doc.fontSize(12)
         .text(queueUrl, 30, 540, {
           align: 'center',
           width: pageWidth - 60
         });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateQRPosterPDF,
  generateSimpleQRPDF
};