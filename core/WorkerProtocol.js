/**
 * WorkerProtocol: Message-passing protocol for WASM Worker communication
 *
 * Defines the contract between main thread (Engine) and worker thread (WASM Core)
 *
 * Architecture:
 * - Main Thread: Engine.ts sends actions, receives state updates
 * - Worker Thread: Executes WASM operations, sends results back
 * - Async: All operations return Promises that resolve when worker responds
 */
/**
 * Message types sent from main thread → worker
 */
export var WorkerRequestType;
(function (WorkerRequestType) {
    // Initialization
    WorkerRequestType["INIT"] = "init";
    WorkerRequestType["LOAD_WASM"] = "load_wasm";
    // Action dispatch
    WorkerRequestType["DISPATCH_ACTION"] = "dispatch_action";
    WorkerRequestType["DISPATCH_BATCH"] = "dispatch_batch";
    // State queries
    WorkerRequestType["GET_STATE"] = "get_state";
    WorkerRequestType["GET_STACK_STATE"] = "get_stack_state";
    WorkerRequestType["GET_SPACE_STATE"] = "get_space_state";
    WorkerRequestType["GET_SOURCE_STATE"] = "get_source_state";
    // CRDT operations
    WorkerRequestType["MERGE_STATE"] = "merge_state";
    WorkerRequestType["SAVE_SNAPSHOT"] = "save_snapshot";
    WorkerRequestType["LOAD_SNAPSHOT"] = "load_snapshot";
    // Worker management
    WorkerRequestType["SHUTDOWN"] = "shutdown";
    WorkerRequestType["PING"] = "ping";
})(WorkerRequestType || (WorkerRequestType = {}));
/**
 * Message types sent from worker → main thread
 */
export var WorkerResponseType;
(function (WorkerResponseType) {
    // Response to requests
    WorkerResponseType["SUCCESS"] = "success";
    WorkerResponseType["ERROR"] = "error";
    // Proactive updates
    WorkerResponseType["STATE_CHANGED"] = "state_changed";
    WorkerResponseType["ACTION_COMPLETED"] = "action_completed";
    // Worker status
    WorkerResponseType["READY"] = "ready";
    WorkerResponseType["PONG"] = "pong";
})(WorkerResponseType || (WorkerResponseType = {}));
/**
 * Generate unique message ID
 */
export function generateMessageId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
/**
 * Create a request message
 */
export function createRequest(type, payload) {
    return {
        id: generateMessageId(),
        type,
        timestamp: Date.now(),
        payload,
    };
}
/**
 * Create a response message
 */
export function createResponse(requestId, type, payload, error) {
    return {
        id: generateMessageId(),
        type,
        requestId,
        timestamp: Date.now(),
        payload,
        error,
    };
}
/**
 * Type guards for message validation
 */
export function isWorkerRequest(msg) {
    return (msg &&
        typeof msg === 'object' &&
        'id' in msg &&
        'type' in msg &&
        'timestamp' in msg &&
        Object.values(WorkerRequestType).includes(msg.type));
}
export function isWorkerResponse(msg) {
    return (msg &&
        typeof msg === 'object' &&
        'id' in msg &&
        'type' in msg &&
        'requestId' in msg &&
        'timestamp' in msg &&
        Object.values(WorkerResponseType).includes(msg.type));
}
