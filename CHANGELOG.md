# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Prior to 0.3.0 the project did not maintain a changelog; earlier history is
available via `git log`.

## [Unreleased]

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
- **Chronicle-incremental parity coverage for all 47 allowlisted actions.**
  `test/testChronicleIncremental.ts` now covers the remaining 30 WASM-routed
  actions (stack:cut/insertAt/peek/removeAt/shuffle/swap, space:clear/
  clearZone/deleteZone/lockZone/remove/shuffleZone/transferZone,
  source:draw/shuffle, game:loopInit/start, token:attach/detach/merge/split/
  transform, and the tokens:* batch actions) with TS/WASM behavioral-parity
  tests. The parity audit (`test/audit-parity.js` check [4]) is green and
  `npm run verify` passes.

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
