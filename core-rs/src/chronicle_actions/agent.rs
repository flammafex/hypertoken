// Agent action methods for Chronicle (Phase 2)
//
// Incremental Automerge operations for the agents section:
// agent_create, agent_remove, agent_set_active, agent_give_resource,
// agent_take_resource, agent_add_token, agent_remove_token,
// agent_transfer_resource, agent_transfer_token, agent_steal_resource,
// agent_steal_token, agent_draw_cards, agent_discard_cards, agent_trade
//
// Document schema:
// ROOT/agents: Map {
//     "agentName": Map {
//         "id": String,
//         "name": String,
//         "active": bool,
//         "resources": Map { "gold": f64, ... },
//         "inventory": List[Map{token fields}],
//         "meta": Map { ... }
//     }
// }

use automerge::{AutomergeError, ObjType, ReadDoc, transaction::Transactable};
use crate::chronicle::Chronicle;
use crate::chronicle_actions::helpers::*;
use crate::types::{HyperTokenError, IToken, Result};

impl Chronicle {
    /// Create an agent as a structured nested Map under the agents section.
    /// Returns JSON of the created agent.
    pub fn agent_create(&mut self, id: &str, name: &str, meta_json: Option<&str>) -> Result<String> {
        let agents_id = self.ensure_section("agents")?;

        let id_str = id.to_string();
        let name_str = name.to_string();
        let meta: Option<serde_json::Map<String, serde_json::Value>> = meta_json
            .and_then(|s| serde_json::from_str(s).ok());

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            let agent_obj = tx.put_object(&agents_id, name_str.as_str(), ObjType::Map)?;
            tx.put(&agent_obj, "id", id_str.as_str())?;
            tx.put(&agent_obj, "name", name_str.as_str())?;
            tx.put(&agent_obj, "active", true)?;
            let resources_obj = tx.put_object(&agent_obj, "resources", ObjType::Map)?;
            let _inventory_obj = tx.put_object(&agent_obj, "inventory", ObjType::List)?;
            let meta_obj = tx.put_object(&agent_obj, "meta", ObjType::Map)?;

            // Write meta fields if provided
            if let Some(m) = &meta {
                for (k, v) in m {
                    if let Some(s) = v.as_str() {
                        tx.put(&meta_obj, k.as_str(), s)?;
                    } else if let Some(n) = v.as_f64() {
                        tx.put(&meta_obj, k.as_str(), n)?;
                    } else if let Some(b) = v.as_bool() {
                        tx.put(&meta_obj, k.as_str(), b)?;
                    } else {
                        let s = serde_json::to_string(v).unwrap_or_default();
                        tx.put(&meta_obj, k.as_str(), s.as_str())?;
                    }
                }
            }

            // Suppress unused variable warning
            let _ = resources_obj;

            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.agents = true;

        let mut result = serde_json::Map::new();
        result.insert("id".into(), id.into());
        result.insert("name".into(), name.into());
        result.insert("active".into(), true.into());
        result.insert("resources".into(), serde_json::json!({}));
        result.insert("inventory".into(), serde_json::json!([]));
        result.insert("meta".into(), meta.map(|m| serde_json::Value::Object(m)).unwrap_or(serde_json::json!({})));

        serde_json::to_string(&result)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Remove an agent by name from the agents map.
    pub fn agent_remove(&mut self, agent_name: &str) -> Result<()> {
        let agents_id = self.agents_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No agents section".into()))?;

        // Check agent exists
        self.doc.get(&agents_id, agent_name)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation(format!("Agent '{}' not found", agent_name)))?;

        let name = agent_name.to_string();

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.delete(&agents_id, name.as_str())?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.agents = true;
        Ok(())
    }

