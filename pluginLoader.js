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
// ./pluginLoader.js
import { Emitter } from "./core/events.js";

/**
 * Lightweight plugin loader usable in Node or browser.
 * A plugin is any ESM module that exports `init(engineOrContext)` or `default(engineOrContext)`.
 *
 * @param {Array<string|{url?:string,meta?:any}>} list
 * @param {object} context - object passed to each plugin (e.g. Engine or API)
 * @param {Emitter} [bus] - optional event emitter for logging
 * @returns {Promise<Array<{url:string,module:any}>>}
 */
export async function loadPlugins(list = [], context = {}, bus = new Emitter()) {
  const loaded = [];

  for (const spec of list) {
    const raw = typeof spec === "string" ? spec : spec.url;
    if (!raw) {
      bus.emit("info", { msg: "Plugin skipped: empty spec" });
      continue;
    }

    let url;
    try {
      url = new URL(raw, import.meta.url).href;
    } catch {
      url = raw; // works for absolute or file paths
    }

    try {
      const mod = await import(/* @vite-ignore */ url);
      const entry = typeof mod?.init === "function"
        ? mod.init
        : typeof mod?.default === "function"
          ? mod.default
          : null;

      if (entry) {
        await entry(context);
        bus.emit("info", { msg: `Plugin loaded: ${url}` });
      } else {
        bus.emit("info", { msg: `Plugin loaded (no init): ${url}` });
      }

      loaded.push({ url, module: mod });
    } catch (error) {
      bus.emit("error", { msg: `Plugin failed: ${url}`, error });
    }
  }

  return loaded;
}
