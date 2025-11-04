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
//.engine/actions.js
export const ActionRegistry = {
  "deck:shuffle": (eng, p) => eng.deck.shuffle(p.seed),
  "deck:draw":    (eng, p) => eng.deck.draw(p.count ?? 1),
  "table:place":  (eng, p) => eng.table.place(p.zone, p.card, p.opts),
  "table:clear":  (eng)    => eng.table.clear(),
  "shoe:draw":    (eng, p) => eng.shoe.draw(p.count ?? 1),
  // …extend with new Deck/Table/Shoe verbs here…
};