# StoreHub Queue Management System - Technical Specification Document (TSD)

## Document Information
- **Version**: 2.0
- **Date**: August 2025
- **Status**: Active Development
- **Platform**: *.storehubqms.com

---

## 1. System Architecture

### 1.1 Multi-Tenant Architecture Overview
```
┌─────────────────────────────────────────────────────────────────┐
│                        Internet/Users                            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                 Cloudflare DNS + SSL                             │
│               *.storehubqms.com (Wildcard)                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                    Render.com                                    │
│         (Load Balancer + Auto-scaling + SSL Termination)         │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                 Node.js Application Layer                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            Tenant Resolution Middleware                   │   │
│  │    (Extracts tenant from subdomain, sets context)        │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │   SuperAdmin Portal  |  Tenant Dashboard  |  Customer UI │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│              PostgreSQL on Neon (Serverless)                     │
│                  Row-Level Security (RLS)                        │
│                 tenant_id based isolation                        │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack
- **Hosting**: Render.com (Auto-scaling, Managed SSL)
- **Database**: PostgreSQL on Neon with Prisma ORM
- **Backend**: Node.js 20 LTS + Express.js 4.21
- **Frontend**: EJS templates + Vanilla JavaScript
- **Real-time**: Socket.IO with Redis adapter (multi-instance)
- **Security**: 
  - Helmet.js for HTTP headers
  - CSP (Content Security Policy)
  - Rate limiting (express-rate-limit)
  - CSRF protection
  - Session encryption
- **Session**: express-session with connect-pg-simple
- **Authentication**: Bcrypt + JWT for APIs
- **File Storage**: Cloudinary (logos, assets)
- **Email**: SendGrid/AWS SES
- **Monitoring**: Custom analytics + external APM
- **Process Manager**: PM2 (production)
- **Logging**: Winston with daily rotation

### 1.3 Project Structure
```
├── server/
│   ├── index.js                    # Main server file with multi-tenant setup
│   ├── middleware/
│   │   ├── tenantResolver.js       # Extract and validate tenant from subdomain
│   │   ├── authentication.js       # Session & JWT auth middleware
│   │   ├── errorHandler.js         # Global error handling
│   │   └── security.js             # Security headers and CSRF
│   ├── services/
│   │   ├── queueService.js         # Queue operations (tenant-aware)
│   │   ├── merchantService.js      # Merchant/tenant operations
│   │   ├── tenantService.js        # Multi-tenant management
│   │   ├── renderApiService.js     # Render.com API integration
│   │   ├── whatsappService.js      # WhatsApp integration
│   │   ├── webchatService.js       # WebChat real-time messaging
│   │   ├── notificationService.js  # Multi-channel notifications
│   │   ├── emailService.js         # Email notifications
│   │   └── analyticsService.js     # Tenant-scoped analytics
│   ├── routes/
│   │   ├── superadmin/             # SuperAdmin routes
│   │   │   ├── tenants.js          # Tenant CRUD operations
│   │   │   ├── users.js            # User management
│   │   │   ├── billing.js          # Subscription management
│   │   │   └── analytics.js        # Platform analytics
│   │   ├── api/
│   │   │   ├── queue.js            # Queue management API
│   │   │   ├── customer.js         # Customer operations
│   │   │   ├── webchat.js          # WebChat endpoints
│   │   │   └── analytics.js        # Tenant analytics
│   │   └── frontend/
│   │       ├── dashboard.js        # Management dashboard
│   │       ├── queue.js            # Customer queue UI
│   │       └── auth.js             # Login/logout
│   └── utils/
│       ├── logger.js               # Winston logging with tenant context
│       ├── validators.js           # Input validation schemas
│       ├── constants.js            # System-wide constants
│       └── helpers.js              # Utility functions
├── views/                          # EJS templates
│   ├── superadmin/                 # SuperAdmin interface
│   │   ├── tenants/                # Tenant management views
│   │   └── analytics/              # Platform analytics
│   ├── dashboard/                  # Tenant management interface
│   ├── queue/                      # Customer queue views
│   └── partials/                   # Shared components
├── public/                         # Static assets
│   ├── css/                        # Stylesheets
│   ├── js/                         # Client-side JavaScript
│   └── images/                     # Static images
├── prisma/
│   ├── schema.prisma               # Database schema
│   └── migrations/                 # Database migrations
└── config/
    ├── database.js                 # Database configuration
    ├── redis.js                    # Redis configuration
    └── render.js                   # Render API config
