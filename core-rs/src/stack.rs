// Stack: CRDT-backed ordered collection for HyperToken

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

use crate::token::Token;
use crate::types::{HyperTokenError, Result};
use crate::utils::shuffle_vec;
use crate::chronicle::Chronicle;

/// Stack state stored in the CRDT
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StackState {
    /// Main deck of tokens
    pub stack: Vec<Token>,
    /// Drawn tokens
    pub drawn: Vec<Token>,
    /// Discarded tokens
    pub discards: Vec<Token>,
}

impl Default for StackState {
    fn default() -> Self {
        StackState {
            stack: Vec::new(),
            drawn: Vec::new(),
            discards: Vec::new(),
        }
    }
}

/// Stack: Ordered collection with shuffle/draw operations
///
/// Provides a high-performance replacement for the TypeScript Stack class.
/// Key improvements:
/// - No JSON.parse/stringify cloning (zero-copy operations)
/// - Efficient Vec operations instead of Array manipulations
/// - Direct memory management (no GC pressure)
///
/// Performance targets (vs TypeScript):
/// - Shuffle 1000 tokens: 986ms → <50ms (20x improvement)
/// - Draw single card: 18ms → <1ms (18x improvement)
#[derive(Clone)]
#[wasm_bindgen]
pub struct Stack {
    state: StackState,
}

#[wasm_bindgen]
impl Stack {
    /// Create a new Stack
    #[wasm_bindgen(constructor)]
    pub fn new() -> Stack {
        Stack {
            state: StackState::default(),
        }
    }

