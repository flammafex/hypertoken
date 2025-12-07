// Action dispatch system for HyperToken Core

use wasm_bindgen::prelude::*;

use crate::stack::Stack;
use crate::space::Space;
use crate::source::Source;
use crate::agent::AgentManager;
use crate::token_ops::TokenOps;
use crate::gamestate::GameStateManager;
use crate::batch::BatchOps;
use crate::types::{HyperTokenError, Result, IToken};

/// Unified action dispatcher for HyperToken operations
///
/// This provides a single entry point for all game actions,
/// using zero-overhead typed methods for optimal performance.
#[wasm_bindgen]
pub struct ActionDispatcher {
    stack: Option<Stack>,
    space: Option<Space>,
    source: Option<Source>,
    agent_manager: AgentManager,
    token_ops: TokenOps,
    game_state: GameStateManager,
    batch_ops: BatchOps,
}

#[wasm_bindgen]
impl ActionDispatcher {
    /// Create a new ActionDispatcher
    #[wasm_bindgen(constructor)]
    pub fn new() -> ActionDispatcher {
        ActionDispatcher {
            stack: None,
            space: None,
            source: None,
            agent_manager: AgentManager::new(),
            token_ops: TokenOps::new(),
            game_state: GameStateManager::new(),
            batch_ops: BatchOps::new(),
        }
    }

    /// Set the stack instance
    #[wasm_bindgen(js_name = setStack)]
    pub fn set_stack(&mut self, stack: Stack) {
        self.stack = Some(stack);
    }

    /// Set the space instance
    #[wasm_bindgen(js_name = setSpace)]
    pub fn set_space(&mut self, space: Space) {
        self.space = Some(space);
    }

    /// Set the source instance
    #[wasm_bindgen(js_name = setSource)]
    pub fn set_source(&mut self, source: Source) {
        self.source = Some(source);
    }

    /// Get the stack instance
    #[wasm_bindgen(js_name = getStack)]
    pub fn get_stack(&self) -> Option<Stack> {
        self.stack.clone()
    }

    /// Get the space instance
    #[wasm_bindgen(js_name = getSpace)]
    pub fn get_space(&self) -> Option<Space> {
        self.space.clone()
    }

    /// Get the source instance
    #[wasm_bindgen(js_name = getSource)]
    pub fn get_source(&self) -> Option<Source> {
        self.source.clone()
    }

    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TYPED DISPATCH METHODS (Zero overhead)
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /// Draw cards from stack (typed, zero overhead)
    #[wasm_bindgen(js_name = stackDraw)]
    pub fn stack_draw(&mut self, count: usize) -> Result<String> {
        let stack = self.stack.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack available".to_string()))?;
        stack.draw(count)
    }

    /// Peek at top cards of stack (typed, zero overhead)
    #[wasm_bindgen(js_name = stackPeek)]
    pub fn stack_peek(&self, count: usize) -> Result<String> {
        let stack = self.stack.as_ref()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack available".to_string()))?;
        stack.peek(count)
    }

    /// Shuffle stack with optional seed (typed, zero overhead)
    #[wasm_bindgen(js_name = stackShuffle)]
    pub fn stack_shuffle(&mut self, seed: Option<String>) -> Result<()> {
        let stack = self.stack.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack available".to_string()))?;
        stack.shuffle(seed)
    }

    /// Burn cards from stack (typed, zero overhead)
    #[wasm_bindgen(js_name = stackBurn)]
    pub fn stack_burn(&mut self, count: usize) -> Result<String> {
        let stack = self.stack.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack available".to_string()))?;
        stack.burn(count)
    }

    /// Reset stack to initial state (typed, zero overhead)
    #[wasm_bindgen(js_name = stackReset)]
    pub fn stack_reset(&mut self) -> Result<()> {
        let stack = self.stack.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack available".to_string()))?;
        stack.reset();
        Ok(())
    }

    /// Cut stack at index (typed, zero overhead)
    #[wasm_bindgen(js_name = stackCut)]
    pub fn stack_cut(&mut self, index: usize) -> Result<()> {
        let stack = self.stack.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack available".to_string()))?;
        stack.cut(index)
    }

    /// Insert token at index (typed, zero overhead)
    #[wasm_bindgen(js_name = stackInsertAt)]
    pub fn stack_insert_at(&mut self, index: usize, token_json: &str) -> Result<()> {
        let stack = self.stack.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack available".to_string()))?;
        stack.insert_at(index, token_json)
    }

