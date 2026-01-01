// Chronicle: CRDT document wrapper using automerge-rs
//
// This implementation stores HyperTokenState fields as native Automerge types
// for proper field-level CRDT conflict resolution.

use automerge::{Automerge, AutomergeError, ObjId, ObjType, ReadDoc, Value, transaction::Transactable, sync, sync::SyncDoc};
use wasm_bindgen::prelude::*;

use crate::types::{
    HyperTokenError, HyperTokenState, IStackState, ISourceState, IGameLoopState,
    IRuleState, IPlacementCRDT, IToken, ReshufflePolicy, Result,
};
use std::collections::HashMap;

/// Chronicle wraps an Automerge CRDT document
///
/// This implementation stores HyperTokenState fields as native Automerge
/// maps and lists, enabling field-level CRDT conflict resolution.
///
/// Document structure:
/// ROOT
/// ├── stack: { stack: [...], drawn: [...], discards: [...] }
/// ├── zones: { zone_name: [...placements...], ... }
/// ├── source: { stackIds: [...], tokens: [...], burned: [...], seed, reshufflePolicy: {...} }
/// ├── gameLoop: { turn, running, activeAgentIndex, phase, maxTurns }
/// ├── rules: { fired: { ruleName: timestamp, ... } }
/// ├── agents: { agentName: {...}, ... }
/// ├── version: "string"
/// └── nullifiers: { hash: timestamp, ... }
#[wasm_bindgen]
pub struct Chronicle {
    doc: Automerge,
}

#[wasm_bindgen]
impl Chronicle {
    /// Create a new Chronicle with an empty CRDT document
    #[wasm_bindgen(constructor)]
    pub fn new() -> Chronicle {
        Chronicle {
            doc: Automerge::new(),
        }
    }

    /// Set the entire state (used for initialization)
    ///
    /// Takes a JSON string of HyperTokenState and stores each field
    /// natively in the CRDT for proper conflict resolution.
    #[wasm_bindgen(js_name = setState)]
    pub fn set_state(&mut self, state_json: &str) -> Result<()> {
        // Parse the JSON into HyperTokenState
        let state: HyperTokenState = serde_json::from_str(state_json)
            .map_err(|e| HyperTokenError::SerializationError(format!("Invalid state JSON: {}", e)))?;

        // Write state to Automerge document using native types
        self.write_state_to_doc(&state)?;

        Ok(())
    }

    /// Get the current document state as JSON
    ///
    /// Reads native Automerge fields and reconstructs HyperTokenState.
    #[wasm_bindgen(js_name = getState)]
    pub fn get_state(&self) -> Result<String> {
        let state = self.read_state_from_doc()?;
        serde_json::to_string(&state)
            .map_err(|e| HyperTokenError::SerializationError(format!("Failed to serialize state: {}", e)))
    }

    /// Apply a change to the document
    ///
    /// JavaScript usage:
    /// ```js
    /// chronicle.change("draw-card", newStateJson);
    /// ```
    #[wasm_bindgen(js_name = change)]
    pub fn change(&mut self, _message: &str, new_state_json: &str) -> Result<()> {
        // Parse and validate the new state
        let state: HyperTokenState = serde_json::from_str(new_state_json)
            .map_err(|e| HyperTokenError::SerializationError(format!("Invalid state JSON: {}", e)))?;

        // Write state to document
        self.write_state_to_doc(&state)?;

        Ok(())
    }

    /// Save the document to a binary format
    #[wasm_bindgen(js_name = save)]
    pub fn save(&self) -> Result<Vec<u8>> {
        Ok(self.doc.save())
    }

    /// Load a document from binary format
    #[wasm_bindgen(js_name = load)]
    pub fn load(&mut self, data: &[u8]) -> Result<()> {
        self.doc = Automerge::load(data)
            .map_err(|e| HyperTokenError::CrdtError(format!("Failed to load document: {:?}", e)))?;
        Ok(())
    }

    /// Save document to Base64 string (for easier transport)
    #[wasm_bindgen(js_name = saveToBase64)]
    pub fn save_to_base64(&self) -> Result<String> {
        let data = self.save()?;
        Ok(base64_encode(&data))
    }

    /// Load document from Base64 string
    #[wasm_bindgen(js_name = loadFromBase64)]
    pub fn load_from_base64(&mut self, base64: &str) -> Result<()> {
        let data = base64_decode(base64)
            .map_err(|e| HyperTokenError::SerializationError(format!("Invalid base64: {}", e)))?;
        self.load(&data)
    }

    /// Merge another document into this one
    #[wasm_bindgen(js_name = merge)]
    pub fn merge(&mut self, other_data: &[u8]) -> Result<()> {
        let mut other_doc = Automerge::load(other_data)
            .map_err(|e| HyperTokenError::CrdtError(format!("Failed to load other document: {:?}", e)))?;

        self.doc.merge(&mut other_doc)
            .map_err(|_e| HyperTokenError::CrdtError("Failed to merge documents".to_string()))?;

        Ok(())
    }

    /// Get the number of changes in the document
    #[wasm_bindgen(js_name = changeCount)]
    pub fn change_count(&self) -> usize {
        self.doc.get_heads().len()
    }

