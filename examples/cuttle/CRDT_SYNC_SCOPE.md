# Cuttle CRDT Sync — Scope & Threat Model

## Goal

Wire Cuttle to use real Engine + Chronicle + ConsensusCore CRDT sync, with
encrypted hands so hidden information is preserved in a serverless model.

This is the flagship demo proving the engine's core thesis: serverless
multiplayer with CRDT state convergence, no central server deciding state.

## In scope

- **Classic 2-player Cuttle only.** No teams, no cutthroat variant.
- **Trusted dealer.** Host shuffles and deals. No mental poker protocol.
- **Deck commitments.** Deck stored as count + card commitments (hashes), not
  plaintext. Prevents post-hoc card substitution. Does NOT prove fair shuffle.
- **Encrypted hands.** Cards dealt to a player are encrypted with their session
  key (E2EEncryption ECDH + AES-GCM). Only the recipient can decrypt.
- **Reveal verification.** When a card is played, peers verify it matches its
  prior commitment.
- **TS-only path.** The engine is TypeScript-only; all actions route through the
  TS `ActionRegistry` and the Automerge `Chronicle` sync methods.
- **Snapshot-in-CRDT.** CuttleGame stays as a mutable rules engine. After each
  accepted action, a sanitized snapshot is written to Chronicle via
  `session.change()`. Full-state replacement, not field-level CRDT ops.
- **Turn/phase guards.** Actions include `expectedTurnNumber` to reject stale
  actions from out-of-sync peers.
- **Disconnect/reconnect.** Peers can disconnect and rejoin; CRDT sync catches
  them up via Automerge sync messages.

## Out of scope (for this milestone)

- **Mental poker / fair-shuffle proof.** The dealer is trusted to shuffle
  fairly. Deck commitments prevent card substitution but not biased shuffles.
- **Field-level CRDT operations.** Full-state replacement is acceptable for a
  2-player turn-based game where concurrent writes are rare.
- **Chronicle-native CuttleGame migration.** CuttleGame stays mutable; we write
  snapshots to Chronicle, not field-level ops.
- **Teams / cutthroat variant.** Classic 2-player only.
- **Spectators.** Two players only, no observer mode.
- **Persistence across sessions.** In-memory CRDT sync only. Save/resume is a
  future milestone.

## Threat model

**Honest dealer, hidden-info transport demo — not adversarial fair-shuffle.**

| Threat | Mitigation | Residual risk |
|--------|------------|---------------|
| Dealer substitutes cards post-shuffle | Deck commitments (hash before deal, verify on reveal) | None — substitution detected |
| Dealer biases the shuffle | None | Shuffle fairness is trusted |
| Peer reads opponent's hand from CRDT | Encrypted with recipient's session key | None — can't decrypt without key |
| Peer reads future draws from deck | Deck stored as count + commitments, not plaintext | None — order hidden |
| Public pending state leaks private info | Sanitize pending state (no "responders known to hold X") | Must audit each pending field |
| Stale action from disconnected peer | `expectedTurnNumber` guard rejects stale actions | Concurrent edge cases may need manual resolution |
| Key exchange MITM | E2EEncryption uses ECDH via relay signaling | Relay could MITM (future: signed keys) |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Player A (host/dealer)                 │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────┐ │
│  │  CuttleGame   │←──│  Engine      │←──│ Chronicle  │ │
│  │  (rules,      │   │  (dispatch)  │   │  (CRDT)   │ │
│  │   mutable)    │──→│              │──→│           │ │
│  └──────────────┘    └──────┬───────┘    └─────┬────┘ │
│                             │                  │       │
│                     ┌───────▼──────┐  ┌────────▼─────┐ │
│                     │ E2EEncryption│  │ ConsensusCore│ │
│                     │ (encrypt     │  │ (sync loop)  │ │
│                     │  opponent's  │  │              │ │
│                     │  cards)      │  └────────┬────┘ │
│                     └──────────────┘           │      │
└────────────────────────────────────────────────┼──────┘
                                                 │
                                    ┌────────────▼───────┐
                                    │   Relay Server     │
                                    │ (WebSocket signaling│
                                    │  + sync transport)  │
                                    └────────────┬───────┘
                                                 │
┌────────────────────────────────────────────────┼──────┐
│                    Player B (client)           │      │
│  ┌──────────────┐    ┌───────┬──────┐  ┌────────▼────┐│
│  │  CuttleGame   │←──│ Engine│      │  │ Chronicle   ││
│  │  (rules,      │   │       │      │  │  (CRDT)     ││
│  │   mutable)    │──→│       │      │  │             ││
│  └──────────────┘    └───────┘      │  └─────┬───────┘│
│                     ┌──────────────┐│        │        │
│                     │E2EEncryption ││  ┌─────▼──────┐ │
│                     │(decrypt own  ││  │ConsensusCore│ │
│                     │ hand)        ││  │ (sync loop) │ │
│                     └──────────────┘│  └────────────┘ │
└────────────────────────────────────────────────────────┘
```

### Synced state shape

```typescript
cuttle: {
  public: {
    phase: string,              // play, counter, resolve_*, etc.
    currentPlayer: number,      // 0 or 1
    turnNumber: number,         // increments each action
    winner: number | null,
    scrap: Card[],              // revealed cards
    publicZones: {              // revealed when played
      pointCards: Card[][],     // per player
      permanents: Card[][],     // per player
    },
    deckCount: number,          // how many cards remain
    deckCommitments: string[],  // hash per card (pre-deal)
    pendingResolution: {        // sanitized — no private info leaks
      type: string,             // "oneoff" | "royal" | etc.
      card: Card | null,        // the played card (revealed)
      // NO "respondersWithNine" or similar private-derived fields
    } | null,
  },
  privateZones: {
    hands: {
      0: EncryptedCardRef[],   // encrypted for player 0
      1: EncryptedCardRef[],    // encrypted for player 1
    }
  }
}

EncryptedCardRef = {
  slotId: string,              // stable id for this card slot
  recipientPeerId: string,     // who can decrypt
  senderPeerId: string,        // who encrypted (the dealer)
  ciphertext: string,          // base64 AES-GCM
  iv: string,                  // base64
  commitment: string,          // hash of plaintext card
  revealed: boolean,           // true once played publicly
}
```

### Action flow

1. Player dispatches: `engine.dispatch("cuttle:action", { action, player, expectedTurnNumber })`
2. Action handler validates (using CuttleGame rules)
3. If dealing: encrypt cards for recipient, store EncryptedCardRef in CRDT
4. If playing: reveal card (mark revealed=true, move to public zone)
5. Write sanitized snapshot to Chronicle via `session.change()`
6. Chronicle emits `state:changed` → ConsensusCore syncs to peer
7. Peer receives, Chronicle merges, emits `state:changed`
8. Peer's client decrypts own hand, renders public state

### Key exchange flow

1. Both players `engine.connect("ws://relay:3000")`
2. Each calls `E2EEncryption.initialize(peerId)` — generates ECDH key pair
3. Exchange public keys via relay signaling
4. `handleKeyExchange()` — derives shared secret (AES-GCM session key)
5. Dealer can now `encryptJSON(opponentPeerId, cardData)` for each dealt card
