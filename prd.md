# StoreHub Queue Management System - Product Requirements Document (PRD)

## Document Information
- **Version**: 3.0
- **Date**: August 2025
- **Status**: Active Development
- **Platform URL**: *.storehubqms.com

---

## 1. Executive Summary

### 1.1 Product Overview
StoreHub Queue Management System is a comprehensive multi-tenant SaaS platform designed to revolutionize queue management for restaurants and retail establishments. The system enables customers to join virtual queues via web interface and receive real-time notifications through multiple channels (browser, WhatsApp, WebChat). Each tenant operates on their own branded subdomain (e.g., `storehubrestaurant.storehubqms.com`) with complete data isolation.

### 1.2 Business Objectives
- **Primary Goal**: Provide an enterprise-grade, multi-tenant queue management SaaS platform
- **Secondary Goals**:
  - Enable automatic subdomain provisioning for tenants
  - Support tiered subscription models with feature gating
  - Reduce operational overhead by 60% through automation
  - Scale to support thousands of tenants on shared infrastructure

### 1.3 Target Market
- **Primary**: Malaysian restaurants in shopping malls and commercial areas
- **Secondary**: Cafes, food courts, retail stores, service centers
- **Geographic Focus**: Malaysia (initial), Southeast Asia (expansion)
- **Business Size**: SME to Enterprise with multi-location support

---

## 2. Product Vision & Strategy

### 2.1 Vision Statement
"To become the leading queue management platform in Southeast Asia by providing a seamless, branded experience for businesses and their customers through innovative multi-tenant technology."

### 2.2 Key Differentiators
- **Subdomain-Based Multi-Tenancy**: Each tenant gets `{tenant}.storehubqms.com`
- **Automated Provisioning**: < 2 minutes from signup to operational subdomain
- **WebChat Integration**: Real-time browser-based communication
- **SuperAdmin Control Panel**: Comprehensive tenant management
- **No App Required**: Pure web-based solution
- **Enterprise Security**: Complete tenant isolation with audit trails

---

## 3. System Architecture Overview

### 3.1 Multi-Tenant Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                        Internet/Users                            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                    Cloudflare DNS                                │
│                  *.storehubqms.com                               │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                    Render.com                                    │
│              (Load Balancer + SSL Termination)                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                 Node.js Application                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            Tenant Resolution Middleware                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         Queue Management    |    SuperAdmin Portal       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│              PostgreSQL (Shared Database)                        │
│                  with Row-Level Isolation                        │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 URL Structure
- **SuperAdmin Portal**: `admin.storehubqms.com`
- **Tenant Dashboard**: `{tenant}.storehubqms.com/dashboard`
- **Customer Queue**: `{tenant}.storehubqms.com/queue`
- **Public API**: `api.storehubqms.com`

---

## 4. User Personas

### 4.1 SuperAdmin (Platform Administrator)
- **Profile**: Technical administrator managing the entire platform
- **Responsibilities**: 
  - Create and manage tenant accounts
  - Monitor system health and usage
  - Handle billing and subscriptions
  - Provide technical support
- **Pain Points**: Manual tenant setup, scattered management tools
- **Goals**: Efficient tenant management, system stability, revenue tracking

### 4.2 Tenant Admin (Business Owner)
- **Profile**: Restaurant/retail business owner
- **Responsibilities**:
  - Configure business settings and branding
  - Manage staff accounts
  - Review analytics and reports
  - Handle subscription and billing
- **Pain Points**: Complex setup, lack of customization
- **Goals**: Easy setup, brand consistency, operational insights

### 4.3 Tenant Staff (Queue Manager)
- **Profile**: Front-desk staff managing daily operations
- **Responsibilities**:
  - Manage customer queues
  - Call and seat customers
  - Handle walk-ins
  - Respond to customer inquiries
- **Pain Points**: Rush hour management, system complexity
- **Goals**: Simple interface, quick actions, real-time updates

### 4.4 Customer (End User)
- **Profile**: Diners and shoppers at tenant locations
- **Responsibilities**:
  - Join virtual queue
  - Monitor queue status
  - Respond to notifications
  - Provide feedback
- **Pain Points**: Long waits, uncertainty, missed calls
- **Goals**: Continue activities while waiting, timely notifications

---

## 5. Core Features

### 5.1 SuperAdmin Control Panel

#### 5.1.1 Tenant Management
- **Automated Provisioning**
  - Subdomain generation and SSL provisioning
  - Render API integration for domain management
  - Default configuration templates
  - Welcome email automation

- **Tenant Operations**
  - Create, Read, Update, Delete (CRUD)
  - Activate/Deactivate with grace periods
  - Bulk operations support
  - Subdomain management

- **User Management**
  - Email invitation system
  - Role-based access control
  - Bulk user import (CSV)
  - Password reset management

