# Guide: Updating Vendored HyperToken in Your Application

If you're vendoring HyperToken code in your application (like at `/Users/sibyl/dev/scarcity/src/vendor/hypertoken/`), follow these steps to get WebRTC working in Node.js:

## Step 1: Copy the Polyfill File

```bash
cd /Users/sibyl/dev/scarcity
cp /path/to/hypertoken/network/webrtc-polyfill.ts src/vendor/hypertoken/webrtc-polyfill.ts
```

Or create it manually with this content:

```typescript
/*
 * webrtc-polyfill.ts
 * WebRTC polyfill for Node.js environments
 */

// Detect if we're in a Node.js environment (no window object)
const isNode = typeof window === 'undefined';

let RTCPeerConnection: typeof globalThis.RTCPeerConnection;
let RTCSessionDescription: typeof globalThis.RTCSessionDescription;
let RTCIceCandidate: typeof globalThis.RTCIceCandidate;

if (isNode) {
  // We're in Node.js - use the wrtc polyfill
  try {
    // Dynamic import for ES modules - convert to synchronous using createRequire
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const wrtc = require('@roamhq/wrtc');

    RTCPeerConnection = wrtc.RTCPeerConnection;
    RTCSessionDescription = wrtc.RTCSessionDescription;
    RTCIceCandidate = wrtc.RTCIceCandidate;
    console.log('[WebRTC Polyfill] Using @roamhq/wrtc for Node.js environment');
  } catch (err) {
    console.error('[WebRTC Polyfill] Failed to load @roamhq/wrtc. WebRTC will not be available.');
    console.error('Install it with: npm install @roamhq/wrtc');
    console.error('Error:', err);
    throw new Error('WebRTC polyfill not available. Please install @roamhq/wrtc');
  }
} else {
  // We're in a browser - use native APIs
  RTCPeerConnection = globalThis.RTCPeerConnection;
  RTCSessionDescription = globalThis.RTCSessionDescription;
  RTCIceCandidate = globalThis.RTCIceCandidate;
}

export {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate
};
```

## Step 2: Update WebRTCConnection.ts

Edit `/Users/sibyl/dev/scarcity/src/vendor/hypertoken/WebRTCConnection.ts`

**Add this import at the top** (after other imports):

```typescript
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate
} from "./webrtc-polyfill.js";
```

**Remove any usage of global RTCPeerConnection, RTCSessionDescription, RTCIceCandidate** - they should now come from the import instead.

The key change is on line ~89 where it creates the peer connection. It should just use `new RTCPeerConnection()` (which now comes from the import).

## Step 3: Install the WebRTC Package

```bash
cd /Users/sibyl/dev/scarcity
npm install @roamhq/wrtc
```

## Step 4: Clean and Rebuild

```bash
# Remove old compiled files
rm -rf dist

# Rebuild your application
npm run build
# OR if you use tsc directly:
tsc
```

## Step 5: Run Your Application Again

```bash
npm start
# OR however you normally run it
```

## Expected Output

You should now see:
```
[WebRTC Polyfill] Using @roamhq/wrtc for Node.js environment
[Hybrid] Initiating WebRTC connection to peer-xxxxx
[Hybrid] ✅ WebRTC connection established with peer-xxxxx
```

## Troubleshooting

**Still seeing "RTCPeerConnection is not defined"?**
- Check that `dist/src/vendor/hypertoken/webrtc-polyfill.js` exists
- Check that `dist/src/vendor/hypertoken/WebRTCConnection.js` imports from `./webrtc-polyfill.js`
- Make sure you ran `npm run build` or `tsc` after making changes
- Verify `@roamhq/wrtc` is in your `package.json` dependencies

**Module not found errors?**
- Check that the import path is correct: `"./webrtc-polyfill.js"` (with .js extension for ES modules)
- Ensure the polyfill file is in the same directory as WebRTCConnection.ts

## Quick Verification Script

Run this to check your setup:

```bash
cd /Users/sibyl/dev/scarcity

# Check if polyfill source exists
[ -f "src/vendor/hypertoken/webrtc-polyfill.ts" ] && echo "✅ Polyfill source exists" || echo "❌ Polyfill source missing"

# Check if polyfill is compiled
[ -f "dist/src/vendor/hypertoken/webrtc-polyfill.js" ] && echo "✅ Polyfill compiled" || echo "❌ Polyfill not compiled - run build"

# Check if @roamhq/wrtc is installed
[ -d "node_modules/@roamhq/wrtc" ] && echo "✅ @roamhq/wrtc installed" || echo "❌ @roamhq/wrtc missing - run npm install"

# Check if WebRTCConnection imports polyfill
grep -q "webrtc-polyfill" "src/vendor/hypertoken/WebRTCConnection.ts" && echo "✅ Import found" || echo "❌ Import missing"
```
