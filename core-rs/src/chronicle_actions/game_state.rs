// GameState action methods for Chronicle (Phase 2)
//
// Incremental Automerge operations for the gameState section:
// game_state_start, game_state_end, game_state_pause, game_state_resume,
// game_state_next_phase, game_state_set_property
//
// GameState is a flat key-value map at ROOT/gameState with arbitrary properties.

use automerge::{AutomergeError, ReadDoc, transaction::Transactable};
use crate::chronicle::Chronicle;
use crate::chronicle_actions::helpers::*;
use crate::types::{HyperTokenError, Result};
use crate::utils::now;

impl Chronicle {
    /// Start the game: ensure gameState section, set started=true, startTime, phase, turn, ended.
    /// Returns JSON of the initial game state.
    pub fn game_state_start(&mut self) -> Result<String> {
        let gs_id = self.ensure_section("gameState")?;
        let start_time = now();

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.put(&gs_id, "started", true)?;
            tx.put(&gs_id, "startTime", start_time)?;
            tx.put(&gs_id, "phase", "setup")?;
            tx.put(&gs_id, "turn", 0_i64)?;
            tx.put(&gs_id, "ended", false)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.game_state = true;

        let result = serde_json::json!({
            "started": true,
            "startTime": start_time,
            "phase": "setup",
            "turn": 0,
            "ended": false
        });
        Ok(result.to_string())
    }

    /// End the game: set ended=true, endTime, and optional winner.
    /// Returns JSON of the updated game state fields.
    pub fn game_state_end(&mut self, winner: Option<&str>) -> Result<String> {
        let gs_id = self.game_state_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No gameState section".into()))?;
        let end_time = now();
        let winner_str = winner.map(|w| w.to_string());

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.put(&gs_id, "ended", true)?;
            tx.put(&gs_id, "endTime", end_time)?;
            if let Some(ref w) = winner_str {
                tx.put(&gs_id, "winner", w.as_str())?;
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.game_state = true;

        let mut result = serde_json::json!({
            "ended": true,
            "endTime": end_time
        });
        if let Some(w) = winner {
            result["winner"] = serde_json::Value::String(w.to_string());
        }
        Ok(result.to_string())
    }

    /// Pause the game: set paused=true and pauseTime.
    pub fn game_state_pause(&mut self) -> Result<()> {
        let gs_id = self.game_state_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No gameState section".into()))?;
        let pause_time = now();

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.put(&gs_id, "paused", true)?;
            tx.put(&gs_id, "pauseTime", pause_time)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.game_state = true;
        Ok(())
    }

    /// Resume the game: set paused=false.
    pub fn game_state_resume(&mut self) -> Result<()> {
        let gs_id = self.game_state_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No gameState section".into()))?;

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.put(&gs_id, "paused", false)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.game_state = true;
        Ok(())
    }

    /// Set the phase in gameState.
    pub fn game_state_next_phase(&mut self, phase: &str) -> Result<()> {
        let gs_id = self.game_state_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No gameState section".into()))?;
        let phase_str = phase.to_string();

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.put(&gs_id, "phase", phase_str.as_str())?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.game_state = true;
        Ok(())
    }

    /// Set an arbitrary property on the gameState map.
    /// The value is parsed from JSON and written as the appropriate scalar type.
    pub fn game_state_set_property(&mut self, key: &str, value_json: &str) -> Result<()> {
        let gs_id = self.game_state_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No gameState section".into()))?;

        let parsed: serde_json::Value = serde_json::from_str(value_json)
            .map_err(|e| HyperTokenError::SerializationError(format!("Invalid JSON value: {}", e)))?;

        let key_str = key.to_string();

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            match &parsed {
                serde_json::Value::String(s) => { tx.put(&gs_id, key_str.as_str(), s.as_str())?; }
                serde_json::Value::Number(n) => {
                    if let Some(i) = n.as_i64() { tx.put(&gs_id, key_str.as_str(), i)?; }
                    else if let Some(f) = n.as_f64() { tx.put(&gs_id, key_str.as_str(), f)?; }
                }
                serde_json::Value::Bool(b) => { tx.put(&gs_id, key_str.as_str(), *b)?; }
                _ => {
                    let s = serde_json::to_string(&parsed).unwrap_or_default();
                    tx.put(&gs_id, key_str.as_str(), s.as_str())?;
                }
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.game_state = true;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::chronicle::Chronicle;
    use crate::types::HyperTokenState;

    #[test]
    fn test_game_state_start() {
        let mut c = Chronicle::new();

        let result = c.game_state_start().unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["started"], true);
        assert_eq!(parsed["phase"], "setup");
        assert_eq!(parsed["turn"], 0);
        assert_eq!(parsed["ended"], false);
        assert!(parsed["startTime"].as_i64().unwrap() > 0);
        assert!(c.dirty.game_state);

        // Verify via get_state
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let gs = state.gameState.unwrap();
        assert_eq!(gs["started"], true);
        assert_eq!(gs["phase"], "setup");
    }

    #[test]
    fn test_game_state_end() {
        let mut c = Chronicle::new();
        c.game_state_start().unwrap();
        c.dirty.clear();

        let result = c.game_state_end(Some("Alice")).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["ended"], true);
        assert_eq!(parsed["winner"], "Alice");
        assert!(parsed["endTime"].as_i64().unwrap() > 0);
        assert!(c.dirty.game_state);

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let gs = state.gameState.unwrap();
        assert_eq!(gs["ended"], true);
        assert_eq!(gs["winner"], "Alice");
    }

    #[test]
    fn test_game_state_end_no_winner() {
        let mut c = Chronicle::new();
        c.game_state_start().unwrap();

        let result = c.game_state_end(None).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["ended"], true);
        assert!(parsed.get("winner").is_none());
    }

