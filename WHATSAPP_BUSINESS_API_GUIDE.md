# WhatsApp Business API Migration Guide

## Overview

This guide explains how to migrate from WhatsApp Web.js (browser automation) to the official WhatsApp Business API for commercial use.

## Why Migrate?

1. **Legal Compliance**: WhatsApp Web.js violates WhatsApp's Terms of Service for commercial use
2. **Reliability**: Official API provides better uptime and support
3. **Scalability**: Handle thousands of messages without getting banned
4. **Features**: Access to message templates, analytics, and business features
5. **Support**: Official support from Meta/WhatsApp

## Prerequisites

### 1. Meta Business Account
- Create a Meta Business account at https://business.facebook.com
- Verify your business
- Add your business phone number

### 2. WhatsApp Business API Access
- Apply for WhatsApp Business API access
- Choose a Business Solution Provider (BSP) or use Cloud API
- Get your phone number verified

### 3. Message Templates
- Create and submit message templates for approval
- Templates are required for business-initiated messages
- Allow 24-48 hours for approval

## Implementation Options

### Option 1: WhatsApp Cloud API (Recommended)

**Pros:**
- Direct from Meta
- Free tier available (1,000 conversations/month)
- Easy setup

**Cons:**
- Requires hosting webhook endpoint
- Limited to Meta's infrastructure

**Setup:**
```bash
# Environment variables
META_ACCESS_TOKEN=your_access_token
META_PHONE_NUMBER_ID=your_phone_number_id
META_BUSINESS_ACCOUNT_ID=your_business_account_id
META_WEBHOOK_VERIFY_TOKEN=your_verify_token
WHATSAPP_PROVIDER=meta
```

### Option 2: Twilio WhatsApp Business API

**Pros:**
- Easy integration
- Good documentation
- Reliable infrastructure

**Cons:**
- Additional cost on top of WhatsApp fees
- Goes through Twilio's servers

**Setup:**
```bash
# Environment variables
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890
WHATSAPP_PROVIDER=twilio
```

### Option 3: Other BSPs (MessageBird, Vonage, etc.)

**Pros:**
- Various pricing options
- Additional features
- Regional presence

**Cons:**
- Vendor lock-in
- Variable quality

## Migration Steps

### 1. Set Up Provider Account

#### For WhatsApp Cloud API:
1. Go to https://developers.facebook.com/apps
2. Create a new app (Type: Business)
3. Add WhatsApp product
4. Set up webhook URL
5. Get access tokens

#### For Twilio:
1. Sign up at https://www.twilio.com
2. Enable WhatsApp in console
3. Request WhatsApp-enabled number
4. Configure webhook URLs

### 2. Create Message Templates

Templates must be approved before use. Common templates:

**Queue Joined Template:**
```
Name: queue_joined
Text: Welcome to {{1}}! Your queue number is {{2}}. Current position: {{3}}. Estimated wait: {{4}} minutes. Reply CANCEL to leave the queue.
```

**Queue Ready Template:**
```
Name: queue_ready
Text: It's your turn at {{1}}! Queue number {{2}}. Please proceed to the counter now. Thank you for your patience!
```

### 3. Update Environment Variables

```bash
# .env
# Remove old WhatsApp Web.js variables
# ENABLE_WHATSAPP_WEB=false

# Add Business API variables
WHATSAPP_PROVIDER=twilio  # or 'meta'
TWILIO_ACCOUNT_SID=ACxxxxxx
TWILIO_AUTH_TOKEN=xxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890

# OR for Meta Cloud API
WHATSAPP_PROVIDER=meta
META_ACCESS_TOKEN=EAAxxxxxx
META_PHONE_NUMBER_ID=1234567890
META_WEBHOOK_VERIFY_TOKEN=your_secret_token
```

### 4. Update Code

Replace WhatsApp service initialization:

```javascript
// OLD (whatsapp-web.js)
const whatsappService = require('./services/whatsappService');
await whatsappService.initialize();

// NEW (Business API)
const whatsappBusinessAPI = require('./services/whatsappBusinessAPI');
await whatsappBusinessAPI.initialize();
```

