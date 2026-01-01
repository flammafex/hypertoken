/*
 * test/testExporters.js
 */
import { Space } from "../core/Space.js";
import { Stack } from "../core/Stack.js";
import { exportSpread, exportSpaceJSON } from "../exporters.js";
import { Chronicle } from "../core/Chronicle.js"; 
import { Token } from '../core/Token.js'; // FIX: Import Token

// Setup
const session = new Chronicle(); 
const stack = new Stack(session, [
    new Token({ id: "AS", label: "Ace of Spades" }), // FIX: Use Token
    new Token({ id: "2H", label: "Two of Hearts" })
]); 
const space = new Space(session); 

space.defineSpread("Test", [
  { id: "pos1", label: "Position 1" },
  { id: "pos2", label: "Position 2" }
]);

// Simulate draw and placement
const c1 = stack.draw();
const c2 = stack.draw();
space.place("pos1", c1);
space.place("pos2", c2);

// Test exportSpread
const text = exportSpread(space, "Test");
console.log("Spread text:\n" + text);

// Test JSON export
const json = exportSpaceJSON(space);
console.log("JSON snapshot length:", json.length);