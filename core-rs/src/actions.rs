// Action dispatch system for HyperToken Core
//
// This module provides ActionDispatcher, a thin facade that delegates all
// CRDT-mutating operations to Chronicle (Automerge-backed incremental CRDT)
// and keeps TokenOps and BatchOps as direct stateless delegates.

use wasm_bindgen::prelude::*;

use crate::chronicle::Chronicle;
use crate::token_ops::TokenOps;
use crate::batch::BatchOps;
use crate::types::{HyperTokenError, Result};

/// Unified action dispatcher for HyperToken operations
///
/// All CRDT-mutating operations delegate to `chronicle`.
/// Stateless operations (token transforms, batch queries) delegate to
/// `token_ops` and `batch_ops` respectively.
#[wasm_bindgen]
pub struct ActionDispatcher {
    chronicle: Chronicle,
    token_ops: TokenOps,
    batch_ops: BatchOps,
}

#[wasm_bindgen]
impl ActionDispatcher {
    /// Create a new ActionDispatcher
    #[wasm_bindgen(constructor)]
    pub fn new() -> ActionDispatcher {
        ActionDispatcher {
            chronicle: Chronicle::new(),
            token_ops: TokenOps::new(),
            batch_ops: BatchOps::new(),
        }
    }

    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STATE MANAGEMENT
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /// Initialize the full CRDT state from JSON
    #[wasm_bindgen(js_name = initializeState)]
    pub fn initialize_state(&mut self, state_json: &str) -> Result<()> {
        self.chronicle.set_state(state_json)
    }

    /// Get the full CRDT state as JSON
    #[wasm_bindgen(js_name = getState)]
    pub fn get_state(&self) -> Result<String> {
        self.chronicle.get_state()
    }

    /// Get dirty section flags as JSON
    #[wasm_bindgen(js_name = getDirty)]
    pub fn get_dirty(&self) -> String {
        self.chronicle.get_dirty()
    }

    /// Clear all dirty flags
    #[wasm_bindgen(js_name = clearDirty)]
    pub fn clear_dirty(&mut self) {
        self.chronicle.clear_dirty()
    }

    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEMPORARY NO-OPS (removed when Engine.ts migrates to Chronicle)
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /// Set the stack instance (no-op: state now lives in Chronicle)
    #[wasm_bindgen(js_name = setStack)]
    pub fn set_stack(&mut self, _json: &str) -> Result<()> { Ok(()) }

    /// Set the space instance (no-op: state now lives in Chronicle)
    #[wasm_bindgen(js_name = setSpace)]
    pub fn set_space(&mut self, _json: &str) -> Result<()> { Ok(()) }

    /// Set the source instance (no-op: state now lives in Chronicle)
    #[wasm_bindgen(js_name = setSource)]
    pub fn set_source(&mut self, _json: &str) -> Result<()> { Ok(()) }

    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STACK ACTIONS (delegates to chronicle)
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /// Draw cards from stack
    #[wasm_bindgen(js_name = stackDraw)]
    pub fn stack_draw(&mut self, count: usize) -> Result<String> {
        self.chronicle.stack_draw(count)
    }

    /// Shuffle stack with optional seed
    #[wasm_bindgen(js_name = stackShuffle)]
    pub fn stack_shuffle(&mut self, seed: Option<String>) -> Result<()> {
        self.chronicle.stack_shuffle(seed)
    }

    /// Burn cards from stack
    #[wasm_bindgen(js_name = stackBurn)]
    pub fn stack_burn(&mut self, count: usize) -> Result<String> {
        self.chronicle.stack_burn(count)
    }

    /// Reset stack to initial state
    #[wasm_bindgen(js_name = stackReset)]
    pub fn stack_reset(&mut self) -> Result<()> {
        self.chronicle.stack_reset()
    }

    /// Cut stack at index
    #[wasm_bindgen(js_name = stackCut)]
    pub fn stack_cut(&mut self, index: usize) -> Result<()> {
        self.chronicle.stack_cut(index)
    }

    /// Discard a token by ID (moves from drawn to discards)
    #[wasm_bindgen(js_name = stackDiscard)]
    pub fn stack_discard(&mut self, token_id: &str) -> Result<String> {
        self.chronicle.stack_discard(token_id)
    }

    /// Insert token at index
    #[wasm_bindgen(js_name = stackInsertAt)]
    pub fn stack_insert_at(&mut self, index: usize, token_json: &str) -> Result<()> {
        self.chronicle.stack_insert_at(index, token_json)
    }

