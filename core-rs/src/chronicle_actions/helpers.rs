// core-rs/src/chronicle_actions/helpers.rs
//
// Transaction-compatible helpers for reading and writing Automerge objects.
// These work inside transact() closures via the Transactable trait.

use automerge::{AutomergeError, ObjId, ObjType, ReadDoc, Value, transaction::Transactable};
use crate::types::{IToken, IPlacementCRDT, Metadata};
use std::collections::HashMap;

// ============================================================================
// Scalar readers (work with both Automerge and Transaction via ReadDoc)
// ============================================================================

pub fn read_string_rd<D: ReadDoc>(doc: &D, obj: &ObjId, key: &str) -> Option<String> {
    match doc.get(obj, key) {
        Ok(Some((Value::Scalar(s), _))) => {
            if let automerge::ScalarValue::Str(v) = s.as_ref() {
                Some(v.to_string())
            } else {
                None
            }
        }
        _ => None,
    }
}

pub fn read_i64_rd<D: ReadDoc>(doc: &D, obj: &ObjId, key: &str) -> Option<i64> {
    match doc.get(obj, key) {
        Ok(Some((Value::Scalar(s), _))) => {
            match s.as_ref() {
                automerge::ScalarValue::Int(v) => Some(*v),
                automerge::ScalarValue::Uint(v) => Some(*v as i64),
                _ => None,
            }
        }
        _ => None,
    }
}

pub fn read_f64_rd<D: ReadDoc>(doc: &D, obj: &ObjId, key: &str) -> Option<f64> {
    match doc.get(obj, key) {
        Ok(Some((Value::Scalar(s), _))) => {
            match s.as_ref() {
                automerge::ScalarValue::F64(v) => Some(*v),
                automerge::ScalarValue::Int(v) => Some(*v as f64),
                automerge::ScalarValue::Uint(v) => Some(*v as f64),
                _ => None,
            }
        }
        _ => None,
    }
}

pub fn read_bool_rd<D: ReadDoc>(doc: &D, obj: &ObjId, key: &str) -> Option<bool> {
    match doc.get(obj, key) {
        Ok(Some((Value::Scalar(s), _))) => {
            if let automerge::ScalarValue::Boolean(v) = s.as_ref() {
                Some(*v)
            } else {
                None
            }
        }
        _ => None,
    }
}

pub fn read_list_string_rd<D: ReadDoc>(doc: &D, list: &ObjId, index: usize) -> Option<String> {
    match doc.get(list, index) {
        Ok(Some((Value::Scalar(s), _))) => {
            if let automerge::ScalarValue::Str(v) = s.as_ref() {
                Some(v.to_string())
            } else {
                None
            }
        }
        _ => None,
    }
}

// ============================================================================
// Token read/write (transaction-compatible)
// ============================================================================

/// Read an IToken from an Automerge map object
pub fn read_token_rd<D: ReadDoc>(doc: &D, obj: &ObjId) -> IToken {
    let id = read_string_rd(doc, obj, "id").unwrap_or_default();
    let label = read_string_rd(doc, obj, "label");
    let group = read_string_rd(doc, obj, "group");
    let text = read_string_rd(doc, obj, "text").unwrap_or_default();
    let char = read_string_rd(doc, obj, "char").unwrap_or_else(|| "□".to_string());
    let kind = read_string_rd(doc, obj, "kind").unwrap_or_else(|| "default".to_string());
    let index = read_i64_rd(doc, obj, "index").unwrap_or(0) as i32;

    let meta: Metadata = read_string_rd(doc, obj, "meta")
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    let _rev = read_bool_rd(doc, obj, "_rev");
    let _tags = read_string_rd(doc, obj, "_tags")
        .and_then(|s| serde_json::from_str(&s).ok());
    let _attachedTo = read_string_rd(doc, obj, "_attachedTo");
    let _attachmentType = read_string_rd(doc, obj, "_attachmentType");
    let _merged = read_bool_rd(doc, obj, "_merged");
    let _mergedInto = read_string_rd(doc, obj, "_mergedInto");
    let _mergedFrom = read_string_rd(doc, obj, "_mergedFrom")
        .and_then(|s| serde_json::from_str(&s).ok());
    let _mergedAt = read_i64_rd(doc, obj, "_mergedAt");
    let _split = read_bool_rd(doc, obj, "_split");
    let _splitInto = read_string_rd(doc, obj, "_splitInto")
        .and_then(|s| serde_json::from_str(&s).ok());
    let _splitFrom = read_string_rd(doc, obj, "_splitFrom");
    let _splitIndex = read_i64_rd(doc, obj, "_splitIndex").map(|v| v as i32);
    let _splitAt = read_i64_rd(doc, obj, "_splitAt");

    IToken {
        id, label, group, text, meta, char, kind, index,
        _rev, _tags, _attachments: None, _attachedTo, _attachmentType,
        _merged, _mergedInto, _mergedFrom, _mergedAt,
        _split, _splitInto, _splitFrom, _splitIndex, _splitAt,
    }
}

