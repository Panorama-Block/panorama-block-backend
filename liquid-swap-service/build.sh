#!/bin/bash
set -e

echo "Installing dependencies..."
npm install

echo "Building TypeScript project..."
npm run build

echo "Build completed successfully!" 