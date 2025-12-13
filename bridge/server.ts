/**
 * HyperToken Environment Server
 *
 * Hosts PettingZoo environments and exposes them via WebSocket.
 * Allows Python (and other) clients to interact with HyperToken games.
 *
 * Protocol: JSON messages with { cmd, ...args } structure.
 *
 * Usage:
 *   npx tsx bridge/server.ts --env blackjack --port 9999
 *
 * Or programmatically:
 *   const server = new EnvServer({ envType: 'blackjack', port: 9999 });
 *   await server.start();
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { AECEnvironment } from "../interface/PettingZoo.js";
import { BlackjackAEC, BlackjackAECConfig } from "../examples/blackjack/BlackjackAEC.js";
import { RateLimiter, RateLimitConfig } from "../network/RateLimiter.js";
import type { Command, Response, EnvInfoResponse } from "./protocol.js";
import type { Space } from "../interface/Gym.js";

// ============================================================================
// Configuration
// ============================================================================

export interface EnvServerOptions {
  /** Port to listen on (default: 9999) */
  port?: number;
  /** Environment type to host */
  envType?: string;
  /** Environment-specific options */
  envOptions?: Record<string, unknown>;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Host to bind to (default: 0.0.0.0) */
  host?: string;
  /** Rate limiting config (optional, enabled by default) */
  rateLimit?: Partial<RateLimitConfig> | false;
}

interface ResolvedOptions {
  port: number;
  envType: string;
  envOptions: Record<string, unknown>;
  verbose: boolean;
  host: string;
}

// ============================================================================
// Environment Registry
// ============================================================================

type EnvFactory = (options: Record<string, unknown>) => AECEnvironment;

const ENV_REGISTRY: Record<string, EnvFactory> = {
  blackjack: (options) =>
    new BlackjackAEC(options as BlackjackAECConfig),
  // Add more environments here as they are implemented:
  // 'prisoners-dilemma': (options) => new PrisonersDilemmaAEC(options),
  // 'tictactoe': (options) => new TicTacToeAEC(options),
};

// ============================================================================
// EnvServer Class
// ============================================================================

export class EnvServer {
  private httpServer: ReturnType<typeof createServer> | null = null;
  private wss: WebSocketServer | null = null;
  private env: AECEnvironment | null = null;
  private options: ResolvedOptions;
  private clientCount: number = 0;
  private rateLimiter: RateLimiter | null = null;
  private clientIds: Map<WebSocket, string> = new Map();
  private startTime: number = Date.now();

  constructor(options: EnvServerOptions = {}) {
    this.options = {
      port: options.port ?? 9999,
      envType: options.envType ?? "blackjack",
      envOptions: options.envOptions ?? {},
      verbose: options.verbose ?? false,
      host: options.host ?? "0.0.0.0",
    };

    // Initialize rate limiter unless explicitly disabled
    if (options.rateLimit !== false) {
      this.rateLimiter = new RateLimiter(options.rateLimit ?? {});
    }
  }

