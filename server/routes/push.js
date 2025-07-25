const express = require('express');
const router = express.Router();
const pushNotificationService = require('../services/pushNotificationService');
const logger = require('../utils/logger');

// GET /api/push/vapid-public-key - Get VAPID public key for client
router.get('/vapid-public-key', (req, res) => {
  try {
    const publicKey = pushNotificationService.getPublicKey();
    res.json({ publicKey });
  } catch (error) {
    logger.error('Error getting VAPID public key:', error);
    res.status(500).json({ error: 'Failed to get public key' });
  }
});

// POST /api/push/subscribe - Save push subscription
router.post('/subscribe', async (req, res) => {
  try {
    const { queueEntryId, subscription } = req.body;

    if (!queueEntryId || !subscription) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const saved = await pushNotificationService.saveSubscription(queueEntryId, subscription);
    
    if (saved) {
      res.json({ success: true, message: 'Subscription saved' });
    } else {
      res.status(500).json({ error: 'Failed to save subscription' });
    }

  } catch (error) {
    logger.error('Error saving push subscription:', error);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// POST /api/push/test - Test push notification (for development)
router.post('/test', async (req, res) => {
  try {
    const { queueEntryId } = req.body;

    if (!queueEntryId) {
      return res.status(400).json({ error: 'Queue entry ID required' });
    }

    const sent = await pushNotificationService.notifyTableReady(
      queueEntryId,
      'TEST001',
      'Test Restaurant'
    );

    if (sent) {
      res.json({ success: true, message: 'Test notification sent' });
    } else {
      res.status(500).json({ error: 'Failed to send notification' });
    }

  } catch (error) {
    logger.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

module.exports = router;