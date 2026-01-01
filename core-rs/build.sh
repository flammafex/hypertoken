#!/bin/bash

# Build script for HyperToken Core Rust/WASM module
# This script builds the Rust code and generates WASM bindings

set -e

echo "🦀 Building HyperToken Core (Rust → WASM)..."

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "❌ wasm-pack not found. Installing..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Build for Node.js (also works with bundlers)
echo "📦 Building for Node.js..."
wasm-pack build --target nodejs --out-dir pkg/nodejs

# Build for Web (for direct browser use)
echo "🌐 Building for Web..."
wasm-pack build --target web --out-dir pkg/web

# Build for Bundler (Webpack, Rollup, etc.)
echo "📦 Building for Bundler..."
wasm-pack build --target bundler --out-dir pkg/bundler

echo "✅ Build complete!"
echo ""
echo "Output locations:"
echo "  - Node.js: core-rs/pkg/nodejs/"
echo "  - Web:     core-rs/pkg/web/"
echo "  - Bundler: core-rs/pkg/bundler/"
