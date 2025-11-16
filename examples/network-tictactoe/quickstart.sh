#!/bin/bash
# Quick Start Script for Network Tic-Tac-Toe

echo "╔══════════════════════════════════════════╗"
echo "║  HYPERTOKEN NETWORK TIC-TAC-TOE         ║"
echo "║  Quick Start                            ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check if ws is installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

echo "🎮 Starting Network Tic-Tac-Toe"
echo ""
echo "This script will:"
echo "  1. Start the server"
echo "  2. Wait 2 seconds"
echo "  3. Start two clients in new terminal windows"
echo ""
echo "If you prefer manual control:"
echo "  Terminal 1: npm run server"
echo "  Terminal 2: npm run client"
echo "  Terminal 3: npm run client"
echo ""
read -p "Press ENTER to continue or Ctrl+C to cancel..."

# Start server in background
echo ""
echo "🌐 Starting server..."
npm run server &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Check OS and open terminals accordingly
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "🎮 Opening client windows..."
    osascript -e 'tell app "Terminal" to do script "cd \"'"$PWD"'\" && npm run client"'
    sleep 1
    osascript -e 'tell app "Terminal" to do script "cd \"'"$PWD"'\" && npm run client"'
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal -- bash -c "npm run client; exec bash"
        sleep 1
        gnome-terminal -- bash -c "npm run client; exec bash"
    elif command -v xterm &> /dev/null; then
        xterm -e "npm run client" &
        sleep 1
        xterm -e "npm run client" &
    else
        echo "⚠️  Could not open terminal windows automatically"
        echo "Please open two terminals manually and run: npm run client"
    fi
else
    echo "⚠️  Automatic terminal opening not supported on this OS"
    echo "Please open two terminals manually and run: npm run client"
fi

echo ""
echo "✓ Server running (PID: $SERVER_PID)"
echo ""
echo "To stop the server:"
echo "  kill $SERVER_PID"
echo "  or press Ctrl+C"
echo ""

# Wait for Ctrl+C
wait $SERVER_PID