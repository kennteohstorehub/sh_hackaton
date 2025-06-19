# StoreHub Queue Management System - Technical Specification

## 1. System Overview

### 1.1 Architecture Pattern
**Model-View-Controller (MVC)** architecture with real-time capabilities:
- **Model**: MongoDB with Mongoose ODM
- **View**: EJS templates with client-side JavaScript
- **Controller**: Express.js route handlers
- **Real-time Layer**: Socket.IO for live updates

### 1.2 Technology Stack Details

#### Backend Technologies
- **Runtime**: Node.js v18+
- **Framework**: Express.js v4.18+
- **Database**: MongoDB v5.0+ with Mongoose ODM
- **Real-time**: Socket.IO v4.7+
- **Session Management**: express-session with connect-mongo
- **Security**: Helmet.js, express-rate-limit
- **Validation**: express-validator
- **Logging**: Custom Winston-based logger

#### Frontend Technologies
- **Template Engine**: EJS (Embedded JavaScript)
- **Styling**: CSS3 with custom responsive design
- **JavaScript**: ES6+ with async/await patterns
- **Real-time Client**: Socket.IO client
- **HTTP Client**: Fetch API for AJAX requests

## 2. Database Design

### 2.1 MongoDB Collections

#### 2.1.1 Queues Collection
```javascript
{
  _id: ObjectId,
  merchantId: ObjectId,           // Reference to merchant
  name: String,                   // "Restaurant Queue"
  description: String,            // Queue description
  isActive: Boolean,              // Queue operational status
  maxCapacity: Number,            // Maximum customers (default: 50)
  averageServiceTime: Number,     // Service time in minutes (default: 15)
  currentServing: Number,         // Current serving position
  entries: [                      // Embedded customer entries
    {
      _id: ObjectId,              // Auto-generated entry ID
      customerId: String,         // Unique customer identifier
      customerName: String,       // Customer display name
      customerPhone: String,      // Phone for notifications
      partySize: Number,          // Party size (1-20, default: 1)
      platform: String,           // "web", "whatsapp", "messenger"
      position: Number,           // Queue position
      estimatedWaitTime: Number,  // Wait time in minutes
      status: String,             // "waiting", "called", "completed"
      priority: String,           // "normal", "high", "urgent"
      serviceType: String,        // Service category
      notes: String,              // Additional notes
      joinedAt: Date,             // Queue join timestamp
      calledAt: Date,             // Notification timestamp
      completedAt: Date,          // Service completion timestamp
      notificationCount: Number,  // Notifications sent count
      sentimentScore: Number,     // AI sentiment (-1 to 1)
      feedback: {                 // Customer feedback
        rating: Number,           // 1-5 star rating
        comment: String,          // Feedback text
        submittedAt: Date         // Feedback timestamp
      }
    }
  ],
  settings: {                     // Queue configuration
    autoNotifications: Boolean,   // Auto-notify customers
    notificationInterval: Number, // Notification frequency (minutes)
    allowCancellation: Boolean,   // Allow customer cancellation
    requireConfirmation: Boolean, // Require arrival confirmation
    businessHours: {              // Operating hours
      start: String,              // "09:00"
      end: String,                // "17:00"
      timezone: String            // "UTC"
    }
  },
  analytics: {                    // Performance metrics
    totalServed: Number,          // Total customers served
    averageWaitTime: Number,      // Average wait time
    averageServiceTime: Number,   // Average service time
    customerSatisfaction: Number, // Average satisfaction score
    noShowRate: Number,           // No-show percentage
    lastUpdated: Date             // Last analytics update
  },
  createdAt: Date,                // Queue creation timestamp
  updatedAt: Date                 // Last modification timestamp
}
```

