/**
 * HyperToken Browser Demo
 *
 * Demonstrates Web Worker + WASM execution in the browser.
 */

// State
let engine = null;
let isReady = false;
let actionCount = 0;
let totalLatency = 0;
let logEntries = 0;

// DOM Elements
const output = document.getElementById('output');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const envBadge = document.getElementById('envBadge');
const actionCountEl = document.getElementById('actionCount');
const avgLatencyEl = document.getElementById('avgLatency');
const workerPingEl = document.getElementById('workerPing');
const logCountEl = document.getElementById('logCount');

// Buttons
const btnInit = document.getElementById('btnInit');
const btnShuffle = document.getElementById('btnShuffle');
const btnDraw = document.getElementById('btnDraw');
const btnPing = document.getElementById('btnPing');
const btnBenchmark = document.getElementById('btnBenchmark');
const btnShutdown = document.getElementById('btnShutdown');

/**
 * Log a message to the output
 */
function log(message, type = '') {
  const line = document.createElement('div');
  line.className = `log-line ${type}`;

  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  line.innerHTML = `<span class="timestamp">[${timestamp}]</span>${escapeHtml(message)}`;

  output.appendChild(line);
  output.scrollTop = output.scrollHeight;

  logEntries++;
  logCountEl.textContent = `${logEntries} entries`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Update status display
 */
function setStatus(status, text) {
  statusIndicator.className = `status-indicator ${status}`;
  statusText.textContent = text;
}

/**
 * Update button states
 */
function updateButtons(ready) {
  btnInit.disabled = ready;
  btnShuffle.disabled = !ready;
  btnDraw.disabled = !ready;
  btnPing.disabled = !ready;
  btnBenchmark.disabled = !ready;
  btnShutdown.disabled = !ready;
}

/**
 * Update stats
 */
function updateStats(latency) {
  actionCount++;
  totalLatency += latency;

  actionCountEl.textContent = actionCount;
  avgLatencyEl.textContent = (totalLatency / actionCount).toFixed(2);
}

/**
 * Initialize the Engine with Web Worker
 */
window.initEngine = async function() {
  if (engine) {
    log('Engine already initialized', 'warn');
    return;
  }

  try {
    setStatus('loading', 'Loading Engine module...');
    log('Loading Engine module...', 'info');

    // Dynamically import the Engine
    // Note: In a real app, you'd use a bundler (webpack, vite, etc.)
    // For this demo, we're importing directly from the source
    const { Engine } = await import('../../engine/Engine.js');

    setStatus('loading', 'Creating Engine with Web Worker...');
    log('Creating Engine with useWorker: true', 'info');

    engine = new Engine({
      useWorker: true,
      workerOptions: {
        debug: true,
        workerPath: '/workers/hypertoken.worker.js',
        wasmPath: '/wasm'
      }
    });

    // Set debug mode
    engine.debug = true;

    // Listen for events
    engine.on('engine:action', (event) => {
      log(`Action completed: ${JSON.stringify(event.payload?.actionType || 'unknown')}`, 'info');
    });

    engine.on('engine:error', (event) => {
      log(`Engine error: ${event.payload?.error?.message || 'Unknown error'}`, 'error');
    });

    engine.on('state:updated', (event) => {
      log('State updated', 'info');
    });

    // Wait for worker to be ready
    // The Engine initializes the worker asynchronously
    setStatus('loading', 'Waiting for worker initialization...');
    log('Waiting for worker to initialize...', 'info');

    // Give the worker time to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if worker is ready
    if (engine._wasmWorker && engine._wasmWorker.ready) {
      isReady = true;
      const env = engine._wasmWorker.environment || 'browser';
      envBadge.textContent = env;
      setStatus('ready', 'Engine ready');
      log(`Engine initialized successfully in ${env} mode`, 'success');
      updateButtons(true);
    } else {
      // Worker might have fallen back to sync mode
      log('Worker may have fallen back to sync mode', 'warn');
      setStatus('ready', 'Engine ready (sync fallback)');
      envBadge.textContent = 'sync';
      isReady = true;
      updateButtons(true);
    }

  } catch (error) {
    log(`Failed to initialize: ${error.message}`, 'error');
    setStatus('', 'Initialization failed');
    console.error('Init error:', error);
  }
};

/**
 * Test shuffle operation
 */
window.testShuffle = async function() {
  if (!engine || !isReady) {
    log('Engine not ready', 'warn');
    return;
  }

  try {
    const seed = Date.now();
    log(`Shuffling deck with seed: ${seed}...`, 'info');

    const start = performance.now();
    await engine.dispatch('stack:shuffle', { seed });
    const duration = performance.now() - start;

    log(`Shuffle complete in ${duration.toFixed(2)}ms`, 'success');
    updateStats(duration);

  } catch (error) {
    log(`Shuffle error: ${error.message}`, 'error');
  }
};

/**
 * Test draw operation
 */
window.testDraw = async function() {
  if (!engine || !isReady) {
    log('Engine not ready', 'warn');
    return;
  }

  try {
    log('Drawing 5 cards...', 'info');

    const start = performance.now();
    const result = await engine.dispatch('stack:draw', { count: 5 });
    const duration = performance.now() - start;

    log(`Drew ${result?.length || 0} cards in ${duration.toFixed(2)}ms`, 'success');
    if (result && result.length > 0) {
      log(`Cards: ${JSON.stringify(result)}`, 'info');
    }
    updateStats(duration);

  } catch (error) {
    log(`Draw error: ${error.message}`, 'error');
  }
};

/**
 * Ping the worker
 */
window.testPing = async function() {
  if (!engine || !isReady) {
    log('Engine not ready', 'warn');
    return;
  }

  try {
    log('Pinging worker...', 'info');

    if (engine._wasmWorker && engine._wasmWorker.ping) {
      const latency = await engine._wasmWorker.ping();
      log(`Worker responded in ${latency}ms`, 'success');
      workerPingEl.textContent = latency.toFixed(2);
    } else {
      log('Worker ping not available (sync mode?)', 'warn');
    }

  } catch (error) {
    log(`Ping error: ${error.message}`, 'error');
  }
};

/**
 * Run benchmark
 */
window.runBenchmark = async function() {
  if (!engine || !isReady) {
    log('Engine not ready', 'warn');
    return;
  }

  const iterations = 100;
  log(`Running benchmark: ${iterations} shuffles...`, 'info');

  try {
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      await engine.dispatch('stack:shuffle', { seed: i });
    }

    const duration = performance.now() - start;
    const avgPerOp = duration / iterations;

    log(`Benchmark complete:`, 'success');
    log(`  Total time: ${duration.toFixed(2)}ms`, 'success');
    log(`  Avg per operation: ${avgPerOp.toFixed(2)}ms`, 'success');
    log(`  Operations/second: ${(1000 / avgPerOp).toFixed(0)}`, 'success');

    // Update stats for each iteration
    for (let i = 0; i < iterations; i++) {
      updateStats(avgPerOp);
    }

  } catch (error) {
    log(`Benchmark error: ${error.message}`, 'error');
  }
};

/**
 * Shutdown the engine
 */
window.shutdownEngine = async function() {
  if (!engine) {
    log('No engine to shutdown', 'warn');
    return;
  }

  try {
    log('Shutting down engine...', 'info');

    await engine.shutdown();

    engine = null;
    isReady = false;

    setStatus('', 'Engine shutdown');
    log('Engine shutdown complete', 'success');
    updateButtons(false);

  } catch (error) {
    log(`Shutdown error: ${error.message}`, 'error');
  }
};

/**
 * Clear the output log
 */
window.clearOutput = function() {
  output.innerHTML = '';
  logEntries = 0;
  logCountEl.textContent = '0 entries';
};

// Initial log message
log('HyperToken Browser Demo loaded', 'info');
log('Click "Initialize Engine" to start', 'info');
setStatus('', 'Click Initialize to start');
envBadge.textContent = 'browser';
