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
//./test/testCore.js
import { Stack } from "../core/Stack.js";
import { Space } from "../core/Space.js";
import { Source } from "../core/Source.js";

const stack = new Stack([{ label: "A" }, { label: "B" }, { label: "C" }]);
stack.shuffle(123);
console.log("Stack size:", stack.size);

const c = stack.draw();
console.log("Drawn:", c.label);

const space = new Space();
space.place("altar", c);
console.log("Space zones:", space.zoneCount("altar"));

const source = new Source(stack);
source.shuffle(123);
console.log("Source remaining:", source.inspect().remaining);