#### 2.1.2 Merchants Collection
```javascript
{
  _id: ObjectId,
  email: String,                  // Merchant email
  businessName: String,           // Business name
  businessType: String,           // "restaurant", "retail", etc.
  contactInfo: {
    phone: String,
    address: String,
    city: String,
    country: String
  },
  subscription: {
    plan: String,                 // "free", "premium", "enterprise"
    status: String,               // "active", "suspended", "cancelled"
    expiresAt: Date
  },
  integrations: {
    whatsapp: {
      enabled: Boolean,
      phoneNumber: String,
      apiKey: String
    },
    messenger: {
      enabled: Boolean,
      pageId: String,
      accessToken: String
    }
  },
  settings: {
    timezone: String,
    language: String,
    notifications: {
      email: Boolean,
      sms: Boolean,
      push: Boolean
    }
  },
  createdAt: Date,
  updatedAt: Date
}
```

### 2.2 Database Indexes
```javascript
// Performance optimization indexes
db.queues.createIndex({ merchantId: 1, isActive: 1 });
db.queues.createIndex({ "entries.customerId": 1 });
db.queues.createIndex({ "entries.status": 1 });
db.queues.createIndex({ "entries.joinedAt": 1 });
db.merchants.createIndex({ email: 1 }, { unique: true });
```

## 3. API Design

### 3.1 RESTful API Endpoints

#### 3.1.1 Queue Management
```javascript
// GET /api/queue - List all queues for merchant
Response: {
  success: Boolean,
  queues: [Queue],
  pagination: { page, limit, total }
}

// POST /api/queue - Create new queue
Request: {
  name: String,
  description: String,
  maxCapacity: Number,
  averageServiceTime: Number
}
Response: {
  success: Boolean,
  queue: Queue,
  message: String
}

// GET /api/queue/:id - Get specific queue
Response: {
  success: Boolean,
  queue: Queue
}

// PUT /api/queue/:id - Update queue settings
Request: {
  name?: String,
  description?: String,
  maxCapacity?: Number,
  isActive?: Boolean,
  settings?: Object
}
Response: {
  success: Boolean,
  queue: Queue,
  message: String
}
```

#### 3.1.2 Customer Operations
```javascript
// POST /api/queue/:id/join - Join queue
Request: {
  customerName: String,
  customerPhone: String,
  partySize?: Number,
  serviceType?: String,
  notes?: String
}
Response: {
  success: Boolean,
  customer: QueueEntry,
  position: Number,
  estimatedWaitTime: Number,
  queueInfo: {
    name: String,
    currentLength: Number
  }
}

// POST /api/queue/:id/call-next - Notify next customer
Response: {
  success: Boolean,
  customer: QueueEntry,
  queue: {
    currentLength: Number,
    nextPosition: Number
  }
}

// POST /api/queue/:id/call-specific - Notify specific customer
Request: {
  customerId: String
}
Response: {
  success: Boolean,
  customer: QueueEntry,
  queue: Object
}

// POST /api/queue/:id/complete/:customerId - Mark customer as seated
Response: {
  success: Boolean,
  customer: QueueEntry,
  queue: {
    currentLength: Number,
    nextPosition: Number
  }
}
```

### 3.2 Error Handling
```javascript
// Standard error response format
{
  success: false,
  error: String,              // Error message
  code?: String,              // Error code
  details?: Object,           // Additional error details
  timestamp: Date
}

// HTTP Status Codes
200 - Success
201 - Created
400 - Bad Request (validation errors)
401 - Unauthorized
403 - Forbidden
404 - Not Found
429 - Too Many Requests
500 - Internal Server Error
```

## 4. Real-time Communication

### 4.1 Socket.IO Events

#### 4.1.1 Client to Server Events
```javascript
// Join merchant room for updates
socket.emit('join-merchant-room', merchantId);

// Join customer room for personal updates
socket.emit('join-customer-room', customerId);
```

#### 4.1.2 Server to Client Events
```javascript
// Queue updated event
socket.emit('queue-updated', {
  queueId: String,
  action: String,           // 'customer-joined', 'customer-called', 'customer-completed'
  customer?: QueueEntry,
  queue: {
    currentLength: Number,
    nextPosition: Number,
    entries?: [QueueEntry]
  }
});

// Customer-specific events
socket.emit('customer-called', {
  queueName: String,
  position: Number,
  priority?: Boolean
});

socket.emit('service-completed', {
  queueName: String,
  completedAt: Date
});
```

