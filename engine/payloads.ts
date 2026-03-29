/**
 * engine/payloads.ts
 * Per-action payload types for the HyperToken action registry.
 */
import type { IToken } from "../core/types.js";
import type { Stack } from "../core/Stack.js";

// ─── Stack ───────────────────────────────────────────────────────────────────
export interface StackDrawPayload     { count?: number }
export interface StackPeekPayload     { count?: number }
export interface StackShufflePayload  { seed?: number | string | null }
export interface StackBurnPayload     { count?: number }
export interface StackCutPayload      { position?: number }
export interface StackInsertAtPayload { position?: number; card: IToken }
export interface StackRemoveAtPayload { position?: number }
export interface StackSwapPayload     { i: number; j: number }
export interface StackDiscardPayload  { card: IToken }

// ─── Space ───────────────────────────────────────────────────────────────────
export interface SpacePlacePayload        { zone: string; card: IToken; opts?: Record<string, unknown> }
export interface SpaceRemovePayload       { zone: string; placementId: string }
export interface SpaceMovePayload         { fromZone: string; toZone: string; placementId: string; x?: number; y?: number }
export interface SpaceFlipPayload         { zone: string; placementId: string; faceUp?: boolean }
export interface SpaceCreateZonePayload   { name: string; label?: string; x?: number; y?: number }
export interface SpaceDeleteZonePayload   { name: string }
export interface SpaceClearZonePayload    { zone: string }
export interface SpaceLockZonePayload     { zone: string; locked?: boolean }
export interface SpaceShuffleZonePayload  { zone: string; seed?: number }
export interface SpaceFanZonePayload      { zone: string; [key: string]: unknown }
export interface SpaceSpreadZonePayload   { zone: string; pattern?: string; angleStep?: number; radius?: number }
export interface SpaceStackZonePayload    { zone: string }
export interface SpaceTransferZonePayload { fromZone: string; toZone: string }

// ─── Source ──────────────────────────────────────────────────────────────────
export interface SourceDrawPayload        { count?: number }
export interface SourceShufflePayload     { seed?: number }
export interface SourceBurnPayload        { count?: number }
export interface SourceAddStackPayload    { stack: Stack }
export interface SourceRemoveStackPayload { stack: Stack }

// ─── Agent ───────────────────────────────────────────────────────────────────
export interface AgentCreatePayload           { id?: string; name: string; meta?: Record<string, unknown> }
export interface AgentRemovePayload           { name: string }
export interface AgentSetActivePayload        { name: string; active?: boolean }
export interface AgentGiveResourcePayload     { name: string; resource: string; amount?: number }
export interface AgentTakeResourcePayload     { name: string; resource: string; amount?: number }
export interface AgentAddTokenPayload         { name: string; token: IToken }
export interface AgentRemoveTokenPayload      { name: string; tokenId: string }
export interface AgentGetPayload              { name: string }
export interface AgentTransferResourcePayload { from: string; to: string; resource: string; amount?: number }
export interface AgentTransferTokenPayload    { from: string; to: string; tokenId: string }
export interface AgentStealResourcePayload    { from: string; to: string; resource: string; amount?: number }
export interface AgentStealTokenPayload       { from: string; to: string; tokenId: string }
export interface TradeOffer                   { token?: IToken; resource?: string; amount?: number }
export interface AgentTradePayload            { agent1: string; agent2: string; offer1?: TradeOffer; offer2?: TradeOffer }
export interface AgentDrawCardsPayload        { name: string; count?: number }
export interface AgentDiscardCardsPayload     { name: string; tokenIds: string[] }
export interface AgentSetMetaPayload          { name: string; key: string; value: unknown }

// ─── Game ────────────────────────────────────────────────────────────────────
export interface GameEndPayload         { winner?: string; reason?: string }
export interface GameNextPhasePayload   { phase: string }
export interface GameSetPropertyPayload { key: string; value: unknown }
export interface GameMergeStatePayload  { state: Record<string, unknown> }

// ─── GameLoop ────────────────────────────────────────────────────────────────
export interface GameLoopInitPayload       { maxTurns?: number }
export interface GameLoopStopPayload       { phase?: string }
export interface GameNextTurnPayload       { agentCount?: number }
export interface GameSetPhasePayload       { phase: string }
export interface GameSetMaxTurnsPayload    { maxTurns: number }
export interface GameSetActiveAgentPayload { index: number }

// ─── Rule ────────────────────────────────────────────────────────────────────
export interface RuleMarkFiredPayload { name: string; timestamp?: number }

// ─── Token ───────────────────────────────────────────────────────────────────
export interface TokenTransformPayload { token: IToken; properties?: Record<string, unknown> }
export interface TokenAttachPayload    { host: IToken; attachment: IToken; attachmentType?: string }
export interface TokenDetachPayload    { host: IToken; attachmentId: string }
export interface TokenMergePayload     { tokens: IToken[]; properties?: Record<string, unknown>; keepOriginals?: boolean }
export interface TokenSplitPayload     { token: IToken; count?: number; propertiesArray?: Array<Record<string, unknown>> }

// ─── Debug ───────────────────────────────────────────────────────────────────
export interface DebugLogPayload { [key: string]: unknown }
