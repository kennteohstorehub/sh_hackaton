#!/bin/bash

# Server Always Up Script
# This script ensures the server stays running and automatically restarts on crash

PORT=3838
LOG_FILE="server-always-up.log"
PID_FILE="server.pid"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if server is running
is_server_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            return 0
        fi
    fi
    
    # Also check by port
    if lsof -ti:$PORT > /dev/null 2>&1; then
        return 0
    fi
    
    return 1
}

# Function to start the server
start_server() {
    echo -e "${YELLOW}Starting server on port $PORT...${NC}"
    
    # Kill any existing process on the port
    lsof -ti:$PORT | xargs kill -9 2>/dev/null
    
    # Start the server in background
    nohup node server/index.js > "$LOG_FILE" 2>&1 &
    SERVER_PID=$!
    echo $SERVER_PID > "$PID_FILE"
    
    # Wait a bit for server to start
    sleep 3
    
    if is_server_running; then
        echo -e "${GREEN}✅ Server started successfully (PID: $SERVER_PID)${NC}"
        echo "📋 Logs: tail -f $LOG_FILE"
        return 0
    else
        echo -e "${RED}❌ Server failed to start${NC}"
        echo "Check logs: tail -100 $LOG_FILE"
        return 1
    fi
}

# Function to monitor and restart server
monitor_server() {
    echo -e "${GREEN}🔍 Starting server monitor...${NC}"
    echo "Press Ctrl+C to stop monitoring"
    
    while true; do
        if ! is_server_running; then
            echo -e "${RED}⚠️  Server is down! Restarting...${NC}" | tee -a "$LOG_FILE"
            start_server
        fi
        sleep 5
    done
}

# Main script
case "${1:-monitor}" in
    start)
        if is_server_running; then
            echo -e "${YELLOW}Server is already running${NC}"
        else
            start_server
        fi
        ;;
    stop)
        if [ -f "$PID_FILE" ]; then
            PID=$(cat "$PID_FILE")
            kill "$PID" 2>/dev/null
            rm -f "$PID_FILE"
            echo -e "${GREEN}Server stopped${NC}"
        else
            echo -e "${YELLOW}Server is not running${NC}"
        fi
        ;;
    restart)
        $0 stop
        sleep 2
        $0 start
        ;;
    status)
        if is_server_running; then
            echo -e "${GREEN}✅ Server is running${NC}"
            if [ -f "$PID_FILE" ]; then
                echo "PID: $(cat $PID_FILE)"
            fi
        else
            echo -e "${RED}❌ Server is not running${NC}"
        fi
        ;;
    monitor|*)
        # First ensure server is running
        if ! is_server_running; then
            start_server
        fi
        # Then start monitoring
        monitor_server
        ;;
esac