#!/bin/bash

# Smart Queue Manager Server Management Script

PORT=3001
SERVER_SCRIPT="server/index.js"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if port is in use
check_port() {
    lsof -ti:$PORT > /dev/null 2>&1
}

# Function to kill processes on port
kill_port() {
    echo -e "${YELLOW}Killing processes on port $PORT...${NC}"
    lsof -ti:$PORT | xargs kill -9 2>/dev/null
    sleep 2
}

# Function to start server
start_server() {
    echo -e "${GREEN}Starting Smart Queue Manager server...${NC}"
    
    if check_port; then
        echo -e "${RED}Port $PORT is already in use!${NC}"
        echo -e "${YELLOW}Would you like to kill existing processes? (y/n)${NC}"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            kill_port
        else
            echo -e "${RED}Cannot start server. Port $PORT is in use.${NC}"
            exit 1
        fi
    fi
    
    echo -e "${GREEN}Starting server on port $PORT...${NC}"
    npm start
}

# Function to stop server
stop_server() {
    echo -e "${YELLOW}Stopping Smart Queue Manager server...${NC}"
    
    if check_port; then
        kill_port
        echo -e "${GREEN}Server stopped successfully.${NC}"
    else
        echo -e "${YELLOW}No server running on port $PORT.${NC}"
    fi
}

# Function to restart server
restart_server() {
    echo -e "${YELLOW}Restarting Smart Queue Manager server...${NC}"
    stop_server
    sleep 3
    start_server
}

# Function to check server status
check_status() {
    if check_port; then
        echo -e "${GREEN}✅ Server is running on port $PORT${NC}"
        echo -e "${GREEN}🌐 Dashboard: http://localhost:$PORT${NC}"
        echo -e "${GREEN}🔌 API: http://localhost:$PORT/api${NC}"
        
        # Test if server is responding
        if curl -s http://localhost:$PORT > /dev/null; then
            echo -e "${GREEN}✅ Server is responding to requests${NC}"
        else
            echo -e "${RED}❌ Server is not responding to requests${NC}"
        fi
    else
        echo -e "${RED}❌ No server running on port $PORT${NC}"
    fi
}

# Function to clean up old processes
cleanup() {
    echo -e "${YELLOW}Cleaning up old processes...${NC}"
    
    # Kill old Chromium processes
    pkill -f "chrome-mac/Chromium" 2>/dev/null
    
    # Kill any orphaned node processes
    pkill -f "nodemon" 2>/dev/null
    
    echo -e "${GREEN}Cleanup completed.${NC}"
}

# Function to show logs
show_logs() {
    echo -e "${GREEN}Showing server logs (press Ctrl+C to exit)...${NC}"
    if check_port; then
        # This would show logs if we had a log file
        echo -e "${YELLOW}Server is running. Check the terminal where you started it for logs.${NC}"
    else
        echo -e "${RED}No server running.${NC}"
    fi
}

# Main script logic
case "$1" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        check_status
        ;;
    cleanup)
        cleanup
        ;;
    logs)
        show_logs
        ;;
    *)
        echo -e "${GREEN}Smart Queue Manager Server Management${NC}"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|cleanup|logs}"
        echo ""
        echo "Commands:"
        echo "  start    - Start the server"
        echo "  stop     - Stop the server"
        echo "  restart  - Restart the server"
        echo "  status   - Check server status"
        echo "  cleanup  - Clean up old processes"
        echo "  logs     - Show server logs"
        echo ""
        exit 1
        ;;
esac

exit 0 