/// Read a list of tokens from an Automerge list object
pub fn read_token_list_rd<D: ReadDoc>(doc: &D, list_id: &ObjId) -> Vec<IToken> {
    let len = doc.length(list_id);
    let mut tokens = Vec::with_capacity(len);
    for i in 0..len {
        if let Ok(Some((_, token_id))) = doc.get(list_id, i) {
            tokens.push(read_token_rd(doc, &token_id));
        }
    }
    tokens
}

/// Write an IToken to an Automerge map object (inside a transaction)
pub fn write_token_tx<T: Transactable>(tx: &mut T, obj: &ObjId, token: &IToken) -> std::result::Result<(), AutomergeError> {
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

    let meta_json = serde_json::to_string(&token.meta).unwrap_or_else(|_| "{}".to_string());
    tx.put(obj, "meta", meta_json.as_str())?;

    if let Some(rev) = token._rev { tx.put(obj, "_rev", rev)?; }
    if let Some(tags) = &token._tags {
        let j = serde_json::to_string(tags).unwrap_or_else(|_| "[]".to_string());
        tx.put(obj, "_tags", j.as_str())?;
    }
    if let Some(v) = &token._attachedTo { tx.put(obj, "_attachedTo", v.as_str())?; }
    if let Some(v) = &token._attachmentType { tx.put(obj, "_attachmentType", v.as_str())?; }
    if let Some(v) = token._merged { tx.put(obj, "_merged", v)?; }
    if let Some(v) = &token._mergedInto { tx.put(obj, "_mergedInto", v.as_str())?; }
    if let Some(v) = &token._mergedFrom {
        let j = serde_json::to_string(v).unwrap_or_else(|_| "[]".to_string());
        tx.put(obj, "_mergedFrom", j.as_str())?;
    }
    if let Some(v) = token._mergedAt { tx.put(obj, "_mergedAt", v)?; }
    if let Some(v) = token._split { tx.put(obj, "_split", v)?; }
    if let Some(v) = &token._splitInto {
        let j = serde_json::to_string(v).unwrap_or_else(|_| "[]".to_string());
        tx.put(obj, "_splitInto", j.as_str())?;
    }
    if let Some(v) = &token._splitFrom { tx.put(obj, "_splitFrom", v.as_str())?; }
    if let Some(v) = token._splitIndex { tx.put(obj, "_splitIndex", v as i64)?; }
    if let Some(v) = token._splitAt { tx.put(obj, "_splitAt", v)?; }

    Ok(())
}

/// Write a placement to an Automerge map object (inside a transaction)
#[allow(non_snake_case)]
pub fn write_placement_tx<T: Transactable>(tx: &mut T, obj: &ObjId, p: &IPlacementCRDT) -> std::result::Result<(), AutomergeError> {
    tx.put(obj, "id", p.id.as_str())?;
    tx.put(obj, "tokenId", p.tokenId.as_str())?;

    let snapshot_obj = tx.put_object(obj, "tokenSnapshot", ObjType::Map)?;
    write_token_tx(tx, &snapshot_obj, &p.tokenSnapshot)?;

    if let Some(x) = p.x { tx.put(obj, "x", x)?; }
    if let Some(y) = p.y { tx.put(obj, "y", y)?; }
    tx.put(obj, "faceUp", p.faceUp)?;
    if let Some(label) = &p.label { tx.put(obj, "label", label.as_str())?; }
    tx.put(obj, "ts", p.ts)?;
    tx.put(obj, "reversed", p.reversed)?;

    let tags_json = serde_json::to_string(&p.tags).unwrap_or_else(|_| "[]".to_string());
    tx.put(obj, "tags", tags_json.as_str())?;

    Ok(())
}

/// Read a placement from an Automerge map object
#[allow(non_snake_case)]
pub fn read_placement_rd<D: ReadDoc>(doc: &D, obj: &ObjId) -> IPlacementCRDT {
    let id = read_string_rd(doc, obj, "id").unwrap_or_default();
    let token_id = read_string_rd(doc, obj, "tokenId").unwrap_or_default();

    let token_snapshot = if let Ok(Some((_, snap_id))) = doc.get(obj, "tokenSnapshot") {
        read_token_rd(doc, &snap_id)
    } else {
        IToken {
            id: String::new(), label: None, group: None, text: String::new(),
            meta: HashMap::new(), char: "□".to_string(), kind: "default".to_string(),
            index: 0, _rev: None, _tags: None, _attachments: None,
            _attachedTo: None, _attachmentType: None, _merged: None,
            _mergedInto: None, _mergedFrom: None, _mergedAt: None,
            _split: None, _splitInto: None, _splitFrom: None,
            _splitIndex: None, _splitAt: None,
        }
    };

    let x = read_f64_rd(doc, obj, "x");
    let y = read_f64_rd(doc, obj, "y");
    let face_up = read_bool_rd(doc, obj, "faceUp").unwrap_or(true);
    let label = read_string_rd(doc, obj, "label");
    let ts = read_i64_rd(doc, obj, "ts").unwrap_or(0);
    let reversed = read_bool_rd(doc, obj, "reversed").unwrap_or(false);
    let tags: Vec<String> = read_string_rd(doc, obj, "tags")
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    IPlacementCRDT {
        id, tokenId: token_id, tokenSnapshot: token_snapshot,
        x, y, faceUp: face_up, label, ts, reversed, tags,
    }
}
