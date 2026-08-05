# WASM Integration — REMOVED

**Status:** The Rust→WASM core has been removed. HyperToken is now **TypeScript-only**.

## What happened

The optional Rust→WASM acceleration layer was removed from the repository. The
following were deleted:

- `core-rs/` (entire directory — Rust source, `Cargo.toml`, `build.sh`, `pkg/`)
- `core/WasmBridge.ts`
- `core/WasmChronicleAdapter.ts`
- `engine/WasmManager.ts`
- `test/testWasmBridge.ts`
- `test/testChronicleIncremental.ts`
- `test/audit-parity.js`

The `disableWasm` option was removed from the `Engine`. There is no longer any
WASM backend to disable — the TypeScript `ActionRegistry` + Automerge `Chronicle`
path is the **only** dispatch path.

## Current architecture

All actions (`category:verb`) route through `engine.dispatch()` to the TypeScript
`ActionRegistry`, which mutates the Automerge Chronicle via `session.change()`.
The `ActionProfiler` is wired into `Engine.dispatch` via `globalProfiler` (from
`benchmark/ActionProfiler.js`), so per-action timing is collected whenever
profiling is enabled.

## Historical reference

The pre-removal state of this document (and the Rust/WASM integration it
described) is preserved in git at the tag `pre-rust-removal`.

## Related docs

- [Architecture Guide](./docs/ARCHITECTURE.md)
- [Action Reference](./engine/ACTIONS.md)
- [Testing Guide](./docs/TESTING.md)