    /// Initialize stack with tokens from JSON array
    #[wasm_bindgen(js_name = initializeWithTokens)]
    pub fn initialize_with_tokens(&mut self, tokens_json: &str) -> Result<()> {
        let tokens: Vec<Token> = serde_json::from_str(tokens_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        self.state.stack = tokens;
        Ok(())
    }

    /// Get the number of tokens in the stack
    #[wasm_bindgen(js_name = size)]
    pub fn size(&self) -> usize {
        self.state.stack.len()
    }

    /// Get the number of drawn tokens
    #[wasm_bindgen(js_name = drawnCount)]
    pub fn drawn_count(&self) -> usize {
        self.state.drawn.len()
    }

    /// Get the number of discarded tokens
    #[wasm_bindgen(js_name = discardCount)]
    pub fn discard_count(&self) -> usize {
        self.state.discards.len()
    }

    /// Peek at N tokens from the top of the stack (without removing them)
    ///
    /// Returns JSON array of tokens
    #[wasm_bindgen(js_name = peek)]
    pub fn peek(&self, count: usize) -> Result<String> {
        if count == 0 {
            return Ok("[]".to_string());
        }

        let available = self.state.stack.len();
        let to_peek = count.min(available);

        // Get tokens from the end without removing them
        let start_index = available - to_peek;
        let peeked: Vec<Token> = self.state.stack[start_index..].to_vec();

        serde_json::to_string(&peeked)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Draw N tokens from the stack
    ///
    /// Returns JSON array of drawn tokens
    #[wasm_bindgen(js_name = draw)]
    pub fn draw(&mut self, count: usize) -> Result<String> {
        if count == 0 {
            return Ok("[]".to_string());
        }

        let available = self.state.stack.len();
        let to_draw = count.min(available);

        // Remove tokens from the end of the stack (most efficient)
        let drawn: Vec<Token> = self.state.stack
            .drain(self.state.stack.len() - to_draw..)
            .collect();

        // Add to drawn pile
        self.state.drawn.extend(drawn.iter().cloned());

        // Return drawn tokens as JSON
        serde_json::to_string(&drawn)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }
    
    /// Add a specific token to the discard pile (used by agents discarding)
    #[wasm_bindgen(js_name = addToDiscard)]
    pub fn add_to_discard(&mut self, token_json: &str) -> Result<()> {
        let token: Token = serde_json::from_str(token_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;
        self.state.discards.push(token);
        Ok(())
    }

    /// Shuffle the stack
    ///
    /// If seed is provided, uses deterministic shuffle
    #[wasm_bindgen(js_name = shuffle)]
    pub fn shuffle(&mut self, seed: Option<String>) -> Result<()> {
        shuffle_vec(&mut self.state.stack, seed.as_deref());
        Ok(())
    }

    /// Static helper: Shuffle an array of tokens without creating a Stack instance
    ///
    /// Avoids the overhead of Stack instantiation for standalone shuffle operations.
    /// This is much faster for Source.ts which just needs to shuffle tokens without
    /// the full Stack state management.
    #[wasm_bindgen(js_name = shuffleTokens)]
    pub fn shuffle_tokens(tokens_json: &str, seed: &str) -> Result<String> {
        let mut tokens: Vec<Token> = serde_json::from_str(tokens_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        let seed_opt = if seed.is_empty() { None } else { Some(seed) };
        shuffle_vec(&mut tokens, seed_opt);

        serde_json::to_string(&tokens)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Burn (remove) N tokens from the top of the stack
    #[wasm_bindgen(js_name = burn)]
    pub fn burn(&mut self, count: usize) -> Result<String> {
        let available = self.state.stack.len();
        let to_burn = count.min(available);

        let burned: Vec<Token> = self.state.stack
            .drain(self.state.stack.len() - to_burn..)
            .collect();

        serde_json::to_string(&burned)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Discard drawn tokens to discard pile
    #[wasm_bindgen(js_name = discard)]
    pub fn discard(&mut self, count: usize) -> Result<()> {
        let available = self.state.drawn.len();
        let to_discard = count.min(available);

        let discarded: Vec<Token> = self.state.drawn
            .drain(self.state.drawn.len() - to_discard..)
            .collect();

        self.state.discards.extend(discarded);
        Ok(())
    }

    /// Cut the deck at a specific index
    #[wasm_bindgen(js_name = cut)]
    pub fn cut(&mut self, index: usize) -> Result<()> {
        if index >= self.state.stack.len() {
            return Err(HyperTokenError::IndexOutOfBounds(index));
        }

        // Split at index and rotate
        let mut top = self.state.stack.split_off(index);
        top.append(&mut self.state.stack);
        self.state.stack = top;

        Ok(())
    }

    /// Insert a token at a specific index
    #[wasm_bindgen(js_name = insertAt)]
    pub fn insert_at(&mut self, index: usize, token_json: &str) -> Result<()> {
        let token: Token = serde_json::from_str(token_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        if index > self.state.stack.len() {
            return Err(HyperTokenError::IndexOutOfBounds(index));
        }

        self.state.stack.insert(index, token);
        Ok(())
    }

    /// Remove a token at a specific index
    #[wasm_bindgen(js_name = removeAt)]
    pub fn remove_at(&mut self, index: usize) -> Result<String> {
        if index >= self.state.stack.len() {
            return Err(HyperTokenError::IndexOutOfBounds(index));
        }

        let removed = self.state.stack.remove(index);
        serde_json::to_string(&removed)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Swap two tokens by index
    #[wasm_bindgen(js_name = swap)]
    pub fn swap(&mut self, index_a: usize, index_b: usize) -> Result<()> {
        let len = self.state.stack.len();

        if index_a >= len || index_b >= len {
            return Err(HyperTokenError::IndexOutOfBounds(index_a.max(index_b)));
        }

        self.state.stack.swap(index_a, index_b);
        Ok(())
    }

    /// Reverse a range of tokens
    #[wasm_bindgen(js_name = reverseRange)]
    pub fn reverse_range(&mut self, start: usize, end: usize) -> Result<()> {
        let len = self.state.stack.len();

        if start >= len || end > len || start >= end {
            return Err(HyperTokenError::InvalidOperation(
                format!("Invalid range: {}..{}", start, end)
            ));
        }

        self.state.stack[start..end].reverse();
        Ok(())
    }
    
    /// Reverse the order of the stack
    #[wasm_bindgen(js_name = reverse)]
    pub fn reverse(&mut self) -> Result<()> {
        self.state.stack.reverse();
        Ok(())
    }

    /// Reset the stack (move all drawn/discarded back to stack)
    #[wasm_bindgen(js_name = reset)]
    pub fn reset(&mut self) {
        // Move drawn and discarded back to stack
        self.state.stack.append(&mut self.state.drawn);
        self.state.stack.append(&mut self.state.discards);
        self.state.drawn.clear();
        self.state.discards.clear();
    }

    /// Get the full state as JSON
    #[wasm_bindgen(js_name = getState)]
    pub fn get_state(&self) -> Result<String> {
        serde_json::to_string(&self.state)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Set the state from JSON
    #[wasm_bindgen(js_name = setState)]
    pub fn set_state(&mut self, state_json: &str) -> Result<()> {
        self.state = serde_json::from_str(state_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;
        Ok(())
    }
}

impl Default for Stack {
    fn default() -> Self {
        Self::new()
    }
}

// Non-WASM methods for internal use
impl Stack {
    /// Get a reference to the internal state
    pub fn state(&self) -> &StackState {
        &self.state
    }

    /// Get a mutable reference to the internal state
    pub fn state_mut(&mut self) -> &mut StackState {
        &mut self.state
    }

    /// Create a stack with initial tokens
    pub fn with_tokens(tokens: Vec<Token>) -> Stack {
        Stack {
            state: StackState {
                stack: tokens,
                drawn: Vec::new(),
                discards: Vec::new(),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_token(id: &str, index: i32) -> Token {
        Token::new(id.to_string(), index)
    }

    #[test]
    fn test_stack_creation() {
        let stack = Stack::new();
        assert_eq!(stack.size(), 0);
        assert_eq!(stack.drawn_count(), 0);
    }

    #[test]
    fn test_stack_with_tokens() {
        let tokens = vec![
            create_test_token("t1", 0),
            create_test_token("t2", 1),
            create_test_token("t3", 2),
        ];

        let stack = Stack::with_tokens(tokens);
        assert_eq!(stack.size(), 3);
    }

    #[test]
    fn test_draw() {
        let tokens = vec![
            create_test_token("t1", 0),
            create_test_token("t2", 1),
            create_test_token("t3", 2),
        ];

        let mut stack = Stack::with_tokens(tokens);
        let drawn = stack.draw(2).unwrap();

        assert_eq!(stack.size(), 1);
        assert_eq!(stack.drawn_count(), 2);

        // Verify drawn tokens are valid JSON
        let parsed: Vec<Token> = serde_json::from_str(&drawn).unwrap();
        assert_eq!(parsed.len(), 2);
    }

    #[test]
    fn test_shuffle() {
        let tokens = vec![
            create_test_token("t1", 0),
            create_test_token("t2", 1),
            create_test_token("t3", 2),
            create_test_token("t4", 3),
            create_test_token("t5", 4),
        ];

        let mut stack = Stack::with_tokens(tokens);
        stack.shuffle(Some("test-seed".to_string())).unwrap();

        // Should still have same number of tokens
        assert_eq!(stack.size(), 5);

        // Test deterministic shuffle
        let state1 = stack.get_state().unwrap();

        let tokens2 = vec![
            create_test_token("t1", 0),
            create_test_token("t2", 1),
            create_test_token("t3", 2),
            create_test_token("t4", 3),
            create_test_token("t5", 4),
        ];

        let mut stack2 = Stack::with_tokens(tokens2);
        stack2.shuffle(Some("test-seed".to_string())).unwrap();
        let state2 = stack2.get_state().unwrap();

        assert_eq!(state1, state2, "Seeded shuffle should be deterministic");
    }

    #[test]
    fn test_burn() {
        let tokens = vec![
            create_test_token("t1", 0),
            create_test_token("t2", 1),
            create_test_token("t3", 2),
        ];

        let mut stack = Stack::with_tokens(tokens);
        stack.burn(2).unwrap();

        assert_eq!(stack.size(), 1);
    }

    #[test]
    fn test_cut() {
        let tokens = vec![
            create_test_token("t1", 0),
            create_test_token("t2", 1),
            create_test_token("t3", 2),
        ];

        let mut stack = Stack::with_tokens(tokens);
        stack.cut(1).unwrap();

        // After cut at index 1: [t2, t3, t1]
        assert_eq!(stack.size(), 3);
    }

    #[test]
    fn test_swap() {
        let tokens = vec![
            create_test_token("t1", 0),
            create_test_token("t2", 1),
            create_test_token("t3", 2),
        ];

        let mut stack = Stack::with_tokens(tokens);
        stack.swap(0, 2).unwrap();

        // After swap: [t3, t2, t1]
        assert_eq!(stack.size(), 3);
    }

    #[test]
    fn test_reset() {
        let tokens = vec![
            create_test_token("t1", 0),
            create_test_token("t2", 1),
            create_test_token("t3", 2),
        ];

        let mut stack = Stack::with_tokens(tokens);
        stack.draw(2).unwrap();

        assert_eq!(stack.size(), 1);
        assert_eq!(stack.drawn_count(), 2);

        stack.reset();

        assert_eq!(stack.size(), 3);
        assert_eq!(stack.drawn_count(), 0);
    }
}
