// Rules action methods for Chronicle (Phase 2)
//
// Incremental Automerge operations for the rules section:
// rule_mark_fired

use automerge::{AutomergeError, ReadDoc, transaction::Transactable};
use crate::chronicle::Chronicle;
use crate::chronicle_actions::helpers::*;
use crate::types::{HyperTokenError, Result};

impl Chronicle {
    /// Mark a rule as fired with the given timestamp.
    /// Writes to rules/fired/{rule_name} = timestamp.
    pub fn rule_mark_fired(&mut self, rule_name: &str, timestamp: i64) -> Result<()> {
        let rules_id = self.rules_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No rules initialized".into()))?;
        let name = rule_name.to_string();

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            if let Ok(Some((_, fired_id))) = tx.get(&rules_id, "fired") {
                tx.put(&fired_id, name.as_str(), timestamp)?;
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.rules = true;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::chronicle::Chronicle;
    use crate::types::HyperTokenState;

    #[test]
    fn test_rule_mark_fired() {
        let mut c = Chronicle::new();
        c.set_state(r#"{"rules":{"fired":{}}}"#).unwrap();
        c.resolve_section_ids();
        c.dirty.clear();

        c.rule_mark_fired("win_check", 1234567890).unwrap();

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        assert_eq!(state.rules.unwrap().fired["win_check"], 1234567890);
        assert!(c.dirty.rules);
    }

    #[test]
    fn test_rule_mark_fired_multiple() {
        let mut c = Chronicle::new();
        c.set_state(r#"{"rules":{"fired":{}}}"#).unwrap();
        c.resolve_section_ids();

        c.rule_mark_fired("rule_a", 1000).unwrap();
        c.rule_mark_fired("rule_b", 2000).unwrap();
        c.rule_mark_fired("rule_a", 3000).unwrap(); // overwrite

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let fired = &state.rules.unwrap().fired;
        assert_eq!(fired["rule_a"], 3000); // latest timestamp
        assert_eq!(fired["rule_b"], 2000);
    }

    #[test]
    fn test_rule_mark_fired_no_rules_section() {
        let mut c = Chronicle::new();
        // No rules section initialized
        let result = c.rule_mark_fired("test", 1000);
        assert!(result.is_err());
    }
}
