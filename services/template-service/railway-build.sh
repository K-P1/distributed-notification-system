#!/bin/bash
# Railway build script for Template Service

echo "🏗️ Building Template Service for Railway..."

# Set Node.js options
export NODE_OPTIONS="--max-old-space-size=4096"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production=false

# Build the application
echo "🔨 Building application..."
npx nest build

echo "✅ Build completed successfully!"

# List contents to verify build
echo "📂 Build output:"
ls -la dist/