#### 5.1.2 Subscription & Billing
| Plan | Queues | Customers/Day | Features | Price/Month |
|------|--------|---------------|----------|-------------|
| Free | 1 | 50 | Basic | $0 |
| Basic | 3 | 200 | + Analytics | $29 |
| Premium | Unlimited | 1000 | + API, SMS, WebChat | $99 |
| Enterprise | Custom | Custom | All Features + SLA | Custom |

#### 5.1.3 Analytics Dashboard
- System-wide metrics
- Tenant usage statistics
- Revenue tracking
- Growth trends
- Performance monitoring

### 5.2 Tenant Features

#### 5.2.1 Queue Management
- **Customer Queue Operations**
  - Web-based queue joining
  - Real-time position updates
  - Estimated wait time
  - Party size management (1-20)
  - Special requests/notes

- **Staff Dashboard**
  - Live queue display
  - Drag-and-drop seating
  - Call customer functionality
  - Queue statistics
  - Color-coded party sizes

#### 5.2.2 Notification Channels
- **WebChat** (Primary)
  - Real-time browser notifications
  - Persistent chat interface
  - Session recovery
  - Typing indicators

- **WhatsApp Business**
  - Template messages
  - Media support
  - Two-way communication

- **Browser Push**
  - Web push notifications
  - Offline capability

#### 5.2.3 Branding & Customization
- Custom logo upload
- Brand colors
- Welcome messages
- Notification templates
- Operating hours

### 5.3 Customer Features

#### 5.3.1 Queue Experience
- Mobile-optimized interface
- Real-time queue status
- Position tracking
- Wait time estimates
- Leave/rejoin capability

#### 5.3.2 Communication
- WebChat interface
- Notification preferences
- Feedback system
- Help/support access

---

## 6. Technical Requirements

### 6.1 Technology Stack
- **Hosting**: Render.com with auto-scaling
- **Database**: PostgreSQL on Neon with Prisma ORM
- **Backend**: Node.js + Express.js
- **Frontend**: EJS templates + Vanilla JS
- **Real-time**: Socket.IO with Redis adapter
- **Security**: Helmet.js, CSRF, rate limiting
- **Sessions**: express-session with PostgreSQL store
- **Email**: SendGrid/AWS SES
- **File Storage**: Cloudinary
- **Monitoring**: Custom analytics + external APM

### 6.2 Performance Requirements
- Page load time: < 2 seconds
- API response time: < 200ms
- Real-time update latency: < 100ms
- Support 1000+ concurrent tenants
- 99.9% uptime SLA

### 6.3 Security Requirements
- Complete tenant data isolation
- SSL/TLS encryption
- OWASP compliance
- Regular security audits
- GDPR compliance
- Comprehensive audit logging

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Completed) ✅
- Basic queue management
- PostgreSQL migration
- WebChat implementation
- Session recovery
- Multi-tenant middleware

### Phase 2: SuperAdmin Portal (Current) 🚧
- Tenant CRUD operations
- Subdomain provisioning
- User invitation system
- Basic analytics
- Billing integration

### Phase 3: Advanced Features (Q3 2025)
- SMS notifications
- Advanced analytics
- API marketplace
- Mobile apps
- Multi-location support

### Phase 4: Enterprise (Q4 2025)
- White-label options
- Custom integrations
- Advanced reporting
- AI-powered insights
- Global expansion

---

## 8. Success Metrics

### 8.1 Business Metrics
- Active tenants: 500+ by end of 2025
- Monthly Recurring Revenue: $50,000+
- Tenant churn rate: < 5%
- Customer satisfaction: > 95%

### 8.2 Technical Metrics
- System uptime: 99.9%
- Average response time: < 200ms
- Subdomain provisioning: < 30 seconds
- Zero security incidents

### 8.3 User Metrics
- Tenant onboarding time: < 2 minutes
- Daily active users: 10,000+
- Queue completion rate: > 90%
- Support ticket reduction: 60%

---

## 9. Risk Analysis

### 9.1 Technical Risks
- **Scalability**: Mitigated by horizontal scaling and caching
- **Security**: Addressed through tenant isolation and auditing
- **Performance**: Monitored with APM and optimization

### 9.2 Business Risks
- **Competition**: Differentiated by multi-tenant architecture
- **Adoption**: Simplified onboarding and free tier
- **Churn**: Feature-rich platform with excellent support

---

## 10. Appendices

### A. Database Schema Overview
- Multi-tenant architecture with tenant_id isolation
- Comprehensive audit logging
- Optimized indexes for performance
- Scalable schema design

### B. API Structure
- RESTful design principles
- Consistent error handling
- Rate limiting and throttling
- Comprehensive documentation

### C. UI/UX Guidelines
- Mobile-first responsive design
- Accessibility compliance (WCAG 2.1)
- Consistent design system
- Performance-optimized assets

---

**Document Approval**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Tech Lead | | | |
| UX Designer | | | |
| Engineering Manager | | | |