### 4.2 Room Management
```javascript
// Merchant rooms: `merchant-${merchantId}`
// Customer rooms: `customer-${customerId}`
// Queue rooms: `queue-${queueId}`
```

## 5. Security Implementation

### 5.1 Content Security Policy
```javascript
// CSP Configuration in server/index.js
{
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdn.socket.io"],
    scriptSrcAttr: ["'unsafe-inline'"],  // Allow onclick handlers
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "ws:", "wss:"]
  }
}
```

### 5.2 Rate Limiting
```javascript
// API rate limiting configuration
{
  windowMs: 15 * 60 * 1000,    // 15 minutes
  max: 100,                    // 100 requests per window
  message: 'Too many API requests from this IP'
}
```

### 5.3 Input Validation
```javascript
// Example validation for queue joining
[
  body('customerName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be 1-100 characters'),
  body('customerPhone')
    .isMobilePhone()
    .withMessage('Valid phone number required'),
  body('partySize')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Party size must be 1-20')
]
```

## 6. Service Integrations

### 6.1 WhatsApp Service
```javascript
// WhatsApp service implementation
class WhatsAppService {
  async initialize(io) {
    // Initialize WhatsApp client (demo mode)
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: { headless: true }
    });
    
    this.client.on('ready', () => {
      logger.info('WhatsApp client is ready! (demo mode)');
    });
  }
  
  async sendMessage(phoneNumber, message) {
    // Demo mode - log message instead of sending
    logger.info(`[DEMO] Sending WhatsApp message to ${phoneNumber}: ${message}`);
    return { success: true, messageId: 'demo-' + Date.now() };
  }
}
```

### 6.2 AI Service
```javascript
// AI service for sentiment analysis
class AIService {
  async analyzeSentiment(text) {
    // Simple sentiment analysis implementation
    const positiveWords = ['good', 'great', 'excellent', 'happy', 'satisfied'];
    const negativeWords = ['bad', 'terrible', 'awful', 'angry', 'frustrated'];
    
    const words = text.toLowerCase().split(' ');
    let score = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) score += 0.1;
      if (negativeWords.includes(word)) score -= 0.1;
    });
    
    return Math.max(-1, Math.min(1, score));
  }
}
```

## 7. Frontend Implementation

### 7.1 Dashboard JavaScript Architecture
```javascript
// Main dashboard functionality
class QueueDashboard {
  constructor() {
    this.socket = io();
    this.initializeEventListeners();
    this.setupRealTimeUpdates();
  }
  
  // Real-time updates via Socket.IO
  setupRealTimeUpdates() {
    this.socket.on('queue-updated', (data) => {
      this.updateQueueDisplay(data);
      this.updateQueueStats(data);
      this.updateTotalWaitingCount();
    });
  }
  
  // Customer notification with UI feedback
  async notifyNext(queueId) {
    const button = document.querySelector(`button[onclick*="notifyNext('${queueId}')"]`);
    this.setButtonLoading(button, 'Sending...');
    
    try {
      const response = await fetch(`/api/queue/${queueId}/call-next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.updateCustomerRowToNotified(result.customer);
        this.showAlert(`Notified: ${result.customer.customerName}`);
      } else {
        this.showAlert(result.error, 'error');
        this.resetButton(button, 'Notify');
      }
    } catch (error) {
      this.showAlert('Error notifying customer', 'error');
      this.resetButton(button, 'Notify');
    }
  }
}
```

### 7.2 Responsive Design Implementation
```css
/* Mobile-first responsive design */
.container {
  max-width: 1200px;
  margin: 2rem auto;
  padding: 0 2rem;
}

@media (max-width: 768px) {
  .container {
    padding: 0 1rem;
  }
  
  .customer-list-header,
  .customer-row {
    grid-template-columns: 80px 1fr 60px 80px;
    gap: 0.5rem;
  }
  
  .customer-row .phone,
  .customer-row .wait-time {
    display: none;
  }
}

