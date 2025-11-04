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
import { Deck } from "../core/Deck.js";
import { Table } from "../core/Table.js";
import { Shoe } from "../core/Shoe.js";

const deck = new Deck([{ label: "A" }, { label: "B" }, { label: "C" }]);
deck.shuffle(123);
console.log("Deck size:", deck.size);

const c = deck.draw();
console.log("Drawn:", c.label);

const table = new Table();
table.place("altar", c);
console.log("Table zones:", table.zoneCount("altar"));

const shoe = new Shoe(deck);
shoe.shuffle(123);
console.log("Shoe remaining:", shoe.inspect().remaining);
