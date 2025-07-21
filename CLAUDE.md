# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StoreHub Queue Management System - An AI-powered queue management platform that reduces customer friction during peak hours by allowing customers to join virtual queues via WhatsApp, Facebook Messenger, or web interface.

## Key Technologies

- **Backend**: Node.js with Express.js
- **Databases**: MongoDB (primary) + PostgreSQL via Prisma (production)
- **Frontend**: Server-side rendered EJS templates
- **Real-time**: Socket.IO for live updates
- **Messaging**: WhatsApp Web.js, Facebook Messenger API
- **AI/ML**: Natural.js for NLP and sentiment analysis

## Development Commands

### Standard Operations
```bash
npm run dev          # Start development server with nodemon (hot reload)
npm start            # Start production server
```

### Server Management
```bash
./scripts/server-manager.sh status    # Check server status
./scripts/server-manager.sh start     # Start server (handles port conflicts)
./scripts/server-manager.sh stop      # Stop server
./scripts/server-manager.sh restart   # Restart server
./scripts/server-manager.sh cleanup   # Clean up old processes
./scripts/server-manager.sh logs      # Show server logs
```

### Database Operations
```bash
npx prisma migrate dev    # Run database migrations (development)
npx prisma migrate deploy # Run database migrations (production)
npx prisma generate       # Regenerate Prisma client
npx prisma studio         # Open Prisma Studio GUI
```

### Utility Scripts
```bash
node scripts/create-demo-merchant.js  # Create demo merchant data
node scripts/migrate-to-postgres.js   # Migrate from MongoDB to PostgreSQL
```

## High-Level Architecture

### Request Flow
```
Customer → WhatsApp/Messenger/Web → API Routes → Services → Database
                                          ↓
                                    Socket.IO → Real-time Updates
```

### Directory Structure
```
server/
├── routes/           # API and page routes
│   ├── frontend/    # Server-rendered pages
│   └── *.js        # API endpoints
├── services/        # Business logic
│   ├── whatsappService.js     # WhatsApp integration
│   ├── messengerService.js    # Facebook integration
│   ├── queueNotificationService.js  # Notifications
│   └── aiService.js           # AI/ML features
├── models/          # MongoDB models (legacy)
├── middleware/      # Express middleware
└── utils/          # Shared utilities
```

### Database Schema (Prisma)
- **Merchant**: Business entities with settings and integrations
- **Queue**: Service queues with capacity and business hours
- **QueueEntry**: Customer entries with status tracking
- **ServiceType**: Different service categories
- **Analytics**: Performance and usage metrics

### Key Features

1. **Multi-tenant Architecture**: Each merchant manages their own queues
2. **Multi-channel Support**: WhatsApp, Messenger, and web interfaces
3. **Real-time Updates**: WebSocket-based live queue status
4. **AI Features**: Sentiment analysis, wait time predictions
5. **Business Hours**: Dynamic operating hours management

## Development Practices

### Environment Setup
1. Copy `env.example` to `.env`
2. Configure database URLs and API keys
3. Ensure MongoDB is running locally
4. Run `npm install` to install dependencies

### Common Patterns

**Route Structure**:
```javascript
router.post('/endpoint', authMiddleware, async (req, res) => {
    try {
        // Input validation
        // Business logic via services
        // Response with appropriate status
    } catch (error) {
        logger.error('Context:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
```

**Service Pattern**:
```javascript
class ServiceName {
    async methodName(params) {
        // Validation
        // Core logic
        // Error handling
        return result;
    }
}
```

**Real-time Updates**:
```javascript
io.to(merchantId).emit('queue-update', {
    queueId,
    entries: updatedEntries
});
```

### Security Considerations
- Always validate input data
- Use parameterized queries with Prisma
- Implement rate limiting on public endpoints
- Session management with secure cookies
- Environment variables for sensitive data

### Testing Approach
- Test files: `test-*.js` in root directory
- Focus on integration tests for messaging services
- Manual testing via server management scripts
- Use demo merchant for testing features

### Common Issues & Solutions

**Port Conflicts**: Use `./scripts/server-manager.sh cleanup` to kill orphaned processes

**WhatsApp Connection**: Clear session data in `.wwebjs_auth` if authentication fails

**High CPU Usage**: Check for orphaned Chromium processes from WhatsApp Web.js

**Template Errors**: Ensure all required variables are passed to EJS templates

### Deployment Notes
- Production uses PM2 for process management
- PostgreSQL via Neon for production database
- Environment-specific configurations in `.env`
- Logs stored in `logs/` directory with daily rotation