```

## 2. Database Schema (Prisma/PostgreSQL)

### 2.1 Multi-Tenant Models

#### Tenant Model (New)
```prisma
model Tenant {
  id                    String              @id @default(uuid())
  subdomain             String              @unique
  businessName          String
  businessType          BusinessType
  subscriptionPlan      SubscriptionPlan    @default(FREE)
  subscriptionStatus    SubscriptionStatus  @default(TRIAL)
  trialEndsAt           DateTime?
  billingEmail          String
  supportEmail          String?
  phone                 String
  timezone              String              @default("Asia/Kuala_Lumpur")
  isActive              Boolean             @default(true)
  activatedAt           DateTime?
  deactivatedAt         DateTime?
  customDomain          String?             @unique
  logoUrl               String?
  primaryColor          String              @default("#FF8C00")
  maxQueues             Int                 @default(1)
  maxUsers              Int                 @default(3)
  maxCustomersPerDay    Int                 @default(50)
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt
  
  merchants             Merchant[]
  subscriptions         Subscription[]
  auditLogs             AuditLog[]
  
  @@index([subdomain])
  @@index([isActive])
}

enum SubscriptionPlan {
  FREE
  BASIC
  PREMIUM
  ENTERPRISE
}

enum SubscriptionStatus {
  TRIAL
  ACTIVE
  PAST_DUE
  CANCELLED
  SUSPENDED
}
```

#### Updated Merchant Model (Tenant-aware)
```prisma
model Merchant {
  id                     String                @id @default(uuid())
  tenantId               String                // NEW: Links to tenant
  businessName           String
  email                  String
  password               String
  phone                  String
  role                   MerchantRole          @default(STAFF)
  isActive               Boolean               @default(true)
  lastLogin              DateTime?
  invitedBy              String?
  invitedAt              DateTime?
  acceptedAt             DateTime?
  createdAt              DateTime              @default(now())
  updatedAt              DateTime              @updatedAt
  
  tenant                 Tenant                @relation(fields: [tenantId], references: [id])
  settings               MerchantSettings?
  queues                 Queue[]
  sessions               Session[]
  
  @@unique([tenantId, email])  // Email unique per tenant
  @@index([tenantId])
}

enum MerchantRole {
  OWNER
  ADMIN
  STAFF
}
```

### 2.2 Queue Model (Updated)
```prisma
model Queue {
  id                    String       @id @default(uuid())
  tenantId              String       // NEW: Tenant isolation
  merchantId            String
  name                  String
  description           String?
  isActive              Boolean      @default(true)
  acceptingCustomers    Boolean      @default(true)
  maxCapacity           Int          @default(50)
  averageServiceTime    Int          @default(30)
  currentServing        Int          @default(0)
  autoNotifications     Boolean      @default(true)
  notificationInterval  Int          @default(5)
  allowCancellation     Boolean      @default(true)
  requireConfirmation   Boolean      @default(true)
  businessHoursStart    String       @default("09:00")
  businessHoursEnd      String       @default("17:00")
  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt
  
  tenant                Tenant       @relation(fields: [tenantId], references: [id])
  merchant              Merchant     @relation(fields: [merchantId], references: [id])
  entries               QueueEntry[]
  analytics             QueueAnalytics?
  
  @@index([tenantId])
  @@index([merchantId])
}
```

### 2.3 QueueEntry Model (Updated)
```prisma
model QueueEntry {
  id                String         @id @default(uuid())
  tenantId          String         // NEW: Tenant isolation
  queueId           String
  customerId        String
  customerName      String
  customerPhone     String
  platform          Platform
  position          Int
  estimatedWaitTime Int
  status            QueueEntryStatus @default(waiting)
  serviceTypeId     String?
  partySize         Int            @default(1)
  notes             String?
  specialRequests   String?
  verificationCode  String?
  sessionId         String?
  joinedAt          DateTime       @default(now())
  calledAt          DateTime?
  servedAt          DateTime?
  completedAt       DateTime?
  requeuedAt        DateTime?
  lastNotified      DateTime?
  notificationCount Int            @default(0)
  sentimentScore    Float?
  webchatSessionId  String?        // NEW: WebChat session
  
  tenant            Tenant         @relation(fields: [tenantId], references: [id])
  queue             Queue          @relation(fields: [queueId], references: [id])
  serviceType       ServiceType?   @relation(fields: [serviceTypeId], references: [id])
  webchatMessages   WebChatMessage[]
  
  @@index([tenantId])
  @@index([queueId, status])
  @@index([customerId])
}

