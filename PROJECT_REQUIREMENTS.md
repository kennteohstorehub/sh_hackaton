# Smart Queue Manager - Project Requirements Document

## 1. Project Overview

### 1.1 Project Name
**Smart Queue Manager** - Digital Queue Management System for Shopping Mall Restaurants

### 1.2 Project Description
A comprehensive web-based queue management system designed to reduce customer friction during peak hours by enabling digital queue joining and real-time notifications via WhatsApp and Facebook Messenger. The system focuses on shopping mall restaurants where customers are physically present and can check queue status while in the vicinity.

### 1.3 Project Objectives
- **Primary Goal**: Reduce customer wait time friction and improve dining experience
- **Secondary Goals**: 
  - Streamline restaurant operations
  - Provide real-time queue visibility
  - Enable efficient table management based on party sizes
  - Integrate with popular messaging platforms (WhatsApp/Messenger)

## 2. Functional Requirements

### 2.1 Customer-Facing Features

#### 2.1.1 Queue Joining
- **REQ-CF-001**: Customers can join the queue via web interface
- **REQ-CF-002**: System collects customer name, phone number, and party size (1-20 people)
- **REQ-CF-003**: System provides estimated wait time upon joining
- **REQ-CF-004**: System assigns unique position number to each customer
- **REQ-CF-005**: Customers receive confirmation with queue position and estimated wait time

#### 2.1.2 Queue Status Monitoring
- **REQ-CF-006**: Customers can view current queue status and their position
- **REQ-CF-007**: Real-time updates of queue progression
- **REQ-CF-008**: Display of current wait time based on actual queue movement

#### 2.1.3 Notification System
- **REQ-CF-009**: WhatsApp notifications when customer's turn approaches
- **REQ-CF-010**: Facebook Messenger integration for notifications (future)
- **REQ-CF-011**: Priority notifications for customers called out of order
- **REQ-CF-012**: Notification includes queue name, position, and instructions

### 2.2 Restaurant Management Features

#### 2.2.1 Dashboard Overview
- **REQ-RM-001**: Real-time dashboard showing queue statistics
- **REQ-RM-002**: Display total queues, currently waiting customers, average wait time, daily customer count
- **REQ-RM-003**: Single queue view optimized for shopping mall restaurant operations
- **REQ-RM-004**: Queue capacity management (max 50 customers)

#### 2.2.2 Customer Management
- **REQ-RM-005**: View all customers in queue with details (name, phone, party size, wait time)
- **REQ-RM-006**: Color-coded party size indicators:
  - 1-2 pax: Green badge
  - 3-4 pax: Yellow badge  
  - 5-6+ pax: Red badge
- **REQ-RM-007**: Position-based queue ordering with "NEXT" indicator for first customer
- **REQ-RM-008**: Real-time wait time calculation and display

#### 2.2.3 Queue Operations
- **REQ-RM-009**: "Notify Next Customer" functionality for sequential processing
- **REQ-RM-010**: Selective customer notification (override queue order)
- **REQ-RM-011**: Customer status management: Waiting → Notified → Seated
- **REQ-RM-012**: Interactive row updates with immediate UI feedback
- **REQ-RM-013**: Customer removal upon seating with fade animations
- **REQ-RM-014**: Confirmation dialogs for out-of-order notifications

#### 2.2.4 Analytics and Reporting
- **REQ-RM-015**: Real-time statistics calculation and display
- **REQ-RM-016**: Average wait time based on actual customer data
- **REQ-RM-017**: Daily customer count tracking
- **REQ-RM-018**: Queue performance metrics

## 3. Technical Requirements

### 3.1 Architecture
- **REQ-TECH-001**: Node.js backend with Express.js framework
- **REQ-TECH-002**: MongoDB database for data persistence
- **REQ-TECH-003**: EJS templating engine for server-side rendering
- **REQ-TECH-004**: Socket.IO for real-time updates
- **REQ-TECH-005**: RESTful API design for all operations

### 3.2 Frontend Requirements
- **REQ-TECH-006**: Responsive web design for mobile and desktop
- **REQ-TECH-007**: Real-time UI updates without page refreshes
- **REQ-TECH-008**: Interactive animations for state changes
- **REQ-TECH-009**: Orange color theme (RGB 255,140,0) throughout application
- **REQ-TECH-010**: Accessibility compliance for public interfaces

### 3.3 Backend Requirements
- **REQ-TECH-011**: Session-based authentication for merchant dashboard
- **REQ-TECH-012**: Mock user system for demo purposes
- **REQ-TECH-013**: Comprehensive error handling and logging
- **REQ-TECH-014**: Input validation and sanitization
- **REQ-TECH-015**: Rate limiting for API endpoints