    /// Remove token at index
    #[wasm_bindgen(js_name = stackRemoveAt)]
    pub fn stack_remove_at(&mut self, index: usize) -> Result<String> {
        self.chronicle.stack_remove_at(index)
    }

    /// Swap two tokens by index
    #[wasm_bindgen(js_name = stackSwap)]
    pub fn stack_swap(&mut self, index_a: usize, index_b: usize) -> Result<()> {
        self.chronicle.stack_swap(index_a, index_b)
    }

    /// Reverse the stack
    #[wasm_bindgen(js_name = stackReverse)]
    pub fn stack_reverse(&mut self) -> Result<()> {
        self.chronicle.stack_reverse()
    }

    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SPACE ACTIONS (delegates to chronicle)
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /// Place token in zone
    #[wasm_bindgen(js_name = spacePlace)]
    pub fn space_place(&mut self, zone: &str, token_json: &str, x: Option<f64>, y: Option<f64>) -> Result<String> {
        self.chronicle.space_place(zone, token_json, x, y)
    }

    /// Remove token from zone
    #[wasm_bindgen(js_name = spaceRemove)]
    pub fn space_remove(&mut self, zone: &str, token_id: &str) -> Result<String> {
        self.chronicle.space_remove(zone, token_id)
    }

    /// Move token between zones
    #[wasm_bindgen(js_name = spaceMove)]
    pub fn space_move(&mut self, token_id: &str, from_zone: &str, to_zone: &str, _x: Option<f64>, _y: Option<f64>) -> Result<()> {
        self.chronicle.space_move(token_id, from_zone, to_zone)
    }

    /// Flip token in zone
    #[wasm_bindgen(js_name = spaceFlip)]
    pub fn space_flip(&mut self, zone: &str, token_id: &str) -> Result<()> {
        self.chronicle.space_flip(zone, token_id)
    }

    /// Create new zone
    #[wasm_bindgen(js_name = spaceCreateZone)]
    pub fn space_create_zone(&mut self, name: &str) -> Result<()> {
        self.chronicle.space_create_zone(name)
    }

    /// Delete zone
    #[wasm_bindgen(js_name = spaceDeleteZone)]
    pub fn space_delete_zone(&mut self, name: &str) -> Result<()> {
        self.chronicle.space_delete_zone(name)
    }

    /// Clear all tokens from zone
    #[wasm_bindgen(js_name = spaceClearZone)]
    pub fn space_clear_zone(&mut self, name: &str) -> Result<()> {
        self.chronicle.space_clear_zone(name)
    }

    /// Lock or unlock zone
    #[wasm_bindgen(js_name = spaceLockZone)]
    pub fn space_lock_zone(&mut self, name: &str, locked: bool) -> Result<()> {
        self.chronicle.space_lock_zone(name, locked)
    }

    /// Shuffle tokens in zone
    #[wasm_bindgen(js_name = spaceShuffleZone)]
    pub fn space_shuffle_zone(&mut self, name: &str, seed: Option<String>) -> Result<()> {
        self.chronicle.space_shuffle_zone(name, seed)
    }

    /// Transfer all tokens from one zone to another
    #[wasm_bindgen(js_name = spaceTransferZone)]
    pub fn space_transfer_zone(&mut self, from_zone: &str, to_zone: &str) -> Result<()> {
        self.chronicle.space_transfer_zone(from_zone, to_zone)
    }

    /// Clear all zones
    #[wasm_bindgen(js_name = spaceClear)]
    pub fn space_clear(&mut self) -> Result<()> {
        self.chronicle.space_clear()
    }

    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SOURCE ACTIONS (delegates to chronicle)
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /// Draw from source
    #[wasm_bindgen(js_name = sourceDraw)]
    pub fn source_draw(&mut self, count: usize) -> Result<String> {
        self.chronicle.source_draw(count)
    }

    /// Shuffle source
    #[wasm_bindgen(js_name = sourceShuffle)]
    pub fn source_shuffle(&mut self, seed: Option<String>) -> Result<()> {
        self.chronicle.source_shuffle(seed)
    }

    /// Burn from source
    #[wasm_bindgen(js_name = sourceBurn)]
    pub fn source_burn(&mut self, count: usize) -> Result<String> {
        self.chronicle.source_burn(count)
    }

