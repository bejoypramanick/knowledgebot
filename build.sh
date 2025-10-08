#!/bin/bash

# Cloudflare Pages Build Script
echo "Starting KnowledgeBot build process..."

# Set Node.js version
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Install dependencies
echo "Installing dependencies..."
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