### 3.4 Database Requirements
- **REQ-TECH-016**: MongoDB with Mongoose ODM
- **REQ-TECH-017**: Queue model with embedded customer entries
- **REQ-TECH-018**: Merchant model for business account management
- **REQ-TECH-019**: Automatic position management and recalculation
- **REQ-TECH-020**: Data persistence for queue state and customer history

### 3.5 Integration Requirements
- **REQ-TECH-021**: WhatsApp Business API integration (demo mode implemented)
- **REQ-TECH-022**: Facebook Messenger API integration (stub implementation)
- **REQ-TECH-023**: AI service integration for sentiment analysis
- **REQ-TECH-024**: Chatbot service for automated responses

## 4. Non-Functional Requirements

### 4.1 Performance
- **REQ-PERF-001**: Page load time < 3 seconds
- **REQ-PERF-002**: Real-time updates with < 1 second latency
- **REQ-PERF-003**: Support for 50 concurrent customers per queue
- **REQ-PERF-004**: Database queries optimized with proper indexing

### 4.2 Security
- **REQ-SEC-001**: Content Security Policy (CSP) implementation
- **REQ-SEC-002**: Helmet.js security middleware
- **REQ-SEC-003**: Input validation and XSS protection
- **REQ-SEC-004**: Session security with HTTP-only cookies
- **REQ-SEC-005**: Rate limiting to prevent abuse

### 4.3 Reliability
- **REQ-REL-001**: 99% uptime availability
- **REQ-REL-002**: Graceful error handling with user-friendly messages
- **REQ-REL-003**: Data consistency in queue operations
- **REQ-REL-004**: Automatic recovery from connection failures

### 4.4 Usability
- **REQ-USE-001**: Intuitive interface requiring no training
- **REQ-USE-002**: Mobile-first responsive design
- **REQ-USE-003**: Clear visual feedback for all actions
- **REQ-USE-004**: Consistent UI patterns throughout application

## 5. System Architecture

### 5.1 Technology Stack
- **Frontend**: HTML5, CSS3, JavaScript (ES6+), EJS Templates
- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Real-time**: Socket.IO
- **Security**: Helmet.js, express-rate-limit
- **Session Management**: express-session with MongoStore
- **Messaging**: WhatsApp Business API, Facebook Messenger API

### 5.2 Application Structure
```
├── server/
│   ├── index.js                 # Main server file
│   ├── models/                  # Database models
│   │   ├── Queue.js            # Queue and customer entry schema
│   │   └── Merchant.js         # Business account schema
│   ├── routes/                  # API and frontend routes
│   │   ├── queue.js            # Queue management API
│   │   ├── customer.js         # Customer operations API
│   │   ├── merchant.js         # Merchant management API
│   │   ├── analytics.js        # Analytics and reporting API
│   │   └── frontend/           # Frontend route handlers
│   ├── services/               # External service integrations
│   │   ├── whatsappService.js  # WhatsApp integration
│   │   ├── messengerService.js # Messenger integration
│   │   ├── aiService.js        # AI and sentiment analysis
│   │   └── chatbotService.js   # Automated chat responses
│   └── utils/                  # Utility functions
│       └── logger.js           # Application logging
├── views/                      # EJS templates
│   ├── dashboard/              # Management interface
│   ├── queue-info.ejs         # Customer queue status
│   └── join-queue.ejs         # Customer queue joining
└── public/                     # Static assets
```

### 5.3 Data Models

#### 5.3.1 Queue Model
```javascript
{
  merchantId: ObjectId,           // Reference to merchant
  name: String,                   // Queue name
  description: String,            // Queue description
  isActive: Boolean,              // Queue status
  maxCapacity: Number,            // Maximum customers (50)
  averageServiceTime: Number,     // Service time in minutes
  entries: [QueueEntry],          // Customer entries array
  settings: {                     // Queue configuration
    autoNotifications: Boolean,
    notificationInterval: Number,
    allowCancellation: Boolean,
    requireConfirmation: Boolean
  },
  analytics: {                    // Performance metrics
    totalServed: Number,
    averageWaitTime: Number,
    customerSatisfaction: Number
  }
}
```

#### 5.3.2 Queue Entry Model
```javascript
{
  customerId: String,             // Unique customer identifier
  customerName: String,           // Customer name
  customerPhone: String,          // Phone number for notifications
  partySize: Number,              // Number of people (1-20)
  position: Number,               // Queue position
  estimatedWaitTime: Number,      // Estimated wait in minutes
  status: String,                 // waiting|called|completed
  priority: String,               // normal|high|urgent
  joinedAt: Date,                 // Queue join timestamp
  calledAt: Date,                 // Notification timestamp
  completedAt: Date,              // Service completion timestamp
  notificationCount: Number,      // Number of notifications sent
  sentimentScore: Number          // AI sentiment analysis (-1 to 1)
}
```

