const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const flash = require('express-flash');
const methodOverride = require('method-override');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();
const { config, initialize: initializeConfig } = require('./config');

const logger = require('./utils/logger');
const { 
  configureSecurityMiddleware, 
  authLimiter,
  apiLimiter 
} = require('./middleware/security');
const { captureRawBody } = require('./middleware/webhook-auth');
// Use safer CSRF middleware that won't crash if session is unavailable
const { 
  csrfTokenManager, 
  csrfValidation, 
  csrfHelpers 
} = require('./middleware/csrf-protection-safe');
const { registerHelpers } = require('./utils/templateHelpers');

// API Routes
const queueRoutes = require('./routes/queue');
const merchantRoutes = require('./routes/merchant');
const customerRoutes = require('./routes/customer');
const analyticsRoutes = require('./routes/analytics');

// Frontend Routes
const dashboardRoutes = require('./routes/frontend/dashboard');
const authRoutes = require('./routes/frontend/auth');
const publicRoutes = require('./routes/frontend/public');

// Services
const whatsappService = require('./services/whatsappService');
const aiService = require('./services/aiService');
const chatbotService = require('./services/chatbotService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3001'],
    methods: ['GET', 'POST']
  }
});

// Initialize configuration with validation
initializeConfig();

const PORT = config.server.port;

// Trust proxy for Render deployment
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY) {
  app.set('trust proxy', true);
  logger.info('Trust proxy enabled for production environment');
}

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Register template security helpers
registerHelpers(app);

// Static files with caching
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '1d',
  etag: true
}));

// Response compression - compress all responses
app.use(compression({
  filter: (req, res) => {
    // Don't compress responses with this request header
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Fallback to standard filter function
    return compression.filter(req, res);
  },
  level: 6 // Balanced compression level
}));

// Apply comprehensive security middleware
configureSecurityMiddleware(app);

// CORS for API routes only
app.use('/api', cors({
  origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3001'],
  credentials: true
}));

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Body parsing middleware with raw body capture for webhooks
app.use(express.json({ 
  limit: '10mb',
  verify: captureRawBody // Capture raw body for webhook signature verification
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  verify: captureRawBody 
}));
app.use(methodOverride('_method'));

// Configuration validation is now handled by initializeConfig()

// Session configuration
const sessionConfig = {
  secret: config.security.sessionSecret,
  ...config.session
};

// Only use PostgreSQL session store if database URL is available
if (config.database.postgres.url || process.env.DATABASE_URL) {
  try {
    sessionConfig.store = new pgSession({
      conString: config.database.postgres.url || process.env.DATABASE_URL,
      tableName: 'session', // This matches our Prisma schema
      ttl: 24 * 60 * 60, // 24 hours
      disableTouch: false,
      createTableIfMissing: true
    });
    logger.info('PostgreSQL session store initialized');
  } catch (error) {
    logger.error('Failed to initialize PostgreSQL session store:', error);
    logger.warn('Falling back to memory session store (not suitable for production)');
  }
} else {
  logger.warn('No PostgreSQL URL provided - using memory session store (not suitable for production)');
}

app.use(session(sessionConfig));

app.use(flash());

// CSRF Protection
app.use(csrfTokenManager);
app.use(csrfHelpers);

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Log incoming request
  logger.info(`Incoming ${req.method} ${req.path}`, {
    sessionId: req.sessionID,
    userId: req.session?.userId,
    hasSession: !!req.session
  });
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (res.statusCode >= 400) {
      logger.error(`Response ${req.method} ${req.path} - ${res.statusCode}`, {
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        sessionId: req.sessionID,
        userId: req.session?.userId
      });
    }
  });
  
  next();
});

// Make io and user data accessible to all routes
app.set('io', io); // Store io instance on app for route access
app.use((req, res, next) => {
  req.io = io;
  res.locals.user = req.session.user || null;
  
  // Ensure messages is always an object
  try {
    res.locals.messages = req.flash ? req.flash() : {};
  } catch (error) {
    logger.warn('Flash messages error:', error);
    res.locals.messages = {};
  }
  
  // Ensure messages has default structure
  if (!res.locals.messages || typeof res.locals.messages !== 'object') {
    res.locals.messages = {};
  }
  if (!res.locals.messages.error) res.locals.messages.error = null;
  if (!res.locals.messages.success) res.locals.messages.success = null;
  
  next();
});

// Apply CSRF validation to all state-changing routes
app.use(csrfValidation);

