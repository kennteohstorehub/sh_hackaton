const express = require('express');
const { body, validationResult } = require('express-validator');
const merchantService = require('../services/merchantService');
const queueService = require('../services/queueService');
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const checkQueueStatus = require('../middleware/checkQueueStatus');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Use appropriate auth middleware based on environment
let requireAuth, loadUser;
const useAuthBypass = process.env.USE_AUTH_BYPASS === 'true' || 
                     (process.env.NODE_ENV !== 'production' && process.env.USE_AUTH_BYPASS !== 'false');

if (useAuthBypass) {
  ({ requireAuth, loadUser } = require('../middleware/auth-bypass'));
} else {
  ({ requireAuth, loadUser } = require('../middleware/auth'));
}

// Import tenant isolation middleware
const { tenantIsolationMiddleware, validateMerchantAccess } = require('../middleware/tenant-isolation');

const { generateQRPosterPDF, generateSimpleQRPDF } = require('../utils/pdfGenerator');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const merchantId = req.session?.user?.id || 'temp';
    const uploadDir = path.join(__dirname, '../../public/uploads/merchants', merchantId);
    
    // Create directory if it doesn't exist
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    
    if (file.fieldname === 'logo') {
      cb(null, 'logo-' + uniqueSuffix + ext);
    } else if (file.fieldname === 'banner') {
      cb(null, 'banner-' + uniqueSuffix + ext);
    } else {
      cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPG, and SVG images are allowed.'));
    }
  }
});

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

// Apply authentication and tenant isolation to protected merchant API routes
router.use(requireAuth);
router.use(loadUser);
router.use(tenantIsolationMiddleware);
router.use(validateMerchantAccess);

// GET /api/merchant/profile - Get merchant profile with tenant isolation
router.get('/profile', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const merchant = await merchantService.findById(req.user.id, {
      settings: true,
      businessHours: true,
      address: true,
      integrations: true
    }, tenantId);
    
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
  checkQueueStatus(), // Prevent changes when queue is operating
  body('businessName').optional().trim().isLength({ min: 2, max: 100 }),
  body('email').optional().isEmail(),
  body('phone').optional().isMobilePhone(),
  body('businessType').optional().isIn(['restaurant', 'retail']),
  body('address').optional(),
  body('businessHours').optional()
], async (req, res) => {
  console.log('--- PROFILE UPDATE HANDLER REACHED ---');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('Request user:', req.user?.id);
  console.log('Request tenantId:', req.tenantId);
  
  // CRITICAL FIX: Remove empty address object that causes Prisma errors
  if (req.body.address && 
      (!req.body.address.street || req.body.address.street.trim() === '')) {
    console.log('Removing empty address object from request');
    delete req.body.address;
  }
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const merchant = await merchantService.findById(req.user.id);
    
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    // Prepare update data
    const updateData = {};
    // Only include direct merchant fields, exclude relations that need special handling
    const allowedFields = ['businessName', 'email', 'phone', 'businessType'];
    
    // CRITICAL: Exclude system fields that should never be updated by users
    const excludedFields = ['tenantId', 'id', 'createdAt', 'updatedAt'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined && !excludedFields.includes(field)) {
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

    // Update merchant in database with tenant context
    const tenantId = req.tenantId;
    await merchantService.update(merchant.id, updateData, tenantId);

    // Handle address update separately if provided
    // CRITICAL: Only update address if it has actual content, not just empty street
    if (req.body.address && 
        typeof req.body.address === 'object' && 
        req.body.address.street && 
        req.body.address.street.trim().length > 0) {
      const db = require('../utils/prisma');
      
      // Ensure all address fields have values
      const addressData = {
        street: req.body.address.street || '',
        city: req.body.address.city || '',
        state: req.body.address.state || '',
        zipCode: req.body.address.zipCode || '',
        country: req.body.address.country || ''
      };
      
      await db.merchantAddress.upsert({
        where: { merchantId: merchant.id },
        update: addressData,
        create: {
          merchantId: merchant.id,
          ...addressData
        }
      });
    }

    // Handle business hours update separately if provided
    if (req.body.businessHours && typeof req.body.businessHours === 'object') {
      const db = require('../utils/prisma');
      const businessHours = req.body.businessHours;
      
      // Convert object format to array format for database
      const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const dayNameMap = {
        monday: 'Monday',
        tuesday: 'Tuesday', 
        wednesday: 'Wednesday',
        thursday: 'Thursday',
        friday: 'Friday',
        saturday: 'Saturday',
        sunday: 'Sunday'
      };

      for (const day of daysOfWeek) {
        if (businessHours[day]) {
          await db.businessHours.upsert({
            where: { 
              merchantId_dayOfWeek: {
                merchantId: merchant.id,
                dayOfWeek: dayNameMap[day]
              }
            },
            update: {
              start: businessHours[day].start,
              end: businessHours[day].end,
              closed: businessHours[day].closed
            },
            create: {
              merchantId: merchant.id,
              dayOfWeek: dayNameMap[day],
              start: businessHours[day].start,
              end: businessHours[day].end,
              closed: businessHours[day].closed
            }
          });
        }
      }
    }

    // Get the updated merchant details
    const fullMerchant = await merchantService.getFullDetails(merchant.id, tenantId);
    res.json({
      success: true,
      merchant: fullMerchant
    });

  } catch (error) {
    logger.error('Error updating merchant profile:', {
      error: error.message,
      stack: error.stack,
      requestBody: req.body,
      merchantId: req.user?.id,
      tenantId: req.tenantId
    });
    
    // Send more specific error message based on the error type
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Business name already exists' });
    } else if (error.code === 'P2025') {
      res.status(404).json({ error: 'Record not found' });
    } else {
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
});

