# Multi-stage build for HyperToken
# Stage 1: Build environment with Rust and Node.js
FROM node:20-bookworm as builder

# Install Rust toolchain
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Add wasm32 target
RUN rustup target add wasm32-unknown-unknown

# Install wasm-pack
RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY packages/quickstart/package*.json ./packages/quickstart/

# Install Node dependencies
RUN npm install

# Copy Rust source code
COPY core-rs/ ./core-rs/

# Build Rust/WASM core
WORKDIR /app/core-rs
RUN chmod +x build.sh && ./build.sh

# Copy TypeScript source code
WORKDIR /app
COPY . .

# Compile TypeScript
RUN npx tsc

# Stage 2: Runtime environment (smaller image)
FROM node:20-bookworm-slim

WORKDIR /app

# Copy package files for reference
COPY package*.json ./

# Copy node_modules from builder (more efficient than reinstalling)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

# Copy compiled outputs from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/core-rs/pkg ./core-rs/pkg

# Copy necessary runtime files
COPY start-relay.js ./
COPY examples/ ./examples/

# Expose default ports
# 3000 - Relay server
# 8080 - WebRTC test server
# 9090 - Blackjack server
EXPOSE 3000 8080 9090

# Default command: run the quickstart CLI
CMD ["npx", "hypertoken-quickstart"]