    /// Add a stack to the source
    #[wasm_bindgen(js_name = sourceAddStack)]
    pub fn source_add_stack(&mut self, stack_json: &str, stack_id: Option<String>) -> Result<()> {
        // Parse the input JSON to extract tokens (same logic as old dispatcher)
        let input: serde_json::Value = serde_json::from_str(stack_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        // Extract tokens: support both direct array or StackState object
        let tokens_vec = if let Some(arr) = input.as_array() {
            arr
        } else if let Some(stack_obj) = input.get("stack") {
            if let Some(inner_arr) = stack_obj.as_array() {
                inner_arr
            } else if let Some(nested_stack) = stack_obj.get("stack") {
                nested_stack.as_array()
                    .ok_or_else(|| HyperTokenError::InvalidOperation("Nested 'stack' field is not an array".to_string()))?
            } else {
                return Err(HyperTokenError::InvalidOperation("Invalid stack format: missing token array".to_string()));
            }
        } else {
            return Err(HyperTokenError::InvalidOperation("Could not find tokens in payload".to_string()));
        };

        let tokens_str = serde_json::to_string(tokens_vec)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        let id = stack_id.unwrap_or_else(|| format!("stack-{}", crate::utils::generate_id()));

        self.chronicle.source_add_stack(&tokens_str, &id)
    }

    /// Remove a stack from the source
    #[wasm_bindgen(js_name = sourceRemoveStack)]
    pub fn source_remove_stack(&mut self, stack_id: &str) -> Result<()> {
        self.chronicle.source_remove_stack(stack_id)
    }

    /// Reset the source
    #[wasm_bindgen(js_name = sourceReset)]
    pub fn source_reset(&mut self, tokens_json: Option<String>) -> Result<()> {
        if let Some(json) = tokens_json {
            self.chronicle.source_reset(&json)
        } else {
            // No tokens provided: reset with empty array
            self.chronicle.source_reset("[]")
        }
    }

    /// Set source reshuffle policy
    #[wasm_bindgen(js_name = sourceSetReshufflePolicy)]
    pub fn source_set_reshuffle_policy(&mut self, threshold: i32, mode: &str) -> Result<()> {
        self.chronicle.source_set_reshuffle_policy(threshold, mode)
    }

    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // AGENT ACTIONS (delegates to chronicle)
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /// Create an agent
    #[wasm_bindgen(js_name = agentCreate)]
    pub fn agent_create(&mut self, id: &str, name: &str, meta_json: Option<String>) -> Result<String> {
        self.chronicle.agent_create(id, name, meta_json.as_deref())
    }

    /// Remove an agent
    #[wasm_bindgen(js_name = agentRemove)]
    pub fn agent_remove(&mut self, name: &str) -> Result<()> {
        self.chronicle.agent_remove(name)
    }

    /// Set agent active state
    #[wasm_bindgen(js_name = agentSetActive)]
    pub fn agent_set_active(&mut self, name: &str, active: bool) -> Result<()> {
        self.chronicle.agent_set_active(name, active)
    }

    /// Give resource to agent
    #[wasm_bindgen(js_name = agentGiveResource)]
    pub fn agent_give_resource(&mut self, name: &str, resource: &str, amount: f64) -> Result<()> {
        self.chronicle.agent_give_resource(name, resource, amount)
    }

    /// Take resource from agent
    #[wasm_bindgen(js_name = agentTakeResource)]
    pub fn agent_take_resource(&mut self, name: &str, resource: &str, amount: f64) -> Result<()> {
        self.chronicle.agent_take_resource(name, resource, amount)
    }

    /// Add token to agent's inventory
    #[wasm_bindgen(js_name = agentAddToken)]
    pub fn agent_add_token(&mut self, name: &str, token_json: &str) -> Result<()> {
        self.chronicle.agent_add_token(name, token_json)
    }

    /// Remove token from agent's inventory
    #[wasm_bindgen(js_name = agentRemoveToken)]
    pub fn agent_remove_token(&mut self, name: &str, token_id: &str) -> Result<String> {
        self.chronicle.agent_remove_token(name, token_id)
    }

    /// Transfer resource between agents
    #[wasm_bindgen(js_name = agentTransferResource)]
    pub fn agent_transfer_resource(
        &mut self,
        from: &str,
        to: &str,
        resource: &str,
        amount: f64,
    ) -> Result<()> {
        self.chronicle.agent_transfer_resource(from, to, resource, amount)
    }

    /// Transfer token between agents
    #[wasm_bindgen(js_name = agentTransferToken)]
    pub fn agent_transfer_token(
        &mut self,
        from: &str,
        to: &str,
        token_id: &str,
    ) -> Result<()> {
        self.chronicle.agent_transfer_token(from, to, token_id)
    }

    /// Steal resource from another agent
    #[wasm_bindgen(js_name = agentStealResource)]
    pub fn agent_steal_resource(
        &mut self,
        from: &str,
        to: &str,
        resource: &str,
        amount: f64,
    ) -> Result<()> {
        self.chronicle.agent_steal_resource(from, to, resource, amount)
    }

    /// Steal token from another agent
    #[wasm_bindgen(js_name = agentStealToken)]
    pub fn agent_steal_token(
        &mut self,
        from: &str,
        to: &str,
        token_id: &str,
    ) -> Result<()> {
        self.chronicle.agent_steal_token(from, to, token_id)
    }

    /// Agent draws cards from the Stack
    #[wasm_bindgen(js_name = agentDrawCards)]
    pub fn agent_draw_cards(&mut self, agent_name: &str, count: usize) -> Result<String> {
        self.chronicle.agent_draw_cards(agent_name, count)
    }

    /// Agent discards cards (N cards from end of inventory to stack discards)
    #[wasm_bindgen(js_name = agentDiscardCards)]
    pub fn agent_discard_cards(&mut self, agent_name: &str, count: usize) -> Result<String> {
        self.chronicle.agent_discard_cards(agent_name, count)
    }

    /// Agent Trade
    #[wasm_bindgen(js_name = agentTrade)]
    pub fn agent_trade(
        &mut self,
        agent1: &str,
        agent2: &str,
        offer1: &str,
        offer2: &str,
    ) -> Result<()> {
        self.chronicle.agent_trade(agent1, agent2, offer1, offer2)
    }

    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // GAME LOOP ACTIONS (delegates to chronicle)
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /// Initialize game loop with max turns
    #[wasm_bindgen(js_name = gameLoopInit)]
    pub fn game_loop_init(&mut self, max_turns: i32) -> Result<()> {
        self.chronicle.game_loop_init(max_turns)
    }

    /// Start the game loop
    #[wasm_bindgen(js_name = gameLoopStart)]
    pub fn game_loop_start(&mut self) -> Result<()> {
        self.chronicle.game_loop_start()
    }

    /// Stop the game loop
    #[wasm_bindgen(js_name = gameLoopStop)]
    pub fn game_loop_stop(&mut self, phase: &str) -> Result<()> {
        self.chronicle.game_loop_stop(phase)
    }

    /// Advance to the next turn
    #[wasm_bindgen(js_name = gameLoopNextTurn)]
    pub fn game_loop_next_turn(&mut self, agent_count: usize) -> Result<()> {
        self.chronicle.game_loop_next_turn(agent_count)
    }

    /// Set the game loop phase
    #[wasm_bindgen(js_name = gameLoopSetPhase)]
    pub fn game_loop_set_phase(&mut self, phase: &str) -> Result<()> {
        self.chronicle.game_loop_set_phase(phase)
    }

    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // GAME STATE ACTIONS (delegates to chronicle)
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /// Start the game
    #[wasm_bindgen(js_name = gameStart)]
    pub fn game_start(&mut self) -> Result<String> {
        self.chronicle.game_state_start()
    }

    /// End the game
    #[wasm_bindgen(js_name = gameEnd)]
    pub fn game_end(&mut self, winner: Option<String>, _reason: Option<String>) -> Result<String> {
        self.chronicle.game_state_end(winner.as_deref())
    }

    /// Pause the game
    #[wasm_bindgen(js_name = gamePause)]
    pub fn game_pause(&mut self) -> Result<()> {
        self.chronicle.game_state_pause()
    }

    /// Resume the game from pause
    #[wasm_bindgen(js_name = gameResume)]
    pub fn game_resume(&mut self) -> Result<()> {
        self.chronicle.game_state_resume()
    }

    /// Advance to next phase or set specific phase
    #[wasm_bindgen(js_name = gameNextPhase)]
    pub fn game_next_phase(&mut self, phase: Option<String>) -> Result<()> {
        let phase_str = phase.unwrap_or_else(|| "next".to_string());
        self.chronicle.game_state_next_phase(&phase_str)
    }

    /// Set arbitrary game state property
    #[wasm_bindgen(js_name = gameSetProperty)]
    pub fn game_set_property(&mut self, key: &str, value_json: &str) -> Result<()> {
        self.chronicle.game_state_set_property(key, value_json)
    }

    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // RULES ACTIONS (delegates to chronicle)
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /// Mark a rule as fired
    #[wasm_bindgen(js_name = ruleMarkFired)]
    pub fn rule_mark_fired(&mut self, rule_name: &str, timestamp: i64) -> Result<()> {
        self.chronicle.rule_mark_fired(rule_name, timestamp)
    }

    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // READ-ONLY DELEGATES
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /// Peek at top cards of stack (reads from Chronicle's stack export)
    #[wasm_bindgen(js_name = stackPeek)]
    pub fn stack_peek(&self, _count: usize) -> Result<String> {
        self.chronicle.export_stack()
    }

    /// Get agent data
    #[wasm_bindgen(js_name = agentGet)]
    pub fn agent_get(&self, name: &str) -> Result<String> {
        let agents_json = self.chronicle.export_agents()?;
        let agents: serde_json::Value = serde_json::from_str(&agents_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;
        if agents.is_null() || agents.get(name).is_none() {
            return Err(HyperTokenError::InvalidOperation(format!("Agent '{}' not found", name)));
        }
        Ok(agents[name].to_string())
    }

    /// Get all agents
    #[wasm_bindgen(js_name = agentGetAll)]
    pub fn agent_get_all(&self) -> Result<String> {
        self.chronicle.export_agents()
    }

    /// Get current game state
    #[wasm_bindgen(js_name = gameGetState)]
    pub fn game_get_state(&self) -> Result<String> {
        self.chronicle.export_game_state()
    }

    /// Inspect source
    #[wasm_bindgen(js_name = sourceInspect)]
    pub fn source_inspect(&self) -> Result<String> {
        self.chronicle.export_source()
    }

    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TOKEN OPERATIONS (stateless, delegates to token_ops)
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /// Transform a token by applying properties
    #[wasm_bindgen(js_name = tokenTransform)]
    pub fn token_transform(&self, token_json: &str, properties_json: &str) -> Result<String> {
        self.token_ops.transform(token_json, properties_json)
    }

    /// Attach a token to another token
    #[wasm_bindgen(js_name = tokenAttach)]
    pub fn token_attach(
        &self,
        host_json: &str,
        attachment_json: &str,
        attachment_type: &str,
    ) -> Result<String> {
        self.token_ops.attach(host_json, attachment_json, attachment_type)
    }

    /// Detach a token from its host
    #[wasm_bindgen(js_name = tokenDetach)]
    pub fn token_detach(&self, host_json: &str, attachment_id: &str) -> Result<String> {
        self.token_ops.detach(host_json, attachment_id)
    }

    /// Merge multiple tokens into one
    #[wasm_bindgen(js_name = tokenMerge)]
    pub fn token_merge(
        &self,
        tokens_json: &str,
        result_properties_json: Option<String>,
        keep_originals: bool,
    ) -> Result<String> {
        self.token_ops.merge(tokens_json, result_properties_json, keep_originals)
    }

    /// Split a token into multiple tokens
    #[wasm_bindgen(js_name = tokenSplit)]
    pub fn token_split(
        &self,
        token_json: &str,
        count: usize,
        properties_array_json: Option<String>,
    ) -> Result<String> {
        self.token_ops.split(token_json, count, properties_array_json)
    }

    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // BATCH OPERATIONS (stateless, delegates to batch_ops)
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /// Find a token in a list matching a predicate
    #[wasm_bindgen(js_name = batchFind)]
    pub fn batch_find(&self, tokens_json: &str, predicate: &str) -> Result<String> {
        self.batch_ops.parallel_find(tokens_json, predicate)
    }

    /// Count tokens in a list matching a predicate
    #[wasm_bindgen(js_name = batchCount)]
    pub fn batch_count(&self, tokens_json: &str, predicate: &str) -> Result<usize> {
        self.batch_ops.parallel_count(tokens_json, predicate)
    }

    /// Apply an operation to all tokens (forEach equivalent)
    #[wasm_bindgen(js_name = batchForEach)]
    pub fn batch_for_each(&self, tokens_json: &str, operation: &str) -> Result<String> {
        self.batch_ops.parallel_map(tokens_json, operation)
    }

    /// Collect tokens from multiple sources (reads from chronicle state)
    #[wasm_bindgen(js_name = batchCollect)]
    pub fn batch_collect(&self, sources_json: &str) -> Result<String> {
        let sources: Vec<String> = serde_json::from_str(sources_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        let mut collected: Vec<serde_json::Value> = Vec::new();

        // Get state once for efficient reads
        let state_json = self.chronicle.get_state()?;
        let state: serde_json::Value = serde_json::from_str(&state_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        for source in sources {
            match source.as_str() {
                "stack" => {
                    if let Some(stack) = state.get("stack") {
                        if let Some(arr) = stack.get("stack").and_then(|s| s.as_array()) {
                            for t in arr {
                                collected.push(t.clone());
                            }
                        }
                    }
                },
                "discard" | "discards" => {
                    if let Some(stack) = state.get("stack") {
                        if let Some(arr) = stack.get("discards").and_then(|s| s.as_array()) {
                            for t in arr {
                                collected.push(t.clone());
                            }
                        }
                    }
                },
                "drawn" => {
                    if let Some(stack) = state.get("stack") {
                        if let Some(arr) = stack.get("drawn").and_then(|s| s.as_array()) {
                            for t in arr {
                                collected.push(t.clone());
                            }
                        }
                    }
                },
                "source" => {
                    if let Some(src) = state.get("source") {
                        if let Some(arr) = src.get("tokens").and_then(|s| s.as_array()) {
                            for t in arr {
                                collected.push(t.clone());
                            }
                        }
                    }
                },
                zone_name => {
                    if let Some(zones) = state.get("zones") {
                        if let Some(zone_arr) = zones.get(zone_name).and_then(|z| z.as_array()) {
                            for p in zone_arr {
                                if let Some(token_snapshot) = p.get("tokenSnapshot") {
                                    collected.push(token_snapshot.clone());
                                }
                            }
                        }
                    }
                }
            }
        }

        serde_json::to_string(&collected)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Batch shuffle multiple decks
    #[wasm_bindgen(js_name = batchShuffle)]
    pub fn batch_shuffle(&self, decks_json: &str, seed_prefix: Option<String>) -> Result<String> {
        self.batch_ops.batch_shuffle(decks_json, seed_prefix)
    }

    /// Batch draw from multiple decks
    #[wasm_bindgen(js_name = batchDraw)]
    pub fn batch_draw(&self, decks_json: &str, counts_json: &str) -> Result<String> {
        self.batch_ops.batch_draw(decks_json, counts_json)
    }

    /// Filter tokens with predefined predicate
    #[wasm_bindgen(js_name = batchFilter)]
    pub fn batch_filter(&self, tokens_json: &str, predicate: &str) -> Result<String> {
        self.batch_ops.parallel_filter(tokens_json, predicate)
    }

    /// Map tokens with predefined operation
    #[wasm_bindgen(js_name = batchMap)]
    pub fn batch_map(&self, tokens_json: &str, operation: &str) -> Result<String> {
        self.batch_ops.parallel_map(tokens_json, operation)
    }

    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SAVE / LOAD / SYNC (delegates to chronicle)
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /// Save document to binary
    #[wasm_bindgen(js_name = save)]
    pub fn save(&self) -> Result<Vec<u8>> {
        self.chronicle.save()
    }

    /// Save document to Base64 string
    #[wasm_bindgen(js_name = saveToBase64)]
    pub fn save_to_base64(&self) -> Result<String> {
        self.chronicle.save_to_base64()
    }

    /// Load document from binary
    #[wasm_bindgen(js_name = load)]
    pub fn load(&mut self, data: &[u8]) -> Result<()> {
        self.chronicle.load(data)
    }

    /// Load document from Base64 string
    #[wasm_bindgen(js_name = loadFromBase64)]
    pub fn load_from_base64(&mut self, base64: &str) -> Result<()> {
        self.chronicle.load_from_base64(base64)
    }

    /// Merge another document
    #[wasm_bindgen(js_name = merge)]
    pub fn merge(&mut self, other_data: &[u8]) -> Result<()> {
        self.chronicle.merge(other_data)
    }

    /// Generate sync message
    #[wasm_bindgen(js_name = generateSyncMessage)]
    pub fn generate_sync_message(&self, sync_state_bytes: Option<Vec<u8>>) -> Result<String> {
        self.chronicle.generate_sync_message(sync_state_bytes)
    }

    /// Receive sync message
    #[wasm_bindgen(js_name = receiveSyncMessage)]
    pub fn receive_sync_message(&mut self, message_base64: &str, sync_state_bytes: Option<Vec<u8>>) -> Result<String> {
        self.chronicle.receive_sync_message(message_base64, sync_state_bytes)
    }

    /// Full document sync
    #[wasm_bindgen(js_name = syncFull)]
    pub fn sync_full(&mut self, other_doc_bytes: &[u8]) -> Result<()> {
        self.chronicle.sync_full(other_doc_bytes)
    }

    /// Get change count
    #[wasm_bindgen(js_name = changeCount)]
    pub fn change_count(&self) -> usize {
        self.chronicle.change_count()
    }

    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SECTION EXPORTS (delegates to chronicle)
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /// Export stack section as JSON
    #[wasm_bindgen(js_name = exportStack)]
    pub fn export_stack(&self) -> Result<String> {
        self.chronicle.export_stack()
    }

    /// Export zones section as JSON
    #[wasm_bindgen(js_name = exportZones)]
    pub fn export_zones(&self) -> Result<String> {
        self.chronicle.export_zones()
    }

    /// Export source section as JSON
    #[wasm_bindgen(js_name = exportSource)]
    pub fn export_source(&self) -> Result<String> {
        self.chronicle.export_source()
    }

    /// Export gameLoop section as JSON
    #[wasm_bindgen(js_name = exportGameLoop)]
    pub fn export_game_loop(&self) -> Result<String> {
        self.chronicle.export_game_loop()
    }

    /// Export gameState section as JSON
    #[wasm_bindgen(js_name = exportGameState)]
    pub fn export_game_state(&self) -> Result<String> {
        self.chronicle.export_game_state()
    }

    /// Export rules section as JSON
    #[wasm_bindgen(js_name = exportRules)]
    pub fn export_rules(&self) -> Result<String> {
        self.chronicle.export_rules()
    }

    /// Export agents section as JSON
    #[wasm_bindgen(js_name = exportAgents)]
    pub fn export_agents(&self) -> Result<String> {
        self.chronicle.export_agents()
    }

    /// Export nullifiers section as JSON
    #[wasm_bindgen(js_name = exportNullifiers)]
    pub fn export_nullifiers(&self) -> Result<String> {
        self.chronicle.export_nullifiers()
    }
}

impl Default for ActionDispatcher {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dispatcher_creation() {
        let dispatcher = ActionDispatcher::new();
        assert!(dispatcher.get_state().is_ok());
    }

    #[test]
    fn test_dispatcher_stack_draw_via_chronicle() {
        let mut dispatcher = ActionDispatcher::new();
        dispatcher.initialize_state(r#"{"stack":{"stack":[
            {"id":"t1","text":"","char":"□","kind":"default","index":0,"meta":{}},
            {"id":"t2","text":"","char":"□","kind":"default","index":1,"meta":{}}
        ],"drawn":[],"discards":[]}}"#).unwrap();

        let result = dispatcher.stack_draw(1).unwrap();
        let drawn: Vec<serde_json::Value> = serde_json::from_str(&result).unwrap();
        assert_eq!(drawn.len(), 1);

        // Verify dirty tracking works
        let dirty = dispatcher.get_dirty();
        let dirty_val: serde_json::Value = serde_json::from_str(&dirty).unwrap();
        assert_eq!(dirty_val["stack"], true);
        assert_eq!(dirty_val["zones"], false);
    }

    #[test]
    fn test_dispatcher_space_place_via_chronicle() {
        let mut dispatcher = ActionDispatcher::new();
        dispatcher.initialize_state(r#"{"zones":{"hand":[],"table":[]}}"#).unwrap();

        let token_json = r#"{"id":"t1","text":"A","char":"A","kind":"card","index":0,"meta":{}}"#;
        let result = dispatcher.space_place("hand", token_json, Some(10.0), Some(20.0)).unwrap();
        let placement: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(placement["tokenId"], "t1");
    }

    #[test]
    fn test_dispatcher_agent_via_chronicle() {
        let mut dispatcher = ActionDispatcher::new();
        dispatcher.initialize_state(r#"{"agents":{}}"#).unwrap();

        let result = dispatcher.agent_create("a1", "Alice", None).unwrap();
        let agent: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(agent["name"], "Alice");

        dispatcher.agent_give_resource("Alice", "gold", 100.0).unwrap();
        let agent_json = dispatcher.agent_get("Alice").unwrap();
        let alice: serde_json::Value = serde_json::from_str(&agent_json).unwrap();
        assert_eq!(alice["resources"]["gold"], 100.0);
    }

    #[test]
    fn test_dispatcher_game_state_via_chronicle() {
        let mut dispatcher = ActionDispatcher::new();
        let result = dispatcher.game_start().unwrap();
        let gs: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(gs["started"], true);

        let end_result = dispatcher.game_end(Some("Alice".to_string()), None).unwrap();
        let end: serde_json::Value = serde_json::from_str(&end_result).unwrap();
        assert_eq!(end["ended"], true);
        assert_eq!(end["winner"], "Alice");
    }

    #[test]
    fn test_dispatcher_game_loop_via_chronicle() {
        let mut dispatcher = ActionDispatcher::new();
        dispatcher.game_loop_init(10).unwrap();
        dispatcher.game_loop_start().unwrap();
        dispatcher.game_loop_next_turn(3).unwrap();

        let dirty = dispatcher.get_dirty();
        let dirty_val: serde_json::Value = serde_json::from_str(&dirty).unwrap();
        assert_eq!(dirty_val["gameLoop"], true);
    }

    #[test]
    fn test_dispatcher_save_load_roundtrip() {
        let mut dispatcher = ActionDispatcher::new();
        dispatcher.initialize_state(r#"{"stack":{"stack":[
            {"id":"t1","text":"","char":"□","kind":"default","index":0,"meta":{}}
        ],"drawn":[],"discards":[]}}"#).unwrap();

        let saved = dispatcher.save().unwrap();
        let mut dispatcher2 = ActionDispatcher::new();
        dispatcher2.load(&saved).unwrap();

        let state = dispatcher2.get_state().unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&state).unwrap();
        assert!(parsed["stack"]["stack"].as_array().unwrap().len() == 1);
    }

    #[test]
    fn test_dispatcher_source_via_chronicle() {
        let mut dispatcher = ActionDispatcher::new();
        dispatcher.initialize_state(r#"{"source":{"stackIds":["s1"],"tokens":[
            {"id":"t1","text":"","char":"□","kind":"default","index":0,"meta":{}},
            {"id":"t2","text":"","char":"□","kind":"default","index":1,"meta":{}}
        ],"burned":[],"seed":null,"reshufflePolicy":{"mode":"auto"}}}"#).unwrap();

        let drawn = dispatcher.source_draw(1).unwrap();
        let drawn_tokens: Vec<serde_json::Value> = serde_json::from_str(&drawn).unwrap();
        assert_eq!(drawn_tokens.len(), 1);
    }

