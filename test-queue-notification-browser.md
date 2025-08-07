# Queue Status Page Notification Test Guide

## Summary of Implementation

✅ **Notification Sound System Implemented**
- Plays sound automatically when customer status changes to "called" or "serving"
- Multiple sound format support (MP3, OGG) for browser compatibility
- Sound repeats 3 times with 2-second intervals for better attention
- Visual fallback with screen flash animation if sound fails
- Uses localStorage to prevent duplicate notifications
- Checks for status updates every 10 seconds via API

✅ **StoreHub Design System Applied**
- Primary orange color (#FA8C16) for branding
- Success green (#52C41A) for called status
- Open Sans font family
- 4px grid spacing system
- Rounded corners and soft shadows
- Responsive design for mobile and desktop
- Animated queue number with pulsing effect when called

## Manual Testing Steps

### 1. Join a Queue
Open in your browser:
```
http://localhost:3000/queue/join/3ecceb82-fb33-42c8-9d84-19eb69417e16
```

Fill in:
- Name: Test Customer
- Phone: +60123456789
- Party Size: 2

Click "Join Queue"

### 2. View Queue Status Page
After joining, you'll be redirected to the status page showing:
- Large circular queue number
- Current status message
- Estimated wait time
- Position in queue
- Timeline of your journey

### 3. Test Notification Sound

**Option A: Using Merchant Dashboard**
1. Open merchant dashboard in another browser/tab
2. Login as merchant
3. Find your test customer in the "Waiting" section
4. Click the "Call" button

**Option B: Direct Database Update (for testing)**
```bash
# Get the customer entry ID from the status page URL
# Update status to 'called' in database
```

### 4. Expected Behavior When Called

When your status changes to "called":
1. 🔔 **Notification sound plays** (repeats 3 times)
2. 🟢 **Queue number turns green** with pulsing animation
3. ✅ **Success notification card** appears at top
4. 📱 **Browser notification** (if permissions granted)
5. 🔄 **Page auto-refreshes** to show updated status

### 5. Visual Indicators

**Waiting State:**
- Orange queue number
- "You're in the queue!" message
- Shows number of people ahead

**Called State:**
- Green pulsing queue number
- "Your turn has arrived!" message
- Bell icon notification card
- Ringing bell animation

**Serving State:**
- Green queue number
- "You're being served" message
- Checkmark icon

## Features Implemented

### Audio System
- Primary sound: `/sounds/table-ready.mp3`
- Fallback sound: `/sounds/notification.mp3`
- Volume set to 70% for comfortable listening
- Automatic retry with different formats

### Visual Feedback
- Color changes (orange → green)
- Pulse animation on queue number
- Sliding notification cards
- Bell ringing animation
- Screen flash as fallback

### Real-time Updates
- API endpoint: `/api/queue/:queueId/status/:customerId`
- Checks every 10 seconds for status changes
- Automatic page refresh on status change
- WebSocket support for instant updates

## Troubleshooting

If notification sound doesn't play:
1. Check browser console for errors
2. Ensure browser allows autoplay (some browsers block it)
3. Check volume is not muted
4. Try clicking anywhere on the page first (interaction requirement)
5. Visual notifications will still work as fallback

## Design System Elements Used

- **Colors**: Primary orange (#FA8C16), Success green (#52C41A)
- **Typography**: Open Sans font, various weights
- **Spacing**: 4px grid system (space-1 through space-16)
- **Shadows**: Subtle elevation (shadow-sm, shadow-md, shadow-lg)
- **Radius**: Soft corners (radius-md: 8px, radius-lg: 12px)
- **Animations**: Smooth transitions (250ms default)