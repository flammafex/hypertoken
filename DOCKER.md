# HyperToken Docker Quickstart

Get HyperToken running in minutes with Docker! This guide provides everything you need to containerize and run HyperToken's distributed simulation engine.

## Prerequisites

- Docker Engine 20.10 or later
- Docker Compose V2 (comes with Docker Desktop)

## Quick Start

### 1. Build the Docker Image

```bash
docker build -t hypertoken:latest .
```

The build process:
- Installs Rust toolchain and wasm-pack
- Compiles Rust/WASM core for optimal performance
- Installs Node.js dependencies
- Compiles TypeScript to JavaScript
- Creates an optimized runtime image (~400MB)

### 2. Run the Relay Server

The relay server enables P2P synchronization between clients:

```bash
docker compose up relay
```

This starts the relay server on `http://localhost:3000`.

### 3. Run Interactive Quickstart

```bash
docker compose run --rm quickstart
```

This launches the interactive CLI to explore HyperToken's capabilities.

## Using Docker Compose Profiles

Docker Compose profiles let you run different service combinations:

### Relay Server Only (Default)

```bash
docker compose up
```

### CLI Quickstart

```bash
docker compose --profile cli run quickstart
```

### Run Example Applications

```bash
# Start blackjack server and clients
docker compose --profile examples up

# Or start specific services
docker compose up blackjack-server
docker compose run blackjack-alice
docker compose run blackjack-bob
```

## Running Custom Commands

### Execute Commands in Container

```bash
# Run the relay server on custom port
docker run -p 8080:8080 -e PORT=8080 hypertoken:latest node dist/cli/index.js relay --port 8080

# Run Prisoner's Dilemma example
docker run -it hypertoken:latest node dist/examples/prisoners-dilemma/pd-cli.js

# Run Accordion example
docker run -it hypertoken:latest node dist/examples/accordion/accordion.js
```

### Interactive Shell Access

```bash
# Start a bash shell in the container
docker run -it hypertoken:latest bash

# Now you can run any commands:
node dist/cli/index.js relay
node dist/cli/index.js bridge --env blackjack
npx hypertoken-quickstart
node dist/examples/blackjack/server.js
```

## Development Workflow

### Mount Local Code for Development

```bash
docker run -it \
  -v $(pwd)/dist:/app/dist \
  -v $(pwd)/core-rs/pkg:/app/core-rs/pkg \
  -p 3000:3000 \
  hypertoken:latest \
  node dist/cli/index.js relay
```

This mounts your local `dist/` and `core-rs/pkg/` directories so you can rebuild code outside Docker and see changes immediately.

### Rebuild After Code Changes

```bash
# Rebuild the image
docker compose build

# Or force rebuild without cache
docker compose build --no-cache
```

## Architecture

### Multi-Stage Build

The Dockerfile uses a multi-stage build for efficiency:

1. **Builder Stage** (`node:20-bookworm`):
   - Installs Rust toolchain (rustup, cargo)
   - Adds wasm32-unknown-unknown target
   - Installs wasm-pack
   - Builds Rust/WASM core modules
   - Compiles TypeScript

2. **Runtime Stage** (`node:20-bookworm-slim`):
   - Copies only production dependencies
   - Copies compiled artifacts
   - Much smaller final image (~400MB vs ~2GB)

### Exposed Ports

- **3000** - Relay server (P2P synchronization)
- **8080** - WebRTC test server
- **9090** - Blackjack example server

## Networking

### Container-to-Container Communication

Containers on the `hypertoken-network` bridge can communicate using service names:

```javascript
// From within a container:
const relayUrl = 'ws://relay:3000';
const blackjackUrl = 'http://blackjack-server:9090';
```

### Host-to-Container Communication

From your host machine:

```javascript
const relayUrl = 'ws://localhost:3000';
const blackjackUrl = 'http://localhost:9090';
```

## Troubleshooting

### Build Failures

**Issue**: Rust compilation fails
```bash
# Solution: Ensure you have enough memory allocated to Docker
# Docker Desktop: Settings → Resources → Memory (minimum 4GB recommended)
```

**Issue**: wasm-pack installation fails
```bash
# Solution: Build with no cache to get fresh downloads
docker build --no-cache -t hypertoken:latest .
```

### Runtime Issues

**Issue**: Container exits immediately
```bash
# Check logs
docker compose logs relay

# Run with interactive mode to see errors
docker run -it hypertoken:latest node dist/cli/index.js relay
```

**Issue**: Port already in use
```bash
# Change port mapping in docker-compose.yml or use:
docker compose up --scale relay=0
docker run -p 3001:3000 hypertoken:latest node dist/cli/index.js relay
```

### Performance Issues

**Issue**: Slow WASM execution
```bash
# Ensure you're using the release build
# Modify Dockerfile to use:
RUN cd core-rs && wasm-pack build --release --target nodejs --out-dir pkg/nodejs
```

## Advanced Usage

### Custom Environment Variables

```yaml
# docker-compose.override.yml
services:
  relay:
    environment:
      - PORT=3000
      - VERBOSE=true
      - NODE_ENV=production
```

### Volume Mounts for Persistence

```yaml
services:
  relay:
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
```

### Health Checks

```yaml
services:
  relay:
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## Production Deployment

### Build for Production

```bash
# Use BuildKit for better caching
DOCKER_BUILDKIT=1 docker build -t hypertoken:latest .

# Tag for registry
docker tag hypertoken:latest your-registry.com/hypertoken:v1.0.0

# Push to registry
docker push your-registry.com/hypertoken:v1.0.0
```

### Security Best Practices

1. **Run as non-root user**: Add to Dockerfile:
   ```dockerfile
   RUN useradd -m -u 1001 hypertoken
   USER hypertoken
   ```

2. **Scan for vulnerabilities**:
   ```bash
   docker scan hypertoken:latest
   ```

3. **Use specific base image tags**: Instead of `node:20`, use `node:20.11.0-bookworm-slim`

### Orchestration with Kubernetes

Example deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hypertoken-relay
spec:
  replicas: 3
  selector:
    matchLabels:
      app: hypertoken-relay
  template:
    metadata:
      labels:
        app: hypertoken-relay
    spec:
      containers:
      - name: relay
        image: hypertoken:latest
        command: ["node", "dist/cli/index.js", "relay"]
        ports:
        - containerPort: 3000
        env:
        - name: PORT
          value: "3000"
---
apiVersion: v1
kind: Service
metadata:
  name: hypertoken-relay
spec:
  selector:
    app: hypertoken-relay
  ports:
  - port: 3000
    targetPort: 3000
  type: LoadBalancer
```

## Next Steps

- Read the main [README.md](./README.md) for HyperToken concepts
- Explore examples in `examples/` directory
- Build your own simulations using the [HyperToken API](./docs/)
- Join the community and share your creations!

## Support

- GitHub Issues: [Report bugs or request features](https://github.com/flammafex/hypertoken/issues)
- Documentation: [Full HyperToken docs](./docs/)
- Examples: See `examples/` for complete working applications
