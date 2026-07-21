# Engine dispatch and authoritative-view safety

This note describes the safety boundaries implemented by `Engine`,
`AuthoritativeServer`, and `RoomAuthoritativeServer`.

## Dispatch completion and failures

`Engine.dispatchChecked(type, payload, opts)` resolves to a discriminated outcome:

```ts
type DispatchOutcome<T> =
  | { ok: true; result: T }
  | { ok: false; error: { code: DispatchErrorCode; message: string } };
```

Narrow on `outcome.ok` before reading `result` or `error`. Error codes are
`UNKNOWN_ACTION`, `ACTION_HANDLER_ERROR`, and `WASM_EXECUTION_ERROR`.

The legacy `dispatch()` API still returns the handler result, but now rejects
with `DispatchError` on failure. A successful handler that returns no value
continues to resolve to `undefined`; `undefined` is not a failure signal.

Both APIs wait for promise-like handler results. History recording,
`engine:action`, policy evaluation, and authoritative success acknowledgement
happen only after asynchronous completion succeeds. A rejection is reported as
a failure and is not recorded as a successful action.

Dispatch is **not transactional**: there is no handler rollback guarantee. If a
handler mutates state and then throws or rejects, those earlier mutations may
remain even though dispatch reports failure. Validate before mutation and make
multi-step handlers explicitly atomic where the game requires it.

## Final outbound projection

Every built-in authoritative-server send passes through:

```ts
protected projectOutbound(
  principal: OutboundPrincipal,
  category: OutboundMessageCategory,
  payload: any,
): any | null
```

The principal contains `clientId` and, where available, `roomCode` and
`playerIndex`. Override this final policy boundary to enforce application
disclosure rules. Returning `null`/`undefined`, throwing, or failing
serialization denies the send. The built-in paths covered include welcome,
state describe/broadcast, history, room create/join/leave/list/errors, and
dispatch success/errors (as well as protocol errors). Unknown/custom message
shapes are denied unless an override explicitly projects them.

`projectHistory(principal, entry, index)` separately projects individual history
entries. Its default returns `null`, so history responses contain no actions.
Projection failures for one entry omit that entry.

Safe defaults disclose only minimal state: the base server exposes history
length, while room views expose room membership/code and history length. History
entries are denied. Dispatch acknowledgements and errors omit the submitted
payload and handler result; correlation IDs and action type may be retained, and
errors are sanitized.

### Compatibility and migration

`getStateForClient(clientId)` and room-aware
`getStateForRoom(roomCode, clientId)` remain supported. Existing subclasses can
continue using them to construct player-specific state. For a hardened server:

1. Keep those hooks as the game-specific state-view builders.
2. Override `projectOutbound` for the final per-principal envelope and disclosure
   policy.
3. Override `projectHistory` only for fields that are safe to reveal.

Room and non-room sends share the same final projection boundary. Custom code
should use `sendToClient` rather than writing directly to a WebSocket.

## Scope and non-goals

Projection is view-only. It does not authenticate peer-authored state, establish
consensus, or make a CRDT update trustworthy. It also does not protect raw P2P
CRDT synchronization, and `UniversalRelayServer` remains an opaque relay rather
than an authoritative projection boundary.

A reconnect creates a new connection identity and receives a freshly computed,
projected welcome view. There is no durable reconnect/catch-up protocol.
Durable request idempotency and encrypted state storage are deferred concerns
and must not be inferred from these APIs.
