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
// src/core/loaders/tokenSetLoader.js
import { Token } from "../Token.js";

/**
 * Normalize, validate, and load token set JSON
 * for use by the headless runtime (no DOM).
 */
function clean(str) {
  return String(str ?? "").trim();
}

function normalizeTokens(data) {
  const kind = data.kind ?? "default";
  if (!Array.isArray(data.tokens))
    throw new Error("Stack JSON must include tokens[]");

  return data.tokens.map((t, i) => new Token({
    ...t,
    group: t.group ?? t.suit ?? null,
    label: t.label ?? t.rank ?? t.id ?? `token-${i}`,
    kind,
    index: i
  }));
}

/** Parse an in-memory stack object into a normalized stack structure */
export function parseTokenSetObject(data) {
  const stack = {
    name: clean(data.name) || "Untitled Set",
    kind: clean(data.kind) || "default",
    description: clean(data.description) || "",
    tokens: normalizeTokens(data)
  };

  // Ensure unique IDs for all tokens
  const used = new Set(stack.tokens.map(t => t.id).filter(Boolean));
  for (const tok of stack.tokens) {
    if (!tok.id) {
      let base = `${stack.kind}-${tok.group ?? ""}-${tok.label ?? ""}`
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]/g, "");
      if (!base) base = `${stack.kind}-token`;
      let id = base, n = 2;
      while (used.has(id)) id = `${base}-${n++}`;
      tok.id = id;
      used.add(id);
    }
  }
  return stack;
}

/** Fetch + parse a stack JSON file into { name, kind, description, tokens[] } */
// loaders/tokenSetLoader.js
export async function loadTokenSetJSON(url, fetchImpl = (typeof fetch !== "undefined" ? fetch : null)) {
  if (!fetchImpl) throw new Error("No fetch implementation available");
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Failed to load token set: ${url}`);
  return parseTokenSetObject(await res.json());
}

