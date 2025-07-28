# Queue Management System - Product Requirements Document (PRD)

## 1. Executive Summary

### 1.1 Product Overview
Queue Management System is a multi-tenant SaaS platform designed for Malaysian restaurants and food establishments. The system eliminates physical waiting by enabling customers to join virtual queues through a web interface and receive real-time browser notifications when their table is ready. Each merchant accesses their own branded queue system through a unified login portal.

### 1.2 Business Objectives
**Primary Goal**: Provide a white-label queue management solution for multiple restaurants through a single platform  
**Secondary Goals**:
- Enable merchant-specific branding and configurations
- Streamline restaurant operations during peak hours
- Reduce infrastructure costs through multi-tenant architecture
- Provide scalable SaaS solution with subscription model

### 1.3 Target Market
- **Primary**: Malaysian restaurants in shopping malls and commercial areas
- **Secondary**: Cafes, food courts, and quick-service restaurants
- **Geographic Focus**: Malaysia (starting with Klang Valley)

## 2. Product Vision & Strategy

### 2.1 Vision Statement
"To revolutionize the Malaysian dining experience by providing a unified queue management platform that serves multiple restaurants with personalized experiences."

### 2.2 Key Differentiators
- **Multi-Tenant Architecture**: Single deployment serving unlimited merchants
- **Email-Based Merchant Isolation**: Each business accessed via unique email login
- **No App Download Required**: Pure web-based solution for customers
- **Merchant Branding**: Customizable interface per merchant
- **Cost-Effective**: Shared infrastructure on Render with PostgreSQL on Neon

## 3. User Personas & Use Cases

### 3.1 Primary Personas

#### 3.1.1 The Mall Visitor (Customer)
- **Profile**: Malaysian families and individuals dining at malls
- **Pain Points**: Long physical queues, wasting time standing, uncertainty about wait times
- **Goals**: Continue shopping while waiting, receive timely notifications
- **Use Case**: Scans merchant-specific QR code, joins queue with merchant branding, receives notifications

#### 3.1.2 The Restaurant Owner (Merchant)
- **Profile**: Restaurant owners/managers subscribing to the queue service
- **Pain Points**: Managing walk-ins, no technical expertise for custom solutions
- **Goals**: Affordable queue management, maintain brand identity, easy staff training
- **Use Case**: Logs in with business email, accesses personalized dashboard, manages daily operations

#### 3.1.3 The Restaurant Staff (User)
- **Profile**: Front-desk staff managing daily queue operations
- **Pain Points**: Remembering multiple system logins, handling peak hour rushes
- **Goals**: Simple queue management, quick customer service
- **Use Case**: Uses shared merchant login or staff account to manage queues

#### 3.1.4 The Platform Administrator (Super Admin)
- **Profile**: Technical administrator managing the entire SaaS platform
- **Pain Points**: Manual merchant onboarding, account management, system monitoring
- **Goals**: Efficient merchant management, system stability, subscription tracking
- **Use Case**: Creates merchant accounts, assigns subscriptions, monitors all merchants

### 3.2 User Journey

#### Customer Journey
1. **Arrival**: Scans merchant-specific QR code at restaurant
2. **Merchant Recognition**: Sees restaurant branding and name
3. **Registration**: Enters name, phone number, and party size
4. **Confirmation**: Receives queue number with restaurant details
5. **Permission**: Allows browser notifications
6. **Waiting**: Continues activities while monitoring queue
7. **Notification**: Receives branded notification when ready
8. **Seating**: Shows queue number to staff

#### Merchant Journey
1. **Account Creation**: Receives credentials from platform admin
2. **First Login**: Accesses platform via login page with business email
3. **Configuration**: Sets up restaurant details, branding, operating hours
4. **Staff Training**: Creates staff accounts or shares main login
5. **Daily Operations**: Staff logs in and manages queue
6. **Analytics Review**: Owner reviews performance metrics

## 4. Functional Requirements

### 4.1 Multi-Tenant Architecture

#### 4.1.1 URL Structure
- **Main Platform**: https://queueapp.com
- **Merchant Login**: https://queueapp.com/merchant/login
- **Customer Queue**: https://queueapp.com/queue/{merchant-slug}
- **Merchant Dashboard**: https://queueapp.com/merchant/dashboard
- **Admin Portal**: https://queueapp.com/admin

#### 4.1.2 Merchant Isolation
**Data Segregation**:
- All queries filtered by merchant_id
- Row-level security in PostgreSQL
- Separate queue numbering per merchant