enum QueueEntryStatus {
  waiting
  called
  seated
  completed
  cancelled
  no_show
}

enum Platform {
  web
  whatsapp
  messenger
  api
}
```

### 2.4 Session & Authentication Models
```prisma
model Session {
  id        String   @id
  sid       String   @unique
  sess      Json
  expire    DateTime
  tenantId  String?  // NEW: Track tenant per session
  
  @@index([expire])
  @@index([tenantId])
}

model SuperAdmin {
  id                String    @id @default(uuid())
  email             String    @unique
  password          String
  name              String
  isActive          Boolean   @default(true)
  lastLogin         DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  auditLogs         AuditLog[]
}
```

### 2.5 WebChat & Notification Models
```prisma
model WebChatMessage {
  id                String      @id @default(uuid())
  tenantId          String
  queueEntryId      String
  sender            MessageSender
  content           String
  isRead            Boolean     @default(false)
  createdAt         DateTime    @default(now())
  
  tenant            Tenant      @relation(fields: [tenantId], references: [id])
  queueEntry        QueueEntry  @relation(fields: [queueEntryId], references: [id])
  
  @@index([tenantId])
  @@index([queueEntryId])
}

enum MessageSender {
  CUSTOMER
  STAFF
  SYSTEM
}

model NotificationLog {
  id                String      @id @default(uuid())
  tenantId          String
  queueEntryId      String
  channel           NotificationChannel
  status            NotificationStatus
  message           String
  errorMessage      String?
  sentAt            DateTime    @default(now())
  
  @@index([tenantId])
  @@index([queueEntryId])
}

enum NotificationChannel {
  WEBCHAT
  WHATSAPP
  EMAIL
  SMS
  PUSH
}

enum NotificationStatus {
  SENT
  DELIVERED
  FAILED
  BOUNCED
}
```

### 2.6 Analytics & Audit Models
```prisma
model QueueAnalytics {
  id                String    @id @default(uuid())
  tenantId          String
  queueId           String    @unique
  date              DateTime  @default(now())
  totalCustomers    Int       @default(0)
  averageWaitTime   Float     @default(0)
  peakHour          Int?
  completionRate    Float     @default(0)
  noShowRate        Float     @default(0)
  
  tenant            Tenant    @relation(fields: [tenantId], references: [id])
  queue             Queue     @relation(fields: [queueId], references: [id])
  
  @@index([tenantId, date])
}

model AuditLog {
  id                String    @id @default(uuid())
  tenantId          String?
  userId            String?
  userType          UserType
  action            String
  resource          String
  resourceId        String?
  details           Json?
  ipAddress         String?
  userAgent         String?
  createdAt         DateTime  @default(now())
  
  tenant            Tenant?   @relation(fields: [tenantId], references: [id])
  
  @@index([tenantId])
  @@index([userId])
  @@index([createdAt])
}

enum UserType {
  SUPERADMIN
  MERCHANT
  CUSTOMER
  SYSTEM
}
```

## 3. API Endpoints

### 3.1 SuperAdmin API (New)
```
# Authentication
POST   /api/superadmin/login              # SuperAdmin login
POST   /api/superadmin/logout             # Logout

# Tenant Management
GET    /api/superadmin/tenants            # List all tenants
POST   /api/superadmin/tenants            # Create new tenant
GET    /api/superadmin/tenants/:id        # Get tenant details
PUT    /api/superadmin/tenants/:id        # Update tenant
DELETE /api/superadmin/tenants/:id        # Deactivate tenant
POST   /api/superadmin/tenants/:id/activate   # Activate tenant
POST   /api/superadmin/tenants/:id/suspend    # Suspend tenant

