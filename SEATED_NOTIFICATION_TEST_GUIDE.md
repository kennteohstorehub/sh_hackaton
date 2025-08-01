# Seated Notification Feature - Test Guide

## Overview
After a merchant assigns a table to a customer, the system now:
1. Sends a "You have been seated" notification to the customer's WebChat
2. Closes the WebChat session cleanly
3. Prevents further messages from being sent

## How to Test

### 1. Start the Application
```bash
npm run dev
```
The server is running at http://localhost:3838

### 2. Open Two Browser Windows

#### Window 1: Merchant Dashboard
1. Navigate to http://localhost:3838/auth/login
2. Login with:
   - Email: `demo@storehub.com`
   - Password: `demo123`
3. You'll see the queue dashboard

#### Window 2: Customer WebChat
1. Navigate to http://localhost:3838/chat/[merchantId]
   - You can find the merchantId in the merchant dashboard URL
2. Or use the QR code from the merchant dashboard

### 3. Test Flow

#### Step 1: Customer Joins Queue
In the customer window:
1. Fill in the form:
   - Name: Test Customer
   - Phone: +60123456789
   - Party Size: 2
2. Click "Join Queue"
3. Customer sees confirmation and queue position

#### Step 2: Merchant Calls Customer
In the merchant window:
1. See the new customer in the queue
2. Click "Call Next" or the specific call button
3. Customer receives notification "IT'S YOUR TURN!"

#### Step 3: Customer Acknowledges
In the customer window:
1. Click "On My Way" button
2. Merchant sees acknowledgment

#### Step 4: Merchant Assigns Table (NEW FEATURE)
In the merchant window:
1. Click "Assign Table" button
2. Enter table number (e.g., "5")
3. Click confirm

#### Step 5: Customer Receives Seated Notification
In the customer window, you'll see:
1. 🎉 "You have been seated at table 5. Thank you for using our queue system!"
2. Connection status changes to "Session Ended"
3. Message input becomes disabled with placeholder "Queue session has ended"
4. Quick action buttons disappear
5. After 2 seconds: "This chat session is now closed. We hope you enjoy your visit!"
6. WebSocket disconnects automatically

### What's Happening Behind the Scenes

1. **Server Side** (`/server/routes/queue.js`):
   - When table is assigned, emits `customer-seated-notification` to customer
   - Clears the WebChat session using `webChatService.clearSession()`
   - Logs the action for debugging

2. **Client Side** (`/public/js/queue-chat.js`):
   - `handleCustomerSeated()` method processes the notification
   - Updates UI to show session ended state
   - Removes queue data from localStorage
   - Disconnects WebSocket connection
   - Disables all interactive elements

### Expected Behavior

✅ Customer receives clear notification about being seated
✅ Table number is displayed in the message
✅ Session ends transparently - no confusion about queue status
✅ Customer cannot send further messages
✅ Clean resource cleanup on both server and client
✅ Professional ending to the queue experience

### Debugging

Check browser console for:
- `[SEATED] Customer seated notification received` - Confirms event was received
- `[SEATED] Cleared WebChat session` - Server cleaned up session

Check server logs for:
- `[SEATED] Sent seated notification to room` - Notification was sent
- `[SEATED] Cleared WebChat session for customer` - Session was cleared

## Benefits

1. **Clear Communication**: Customers know exactly when they've been seated
2. **Transparent Session Management**: No ambiguity about when the interaction ends
3. **Resource Efficiency**: Sessions are properly closed and cleaned up
4. **Better UX**: Professional conclusion to the queue experience
5. **Prevents Confusion**: Customers can't accidentally send messages after being seated