// Agent system for HyperToken
//
// Agents are entities that can hold resources, tokens, and participate in
// economic activities like trading, stealing, and resource management.

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::types::{HyperTokenError, Result, IToken};

/// Agent state structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentState {
    pub id: String,
    pub name: String,
    pub active: bool,
    pub resources: HashMap<String, i64>,
    pub inventory: Vec<IToken>,
    pub meta: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct TradeOffer {
    #[serde(default)]
    resource: Option<String>,
    #[serde(default)]
    amount: Option<i64>,
    #[serde(default)]
    token: Option<String>, // Token ID
}


/// Agent manager for WASM
#[wasm_bindgen]
pub struct AgentManager {
    agents: HashMap<String, AgentState>,
}

#[wasm_bindgen]
impl AgentManager {
    /// Create a new Agent manager
    #[wasm_bindgen(constructor)]
    pub fn new() -> AgentManager {
        AgentManager {
            agents: HashMap::new(),
        }
    }

    /// Create a new agent
    #[wasm_bindgen(js_name = createAgent)]
    pub fn create_agent(
        &mut self,
        id: &str,
        name: &str,
        meta_json: Option<String>,
    ) -> Result<String> {
        if self.agents.contains_key(name) {
            return Err(HyperTokenError::InvalidOperation(
                format!("Agent {} already exists", name)
            ));
        }

        let meta = if let Some(json) = meta_json {
            serde_json::from_str(&json)
                .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?
        } else {
            serde_json::Value::Object(serde_json::Map::new())
        };

        let agent = AgentState {
            id: id.to_string(),
            name: name.to_string(),
            active: true,
            resources: HashMap::new(),
            inventory: Vec::new(),
            meta,
        };

        self.agents.insert(name.to_string(), agent.clone());

        serde_json::to_string(&agent)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Remove an agent
    #[wasm_bindgen(js_name = removeAgent)]
    pub fn remove_agent(&mut self, name: &str) -> Result<()> {
        if self.agents.remove(name).is_none() {
            return Err(HyperTokenError::InvalidOperation(
                format!("Agent {} not found", name)
            ));
        }
        Ok(())
    }

    /// Set agent active state
    #[wasm_bindgen(js_name = setAgentActive)]
    pub fn set_agent_active(&mut self, name: &str, active: bool) -> Result<()> {
        let agent = self.agents.get_mut(name)
            .ok_or_else(|| HyperTokenError::InvalidOperation(
                format!("Agent {} not found", name)
            ))?;

        agent.active = active;
        Ok(())
    }

    /// Give resources to an agent
    #[wasm_bindgen(js_name = giveResource)]
    pub fn give_resource(&mut self, name: &str, resource: &str, amount: i64) -> Result<()> {
        let agent = self.agents.get_mut(name)
            .ok_or_else(|| HyperTokenError::InvalidOperation(
                format!("Agent {} not found", name)
            ))?;

        let current = agent.resources.get(resource).unwrap_or(&0);
        agent.resources.insert(resource.to_string(), current + amount);
        Ok(())
    }

    /// Take resources from an agent
    #[wasm_bindgen(js_name = takeResource)]
    pub fn take_resource(&mut self, name: &str, resource: &str, amount: i64) -> Result<()> {
        let agent = self.agents.get_mut(name)
            .ok_or_else(|| HyperTokenError::InvalidOperation(
                format!("Agent {} not found", name)
            ))?;

        let current = agent.resources.get(resource).unwrap_or(&0);
        agent.resources.insert(resource.to_string(), 0.max(current - amount));
        Ok(())
    }

    /// Add token to agent's inventory
    #[wasm_bindgen(js_name = addToken)]
    pub fn add_token(&mut self, name: &str, token_json: &str) -> Result<()> {
        let agent = self.agents.get_mut(name)
            .ok_or_else(|| HyperTokenError::InvalidOperation(
                format!("Agent {} not found", name)
            ))?;

        let token: IToken = serde_json::from_str(token_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        agent.inventory.push(token);
        Ok(())
    }

    /// Remove token from agent's inventory
    #[wasm_bindgen(js_name = removeToken)]
    pub fn remove_token(&mut self, name: &str, token_id: &str) -> Result<String> {
        let agent = self.agents.get_mut(name)
            .ok_or_else(|| HyperTokenError::InvalidOperation(
                format!("Agent {} not found", name)
            ))?;

        let index = agent.inventory.iter()
            .position(|t| t.id == token_id)
            .ok_or_else(|| HyperTokenError::InvalidOperation(
                format!("Agent {} does not have token {}", name, token_id)
            ))?;

        let removed = agent.inventory.remove(index);

        serde_json::to_string(&removed)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Get agent state as JSON
    #[wasm_bindgen(js_name = getAgent)]
    pub fn get_agent(&self, name: &str) -> Result<String> {
        let agent = self.agents.get(name)
            .ok_or_else(|| HyperTokenError::InvalidOperation(
                format!("Agent {} not found", name)
            ))?;

        serde_json::to_string(agent)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Transfer resource between agents
    #[wasm_bindgen(js_name = transferResource)]
    pub fn transfer_resource(
        &mut self,
        from: &str,
        to: &str,
        resource: &str,
        amount: i64,
    ) -> Result<String> {
        // Check source agent has enough
        let from_agent = self.agents.get(from)
            .ok_or_else(|| HyperTokenError::InvalidOperation(
                format!("Agent {} not found", from)
            ))?;

        let available = from_agent.resources.get(resource).unwrap_or(&0);
        if *available < amount {
            return Err(HyperTokenError::InvalidOperation(
                format!("Agent {} only has {} {}, cannot transfer {}",
                    from, available, resource, amount)
            ));
        }

        // Check target agent exists
        if !self.agents.contains_key(to) {
            return Err(HyperTokenError::InvalidOperation(
                format!("Agent {} not found", to)
            ));
        }

        // Perform transfer
        self.take_resource(from, resource, amount)?;
        self.give_resource(to, resource, amount)?;

        // Return transaction result
        let from_remaining = self.agents.get(from).unwrap()
            .resources.get(resource).unwrap_or(&0);
        let to_total = self.agents.get(to).unwrap()
            .resources.get(resource).unwrap_or(&0);

        let result = serde_json::json!({
            "success": true,
            "from": {
                "agent": from,
                "remaining": from_remaining
            },
            "to": {
                "agent": to,
                "total": to_total
            }
        });

        serde_json::to_string(&result)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Transfer token between agents
    #[wasm_bindgen(js_name = transferToken)]
    pub fn transfer_token(
        &mut self,
        from: &str,
        to: &str,
        token_id: &str,
    ) -> Result<String> {
        // Remove from source
        let token_json = self.remove_token(from, token_id)?;

        // Add to target
        self.add_token(to, &token_json)?;

        // Return success result
        let result = serde_json::json!({
            "success": true,
            "token": serde_json::from_str::<serde_json::Value>(&token_json)
                .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?
        });

        serde_json::to_string(&result)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Steal resource from another agent
    #[wasm_bindgen(js_name = stealResource)]
    pub fn steal_resource(
        &mut self,
        from: &str,
        to: &str,
        resource: &str,
        amount: i64,
    ) -> Result<String> {
        // Get available amount
        let from_agent = self.agents.get(from)
            .ok_or_else(|| HyperTokenError::InvalidOperation(
                format!("Agent {} not found", from)
            ))?;

        let available = *from_agent.resources.get(resource).unwrap_or(&0);
        let stolen = available.min(amount);

        if stolen == 0 {
            return Err(HyperTokenError::InvalidOperation(
                format!("Agent {} has no {} to steal", from, resource)
            ));
        }

        // Perform steal (same as transfer)
        self.take_resource(from, resource, stolen)?;
        self.give_resource(to, resource, stolen)?;

        // Return steal result
        let from_remaining = self.agents.get(from).unwrap()
            .resources.get(resource).unwrap_or(&0);
        let to_total = self.agents.get(to).unwrap()
            .resources.get(resource).unwrap_or(&0);

        let result = serde_json::json!({
            "success": true,
            "stolen": stolen,
            "from": {
                "agent": from,
                "remaining": from_remaining
            },
            "to": {
                "agent": to,
                "total": to_total
            }
        });

        serde_json::to_string(&result)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Steal token from another agent
    #[wasm_bindgen(js_name = stealToken)]
    pub fn steal_token(
        &mut self,
        from: &str,
        to: &str,
        token_id: &str,
    ) -> Result<String> {
        // Same as transfer for tokens
        self.transfer_token(from, to, token_id)
    }

    /// Get all agents as JSON array
    #[wasm_bindgen(js_name = getAllAgents)]
    pub fn get_all_agents(&self) -> Result<String> {
        let agents: Vec<&AgentState> = self.agents.values().collect();
        serde_json::to_string(&agents)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }
    
    #[wasm_bindgen(js_name = trade)]
    pub fn trade(
        &mut self,
        agent1_name: &str,
        offer1_json: &str,
        agent2_name: &str,
        offer2_json: &str,
    ) -> Result<String> {
        let offer1: TradeOffer = serde_json::from_str(offer1_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;
        let offer2: TradeOffer = serde_json::from_str(offer2_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        // 1. Validation Phase
        {
            let a1 = self.agents.get(agent1_name)
                .ok_or_else(|| HyperTokenError::InvalidOperation(format!("Agent {} not found", agent1_name)))?;
            
            if let Some(res) = &offer1.resource {
                let amt = offer1.amount.unwrap_or(1);
                let has = a1.resources.get(res).unwrap_or(&0);
                if *has < amt {
                    return Err(HyperTokenError::InvalidOperation(format!("Agent {} insufficient {}: have {}, need {}", agent1_name, res, has, amt)));
                }
            } else if let Some(tid) = &offer1.token {
                if !a1.inventory.iter().any(|t| t.id == *tid) {
                    return Err(HyperTokenError::InvalidOperation(format!("Agent {} does not have token {}", agent1_name, tid)));
                }
            }

            let a2 = self.agents.get(agent2_name)
                .ok_or_else(|| HyperTokenError::InvalidOperation(format!("Agent {} not found", agent2_name)))?;

            if let Some(res) = &offer2.resource {
                let amt = offer2.amount.unwrap_or(1);
                let has = a2.resources.get(res).unwrap_or(&0);
                if *has < amt {
                    return Err(HyperTokenError::InvalidOperation(format!("Agent {} insufficient {}: have {}, need {}", agent2_name, res, has, amt)));
                }
            } else if let Some(tid) = &offer2.token {
                if !a2.inventory.iter().any(|t| t.id == *tid) {
                    return Err(HyperTokenError::InvalidOperation(format!("Agent {} does not have token {}", agent2_name, tid)));
                }
            }
        }

        // 2. Execution Phase
        // Move Offer 1: Agent 1 -> Agent 2
        if let Some(res) = &offer1.resource {
            let amt = offer1.amount.unwrap_or(1);
            self.take_resource(agent1_name, res, amt)?;
            self.give_resource(agent2_name, res, amt)?;
        } else if let Some(tid) = &offer1.token {
            let token_json = self.remove_token(agent1_name, tid)?;
            self.add_token(agent2_name, &token_json)?;
        }

        // Move Offer 2: Agent 2 -> Agent 1
        if let Some(res) = &offer2.resource {
            let amt = offer2.amount.unwrap_or(1);
            self.take_resource(agent2_name, res, amt)?;
            self.give_resource(agent1_name, res, amt)?;
        } else if let Some(tid) = &offer2.token {
            let token_json = self.remove_token(agent2_name, tid)?;
            self.add_token(agent1_name, &token_json)?;
        }

        Ok(serde_json::json!({ "success": true }).to_string())
    }
}

impl Default for AgentManager {
    fn default() -> Self {
        Self::new()
    }
}
