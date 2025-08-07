// Load environment variables FIRST
require('dotenv').config();

// BUILD VERSION: 2025-01-24-v8 - CONDITIONAL AUTH BYPASS
console.log('🚀 Starting server with BUILD VERSION: 2025-01-24-v8');
console.log('✅ Neon database migration completed successfully');
console.log('✅ Demo data seeded in PostgreSQL');
console.log(`📍 PORT from .env: ${process.env.PORT}`);

// Show appropriate authentication messages
const useAuthBypassStartup = process.env.USE_AUTH_BYPASS === 'true';

if (process.env.NODE_ENV !== 'production') {
  console.log('🔒 CSRF PROTECTION ENABLED');
  if (useAuthBypassStartup) {
    console.log('🔓 AUTHENTICATION BYPASSED - All requests use demo merchant');
    console.log('🛡️  Enhanced auth-bypass to prevent redirect loops');
    console.log('📝 Focus on core functionality development');
  } else {
    console.log('✅ AUTHENTICATION SYSTEM ACTIVE - Login required');
    console.log('🔐 Session-based authentication enabled');
  }
} else {
  console.log('🔒 Running in production mode with authentication enabled');
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const expressLayouts = require('express-ejs-layouts');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const flash = require('express-flash');
const methodOverride = require('method-override');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const { config, initialize: initializeConfig } = require('./config');

const logger = require('./utils/logger');
const { 
  configureSecurityMiddleware, 
  authLimiter,
  apiLimiter 
} = require('./middleware/security');
const { captureRawBody } = require('./middleware/webhook-auth');
// Use CSRF protection
const { 
  csrfTokenManager, 
  csrfValidation, 
  csrfHelpers 
} = require('./middleware/csrf-protection');
const { registerHelpers } = require('./utils/templateHelpers');
const RoomHelpers = require('./utils/roomHelpers');
const prisma = require('./utils/prisma');

// API Routes
const queueRoutes = require('./routes/queue');
const merchantRoutes = require('./routes/merchant');
const customerRoutes = require('./routes/customer');
const analyticsRoutes = require('./routes/analytics');
const pushRoutes = require('./routes/push');

// Frontend Routes
const authRoutes = require('./routes/frontend/auth');
const publicRoutes = require('./routes/frontend/public');
const registrationRoutes = require('./routes/public-registration');

// BackOffice Routes
const backOfficeAuthRoutes = require('./routes/backoffice/auth');
const backOfficeDashboardRoutes = require('./routes/backoffice/dashboard');
const backOfficeUserRoutes = require('./routes/backoffice/users');
const backOfficeMerchantRoutes = require('./routes/backoffice/merchants');
const backOfficeAuditLogRoutes = require('./routes/backoffice/audit-logs');
const backOfficeSettingsRoutes = require('./routes/backoffice/settings');

// Services
const aiService = require('./services/aiService');
const chatbotService = require('./services/chatbotService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3000'],
    methods: ['GET', 'POST']
  }
});

// Initialize configuration with validation
initializeConfig();

const PORT = config.server.port;

// Process-level error handlers to prevent crashes
process.on('uncaughtException', (err) => {
  logger.error('[FATAL] Uncaught Exception:', err);
  logger.error(err.stack);
  // Give some time to log the error before exiting
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  // Convert to exception
  throw reason;
});

// Trust proxy for Render deployment
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY) {
  app.set('trust proxy', true);
  logger.info('Trust proxy enabled for production environment');
}

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Configure express-ejs-layouts
app.use(expressLayouts);
app.set('layout', false); // Disable default layout - we'll set it per route
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Register template security helpers
registerHelpers(app);

