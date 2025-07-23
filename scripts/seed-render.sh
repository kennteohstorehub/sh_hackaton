#!/bin/bash

# This script runs the production seed on Render
# It should be run from Render's shell or as a one-off job

echo "🚀 Seeding Render production database..."

# Check if we're on Render
if [ -z "$RENDER" ]; then
  echo "⚠️  Warning: Not running on Render environment"
fi

# Check for DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL not found"
  echo "Make sure you're running this on Render or have DATABASE_URL set"
  exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Run the seed script
echo "🌱 Running seed script..."
node seed-production.js

echo "✅ Seeding complete!"