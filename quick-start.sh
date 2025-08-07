#!/bin/bash

echo "🚀 Starting StoreHub Queue Management System on port 3838..."
echo ""

# Change to the project directory
cd /Users/kennteoh/Development/Hack

# Export the port
export PORT=3838

# Kill any existing process on port 3838
lsof -ti:3838 | xargs kill -9 2>/dev/null || true

echo "📦 Starting server..."
echo "Dashboard will be available at: http://localhost:3838/dashboard"
echo ""

# Start the server
node server/index.js