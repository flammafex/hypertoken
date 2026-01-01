# HyperToken Performance Benchmarks

Comprehensive performance and memory benchmarking suite for HyperToken.

## Overview

The benchmark suite consists of two main components:

1. **Performance Benchmarks** (`benchmarks.ts`) - Measures execution speed and throughput
2. **Memory Benchmarks** (`benchmarks-memory.ts`) - Measures memory consumption patterns

## Quick Start

```bash
# Build TypeScript files first
npx tsc

# Run performance benchmarks (takes ~3-5 minutes)
npm run benchmark

# Run memory benchmarks (requires --expose-gc, takes ~2-3 minutes)
npm run benchmark:memory

# Run all benchmarks (takes ~5-8 minutes total)
npm run benchmark:all
```

**Note:** Benchmarks are intentionally comprehensive and may take several minutes to complete. This is normal - the benchmarks test thousands of operations across multiple categories to provide statistically significant results.

## Performance Benchmarks

### What's Tested

The performance benchmark suite measures operations per second for:

#### Engine Operations
- Simple action dispatch
- Stack creation and drawing
- Sequential action execution
- Policy evaluation overhead

#### Token Operations
- Single token creation
- Batch token creation (100 tokens)
- Metadata read operations
- Metadata write operations

#### Stack Operations
- Stack creation with various sizes (52, 1000 tokens)
- Shuffling operations
- Drawing cards (single and multiple)
- Large-scale stack operations

#### Space Operations
- Space creation
- Token placement (single and batch)
- Moving tokens between zones
- Querying tokens in zones

#### CRDT Operations (Chronicle)
- Chronicle instance creation
- Applying changes (single and batch)
- Serialization to binary
- Deserialization from binary
- Base64 encoding
- Document merging

#### Collection Operations
- Filtering tokens with native array methods
- Counting and querying token collections

#### Large-Scale Operations
- Multiple stacks (10 stacks × 52 tokens)
- Large spaces (1000 tokens)
- Complex engine snapshots
- Source operations (1000 tokens)

#### Real-World Scenarios
- Blackjack hand dealing
- Card game rounds (4 players)
- Token filtering and manipulation
- State persistence (save/restore)

### Output Format

```
📊 Engine: Simple action dispatch (debug:log)
   Iterations: 10,000
   Total Time: 123.45 ms
   Avg Time:   0.0123 ms
   Ops/Sec:    81,234
   Min Time:   0.0100 ms
   Max Time:   0.0500 ms
```

### Running Specific Benchmarks

The benchmarks run sequentially. To run a subset, modify `test/benchmarks.ts` and comment out unwanted sections.

## Memory Benchmarks

### What's Tested

The memory benchmark suite measures heap and external memory usage for:

#### Token Memory
- Single token allocation
- Batch allocations (100, 1K, 10K, 100K tokens)

#### Stack Memory
- Standard deck (52 tokens)
- Large stacks (1K, 10K tokens)
- Multiple stacks (10 × 52 tokens)

#### Space Memory
- Empty space overhead
- Populated spaces (100, 1K, 10K tokens)
- Multi-zone spaces (10 zones × 100 tokens)

#### CRDT Memory
- Empty Chronicle overhead
- Growth with changes (10, 100, 1K changes)
- Serialization overhead
- Document merging memory cost

#### Engine Memory
- Empty engine overhead
- Engine with components (Stack, Space, Source)
- Action history accumulation
- Snapshot memory cost
- Multiple engine instances

#### Real-World Scenarios
- Multiplayer card game (4 players)
- Large simulations (1000 tokens, 500 actions)
- Tournament systems (10 concurrent games)
- Persistent worlds with history

### Output Format

```
📊 Stack with 52 tokens
   Heap Used:    1.23 MB → 1.45 MB (Δ 234.56 KB)
   External:     0.12 MB → 0.15 MB (Δ 30.00 KB)
   Total Impact: 264.56 KB
```

### Important: Garbage Collection

For accurate memory measurements, run with `--expose-gc`:

```bash
npm run benchmark:memory
```

The script automatically uses `--expose-gc` via the npm script. If running manually:

```bash
node --expose-gc --loader ./test/ts-esm-loader.js test/benchmarks-memory.ts
```

Without `--expose-gc`, you'll see a warning but benchmarks will still run (less accurate).

## Understanding the Results

### Performance Metrics

- **Avg Time**: Average time per operation (lower is better)
- **Ops/Sec**: Operations per second (higher is better)
- **Min/Max Time**: Range of execution times (smaller range = more consistent)

### Performance Guidelines

