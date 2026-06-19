# Persistence Guide

HyperToken supports persisting game state to disk (Node.js) or IndexedDB
(browser), enabling save/resume across sessions, auto-save, and forkable worlds
that survive page refreshes or server restarts.

## Quick start

```typescript
import { Engine } from './engine/Engine.js';
import { FilesystemAdapter } from './core/storage/FilesystemAdapter.js';

const engine = new Engine({ disableWasm: true });

// Attach a storage adapter
const adapter = new FilesystemAdapter({ dir: './saves' });
engine.useStorage(adapter);

// Write some game state
engine.session.change('init', (doc) => {
  doc.game = { players: [], turn: 0 };
});

// Save
await engine.persist('my-game', 'First save');

// Later: load in a new engine
const engine2 = new Engine({ disableWasm: true });
engine2.useStorage(new FilesystemAdapter({ dir: './saves' }));
await engine2.resume('my-game');

// State is restored
console.log(engine2.session.state.game); // { players: [], turn: 0 }
```

## Storage adapters

### FilesystemAdapter (Node.js)

Saves game state as JSON files in a directory.

```typescript
import { FilesystemAdapter } from './core/storage/FilesystemAdapter.js';

const adapter = new FilesystemAdapter({
  dir: './saves',        // Directory for save files (default: './saves')
});
```

### IndexedDBAdapter (browser)

Saves game state in the browser's IndexedDB. Survives page refresh,
works offline.

```typescript
import { IndexedDBAdapter } from './core/storage/IndexedDBAdapter.js';

const adapter = new IndexedDBAdapter({
  dbName: 'hypertoken',  // Database name (default: 'hypertoken')
});
```

### MemoryAdapter (testing)

In-memory storage for tests. Cleared when the process exits.

```typescript
import { MemoryAdapter } from './core/storage/MemoryAdapter.js';

const adapter = new MemoryAdapter();
```

## Engine API

### `engine.useStorage(adapter)`

Attach a storage adapter. Must be called before `persist()`, `resume()`,
`listSaves()`, or `deleteSave()`.

### `await engine.persist(name, description?)`

Save the current game state. The Chronicle (Automerge CRDT) is serialized
to base64 and stored via the adapter.

```typescript
await engine.persist('my-game', 'After turn 5');
```

### `await engine.resume(name)`

Load a saved game state. Returns `true` if a save was found, `false` if
no save exists with that name.

```typescript
const loaded = await engine.resume('my-game');
if (loaded) {
  console.log('Game restored!');
} else {
  console.log('No save found, starting new game');
}
```

### `await engine.listSaves()`

List all saved games, sorted by timestamp (newest first).

```typescript
const saves = await engine.listSaves();
for (const save of saves) {
  console.log(`${save.name} — ${new Date(save.timestamp).toLocaleString()}`);
}
```

### `await engine.deleteSave(name)`

Delete a saved game.

### `engine.enableAutoSave(intervalMs, name?)`

Enable auto-save at a regular interval.

```typescript
engine.enableAutoSave(30000, 'autosave'); // Save every 30 seconds
```

### `engine.disableAutoSave()`

Disable auto-save.

## How it works

The Engine's Chronicle is an Automerge CRDT document. Automerge provides
`save()` (serialize to binary) and `load()` (deserialize from binary).
The storage adapters serialize this to base64 for storage.

```
Engine.persist()
  → Chronicle.saveToBase64()
    → Automerge.save(doc) → Uint8Array → base64 string
      → StorageAdapter.save(name, base64)

Engine.resume()
  → StorageAdapter.load(name) → base64 string
    → Chronicle.loadFromBase64(base64)
      → Automerge.load(bytes) → doc
```

## Migration from save-state-plugin

The old `plugins/save-state-plugin.js` monkey-patched methods onto the engine.
The new API is first-class:

```typescript
// Old (monkey-patch)
import saveStatePlugin from './plugins/save-state-plugin.js';
saveStatePlugin.init(engine, { storageType: 'file' });
await engine.saveGame('my-game');
await engine.loadGame('my-game');

// New (first-class API)
import { FilesystemAdapter } from './core/storage/FilesystemAdapter.js';
engine.useStorage(new FilesystemAdapter({ dir: './saves' }));
await engine.persist('my-game');
await engine.resume('my-game');
```

The old plugin still works for backward compatibility, but the new API is
recommended for new code.

## Files

| File | Purpose |
|------|---------|
| `core/StorageAdapter.ts` | Interface + types |
| `core/storage/MemoryAdapter.ts` | In-memory adapter (testing) |
| `core/storage/FilesystemAdapter.ts` | Filesystem adapter (Node.js) |
| `core/storage/IndexedDBAdapter.ts` | IndexedDB adapter (browser) |
| `engine/Engine.ts` | `useStorage()`, `persist()`, `resume()`, `listSaves()`, `deleteSave()`, `enableAutoSave()` |
| `test/testPersistence.ts` | 16 tests covering all adapters + Engine API |
