# Chatbot Deployment Guide

## 🚀 Quick Deployment to Render

The web-based chatbot with push notifications has been successfully pushed to GitHub and is ready for deployment on Render.

### Prerequisites

1. **Environment Variables** - Make sure these are set in your Render dashboard:
   - `DATABASE_URL` - Your Neon pooled connection string
   - `DATABASE_URL_DIRECT` - Your Neon direct connection string
   - `VAPID_PUBLIC_KEY` - For push notifications (will be auto-generated if not set)
   - `VAPID_PRIVATE_KEY` - For push notifications (will be auto-generated if not set)

### Deployment Steps

1. **Automatic Deployment**
   - If auto-deploy is enabled, Render will automatically deploy the latest changes
   - Check your Render dashboard for deployment status

2. **Manual Deployment**
   - Go to your Render dashboard
   - Click "Manual Deploy" > "Deploy latest commit"

### Post-Deployment Setup

1. **Database Migration**
   - The migration will run automatically during build
   - New fields added: `sessionId` in QueueEntry, `webchat` platform enum

2. **Test the Chatbot**
   - Visit: `https://your-app.onrender.com/chatbot-demo.html`
   - Or embed on any page: `https://your-app.onrender.com/chatbot?merchantId=YOUR_ID`

3. **Add Sound Files** (Optional)
   - Upload notification sounds to `/public/sounds/`:
     - `notification.mp3` - General notification sound
     - `table-ready.mp3` - Table ready alert sound

4. **Add PWA Icons** (Optional)
   - Upload icon files as specified in `/public/images/README.md`
   - This enables better mobile app experience

### Testing the Features

1. **Chat Widget**
   - Look for the orange chat button in bottom-right corner
   - Click to open the chat interface

2. **Join Queue**
   - Type "join" or click "Join Queue" button
   - Fill in the form with test details
   - Note the verification code displayed

3. **Push Notifications**
   - Allow notifications when prompted
   - Notifications will play sounds when:
     - Someone ahead is seated (position update)
     - Your table is ready

4. **Session Persistence**
   - Refresh the page - your queue status persists
   - Session stored in browser localStorage

### Monitoring

- Check logs: `https://dashboard.render.com/web/YOUR_SERVICE/logs`
- Monitor active sessions in your database
- Push notification delivery can be tracked via browser DevTools

### Troubleshooting

1. **Notifications not working**
   - Ensure HTTPS is enabled (required for service workers)
   - Check browser notification permissions
   - Verify VAPID keys are set correctly

2. **Chat not appearing**
   - Check browser console for errors
   - Ensure Socket.IO is connecting properly
   - Verify merchant ID is valid

3. **Database errors**
   - Run `npx prisma migrate deploy` manually if needed
   - Check DATABASE_URL connection strings

### Security Notes

- Phone numbers are validated
- Session IDs are cryptographically random
- Verification codes are unique per day
- All API endpoints validate input

## 🎉 Ready to Test!

Your chatbot is now live and ready for testing. The free web-based solution provides all WhatsApp features including real-time updates and sound notifications!