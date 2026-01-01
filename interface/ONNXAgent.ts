/*
 * interface/ONNXAgent.ts
 * Run trained ONNX policies in browser/Node.js
 *
 * Implements the IAgent interface so it can be used with HyperToken's
 * Agent system for autonomous play.
 *
 * Usage:
 *   const agent = new ONNXAgent();
 *   await agent.load('/models/blackjack_policy.onnx');
 *
 *   // Use with Agent
 *   const player = new Agent('Bot', { agent });
 *   await player.think(engine);  // Bot makes decision via ONNX inference
 */

import { Emitter } from "../core/events.js";
import type { Engine } from "../engine/Engine.js";
import type { Agent } from "../engine/Agent.js";
import type { IAgent } from "../engine/Agent.js";
import type { Observation } from "./Gym.js";

// ONNX Runtime types (loaded dynamically)
interface OrtInferenceSession {
  inputNames: string[];
  outputNames: string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array }>>;
}

interface OrtTensorConstructor {
  new (type: string, data: Float32Array, dims: number[]): unknown;
}

interface OrtModule {
  InferenceSession: {
    create(path: string): Promise<OrtInferenceSession>;
  };
  Tensor: OrtTensorConstructor;
}

export interface ONNXAgentOptions {
  /** Path to .onnx model file */
  modelPath?: string;

  /** Path to metadata JSON (action mappings, etc.) */
  metadataPath?: string;

  /**
   * Function to extract observation from engine state.
   * If not provided, uses metadata or requires manual observe() calls.
   */
  observationExtractor?: (engine: Engine, agent: Agent) => Observation;

  /**
   * Action mapping: index -> action type
   * e.g., { 0: 'blackjack:hit', 1: 'blackjack:stand' }
   */
  actionMap?: Record<number, string>;

  /**
   * Selection strategy for actions
   * - 'argmax': Always pick highest probability (deterministic)
   * - 'sample': Sample from probability distribution (stochastic)
   */
  selectionStrategy?: "argmax" | "sample";

  /** Enable debug logging */
  debug?: boolean;
}

export interface ONNXMetadata {
  env?: string;
  actions?: string[];
  actionMap?: Record<number, string>;
  observationFeatures?: string[];
  observationShape?: number[];
  _export_info?: {
    algorithm?: string;
    observation_shape?: number[];
    action_type?: string;
    opset_version?: number;
  };
}

/**
 * ONNXAgent: Run trained neural network policies in browser/Node.js
 *
 * Implements IAgent interface for use with HyperToken's Agent system.
 * Supports both browser (onnxruntime-web) and Node.js (onnxruntime-node).
 */
export class ONNXAgent extends Emitter implements IAgent {
  private session: OrtInferenceSession | null = null;
  private metadata: ONNXMetadata | null = null;
  private options: Required<ONNXAgentOptions>;
  private ort: OrtModule | null = null;

  /** Whether the model is loaded and ready for inference */
  public ready: boolean = false;

  constructor(options: ONNXAgentOptions = {}) {
    super();

    this.options = {
      modelPath: options.modelPath ?? "",
      metadataPath: options.metadataPath ?? "",
      observationExtractor:
        options.observationExtractor ?? this.defaultObservationExtractor.bind(this),
      actionMap: options.actionMap ?? {},
      selectionStrategy: options.selectionStrategy ?? "argmax",
      debug: options.debug ?? false,
    };
  }

  /**
   * Load ONNX model (works in both browser and Node.js)
   *
   * @param modelPath - Path to .onnx file (overrides constructor option)
   * @param metadataPath - Path to metadata JSON (overrides constructor option)
   */
  async load(modelPath?: string, metadataPath?: string): Promise<void> {
    const model = modelPath ?? this.options.modelPath;
    const meta = metadataPath ?? this.options.metadataPath;

    if (!model) {
      throw new Error("No model path provided");
    }

    // Dynamically import ONNX Runtime
    this.ort = await this.loadONNXRuntime();

    if (this.options.debug) {
      console.log("Loading ONNX model:", model);
    }

    // Load model
    this.session = await this.ort.InferenceSession.create(model);

    // Load metadata if available
    if (meta) {
      await this.loadMetadata(meta);
    } else {
      // Try to auto-discover metadata (same name, .json extension)
      const autoMetaPath = model.replace(/\.onnx$/, ".json");
      if (autoMetaPath !== model) {
        await this.loadMetadata(autoMetaPath).catch(() => {
          if (this.options.debug) {
            console.log("No metadata found at", autoMetaPath);
          }
        });
      }
    }

    this.ready = true;
    this.emit("agent:loaded", { modelPath: model });

    if (this.options.debug) {
      console.log("ONNX model loaded");
      console.log("   Inputs:", this.session.inputNames);
      console.log("   Outputs:", this.session.outputNames);
    }
  }

