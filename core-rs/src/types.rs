// Type definitions for HyperToken Core

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

/// Metadata container for arbitrary key-value data
pub type Metadata = HashMap<String, serde_json::Value>;

/// Timestamp in milliseconds since epoch
pub type Timestamp = i64;

/// Result type for HyperToken operations
pub type Result<T> = std::result::Result<T, HyperTokenError>;

/// Error types for HyperToken operations
#[derive(Debug, thiserror::Error, Clone, Serialize, Deserialize)]
pub enum HyperTokenError {
    #[error("CRDT error: {0}")]
    CrdtError(String),

    #[error("Token not found: {0}")]
    TokenNotFound(String),

    #[error("Zone not found: {0}")]
    ZoneNotFound(String),

    #[error("Invalid operation: {0}")]
    InvalidOperation(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Index out of bounds: {0}")]
    IndexOutOfBounds(usize),

    #[error("Zone locked: {0}")]
    ZoneLocked(String),
}

// Convert Rust errors to JsValue for WASM boundary
impl From<HyperTokenError> for JsValue {
    fn from(err: HyperTokenError) -> Self {
        JsValue::from_str(&err.to_string())
    }
}

/// Position in 2D space
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[wasm_bindgen]
impl Position {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f64, y: f64) -> Position {
        Position { x, y }
    }
}

/// Spread pattern for spatial distribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SpreadPattern {
    Linear { spacing: f64 },
    Arc { radius: f64, start_angle: f64, end_angle: f64 },
    Grid { cols: usize, row_spacing: f64, col_spacing: f64 },
}

/// Zone lock state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZoneLock {
    pub locked: bool,
    pub locked_at: Option<Timestamp>,
    pub locked_by: Option<String>,
}

impl Default for ZoneLock {
    fn default() -> Self {
        ZoneLock {
            locked: false,
            locked_at: None,
            locked_by: None,
        }
    }
}

/// Action type enumeration matching TypeScript implementation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ActionType {
    // Stack actions
    #[serde(rename = "stack:reset")]
    StackReset,
    #[serde(rename = "stack:draw")]
    StackDraw { count: usize },
    #[serde(rename = "stack:burn")]
    StackBurn { count: usize },
    #[serde(rename = "stack:shuffle")]
    StackShuffle { seed: Option<String> },
    #[serde(rename = "stack:cut")]
    StackCut { index: usize },

    // Space actions
    #[serde(rename = "space:place")]
    SpacePlace { zone: String, token_id: String, x: Option<f64>, y: Option<f64> },
    #[serde(rename = "space:move")]
    SpaceMove { token_id: String, from_zone: String, to_zone: String },
    #[serde(rename = "space:remove")]
    SpaceRemove { token_id: String, zone: String },
    #[serde(rename = "space:flip")]
    SpaceFlip { token_id: String, zone: String },

    // Zone management
    #[serde(rename = "space:createZone")]
    SpaceCreateZone { name: String },
    #[serde(rename = "space:deleteZone")]
    SpaceDeleteZone { name: String },
    #[serde(rename = "space:clearZone")]
    SpaceClearZone { name: String },
    #[serde(rename = "space:lockZone")]
    SpaceLockZone { name: String, locked: bool },

    // Debug
    #[serde(rename = "debug:log")]
    DebugLog { msg: String },
}
