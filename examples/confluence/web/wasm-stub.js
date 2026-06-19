/**
 * Stub for the Automerge WASM binary module.
 *
 * The real module loads a .wasm binary file. In the browser bundle with
 * disableWasm: true, we don't need the WASM backend — we use the TS
 * Chronicle path. This stub provides the interface the JS wrapper expects
 * without loading any binary.
 */

// No-op: the JS wrapper calls this to store the wasm reference
export function __wbg_set_wasm() {}

// No-op: the JS wrapper calls this to initialize the WASM module
export function __wbindgen_start() {}

// Export an empty default — the JS wrapper does `import * as wasm from ...`
export default {
  __wbg_set_wasm,
  __wbindgen_start,
};
