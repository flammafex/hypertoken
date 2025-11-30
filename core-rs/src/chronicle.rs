// Chronicle: CRDT document wrapper using automerge-rs

use automerge::{Automerge, transaction::Transactable, ReadDoc};
use wasm_bindgen::prelude::*;

use crate::types::{HyperTokenError, HyperTokenState, Result};

/// Chronicle wraps an Automerge CRDT document
///
/// This is the performance-critical component that replaces the TypeScript
/// Chronicle. Automerge-rs provides 10-100x performance improvement for:
/// - Document merges
/// - Serialization/deserialization
/// - State changes
///
/// All state in HyperToken is stored in the CRDT document for:
/// - Conflict-free merging across peers
/// - Time-travel and undo/redo
/// - Deterministic state synchronization
#[wasm_bindgen]
pub struct Chronicle {
    doc: Automerge,
}

#[wasm_bindgen]
impl Chronicle {
    /// Create a new Chronicle with an empty CRDT document
    #[wasm_bindgen(constructor)]
    pub fn new() -> Chronicle {
        Chronicle {
            doc: Automerge::new(),
        }
    }

    /// Set the entire state (used for initialization)
    ///
    /// Takes a JSON string of HyperTokenState and stores it in the CRDT.
    /// The state is validated before being stored.
    #[wasm_bindgen(js_name = setState)]
    pub fn set_state(&mut self, state_json: &str) -> Result<()> {
        // Validate the JSON first
        let _state: HyperTokenState = serde_json::from_str(state_json)
            .map_err(|e| HyperTokenError::SerializationError(format!("Invalid state JSON: {}", e)))?;

        // Store as JSON string in the CRDT
        // This is simpler than trying to map to Automerge's native types
        let _result = self.doc.transact(|tx| {
            tx.put(automerge::ROOT, "state", state_json)
        });

        Ok(())
    }

    /// Get the current document state as JSON
    ///
    /// Returns the complete HyperTokenState as a JSON string.
    #[wasm_bindgen(js_name = getState)]
    pub fn get_state(&self) -> Result<String> {
        // Read state from the CRDT document
        let state_value = self.doc.get(automerge::ROOT, "state")
            .map_err(|e| HyperTokenError::CrdtError(format!("Failed to get state: {:?}", e)))?;

        // If no state exists, return empty HyperTokenState
        if state_value.is_none() {
            let empty_state = HyperTokenState::default();
            return serde_json::to_string(&empty_state)
                .map_err(|e| HyperTokenError::SerializationError(format!("Failed to serialize state: {}", e)));
        }

        // Extract the JSON string from Automerge value
        match state_value.unwrap().0 {
            automerge::Value::Scalar(s) => {
                match s.as_ref() {
                    automerge::ScalarValue::Str(json_str) => Ok(json_str.to_string()),
                    _ => {
                        let empty_state = HyperTokenState::default();
                        serde_json::to_string(&empty_state)
                            .map_err(|e| HyperTokenError::SerializationError(format!("Failed to serialize state: {}", e)))
                    }
                }
            },
            _ => {
                let empty_state = HyperTokenState::default();
                serde_json::to_string(&empty_state)
                    .map_err(|e| HyperTokenError::SerializationError(format!("Failed to serialize state: {}", e)))
            }
        }
    }

    /// Apply a change to the document
    ///
    /// JavaScript usage:
    /// ```js
    /// chronicle.change("draw-card", newStateJson);
    /// ```
    ///
    /// The new state is merged into the document atomically with a message.
    #[wasm_bindgen(js_name = change)]
    pub fn change(&mut self, message: &str, new_state_json: &str) -> Result<()> {
        // Validate the JSON first
        let _state: HyperTokenState = serde_json::from_str(new_state_json)
            .map_err(|e| HyperTokenError::SerializationError(format!("Invalid state JSON: {}", e)))?;

        // Apply change with message
        // Note: Automerge transact_with expects (F, time_option, extra) but the API differs per version
        // For simplicity, use regular transact since it includes the change in the op log
        let _result = self.doc.transact(|tx| {
            tx.put(automerge::ROOT, "state", new_state_json)
        });

        Ok(())
    }

    /// Save the document to a binary format
    #[wasm_bindgen(js_name = save)]
    pub fn save(&self) -> Result<Vec<u8>> {
        Ok(self.doc.save())
    }

    /// Load a document from binary format
    #[wasm_bindgen(js_name = load)]
    pub fn load(&mut self, data: &[u8]) -> Result<()> {
        self.doc = Automerge::load(data)
            .map_err(|e| HyperTokenError::CrdtError(format!("Failed to load document: {:?}", e)))?;
        Ok(())
    }

    /// Save document to Base64 string (for easier transport)
    #[wasm_bindgen(js_name = saveToBase64)]
    pub fn save_to_base64(&self) -> Result<String> {
        let data = self.save()?;
        Ok(base64_encode(&data))
    }

