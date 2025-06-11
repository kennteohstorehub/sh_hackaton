const express = require('express');
const { body, validationResult } = require('express-validator');
const Merchant = require('../models/Merchant');
const logger = require('../utils/logger');

const router = express.Router();

// Mock user for demo purposes
const mockUser = {
  id: '507f1f77bcf86cd799439011',
  email: 'demo@smartqueue.com',
  businessName: 'Demo Restaurant',
  businessType: 'restaurant'
};

// Middleware to set mock user for API
const setMockUser = (req, res, next) => {
  req.session.user = mockUser;
  next();
};

// GET /api/merchant/profile - Get merchant profile
router.get('/profile', setMockUser, async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.session.user.id);
    
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    res.json({
      success: true,
      merchant: merchant.toJSON()
    });

  } catch (error) {
    logger.error('Error fetching merchant profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/merchant/profile - Update merchant profile
router.put('/profile', setMockUser, [
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

    const merchant = await Merchant.findById(req.session.user.id);
    
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

    // Handle settings update if provided
    if (req.body.settings) {
      // Merge settings with existing settings
      merchant.settings = {
        ...merchant.settings.toObject(),
        ...req.body.settings
      };
    }

    await merchant.save();

    // Update session data
    req.session.user.businessName = merchant.businessName;
    req.session.user.businessType = merchant.businessType;
    req.session.user.email = merchant.email;

    res.json({
      success: true,
      merchant: merchant.toJSON()
    });

  } catch (error) {
    logger.error('Error updating merchant profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router; 