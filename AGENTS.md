# AGENTS.md

Guidance for Codex / AI agents working in this repository. Read this before making changes.

## Repository at a glance

HyperToken is a distributed game engine where **all state is a CRDT** (Automerge). One architectural decision yields serverless multiplayer, perfect replay, and forkable worlds. Optional Rust→WASM acceleration for hot paths. Ships with card/strategy game examples and Gym/PettingZoo RL interfaces.

- **Runtime:** Node.js 18+ (server/CLI), browser (WASM + examples)
- **Language:** TypeScript (ESM, strict) + Rust (optional WASM)
- **License:** Apache 2.0
- **Branch:** `main` (clean working tree as of last review)

## Repo layout

```
core/          CRDT state primitives (Token, Stack, Space, Source, Chronicle, IChronicle, WasmChronicleAdapter)
core/browser/  Browser build infrastructure (shims.js, build.js)
core/storage/  Storage adapters (MemoryAdapter, FilesystemAdapter, IndexedDBAdapter)
core/StorageAdapter.ts  Storage adapter interface
engine/        Game coordination (Engine, actions.ts, Action, GameLoop, RuleEngine, Agent, Policy, Recorder, Script)
network/       P2P & server (PeerConnection, AuthoritativeServer, HybridPeerManager, MessageCodec, E2EEncryption)
hypertoken-rl/  RL adapters split (interface/, bridge/, python/) — Gym, PettingZoo, ONNXAgent, bridge server, Python client
core-rs/       Rust → WASM source (src/lib.rs, src/chronicle_actions/, Cargo.toml, build.sh)
cli/           CLI entrypoint (index.ts → commands/{relay,bridge,mcp}.ts)
examples/      10 game dirs (blackjack, poker, cuttle, prisoners-dilemma, hanabi, coup, liars-dice, accordion, dungeon-raiders, browser-demo)
examples/confluence/  Confluence CRDT showcase game (real-time territory game)
mcp/           MCP server for LLM play (server.ts, games/)
plugins/       analytics, logging, save-state plugins + pluginLoader
workers/       hypertoken.worker.js (Phase 3 multi-threading is future work)
docs/          Architecture, getting started, testing, extending, etc.
schemas/       JSON schemas
patterns/      Pattern reference
benchmark/     Benchmark scripts
test/          Custom test runner (no Jest/Vitest)
```

**Library entrypoint:** `core/index.js` exports `Token, Stack, Space, Source, Chronicle, Engine, Emitter, EventRegistry, random helpers, token-set loaders`. Note: `package.json` has **no `main`/`exports`** — consumers import directly from `core/index.js` or specific module paths.

## Setup, run, test, lint, build

```bash
npm install              # install deps
npm run build            # tsc + copy examples/WASM to dist/
npm run build:browser    # Build any game for browser (shared esbuild config)
npm run build:rust       # optional: compile Rust → WASM (prebuilt binaries included)
npm run clean            # rm -rf dist

# Tests (custom runner, no Jest/Vitest)
npm run test:quick       # ~10s: core + engine
npm run test:unit        # ~30s: core + engine + exporters + token + batch + transfers
npm run test            # ~2min: full suite incl. integration & network
npm run test:rust       # cargo test (native target, requires Rust)
npm run test:wasm       # WASM bridge tests
npm run test:sync:spike  # Phase 1 CRDT sync spike tests
npm run test:sync:hardening  # Phase B sync hardening tests
npm run test:persistence  # Phase C persistence tests
npm run test:cuttle:sync  # Cuttle CRDT sync tests
npm run test:cuttle:crypto  # Cuttle encrypted hands tests
npm run test:cuttle:hardening  # Cuttle hardening tests
npm run test:confluence:rules  # Confluence game rules tests
npm run test:confluence:sync  # Confluence CRDT sync tests

# Single test file (custom ESM loader resolves .js → .ts):
node --loader ./test/ts-esm-loader.js test/testCore.js

# Run games
npm run blackjack        # Casino with AI & betting
npm run poker            # Texas Hold'em
npm run cuttle           # Card combat
npm run prisoners-dilemma  # Game theory tournament
npm run confluence:web   # Build + serve Confluence browser client

# Infrastructure
npm run relay            # P2P relay server
npm run bridge           # Python bridge server
npm run mcp              # LLM MCP server
```

**Lint:** No ESLint/Prettier/Biome configured. Typechecking via `tsc` (strict mode). No dedicated lint script — run `npx tsc --noEmit` to typecheck.

**Docker:** `docker build -t hypertoken:latest .` then `docker compose up relay` (see `DOCKER.md`, `docker-compose.yml`).

## Coding conventions

