/*
 * Copyright 2025 The Carpocratian Church of Commonality and Equality, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/*
 * engine/PluginHost.ts
 * Plugin management and loading system
 */

import { Engine } from "./Engine.js";

/**
 * Plugin function type - receives the engine instance
 */
export type PluginFunction = (engine: Engine) => void;

/**
 * PluginHost manages plugin loading and lifecycle
 *
 * Plugins are functions that receive the engine instance and can:
 * - Register custom actions
 * - Attach event listeners
 * - Add policies or rules
 * - Extend engine functionality
 */
export class PluginHost {
  engine: Engine;
  plugins: Map<string, PluginFunction>;

  constructor(engine: Engine) {
    this.engine = engine;
    this.plugins = new Map();
  }

  /**
   * Load and execute a plugin
   *
   * @param name - Unique plugin identifier
   * @param fn - Plugin function to execute
   */
  load(name: string, fn: PluginFunction): void {
    this.plugins.set(name, fn);
    fn(this.engine);
    this.engine.emit("plugin:loaded", { payload: { name } });
  }

  /**
   * Check if a plugin is loaded
   */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Get a loaded plugin function
   */
  get(name: string): PluginFunction | undefined {
    return this.plugins.get(name);
  }

  /**
   * Unload a plugin (removes from registry, does not undo its effects)
   */
  unload(name: string): boolean {
    const removed = this.plugins.delete(name);
    if (removed) {
      this.engine.emit("plugin:unloaded", { payload: { name } });
    }
    return removed;
  }

  /**
   * Get list of loaded plugin names
   */
  list(): string[] {
    return Array.from(this.plugins.keys());
  }
}
