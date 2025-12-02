/**
 * WasmWorker.worker: Worker Thread script for WASM execution
 *
 * This file runs in a separate thread and handles all WASM operations.
 * It communicates with the main thread via message passing.
 *
 * Architecture:
 * - Loads WASM module on startup
 * - Maintains WASM state (Stack, Space, Source, Chronicle)
 * - Processes action requests from main thread
 * - Sends state updates back to main thread
 */
import { parentPort } from 'node:worker_threads';
import { loadWasm } from './WasmBridge.js';
import { createResponse, isWorkerRequest } from './WorkerProtocol.js';
// WASM module and instances
let wasm = null;
let wasmStack = null;
let wasmSpace = null;
let wasmSource = null;
let wasmChronicle = null;
let wasmDispatcher = null;
/**
 * Initialize WASM module
 */
async function initializeWasm() {
    try {
        console.log('🔧 Worker: Loading WASM...');
        wasm = await loadWasm();
        // Create instances
        wasmChronicle = new wasm.Chronicle();
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
        console.log('✅ Worker: WASM loaded and initialized');
    }
    catch (error) {
        console.error('❌ Worker: WASM initialization failed:', error);
        throw error;
    }
}
/**
 * Handle action dispatch request
 */
function handleDispatchAction(request) {
    if (!wasmDispatcher) {
        return createResponse(request.id, 'error', undefined, { message: 'WASM not initialized' });
    }
    const { actionType, actionPayload } = request.payload;
    const start = Date.now();
    try {
        // Create action JSON
        const actionJson = JSON.stringify({
            type: actionType,
            ...actionPayload,
        });
        // Dispatch to WASM
        const resultJson = wasmDispatcher.dispatch(actionJson);
        const result = JSON.parse(resultJson);
        const duration = Date.now() - start;
        // Send action completed event
        if (parentPort) {
            const completedEvent = createResponse(request.id, 'action_completed', {
                actionType,
                result,
                duration,
            });
            parentPort.postMessage(completedEvent);
        }
        // Send success response
        return createResponse(request.id, 'success', result);
    }
    catch (error) {
        return createResponse(request.id, 'error', undefined, {
            message: error.message || 'Action dispatch failed',
            stack: error.stack,
        });
    }
}
/**
 * Handle batch action dispatch
 */
function handleDispatchBatch(request) {
    if (!wasmDispatcher) {
        return createResponse(request.id, 'error', undefined, { message: 'WASM not initialized' });
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
        return createResponse(request.id, 'success', { results, count: actions.length });
    }
    catch (error) {
        return createResponse(request.id, 'error', undefined, {
            message: error.message || 'Batch dispatch failed',
            stack: error.stack,
        });
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
    }
    catch (error) {
        return createResponse(request.id, 'error', undefined, {
            message: error.message || 'Get state failed',
            stack: error.stack,
        });
    }
}
/**
 * Handle CRDT merge request
 */
function handleMergeState(request) {
    if (!wasmChronicle) {
        return createResponse(request.id, 'error', undefined, { message: 'Chronicle not initialized' });
    }
    try {
        const { data } = request.payload;
        wasmChronicle.merge(data);
        // Send state changed event
        if (parentPort) {
            const stateChangedEvent = createResponse(request.id, 'state_changed', {
                chronicle: {
                    changeCount: wasmChronicle.changeCount(),
                },
            });
            parentPort.postMessage(stateChangedEvent);
        }
        return createResponse(request.id, 'success');
    }
    catch (error) {
        return createResponse(request.id, 'error', undefined, {
            message: error.message || 'Merge state failed',
            stack: error.stack,
        });
    }
}
/**
 * Handle save snapshot request
 */
function handleSaveSnapshot(request) {
    if (!wasmChronicle) {
        return createResponse(request.id, 'error', undefined, { message: 'Chronicle not initialized' });
    }
    try {
        const data = wasmChronicle.save();
        return createResponse(request.id, 'success', data);
    }
    catch (error) {
        return createResponse(request.id, 'error', undefined, {
            message: error.message || 'Save snapshot failed',
            stack: error.stack,
        });
    }
}
/**
 * Handle load snapshot request
 */
function handleLoadSnapshot(request) {
    if (!wasmChronicle) {
        return createResponse(request.id, 'error', undefined, { message: 'Chronicle not initialized' });
    }
    try {
        const { data } = request.payload;
        wasmChronicle.load(data);
        // Send state changed event
        if (parentPort) {
            const stateChangedEvent = createResponse(request.id, 'state_changed', {
                chronicle: {
                    changeCount: wasmChronicle.changeCount(),
                },
            });
            parentPort.postMessage(stateChangedEvent);
        }
        return createResponse(request.id, 'success');
    }
    catch (error) {
        return createResponse(request.id, 'error', undefined, {
            message: error.message || 'Load snapshot failed',
            stack: error.stack,
        });
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
    console.log('🔌 Worker: Shutting down...');
    // Clean up WASM instances
    wasmStack = null;
    wasmSpace = null;
    wasmSource = null;
    wasmChronicle = null;
    wasmDispatcher = null;
    wasm = null;
    const response = createResponse(request.id, 'success');
    // Exit after sending response
    setTimeout(() => {
        process.exit(0);
    }, 100);
    return response;
}
/**
 * Main message handler
 */
function handleMessage(message) {
    if (!isWorkerRequest(message)) {
        console.warn('Worker: Invalid message:', message);
        return;
    }
    const request = message;
    let response;
    // Route to appropriate handler
    switch (request.type) {
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
            response = createResponse(request.id, 'error', undefined, {
                message: `Unknown request type: ${request.type}`,
            });
    }
    // Send response
    if (parentPort) {
        parentPort.postMessage(response);
    }
}
/**
 * Worker initialization
 */
async function main() {
    if (!parentPort) {
        console.error('Worker: parentPort not available');
        process.exit(1);
    }
    try {
        // Initialize WASM
        await initializeWasm();
        // Set up message handler
        parentPort.on('message', handleMessage);
        // Send ready signal
        const readyResponse = createResponse('init', 'ready', {
            wasmVersion: wasm?.version() || 'unknown',
        });
        parentPort.postMessage(readyResponse);
        console.log('✅ Worker: Ready and listening for messages');
    }
    catch (error) {
        console.error('Worker initialization failed:', error);
        process.exit(1);
    }
}
// Start the worker
main().catch((error) => {
    console.error('Worker fatal error:', error);
    process.exit(1);
});
