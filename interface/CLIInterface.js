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
// ./interface/CLIInterface.js
// Simple interactive terminal for human control of the engine.

import readline from "node:readline";
import { Interpreter } from "./Interpreter.js";
import { Narrator } from "./Narrator.js";

export class CLIInterface {
  /**
   * @param {Engine} engine
   * @param {object} [opts]
   * @param {boolean} [opts.verbose=false]
   */
  constructor(engine, { verbose = false } = {}) {
    this.engine = engine;
    this.verbose = verbose;
    this.interpreter = new Interpreter();
    this.narrator = new Narrator(engine, { verbose });
  }

  start() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "🎮 > "
    });

    console.log("🕹️ Type commands like 'draw 1', 'shuffle', 'place altar', 'end'.");
    rl.prompt();

    rl.on("line", line => {
      const action = this.interpreter.parse(line);
      if (!action) {
        console.log("❓ Unknown command.");
      } else {
        this.engine.dispatch(action.type, action.payload);
      }

      if (this.verbose) {
        console.log(JSON.stringify(this.engine.describe(), null, 2));
      }
      rl.prompt();
    });

    rl.on("close", () => {
      console.log("👋 Exiting CLI interface.");
      process.exit(0);
    });
  }
}
