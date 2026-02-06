# Contributor Guide for AI Agents

This guide helps AI agents quickly understand HyperToken’s architecture, entry points, and workflows so they can contribute safely and effectively.

## 1) Repo Map (What Lives Where)

```
hypertoken/
├── core/        # CRDT data structures (Token/Stack/Space/Chronicle)
├── engine/      # Engine orchestration, action dispatch, game loop
├── network/     # P2P relay, WebRTC/WebSocket, authoritative server
├── interface/   # Gym/PettingZoo adapters
├── bridge/      # WebSocket server for Python RL clients
├── examples/    # Game implementations & demos
├── core-rs/     # Rust/WASM acceleration for core operations
└── docs/        # Architecture + guides
```

References: README architecture overview + Getting Started structure summary.【F:README.md†L165-L193】【F:docs/GETTING_STARTED.md†L177-L187】

## 2) Architectural Style (High-Level)

HyperToken is a **modular monolith**: one repo + one npm package with clear internal modules for CRDT state, engine orchestration, networking, and ML interfaces. It is not split into independently deployed services, but the CLI can start different modes (relay, bridge, MCP).【F:package.json†L1-L44】【F:cli/index.ts†L1-L102】

## 3) Core Concepts & Domains

**CRDT State & Data Models**
- `Chronicle` is the CRDT state container (Automerge wrapper).【F:core/Chronicle.ts†L4-L58】
- `Token`, `Stack`, `Space`, `Source` describe game entities and collections (see Architecture Guide).【F:docs/ARCHITECTURE.md†L11-L43】

**Engine & Action Dispatch**
- `Engine` coordinates actions and game flow and uses `Chronicle` for state.【F:docs/ARCHITECTURE.md†L17-L43】

**Networking**
- `ConsensusCore` handles Automerge sync messaging across peers.【F:core/ConsensusCore.ts†L1-L140】
- `UniversalRelayServer` is a WebSocket relay for P2P signaling + routing.【F:network/UniversalRelayServer.ts†L17-L429】
- `HybridPeerManager` upgrades WebSocket → WebRTC when possible.【F:network/HybridPeerManager.ts†L1-L408】
- `AuthoritativeServer` supports server-owned state (centralized option).【F:network/AuthoritativeServer.ts†L1-L304】

**AI/ML Integration**
- `bridge/server.ts` hosts environments over WebSocket for Python RL clients (Gym/PettingZoo).【F:bridge/server.ts†L1-L533】
- The Python integration protocol is documented in `docs/PYTHON_BRIDGE.md`.【F:docs/PYTHON_BRIDGE.md†L1-L110】

## 4) Primary Entry Points

**CLI**
- `hypertoken` binary points to `dist/cli/index.js` and supports:
  - `relay` (P2P signaling server)
  - `bridge` (Python RL bridge server)
  - `mcp` (LLM integration server)
【F:package.json†L8-L44】【F:cli/index.ts†L1-L102】

**Relay Server**
- `cli/commands/relay.ts` starts `UniversalRelayServer`.【F:cli/commands/relay.ts†L1-L135】

**Python Bridge Server**
- `bridge/server.ts` exposes AEC environments via WebSocket.【F:bridge/server.ts†L1-L533】

**Authoritative Server**
- `network/AuthoritativeServer.ts` provides a server-authoritative alternative.【F:network/AuthoritativeServer.ts†L1-L304】

## 5) Request Path Example (Python RL `step`)

```
Python Client → WebSocket {cmd:"step"} → EnvServer.handleCommand
→ AECEnvironment.step(...) → Engine/Chronicle state update → response
```

Evidence:
- Command protocol documented in Python Bridge guide.【F:docs/PYTHON_BRIDGE.md†L69-L88】
- WebSocket request parsing + `step` dispatch in EnvServer.【F:bridge/server.ts†L267-L343】
- CRDT state serialized/restored via Chronicle + Engine snapshots (for replay/persistence).【F:core/Chronicle.ts†L41-L58】【F:engine/Engine.ts†L802-L820】

## 6) How to Run Locally

**Install & Build**
```bash
npm install
npm run build
```
【F:docs/GETTING_STARTED.md†L19-L33】

**Run an Example Game**
```bash
npm run blackjack
```
【F:docs/GETTING_STARTED.md†L35-L40】

**Start Relay Server**
```bash
npm run relay
```
【F:package.json†L41-L44】

**Start Python Bridge**
```bash
npm run bridge
# or
npx tsx bridge/server.ts --env blackjack --port 9999
```
【F:package.json†L41-L44】【F:docs/PYTHON_BRIDGE.md†L36-L48】

**Docker (optional)**
```bash
docker compose up relay
```
【F:docker-compose.yml†L1-L24】

## 7) Tests & Checks

**Fast tests**
```bash
npm run test:quick
```
**Full suite**
```bash
npm run test
```
Scripts in `package.json` enumerate many focused suites (core, engine, network, plugins, wasm, etc.).【F:package.json†L45-L85】

## 8) Stability Risks & Watch Areas (Operational)

- **State persistence is optional**: `Chronicle` supports save/load, and `Engine` snapshots embed CRDT data. Production usage should define where/when to persist snapshots.【F:core/Chronicle.ts†L41-L58】【F:engine/Engine.ts†L802-L820】
- **Bridge security is opt-in**: API token enforcement is optional in EnvServer. If `apiToken` is unset, the bridge is open to any reachable client.【F:bridge/server.ts†L45-L49】【F:bridge/server.ts†L247-L256】

## 9) Useful Files to Read First

1. `docs/ARCHITECTURE.md` — component definitions and flows.【F:docs/ARCHITECTURE.md†L1-L468】
2. `cli/index.ts` — CLI entry and top-level services.【F:cli/index.ts†L1-L102】
3. `bridge/server.ts` — Python integration server, command handling.【F:bridge/server.ts†L1-L533】
4. `core/Chronicle.ts` + `core/ConsensusCore.ts` — CRDT and sync logic.【F:core/Chronicle.ts†L4-L58】【F:core/ConsensusCore.ts†L1-L140】
5. `network/UniversalRelayServer.ts` — P2P relay server details.【F:network/UniversalRelayServer.ts†L17-L429】

---

## Contribution Notes (AI-Specific)

- Prefer small, targeted changes with clear citations and tests.
- When touching networking or CRDT logic, trace the end-to-end flow (Engine → Chronicle → ConsensusCore → network).【F:core/ConsensusCore.ts†L1-L140】【F:engine/Engine.ts†L57-L140】
- If modifying Python bridge behavior, update both server and `docs/PYTHON_BRIDGE.md` for protocol changes.【F:bridge/server.ts†L267-L343】【F:docs/PYTHON_BRIDGE.md†L69-L110】