    /// Generate a sync message for incremental synchronization
    ///
    /// Takes an optional serialized SyncState from a previous sync.
    /// Returns a tuple: (sync_message, new_sync_state) as JSON.
    ///
    /// Usage:
    /// ```js
    /// // First sync (no prior state)
    /// const result = chronicle.generateSyncMessage(null);
    /// const { message, syncState } = JSON.parse(result);
    ///
    /// // Subsequent syncs (use saved sync state)
    /// const result2 = chronicle.generateSyncMessage(syncState);
    /// ```
    #[wasm_bindgen(js_name = generateSyncMessage)]
    pub fn generate_sync_message(&self, sync_state_bytes: Option<Vec<u8>>) -> Result<String> {
        // Deserialize or create new sync state
        let mut sync_state = if let Some(bytes) = sync_state_bytes {
            sync::State::decode(&bytes)
                .map_err(|e| HyperTokenError::CrdtError(format!("Failed to decode sync state: {:?}", e)))?
        } else {
            sync::State::new()
        };

        // Generate sync message
        let message = self.doc.generate_sync_message(&mut sync_state);
        let has_message = message.is_some();
        let message_base64 = message.map(|m| base64_encode(&m.encode()));

        // Serialize the sync state for storage
        let new_sync_state_bytes = sync_state.encode();

        // Return as JSON with base64-encoded data
        let result = serde_json::json!({
            "message": message_base64,
            "syncState": base64_encode(&new_sync_state_bytes),
            "hasMessage": has_message
        });

        serde_json::to_string(&result)
            .map_err(|e| HyperTokenError::SerializationError(format!("Failed to serialize sync result: {}", e)))
    }

    /// Receive a sync message and update the document
    ///
    /// Takes:
    /// - message_base64: The sync message from the peer (base64 encoded)
    /// - sync_state_bytes: Optional serialized SyncState
    ///
    /// Returns: JSON with updated sync state and any response message
    #[wasm_bindgen(js_name = receiveSyncMessage)]
    pub fn receive_sync_message(&mut self, message_base64: &str, sync_state_bytes: Option<Vec<u8>>) -> Result<String> {
        // Decode the message
        let message_bytes = base64_decode(message_base64)
            .map_err(|e| HyperTokenError::SerializationError(format!("Invalid base64 message: {}", e)))?;

        let message = sync::Message::decode(&message_bytes)
            .map_err(|e| HyperTokenError::CrdtError(format!("Failed to decode sync message: {:?}", e)))?;

        // Deserialize or create new sync state
        let mut sync_state = if let Some(bytes) = sync_state_bytes {
            sync::State::decode(&bytes)
                .map_err(|e| HyperTokenError::CrdtError(format!("Failed to decode sync state: {:?}", e)))?
        } else {
            sync::State::new()
        };

        // Receive the sync message
        self.doc.receive_sync_message(&mut sync_state, message)
            .map_err(|e| HyperTokenError::CrdtError(format!("Failed to receive sync message: {:?}", e)))?;

        // Generate response message if needed
        let response = self.doc.generate_sync_message(&mut sync_state);
        let has_response = response.is_some();
        let response_base64 = response.map(|m| base64_encode(&m.encode()));

        // Serialize the sync state for storage
        let new_sync_state_bytes = sync_state.encode();

        // Return result as JSON
        let result = serde_json::json!({
            "responseMessage": response_base64,
            "syncState": base64_encode(&new_sync_state_bytes),
            "hasResponse": has_response
        });

        serde_json::to_string(&result)
            .map_err(|e| HyperTokenError::SerializationError(format!("Failed to serialize sync result: {}", e)))
    }

    /// Simple full-document sync (for backwards compatibility)
    ///
    /// Merges the given binary document into this one.
    #[wasm_bindgen(js_name = syncFull)]
    pub fn sync_full(&mut self, other_doc_bytes: &[u8]) -> Result<()> {
        self.merge(other_doc_bytes)
    }
}