| Operation | Expected Ops/Sec | Notes |
|-----------|-----------------|-------|
| Token Creation | > 100,000 | Very lightweight |
| Engine Dispatch | > 10,000 | Depends on action complexity |
| Stack Shuffle | > 1,000 | Uses seeded PRNG |
| CRDT Changes | > 500 | Depends on change size |
| Batch Filter (100) | > 5,000 | Linear scan |
| Batch Filter (1000) | > 500 | Scales linearly |

### Memory Guidelines

| Structure | Expected Memory | Notes |
|-----------|----------------|-------|
| Single Token | < 1 KB | Minimal overhead |
| Stack (52 tokens) | < 100 KB | Includes CRDT overhead |
| Space (100 tokens) | < 200 KB | Zone management overhead |
| Chronicle (100 changes) | < 500 KB | Automerge overhead |
| Engine (full state) | < 1 MB | Depends on components |

## Interpreting Results

### Good Performance Indicators
- ✅ Linear scaling (2x tokens = 2x time)
- ✅ Consistent min/max times
- ✅ High ops/sec for simple operations
- ✅ Reasonable memory growth

### Performance Red Flags
- ❌ Super-linear scaling (2x tokens = 4x time)
- ❌ Large variance in min/max times
- ❌ Sudden performance drops at specific sizes
- ❌ Exponential memory growth

## Benchmarking Best Practices

### 1. Consistent Environment
Run benchmarks in a consistent environment:
- Close other applications
- Run multiple times and average results
- Use the same Node.js version for comparisons

### 2. Warmup
Benchmarks include warmup runs to allow JIT compilation to stabilize.

### 3. Realistic Scenarios
The "Real-World Scenarios" section tests practical use cases. These are most relevant for application performance.

### 4. Compare Incrementally
When optimizing, compare before/after results for specific operations.

## Adding New Benchmarks

### Performance Benchmark Template

```typescript
runner.benchmark('Category: Operation description', () => {
  // Setup (not timed, but kept minimal)
  const engine = new Engine();

  // Operation to benchmark (timed)
  engine.dispatch('some:action', { data: 'test' });
}, 1000); // iterations
```

### Memory Benchmark Template

```typescript
await measureMemory('Category: Operation description', () => {
  // Operation to measure
  const tokens = createTestTokens(100);
  // GC happens before and after automatically
});
```

## Continuous Performance Monitoring

### Establishing Baselines

1. Run benchmarks on a clean build:
   ```bash
   npm run benchmark:all > benchmarks-baseline.txt
   ```

2. After changes, compare:
   ```bash
   npm run benchmark > benchmarks-current.txt
   diff benchmarks-baseline.txt benchmarks-current.txt
   ```

### Regression Testing

Add benchmark runs to CI/CD:
```yaml
# Example GitHub Actions
- name: Run Benchmarks
  run: |
    npm run benchmark
    npm run benchmark:memory
```

### Performance Goals

Set performance budgets:
- Engine dispatch: > 10,000 ops/sec
- Token creation: > 100,000 ops/sec
- Stack operations: > 1,000 ops/sec
- Memory per token: < 1 KB

## Optimization Tips

### If Operations Are Slow
1. Check algorithm complexity (O(n²) vs O(n))
2. Reduce object allocations in hot paths
3. Use batch operations instead of loops
4. Profile with `node --prof`

### If Memory Is High
1. Check for memory leaks (objects not being GC'd)
2. Reduce object duplication
3. Use object pooling for frequently created objects
4. Profile with `node --heap-prof`

## Platform-Specific Notes

### Node.js Versions
Performance characteristics may vary between Node.js versions due to:
- V8 engine optimizations
- Garbage collector improvements
- JIT compiler changes

Always specify Node.js version when reporting benchmarks.

### CPU Architecture
Results vary by CPU:
- Apple Silicon (M1/M2): Excellent single-thread performance
- Intel/AMD: May show different patterns
- ARM: Different optimization characteristics

## Troubleshooting

### "Cannot find module" errors
Ensure TypeScript files are compiled:
```bash
npx tsc
```

### Inconsistent results
- Close other applications
- Run benchmarks multiple times
- Check CPU throttling (temperature, power saving)

### Memory benchmarks show no delta
- Verify `--expose-gc` flag is present
- Check that global.gc is available
- Increase allocation size to exceed measurement threshold

## Contributing

When adding features to HyperToken:

1. ✅ Add relevant benchmarks for new operations
2. ✅ Ensure performance remains within guidelines
3. ✅ Document any performance trade-offs
4. ✅ Update this README if adding new benchmark categories

## References

- [Performance API](https://nodejs.org/api/perf_hooks.html)
- [Memory Management](https://nodejs.org/en/docs/guides/diagnostics/memory/)
- [V8 Optimization](https://v8.dev/docs/turbofan)

---

**Last Updated**: 2025-11-22
**Node.js Version**: v22+ recommended
**Platform**: Cross-platform (Linux, macOS, Windows)