# Subdomain Provisioning
POST   /api/superadmin/tenants/:id/provision-subdomain  # Provision subdomain
DELETE /api/superadmin/tenants/:id/remove-subdomain     # Remove subdomain

# User Management
GET    /api/superadmin/tenants/:id/users  # List tenant users
POST   /api/superadmin/tenants/:id/users  # Create/invite user
DELETE /api/superadmin/users/:id          # Remove user

# Analytics & Monitoring
GET    /api/superadmin/analytics          # Platform analytics
GET    /api/superadmin/analytics/tenants  # Tenant usage stats
GET    /api/superadmin/analytics/revenue  # Revenue analytics

# Billing & Subscriptions
GET    /api/superadmin/subscriptions      # All subscriptions
PUT    /api/superadmin/tenants/:id/subscription  # Update plan
GET    /api/superadmin/invoices           # All invoices
```

### 3.2 Tenant API (Queue Management)
```
# Authentication
POST   /api/auth/login                    # Tenant user login
POST   /api/auth/logout                   # Logout
POST   /api/auth/forgot-password          # Password reset
POST   /api/auth/reset-password           # Complete reset

# Queue Management
GET    /api/queues                        # List tenant queues
POST   /api/queues                        # Create new queue
GET    /api/queues/:id                    # Get queue details
PUT    /api/queues/:id                    # Update queue
DELETE /api/queues/:id                    # Delete queue
POST   /api/queues/:id/toggle             # Enable/disable queue

# Customer Operations
POST   /api/queues/:id/join               # Join queue
GET    /api/queues/entry/:sessionId       # Get entry status
POST   /api/queues/:id/call-next          # Call next customer
POST   /api/queues/:id/call/:entryId      # Call specific customer
POST   /api/queues/:id/seat/:entryId      # Mark as seated
POST   /api/queues/:id/cancel/:entryId    # Cancel entry
POST   /api/queues/:id/no-show/:entryId   # Mark no-show

# WebChat API
GET    /api/webchat/:sessionId            # Get chat messages
POST   /api/webchat/:sessionId/message    # Send message
GET    /api/webchat/:sessionId/status     # Get connection status
```

### 3.3 Frontend Routes
```
# SuperAdmin Portal (admin.storehubqms.com)
GET    /superadmin                        # SuperAdmin dashboard
GET    /superadmin/login                  # Login page
GET    /superadmin/tenants                # Tenant management
GET    /superadmin/tenants/:id            # Tenant details
GET    /superadmin/analytics              # Platform analytics
GET    /superadmin/billing                # Billing management

# Tenant Dashboard ({tenant}.storehubqms.com)
GET    /dashboard                          # Management dashboard
GET    /dashboard/queues                   # Queue management
GET    /dashboard/analytics               # Tenant analytics
GET    /dashboard/settings                 # Business settings
GET    /dashboard/users                    # User management

# Customer Interface ({tenant}.storehubqms.com)
GET    /                                   # Queue listing/join
GET    /queue/:id                          # Queue status
GET    /queue/status/:sessionId           # Customer status
GET    /webchat                           # WebChat interface
```

## 4. Real-time Features

### 4.1 Multi-Tenant Socket.IO Architecture
```javascript
// Namespace-based tenant isolation
const tenantNamespace = io.of(`/${tenant.subdomain}`);

// Room structure
const rooms = {
  tenant: `tenant:${tenantId}`,              // All tenant users
  merchant: `merchant:${merchantId}`,        // Specific merchant
  queue: `queue:${queueId}`,                 // Queue updates
  customer: `customer:${customerId}`,        // Customer notifications
  webchat: `webchat:${sessionId}`           // WebChat messages
};

// Connection with tenant context
tenantNamespace.use(async (socket, next) => {
  const tenantId = await resolveTenantFromSocket(socket);
  socket.tenantId = tenantId;
  next();
});
```

### 4.2 Socket Events
```javascript
// Merchant Events
socket.on('merchant:join', (merchantId) => {
  socket.join(`merchant:${merchantId}`);
  socket.join(`tenant:${socket.tenantId}`);
});

// Queue Updates (Broadcast to all merchants)
io.to(`tenant:${tenantId}`).emit('queue:update', {
  queueId: String,
  action: 'customer-joined|called|seated|cancelled',
  entry: QueueEntry,
  stats: { waiting, averageWaitTime, nextPosition }
});

