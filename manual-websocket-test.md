# Manual WebSocket Notification Test

## Prerequisites
- Server running on http://localhost:3838
- Two browser windows/tabs

## Test Steps

### Window 1: Customer
1. Open http://localhost:3838/queue/join/7a99f35e-0f73-4f8e-831c-fde8fc3a5532
2. Fill in:
   - Name: Manual Test User
   - Phone: +60191234567
   - Party Size: 2
3. Click "Join Queue"
4. Note the queue number and keep this window open
5. Open browser console (F12) and run: `window.socket?.connected` (should be true)

### Window 2: Merchant
1. Open http://localhost:3838/login
2. Login with:
   - Email: demo@storehub.com
   - Password: demo1234
3. You should see the dashboard
4. Look for "Manual Test User" in the customer list
5. Click the "Notify" button next to the customer

### Expected Results
- Customer window should receive a notification
- The notification should appear either as:
  - A popup/alert on the page
  - Text update showing "YOUR TURN" or similar
  - Console log showing the notification received
- Customer status in merchant dashboard should change from "waiting" to "called"

## Verification via API

You can also test the API directly:

```bash
# 1. Join queue via API
curl -X POST http://localhost:3838/api/webchat/join \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "API Test User",
    "customerPhone": "+60191234567",
    "partySize": 2,
    "merchantId": "7a99f35e-0f73-4f8e-831c-fde8fc3a5532",
    "sessionId": "test_session_123"
  }'

# 2. Check status (use the sessionId from above)
curl http://localhost:3838/api/webchat/status/test_session_123

# 3. As merchant, get queue info
curl http://localhost:3838/api/queue/7a99f35e-0f73-4f8e-831c-fde8fc3a5532

# 4. Call next customer (need to get queue ID from dashboard or API)
curl -X POST http://localhost:3838/api/queue/{QUEUE_ID}/call-next
```

## WebSocket Connection Test

In the browser console on the customer page:

```javascript
// Check if socket is connected
console.log('Socket connected:', window.socket?.connected);

// Listen for notifications
if (window.socket) {
  window.socket.on('notification', (data) => {
    console.log('Notification received:', data);
  });
  window.socket.on('customer-called', (data) => {
    console.log('Customer called:', data);
  });
}
```