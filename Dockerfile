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

# Copy all source code first (so npm install can run build scripts successfully)
COPY . .

# Install Node dependencies (build scripts will run but now all config files are present)
RUN npm install

# Build Rust/WASM core
WORKDIR /app/core-rs
RUN chmod +x build.sh && ./build.sh

# Compile TypeScript (root project)
WORKDIR /app
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
COPY examples/ ./examples/

# Expose default ports
# 3000 - Relay server
# 9999 - Bridge server (Gym/PettingZoo)
EXPOSE 3000 9999

# Environment variables for bridge server
ENV BRIDGE_PORT=9999
ENV BRIDGE_ENV=poker
ENV BRIDGE_HOST=0.0.0.0

# Default command: run the poker bridge server with RL features
# Override with: docker run ... hypertoken npx hypertoken-quickstart
CMD ["node", "dist/cli/index.js", "bridge", "poker", "--rich", "--extended", "--shaped", "--port", "9999", "--host", "0.0.0.0"]
