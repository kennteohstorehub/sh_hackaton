# StoreHub Queue Management System - Technical Specification

## 1. System Architecture

### 1.1 Technology Stack
- **Backend**: Node.js + Express.js
- **Database**: MongoDB with Mongoose ODM
- **Frontend**: EJS templates + vanilla JavaScript
- **Real-time**: Socket.IO
- **Security**: Helmet.js, CSP, rate limiting
- **Session**: express-session with MongoStore

### 1.2 Project Structure
```
├── server/
│   ├── index.js                 # Main server file
│   ├── models/
│   │   ├── Queue.js            # Queue schema with embedded entries
│   │   └── Merchant.js         # Merchant account schema
│   ├── routes/
│   │   ├── queue.js            # Queue management API
│   │   ├── customer.js         # Customer operations
│   │   ├── merchant.js         # Merchant management
│   │   ├── analytics.js        # Analytics endpoints
│   │   └── frontend/           # Frontend routes
│   ├── services/
│   │   ├── whatsappService.js  # WhatsApp integration (demo)
│   │   ├── messengerService.js # Messenger integration (stub)
│   │   ├── aiService.js        # AI sentiment analysis
│   │   └── chatbotService.js   # Automated responses
│   └── utils/
│       └── logger.js           # Winston logging
├── views/                      # EJS templates
│   ├── dashboard/              # Management interface
│   ├── queue-info.ejs         # Customer status view
│   └── join-queue.ejs         # Queue joining form
└── public/                     # Static assets
```

## 2. Database Schema

### 2.1 Queue Model
```javascript
{
  merchantId: ObjectId,           // Business owner reference
  name: "Restaurant Queue",       // Queue display name
  description: String,            // Queue description
  isActive: Boolean,              // Operational status
  maxCapacity: 50,                // Maximum customers
  averageServiceTime: 25,         // Minutes per customer
  currentServing: Number,         // Current position being served
  entries: [                      // Customer array
    {
      customerId: String,         // Unique identifier
      customerName: String,       // Display name
      customerPhone: String,      // For notifications
      partySize: Number,          // 1-20 people
      platform: "web",           // Entry method
      position: Number,           // Queue position
      estimatedWaitTime: Number,  // Minutes
      status: "waiting|called|completed",
      priority: "normal",         // Priority level
      serviceType: String,        // Service category
      joinedAt: Date,             // Entry timestamp
      calledAt: Date,             // Notification time
      completedAt: Date,          // Service completion
      notificationCount: Number,  // Messages sent
      sentimentScore: Number      // AI analysis (-1 to 1)
    }
  ],
  settings: {
    autoNotifications: true,
    notificationInterval: 5,      // Minutes
    allowCancellation: true,
    requireConfirmation: true,
    businessHours: {
      start: "09:00",
      end: "17:00",
      timezone: "UTC"
    }
  },
  analytics: {
    totalServed: Number,
    averageWaitTime: Number,
    averageServiceTime: Number,
    customerSatisfaction: Number,
    noShowRate: Number
  }
}
```

## 3. API Endpoints

### 3.1 Queue Management
```
GET    /api/queue                    # List all queues
POST   /api/queue                    # Create new queue
GET    /api/queue/:id                # Get queue details
PUT    /api/queue/:id                # Update queue
DELETE /api/queue/:id                # Delete queue
```

### 3.2 Customer Operations
```
POST   /api/queue/:id/join           # Join queue
POST   /api/queue/:id/call-next      # Notify next customer
POST   /api/queue/:id/call-specific  # Notify specific customer
POST   /api/queue/:id/complete/:customerId  # Mark as seated
DELETE /api/queue/:id/remove/:customerId    # Remove customer
```

### 3.3 Frontend Routes
```
GET    /                            # Customer queue joining
GET    /queue/:id                   # Queue status view
GET    /dashboard                   # Management dashboard
GET    /dashboard/queues            # Queue management
GET    /dashboard/analytics         # Analytics view
```

## 4. Real-time Features

### 4.1 Socket.IO Events
```javascript
// Client joins rooms
socket.emit('join-merchant-room', merchantId);
socket.emit('join-customer-room', customerId);

// Server broadcasts updates
io.to(`merchant-${merchantId}`).emit('queue-updated', {
  queueId: String,
  action: 'customer-joined|customer-called|customer-completed',
  customer: Object,
  queue: { currentLength, nextPosition }
});

// Customer notifications
io.to(`customer-${customerId}`).emit('customer-called', {
  queueName: String,
  position: Number,
  priority: Boolean
});
```

### 4.2 Dashboard Updates
- Real-time customer list updates
- Live statistics recalculation
- Interactive row transformations
- Immediate UI feedback for actions

## 5. Key Features Implemented

