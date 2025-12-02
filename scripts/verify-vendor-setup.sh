#!/bin/bash
# Verification script for vendored HyperToken WebRTC setup

set -e

PROJECT_DIR="${1:-/Users/sibyl/dev/scarcity}"

echo "🔍 Verifying HyperToken WebRTC setup in: $PROJECT_DIR"
echo ""

cd "$PROJECT_DIR"

# Check 1: Polyfill source file
if [ -f "src/vendor/hypertoken/webrtc-polyfill.ts" ]; then
    echo "✅ Polyfill source exists"
else
    echo "❌ Polyfill source missing: src/vendor/hypertoken/webrtc-polyfill.ts"
    exit 1
fi

# Check 2: WebRTCConnection imports polyfill
if grep -q "from [\"'].*webrtc-polyfill" "src/vendor/hypertoken/WebRTCConnection.ts" 2>/dev/null; then
    echo "✅ WebRTCConnection imports polyfill"
else
    echo "❌ WebRTCConnection does NOT import polyfill"
    echo "   Add this to the top of WebRTCConnection.ts:"
    echo "   import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from \"./webrtc-polyfill.js\";"
    exit 1
fi

# Check 3: @roamhq/wrtc package installed
if [ -d "node_modules/@roamhq/wrtc" ]; then
    echo "✅ @roamhq/wrtc installed"
else
    echo "❌ @roamhq/wrtc NOT installed"
    echo "   Run: npm install @roamhq/wrtc"
    exit 1
fi

# Check 4: Compiled polyfill
if [ -f "dist/src/vendor/hypertoken/webrtc-polyfill.js" ]; then
    echo "✅ Polyfill compiled"
else
    echo "⚠️  Polyfill not compiled yet"
    echo "   Run: npm run build (or tsc)"
    exit 1
fi

# Check 5: Compiled WebRTCConnection imports polyfill
if grep -q "webrtc-polyfill" "dist/src/vendor/hypertoken/WebRTCConnection.js" 2>/dev/null; then
    echo "✅ Compiled WebRTCConnection imports polyfill"
else
    echo "❌ Compiled WebRTCConnection does NOT import polyfill"
    echo "   Your dist directory has old code. Run: npm run build"
    exit 1
fi

echo ""
echo "🎉 All checks passed! Your setup should work."
echo ""
echo "If you still see errors, try:"
echo "  1. rm -rf dist"
echo "  2. npm run build"
echo "  3. Run your application again"