// Customer Notifications
io.to(`customer:${customerId}`).emit('notification', {
  type: 'called|reminder|update',
  queueName: String,
  position: Number,
  estimatedWaitTime: Number,
  message: String
});

// WebChat Real-time
io.to(`webchat:${sessionId}`).emit('message', {
  sender: 'staff|customer|system',
  content: String,
  timestamp: Date,
  metadata: Object
});
```

### 4.3 WebChat Implementation
```javascript
// Customer joins webchat
socket.on('webchat:join', async (sessionId) => {
  const entry = await validateWebChatSession(sessionId);
  if (entry) {
    socket.join(`webchat:${sessionId}`);
    socket.emit('webchat:history', await getMessageHistory(sessionId));
  }
});

// Message handling
socket.on('webchat:message', async (data) => {
  const { sessionId, content } = data;
  const message = await saveWebChatMessage({
    tenantId: socket.tenantId,
    sessionId,
    content,
    sender: socket.userType
  });
  
  // Broadcast to all participants
  io.to(`webchat:${sessionId}`).emit('message', message);
  
  // Notify staff if from customer
  if (socket.userType === 'customer') {
    io.to(`queue:${message.queueId}`).emit('webchat:new-message', {
      sessionId,
      customerName: message.customerName
    });
  }
});
```

## 5. Multi-Tenant Implementation

### 5.1 Tenant Resolution Middleware
```javascript
// server/middleware/tenantResolver.js
async function resolveTenant(req, res, next) {
  const hostname = req.hostname; // e.g., storehubrestaurant.storehubqms.com
  const subdomain = hostname.split('.')[0];
  
  // Special handling for SuperAdmin
  if (subdomain === 'admin') {
    req.isSuperAdmin = true;
    return next();
  }
  
  // Resolve tenant from subdomain
  const tenant = await prisma.tenant.findUnique({
    where: { subdomain, isActive: true }
  });
  
  if (!tenant) {
    return res.status(404).render('errors/tenant-not-found');
  }
  
  // Set tenant context
  req.tenant = tenant;
  req.tenantId = tenant.id;
  
  // Apply tenant to session
  if (req.session) {
    req.session.tenantId = tenant.id;
  }
  
  next();
}
```

### 5.2 Subdomain Provisioning (Render API)
```javascript
// server/services/renderApiService.js
class RenderApiService {
  async provisionSubdomain(tenant) {
    const subdomain = `${tenant.subdomain}.storehubqms.com`;
    
    // Add custom domain to Render service
    const response = await fetch(`${RENDER_API_URL}/services/${SERVICE_ID}/custom-domains`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: subdomain,
        certificateType: 'managed' // Automatic SSL
      })
    });
    
    return response.json();
  }
  
  async removeSubdomain(subdomain) {
    // Remove custom domain from Render
    await fetch(`${RENDER_API_URL}/services/${SERVICE_ID}/custom-domains/${subdomain}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${RENDER_API_KEY}` }
    });
  }
}
```

### 5.3 Data Isolation
```javascript
// All queries automatically filtered by tenant
class TenantAwareService {
  constructor(tenantId) {
    this.tenantId = tenantId;
  }
  
  async findQueues() {
    return prisma.queue.findMany({
      where: { tenantId: this.tenantId }
    });
  }
  
  async createQueue(data) {
    return prisma.queue.create({
      data: { ...data, tenantId: this.tenantId }
    });
  }
}