// PUT /api/merchant/settings/queue - Update queue-specific settings
router.put('/settings/queue', checkQueueStatus(), async (req, res) => {
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
router.put('/settings/notifications', checkQueueStatus(), async (req, res) => {
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

// POST /api/merchant/upload-logo - Upload business logo
router.post('/upload-logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const merchantId = req.session.user.id;
    const logoUrl = `/uploads/merchants/${merchantId}/${req.file.filename}`;

    // Update merchant with logo URL
    await prisma.merchant.update({
      where: { id: merchantId },
      data: { logoUrl }
    });

    res.json({ 
      success: true, 
      logoUrl,
      message: 'Logo uploaded successfully'
    });
  } catch (error) {
    logger.error('Error uploading logo:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// POST /api/merchant/upload-banner - Upload banner image
router.post('/upload-banner', upload.single('banner'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const merchantId = req.session.user.id;
    const bannerUrl = `/uploads/merchants/${merchantId}/${req.file.filename}`;

    // Update merchant with banner URL
    await prisma.merchant.update({
      where: { id: merchantId },
      data: { bannerImageUrl: bannerUrl }
    });

    res.json({ 
      success: true, 
      bannerUrl,
      message: 'Banner uploaded successfully'
    });
  } catch (error) {
    logger.error('Error uploading banner:', error);
    res.status(500).json({ error: 'Failed to upload banner' });
  }
});

// PUT /api/merchant/branding - Update branding settings
router.put('/branding', async (req, res) => {
  try {
    const merchantId = req.session.user.id;
    const { brandColor } = req.body;

    await prisma.merchant.update({
      where: { id: merchantId },
      data: { brandColor }
    });

    res.json({ 
      success: true,
      message: 'Branding settings updated successfully'
    });
  } catch (error) {
    logger.error('Error updating branding:', error);
    res.status(500).json({ error: 'Failed to update branding' });
  }
});

// PUT /api/merchant/settings/mobile - Update mobile display settings
router.put('/settings/mobile', async (req, res) => {
  try {
    const merchantId = req.session.user.id;
    const {
      mobileRefreshInterval,
      mobileDisplayFormat,
      mobileHighlightDuration,
      mobileAutoScroll,
      mobileSoundAlerts,
      mobileVibrationAlerts
    } = req.body;

    // Find or create settings
    const settings = await prisma.merchantSettings.upsert({
      where: { merchantId },
      update: {
        mobileRefreshInterval,
        mobileDisplayFormat,
        mobileHighlightDuration,
        mobileAutoScroll,
        mobileSoundAlerts,
        mobileVibrationAlerts
      },
      create: {
        merchantId,
        mobileRefreshInterval,
        mobileDisplayFormat,
        mobileHighlightDuration,
        mobileAutoScroll,
        mobileSoundAlerts,
        mobileVibrationAlerts
      }
    });

    res.json({
      success: true,
      message: 'Mobile settings updated successfully',
      settings
    });
  } catch (error) {
    logger.error('Error updating mobile settings:', error);
    res.status(500).json({ error: 'Failed to update mobile settings' });
  }
});

// PUT /api/merchant/settings/operations - Update operations settings
router.put('/settings/operations', checkQueueStatus(), async (req, res) => {
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
    
    // Add party size limits
    if (req.body.partySizeRegularMin !== undefined) settingsData.partySizeRegularMin = req.body.partySizeRegularMin;
    if (req.body.partySizeRegularMax !== undefined) settingsData.partySizeRegularMax = req.body.partySizeRegularMax;
    if (req.body.partySizePeakMin !== undefined) settingsData.partySizePeakMin = req.body.partySizePeakMin;
    if (req.body.partySizePeakMax !== undefined) settingsData.partySizePeakMax = req.body.partySizePeakMax;
    
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