- **ESM throughout** — `"type": "module"`; imports use `.js` extensions even for `.ts` files (the test loader at `test/ts-esm-loader.js` resolves them).
- **Strict TypeScript** — `strict: true`; `allowJs: true` enables file-by-file `.js`→`.ts` migration (codebase is mixed).
- **Action naming** — `category:verb` across 7 categories: `stack:`, `space:`, `agent:`, `token:`, `batch:`, `source:`, `game:`.
- **Event naming** — `type:name` (e.g., `state:updated`, `net:ready`, `state:changed`).
- **Everything extends `Emitter`** (`core/events.ts`) for event-based comms.
- **Tokens are immutable** — never modified, only created/destroyed. Provenance via `_mergedFrom` / `_splitFrom`.
- **State mutations go through `engine.dispatch()`** — not direct `session.change()`. Recent refactor migrated call sites; preserve this pattern.
- **Dual-path dispatch** — WASM `ActionDispatcher` if available + action supported, else TS `ActionRegistry` fallback. `IChronicle` interface abstracts both backends. Any new action needs both paths or an explicit fallback.
- **disableWasm option** — use `new Engine({ disableWasm: true })` when network sync is needed (WASM dispatcher doesn't support sync).
- **StorageAdapter pattern** — use `engine.useStorage(adapter)` + `await engine.persist(name)` / `await engine.resume(name)` for persistence (not the old save-state-plugin monkey-patching).
- **Automerge proxy issue** — `Object.values()` may not work on Automerge proxies; use `JSON.parse(JSON.stringify(state))` before derivation logic.
- **Seeded randomness** — `mulberry32` + `shuffleArray` (`core/random.js`). Tests use fixed seeds for reproducibility.
- **Apache 2.0 license header** on source files (see `core/index.js:1-15`).

## Testing expectations

- **Custom test runner** — no Jest/Vitest. Tests use hand-rolled `test()` / `assert()` helpers with pass/fail summary and `process.exit(1)` on failure (pattern documented in `docs/TESTING.md:103-153`).
- **ESM loader required** for `.ts` test files: `node --loader ./test/ts-esm-loader.js test/<file>`.
- **Use fixed seeds** for any randomness in tests (e.g., `stack.shuffle(123)`).
- **WASM parity** — changes to action handlers that exist in both TS and Rust must keep `test/testChronicleIncremental.ts` passing (TS/WASM behavioral parity).
- **Test categories:** core, engine, exporters, token, batch, player-transfers, recorder, script, agent, policy, crypto, random, plugins, plugin-loader, integration, sync, rule-sync, wasm, wasm:stack, wasm:space, parallel.
- ⚠️ `test/testCore.js` is a bare `console.log` script without assertions — it does **not** follow the documented `test()`/`assert()` pattern and always exits 0. Do not use it as a template for new tests; follow `docs/TESTING.md` instead.

## PR / review expectations

- **Working tree discipline** — recent commits show an active multi-phase engine refactor (migrating state into Chronicle, `session.change()` → `engine.dispatch()`). Check `git log` before touching engine/network code; some areas are mid-evolution.
- **Commit messages** follow conventional-commits style (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`) — match existing style.
- **Keep diffs clean** — no linter auto-formatting configured; don't reformat untouched code.
- **Dual-path changes need dual-path review** — if you touch an action handler, check whether a Rust counterpart exists in `core-rs/src/chronicle_actions/` and update both.
- **Docs and code must agree** — several docs are out of sync with code (see "Known inconsistencies" below). If your change affects documented behavior, update the doc in the same PR.
- **No secrets** — `.env` and `.env.local` are gitignored; never commit credentials.

## Constraints — do not touch without asking

1. **`network/E2EEncryption.ts`** — security-critical (ECDH/HKDF/AES-GCM). No visible security audit or constant-time guarantees. Treat as high-risk; ask before changing.
2. **`core-rs/src/chronicle.rs` + `chronicle_actions/`** — the incremental CRDT (54 field-level action methods) is the performance-critical core. Changes here affect WASM/TS parity for the whole engine.
3. **`IChronicle` interface / `WasmChronicleAdapter`** — abstracts the TS/WASM backend split. Breaking this interface breaks both dispatch paths.
4. **`engine/actions.ts`** — the large `ActionRegistry`. Adding actions is fine; renaming/removing actions is a breaking API change across all examples.
5. **`package.json` scripts** — many test scripts are referenced by CI and docs; renaming breaks tooling.
6. **`tsconfig.json` strict mode** — do not relax `strict: true` to silence errors; fix the errors.
7. **License headers** — preserve Apache 2.0 headers on source files.
8. **`core/StorageAdapter.ts` interface** — breaking this interface breaks all storage adapters. Add new methods with defaults.

## Definition of done

A change is complete when **all** of the following hold:

- [ ] `npx tsc --noEmit` passes (strict mode, no new errors)
- [ ] Relevant test category passes: `npm run test:quick` minimum; `npm run test:unit` for engine/core changes; `npm run test` for network/integration changes
- [ ] If you touched an action with a Rust counterpart: `npm run test:wasm` passes (TS/WASM parity)
- [ ] If you touched Rust: `npm run test:rust` passes
- [ ] If you touched storage/persistence code: `npm run test:persistence` passes
- [ ] No new `console.log` left in production code (use `Emitter` events or `engine.debug = true`)
- [ ] Docs updated if behavior changed (README, `docs/`, `engine/ACTIONS.md`, `WASM_INTEGRATION.md` as relevant)
- [ ] No secrets, no `.env` files, no large binary artifacts committed
- [ ] Commit message follows conventional-commits style
- [ ] Working tree clean (or only intended files staged)

## Quick orientation for new sessions

1. Read `CLAUDE.md` (authoritative agent guidance) and `docs/ARCHITECTURE.md` (component overview).
2. Run `npm run test:quick` to confirm the environment works.
3. Run `npm run blackjack` to see an end-to-end game.
4. For action questions: `engine/ACTIONS.md` + per-category docs in `engine/actions/`.
5. For WASM questions: `WASM_INTEGRATION.md` + `core-rs/README.md`.
6. For networking questions: `docs/GOSSIP_SCALING.md`, `docs/WORKER_MODE.md`, `network/` source.
