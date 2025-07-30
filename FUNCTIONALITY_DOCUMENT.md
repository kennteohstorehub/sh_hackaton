# StoreHub Queue Management System - Functionality Document

## 1. System Overview

### 1.1 Architecture Summary
The StoreHub Queue Management System is a full-stack web application built with Node.js, Express.js, MongoDB, and Socket.IO, featuring real-time queue management capabilities with WhatsApp integration and AI-powered features.

### 1.2 Core Components
- **Backend API**: RESTful services for queue and customer management
- **Real-Time Engine**: Socket.IO for live updates and notifications
- **WhatsApp Service**: Integration with WhatsApp Web.js for messaging
- **AI Service**: Sentiment analysis and intelligent predictions
- **Dashboard Interface**: Web-based management console
- **Customer Interface**: Public queue joining and status pages

## 2. Customer-Facing Features

### 2.1 Queue Joining System

#### 2.1.1 Web-Based Queue Joining
**Endpoint**: `GET /queue/:queueId/join`
**Functionality**:
- Responsive form for customer information input
- Fields: Name, phone number, party size (1-20), service type
- Real-time queue status display
- Estimated wait time calculation
- QR code generation for easy access

#### 2.1.2 WhatsApp Queue Joining
**Functionality**:
- Natural language processing for customer requests
- Automated queue selection based on context
- Party size collection with validation
- Confirmation messages with queue details
- Integration with chatbot service

**Message Flow**:
1. Customer sends "join queue" or similar message
2. System identifies available queues
3. Collects customer information through conversation
4. Confirms queue entry with position and wait time
5. Provides status check commands

### 2.2 Queue Status Monitoring

#### 2.2.1 Real-Time Status Updates
**Endpoint**: `GET /queue/:queueId/status/:customerId`
**Functionality**:
- Live queue position tracking
- Dynamic wait time updates
- Party size display with color coding
- Queue progress visualization
- Auto-refresh every 30 seconds

**Color Coding System**:
- 🟢 Green: 1-2 people
- 🟡 Yellow: 3-4 people  
- 🟠 Orange: 5-6 people
- 🔴 Red: 7+ people

#### 2.2.2 WhatsApp Status Checking
**Commands Supported**:
- `status` - Get current queue position
- `position` - Check queue position
- `time` - Get estimated wait time
- `queue` - Full queue status

### 2.3 Notification System

#### 2.3.1 Automated WhatsApp Notifications
**Notification Types**:
- **Queue Confirmation**: Sent upon joining
- **Position Updates**: Periodic progress updates
- **Turn Notification**: When customer's turn arrives
- **Requeue Notifications**: When customer is re-added

#### 2.3.2 Message Templates
**Turn Notification**:
```
🔔 It's your turn!
📍 Queue: {queueName}
🎫 Your position: #{position}
Please come to the service counter now. Thank you for waiting!
```

### 2.4 New Queue Acknowledgment Flow (WebChat)

#### 2.4.1 Card-Based Acknowledgment System
**Overview**: Replaces overlay popups with inline interactive card messages for better mobile UX and clearer user actions.

#### 2.4.2 When Customer is Called
**Initial Notification Card**:
- **Card Header**: "🎉 Your table is ready!"
- **Card Body**: 
  - Verification code displayed prominently (large, bold text)
  - Queue name and position information
  - Clear instructions: "Please show this code to the staff"
- **Action Cards** (displayed below notification):
  - **Primary Action Card** (green/success styling):
    - Text: "I'm headed to the restaurant"
    - Icon: Forward/walking icon
    - Full-width button design
  - **Secondary Action Card** (red/danger styling):
    - Text: "Cancel my spot"
    - Icon: X or cancel icon
    - Full-width button design

#### 2.4.3 User Interaction Flows

**Flow A: Customer Acknowledges**
1. Customer clicks "I'm headed to restaurant" card
2. System behavior:
   - Replace all cards with confirmation message
   - Message: "✅ Great! We're expecting you. Your verification code is: [CODE]"
   - Update dashboard to show customer acknowledged
   - Start grace period timer (configurable, default 10 minutes)
   - Log acknowledgment timestamp

**Flow B: Customer Cancels**
1. Customer clicks "Cancel my spot" card
2. System shows confirmation card:
   - Header: "Are you sure you want to cancel?"
   - Body: "You'll lose your spot in the queue"
   - Action cards:
     - "Yes, cancel my spot" (red/danger)
     - "No, keep my spot" (green/success)
3. If confirmed:
   - Replace cards with cancellation message
   - Message: "Your spot has been cancelled. Thank you!"
   - Remove from queue
   - Update dashboard immediately
4. If declined:
   - Return to original notification cards
   - Reset any timers

#### 2.4.4 Timeout Progressive Flow
**Automated progression to prevent no-shows**:

**Stage 1: Warning (4 minutes after call)**
- New warning card appears below existing cards
- Card styling: Yellow/warning theme
- Header: "⚠️ Are you on your way?"
- Body: "Your table will be given away in 1 minute if not confirmed"
- Existing action cards remain active

