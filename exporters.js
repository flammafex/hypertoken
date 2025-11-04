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
// ./exporters.js
/**
 * Generate a plain-text representation of a table spread.
 * @param {Table} table - Table instance
 * @param {string} name - Spread name
 * @param {(card:any)=>string} [formatFn] - Optional token formatter
 * @returns {string} Multiline text listing zone → cards
 */
export function exportSpread(table, name, formatFn = c => c?.label || String(c)) {
  if (!table || typeof table.cards !== "function") {
    throw new Error("exportSpread() requires a valid Table instance");
  }

  const zones = table.spreads?.[name] || [];
  if (!zones.length) return `(Spread "${name}" not found.)`;

  const lines = zones.map(z => {
    const cards = table.cards(z.id);
    const tokens = cards.map(p => formatFn(p.card)).join(" | ");
    return `${z.label || z.id}: ${tokens || "(empty)"}`;
  });

  return lines.join("\n");
}

/**
 * Export a full table snapshot as JSON.
 * Useful for saving or interop without referencing UI state.
 */
export function exportTableJSON(table) {
  if (!table || typeof table.snapshot !== "function")
    throw new Error("exportTableJSON() requires a valid Table instance");
  return JSON.stringify(table.snapshot(), null, 2);
}
