/*
 * core/types.ts
 */

export type TokenId = string;

export interface TokenMeta {
  [key: string]: any;
}

export interface IToken {
  id: TokenId;
  label: string | null;
  group: string | null;
  text: string;
  meta: TokenMeta;
  char: string;
  kind: string;
  index: number;
  
  _rev?: boolean;
  _tags?: Set<string>;
  _attachments?: any[]; 
  _attachedTo?: string;
  _attachmentType?: string;

  _merged?: boolean;
  _mergedInto?: string;
  _mergedFrom?: string[];
  _mergedAt?: number;
  _split?: boolean;
  _splitInto?: string[];
  _splitFrom?: string;
  _splitIndex?: number;
  _splitAt?: number;
}

export interface ReversalPolicy {
  enabled: boolean;
  chance: number;
  jitter: number;
}

export interface IActionPayload {
  [key: string]: any;
}

export interface IAction {
  type: string;
  payload: IActionPayload;
  seed?: number | null;
  reversible?: boolean;
  timestamp?: number;
}

export interface IPlacementCRDT {
  id: string;
  tokenId: string;
  tokenSnapshot: IToken;
  x: number | null;
  y: number | null;
  faceUp: boolean;
  label: string | null;
  ts: number;
  reversed: boolean;
  tags: string[];
}

export interface IStackState {
  stack: IToken[];
  drawn: IToken[];
  discards: IToken[];
}

export interface ReshufflePolicy {
  threshold: number | null;
  mode: "auto" | "manual";
}

export interface ISourceState {
  stackIds: string[];
  tokens: IToken[];
  burned: IToken[];
  seed: number | null;
  reshufflePolicy: ReshufflePolicy;
}

export interface IGameLoopState {
  turn: number;
  running: boolean;
  activeAgentIndex: number;
  phase: string;
  maxTurns: number;
}

// Rule State
export interface IRuleState {
  fired: Record<string, number>; // Maps RuleName -> Timestamp
}

export interface HyperTokenState {
  zones?: Record<string, IPlacementCRDT[]>;
  stack?: IStackState;
  source?: ISourceState;
  gameLoop?: IGameLoopState;
  rules?: IRuleState;
  agents?: Record<string, unknown>;
  version?: string;
  nullifiers?: Record<string, number>; // Map<NullifierHash, Timestamp>
  [key: string]: unknown;
}