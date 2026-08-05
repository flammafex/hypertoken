# Multi-stage build for HyperToken
# Stage 1: Build environment with Node.js
FROM node:20-bookworm as builder

# Set working directory
WORKDIR /app

# Copy all source code first (so npm install can run build scripts successfully)
COPY . .

# Install Node dependencies (build scripts will run but now all config files are present)
RUN npm install

# Compile TypeScript (root project)
RUN npx tsc

# Stage 2: Runtime environment (smaller image)
FROM node:20-bookworm-slim

WORKDIR /app

# Copy package files for reference
COPY package*.json ./

# Copy node_modules from builder (more efficient than reinstalling)
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled outputs from builder
COPY --from=builder /app/dist ./dist

# Copy necessary runtime files
COPY examples/ ./examples/

# Expose default ports
# 3000 - Relay server
EXPOSE 3000

# Default command: run the relay server
CMD ["node", "dist/cli/index.js", "relay"]
