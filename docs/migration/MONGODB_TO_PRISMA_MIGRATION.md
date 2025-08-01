# MongoDB to Prisma Migration Plan

## Overview
Removing MongoDB completely and using only PostgreSQL with Prisma for better maintainability and scalability.

## Current State
- Using both MongoDB (Mongoose) and PostgreSQL (Prisma)
- Queue and Merchant models exist in both systems
- WebChat customers stored in Prisma, others in MongoDB

## Migration Steps

### Phase 1: Update Queue Operations
1. Replace Queue model methods with Prisma queries
2. Remove MongoDB-specific logic (embedded documents, etc.)
3. Update all queue CRUD operations

### Phase 2: Update Routes
Files to update:
- `/server/routes/queue.js` - Main queue operations
- `/server/routes/webchat.js` - WebChat operations
- `/server/routes/merchant.js` - Merchant operations
- `/server/routes/frontend/dashboard.js` - Dashboard data
- `/server/routes/frontend/auth.js` - Authentication
- `/server/routes/frontend/public.js` - Public routes
- `/server/routes/customer.js` - Customer operations
- `/server/routes/analytics.js` - Analytics

### Phase 3: Remove MongoDB
1. Remove Mongoose models
2. Remove MongoDB connection code
3. Remove mongoose from package.json
4. Update environment variables

## Key Changes

### Queue Model Methods to Replace
- `Queue.findOne()` → `prisma.queue.findFirst()`
- `Queue.find()` → `prisma.queue.findMany()`
- `queue.save()` → `prisma.queue.update()`
- `queue.entries` → `prisma.queueEntry.findMany({ where: { queueId } })`

### Merchant Model Methods to Replace
- `Merchant.findById()` → `prisma.merchant.findUnique({ where: { id } })`
- `Merchant.findOne()` → `prisma.merchant.findFirst()`
- `merchant.save()` → `prisma.merchant.update()`

## Benefits
1. Single database system
2. Type safety with Prisma
3. Better performance with proper relations
4. Easier maintenance
5. Consistent data model