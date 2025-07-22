const express = require('express');
const router = express.Router();
const telegramService = require('../services/telegramService');
const logger = require('../utils/logger');

// Webhook endpoint for Telegram updates (production)
router.post('/webhook', async (req, res) => {
  try {
    await telegramService.handleWebhook(req.body);
    res.sendStatus(200);
  } catch (error) {
    logger.error('Telegram webhook error:', error);
    res.sendStatus(500);
  }
});

// Set webhook URL (admin endpoint)
router.post('/setup-webhook', async (req, res) => {
  if (!req.session.user?.role === 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const webhookUrl = `${process.env.APP_URL}/api/telegram/webhook`;
    await telegramService.bot.setWebHook(webhookUrl);
    
    res.json({ 
      success: true, 
      message: 'Telegram webhook configured',
      url: webhookUrl 
    });
  } catch (error) {
    logger.error('Failed to setup Telegram webhook:', error);
    res.status(500).json({ error: 'Failed to setup webhook' });
  }
});

module.exports = router;