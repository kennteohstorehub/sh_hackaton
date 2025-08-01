# MongoDB to PostgreSQL Migration Guide

## Overview

This guide documents the complete migration from MongoDB/Mongoose to PostgreSQL/Prisma for the StoreHub Queue Management System. The migration was completed to improve scalability, maintainability, and reduce operational complexity by consolidating to a single database system.

## Migration Benefits

1. **Single Database System**: Simplified infrastructure with just PostgreSQL
2. **Better Scalability**: PostgreSQL handles relational data more efficiently
3. **Type Safety**: Prisma provides compile-time type safety
4. **Better Tooling**: Prisma Studio, migrations, and introspection
5. **Cost Effective**: Single database reduces hosting costs

## Architecture Changes

### Before (MongoDB + Mongoose)
```
├── server/
│   ├── models/
│   │   ├── Queue.js         # Mongoose schema
│   │   └── Merchant.js      # Mongoose schema
│   └── routes/
│       └── *.js             # Direct model usage
```

### After (PostgreSQL + Prisma)
```
├── server/
│   ├── services/
│   │   ├── queueService.js     # Queue operations
│   │   └── merchantService.js  # Merchant operations
│   ├── utils/
│   │   └── prisma.js           # Prisma client singleton
│   └── routes/
│       └── *.js                # Use services instead of models
├── prisma/
│   └── schema.prisma           # Database schema
```

## Key Changes

### 1. Database Schema

**MongoDB (Embedded Documents)**:
```javascript
// Queue with embedded entries
{
  merchantId: ObjectId,
  entries: [{
    customerId: String,
    customerName: String,
    // ... nested data
  }]
}
```

**PostgreSQL (Normalized Relations)**:
```prisma
model Queue {
  id         String       @id @default(uuid())
  merchantId String
  merchant   Merchant     @relation(...)
  entries    QueueEntry[]
}

model QueueEntry {
  id       String @id @default(uuid())
  queueId  String
  queue    Queue  @relation(...)
}
```

### 2. Service Layer Pattern

Created dedicated services to handle database operations:

**queueService.js**:
- `findById(id, include)` - Get queue with optional relations
- `findByMerchant(merchantId)` - Get all queues for a merchant
- `addCustomer(queueId, data)` - Add customer to queue
- `removeCustomer(queueId, customerId, status)` - Remove customer
- `callNext(queueId)` - Call next customer in queue
- `getQueueStats(queueId)` - Get queue statistics

**merchantService.js**:
- `findById(id, include)` - Get merchant with optional relations
- `findByEmail(email)` - Find merchant by email
- `authenticate(email, password)` - Authenticate merchant
- `update(id, data)` - Update merchant data

### 3. Query Changes

**MongoDB**:
```javascript
const queue = await Queue.findById(id).populate('merchantId');
queue.entries.push(newEntry);
await queue.save();
```

**Prisma**:
```javascript
const queue = await queueService.findById(id, { merchant: true });
await queueService.addCustomer(queue.id, newEntry);
```

### 4. Session Store

**MongoDB**:
```javascript
const MongoStore = require('connect-mongo');
store: MongoStore.create({ mongoUrl: MONGODB_URI })
```

**PostgreSQL**:
```javascript
const pgSession = require('connect-pg-simple')(session);
store: new pgSession({ 
  pool: pgPool,
  tableName: 'Session'
})
```

## Migration Steps

### Step 1: Install Dependencies
```bash
npm install @prisma/client prisma
npm install connect-pg-simple
npm uninstall mongoose connect-mongo
```

### Step 2: Create Prisma Schema
Create `prisma/schema.prisma` with all models migrated from Mongoose schemas.

### Step 3: Generate Prisma Client
```bash
npx prisma generate
npx prisma migrate dev --name init
```

### Step 4: Create Service Layer
Implement `queueService.js` and `merchantService.js` to abstract database operations.

### Step 5: Update Routes
Replace all direct model usage with service calls:
- Replace `Queue.find()` with `queueService.findByMerchant()`
- Replace `queue.save()` with `queueService.update()`
- Replace `.populate()` with Prisma includes

### Step 6: Update Real-time Features
Ensure Socket.IO events use new ID format:
- MongoDB `_id` → Prisma `id`
- Update client-side ID references

### Step 7: Data Migration
If migrating existing data:
```javascript
// Example migration script
const oldData = await MongoQueue.find();
for (const queue of oldData) {
  await prisma.queue.create({
    data: {
      id: queue._id.toString(),
      merchantId: queue.merchantId.toString(),
      // ... map other fields
    }
  });
}
```

## Common Pitfalls & Solutions

### 1. ID Field Differences
- MongoDB uses `_id`, Prisma uses `id`
- Solution: Update all references in routes and frontend

### 2. Populate vs Include
- MongoDB `.populate()` doesn't exist in Prisma
- Solution: Use Prisma's include syntax in service methods

### 3. Embedded vs Relational
- MongoDB embeds arrays, PostgreSQL uses relations
- Solution: Normalize data structure properly

### 4. Case Sensitivity
- PostgreSQL column names are case-sensitive in raw queries
- Solution: Use Prisma's query builder or proper quotes in raw SQL

### 5. JSON Fields
- MongoDB stores objects freely, PostgreSQL needs JSON type
- Solution: Define JSON fields in Prisma schema where needed

## Testing the Migration

Run the comprehensive test suite:
```bash
node test-prisma-migration.js
```

Expected results:
- ✅ Queue operations (CRUD)
- ✅ Merchant operations 
- ✅ Customer queue joining
- ✅ Real-time updates
- ✅ Analytics queries
- ✅ Session management

## Environment Variables

Update `.env` file:
```bash
# Remove MongoDB
# MONGODB_URI=mongodb://...

# Add PostgreSQL
DATABASE_URL="postgresql://..."
DATABASE_URL_DIRECT="postgresql://..."
```

## Rollback Plan

If issues arise:
1. Keep MongoDB models in a backup branch
2. Prisma migrations can be rolled back
3. Service layer can be modified to support both databases temporarily

## Future Improvements

1. **Add database indexes** for frequently queried fields
2. **Implement connection pooling** optimization
3. **Add database backup automation**
4. **Consider read replicas** for scaling
5. **Add query performance monitoring**

## Conclusion

The migration from MongoDB to PostgreSQL with Prisma provides a more scalable, maintainable, and cost-effective solution. The service layer pattern ensures clean separation of concerns and makes future database changes easier to implement.