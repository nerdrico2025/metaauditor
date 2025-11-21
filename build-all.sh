#!/bin/bash
echo "Building all projects separately..."
echo ""
echo "📦 Building Landing (Next.js)..."
cd landing && npm run build && cd ..
echo "✅ Landing built"
echo ""
echo "📦 Building Client (React/Vite)..."
cd client && npm run build && cd ..
echo "✅ Client built"
echo ""
echo "📦 Building Server (Express)..."
cd server && npm run build && cd ..
echo "✅ Server built"
echo ""
echo "🎉 All builds complete!"
