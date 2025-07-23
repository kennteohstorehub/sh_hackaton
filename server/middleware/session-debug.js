const logger = require('../utils/logger');

// Middleware to debug session issues
const sessionDebugMiddleware = (req, res, next) => {
  // Only in development or when debugging
  if (process.env.NODE_ENV === 'production' && process.env.DEBUG_SESSIONS !== 'true') {
    return next();
  }
  
  // Log session info for every request
  logger.info('Session Debug:', {
    method: req.method,
    path: req.path,
    sessionID: req.sessionID,
    hasSession: !!req.session,
    sessionData: req.session,
    cookies: req.cookies,
    headers: {
      cookie: req.headers.cookie,
      'x-forwarded-proto': req.headers['x-forwarded-proto']
    }
  });
  
  // Log after response
  const originalSend = res.send;
  res.send = function(data) {
    logger.info('Session Debug Response:', {
      statusCode: res.statusCode,
      sessionID: req.sessionID,
      sessionChanged: req.session ? req.session.touched : false
    });
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = sessionDebugMiddleware;