**Stage 2: Final Warning (5 minutes after call)**
- Replace all cards with urgent notification
- Card styling: Orange/urgent theme
- Header: "🚨 Last chance!"
- Body: "Your table will be given away in 2 minutes"
- Action cards:
  - "I'm coming!" (green, prominent)
  - "Cancel" (red, smaller)

**Stage 3: Auto-cancellation (7 minutes after call)**
- Replace all cards with cancellation notice
- Card styling: Gray/muted theme
- Header: "❌ Spot given away"
- Body: "Sorry, we had to give your table to the next customer"
- Single action card: "Join queue again" (if applicable)

#### 2.4.5 Chat Interface Modifications

**During Queue Interactions**:
- **Hide text input box**: Prevent free-form messages during critical flows
- **Show only cards**: All interactions through card buttons
- **Visual indicators**: Loading states while processing actions
- **Auto-scroll**: Ensure new cards are visible immediately

**Technical Requirements**:
- **Touch targets**: Minimum 48px height for mobile optimization
- **Card spacing**: 16px between cards for clear separation
- **Responsive design**: Cards stack vertically on mobile
- **Animation**: Smooth transitions when cards appear/disappear
- **Accessibility**: ARIA labels for screen readers

#### 2.4.6 State Management
**Customer States During Acknowledgment**:
- `called`: Initial state when notified
- `acknowledged`: Customer confirmed they're coming
- `cancelled`: Customer cancelled their spot
- `no_show`: Auto-cancelled due to timeout
- `seated`: Successfully checked in at location

**Dashboard Updates**:
- Real-time status changes via WebSocket
- Visual indicators for each state
- Timestamp logging for all state transitions
- Grace period countdown display

### 2.5 Queue Cancellation System

#### 2.5.1 Cancellation Flow
**WhatsApp Commands**: `cancel`, `leave`, `exit`
**Functionality**:
- Confirmation prompt before cancellation
- Yes/No response handling
- Graceful queue removal
- Confirmation message upon cancellation

## 3. Merchant Dashboard Features

### 3.1 Real-Time Queue Management

#### 3.1.1 Dashboard Overview
**Endpoint**: `GET /dashboard`
**Functionality**:
- Live queue statistics display
- Active queues monitoring
- Customer count tracking
- Average wait time calculation
- Today's performance metrics

**Key Metrics Displayed**:
- Total active queues
- Current waiting customers
- Today's total customers served
- Average actual wait time
- Queue utilization rates

#### 3.1.2 Integrated Queue Management
**Functionality**:
- All queue management consolidated in main dashboard
- Real-time customer monitoring for all queues
- Individual customer action buttons (Call, Seat, Remove, Requeue)
- Queue statistics and analytics integrated in dashboard
- No separate queue detail pages (streamlined interface)

### 3.2 Queue Configuration

#### 3.2.1 Queue Creation and Editing
**Endpoints**: 
- `GET /dashboard/queues/new` - Create new queue
- `GET /dashboard/queues/:id/edit` - Edit existing queue

**Configuration Options**:
- Queue name and description
- Service types and categories
- Maximum capacity limits
- Average service time settings
- Operating hours and availability
- Notification preferences

### 3.3 Customer Management

#### 3.3.1 Individual Customer Operations
**Available Actions**:
- **Call Customer**: Send turn notification
- **Seat Customer**: Mark as served and remove from queue
- **Remove Customer**: Remove without serving
- **Requeue Customer**: Move to end of queue
- **Call Specific**: Call a specific customer out of order

#### 3.3.2 Bulk Operations
**Functionality**:
- Select multiple customers for batch operations
- Bulk notifications for queue updates
- Mass requeuing for system issues
- Batch customer data export

### 3.4 Analytics and Reporting

#### 3.4.1 Real-Time Analytics
**Metrics Tracked**:
- Queue performance indicators
- Customer flow patterns
- Peak hour identification
- Service efficiency metrics
- Customer satisfaction scores

## 4. WhatsApp Integration Features

### 4.1 Chatbot Functionality

#### 4.1.1 Natural Language Processing
**Capabilities**:
- Intent recognition for customer requests
- Context-aware conversation handling
- Multi-turn dialogue management
- Fallback responses for unrecognized inputs

**Supported Intents**:
- Queue joining requests
- Status inquiries
- Cancellation requests
- Help and information requests
- Feedback and complaints

#### 4.1.2 Session Management
**Session States**:
- `idle` - No active conversation
- `joining_queue` - In process of joining
- `in_queue` - Customer is waiting
- `confirming_cancel` - Confirming cancellation
- `providing_feedback` - Giving feedback

### 4.2 Message Handling

#### 4.2.1 Incoming Message Processing
**Flow**:
1. Receive WhatsApp message
2. Extract phone number and message content
3. Retrieve or create user session
4. Process message based on current state
5. Generate appropriate response
6. Update session state
7. Send response via WhatsApp

#### 4.2.2 Message Types Supported
- **Text Messages**: Natural language processing
- **Quick Replies**: Predefined response options
- **Commands**: Specific action triggers
- **Emojis**: Enhanced user experience

