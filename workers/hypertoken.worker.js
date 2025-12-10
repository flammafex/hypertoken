/**
 * HyperToken Browser Web Worker
 *
 * Loads WASM and processes action requests in a separate thread.
 * This script runs in a Web Worker context (no DOM access).
 *
 * Communication:
 * - Receives: WorkerRequest messages from main thread
 * - Sends: WorkerResponse messages back to main thread
 */

// WASM module and instances
let wasmModule = null;
let wasmStack = null;
let wasmSpace = null;
let wasmSource = null;
let wasmChronicle = null;
let wasmDispatcher = null;
let isInitialized = false;

/**
 * Initialize WASM module
 * @param {string} wasmPath - Path to WASM files (e.g., '/wasm/')
 */
async function initializeWasm(wasmPath) {
  if (isInitialized) {
    return true;
  }

  try {
    console.log('[Worker] Loading WASM...');

    // Dynamically import the WASM module from web build
    // The path should be relative to where the worker script is served
    const wasmUrl = wasmPath
      ? `${wasmPath.replace(/\/$/, '')}/hypertoken_core.js`
      : '/wasm/hypertoken_core.js';

    // Import the ES module
    const wasm = await import(wasmUrl);

    // Initialize WASM (wasm-bindgen generates an init function as default export)
    if (wasm.default && typeof wasm.default === 'function') {
      const wasmBinaryPath = wasmPath
        ? `${wasmPath.replace(/\/$/, '')}/hypertoken_core_bg.wasm`
        : '/wasm/hypertoken_core_bg.wasm';
      await wasm.default(wasmBinaryPath);
    }

    wasmModule = wasm;

    // Create instances
    if (wasm.Chronicle) {
      wasmChronicle = new wasm.Chronicle();
    }
    wasmStack = new wasm.Stack();
    wasmSpace = new wasm.Space();
    wasmSource = new wasm.Source();
    wasmDispatcher = new wasm.ActionDispatcher();

    // Initialize instances with empty state
    wasmStack.setState(JSON.stringify({
      stack: [],
      drawn: [],
      discards: []
    }));

    wasmSpace.setState(JSON.stringify({
      zones: {}
    }));

    wasmSource.setState(JSON.stringify({
      stackIds: [],
      tokens: [],
      burned: [],
      seed: null,
      reshufflePolicy: { threshold: null, mode: 'auto' }
    }));

    // Connect dispatcher to instances
    wasmDispatcher.setStack(wasmStack);
    wasmDispatcher.setSpace(wasmSpace);
    wasmDispatcher.setSource(wasmSource);

    isInitialized = true;
    console.log('[Worker] WASM initialized successfully');

    return true;
  } catch (error) {
    console.error('[Worker] WASM initialization failed:', error);
    throw error;
  }
}

/**
 * Generate unique message ID
 */
function generateMessageId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a response message
 */
function createResponse(requestId, type, payload, error) {
  return {
    id: generateMessageId(),
    type,
    requestId,
    timestamp: Date.now(),
    payload,
    error
  };
}

/**
 * Handle action dispatch request
 */
function handleDispatchAction(request) {
  if (!wasmDispatcher) {
    return createResponse(
      request.id,
      'error',
      undefined,
      { message: 'WASM not initialized' }
    );
  }

  const { actionType, actionPayload } = request.payload;
  const start = performance.now();

  try {
    // Create action JSON
    const actionJson = JSON.stringify({
      type: actionType,
      ...actionPayload,
    });

    // Dispatch to WASM
    const resultJson = wasmDispatcher.dispatch(actionJson);
    const result = JSON.parse(resultJson);

    const duration = performance.now() - start;

    // Send action completed event
    self.postMessage(createResponse(
      request.id,
      'action_completed',
      {
        actionType,
        result,
        duration,
      }
    ));

    // Send success response
    return createResponse(request.id, 'success', result);
  } catch (error) {
    return createResponse(
      request.id,
      'error',
      undefined,
      {
        message: error.message || 'Action dispatch failed',
        stack: error.stack,
      }
    );
  }
}

/**
 * Handle batch action dispatch
 */
function handleDispatchBatch(request) {
  if (!wasmDispatcher) {
    return createResponse(
      request.id,
      'error',
      undefined,
      { message: 'WASM not initialized' }
    );
  }

  const { actions } = request.payload;
  const results = [];

  try {
    for (const action of actions) {
      const actionJson = JSON.stringify({
        type: action.actionType,
        ...action.actionPayload,
      });

      const resultJson = wasmDispatcher.dispatch(actionJson);
      const result = JSON.parse(resultJson);
      results.push(result);
    }

    return createResponse(
      request.id,
      'success',
      { results, count: actions.length }
    );
  } catch (error) {
    return createResponse(
      request.id,
      'error',
      undefined,
      {
        message: error.message || 'Batch dispatch failed',
        stack: error.stack,
      }
    );
  }
}

/**
 * Handle get state request
 */
