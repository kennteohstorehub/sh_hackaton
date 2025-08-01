# Read Receipt/Acknowledgment System Documentation

## Overview

This document describes the implementation of a two-way acknowledgment system for table ready notifications in the StoreHub QMS. The system ensures that when customers are notified their table is ready, they can acknowledge receipt, and the backend confirms this acknowledgment was successfully received.

## Features Implemented

### 1. **Backend Confirmation System**
- Modified `/api/queue/acknowledge` endpoint to emit WebSocket confirmation after successful database update
- Added `acknowledgment-confirmed` socket event that sends confirmation back to the customer
- Includes timestamp and acknowledgment type in confirmation message

### 2. **Frontend Receipt Handling**
- Added listener for `acknowledgment-confirmed` event in `queue-chat.js`
- Shows visual confirmation with animated checkmark when acknowledgment is received
- Updates UI to show "Acknowledged ✓" status permanently
- Stores acknowledgment status in localStorage to persist across page refreshes

### 3. **Retry Mechanism**
- Implements 5-second timeout for acknowledgment confirmation
- Automatically retries up to 3 times if no confirmation is received
- Shows loading spinner during acknowledgment process
- Displays appropriate error messages if acknowledgment fails after all retries

### 4. **Enhanced Merchant Dashboard**
- Real-time toast notifications when customers acknowledge
- Visual pulse animation on customer rows when acknowledgment is received
- Different icons and statuses for different acknowledgment types:
  - ✅ "On way" - Customer is coming
  - ⏱️ "Needs time" - Customer needs more time
- Acknowledgment timestamp displayed in the dashboard
- Plays notification sound when acknowledgment is received

### 5. **Database Schema**
The system uses the existing database fields:
- `acknowledged` (Boolean) - Whether the customer has acknowledged
- `acknowledgedAt` (DateTime) - When the acknowledgment was received
- `acknowledgmentType` (String) - Type of acknowledgment (on_way, need_time)

## Technical Implementation

### Backend Flow
1. Customer clicks acknowledgment button in webchat
2. Frontend sends POST to `/api/queue/acknowledge` with entry ID and type
3. Backend updates database with acknowledgment details
4. Backend emits `acknowledgment-confirmed` to customer's WebSocket rooms
5. Backend emits `customer-acknowledged` to merchant dashboard

### Frontend Flow
1. Customer sees "I'm headed to the restaurant" button when called
2. Click triggers `acknowledge()` function with retry logic
3. Function sends HTTP request and waits for WebSocket confirmation
4. On success: Shows animated checkmark and success message
5. On timeout: Retries up to 3 times before showing fallback message
6. Updates local storage to persist acknowledgment state

### WebSocket Events

#### `acknowledgment-confirmed` (Server → Customer)
```javascript
{
  entryId: string,
  customerId: string,
  customerName: string,
  type: string,
  acknowledgedAt: DateTime,
  message: string,
  queueName: string
}
```

#### `customer-acknowledged` (Server → Merchant)
```javascript
{
  queueId: string,
  entryId: string,
  customerName: string,
  type: string,
  acknowledgedAt: DateTime,
  message: string
}
```

## Benefits

1. **Reliability**: Customers receive confirmation their acknowledgment was received
2. **User Experience**: Clear visual feedback reduces anxiety and confusion
3. **Merchant Value**: Real-time visibility into customer responsiveness
4. **System Integrity**: Two-way confirmation ensures data consistency
5. **Resilience**: Retry mechanism handles temporary network issues

## Testing

A comprehensive test script is provided at `test-acknowledgment-flow.js` that verifies:
- Customer can acknowledge table ready notifications
- Backend sends confirmation via WebSocket
- Frontend displays success confirmation
- Merchant dashboard updates in real-time
- Retry mechanism works when network is interrupted

## Usage

### For Customers
1. When notified table is ready, click "I'm headed to the restaurant"
2. See loading spinner while acknowledgment is sent
3. See animated checkmark when confirmed
4. If network issues occur, system automatically retries

### For Merchants
1. See real-time updates when customers acknowledge
2. Visual pulse animation draws attention to acknowledged customers
3. Status shows "On way" with timestamp
4. Toast notification provides immediate feedback

## Future Enhancements

1. Add estimated arrival time based on customer location
2. Support more acknowledgment types (e.g., "running late", "5 minutes away")
3. Analytics on acknowledgment rates and response times
4. Push notification support for acknowledgment confirmations
5. SMS fallback for acknowledgment confirmation