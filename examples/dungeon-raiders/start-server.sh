#!/bin/bash
# Start Dungeon Raiders Server

cd "$(dirname "$0")/../.."

echo "🎮 Starting Dungeon Raiders Server..."
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

if [ ! -d "examples/dungeon-raiders/node_modules" ]; then
    echo "📦 Installing demo dependencies..."
    cd examples/dungeon-raiders
    npm install
    cd ../..
    echo ""
fi

# Start server with TypeScript loader
node --loader ./test/ts-esm-loader.js examples/dungeon-raiders/server.js
