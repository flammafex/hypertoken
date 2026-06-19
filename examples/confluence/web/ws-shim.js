/**
 * Browser shim for the 'ws' package — uses native WebSocket.
 *
 * The 'ws' package (Node.js) passes raw data to the 'message' event handler.
 * Browser WebSocket passes a MessageEvent (with data in .data).
 *
 * PeerConnection.ts already handles both cases:
 * - Node/ws: socket.on("message", (data) => handleData(data))
 * - Browser: socket.addEventListener("message", (ev) => handleData(ev.data))
 *
 * So we just need to re-export the native browser WebSocket.
 * PeerConnection detects Node vs browser by checking if socket.on is a function.
 */
export class WebSocket extends globalThis.WebSocket {
  constructor(url, protocols) {
    super(url, protocols);
  }
}

export default { WebSocket };