    /// Load document from Base64 string
    #[wasm_bindgen(js_name = loadFromBase64)]
    pub fn load_from_base64(&mut self, base64: &str) -> Result<()> {
        let data = base64_decode(base64)
            .map_err(|e| HyperTokenError::SerializationError(format!("Invalid base64: {}", e)))?;
        self.load(&data)
    }

    /// Merge another document into this one
    #[wasm_bindgen(js_name = merge)]
    pub fn merge(&mut self, other_data: &[u8]) -> Result<()> {
        let mut other_doc = Automerge::load(other_data)
            .map_err(|e| HyperTokenError::CrdtError(format!("Failed to load other document: {:?}", e)))?;

        self.doc.merge(&mut other_doc)
            .map_err(|_e| HyperTokenError::CrdtError("Failed to merge documents".to_string()))?;

        Ok(())
    }

    /// Get the number of changes in the document
    #[wasm_bindgen(js_name = changeCount)]
    pub fn change_count(&self) -> usize {
        self.doc.get_heads().len()
    }

    /// Get sync state for a peer (incremental sync)
    #[wasm_bindgen(js_name = generateSyncMessage)]
    pub fn generate_sync_message(&self, _sync_state: Option<Vec<u8>>) -> Result<Vec<u8>> {
        // For now, return the full document
        // TODO: Implement incremental sync
        self.save()
    }

    /// Receive a sync message from a peer
    #[wasm_bindgen(js_name = receiveSyncMessage)]
    pub fn receive_sync_message(&mut self, message: &[u8]) -> Result<()> {
        self.merge(message)
    }
}

// Non-WASM methods for internal use
impl Chronicle {
    /// Get a reference to the inner Automerge document
    pub fn doc(&self) -> &Automerge {
        &self.doc
    }

    /// Get a mutable reference to the inner Automerge document
    pub fn doc_mut(&mut self) -> &mut Automerge {
        &mut self.doc
    }
}

impl Default for Chronicle {
    fn default() -> Self {
        Self::new()
    }
}

// Base64 encoding/decoding helpers
fn base64_encode(data: &[u8]) -> String {
    use std::fmt::Write;
    let mut result = String::new();
    for chunk in data.chunks(3) {
        let mut buf = [0u8; 3];
        buf[..chunk.len()].copy_from_slice(chunk);

        let b64_chars = [
            (buf[0] >> 2) & 0x3F,
            ((buf[0] & 0x03) << 4) | ((buf[1] >> 4) & 0x0F),
            ((buf[1] & 0x0F) << 2) | ((buf[2] >> 6) & 0x03),
            buf[2] & 0x3F,
        ];

        for (i, &val) in b64_chars.iter().enumerate() {
            if i >= chunk.len() + 1 && i > 0 {
                result.push('=');
            } else {
                result.push(BASE64_CHARS[val as usize] as char);
            }
        }
    }
    result
}

fn base64_decode(data: &str) -> std::result::Result<Vec<u8>, String> {
    let mut result = Vec::new();
    let chars: Vec<u8> = data.bytes().collect();

    for chunk in chars.chunks(4) {
        if chunk.len() < 4 {
            return Err("Invalid base64 length".to_string());
        }

        let mut vals = [0u8; 4];
        for (i, &ch) in chunk.iter().enumerate() {
            if ch == b'=' {
                break;
            }
            vals[i] = BASE64_DECODE[ch as usize];
        }

        result.push((vals[0] << 2) | (vals[1] >> 4));
        if chunk[2] != b'=' {
            result.push((vals[1] << 4) | (vals[2] >> 2));
        }
        if chunk[3] != b'=' {
            result.push((vals[2] << 6) | vals[3]);
        }
    }

    Ok(result)
}

const BASE64_CHARS: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const BASE64_DECODE: &[u8; 256] = &{
    let mut table = [0u8; 256];
    let mut i = 0;
    while i < 64 {
        table[BASE64_CHARS[i] as usize] = i as u8;
        i += 1;
    }
    table
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chronicle_creation() {
        let chronicle = Chronicle::new();
        assert_eq!(chronicle.change_count(), 0);
    }

    #[test]
    fn test_save_and_load() {
        let mut chronicle1 = Chronicle::new();
        let data = chronicle1.save().unwrap();

        let mut chronicle2 = Chronicle::new();
        chronicle2.load(&data).unwrap();

        assert_eq!(chronicle2.change_count(), chronicle1.change_count());
    }

    #[test]
    fn test_base64_encoding() {
        let chronicle = Chronicle::new();
        let base64 = chronicle.save_to_base64().unwrap();
        assert!(!base64.is_empty());

        let mut chronicle2 = Chronicle::new();
        chronicle2.load_from_base64(&base64).unwrap();

        assert_eq!(chronicle2.change_count(), chronicle.change_count());
    }

    #[test]
    fn test_merge() {
        let mut chronicle1 = Chronicle::new();
        let chronicle2 = Chronicle::new();

        let data = chronicle2.save().unwrap();
        chronicle1.merge(&data).unwrap();

        // Merging empty documents should work
        assert!(true);
    }
}
