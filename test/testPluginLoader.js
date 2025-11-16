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
//./test/testPluginLoader.js
import { loadPlugins } from "../plugins/pluginLoader.js";
import { Emitter } from "../core/events.js";


const pluginSrc = 'export function init(ctx){ ctx.loaded = true; console.log("plugin init ok") }';
const pluginUrl = 'data:text/javascript;base64,' + Buffer.from(pluginSrc).toString('base64');
const ctx = {};
const bus = new Emitter();

bus.on("info", e => console.log("[INFO]",  e?.msg ?? e));
bus.on("error", e => console.error("[ERROR]", e?.msg ?? e));

const results = await loadPlugins([pluginUrl], ctx, bus);

console.log("Plugin loaded:", ctx.loaded === true);
console.log("Loaded count:", results.length);
