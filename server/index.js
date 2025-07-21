const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('express-flash');
const methodOverride = require('method-override');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
require('dotenv').config();

const logger = require('./utils/logger');
const { 
  configureSecurityMiddleware, 
  generateCSRFToken, 
  csrfProtection,
  authLimiter,
  apiLimiter 
} = require('./middleware/security');
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
const messengerService = require('./services/messengerService');
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

const PORT = process.env.PORT || 3001;

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

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(methodOverride('_method'));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-queue-manager', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  logger.info('Connected to MongoDB');
})
.catch((error) => {
  logger.error('MongoDB connection error:', error);
  logger.warn('Server will continue without database - some features may not work');
  // Don't exit - let the server run without database
});

// Ensure critical environment variables are set
if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET environment variable is required');
  process.exit(1);
}

// Session configuration
app.use(session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-queue-manager',
    touchAfter: 24 * 3600 // lazy session update
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 1000 * 60 * 60 * 2 // 2 hours for better security
  },
  name: 'sessionId' // Use custom name instead of default
}));

app.use(flash());

// Generate CSRF token for all requests
app.use(generateCSRFToken);

// Make io and user data accessible to all routes
app.set('io', io); // Store io instance on app for route access
app.use((req, res, next) => {
  req.io = io;
  res.locals.user = req.session.user || null;
  res.locals.messages = req.flash();
  next();
});

// Apply CSRF protection to all POST/PUT/DELETE routes
app.use(csrfProtection);

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
  const sessionMiddleware = session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-queue-manager',
    })
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
    const initPromises = [
      whatsappService.initialize(io)
        .then(() => logger.info('WhatsApp service initialized'))
        .catch(err => logger.warn('WhatsApp initialization failed (non-critical):', err.message)),
      
      messengerService.initialize(io)
        .then(() => logger.info('Messenger service initialized'))
        .catch(err => logger.warn('Messenger initialization failed (non-critical):', err.message)),
      
      aiService.initialize()
        .then(() => logger.info('AI service initialized'))
        .catch(err => logger.warn('AI service initialization failed (non-critical):', err.message)),
      
      Promise.resolve(chatbotService.setSocketIO(io))
        .then(() => logger.info('Chatbot service initialized'))
    ];
    
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
  logger.error('Unhandled error:', error);
  
  // Check if it's an API request
  if (req.path.startsWith('/api/')) {
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  } else {
    // Render error page for frontend requests
    res.status(500).render('error', {
      title: 'Server Error',
      status: 500,
      message: 'Something went wrong. Please try again later.'
    });
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
    mongoose.connection.close();
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