    #[test]
    fn test_dispatcher_clear_dirty() {
        let mut dispatcher = ActionDispatcher::new();
        dispatcher.initialize_state(r#"{"stack":{"stack":[
            {"id":"t1","text":"","char":"□","kind":"default","index":0,"meta":{}}
        ],"drawn":[],"discards":[]}}"#).unwrap();

        dispatcher.stack_draw(1).unwrap();
        dispatcher.clear_dirty();
        let dirty = dispatcher.get_dirty();
        let dirty_val: serde_json::Value = serde_json::from_str(&dirty).unwrap();
        assert_eq!(dirty_val["stack"], false);
    }

    #[test]
    fn test_dispatcher_set_stack_noop() {
        let mut dispatcher = ActionDispatcher::new();
        // Should succeed as a no-op
        assert!(dispatcher.set_stack("{}").is_ok());
        assert!(dispatcher.set_space("{}").is_ok());
        assert!(dispatcher.set_source("{}").is_ok());
    }

    #[test]
    fn test_dispatcher_rule_mark_fired() {
        let mut dispatcher = ActionDispatcher::new();
        dispatcher.initialize_state(r#"{"rules":{"fired":{}}}"#).unwrap();

        dispatcher.rule_mark_fired("win_check", 1234567890).unwrap();
        let dirty = dispatcher.get_dirty();
        let dirty_val: serde_json::Value = serde_json::from_str(&dirty).unwrap();
        assert_eq!(dirty_val["rules"], true);
    }

    #[test]
    fn test_dispatcher_batch_collect_via_chronicle() {
        let mut dispatcher = ActionDispatcher::new();
        dispatcher.initialize_state(r#"{"stack":{"stack":[
            {"id":"t1","text":"A","char":"A","kind":"card","index":0,"meta":{}},
            {"id":"t2","text":"B","char":"B","kind":"card","index":1,"meta":{}}
        ],"drawn":[],"discards":[]}}"#).unwrap();

        let collected = dispatcher.batch_collect(r#"["stack"]"#).unwrap();
        let tokens: Vec<serde_json::Value> = serde_json::from_str(&collected).unwrap();
        assert_eq!(tokens.len(), 2);
    }
}