**Configuration Storage**:
- Business name and details
- Operating hours
- Logo and brand colors
- Custom messages
- Queue settings (max party size, estimated times)

### 4.2 Authentication System

#### 4.2.1 Merchant Login Page
- **URL**: /merchant/login
- **Features**:
  - Email and password authentication
  - "Remember Me" functionality
  - Password reset via email
  - Session management
  - Redirect to merchant-specific dashboard

#### 4.2.2 Authentication Flow
1. Merchant enters email/password
2. System validates credentials
3. JWT token generated with merchant_id
4. All subsequent requests include merchant_id
5. Dashboard displays merchant-specific data only

#### 4.2.3 User Roles
- **Merchant Owner**: Full access to settings and analytics
- **Merchant Staff**: Queue management only
- **Platform Admin**: Access to all merchants
- **Super Admin**: System-wide configuration

### 4.3 Customer-Facing Interface

#### 4.3.1 Merchant-Specific Queue Page
**Dynamic Elements**:
- Restaurant name and logo
- Custom welcome message
- Brand colors
- Operating hours
- Current wait time

**Queue Registration Form**:
- Name (required)
- Phone Number (Malaysian format)
- Party Size (1-12, configurable per merchant)
- Special requests (optional)

#### 4.3.2 Queue Status Display
**Branded Experience**:
- Merchant logo on all pages
- Custom color scheme
- Restaurant contact information
- Personalized messages

### 4.4 Merchant Dashboard

#### 4.4.1 Post-Login Dashboard
**Merchant Context**:
- Business name prominently displayed
- Logo in header
- Current date/time
- Quick stats widget

#### 4.4.2 Queue Management
**Features**:
- Real-time queue display
- Customer details view
- Queue actions (call, seat, remove)
- Search and filter
- Manual customer addition

#### 4.4.3 Merchant Settings
**Business Profile**:
- Restaurant name
- Address
- Contact numbers
- Operating hours
- Table configurations

**Branding Settings**:
- Logo upload
- Primary/secondary colors
- Custom messages
- Notification templates

#### 4.4.4 Staff Management
**Features**:
- Create staff accounts
- Set permissions
- View login history
- Reset staff passwords

### 4.5 Admin Developer Dashboard

#### 4.5.1 Merchant Management
**Create New Merchant**:
- Business Name (required)
- Owner Email (unique, used for login)
- Owner Password (temporary)
- Phone Number
- Address
- Subscription Plan
- Initial Configuration

#### 4.5.2 Merchant List View
**Display**:
- All merchants in table format
- Search by name/email
- Filter by subscription status
- Quick actions (enable/disable, reset password)
- Login as merchant (for support)

#### 4.5.3 System Overview
**Metrics**:
- Total active merchants
- Total customers in queues
- System resource usage
- Error logs per merchant

## 5. Technical Requirements

### 5.1 Technology Stack
- **Hosting**: Render.com
- **Database**: PostgreSQL on Neon Tech with Prisma ORM
- **Backend**: Node.js with Express.js
- **Frontend**: Server-side rendered EJS templates with vanilla JavaScript
- **Authentication**: Session-based with express-session and connect-pg-simple
- **Real-time**: Socket.io with merchant namespaces
- **Email Service**: SendGrid or AWS SES
- **File Storage**: Cloudinary for logos
- **ORM**: Prisma (migrated from Mongoose/MongoDB)

### 5.2 Database Schema (Prisma Models)

