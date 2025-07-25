const express = require('express');
const logger = require('../utils/logger');
const { 
  whatsappWebhookAuth, 
  messengerWebhookAuth,
  handleWebhookChallenge 
} = require('../middleware/webhook-auth');
const whatsappService = require('../services/whatsappService');
const whatsappBusinessAPI = require('../services/whatsappBusinessAPI');
const messengerService = require('../services/messengerService');

const router = express.Router();

/**
 * WhatsApp Webhook Endpoint
 * Handles both verification challenges and incoming messages
 */
router.all('/whatsapp', handleWebhookChallenge, whatsappWebhookAuth, async (req, res) => {
  try {
    if (req.method === 'POST') {
      // Process incoming WhatsApp message
      const { entry } = req.body;
      
      if (entry && entry.length > 0) {
        for (const item of entry) {
          const changes = item.changes;
          if (changes && changes.length > 0) {
            for (const change of changes) {
              if (change.field === 'messages') {
                const messageData = change.value;
                
                // Process the message
                await whatsappService.handleIncomingWebhook(messageData);
              }
            }
          }
        }
      }
      
      // Always respond quickly to webhooks
      res.status(200).json({ status: 'received' });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    logger.error('WhatsApp webhook error:', error);
    // Still return 200 to prevent webhook retries
    res.status(200).json({ status: 'error', message: 'Internal processing error' });
  }
});

/**
 * Facebook Messenger Webhook Endpoint
 */
router.all('/messenger', handleWebhookChallenge, messengerWebhookAuth, async (req, res) => {
  try {
    if (req.method === 'POST') {
      const { object, entry } = req.body;
      
      if (object === 'page' && entry && entry.length > 0) {
        // Process each entry
        for (const pageEntry of entry) {
          const { messaging } = pageEntry;
          
          if (messaging && messaging.length > 0) {
            for (const messagingEvent of messaging) {
              // Handle different types of events
              if (messagingEvent.message) {
                await messengerService.handleIncomingMessage(messagingEvent);
              } else if (messagingEvent.postback) {
                await messengerService.handlePostback(messagingEvent);
              }
            }
          }
        }
      }
      
      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    logger.error('Messenger webhook error:', error);
    // Still return 200 to prevent webhook retries
    res.status(200).send('EVENT_RECEIVED');
  }
});

/**
 * WhatsApp Business API - Twilio Webhook
 */
router.post('/whatsapp/twilio', async (req, res) => {
  try {
    logger.info('Twilio WhatsApp webhook received', {
      from: req.body.From,
      body: req.body.Body?.substring(0, 50)
    });

    await whatsappBusinessAPI.handleWebhook(req.body);
    
    // Twilio expects TwiML or empty response
    res.status(200).send('');
  } catch (error) {
    logger.error('Twilio webhook error:', error);
    res.status(200).send(''); // Still return 200 to prevent retries
  }
});

/**
 * WhatsApp Business API - Meta Cloud API Webhook
 */
router.get('/whatsapp/meta', (req, res) => {
  // Webhook verification for Meta
  const verify_token = process.env.META_WEBHOOK_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode && token === verify_token) {
    logger.info('Meta webhook verified');
    res.status(200).send(challenge);
  } else {
    logger.warn('Meta webhook verification failed');
    res.sendStatus(403);
  }
});

router.post('/whatsapp/meta', async (req, res) => {
  try {
    logger.info('Meta WhatsApp webhook received', {
      object: req.body.object
    });

    if (req.body.object === 'whatsapp_business_account') {
      await whatsappBusinessAPI.handleWebhook(req.body);
    }
    
    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    logger.error('Meta webhook error:', error);
    res.status(200).send('EVENT_RECEIVED'); // Still return 200
  }
});

/**
 * Generic webhook endpoint for other integrations
 */
router.post('/generic/:integration', async (req, res) => {
  try {
    const { integration } = req.params;
    
    logger.info('Generic webhook received', {
      integration,
      verified: req.webhook?.verified || false,
      bodySize: JSON.stringify(req.body).length
    });
    
    // Process based on integration type
    switch (integration) {
      case 'payment':
        // Handle payment webhooks
        break;
      case 'notification':
        // Handle notification service webhooks
        break;
      default:
        logger.warn('Unknown webhook integration:', integration);
    }
    
    res.status(200).json({ status: 'received' });
  } catch (error) {
    logger.error('Generic webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;