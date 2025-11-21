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
  
  // Runtime properties
  _rev?: boolean;
  _tags?: Set<string>;
  _attachments?: any[]; 
  _attachedTo?: string;
  _attachmentType?: string;

  // Merge/Split tracking (Added for future action compatibility)
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

// Added: Needed for Deck.ts
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