// Middleware applies tenant filter
app.use((req, res, next) => {
  if (req.tenantId) {
    req.queueService = new QueueService(req.tenantId);
    req.merchantService = new MerchantService(req.tenantId);
  }
  next();
});
```

## 6. Key Features

### 6.1 Customer Experience
1. **Multi-Channel Queue Join**
   - Web interface (mobile-optimized)
   - WhatsApp integration
   - API for third-party integration
   
2. **Real-time Updates**
   - Live position tracking
   - Accurate wait time estimates
   - WebChat for instant communication
   
3. **Flexible Notifications**
   - WebChat (primary)
   - WhatsApp Business
   - Browser push notifications
   - Email notifications

### 6.2 Staff Dashboard Features
1. **Queue Management**
   - Drag-and-drop customer reordering
   - Bulk operations (call multiple)
   - Color-coded party sizes
   - Quick actions (call, seat, remove)
   
2. **Real-time Analytics**
   - Live customer count
   - Average wait times
   - Service rate tracking
   - Peak hour identification
   
3. **Communication Hub**
   - WebChat with customers
   - Notification history
   - Quick message templates

### 6.3 SuperAdmin Control Panel
1. **Tenant Management**
   - One-click tenant creation
   - Automatic subdomain provisioning
   - Subscription management
   - Usage monitoring
   
2. **User Administration**
   - Email-based invitations
   - Role management
   - Bulk operations
   - Activity tracking
   
3. **Platform Analytics**
   - Revenue tracking
   - Tenant growth metrics
   - System health monitoring
   - Usage patterns

## 7. Security Implementation

### 7.1 Multi-layered Security Architecture

#### Authentication & Authorization
```javascript
// SuperAdmin authentication
app.use('/api/superadmin/*', authenticateSuperAdmin);

// Tenant user authentication
app.use('/api/*', authenticateTenant);

// Role-based access control
const authorize = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

// Usage
router.put('/users/:id', authorize(['OWNER', 'ADMIN']), updateUser);
```

#### Session Security
```javascript
app.use(session({
  secret: process.env.SESSION_SECRET,
  store: new PgSession({
    pool: pgPool,
    tableName: 'sessions'
  }),
  cookie: {
    secure: true,              // HTTPS only
    httpOnly: true,            // No JS access
    sameSite: 'lax',          // CSRF protection
    maxAge: 24 * 60 * 60 * 1000  // 24 hours
  },
  resave: false,
  saveUninitialized: false
}));
```

### 7.2 Content Security Policy (Enhanced)
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://www.googletagmanager.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "https://res.cloudinary.com"],
      connectSrc: ["'self'", "wss:", `wss://*.storehubqms.com`],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 7.3 Rate Limiting (Per-Tenant)
```javascript
const tenantRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,    // 15 minutes
  max: (req) => {
    // Different limits based on subscription
    const limits = {
      FREE: 100,
      BASIC: 500,
      PREMIUM: 2000,
      ENTERPRISE: 10000
    };
    return limits[req.tenant?.subscriptionPlan] || 100;
  },
  keyGenerator: (req) => `${req.tenantId}:${req.ip}`,
  standardHeaders: true,
  legacyHeaders: false
});

// API-specific limits
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,     // 1 minute
  max: 60,                     // 60 requests per minute
  message: 'Too many API requests'
});
```

### 7.4 Input Validation & Sanitization
```javascript
const { body, validationResult } = require('express-validator');

// Tenant creation validation
const validateTenantCreation = [
  body('subdomain')
    .isSlug()
    .isLength({ min: 3, max: 50 })
    .custom(async (value) => {
      const existing = await prisma.tenant.findUnique({ where: { subdomain: value } });
      if (existing) throw new Error('Subdomain already taken');
      return true;
    }),
  body('businessName').trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('phone').isMobilePhone('any'),
  body('subscriptionPlan').isIn(['FREE', 'BASIC', 'PREMIUM', 'ENTERPRISE'])
];

// Queue entry validation
const validateQueueJoin = [
  body('customerName').trim().escape().isLength({ min: 1, max: 100 }),
  body('customerPhone').isMobilePhone('any'),
  body('partySize').isInt({ min: 1, max: 20 }),
  body('notes').optional().trim().escape().isLength({ max: 500 })
];
```

### 7.5 CORS Configuration
```javascript
const corsOptions = {
  origin: (origin, callback) => {
    // Allow subdomains and specific origins
    const allowedPatterns = [
      /^https:\/\/.*\.storehubqms\.com$/,
      /^http:\/\/localhost:\d+$/  // Development
    ];
    
    if (!origin || allowedPatterns.some(pattern => pattern.test(origin))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

## 8. Performance & Scalability

### 8.1 Database Optimization
```javascript
// Composite indexes for common queries
@@index([tenantId, status, joinedAt])
@@index([tenantId, queueId, position])
@@index([tenantId, createdAt])

