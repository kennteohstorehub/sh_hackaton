#!/bin/bash

# Render Deployment Configuration Script
# This script helps configure your Render deployment for multi-tenant support

set -e

echo "🚀 StoreHub QMS - Render Deployment Configuration"
echo "================================================="
echo

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if render.yaml exists
if [ ! -f "render.yaml" ]; then
    echo -e "${RED}❌ render.yaml not found${NC}"
    echo "Please run from the project root directory"
    exit 1
fi

# Function to check environment variables
check_env_var() {
    if [ -z "${!1}" ]; then
        echo -e "${YELLOW}⚠️  $1 is not set${NC}"
        return 1
    else
        echo -e "${GREEN}✅ $1 is set${NC}"
        return 0
    fi
}

# Function to prompt for API key
get_api_key() {
    if [ -z "$RENDER_API_KEY" ]; then
        echo
        echo "Please enter your Render API key:"
        echo "(You can find it at: https://dashboard.render.com/account/api-keys)"
        read -s RENDER_API_KEY
        echo
        export RENDER_API_KEY
    fi
}

# Function to get service list
get_services() {
    echo "Fetching your Render services..."
    
    response=$(curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
        "https://api.render.com/v1/services?limit=100")
    
    if echo "$response" | grep -q "error"; then
        echo -e "${RED}❌ Failed to fetch services. Check your API key.${NC}"
        exit 1
    fi
    
    echo "$response" | jq -r '.[] | select(.type == "web_service") | "\(.service.id) \(.service.name)"' 2>/dev/null || {
        echo -e "${RED}❌ Failed to parse services. Is jq installed?${NC}"
        echo "Install with: brew install jq"
        exit 1
    }
}

# Function to create custom domain
add_custom_domain() {
    local service_id=$1
    local domain=$2
    
    echo "Adding custom domain: $domain"
    
    response=$(curl -s -X POST \
        -H "Authorization: Bearer $RENDER_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$domain\"}" \
        "https://api.render.com/v1/services/$service_id/custom-domains")
    
    if echo "$response" | grep -q "error"; then
        echo -e "${YELLOW}⚠️  Failed to add $domain (may already exist)${NC}"
    else
        echo -e "${GREEN}✅ Added $domain${NC}"
    fi
}

# Function to list custom domains
list_custom_domains() {
    local service_id=$1
    
    echo "Fetching custom domains..."
    
    response=$(curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
        "https://api.render.com/v1/services/$service_id/custom-domains")
    
    echo "$response" | jq -r '.[] | .name' 2>/dev/null || echo "No custom domains found"
}

# Main configuration flow
main() {
    echo "This script will help you configure Render for multi-tenant deployment"
    echo
    
    # Check for required tools
    if ! command -v curl &> /dev/null; then
        echo -e "${RED}❌ curl is required but not installed${NC}"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}⚠️  jq is recommended for JSON parsing${NC}"
        echo "Install with: brew install jq"
    fi
    
    # Get API key
    get_api_key
    
    # Show menu
    while true; do
        echo
        echo "What would you like to do?"
        echo "1. List my Render services"
        echo "2. Configure custom domains for a service"
        echo "3. Create .env.render file with configuration"
        echo "4. Show deployment checklist"
        echo "5. Exit"
        echo
        read -p "Enter choice (1-5): " choice
        
        case $choice in
            1)
                echo
                echo "Your Render services:"
                echo "===================="
                get_services
                ;;
            2)
                echo
                echo "Enter your service ID (e.g., srv-xxxxx):"
                read service_id
                
                echo
                echo "Current custom domains:"
                list_custom_domains "$service_id"
                
                echo
                echo "Would you like to add domains? (y/n)"
                read add_domains
                
                if [ "$add_domains" = "y" ]; then
                    echo "Enter your base domain (e.g., storehubqms.com):"
                    read base_domain
                    
                    # Add base domain
                    add_custom_domain "$service_id" "$base_domain"
                    
                    # Add wildcard
                    add_custom_domain "$service_id" "*.$base_domain"
                    
                    # Add admin subdomain explicitly (some DNS providers don't support wildcards)
                    add_custom_domain "$service_id" "admin.$base_domain"
                    
                    echo
                    echo -e "${GREEN}✅ Domain configuration complete${NC}"
                    echo
                    echo "Next steps:"
                    echo "1. Update your DNS records:"
                    echo "   CNAME  @      $service_id.onrender.com."
                    echo "   CNAME  *      $service_id.onrender.com."
                    echo "   CNAME  admin  $service_id.onrender.com."
                    echo
                    echo "2. Wait for DNS propagation (5-30 minutes)"
                    echo "3. Render will automatically provision SSL certificates"
                fi
                ;;
            3)
                echo
                echo "Creating .env.render configuration file..."
                
                cat > .env.render << EOF
