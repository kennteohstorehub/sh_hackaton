#!/bin/bash

echo "🔧 Fixing PostgreSQL Session Store Configuration"
echo "============================================="

# Install the new session store package
echo "📦 Installing express-pg-session..."
npm uninstall connect-pg-simple
npm install express-pg-session

echo ""
echo "✅ Package replacement complete!"
echo ""
echo "The code has been updated to use express-pg-session with proper column mapping:"
echo "- session_id → 'sid'"
echo "- session_data → 'data'" 
echo "- expire → 'expiresAt'"
echo ""
echo "This will fix the session table column mismatch error."
echo ""
echo "Next steps:"
echo "1. Commit these changes"
echo "2. Push to GitHub"
echo "3. Render will automatically deploy"