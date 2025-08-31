#!/bin/bash

# Build script for @chaim/cdk

set -e

echo "🏗️  Building @chaim/cdk..."

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf lib/
rm -rf dist/

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run linting
echo "🔍 Running linter..."
npm run lint

# Run tests
echo "🧪 Running tests..."
npm test

# Build the project
echo "🔨 Building TypeScript..."
npm run build

echo "✅ Build completed successfully!"
echo "📦 Package is ready in lib/"