### 5.1 Customer Flow
1. **Join Queue**: Web form with name, phone, party size
2. **Wait**: Real-time position and wait time updates
3. **Notification**: WhatsApp message when turn arrives
4. **Service**: Staff marks as seated, customer removed

### 5.2 Staff Management
1. **Dashboard**: Overview with live statistics
2. **Customer List**: Sortable with party size indicators
3. **Notify Actions**: 
   - "Notify Next Customer" for sequential processing
   - Individual "Notify" buttons for selective calling
4. **Status Management**: Waiting → Notified → Seated flow
5. **Interactive UI**: Immediate row updates, animations

### 5.3 Party Size Management
- Color-coded badges: Green (1-2), Yellow (3-4), Red (5-6+)
- Table matching assistance for staff
- Capacity planning based on group sizes

### 5.4 Notification System
- WhatsApp integration (demo mode)
- Messenger integration (stub for future)
- Priority notifications for out-of-order calls
- Confirmation dialogs for queue jumping

## 6. Security Implementation

### 6.1 Content Security Policy
```javascript
{
  defaultSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
  scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
  scriptSrcAttr: ["'unsafe-inline'"],  // Enables onclick handlers
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  imgSrc: ["'self'", "data:", "https:"],
  connectSrc: ["'self'", "ws:", "wss:"]
}
```

### 6.2 Rate Limiting
- 100 requests per 15-minute window
- Applied to all API endpoints
- Prevents abuse and DoS attacks

### 6.3 Input Validation
- express-validator for all inputs
- Phone number validation
- Party size limits (1-20)
- XSS protection via sanitization

## 7. User Interface

### 7.1 Design System
- **Primary Color**: RGB(255, 140, 0) - Orange theme
- **Responsive**: Mobile-first design
- **Typography**: Clean, readable fonts
- **Animations**: Smooth transitions for state changes

### 7.2 Customer Interface
- Simple queue joining form
- Real-time status display
- Mobile-optimized layout
- Clear position and wait time

### 7.3 Management Dashboard
- Statistics overview cards
- Interactive customer grid
- Real-time updates without refresh
- Color-coded party size indicators
- Smooth row animations for state changes

## 8. Performance Optimizations

### 8.1 Database
- Indexed queries on merchantId, status, joinedAt
- Embedded documents for queue entries
- Efficient aggregation pipelines for analytics

### 8.2 Frontend
- Debounced search functionality
- Efficient DOM updates with requestAnimationFrame
- Minimal JavaScript bundle size
- CSS-based animations for performance

### 8.3 Real-time
- Room-based Socket.IO for targeted updates
- Efficient event payload design
- Connection pooling and cleanup

## 9. Integration Services

### 9.1 WhatsApp Service (Demo Mode)
```javascript
// Simulated WhatsApp integration
async sendMessage(phoneNumber, message) {
  logger.info(`[DEMO] Sending WhatsApp to ${phoneNumber}: ${message}`);
  return { success: true, messageId: 'demo-' + Date.now() };
}
```

### 9.2 AI Service
- Simple sentiment analysis
- Keyword-based scoring
- Customer feedback processing
- Future ML integration ready

### 9.3 Messenger Service
- Stub implementation for future development
- Webhook structure prepared
- Integration points defined

## 10. Deployment Configuration

### 10.1 Environment Variables
```bash
PORT=3001
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/smart-queue-manager
JWT_SECRET=your-secret-key
SESSION_SECRET=your-session-secret
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 10.2 Production Setup
- Node.js 18+ runtime
- MongoDB 5.0+ database
- SSL/TLS certificates
- Process management (PM2)
- Reverse proxy (Nginx)
- Log rotation and monitoring

## 11. Testing Strategy

### 11.1 Manual Testing Completed
- Customer queue joining flow
- Staff notification workflow
- Real-time updates verification
- Mobile responsiveness
- Cross-browser compatibility

### 11.2 Automated Testing (Future)
- Unit tests for models and services
- API endpoint integration tests
- Frontend component testing
- End-to-end workflow testing

## 12. Current Status

### 12.1 Completed Features ✅
- Complete queue management system
- Real-time dashboard with Socket.IO
- Interactive customer notifications
- Party size management with color coding
- WhatsApp integration (demo mode)
- Responsive design with orange theme
- Content Security Policy configuration
- Database optimization and indexing

### 12.2 Demo Ready ✅
- Fully functional web application
- Clean database with test data capability
- Interactive UI with immediate feedback
- Real-time statistics and updates
- Mobile-responsive design

### 12.3 Future Enhancements
- Production WhatsApp API integration
- Facebook Messenger implementation
- Advanced analytics dashboard
- Multi-location support
- Mobile application development

---

**Document Version**: 1.0  
**Last Updated**: June 11, 2025  
**Implementation Status**: Complete - Phase 1  
**Demo Ready**: Yes 