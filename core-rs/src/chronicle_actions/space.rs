// Space action methods for Chronicle (Phase 2)
//
// Incremental Automerge operations for the zones section:
// space_place, space_move, space_remove, space_flip, space_create_zone,
// space_delete_zone, space_clear_zone, space_lock_zone, space_shuffle_zone,
// space_transfer_zone, space_clear

use automerge::{AutomergeError, ObjType, ReadDoc, transaction::Transactable};
use crate::chronicle::Chronicle;
use crate::chronicle_actions::helpers::{read_placement_rd, write_placement_tx};
use crate::types::{HyperTokenError, IPlacementCRDT, IToken, Result};
use crate::utils::{generate_id, now, shuffle_vec};

impl Chronicle {
    /// Place a token into a zone. Creates an IPlacementCRDT and appends to the zone list.
    /// Returns placement JSON.
    pub fn space_place(
        &mut self,
        zone: &str,
        token_json: &str,
        x: Option<f64>,
        y: Option<f64>,
    ) -> Result<String> {
        let zones_id = self.zones_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No zones section".into()))?;

        let token: IToken = serde_json::from_str(token_json)
            .map_err(|e| HyperTokenError::SerializationError(format!("Invalid token JSON: {}", e)))?;

        // Check for zone lock
        if let Ok(Some((automerge::Value::Scalar(s), _))) =
            self.doc.get(&zones_id, &format!("_lock:{}", zone))
        {
            if let automerge::ScalarValue::Boolean(true) = s.as_ref() {
                return Err(HyperTokenError::ZoneLocked(zone.to_string()));
            }
        }

        let zone_list_id = self.doc.get(&zones_id, zone)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(zone.to_string()))?;

        let zone_len = self.doc.length(&zone_list_id);

        let placement = IPlacementCRDT {
            id: generate_id(),
            tokenId: token.id.clone(),
            tokenSnapshot: token.clone(),
            x,
            y,
            faceUp: true,
            label: token.label.clone(),
            ts: now(),
            reversed: false,
            tags: Vec::new(),
        };

        let placement_clone = placement.clone();

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            let p_obj = tx.insert_object(&zone_list_id, zone_len, ObjType::Map)?;
            write_placement_tx(tx, &p_obj, &placement_clone)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.zones = true;

        serde_json::to_string(&placement)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Move a placement from one zone to another by placement ID.
    pub fn space_move(
        &mut self,
        placement_id: &str,
        from_zone: &str,
        to_zone: &str,
    ) -> Result<()> {
        let zones_id = self.zones_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No zones section".into()))?;

        // Check locks
        for zone_name in &[from_zone, to_zone] {
            if let Ok(Some((automerge::Value::Scalar(s), _))) =
                self.doc.get(&zones_id, &format!("_lock:{}", zone_name))
            {
                if let automerge::ScalarValue::Boolean(true) = s.as_ref() {
                    return Err(HyperTokenError::ZoneLocked(zone_name.to_string()));
                }
            }
        }

        let from_list_id = self.doc.get(&zones_id, from_zone)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(from_zone.to_string()))?;

