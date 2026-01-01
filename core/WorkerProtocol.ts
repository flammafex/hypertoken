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
export enum WorkerRequestType {
  // Initialization
  INIT = 'init',
  LOAD_WASM = 'load_wasm',

  // Action dispatch
  DISPATCH_ACTION = 'dispatch_action',
  DISPATCH_BATCH = 'dispatch_batch',

  // State queries
  GET_STATE = 'get_state',
  GET_STACK_STATE = 'get_stack_state',
  GET_SPACE_STATE = 'get_space_state',
  GET_SOURCE_STATE = 'get_source_state',

  // CRDT operations
  MERGE_STATE = 'merge_state',
  SAVE_SNAPSHOT = 'save_snapshot',
  LOAD_SNAPSHOT = 'load_snapshot',

  // Worker management
  SHUTDOWN = 'shutdown',
  PING = 'ping',
}

/**
 * Message types sent from worker → main thread
 */
export enum WorkerResponseType {
  // Response to requests
  SUCCESS = 'success',
  ERROR = 'error',

  // Proactive updates
  STATE_CHANGED = 'state_changed',
  ACTION_COMPLETED = 'action_completed',

  // Worker status
  READY = 'ready',
  PONG = 'pong',
}

/**
 * Base message structure
 */
export interface WorkerMessage {
  id: string; // Unique message ID for request/response matching
  type: WorkerRequestType | WorkerResponseType;
  timestamp: number;
}

/**
 * Request message from main → worker
 */
export interface WorkerRequest extends WorkerMessage {
  type: WorkerRequestType;
  payload?: any;
}

/**
 * Response message from worker → main
 */
export interface WorkerResponse extends WorkerMessage {
  type: WorkerResponseType;
  requestId: string; // ID of the request this responds to
  payload?: any;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Action dispatch request
 */
export interface DispatchActionRequest extends WorkerRequest {
  type: WorkerRequestType.DISPATCH_ACTION;
  payload: {
    actionType: string;
    actionPayload: any;
    opts?: {
      skipStateUpdate?: boolean; // Don't send state_changed event
    };
  };
}

/**
 * Batch action dispatch request
 */
export interface DispatchBatchRequest extends WorkerRequest {
  type: WorkerRequestType.DISPATCH_BATCH;
  payload: {
    actions: Array<{
      actionType: string;
      actionPayload: any;
    }>;
    opts?: {
      skipStateUpdate?: boolean;
    };
  };
}

/**
 * Action completion notification
 */
export interface ActionCompletedResponse extends WorkerResponse {
  type: WorkerResponseType.ACTION_COMPLETED;
  payload: {
    actionType: string;
    result: any;
    duration: number; // Execution time in ms
  };
}

/**
 * State change notification
 */
export interface StateChangedResponse extends WorkerResponse {
  type: WorkerResponseType.STATE_CHANGED;
  payload: {
    stack?: any;
    space?: any;
    source?: any;
    chronicle?: {
      changeCount: number;
      data?: Uint8Array; // Binary CRDT data
    };
  };
}

/**
 * CRDT merge request
 */
export interface MergeStateRequest extends WorkerRequest {
  type: WorkerRequestType.MERGE_STATE;
  payload: {
    data: Uint8Array; // Binary CRDT data from remote peer
  };
}

/**
 * Generate unique message ID
 */
export function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a request message
 */
export function createRequest(
  type: WorkerRequestType,
  payload?: any
): WorkerRequest {
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
export function createResponse(
  requestId: string,
  type: WorkerResponseType,
  payload?: any,
  error?: WorkerResponse['error']
): WorkerResponse {
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
export function isWorkerRequest(msg: any): msg is WorkerRequest {
  return (
    msg &&
    typeof msg === 'object' &&
    'id' in msg &&
    'type' in msg &&
    'timestamp' in msg &&
    Object.values(WorkerRequestType).includes(msg.type)
  );
}

export function isWorkerResponse(msg: any): msg is WorkerResponse {
  return (
    msg &&
    typeof msg === 'object' &&
    'id' in msg &&
    'type' in msg &&
    'requestId' in msg &&
    'timestamp' in msg &&
    Object.values(WorkerResponseType).includes(msg.type)
  );
}
