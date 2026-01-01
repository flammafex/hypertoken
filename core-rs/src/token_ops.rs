// Token transformation and mutation operations
//
// These operations modify token state, handle attachments, and perform
// complex transformations like merge/split. These are CPU-intensive
// operations that benefit significantly from Rust's performance.

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use crate::types::{HyperTokenError, Result, IToken};

/// Attachment record for tokens
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub token: IToken,
    pub attachment_type: String,
    pub attached_at: i64,
    pub id: String,
}

/// Token operations manager for WASM
#[wasm_bindgen]
pub struct TokenOps {
    // This is a stateless utility struct
}

#[wasm_bindgen]
impl TokenOps {
    /// Create a new TokenOps instance
    #[wasm_bindgen(constructor)]
    pub fn new() -> TokenOps {
        TokenOps {}
    }

    /// Transform a token by applying properties
    ///
    /// This modifies the token's properties in-place. Properties are merged
    /// with existing token data.
    #[wasm_bindgen(js_name = transform)]
    pub fn transform(&self, token_json: &str, properties_json: &str) -> Result<String> {
        let mut token: IToken = serde_json::from_str(token_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        let properties: serde_json::Value = serde_json::from_str(properties_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        // Apply properties to token
        if let serde_json::Value::Object(props) = properties {
            for (key, value) in props {
                match key.as_str() {
                    "meta" => {
                        // Merge meta objects
                        if let serde_json::Value::Object(new_meta) = value {
                            for (k, v) in new_meta {
                                token.meta.insert(k, v);
                            }
                        }
                    }
                    "char" => {
                        if let Some(s) = value.as_str() {
                            token.char = s.to_string();
                        }
                    }
                    "kind" => {
                        if let Some(s) = value.as_str() {
                            token.kind = s.to_string();
                        }
                    }
                    "label" => {
                        if let Some(s) = value.as_str() {
                            token.label = Some(s.to_string());
                        }
                    }
                    "group" => {
                        if let Some(s) = value.as_str() {
                            token.group = Some(s.to_string());
                        }
                    }
                    _ => {
                        // Store other properties in meta
                        token.meta.insert(key, value);
                    }
                }
            }
        }

        serde_json::to_string(&token)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Attach a token to another token
    ///
    /// Creates an attachment relationship. The attachment token gains
    /// _attachedTo and _attachmentType properties.
    #[wasm_bindgen(js_name = attach)]
    pub fn attach(
        &self,
        host_json: &str,
        attachment_json: &str,
        attachment_type: &str,
    ) -> Result<String> {
        let mut host: IToken = serde_json::from_str(host_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        let mut attachment: IToken = serde_json::from_str(attachment_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        // Create attachment record
        let attachment_record = Attachment {
            token: attachment.clone(),
            attachment_type: attachment_type.to_string(),
            attached_at: chrono::Utc::now().timestamp_millis(),
            id: attachment.id.clone(),
        };

        // Add _attachments array to host
        let attachments_value = if let Some(serde_json::Value::Array(existing)) = host.meta.get("_attachments") {
            let mut arr = existing.clone();
            arr.push(serde_json::to_value(&attachment_record)
                .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?);
            arr
        } else {
            vec![serde_json::to_value(&attachment_record)
                .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?]
        };

        // Update host meta
        host.meta.insert("_attachments".to_string(), serde_json::Value::Array(attachments_value));

        // Update attachment token
        attachment.meta.insert("_attachedTo".to_string(), serde_json::Value::String(host.id.clone()));
        attachment.meta.insert("_attachmentType".to_string(), serde_json::Value::String(attachment_type.to_string()));

        serde_json::to_string(&host)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Detach a token from its host
    ///
    /// Removes the attachment relationship and returns the detached token.
    #[wasm_bindgen(js_name = detach)]
    pub fn detach(&self, host_json: &str, attachment_id: &str) -> Result<String> {
        let mut host: IToken = serde_json::from_str(host_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        // Get attachments array from meta
        if let Some(serde_json::Value::Array(attachments)) = host.meta.get_mut("_attachments") {
            // Find and remove the attachment
            if let Some(index) = attachments.iter().position(|a| {
                a.get("id")
                    .and_then(|id| id.as_str())
                    .map(|id| id == attachment_id)
                    .unwrap_or(false)
            }) {
                let removed = attachments.remove(index);

                // Extract the token and clean it
                if let serde_json::Value::Object(ref obj) = removed {
                    if let Some(token_value) = obj.get("token") {
                        // Deserialize to IToken so we can clean it properly
                        let mut token: IToken = serde_json::from_value(token_value.clone())
                            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

                        // Remove attachment metadata
                        token.meta.remove("_attachedTo");
                        token.meta.remove("_attachmentType");

                        return serde_json::to_string(&token)
                            .map_err(|e| HyperTokenError::SerializationError(e.to_string()));
                    }
                }
            }
        }

        Err(HyperTokenError::InvalidOperation(
            format!("Attachment {} not found", attachment_id)
        ))
    }

    /// Merge multiple tokens into one
    ///
    /// Combines properties from multiple tokens. The first token is used as
    /// the base, with properties from subsequent tokens merged in.
    #[wasm_bindgen(js_name = merge)]
    pub fn merge(
        &self,
        tokens_json: &str,
        result_properties_json: Option<String>,
        keep_originals: bool,
    ) -> Result<String> {
        let tokens: Vec<IToken> = serde_json::from_str(tokens_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        if tokens.len() < 2 {
            return Err(HyperTokenError::InvalidOperation(
                "At least 2 tokens required to merge".to_string()
            ));
        }

        let mut merged = tokens[0].clone();

        // Merge meta from all tokens
        for token in &tokens {
            for (k, v) in &token.meta {
                merged.meta.insert(k.clone(), v.clone());
            }
        }

        // Apply result properties if provided
        if let Some(props_json) = result_properties_json {
            let props: serde_json::Value = serde_json::from_str(&props_json)
                .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

            if let serde_json::Value::Object(props_obj) = props {
                for (k, v) in props_obj {
                    if k != "meta" {
                        merged.meta.insert(k, v);
                    }
                }
            }
        }

        // Add merge metadata
        merged.meta.insert(
            "_mergedFrom".to_string(),
            serde_json::Value::Array(
                tokens.iter().map(|t| serde_json::Value::String(t.id.clone())).collect()
            )
        );
        merged.meta.insert(
            "_mergedAt".to_string(),
            serde_json::Value::Number(serde_json::Number::from(chrono::Utc::now().timestamp_millis()))
        );

        // Mark original tokens as merged (if not keeping)
        if !keep_originals {
            // This would require modifying the input tokens, which we can't do
            // in this stateless function. The TypeScript layer will handle this.
        }

        serde_json::to_string(&merged)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Split a token into multiple tokens
    ///
    /// Creates multiple copies of a token with optional custom properties.
    #[wasm_bindgen(js_name = split)]
    pub fn split(
        &self,
        token_json: &str,
        count: usize,
        properties_array_json: Option<String>,
    ) -> Result<String> {
        if count < 2 {
            return Err(HyperTokenError::InvalidOperation(
                "Split count must be at least 2".to_string()
            ));
        }

        let base_token: IToken = serde_json::from_str(token_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        let properties_array: Vec<serde_json::Value> = if let Some(props_json) = properties_array_json {
            serde_json::from_str(&props_json)
                .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?
        } else {
            vec![]
        };

        let mut split_tokens = Vec::new();

        for i in 0..count {
            let mut split_token = base_token.clone();

            // Update ID
            split_token.id = format!("{}-split-{}", base_token.id, i);

            // Apply custom properties if provided
            if i < properties_array.len() {
                if let serde_json::Value::Object(ref custom_props) = properties_array[i] {
                    for (k, v) in custom_props {
                        split_token.meta.insert(k.clone(), v.clone());
                    }
                }
            }

            // Add split metadata
            split_token.meta.insert("_splitFrom".to_string(), serde_json::Value::String(base_token.id.clone()));
            split_token.meta.insert("_splitIndex".to_string(), serde_json::Value::Number(serde_json::Number::from(i)));
            split_token.meta.insert("_splitAt".to_string(), serde_json::Value::Number(serde_json::Number::from(chrono::Utc::now().timestamp_millis())));

            split_tokens.push(split_token);
        }

        serde_json::to_string(&split_tokens)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }
}

impl Default for TokenOps {
    fn default() -> Self {
        Self::new()
    }
}
