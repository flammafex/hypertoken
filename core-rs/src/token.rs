// Token implementation for HyperToken Core

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use wasm_bindgen::prelude::*;

use crate::types::{Metadata, Timestamp};

/// Universal entity representation
///
/// Tokens are the fundamental data structure representing game entities
/// (cards, items, agents, etc.). They support:
/// - Metadata and grouping
/// - Reversals (tarot-style)
/// - Tags and attachments
/// - Merge/split tracking for composite entities
#[derive(Debug, Clone, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct Token {
    // Core properties (not directly exposed - use getters/setters)
    #[wasm_bindgen(skip)]
    pub id: String,

    #[wasm_bindgen(skip)]
    pub group: Option<String>,

    #[wasm_bindgen(skip)]
    pub label: Option<String>,

    #[wasm_bindgen(skip)]
    pub text: String,

    #[wasm_bindgen(skip)]
    pub meta: Metadata,

    #[wasm_bindgen(skip)]
    pub char: String,

    #[wasm_bindgen(skip)]
    pub kind: String,

    #[wasm_bindgen(skip)]
    pub index: i32,

    // Runtime properties (not exposed to WASM directly)
    #[wasm_bindgen(skip)]
    pub rev: Option<bool>,

    #[wasm_bindgen(skip)]
    pub tags: Option<HashSet<String>>,

    #[wasm_bindgen(skip)]
    pub attachments: Option<Vec<serde_json::Value>>,

    #[wasm_bindgen(skip)]
    pub attached_to: Option<String>,

    #[wasm_bindgen(skip)]
    pub attachment_type: Option<String>,

    // Merge/split bookkeeping
    #[wasm_bindgen(skip)]
    pub merged: Option<bool>,

    #[wasm_bindgen(skip)]
    pub merged_into: Option<String>,

    #[wasm_bindgen(skip)]
    pub merged_from: Option<Vec<String>>,

    #[wasm_bindgen(skip)]
    pub merged_at: Option<Timestamp>,

    #[wasm_bindgen(skip)]
    pub split: Option<bool>,

    #[wasm_bindgen(skip)]
    pub split_into: Option<Vec<String>>,

    #[wasm_bindgen(skip)]
    pub split_from: Option<String>,

    #[wasm_bindgen(skip)]
    pub split_index: Option<i32>,

    #[wasm_bindgen(skip)]
    pub split_at: Option<Timestamp>,
}

#[wasm_bindgen]
impl Token {
    /// Create a new Token with minimal properties
    #[wasm_bindgen(constructor)]
    pub fn new(id: String, index: i32) -> Token {
        Token {
            id,
            group: None,
            label: None,
            text: String::new(),
            meta: Metadata::new(),
            char: "□".to_string(),
            kind: "default".to_string(),
            index,
            rev: None,
            tags: None,
            attachments: None,
            attached_to: None,
            attachment_type: None,
            merged: None,
            merged_into: None,
            merged_from: None,
            merged_at: None,
            split: None,
            split_into: None,
            split_from: None,
            split_index: None,
            split_at: None,
        }
    }

    /// Create a Token from a JSON string
    #[wasm_bindgen(js_name = fromJSON)]
    pub fn from_json(json: &str) -> Result<Token, JsValue> {
        serde_json::from_str(json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse Token JSON: {}", e)))
    }

    /// Convert Token to JSON string
    #[wasm_bindgen(js_name = toJSON)]
    pub fn to_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(self)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize Token: {}", e)))
    }

    /// Add a tag to the token
    #[wasm_bindgen(js_name = addTag)]
    pub fn add_tag(&mut self, tag: String) {
        self.tags.get_or_insert_with(HashSet::new).insert(tag);
    }

    /// Remove a tag from the token
    #[wasm_bindgen(js_name = removeTag)]
    pub fn remove_tag(&mut self, tag: &str) -> bool {
        self.tags
            .as_mut()
            .map(|tags| tags.remove(tag))
            .unwrap_or(false)
    }

    /// Check if token has a specific tag
    #[wasm_bindgen(js_name = hasTag)]
    pub fn has_tag(&self, tag: &str) -> bool {
        self.tags
            .as_ref()
            .map(|tags| tags.contains(tag))
            .unwrap_or(false)
    }

    /// Flip the token (toggle reversed state)
    pub fn flip(&mut self) {
        let current = self.rev.unwrap_or(false);
        self.rev = Some(!current);
    }

    /// Check if token is reversed
    #[wasm_bindgen(js_name = isReversed)]
    pub fn is_reversed(&self) -> bool {
        self.rev.unwrap_or(false)
    }

    /// Get the token ID
    #[wasm_bindgen(js_name = getId)]
    pub fn get_id(&self) -> String {
        self.id.clone()
    }

    /// Get the token index
    #[wasm_bindgen(js_name = getIndex)]
    pub fn get_index(&self) -> i32 {
        self.index
    }
}

// Non-WASM methods for internal use
impl Token {
    /// Create a Token with full properties (internal use)
    pub fn with_properties(
        id: String,
        group: Option<String>,
        label: Option<String>,
        text: String,
        meta: Metadata,
        char: String,
        kind: String,
        index: i32,
    ) -> Token {
        Token {
            id,
            group,
            label,
            text,
            meta,
            char,
            kind,
            index,
            rev: None,
            tags: None,
            attachments: None,
            attached_to: None,
            attachment_type: None,
            merged: None,
            merged_into: None,
            merged_from: None,
            merged_at: None,
            split: None,
            split_into: None,
            split_from: None,
            split_index: None,
            split_at: None,
        }
    }

    /// Clone the token (deep copy)
    pub fn deep_clone(&self) -> Token {
        Token {
            id: self.id.clone(),
            group: self.group.clone(),
            label: self.label.clone(),
            text: self.text.clone(),
            meta: self.meta.clone(),
            char: self.char.clone(),
            kind: self.kind.clone(),
            index: self.index,
            rev: self.rev,
            tags: self.tags.clone(),
            attachments: self.attachments.clone(),
            attached_to: self.attached_to.clone(),
            attachment_type: self.attachment_type.clone(),
            merged: self.merged,
            merged_into: self.merged_into.clone(),
            merged_from: self.merged_from.clone(),
            merged_at: self.merged_at,
            split: self.split,
            split_into: self.split_into.clone(),
            split_from: self.split_from.clone(),
            split_index: self.split_index,
            split_at: self.split_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_creation() {
        let token = Token::new("test-1".to_string(), 0);
        assert_eq!(token.id, "test-1");
        assert_eq!(token.index, 0);
        assert_eq!(token.kind, "default");
    }

    #[test]
    fn test_token_tags() {
        let mut token = Token::new("test-1".to_string(), 0);

        token.add_tag("rare".to_string());
        assert!(token.has_tag("rare"));

        token.add_tag("legendary".to_string());
        assert!(token.has_tag("legendary"));

        assert!(token.remove_tag("rare"));
        assert!(!token.has_tag("rare"));
    }

    #[test]
    fn test_token_flip() {
        let mut token = Token::new("test-1".to_string(), 0);

        assert!(!token.is_reversed());
        token.flip();
        assert!(token.is_reversed());
        token.flip();
        assert!(!token.is_reversed());
    }

    #[test]
    fn test_token_serialization() {
        let token = Token::new("test-1".to_string(), 42);
        let json = token.to_json().unwrap();
        let restored = Token::from_json(&json).unwrap();

        assert_eq!(token.id, restored.id);
        assert_eq!(token.index, restored.index);
    }
}