/* Color-coded party size badges */
.pax-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
}

.pax-1, .pax-2 { background: #d4edda; color: #155724; }
.pax-3, .pax-4 { background: #fff3cd; color: #856404; }
.pax-5, .pax-6 { background: #f8d7da; color: #721c24; }
```

## 8. Performance Optimization

### 8.1 Database Optimization
```javascript
// Efficient queue queries with projection
const queue = await Queue.findOne(
  { _id: queueId, merchantId },
  { 
    'entries.status': 1,
    'entries.customerName': 1,
    'entries.position': 1,
    'entries.joinedAt': 1
  }
);

// Aggregation pipeline for analytics
const analytics = await Queue.aggregate([
  { $match: { merchantId: ObjectId(merchantId) } },
  { $unwind: '$entries' },
  { $match: { 'entries.status': 'completed' } },
  { $group: {
    _id: null,
    avgWaitTime: { $avg: '$entries.waitTime' },
    totalServed: { $sum: 1 }
  }}
]);
```

### 8.2 Frontend Optimization
```javascript
// Debounced search functionality
const debouncedSearch = debounce((query) => {
  searchCustomers(query);
}, 300);

// Efficient DOM updates
function updateCustomerRowToNotified(customer) {
  const row = document.querySelector(`[data-customer-id="${customer.customerId}"]`);
  if (row) {
    row.classList.add('notified-customer');
    // Batch DOM updates
    requestAnimationFrame(() => {
      updatePositionBadge(row);
      updateActionButton(row, customer);
      updateStats();
    });
  }
}
```

## 9. Error Handling and Logging

### 9.1 Centralized Error Handling
```javascript
// Global error handler middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  
  if (req.path.startsWith('/api/')) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  } else {
    res.status(500).render('error', { error: 'Something went wrong' });
  }
});
```

### 9.2 Logging Configuration
```javascript
// Winston logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'smart-queue-manager' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

## 10. Testing Strategy

### 10.1 Unit Testing
```javascript
// Example test for queue model
describe('Queue Model', () => {
  test('should add customer to queue', () => {
    const queue = new Queue({ name: 'Test Queue' });
    const customer = queue.addCustomer({
      customerName: 'John Doe',
      customerPhone: '1234567890'
    });
    
    expect(customer.position).toBe(1);
    expect(queue.currentLength).toBe(1);
  });
  
  test('should remove customer from queue', () => {
    const queue = new Queue({ name: 'Test Queue' });
    const customer = queue.addCustomer({ customerName: 'John Doe' });
    const removed = queue.removeCustomer(customer.customerId);
    
    expect(removed).toBeTruthy();
    expect(queue.currentLength).toBe(0);
  });
});
```

### 10.2 Integration Testing
```javascript
// API endpoint testing
describe('Queue API', () => {
  test('POST /api/queue/:id/join should add customer', async () => {
    const response = await request(app)
      .post(`/api/queue/${queueId}/join`)
      .send({
        customerName: 'Test Customer',
        customerPhone: '1234567890',
        partySize: 2
      })
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.customer.position).toBe(1);
  });
});
```

## 11. Deployment Configuration

### 11.1 Environment Variables
```bash
# Server configuration
PORT=3001
NODE_ENV=production

# Database
MONGODB_URI=mongodb://localhost:27017/smart-queue-manager

# Security
JWT_SECRET=your-jwt-secret-key
SESSION_SECRET=your-session-secret

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# External services
WHATSAPP_API_KEY=your-whatsapp-api-key
MESSENGER_ACCESS_TOKEN=your-messenger-token

# Logging
LOG_LEVEL=info
```

### 11.2 Production Deployment
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD ["node", "server/index.js"]
```

### 11.3 Docker Compose
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/smart-queue-manager
    depends_on:
      - mongo
  
  mongo:
    image: mongo:5.0
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

---

**Document Version**: 1.0  
**Last Updated**: June 11, 2025  
**Prepared By**: Smart Queue Manager Development Team  
**Status**: Implementation Complete - Phase 1 