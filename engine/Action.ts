/*
 * Copyright 2025 The Carpocratian Church of Commonality and Equality, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/*
 * engine/Action.ts
 */
import { IAction, IActionPayload } from "../core/types.js";
import { generateId } from "../core/crypto.js";

export interface ActionOptions {
  seed?: number | null;
  reversible?: boolean;
}

export class Action implements IAction {
  id: string;
  type: string;
  payload: IActionPayload;
  seed?: number | null;
  reversible?: boolean;
  timestamp: number;
  result?: any; // To store the return value of the action

  constructor(
    type: string,
    payload: IActionPayload = {},
    { seed = null, reversible = true }: ActionOptions = {}
  ) {
    this.id = generateId();
    this.type = type;
    this.payload = payload;
    this.seed = seed;
    this.reversible = reversible;
    this.timestamp = Date.now();
  }

  static fromJSON(data: any): Action {
    const a = new Action(data.type, data.payload, {
      seed: data.seed,
      reversible: data.reversible
    });
    // Restore timestamp/id if present
    if (data.timestamp) a.timestamp = data.timestamp;
    if (data.id) a.id = data.id;
    return a;
  }

  toJSON(): any {
    return {
      id: this.id,
      type: this.type,
      payload: this.payload,
      seed: this.seed,
      reversible: this.reversible,
      timestamp: this.timestamp
    };
  }
}