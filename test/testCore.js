/*
 * test/testCore.js
 */
import { Stack } from "../core/Stack.js";
import { Space } from "../core/Space.js";
import { Source } from "../core/Source.js";
import { Chronicle } from "../core/Chronicle.js";
import { Token } from "../core/Token.js"; // FIX: Import Token

// Create session
const session = new Chronicle(); 

const stack = new Stack(session, [
    new Token({ id: "A", label: "A" }), // FIX: Use Token instances with explicit IDs
    new Token({ id: "B", label: "B" }),
    new Token({ id: "C", label: "C" })
]); 
stack.shuffle(123);
console.log("Stack size:", stack.size);

const c = stack.draw();
console.log("Drawn:", c.label);

const space = new Space(session);
space.place("altar", c); 
console.log("Space zones:", space.zoneCount("altar"));

const source = new Source(session, [stack]);
source.shuffle(123);
console.log("Source remaining:", source.inspect().tokens.length);