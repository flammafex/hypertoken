/**
 * Browser crypto shim — provides a minimal subset of node:crypto
 * that Automerge/Chronicle needs, using the Web Crypto API.
 */

// Browser has globalThis.crypto (Web Crypto API)
// Automerge uses randomBytes for generating actor IDs
export const webcrypto = globalThis.crypto;
export default globalThis.crypto;

// randomBytes polyfill using Web Crypto
export function randomBytes(size) {
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

// randomUUID polyfill using Web Crypto
export function randomUUID() {
  return globalThis.crypto.randomUUID();
}

// createHash polyfill using Web Crypto (SHA-256 only)
export function createHash(algorithm) {
  if (algorithm !== 'sha256' && algorithm !== 'sha1') {
    console.warn(`crypto-browser-shim: ${algorithm} not supported, falling back to sha256`);
  }
  const chunks = [];
  return {
    update(data) {
      if (typeof data === 'string') {
        chunks.push(new TextEncoder().encode(data));
      } else if (data instanceof Uint8Array) {
        chunks.push(data);
      } else if (data instanceof ArrayBuffer) {
        chunks.push(new Uint8Array(data));
      }
      return this;
    },
    async digest(encoding) {
      const combined = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', combined);
      if (encoding === 'hex') {
        const bytes = new Uint8Array(hashBuffer);
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      }
      return new Uint8Array(hashBuffer);
    },
  };
}
