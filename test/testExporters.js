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
//./test/testExporters.js
import { Table } from "../core/Table.js";
import { Deck } from "../core/Deck.js";
import { exportSpread, exportTableJSON } from "../exporters.js";

// Setup
const deck = new Deck([{ label: "Ace of Spades" }, { label: "Two of Hearts" }]);
const table = new Table();
table.defineSpread("Test", [
  { id: "pos1", label: "Position 1" },
  { id: "pos2", label: "Position 2" }
]);

// Simulate draw and placement
const c1 = deck.draw();
const c2 = deck.draw();
table.place("pos1", c1);
table.place("pos2", c2);

// Test exportSpread
const text = exportSpread(table, "Test");
console.log("Spread text:\n" + text);

// Test JSON export
const json = exportTableJSON(table);
console.log("JSON snapshot length:", json.length);
