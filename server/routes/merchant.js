const express = require('express');
const { body, validationResult } = require('express-validator');
const merchantService = require('../services/merchantService');
const queueService = require('../services/queueService');
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

// Use appropriate auth middleware based on environment
let requireAuth, loadUser;
if (process.env.NODE_ENV !== 'production') {
  ({ requireAuth, loadUser } = require('../middleware/auth-bypass'));
} else {
  ({ requireAuth, loadUser } = require('../middleware/auth'));
}

const { generateQRPosterPDF, generateSimpleQRPDF } = require('../utils/pdfGenerator');

const router = express.Router();

// Public endpoints (no auth required)
// GET /api/merchants - Get list of active merchants (public)
router.get('/', async (req, res) => {
  try {
    const merchants = await prisma.merchant.findMany({
      where: { isActive: true },
      select: {
        id: true,
        businessName: true,
        businessType: true
      },
      take: 20
    });
    
    res.json(merchants);
  } catch (error) {
    logger.error('Error fetching merchants:', error);
    res.status(500).json({ error: 'Failed to fetch merchants' });
  }
});

// Apply authentication to protected merchant API routes
router.use(requireAuth);
router.use(loadUser);

// GET /api/merchant/profile - Get merchant profile
router.get('/profile', async (req, res) => {
  try {
    const merchant = await merchantService.findById(req.user.id, {
      settings: true,
      businessHours: true,
      address: true,
      integrations: true
    });
    
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    res.json({
      success: true,
      merchant: merchant
    });

  } catch (error) {
    logger.error('Error fetching merchant profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/merchant/profile - Update merchant profile
router.put('/profile', [
  body('businessName').optional().trim().isLength({ min: 2, max: 100 }),
  body('email').optional().isEmail(),
  body('phone').optional().isMobilePhone(),
  body('businessType').optional().isIn(['restaurant', 'retail']),
  body('address').optional(),
  body('businessHours').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const merchant = await merchantService.findById(req.user.id);
    
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    // Update allowed fields
    const allowedFields = ['businessName', 'email', 'phone', 'businessType', 'address', 'businessHours'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        merchant[field] = req.body[field];
      }
    });

    // Prepare update data
    const updateData = {};
    editableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // Handle settings update if provided
    if (req.body.settings) {
      updateData.settings = {
        ...merchant.settings,
        ...req.body.settings
      };
    }

    // Update merchant in database
    await merchantService.update(merchant.id, updateData);

    // Session data will be updated via loadUser middleware on next request

    const fullMerchant = await merchantService.getFullDetails(merchantId);
    res.json({
      success: true,
      merchant: fullMerchant
    });

  } catch (error) {
    logger.error('Error updating merchant profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// PUT /api/merchant/settings/queue - Update queue-specific settings
router.put('/settings/queue', async (req, res) => {
  try {
    const merchant = await merchantService.findById(req.user.id, { settings: true });
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    // Update queue settings - these map to MerchantSettings model fields
    const settingsData = {};
    
    // Map queue settings to MerchantSettings fields
    if (req.body.maxQueueSize !== undefined) settingsData.maxQueueSize = req.body.maxQueueSize;
    if (req.body.averageServiceTime !== undefined) settingsData.avgMealDuration = req.body.averageServiceTime;
    if (req.body.noShowTimeout !== undefined) settingsData.noShowTimeout = req.body.noShowTimeout;
    if (req.body.gracePeriod !== undefined) settingsData.gracePeriod = req.body.gracePeriod;
    if (req.body.joinCutoffTime !== undefined) settingsData.joinCutoffTime = req.body.joinCutoffTime;
    
    // Update or create settings
    let updatedSettings;
    if (merchant.settings) {
      updatedSettings = await prisma.merchantSettings.update({
        where: { merchantId: merchant.id },
        data: settingsData
      });
    } else {
      updatedSettings = await prisma.merchantSettings.create({
        data: {
          merchantId: merchant.id,
          ...settingsData
        }
      });
    }
    
    res.json({ success: true, settings: updatedSettings, merchant: { ...merchant, settings: updatedSettings } });

  } catch (error) {
    logger.error('Error updating queue settings:', error);
    console.error('Settings update error:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to update queue settings', details: error.message });
  }
});

// PUT /api/merchant/settings/notifications - Update notification settings
router.put('/settings/notifications', async (req, res) => {
  try {
    const merchant = await merchantService.findById(req.user.id, { settings: true });
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    // Update notification settings - these map to MerchantSettings model fields
    const settingsData = {};
    
    // Map notification settings to MerchantSettings fields
    if (req.body.firstNotification !== undefined) settingsData.firstNotification = req.body.firstNotification;
    if (req.body.finalNotification !== undefined) settingsData.finalNotification = req.body.finalNotification;
    if (req.body.sendNoShowWarning !== undefined) settingsData.sendNoShowWarning = req.body.sendNoShowWarning;
    if (req.body.confirmTableAcceptance !== undefined) settingsData.confirmTableAcceptance = req.body.confirmTableAcceptance;
    
    // Update or create settings
    let updatedSettings;
    if (merchant.settings) {
      updatedSettings = await prisma.merchantSettings.update({
        where: { merchantId: merchant.id },
        data: settingsData
      });
    } else {
      updatedSettings = await prisma.merchantSettings.create({
        data: {
          merchantId: merchant.id,
          ...settingsData
        }
      });
    }
    
    res.json({ success: true, settings: updatedSettings });

  } catch (error) {
    logger.error('Error updating notification settings:', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
});

// PUT /api/merchant/settings/operations - Update operations settings
router.put('/settings/operations', async (req, res) => {
  try {
    const merchant = await merchantService.findById(req.user.id, { settings: true });
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    // Update operations settings - these map to MerchantSettings model fields
    const settingsData = {};
    
    // Map operations settings to MerchantSettings fields
    if (req.body.seatingCapacity !== undefined) settingsData.seatingCapacity = req.body.seatingCapacity;
    if (req.body.autoPauseThreshold !== undefined) settingsData.autoPauseThreshold = req.body.autoPauseThreshold;
    if (req.body.adjustForPeakHours !== undefined) settingsData.adjustForPeakHours = req.body.adjustForPeakHours;
    if (req.body.peakMultiplier !== undefined) settingsData.peakMultiplier = req.body.peakMultiplier;
    if (req.body.advanceBookingHours !== undefined) settingsData.advanceBookingHours = req.body.advanceBookingHours;
    
    // Update or create settings
    let updatedSettings;
    if (merchant.settings) {
      updatedSettings = await prisma.merchantSettings.update({
        where: { merchantId: merchant.id },
        data: settingsData
      });
    } else {
      updatedSettings = await prisma.merchantSettings.create({
        data: {
          merchantId: merchant.id,
          ...settingsData
        }
      });
    }
    
    res.json({ success: true, settings: updatedSettings });

  } catch (error) {
    logger.error('Error updating operations settings:', error);
    res.status(500).json({ error: 'Failed to update operations settings' });
  }
});

// GET /api/merchant/qr-pdf - Generate QR code PDF
router.get('/qr-pdf', async (req, res) => {
  try {
    const { queueId, type = 'professional' } = req.query;
    
    if (!queueId) {
      return res.status(400).json({ error: 'Queue ID is required' });
    }
    
    // Verify the queue belongs to this merchant
    const queue = await queueService.findByMerchantAndId(req.user.id, queueId);
    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }
    
    // Get merchant details
    const merchant = await merchantService.findById(req.user.id, { settings: true });
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }
    
    // Determine base URL (use HTTPS in production)
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    const queueUrl = `${baseUrl}/queue/${queueId}`;
    
    // Generate PDF based on type
    let pdfBuffer;
    const options = {
      merchantName: merchant.businessName,
      queueId: queueId,
      queueUrl: queueUrl,
      baseUrl: baseUrl
    };
    
    if (type === 'simple') {
      pdfBuffer = await generateSimpleQRPDF(options);
    } else {
      pdfBuffer = await generateQRPosterPDF(options);
    }
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="queue-qr-${type}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    // Send the PDF
    res.send(pdfBuffer);
    
    logger.info(`QR PDF generated for merchant ${merchant._id}, queue ${queueId}, type: ${type}`);
    
  } catch (error) {
    logger.error('Error generating QR PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router; 