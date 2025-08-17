#!/bin/bash

# Rental Contract AO Agent Test Runner

echo "🏡 Running Rental Contract AO Agent Tests"
echo "=========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm version: $(npm -v)"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi

# Create test directories
mkdir -p logs
mkdir -p data
mkdir -p coverage

echo "📁 Test directories created"

# Run tests
echo "🧪 Running tests..."
npm test

# Check test exit code
if [ $? -eq 0 ]; then
    echo "✅ All tests passed!"
    
    # Show coverage if available
    if [ -d "coverage" ]; then
        echo "📊 Test coverage report generated in coverage/"
    fi
    
    exit 0
else
    echo "❌ Some tests failed"
    exit 1
fi