        let to_list_id = self.doc.get(&zones_id, to_zone)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(to_zone.to_string()))?;

        // Read placements from from_zone to find the index
        let from_len = self.doc.length(&from_list_id);
        let mut found_idx = None;
        let mut found_placement = None;

        for i in 0..from_len {
            if let Ok(Some((_, p_obj_id))) = self.doc.get(&from_list_id, i) {
                let p = read_placement_rd(&self.doc, &p_obj_id);
                if p.id == placement_id {
                    found_idx = Some(i);
                    found_placement = Some(p);
                    break;
                }
            }
        }

        let idx = found_idx
            .ok_or_else(|| HyperTokenError::TokenNotFound(placement_id.to_string()))?;
        let placement = found_placement.unwrap();
        let to_len = self.doc.length(&to_list_id);

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.delete(&from_list_id, idx)?;
            let p_obj = tx.insert_object(&to_list_id, to_len, ObjType::Map)?;
            write_placement_tx(tx, &p_obj, &placement)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.zones = true;
        Ok(())
    }

    /// Remove a placement from a zone by placement ID. Returns the placement JSON.
    pub fn space_remove(&mut self, zone: &str, placement_id: &str) -> Result<String> {
        let zones_id = self.zones_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No zones section".into()))?;

        let zone_list_id = self.doc.get(&zones_id, zone)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(zone.to_string()))?;

        let zone_len = self.doc.length(&zone_list_id);
        let mut found_idx = None;
        let mut found_placement = None;

        for i in 0..zone_len {
            if let Ok(Some((_, p_obj_id))) = self.doc.get(&zone_list_id, i) {
                let p = read_placement_rd(&self.doc, &p_obj_id);
                if p.id == placement_id {
                    found_idx = Some(i);
                    found_placement = Some(p);
                    break;
                }
            }
        }

        let idx = found_idx
            .ok_or_else(|| HyperTokenError::TokenNotFound(placement_id.to_string()))?;
        let placement = found_placement.unwrap();

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.delete(&zone_list_id, idx)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.zones = true;

        serde_json::to_string(&placement)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Flip a placement: toggle reversed and faceUp.
    pub fn space_flip(&mut self, zone: &str, placement_id: &str) -> Result<()> {
        let zones_id = self.zones_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No zones section".into()))?;

        let zone_list_id = self.doc.get(&zones_id, zone)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(zone.to_string()))?;

        let zone_len = self.doc.length(&zone_list_id);
        let mut found_obj_id = None;
        let mut old_reversed = false;
        let mut old_face_up = true;

        for i in 0..zone_len {
            if let Ok(Some((_, p_obj_id))) = self.doc.get(&zone_list_id, i) {
                let p = read_placement_rd(&self.doc, &p_obj_id);
                if p.id == placement_id {
                    old_reversed = p.reversed;
                    old_face_up = p.faceUp;
                    found_obj_id = Some(p_obj_id);
                    break;
                }
            }
        }

        let obj_id = found_obj_id
            .ok_or_else(|| HyperTokenError::TokenNotFound(placement_id.to_string()))?;

        let new_reversed = !old_reversed;
        let new_face_up = !old_face_up;

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.put(&obj_id, "reversed", new_reversed)?;
            tx.put(&obj_id, "faceUp", new_face_up)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.zones = true;
        Ok(())
    }

    /// Create a new empty zone.
    pub fn space_create_zone(&mut self, zone_name: &str) -> Result<()> {
        let zones_id = self.zones_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No zones section".into()))?;

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.put_object(&zones_id, zone_name, ObjType::List)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.zones = true;
        Ok(())
    }

    /// Delete a zone entirely.
    pub fn space_delete_zone(&mut self, zone_name: &str) -> Result<()> {
        let zones_id = self.zones_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No zones section".into()))?;

        // Verify zone exists
        self.doc.get(&zones_id, zone_name)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::ZoneNotFound(zone_name.to_string()))?;

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.delete(&zones_id, zone_name)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.zones = true;
        Ok(())
    }

    /// Clear all placements from a zone (keep the zone, empty the list).
    pub fn space_clear_zone(&mut self, zone_name: &str) -> Result<()> {
        let zones_id = self.zones_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No zones section".into()))?;

        let zone_list_id = self.doc.get(&zones_id, zone_name)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(zone_name.to_string()))?;

        let len = self.doc.length(&zone_list_id);

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            for i in (0..len).rev() {
                tx.delete(&zone_list_id, i)?;
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.zones = true;
        Ok(())
    }

    /// Lock or unlock a zone by setting _lock:<zone_name> boolean.
    pub fn space_lock_zone(&mut self, zone_name: &str, locked: bool) -> Result<()> {
        let zones_id = self.zones_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No zones section".into()))?;

        let lock_key = format!("_lock:{}", zone_name);

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.put(&zones_id, lock_key.as_str(), locked)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.zones = true;
        Ok(())
    }

    /// Shuffle placements within a zone.
    pub fn space_shuffle_zone(&mut self, zone_name: &str, seed: Option<String>) -> Result<()> {
        let zones_id = self.zones_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No zones section".into()))?;

        let zone_list_id = self.doc.get(&zones_id, zone_name)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(zone_name.to_string()))?;

        // Read all placements
        let zone_len = self.doc.length(&zone_list_id);
        let mut placements = Vec::with_capacity(zone_len);
        for i in 0..zone_len {
            if let Ok(Some((_, p_obj_id))) = self.doc.get(&zone_list_id, i) {
                placements.push(read_placement_rd(&self.doc, &p_obj_id));
            }
        }

        shuffle_vec(&mut placements, seed.as_deref());

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            for i in (0..zone_len).rev() {
                tx.delete(&zone_list_id, i)?;
            }
            for (i, p) in placements.iter().enumerate() {
                let p_obj = tx.insert_object(&zone_list_id, i, ObjType::Map)?;
                write_placement_tx(tx, &p_obj, p)?;
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.zones = true;
        Ok(())
    }

    /// Transfer all placements from one zone to another.
    pub fn space_transfer_zone(&mut self, from_zone: &str, to_zone: &str) -> Result<()> {
        let zones_id = self.zones_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No zones section".into()))?;

        let from_list_id = self.doc.get(&zones_id, from_zone)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(from_zone.to_string()))?;

        let to_list_id = self.doc.get(&zones_id, to_zone)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::ZoneNotFound(to_zone.to_string()))?;

        // Read all placements from source
        let from_len = self.doc.length(&from_list_id);
        let mut placements = Vec::with_capacity(from_len);
        for i in 0..from_len {
            if let Ok(Some((_, p_obj_id))) = self.doc.get(&from_list_id, i) {
                placements.push(read_placement_rd(&self.doc, &p_obj_id));
            }
        }

        let to_len = self.doc.length(&to_list_id);

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            // Delete all from source
            for i in (0..from_len).rev() {
                tx.delete(&from_list_id, i)?;
            }
            // Append to target
            for (i, p) in placements.iter().enumerate() {
                let p_obj = tx.insert_object(&to_list_id, to_len + i, ObjType::Map)?;
                write_placement_tx(tx, &p_obj, p)?;
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.zones = true;
        Ok(())
    }

    /// Clear all zones entirely. Deletes all zone entries and recreates an empty zones map.
    pub fn space_clear(&mut self) -> Result<()> {
        // Recreate the zones section as empty
        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.put_object(automerge::ROOT, "zones", ObjType::Map)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        // Update the cached zones_id
        self.resolve_section_ids();
        self.dirty.zones = true;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::chronicle::Chronicle;
    use crate::types::HyperTokenState;

    fn init_space_chronicle() -> Chronicle {
        let mut c = Chronicle::new();
        c.set_state(r#"{"zones":{"hand":[],"table":[]}}"#).unwrap();
        c.resolve_section_ids();
        c.dirty.clear();
        c
    }

    fn place_token(c: &mut Chronicle, zone: &str, id: &str) -> String {
        let token_json = format!(
            r#"{{"id":"{}","text":"{}","char":"{}","kind":"card","index":0,"meta":{{}}}}"#,
            id, id, id
        );
        c.space_place(zone, &token_json, Some(10.0), Some(20.0)).unwrap()
    }

    #[test]
    fn test_space_place() {
        let mut c = init_space_chronicle();
        let token_json = r#"{"id":"t1","text":"A","char":"A","kind":"card","index":0,"meta":{}}"#;
        let result = c.space_place("hand", token_json, Some(10.0), Some(20.0)).unwrap();
        let placement: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(placement["tokenId"], "t1");
        assert_eq!(placement["x"], 10.0);
        assert_eq!(placement["y"], 20.0);
        assert_eq!(placement["faceUp"], true);
        assert_eq!(placement["reversed"], false);
        assert!(c.dirty.zones);
        assert!(!c.dirty.stack);

        // Verify in state
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let zones = state.zones.unwrap();
        assert_eq!(zones["hand"].len(), 1);
    }

    #[test]
    fn test_space_place_zone_not_found() {
        let mut c = init_space_chronicle();
        let token_json = r#"{"id":"t1","text":"A","char":"A","kind":"card","index":0,"meta":{}}"#;
        let result = c.space_place("nonexistent", token_json, None, None);
        assert!(result.is_err());
    }

    #[test]
    fn test_space_move() {
        let mut c = init_space_chronicle();
        let result_json = place_token(&mut c, "hand", "t1");
        let placement: serde_json::Value = serde_json::from_str(&result_json).unwrap();
        let placement_id = placement["id"].as_str().unwrap();

        c.dirty.clear();
        c.space_move(placement_id, "hand", "table").unwrap();

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let zones = state.zones.unwrap();
        assert_eq!(zones["hand"].len(), 0);
        assert_eq!(zones["table"].len(), 1);
        assert_eq!(zones["table"][0].tokenId, "t1");
        assert!(c.dirty.zones);
    }

    #[test]
    fn test_space_move_not_found() {
        let mut c = init_space_chronicle();
        let result = c.space_move("nonexistent", "hand", "table");
        assert!(result.is_err());
    }

    #[test]
    fn test_space_remove() {
        let mut c = init_space_chronicle();
        let result_json = place_token(&mut c, "hand", "t1");
        let placement: serde_json::Value = serde_json::from_str(&result_json).unwrap();
        let placement_id = placement["id"].as_str().unwrap();

        c.dirty.clear();
        let removed_json = c.space_remove("hand", placement_id).unwrap();
        let removed: serde_json::Value = serde_json::from_str(&removed_json).unwrap();
        assert_eq!(removed["tokenId"], "t1");

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let zones = state.zones.unwrap();
        assert_eq!(zones["hand"].len(), 0);
        assert!(c.dirty.zones);
    }

    #[test]
    fn test_space_remove_not_found() {
        let mut c = init_space_chronicle();
        let result = c.space_remove("hand", "nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_space_flip() {
        let mut c = init_space_chronicle();
        let result_json = place_token(&mut c, "hand", "t1");
        let placement: serde_json::Value = serde_json::from_str(&result_json).unwrap();
        let placement_id = placement["id"].as_str().unwrap();

        c.dirty.clear();
        c.space_flip("hand", placement_id).unwrap();

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let zones = state.zones.unwrap();
        let p = &zones["hand"][0];
        assert_eq!(p.faceUp, false);
        assert_eq!(p.reversed, true);
        assert!(c.dirty.zones);

        // Flip again
        c.space_flip("hand", placement_id).unwrap();
        let state_json2 = c.get_state().unwrap();
        let state2: HyperTokenState = serde_json::from_str(&state_json2).unwrap();
        let zones2 = state2.zones.unwrap();
        let p2 = &zones2["hand"][0];
        assert_eq!(p2.faceUp, true);
        assert_eq!(p2.reversed, false);
    }

    #[test]
    fn test_space_create_zone() {
        let mut c = init_space_chronicle();
        c.space_create_zone("discard_pile").unwrap();
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        assert!(state.zones.unwrap().contains_key("discard_pile"));
        assert!(c.dirty.zones);
    }

    #[test]
    fn test_space_delete_zone() {
        let mut c = init_space_chronicle();
        c.space_delete_zone("hand").unwrap();
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let zones = state.zones.unwrap();
        assert!(!zones.contains_key("hand"));
        assert!(zones.contains_key("table"));
        assert!(c.dirty.zones);
    }

    #[test]
    fn test_space_delete_zone_not_found() {
        let mut c = init_space_chronicle();
        let result = c.space_delete_zone("nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_space_clear_zone() {
        let mut c = init_space_chronicle();
        place_token(&mut c, "hand", "t1");
        place_token(&mut c, "hand", "t2");

        c.dirty.clear();
        c.space_clear_zone("hand").unwrap();

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let zones = state.zones.unwrap();
        assert_eq!(zones["hand"].len(), 0);
        assert!(c.dirty.zones);
    }

    #[test]
    fn test_space_lock_zone() {
        let mut c = init_space_chronicle();
        c.space_lock_zone("hand", true).unwrap();

        // Try to place into locked zone
        let token_json = r#"{"id":"t1","text":"A","char":"A","kind":"card","index":0,"meta":{}}"#;
        let result = c.space_place("hand", token_json, None, None);
        assert!(result.is_err());

        // Unlock
        c.space_lock_zone("hand", false).unwrap();
        let result2 = c.space_place("hand", token_json, None, None);
        assert!(result2.is_ok());
        assert!(c.dirty.zones);
    }

    #[test]
    fn test_space_shuffle_zone() {
        let mut c = init_space_chronicle();
        for i in 0..10 {
            place_token(&mut c, "hand", &format!("t{}", i));
        }

        c.dirty.clear();
        c.space_shuffle_zone("hand", Some("seed42".to_string())).unwrap();

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let zones = state.zones.unwrap();
        assert_eq!(zones["hand"].len(), 10);
        assert!(c.dirty.zones);
    }

    #[test]
    fn test_space_transfer_zone() {
        let mut c = init_space_chronicle();
        place_token(&mut c, "hand", "t1");
        place_token(&mut c, "hand", "t2");

        c.dirty.clear();
        c.space_transfer_zone("hand", "table").unwrap();

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let zones = state.zones.unwrap();
        assert_eq!(zones["hand"].len(), 0);
        assert_eq!(zones["table"].len(), 2);
        assert!(c.dirty.zones);
    }

    #[test]
    fn test_space_clear() {
        let mut c = init_space_chronicle();
        place_token(&mut c, "hand", "t1");
        place_token(&mut c, "table", "t2");

        c.dirty.clear();
        c.space_clear().unwrap();

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let zones = state.zones.unwrap();
        assert!(zones.is_empty());
        assert!(c.dirty.zones);
    }
}
