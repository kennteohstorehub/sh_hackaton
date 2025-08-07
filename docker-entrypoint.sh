#!/bin/sh
# Secure Docker entrypoint script for StoreHub Queue Management System
# Security-hardened startup with validation and monitoring

set -euo pipefail

# Security: Define required environment variables
required_vars="DATABASE_URL SESSION_SECRET"

echo "🔒 Starting StoreHub QMS with security validations..."

# Function to log with timestamp
log() {
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $1"
}

# Function to validate environment variables
validate_env() {
    log "🔍 Validating environment variables..."
    
    for var in $required_vars; do
        if [ -z "${!var:-}" ]; then
            log "❌ ERROR: Required environment variable $var is not set"
            exit 1
        fi
    done
    
    # Security: Validate database URL format
    if ! echo "$DATABASE_URL" | grep -q "^postgresql://"; then
        log "❌ ERROR: DATABASE_URL must be a valid PostgreSQL connection string"
        exit 1
    fi
    
    # Security: Validate session secret length
    if [ ${#SESSION_SECRET} -lt 32 ]; then
        log "❌ ERROR: SESSION_SECRET must be at least 32 characters long"
        exit 1
    fi
    
    log "✅ Environment validation passed"
}

# Function to validate database connectivity
validate_database() {
    log "🔍 Validating database connectivity..."
    
    # Use node to test database connection
    node -e "
        const { Pool } = require('pg');
        const pool = new Pool({ 
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        pool.query('SELECT 1')
            .then(() => {
                console.log('✅ Database connection successful');
                process.exit(0);
            })
            .catch(err => {
                console.error('❌ Database connection failed:', err.message);
                process.exit(1);
            });
    " || {
        log "❌ ERROR: Database connectivity check failed"
        exit 1
    }
}

# Function to validate file permissions
validate_permissions() {
    log "🔍 Validating file permissions..."
    
    # Check that we're running as non-root
    if [ "$(id -u)" -eq 0 ]; then
        log "❌ ERROR: Container is running as root user"
        exit 1
    fi
    
    # Check write permissions for necessary directories
    for dir in /app/logs /app/tmp /app/cache; do
        if [ ! -w "$dir" ]; then
            log "❌ ERROR: No write permission for $dir"
            exit 1
        fi
    done
    
    log "✅ File permissions validation passed"
}

# Function to setup security headers
setup_security() {
    log "🔒 Setting up security configurations..."
    
    # Ensure security environment variables are set
    export HELMET_ENABLED="${HELMET_ENABLED:-true}"
    export CSRF_PROTECTION="${CSRF_PROTECTION:-true}"
    export RATE_LIMITING_ENABLED="${RATE_LIMITING_ENABLED:-true}"
    export SESSION_SECURE="${SESSION_SECURE:-true}"
    export SESSION_SAME_SITE="${SESSION_SAME_SITE:-strict}"
    
    # Security: Disable X-Powered-By header
    export DISABLE_X_POWERED_BY=true
    
    # Security: Enable audit logging
    export AUDIT_LOGGING="${AUDIT_LOGGING:-true}"
    
    log "✅ Security configuration completed"
}

# Function to create necessary directories
setup_directories() {
    log "📁 Setting up application directories..."
    
    # Create directories if they don't exist
    mkdir -p /app/logs /app/tmp /app/cache
    
    # Set proper permissions
    chmod 755 /app/logs /app/tmp /app/cache
    
    log "✅ Directory setup completed"
}

# Function to setup monitoring
setup_monitoring() {
    log "📊 Setting up monitoring..."
    
    # Enable metrics collection
    export METRICS_ENABLED="${METRICS_ENABLED:-true}"
    
    # Setup log rotation for container logs
    export LOG_LEVEL="${LOG_LEVEL:-info}"
    export LOG_FORMAT="${LOG_FORMAT:-json}"
    
    log "✅ Monitoring setup completed"
}

# Function to handle graceful shutdown
cleanup() {
    log "🛑 Received shutdown signal, cleaning up..."
    
    # Kill any background processes
    jobs -p | xargs -r kill
    
    # Clean up temporary files
    rm -rf /app/tmp/*
    
    log "✅ Cleanup completed"
    exit 0
}

# Trap signals for graceful shutdown
trap cleanup TERM INT

# Main execution
main() {
    log "🚀 Starting StoreHub Queue Management System..."
    
    # Run all validation checks
    validate_env
    validate_permissions
    setup_directories
    setup_security
    setup_monitoring
    validate_database
    
    log "✅ All security validations passed"
    log "🌟 Starting application server..."
    
    # Start the Node.js application
    exec node server/index.js
}

# Execute main function
main "$@"