## 6. API Specifications

### 6.1 Queue Management APIs
- `GET /api/queue` - List all queues
- `POST /api/queue` - Create new queue
- `GET /api/queue/:id` - Get queue details
- `PUT /api/queue/:id` - Update queue settings
- `DELETE /api/queue/:id` - Delete queue

### 6.2 Customer Management APIs
- `POST /api/queue/:id/join` - Join queue
- `POST /api/queue/:id/call-next` - Notify next customer
- `POST /api/queue/:id/call-specific` - Notify specific customer
- `POST /api/queue/:id/complete/:customerId` - Mark customer as seated
- `DELETE /api/queue/:id/remove/:customerId` - Remove customer from queue

### 6.3 Analytics APIs
- `GET /api/analytics/queue/:id` - Queue performance metrics
- `GET /api/analytics/merchant/:id` - Merchant analytics
- `GET /api/analytics/daily` - Daily statistics

## 7. User Interface Requirements

### 7.1 Customer Interface
- **Clean, mobile-optimized queue joining form**
- **Real-time queue status display**
- **Clear position and wait time information**
- **Responsive design for various screen sizes**

### 7.2 Management Dashboard
- **Comprehensive queue overview with statistics**
- **Interactive customer list with management actions**
- **Real-time updates without page refreshes**
- **Color-coded party size indicators**
- **Smooth animations for state changes**

### 7.3 Design System
- **Primary Color**: RGB(255, 140, 0) - Orange theme
- **Typography**: Clean, readable fonts
- **Icons**: Intuitive symbols for actions and status
- **Responsive Grid**: Mobile-first approach
- **Accessibility**: WCAG 2.1 AA compliance

## 8. Integration Specifications

### 8.1 WhatsApp Integration
- **Business API integration for notifications**
- **Message templates for different scenarios**
- **Demo mode for development and testing**
- **Error handling for failed message delivery**

### 8.2 Facebook Messenger Integration
- **Webhook setup for message handling**
- **Automated responses for common queries**
- **Integration with queue status updates**
- **Future implementation roadmap**

### 8.3 AI Services
- **Sentiment analysis for customer feedback**
- **Predictive wait time calculations**
- **Customer behavior pattern analysis**
- **Automated response generation**

## 9. Deployment Requirements

### 9.1 Environment Setup
- **Node.js 18+ runtime environment**
- **MongoDB 5.0+ database server**
- **SSL/TLS certificate for HTTPS**
- **Environment variable configuration**

### 9.2 Production Considerations
- **Load balancing for high traffic**
- **Database replication and backup**
- **Monitoring and alerting systems**
- **Automated deployment pipeline**

### 9.3 Scalability
- **Horizontal scaling capability**
- **Database sharding for large datasets**
- **CDN integration for static assets**
- **Caching strategies for performance**

## 10. Testing Requirements

### 10.1 Unit Testing
- **Model validation and business logic**
- **API endpoint functionality**
- **Service integration components**
- **Utility function coverage**

### 10.2 Integration Testing
- **End-to-end queue management workflows**
- **Real-time update functionality**
- **External service integrations**
- **Database operations and consistency**

### 10.3 User Acceptance Testing
- **Customer queue joining and monitoring**
- **Restaurant staff queue management**
- **Notification delivery and reliability**
- **Performance under load conditions**

## 11. Maintenance and Support

### 11.1 Monitoring
- **Application performance monitoring**
- **Database performance tracking**
- **Error logging and alerting**
- **User activity analytics**

### 11.2 Backup and Recovery
- **Daily database backups**
- **Application state recovery procedures**
- **Disaster recovery planning**
- **Data retention policies**

### 11.3 Updates and Maintenance
- **Security patch management**
- **Feature enhancement roadmap**
- **Performance optimization cycles**
- **User feedback integration**

## 12. Future Enhancements

### 12.1 Phase 2 Features
- **Multi-location support for restaurant chains**
- **Advanced analytics and reporting dashboard**
- **Customer loyalty program integration**
- **Table reservation system integration**

### 12.2 Phase 3 Features
- **Mobile application development**
- **Voice notification system**
- **Integration with POS systems**
- **Advanced AI-powered queue optimization**

### 12.3 Long-term Vision
- **Marketplace for queue management services**
- **White-label solutions for different industries**
- **IoT integration for automated queue detection**
- **Blockchain-based customer verification**

---

**Document Version**: 1.0  
**Last Updated**: June 11, 2025  
**Prepared By**: Smart Queue Manager Development Team  
**Status**: Implementation Complete - Phase 1 