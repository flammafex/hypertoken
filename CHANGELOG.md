# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Prior to 0.3.0 the project did not maintain a changelog; earlier history is
available via `git log`.

## [Unreleased]

### Changed
- **Chronicle-incremental parity coverage.** `test/testChronicleIncremental.ts`
  covers all 42 WASM-routed actions (plus the 5 TS-routed token ops) with
  TS/WASM behavioral-parity tests; the parity audit (`test/audit-parity.js`
  check [4]) is green and `npm run verify` passes. Suite is now 68 tests.
- **Four TS/WASM divergence closures:**
  - **Shuffle RNG unified.** Rust now uses the same mulberry32 PRNG as TS
    (`core-rs/src/utils.rs`: `Mulberry32`, `js_to_uint32`, `batch_seed_hash`;
    `core-rs/src/parallel.rs` uses it for batch shuffles), so
    `stack:shuffle`, `source:shuffle`, `space:shuffleZone` and
    `tokens:shuffle` produce byte-identical orders for the same seed. Parity
    tests tightened from membership to exact-order assertions.
  - **Token ops de-listed from WASM.** `token:transform/attach/detach/merge/
    split` now route through the TS `ActionRegistry` on both paths
    (`WasmManager.WASM_ACTIONS`: 47 → 42), eliminating their structural
    divergences. Parity tests assert byte-identical TS shapes.
  - **Space locks persisted in the CRDT doc.** `core/Space.ts` stores locks as
    `_lock:{zone}` boolean keys inside `zones` (mirroring Rust), replacing the
    in-memory `_lockedZones` set. Locks survive persist/resume and sync
    between peers; `test/testEngine.js` gained 4 lock tests.
  - **Edge-case validation aligned to Rust.** `core/Stack.ts`
    (`cut`/`insertAt`/`removeAt`) and `core/Source.ts` (`draw`/`burn`) throw on
    out-of-bounds positions / overdraw instead of clamping; parity tests cover
    throw-agreement plus the `rotate_left` boundary no-ops.
  - Accepted residual divergences (documented in tests): Rust enforces locks
    only on `place`/`move`/`remove`/`flip` (`clearZone`/`shuffleZone`/
    `transferZone` ignore them); non-integer stack positions coerce to `usize`
    on WASM while TS throws; TS writes `source.seed` but Rust does not; Rust
    `read_zones` exports `_lock:*` keys as zero-length lists.

### Planned
- Game module contract (`GameDefinition`) formalizing the per-game action
  surface, state schema, phases, and win/loss hooks.
- Hidden-information generalization: player-owned `secret:` slices with reveal
  semantics, lifting the cuttle encrypted-hand pattern to an engine-level
  capability.
- Hybrid fast-path sync: authoritative ordering lane for real-time games on
  top of the CRDT substrate, with delta-level sync and a documented decision
  matrix (P2P CRDT vs host-authoritative).

## [0.3.0] - 2026-08-04

### Added
- **Full agent action surface routed through WASM.** The agent category
  (`agent:create`, `agent:transferToken`, `agent:trade`, `agent:steal`,
  `agent:discard`, ...) now dispatches through the Rust `ActionDispatcher`
  with TypeScript fallback, closing the largest remaining TS/WASM parity gap.
  Includes Rust `trade` and `discard` implementations.
- **WASM init and CRDT sync hardening.** Silent WASM initialization failure
  paths fixed; the sync handshake no longer suppresses in-flight sync
  responses, so CRDT sync completes reliably on WASM-enabled engines.
- **Engine component test repairs.** Fixed 13 pre-existing failures in the
  engine-components suite: dead `test:action` fixture actions, stale
  assertions, and the `engine._agents` no-op getter bug (also present in
  blackjack).
- **Cuttle migrated to `game:setState`.** Example game state writes now flow
  through `engine.dispatch()` instead of raw `session.change()`, matching the
  engine refactor conventions.
- **Verification gate.**
  - `test/run-all.js` — runs every test file sequentially, survives
    per-file failures, prints a per-category summary, and exits nonzero only
    when something failed. Replaces the `&&`-chained `npm run test` that
    aborted at the first failure and silently skipped the remaining suites.
  - `test/audit-parity.js` — parity audit checking the action registry count
    against the action docs, verifying every WASM-routed action has a Rust
    handler and chronicle-incremental test coverage, and validating the
    documented field-level method count.
  - `npm run verify` — `tsc --noEmit` + full test suite + parity audit in one
    command.
  - Gitea Actions workflow (`.gitea/workflows/ci.yml`) running `npm run
    verify` on push and pull requests.

### Fixed
- Landing page: live showcase links, canonical URL, action count (77 → 81),
  `token:merge` example payload key, invalid HTML in the showcase block, and
  restored footer links.
- `Source.draw`/`Source.burn` passed a negative `splice` index to the
  Automerge proxy, which rejects negative indices — every source draw/burn
  threw on the TypeScript path. Now computes a non-negative start index
  (mirrors `Stack._drawMany`).

### Changed
- Version bumped 0.2.0 → 0.3.0.

[0.3.0]: https://git.carpocratian.org/sibyl/hypertoken
