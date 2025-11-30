// Action dispatch system for HyperToken Core

use wasm_bindgen::prelude::*;
use serde_json::Value as JsonValue;

use crate::stack::Stack;
use crate::space::Space;
use crate::types::{HyperTokenError, Result};

/// Unified action dispatcher for HyperToken operations
///
/// This provides a single entry point for all game actions,
/// replacing the TypeScript ActionRegistry pattern.
///
/// Actions are dispatched as JSON payloads and routed to the
/// appropriate handler based on action type.
#[wasm_bindgen]
pub struct ActionDispatcher {
    stack: Option<Stack>,
    space: Option<Space>,
}

#[wasm_bindgen]
impl ActionDispatcher {
    /// Create a new ActionDispatcher
    #[wasm_bindgen(constructor)]
    pub fn new() -> ActionDispatcher {
        ActionDispatcher {
            stack: None,
            space: None,
        }
    }

    /// Set the stack instance
    #[wasm_bindgen(js_name = setStack)]
    pub fn set_stack(&mut self, stack: Stack) {
        self.stack = Some(stack);
    }

    /// Set the space instance
    #[wasm_bindgen(js_name = setSpace)]
    pub fn set_space(&mut self, space: Space) {
        self.space = Some(space);
    }

    /// Get the stack instance
    #[wasm_bindgen(js_name = getStack)]
    pub fn get_stack(&self) -> Option<Stack> {
        self.stack.clone()
    }

    /// Get the space instance
    #[wasm_bindgen(js_name = getSpace)]
    pub fn get_space(&self) -> Option<Space> {
        self.space.clone()
    }

    /// Dispatch an action
    ///
    /// Actions are JSON objects with `type` and optional payload fields
    ///
    /// Example:
    /// ```js
    /// dispatcher.dispatch(JSON.stringify({
    ///   type: "stack:draw",
    ///   count: 5
    /// }));
    /// ```
    #[wasm_bindgen(js_name = dispatch)]
    pub fn dispatch(&mut self, action_json: &str) -> Result<String> {
        let action: JsonValue = serde_json::from_str(action_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        let action_type = action["type"]
            .as_str()
            .ok_or_else(|| HyperTokenError::InvalidOperation("Missing action type".to_string()))?;

        match action_type {
            // Stack actions
            "stack:draw" => self.handle_stack_draw(&action),
            "stack:shuffle" => self.handle_stack_shuffle(&action),
            "stack:burn" => self.handle_stack_burn(&action),
            "stack:reset" => self.handle_stack_reset(),
            "stack:cut" => self.handle_stack_cut(&action),
            "stack:insertAt" => self.handle_stack_insert_at(&action),
            "stack:removeAt" => self.handle_stack_remove_at(&action),
            "stack:swap" => self.handle_stack_swap(&action),

            // Space actions
            "space:place" => self.handle_space_place(&action),
            "space:remove" => self.handle_space_remove(&action),
            "space:move" => self.handle_space_move(&action),
            "space:flip" => self.handle_space_flip(&action),

            // Zone management
            "space:createZone" => self.handle_space_create_zone(&action),
            "space:deleteZone" => self.handle_space_delete_zone(&action),
            "space:clearZone" => self.handle_space_clear_zone(&action),
            "space:lockZone" => self.handle_space_lock_zone(&action),
            "space:shuffleZone" => self.handle_space_shuffle_zone(&action),

            // Debug
            "debug:log" => {
                let msg = action["msg"].as_str().unwrap_or("(no message)");
                Ok(format!("{{\"logged\":\"{}\"}}", msg))
            }

            _ => Err(HyperTokenError::InvalidOperation(
                format!("Unknown action type: {}", action_type)
            )),
        }
    }
}

// Stack action handlers
impl ActionDispatcher {
    fn handle_stack_draw(&mut self, action: &JsonValue) -> Result<String> {
        let stack = self.stack.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack available".to_string()))?;

        let count = action["count"].as_u64().unwrap_or(1) as usize;
        stack.draw(count)
    }

    fn handle_stack_shuffle(&mut self, action: &JsonValue) -> Result<String> {
        let stack = self.stack.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack available".to_string()))?;

        let seed = action["seed"].as_str().map(|s| s.to_string());
        stack.shuffle(seed)?;
        Ok("{}".to_string())
    }

    fn handle_stack_burn(&mut self, action: &JsonValue) -> Result<String> {
        let stack = self.stack.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack available".to_string()))?;

        let count = action["count"].as_u64().unwrap_or(1) as usize;
        stack.burn(count)
    }

    fn handle_stack_reset(&mut self) -> Result<String> {
        let stack = self.stack.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack available".to_string()))?;

        stack.reset();
        Ok("{}".to_string())
    }

    fn handle_stack_cut(&mut self, action: &JsonValue) -> Result<String> {
        let stack = self.stack.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack available".to_string()))?;

        let index = action["index"].as_u64()
            .ok_or_else(|| HyperTokenError::InvalidOperation("Missing index".to_string()))? as usize;

        stack.cut(index)?;
        Ok("{}".to_string())
    }

    fn handle_stack_insert_at(&mut self, action: &JsonValue) -> Result<String> {
        let stack = self.stack.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack available".to_string()))?;

        let index = action["index"].as_u64()
            .ok_or_else(|| HyperTokenError::InvalidOperation("Missing index".to_string()))? as usize;
        let token_json = serde_json::to_string(&action["token"])
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        stack.insert_at(index, &token_json)?;
        Ok("{}".to_string())
    }

