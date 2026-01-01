// Space: 2D placement with zone management for HyperToken

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::token::Token;
use crate::types::{HyperTokenError, Result, Position, ZoneLock, IPlacementCRDT, IToken};
use crate::utils::{now, shuffle_vec};

/// Zone state (collection of placements)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Zone {
    pub placements: Vec<IPlacementCRDT>,
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
    /// Returns the placement as JSON
    #[wasm_bindgen(js_name = place)]
    pub fn place(
        &mut self,
        zone_name: &str,
        token_json: &str,
        x: Option<f64>,
        y: Option<f64>,
    ) -> Result<String> {
        // Ensure zone exists
        if !self.state.zones.contains_key(zone_name) {
            self.create_zone(zone_name.to_string())?;
        }

        let zone = self.state.zones.get_mut(zone_name).unwrap();

        // Check if zone is locked
        if zone.lock.locked {
            return Err(HyperTokenError::ZoneLocked(zone_name.to_string()));
        }

        // Parse token to IToken
        let token: IToken = serde_json::from_str(token_json)
            .map_err(|e| {
                eprintln!("Failed to deserialize token from JSON: {}", e);
                eprintln!("Token JSON was: {}", token_json);
                HyperTokenError::SerializationError(format!("Failed to parse token: {}", e))
            })?;

        // Generate unique ID for placement (simple counter-based for now)
        let placement_id = format!("p-{}-{}", zone.placements.len(), now());

        // Create placement in Chronicle format
        let placement = IPlacementCRDT {
            id: placement_id,
            tokenId: token.id.clone(),
            tokenSnapshot: token,
            x: Some(x.unwrap_or(0.0)),
            y: Some(y.unwrap_or(0.0)),
            faceUp: true,
            label: None,
            ts: now(),
            reversed: false,
            tags: Vec::new(),
        };

        // Add to zone
        zone.placements.push(placement.clone());

        // Return placement as JSON
        let result_json = serde_json::to_string(&placement)
            .map_err(|e| {
                eprintln!("Failed to serialize placement to JSON: {}", e);
                HyperTokenError::SerializationError(format!("Failed to serialize placement: {}", e))
            })?;

        eprintln!("Successfully created placement: {}", &result_json[..result_json.len().min(100)]);
        Ok(result_json)
    }

    /// Remove a placement from a zone by placement ID
    #[wasm_bindgen(js_name = remove)]
    pub fn remove(&mut self, zone_name: &str, placement_id: &str) -> Result<String> {
        let zone = self.state.zones.get_mut(zone_name)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(zone_name.to_string()))?;

        if zone.lock.locked {
            return Err(HyperTokenError::ZoneLocked(zone_name.to_string()));
        }

        let index = zone.placements.iter()
            .position(|p| p.id == placement_id)
            .ok_or_else(|| HyperTokenError::TokenNotFound(placement_id.to_string()))?;

        let placement = zone.placements.remove(index);

        serde_json::to_string(&placement.tokenSnapshot)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Move a placement between zones by placement ID
    #[wasm_bindgen(js_name = move)]
    pub fn move_token(
        &mut self,
        placement_id: &str,
        from_zone: &str,
        to_zone: &str,
        x: Option<f64>,
        y: Option<f64>,
    ) -> Result<()> {
        // Find and remove the placement from source zone
        let from = self.state.zones.get_mut(from_zone)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(from_zone.to_string()))?;

        if from.lock.locked {
            return Err(HyperTokenError::ZoneLocked(from_zone.to_string()));
        }

        let index = from.placements.iter()
            .position(|p| p.id == placement_id)
            .ok_or_else(|| HyperTokenError::TokenNotFound(placement_id.to_string()))?;

        let mut placement = from.placements.remove(index);

        // Update position if provided
        if let Some(new_x) = x {
            placement.x = Some(new_x);
        }
        if let Some(new_y) = y {
            placement.y = Some(new_y);
        }

        // Ensure destination zone exists
        if !self.state.zones.contains_key(to_zone) {
            self.create_zone(to_zone.to_string())?;
        }

        // Add to destination zone
        let to = self.state.zones.get_mut(to_zone)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(to_zone.to_string()))?;

        if to.lock.locked {
            return Err(HyperTokenError::ZoneLocked(to_zone.to_string()));
        }

        to.placements.push(placement);

        Ok(())
    }

    /// Flip a placement in a zone by placement ID
    #[wasm_bindgen(js_name = flip)]
    pub fn flip(&mut self, zone_name: &str, placement_id: &str, face_up: Option<bool>) -> Result<()> {
        let zone = self.state.zones.get_mut(zone_name)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(zone_name.to_string()))?;

        if zone.lock.locked {
            return Err(HyperTokenError::ZoneLocked(zone_name.to_string()));
        }

        let placement = zone.placements.iter_mut()
            .find(|p| p.id == placement_id)
            .ok_or_else(|| HyperTokenError::TokenNotFound(placement_id.to_string()))?;

        // If explicit face_up value provided, use it; otherwise toggle
        placement.faceUp = face_up.unwrap_or(!placement.faceUp);
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

        let tokens: Vec<&IToken> = zone.placements.iter()
            .map(|p| &p.tokenSnapshot)
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
        Ok(())
    }
    
    /// Transfer all tokens from one zone to another
    #[wasm_bindgen(js_name = transferZone)]
    pub fn transfer_zone(&mut self, from_zone: &str, to_zone: &str) -> Result<usize> {
        // We need to move items, so we can't borrow self immutably and mutably at same time.
        // Strategy: remove from source, then append to dest.
        
        if !self.state.zones.contains_key(from_zone) {
            return Err(HyperTokenError::ZoneNotFound(from_zone.to_string()));
        }
        
        // Ensure destination exists
        if !self.state.zones.contains_key(to_zone) {
            self.create_zone(to_zone.to_string())?;
        }

        // Check locks
        if self.is_zone_locked(from_zone) {
            return Err(HyperTokenError::ZoneLocked(from_zone.to_string()));
        }
        if self.is_zone_locked(to_zone) {
            return Err(HyperTokenError::ZoneLocked(to_zone.to_string()));
        }

        // Extract items
        let mut tokens_to_move = {
            let from = self.state.zones.get_mut(from_zone).unwrap();
            std::mem::take(&mut from.placements)
        };
        
        let count = tokens_to_move.len();

        // Append to destination
        let to = self.state.zones.get_mut(to_zone).unwrap();
        to.placements.append(&mut tokens_to_move);

        Ok(count)
    }

    /// Clear all tokens from ALL zones (Global clear)
    #[wasm_bindgen(js_name = clear)]
    pub fn clear(&mut self) -> Result<()> {
        for (name, zone) in self.state.zones.iter_mut() {
            if zone.lock.locked {
                // If any zone is locked, operation fails? Or skip?
                // Legacy behavior usually implies admin override or fail.
                // For safety, we fail if any zone is locked.
                return Err(HyperTokenError::ZoneLocked(name.to_string()));
            }
        }

        for zone in self.state.zones.values_mut() {
            zone.placements.clear();
        }
        Ok(())
    }

    /// Arrange tokens in a fan (arc) layout
    #[wasm_bindgen(js_name = fan)]
    pub fn fan(
        &mut self, 
        zone_name: &str, 
        x: f64, 
        y: f64, 
        radius: f64, 
        angle_start: f64, 
        angle_step: f64
    ) -> Result<()> {
        let zone = self.state.zones.get_mut(zone_name)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(zone_name.to_string()))?;

        if zone.lock.locked {
            return Err(HyperTokenError::ZoneLocked(zone_name.to_string()));
        }

        let count = zone.placements.len();
        if count == 0 { return Ok(()); }

        // Convert degrees to radians
        let to_rad = std::f64::consts::PI / 180.0;
        
        for (i, placement) in zone.placements.iter_mut().enumerate() {
            let angle_deg = angle_start + (i as f64 * angle_step);
            let angle_rad = angle_deg * to_rad;
            
            // Calculate new position relative to center (x, y)
            placement.x = Some(x + (radius * angle_rad.cos()));
            placement.y = Some(y + (radius * angle_rad.sin()));
            
            // Optional: Rotate the card to match the arc? 
            // Legacy implementation usually just sets X/Y.
        }

        Ok(())
    }

    /// Arrange tokens in a stack (pile) layout
    #[wasm_bindgen(js_name = stackLayout)]
    pub fn stack_layout(
        &mut self, 
        zone_name: &str, 
        x: f64, 
        y: f64, 
        offset_x: f64, 
        offset_y: f64
    ) -> Result<()> {
        let zone = self.state.zones.get_mut(zone_name)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(zone_name.to_string()))?;

        if zone.lock.locked {
            return Err(HyperTokenError::ZoneLocked(zone_name.to_string()));
        }

        for (i, placement) in zone.placements.iter_mut().enumerate() {
            placement.x = Some(x + (i as f64 * offset_x));
            placement.y = Some(y + (i as f64 * offset_y));
        }

        Ok(())
    }

    /// Arrange tokens in a linear spread
    #[wasm_bindgen(js_name = spread)]
    pub fn spread(
        &mut self,
        zone_name: &str,
        x: f64,
        y: f64,
        spacing: f64,
        horizontal: bool
    ) -> Result<()> {
        let zone = self.state.zones.get_mut(zone_name)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(zone_name.to_string()))?;

        if zone.lock.locked {
            return Err(HyperTokenError::ZoneLocked(zone_name.to_string()));
        }

        for (i, placement) in zone.placements.iter_mut().enumerate() {
            if horizontal {
                placement.x = Some(x + (i as f64 * spacing));
                placement.y = Some(y);
            } else {
                placement.x = Some(x);
                placement.y = Some(y + (i as f64 * spacing));
            }
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