  /**
   * Start the WebSocket server with HTTP health endpoint.
   */
  async start(): Promise<void> {
    this.startTime = Date.now();

    // Create the environment
    this.env = this.createEnvironment(
      this.options.envType,
      this.options.envOptions
    );

    // Create HTTP server with health check endpoint
    this.httpServer = createServer((req, res) => this.handleHttpRequest(req, res));

    // Attach WebSocket server to HTTP server
    this.wss = new WebSocketServer({ server: this.httpServer });

    console.log(
      `🎮 HyperToken EnvServer running on ws://${this.options.host}:${this.options.port}`
    );
    console.log(`   Environment: ${this.options.envType}`);
    console.log(`   Options: ${JSON.stringify(this.options.envOptions)}`);
    console.log(`   Health check: http://${this.options.host}:${this.options.port}/health`);
    if (this.rateLimiter) {
      console.log(`   Rate limiting: enabled`);
    }

    this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));

    this.wss.on("error", (error) => {
      console.error("[EnvServer] Server error:", error);
    });

    // Start listening
    return new Promise((resolve) => {
      this.httpServer!.listen(this.options.port, this.options.host, () => {
        resolve();
      });
    });
  }

  /**
   * Handle HTTP requests (health check endpoint).
   */
  private handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
    if (req.url === "/health" || req.url === "/health/") {
      const health = {
        status: "healthy",
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        environment: this.options.envType,
        connections: this.clientIds.size,
        rateLimit: this.rateLimiter?.getStats() ?? null,
      };

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(health));
      return;
    }

    if (req.url === "/ready" || req.url === "/ready/") {
      // Readiness check - is the environment initialized?
      const ready = this.env !== null;
      res.writeHead(ready ? 200 : 503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ready }));
      return;
    }

    // For any other HTTP request, return 426 Upgrade Required
    res.writeHead(426, { "Content-Type": "text/plain" });
    res.end("WebSocket connection required. Use ws:// protocol.");
  }

  /**
   * Stop the server and cleanup.
   */
  stop(): void {
    if (this.options.verbose) {
      console.log("[EnvServer] Shutting down...");
    }

    this.env?.close();
    this.wss?.close();
    this.httpServer?.close();
    this.rateLimiter?.destroy();

    this.wss = null;
    this.httpServer = null;
    this.env = null;
    this.clientIds.clear();

    console.log("[EnvServer] Server stopped.");
  }

  /**
   * Create an environment instance from the registry.
   */
  private createEnvironment(
    type: string,
    options: Record<string, unknown>
  ): AECEnvironment {
    const factory = ENV_REGISTRY[type];
    if (!factory) {
      const available = Object.keys(ENV_REGISTRY).join(", ");
      throw new Error(
        `Unknown environment type: "${type}". Available: ${available}`
      );
    }
    return factory(options);
  }

  /**
   * Handle a new WebSocket connection.
   */
  private handleConnection(ws: WebSocket, req: any): void {
    this.clientCount++;
    const clientId = `client-${this.clientCount}`;
    this.clientIds.set(ws, clientId);

    if (this.options.verbose) {
      const addr = req.socket.remoteAddress;
      console.log(`[EnvServer] ${clientId} connected from ${addr}`);
    }

    ws.on("message", async (data) => {
      // Rate limiting check
      if (this.rateLimiter && !this.rateLimiter.check(clientId)) {
        console.warn(`[EnvServer] ${clientId} rate limited, closing connection`);
        ws.close(1008, "Rate limit exceeded");
        return;
      }

      try {
        const msg = JSON.parse(data.toString()) as Command;

        if (this.options.verbose) {
          console.log(`[EnvServer] ${clientId} -> ${JSON.stringify(msg)}`);
        }

        const response = await this.handleCommand(msg);

        if (this.options.verbose) {
          const respPreview =
            JSON.stringify(response).slice(0, 200) +
            (JSON.stringify(response).length > 200 ? "..." : "");
          console.log(`[EnvServer] ${clientId} <- ${respPreview}`);
        }

        ws.send(JSON.stringify(response));
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        console.error(`[EnvServer] ${clientId} error:`, errorMsg);
        ws.send(JSON.stringify({ error: errorMsg }));
      }
    });

    ws.on("close", () => {
      this.clientIds.delete(ws);
      this.rateLimiter?.remove(clientId);

      if (this.options.verbose) {
        console.log(`[EnvServer] ${clientId} disconnected`);
      }
    });

    ws.on("error", (error) => {
      console.error(`[EnvServer] ${clientId} WebSocket error:`, error);
    });
  }

  /**
   * Handle a command from the client.
   */
  private async handleCommand(cmd: Command): Promise<Response> {
    if (!this.env) {
      throw new Error("Environment not initialized");
    }

    switch (cmd.cmd) {
      case "reset":
        await this.env.reset(cmd.seed);
        return { ok: true };

      case "step":
        await this.env.step(cmd.action);
        return { ok: true };

      case "observe":
        return { observation: this.env.observe(cmd.agent) };

      case "last": {
        const result = this.env.last();
        return {
          observation: result.observation,
          reward: result.reward,
          terminated: result.terminated,
          truncated: result.truncated,
          info: result.info,
        };
      }

      case "agents":
        return { agents: this.env.agents };

      case "possible_agents":
        return { possible_agents: this.env.possibleAgents };

      case "agent_selection":
        return { agent: this.env.agentSelection() };

      case "observation_space":
        return { space: this.env.observationSpace(cmd.agent) };

      case "action_space":
        return { space: this.env.actionSpace(cmd.agent) };

      case "rewards":
        return { rewards: this.env.rewards() };

      case "terminations":
        return { terminations: this.env.terminations() };

      case "truncations":
        return { truncations: this.env.truncations() };

      case "infos":
        return { infos: this.env.infos() };

      case "action_mask": {
        const mask = this.env.actionMask(cmd.agent);
        return { mask: mask ?? null };
      }

      case "render":
        this.env.render();
        return { ok: true };

      case "close":
        this.env.close();
        return { ok: true };

      case "ping":
        return { pong: Date.now() };

      case "env_info": {
        // Return full environment info for initial setup
        const possibleAgents = this.env.possibleAgents;
        const observationSpaces: Record<string, Space> = {};
        const actionSpaces: Record<string, Space> = {};

        for (const agent of possibleAgents) {
          observationSpaces[agent] = this.env.observationSpace(agent);
          actionSpaces[agent] = this.env.actionSpace(agent);
        }

        return {
          env_type: this.options.envType,
          env_options: this.options.envOptions,
          possible_agents: possibleAgents,
          observation_spaces: observationSpaces,
          action_spaces: actionSpaces,
        } as EnvInfoResponse;
      }

      default:
        throw new Error(`Unknown command: ${(cmd as { cmd: string }).cmd}`);
    }
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

function parseArgs(): EnvServerOptions {
  const args = process.argv.slice(2);
  const options: EnvServerOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--port":
      case "-p":
        options.port = parseInt(args[++i], 10);
        break;

      case "--env":
      case "-e":
        options.envType = args[++i];
        break;

      case "--verbose":
      case "-v":
        options.verbose = true;
        break;

      case "--host":
      case "-h":
        options.host = args[++i];
        break;

      case "--agents":
      case "-a":
        options.envOptions = options.envOptions || {};
        options.envOptions.numAgents = parseInt(args[++i], 10);
        break;

      case "--decks":
      case "-d":
        options.envOptions = options.envOptions || {};
        options.envOptions.numDecks = parseInt(args[++i], 10);
        break;

      case "--seed":
      case "-s":
        options.envOptions = options.envOptions || {};
        options.envOptions.seed = parseInt(args[++i], 10);
        break;

      case "--help":
        printHelp();
        process.exit(0);

      default:
        if (arg.startsWith("-")) {
          console.error(`Unknown option: ${arg}`);
          printHelp();
          process.exit(1);
        }
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
HyperToken Environment Server

Usage: npx tsx bridge/server.ts [options]

Options:
  --port, -p <port>     Port to listen on (default: 9999)
  --env, -e <type>      Environment type (default: blackjack)
  --host, -h <host>     Host to bind to (default: 0.0.0.0)
  --verbose, -v         Enable verbose logging
  --agents, -a <num>    Number of agents (blackjack)
  --decks, -d <num>     Number of decks (blackjack)
  --seed, -s <num>      Random seed
  --help                Show this help message

Available Environments:
  blackjack             Multi-agent blackjack (AEC)

Examples:
  npx tsx bridge/server.ts --env blackjack --port 9999
  npx tsx bridge/server.ts -e blackjack -a 3 -v
  `);
}

// Run if executed directly
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("server.ts") ||
  process.argv[1]?.endsWith("server.js");

if (isMainModule) {
  const options = parseArgs();
  const server = new EnvServer(options);

  // Handle shutdown signals
  process.on("SIGINT", () => {
    console.log("\n[EnvServer] Received SIGINT, shutting down...");
    server.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("[EnvServer] Received SIGTERM, shutting down...");
    server.stop();
    process.exit(0);
  });

  server.start().catch((error) => {
    console.error("[EnvServer] Failed to start:", error);
    process.exit(1);
  });
}
