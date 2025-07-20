# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

StoreHub Queue Management System - A real-time queue management platform that reduces customer friction during busy hours by allowing customers to join virtual queues via WhatsApp or Facebook Messenger. The system features AI-powered sentiment analysis, smart wait time predictions, and comprehensive merchant analytics.

## Common Development Commands

### Development & Testing
```bash
npm run dev            # Start development server with nodemon (auto-restart)
npm start              # Start production server
npm test               # Run tests (not configured yet)

# Server management
./scripts/server-manager.sh start     # Start server (handles port conflicts)
./scripts/server-manager.sh stop      # Stop server
./scripts/server-manager.sh restart   # Restart server
./scripts/server-manager.sh status    # Check server status
./scripts/server-manager.sh logs      # View server logs

# Quick development start
./quick-start.sh       # Starts server on port 3838
```

### Initial Setup
```bash
cp env.example .env    # Create environment configuration
npm install            # Install dependencies
node scripts/create-demo-merchant.js  # Create demo merchant data
```

## High-Level Architecture

### Request Flow
```
Customer Device → WhatsApp/Messenger/Web → Webhook/API → Service Layer → MongoDB
                                                ↓
                                          Socket.IO → Real-time Updates
```

### Core Architecture Patterns

1. **Service-Oriented Design**: Business logic isolated in `/server/services/`
   - Each service handles a specific domain (queue, notifications, AI, messaging)
   - Services are injected into routes, maintaining separation of concerns

2. **Real-time Communication**: Socket.IO manages WebSocket connections
   - Room-based broadcasting for merchant and customer updates
   - Event-driven architecture for queue state changes

3. **Multi-Channel Integration**: Unified queue interface across platforms
   - WhatsApp via whatsapp-web.js with QR code authentication
   - Facebook Messenger via webhook API
   - Web interface with responsive design

4. **AI Enhancement Pipeline**:
   ```
   Customer Message → Natural.js Processing → Sentiment Analysis → Smart Response
                                                ↓
                                          Wait Time Prediction
   ```

### Key Technical Decisions

1. **MongoDB with Embedded Documents**: Queue entries are embedded within queue documents for atomic operations and better performance

2. **Session Management**: Express-session with MongoDB store for persistent sessions across server restarts

3. **Security Layers**:
   - WhatsApp phone number whitelist in development
   - Helmet.js for security headers
   - Rate limiting on API endpoints
   - CORS configuration for cross-origin requests

4. **Logging Strategy**: Winston logger with separate error and combined logs, automatic rotation

### Environment Configuration

Required environment variables (.env):
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/storehub-queue
JWT_SECRET=your-secret-key
SESSION_SECRET=your-session-secret
WHATSAPP_SESSION_PATH=./whatsapp-session
NODE_ENV=development
```

### Testing Approaches

For WhatsApp integration testing:
```bash
# Enable test mode in whatsapp-security.js
# Add test phone numbers to whitelist
# Use development mode for easier debugging
```

For queue operations testing:
```bash
# Use the demo merchant created by create-demo-merchant.js
# Test queue join/leave via API endpoints
# Monitor real-time updates via Socket.IO
```

### Important Service Integration Points

1. **WhatsApp Service** (`/server/services/whatsappService.js`):
   - Manages WhatsApp client lifecycle
   - Handles QR code generation and authentication
   - Processes incoming messages and sends notifications

2. **Queue Notification Service** (`/server/services/queueNotificationService.js`):
   - Orchestrates notifications across all channels
   - Manages notification timing and retry logic

3. **AI Service** (`/server/services/aiService.js`):
   - Natural language processing for customer intents
   - Sentiment analysis for priority handling
   - Wait time prediction based on historical data

### Database Schema Considerations

- **Queue Model**: Includes embedded `entries` array for atomic queue operations
- **Merchant Model**: Supports complex business hours with timezone handling
- Indexes on: `merchantId`, `status`, `createdAt` for query performance

### Deployment Notes

Production deployment uses:
```bash
node scripts/deploy-production.js  # Automated deployment script
```

The deployment script handles:
- Environment validation
- Database connection checks
- WhatsApp service initialization
- Process management setup