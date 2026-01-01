/*
 * Copyright 2025 The Carpocratian Church of Commonality and Equality, Inc.
// ... (licenses and comments)
 */
// ./exporters.js
/**
 * Generate a plain-text representation of a space spread.
 * @param {Space} space - Space instance
 * @param {string} name - Spread name
 * @param {(card:any)=>string} [formatFn] - Optional token formatter
 * @returns {string} Multiline text listing zone → cards
 */
export function exportSpread(space, name, formatFn = c => c?.label || String(c)) {
  if (!space || typeof space.cards !== "function") {
    throw new Error("exportSpread() requires a valid Space instance");
  }

  const zones = space.spreads?.[name] || [];
  if (!zones.length) return `(Spread "${name}" not found.)`;

  const lines = zones.map(z => {
    const cards = space.cards(z.id);
    // FIX: Access the nested 'tokenSnapshot' property which holds the actual IToken object.
    const tokens = cards.map(p => formatFn(p.tokenSnapshot)).join(" | ");
    return `${z.label || z.id}: ${tokens || "(empty)"}`;
  });

  return lines.join("\n");
}

/**
 * Export a full space snapshot as JSON.
 * Useful for saving or interop without referencing UI state.
 */
export function exportSpaceJSON(space) {
  if (!space || typeof space.snapshot !== "function")
    throw new Error("exportSpaceJSON() requires a valid Space instance");
  return JSON.stringify(space.snapshot(), null, 2);
}
