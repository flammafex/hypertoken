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
// ./interface/OpenAIAgent.js
export class OpenAIAgent {
  constructor(apiClient, {
    model = "gpt-4o-mini",
    systemPrompt = "You control a simulation engine.",
    temperature = 0
  } = {}) {
    this.api = apiClient;
    this.model = model;
    this.systemPrompt = systemPrompt;
    this.temperature = temperature;
  }

  async think(engine, agent) {
    const snapshot = engine.describe();
    const actions = engine.availableActions?.() ?? [];
    const payload = { state: snapshot, availableActions: actions, agent: agent.name };

    const messages = [
      { role: "system", content: this.systemPrompt },
      { role: "user", content: JSON.stringify(payload, null, 2) }
    ];

    try {
      const completion = await this.api.chat.completions.create({
        model: this.model,
        temperature: this.temperature,
        messages,
        tools: [
          {
            type: "function",
            function: {
              name: "dispatchAction",
              description: "Choose a valid action for the agent to execute on the engine.",
              parameters: {
                type: "object",
                properties: {
                  type: { type: "string", description: "Action type identifier" },
                  payload: { type: "object", description: "Action parameters" }
                },
                required: ["type"]
              }
            }
          }
        ],
        tool_choice: "auto"
      });

      const toolCall = completion.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) return null;

      const args = toolCall.function?.arguments;
      const decision = typeof args === "string" ? JSON.parse(args) : args;
      return decision;
    } catch (err) {
      console.error("OpenAIAgent.think() error:", err);
      return null;
    }
  }
}