// Pagination for large datasets
async function getPaginatedQueues(tenantId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  return prisma.queue.findMany({
    where: { tenantId },
    skip,
    take: limit,
    include: {
      _count: { select: { entries: true } }
    }
  });
}

// Efficient analytics aggregation
async function getTenantAnalytics(tenantId, dateRange) {
  return prisma.$queryRaw`
    SELECT 
      DATE(joined_at) as date,
      COUNT(*) as total_customers,
      AVG(EXTRACT(EPOCH FROM (served_at - joined_at))/60) as avg_wait_minutes,
      COUNT(CASE WHEN status = 'no_show' THEN 1 END)::float / COUNT(*) as no_show_rate
    FROM queue_entries
    WHERE tenant_id = ${tenantId}
      AND joined_at BETWEEN ${dateRange.start} AND ${dateRange.end}
    GROUP BY DATE(joined_at)
  `;
}
```

### 8.2 Caching Strategy
```javascript
// Redis caching for frequently accessed data
const cache = {
  async getTenantSettings(tenantId) {
    const key = `tenant:${tenantId}:settings`;
    const cached = await redis.get(key);
    
    if (cached) return JSON.parse(cached);
    
    const settings = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { /* tenant settings */ }
    });
    
    await redis.setex(key, 3600, JSON.stringify(settings)); // 1 hour
    return settings;
  }
};

// Cache invalidation on updates
async function updateTenant(tenantId, data) {
  const result = await prisma.tenant.update({
    where: { id: tenantId },
    data
  });
  
  await redis.del(`tenant:${tenantId}:*`);
  return result;
}
```

### 8.3 Frontend Performance
```javascript
// Lazy loading for tenant-specific assets
const loadTenantAssets = async (tenantId) => {
  const [css, logo] = await Promise.all([
    import(`/tenants/${tenantId}/theme.css`),
    loadImage(`/tenants/${tenantId}/logo.png`)
  ]);
};

// Virtual scrolling for large customer lists
class VirtualList {
  constructor(container, itemHeight, renderItem) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.renderItem = renderItem;
    this.setupScrollListener();
  }
  
  render(items) {
    const scrollTop = this.container.scrollTop;
    const containerHeight = this.container.clientHeight;
    const startIndex = Math.floor(scrollTop / this.itemHeight);
    const endIndex = Math.ceil((scrollTop + containerHeight) / this.itemHeight);
    
    // Only render visible items
    const visibleItems = items.slice(startIndex, endIndex + 1);
    this.renderItems(visibleItems, startIndex);
  }
}
```

## 9. Infrastructure & Deployment

### 9.1 Multi-Environment Configuration
```javascript
// config/environments.js
const environments = {
  development: {
    domain: 'localhost:3001',
    database: process.env.DATABASE_URL_DEV,
    redis: 'redis://localhost:6379',
    cors: ['http://localhost:3000', 'http://localhost:3001']
  },
  staging: {
    domain: 'staging.storehubqms.com',
    database: process.env.DATABASE_URL_STAGING,
    redis: process.env.REDIS_URL_STAGING,
    cors: ['https://*.staging.storehubqms.com']
  },
  production: {
    domain: 'storehubqms.com',
    database: process.env.DATABASE_URL,
    redis: process.env.REDIS_URL,
    cors: ['https://*.storehubqms.com']
  }
};
```

### 9.2 Render.com Deployment
```yaml
# render.yaml
services:
  - type: web
    name: storehub-qms
    env: node
    region: singapore
    plan: standard
    buildCommand: npm ci && npm run build && npx prisma generate
    startCommand: npm run start:production
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: storehub-qms-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: storehub-qms-redis
          type: redis
          property: connectionString
    autoDeploy: true
    domains:
      - storehubqms.com
      - '*.storehubqms.com'

databases:
  - name: storehub-qms-db
    databaseName: storehub_qms
    plan: standard
    region: singapore

services:
  - type: redis
    name: storehub-qms-redis
    plan: standard
    region: singapore
```

### 9.3 Environment Variables
```bash
# Core Configuration
NODE_ENV=production
PORT=3001
BASE_DOMAIN=storehubqms.com

# Database
DATABASE_URL=postgresql://user:pass@host:5432/storehub_qms
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis
REDIS_URL=redis://host:6379
REDIS_MAX_RETRIES=3

