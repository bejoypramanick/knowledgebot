#!/bin/bash

# Cloudflare Pages Build Script - Force npm usage
echo "Starting KnowledgeBot build process..."

# Set environment variables to force npm usage
export NPM_CONFIG_PRODUCTION=false
export CI=true
export NODE_ENV=production

# Set Node.js version
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Remove any existing lockfiles that might cause conflicts
echo "Cleaning up lockfiles..."
rm -f bun.lockb
rm -f yarn.lock

# Install dependencies using npm only
echo "Installing dependencies with npm..."
npm ci

# Build the application
echo "Building application..."
npm run build

# Check if build was successful
if [ -d "dist" ]; then
    echo "Build successful! Contents of dist directory:"
    ls -la dist/
    echo "Build completed successfully!"
else
    echo "Build failed - dist directory not found"
    exit 1
fi
