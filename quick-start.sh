#!/bin/bash

echo "🚀 Starting StoreHub Queue Management System on port 3000..."
echo ""

# Change to the project directory
cd /Users/kennteoh/Development/Hack

# Export the port
export PORT=3000

# Kill any existing process on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

echo "📦 Starting server..."
echo "Dashboard will be available at: http://localhost:3000/dashboard"
echo ""

# Start the server
node server/index.js