    fn handle_stack_remove_at(&mut self, action: &JsonValue) -> Result<String> {
        let stack = self.stack.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack available".to_string()))?;

        let index = action["index"].as_u64()
            .ok_or_else(|| HyperTokenError::InvalidOperation("Missing index".to_string()))? as usize;

        stack.remove_at(index)
    }

    fn handle_stack_swap(&mut self, action: &JsonValue) -> Result<String> {
        let stack = self.stack.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack available".to_string()))?;

        let index_a = action["indexA"].as_u64()
            .ok_or_else(|| HyperTokenError::InvalidOperation("Missing indexA".to_string()))? as usize;
        let index_b = action["indexB"].as_u64()
            .ok_or_else(|| HyperTokenError::InvalidOperation("Missing indexB".to_string()))? as usize;

        stack.swap(index_a, index_b)?;
        Ok("{}".to_string())
    }
}

// Space action handlers
impl ActionDispatcher {
    fn handle_space_place(&mut self, action: &JsonValue) -> Result<String> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;

        let zone = action["zone"].as_str()
            .ok_or_else(|| HyperTokenError::InvalidOperation("Missing zone".to_string()))?;
        let token_json = serde_json::to_string(&action["token"])
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;
        let x = action["x"].as_f64();
        let y = action["y"].as_f64();

        space.place(zone, &token_json, x, y)?;
        Ok("{}".to_string())
    }

    fn handle_space_remove(&mut self, action: &JsonValue) -> Result<String> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;

        let zone = action["zone"].as_str()
            .ok_or_else(|| HyperTokenError::InvalidOperation("Missing zone".to_string()))?;
        let token_id = action["tokenId"].as_str()
            .ok_or_else(|| HyperTokenError::InvalidOperation("Missing tokenId".to_string()))?;

        space.remove(zone, token_id)
    }

    fn handle_space_move(&mut self, action: &JsonValue) -> Result<String> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;

        let token_id = action["tokenId"].as_str()
            .ok_or_else(|| HyperTokenError::InvalidOperation("Missing tokenId".to_string()))?;
        let from_zone = action["fromZone"].as_str()
            .ok_or_else(|| HyperTokenError::InvalidOperation("Missing fromZone".to_string()))?;
        let to_zone = action["toZone"].as_str()
            .ok_or_else(|| HyperTokenError::InvalidOperation("Missing toZone".to_string()))?;
        let x = action["x"].as_f64();
        let y = action["y"].as_f64();

        space.move_token(token_id, from_zone, to_zone, x, y)?;
        Ok("{}".to_string())
    }

    fn handle_space_flip(&mut self, action: &JsonValue) -> Result<String> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;

        let zone = action["zone"].as_str()
            .ok_or_else(|| HyperTokenError::InvalidOperation("Missing zone".to_string()))?;
        let token_id = action["tokenId"].as_str()
            .ok_or_else(|| HyperTokenError::InvalidOperation("Missing tokenId".to_string()))?;

        space.flip(zone, token_id)?;
        Ok("{}".to_string())
    }

    fn handle_space_create_zone(&mut self, action: &JsonValue) -> Result<String> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;

        let name = action["name"].as_str()
            .ok_or_else(|| HyperTokenError::InvalidOperation("Missing name".to_string()))?;

        space.create_zone(name.to_string())?;
        Ok("{}".to_string())
    }

    fn handle_space_delete_zone(&mut self, action: &JsonValue) -> Result<String> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;

        let name = action["name"].as_str()
            .ok_or_else(|| HyperTokenError::InvalidOperation("Missing name".to_string()))?;

        space.delete_zone(name)?;
        Ok("{}".to_string())
    }

    fn handle_space_clear_zone(&mut self, action: &JsonValue) -> Result<String> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;

        let name = action["name"].as_str()
            .ok_or_else(|| HyperTokenError::InvalidOperation("Missing name".to_string()))?;

        space.clear_zone(name)?;
        Ok("{}".to_string())
    }

    fn handle_space_lock_zone(&mut self, action: &JsonValue) -> Result<String> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;

        let name = action["name"].as_str()
            .ok_or_else(|| HyperTokenError::InvalidOperation("Missing name".to_string()))?;
        let locked = action["locked"].as_bool().unwrap_or(true);

        space.lock_zone(name, locked)?;
        Ok("{}".to_string())
    }

    fn handle_space_shuffle_zone(&mut self, action: &JsonValue) -> Result<String> {
        let space = self.space.as_mut()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No space available".to_string()))?;

        let name = action["name"].as_str()
            .ok_or_else(|| HyperTokenError::InvalidOperation("Missing name".to_string()))?;
        let seed = action["seed"].as_str().map(|s| s.to_string());

        space.shuffle_zone(name, seed)?;
        Ok("{}".to_string())
    }
}

impl Default for ActionDispatcher {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dispatcher_creation() {
        let dispatcher = ActionDispatcher::new();
        assert!(dispatcher.stack.is_none());
        assert!(dispatcher.space.is_none());
    }

    #[test]
    fn test_debug_log() {
        let mut dispatcher = ActionDispatcher::new();
        let action = r#"{"type":"debug:log","msg":"test"}"#;
        let result = dispatcher.dispatch(action).unwrap();
        assert!(result.contains("test"));
    }
}
