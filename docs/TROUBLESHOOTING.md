# StoreHub Queue Management System - Troubleshooting Guide

## Common Issues and Solutions

### 1. Port Already in Use Error (EADDRINUSE)

**Error Message:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**
Use the server management script to handle this automatically:
```bash
./scripts/server-manager.sh start
```

Or manually kill the process:
```bash
lsof -ti:3000 | xargs kill -9
npm start
```

### 2. EJS Template Errors

**Error Message:**
```
ReferenceError: index is not defined
```

**Cause:** This usually happens when template variables are not properly passed from the route to the view.

**Solution:**
- Check that all required variables are passed in the route handler
- Ensure forEach loops in EJS templates have proper index parameters
- Verify that arrays are not undefined before iterating

### 3. WhatsApp Service Errors

**Error Message:**
```
Protocol error (Runtime.callFunctionOn): Target closed
```

**Cause:** WhatsApp service browser instance was closed or crashed.

**Solution:**
1. Clean up old Chromium processes:
   ```bash
   ./scripts/server-manager.sh cleanup
   ```

2. Restart the server:
   ```bash
   ./scripts/server-manager.sh restart
   ```

### 4. High CPU Usage from Chromium Processes

**Cause:** Multiple WhatsApp browser instances running simultaneously.

**Solution:**
```bash
# Kill all Chromium processes
pkill -f "chrome-mac/Chromium"

# Restart the server
./scripts/server-manager.sh restart
```

### 5. Database Connection Issues

**Error Message:**
```
MongooseError: Operation `queues.find()` buffering timed out
```

**Solution:**
1. Check if MongoDB is running
2. Verify connection string in environment variables
3. Restart MongoDB service if needed

### 6. Dashboard Not Loading

**Symptoms:**
- Blank page
- JavaScript errors in console
- Template rendering errors

**Solution:**
1. Check server logs for errors
2. Verify all template variables are defined
3. Clear browser cache
4. Check network connectivity

## Server Management Commands

Use the provided server management script for easy server control:

```bash
# Check server status
./scripts/server-manager.sh status

# Start server (handles port conflicts automatically)
./scripts/server-manager.sh start

# Stop server
./scripts/server-manager.sh stop

# Restart server
./scripts/server-manager.sh restart

# Clean up old processes
./scripts/server-manager.sh cleanup
```

## Debugging Tips

### 1. Enable Debug Logging
```bash
DEBUG=* npm start
```

### 2. Check Server Logs
Monitor the terminal where you started the server for real-time logs.

### 3. Test API Endpoints
```bash
# Test server health
curl http://localhost:3000

# Test dashboard
curl http://localhost:3000/dashboard

# Test API
curl http://localhost:3000/api/health
```

### 4. Browser Developer Tools
- Open browser DevTools (F12)
- Check Console tab for JavaScript errors
- Check Network tab for failed requests

## Performance Optimization

### 1. Memory Usage
- Regularly clean up old Chromium processes
- Monitor Node.js memory usage
- Restart server periodically if memory usage is high

### 2. WhatsApp Service
- Avoid multiple simultaneous WhatsApp connections
- Clean up browser sessions regularly
- Use headless mode for better performance

## Getting Help

If you encounter issues not covered in this guide:

1. Check the server logs for detailed error messages
2. Use the server management script to diagnose issues
3. Ensure all dependencies are properly installed
4. Verify environment variables are set correctly

## Quick Fix Commands

```bash
# Complete reset (use when everything seems broken)
./scripts/server-manager.sh stop
./scripts/server-manager.sh cleanup
sleep 5
./scripts/server-manager.sh start

# Kill all Node processes (nuclear option)
pkill -f node
npm start
``` 