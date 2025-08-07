#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 StoreHub Queue Management System Startup Script${NC}"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install Node.js and npm first.${NC}"
    exit 1
fi

# Change to project directory
cd /Users/kennteoh/Development/Hack

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Check if PM2 is installed globally
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}📦 Installing PM2 globally...${NC}"
    npm install -g pm2
fi

# Stop any existing PM2 process for this app
echo -e "${YELLOW}🛑 Stopping any existing queue-system process...${NC}"
pm2 stop queue-system 2>/dev/null || true
pm2 delete queue-system 2>/dev/null || true

# Also kill any process on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Start the application with PM2
echo -e "${GREEN}✅ Starting StoreHub Queue Management System with PM2...${NC}"
pm2 start server/index.js --name queue-system --watch --ignore-watch="node_modules logs tmp sessions" --env production

# Show status
pm2 status

echo ""
echo -e "${GREEN}✅ Server is running!${NC}"
echo -e "${GREEN}📍 Dashboard: http://localhost:3000/dashboard${NC}"
echo -e "${GREEN}📍 API: http://localhost:3000/api${NC}"
echo ""
echo -e "${YELLOW}Useful PM2 commands:${NC}"
echo "  pm2 logs queue-system    - View logs"
echo "  pm2 restart queue-system - Restart server"
echo "  pm2 stop queue-system    - Stop server"
echo "  pm2 status              - Check status"
echo ""
echo -e "${GREEN}Login credentials:${NC}"
echo "  Email: demo@test.com"
echo "  Password: Demo1234!"