```prisma
// Merchants table (core tenant table)
model Merchant {
  id                     String                @id @default(uuid())
  businessName           String
  email                  String                @unique
  password               String
  phone                  String
  businessType           BusinessType
  timezone               String                @default("UTC")
  isActive               Boolean               @default(true)
  lastLogin              DateTime?
  createdAt              DateTime              @default(now())
  updatedAt              DateTime              @updatedAt
  
  settings               MerchantSettings?
  queues                 Queue[]
  businessHours          BusinessHours[]
  address                MerchantAddress?
  integrations           MerchantIntegrations?
}

-- Users table (merchant staff)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'staff',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email, merchant_id)
);

// Queues table (tenant-specific data)
model Queue {
  id                    String       @id @default(uuid())
  merchantId            String
  name                  String
  description           String?
  isActive              Boolean      @default(true)
  acceptingCustomers    Boolean      @default(true)
  maxCapacity           Int          @default(50)
  averageServiceTime    Int          @default(30)
  currentServing        Int          @default(0)
  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt
  
  merchant              Merchant     @relation(fields: [merchantId], references: [id])
  entries               QueueEntry[]
  analytics             QueueAnalytics?
}

model QueueEntry {
  id                String         @id @default(uuid())
  queueId           String
  customerId        String
  customerName      String
  customerPhone     String
  platform          Platform
  position          Int
  estimatedWaitTime Int
  status            QueueEntryStatus @default(waiting)
  partySize         Int            @default(1)
  joinedAt          DateTime       @default(now())
  calledAt          DateTime?
  completedAt       DateTime?
  
  queue             Queue          @relation(fields: [queueId], references: [id])
}

// Merchant settings
model MerchantSettings {
  id                     String     @id @default(uuid())
  merchantId             String     @unique
  maxQueueSize           Int        @default(50)
  avgMealDuration        Int        @default(45)
  noShowTimeout          Int        @default(15)
  gracePeriod            Int        @default(5)
  joinCutoffTime         Int        @default(30)
  seatingCapacity        Int        @default(50)
  autoPauseThreshold     Float      @default(0.9)
  
  merchant               Merchant   @relation(fields: [merchantId], references: [id])
}

-- Queue sequences (per merchant)
CREATE TABLE queue_sequences (
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    current_date DATE NOT NULL,
    last_number INTEGER DEFAULT 0,
    PRIMARY KEY(merchant_id, current_date)
);

-- Create indexes for performance
CREATE INDEX idx_queues_merchant_status ON queues(merchant_id, status);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_merchants_slug ON merchants(slug);
```

### 5.3 API Architecture

#### Authentication Endpoints
```javascript
// Merchant Authentication
POST   /api/auth/merchant/login      // Merchant login with email/password
POST   /api/auth/merchant/logout     // Logout
POST   /api/auth/merchant/refresh    // Refresh JWT token
POST   /api/auth/merchant/forgot     // Password reset request
POST   /api/auth/merchant/reset      // Password reset confirm

// Middleware to inject merchant_id
// All routes below auto-filter by merchant_id from JWT
```

#### Merchant-Specific APIs
```javascript
// Dashboard APIs (requires auth)
GET    /api/merchant/profile         // Get merchant details
PUT    /api/merchant/profile         // Update merchant details
POST   /api/merchant/logo            // Upload logo

GET    /api/merchant/queues          // Get current queues
POST   /api/merchant/queues/call     // Call customer
PUT    /api/merchant/queues/:id      // Update queue status
DELETE /api/merchant/queues/:id      // Remove from queue

GET    /api/merchant/analytics       // Get merchant analytics
GET    /api/merchant/settings        // Get all settings
PUT    /api/merchant/settings        // Update settings

// Staff Management
GET    /api/merchant/staff           // List staff
POST   /api/merchant/staff           // Create staff account
PUT    /api/merchant/staff/:id       // Update staff
DELETE /api/merchant/staff/:id       // Remove staff
```

#### Customer APIs
```javascript
// Public APIs (no auth required)
GET    /api/public/merchant/:slug    // Get merchant details for queue page
POST   /api/public/queue/join        // Join queue (includes merchant_id)
GET    /api/public/queue/:id/status  // Check queue status
DELETE /api/public/queue/:id         // Cancel queue
POST   /api/public/notifications/subscribe // Subscribe to push notifications
```

#### Admin APIs
```javascript
// Platform Admin APIs
POST   /api/admin/auth/login         // Admin login
GET    /api/admin/merchants          // List all merchants
POST   /api/admin/merchants          // Create new merchant
PUT    /api/admin/merchants/:id      // Update merchant
DELETE /api/admin/merchants/:id      // Delete merchant
POST   /api/admin/merchants/:id/login // Login as merchant (support)

GET    /api/admin/system/stats       // System statistics
GET    /api/admin/system/logs        // System logs
```

### 5.4 Security Implementation

#### 5.4.1 Authentication Security
**Password Requirements**:
- Minimum 8 characters
- Mix of letters and numbers
- Bcrypt hashing with salt rounds: 10

**JWT Implementation**:
```javascript
// JWT Payload Structure
{
  userId: "uuid",
  merchantId: "uuid",
  email: "user@email.com",
  role: "owner|staff",
  iat: timestamp,
  exp: timestamp
}
```