# Session
SESSION_SECRET=long-random-string
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_DOMAIN=.storehubqms.com

# Security
JWT_SECRET=another-long-random-string
BCRYPT_ROUNDS=12
SUPERADMIN_EMAILS=admin@storehubqms.com

# External APIs
RENDER_API_KEY=rndr_xxx
RENDER_SERVICE_ID=srv-xxx
SENDGRID_API_KEY=SG.xxx
CLOUDINARY_URL=cloudinary://xxx
WHATSAPP_API_TOKEN=xxx

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_FREE=100
RATE_LIMIT_MAX_PREMIUM=2000

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx
NEW_RELIC_LICENSE_KEY=xxx
```

## 10. Monitoring & Analytics

### 10.1 Application Monitoring
```javascript
// Custom metrics collection
class MetricsCollector {
  async trackQueueMetrics(tenantId) {
    const metrics = await prisma.$queryRaw`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'waiting') as waiting_count,
        COUNT(*) FILTER (WHERE status = 'called') as called_count,
        AVG(EXTRACT(EPOCH FROM (NOW() - joined_at))/60) 
          FILTER (WHERE status = 'waiting') as avg_wait_minutes
      FROM queue_entries
      WHERE tenant_id = ${tenantId}
        AND status IN ('waiting', 'called')
    `;
    
    // Send to monitoring service
    await prometheus.gauge('queue_waiting_count', metrics.waiting_count, { tenantId });
    await prometheus.gauge('queue_avg_wait_minutes', metrics.avg_wait_minutes, { tenantId });
  }
}
```

### 10.2 Error Tracking
```javascript
// Centralized error handling with context
app.use((err, req, res, next) => {
  const errorContext = {
    tenantId: req.tenantId,
    userId: req.user?.id,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent')
  };
  
  // Log to file
  logger.error({
    ...errorContext,
    error: err.message,
    stack: err.stack
  });
  
  // Send to Sentry
  Sentry.captureException(err, {
    contexts: { request: errorContext }
  });
  
  // Respond to client
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'An error occurred' 
      : err.message
  });
});
```

## 11. Testing & Quality Assurance

### 11.1 Testing Strategy
```javascript
// Integration tests for multi-tenant functionality
describe('Multi-Tenant Queue System', () => {
  it('should isolate data between tenants', async () => {
    const tenant1 = await createTestTenant('restaurant1');
    const tenant2 = await createTestTenant('restaurant2');
    
    const queue1 = await createQueue(tenant1.id, 'Main Queue');
    const queue2 = await createQueue(tenant2.id, 'VIP Queue');
    
    const tenant1Queues = await getQueues(tenant1.id);
    expect(tenant1Queues).toHaveLength(1);
    expect(tenant1Queues[0].id).toBe(queue1.id);
  });
  
  it('should provision subdomain on tenant creation', async () => {
    const tenant = await createTenant({
      subdomain: 'testrestaurant',
      businessName: 'Test Restaurant'
    });
    
    const domainStatus = await checkSubdomainStatus('testrestaurant.storehubqms.com');
    expect(domainStatus).toBe('active');
  });
});
```

### 11.2 Load Testing
```bash
# K6 load test script
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
  },
};

export default function () {
  const tenants = ['restaurant1', 'restaurant2', 'restaurant3'];
  const tenant = tenants[Math.floor(Math.random() * tenants.length)];
  
  const res = http.get(`https://${tenant}.storehubqms.com/api/queues`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

## 12. Roadmap & Future Enhancements

### Phase 2: Advanced Features (Q2 2025)
- SMS notifications via Twilio
- Advanced analytics with drill-down
- API marketplace for integrations
- Mobile apps (React Native)
- Multi-location support

### Phase 3: Enterprise Features (Q3 2025)
- White-label options
- Custom domain support
- Advanced reporting with exports
- AI-powered wait time predictions
- Integration with POS systems

### Phase 4: Global Expansion (Q4 2025)
- Multi-language support
- Regional compliance (GDPR, etc.)
- Global CDN deployment
- 24/7 support infrastructure
- Enterprise SLAs

---

**Document Version**: 2.0  
**Last Updated**: August 2025  
**Implementation Status**: Phase 1 Complete, Phase 2 In Development  
**Platform**: https://storehubqms.com 