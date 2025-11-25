#!/bin/bash
# Start Dungeon Raiders Client

cd "$(dirname "$0")/../.."

# Get player name from argument or use default
PLAYER_NAME="${1:-Player$RANDOM}"

echo "🎮 Starting Dungeon Raiders Client as: $PLAYER_NAME"
echo ""

# Check if dependencies are installed
if [ ! -d "examples/dungeon-raiders/node_modules" ]; then
    echo "📦 Installing demo dependencies..."
    cd examples/dungeon-raiders
    npm install
    cd ../..
    echo ""
fi

# Start client with TypeScript loader
node --loader ./test/ts-esm-loader.js examples/dungeon-raiders/client.js "$PLAYER_NAME"
