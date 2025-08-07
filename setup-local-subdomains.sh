#!/bin/bash

# Local Subdomain Setup Script for macOS/Linux
# This script sets up local subdomain testing for the multi-tenant system

set -e

echo "🚀 StoreHub QMS - Local Subdomain Setup"
echo "======================================="
echo

# Function to detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    else
        echo "unsupported"
    fi
}

OS=$(detect_os)

if [ "$OS" == "unsupported" ]; then
    echo "❌ This script only supports macOS and Linux"
    exit 1
fi

# Function to check if running with sudo
check_sudo() {
    if [ "$EUID" -ne 0 ]; then
        echo "❌ This script needs sudo privileges to modify /etc/hosts"
        echo "Please run: sudo $0"
        exit 1
    fi
}

# Function to setup hosts file
setup_hosts_file() {
    echo "📝 Setting up /etc/hosts entries..."
    
    # Backup hosts file
    cp /etc/hosts /etc/hosts.backup.$(date +%Y%m%d%H%M%S)
    
    # Check if entries already exist
    if grep -q "storehubqms.local" /etc/hosts; then
        echo "⚠️  Entries already exist in /etc/hosts. Skipping..."
    else
        # Add entries
        echo "" >> /etc/hosts
        echo "# StoreHub QMS Local Development" >> /etc/hosts
        echo "127.0.0.1   storehubqms.local" >> /etc/hosts
        echo "127.0.0.1   admin.storehubqms.local" >> /etc/hosts
        echo "127.0.0.1   demo.storehubqms.local" >> /etc/hosts
        echo "127.0.0.1   test-restaurant-1.storehubqms.local" >> /etc/hosts
        echo "127.0.0.1   test-restaurant-2.storehubqms.local" >> /etc/hosts
        echo "127.0.0.1   test-cafe.storehubqms.local" >> /etc/hosts
        echo "# End StoreHub QMS" >> /etc/hosts
        
        echo "✅ Added hosts entries"
    fi
}

# Function to setup dnsmasq (macOS)
setup_dnsmasq_macos() {
    echo "📝 Setting up dnsmasq for wildcard domains..."
    
    # Check if Homebrew is installed
    if ! command -v brew &> /dev/null; then
        echo "❌ Homebrew is required but not installed"
        echo "Install from: https://brew.sh"
        exit 1
    fi
    
    # Install dnsmasq
    if ! brew list dnsmasq &> /dev/null; then
        echo "Installing dnsmasq..."
        brew install dnsmasq
    fi
    
    # Configure dnsmasq
    echo "address=/.storehubqms.local/127.0.0.1" > /usr/local/etc/dnsmasq.conf
    
    # Start dnsmasq
    sudo brew services start dnsmasq
    
    # Setup resolver
    sudo mkdir -p /etc/resolver
    echo "nameserver 127.0.0.1" | sudo tee /etc/resolver/storehubqms.local > /dev/null
    
    echo "✅ dnsmasq configured for *.storehubqms.local"
}

# Function to create .env.local
setup_env_file() {
    echo "📝 Creating .env.local file..."
    
    if [ -f ".env.local" ]; then
        echo "⚠️  .env.local already exists. Creating .env.local.example instead..."
        ENV_FILE=".env.local.example"
    else
        ENV_FILE=".env.local"
    fi
    
    cat > $ENV_FILE << EOF
# Local development settings
NODE_ENV=development
PORT=3838

# Domain configuration (choose one)
# Option 1: Using /etc/hosts or dnsmasq
BASE_DOMAIN=storehubqms.local
SUPERADMIN_DOMAIN=admin.storehubqms.local

# Option 2: Using lvh.me (no setup required)
# BASE_DOMAIN=lvh.me
# SUPERADMIN_DOMAIN=admin.lvh.me

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/storehub_multitenant

# Session
SESSION_SECRET=local-dev-secret-change-in-production

# Mock Render API for local development
RENDER_API_KEY=mock-key-for-local
RENDER_SERVICE_ID=mock-service-id
MOCK_RENDER_API=true

# Email (console output for local)
EMAIL_PROVIDER=console
EMAIL_FROM=noreply@storehubqms.local

# Authentication bypass for development (NEVER use in production)
USE_AUTH_BYPASS=false

# Trust proxy (for production)
TRUST_PROXY=false
EOF
    
    echo "✅ Created $ENV_FILE"
}

# Function to setup database
setup_database() {
    echo "📝 Setting up PostgreSQL database..."
    
    # Check if PostgreSQL is running
    if ! pg_isready -q; then
        echo "⚠️  PostgreSQL is not running"
        if [ "$OS" == "macos" ]; then
            echo "Starting PostgreSQL..."
            brew services start postgresql
        else
            echo "Please start PostgreSQL manually"
        fi
    fi
    
    # Create database if it doesn't exist
    if ! psql -U postgres -lqt | cut -d \| -f 1 | grep -qw storehub_multitenant; then
        echo "Creating database..."
        createdb -U postgres storehub_multitenant || {
            echo "❌ Failed to create database. You may need to run:"
            echo "   createdb -U postgres storehub_multitenant"
        }
    else
        echo "✅ Database already exists"
    fi
}

# Function to show next steps
show_next_steps() {
    echo
    echo "✅ Local subdomain setup complete!"
    echo
    echo "Next steps:"
    echo "1. Install dependencies: npm install"
    echo "2. Run migrations: npx prisma migrate dev"
    echo "3. Start the server: npm run dev"
    echo "4. Create test tenants: node test-local-subdomains.js"
    echo
    echo "Access your local sites at:"
    echo "  - Main: http://storehubqms.local:3000"
    echo "  - Admin: http://admin.storehubqms.local:3000"
    echo "  - Demo: http://demo.storehubqms.local:3000"
    echo
    echo "Alternative (no setup required):"
    echo "  - Main: http://lvh.me:3000"
    echo "  - Admin: http://admin.lvh.me:3000"
    echo "  - Demo: http://demo.lvh.me:3000"
    echo
}

# Main setup flow
main() {
    echo "Choose setup method:"
    echo "1. Simple - Add entries to /etc/hosts (requires sudo)"
    echo "2. Advanced - Setup dnsmasq for wildcard domains (macOS only)"
    echo "3. Skip - Use lvh.me (no setup required)"
    echo
    read -p "Enter choice (1-3): " choice
    
    case $choice in
        1)
            check_sudo
            setup_hosts_file
            ;;
        2)
            if [ "$OS" != "macos" ]; then
                echo "❌ dnsmasq setup is only available for macOS"
                exit 1
            fi
            setup_dnsmasq_macos
            ;;
        3)
            echo "✅ Using lvh.me - no setup required"
            ;;
        *)
            echo "❌ Invalid choice"
            exit 1
            ;;
    esac
    
    # Setup other components (no sudo required)
    setup_env_file
    setup_database
    show_next_steps
}

# Run main function
main