# Render Production Environment Variables
# Copy these to your Render service environment variables

# Core Configuration
NODE_ENV=production
BASE_DOMAIN=storehubqms.com
SUPERADMIN_DOMAIN=admin.storehubqms.com

# Render API Configuration
RENDER_API_KEY=$RENDER_API_KEY
RENDER_SERVICE_ID=srv-XXXXX  # Update with your service ID

# Email Configuration (choose one)
EMAIL_PROVIDER=console  # For testing
# EMAIL_PROVIDER=sendgrid
# SENDGRID_API_KEY=your-sendgrid-api-key
# EMAIL_FROM=noreply@storehubqms.com

# Security
TRUST_PROXY=true

# Session secret will be auto-generated by Render
# Database URL will be auto-connected by Render
EOF
                
                echo -e "${GREEN}✅ Created .env.render${NC}"
                echo "Update RENDER_SERVICE_ID with your actual service ID"
                ;;
            4)
                echo
                echo "📋 Render Deployment Checklist"
                echo "============================="
                echo
                echo "Pre-deployment:"
                echo "□ Run tests locally: npm test"
                echo "□ Build successfully: npm run build"
                echo "□ Database migrations ready: npx prisma migrate dev"
                echo "□ Environment variables documented"
                echo
                echo "Render Setup:"
                echo "□ Create Web Service on Render"
                echo "□ Connect GitHub repository"
                echo "□ render.yaml detected automatically"
                echo "□ Set environment variables:"
                echo "  - RENDER_API_KEY"
                echo "  - RENDER_SERVICE_ID (after first deploy)"
                echo "  - Email provider credentials (if needed)"
                echo
                echo "Post-deployment:"
                echo "□ Configure custom domains"
                echo "□ Update DNS records"
                echo "□ Wait for SSL certificates"
                echo "□ Create SuperAdmin account"
                echo "□ Test tenant creation"
                echo "□ Verify subdomain routing"
                echo
                echo "Monitoring:"
                echo "□ Check deployment logs"
                echo "□ Monitor health endpoint"
                echo "□ Set up alerts"
                ;;
            5)
                echo "Goodbye!"
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid choice${NC}"
                ;;
        esac
    done
}

# Create deployment helper scripts
create_helper_scripts() {
    # Create SuperAdmin creation script
    cat > create-superadmin.js << 'EOF'
// Run this in Render Shell to create the first SuperAdmin
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createSuperAdmin() {
  const email = process.argv[2] || 'admin@storehubqms.com';
  const password = process.argv[3] || 'ChangeMe123!@#';
  const fullName = process.argv[4] || 'System Administrator';
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const superAdmin = await prisma.superAdmin.create({
      data: {
        email,
        password: hashedPassword,
        fullName,
        isActive: true
      }
    });
    
    console.log('✅ SuperAdmin created successfully!');
    console.log('Email:', email);
    console.log('Temporary Password:', password);
    console.log('⚠️  CHANGE THIS PASSWORD IMMEDIATELY!');
    console.log('\nLogin at: https://admin.storehubqms.com');
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('❌ SuperAdmin with this email already exists');
    } else {
      console.error('❌ Error creating SuperAdmin:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdmin();
EOF

    echo -e "${GREEN}✅ Created create-superadmin.js${NC}"
}

# Check if this is first run
if [ ! -f ".env.render" ]; then
    create_helper_scripts
fi

# Start main flow
main