#!/bin/bash

# Simple server startup script with auto-restart
echo "🚀 Starting StoreHub QMS Server with auto-restart..."

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

# Stop any existing instance
pm2 stop storehub-qms 2>/dev/null

# Start with PM2
pm2 start ecosystem.config.js

# Show status
pm2 status

echo ""
echo "✅ Server is running with auto-restart enabled!"
echo ""
echo "🌐 Access URLs:"
echo "   BackOffice: http://admin.lvh.me:3000"
echo "   Demo Tenant: http://demo.lvh.me:3000"
echo "   Test Cafe: http://test-cafe.lvh.me:3000"
echo ""
echo "📋 Useful commands:"
echo "   View logs: pm2 logs storehub-qms"
echo "   Stop server: pm2 stop storehub-qms"
echo "   Restart: pm2 restart storehub-qms"
echo "   Monitor: pm2 monit"
echo ""