// Private implementation methods
impl Chronicle {
    /// Write HyperTokenState to Automerge document using native types
    fn write_state_to_doc(&mut self, state: &HyperTokenState) -> Result<()> {
        self.doc.transact::<_, _, AutomergeError>(|tx| {
            // Write stack field
            if let Some(stack) = &state.stack {
                let stack_id = tx.put_object(automerge::ROOT, "stack", ObjType::Map)?;
                Self::write_stack_state_tx(tx, &stack_id, stack)?;
            } else {
                let _ = tx.delete(automerge::ROOT, "stack");
            }

            // Write zones field
            if let Some(zones) = &state.zones {
                let zones_id = tx.put_object(automerge::ROOT, "zones", ObjType::Map)?;
                Self::write_zones_tx(tx, &zones_id, zones)?;
            } else {
                let _ = tx.delete(automerge::ROOT, "zones");
            }

            // Write source field
            if let Some(source) = &state.source {
                let source_id = tx.put_object(automerge::ROOT, "source", ObjType::Map)?;
                Self::write_source_state_tx(tx, &source_id, source)?;
            } else {
                let _ = tx.delete(automerge::ROOT, "source");
            }

            // Write gameLoop field
            if let Some(game_loop) = &state.gameLoop {
                let gl_id = tx.put_object(automerge::ROOT, "gameLoop", ObjType::Map)?;
                Self::write_game_loop_state_tx(tx, &gl_id, game_loop)?;
            } else {
                let _ = tx.delete(automerge::ROOT, "gameLoop");
            }

            // Write rules field
            if let Some(rules) = &state.rules {
                let rules_id = tx.put_object(automerge::ROOT, "rules", ObjType::Map)?;
                Self::write_rule_state_tx(tx, &rules_id, rules)?;
            } else {
                let _ = tx.delete(automerge::ROOT, "rules");
            }

            // Write agents field
            if let Some(agents) = &state.agents {
                let agents_id = tx.put_object(automerge::ROOT, "agents", ObjType::Map)?;
                Self::write_agents_tx(tx, &agents_id, agents)?;
            } else {
                let _ = tx.delete(automerge::ROOT, "agents");
            }

            // Write version field
            if let Some(version) = &state.version {
                tx.put(automerge::ROOT, "version", version.as_str())?;
            } else {
                let _ = tx.delete(automerge::ROOT, "version");
            }

            // Write nullifiers field
            if let Some(nullifiers) = &state.nullifiers {
                let null_id = tx.put_object(automerge::ROOT, "nullifiers", ObjType::Map)?;
                for (hash, timestamp) in nullifiers {
                    tx.put(&null_id, hash.as_str(), *timestamp)?;
                }
            } else {
                let _ = tx.delete(automerge::ROOT, "nullifiers");
            }

            // Write extra fields (extensible)
            for (key, value) in &state.extra {
                let json_str = serde_json::to_string(value).unwrap_or_default();
                tx.put(automerge::ROOT, key.as_str(), json_str.as_str())?;
            }

            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        Ok(())
    }

    /// Write IStackState to an Automerge map (transaction-compatible)
    fn write_stack_state_tx<T: Transactable>(tx: &mut T, obj: &ObjId, stack: &IStackState) -> std::result::Result<(), AutomergeError> {
        // Write stack array
        let stack_arr = tx.put_object(obj, "stack", ObjType::List)?;
        for (i, token) in stack.stack.iter().enumerate() {
            let token_obj = tx.insert_object(&stack_arr, i, ObjType::Map)?;
            Self::write_token_tx(tx, &token_obj, token)?;
        }

        // Write drawn array
        let drawn_arr = tx.put_object(obj, "drawn", ObjType::List)?;
        for (i, token) in stack.drawn.iter().enumerate() {
            let token_obj = tx.insert_object(&drawn_arr, i, ObjType::Map)?;
            Self::write_token_tx(tx, &token_obj, token)?;
        }

        // Write discards array
        let discards_arr = tx.put_object(obj, "discards", ObjType::List)?;
        for (i, token) in stack.discards.iter().enumerate() {
            let token_obj = tx.insert_object(&discards_arr, i, ObjType::Map)?;
            Self::write_token_tx(tx, &token_obj, token)?;
        }

        Ok(())
    }

    /// Write IToken to an Automerge map (transaction-compatible)
    fn write_token_tx<T: Transactable>(tx: &mut T, obj: &ObjId, token: &IToken) -> std::result::Result<(), AutomergeError> {
        tx.put(obj, "id", token.id.as_str())?;

        if let Some(label) = &token.label {
            tx.put(obj, "label", label.as_str())?;
        }

        if let Some(group) = &token.group {
            tx.put(obj, "group", group.as_str())?;
        }

        tx.put(obj, "text", token.text.as_str())?;
        tx.put(obj, "char", token.char.as_str())?;
        tx.put(obj, "kind", token.kind.as_str())?;
        tx.put(obj, "index", token.index as i64)?;

        // Write meta as JSON string for simplicity (nested arbitrary data)
        let meta_json = serde_json::to_string(&token.meta).unwrap_or_else(|_| "{}".to_string());
        tx.put(obj, "meta", meta_json.as_str())?;

        // Write optional runtime properties
        if let Some(rev) = token._rev {
            tx.put(obj, "_rev", rev)?;
        }

        if let Some(tags) = &token._tags {
            let tags_json = serde_json::to_string(tags).unwrap_or_else(|_| "[]".to_string());
            tx.put(obj, "_tags", tags_json.as_str())?;
        }

        if let Some(attached_to) = &token._attachedTo {
            tx.put(obj, "_attachedTo", attached_to.as_str())?;
        }

        if let Some(attachment_type) = &token._attachmentType {
            tx.put(obj, "_attachmentType", attachment_type.as_str())?;
        }

        // Merge/split tracking
        if let Some(merged) = token._merged {
            tx.put(obj, "_merged", merged)?;
        }
        if let Some(merged_into) = &token._mergedInto {
            tx.put(obj, "_mergedInto", merged_into.as_str())?;
        }
        if let Some(merged_from) = &token._mergedFrom {
            let json = serde_json::to_string(merged_from).unwrap_or_else(|_| "[]".to_string());
            tx.put(obj, "_mergedFrom", json.as_str())?;
        }
        if let Some(merged_at) = token._mergedAt {
            tx.put(obj, "_mergedAt", merged_at)?;
        }
        if let Some(split) = token._split {
            tx.put(obj, "_split", split)?;
        }
        if let Some(split_into) = &token._splitInto {
            let json = serde_json::to_string(split_into).unwrap_or_else(|_| "[]".to_string());
            tx.put(obj, "_splitInto", json.as_str())?;
        }
        if let Some(split_from) = &token._splitFrom {
            tx.put(obj, "_splitFrom", split_from.as_str())?;
        }
        if let Some(split_index) = token._splitIndex {
            tx.put(obj, "_splitIndex", split_index as i64)?;
        }
        if let Some(split_at) = token._splitAt {
            tx.put(obj, "_splitAt", split_at)?;
        }

        Ok(())
    }

    /// Write zones map (transaction-compatible)
    fn write_zones_tx<T: Transactable>(tx: &mut T, obj: &ObjId, zones: &HashMap<String, Vec<IPlacementCRDT>>) -> std::result::Result<(), AutomergeError> {
        for (zone_name, placements) in zones {
            let zone_arr = tx.put_object(obj, zone_name.as_str(), ObjType::List)?;

            for (i, placement) in placements.iter().enumerate() {
                let p_obj = tx.insert_object(&zone_arr, i, ObjType::Map)?;
                Self::write_placement_tx(tx, &p_obj, placement)?;
            }
        }
        Ok(())
    }

    /// Write IPlacementCRDT to an Automerge map (transaction-compatible)
    fn write_placement_tx<T: Transactable>(tx: &mut T, obj: &ObjId, placement: &IPlacementCRDT) -> std::result::Result<(), AutomergeError> {
        tx.put(obj, "id", placement.id.as_str())?;
        tx.put(obj, "tokenId", placement.tokenId.as_str())?;

        // Write tokenSnapshot as nested map
        let snapshot_obj = tx.put_object(obj, "tokenSnapshot", ObjType::Map)?;
        Self::write_token_tx(tx, &snapshot_obj, &placement.tokenSnapshot)?;

        if let Some(x) = placement.x {
            tx.put(obj, "x", x)?;
        }
        if let Some(y) = placement.y {
            tx.put(obj, "y", y)?;
        }

        tx.put(obj, "faceUp", placement.faceUp)?;

        if let Some(label) = &placement.label {
            tx.put(obj, "label", label.as_str())?;
        }

        tx.put(obj, "ts", placement.ts)?;
        tx.put(obj, "reversed", placement.reversed)?;

        // Write tags as JSON array
        let tags_json = serde_json::to_string(&placement.tags).unwrap_or_else(|_| "[]".to_string());
        tx.put(obj, "tags", tags_json.as_str())?;

        Ok(())
    }

    /// Write ISourceState to an Automerge map (transaction-compatible)
    fn write_source_state_tx<T: Transactable>(tx: &mut T, obj: &ObjId, source: &ISourceState) -> std::result::Result<(), AutomergeError> {
        // Write stackIds array
        let stack_ids_arr = tx.put_object(obj, "stackIds", ObjType::List)?;
        for (i, id) in source.stackIds.iter().enumerate() {
            tx.insert(&stack_ids_arr, i, id.as_str())?;
        }

        // Write tokens array
        let tokens_arr = tx.put_object(obj, "tokens", ObjType::List)?;
        for (i, token) in source.tokens.iter().enumerate() {
            let token_obj = tx.insert_object(&tokens_arr, i, ObjType::Map)?;
            Self::write_token_tx(tx, &token_obj, token)?;
        }

        // Write burned array
        let burned_arr = tx.put_object(obj, "burned", ObjType::List)?;
        for (i, token) in source.burned.iter().enumerate() {
            let token_obj = tx.insert_object(&burned_arr, i, ObjType::Map)?;
            Self::write_token_tx(tx, &token_obj, token)?;
        }

        // Write seed
        if let Some(seed) = source.seed {
            tx.put(obj, "seed", seed as i64)?;
        }

        // Write reshufflePolicy
        let policy_obj = tx.put_object(obj, "reshufflePolicy", ObjType::Map)?;
        if let Some(threshold) = source.reshufflePolicy.threshold {
            tx.put(&policy_obj, "threshold", threshold as i64)?;
        }
        tx.put(&policy_obj, "mode", source.reshufflePolicy.mode.as_str())?;

        Ok(())
    }

    /// Write IGameLoopState to an Automerge map (transaction-compatible)
    fn write_game_loop_state_tx<T: Transactable>(tx: &mut T, obj: &ObjId, game_loop: &IGameLoopState) -> std::result::Result<(), AutomergeError> {
        tx.put(obj, "turn", game_loop.turn as i64)?;
        tx.put(obj, "running", game_loop.running)?;
        tx.put(obj, "activeAgentIndex", game_loop.activeAgentIndex as i64)?;
        tx.put(obj, "phase", game_loop.phase.as_str())?;
        tx.put(obj, "maxTurns", game_loop.maxTurns as i64)?;
        Ok(())
    }

    /// Write IRuleState to an Automerge map (transaction-compatible)
    fn write_rule_state_tx<T: Transactable>(tx: &mut T, obj: &ObjId, rules: &IRuleState) -> std::result::Result<(), AutomergeError> {
        let fired_obj = tx.put_object(obj, "fired", ObjType::Map)?;
        for (rule_name, timestamp) in &rules.fired {
            tx.put(&fired_obj, rule_name.as_str(), *timestamp)?;
        }
        Ok(())
    }

    /// Write agents map (transaction-compatible)
    fn write_agents_tx<T: Transactable>(tx: &mut T, obj: &ObjId, agents: &HashMap<String, serde_json::Value>) -> std::result::Result<(), AutomergeError> {
        for (agent_name, agent_data) in agents {
            let json_str = serde_json::to_string(agent_data).unwrap_or_else(|_| "{}".to_string());
            tx.put(obj, agent_name.as_str(), json_str.as_str())?;
        }
        Ok(())
    }

    /// Read HyperTokenState from Automerge document
    fn read_state_from_doc(&self) -> Result<HyperTokenState> {
        let mut state = HyperTokenState::default();

        // Read stack
        if let Ok(Some((_, stack_id))) = self.doc.get(automerge::ROOT, "stack") {
            state.stack = Some(self.read_stack_state(&stack_id)?);
        }

        // Read zones
        if let Ok(Some((_, zones_id))) = self.doc.get(automerge::ROOT, "zones") {
            state.zones = Some(self.read_zones(&zones_id)?);
        }

        // Read source
        if let Ok(Some((_, source_id))) = self.doc.get(automerge::ROOT, "source") {
            state.source = Some(self.read_source_state(&source_id)?);
        }

        // Read gameLoop
        if let Ok(Some((_, gl_id))) = self.doc.get(automerge::ROOT, "gameLoop") {
            state.gameLoop = Some(self.read_game_loop_state(&gl_id)?);
        }

        // Read rules
        if let Ok(Some((_, rules_id))) = self.doc.get(automerge::ROOT, "rules") {
            state.rules = Some(self.read_rule_state(&rules_id)?);
        }

        // Read agents
        if let Ok(Some((_, agents_id))) = self.doc.get(automerge::ROOT, "agents") {
            state.agents = Some(self.read_agents(&agents_id)?);
        }

        // Read version
        if let Ok(Some((Value::Scalar(s), _))) = self.doc.get(automerge::ROOT, "version") {
            if let automerge::ScalarValue::Str(v) = s.as_ref() {
                state.version = Some(v.to_string());
            }
        }

        // Read nullifiers
        if let Ok(Some((_, null_id))) = self.doc.get(automerge::ROOT, "nullifiers") {
            state.nullifiers = Some(self.read_nullifiers(&null_id)?);
        }

        // Read extra fields - scan ROOT for unknown keys
        let known_keys = ["stack", "zones", "source", "gameLoop", "rules", "agents", "version", "nullifiers"];
        for item in self.doc.map_range(automerge::ROOT, ..) {
            let key = item.key.to_string();
            if !known_keys.contains(&key.as_str()) {
                if let Ok(Some((Value::Scalar(s), _))) = self.doc.get(automerge::ROOT, key.as_str()) {
                    if let automerge::ScalarValue::Str(json_str) = s.as_ref() {
                        if let Ok(value) = serde_json::from_str(json_str.as_str()) {
                            state.extra.insert(key, value);
                        } else {
                            // If not valid JSON, store as string
                            state.extra.insert(key, serde_json::Value::String(json_str.to_string()));
                        }
                    }
                }
            }
        }

        Ok(state)
    }

    /// Read IStackState from an Automerge map
    fn read_stack_state(&self, obj: &ObjId) -> Result<IStackState> {
        let mut stack_state = IStackState::default();

        // Read stack array
        if let Ok(Some((_, stack_arr))) = self.doc.get(obj, "stack") {
            stack_state.stack = self.read_token_list(&stack_arr)?;
        }

        // Read drawn array
        if let Ok(Some((_, drawn_arr))) = self.doc.get(obj, "drawn") {
            stack_state.drawn = self.read_token_list(&drawn_arr)?;
        }

        // Read discards array
        if let Ok(Some((_, discards_arr))) = self.doc.get(obj, "discards") {
            stack_state.discards = self.read_token_list(&discards_arr)?;
        }

        Ok(stack_state)
    }

    /// Read a list of tokens
    fn read_token_list(&self, list_id: &ObjId) -> Result<Vec<IToken>> {
        let mut tokens = Vec::new();
        let len = self.doc.length(list_id);

        for i in 0..len {
            if let Ok(Some((_, token_id))) = self.doc.get(list_id, i) {
                tokens.push(self.read_token(&token_id)?);
            }
        }

        Ok(tokens)
    }

    /// Read IToken from an Automerge map
    fn read_token(&self, obj: &ObjId) -> Result<IToken> {
        let id = self.read_string(obj, "id")?.unwrap_or_default();
        let label = self.read_string(obj, "label")?;
        let group = self.read_string(obj, "group")?;
        let text = self.read_string(obj, "text")?.unwrap_or_default();
        let char = self.read_string(obj, "char")?.unwrap_or_else(|| "□".to_string());
        let kind = self.read_string(obj, "kind")?.unwrap_or_else(|| "default".to_string());
        let index = self.read_i64(obj, "index")?.unwrap_or(0) as i32;

        // Read meta (stored as JSON string)
        let meta = if let Some(meta_json) = self.read_string(obj, "meta")? {
            serde_json::from_str(&meta_json).unwrap_or_default()
        } else {
            HashMap::new()
        };

        // Read optional runtime properties
        let _rev = self.read_bool(obj, "_rev")?;
        let _tags = if let Some(tags_json) = self.read_string(obj, "_tags")? {
            serde_json::from_str(&tags_json).ok()
        } else {
            None
        };
        let _attachments = None; // Complex type, skip for now
        let _attachedTo = self.read_string(obj, "_attachedTo")?;
        let _attachmentType = self.read_string(obj, "_attachmentType")?;

        // Merge/split tracking
        let _merged = self.read_bool(obj, "_merged")?;
        let _mergedInto = self.read_string(obj, "_mergedInto")?;
        let _mergedFrom = if let Some(json) = self.read_string(obj, "_mergedFrom")? {
            serde_json::from_str(&json).ok()
        } else {
            None
        };
        let _mergedAt = self.read_i64(obj, "_mergedAt")?;
        let _split = self.read_bool(obj, "_split")?;
        let _splitInto = if let Some(json) = self.read_string(obj, "_splitInto")? {
            serde_json::from_str(&json).ok()
        } else {
            None
        };
        let _splitFrom = self.read_string(obj, "_splitFrom")?;
        let _splitIndex = self.read_i64(obj, "_splitIndex")?.map(|v| v as i32);
        let _splitAt = self.read_i64(obj, "_splitAt")?;

        Ok(IToken {
            id,
            label,
            group,
            text,
            meta,
            char,
            kind,
            index,
            _rev,
            _tags,
            _attachments,
            _attachedTo,
            _attachmentType,
            _merged,
            _mergedInto,
            _mergedFrom,
            _mergedAt,
            _split,
            _splitInto,
            _splitFrom,
            _splitIndex,
            _splitAt,
        })
    }

    /// Read zones map
    fn read_zones(&self, obj: &ObjId) -> Result<HashMap<String, Vec<IPlacementCRDT>>> {
        let mut zones = HashMap::new();

        for item in self.doc.map_range(obj, ..) {
            let zone_name = item.key.to_string();
            if let Ok(Some((_, zone_arr))) = self.doc.get(obj, zone_name.as_str()) {
                let mut placements = Vec::new();
                let len = self.doc.length(&zone_arr);

                for i in 0..len {
                    if let Ok(Some((_, p_id))) = self.doc.get(&zone_arr, i) {
                        placements.push(self.read_placement(&p_id)?);
                    }
                }

                zones.insert(zone_name, placements);
            }
        }

        Ok(zones)
    }

    /// Read IPlacementCRDT from an Automerge map
    fn read_placement(&self, obj: &ObjId) -> Result<IPlacementCRDT> {
        let id = self.read_string(obj, "id")?.unwrap_or_default();
        let tokenId = self.read_string(obj, "tokenId")?.unwrap_or_default();

        let tokenSnapshot = if let Ok(Some((_, snapshot_id))) = self.doc.get(obj, "tokenSnapshot") {
            self.read_token(&snapshot_id)?
        } else {
            IToken {
                id: String::new(),
                label: None,
                group: None,
                text: String::new(),
                meta: HashMap::new(),
                char: "□".to_string(),
                kind: "default".to_string(),
                index: 0,
                _rev: None,
                _tags: None,
                _attachments: None,
                _attachedTo: None,
                _attachmentType: None,
                _merged: None,
                _mergedInto: None,
                _mergedFrom: None,
                _mergedAt: None,
                _split: None,
                _splitInto: None,
                _splitFrom: None,
                _splitIndex: None,
                _splitAt: None,
            }
        };

        let x = self.read_f64(obj, "x")?;
        let y = self.read_f64(obj, "y")?;
        let faceUp = self.read_bool(obj, "faceUp")?.unwrap_or(true);
        let label = self.read_string(obj, "label")?;
        let ts = self.read_i64(obj, "ts")?.unwrap_or(0);
        let reversed = self.read_bool(obj, "reversed")?.unwrap_or(false);

        let tags = if let Some(tags_json) = self.read_string(obj, "tags")? {
            serde_json::from_str(&tags_json).unwrap_or_default()
        } else {
            Vec::new()
        };

        Ok(IPlacementCRDT {
            id,
            tokenId,
            tokenSnapshot,
            x,
            y,
            faceUp,
            label,
            ts,
            reversed,
            tags,
        })
    }

    /// Read ISourceState from an Automerge map
    fn read_source_state(&self, obj: &ObjId) -> Result<ISourceState> {
        let mut source = ISourceState::default();

        // Read stackIds
        if let Ok(Some((_, arr))) = self.doc.get(obj, "stackIds") {
            let len = self.doc.length(&arr);
            for i in 0..len {
                if let Some(id) = self.read_list_string(&arr, i)? {
                    source.stackIds.push(id);
                }
            }
        }

        // Read tokens
        if let Ok(Some((_, arr))) = self.doc.get(obj, "tokens") {
            source.tokens = self.read_token_list(&arr)?;
        }

        // Read burned
        if let Ok(Some((_, arr))) = self.doc.get(obj, "burned") {
            source.burned = self.read_token_list(&arr)?;
        }

        // Read seed
        source.seed = self.read_i64(obj, "seed")?.map(|v| v as i32);

        // Read reshufflePolicy
        if let Ok(Some((_, policy_id))) = self.doc.get(obj, "reshufflePolicy") {
            source.reshufflePolicy = ReshufflePolicy {
                threshold: self.read_i64(&policy_id, "threshold")?.map(|v| v as i32),
                mode: self.read_string(&policy_id, "mode")?.unwrap_or_else(|| "auto".to_string()),
            };
        }

        Ok(source)
    }

    /// Read IGameLoopState from an Automerge map
    fn read_game_loop_state(&self, obj: &ObjId) -> Result<IGameLoopState> {
        Ok(IGameLoopState {
            turn: self.read_i64(obj, "turn")?.unwrap_or(0) as i32,
            running: self.read_bool(obj, "running")?.unwrap_or(false),
            activeAgentIndex: self.read_i64(obj, "activeAgentIndex")?.unwrap_or(0) as i32,
            phase: self.read_string(obj, "phase")?.unwrap_or_default(),
            maxTurns: self.read_i64(obj, "maxTurns")?.unwrap_or(0) as i32,
        })
    }

    /// Read IRuleState from an Automerge map
    fn read_rule_state(&self, obj: &ObjId) -> Result<IRuleState> {
        let mut rules = IRuleState::default();

        if let Ok(Some((_, fired_id))) = self.doc.get(obj, "fired") {
            for item in self.doc.map_range(&fired_id, ..) {
                let key = item.key.to_string();
                if let Some(ts) = self.read_i64(&fired_id, key.as_str())? {
                    rules.fired.insert(key, ts);
                }
            }
        }

        Ok(rules)
    }

    /// Read agents map
    fn read_agents(&self, obj: &ObjId) -> Result<HashMap<String, serde_json::Value>> {
        let mut agents = HashMap::new();

        for item in self.doc.map_range(obj, ..) {
            let key = item.key.to_string();
            if let Some(json_str) = self.read_string(obj, key.as_str())? {
                if let Ok(value) = serde_json::from_str(&json_str) {
                    agents.insert(key, value);
                }
            }
        }

        Ok(agents)
    }

    /// Read nullifiers map
    fn read_nullifiers(&self, obj: &ObjId) -> Result<HashMap<String, i64>> {
        let mut nullifiers = HashMap::new();

        for item in self.doc.map_range(obj, ..) {
            let key = item.key.to_string();
            if let Some(ts) = self.read_i64(obj, key.as_str())? {
                nullifiers.insert(key, ts);
            }
        }

        Ok(nullifiers)
    }

    // Helper methods for reading scalar values

    fn read_string(&self, obj: &ObjId, key: &str) -> Result<Option<String>> {
        match self.doc.get(obj, key) {
            Ok(Some((Value::Scalar(s), _))) => {
                if let automerge::ScalarValue::Str(v) = s.as_ref() {
                    Ok(Some(v.to_string()))
                } else {
                    Ok(None)
                }
            }
            _ => Ok(None),
        }
    }

    fn read_i64(&self, obj: &ObjId, key: &str) -> Result<Option<i64>> {
        match self.doc.get(obj, key) {
            Ok(Some((Value::Scalar(s), _))) => {
                match s.as_ref() {
                    automerge::ScalarValue::Int(v) => Ok(Some(*v)),
                    automerge::ScalarValue::Uint(v) => Ok(Some(*v as i64)),
                    _ => Ok(None),
                }
            }
            _ => Ok(None),
        }
    }

    fn read_f64(&self, obj: &ObjId, key: &str) -> Result<Option<f64>> {
        match self.doc.get(obj, key) {
            Ok(Some((Value::Scalar(s), _))) => {
                match s.as_ref() {
                    automerge::ScalarValue::F64(v) => Ok(Some(*v)),
                    automerge::ScalarValue::Int(v) => Ok(Some(*v as f64)),
                    automerge::ScalarValue::Uint(v) => Ok(Some(*v as f64)),
                    _ => Ok(None),
                }
            }
            _ => Ok(None),
        }
    }

    fn read_bool(&self, obj: &ObjId, key: &str) -> Result<Option<bool>> {
        match self.doc.get(obj, key) {
            Ok(Some((Value::Scalar(s), _))) => {
                if let automerge::ScalarValue::Boolean(v) = s.as_ref() {
                    Ok(Some(*v))
                } else {
                    Ok(None)
                }
            }
            _ => Ok(None),
        }
    }

    fn read_list_string(&self, list: &ObjId, index: usize) -> Result<Option<String>> {
        match self.doc.get(list, index) {
            Ok(Some((Value::Scalar(s), _))) => {
                if let automerge::ScalarValue::Str(v) = s.as_ref() {
                    Ok(Some(v.to_string()))
                } else {
                    Ok(None)
                }
            }
            _ => Ok(None),
        }
    }
}

// Non-WASM methods for internal use
impl Chronicle {
    /// Get a reference to the inner Automerge document
    pub fn doc(&self) -> &Automerge {
        &self.doc
    }

    /// Get a mutable reference to the inner Automerge document
    pub fn doc_mut(&mut self) -> &mut Automerge {
        &mut self.doc
    }
}

impl Default for Chronicle {
    fn default() -> Self {
        Self::new()
    }
}

// Base64 encoding/decoding helpers
fn base64_encode(data: &[u8]) -> String {
    let mut result = String::new();
    for chunk in data.chunks(3) {
        let mut buf = [0u8; 3];
        buf[..chunk.len()].copy_from_slice(chunk);

        let b64_chars = [
            (buf[0] >> 2) & 0x3F,
            ((buf[0] & 0x03) << 4) | ((buf[1] >> 4) & 0x0F),
            ((buf[1] & 0x0F) << 2) | ((buf[2] >> 6) & 0x03),
            buf[2] & 0x3F,
        ];

        for (i, &val) in b64_chars.iter().enumerate() {
            if i >= chunk.len() + 1 && i > 0 {
                result.push('=');
            } else {
                result.push(BASE64_CHARS[val as usize] as char);
            }
        }
    }
    result
}

fn base64_decode(data: &str) -> std::result::Result<Vec<u8>, String> {
    let mut result = Vec::new();
    let chars: Vec<u8> = data.bytes().collect();

    for chunk in chars.chunks(4) {
        if chunk.len() < 4 {
            return Err("Invalid base64 length".to_string());
        }

        let mut vals = [0u8; 4];
        for (i, &ch) in chunk.iter().enumerate() {
            if ch == b'=' {
                break;
            }
            vals[i] = BASE64_DECODE[ch as usize];
        }

        result.push((vals[0] << 2) | (vals[1] >> 4));
        if chunk[2] != b'=' {
            result.push((vals[1] << 4) | (vals[2] >> 2));
        }
        if chunk[3] != b'=' {
            result.push((vals[2] << 6) | vals[3]);
        }
    }

    Ok(result)
}

const BASE64_CHARS: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const BASE64_DECODE: &[u8; 256] = &{
    let mut table = [0u8; 256];
    let mut i = 0;
    while i < 64 {
        table[BASE64_CHARS[i] as usize] = i as u8;
        i += 1;
    }
    table
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chronicle_creation() {
        let chronicle = Chronicle::new();
        assert_eq!(chronicle.change_count(), 0);
    }

    #[test]
    fn test_set_and_get_state() {
        let mut chronicle = Chronicle::new();

        let state_json = r#"{"stack":{"stack":[{"id":"t1","label":"Token 1","text":"","char":"□","kind":"default","index":0,"meta":{}}],"drawn":[],"discards":[]}}"#;
        chronicle.set_state(state_json).unwrap();

        let result = chronicle.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&result).unwrap();

        assert!(state.stack.is_some());
        let stack = state.stack.unwrap();
        assert_eq!(stack.stack.len(), 1);
        assert_eq!(stack.stack[0].id, "t1");
    }

    #[test]
    fn test_save_and_load() {
        let mut chronicle1 = Chronicle::new();

        let state_json = r#"{"version":"1.0","stack":{"stack":[],"drawn":[],"discards":[]}}"#;
        chronicle1.set_state(state_json).unwrap();

        let data = chronicle1.save().unwrap();

        let mut chronicle2 = Chronicle::new();
        chronicle2.load(&data).unwrap();

        let result = chronicle2.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&result).unwrap();
        assert_eq!(state.version, Some("1.0".to_string()));
    }