    /// Remove token at index (typed, zero overhead)
    #[wasm_bindgen(js_name = stackRemoveAt)]
    pub fn stack_remove_at(&mut self, index: usize) -> Result<String> {
        let stack = self.stack.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack available".to_string()))?;
        stack.remove_at(index)
    }

    /// Swap two tokens (typed, zero overhead)
    #[wasm_bindgen(js_name = stackSwap)]
    pub fn stack_swap(&mut self, index_a: usize, index_b: usize) -> Result<()> {
        let stack = self.stack.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack available".to_string()))?;
        stack.swap(index_a, index_b)
    }

    /// Place token in zone (typed, zero overhead)
    #[wasm_bindgen(js_name = spacePlace)]
    pub fn space_place(&mut self, zone: &str, token_json: &str, x: Option<f64>, y: Option<f64>) -> Result<String> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;
        space.place(zone, token_json, x, y)
    }

    /// Remove token from zone (typed, zero overhead)
    #[wasm_bindgen(js_name = spaceRemove)]
    pub fn space_remove(&mut self, zone: &str, token_id: &str) -> Result<String> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;
        space.remove(zone, token_id)
    }

    /// Move token between zones (typed, zero overhead)
    #[wasm_bindgen(js_name = spaceMove)]
    pub fn space_move(&mut self, token_id: &str, from_zone: &str, to_zone: &str, x: Option<f64>, y: Option<f64>) -> Result<()> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;
        space.move_token(token_id, from_zone, to_zone, x, y)
    }

    /// Flip token in zone (typed, zero overhead)
    #[wasm_bindgen(js_name = spaceFlip)]
    pub fn space_flip(&mut self, zone: &str, token_id: &str) -> Result<()> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;
        space.flip(zone, token_id, None)
    }

    /// Create new zone (typed, zero overhead)
    #[wasm_bindgen(js_name = spaceCreateZone)]
    pub fn space_create_zone(&mut self, name: &str) -> Result<()> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;
        space.create_zone(name.to_string())
    }

    /// Delete zone (typed, zero overhead)
    #[wasm_bindgen(js_name = spaceDeleteZone)]
    pub fn space_delete_zone(&mut self, name: &str) -> Result<()> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;
        space.delete_zone(name)
    }

    /// Clear all tokens from zone (typed, zero overhead)
    #[wasm_bindgen(js_name = spaceClearZone)]
    pub fn space_clear_zone(&mut self, name: &str) -> Result<()> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;
        space.clear_zone(name)
    }

    /// Lock or unlock zone (typed, zero overhead)
    #[wasm_bindgen(js_name = spaceLockZone)]
    pub fn space_lock_zone(&mut self, name: &str, locked: bool) -> Result<()> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;
        space.lock_zone(name, locked)
    }

    /// Shuffle tokens in zone (typed, zero overhead)
    #[wasm_bindgen(js_name = spaceShuffleZone)]
    pub fn space_shuffle_zone(&mut self, name: &str, seed: Option<String>) -> Result<()> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;
        space.shuffle_zone(name, seed)
    }

    /// Draw from source (typed, zero overhead)
    #[wasm_bindgen(js_name = sourceDraw)]
    pub fn source_draw(&mut self, count: usize) -> Result<String> {
        let source = self.source.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No source available".to_string()))?;
        source.draw(count)
    }

    /// Shuffle source (typed, zero overhead)
    #[wasm_bindgen(js_name = sourceShuffle)]
    pub fn source_shuffle(&mut self, seed: Option<String>) -> Result<()> {
        let source = self.source.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No source available".to_string()))?;
        source.shuffle(seed)
    }

    /// Burn from source (typed, zero overhead)
    #[wasm_bindgen(js_name = sourceBurn)]
    pub fn source_burn(&mut self, count: usize) -> Result<String> {
        let source = self.source.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No source available".to_string()))?;
        source.burn(count)
    }

    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // AGENT ACTIONS (Zero overhead - typed methods)
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /// Create an agent (typed, zero overhead)
    #[wasm_bindgen(js_name = agentCreate)]
    pub fn agent_create(&mut self, id: &str, name: &str, meta_json: Option<String>) -> Result<String> {
        self.agent_manager.create_agent(id, name, meta_json)
    }

    /// Remove an agent (typed, zero overhead)
    #[wasm_bindgen(js_name = agentRemove)]
    pub fn agent_remove(&mut self, name: &str) -> Result<()> {
        self.agent_manager.remove_agent(name)
    }

    /// Set agent active state (typed, zero overhead)
    #[wasm_bindgen(js_name = agentSetActive)]
    pub fn agent_set_active(&mut self, name: &str, active: bool) -> Result<()> {
        self.agent_manager.set_agent_active(name, active)
    }

    /// Give resource to agent (typed, zero overhead)
    #[wasm_bindgen(js_name = agentGiveResource)]
    pub fn agent_give_resource(&mut self, name: &str, resource: &str, amount: i64) -> Result<()> {
        self.agent_manager.give_resource(name, resource, amount)
    }

    /// Take resource from agent (typed, zero overhead)
    #[wasm_bindgen(js_name = agentTakeResource)]
    pub fn agent_take_resource(&mut self, name: &str, resource: &str, amount: i64) -> Result<()> {
        self.agent_manager.take_resource(name, resource, amount)
    }

    /// Add token to agent's inventory (typed, zero overhead)
    #[wasm_bindgen(js_name = agentAddToken)]
    pub fn agent_add_token(&mut self, name: &str, token_json: &str) -> Result<()> {
        self.agent_manager.add_token(name, token_json)
    }

    /// Remove token from agent's inventory (typed, zero overhead)
    #[wasm_bindgen(js_name = agentRemoveToken)]
    pub fn agent_remove_token(&mut self, name: &str, token_id: &str) -> Result<String> {
        self.agent_manager.remove_token(name, token_id)
    }

    /// Get agent data (typed, zero overhead)
    #[wasm_bindgen(js_name = agentGet)]
    pub fn agent_get(&self, name: &str) -> Result<String> {
        self.agent_manager.get_agent(name)
    }

    /// Transfer resource between agents (typed, zero overhead)
    #[wasm_bindgen(js_name = agentTransferResource)]
    pub fn agent_transfer_resource(
        &mut self,
        from: &str,
        to: &str,
        resource: &str,
        amount: i64,
    ) -> Result<String> {
        self.agent_manager.transfer_resource(from, to, resource, amount)
    }

    /// Transfer token between agents (typed, zero overhead)
    #[wasm_bindgen(js_name = agentTransferToken)]
    pub fn agent_transfer_token(
        &mut self,
        from: &str,
        to: &str,
        token_id: &str,
    ) -> Result<String> {
        self.agent_manager.transfer_token(from, to, token_id)
    }

    /// Steal resource from another agent (typed, zero overhead)
    #[wasm_bindgen(js_name = agentStealResource)]
    pub fn agent_steal_resource(
        &mut self,
        from: &str,
        to: &str,
        resource: &str,
        amount: i64,
    ) -> Result<String> {
        self.agent_manager.steal_resource(from, to, resource, amount)
    }

    /// Steal token from another agent (typed, zero overhead)
    #[wasm_bindgen(js_name = agentStealToken)]
    pub fn agent_steal_token(
        &mut self,
        from: &str,
        to: &str,
        token_id: &str,
    ) -> Result<String> {
        self.agent_manager.steal_token(from, to, token_id)
    }

    /// Get all agents (typed, zero overhead)
    #[wasm_bindgen(js_name = agentGetAll)]
    pub fn agent_get_all(&self) -> Result<String> {
        self.agent_manager.get_all_agents()
    }
    
    // -------------------------------------------------------------------------
    // BATCH ACTIONS
    // -------------------------------------------------------------------------

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
    /// Maps to parallel_map for high-performance state updates
    #[wasm_bindgen(js_name = batchForEach)]
    pub fn batch_for_each(&self, tokens_json: &str, operation: &str) -> Result<String> {
        self.batch_ops.parallel_map(tokens_json, operation)
    }

    /// Collect tokens from multiple sources
    /// 
    /// Sources: "stack", "discard", "source", or any zone name (e.g., "hand")
    #[wasm_bindgen(js_name = batchCollect)]
    pub fn batch_collect(&self, sources_json: &str) -> Result<String> {
        let sources: Vec<String> = serde_json::from_str(sources_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        // FIXED: Use serde_json::Value to handle both Token (Stack) and IToken (Source/Space)
        let mut collected: Vec<serde_json::Value> = Vec::new();

        for source in sources {
            match source.as_str() {
                "stack" => {
                    if let Some(stack) = &self.stack {
                        for t in &stack.state().stack {
                            let v = serde_json::to_value(t)
                                .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;
                            collected.push(v);
                        }
                    }
                },
                "discard" | "discards" => {
                    if let Some(stack) = &self.stack {
                        for t in &stack.state().discards {
                            let v = serde_json::to_value(t)
                                .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;
                            collected.push(v);
                        }
                    }
                },
                "drawn" => {
                    if let Some(stack) = &self.stack {
                        for t in &stack.state().drawn {
                            let v = serde_json::to_value(t)
                                .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;
                            collected.push(v);
                        }
                    }
                },
                "source" => {
                    if let Some(src) = &self.source {
                        for t in &src.state().tokens {
                            let v = serde_json::to_value(t)
                                .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;
                            collected.push(v);
                        }
                    }
                },
                zone_name => {
                    if let Some(space) = &self.space {
                        if let Some(zone) = space.state().zones.get(zone_name) {
                             // FIXED: Iterate over .placements, not the zone itself
                             for p in &zone.placements {
                                 let v = serde_json::to_value(&p.tokenSnapshot)
                                    .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;
                                 collected.push(v);
                             }
                        }
                    }
                }
            }
        }

        serde_json::to_string(&collected)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TOKEN OPERATIONS (Zero overhead - typed methods)
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /// Transform a token by applying properties (typed, zero overhead)
    #[wasm_bindgen(js_name = tokenTransform)]
    pub fn token_transform(&self, token_json: &str, properties_json: &str) -> Result<String> {
        self.token_ops.transform(token_json, properties_json)
    }

    /// Attach a token to another token (typed, zero overhead)
    #[wasm_bindgen(js_name = tokenAttach)]
    pub fn token_attach(
        &self,
        host_json: &str,
        attachment_json: &str,
        attachment_type: &str,
    ) -> Result<String> {
        self.token_ops.attach(host_json, attachment_json, attachment_type)
    }

    /// Detach a token from its host (typed, zero overhead)
    #[wasm_bindgen(js_name = tokenDetach)]
    pub fn token_detach(&self, host_json: &str, attachment_id: &str) -> Result<String> {
        self.token_ops.detach(host_json, attachment_id)
    }

    /// Merge multiple tokens into one (typed, zero overhead)
    #[wasm_bindgen(js_name = tokenMerge)]
    pub fn token_merge(
        &self,
        tokens_json: &str,
        result_properties_json: Option<String>,
        keep_originals: bool,
    ) -> Result<String> {
        self.token_ops.merge(tokens_json, result_properties_json, keep_originals)
    }

    /// Split a token into multiple tokens (typed, zero overhead)
    #[wasm_bindgen(js_name = tokenSplit)]
    pub fn token_split(
        &self,
        token_json: &str,
        count: usize,
        properties_array_json: Option<String>,
    ) -> Result<String> {
        self.token_ops.split(token_json, count, properties_array_json)
    }

	/// Reverse the stack
    #[wasm_bindgen(js_name = stackReverse)]
    pub fn stack_reverse(&mut self) -> Result<()> {
        let stack = self.stack.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack available".to_string()))?;
        stack.reverse()
    }

	/// Add a stack to the source
    /// Expects JSON with { "stack": { "stack": [Tokens...] }, "id": "optional-id" }
    #[wasm_bindgen(js_name = sourceAddStack)]
    pub fn source_add_stack(&mut self, stack_json: &str, stack_id: Option<String>) -> Result<()> {
        let source = self.source.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No source available".to_string()))?;

        // Parse the input JSON to extract tokens
        let input: serde_json::Value = serde_json::from_str(stack_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        // Extract tokens: support both direct array or StackState object
        // We use a strict match pattern to avoid temporary value borrowing issues
        let tokens_vec = if let Some(arr) = input.as_array() {
            arr
        } else if let Some(stack_obj) = input.get("stack") {
            // Handle { stack: { stack: [...] } } or { stack: [...] }
            if let Some(inner_arr) = stack_obj.as_array() {
                inner_arr
            } else if let Some(nested_stack) = stack_obj.get("stack") {
                // FIXED: Use ok_or_else to return an error instead of creating a temporary empty vec
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

        // Generate ID if missing
        let id = stack_id.unwrap_or_else(|| format!("stack-{}", crate::utils::generate_id()));

        source.add_stack(&tokens_str, &id)
    }
    /// Remove a stack from the source
    #[wasm_bindgen(js_name = sourceRemoveStack)]
    pub fn source_remove_stack(&mut self, stack_id: &str) -> Result<()> {
        let source = self.source.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No source available".to_string()))?;
        source.remove_stack(stack_id)
    }

    /// Reset the source
    #[wasm_bindgen(js_name = sourceReset)]
    pub fn source_reset(&mut self, tokens_json: Option<String>) -> Result<()> {
        let source = self.source.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No source available".to_string()))?;

        if let Some(json) = tokens_json {
            source.reset(&json)
        } else {
            source.restore_burned()
        }
    }

    /// Inspect source
    #[wasm_bindgen(js_name = sourceInspect)]
    pub fn source_inspect(&self) -> Result<String> {
        let source = self.source.as_ref()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No source available".to_string()))?;
        source.inspect()
    }

    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // GAME STATE OPERATIONS (Zero overhead - typed methods)
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /// Start the game (typed, zero overhead)
    #[wasm_bindgen(js_name = gameStart)]
    pub fn game_start(&mut self) -> Result<String> {
        self.game_state.start()
    }

    /// End the game (typed, zero overhead)
    #[wasm_bindgen(js_name = gameEnd)]
    pub fn game_end(&mut self, winner: Option<String>, reason: Option<String>) -> Result<String> {
        self.game_state.end(winner, reason)
    }

    /// Pause the game (typed, zero overhead)
    #[wasm_bindgen(js_name = gamePause)]
    pub fn game_pause(&mut self) -> Result<String> {
        self.game_state.pause()
    }

    /// Resume the game from pause (typed, zero overhead)
    #[wasm_bindgen(js_name = gameResume)]
    pub fn game_resume(&mut self) -> Result<String> {
        self.game_state.resume()
    }

    /// Advance to next phase or set specific phase (typed, zero overhead)
    #[wasm_bindgen(js_name = gameNextPhase)]
    pub fn game_next_phase(&mut self, phase: Option<String>) -> Result<String> {
        self.game_state.next_phase(phase)
    }

    /// Set arbitrary game state property (typed, zero overhead)
    #[wasm_bindgen(js_name = gameSetProperty)]
    pub fn game_set_property(&mut self, key: &str, value_json: &str) -> Result<String> {
        self.game_state.set_property(key, value_json)
    }

    /// Get current game state (typed, zero overhead)
    #[wasm_bindgen(js_name = gameGetState)]
    pub fn game_get_state(&self) -> Result<String> {
        self.game_state.get_state()
    }
    
    // -------------------------------------------------------------------------
    // SPACE LAYOUT
    // -------------------------------------------------------------------------

    #[wasm_bindgen(js_name = spaceTransferZone)]
    pub fn space_transfer_zone(&mut self, from_zone: &str, to_zone: &str) -> Result<usize> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;
        space.transfer_zone(from_zone, to_zone)
    }

    #[wasm_bindgen(js_name = spaceClear)]
    pub fn space_clear(&mut self) -> Result<()> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;
        space.clear()
    }

    #[wasm_bindgen(js_name = spaceFan)]
    pub fn space_fan(&mut self, zone: &str, x: f64, y: f64, radius: f64, angle_start: f64, angle_step: f64) -> Result<()> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;
        space.fan(zone, x, y, radius, angle_start, angle_step)
    }

    #[wasm_bindgen(js_name = spaceStack)]
    pub fn space_stack(&mut self, zone: &str, x: f64, y: f64, off_x: f64, off_y: f64) -> Result<()> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;
        space.stack_layout(zone, x, y, off_x, off_y)
    }

    #[wasm_bindgen(js_name = spaceSpread)]
    pub fn space_spread(&mut self, zone: &str, x: f64, y: f64, spacing: f64, horizontal: bool) -> Result<()> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;
        space.spread(zone, x, y, spacing, horizontal)
    }

    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // BATCH OPERATIONS (Zero overhead - typed methods)
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /// Batch shuffle multiple decks (typed, zero overhead)
    ///
    /// Takes JSON array of token arrays, returns shuffled arrays.
    ///
    /// Example:
    /// ```js
    /// const decks = [[token1, token2], [token3, token4]];
    /// const shuffled = dispatcher.batchShuffle(JSON.stringify(decks), "seed");
    /// ```
    #[wasm_bindgen(js_name = batchShuffle)]
    pub fn batch_shuffle(&self, decks_json: &str, seed_prefix: Option<String>) -> Result<String> {
        self.batch_ops.batch_shuffle(decks_json, seed_prefix)
    }

    /// Batch draw from multiple decks (typed, zero overhead)
    ///
    /// Takes JSON array of token arrays and array of draw counts.
    /// Returns drawn cards and updated decks.
    ///
    /// Example:
    /// ```js
    /// const result = dispatcher.batchDraw(
    ///   JSON.stringify(decks),
    ///   JSON.stringify([3, 2, 5])
    /// );
    /// // result: { drawn: [[...], [...]], decks: [[...], [...]] }
    /// ```
    #[wasm_bindgen(js_name = batchDraw)]
    pub fn batch_draw(&self, decks_json: &str, counts_json: &str) -> Result<String> {
        self.batch_ops.batch_draw(decks_json, counts_json)
    }

    /// Filter tokens with predefined predicate (typed, zero overhead)
    ///
    /// Supported predicates:
    /// - "reversed": Filter reversed tokens
    /// - "normal": Filter normal (non-reversed) tokens
    /// - "merged": Filter merged tokens
    /// - "split": Filter split tokens
    ///
    /// Example:
    /// ```js
    /// const filtered = dispatcher.batchFilter(
    ///   JSON.stringify(tokens),
    ///   "reversed"
    /// );
    /// ```
    #[wasm_bindgen(js_name = batchFilter)]
    pub fn batch_filter(&self, tokens_json: &str, predicate: &str) -> Result<String> {
        self.batch_ops.parallel_filter(tokens_json, predicate)
    }

    /// Map tokens with predefined operation (typed, zero overhead)
    ///
    /// Supported operations:
    /// - "flip": Toggle reversal state
    /// - "merge": Mark all as merged
    /// - "unmerge": Mark all as unmerged
    ///
    /// Example:
    /// ```js
    /// const flipped = dispatcher.batchMap(
    ///   JSON.stringify(tokens),
    ///   "flip"
    /// );
    /// ```
    #[wasm_bindgen(js_name = batchMap)]
    pub fn batch_map(&self, tokens_json: &str, operation: &str) -> Result<String> {
        self.batch_ops.parallel_map(tokens_json, operation)
    }
    
    /// Agent draws cards from the Stack
    #[wasm_bindgen(js_name = agentDrawCards)]
    pub fn agent_draw_cards(&mut self, agent_name: &str, count: usize) -> Result<String> {
        let stack = self.stack.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack available".to_string()))?;

        // 1. Draw from stack
        // Note: Using JSON here to interface between components, could be optimized with internal API later
        let tokens_json = stack.draw(count)?; 
        let tokens: Vec<IToken> = serde_json::from_str(&tokens_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        // 2. Add to agent
        for token in &tokens {
            let token_str = serde_json::to_string(token)
                .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;
            self.agent_manager.add_token(agent_name, &token_str)?;
        }

        Ok(serde_json::json!({ "drawn": tokens.len() }).to_string())
    }

    /// Agent discards cards to the Stack's discard pile
    #[wasm_bindgen(js_name = agentDiscardCards)]
    pub fn agent_discard_cards(&mut self, agent_name: &str, token_ids_json: &str) -> Result<String> {
        let stack = self.stack.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack available".to_string()))?;

        let token_ids: Vec<String> = serde_json::from_str(token_ids_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        let mut discarded_count = 0;

        for tid in token_ids {
            // 1. Remove from agent
            let token_json = self.agent_manager.remove_token(agent_name, &tid)?;
            
            // 2. Add to stack discard
            stack.add_to_discard(&token_json)?;
            discarded_count += 1;
        }

        Ok(serde_json::json!({ "discarded": discarded_count }).to_string())
    }

    /// Agent Trade (Wrapper)
    #[wasm_bindgen(js_name = agentTrade)]
    pub fn agent_trade(
        &mut self,
        agent1: &str,
        offer1: &str,
        agent2: &str,
        offer2: &str
    ) -> Result<String> {
        self.agent_manager.trade(agent1, offer1, agent2, offer2)
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
        assert!(dispatcher.stack.is_none());
        assert!(dispatcher.space.is_none());
        assert!(dispatcher.source.is_none());
    }
}
