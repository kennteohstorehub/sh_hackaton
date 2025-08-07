#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting StoreHub Queue System (Development Mode)${NC}"
echo ""

# Change to project directory
cd /Users/kennteoh/Development/Hack

# Kill any existing process on port 3000
echo -e "${YELLOW}🛑 Checking for existing processes on port 3000...${NC}"
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo -e "${YELLOW}Killed existing process on port 3000${NC}" || echo -e "${GREEN}Port 3000 is free${NC}"

# Also check port 3838 (old port)
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo -e "${YELLOW}Killed existing process on port 3838${NC}"

echo ""
echo -e "${GREEN}✅ Starting development server with nodemon...${NC}"
echo -e "${GREEN}📍 Dashboard will be available at: http://localhost:3000${NC}"
echo -e "${GREEN}📍 Login: demo@test.com / Demo1234!${NC}"
echo ""

# Start with nodemon for auto-restart on file changes
npm run dev