    #[test]
    fn test_base64_encoding() {
        let mut chronicle = Chronicle::new();
        chronicle.set_state("{}").unwrap();

        let base64 = chronicle.save_to_base64().unwrap();
        assert!(!base64.is_empty());

        let mut chronicle2 = Chronicle::new();
        chronicle2.load_from_base64(&base64).unwrap();

        assert_eq!(chronicle2.change_count(), chronicle.change_count());
    }

    #[test]
    fn test_merge_different_fields() {
        // Test that merging documents with changes to different fields works correctly
        let mut chronicle1 = Chronicle::new();
        let mut chronicle2 = Chronicle::new();

        // Chronicle 1 modifies stack
        chronicle1.set_state(r#"{"stack":{"stack":[{"id":"t1","text":"","char":"□","kind":"default","index":0,"meta":{}}],"drawn":[],"discards":[]}}"#).unwrap();

        // Chronicle 2 modifies zones
        chronicle2.set_state(r#"{"zones":{"zone1":[]}}"#).unwrap();

        // Merge chronicle2 into chronicle1
        let data2 = chronicle2.save().unwrap();
        chronicle1.merge(&data2).unwrap();

        // Verify both fields are present
        let result = chronicle1.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&result).unwrap();

        assert!(state.stack.is_some());
        assert!(state.zones.is_some());
    }

    #[test]
    fn test_change_preserves_other_fields() {
        let mut chronicle = Chronicle::new();

        // Set initial state with multiple fields
        chronicle.set_state(r#"{"version":"1.0","stack":{"stack":[],"drawn":[],"discards":[]}}"#).unwrap();

        // Change to add zones
        chronicle.change("add-zones", r#"{"version":"1.0","stack":{"stack":[],"drawn":[],"discards":[]},"zones":{"main":[]}}"#).unwrap();

        let result = chronicle.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&result).unwrap();

        assert_eq!(state.version, Some("1.0".to_string()));
        assert!(state.stack.is_some());
        assert!(state.zones.is_some());
    }

    #[test]
    fn test_incremental_sync() {
        // Create two chronicles that start diverged
        let mut chronicle1 = Chronicle::new();
        let mut chronicle2 = Chronicle::new();

        // Chronicle 1 has some initial state
        chronicle1.set_state(r#"{"version":"1.0","stack":{"stack":[],"drawn":[],"discards":[]}}"#).unwrap();

        // Chronicle 2 has different initial state
        chronicle2.set_state(r#"{"version":"2.0","zones":{"main":[]}}"#).unwrap();

        // Generate sync message from chronicle1 (no prior sync state)
        let sync_result1 = chronicle1.generate_sync_message(None).unwrap();
        let parsed1: serde_json::Value = serde_json::from_str(&sync_result1).unwrap();

        // The sync should produce a message
        assert!(parsed1["hasMessage"].as_bool().unwrap());
        assert!(parsed1["syncState"].is_string());

        // Chronicle2 receives the sync message
        if let Some(msg) = parsed1["message"].as_str() {
            // Decode the sync state from base64 for receiving
            let sync_state_base64 = parsed1["syncState"].as_str().unwrap();
            let sync_state_bytes = base64_decode(sync_state_base64).unwrap();

            let receive_result = chronicle2.receive_sync_message(msg, Some(sync_state_bytes)).unwrap();
            let parsed_receive: serde_json::Value = serde_json::from_str(&receive_result).unwrap();

            // Should get a response or updated sync state
            assert!(parsed_receive["syncState"].is_string());
        }
    }

    #[test]
    fn test_sync_full_backwards_compat() {
        // Test the simple full-document sync method
        let mut chronicle1 = Chronicle::new();
        let mut chronicle2 = Chronicle::new();

        chronicle1.set_state(r#"{"version":"1.0"}"#).unwrap();
        chronicle2.set_state(r#"{"zones":{"zone1":[]}}"#).unwrap();

        // Full sync by saving and merging
        let data = chronicle2.save().unwrap();
        chronicle1.sync_full(&data).unwrap();

        let result = chronicle1.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&result).unwrap();

        // Both fields should be present after sync
        assert!(state.version.is_some());
        assert!(state.zones.is_some());
    }
}
