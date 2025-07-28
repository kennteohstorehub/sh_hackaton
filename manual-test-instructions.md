# Manual End-to-End Test Instructions

Follow these steps to verify the webchat queue system works end-to-end:

## Setup
1. Open two browser windows side by side
2. In Window 1: Go to http://localhost:3838/dashboard and login
3. In Window 2: Go to http://localhost:3838/queue/join/3ecceb82-fb33-42c8-9d84-19eb69417e16

## Test Steps

### 1. Customer Joins Queue (Window 2)
- Fill in the form:
  - Name: "Manual Test Customer"
  - Phone: "0123456789"
  - Party Size: 2
  - Special Requests: "Testing webchat system"
- Click "Join Queue"
- ✅ **Verify**: You're redirected to the chat interface
- ✅ **Verify**: You see welcome messages with queue number and verification code

### 2. Dashboard Shows Customer (Window 1)
- Refresh the dashboard
- ✅ **Verify**: "Manual Test Customer" appears in the Active Queue
- ✅ **Verify**: The customer shows platform as "webchat"
- ✅ **Verify**: Total waiting count increases

### 3. Test Status Check (Window 2)
- Click "Check Status" button
- ✅ **Verify**: You receive current position and wait time
- ✅ **Verify**: Status shows as "waiting"

### 4. Test Notification (Window 1)
- Find "Manual Test Customer" in the queue
- Click "Select" button (or "Notify" if first in queue)
- Confirm the notification
- ✅ **Verify**: Success message appears

### 5. Customer Receives Notification (Window 2)
- ✅ **Verify**: "IT'S YOUR TURN!" message appears
- ✅ **Verify**: Verification code is displayed
- ✅ **Verify**: Browser notification appears (if enabled)

### 6. Test Cancellation (Window 2)
- Click "Cancel Queue" button
- Type "YES" to confirm
- ✅ **Verify**: Success message appears
- ✅ **Verify**: "You've been successfully removed from the queue"

### 7. Dashboard Updates (Window 1)
- Refresh the dashboard
- ✅ **Verify**: "Manual Test Customer" no longer appears
- ✅ **Verify**: Total waiting count decreases

### 8. Verify Not in Queue (Window 2)
- Click "Check Status"
- ✅ **Verify**: Message says "You're not currently in any queue"

## Summary of Working Features

Based on automated tests:
- ✅ Customer can join queue via web form
- ✅ Customer gets unique session ID and verification code
- ✅ Real-time chat interface loads successfully
- ✅ Status check returns correct queue position
- ✅ Cancellation removes customer from queue
- ✅ System correctly tracks queue state
- ✅ WebSocket connections work for real-time updates
- ✅ Session persistence works across page refreshes

## Known Issues Fixed
- Fixed: Queue status 404 error
- Fixed: Cancel functionality not working
- Fixed: Dashboard not showing webchat customers
- Fixed: Notification system for webchat customers
- Fixed: Socket room management for webchat

## Test Results
All customer-facing features are working correctly. The system properly handles:
- Queue management (join, status, cancel)
- Real-time notifications via WebSocket
- Session management and persistence
- Integration between Prisma (webchat) and MongoDB (other platforms)