#### 5.4.2 Multi-Tenant Security
**Request Isolation**:
```javascript
// Middleware to enforce tenant isolation
app.use((req, res, next) => {
  if (req.user && req.user.merchantId) {
    req.merchantId = req.user.merchantId;
    // All DB queries automatically filtered by merchantId
  }
  next();
});
```

**Data Access Control**:
- Row-level security policies in PostgreSQL
- Automatic merchant_id injection in queries
- Prevent cross-tenant data access

### 5.5 Deployment Configuration

#### 5.5.1 Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@neon.tech/db

# Authentication
JWT_SECRET=random-secret-key
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

# Email Service
SENDGRID_API_KEY=your-api-key
EMAIL_FROM=noreply@queueapp.com

# File Storage
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name

# Push Notifications
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key

# Admin
ADMIN_EMAIL=admin@queueapp.com
ADMIN_PASSWORD=secure-password
```

#### 5.5.2 Render.com Configuration
**Web Service**:
- Build Command: npm install && npm run build
- Start Command: npm start
- Health Check Path: /api/health
- Auto-Deploy: On Git push

**Database**:
- Neon PostgreSQL connection pooling
- Max connections: 20
- SSL required

## 6. User Interface Requirements

### 6.1 Merchant Login Page
**Elements**:
- Platform logo/branding
- Email input field
- Password input field
- "Remember Me" checkbox
- "Forgot Password" link
- Login button
- Error message display

**Flow**:
1. Enter email and password
2. System identifies merchant by email
3. Validates password
4. Redirects to merchant-specific dashboard
5. Shows merchant branding immediately

### 6.2 Merchant Dashboard Layout
**Header**:
- Merchant logo (left)
- Business name
- Logged-in user email
- Logout button

**Navigation**:
- Queue Management (default)
- Analytics
- Settings
- Staff Management (owner only)

**Responsive Design**:
- Desktop: Full sidebar navigation
- Tablet: Collapsible sidebar
- Mobile: Bottom navigation

### 6.3 Customer Queue Interface
**Merchant Branding**:
```css
/* Dynamic CSS variables per merchant */
:root {
  --primary-color: ${merchant.primaryColor};
  --secondary-color: ${merchant.secondaryColor};
}
```

**Layout**:
- Merchant logo header
- Current wait time display
- Queue join form
- Terms acceptance
- Notification permission request

## 7. Implementation Roadmap

### 7.1 Phase 1: Core Multi-Tenant System (Month 1-2)
- ✅ Database schema with tenant isolation
- ✅ Merchant authentication system
- ✅ Email-based merchant identification
- ✅ Basic merchant dashboard
- ✅ Customer queue join page
- ✅ Merchant-specific branding

### 7.2 Phase 2: Full Feature Set (Month 3-4)
- 📋 Browser push notifications
- 📋 Real-time queue updates
- 📋 Staff account management
- 📋 Admin portal for merchant creation
- 📋 Analytics dashboard
- 📋 Email notifications

### 7.3 Phase 3: Advanced Features (Month 5-6)
- 📋 SMS fallback notifications
- 📋 Advanced analytics and reports
- 📋 API for third-party integrations
- 📋 Mobile app for merchants
- 📋 Subscription billing integration
- 📋 Multi-location support per merchant

## 8. Testing Strategy

### 8.1 Multi-Tenant Testing
**Isolation Tests**:
- Verify data segregation between merchants
- Test concurrent merchant access
- Validate merchant-specific configurations

### 8.2 Authentication Testing
**Test Cases**:
- Multiple merchants with same staff email
- Session management across browsers
- Password reset for specific merchant
- JWT token expiry and refresh

## 9. Success Metrics

### 9.1 Platform Metrics
- Number of active merchants
- Daily active users per merchant
- System uptime: 99.9%
- Average response time: <200ms

### 9.2 Merchant Success Metrics
- Queue completion rate
- Average wait time reduction
- Customer no-show rate
- Daily customer throughput

## 10. Support & Documentation

### 10.1 Merchant Onboarding
- Welcome email with credentials
- Video tutorial for first login
- PDF guide for staff training
- Demo merchant account for testing

### 10.2 Technical Support
- Email support for all merchants
- FAQ section in dashboard
- System status page
- Merchant community forum

---

**Document Version**: 2.0  
**Last Updated**: December 2024  
**Status**: Ready for Development  
**Target Launch**: Q2 2025  
**Platform URL**: queueapp.com (example)