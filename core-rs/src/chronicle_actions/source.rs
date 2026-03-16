// Source action methods for Chronicle (Phase 2)
//
// Incremental Automerge operations for the source section:
// source_draw, source_shuffle, source_burn, source_add_stack,
// source_remove_stack, source_reset, source_set_reshuffle_policy

use automerge::{AutomergeError, ObjType, ReadDoc, transaction::Transactable};
use crate::chronicle::Chronicle;
use crate::chronicle_actions::helpers::{read_token_list_rd, read_list_string_rd, write_token_tx};
use crate::types::{HyperTokenError, IToken, Result};
use crate::utils::shuffle_vec;

impl Chronicle {
    /// Draw N tokens from the end of the source tokens list.
    /// Returns JSON array of drawn tokens.
    pub fn source_draw(&mut self, count: usize) -> Result<String> {
        let source_id = self.source_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No source section".into()))?;

        let tokens_list_id = self.doc.get(&source_id, "tokens")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No tokens list in source".into()))?;

        let tokens = read_token_list_rd(&self.doc, &tokens_list_id);
        let len = tokens.len();

        if count > len {
            return Err(HyperTokenError::InvalidOperation(
                format!("Cannot draw {} from source of {}", count, len),
            ));
        }

        let drawn_tokens: Vec<IToken> = tokens[len - count..].to_vec();

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            for i in (len - count..len).rev() {
                tx.delete(&tokens_list_id, i)?;
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.source = true;

        serde_json::to_string(&drawn_tokens)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Shuffle the source tokens in-place.
    pub fn source_shuffle(&mut self, seed: Option<String>) -> Result<()> {
        let source_id = self.source_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No source section".into()))?;

        let tokens_list_id = self.doc.get(&source_id, "tokens")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No tokens list in source".into()))?;

        let mut tokens = read_token_list_rd(&self.doc, &tokens_list_id);
        shuffle_vec(&mut tokens, seed.as_deref());

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            let len = tx.length(&tokens_list_id);
            for i in (0..len).rev() {
                tx.delete(&tokens_list_id, i)?;
            }
            for (i, token) in tokens.iter().enumerate() {
                let obj = tx.insert_object(&tokens_list_id, i, ObjType::Map)?;
                write_token_tx(tx, &obj, token)?;
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.source = true;
        Ok(())
    }

    /// Burn N tokens from the end of source tokens into burned.
    /// Returns JSON array of burned tokens.
    pub fn source_burn(&mut self, count: usize) -> Result<String> {
        let source_id = self.source_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No source section".into()))?;

        let tokens_list_id = self.doc.get(&source_id, "tokens")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No tokens list in source".into()))?;
        let burned_list_id = self.doc.get(&source_id, "burned")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No burned list in source".into()))?;

        let tokens = read_token_list_rd(&self.doc, &tokens_list_id);
        let len = tokens.len();

        if count > len {
            return Err(HyperTokenError::InvalidOperation(
                format!("Cannot burn {} from source of {}", count, len),
            ));
        }

        let burned_tokens: Vec<IToken> = tokens[len - count..].to_vec();
        let existing_burned_len = self.doc.length(&burned_list_id);

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            for i in (len - count..len).rev() {
                tx.delete(&tokens_list_id, i)?;
            }
            for (i, token) in burned_tokens.iter().enumerate() {
                let obj = tx.insert_object(&burned_list_id, existing_burned_len + i, ObjType::Map)?;
                write_token_tx(tx, &obj, token)?;
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.source = true;

        serde_json::to_string(&burned_tokens)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Add a stack of tokens to the source. Appends tokens to the tokens list
    /// and adds stack_id to the stackIds list.
    pub fn source_add_stack(&mut self, tokens_json: &str, stack_id_str: &str) -> Result<()> {
        let source_id = self.source_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No source section".into()))?;

        let tokens_list_id = self.doc.get(&source_id, "tokens")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No tokens list in source".into()))?;
        let stack_ids_list_id = self.doc.get(&source_id, "stackIds")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stackIds list in source".into()))?;

        let new_tokens: Vec<IToken> = serde_json::from_str(tokens_json)
            .map_err(|e| HyperTokenError::SerializationError(format!("Invalid tokens JSON: {}", e)))?;

        let tokens_len = self.doc.length(&tokens_list_id);
        let stack_ids_len = self.doc.length(&stack_ids_list_id);

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            // Append tokens
            for (i, token) in new_tokens.iter().enumerate() {
                let obj = tx.insert_object(&tokens_list_id, tokens_len + i, ObjType::Map)?;
                write_token_tx(tx, &obj, token)?;
            }
            // Append stack_id
            tx.insert(&stack_ids_list_id, stack_ids_len, stack_id_str)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.source = true;
        Ok(())
    }

    /// Remove a stack from the source. Removes stack_id from stackIds and
    /// removes all tokens whose group matches the stack_id.
    pub fn source_remove_stack(&mut self, stack_id_str: &str) -> Result<()> {
        let source_id = self.source_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No source section".into()))?;

        let tokens_list_id = self.doc.get(&source_id, "tokens")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No tokens list in source".into()))?;
        let stack_ids_list_id = self.doc.get(&source_id, "stackIds")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stackIds list in source".into()))?;

        // Find stack_id index in stackIds
        let stack_ids_len = self.doc.length(&stack_ids_list_id);
        let mut stack_id_idx = None;
        for i in 0..stack_ids_len {
            if let Some(s) = read_list_string_rd(&self.doc, &stack_ids_list_id, i) {
                if s == stack_id_str {
                    stack_id_idx = Some(i);
                    break;
                }
            }
        }

        // Find token indices to remove (those with matching group)
        let tokens = read_token_list_rd(&self.doc, &tokens_list_id);
        let remove_indices: Vec<usize> = tokens.iter().enumerate()
            .filter(|(_, t)| t.group.as_deref() == Some(stack_id_str))
            .map(|(i, _)| i)
            .collect();

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            // Remove tokens in reverse order to keep indices valid
            for &idx in remove_indices.iter().rev() {
                tx.delete(&tokens_list_id, idx)?;
            }
            // Remove stack_id
            if let Some(idx) = stack_id_idx {
                tx.delete(&stack_ids_list_id, idx)?;
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.source = true;
        Ok(())
    }

    /// Reset the source: replace tokens with new ones, clear burned.
    pub fn source_reset(&mut self, tokens_json: &str) -> Result<()> {
        let source_id = self.source_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No source section".into()))?;

        let tokens_list_id = self.doc.get(&source_id, "tokens")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No tokens list in source".into()))?;
        let burned_list_id = self.doc.get(&source_id, "burned")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No burned list in source".into()))?;

        let new_tokens: Vec<IToken> = serde_json::from_str(tokens_json)
            .map_err(|e| HyperTokenError::SerializationError(format!("Invalid tokens JSON: {}", e)))?;

        let old_tokens_len = self.doc.length(&tokens_list_id);
        let old_burned_len = self.doc.length(&burned_list_id);

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            // Clear existing tokens
            for i in (0..old_tokens_len).rev() {
                tx.delete(&tokens_list_id, i)?;
            }
            // Write new tokens
            for (i, token) in new_tokens.iter().enumerate() {
                let obj = tx.insert_object(&tokens_list_id, i, ObjType::Map)?;
                write_token_tx(tx, &obj, token)?;
            }
            // Clear burned
            for i in (0..old_burned_len).rev() {
                tx.delete(&burned_list_id, i)?;
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.source = true;
        Ok(())
    }

    /// Set the reshuffle policy (threshold and mode).
    pub fn source_set_reshuffle_policy(&mut self, threshold: i32, mode: &str) -> Result<()> {
        let source_id = self.source_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No source section".into()))?;

        let policy_id = self.doc.get(&source_id, "reshufflePolicy")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No reshufflePolicy in source".into()))?;

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.put(&policy_id, "threshold", threshold as i64)?;
            tx.put(&policy_id, "mode", mode)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.source = true;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::chronicle::Chronicle;
    use crate::types::HyperTokenState;

    fn init_source_chronicle() -> Chronicle {
        let mut c = Chronicle::new();
        c.set_state(r#"{"source":{"stackIds":["s1"],"tokens":[
            {"id":"t1","text":"","char":"□","kind":"default","index":0,"meta":{}},
            {"id":"t2","text":"","char":"□","kind":"default","index":1,"meta":{}},
            {"id":"t3","text":"","char":"□","kind":"default","index":2,"meta":{}}
        ],"burned":[],"seed":null,"reshufflePolicy":{"mode":"auto"}}}"#).unwrap();
        c.resolve_section_ids();
        c.dirty.clear();
        c
    }

    #[test]
    fn test_source_draw() {
        let mut c = init_source_chronicle();
        let drawn_json = c.source_draw(2).unwrap();
        let drawn: Vec<serde_json::Value> = serde_json::from_str(&drawn_json).unwrap();
        assert_eq!(drawn.len(), 2);
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let source = state.source.unwrap();
        assert_eq!(source.tokens.len(), 1);
        assert!(c.dirty.source);
        assert!(!c.dirty.stack);
    }

    #[test]
    fn test_source_draw_overflow() {
        let mut c = init_source_chronicle();
        let result = c.source_draw(10);
        assert!(result.is_err());
    }

    #[test]
    fn test_source_shuffle() {
        let mut c = init_source_chronicle();
        c.source_shuffle(Some("seed42".to_string())).unwrap();
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let source = state.source.unwrap();
        assert_eq!(source.tokens.len(), 3);
        assert!(c.dirty.source);
    }

    #[test]
    fn test_source_burn() {
        let mut c = init_source_chronicle();
        let burned_json = c.source_burn(1).unwrap();
        let burned: Vec<serde_json::Value> = serde_json::from_str(&burned_json).unwrap();
        assert_eq!(burned.len(), 1);
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let source = state.source.unwrap();
        assert_eq!(source.tokens.len(), 2);
        assert_eq!(source.burned.len(), 1);
        assert_eq!(source.burned[0].id, "t3");
        assert!(c.dirty.source);
    }

    #[test]
    fn test_source_burn_overflow() {
        let mut c = init_source_chronicle();
        let result = c.source_burn(10);
        assert!(result.is_err());
    }

    #[test]
    fn test_source_add_stack() {
        let mut c = init_source_chronicle();
        let tokens_json = r#"[
            {"id":"t4","text":"","char":"□","kind":"default","index":3,"group":"s2","meta":{}},
            {"id":"t5","text":"","char":"□","kind":"default","index":4,"group":"s2","meta":{}}
        ]"#;
        c.source_add_stack(tokens_json, "s2").unwrap();
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let source = state.source.unwrap();
        assert_eq!(source.tokens.len(), 5);
        assert_eq!(source.stackIds.len(), 2);
        assert_eq!(source.stackIds[1], "s2");
        assert!(c.dirty.source);
    }

    #[test]
    fn test_source_remove_stack() {
        let mut c = Chronicle::new();
        c.set_state(r#"{"source":{"stackIds":["s1","s2"],"tokens":[
            {"id":"t1","text":"","char":"□","kind":"default","index":0,"group":"s1","meta":{}},
            {"id":"t2","text":"","char":"□","kind":"default","index":1,"group":"s1","meta":{}},
            {"id":"t3","text":"","char":"□","kind":"default","index":2,"group":"s2","meta":{}}
        ],"burned":[],"seed":null,"reshufflePolicy":{"mode":"auto"}}}"#).unwrap();
        c.resolve_section_ids();
        c.dirty.clear();

        c.source_remove_stack("s1").unwrap();
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let source = state.source.unwrap();
        assert_eq!(source.tokens.len(), 1);
        assert_eq!(source.tokens[0].id, "t3");
        assert_eq!(source.stackIds.len(), 1);
        assert_eq!(source.stackIds[0], "s2");
        assert!(c.dirty.source);
    }

    #[test]
    fn test_source_reset() {
        let mut c = init_source_chronicle();
        c.source_burn(1).unwrap();
        c.dirty.clear();

        let new_tokens_json = r#"[
            {"id":"t10","text":"","char":"□","kind":"default","index":0,"meta":{}},
            {"id":"t11","text":"","char":"□","kind":"default","index":1,"meta":{}}
        ]"#;
        c.source_reset(new_tokens_json).unwrap();
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let source = state.source.unwrap();
        assert_eq!(source.tokens.len(), 2);
        assert_eq!(source.tokens[0].id, "t10");
        assert_eq!(source.burned.len(), 0);
        assert!(c.dirty.source);
    }

    #[test]
    fn test_source_set_reshuffle_policy() {
        let mut c = init_source_chronicle();
        c.source_set_reshuffle_policy(5, "manual").unwrap();
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let source = state.source.unwrap();
        assert_eq!(source.reshufflePolicy.threshold, Some(5));
        assert_eq!(source.reshufflePolicy.mode, "manual");
        assert!(c.dirty.source);
    }
}
