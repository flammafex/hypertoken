// Batch operations exposed to WASM/JavaScript
//
// Phase 3B: High-level batch operations for parallel processing
//
// These operations can be combined with Node.js Worker Threads (Phase 3A)
// for maximum throughput.

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use crate::token::Token;
use crate::types::{HyperTokenError, Result};
use crate::parallel;

/// BatchOps: High-performance batch operations
///
/// Provides WASM-exposed batch operations that can process
/// multiple items efficiently using optimized algorithms.
#[wasm_bindgen]
pub struct BatchOps {
    _private: (),
}

#[wasm_bindgen]
impl BatchOps {
    /// Create a new BatchOps instance
    #[wasm_bindgen(constructor)]
    pub fn new() -> BatchOps {
        BatchOps { _private: () }
    }

    /// Batch shuffle multiple decks
    ///
    /// Takes JSON array of token arrays, returns shuffled arrays.
    ///
    /// Example:
    /// ```js
    /// const batchOps = new BatchOps();
    /// const decks = [
    ///   [token1, token2, token3],
    ///   [token4, token5, token6],
    /// ];
    ///
    /// const shuffled = batchOps.batchShuffle(JSON.stringify(decks), "seed");
    /// ```
    #[wasm_bindgen(js_name = batchShuffle)]
    pub fn batch_shuffle(&self, decks_json: &str, seed_prefix: Option<String>) -> Result<String> {
        // Parse input
        let mut decks: Vec<Vec<Token>> = serde_json::from_str(decks_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        // Perform batch shuffle
        parallel::batch_shuffle(&mut decks, seed_prefix.as_deref());

        // Serialize result
        serde_json::to_string(&decks)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Batch draw from multiple decks
    ///
    /// Takes JSON array of token arrays and array of draw counts.
    /// Returns drawn cards and updated decks.
    ///
    /// Example:
    /// ```js
    /// const result = batchOps.batchDraw(
    ///   JSON.stringify(decks),
    ///   JSON.stringify([3, 2, 5])  // Draw 3 from first deck, 2 from second, etc.
    /// );
    /// // result: { drawn: [[...], [...], [...]], decks: [[...], [...], [...]] }
    /// ```
    #[wasm_bindgen(js_name = batchDraw)]
    pub fn batch_draw(&self, decks_json: &str, counts_json: &str) -> Result<String> {
        // Parse inputs
        let mut decks: Vec<Vec<Token>> = serde_json::from_str(decks_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        let counts: Vec<usize> = serde_json::from_str(counts_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        // Perform batch draw
        let drawn = parallel::batch_draw(&mut decks, &counts);

        // Create result
        #[derive(Serialize)]
        struct BatchDrawResult {
            drawn: Vec<Vec<Token>>,
            decks: Vec<Vec<Token>>,
        }

        let result = BatchDrawResult { drawn, decks };

        // Serialize
        serde_json::to_string(&result)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Parallel map operation on tokens
    ///
    /// Applies a transformation to all tokens efficiently.
    /// The transformer is specified as a string operation type.
    ///
    /// Supported operations:
    /// - "flip": Toggle faceUp state
    /// - "lock": Set locked = true
    /// - "unlock": Set locked = false
    ///
    /// Example:
    /// ```js
    /// const flipped = batchOps.parallelMap(
    ///   JSON.stringify(tokens),
    ///   "flip"
    /// );
    /// ```
    #[wasm_bindgen(js_name = parallelMap)]
    pub fn parallel_map(&self, tokens_json: &str, operation: &str) -> Result<String> {
        let mut tokens: Vec<Token> = serde_json::from_str(tokens_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        match operation {
            "flip" => {
                // Toggle reversal state
                tokens.iter_mut().for_each(|token| {
                    token.rev = Some(!token.rev.unwrap_or(false));
                });
            }
            "merge" => {
                // Mark all as merged
                tokens.iter_mut().for_each(|token| {
                    token.merged = Some(true);
                });
            }
            "unmerge" => {
                // Mark all as unmerged
                tokens.iter_mut().for_each(|token| {
                    token.merged = Some(false);
                });
            }
            _ => {
                return Err(HyperTokenError::InvalidOperation(
                    format!("Unknown operation: {}", operation)
                ));
            }
        }

        serde_json::to_string(&tokens)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Parallel filter operation on tokens
    ///
    /// Filters tokens based on a predicate efficiently.
    ///
    /// Supported predicates:
    /// - "faceUp": Filter face-up tokens
    /// - "faceDown": Filter face-down tokens
    /// - "locked": Filter locked tokens
    /// - "unlocked": Filter unlocked tokens
    ///
    /// Example:
    /// ```js
    /// const faceUpTokens = batchOps.parallelFilter(
    ///   JSON.stringify(tokens),
    ///   "faceUp"
    /// );
    /// ```
    #[wasm_bindgen(js_name = parallelFilter)]
    pub fn parallel_filter(&self, tokens_json: &str, predicate: &str) -> Result<String> {
        let tokens: Vec<Token> = serde_json::from_str(tokens_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        let filtered = match predicate {
            "reversed" => parallel::parallel_filter(&tokens, |t| t.rev.unwrap_or(false)),
            "normal" => parallel::parallel_filter(&tokens, |t| !t.rev.unwrap_or(false)),
            "merged" => parallel::parallel_filter(&tokens, |t| t.merged.unwrap_or(false)),
            "split" => parallel::parallel_filter(&tokens, |t| t.split.unwrap_or(false)),
            _ => {
                return Err(HyperTokenError::InvalidOperation(
                    format!("Unknown predicate: {}", predicate)
                ));
            }
        };

        serde_json::to_string(&filtered)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }
    
    /// Parallel find operation
    ///
    /// Returns the first token matching the predicate.
    #[wasm_bindgen(js_name = parallelFind)]
    pub fn parallel_find(&self, tokens_json: &str, predicate: &str) -> Result<String> {
        let tokens: Vec<Token> = serde_json::from_str(tokens_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        // Note: For 'find', sequential iteration is often faster due to short-circuiting
        let found = match predicate {
            "reversed" => tokens.iter().find(|t| t.rev.unwrap_or(false)),
            "normal" => tokens.iter().find(|t| !t.rev.unwrap_or(false)),
            "merged" => tokens.iter().find(|t| t.merged.unwrap_or(false)),
            "split" => tokens.iter().find(|t| t.split.unwrap_or(false)),
            // Add basic kind/group checks that might be useful
            p if p.starts_with("kind:") => {
                let k = &p[5..];
                tokens.iter().find(|t| t.kind == k)
            },
            p if p.starts_with("group:") => {
                let g = &p[6..];
                tokens.iter().find(|t| t.group.as_deref() == Some(g))
            },
            _ => None // Return None for unknown predicates to be safe, or Error
        };

        match found {
            Some(t) => serde_json::to_string(t)
                .map_err(|e| HyperTokenError::SerializationError(e.to_string())),
            None => Ok("null".to_string())
        }
    }

    /// Parallel count operation
    ///
    /// Returns the number of tokens matching the predicate.
    #[wasm_bindgen(js_name = parallelCount)]
    pub fn parallel_count(&self, tokens_json: &str, predicate: &str) -> Result<usize> {
        let tokens: Vec<Token> = serde_json::from_str(tokens_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        let count = match predicate {
            "reversed" => tokens.iter().filter(|t| t.rev.unwrap_or(false)).count(),
            "normal" => tokens.iter().filter(|t| !t.rev.unwrap_or(false)).count(),
            "merged" => tokens.iter().filter(|t| t.merged.unwrap_or(false)).count(),
            "split" => tokens.iter().filter(|t| t.split.unwrap_or(false)).count(),
            p if p.starts_with("kind:") => {
                let k = &p[5..];
                tokens.iter().filter(|t| t.kind == k).count()
            },
            p if p.starts_with("group:") => {
                let g = &p[6..];
                tokens.iter().filter(|t| t.group.as_deref() == Some(g)).count()
            },
            _ => 0
        };

        Ok(count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_tokens(count: usize) -> Vec<Token> {
        (0..count)
            .map(|i| Token {
                id: format!("token-{}", i),
                label: Some(format!("Token {}", i)),
                rev: Some(i % 2 == 0),
                merged: Some(false),
                group: Some("test".to_string()),
                text: format!("Test token {}", i),
                char: "□".to_string(),
                kind: "default".to_string(),
                index: i as i32,
                meta: Default::default(),
                tags: None,
                attachments: None,
                attached_to: None,
                attachment_type: None,
                merged_into: None,
                merged_from: None,
                merged_at: None,
                split: None,
                split_into: None,
                split_from: None,
                split_index: None,
                split_at: None,
            })
            .collect()
    }

    #[test]
    fn test_batch_shuffle() {
        let batch_ops = BatchOps::new();
        let decks = vec![
            create_test_tokens(5),
            create_test_tokens(10),
        ];

        let decks_json = serde_json::to_string(&decks).unwrap();
        let result = batch_ops.batch_shuffle(&decks_json, Some("test".to_string())).unwrap();

        let shuffled: Vec<Vec<Token>> = serde_json::from_str(&result).unwrap();
        assert_eq!(shuffled.len(), 2);
        assert_eq!(shuffled[0].len(), 5);
        assert_eq!(shuffled[1].len(), 10);
    }

    #[test]
    fn test_batch_draw() {
        let batch_ops = BatchOps::new();
        let decks = vec![
            create_test_tokens(10),
            create_test_tokens(10),
        ];

        let decks_json = serde_json::to_string(&decks).unwrap();
        let counts_json = "[3, 5]";

        let result = batch_ops.batch_draw(&decks_json, counts_json).unwrap();

        #[derive(Deserialize)]
        struct Result {
            drawn: Vec<Vec<Token>>,
            decks: Vec<Vec<Token>>,
        }

        let parsed: Result = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed.drawn[0].len(), 3);
        assert_eq!(parsed.drawn[1].len(), 5);
        assert_eq!(parsed.decks[0].len(), 7);
        assert_eq!(parsed.decks[1].len(), 5);
    }

    #[test]
    fn test_parallel_map() {
        let batch_ops = BatchOps::new();
        let tokens = create_test_tokens(10);
        let tokens_json = serde_json::to_string(&tokens).unwrap();

        let result = batch_ops.parallel_map(&tokens_json, "flip").unwrap();
        let flipped: Vec<Token> = serde_json::from_str(&result).unwrap();

        // All tokens should be flipped (rev toggled)
        for (original, flipped) in tokens.iter().zip(flipped.iter()) {
            assert_eq!(
                original.rev.unwrap_or(false),
                !flipped.rev.unwrap_or(false)
            );
        }
    }

    #[test]
    fn test_parallel_filter() {
        let batch_ops = BatchOps::new();
        let tokens = create_test_tokens(10);
        let tokens_json = serde_json::to_string(&tokens).unwrap();

        let result = batch_ops.parallel_filter(&tokens_json, "reversed").unwrap();
        let filtered: Vec<Token> = serde_json::from_str(&result).unwrap();

        // Only reversed tokens (even indices)
        assert_eq!(filtered.len(), 5);
        for token in filtered {
            assert!(token.rev.unwrap_or(false));
        }
    }
}