  /**
   * Load metadata from JSON file
   */
  private async loadMetadata(metadataPath: string): Promise<void> {
    try {
      const response = await fetch(metadataPath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      this.metadata = await response.json();

      // Apply metadata to options
      if (this.metadata?.actions) {
        this.options.actionMap = {};
        this.metadata.actions.forEach((action, i) => {
          this.options.actionMap[i] = action;
        });
      }

      if (this.options.debug) {
        console.log("Loaded metadata:", this.metadata);
      }
    } catch (e) {
      if (this.options.debug) {
        console.log("Could not load metadata from", metadataPath);
      }
      throw e;
    }
  }

  /**
   * Load ONNX Runtime (handles browser vs Node.js)
   */
  private async loadONNXRuntime(): Promise<OrtModule> {
    // Check if we're in browser or Node.js
    const isBrowser = typeof window !== "undefined";

    if (isBrowser) {
      // Browser: use onnxruntime-web
      // First check if it's already loaded via script tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      if (win.ort) {
        return win.ort as OrtModule;
      }

      // Try dynamic import (onnxruntime-web is an optional peer dependency)
      try {
        // @ts-ignore - optional dependency, may not be installed
        const ort = await import("onnxruntime-web");
        return ort as unknown as OrtModule;
      } catch {
        throw new Error(
          "ONNX Runtime not found. Add to your HTML:\n" +
            '<script src="https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js"></script>'
        );
      }
    } else {
      // Node.js: use onnxruntime-node (optional peer dependency)
      try {
        // @ts-ignore - optional dependency, may not be installed
        const ort = await import("onnxruntime-node");
        return ort as unknown as OrtModule;
      } catch {
        throw new Error(
          "ONNX Runtime not found. Install with:\n" + "npm install onnxruntime-node"
        );
      }
    }
  }

  /**
   * Run inference on observation
   *
   * @param observation - Numeric observation array
   * @returns Action probabilities (for discrete) or action values (for continuous)
   */
  async predict(observation: Observation): Promise<Float32Array> {
    if (!this.session || !this.ort) {
      throw new Error("Model not loaded. Call load() first.");
    }

    // Create tensor from observation
    const inputTensor = new this.ort.Tensor(
      "float32",
      Float32Array.from(observation),
      [1, observation.length]
    );

    // Run inference
    const inputName = this.session.inputNames[0];
    const outputName = this.session.outputNames[0];

    const results = await this.session.run({ [inputName]: inputTensor });
    const output = results[outputName];

    return output.data as Float32Array;
  }

  /**
   * Select action index from probabilities
   *
   * @param probs - Action probabilities from model
   * @returns Selected action index
   */
  selectAction(probs: Float32Array): number {
    if (this.options.selectionStrategy === "sample") {
      return this.sampleFromDistribution(probs);
    } else {
      return this.argmax(probs);
    }
  }

  /**
   * IAgent interface: Make a decision based on current game state
   *
   * @param engine - The game engine
   * @param agent - The agent making the decision
   * @returns Action object { type, payload } or null
   */
  async think(engine: Engine, agent: Agent): Promise<{ type: string; payload: unknown } | null> {
    if (!this.ready) {
      console.warn("ONNXAgent: Model not loaded");
      return null;
    }

    try {
      // Extract observation
      const observation = this.options.observationExtractor(engine, agent);

      if (this.options.debug) {
        console.log("Observation:", observation);
      }

      // Run inference
      const probs = await this.predict(observation);

      if (this.options.debug) {
        console.log("Action probabilities:", Array.from(probs));
      }

      // Select action
      const actionIndex = this.selectAction(probs);
      const actionType = this.options.actionMap[actionIndex];

      if (!actionType) {
        console.warn(`ONNXAgent: No action mapping for index ${actionIndex}`);
        return null;
      }

      if (this.options.debug) {
        console.log("Selected action:", actionIndex, "->", actionType);
      }

      this.emit("agent:decision", {
        observation,
        probs: Array.from(probs),
        actionIndex,
        actionType,
      });

      return { type: actionType, payload: {} };
    } catch (error) {
      console.error("ONNXAgent inference error:", error);
      this.emit("agent:error", { error });
      return null;
    }
  }

  /**
   * Default observation extractor (override or provide custom)
   */
  private defaultObservationExtractor(_engine: Engine, _agent: Agent): Observation {
    // This is a fallback - users should provide a custom extractor
    console.warn(
      "ONNXAgent: Using default observation extractor. " +
        "Consider providing a custom observationExtractor for your environment."
    );

    // Return empty observation - will likely fail
    return [];
  }

  // --- Utility methods ---

  /**
   * Find index of maximum value in array
   */
  private argmax(arr: Float32Array): number {
    let maxIdx = 0;
    let maxVal = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] > maxVal) {
        maxVal = arr[i];
        maxIdx = i;
      }
    }
    return maxIdx;
  }

  /**
   * Sample from probability distribution
   */
  private sampleFromDistribution(probs: Float32Array): number {
    const r = Math.random();
    let cumulative = 0;
    for (let i = 0; i < probs.length; i++) {
      cumulative += probs[i];
      if (r < cumulative) {
        return i;
      }
    }
    return probs.length - 1;
  }

  /**
   * Get model info
   */
  getInfo(): { inputs: string[]; outputs: string[]; metadata: ONNXMetadata | null } {
    return {
      inputs: this.session?.inputNames ?? [],
      outputs: this.session?.outputNames ?? [],
      metadata: this.metadata,
    };
  }

  /**
   * Get current action mapping
   */
  getActionMap(): Record<number, string> {
    return { ...this.options.actionMap };
  }

  /**
   * Set action mapping
   */
  setActionMap(actionMap: Record<number, string>): void {
    this.options.actionMap = { ...actionMap };
  }

  /**
   * Set observation extractor function
   */
  setObservationExtractor(extractor: (engine: Engine, agent: Agent) => Observation): void {
    this.options.observationExtractor = extractor;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.session = null;
    this.ready = false;
    this.emit("agent:disposed", {});
  }
}
