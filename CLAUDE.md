# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
npm run build              # TypeScript compile + copy examples to dist/
npm run build:rust         # Compile Rust → WASM (optional, pre-built binaries included)
npm run test:quick         # Fast check: core + engine (~10s)
npm run test:unit          # Core + engine + exporters + actions (~30s)
npm run test               # Full suite including integration & network (~2min)
npm run clean              # Remove dist/
```

### Running a single test

```bash
node --loader ./test/ts-esm-loader.js test/testCore.js
node --loader ./test/ts-esm-loader.js test/testEngine.js
```

Test files are in `test/` named `test<Feature>.js` or `test<Feature>.ts`. The project uses a custom test runner (no Jest/Vitest) with simple `test()` and `assert()` helpers. All tests use the ESM loader at `test/ts-esm-loader.js`.

### Running games

```bash
npm run blackjack          # Casino with AI & betting
npm run poker              # Texas Hold'em
npm run cuttle             # Card combat
npm run prisoners-dilemma  # Game theory tournament
```

## Architecture

HyperToken is a distributed game engine where all state is a CRDT (Automerge). This single decision gives serverless multiplayer, perfect replay, and forkable worlds.

### Layer structure

- **core/** — CRDT state primitives: `Chronicle` (Automerge wrapper), `IChronicle` (interface), `WasmChronicleAdapter` (dirty-section caching proxy for WASM), `Stack` (ordered token collections), `Space` (2D zones), `Source` (multi-deck manager), `Token` (immutable game entities with provenance tracking)
- **engine/** — Game coordination: `Engine` (main dispatcher), `Action` (registry), `actions.ts` (75+ built-in actions), `GameLoop` (turn/phase control), `RuleEngine` (condition-triggered), `Agent` (player/NPC), `Policy` (post-action evaluation), `Recorder` (history/replay), `Script` (programmatic execution)
- **network/** — P2P & server networking: `PeerConnection` (WebSocket + WebRTC), `AuthoritativeServer`, `HybridPeerManager`, `StateSyncManager`, `MessageCodec` (MessagePack binary), `E2EEncryption`
- **interface/** — AI/ML adapters: `Gym` (single-agent RL), `PettingZoo` (multi-agent turn-based), `PettingZooParallel` (simultaneous), `ONNXAgent` (neural net policies)
- **core-rs/** — Rust WASM implementation: `Chronicle` (incremental Automerge CRDT with 54 field-level action methods), `ActionDispatcher` (delegates to Chronicle), `chronicle_actions/` (stack, space, source, agent, game_loop, game_state, rules modules)
- **examples/** — 12 working games, each with game logic, CLI, and optional networking/RL files
- **cli/** — CLI entry point (`relay`, `bridge`, `mcp` subcommands)

### Data flow

1. Game dispatches action → `engine.dispatch("category:verb", payload)`
2. Engine routes to WASM `ActionDispatcher` (if available) or TS `ActionRegistry` fallback
3. WASM path: Chronicle applies incremental field-level Automerge operations, sets dirty flags
4. TS path: Action handler calls `engine.session.change()` (Automerge proxy)
5. Recorder logs action with actor + timestamp
6. RuleEngine evaluates triggered conditions
7. Policy evaluates post-action
8. Network layer syncs CRDT changes to peers (if connected, Chronicle mode only)

### Action naming convention

Actions use `category:verb` format across 7 categories:
- `stack:draw`, `stack:shuffle`, `stack:burn`, `stack:discard`, `stack:reset`
- `space:place`, `space:move`, `space:flip`, `space:createZone`, `space:shuffleZone`
- `agent:create`, `agent:givResource`, `agent:transferToken`, `agent:drawCards`
- `token:transform`, `token:tag`, `token:merge`, `token:split`
- `batch:multiAction`, `batch:batchPlace`, `batch:batchMove`
- `source:draw`, `source:reshuffle`
- `game:start`, `game:nextPhase`, `game:end`

### Key patterns

- **All components extend Emitter** from `core/events.ts` for event-based communication
- **Tokens are immutable** — never modified, only created/destroyed. Provenance tracked via `_mergedFrom`, `_splitFrom`
- **State mutations go through `engine.dispatch()`** — routes to WASM Chronicle (incremental field-level ops) or TS ActionRegistry (`session.change()` fallback). `IChronicle` interface abstracts over both backends.
- **Events use `type:name`** format (e.g., `state:updated`, `net:ready`)

## Project Configuration

- **ESM throughout** — `"type": "module"` in package.json
- **TypeScript strict mode** — `tsconfig.json` has `strict: true`
- **`allowJs: true`** — supports mixed .ts/.js (file-by-file migration)
- **Target: ES2022, Module: NodeNext**
- **Monorepo** — workspaces in `packages/*` (contains quickstart package)
- **Key dependencies**: `@automerge/automerge`, `@modelcontextprotocol/sdk`, `@msgpack/msgpack`, `ws`