    /// Set the active field on an agent.
    pub fn agent_set_active(&mut self, agent_name: &str, active: bool) -> Result<()> {
        let agents_id = self.agents_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No agents section".into()))?;

        let agent_obj_id = self.doc.get(&agents_id, agent_name)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation(format!("Agent '{}' not found", agent_name)))?
            .1;

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.put(&agent_obj_id, "active", active)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.agents = true;
        Ok(())
    }

    /// Add amount to an agent's resource (creates resource key if missing).
    pub fn agent_give_resource(&mut self, agent_name: &str, resource: &str, amount: f64) -> Result<()> {
        let agents_id = self.agents_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No agents section".into()))?;

        let agent_obj_id = self.doc.get(&agents_id, agent_name)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation(format!("Agent '{}' not found", agent_name)))?
            .1;

        let resources_obj_id = self.doc.get(&agent_obj_id, "resources")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation("Agent has no resources map".into()))?
            .1;

        // Read current value
        let current = read_f64_rd(&self.doc, &resources_obj_id, resource).unwrap_or(0.0);
        let new_val = current + amount;

        let res_key = resource.to_string();

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.put(&resources_obj_id, res_key.as_str(), new_val)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.agents = true;
        Ok(())
    }

    /// Subtract amount from an agent's resource (min 0).
    pub fn agent_take_resource(&mut self, agent_name: &str, resource: &str, amount: f64) -> Result<()> {
        let agents_id = self.agents_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No agents section".into()))?;

        let agent_obj_id = self.doc.get(&agents_id, agent_name)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation(format!("Agent '{}' not found", agent_name)))?
            .1;

        let resources_obj_id = self.doc.get(&agent_obj_id, "resources")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation("Agent has no resources map".into()))?
            .1;

        let current = read_f64_rd(&self.doc, &resources_obj_id, resource).unwrap_or(0.0);
        let new_val = (current - amount).max(0.0);

        let res_key = resource.to_string();

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.put(&resources_obj_id, res_key.as_str(), new_val)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.agents = true;
        Ok(())
    }

    /// Parse a token from JSON and append to agent's inventory list.
    pub fn agent_add_token(&mut self, agent_name: &str, token_json: &str) -> Result<()> {
        let agents_id = self.agents_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No agents section".into()))?;

        let token: IToken = serde_json::from_str(token_json)
            .map_err(|e| HyperTokenError::SerializationError(format!("Invalid token JSON: {}", e)))?;

        let agent_obj_id = self.doc.get(&agents_id, agent_name)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation(format!("Agent '{}' not found", agent_name)))?
            .1;

        let inventory_obj_id = self.doc.get(&agent_obj_id, "inventory")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation("Agent has no inventory list".into()))?
            .1;

        let inv_len = self.doc.length(&inventory_obj_id);

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            let token_obj = tx.insert_object(&inventory_obj_id, inv_len, ObjType::Map)?;
            write_token_tx(tx, &token_obj, &token)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.agents = true;
        Ok(())
    }

    /// Find a token by id in the agent's inventory, remove it, and return its JSON.
    pub fn agent_remove_token(&mut self, agent_name: &str, token_id: &str) -> Result<String> {
        let agents_id = self.agents_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No agents section".into()))?;

        let agent_obj_id = self.doc.get(&agents_id, agent_name)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation(format!("Agent '{}' not found", agent_name)))?
            .1;

        let inventory_obj_id = self.doc.get(&agent_obj_id, "inventory")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation("Agent has no inventory list".into()))?
            .1;

        // Read inventory to find the token
        let tokens = read_token_list_rd(&self.doc, &inventory_obj_id);
        let index = tokens.iter().position(|t| t.id == token_id)
            .ok_or_else(|| HyperTokenError::TokenNotFound(format!("Token '{}' not found in {}'s inventory", token_id, agent_name)))?;
        let removed_token = tokens[index].clone();

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.delete(&inventory_obj_id, index)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.agents = true;

        serde_json::to_string(&removed_token)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Transfer a resource amount from one agent to another (single transaction).
    pub fn agent_transfer_resource(&mut self, from: &str, to: &str, resource: &str, amount: f64) -> Result<()> {
        let agents_id = self.agents_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No agents section".into()))?;

        // Read from agent's resources
        let from_agent_id = self.doc.get(&agents_id, from)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation(format!("Agent '{}' not found", from)))?
            .1;
        let from_res_id = self.doc.get(&from_agent_id, "resources")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation("Source agent has no resources map".into()))?
            .1;
        let from_val = read_f64_rd(&self.doc, &from_res_id, resource).unwrap_or(0.0);

        if from_val < amount {
            return Err(HyperTokenError::InvalidOperation(
                format!("Agent '{}' has {} {} but {} requested", from, from_val, resource, amount),
            ));
        }

        // Read to agent's resources
        let to_agent_id = self.doc.get(&agents_id, to)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation(format!("Agent '{}' not found", to)))?
            .1;
        let to_res_id = self.doc.get(&to_agent_id, "resources")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation("Target agent has no resources map".into()))?
            .1;
        let to_val = read_f64_rd(&self.doc, &to_res_id, resource).unwrap_or(0.0);

        let new_from = from_val - amount;
        let new_to = to_val + amount;
        let res_key = resource.to_string();

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.put(&from_res_id, res_key.as_str(), new_from)?;
            tx.put(&to_res_id, res_key.as_str(), new_to)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.agents = true;
        Ok(())
    }

    /// Transfer a token from one agent's inventory to another's.
    pub fn agent_transfer_token(&mut self, from: &str, to: &str, token_id: &str) -> Result<()> {
        let agents_id = self.agents_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No agents section".into()))?;

        // Find token in from's inventory
        let from_agent_id = self.doc.get(&agents_id, from)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation(format!("Agent '{}' not found", from)))?
            .1;
        let from_inv_id = self.doc.get(&from_agent_id, "inventory")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation("Source agent has no inventory".into()))?
            .1;

        let from_tokens = read_token_list_rd(&self.doc, &from_inv_id);
        let token_idx = from_tokens.iter().position(|t| t.id == token_id)
            .ok_or_else(|| HyperTokenError::TokenNotFound(format!("Token '{}' not found in {}'s inventory", token_id, from)))?;
        let token = from_tokens[token_idx].clone();

        // Get to's inventory
        let to_agent_id = self.doc.get(&agents_id, to)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation(format!("Agent '{}' not found", to)))?
            .1;
        let to_inv_id = self.doc.get(&to_agent_id, "inventory")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation("Target agent has no inventory".into()))?
            .1;
        let to_inv_len = self.doc.length(&to_inv_id);

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            // Remove from source
            tx.delete(&from_inv_id, token_idx)?;
            // Append to target
            let token_obj = tx.insert_object(&to_inv_id, to_inv_len, ObjType::Map)?;
            write_token_tx(tx, &token_obj, &token)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.agents = true;
        Ok(())
    }

    /// Steal a resource: take min(available, amount) from one agent and give to another.
    pub fn agent_steal_resource(&mut self, from: &str, to: &str, resource: &str, amount: f64) -> Result<()> {
        let agents_id = self.agents_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No agents section".into()))?;

        let from_agent_id = self.doc.get(&agents_id, from)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation(format!("Agent '{}' not found", from)))?
            .1;
        let from_res_id = self.doc.get(&from_agent_id, "resources")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation("Source agent has no resources map".into()))?
            .1;
        let from_val = read_f64_rd(&self.doc, &from_res_id, resource).unwrap_or(0.0);
        let actual_amount = from_val.min(amount);

        let to_agent_id = self.doc.get(&agents_id, to)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation(format!("Agent '{}' not found", to)))?
            .1;
        let to_res_id = self.doc.get(&to_agent_id, "resources")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation("Target agent has no resources map".into()))?
            .1;
        let to_val = read_f64_rd(&self.doc, &to_res_id, resource).unwrap_or(0.0);

        let new_from = from_val - actual_amount;
        let new_to = to_val + actual_amount;
        let res_key = resource.to_string();

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            tx.put(&from_res_id, res_key.as_str(), new_from)?;
            tx.put(&to_res_id, res_key.as_str(), new_to)?;
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.agents = true;
        Ok(())
    }

    /// Steal a token: transfer from one agent to another (same as transfer_token semantically).
    pub fn agent_steal_token(&mut self, from: &str, to: &str, token_id: &str) -> Result<()> {
        self.agent_transfer_token(from, to, token_id)
    }

    /// Draw N tokens from the stack section into the agent's inventory.
    /// Sets both dirty.stack and dirty.agents.
    pub fn agent_draw_cards(&mut self, agent_name: &str, count: usize) -> Result<String> {
        let agents_id = self.agents_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No agents section".into()))?;
        let stack_id = self.stack_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack section".into()))?;

        // Get stack list
        let stack_list_id = self.doc.get(&stack_id, "stack")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack list".into()))?;

        let tokens = read_token_list_rd(&self.doc, &stack_list_id);
        let stack_len = tokens.len();

        if count > stack_len {
            return Err(HyperTokenError::InvalidOperation(
                format!("Cannot draw {} from stack of {}", count, stack_len),
            ));
        }

        let drawn_tokens: Vec<IToken> = tokens[stack_len - count..].to_vec();

        // Get agent inventory
        let agent_obj_id = self.doc.get(&agents_id, agent_name)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation(format!("Agent '{}' not found", agent_name)))?
            .1;
        let inventory_obj_id = self.doc.get(&agent_obj_id, "inventory")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation("Agent has no inventory list".into()))?
            .1;
        let inv_len = self.doc.length(&inventory_obj_id);

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            // Remove from stack (reverse order to keep indices valid)
            for i in (stack_len - count..stack_len).rev() {
                tx.delete(&stack_list_id, i)?;
            }
            // Add to agent's inventory
            for (i, token) in drawn_tokens.iter().enumerate() {
                let token_obj = tx.insert_object(&inventory_obj_id, inv_len + i, ObjType::Map)?;
                write_token_tx(tx, &token_obj, token)?;
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.stack = true;
        self.dirty.agents = true;

        serde_json::to_string(&drawn_tokens)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Remove N tokens from agent's inventory and add to stack's discards.
    /// Sets both dirty.stack and dirty.agents.
    pub fn agent_discard_cards(&mut self, agent_name: &str, count: usize) -> Result<String> {
        let agents_id = self.agents_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No agents section".into()))?;
        let stack_id = self.stack_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No stack section".into()))?;

        // Get agent inventory
        let agent_obj_id = self.doc.get(&agents_id, agent_name)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation(format!("Agent '{}' not found", agent_name)))?
            .1;
        let inventory_obj_id = self.doc.get(&agent_obj_id, "inventory")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation("Agent has no inventory list".into()))?
            .1;

        let inv_tokens = read_token_list_rd(&self.doc, &inventory_obj_id);
        let inv_len = inv_tokens.len();

        if count > inv_len {
            return Err(HyperTokenError::InvalidOperation(
                format!("Cannot discard {} from inventory of {}", count, inv_len),
            ));
        }

        // Take from end of inventory
        let discarded: Vec<IToken> = inv_tokens[inv_len - count..].to_vec();

        // Get discards list
        let discards_list_id = self.doc.get(&stack_id, "discards")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .map(|(_, id)| id)
            .ok_or_else(|| HyperTokenError::InvalidOperation("No discards list".into()))?;
        let discards_len = self.doc.length(&discards_list_id);

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            // Remove from inventory (reverse order)
            for i in (inv_len - count..inv_len).rev() {
                tx.delete(&inventory_obj_id, i)?;
            }
            // Add to discards
            for (i, token) in discarded.iter().enumerate() {
                let token_obj = tx.insert_object(&discards_list_id, discards_len + i, ObjType::Map)?;
                write_token_tx(tx, &token_obj, token)?;
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.stack = true;
        self.dirty.agents = true;

        serde_json::to_string(&discarded)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Trade between two agents: exchange resources and tokens atomically.
    ///
    /// Trade offer format (JSON):
    /// { "resources": { "gold": 10.0, ... }, "tokens": ["token_id_1", ...] }
    pub fn agent_trade(&mut self, a: &str, b: &str, a_gives_json: &str, b_gives_json: &str) -> Result<()> {
        let agents_id = self.agents_id.clone()
            .ok_or_else(|| HyperTokenError::InvalidOperation("No agents section".into()))?;

        #[derive(serde::Deserialize, Default)]
        struct TradeOffer {
            #[serde(default)]
            resources: std::collections::HashMap<String, f64>,
            #[serde(default)]
            tokens: Vec<String>,
        }

        let a_gives: TradeOffer = serde_json::from_str(a_gives_json)
            .map_err(|e| HyperTokenError::SerializationError(format!("Invalid trade offer A: {}", e)))?;
        let b_gives: TradeOffer = serde_json::from_str(b_gives_json)
            .map_err(|e| HyperTokenError::SerializationError(format!("Invalid trade offer B: {}", e)))?;

        // Read agent A
        let a_agent_id = self.doc.get(&agents_id, a)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation(format!("Agent '{}' not found", a)))?
            .1;
        let a_res_id = self.doc.get(&a_agent_id, "resources")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation("Agent A has no resources".into()))?
            .1;
        let a_inv_id = self.doc.get(&a_agent_id, "inventory")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation("Agent A has no inventory".into()))?
            .1;

        // Read agent B
        let b_agent_id = self.doc.get(&agents_id, b)
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation(format!("Agent '{}' not found", b)))?
            .1;
        let b_res_id = self.doc.get(&b_agent_id, "resources")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation("Agent B has no resources".into()))?
            .1;
        let b_inv_id = self.doc.get(&b_agent_id, "inventory")
            .map_err(|e| HyperTokenError::CrdtError(e.to_string()))?
            .ok_or_else(|| HyperTokenError::InvalidOperation("Agent B has no inventory".into()))?
            .1;

        // Pre-read resource values for all exchanged resources
        let mut a_resource_vals: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
        let mut b_resource_vals: std::collections::HashMap<String, f64> = std::collections::HashMap::new();

        for key in a_gives.resources.keys().chain(b_gives.resources.keys()) {
            if !a_resource_vals.contains_key(key) {
                a_resource_vals.insert(key.clone(), read_f64_rd(&self.doc, &a_res_id, key).unwrap_or(0.0));
            }
            if !b_resource_vals.contains_key(key) {
                b_resource_vals.insert(key.clone(), read_f64_rd(&self.doc, &b_res_id, key).unwrap_or(0.0));
            }
        }

        // Pre-read inventories for token transfers
        let a_tokens = read_token_list_rd(&self.doc, &a_inv_id);
        let b_tokens = read_token_list_rd(&self.doc, &b_inv_id);

        // Find tokens A gives to B (indices in A's inventory)
        let mut a_give_indices: Vec<(usize, IToken)> = Vec::new();
        for tid in &a_gives.tokens {
            let idx = a_tokens.iter().position(|t| t.id == *tid)
                .ok_or_else(|| HyperTokenError::TokenNotFound(format!("Token '{}' not in {}'s inventory", tid, a)))?;
            a_give_indices.push((idx, a_tokens[idx].clone()));
        }

        // Find tokens B gives to A (indices in B's inventory)
        let mut b_give_indices: Vec<(usize, IToken)> = Vec::new();
        for tid in &b_gives.tokens {
            let idx = b_tokens.iter().position(|t| t.id == *tid)
                .ok_or_else(|| HyperTokenError::TokenNotFound(format!("Token '{}' not in {}'s inventory", tid, b)))?;
            b_give_indices.push((idx, b_tokens[idx].clone()));
        }

        // Sort indices in descending order so deletion indices stay valid
        a_give_indices.sort_by(|x, y| y.0.cmp(&x.0));
        b_give_indices.sort_by(|x, y| y.0.cmp(&x.0));

        let a_inv_len = self.doc.length(&a_inv_id);
        let b_inv_len = self.doc.length(&b_inv_id);

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            // Exchange resources
            for (key, amount) in &a_gives.resources {
                let a_cur = a_resource_vals.get(key).copied().unwrap_or(0.0);
                let b_cur = b_resource_vals.get(key).copied().unwrap_or(0.0);
                tx.put(&a_res_id, key.as_str(), a_cur - amount)?;
                tx.put(&b_res_id, key.as_str(), b_cur + amount)?;
            }
            for (key, amount) in &b_gives.resources {
                // Values may already be adjusted by a_gives, so re-read from our map and apply delta
                let a_cur = a_resource_vals.get(key).copied().unwrap_or(0.0);
                let b_cur = b_resource_vals.get(key).copied().unwrap_or(0.0);
                // Account for any change already applied by a_gives
                let a_already_delta = a_gives.resources.get(key).copied().unwrap_or(0.0);
                let b_already_delta = a_gives.resources.get(key).copied().unwrap_or(0.0);
                tx.put(&b_res_id, key.as_str(), b_cur + b_already_delta - amount)?;
                tx.put(&a_res_id, key.as_str(), a_cur - a_already_delta + amount)?;
            }

            // Remove tokens A gives (descending order)
            for (idx, _) in &a_give_indices {
                tx.delete(&a_inv_id, *idx)?;
            }
            // Remove tokens B gives (descending order)
            for (idx, _) in &b_give_indices {
                tx.delete(&b_inv_id, *idx)?;
            }

            // Add A's given tokens to B's inventory
            // Compute B's new length after deletions
            let b_new_len = b_inv_len - b_give_indices.len();
            for (i, (_, token)) in a_give_indices.iter().rev().enumerate() {
                let obj = tx.insert_object(&b_inv_id, b_new_len + i, ObjType::Map)?;
                write_token_tx(tx, &obj, token)?;
            }

            // Add B's given tokens to A's inventory
            let a_new_len = a_inv_len - a_give_indices.len();
            for (i, (_, token)) in b_give_indices.iter().rev().enumerate() {
                let obj = tx.insert_object(&a_inv_id, a_new_len + i, ObjType::Map)?;
                write_token_tx(tx, &obj, token)?;
            }

            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.agents = true;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::chronicle::Chronicle;
    use crate::types::HyperTokenState;

    fn setup_with_agents() -> Chronicle {
        let mut c = Chronicle::new();
        c.set_state(r#"{
            "agents": {},
            "stack": {
                "stack": [
                    {"id":"c1","text":"Ace","char":"A","kind":"card","index":0,"meta":{}},
                    {"id":"c2","text":"King","char":"K","kind":"card","index":1,"meta":{}},
                    {"id":"c3","text":"Queen","char":"Q","kind":"card","index":2,"meta":{}}
                ],
                "drawn": [],
                "discards": []
            }
        }"#).unwrap();
        c.resolve_section_ids();
        c.dirty.clear();
        c
    }

    #[test]
    fn test_agent_create() {
        let mut c = setup_with_agents();
        let result = c.agent_create("agent-1", "Alice", None).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["name"], "Alice");
        assert_eq!(parsed["id"], "agent-1");
        assert_eq!(parsed["active"], true);
        assert!(c.dirty.agents);

        // Verify via get_state roundtrip
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let agents = state.agents.unwrap();
        assert!(agents.contains_key("Alice"));
        let alice = &agents["Alice"];
        assert_eq!(alice["id"], "agent-1");
        assert_eq!(alice["active"], true);
    }

    #[test]
    fn test_agent_create_with_meta() {
        let mut c = setup_with_agents();
        c.agent_create("agent-1", "Bob", Some(r#"{"role":"dealer"}"#)).unwrap();

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let agents = state.agents.unwrap();
        let bob = &agents["Bob"];
        assert_eq!(bob["meta"]["role"], "dealer");
    }

    #[test]
    fn test_agent_give_resource() {
        let mut c = setup_with_agents();
        c.agent_create("a1", "Alice", None).unwrap();
        c.dirty.clear();

        c.agent_give_resource("Alice", "gold", 100.0).unwrap();
        assert!(c.dirty.agents);

        c.agent_give_resource("Alice", "gold", 50.0).unwrap();

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let alice = &state.agents.unwrap()["Alice"];
        assert_eq!(alice["resources"]["gold"], 150.0);
    }

    #[test]
    fn test_agent_take_resource() {
        let mut c = setup_with_agents();
        c.agent_create("a1", "Alice", None).unwrap();
        c.agent_give_resource("Alice", "gold", 100.0).unwrap();

        c.agent_take_resource("Alice", "gold", 30.0).unwrap();

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let alice = &state.agents.unwrap()["Alice"];
        assert_eq!(alice["resources"]["gold"], 70.0);
    }

    #[test]
    fn test_agent_take_resource_floors_at_zero() {
        let mut c = setup_with_agents();
        c.agent_create("a1", "Alice", None).unwrap();
        c.agent_give_resource("Alice", "gold", 10.0).unwrap();

        c.agent_take_resource("Alice", "gold", 100.0).unwrap();

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let alice = &state.agents.unwrap()["Alice"];
        assert_eq!(alice["resources"]["gold"], 0.0);
    }

    #[test]
    fn test_agent_add_token() {
        let mut c = setup_with_agents();
        c.agent_create("a1", "Alice", None).unwrap();
        c.dirty.clear();

        c.agent_add_token("Alice", r#"{"id":"t1","text":"Sword","char":"S","kind":"item","index":0,"meta":{}}"#).unwrap();
        assert!(c.dirty.agents);

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let alice = &state.agents.unwrap()["Alice"];
        let inv = alice["inventory"].as_array().unwrap();
        assert_eq!(inv.len(), 1);
        assert_eq!(inv[0]["id"], "t1");
        assert_eq!(inv[0]["text"], "Sword");
    }

    #[test]
    fn test_agent_remove_token() {
        let mut c = setup_with_agents();
        c.agent_create("a1", "Alice", None).unwrap();
        c.agent_add_token("Alice", r#"{"id":"t1","text":"Sword","char":"S","kind":"item","index":0,"meta":{}}"#).unwrap();
        c.agent_add_token("Alice", r#"{"id":"t2","text":"Shield","char":"H","kind":"item","index":1,"meta":{}}"#).unwrap();

        let removed = c.agent_remove_token("Alice", "t1").unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&removed).unwrap();
        assert_eq!(parsed["id"], "t1");

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let alice = &state.agents.unwrap()["Alice"];
        let inv = alice["inventory"].as_array().unwrap();
        assert_eq!(inv.len(), 1);
        assert_eq!(inv[0]["id"], "t2");
    }

    #[test]
    fn test_agent_remove() {
        let mut c = setup_with_agents();
        c.agent_create("a1", "Alice", None).unwrap();
        c.agent_create("a2", "Bob", None).unwrap();
        c.dirty.clear();

        c.agent_remove("Alice").unwrap();
        assert!(c.dirty.agents);

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let agents = state.agents.unwrap();
        assert!(!agents.contains_key("Alice"));
        assert!(agents.contains_key("Bob"));
    }

    #[test]
    fn test_agent_transfer_resource() {
        let mut c = setup_with_agents();
        c.agent_create("a1", "Alice", None).unwrap();
        c.agent_create("a2", "Bob", None).unwrap();
        c.agent_give_resource("Alice", "gold", 100.0).unwrap();
        c.dirty.clear();

        c.agent_transfer_resource("Alice", "Bob", "gold", 40.0).unwrap();
        assert!(c.dirty.agents);

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let agents = state.agents.unwrap();
        assert_eq!(agents["Alice"]["resources"]["gold"], 60.0);
        assert_eq!(agents["Bob"]["resources"]["gold"], 40.0);
    }

    #[test]
    fn test_agent_transfer_resource_insufficient() {
        let mut c = setup_with_agents();
        c.agent_create("a1", "Alice", None).unwrap();
        c.agent_create("a2", "Bob", None).unwrap();
        c.agent_give_resource("Alice", "gold", 10.0).unwrap();

        let result = c.agent_transfer_resource("Alice", "Bob", "gold", 50.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_agent_draw_cards() {
        let mut c = setup_with_agents();
        c.agent_create("a1", "Alice", None).unwrap();
        c.dirty.clear();

        let drawn_json = c.agent_draw_cards("Alice", 2).unwrap();
        let drawn: Vec<serde_json::Value> = serde_json::from_str(&drawn_json).unwrap();
        assert_eq!(drawn.len(), 2);

        assert!(c.dirty.stack);
        assert!(c.dirty.agents);

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();

        // Stack should have 1 remaining
        let stack = state.stack.unwrap();
        assert_eq!(stack.stack.len(), 1);

        // Agent inventory should have 2
        let agents = state.agents.unwrap();
        let inv = agents["Alice"]["inventory"].as_array().unwrap();
        assert_eq!(inv.len(), 2);
    }

    #[test]
    fn test_agent_discard_cards() {
        let mut c = setup_with_agents();
        c.agent_create("a1", "Alice", None).unwrap();
        c.agent_draw_cards("Alice", 3).unwrap();
        c.dirty.clear();

        let discarded_json = c.agent_discard_cards("Alice", 2).unwrap();
        let discarded: Vec<serde_json::Value> = serde_json::from_str(&discarded_json).unwrap();
        assert_eq!(discarded.len(), 2);

        assert!(c.dirty.stack);
        assert!(c.dirty.agents);

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();

        // Agent should have 1 remaining
        let agents = state.agents.unwrap();
        let inv = agents["Alice"]["inventory"].as_array().unwrap();
        assert_eq!(inv.len(), 1);

        // Discards should have 2
        let stack = state.stack.unwrap();
        assert_eq!(stack.discards.len(), 2);
    }

    #[test]
    fn test_agent_set_active() {
        let mut c = setup_with_agents();
        c.agent_create("a1", "Alice", None).unwrap();
        c.dirty.clear();

        c.agent_set_active("Alice", false).unwrap();
        assert!(c.dirty.agents);

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        assert_eq!(state.agents.unwrap()["Alice"]["active"], false);
    }

    #[test]
    fn test_agent_steal_resource() {
        let mut c = setup_with_agents();
        c.agent_create("a1", "Alice", None).unwrap();
        c.agent_create("a2", "Bob", None).unwrap();
        c.agent_give_resource("Alice", "gold", 10.0).unwrap();

        // Try to steal more than available
        c.agent_steal_resource("Alice", "Bob", "gold", 100.0).unwrap();

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let agents = state.agents.unwrap();
        assert_eq!(agents["Alice"]["resources"]["gold"], 0.0);
        assert_eq!(agents["Bob"]["resources"]["gold"], 10.0);
    }

    #[test]
    fn test_agent_transfer_token() {
        let mut c = setup_with_agents();
        c.agent_create("a1", "Alice", None).unwrap();
        c.agent_create("a2", "Bob", None).unwrap();
        c.agent_add_token("Alice", r#"{"id":"t1","text":"Sword","char":"S","kind":"item","index":0,"meta":{}}"#).unwrap();

        c.agent_transfer_token("Alice", "Bob", "t1").unwrap();

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let agents = state.agents.unwrap();
        assert_eq!(agents["Alice"]["inventory"].as_array().unwrap().len(), 0);
        assert_eq!(agents["Bob"]["inventory"].as_array().unwrap().len(), 1);
        assert_eq!(agents["Bob"]["inventory"][0]["id"], "t1");
    }

    #[test]
    fn test_agent_trade() {
        let mut c = setup_with_agents();
        c.agent_create("a1", "Alice", None).unwrap();
        c.agent_create("a2", "Bob", None).unwrap();
        c.agent_give_resource("Alice", "gold", 100.0).unwrap();
        c.agent_give_resource("Bob", "gems", 50.0).unwrap();
        c.agent_add_token("Alice", r#"{"id":"t1","text":"Sword","char":"S","kind":"item","index":0,"meta":{}}"#).unwrap();
        c.agent_add_token("Bob", r#"{"id":"t2","text":"Shield","char":"H","kind":"item","index":0,"meta":{}}"#).unwrap();

        c.agent_trade(
            "Alice", "Bob",
            r#"{"resources":{"gold":30},"tokens":["t1"]}"#,
            r#"{"resources":{"gems":20},"tokens":["t2"]}"#,
        ).unwrap();

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let agents = state.agents.unwrap();

        // Alice: 70 gold, +20 gems, lost sword, gained shield
        assert_eq!(agents["Alice"]["resources"]["gold"], 70.0);
        assert_eq!(agents["Alice"]["resources"]["gems"], 20.0);
        let a_inv = agents["Alice"]["inventory"].as_array().unwrap();
        assert_eq!(a_inv.len(), 1);
        assert_eq!(a_inv[0]["id"], "t2");

        // Bob: +30 gold, 30 gems, gained sword, lost shield
        assert_eq!(agents["Bob"]["resources"]["gold"], 30.0);
        assert_eq!(agents["Bob"]["resources"]["gems"], 30.0);
        let b_inv = agents["Bob"]["inventory"].as_array().unwrap();
        assert_eq!(b_inv.len(), 1);
        assert_eq!(b_inv[0]["id"], "t1");
    }
}