// Frontend Routes
app.use('/', publicRoutes);
app.use('/auth', authLimiter, authRoutes); // Apply rate limiting to auth routes
app.use('/dashboard', dashboardRoutes);

// API Routes
app.use('/api/queue', queueRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/webhooks', require('./routes/webhooks'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Socket.IO authentication middleware
io.use((socket, next) => {
  let sessionStore;
  
  // Try to create PostgreSQL session store
  if (config.database.postgres.url || process.env.DATABASE_URL) {
    try {
      sessionStore = new pgSession({
        conString: config.database.postgres.url || process.env.DATABASE_URL,
        tableName: 'session',
        ttl: 24 * 60 * 60
      });
    } catch (error) {
      logger.warn('Socket.IO: Failed to create PostgreSQL session store, using memory store');
    }
  }
  
  const sessionMiddleware = session({
    secret: config.security.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: sessionStore
  });
  
  sessionMiddleware(socket.request, {}, next);
});

// Socket.IO connection handling with authentication
io.on('connection', (socket) => {
  const session = socket.request.session;
  
  if (!session || !session.user) {
    logger.warn(`Unauthorized socket connection attempt: ${socket.id}`);
    socket.disconnect();
    return;
  }
  
  logger.info(`Client connected: ${socket.id}, User: ${session.user.email}`);
  
  socket.on('join-merchant-room', (merchantId) => {
    // Verify the user has access to this merchant
    if (session.user.id === merchantId || session.user.merchantId === merchantId) {
      socket.join(`merchant-${merchantId}`);
      logger.info(`Merchant ${merchantId} joined room`);
    } else {
      logger.warn(`Unauthorized room join attempt by ${session.user.email} for merchant ${merchantId}`);
    }
  });
  
  socket.on('join-customer-room', (customerId) => {
    // For now, allow customers to join their own rooms
    // In production, validate the customer ID against session
    socket.join(`customer-${customerId}`);
    logger.info(`Customer ${customerId} joined room`);
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Initialize services
const initializeServices = async () => {
  try {
    // Initialize services with individual error handling
    const initPromises = [];
    
    // Only initialize WhatsApp if enabled
    if (process.env.ENABLE_WHATSAPP_WEB !== 'false') {
      initPromises.push(
        whatsappService.initialize(io)
          .then(() => logger.info('WhatsApp service initialized'))
          .catch(err => logger.warn('WhatsApp initialization failed (non-critical):', err.message))
      );
    } else {
      logger.info('WhatsApp service disabled by ENABLE_WHATSAPP_WEB=false');
    }
    
    // Always initialize AI service
    initPromises.push(
      aiService.initialize()
        .then(() => logger.info('AI service initialized'))
        .catch(err => logger.warn('AI service initialization failed (non-critical):', err.message))
    );
    
    // Always initialize chatbot service
    initPromises.push(
      Promise.resolve(chatbotService.setSocketIO(io))
        .then(() => logger.info('Chatbot service initialized'))
    );
    
    // Wait for all services to initialize (failures won't stop the server)
    await Promise.allSettled(initPromises);
    logger.info('Service initialization complete');
    
  } catch (error) {
    logger.error('Error initializing services:', error);
    // Don't exit on service initialization failure - app can still work partially
  }
};

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    sessionId: req.sessionID,
    userId: req.session?.userId,
    body: req.body,
    query: req.query
  });
  
  // Prevent sending headers twice
  if (res.headersSent) {
    return next(error);
  }
  
  try {
    // Check if it's an API request
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } else {
      // Render error page for frontend requests
      res.status(500).render('error', {
        title: 'Server Error',
        status: 500,
        message: 'Something went wrong. Please try again later.',
        error: process.env.NODE_ENV === 'development' ? error : null
      });
    }
  } catch (renderError) {
    // If rendering fails, send plain text response
    logger.error('Error rendering error page:', renderError);
    res.status(500).send('Internal Server Error');
  }
});

// 404 handler
app.use('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'API route not found' });
  } else {
    res.status(404).render('error', {
      title: 'Page Not Found',
      status: 404,
      message: 'The page you are looking for does not exist.'
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

server.listen(PORT, () => {
  logger.info(`StoreHub Queue Management System server running on port ${PORT}`);
  logger.info(`Frontend available at: http://localhost:${PORT}`);
  logger.info(`API available at: http://localhost:${PORT}/api`);
  
  // Initialize services in the background (non-blocking)
  initializeServices().catch(err => {
    logger.error('Failed to initialize some services:', err);
    logger.info('Server is still running - some features may be limited');
  });
});

module.exports = { app, io }; 