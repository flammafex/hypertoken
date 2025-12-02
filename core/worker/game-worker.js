/**
 * Game Worker - Worker thread for parallel game simulations
 *
 * Phase 3A: Node.js Worker Threads
 *
 * This worker handles:
 * - Parallel game simulations
 * - Chronicle CRDT operations
 * - Stack/Space operations
 * - Batch processing
 */
import { parentPort } from 'worker_threads';
import { Chronicle } from '../ChronicleWasm.js';
import { SpaceWasm } from '../SpaceWasm.js';
import { StackWasm } from '../StackWasm.js';
/**
 * Handle incoming messages from main thread
 */
if (parentPort) {
    parentPort.on('message', async (message) => {
        try {
            let result;
            switch (message.type) {
                case 'simulate-game':
                    result = await simulateGame(message.data);
                    break;
                case 'merge-chronicles':
                    result = await mergeChronicles(message.data);
                    break;
                case 'batch-stack-operations':
                    result = await batchStackOperations(message.data);
                    break;
                case 'batch-space-operations':
                    result = await batchSpaceOperations(message.data);
                    break;
                default:
                    throw new Error(`Unknown task type: ${message.type}`);
            }
            // Send result back
            parentPort.postMessage({
                type: 'result',
                taskId: message.taskId,
                data: result,
            });
        }
        catch (error) {
            // Send error back
            parentPort.postMessage({
                type: 'error',
                taskId: message.taskId,
                error: error.message,
            });
        }
    });
}
/**
 * Simulate a complete game
 */
async function simulateGame(config) {
    const startTime = Date.now();
    // Create Chronicle instance
    const chronicle = new Chronicle();
    // Load initial state if provided
    if (config.initialState) {
        chronicle.loadFromBase64(config.initialState);
    }
    // Initialize with tokens if provided
    if (config.tokens) {
        new StackWasm(chronicle, config.tokens);
    }
    const metrics = {
        totalActions: 0,
        successfulActions: 0,
        failedActions: 0,
    };
    // Execute simulation turns
    for (let turn = 0; turn < config.turns; turn++) {
        if (config.actions && config.actions.length > 0) {
            // Execute predefined actions
            for (const action of config.actions) {
                try {
                    await executeAction(chronicle, action);
                    metrics.successfulActions++;
                }
                catch (error) {
                    metrics.failedActions++;
                }
                metrics.totalActions++;
            }
        }
        else {
            // Execute default simulation logic
            try {
                await executeDefaultTurn(chronicle, turn, config.seed);
                metrics.successfulActions++;
            }
            catch (error) {
                metrics.failedActions++;
            }
            metrics.totalActions++;
        }
    }
    const executionTime = Date.now() - startTime;
    return {
        finalState: chronicle.saveToBase64(),
        turnsExecuted: config.turns,
        executionTime,
        metrics,
    };
}
/**
 * Execute a single action on Chronicle
 */
async function executeAction(chronicle, action) {
    const { type, ...params } = action;
    switch (type) {
        case 'stack:draw':
            {
                const stack = new StackWasm(chronicle);
                stack.draw(params.count || 1);
            }
            break;
        case 'stack:shuffle':
            {
                const stack = new StackWasm(chronicle);
                stack.shuffle(params.seed);
            }
            break;
        case 'space:place':
            {
                const space = new SpaceWasm(chronicle);
                if (!space.hasZone(params.zone)) {
                    space.createZone(params.zone);
                }
                space.place(params.zone, params.token, { x: params.x, y: params.y });
            }
            break;
        case 'space:move':
            {
                const space = new SpaceWasm(chronicle);
                space.move(params.fromZone, params.toZone, params.placementId, { x: params.x, y: params.y });
            }
            break;
        default:
            throw new Error(`Unknown action type: ${type}`);
    }
}
/**
 * Execute default turn logic (for simple simulations)
 */
async function executeDefaultTurn(chronicle, turn, seed) {
    const stack = new StackWasm(chronicle);
    // Every 5 turns, shuffle
    if (turn % 5 === 0 && stack.size > 0) {
        const shuffleSeed = seed ? (typeof seed === 'string' ? parseInt(seed) + turn : seed + turn) : turn;
        stack.shuffle(shuffleSeed);
    }
    // Draw a card if stack has cards
    if (stack.size > 0) {
        stack.draw(1);
    }
    // Every 10 turns, reset
    if (turn % 10 === 9) {
        stack.reset();
    }
}
/**
 * Merge multiple Chronicle documents
 */
async function mergeChronicles(task) {
    const chronicle = new Chronicle();
    // Load base document
    if (task.baseDoc) {
        chronicle.loadFromBase64(task.baseDoc);
    }
    // Merge each document
    for (const docBase64 of task.docsToMerge) {
        // Create temporary chronicle to load document
        const tempChronicle = new Chronicle();
        tempChronicle.loadFromBase64(docBase64);
        // Merge the document state
        chronicle.merge(tempChronicle.state);
    }
    // Return merged document
    return chronicle.saveToBase64();
}
/**
 * Execute batch Stack operations
 */
async function batchStackOperations(operations) {
    const results = [];
    for (const op of operations) {
        const chronicle = new Chronicle();
        const stack = new StackWasm(chronicle);
        // Load initial state if provided
        if (op.stackState) {
            chronicle.loadFromBase64(op.stackState);
        }
        // Execute operation
        let result = '';
        switch (op.operation) {
            case 'draw':
                result = JSON.stringify(stack.draw(op.params.count || 1));
                break;
            case 'shuffle':
                stack.shuffle(op.params.seed);
                result = JSON.stringify({ shuffled: true });
                break;
            case 'burn':
                result = JSON.stringify(stack.burn(op.params.count || 1));
                break;
            case 'discard':
                stack.discard(op.params.count || 1);
                result = JSON.stringify({ discarded: op.params.count || 1 });
                break;
            default:
                throw new Error(`Unknown stack operation: ${op.operation}`);
        }
        results.push(result);
    }
    return results;
}
/**
 * Execute batch Space operations
 */
async function batchSpaceOperations(operations) {
    const results = [];
    for (const op of operations) {
        const chronicle = new Chronicle();
        const space = new SpaceWasm(chronicle);
        // Load initial state if provided
        if (op.spaceState) {
            chronicle.loadFromBase64(op.spaceState);
        }
        // Execute operation
        let result = '';
        switch (op.operation) {
            case 'place':
                if (!space.hasZone(op.params.zone)) {
                    space.createZone(op.params.zone);
                }
                const placement = space.place(op.params.zone, op.params.token, op.params.x !== undefined ? { x: op.params.x, y: op.params.y } : undefined);
                result = JSON.stringify(placement);
                break;
            case 'move':
                space.move(op.params.fromZone, op.params.toZone, op.params.placementId, { x: op.params.x, y: op.params.y });
                result = JSON.stringify({ moved: true });
                break;
            case 'remove':
                space.remove(op.params.zone, op.params.placementId);
                result = JSON.stringify({ removed: true });
                break;
            case 'flip':
                space.flip(op.params.zone, op.params.placementId, op.params.faceUp);
                result = JSON.stringify({ flipped: true });
                break;
            default:
                throw new Error(`Unknown space operation: ${op.operation}`);
        }
        results.push(result);
    }
    return results;
}
/**
 * Log message back to main thread
 */
function log(message) {
    if (parentPort) {
        parentPort.postMessage({
            type: 'log',
            taskId: 'log',
            data: message,
        });
    }
}
