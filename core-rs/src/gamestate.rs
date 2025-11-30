// Game state management for HyperToken
//
// Manages game lifecycle (start/end), phases, pausing, and arbitrary properties.
// Simple state tracking with no complex logic.

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::types::{HyperTokenError, Result};

/// Game state structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameState {
    pub started: bool,
    pub start_time: Option<i64>,
    pub phase: String,
    pub turn: u32,
    pub ended: bool,
    pub end_time: Option<i64>,
    pub winner: Option<String>,
    pub reason: Option<String>,
    pub paused: bool,
    pub pause_time: Option<i64>,
    pub resume_time: Option<i64>,
    pub total_pause_duration: i64,
    pub properties: HashMap<String, serde_json::Value>,
}

/// Game state manager for WASM
#[wasm_bindgen]
pub struct GameStateManager {
    state: GameState,
}

#[wasm_bindgen]
impl GameStateManager {
    /// Create a new GameState manager
    #[wasm_bindgen(constructor)]
    pub fn new() -> GameStateManager {
        GameStateManager {
            state: GameState {
                started: false,
                start_time: None,
                phase: "setup".to_string(),
                turn: 0,
                ended: false,
                end_time: None,
                winner: None,
                reason: None,
                paused: false,
                pause_time: None,
                resume_time: None,
                total_pause_duration: 0,
                properties: HashMap::new(),
            },
        }
    }

    /// Start the game
    #[wasm_bindgen(js_name = start)]
    pub fn start(&mut self) -> Result<String> {
        self.state.started = true;
        self.state.start_time = Some(chrono::Utc::now().timestamp_millis());
        self.state.phase = "setup".to_string();
        self.state.turn = 0;
        self.state.ended = false;

        serde_json::to_string(&self.state)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// End the game
    #[wasm_bindgen(js_name = end)]
    pub fn end(&mut self, winner: Option<String>, reason: Option<String>) -> Result<String> {
        self.state.ended = true;
        self.state.end_time = Some(chrono::Utc::now().timestamp_millis());
        self.state.winner = winner;
        self.state.reason = reason;

        serde_json::to_string(&self.state)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Pause the game
    #[wasm_bindgen(js_name = pause)]
    pub fn pause(&mut self) -> Result<String> {
        self.state.paused = true;
        self.state.pause_time = Some(chrono::Utc::now().timestamp_millis());

        serde_json::to_string(&self.state)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Resume the game from pause
    #[wasm_bindgen(js_name = resume)]
    pub fn resume(&mut self) -> Result<String> {
        if let Some(pause_time) = self.state.pause_time {
            let now = chrono::Utc::now().timestamp_millis();
            let pause_duration = now - pause_time;
            self.state.total_pause_duration += pause_duration;
            self.state.resume_time = Some(now);
        }

        self.state.paused = false;

        serde_json::to_string(&self.state)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Advance to next phase or set specific phase
    #[wasm_bindgen(js_name = nextPhase)]
    pub fn next_phase(&mut self, phase: Option<String>) -> Result<String> {
        if let Some(new_phase) = phase {
            self.state.phase = new_phase;
        } else {
            // Default phase progression: setup → play → scoring → end
            let phases = ["setup", "play", "scoring", "end"];
            let current_index = phases.iter()
                .position(|&p| p == self.state.phase)
                .unwrap_or(0);
            let next_index = (current_index + 1).min(phases.len() - 1);
            self.state.phase = phases[next_index].to_string();
        }

        serde_json::to_string(&self.state)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Set arbitrary game state property
    #[wasm_bindgen(js_name = setProperty)]
    pub fn set_property(&mut self, key: &str, value_json: &str) -> Result<String> {
        let value: serde_json::Value = serde_json::from_str(value_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        self.state.properties.insert(key.to_string(), value);

        serde_json::to_string(&self.state)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Get current game state as JSON
    #[wasm_bindgen(js_name = getState)]
    pub fn get_state(&self) -> Result<String> {
        serde_json::to_string(&self.state)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }
}

impl Default for GameStateManager {
    fn default() -> Self {
        Self::new()
    }
}