### 4.3 Authentication and Setup

#### 4.3.1 WhatsApp Web.js Integration
**Setup Process**:
1. QR code generation for authentication
2. Session persistence with LocalAuth
3. Client initialization and event handling
4. Connection status monitoring

## 5. AI and Intelligence Features

### 5.1 Sentiment Analysis

#### 5.1.1 Customer Message Analysis
**Functionality**:
- Real-time sentiment scoring of customer messages
- Emotion detection (positive, negative, neutral)
- Escalation alerts for negative sentiment
- Response optimization based on mood

#### 5.1.2 Satisfaction Tracking
**Metrics**:
- Message sentiment trends
- Customer satisfaction scores
- Complaint identification and routing
- Feedback analysis and categorization

### 5.2 Wait Time Prediction

#### 5.2.1 Dynamic Calculation Algorithm
**Factors Considered**:
- Current queue length
- Historical service times
- Peak hour multipliers
- Party size impact
- Service type complexity

#### 5.2.2 Machine Learning Integration
**Future Enhancements**:
- Historical pattern recognition
- Seasonal adjustment factors
- Customer behavior prediction
- Service optimization recommendations

### 5.3 Intelligent Notifications

#### 5.3.1 Optimal Timing Calculation
**Algorithm**:
- Base notification time: 5 minutes before turn
- Sentiment adjustment: ±2 minutes based on customer mood
- Queue velocity consideration
- Customer preference learning

## 6. Real-Time Features

### 6.1 Socket.IO Integration

#### 6.1.1 Real-Time Updates
**Events Supported**:
- `queueUpdate` - Queue status changes
- `customerUpdate` - Individual customer status
- `newCustomer` - Customer joins queue
- `customerRemoved` - Customer leaves queue
- `positionUpdate` - Position changes

#### 6.1.2 Room Management
**Room Structure**:
- `merchant_{merchantId}` - Merchant dashboard updates
- `queue_{queueId}` - Queue-specific updates
- `customer_{customerId}` - Individual customer updates

### 6.2 Live Dashboard Updates

#### 6.2.1 Automatic Refresh
**Features**:
- Real-time customer list updates
- Live queue statistics
- Instant notification delivery status
- Dynamic wait time recalculation

## 7. Security and Compliance Features

### 7.1 Data Protection

#### 7.1.1 Customer Data Handling
**Security Measures**:
- Encrypted data transmission
- Secure session management
- GDPR-compliant data retention
- Anonymization for analytics

#### 7.1.2 Access Control
**Authentication**:
- Session-based merchant authentication
- Role-based access control
- API rate limiting
- Input validation and sanitization

### 7.2 Communication Security

#### 7.2.1 WhatsApp Integration Security
**Measures**:
- Secure webhook endpoints
- Message encryption in transit
- Authentication token management
- Business account verification

## 8. API Documentation

### 8.1 Customer API Endpoints

#### 8.1.1 Queue Operations
```javascript
// Join queue
POST /api/customer/join
Body: {
  queueId: string,
  customerName: string,
  customerPhone: string,
  partySize: number,
  serviceType: string,
  platform: string
}

// Get queue status
GET /api/customer/status/:customerId

// Leave queue
DELETE /api/customer/:customerId/leave
```

### 8.2 Merchant API Endpoints

#### 8.2.1 Queue Management
```javascript
// Create queue
POST /api/queue

// Update queue
PUT /api/queue/:queueId

// Delete queue
DELETE /api/queue/:queueId
```

#### 8.2.2 Customer Management
```javascript
// Call customer
POST /api/queue/:queueId/call/:customerId

// Seat customer
POST /api/queue/:queueId/seat/:customerId

// Remove customer
DELETE /api/queue/:queueId/customer/:customerId

// Requeue customer
POST /api/queue/:queueId/requeue/:customerId
```

## 9. Performance and Scalability

### 9.1 System Performance

#### 9.1.1 Response Time Optimization
**Targets**:
- API responses: <500ms
- Page load times: <2 seconds
- Real-time updates: <100ms latency
- WhatsApp message delivery: <5 seconds

#### 9.1.2 Caching Strategy
**Implementation**:
- Redis for session storage
- MongoDB query optimization
- Static asset caching
- API response caching

### 9.2 Scalability Features

#### 9.2.1 Horizontal Scaling
**Capabilities**:
- Load balancer support
- Database clustering
- Microservice architecture readiness
- CDN integration for static assets

## 10. Future Enhancements

### 10.1 Planned Features

#### 10.1.1 Phase 2 Enhancements
- Facebook Messenger integration
- Mobile application development
- Advanced analytics dashboard
- Multi-language support
- Voice notification system

#### 10.1.2 Phase 3 Expansions
- Multi-location management
- POS system integrations
- Advanced AI features
- IoT device integration
- Blockchain customer verification

---

**Document Version**: 1.1  
**Last Updated**: July 29, 2025  
**Prepared By**: Smart Queue Manager Development Team  
**Status**: Updated with Card-Based Acknowledgment System 