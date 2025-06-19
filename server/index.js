const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
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

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdn.socket.io"],
      scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers like onclick
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

// CORS for API routes only
app.use('/api', cors({
  origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3001'],
  credentials: true
}));

// Rate limiting for API
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many API requests from this IP, please try again later.'
});
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
  process.exit(1);
});

// Session configuration
app.use(session({
  secret: process.env.JWT_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-queue-manager',
    touchAfter: 24 * 3600 // lazy session update
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  }
}));

app.use(flash());

// Make io and user data accessible to all routes
app.use((req, res, next) => {
  req.io = io;
  res.locals.user = req.session.user || null;
  res.locals.messages = req.flash();
  next();
});

// Frontend Routes
app.use('/', publicRoutes);
app.use('/auth', authRoutes);
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

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('join-merchant-room', (merchantId) => {
    socket.join(`merchant-${merchantId}`);
    logger.info(`Merchant ${merchantId} joined room`);
  });
  
  socket.on('join-customer-room', (customerId) => {
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
    // Initialize WhatsApp service
    await whatsappService.initialize(io);
    logger.info('WhatsApp service initialized');
    
    // Initialize Messenger service
    await messengerService.initialize(io);
    logger.info('Messenger service initialized');
    
    // Initialize AI service
    await aiService.initialize();
    logger.info('AI service initialized');
    
    // Initialize chatbot service
    chatbotService.setSocketIO(io);
    logger.info('Chatbot service initialized');
    
  } catch (error) {
    logger.error('Error initializing services:', error);
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

server.listen(PORT, async () => {
  logger.info(`StoreHub Queue Management System server running on port ${PORT}`);
  logger.info(`Frontend available at: http://localhost:${PORT}`);
  logger.info(`API available at: http://localhost:${PORT}/api`);
  await initializeServices();
});

module.exports = { app, io }; 