Update message sending:

```javascript
// OLD
await whatsappService.sendMessage(phone, message);

// NEW (for templates - business initiated)
await whatsappBusinessAPI.sendTemplateMessage(
  phone,
  'queue_joined',
  [businessName, queueNumber, position, waitTime]
);

// NEW (for replies - within 24 hour window)
await whatsappBusinessAPI.sendMessage(phone, message);
```

### 5. Set Up Webhooks

#### For Twilio:
Configure webhook URL in Twilio console:
```
https://your-domain.com/api/webhooks/whatsapp/twilio
```

#### For Meta Cloud API:
1. Configure webhook URL in Meta App Dashboard
2. Verify webhook with verify token
3. Subscribe to messages webhook

### 6. Update Routes

```javascript
// server/routes/webhooks.js
router.post('/whatsapp/twilio', async (req, res) => {
  const { Body, From, MessageSid } = req.body;
  await whatsappBusinessAPI.handleWebhook(req.body);
  res.status(200).send('OK');
});

router.post('/whatsapp/meta', async (req, res) => {
  await whatsappBusinessAPI.handleWebhook(req.body);
  res.status(200).send('EVENT_RECEIVED');
});

// Webhook verification for Meta
router.get('/whatsapp/meta', (req, res) => {
  const verify_token = process.env.META_WEBHOOK_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode && token === verify_token) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});
```

## Testing

### 1. Test Template Messages
```javascript
// Test sending a template
const result = await whatsappBusinessAPI.sendTemplateMessage(
  '+60123456789',
  'queue_joined',
  ['StoreHub Restaurant', 'A001', '5', '15']
);
console.log('Template sent:', result);
```

### 2. Test Webhook
```bash
# Test Twilio webhook
curl -X POST http://localhost:3838/api/webhooks/whatsapp/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+60123456789&Body=STATUS&MessageSid=SMxxxxx"
```

### 3. Monitor Logs
```bash
# Check for successful initialization
grep "WhatsApp Business API initialized" logs/app.log

# Check for message sending
grep "WhatsApp message sent" logs/app.log
```

## Pricing

### WhatsApp Cloud API
- First 1,000 conversations free per month
- After that: $0.005 - $0.08 per conversation (varies by country)
- Conversation = 24-hour message window

### Twilio
- WhatsApp fees (same as above) + Twilio markup
- Typically $0.005 - $0.01 additional per message

## Best Practices

1. **Use Templates for Notifications**
   - All business-initiated messages must use approved templates
   - Keep templates simple and clear

2. **Handle Rate Limits**
   - Implement message queuing
   - Respect rate limits (varies by tier)

3. **Monitor Delivery**
   - Track message status via webhooks
   - Handle failures gracefully

4. **Opt-in/Opt-out**
   - Always get user consent
   - Implement STOP/CANCEL commands

5. **24-Hour Session Window**
   - You can send regular messages (non-template) within 24 hours of user's last message
   - After 24 hours, must use templates

## Troubleshooting

### Common Issues

1. **Template Not Approved**
   - Check Meta Business Manager for rejection reasons
   - Common: Too promotional, unclear variables

2. **Phone Number Not Verified**
   - Ensure number is verified in Business Manager
   - Check country code format

3. **Webhook Not Receiving**
   - Verify webhook URL is publicly accessible
   - Check SSL certificate
   - Confirm webhook subscription

4. **Rate Limit Errors**
   - Implement exponential backoff
   - Check your tier limits

## Rollback Plan

If you need to temporarily rollback:

1. Keep whatsapp-web.js code but disabled
2. Set `WHATSAPP_PROVIDER=none` to disable
3. Can switch back with environment variable

## Support Resources

- WhatsApp Business API Docs: https://developers.facebook.com/docs/whatsapp
- Twilio WhatsApp Docs: https://www.twilio.com/docs/whatsapp
- Meta Business Support: https://business.facebook.com/business/help