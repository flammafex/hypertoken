// HyperToken Core - Rust/WASM Implementation
// Copyright 2025 The Carpocratian Church of Commonality and Equality, Inc.
// Licensed under the Apache License, Version 2.0

//! # HyperToken Core (Rust/WASM)
//!
//! This module provides the high-performance Rust implementation of HyperToken's
//! CRDT-based state management system, compiled to WebAssembly.
//!
//! ## Architecture
//!
//! - **Chronicle**: CRDT document wrapper using automerge-rs
//! - **Token**: Universal entity representation
//! - **Stack**: Ordered collection with shuffle/draw operations
//! - **Space**: 2D placement with zone management
//! - **Actions**: Core game logic operations
//!
//! ## Performance Goals
//!
//! Target 10-100x improvement over TypeScript implementation:
//! - Stack shuffle (1000 tokens): 986ms → ~10-50ms
//! - Space placement (1000 tokens): 958ms → ~10-50ms
//! - Memory usage: 377MB → ~10-50MB

use wasm_bindgen::prelude::*;

// Module declarations
mod chronicle;
mod token;
mod stack;
mod space;
mod source;
mod actions;
mod agent;
mod token_ops;
mod gamestate;
mod types;
mod utils;
mod parallel;
mod batch;

// Re-exports
pub use chronicle::Chronicle;
pub use token::Token;
pub use stack::Stack;
pub use space::Space;
pub use source::Source;
pub use actions::ActionDispatcher;
pub use agent::AgentManager;
pub use token_ops::TokenOps;
pub use gamestate::GameStateManager;
pub use batch::BatchOps;

// WASM initialization
#[wasm_bindgen(start)]
pub fn init() {
    // Set up better panic messages in the browser console
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// Version information
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// Health check for WASM module
#[wasm_bindgen]
pub fn health_check() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        assert!(!version().is_empty());
    }

    #[test]
    fn test_health_check() {
        assert!(health_check());
    }
}
