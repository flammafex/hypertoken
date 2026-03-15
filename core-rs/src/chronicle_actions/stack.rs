// Stack action methods for Chronicle (Phase 2)
//
// Incremental Automerge operations for the stack section:
// stack_draw, stack_shuffle, stack_burn, stack_cut, stack_reset,
// stack_discard, stack_insert_at, stack_remove_at, stack_swap, stack_reverse

use automerge::{AutomergeError, ObjType, ReadDoc, transaction::Transactable};
use crate::chronicle::Chronicle;
use crate::chronicle_actions::helpers::{read_token_list_rd, write_token_tx};
use crate::types::{HyperTokenError, IToken, Result};
use crate::utils::shuffle_vec;

impl Chronicle {
    /// Draw N tokens from the end of the stack list into drawn.
    /// Returns JSON array of drawn tokens.
    pub fn stack_draw(&mut self, count: usize) -> Result<String> {
        let stack_id = self.stack_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack section".into()))?;

        // Read the stack and drawn list IDs, then read tokens
        let stack_list_id = self.doc.get(&stack_id, "stack")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack list".into()))?;
        let drawn_list_id = self.doc.get(&stack_id, "drawn")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No drawn list".into()))?;

        let tokens = read_token_list_rd(&self.doc, &stack_list_id);
        let stack_len = tokens.len();

        if count > stack_len {
            return Err(HyperTokenError::InvalidOperation(
                format!("Cannot draw {} from stack of {}", count, stack_len),
            ));
        }

        let drawn_tokens: Vec<IToken> = tokens[stack_len - count..].to_vec();
        let existing_drawn_len = self.doc.length(&drawn_list_id);

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            // Remove from end of stack (in reverse order to keep indices valid)
            for i in (stack_len - count..stack_len).rev() {
                tx.delete(&stack_list_id, i)?;
            }
            // Append to drawn list
            for (i, token) in drawn_tokens.iter().enumerate() {
                let obj = tx.insert_object(&drawn_list_id, existing_drawn_len + i, ObjType::Map)?;
                write_token_tx(tx, &obj, token)?;
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.stack = true;

        serde_json::to_string(&drawn_tokens)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Shuffle the stack in-place using Fisher-Yates.
    pub fn stack_shuffle(&mut self, seed: Option<String>) -> Result<()> {
        let stack_id = self.stack_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack section".into()))?;

        let stack_list_id = self.doc.get(&stack_id, "stack")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack list".into()))?;

        let mut tokens = read_token_list_rd(&self.doc, &stack_list_id);
        shuffle_vec(&mut tokens, seed.as_deref());

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            // Clear existing list
            let len = tx.length(&stack_list_id);
            for i in (0..len).rev() {
                tx.delete(&stack_list_id, i)?;
            }
            // Rewrite with shuffled order
            for (i, token) in tokens.iter().enumerate() {
                let obj = tx.insert_object(&stack_list_id, i, ObjType::Map)?;
                write_token_tx(tx, &obj, token)?;
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.stack = true;
        Ok(())
    }

    /// Burn N tokens from the end of the stack into discards.
    /// Returns JSON array of burned tokens.
    pub fn stack_burn(&mut self, count: usize) -> Result<String> {
        let stack_id = self.stack_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack section".into()))?;

        let stack_list_id = self.doc.get(&stack_id, "stack")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack list".into()))?;
        let discards_list_id = self.doc.get(&stack_id, "discards")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No discards list".into()))?;

        let tokens = read_token_list_rd(&self.doc, &stack_list_id);
        let stack_len = tokens.len();

        if count > stack_len {
            return Err(HyperTokenError::InvalidOperation(
                format!("Cannot burn {} from stack of {}", count, stack_len),
            ));
        }

        let burned_tokens: Vec<IToken> = tokens[stack_len - count..].to_vec();
        let existing_discards_len = self.doc.length(&discards_list_id);

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            for i in (stack_len - count..stack_len).rev() {
                tx.delete(&stack_list_id, i)?;
            }
            for (i, token) in burned_tokens.iter().enumerate() {
                let obj = tx.insert_object(&discards_list_id, existing_discards_len + i, ObjType::Map)?;
                write_token_tx(tx, &obj, token)?;
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.stack = true;

        serde_json::to_string(&burned_tokens)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Cut (rotate) the stack at the given index: tokens.rotate_left(index).
    pub fn stack_cut(&mut self, index: usize) -> Result<()> {
        let stack_id = self.stack_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack section".into()))?;

        let stack_list_id = self.doc.get(&stack_id, "stack")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack list".into()))?;

        let mut tokens = read_token_list_rd(&self.doc, &stack_list_id);

        if index > tokens.len() {
            return Err(HyperTokenError::IndexOutOfBounds(index));
        }

        tokens.rotate_left(index);

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            let len = tx.length(&stack_list_id);
            for i in (0..len).rev() {
                tx.delete(&stack_list_id, i)?;
            }
            for (i, token) in tokens.iter().enumerate() {
                let obj = tx.insert_object(&stack_list_id, i, ObjType::Map)?;
                write_token_tx(tx, &obj, token)?;
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.stack = true;
        Ok(())
    }

    /// Reset: combine stack+drawn+discards, sort by index, clear drawn and discards.
    pub fn stack_reset(&mut self) -> Result<()> {
        let stack_id = self.stack_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack section".into()))?;

        let stack_list_id = self.doc.get(&stack_id, "stack")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack list".into()))?;
        let drawn_list_id = self.doc.get(&stack_id, "drawn")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No drawn list".into()))?;
        let discards_list_id = self.doc.get(&stack_id, "discards")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No discards list".into()))?;

        let mut all_tokens = read_token_list_rd(&self.doc, &stack_list_id);
        all_tokens.extend(read_token_list_rd(&self.doc, &drawn_list_id));
        all_tokens.extend(read_token_list_rd(&self.doc, &discards_list_id));
        all_tokens.sort_by_key(|t| t.index);

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            // Clear stack, rewrite with all tokens
            let len = tx.length(&stack_list_id);
            for i in (0..len).rev() {
                tx.delete(&stack_list_id, i)?;
            }
            for (i, token) in all_tokens.iter().enumerate() {
                let obj = tx.insert_object(&stack_list_id, i, ObjType::Map)?;
                write_token_tx(tx, &obj, token)?;
            }
            // Clear drawn
            let drawn_len = tx.length(&drawn_list_id);
            for i in (0..drawn_len).rev() {
                tx.delete(&drawn_list_id, i)?;
            }
            // Clear discards
            let discards_len = tx.length(&discards_list_id);
            for i in (0..discards_len).rev() {
                tx.delete(&discards_list_id, i)?;
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.stack = true;
        Ok(())
    }

    /// Discard: find token by ID in drawn, move to discards.
    /// Returns JSON of the discarded token.
    pub fn stack_discard(&mut self, token_id: &str) -> Result<String> {
        let stack_id = self.stack_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack section".into()))?;

        let drawn_list_id = self.doc.get(&stack_id, "drawn")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No drawn list".into()))?;
        let discards_list_id = self.doc.get(&stack_id, "discards")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No discards list".into()))?;

        let drawn_tokens = read_token_list_rd(&self.doc, &drawn_list_id);
        let idx = drawn_tokens.iter().position(|t| t.id == token_id)
            .ok_or_else(|| HyperTokenError::TokenNotFound(token_id.to_string()))?;

        let token = drawn_tokens[idx].clone();
        let existing_discards_len = self.doc.length(&discards_list_id);

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.delete(&drawn_list_id, idx)?;
            let obj = tx.insert_object(&discards_list_id, existing_discards_len, ObjType::Map)?;
            write_token_tx(tx, &obj, &token)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.stack = true;

        serde_json::to_string(&token)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Insert a token at a specific index in the stack.
    pub fn stack_insert_at(&mut self, index: usize, token_json: &str) -> Result<()> {
        let stack_id = self.stack_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack section".into()))?;

        let stack_list_id = self.doc.get(&stack_id, "stack")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack list".into()))?;

        let token: IToken = serde_json::from_str(token_json)
            .map_err(|e| HyperTokenError::SerializationError(format!("Invalid token JSON: {}", e)))?;

        let stack_len = self.doc.length(&stack_list_id);
        if index > stack_len {
            return Err(HyperTokenError::IndexOutOfBounds(index));
        }

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            let obj = tx.insert_object(&stack_list_id, index, ObjType::Map)?;
            write_token_tx(tx, &obj, &token)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.stack = true;
        Ok(())
    }

    /// Remove a token at a specific index in the stack.
    /// Returns JSON of the removed token.
    pub fn stack_remove_at(&mut self, index: usize) -> Result<String> {
        let stack_id = self.stack_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack section".into()))?;

        let stack_list_id = self.doc.get(&stack_id, "stack")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack list".into()))?;

        let tokens = read_token_list_rd(&self.doc, &stack_list_id);
        if index >= tokens.len() {
            return Err(HyperTokenError::IndexOutOfBounds(index));
        }

        let token = tokens[index].clone();

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.delete(&stack_list_id, index)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.stack = true;

        serde_json::to_string(&token)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Swap two tokens in the stack by index.
    pub fn stack_swap(&mut self, index_a: usize, index_b: usize) -> Result<()> {
        let stack_id = self.stack_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack section".into()))?;

        let stack_list_id = self.doc.get(&stack_id, "stack")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack list".into()))?;

        let tokens = read_token_list_rd(&self.doc, &stack_list_id);
        let len = tokens.len();

        if index_a >= len {
            return Err(HyperTokenError::IndexOutOfBounds(index_a));
        }
        if index_b >= len {
            return Err(HyperTokenError::IndexOutOfBounds(index_b));
        }
        if index_a == index_b {
            return Ok(());
        }

        let token_a = tokens[index_a].clone();
        let token_b = tokens[index_b].clone();

        // Delete+reinsert to avoid stale optional fields from in-place overwrite
        let (lo, hi) = if index_a < index_b { (index_a, index_b) } else { (index_b, index_a) };
        let lo_token = if index_a < index_b { token_b.clone() } else { token_a.clone() };
        let hi_token = if index_a < index_b { token_a } else { token_b };

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            // Delete higher index first to keep lower index valid
            tx.delete(&stack_list_id, hi)?;
            let hi_obj = tx.insert_object(&stack_list_id, hi, ObjType::Map)?;
            write_token_tx(tx, &hi_obj, &hi_token)?;

            tx.delete(&stack_list_id, lo)?;
            let lo_obj = tx.insert_object(&stack_list_id, lo, ObjType::Map)?;
            write_token_tx(tx, &lo_obj, &lo_token)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.stack = true;
        Ok(())
    }

    /// Reverse the order of tokens in the stack.
    pub fn stack_reverse(&mut self) -> Result<()> {
        let stack_id = self.stack_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack section".into()))?;

        let stack_list_id = self.doc.get(&stack_id, "stack")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack list".into()))?;

        let mut tokens = read_token_list_rd(&self.doc, &stack_list_id);
        tokens.reverse();

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            let len = tx.length(&stack_list_id);
            for i in (0..len).rev() {
                tx.delete(&stack_list_id, i)?;
            }
            for (i, token) in tokens.iter().enumerate() {
                let obj = tx.insert_object(&stack_list_id, i, ObjType::Map)?;
                write_token_tx(tx, &obj, token)?;
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("{:?}", e)))?;

        self.dirty.stack = true;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::chronicle::Chronicle;
    use crate::types::HyperTokenState;

    fn init_stack_chronicle() -> Chronicle {
        let mut c = Chronicle::new();
        c.set_state(r#"{"stack":{"stack":[
            {"id":"t1","text":"A","char":"A","kind":"card","index":0,"meta":{}},
            {"id":"t2","text":"B","char":"B","kind":"card","index":1,"meta":{}},
            {"id":"t3","text":"C","char":"C","kind":"card","index":2,"meta":{}},
            {"id":"t4","text":"D","char":"D","kind":"card","index":3,"meta":{}},
            {"id":"t5","text":"E","char":"E","kind":"card","index":4,"meta":{}}
        ],"drawn":[],"discards":[]}}"#).unwrap();
        c.resolve_section_ids();
        c.dirty.clear();
        c
    }

    #[test]
    fn test_stack_draw() {
        let mut c = init_stack_chronicle();
        let drawn_json = c.stack_draw(2).unwrap();
        let drawn: Vec<serde_json::Value> = serde_json::from_str(&drawn_json).unwrap();
        assert_eq!(drawn.len(), 2);
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let stack = state.stack.unwrap();
        assert_eq!(stack.stack.len(), 3);
        assert_eq!(stack.drawn.len(), 2);
        assert!(c.dirty.stack);
        assert!(!c.dirty.zones);
    }

    #[test]
    fn test_stack_draw_overflow() {
        let mut c = init_stack_chronicle();
        let result = c.stack_draw(10);
        assert!(result.is_err());
    }

    #[test]
    fn test_stack_shuffle() {
        let mut c = init_stack_chronicle();
        c.stack_shuffle(Some("42".to_string())).unwrap();
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let stack = state.stack.unwrap();
        assert_eq!(stack.stack.len(), 5);
        assert!(c.dirty.stack);
    }

    #[test]
    fn test_stack_shuffle_deterministic() {
        let mut c1 = init_stack_chronicle();
        let mut c2 = init_stack_chronicle();
        c1.stack_shuffle(Some("seed123".to_string())).unwrap();
        c2.stack_shuffle(Some("seed123".to_string())).unwrap();
        let s1 = c1.get_state().unwrap();
        let s2 = c2.get_state().unwrap();
        let st1: HyperTokenState = serde_json::from_str(&s1).unwrap();
        let st2: HyperTokenState = serde_json::from_str(&s2).unwrap();
        let ids1: Vec<String> = st1.stack.unwrap().stack.iter().map(|t| t.id.clone()).collect();
        let ids2: Vec<String> = st2.stack.unwrap().stack.iter().map(|t| t.id.clone()).collect();
        assert_eq!(ids1, ids2);
    }

    #[test]
    fn test_stack_burn() {
        let mut c = init_stack_chronicle();
        let burned_json = c.stack_burn(1).unwrap();
        let burned: Vec<serde_json::Value> = serde_json::from_str(&burned_json).unwrap();
        assert_eq!(burned.len(), 1);
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let stack = state.stack.unwrap();
        assert_eq!(stack.stack.len(), 4);
        assert_eq!(stack.discards.len(), 1);
    }

    #[test]
    fn test_stack_cut() {
        let mut c = init_stack_chronicle();
        c.stack_cut(2).unwrap();
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let stack = state.stack.unwrap();
        assert_eq!(stack.stack.len(), 5);
        // After rotate_left(2): [C, D, E, A, B]
        assert_eq!(stack.stack[0].id, "t3");
        assert_eq!(stack.stack[4].id, "t2");
        assert!(c.dirty.stack);
    }

    #[test]
    fn test_stack_reset() {
        let mut c = init_stack_chronicle();
        c.stack_draw(2).unwrap();
        c.stack_burn(1).unwrap();
        c.dirty.clear();
        c.stack_reset().unwrap();
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let stack = state.stack.unwrap();
        assert_eq!(stack.stack.len(), 5);
        assert_eq!(stack.drawn.len(), 0);
        assert_eq!(stack.discards.len(), 0);
        // Sorted by index
        assert_eq!(stack.stack[0].id, "t1");
        assert_eq!(stack.stack[4].id, "t5");
        assert!(c.dirty.stack);
    }

    #[test]
    fn test_stack_discard() {
        let mut c = init_stack_chronicle();
        c.stack_draw(3).unwrap();
        c.dirty.clear();
        // Drawn has t3, t4, t5 (drawn from end)
        let result = c.stack_discard("t4").unwrap();
        let token: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(token["id"], "t4");
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let stack = state.stack.unwrap();
        assert_eq!(stack.drawn.len(), 2);
        assert_eq!(stack.discards.len(), 1);
        assert_eq!(stack.discards[0].id, "t4");
        assert!(c.dirty.stack);
    }

    #[test]
    fn test_stack_discard_not_found() {
        let mut c = init_stack_chronicle();
        let result = c.stack_discard("nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_stack_insert_at() {
        let mut c = init_stack_chronicle();
        let token_json = r#"{"id":"t6","text":"F","char":"F","kind":"card","index":5,"meta":{}}"#;
        c.stack_insert_at(2, token_json).unwrap();
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let stack = state.stack.unwrap();
        assert_eq!(stack.stack.len(), 6);
        assert_eq!(stack.stack[2].id, "t6");
        assert_eq!(stack.stack[3].id, "t3");
        assert!(c.dirty.stack);
    }

    #[test]
    fn test_stack_insert_at_out_of_bounds() {
        let mut c = init_stack_chronicle();
        let token_json = r#"{"id":"t6","text":"F","char":"F","kind":"card","index":5,"meta":{}}"#;
        let result = c.stack_insert_at(100, token_json);
        assert!(result.is_err());
    }

    #[test]
    fn test_stack_remove_at() {
        let mut c = init_stack_chronicle();
        let result = c.stack_remove_at(1).unwrap();
        let token: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(token["id"], "t2");
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let stack = state.stack.unwrap();
        assert_eq!(stack.stack.len(), 4);
        assert_eq!(stack.stack[1].id, "t3");
        assert!(c.dirty.stack);
    }

    #[test]
    fn test_stack_remove_at_out_of_bounds() {
        let mut c = init_stack_chronicle();
        let result = c.stack_remove_at(100);
        assert!(result.is_err());
    }

    #[test]
    fn test_stack_swap() {
        let mut c = init_stack_chronicle();
        c.stack_swap(0, 4).unwrap();
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let stack = state.stack.unwrap();
        assert_eq!(stack.stack[0].id, "t5");
        assert_eq!(stack.stack[4].id, "t1");
        // Middle elements unchanged
        assert_eq!(stack.stack[2].id, "t3");
        assert!(c.dirty.stack);
    }

    #[test]
    fn test_stack_swap_same_index() {
        let mut c = init_stack_chronicle();
        c.stack_swap(2, 2).unwrap();
        // Should be a no-op
        assert!(!c.dirty.stack);
    }

    #[test]
    fn test_stack_reverse() {
        let mut c = init_stack_chronicle();
        c.stack_reverse().unwrap();
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let stack = state.stack.unwrap();
        assert_eq!(stack.stack[0].id, "t5");
        assert_eq!(stack.stack[1].id, "t4");
        assert_eq!(stack.stack[2].id, "t3");
        assert_eq!(stack.stack[3].id, "t2");
        assert_eq!(stack.stack[4].id, "t1");
        assert!(c.dirty.stack);
    }
}
