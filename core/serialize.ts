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

import type { IToken } from "./types.js";

export function sanitizeToken(token: IToken): IToken {
  const plain = { ...token };
  if (plain._tags instanceof Set) {
    plain._tags = Array.from(plain._tags) as any;
  }
  return JSON.parse(JSON.stringify(plain));
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
