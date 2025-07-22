const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Webhook Signature Verification Middleware
 * 
 * Protects webhook endpoints from unauthorized access by verifying
 * cryptographic signatures sent with the request.
 */

/**
 * Create a webhook verification middleware for a specific service
 * 
 * @param {Object} options Configuration options
 * @param {string} options.secret The webhook secret key
 * @param {string} options.headerName The header containing the signature
 * @param {string} options.algorithm The hashing algorithm (default: sha256)
 * @param {Function} options.getPayload Custom function to get the payload to verify
 * @param {number} options.tolerance Time tolerance in seconds (default: 300)
 */
const createWebhookVerifier = (options) => {
  const {
    secret,
    headerName,
    algorithm = 'sha256',
    getPayload = (req) => JSON.stringify(req.body),
    tolerance = 300 // 5 minutes
  } = options;

  if (!secret) {
    throw new Error('Webhook secret is required');
  }

  if (!headerName) {
    throw new Error('Header name is required');
  }

  return async (req, res, next) => {
    try {
      const signature = req.headers[headerName.toLowerCase()];
      
      if (!signature) {
        logger.warn('Webhook request missing signature', {
          url: req.url,
          ip: req.ip,
          headers: Object.keys(req.headers)
        });
        return res.status(401).json({ error: 'Missing webhook signature' });
      }

      // Get the payload to verify
      const payload = getPayload(req);
      
      // Extract timestamp if included in signature (format: "t=timestamp,sig=signature")
      let timestamp = null;
      let actualSignature = signature;
      
      if (signature.includes(',')) {
        const parts = signature.split(',');
        for (const part of parts) {
          const [key, value] = part.split('=');
          if (key === 't') {
            timestamp = parseInt(value, 10);
          } else if (key === 'sig' || key === 'v1') {
            actualSignature = value;
          }
        }
      }

      // Verify timestamp if present (prevent replay attacks)
      if (timestamp) {
        const currentTime = Math.floor(Date.now() / 1000);
        const timeDiff = Math.abs(currentTime - timestamp);
        
        if (timeDiff > tolerance) {
          logger.warn('Webhook timestamp outside tolerance', {
            url: req.url,
            timeDiff,
            tolerance
          });
          return res.status(401).json({ error: 'Webhook timestamp too old' });
        }
      }

      // Calculate expected signature
      const signedPayload = timestamp ? `${timestamp}.${payload}` : payload;
      const expectedSignature = crypto
        .createHmac(algorithm, secret)
        .update(signedPayload, 'utf8')
        .digest('hex');

      // Compare signatures using timing-safe comparison
      const signatureBuffer = Buffer.from(actualSignature);
      const expectedBuffer = Buffer.from(expectedSignature);
      
      if (signatureBuffer.length !== expectedBuffer.length) {
        logger.warn('Webhook signature length mismatch', {
          url: req.url,
          expected: expectedBuffer.length,
          actual: signatureBuffer.length
        });
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        logger.warn('Invalid webhook signature', {
          url: req.url,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        });
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      // Signature is valid
      logger.info('Webhook signature verified', {
        url: req.url,
        service: options.service || 'unknown'
      });
      
      // Add webhook metadata to request
      req.webhook = {
        verified: true,
        timestamp,
        signature: actualSignature
      };

      next();
    } catch (error) {
      logger.error('Webhook verification error:', error);
      res.status(500).json({ error: 'Webhook verification failed' });
    }
  };
};

/**
 * Pre-configured webhook verifiers for common services
 */

// WhatsApp webhook verifier - lazy initialization
const whatsappWebhookAuth = (req, res, next) => {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('WhatsApp webhook secret not configured, skipping verification');
    return next();
  }
  
  const verifier = createWebhookVerifier({
    secret,
    headerName: 'x-hub-signature-256',
    algorithm: 'sha256',
    service: 'whatsapp',
    getPayload: (req) => {
      // WhatsApp sends the raw body
      return req.rawBody || JSON.stringify(req.body);
    }
  });
  
  return verifier(req, res, next);
};


// Generic webhook verifier (for custom integrations) - lazy initialization
const genericWebhookAuth = (req, res, next) => {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('Generic webhook secret not configured, skipping verification');
    return next();
  }
  
  const verifier = createWebhookVerifier({
    secret,
    headerName: 'x-webhook-signature',
    algorithm: 'sha256',
    service: 'generic'
  });
  
  return verifier(req, res, next);
};

/**
 * Middleware to capture raw body for webhook verification
 * Must be used before body parsers
 */
const captureRawBody = (req, res, buf, encoding) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
};

/**
 * Webhook challenge verification for initial setup
 */
const handleWebhookChallenge = (req, res, next) => {
  // Facebook/WhatsApp webhook verification
  if (req.method === 'GET' && req.query['hub.mode'] === 'subscribe') {
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    const expectedToken = process.env.FB_VERIFY_TOKEN || process.env.WEBHOOK_VERIFY_TOKEN;
    
    if (token === expectedToken) {
      logger.info('Webhook challenge verified', {
        service: req.path.includes('whatsapp') ? 'whatsapp' : 'messenger'
      });
      return res.status(200).send(challenge);
    } else {
      logger.warn('Invalid webhook verify token', {
        url: req.url,
        providedToken: token ? 'provided' : 'missing'
      });
      return res.status(403).json({ error: 'Invalid verify token' });
    }
  }
  
  next();
};

module.exports = {
  createWebhookVerifier,
  whatsappWebhookAuth,
  genericWebhookAuth,
  captureRawBody,
  handleWebhookChallenge
};