    #[test]
    fn test_game_state_pause_resume() {
        let mut c = Chronicle::new();
        c.game_state_start().unwrap();
        c.dirty.clear();

        c.game_state_pause().unwrap();
        assert!(c.dirty.game_state);

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let gs = state.gameState.unwrap();
        assert_eq!(gs["paused"], true);

        c.game_state_resume().unwrap();

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let gs = state.gameState.unwrap();
        assert_eq!(gs["paused"], false);
    }

    #[test]
    fn test_game_state_next_phase() {
        let mut c = Chronicle::new();
        c.game_state_start().unwrap();
        c.dirty.clear();

        c.game_state_next_phase("betting").unwrap();
        assert!(c.dirty.game_state);

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let gs = state.gameState.unwrap();
        assert_eq!(gs["phase"], "betting");
    }

    #[test]
    fn test_game_state_set_property() {
        let mut c = Chronicle::new();
        c.game_state_start().unwrap();
        c.dirty.clear();

        // Set string property
        c.game_state_set_property("mode", r#""tournament""#).unwrap();
        // Set number property
        c.game_state_set_property("roundNumber", "5").unwrap();
        // Set bool property
        c.game_state_set_property("overtime", "true").unwrap();
        assert!(c.dirty.game_state);

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let gs = state.gameState.unwrap();
        assert_eq!(gs["mode"], "tournament");
        assert_eq!(gs["roundNumber"], 5);
        assert_eq!(gs["overtime"], true);
    }

    #[test]
    fn test_game_state_roundtrip_via_set_state() {
        // Test that gameState survives set_state/get_state roundtrip
        let mut c = Chronicle::new();
        c.set_state(r#"{"gameState":{"started":true,"phase":"play","turn":3}}"#).unwrap();
        c.resolve_section_ids();

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let gs = state.gameState.unwrap();
        assert_eq!(gs["started"], true);
        assert_eq!(gs["phase"], "play");
        assert_eq!(gs["turn"], 3);
    }
}