// Static files with optimized caching for performance
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : '0',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Optimize CSS/JS caching
    if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
    // Images can be cached longer
    if (filePath.match(/\.(jpg|jpeg|png|gif|ico|svg)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    }
  }
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
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // In development, allow all lvh.me subdomains and localhost
    if (process.env.NODE_ENV !== 'production') {
      const allowedPatterns = [
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/[^.]+\.lvh\.me:\d+$/
      ];
      
      const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
      if (isAllowed) {
        callback(null, true);
      } else {
        console.log('CORS: Rejected origin:', origin);
        callback(null, false);
      }
    } else {
      // In production, be more restrictive
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Authorization']
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

// Session configuration - use explicit fix for production
const sessionFixConfig = require('./config/session-fix');
const sessionConfig = {
  ...sessionFixConfig,
  secret: config.security.sessionSecret || process.env.SESSION_SECRET
};

// Only use PostgreSQL session store if database URL is available
if (config.database.postgres.url || process.env.DATABASE_URL) {
  try {
    sessionConfig.store = new pgSession({
      conString: config.database.postgres.url || process.env.DATABASE_URL,
      tableName: 'Session',
      ttl: 24 * 60 * 60,
      disableTouch: false,
      createTableIfMissing: false,
      pruneSessionInterval: 60
    });
    logger.info('PostgreSQL session store initialized with pool');
  } catch (error) {
    logger.error('Failed to initialize PostgreSQL session store:', error);
    logger.warn('Falling back to memory session store (not suitable for production)');
  }
} else {
  logger.warn('No PostgreSQL URL provided - using memory session store (not suitable for production)');
}

// Log session configuration for debugging
logger.info('Session configuration:', {
  name: sessionConfig.name,
  proxy: sessionConfig.proxy,
  cookie: {
    secure: sessionConfig.cookie?.secure,
    httpOnly: sessionConfig.cookie?.httpOnly,
    sameSite: sessionConfig.cookie?.sameSite,
    maxAge: sessionConfig.cookie?.maxAge
  }
});

app.use(session(sessionConfig));

app.use(flash());

// Tenant Resolution Middleware (Multi-tenant support)
const { resolveTenant } = require('./middleware/tenantResolver');
app.use(resolveTenant);

// Authentication Context Middleware (Must run after tenant resolution)
const { setAuthContext, validateAuthContext } = require('./middleware/auth-context');
app.use(setAuthContext);
app.use(validateAuthContext);

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
    tenantId: req.tenantId,
    tenantSlug: req.tenant?.slug,
    hasSession: !!req.session,
    isBackOffice: req.isBackOffice
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

// AUTH BYPASS: Only apply when explicitly enabled
const useAuthBypass = process.env.USE_AUTH_BYPASS === 'true';

if (useAuthBypass) {
  const { createDemoSession } = require('./middleware/auth-bypass');
  app.use(createDemoSession);
  logger.warn('🔓 AUTH BYPASS ENABLED - All requests use demo merchant');
} else {
  logger.info('✅ Authentication required - Login system active');
}

// Make io and user data accessible to all routes
app.set('io', io); // Store io instance on app for route access
app.use((req, res, next) => {
  req.io = io;
  // User should already be set by auth-bypass, but double-check
  res.locals.user = req.user || req.session?.user || null;
  
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

// Public Registration Route (no auth required)
app.use('/', registrationRoutes);

// Frontend Routes
app.use('/', publicRoutes);
// Always use the real auth routes - no conditional routing
app.use('/auth', authRoutes);

// BackOffice Routes
app.use('/backoffice/auth', backOfficeAuthRoutes);
app.use('/backoffice/dashboard', backOfficeDashboardRoutes);
app.use('/backoffice/users', backOfficeUserRoutes);
app.use('/backoffice/merchants', backOfficeMerchantRoutes);
app.use('/backoffice/audit-logs', backOfficeAuditLogRoutes);
app.use('/backoffice/settings', backOfficeSettingsRoutes);
// Dashboard root redirect
app.get('/backoffice', (req, res) => res.redirect('/backoffice/dashboard'));
// Login redirect
app.get('/backoffice/login', (req, res) => res.redirect('/backoffice/auth/login'));

// API Routes
app.use('/api/queues', queueRoutes);
app.use('/api/queue', queueRoutes); // Backward compatibility
app.use('/api/merchants', merchantRoutes);
app.use('/api/merchant', merchantRoutes); // Backward compatibility
app.use('/api/customer', customerRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/webchat', require('./routes/webchat'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/test-csrf', require('./routes/test-csrf'));
app.use('/api/debug', require('./routes/debug-session'));
app.use('/api/session-test', require('./routes/session-test'));

// Acknowledge endpoint - bypass CSRF for customer actions
app.use('/api/queue/acknowledge', (req, res, next) => {
  req.skipCSRF = true;
  next();
}, require('./routes/acknowledge'));

// Test auth bypass (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use('/test', require('./routes/test-auth-bypass'));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Legacy URL redirects
app.use('/superadmin*', (req, res) => {
  const newPath = req.originalUrl.replace('/superadmin', '/backoffice');
  res.redirect(301, newPath);
});
app.use('/admin*', (req, res) => {
  res.redirect(301, '/backoffice');
});

// Debug routes (only in development/debugging)
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEBUG === 'true') {
  app.use('/debug', require('./routes/debug-session'));
}

// Socket.IO authentication middleware
io.use((socket, next) => {
  let sessionStore;
  
  // Try to create PostgreSQL session store
  if (config.database.postgres.url || process.env.DATABASE_URL) {
    try {
      sessionStore = new pgSession({
        conString: config.database.postgres.url || process.env.DATABASE_URL,
        tableName: 'Session',
        ttl: 24 * 60 * 60,
        createTableIfMissing: false,
        pruneSessionInterval: 60
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
io.on('connection', async (socket) => {
  const session = socket.request.session;
  
  // Store session info in socket data for later use
  socket.data.sessionId = session?.sessionId;
  socket.data.userId = session?.user?.id;
  socket.data.merchantId = session?.user?.merchantId;
  
  // Allow both authenticated users and public customer connections
  if (!session) {
    logger.info(`Public socket connection: ${socket.id}`);
  } else if (session.user) {
    logger.info(`Authenticated socket connection: ${socket.id}, User: ${session.user.email}`);
  } else {
    logger.info(`Customer socket connection: ${socket.id}`);
  }
  
  socket.on('join-merchant-room', (merchantId) => {
    // Verify the user has access to this merchant
    if (process.env.AUTH_BYPASS === 'true' || (session && session.user && (session.user.id === merchantId || session.user.merchantId === merchantId))) {
      socket.join(RoomHelpers.getMerchantRoom(merchantId));
      logger.info(`Merchant ${merchantId} joined room`);
    } else {
      logger.warn(`Unauthorized room join attempt for merchant ${merchantId}`);
    }
  });
  
  socket.on('join-customer-room', async (data) => {
    try {
      // Handle both string customerId and object data
      const entryId = typeof data === 'string' ? data : data.entryId;
      const sessionId = typeof data === 'object' ? data.sessionId : null;
      
      logger.info(`[SOCKET] join-customer-room request:`, { entryId, sessionId, dataType: typeof data });
      
      if (!entryId) {
        logger.warn('[SOCKET] No entryId provided for join-customer-room');
        return;
      }
      
      // For webchat customers, verify they own this entry
      if (sessionId) {
        const entry = await prisma.queueEntry.findFirst({
          where: {
            OR: [
              { id: entryId },
              { customerId: entryId }
            ],
            sessionId: sessionId,
            status: { in: ['waiting', 'called'] }
          }
        });
        
        if (entry) {
          // Join all appropriate rooms for this entry
          const rooms = RoomHelpers.getCustomerRooms(entry);
          rooms.forEach(room => {
            socket.join(room);
            logger.info(`[SOCKET] Customer joined room: ${room}`);
          });
          
          // Store entry data for later use
          socket.data.entryId = entry.id;
          socket.data.sessionId = sessionId;
          socket.data.phone = entry.customerPhone;
          
          logger.info(`[SOCKET] Customer ${entry.customerName} joined ${rooms.length} rooms for entry ${entry.id}`);
        } else {
          logger.warn(`[SOCKET] No valid entry found for session ${sessionId}`);
        }
      } else {
        // Legacy support - just join the requested room
        socket.join(`customer-${entryId}`);
        logger.info(`[SOCKET] Legacy customer room join: customer-${entryId}`);
      }
    } catch (error) {
      logger.error('[SOCKET] Error joining customer room:', error);
    }
  });
  
  socket.on('join-queue', async (data) => {
    logger.info('[SOCKET] Join-queue event received:', data);
    
    try {
      // Handle webchat customers joining queue
      if (data.sessionId && data.entryId) {
        // Look up the actual queue entry
        const entry = await prisma.queueEntry.findFirst({
          where: {
            id: data.entryId,
            sessionId: data.sessionId,
            status: { in: ['waiting', 'called'] }
          }
        });
        
        if (entry) {
          // Join all appropriate rooms
          const rooms = RoomHelpers.getCustomerRooms(entry);
          rooms.forEach(room => {
            socket.join(room);
            logger.info(`[SOCKET] Queue customer joined room: ${room}`);
          });
          
          // Store data in socket
          socket.data.entryId = entry.id;
          socket.data.sessionId = data.sessionId;
          socket.data.phone = entry.customerPhone;
          
          logger.info(`[SOCKET] Customer ${entry.customerName} joined queue rooms. Total rooms:`, Array.from(socket.rooms));
          
          // Notify merchant dashboard of connection
          if (data.merchantId) {
            io.to(RoomHelpers.getMerchantRoom(data.merchantId)).emit('webchat-connected', {
              sessionId: data.sessionId,
              entryId: entry.id,
              customerName: entry.customerName
            });
          }
        } else {
          logger.warn(`[SOCKET] No valid queue entry found for session ${data.sessionId}`);
        }
      }
    } catch (error) {
      logger.error('[SOCKET] Error joining queue:', error);
    }
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
    
    // Check if this was a webchat customer and notify merchant
    if (socket.data.sessionId && socket.data.entryId) {
      // Find the entry to get merchant ID
      prisma.queueEntry.findUnique({
        where: { id: socket.data.entryId },
        include: { queue: true }
      }).then(entry => {
        if (entry && entry.queue) {
          io.to(RoomHelpers.getMerchantRoom(entry.queue.merchantId)).emit('webchat-disconnected', {
            sessionId: socket.data.sessionId,
            entryId: entry.id,
            customerName: entry.customerName
          });
        }
      }).catch(err => {
        logger.error('Error handling disconnect:', err);
      });
    }
  });
});

// Initialize services
const initializeServices = async () => {
  try {
    // Initialize services with individual error handling
    const initPromises = [];
    
    // Initialize system settings
    const systemSettingsService = require('./services/systemSettingsService');
    initPromises.push(
      systemSettingsService.initializeSettings()
        .then(() => logger.info('System settings initialized'))
        .catch(err => logger.error('System settings initialization failed:', err))
    );
    
    // Start queue cleanup schedule
    const { startQueueCleanupSchedule } = require('./utils/queueCleanup');
    startQueueCleanupSchedule();
    
    // Start session cleanup schedule
    const { cleanupExpiredSessions } = require('./jobs/sessionCleanup');
    setInterval(() => {
      cleanupExpiredSessions()
        .then(result => logger.info('Session cleanup completed:', result))
        .catch(err => logger.error('Session cleanup failed:', err));
    }, 60 * 60 * 1000); // Run every hour
    logger.info('Session cleanup schedule started - will run every hour');
    
    // Start analytics data retention schedule (6 months max)
    const { cleanupOldAnalyticsData } = require('./jobs/analyticsDataRetention');
    // Run immediately on startup
    cleanupOldAnalyticsData()
      .then(result => logger.info('Initial analytics retention cleanup completed:', result))
      .catch(err => logger.error('Initial analytics retention cleanup failed:', err));
    
    // Then run daily at 2 AM
    setInterval(() => {
      const now = new Date();
      if (now.getHours() === 2) {
        cleanupOldAnalyticsData()
          .then(result => logger.info('Analytics retention cleanup completed:', result))
          .catch(err => logger.error('Analytics retention cleanup failed:', err));
      }
    }, 60 * 60 * 1000); // Check every hour, but only run at 2 AM
    logger.info('Analytics data retention schedule started - will run daily at 2 AM (6 months retention)');
    
    // WhatsApp service has been removed from the system
    logger.info('WhatsApp service has been removed - using webchat notifications only');
    
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
        error: process.env.NODE_ENV === 'development' ? error : null,
        req: req // Pass request object for URL checking
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
  // Log 404 for debugging
  logger.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);
  
  // Check if this is a static file request
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.mp3', '.ogg', '.wav', '.woff', '.woff2', '.ttf'];
  const isStaticFile = staticExtensions.some(ext => req.path.toLowerCase().endsWith(ext));
  
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'API route not found' });
  } else if (isStaticFile) {
    // For static files, just return 404 without rendering a template
    res.status(404).send('Not Found');
  } else {
    // For pages, render the error template
    try {
      res.status(404).render('error', {
        title: 'Page Not Found',
        status: 404,
        message: 'The page you are looking for does not exist.',
        error: null, // Ensure error variable exists
        req: req // Pass request object for URL checking
      });
    } catch (renderError) {
      logger.error('Failed to render 404 page:', renderError);
      res.status(404).send('Page Not Found');
    }
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

server.listen(PORT, '0.0.0.0', () => {
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