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
// ./interface/Interpreter.js
// Converts natural or shorthand text commands into structured actions.

export class Interpreter {
  /**
   * Parse a human-readable command string into an engine action.
   * @param {string} text
   * @returns {{type:string,payload:object}|null}
   */
  parse(text) {
    const t = text.trim().toLowerCase();
    if (!t) return null;

    if (t.startsWith("draw")) {
      const n = parseInt(t.split(/\s+/)[1] ?? "1", 10);
      return { type: "stack:draw", payload: { count: n } };
    }

    if (t.startsWith("shuffle")) return { type: "stack:shuffle", payload: {} };
    if (t.startsWith("reset")) return { type: "stack:reset", payload: {} };

    if (t.startsWith("place")) {
      const zone = t.split(/\s+/)[1] ?? "space";
      return { type: "space:place", payload: { zone } };
    }

    if (t.startsWith("clear")) return { type: "space:clear", payload: {} };
    if (t.startsWith("end")) return { type: "loop:stop", payload: {} };

    return null; // unknown command
  }
}
