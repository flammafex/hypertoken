// Source: CRDT-backed multi-stack randomness source

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

use crate::types::{HyperTokenError, Result, ISourceState, ReshufflePolicy, IToken};
use crate::utils::shuffle_vec;

/// Source: Ordered collection combining multiple stacks
///
/// Provides high-performance replacement for TypeScript Source class.
/// Key improvements over TypeScript:
/// - No JSON.parse/stringify cloning for shuffle (zero-copy)
/// - Efficient Vec operations instead of Array manipulations
/// - Direct memory management (no GC pressure)
/// - Eliminates Chronicle proxy serialization overhead
///
/// Performance targets (vs TypeScript):
/// - Shuffle: 237ms → <5ms (50x improvement)
/// - Reset: 183ms → <5ms (35x improvement)
/// - Add stack: 88ms → <1ms (88x improvement)
#[derive(Clone)]
#[wasm_bindgen]
pub struct Source {
    state: ISourceState,
}

#[wasm_bindgen]
impl Source {
    /// Create a new Source
    #[wasm_bindgen(constructor)]
    pub fn new() -> Source {
        Source {
            state: ISourceState::default(),
        }
    }

    /// Initialize source with tokens from JSON array
    #[wasm_bindgen(js_name = initializeWithTokens)]
    pub fn initialize_with_tokens(&mut self, tokens_json: &str, stack_ids_json: &str) -> Result<()> {
        let tokens: Vec<IToken> = serde_json::from_str(tokens_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        let stack_ids: Vec<String> = serde_json::from_str(stack_ids_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        self.state.tokens = tokens;
        self.state.stackIds = stack_ids;
        self.state.burned = Vec::new();
        self.state.seed = None;
        self.state.reshufflePolicy = ReshufflePolicy::default();

        Ok(())
    }

    /// Get current state as JSON
    #[wasm_bindgen(js_name = getState)]
    pub fn get_state(&self) -> Result<String> {
        serde_json::to_string(&self.state)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Set state from JSON
    #[wasm_bindgen(js_name = setState)]
    pub fn set_state(&mut self, state_json: &str) -> Result<()> {
        self.state = serde_json::from_str(state_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;
        Ok(())
    }

    /// Get the number of tokens in the source
    #[wasm_bindgen(js_name = size)]
    pub fn size(&self) -> usize {
        self.state.tokens.len()
    }

    /// Get the number of burned tokens
    #[wasm_bindgen(js_name = burnedCount)]
    pub fn burned_count(&self) -> usize {
        self.state.burned.len()
    }

    /// Get tokens as JSON
    #[wasm_bindgen(js_name = getTokens)]
    pub fn get_tokens(&self) -> Result<String> {
        serde_json::to_string(&self.state.tokens)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Get burned tokens as JSON
    #[wasm_bindgen(js_name = getBurned)]
    pub fn get_burned(&self) -> Result<String> {
        serde_json::to_string(&self.state.burned)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Add tokens from a stack
    #[wasm_bindgen(js_name = addStack)]
    pub fn add_stack(&mut self, tokens_json: &str, stack_id: &str) -> Result<()> {
        let tokens: Vec<IToken> = serde_json::from_str(tokens_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        self.state.stackIds.push(stack_id.to_string());
        self.state.tokens.extend(tokens);

        Ok(())
    }

    /// Remove a stack by ID
    #[wasm_bindgen(js_name = removeStack)]
    pub fn remove_stack(&mut self, stack_id: &str) -> Result<()> {
        if let Some(idx) = self.state.stackIds.iter().position(|id| id == stack_id) {
            self.state.stackIds.remove(idx);
            Ok(())
        } else {
            Err(HyperTokenError::InvalidOperation(
                format!("Stack {} not found in Source", stack_id)
            ))
        }
    }

    /// Burn (remove) N tokens from the top of the source
    #[wasm_bindgen(js_name = burn)]
    pub fn burn(&mut self, count: usize) -> Result<String> {
        let available = self.state.tokens.len();
        let to_burn = count.min(available);

        let burned: Vec<IToken> = self.state.tokens
            .drain(self.state.tokens.len() - to_burn..)
            .collect();

        self.state.burned.extend(burned.iter().cloned());

        serde_json::to_string(&burned)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Shuffle the source
    ///
    /// If seed is provided, uses deterministic shuffle
    #[wasm_bindgen(js_name = shuffle)]
    pub fn shuffle(&mut self, seed: Option<String>) -> Result<()> {
        // Update seed if provided
        if let Some(seed_str) = seed.as_ref() {
            if !seed_str.is_empty() {
                if let Ok(seed_int) = seed_str.parse::<i32>() {
                    self.state.seed = Some(seed_int);
                }
            }
        }

        // Shuffle using current seed
        let seed_opt = self.state.seed.map(|s| s.to_string());
        shuffle_vec(&mut self.state.tokens, seed_opt.as_deref());

        Ok(())
    }
    
    /// Inspect source state (summary for debugging/UI)
    #[wasm_bindgen(js_name = inspect)]
    pub fn inspect(&self) -> Result<String> {
        let summary = serde_json::json!({
            "size": self.size(),
            "burned": self.burned_count(),
            "stackIds": self.state.stackIds,
            "seed": self.state.seed,
            "reshufflePolicy": self.state.reshufflePolicy
        });
        serde_json::to_string(&summary)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Restore burned cards to the main tokens list (soft reset)
    #[wasm_bindgen(js_name = restoreBurned)]
    pub fn restore_burned(&mut self) -> Result<()> {
        self.state.tokens.extend(self.state.burned.drain(..));
        Ok(())
    }

    /// Draw N tokens from the source
    ///
    /// Returns JSON array of drawn tokens
    /// If reshuffle policy is set and threshold is reached, auto-reshuffles
    #[wasm_bindgen(js_name = draw)]
    pub fn draw(&mut self, count: usize) -> Result<String> {
        if count == 0 {
            return Ok("[]".to_string());
        }

        let available = self.state.tokens.len();
        let to_draw = count.min(available);

        // Remove tokens from the end (most efficient)
        let drawn: Vec<IToken> = self.state.tokens
            .drain(self.state.tokens.len() - to_draw..)
            .collect();

        // Check reshuffle policy
        if let Some(threshold) = self.state.reshufflePolicy.threshold {
            if self.state.tokens.len() <= threshold as usize
                && self.state.reshufflePolicy.mode == "auto" {
                // Auto-reshuffle
                let seed_opt = self.state.seed.map(|s| s.to_string());
                shuffle_vec(&mut self.state.tokens, seed_opt.as_deref());
            }
        }

        // Return drawn tokens as JSON
        serde_json::to_string(&drawn)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Set reshuffle policy
    #[wasm_bindgen(js_name = setReshufflePolicy)]
    pub fn set_reshuffle_policy(&mut self, threshold: i32, mode: &str) -> Result<()> {
        if threshold < 0 {
            return Err(HyperTokenError::InvalidOperation(
                format!("Invalid reshuffle threshold: {}. Must be non-negative.", threshold)
            ));
        }

        self.state.reshufflePolicy = ReshufflePolicy {
            threshold: Some(threshold),
            mode: mode.to_string(),
        };

        Ok(())
    }

    /// Reset source with new tokens
    #[wasm_bindgen(js_name = reset)]
    pub fn reset(&mut self, tokens_json: &str) -> Result<()> {
        let tokens: Vec<IToken> = serde_json::from_str(tokens_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        self.state.tokens = tokens;
        self.state.burned.clear();

        Ok(())
    }

    /// Get current seed
    #[wasm_bindgen(js_name = getSeed)]
    pub fn get_seed(&self) -> Option<i32> {
        self.state.seed
    }

    /// Get reshuffle policy as JSON
    #[wasm_bindgen(js_name = getReshufflePolicy)]
    pub fn get_reshuffle_policy(&self) -> Result<String> {
        serde_json::to_string(&self.state.reshufflePolicy)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Get stack IDs as JSON
    #[wasm_bindgen(js_name = getStackIds)]
    pub fn get_stack_ids(&self) -> Result<String> {
        serde_json::to_string(&self.state.stackIds)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }
}

// Non-WASM methods for internal use
impl Source {
    /// Get a reference to the internal state
    pub fn state(&self) -> &ISourceState {
        &self.state
    }

    /// Get a mutable reference to the internal state
    pub fn state_mut(&mut self) -> &mut ISourceState {
        &mut self.state
    }

    /// Create a source with initial tokens
    pub fn with_tokens(tokens: Vec<IToken>, stack_ids: Vec<String>) -> Source {
        Source {
            state: ISourceState {
                stackIds: stack_ids,
                tokens,
                burned: Vec::new(),
                seed: None,
                reshufflePolicy: ReshufflePolicy::default(),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::Metadata;

    fn create_test_token(id: &str, index: i32) -> IToken {
        IToken {
            id: id.to_string(),
            label: Some(format!("Token {}", id)),
            group: None,
            text: String::new(),
            meta: Metadata::new(),
            char: "□".to_string(),
            kind: "default".to_string(),
            index,
            _rev: None,
            _tags: None,
            _attachments: None,
            _attachedTo: None,
            _attachmentType: None,
            _merged: None,
            _mergedInto: None,
            _mergedFrom: None,
            _mergedAt: None,
            _split: None,
            _splitInto: None,
            _splitFrom: None,
            _splitIndex: None,
            _splitAt: None,
        }
    }

    #[test]
    fn test_source_creation() {
        let source = Source::new();
        assert_eq!(source.size(), 0);
        assert_eq!(source.burned_count(), 0);
    }

    #[test]
    fn test_source_with_tokens() {
        let tokens = vec![
            create_test_token("t1", 0),
            create_test_token("t2", 1),
            create_test_token("t3", 2),
        ];

        let source = Source::with_tokens(tokens, vec!["stack-0".to_string()]);
        assert_eq!(source.size(), 3);
    }

    #[test]
    fn test_source_shuffle() {
        let tokens = vec![
            create_test_token("t1", 0),
            create_test_token("t2", 1),
            create_test_token("t3", 2),
        ];

        let mut source = Source::with_tokens(tokens, vec!["stack-0".to_string()]);

        // Shuffle with seed for deterministic result
        source.shuffle(Some("123".to_string())).unwrap();

        assert_eq!(source.size(), 3);
    }

    #[test]
    fn test_source_draw() {
        let tokens = vec![
            create_test_token("t1", 0),
            create_test_token("t2", 1),
            create_test_token("t3", 2),
        ];

        let mut source = Source::with_tokens(tokens, vec!["stack-0".to_string()]);

        let drawn_json = source.draw(2).unwrap();
        let drawn: Vec<IToken> = serde_json::from_str(&drawn_json).unwrap();

        assert_eq!(drawn.len(), 2);
        assert_eq!(source.size(), 1);
    }

    #[test]
    fn test_source_burn() {
        let tokens = vec![
            create_test_token("t1", 0),
            create_test_token("t2", 1),
            create_test_token("t3", 2),
        ];

        let mut source = Source::with_tokens(tokens, vec!["stack-0".to_string()]);

        let burned_json = source.burn(1).unwrap();
        let burned: Vec<IToken> = serde_json::from_str(&burned_json).unwrap();

        assert_eq!(burned.len(), 1);
        assert_eq!(source.size(), 2);
        assert_eq!(source.burned_count(), 1);
    }

    #[test]
    fn test_source_add_stack() {
        let mut source = Source::new();

        let tokens = vec![create_test_token("t1", 0)];
        let tokens_json = serde_json::to_string(&tokens).unwrap();

        source.add_stack(&tokens_json, "stack-0").unwrap();

        assert_eq!(source.size(), 1);
    }

    #[test]
    fn test_source_auto_reshuffle() {
        let tokens = vec![
            create_test_token("t1", 0),
            create_test_token("t2", 1),
            create_test_token("t3", 2),
            create_test_token("t4", 3),
            create_test_token("t5", 4),
        ];

        let mut source = Source::with_tokens(tokens, vec!["stack-0".to_string()]);

        // Set reshuffle policy: reshuffle when <= 2 tokens remain
        source.set_reshuffle_policy(2, "auto").unwrap();

        // Draw 3 tokens, should trigger reshuffle
        source.draw(3).unwrap();

        assert_eq!(source.size(), 2);
    }
}
