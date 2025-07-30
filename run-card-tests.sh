#\!/bin/bash

# Script to run the card-based acknowledgment system tests

echo "🧪 Running Card-Based Acknowledgment System Tests"
echo "================================================"

# Ensure server is running
if \! curl -s http://localhost:3838/health > /dev/null 2>&1; then
    echo "❌ Server not running on port 3838. Please start the server first:"
    echo "   npm run dev"
    exit 1
fi

echo "✅ Server is running on port 3838"
echo ""

# Install Playwright if not already installed
if \! npx playwright --version > /dev/null 2>&1; then
    echo "📦 Installing Playwright..."
    npm install --save-dev @playwright/test
    npx playwright install
fi

# Create test results directory if it doesn't exist
mkdir -p test-results

# Run the card acknowledgment tests
echo "🚀 Starting card acknowledgment tests..."
echo ""

npx playwright test tests/e2e/card-acknowledgment-system.spec.js \
    --reporter=list \
    --workers=1 \
    --timeout=60000

# Check test results
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All tests passed\!"
    echo ""
    echo "📸 Screenshots saved in test-results/"
    ls -la test-results/*.png 2>/dev/null || echo "No screenshots generated"
else
    echo ""
    echo "❌ Some tests failed. Check the output above for details."
    echo ""
    echo "📸 Debug screenshots saved in test-results/"
    ls -la test-results/*.png 2>/dev/null || echo "No screenshots generated"
    exit 1
fi
