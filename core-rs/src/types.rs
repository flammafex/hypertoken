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

// ============================================================================
// HyperTokenState CRDT Types
// ============================================================================

/// Token interface matching TypeScript IToken
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IToken {
    pub id: String,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub group: Option<String>,
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub meta: Metadata,
    #[serde(default = "default_char")]
    pub char: String,
    #[serde(default = "default_kind")]
    pub kind: String,
    #[serde(default)]
    pub index: i32,

    // Optional runtime properties
    #[serde(skip_serializing_if = "Option::is_none")]
    pub _rev: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub _tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub _attachments: Option<Vec<serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub _attachedTo: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub _attachmentType: Option<String>,

    // Merge/split tracking
    #[serde(skip_serializing_if = "Option::is_none")]
    pub _merged: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub _mergedInto: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub _mergedFrom: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub _mergedAt: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub _split: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub _splitInto: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub _splitFrom: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub _splitIndex: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub _splitAt: Option<i64>,
}

fn default_char() -> String {
    "□".to_string()
}

fn default_kind() -> String {
    "default".to_string()
}

/// Placement in 2D space with CRDT tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IPlacementCRDT {
    pub id: String,
    pub tokenId: String,
    pub tokenSnapshot: IToken,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub faceUp: bool,
    pub label: Option<String>,
    pub ts: i64,
    pub reversed: bool,
    pub tags: Vec<String>,
}

/// Stack state (ordered collection)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct IStackState {
    #[serde(default)]
    pub stack: Vec<IToken>,
    #[serde(default)]
    pub drawn: Vec<IToken>,
    #[serde(default)]
    pub discards: Vec<IToken>,
}

/// Source state (reshuffle pool)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ISourceState {
    #[serde(default)]
    pub stackIds: Vec<String>,
    #[serde(default)]
    pub tokens: Vec<IToken>,
    #[serde(default)]
    pub burned: Vec<IToken>,
    pub seed: Option<i32>,
    #[serde(default)]
    pub reshufflePolicy: ReshufflePolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReshufflePolicy {
    pub threshold: Option<i32>,
    #[serde(default = "default_reshuffle_mode")]
    pub mode: String, // "auto" | "manual"
}

fn default_reshuffle_mode() -> String {
    "auto".to_string()
}

impl Default for ReshufflePolicy {
    fn default() -> Self {
        ReshufflePolicy {
            threshold: None,
            mode: default_reshuffle_mode(),
        }
    }
}

impl Default for ISourceState {
    fn default() -> Self {
        ISourceState {
            stackIds: Vec::new(),
            tokens: Vec::new(),
            burned: Vec::new(),
            seed: None,
            reshufflePolicy: ReshufflePolicy::default(),
        }
    }
}

/// Game loop state
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct IGameLoopState {
    #[serde(default)]
    pub turn: i32,
    #[serde(default)]
    pub running: bool,
    #[serde(default)]
    pub activeAgentIndex: i32,
    #[serde(default)]
    pub phase: String,
    #[serde(default)]
    pub maxTurns: i32,
}

/// Rule state (fired rules tracking)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct IRuleState {
    #[serde(default)]
    pub fired: HashMap<String, i64>, // RuleName -> Timestamp
}

/// Complete HyperToken CRDT state
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HyperTokenState {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub zones: Option<HashMap<String, Vec<IPlacementCRDT>>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub stack: Option<IStackState>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<ISourceState>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub gameLoop: Option<IGameLoopState>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub rules: Option<IRuleState>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub agents: Option<HashMap<String, serde_json::Value>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub nullifiers: Option<HashMap<String, i64>>, // NullifierHash -> Timestamp

    // Extensible: any additional fields
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
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
