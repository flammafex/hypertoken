// Space: 2D placement with zone management for HyperToken

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::token::Token;
use crate::types::{HyperTokenError, Result, Position, ZoneLock};
use crate::utils::{now, shuffle_vec};

/// Placement record for a token in 2D space
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Placement {
    pub token: Token,
    pub x: f64,
    pub y: f64,
    pub z_index: i32,
    pub flipped: bool,
}

/// Zone state (collection of placements)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Zone {
    pub placements: Vec<Placement>,
    pub lock: ZoneLock,
}

impl Default for Zone {
    fn default() -> Self {
        Zone {
            placements: Vec::new(),
            lock: ZoneLock::default(),
        }
    }
}

/// Space state stored in CRDT
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpaceState {
    pub zones: HashMap<String, Zone>,
}

impl Default for SpaceState {
    fn default() -> Self {
        SpaceState {
            zones: HashMap::new(),
        }
    }
}

/// Space: 2D placement with zone management
///
/// Provides high-performance spatial token management.
/// Key improvements over TypeScript:
/// - Direct HashMap lookups (no object proxy overhead)
/// - Efficient vector operations (no JSON cloning)
/// - Better memory layout
///
/// Performance targets (vs TypeScript):
/// - Place 1000 tokens: 958ms → <50ms (20x improvement)
/// - Query 100 tokens: 82ms → <5ms (16x improvement)
#[derive(Clone)]
#[wasm_bindgen]
pub struct Space {
    state: SpaceState,
}

#[wasm_bindgen]
impl Space {
    /// Create a new Space
    #[wasm_bindgen(constructor)]
    pub fn new() -> Space {
        Space {
            state: SpaceState::default(),
        }
    }

    /// Create a zone
    #[wasm_bindgen(js_name = createZone)]
    pub fn create_zone(&mut self, name: String) -> Result<()> {
        if self.state.zones.contains_key(&name) {
            return Err(HyperTokenError::InvalidOperation(
                format!("Zone '{}' already exists", name)
            ));
        }

        self.state.zones.insert(name, Zone::default());
        Ok(())
    }

    /// Delete a zone
    #[wasm_bindgen(js_name = deleteZone)]
    pub fn delete_zone(&mut self, name: &str) -> Result<()> {
        if !self.state.zones.contains_key(name) {
            return Err(HyperTokenError::ZoneNotFound(name.to_string()));
        }

        self.state.zones.remove(name);
        Ok(())
    }

    /// Check if a zone exists
    #[wasm_bindgen(js_name = hasZone)]
    pub fn has_zone(&self, name: &str) -> bool {
        self.state.zones.contains_key(name)
    }

    /// Lock or unlock a zone
    #[wasm_bindgen(js_name = lockZone)]
    pub fn lock_zone(&mut self, name: &str, locked: bool) -> Result<()> {
        let zone = self.state.zones.get_mut(name)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(name.to_string()))?;

        zone.lock.locked = locked;
        if locked {
            zone.lock.locked_at = Some(now());
        } else {
            zone.lock.locked_at = None;
            zone.lock.locked_by = None;
        }

