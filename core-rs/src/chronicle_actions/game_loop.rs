// GameLoop action methods for Chronicle (Phase 2)
//
// Incremental Automerge operations for the gameLoop section:
// game_loop_init, game_loop_start, game_loop_stop, game_loop_next_turn, game_loop_set_phase

use automerge::{AutomergeError, ReadDoc, transaction::Transactable};
use crate::chronicle::Chronicle;
use crate::chronicle_actions::helpers::*;
use crate::types::{HyperTokenError, Result};

impl Chronicle {
    /// Initialize the gameLoop section with default values.
    pub fn game_loop_init(&mut self, max_turns: i32) -> Result<()> {
        let gl_id = self.ensure_section("gameLoop")?;

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.put(&gl_id, "turn", 0_i64)?;
            tx.put(&gl_id, "running", false)?;
            tx.put(&gl_id, "activeAgentIndex", -1_i64)?;
            tx.put(&gl_id, "phase", "setup")?;
            tx.put(&gl_id, "maxTurns", max_turns as i64)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.game_loop = true;
        Ok(())
    }

    /// Start the game loop: set running=true, turn=0, phase="play", activeAgentIndex=0.
    pub fn game_loop_start(&mut self) -> Result<()> {
        let gl_id = self.game_loop_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No gameLoop section".into()))?;

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.put(&gl_id, "running", true)?;
            tx.put(&gl_id, "turn", 0_i64)?;
            tx.put(&gl_id, "phase", "play")?;
            tx.put(&gl_id, "activeAgentIndex", 0_i64)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.game_loop = true;
        Ok(())
    }

    /// Stop the game loop: set running=false and the given phase.
    pub fn game_loop_stop(&mut self, phase: &str) -> Result<()> {
        let gl_id = self.game_loop_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No gameLoop section".into()))?;

        let phase_str = phase.to_string();

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.put(&gl_id, "running", false)?;
            tx.put(&gl_id, "phase", phase_str.as_str())?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.game_loop = true;
        Ok(())
    }

    /// Advance to the next turn, wrapping the active agent index.
    pub fn game_loop_next_turn(&mut self, agent_count: usize) -> Result<()> {
        let gl_id = self.game_loop_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No gameLoop section".into()))?;

        // Read current values before the transaction
        let current_turn = read_i64_rd(&self.doc, &gl_id, "turn").unwrap_or(0);
        let current_agent = read_i64_rd(&self.doc, &gl_id, "activeAgentIndex").unwrap_or(0);

        let new_turn = current_turn + 1;
        let new_agent = if agent_count > 0 {
            ((current_agent + 1) as usize % agent_count) as i64
        } else {
            0
        };

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.put(&gl_id, "turn", new_turn)?;
            tx.put(&gl_id, "activeAgentIndex", new_agent)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.game_loop = true;
        Ok(())
    }

    /// Set the phase field on the gameLoop.
    pub fn game_loop_set_phase(&mut self, phase: &str) -> Result<()> {
        let gl_id = self.game_loop_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No gameLoop section".into()))?;

        let phase_str = phase.to_string();

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.put(&gl_id, "phase", phase_str.as_str())?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.game_loop = true;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::chronicle::Chronicle;
    use crate::types::HyperTokenState;

    #[test]
    fn test_game_loop_init() {
        let mut c = Chronicle::new();

        c.game_loop_init(10).unwrap();
        assert!(c.dirty.game_loop);

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let gl = state.gameLoop.unwrap();
        assert_eq!(gl.turn, 0);
        assert!(!gl.running);
        assert_eq!(gl.activeAgentIndex, -1);
        assert_eq!(gl.phase, "setup");
        assert_eq!(gl.maxTurns, 10);
    }

    #[test]
    fn test_game_loop_start() {
        let mut c = Chronicle::new();
        c.game_loop_init(10).unwrap();
        c.dirty.clear();

        c.game_loop_start().unwrap();
        assert!(c.dirty.game_loop);

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let gl = state.gameLoop.unwrap();
        assert!(gl.running);
        assert_eq!(gl.turn, 0);
        assert_eq!(gl.phase, "play");
        assert_eq!(gl.activeAgentIndex, 0);
    }

    #[test]
    fn test_game_loop_next_turn_wraps() {
        let mut c = Chronicle::new();
        c.game_loop_init(100).unwrap();
        c.game_loop_start().unwrap();
        c.dirty.clear();

        // 3 agents: agent indices cycle 0, 1, 2, 0, 1, 2, ...
        c.game_loop_next_turn(3).unwrap(); // turn 1, agent 1
        c.game_loop_next_turn(3).unwrap(); // turn 2, agent 2
        c.game_loop_next_turn(3).unwrap(); // turn 3, agent 0 (wrap)
        assert!(c.dirty.game_loop);

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let gl = state.gameLoop.unwrap();
        assert_eq!(gl.turn, 3);
        assert_eq!(gl.activeAgentIndex, 0); // wrapped back to 0
    }

    #[test]
    fn test_game_loop_stop() {
        let mut c = Chronicle::new();
        c.game_loop_init(10).unwrap();
        c.game_loop_start().unwrap();
        c.dirty.clear();

        c.game_loop_stop("finished").unwrap();
        assert!(c.dirty.game_loop);

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let gl = state.gameLoop.unwrap();
        assert!(!gl.running);
        assert_eq!(gl.phase, "finished");
    }

    #[test]
    fn test_game_loop_set_phase() {
        let mut c = Chronicle::new();
        c.game_loop_init(10).unwrap();
        c.dirty.clear();

        c.game_loop_set_phase("betting").unwrap();
        assert!(c.dirty.game_loop);

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let gl = state.gameLoop.unwrap();
        assert_eq!(gl.phase, "betting");
    }
}