function handleGetState(request) {
  try {
    const state = {
      stack: wasmStack ? JSON.parse(wasmStack.getState()) : null,
      space: wasmSpace ? JSON.parse(wasmSpace.getState()) : null,
      source: wasmSource ? JSON.parse(wasmSource.getState()) : null,
      chronicle: wasmChronicle
        ? {
            changeCount: wasmChronicle.changeCount(),
          }
        : null,
    };

    return createResponse(request.id, 'success', state);
  } catch (error) {
    return createResponse(
      request.id,
      'error',
      undefined,
      {
        message: error.message || 'Get state failed',
        stack: error.stack,
      }
    );
  }
}

/**
 * Handle CRDT merge request
 */
function handleMergeState(request) {
  if (!wasmChronicle) {
    return createResponse(
      request.id,
      'error',
      undefined,
      { message: 'Chronicle not initialized' }
    );
  }

  try {
    const { data } = request.payload;
    wasmChronicle.merge(data);

    // Send state changed event
    self.postMessage(createResponse(
      request.id,
      'state_changed',
      {
        chronicle: {
          changeCount: wasmChronicle.changeCount(),
        },
      }
    ));

    return createResponse(request.id, 'success');
  } catch (error) {
    return createResponse(
      request.id,
      'error',
      undefined,
      {
        message: error.message || 'Merge state failed',
        stack: error.stack,
      }
    );
  }
}

/**
 * Handle save snapshot request
 */
function handleSaveSnapshot(request) {
  if (!wasmChronicle) {
    return createResponse(
      request.id,
      'error',
      undefined,
      { message: 'Chronicle not initialized' }
    );
  }

  try {
    const data = wasmChronicle.save();
    return createResponse(request.id, 'success', data);
  } catch (error) {
    return createResponse(
      request.id,
      'error',
      undefined,
      {
        message: error.message || 'Save snapshot failed',
        stack: error.stack,
      }
    );
  }
}

/**
 * Handle load snapshot request
 */
function handleLoadSnapshot(request) {
  if (!wasmChronicle) {
    return createResponse(
      request.id,
      'error',
      undefined,
      { message: 'Chronicle not initialized' }
    );
  }

  try {
    const { data } = request.payload;
    wasmChronicle.load(data);

    // Send state changed event
    self.postMessage(createResponse(
      request.id,
      'state_changed',
      {
        chronicle: {
          changeCount: wasmChronicle.changeCount(),
        },
      }
    ));

    return createResponse(request.id, 'success');
  } catch (error) {
    return createResponse(
      request.id,
      'error',
      undefined,
      {
        message: error.message || 'Load snapshot failed',
        stack: error.stack,
      }
    );
  }
}

/**
 * Handle ping request
 */
function handlePing(request) {
  return createResponse(request.id, 'success', {
    pong: true,
    timestamp: Date.now(),
  });
}

/**
 * Handle shutdown request
 */
function handleShutdown(request) {
  console.log('[Worker] Shutting down...');

  // Clean up WASM instances
  wasmStack = null;
  wasmSpace = null;
  wasmSource = null;
  wasmChronicle = null;
  wasmDispatcher = null;
  wasmModule = null;
  isInitialized = false;

  const response = createResponse(request.id, 'success');

  // Close worker after sending response
  setTimeout(() => {
    self.close();
  }, 100);

  return response;
}

/**
 * Main message handler
 */
self.onmessage = async function(event) {
  const request = event.data;

  // Validate request structure
  if (!request || !request.id || !request.type) {
    console.warn('[Worker] Invalid request:', request);
    return;
  }

  let response;

  try {
    switch (request.type) {
      case 'init':
        await initializeWasm(request.payload?.wasmPath);
        response = createResponse(request.id, 'ready', {
          wasmVersion: wasmModule?.version?.() || '1.0.0',
        });
        break;

      case 'dispatch_action':
        response = handleDispatchAction(request);
        break;

      case 'dispatch_batch':
        response = handleDispatchBatch(request);
        break;

      case 'get_state':
        response = handleGetState(request);
        break;

      case 'merge_state':
        response = handleMergeState(request);
        break;

      case 'save_snapshot':
        response = handleSaveSnapshot(request);
        break;

      case 'load_snapshot':
        response = handleLoadSnapshot(request);
        break;

      case 'ping':
        response = handlePing(request);
        break;

      case 'shutdown':
        response = handleShutdown(request);
        break;

      default:
        response = createResponse(
          request.id,
          'error',
          undefined,
          { message: `Unknown request type: ${request.type}` }
        );
    }
  } catch (error) {
    response = createResponse(
      request.id,
      'error',
      undefined,
      {
        message: error.message || 'Request processing failed',
        stack: error.stack,
      }
    );
  }

  // Send response back to main thread
  self.postMessage(response);
};

/**
 * Handle errors
 */
self.onerror = function(error) {
  console.error('[Worker] Unhandled error:', error);
};

// Signal that worker script has loaded (WASM not initialized yet)
self.postMessage({
  id: 'boot',
  type: 'ready',
  requestId: 'boot',
  timestamp: Date.now(),
  payload: { status: 'worker_loaded' }
});

console.log('[Worker] Script loaded, waiting for init request...');