        Ok(())
    }

    /// Check if a zone is locked
    #[wasm_bindgen(js_name = isZoneLocked)]
    pub fn is_zone_locked(&self, name: &str) -> bool {
        self.state.zones.get(name)
            .map(|zone| zone.lock.locked)
            .unwrap_or(false)
    }

    /// Place a token in a zone
    #[wasm_bindgen(js_name = place)]
    pub fn place(
        &mut self,
        zone_name: &str,
        token_json: &str,
        x: Option<f64>,
        y: Option<f64>,
    ) -> Result<()> {
        // Ensure zone exists
        if !self.state.zones.contains_key(zone_name) {
            self.create_zone(zone_name.to_string())?;
        }

        let zone = self.state.zones.get_mut(zone_name).unwrap();

        // Check if zone is locked
        if zone.lock.locked {
            return Err(HyperTokenError::ZoneLocked(zone_name.to_string()));
        }

        // Parse token
        let token: Token = serde_json::from_str(token_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        // Create placement
        let placement = Placement {
            token,
            x: x.unwrap_or(0.0),
            y: y.unwrap_or(0.0),
            z_index: zone.placements.len() as i32,
            flipped: false,
        };

        zone.placements.push(placement);
        Ok(())
    }

    /// Remove a token from a zone
    #[wasm_bindgen(js_name = remove)]
    pub fn remove(&mut self, zone_name: &str, token_id: &str) -> Result<String> {
        let zone = self.state.zones.get_mut(zone_name)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(zone_name.to_string()))?;

        if zone.lock.locked {
            return Err(HyperTokenError::ZoneLocked(zone_name.to_string()));
        }

        let index = zone.placements.iter()
            .position(|p| p.token.id == token_id)
            .ok_or_else(|| HyperTokenError::TokenNotFound(token_id.to_string()))?;

        let placement = zone.placements.remove(index);

        serde_json::to_string(&placement.token)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Move a token between zones
    #[wasm_bindgen(js_name = move)]
    pub fn move_token(
        &mut self,
        token_id: &str,
        from_zone: &str,
        to_zone: &str,
        x: Option<f64>,
        y: Option<f64>,
    ) -> Result<()> {
        // Remove from source zone
        let token_json = self.remove(from_zone, token_id)?;

        // Place in destination zone
        self.place(to_zone, &token_json, x, y)?;

        Ok(())
    }

    /// Flip a token in a zone
    #[wasm_bindgen(js_name = flip)]
    pub fn flip(&mut self, zone_name: &str, token_id: &str) -> Result<()> {
        let zone = self.state.zones.get_mut(zone_name)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(zone_name.to_string()))?;

        if zone.lock.locked {
            return Err(HyperTokenError::ZoneLocked(zone_name.to_string()));
        }

        let placement = zone.placements.iter_mut()
            .find(|p| p.token.id == token_id)
            .ok_or_else(|| HyperTokenError::TokenNotFound(token_id.to_string()))?;

        placement.flipped = !placement.flipped;
        Ok(())
    }

    /// Clear all tokens from a zone
    #[wasm_bindgen(js_name = clearZone)]
    pub fn clear_zone(&mut self, zone_name: &str) -> Result<()> {
        let zone = self.state.zones.get_mut(zone_name)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(zone_name.to_string()))?;

        if zone.lock.locked {
            return Err(HyperTokenError::ZoneLocked(zone_name.to_string()));
        }

        zone.placements.clear();
        Ok(())
    }

    /// Get all tokens in a zone as JSON array
    #[wasm_bindgen(js_name = getTokens)]
    pub fn get_tokens(&self, zone_name: &str) -> Result<String> {
        let zone = self.state.zones.get(zone_name)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(zone_name.to_string()))?;

        let tokens: Vec<&Token> = zone.placements.iter()
            .map(|p| &p.token)
            .collect();

        serde_json::to_string(&tokens)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Get all placements in a zone as JSON
    #[wasm_bindgen(js_name = getPlacements)]
    pub fn get_placements(&self, zone_name: &str) -> Result<String> {
        let zone = self.state.zones.get(zone_name)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(zone_name.to_string()))?;

        serde_json::to_string(&zone.placements)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Get the count of tokens in a zone
    #[wasm_bindgen(js_name = count)]
    pub fn count(&self, zone_name: &str) -> Result<usize> {
        let zone = self.state.zones.get(zone_name)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(zone_name.to_string()))?;

        Ok(zone.placements.len())
    }

    /// Shuffle tokens in a zone (randomize z-index)
    #[wasm_bindgen(js_name = shuffleZone)]
    pub fn shuffle_zone(&mut self, zone_name: &str, seed: Option<String>) -> Result<()> {
        let zone = self.state.zones.get_mut(zone_name)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(zone_name.to_string()))?;

        if zone.lock.locked {
            return Err(HyperTokenError::ZoneLocked(zone_name.to_string()));
        }

        shuffle_vec(&mut zone.placements, seed.as_deref());

        // Update z-indices
        for (i, placement) in zone.placements.iter_mut().enumerate() {
            placement.z_index = i as i32;
        }

        Ok(())
    }

    /// Get list of all zone names
    #[wasm_bindgen(js_name = getZoneNames)]
    pub fn get_zone_names(&self) -> Vec<String> {
        self.state.zones.keys().cloned().collect()
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

impl Default for Space {
    fn default() -> Self {
        Self::new()
    }
}

// Non-WASM methods for internal use
impl Space {
    /// Get a reference to the internal state
    pub fn state(&self) -> &SpaceState {
        &self.state
    }

    /// Get a mutable reference to the internal state
    pub fn state_mut(&mut self) -> &mut SpaceState {
        &mut self.state
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::token::Token;

    fn create_test_token(id: &str, index: i32) -> Token {
        Token::new(id.to_string(), index)
    }

    #[test]
    fn test_space_creation() {
        let space = Space::new();
        assert!(space.get_zone_names().is_empty());
    }

    #[test]
    fn test_create_zone() {
        let mut space = Space::new();
        space.create_zone("zone1".to_string()).unwrap();

        assert!(space.has_zone("zone1"));
        assert_eq!(space.get_zone_names().len(), 1);
    }

    #[test]
    fn test_place_token() {
        let mut space = Space::new();
        let token = create_test_token("t1", 0);
        let token_json = serde_json::to_string(&token).unwrap();

        space.place("zone1", &token_json, Some(10.0), Some(20.0)).unwrap();

        assert_eq!(space.count("zone1").unwrap(), 1);
    }

    #[test]
    fn test_remove_token() {
        let mut space = Space::new();
        let token = create_test_token("t1", 0);
        let token_json = serde_json::to_string(&token).unwrap();

        space.place("zone1", &token_json, None, None).unwrap();
        assert_eq!(space.count("zone1").unwrap(), 1);

        space.remove("zone1", "t1").unwrap();
        assert_eq!(space.count("zone1").unwrap(), 0);
    }

    #[test]
    fn test_move_token() {
        let mut space = Space::new();
        let token = create_test_token("t1", 0);
        let token_json = serde_json::to_string(&token).unwrap();

        space.place("zone1", &token_json, None, None).unwrap();
        space.move_token("t1", "zone1", "zone2", Some(5.0), Some(5.0)).unwrap();

        assert_eq!(space.count("zone1").unwrap(), 0);
        assert_eq!(space.count("zone2").unwrap(), 1);
    }

    #[test]
    fn test_lock_zone() {
        let mut space = Space::new();
        space.create_zone("zone1".to_string()).unwrap();

        space.lock_zone("zone1", true).unwrap();
        assert!(space.is_zone_locked("zone1"));

        let token = create_test_token("t1", 0);
        let token_json = serde_json::to_string(&token).unwrap();

        // Should fail to place in locked zone
        assert!(space.place("zone1", &token_json, None, None).is_err());

        space.lock_zone("zone1", false).unwrap();
        assert!(!space.is_zone_locked("zone1"));

        // Should succeed now
        assert!(space.place("zone1", &token_json, None, None).is_ok());
    }

    #[test]
    fn test_clear_zone() {
        let mut space = Space::new();

        for i in 0..10 {
            let token = create_test_token(&format!("t{}", i), i);
            let token_json = serde_json::to_string(&token).unwrap();
            space.place("zone1", &token_json, None, None).unwrap();
        }

        assert_eq!(space.count("zone1").unwrap(), 10);

        space.clear_zone("zone1").unwrap();
        assert_eq!(space.count("zone1").unwrap(), 0);
    }

    #[test]
    fn test_shuffle_zone() {
        let mut space = Space::new();

        for i in 0..10 {
            let token = create_test_token(&format!("t{}", i), i);
            let token_json = serde_json::to_string(&token).unwrap();
            space.place("zone1", &token_json, None, None).unwrap();
        }

        space.shuffle_zone("zone1", Some("test-seed".to_string())).unwrap();

        assert_eq!(space.count("zone1").unwrap(), 10);
    }
}
