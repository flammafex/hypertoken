/**
 * Browser shim for the 'ws' package — uses native WebSocket.
 * Provides a minimal compatible interface for PeerConnection.
 */
export class WebSocket extends globalThis.WebSocket {
  constructor(url, protocols) {
    super(url, protocols);
  }
}

// ws package uses EventEmitter-style API (on/off/emit)
// Browser WebSocket uses addEventListener. This shim bridges them.
const originalAddEventListener = globalThis.WebSocket.prototype.addEventListener;
globalThis.WebSocket.prototype.addEventListener = function(type, listener, options) {
  if (type === 'message') {
    // ws passes (data), browser passes (MessageEvent)
    const wrapped = (event) => listener.call(this, event.data);
    wrapped._original = listener;
    return originalAddEventListener.call(this, type, wrapped, options);
  }
  return originalAddEventListener.call(this, type, listener, options);
};

export default { WebSocket };
