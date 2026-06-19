var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// engine/actions.ts
function getAgentMap(engine) {
  return engine.session.state.agents ?? {};
}
function findAgent(engine, name) {
  const agent = getAgentMap(engine)[name];
  if (!agent) throw new Error(`Agent "${name}" not found`);
  return agent;
}
var StackActions, SpaceActions, SourceActions, AgentActions, GameActions, GameLoopActions, RuleActions, TokenActions, DebugActions, ActionRegistry;
var init_actions = __esm({
  "engine/actions.ts"() {
    "use strict";
    StackActions = {
      "stack:draw": (engine, { count = 1 } = {}) => {
        if (!engine.stack) throw new Error("No stack attached to engine");
        return engine.stack.draw(count);
      },
      "stack:peek": (engine, { count = 1 } = {}) => {
        if (!engine.stack) throw new Error("No stack attached to engine");
        return engine.stack.tokens.slice(-count).reverse();
      },
      "stack:shuffle": (engine, { seed = null } = {}) => {
        if (!engine.stack) throw new Error("No stack attached to engine");
        engine.stack.shuffle(seed ?? void 0);
      },
      "stack:burn": (engine, { count = 1 } = {}) => {
        if (!engine.stack) throw new Error("No stack attached to engine");
        return engine.stack.burn(count);
      },
      "stack:reset": (engine) => {
        if (!engine.stack) throw new Error("No stack attached to engine");
        engine.stack.reset();
      },
      "stack:cut": (engine, { position = 0 } = {}) => {
        if (!engine.stack) throw new Error("No stack attached to engine");
        engine.stack.cut(position);
      },
      "stack:insertAt": (engine, { position = 0, card } = {}) => {
        if (!engine.stack) throw new Error("No stack attached to engine");
        if (!card) throw new Error("card required");
        engine.stack.insertAt(card, position);
      },
      "stack:removeAt": (engine, { position = 0 } = {}) => {
        if (!engine.stack) throw new Error("No stack attached to engine");
        return engine.stack.removeAt(position);
      },
      "stack:swap": (engine, { i, j } = {}) => {
        if (!engine.stack) throw new Error("No stack attached to engine");
        engine.stack.swap(i, j);
      },
      "stack:reverse": (engine) => {
        if (!engine.stack) throw new Error("No stack attached to engine");
        engine.stack.reverseRange(0, engine.stack.size - 1);
      },
      "stack:discard": (engine, { card } = {}) => {
        if (!engine.stack) throw new Error("No stack attached to engine");
        if (!card) throw new Error("card required");
        return engine.stack.discard(card);
      }
    };
    SpaceActions = {
      "space:place": (engine, { zone, card, opts = {} } = {}) => {
        if (!engine.space) throw new Error("No space attached to engine");
        if (!zone) throw new Error("zone required");
        if (!card) throw new Error("card required");
        return engine.space.place(zone, card, opts);
      },
      "space:remove": (engine, { zone, placementId } = {}) => {
        if (!engine.space) throw new Error("No space attached to engine");
        engine.space.remove(zone, placementId);
      },
      "space:move": (engine, { fromZone, toZone, placementId, x, y } = {}) => {
        if (!engine.space) throw new Error("No space attached to engine");
        engine.space.move(fromZone, toZone, placementId, { x, y });
      },
      "space:flip": (engine, { zone, placementId, faceUp } = {}) => {
        if (!engine.space) throw new Error("No space attached to engine");
        engine.space.flip(zone, placementId, faceUp);
      },
      "space:createZone": (engine, { name, label, x, y } = {}) => {
        if (!engine.space) throw new Error("No space attached to engine");
        engine.space.createZone(name, { label, x, y });
      },
      "space:deleteZone": (engine, { name } = {}) => {
        if (!engine.space) throw new Error("No space attached to engine");
        engine.space.deleteZone(name);
      },
      "space:clearZone": (engine, { zone } = {}) => {
        if (!engine.space) throw new Error("No space attached to engine");
        engine.space.clearZone(zone);
      },
      "space:lockZone": (engine, { zone, locked = true } = {}) => {
        if (!engine.space) throw new Error("No space attached to engine");
        engine.space.lockZone(zone, locked);
      },
      "space:shuffleZone": (engine, { zone, seed } = {}) => {
        if (!engine.space) throw new Error("No space attached to engine");
        engine.space.shuffleZone(zone, seed);
      },
      "space:fanZone": (engine, { zone, ...opts } = {}) => {
        if (!engine.space) throw new Error("No space attached to engine");
        engine.space.fan(zone, opts);
      },
      "space:spreadZone": (engine, { zone, pattern, angleStep, radius } = {}) => {
        if (!engine.space) throw new Error("No space attached to engine");
        engine.space.spreadZone(zone, { pattern, angleStep, radius });
      },
      "space:stackZone": (engine, { zone } = {}) => {
        if (!engine.space) throw new Error("No space attached to engine");
        engine.space.stackZone(zone);
      },
      "space:transferZone": (engine, { fromZone, toZone } = {}) => {
        if (!engine.space) throw new Error("No space attached to engine");
        return engine.space.transferZone(fromZone, toZone);
      },
      "space:clear": (engine) => {
        if (!engine.space) throw new Error("No space attached to engine");
        engine.space.clear();
      }
    };
    SourceActions = {
      "source:draw": (engine, { count = 1 } = {}) => {
        if (!engine.source) throw new Error("No source attached to engine");
        return engine.source.draw(count);
      },
      "source:shuffle": (engine, { seed } = {}) => {
        if (!engine.source) throw new Error("No source attached to engine");
        engine.source.shuffle(seed);
      },
      "source:burn": (engine, { count = 1 } = {}) => {
        if (!engine.source) throw new Error("No source attached to engine");
        return engine.source.burn(count);
      },
      "source:addStack": (engine, { stack } = {}) => {
        if (!engine.source) throw new Error("No source attached to engine");
        if (!stack) throw new Error("stack required");
        engine.source.addStack(stack);
      },
      "source:removeStack": (engine, { stack } = {}) => {
        if (!engine.source) throw new Error("No source attached to engine");
        if (!stack) throw new Error("stack required");
        engine.source.removeStack(stack);
      },
      "source:reset": (engine) => {
        if (!engine.source) throw new Error("No source attached to engine");
        engine.source.reset();
      },
      "source:inspect": (engine) => {
        if (!engine.source) throw new Error("No source attached to engine");
        return engine.source.inspect();
      }
    };
    AgentActions = {
      "agent:create": (engine, { id, name, meta } = {}) => {
        if (!name) throw new Error("name required");
        if (getAgentMap(engine)[name]) throw new Error(`Agent "${name}" already exists`);
        const agent = {
          id: id ?? `agent-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name,
          meta: meta ?? {},
          active: true,
          resources: {},
          inventory: []
        };
        engine.session.change("agent:create", (doc) => {
          if (!doc.agents) doc.agents = {};
          doc.agents[name] = agent;
        });
        return agent;
      },
      "agent:remove": (engine, { name } = {}) => {
        if (!getAgentMap(engine)[name]) throw new Error(`Agent "${name}" not found`);
        engine.session.change("agent:remove", (doc) => {
          if (doc.agents) delete doc.agents[name];
        });
      },
      "agent:setActive": (engine, { name, active = true } = {}) => {
        findAgent(engine, name);
        engine.session.change("agent:setActive", (doc) => {
          if (doc.agents?.[name]) doc.agents[name].active = active;
        });
      },
      "agent:giveResource": (engine, { name, resource, amount = 1 } = {}) => {
        findAgent(engine, name);
        engine.session.change("agent:giveResource", (doc) => {
          if (!doc.agents?.[name]) return;
          if (!doc.agents[name].resources) doc.agents[name].resources = {};
          doc.agents[name].resources[resource] = (doc.agents[name].resources[resource] ?? 0) + amount;
        });
      },
      "agent:takeResource": (engine, { name, resource, amount = 1 } = {}) => {
        findAgent(engine, name);
        engine.session.change("agent:takeResource", (doc) => {
          if (!doc.agents?.[name]) return;
          if (!doc.agents[name].resources) doc.agents[name].resources = {};
          doc.agents[name].resources[resource] = (doc.agents[name].resources[resource] ?? 0) - amount;
        });
      },
      "agent:addToken": (engine, { name, token } = {}) => {
        findAgent(engine, name);
        engine.session.change("agent:addToken", (doc) => {
          if (!doc.agents?.[name]) return;
          if (!doc.agents[name].inventory) doc.agents[name].inventory = [];
          doc.agents[name].inventory.push(token);
        });
      },
      "agent:removeToken": (engine, { name, tokenId } = {}) => {
        const agent = findAgent(engine, name);
        const idx = (agent.inventory ?? []).findIndex((t) => t.id === tokenId);
        if (idx === -1) throw new Error(`Token "${tokenId}" not found in agent "${name}"`);
        const removed = agent.inventory[idx];
        engine.session.change("agent:removeToken", (doc) => {
          if (!doc.agents?.[name]?.inventory) return;
          const i = doc.agents[name].inventory.findIndex((t) => t.id === tokenId);
          if (i !== -1) doc.agents[name].inventory.splice(i, 1);
        });
        return removed;
      },
      "agent:get": (engine, { name } = {}) => {
        return findAgent(engine, name);
      },
      "agent:getAll": (engine) => {
        return engine._agents;
      },
      "agent:transferResource": (engine, { from, to, resource, amount = 1 } = {}) => {
        findAgent(engine, from);
        findAgent(engine, to);
        engine.session.change("agent:transferResource", (doc) => {
          if (!doc.agents) return;
          if (!doc.agents[from].resources) doc.agents[from].resources = {};
          if (!doc.agents[to].resources) doc.agents[to].resources = {};
          doc.agents[from].resources[resource] = (doc.agents[from].resources[resource] ?? 0) - amount;
          doc.agents[to].resources[resource] = (doc.agents[to].resources[resource] ?? 0) + amount;
          if (!doc.transactions) doc.transactions = [];
          doc.transactions.push({ type: "resource_transfer", from, to, resource, amount, timestamp: Date.now() });
        });
        const state2 = engine.session.state;
        return {
          from: state2.agents?.[from]?.resources?.[resource] ?? 0,
          to: state2.agents?.[to]?.resources?.[resource] ?? 0
        };
      },
      "agent:transferToken": (engine, { from, to, tokenId } = {}) => {
        const src = findAgent(engine, from);
        findAgent(engine, to);
        const idx = (src.inventory ?? []).findIndex((t) => t.id === tokenId);
        if (idx === -1) throw new Error(`Token "${tokenId}" not found in agent "${from}"`);
        const token = src.inventory[idx];
        engine.session.change("agent:transferToken", (doc) => {
          if (!doc.agents) return;
          const i = doc.agents[from].inventory.findIndex((t) => t.id === tokenId);
          if (i !== -1) {
            const [moved] = doc.agents[from].inventory.splice(i, 1);
            if (!doc.agents[to].inventory) doc.agents[to].inventory = [];
            doc.agents[to].inventory.push(moved);
          }
          if (!doc.transactions) doc.transactions = [];
          doc.transactions.push({ type: "token_transfer", from, to, token: tokenId, timestamp: Date.now() });
        });
        return token;
      },
      "agent:stealResource": (engine, { from, to, resource, amount = 1 } = {}) => {
        const src = findAgent(engine, from);
        findAgent(engine, to);
        const available = src.resources?.[resource] ?? 0;
        const stolen = Math.min(amount, available);
        engine.session.change("agent:stealResource", (doc) => {
          if (!doc.agents) return;
          if (!doc.agents[from].resources) doc.agents[from].resources = {};
          if (!doc.agents[to].resources) doc.agents[to].resources = {};
          doc.agents[from].resources[resource] = available - stolen;
          doc.agents[to].resources[resource] = (doc.agents[to].resources[resource] ?? 0) + stolen;
          if (!doc.transactions) doc.transactions = [];
          doc.transactions.push({ type: "steal_resource", from, to, resource, amount: stolen, timestamp: Date.now() });
        });
        const state2 = engine.session.state;
        return {
          stolen,
          from: state2.agents?.[from]?.resources?.[resource] ?? 0,
          to: state2.agents?.[to]?.resources?.[resource] ?? 0
        };
      },
      "agent:stealToken": (engine, { from, to, tokenId } = {}) => {
        const src = findAgent(engine, from);
        findAgent(engine, to);
        const idx = (src.inventory ?? []).findIndex((t) => t.id === tokenId);
        if (idx === -1) throw new Error(`Token "${tokenId}" not found in agent "${from}"`);
        const token = src.inventory[idx];
        engine.session.change("agent:stealToken", (doc) => {
          if (!doc.agents) return;
          const i = doc.agents[from].inventory.findIndex((t) => t.id === tokenId);
          if (i !== -1) {
            const [moved] = doc.agents[from].inventory.splice(i, 1);
            if (!doc.agents[to].inventory) doc.agents[to].inventory = [];
            doc.agents[to].inventory.push(moved);
          }
          if (!doc.transactions) doc.transactions = [];
          doc.transactions.push({ type: "steal_token", from, to, token: tokenId, timestamp: Date.now() });
        });
        return token;
      },
      "agent:trade": (engine, { agent1, agent2, offer1, offer2 } = {}) => {
        findAgent(engine, agent1);
        findAgent(engine, agent2);
        engine.session.change("agent:trade", (doc) => {
          if (!doc.agents) return;
          const a1 = doc.agents[agent1];
          const a2 = doc.agents[agent2];
          if (!a1.inventory) a1.inventory = [];
          if (!a2.inventory) a2.inventory = [];
          if (!a1.resources) a1.resources = {};
          if (!a2.resources) a2.resources = {};
          if (offer1?.token) {
            const idx = a1.inventory.findIndex((t) => t.id === offer1.token.id);
            if (idx !== -1) a2.inventory.push(...a1.inventory.splice(idx, 1));
          }
          if (offer1?.resource && offer1?.amount) {
            a1.resources[offer1.resource] = (a1.resources[offer1.resource] ?? 0) - offer1.amount;
            a2.resources[offer1.resource] = (a2.resources[offer1.resource] ?? 0) + offer1.amount;
          }
          if (offer2?.token) {
            const idx = a2.inventory.findIndex((t) => t.id === offer2.token.id);
            if (idx !== -1) a1.inventory.push(...a2.inventory.splice(idx, 1));
          }
          if (offer2?.resource && offer2?.amount) {
            a2.resources[offer2.resource] = (a2.resources[offer2.resource] ?? 0) - offer2.amount;
            a1.resources[offer2.resource] = (a1.resources[offer2.resource] ?? 0) + offer2.amount;
          }
          if (!doc.transactions) doc.transactions = [];
          doc.transactions.push({ type: "trade", from: agent1, to: agent2, agent1, agent2, offer1, offer2, timestamp: Date.now() });
        });
      },
      "agent:drawCards": (engine, { name, count = 1 } = {}) => {
        if (!engine.stack) throw new Error("No stack attached to engine");
        findAgent(engine, name);
        const drawn = engine.stack.draw(count);
        const cards = Array.isArray(drawn) ? drawn : drawn ? [drawn] : [];
        engine.session.change("agent:drawCards", (doc) => {
          if (!doc.agents?.[name]) return;
          if (!doc.agents[name].inventory) doc.agents[name].inventory = [];
          doc.agents[name].inventory.push(...cards);
        });
        return cards;
      },
      "agent:setMeta": (engine, { name, key, value } = {}) => {
        if (!key) throw new Error("key required");
        findAgent(engine, name);
        engine.session.change("agent:setMeta", (doc) => {
          if (!doc.agents?.[name]) return;
          if (!doc.agents[name].meta) doc.agents[name].meta = {};
          doc.agents[name].meta[key] = value;
        });
      },
      "agent:discardCards": (engine, { name, tokenIds } = {}) => {
        if (!engine.stack) throw new Error("No stack attached to engine");
        const agent = findAgent(engine, name);
        const discarded = [];
        for (const tokenId of tokenIds || []) {
          const idx = (agent.inventory ?? []).findIndex((t) => t.id === tokenId);
          if (idx !== -1) discarded.push(agent.inventory[idx]);
        }
        if (discarded.length > 0) {
          const discardedIds = new Set(discarded.map((t) => t.id));
          engine.session.change("agent:discardCards", (doc) => {
            if (!doc.agents?.[name]?.inventory) return;
            doc.agents[name].inventory = doc.agents[name].inventory.filter((t) => !discardedIds.has(t.id));
          });
          for (const card of discarded) engine.stack.discard(card);
        }
        return discarded;
      }
    };
    GameActions = {
      "game:start": (engine) => {
        engine.session.change("game:start", (doc) => {
          if (!doc.gameState) doc.gameState = {};
          doc.gameState.started = true;
          doc.gameState.startTime = Date.now();
          doc.gameState.ended = false;
          doc.gameState.paused = false;
          doc.gameState.totalPauseDuration = 0;
        });
        engine.emit("game:started", { payload: engine._gameState });
        return engine._gameState;
      },
      "game:end": (engine, { winner, reason } = {}) => {
        engine.session.change("game:end", (doc) => {
          if (!doc.gameState) doc.gameState = {};
          doc.gameState.ended = true;
          doc.gameState.endTime = Date.now();
          if (winner) doc.gameState.winner = winner;
          if (reason) doc.gameState.reason = reason;
        });
        engine.emit("game:ended", { payload: engine._gameState });
        return engine._gameState;
      },
      "game:pause": (engine) => {
        engine.session.change("game:pause", (doc) => {
          if (!doc.gameState) doc.gameState = {};
          doc.gameState.paused = true;
          doc.gameState.pauseTime = Date.now();
        });
        engine.emit("game:paused", { payload: engine._gameState });
        return engine._gameState;
      },
      "game:resume": (engine) => {
        engine.session.change("game:resume", (doc) => {
          if (!doc.gameState) doc.gameState = {};
          if (doc.gameState.pauseTime) {
            doc.gameState.totalPauseDuration = (doc.gameState.totalPauseDuration ?? 0) + (Date.now() - doc.gameState.pauseTime);
          }
          doc.gameState.paused = false;
          doc.gameState.resumeTime = Date.now();
        });
        engine.emit("game:resumed", { payload: engine._gameState });
        return engine._gameState;
      },
      "game:nextPhase": (engine, { phase } = {}) => {
        engine.session.change("game:nextPhase", (doc) => {
          if (!doc.gameState) doc.gameState = {};
          doc.gameState.phase = phase;
          doc.gameState.turn = (doc.gameState.turn ?? 0) + 1;
        });
        engine.emit("game:phaseChanged", { payload: { phase, turn: engine._gameState.turn } });
        return engine._gameState;
      },
      "game:setProperty": (engine, { key, value } = {}) => {
        if (!key) throw new Error("key required");
        engine.session.change("game:setProperty", (doc) => {
          if (!doc.gameState) doc.gameState = {};
          doc.gameState[key] = value;
        });
        return engine._gameState;
      },
      "game:mergeState": (engine, { state: state2 } = {}) => {
        if (!state2 || typeof state2 !== "object") throw new Error("state object required");
        engine.session.change("game:mergeState", (doc) => {
          if (!doc.gameState) doc.gameState = {};
          Object.assign(doc.gameState, state2);
        });
        return engine._gameState;
      },
      "game:getState": (engine) => {
        return engine._gameState;
      }
    };
    GameLoopActions = {
      "game:loopInit": (engine, { maxTurns = 100 } = {}) => {
        engine.session.change("init loop", (doc) => {
          doc.gameLoop = {
            turn: 0,
            running: false,
            activeAgentIndex: -1,
            phase: "setup",
            maxTurns
          };
        });
      },
      "game:loopStart": (engine) => {
        engine.session.change("start loop", (doc) => {
          if (doc.gameLoop) {
            doc.gameLoop.running = true;
            doc.gameLoop.turn = 0;
            doc.gameLoop.phase = "play";
            doc.gameLoop.activeAgentIndex = 0;
          }
        });
      },
      "game:loopStop": (engine, { phase = "stopped" } = {}) => {
        engine.session.change("stop loop", (doc) => {
          if (doc.gameLoop) {
            doc.gameLoop.running = false;
            doc.gameLoop.phase = phase;
          }
        });
      },
      "game:nextTurn": (engine, { agentCount = 0 } = {}) => {
        engine.session.change("next turn", (doc) => {
          if (!doc.gameLoop) return;
          doc.gameLoop.turn++;
          doc.gameLoop.activeAgentIndex = agentCount > 0 ? (doc.gameLoop.activeAgentIndex + 1) % agentCount : 0;
        });
      },
      "game:setPhase": (engine, { phase } = {}) => {
        engine.session.change("set phase", (doc) => {
          if (doc.gameLoop) doc.gameLoop.phase = phase;
        });
      },
      "game:setMaxTurns": (engine, { maxTurns } = {}) => {
        engine.session.change("set maxTurns", (doc) => {
          if (doc.gameLoop) doc.gameLoop.maxTurns = maxTurns;
        });
      },
      "game:setActiveAgent": (engine, { index } = {}) => {
        engine.session.change("set active agent", (doc) => {
          if (doc.gameLoop) doc.gameLoop.activeAgentIndex = index;
        });
      }
    };
    RuleActions = {
      "rule:markFired": (engine, { name, timestamp } = {}) => {
        engine.session.change("mark fired", (doc) => {
          if (doc.rules) doc.rules.fired[name] = timestamp ?? Date.now();
        });
      },
      "rule:initRules": (engine) => {
        engine.session.change("init rules", (doc) => {
          doc.rules = { fired: {} };
        });
      }
    };
    TokenActions = {
      "token:transform": (engine, { token, properties = {} } = {}) => {
        if (!token) throw new Error("token required");
        return { ...token, ...properties, _transformedFrom: token.id };
      },
      "token:attach": (engine, { host, attachment, attachmentType = "default" } = {}) => {
        if (!host || !attachment) throw new Error("host and attachment required");
        const attachments = [...host._attachments || [], { ...attachment, _attachmentType: attachmentType }];
        return { ...host, _attachments: attachments };
      },
      "token:detach": (engine, { host, attachmentId } = {}) => {
        if (!host) throw new Error("host required");
        const attachments = (host._attachments || []).filter((a) => a.id !== attachmentId);
        return { ...host, _attachments: attachments };
      },
      "token:merge": (engine, { tokens, properties, keepOriginals = false } = {}) => {
        if (!tokens || tokens.length < 2) throw new Error("At least 2 tokens required to merge");
        const merged = {
          id: `merged-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          ...Object.assign({}, ...tokens),
          ...properties || {},
          _mergedFrom: tokens.map((t) => t.id)
        };
        return { merged, originals: keepOriginals ? tokens : void 0 };
      },
      "token:split": (engine, { token, count = 2, propertiesArray } = {}) => {
        if (!token) throw new Error("token required");
        const parts = [];
        for (let i = 0; i < count; i++) {
          parts.push({
            ...token,
            id: `split-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
            ...propertiesArray?.[i] || {},
            _splitFrom: token.id
          });
        }
        return parts;
      }
    };
    DebugActions = {
      "debug:log": (engine, payload) => {
        if (engine.debug) console.log("[debug:log]", payload);
        return payload;
      }
    };
    ActionRegistry = {
      ...StackActions,
      ...SpaceActions,
      ...SourceActions,
      ...AgentActions,
      ...GameActions,
      ...GameLoopActions,
      ...RuleActions,
      ...TokenActions,
      ...DebugActions
    };
  }
});

// examples/confluence/ConfluenceGame.ts
function isTokenConsumed(state2, tokenId) {
  const consumed = state2.consumed[tokenId];
  return consumed !== void 0 && Object.keys(consumed).length > 0;
}
function getActiveTokens(state2) {
  return Object.values(state2.tokens).filter((t) => !isTokenConsumed(state2, t.id));
}
function deriveBoard(state2) {
  const { width, height } = state2.config;
  const activeTokens = getActiveTokens(state2);
  const cellMap = {};
  for (const token of activeTokens) {
    const key = `${token.x},${token.y}`;
    if (!cellMap[key]) cellMap[key] = [];
    cellMap[key].push(token);
  }
  const cells = [];
  for (let y = 0; y < height; y++) {
    cells[y] = [];
    for (let x = 0; x < width; x++) {
      const key = `${x},${y}`;
      const tokens = cellMap[key] || [];
      const playerIds = new Set(tokens.map((t) => t.playerId));
      const contested = playerIds.size > 1;
      const controller = contested ? null : tokens[0]?.playerId ?? null;
      cells[y][x] = { x, y, tokens, contested, controller };
    }
  }
  return { width, height, cells };
}
function deriveScores(state2) {
  const board = deriveBoard(state2);
  const playerMap = state2.players;
  const scores = {};
  for (const [peerId, player] of Object.entries(playerMap)) {
    scores[peerId] = {
      playerId: peerId,
      name: player.name,
      color: player.color,
      tokenCount: 0,
      controlledCells: 0,
      contestedCells: 0
    };
  }
  for (const token of getActiveTokens(state2)) {
    if (scores[token.playerId]) {
      scores[token.playerId].tokenCount++;
    }
  }
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const cell = board.cells[y][x];
      if (cell.tokens.length === 0) continue;
      if (cell.contested) {
        for (const token of cell.tokens) {
          if (scores[token.playerId]) {
            scores[token.playerId].contestedCells++;
          }
        }
      } else if (cell.controller && scores[cell.controller]) {
        scores[cell.controller].controlledCells++;
      }
    }
  }
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const cell = board.cells[y][x];
      if (cell.tokens.length > 0) continue;
      const adjacentPlayers = /* @__PURE__ */ new Set();
      const neighbors = getNeighbors(x, y, board.width, board.height);
      for (const [nx, ny] of neighbors) {
        const ncell = board.cells[ny][nx];
        if (ncell.tokens.length > 0 && !ncell.contested) {
          adjacentPlayers.add(ncell.controller);
        }
      }
      if (adjacentPlayers.size === 1) {
        const controller = adjacentPlayers.values().next().value;
        if (controller && scores[controller]) {
          scores[controller].controlledCells++;
        }
      }
    }
  }
  return Object.values(scores);
}
function deriveResult(state2) {
  const scores = deriveScores(state2);
  const board = deriveBoard(state2);
  let contestedCount = 0;
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      if (board.cells[y][x].contested) contestedCount++;
    }
  }
  let winner = null;
  if (state2.phase === "ended") {
    let maxScore = -1;
    for (const score of scores) {
      if (score.controlledCells > maxScore) {
        maxScore = score.controlledCells;
        winner = score.playerId;
      } else if (score.controlledCells === maxScore && maxScore > 0) {
        winner = null;
      }
    }
  }
  return {
    scores,
    winner,
    totalCells: board.width * board.height,
    contestedCells: contestedCount
  };
}
function getNeighbors(x, y, width, height) {
  const neighbors = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        neighbors.push([nx, ny]);
      }
    }
  }
  return neighbors;
}
function isTimeUp(state2) {
  if (state2.phase === "ended") return true;
  return Date.now() - state2.startTime >= state2.config.durationMs;
}
function getTimeRemaining(state2) {
  if (state2.phase === "ended") return 0;
  return Math.max(0, state2.config.durationMs - (Date.now() - state2.startTime));
}
var init_ConfluenceGame = __esm({
  "examples/confluence/ConfluenceGame.ts"() {
    "use strict";
  }
});

// examples/confluence/crdt-actions.js
var crdt_actions_exports = {};
__export(crdt_actions_exports, {
  getBoard: () => getBoard,
  getScores: () => getScores,
  getTimeRemainingSec: () => getTimeRemainingSec,
  isGameOver: () => isGameOver,
  setupConfluenceSync: () => setupConfluenceSync
});
function loadFromChronicle(engine) {
  const confluenceState = engine.session.state?.confluence;
  if (!confluenceState) return;
  if (!engine._confluenceReady) {
    engine._confluenceReady = true;
    engine.emit("confluence:ready", {});
  }
}
function setupConfluenceSync(engine) {
  engine.on("state:updated", (e) => {
    const source = e?.source || e?.payload?.source;
    if (source !== "local" && source !== void 0) {
      loadFromChronicle(engine);
    }
    if (engine.session.state?.confluence) {
      engine.emit("confluence:updated", {
        state: engine.session.state.confluence,
        source
      });
    }
  });
}
function generateOpId(peerId, seq) {
  return `${peerId}-${seq}`;
}
function getBoard(engine) {
  const state2 = engine.session.state?.confluence;
  if (!state2) return null;
  const plainState = JSON.parse(JSON.stringify(state2));
  return deriveBoard(plainState);
}
function getScores(engine) {
  const state2 = engine.session.state?.confluence;
  if (!state2) return [];
  const plainState = JSON.parse(JSON.stringify(state2));
  return deriveScores(plainState);
}
function getTimeRemainingSec(engine) {
  const state2 = engine.session.state?.confluence;
  if (!state2) return 0;
  return Math.ceil(getTimeRemaining(state2) / 1e3);
}
function isGameOver(engine) {
  const state2 = engine.session.state?.confluence;
  if (!state2) return false;
  return state2.phase === "ended" || isTimeUp(state2);
}
var init_crdt_actions = __esm({
  "examples/confluence/crdt-actions.js"() {
    "use strict";
    init_actions();
    init_ConfluenceGame();
    Object.assign(ActionRegistry, {
      /**
       * Initialize a new Confluence game.
       */
      "confluence:init": (engine, { width, height, durationMs } = {}) => {
        const config = { width: width ?? 10, height: height ?? 10, durationMs: durationMs ?? 3e4 };
        engine.session.change("confluence:init", (doc) => {
          doc.confluence = {
            config: { width: config.width, height: config.height, durationMs: config.durationMs },
            players: {},
            tokens: {},
            consumed: {},
            ops: {},
            phase: "playing",
            startTime: Date.now(),
            winner: null
          };
        });
        if (!engine._confluenceSyncSetup) {
          setupConfluenceSync(engine);
          engine._confluenceSyncSetup = true;
        }
        engine.emit("confluence:ready", {});
      },
      /**
       * Register a player.
       */
      "confluence:register": (engine, { peerId, name } = {}) => {
        if (!peerId) throw new Error("peerId required");
        const state2 = engine.session.state?.confluence;
        if (!state2) throw new Error("Game not initialized");
        if (state2.players[peerId]) return;
        const colors = ["#e94560", "#00d4ff", "#4ade80", "#fbbf24"];
        const colorIndex = Object.keys(state2.players).length % colors.length;
        engine.session.change("confluence:register", (doc) => {
          doc.confluence.players[peerId] = {
            peerId,
            name: name || `Player ${Object.keys(doc.confluence.players).length + 1}`,
            color: colors[colorIndex],
            joinedAt: Date.now()
          };
        });
        engine.emit("confluence:playerJoined", { peerId });
      },
      /**
       * Place a token on the board.
       * Uses field-level write: only adds to doc.confluence.tokens[tokenId]
       * and doc.confluence.ops[opId]. Does NOT replace the entire state.
       */
      "confluence:place": (engine, { x, y, peerId } = {}) => {
        if (x === void 0 || y === void 0) throw new Error("x and y required");
        if (!peerId) throw new Error("peerId required");
        const state2 = engine.session.state?.confluence;
        if (!state2) throw new Error("Game not initialized");
        if (state2.phase !== "playing") throw new Error("Game not in progress");
        if (!state2.players[peerId]) throw new Error(`Player ${peerId} not registered`);
        if (x < 0 || x >= state2.config.width) throw new Error(`x out of bounds: ${x}`);
        if (y < 0 || y >= state2.config.height) throw new Error(`y out of bounds: ${y}`);
        const seq = Object.keys(state2.ops).filter((id) => state2.ops[id].actor === peerId).length;
        const opId = generateOpId(peerId, seq);
        const tokenId = `tok-${opId}`;
        engine.session.change(`confluence:place ${peerId} (${x},${y})`, (doc) => {
          doc.confluence.tokens[tokenId] = {
            id: tokenId,
            playerId: peerId,
            strength: 1,
            x,
            y,
            createdByOp: opId,
            _mergedFrom: null,
            _splitFrom: null,
            placedAt: Date.now()
          };
          doc.confluence.ops[opId] = {
            type: "place",
            actor: peerId,
            seq,
            timestamp: Date.now()
          };
        });
        engine.emit("confluence:placed", { tokenId, x, y, peerId });
      },
      /**
       * Merge two adjacent same-player tokens into a stronger one.
       * Marks parents as consumed, creates new token with _mergedFrom.
       */
      "confluence:merge": (engine, { tokenIdA, tokenIdB, peerId } = {}) => {
        if (!tokenIdA || !tokenIdB) throw new Error("tokenIdA and tokenIdB required");
        if (!peerId) throw new Error("peerId required");
        const state2 = engine.session.state?.confluence;
        if (!state2) throw new Error("Game not initialized");
        if (state2.phase !== "playing") throw new Error("Game not in progress");
        const tokenA = state2.tokens[tokenIdA];
        const tokenB = state2.tokens[tokenIdB];
        if (!tokenA || !tokenB) throw new Error("Token(s) not found");
        if (tokenA.playerId !== peerId || tokenB.playerId !== peerId) throw new Error("Not your tokens");
        const consumedA = state2.consumed[tokenIdA];
        const consumedB = state2.consumed[tokenIdB];
        if (consumedA && Object.keys(consumedA).length > 0) throw new Error(`${tokenIdA} already consumed`);
        if (consumedB && Object.keys(consumedB).length > 0) throw new Error(`${tokenIdB} already consumed`);
        if (tokenA.strength >= 3 || tokenB.strength >= 3) throw new Error("Tokens already at max strength");
        const dx = Math.abs(tokenA.x - tokenB.x);
        const dy = Math.abs(tokenA.y - tokenB.y);
        if (dx > 1 || dy > 1 || dx === 0 && dy === 0) throw new Error("Tokens not adjacent");
        const seq = Object.keys(state2.ops).filter((id) => state2.ops[id].actor === peerId).length;
        const opId = generateOpId(peerId, seq);
        const newTokenId = `tok-${opId}`;
        const newStrength = Math.min(3, tokenA.strength + tokenB.strength);
        engine.session.change(`confluence:merge ${peerId}`, (doc) => {
          if (!doc.confluence.consumed[tokenIdA]) doc.confluence.consumed[tokenIdA] = {};
          doc.confluence.consumed[tokenIdA][opId] = true;
          if (!doc.confluence.consumed[tokenIdB]) doc.confluence.consumed[tokenIdB] = {};
          doc.confluence.consumed[tokenIdB][opId] = true;
          doc.confluence.tokens[newTokenId] = {
            id: newTokenId,
            playerId: peerId,
            strength: newStrength,
            x: tokenA.x,
            y: tokenA.y,
            createdByOp: opId,
            _mergedFrom: [tokenIdA, tokenIdB],
            _splitFrom: null,
            placedAt: Date.now()
          };
          doc.confluence.ops[opId] = {
            type: "merge",
            actor: peerId,
            seq,
            timestamp: Date.now()
          };
        });
        engine.emit("confluence:merged", { newTokenId, tokenIdA, tokenIdB, peerId });
      },
      /**
       * Split a strength-2+ token into two strength-1 tokens.
       * Marks parent as consumed, creates two new tokens with _splitFrom.
       */
      "confluence:split": (engine, { tokenId, targetX, targetY, peerId } = {}) => {
        if (!tokenId) throw new Error("tokenId required");
        if (targetX === void 0 || targetY === void 0) throw new Error("targetX and targetY required");
        if (!peerId) throw new Error("peerId required");
        const state2 = engine.session.state?.confluence;
        if (!state2) throw new Error("Game not initialized");
        if (state2.phase !== "playing") throw new Error("Game not in progress");
        const token = state2.tokens[tokenId];
        if (!token) throw new Error("Token not found");
        if (token.playerId !== peerId) throw new Error("Not your token");
        const consumed = state2.consumed[tokenId];
        if (consumed && Object.keys(consumed).length > 0) throw new Error("Token already consumed");
        if (token.strength < 2) throw new Error("Token must be strength 2+ to split");
        const dx = Math.abs(token.x - targetX);
        const dy = Math.abs(token.y - targetY);
        if (dx > 1 || dy > 1) throw new Error("Target not adjacent");
        if (targetX < 0 || targetX >= state2.config.width) throw new Error("targetX out of bounds");
        if (targetY < 0 || targetY >= state2.config.height) throw new Error("targetY out of bounds");
        const seq = Object.keys(state2.ops).filter((id) => state2.ops[id].actor === peerId).length;
        const opId = generateOpId(peerId, seq);
        const newTokenId1 = `tok-${opId}-a`;
        const newTokenId2 = `tok-${opId}-b`;
        engine.session.change(`confluence:split ${peerId}`, (doc) => {
          if (!doc.confluence.consumed[tokenId]) doc.confluence.consumed[tokenId] = {};
          doc.confluence.consumed[tokenId][opId] = true;
          doc.confluence.tokens[newTokenId1] = {
            id: newTokenId1,
            playerId: peerId,
            strength: 1,
            x: token.x,
            y: token.y,
            createdByOp: opId,
            _mergedFrom: null,
            _splitFrom: tokenId,
            placedAt: Date.now()
          };
          doc.confluence.tokens[newTokenId2] = {
            id: newTokenId2,
            playerId: peerId,
            strength: 1,
            x: targetX,
            y: targetY,
            createdByOp: opId,
            _mergedFrom: null,
            _splitFrom: tokenId,
            placedAt: Date.now()
          };
          doc.confluence.ops[opId] = {
            type: "split",
            actor: peerId,
            seq,
            timestamp: Date.now()
          };
        });
        engine.emit("confluence:split", { newTokenId1, newTokenId2, tokenId, peerId });
      },
      /**
       * End the game and compute final scores.
       */
      "confluence:end": (engine, { peerId } = {}) => {
        const state2 = engine.session.state?.confluence;
        if (!state2) throw new Error("Game not initialized");
        if (state2.phase === "ended") throw new Error("Game already ended");
        engine.session.change("confluence:end", (doc) => {
          doc.confluence.phase = "ended";
          const result = deriveResult(doc.confluence);
          doc.confluence.winner = result.winner;
        });
        engine.emit("confluence:ended", { winner: state2.winner });
      }
    });
  }
});

// examples/confluence/web/confluence-web.js
var Engine;
var setupConfluenceSync2;
var getBoard2;
var getScores2;
var getTimeRemainingSec2;
var isGameOver2;
(async () => {
  try {
    const engineModule = await import("../../engine/Engine.js");
    Engine = engineModule.Engine;
    const crdtModule = await Promise.resolve().then(() => (init_crdt_actions(), crdt_actions_exports));
    setupConfluenceSync2 = crdtModule.setupConfluenceSync;
    getBoard2 = crdtModule.getBoard;
    getScores2 = crdtModule.getScores;
    getTimeRemainingSec2 = crdtModule.getTimeRemainingSec;
    isGameOver2 = crdtModule.isGameOver;
    console.log("[Confluence] Modules loaded successfully");
    initApp();
  } catch (error) {
    console.error("[Confluence] Failed to load modules:", error);
    showError("Failed to load game modules. Check console for details.");
  }
})();
var state = {
  // Engine
  engine: null,
  connected: false,
  offlineMode: false,
  // Player
  peerId: null,
  playerName: "",
  serverUrl: "ws://localhost:3000",
  // Game
  gameStarted: false,
  gameEnded: false,
  lastPeerId: 0,
  // Interaction
  selectedTokenId: null,
  interactionMode: null,
  // 'select', 'merge', 'split'
  hoveredTokenId: null,
  // Timer
  timerInterval: null,
  lastTimeUpdate: 0,
  // UI
  showOfflineBanner: true
};
var elements = {
  // Screens
  startScreen: document.getElementById("start-screen"),
  gameScreen: document.getElementById("game-screen"),
  gameOverScreen: document.getElementById("game-over-screen"),
  // Forms
  startForm: document.getElementById("start-form"),
  playerNameInput: document.getElementById("player-name"),
  serverUrlInput: document.getElementById("server-url"),
  // Buttons
  btnJoin: document.getElementById("btn-join"),
  btnRules: document.getElementById("btn-rules"),
  btnRulesInline: document.getElementById("btn-rules-inline"),
  btnScan: document.getElementById("btn-scan"),
  btnEnd: document.getElementById("btn-end"),
  btnOffline: document.getElementById("btn-offline"),
  btnPlayAgain: document.getElementById("btn-play-again"),
  btnNewLobby: document.getElementById("btn-new-lobby"),
  btnCloseRules: document.getElementById("btn-close-rules"),
  // Modals
  rulesOverlay: document.getElementById("rules-overlay"),
  // Game UI
  gameBoard: document.getElementById("game-board"),
  scorePanel: document.getElementById("score-panel"),
  mobileScorePanel: document.getElementById("mobile-score-panel"),
  timer: document.getElementById("timer"),
  timerValue: document.getElementById("timer-value"),
  syncIndicator: document.getElementById("sync-indicator"),
  syncText: document.getElementById("sync-text"),
  peerCount: document.getElementById("peer-count"),
  instructionText: document.getElementById("instruction-text"),
  offlineBanner: document.getElementById("offline-banner"),
  offlineTitle: document.getElementById("offline-title"),
  offlineDesc: document.getElementById("offline-desc"),
  // Game over
  winnerDisplay: document.getElementById("winner-display"),
  gameOverTitle: document.getElementById("game-over-title"),
  gameOverSubtitle: document.getElementById("game-over-subtitle"),
  finalScores: document.getElementById("final-scores"),
  // Provenance
  provenanceTooltip: document.getElementById("provenance-tooltip"),
  provenanceTree: document.getElementById("provenance-tree"),
  // Accessibility
  srAnnouncements: document.getElementById("sr-announcements")
};
function initApp() {
  const savedName = localStorage.getItem("confluence playerName");
  const savedServer = localStorage.getItem("confluence serverUrl");
  if (savedName) elements.playerNameInput.value = savedName;
  if (savedServer) elements.serverUrlInput.value = savedServer;
  bindEvents();
  state.peerId = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log("[Confluence] App initialized, temp peerId:", state.peerId);
}
function bindEvents() {
  elements.startForm.addEventListener("submit", handleStart);
  elements.btnRules.addEventListener("click", () => showRules());
  elements.btnCloseRules.addEventListener("click", () => hideRules());
  elements.rulesOverlay.addEventListener("click", (e) => {
    if (e.target === elements.rulesOverlay) hideRules();
  });
  elements.btnRulesInline.addEventListener("click", () => showRules());
  elements.btnEnd.addEventListener("click", handleEndGame);
  elements.btnOffline.addEventListener("click", toggleOfflineMode);
  elements.btnPlayAgain.addEventListener("click", handlePlayAgain);
  elements.btnNewLobby.addEventListener("click", handleNewLobby);
  elements.gameBoard.addEventListener("click", handleBoardClick);
  elements.gameBoard.addEventListener("mouseover", handleBoardHover);
  elements.gameBoard.addEventListener("mouseout", handleBoardHoverOut);
  document.addEventListener("keydown", handleKeyboard);
  window.addEventListener("beforeunload", handleUnload);
  window.addEventListener("resize", handleResize);
}
async function handleStart(e) {
  e.preventDefault();
  const name = elements.playerNameInput.value.trim() || "Player";
  const serverUrl = elements.serverUrlInput.value.trim() || "ws://localhost:3000";
  localStorage.setItem("confluence playerName", name);
  localStorage.setItem("confluence serverUrl", serverUrl);
  state.playerName = name;
  state.serverUrl = serverUrl;
  elements.btnJoin.disabled = true;
  elements.btnJoin.textContent = "Connecting...";
  try {
    state.engine = new Engine({ disableWasm: true });
    setupConfluenceSync2(state.engine);
    state.engine.on("confluence:updated", handleStateUpdate);
    state.engine.on("confluence:ready", handleGameReady);
    state.engine.on("confluence:ended", handleGameEnded);
    state.engine.on("net:ready", handleConnected);
    state.engine.on("net:disconnected", handleDisconnected);
    state.engine.on("net:peer:connected", handlePeerJoined);
    state.engine.on("net:peer:disconnected", handlePeerLeft);
    await state.engine.dispatch("confluence:init", {
      width: 10,
      height: 10,
      durationMs: 3e4
    });
    state.engine.connect(state.serverUrl);
    state.engine.dispatch("confluence:register", {
      peerId: state.peerId,
      name: state.playerName
    });
    announce("Connected to game. Place your tokens!");
  } catch (error) {
    console.error("[Confluence] Start error:", error);
    showError(`Failed to connect: ${error.message}`);
    elements.btnJoin.disabled = false;
    elements.btnJoin.textContent = "Join Game";
  }
}
function handleGameReady() {
  console.log("[Confluence] Game ready");
  state.gameStarted = true;
  elements.startScreen.classList.add("hidden");
  elements.gameScreen.classList.add("active");
  startTimer();
  render();
}
function handleStateUpdate(event) {
  requestAnimationFrame(render);
}
function handleConnected(event) {
  state.connected = true;
  const networkPeerId = event?.peerId || state.engine?.network?.peerId;
  if (networkPeerId) {
    state.peerId = networkPeerId;
    console.log("[Confluence] Assigned peerId:", state.peerId);
  }
  updateSyncStatus("connected", "Connected");
  updatePeerCount();
  console.log("[Confluence] Connected to relay");
}
function handleDisconnected(event) {
  state.connected = false;
  updateSyncStatus("offline", "Offline");
  if (!state.offlineMode) {
    showOfflineBanner("Disconnected", 'Click "Reconnect" to sync with other players');
    elements.btnOffline.textContent = "Reconnect";
  }
}
function handlePeerJoined(event) {
  const peerId = event?.peerId || event?.payload?.peerId;
  console.log("[Confluence] Peer joined:", peerId);
  updatePeerCount();
  announce("A player joined the game");
}
function handlePeerLeft(event) {
  const peerId = event?.peerId || event?.payload?.peerId;
  console.log("[Confluence] Peer left:", peerId);
  updatePeerCount();
  announce("A player left the game");
}
function updatePeerCount() {
  const confluenceState = state.engine?.session?.state?.confluence;
  const playerCount = confluenceState?.players ? Object.keys(confluenceState.players).length : 1;
  elements.peerCount.textContent = `${playerCount} player${playerCount !== 1 ? "s" : ""}`;
}
function handleGameEnded(event) {
  state.gameEnded = true;
  stopTimer();
  showGameOver();
}
function startTimer() {
  stopTimer();
  const updateTimer = () => {
    const seconds = getTimeRemainingSec2(state.engine);
    elements.timerValue.textContent = seconds;
    elements.timer.classList.remove("warning", "critical");
    if (seconds <= 10 && seconds > 5) {
      elements.timer.classList.add("warning");
    } else if (seconds <= 5) {
      elements.timer.classList.add("critical");
    }
    if (seconds <= 0 && !state.gameEnded) {
      handleGameEnded();
    }
  };
  updateTimer();
  state.timerInterval = setInterval(updateTimer, 100);
}
function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}
function render() {
  if (!state.engine?.session?.state?.confluence) return;
  const board = getBoard2(state.engine);
  const scores = getScores2(state.engine);
  renderBoard(board);
  renderScores(scores);
  renderInstructions();
}
function renderBoard(board) {
  if (!board) return;
  elements.gameBoard.innerHTML = "";
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const cell = board.cells[y][x];
      const cellEl = document.createElement("div");
      cellEl.className = "cell";
      cellEl.dataset.x = x;
      cellEl.dataset.y = y;
      cellEl.setAttribute("role", "gridcell");
      cellEl.setAttribute("aria-label", `Cell ${x}, ${y}${cell.contested ? ", contested" : ""}`);
      cellEl.setAttribute("tabindex", "0");
      if (cell.contested) {
        cellEl.classList.add("contested");
      }
      if (state.interactionMode === "split" && cell.tokens.length === 0) {
        const selectedToken = getTokenById(state.selectedTokenId);
        if (selectedToken && isAdjacent(selectedToken, x, y)) {
          cellEl.classList.add("highlighted");
          cellEl.classList.add("targetable");
        }
      }
      if (cell.tokens.length > 0) {
        const container = document.createElement("div");
        container.className = "token-container";
        for (const token of cell.tokens) {
          const tokenEl = createTokenElement(token);
          container.appendChild(tokenEl);
        }
        cellEl.appendChild(container);
      }
      elements.gameBoard.appendChild(cellEl);
    }
  }
}
function createTokenElement(token) {
  const tokenEl = document.createElement("div");
  tokenEl.className = `token strength-${token.strength}`;
  tokenEl.dataset.tokenId = token.id;
  tokenEl.textContent = token.strength;
  tokenEl.setAttribute("role", "button");
  tokenEl.setAttribute("tabindex", "0");
  tokenEl.setAttribute("aria-label", `Your token, strength ${token.strength}`);
  const playerState = state.engine.session.state.confluence.players[token.playerId];
  const color = playerState?.color || "#888888";
  tokenEl.style.color = color;
  tokenEl.style.setProperty("--player-color", color);
  if (token.playerId === state.peerId) {
    tokenEl.setAttribute("aria-label", `Your token, strength ${token.strength}`);
  } else {
    tokenEl.setAttribute("aria-label", `Opponent token, strength ${token.strength}`);
  }
  if (state.selectedTokenId === token.id) {
    tokenEl.classList.add("selected");
  }
  if (state.interactionMode === "merge" && state.selectedTokenId) {
    const selectedToken = getTokenById(state.selectedTokenId);
    if (selectedToken && selectedToken.playerId === token.playerId && selectedToken.id !== token.id && isAdjacent(selectedToken, token.x, token.y)) {
      tokenEl.classList.add("merge-target");
    }
  }
  tokenEl.addEventListener("click", (e) => {
    e.stopPropagation();
    handleTokenClick(token);
  });
  tokenEl.addEventListener("mouseenter", () => {
    state.hoveredTokenId = token.id;
    showProvenance(token);
  });
  tokenEl.addEventListener("mouseleave", () => {
    state.hoveredTokenId = null;
    hideProvenance();
  });
  return tokenEl;
}
function renderScores(scores) {
  if (!scores) return;
  const createScoreCard = (score, isMobile = false) => {
    const card = document.createElement("div");
    card.className = "player-score";
    card.style.setProperty("--player-color", score.color);
    const isCurrentPlayer = score.playerId === state.peerId;
    if (isCurrentPlayer) {
      card.classList.add("current-player");
    }
    const maxTerritory = 100;
    const territoryPercent = Math.min(100, score.controlledCells / maxTerritory * 100);
    card.innerHTML = `
      <div class="player-score-header">
        <span class="player-name">
          <span class="player-color-dot" style="background: ${score.color}"></span>
          ${escapeHtml(score.name)}${isCurrentPlayer ? " (You)" : ""}
        </span>
      </div>
      <div class="player-stats">
        <div class="stat">
          <div class="stat-value">${score.controlledCells}</div>
          <div class="stat-label">Controlled</div>
        </div>
        <div class="stat">
          <div class="stat-value">${score.contestedCells}</div>
          <div class="stat-label">Contested</div>
        </div>
      </div>
      <div class="territory-bar">
        <div class="territory-fill" style="width: ${territoryPercent}%; background: ${score.color}"></div>
      </div>
    `;
    return card;
  };
  elements.scorePanel.innerHTML = "";
  for (const score of scores) {
    elements.scorePanel.appendChild(createScoreCard(score));
  }
  elements.mobileScorePanel.innerHTML = "";
  for (const score of scores) {
    const mobileCard = createScoreCard(score, true);
    mobileCard.style.flex = "0 0 120px";
    mobileCard.style.padding = "12px";
    elements.mobileScorePanel.appendChild(mobileCard);
  }
}
function renderInstructions() {
  let text = "Click an empty cell to place a token";
  if (state.selectedTokenId) {
    const token = getTokenById(state.selectedTokenId);
    if (token) {
      if (token.strength >= 2) {
        text = "Click adjacent empty cell to SPLIT, or another token to MERGE";
      } else {
        text = "Click adjacent token to MERGE, or ESC to deselect";
      }
    }
  }
  if (state.offlineMode) {
    text += " [OFFLINE MODE - changes will sync on reconnect]";
  }
  elements.instructionText.textContent = text;
}
function handleBoardClick(e) {
  const cell = e.target.closest(".cell");
  if (!cell) return;
  const x = parseInt(cell.dataset.x);
  const y = parseInt(cell.dataset.y);
  if (state.selectedTokenId) {
    const token = getTokenById(state.selectedTokenId);
    if (token && token.strength >= 2) {
      handleSplit(token, x, y);
    }
    clearSelection();
  } else {
    handlePlace(x, y);
  }
}
function handleTokenClick(token) {
  if (token.playerId !== state.peerId) {
    return;
  }
  if (state.selectedTokenId === token.id) {
    clearSelection();
  } else if (state.selectedTokenId) {
    const selectedToken = getTokenById(state.selectedTokenId);
    if (selectedToken && selectedToken.playerId === token.playerId) {
      handleMerge(selectedToken, token);
      clearSelection();
    } else {
      selectToken(token.id);
    }
  } else {
    selectToken(token.id);
  }
}
function handlePlace(x, y) {
  if (!state.engine || state.gameEnded) return;
  try {
    state.engine.dispatch("confluence:place", {
      x,
      y,
      peerId: state.peerId
    });
    announce("Token placed");
  } catch (error) {
    console.warn("[Confluence] Place failed:", error.message);
  }
}
function handleMerge(tokenA, tokenB) {
  if (!state.engine || state.gameEnded) return;
  try {
    state.engine.dispatch("confluence:merge", {
      tokenIdA: tokenA.id,
      tokenIdB: tokenB.id,
      peerId: state.peerId
    });
    announce("Tokens merged");
  } catch (error) {
    console.warn("[Confluence] Merge failed:", error.message);
    showError(`Cannot merge: ${error.message}`);
  }
}
function handleSplit(token, targetX, targetY) {
  if (!state.engine || state.gameEnded) return;
  const board = getBoard2(state.engine);
  if (!board) return;
  const targetCell = board.cells[targetY][targetX];
  if (targetCell.tokens.length > 0) {
    showError("Target cell is not empty");
    return;
  }
  if (!isAdjacent(token, targetX, targetY)) {
    showError("Target must be adjacent");
    return;
  }
  try {
    state.engine.dispatch("confluence:split", {
      tokenId: token.id,
      targetX,
      targetY,
      peerId: state.peerId
    });
    announce("Token split");
  } catch (error) {
    console.warn("[Confluence] Split failed:", error.message);
    showError(`Cannot split: ${error.message}`);
  }
}
function selectToken(tokenId) {
  state.selectedTokenId = tokenId;
  const token = getTokenById(tokenId);
  if (token && token.strength >= 2) {
    state.interactionMode = "split";
    announce("Token selected. Click adjacent empty cell to split.");
  } else {
    state.interactionMode = "merge";
    announce("Token selected. Click adjacent token to merge.");
  }
  render();
}
function clearSelection() {
  state.selectedTokenId = null;
  state.interactionMode = null;
  render();
  renderInstructions();
}
function handleBoardHover(e) {
}
function handleBoardHoverOut(e) {
}
function handleKeyboard(e) {
  if (e.key === "Escape") {
    clearSelection();
    hideProvenance();
  }
}
function showProvenance(token) {
  const confluenceState = state.engine?.session?.state?.confluence;
  if (!confluenceState) return;
  const tree = buildProvenanceTree(confluenceState, token.id);
  if (!tree || !tree.parents && !token._mergedFrom && !token._splitFrom) {
    hideProvenance();
    return;
  }
  elements.provenanceTree.innerHTML = "";
  const currentNode = document.createElement("div");
  currentNode.className = "provenance-node";
  const player = confluenceState.players[token.playerId];
  currentNode.innerHTML = `
    <span class="dot" style="background: ${player?.color || "#888"}"></span>
    <span>Strength ${token.strength}</span>
    <span class="type">Current</span>
    <span class="coords">(${token.x}, ${token.y})</span>
  `;
  elements.provenanceTree.appendChild(currentNode);
  if (tree.parents && tree.parents.length > 0) {
    for (const parent of tree.parents) {
      const parentNode = document.createElement("div");
      parentNode.className = "provenance-node";
      const parentPlayer = confluenceState.players[parent.token.playerId];
      const parentType = parent.token._mergedFrom ? "Merged" : "Split";
      parentNode.innerHTML = `
        <span class="dot" style="background: ${parentPlayer?.color || "#888"}"></span>
        <span>Strength ${parent.token.strength}</span>
        <span class="type">${parentType}</span>
        <span class="coords">(${parent.token.x}, ${parent.token.y})</span>
      `;
      elements.provenanceTree.appendChild(parentNode);
    }
  }
  elements.provenanceTooltip.classList.add("visible");
  elements.provenanceTooltip.setAttribute("aria-hidden", "false");
}
function hideProvenance() {
  elements.provenanceTooltip.classList.remove("visible");
  elements.provenanceTooltip.setAttribute("aria-hidden", "true");
}
function buildProvenanceTree(confluenceState, tokenId, visited = /* @__PURE__ */ new Set()) {
  if (visited.has(tokenId)) return null;
  visited.add(tokenId);
  const token = confluenceState.tokens[tokenId];
  if (!token) return null;
  const parents = [];
  if (token._mergedFrom) {
    for (const parentId of token._mergedFrom) {
      const parent = buildProvenanceTree(confluenceState, parentId, visited);
      if (parent) parents.push(parent);
    }
  }
  if (token._splitFrom) {
    const parent = buildProvenanceTree(confluenceState, token._splitFrom, visited);
    if (parent) parents.push(parent);
  }
  return { token, parents };
}
function toggleOfflineMode() {
  if (!state.engine) return;
  if (state.offlineMode) {
    state.engine.connect(state.serverUrl);
    state.offlineMode = false;
    elements.btnOffline.textContent = "Go Offline";
    elements.btnOffline.setAttribute("aria-pressed", "false");
    elements.offlineBanner.classList.remove("offline-mode");
    elements.offlineTitle.textContent = "Reconnected!";
    elements.offlineDesc.textContent = "CRDT merged your offline changes with the network state";
    setTimeout(() => {
      hideOfflineBanner();
    }, 3e3);
  } else {
    state.engine.disconnect();
    state.offlineMode = true;
    elements.btnOffline.textContent = "Reconnect";
    elements.btnOffline.setAttribute("aria-pressed", "true");
    elements.offlineBanner.classList.add("offline-mode");
    elements.offlineTitle.textContent = "Offline Mode";
    elements.offlineDesc.textContent = "Place tokens locally. They will sync when you reconnect.";
    showOfflineBanner("Offline Mode Active", "Place tokens locally - they will merge on reconnect");
  }
  renderInstructions();
}
function showOfflineBanner(title, desc) {
  if (!state.showOfflineBanner) return;
  elements.offlineTitle.textContent = title;
  elements.offlineDesc.textContent = desc;
  elements.offlineBanner.classList.add("visible");
}
function hideOfflineBanner() {
  elements.offlineBanner.classList.remove("visible");
}
function showGameOver() {
  const confluenceState = state.engine?.session?.state?.confluence;
  if (!confluenceState) return;
  const scores = getScores2(state.engine);
  const winner = confluenceState.winner;
  const winnerPlayer = winner ? confluenceState.players[winner] : null;
  const isTie = !winner && scores.length > 0;
  elements.winnerDisplay.classList.toggle("tie", isTie);
  if (winnerPlayer) {
    elements.gameOverTitle.textContent = "Victory!";
    elements.gameOverSubtitle.textContent = `${winnerPlayer.name} controls the most territory!`;
  } else if (isTie) {
    elements.gameOverTitle.textContent = "Draw!";
    elements.gameOverSubtitle.textContent = "Multiple players tied for first place";
  } else {
    elements.gameOverTitle.textContent = "Game Over";
    elements.gameOverSubtitle.textContent = "Final scores:";
  }
  elements.finalScores.innerHTML = "";
  const sortedScores = [...scores].sort((a, b) => b.controlledCells - a.controlledCells);
  for (const score of sortedScores) {
    const card = document.createElement("div");
    card.className = "final-score-card";
    if (score.playerId === winner) {
      card.classList.add("winner");
    }
    card.innerHTML = `
      <span class="player-color-dot" style="background: ${score.color}"></span>
      <div class="player-name">${escapeHtml(score.name)}${score.playerId === state.peerId ? " (You)" : ""}</div>
      <div class="score-value">${score.controlledCells}</div>
      <div class="score-label">Territory</div>
    `;
    elements.finalScores.appendChild(card);
  }
  elements.gameOverScreen.classList.add("active");
  announce(`Game over! ${winnerPlayer ? winnerPlayer.name + " wins!" : "It's a tie!"}`);
}
function handleEndGame() {
  if (!state.engine || state.gameEnded) return;
  try {
    state.engine.dispatch("confluence:end", {
      peerId: state.peerId
    });
  } catch (error) {
    console.warn("[Confluence] End game failed:", error.message);
  }
}
function handlePlayAgain() {
  state.gameEnded = false;
  state.gameStarted = false;
  state.selectedTokenId = null;
  state.interactionMode = null;
  elements.gameOverScreen.classList.remove("active");
  state.engine.dispatch("confluence:init", {
    width: 10,
    height: 10,
    durationMs: 3e4
  });
  state.engine.dispatch("confluence:register", {
    peerId: state.peerId,
    name: state.playerName
  });
  startTimer();
  announce("New game started!");
}
function handleNewLobby() {
  if (state.engine) {
    state.engine.disconnect();
  }
  state.gameEnded = false;
  state.gameStarted = false;
  state.connected = false;
  state.selectedTokenId = null;
  state.interactionMode = null;
  elements.gameOverScreen.classList.remove("active");
  elements.gameScreen.classList.remove("active");
  elements.startScreen.classList.remove("hidden");
  elements.btnJoin.disabled = false;
  elements.btnJoin.textContent = "Join Game";
  announce("Returned to lobby");
}
function showRules() {
  elements.rulesOverlay.classList.add("active");
  trapFocus(elements.rulesOverlay);
}
function hideRules() {
  elements.rulesOverlay.classList.remove("active");
  releaseFocusTrap(elements.rulesOverlay);
}
function getTokenById(tokenId) {
  const confluenceState = state.engine?.session?.state?.confluence;
  if (!confluenceState) return null;
  const token = confluenceState.tokens[tokenId];
  if (!token) return null;
  const consumed = confluenceState.consumed[tokenId];
  if (consumed && Object.keys(consumed).length > 0) return null;
  return token;
}
function isAdjacent(token, x, y) {
  const dx = Math.abs(token.x - x);
  const dy = Math.abs(token.y - y);
  return dx <= 1 && dy <= 1 && dx + dy > 0;
}
function updateSyncStatus(status, text) {
  elements.syncIndicator.className = `sync-indicator ${status}`;
  elements.syncText.textContent = text;
  if (status === "connected") {
    updatePeerCount();
  }
}
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
function announce(message) {
  elements.srAnnouncements.textContent = message;
  setTimeout(() => {
    elements.srAnnouncements.textContent = "";
  }, 1e3);
}
function showError(message) {
  console.error("[Confluence]", message);
  announce(`Error: ${message}`);
}
function trapFocus(modal) {
  const focusableElements = modal.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  if (focusableElements.length === 0) return;
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  firstElement.focus();
  const handleKeyDown = (e) => {
    if (e.key !== "Tab") return;
    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };
  modal._focusTrapHandler = handleKeyDown;
  modal.addEventListener("keydown", handleKeyDown);
}
function releaseFocusTrap(modal) {
  if (modal._focusTrapHandler) {
    modal.removeEventListener("keydown", modal._focusTrapHandler);
    delete modal._focusTrapHandler;
  }
}
function handleUnload() {
  if (state.engine) {
    state.engine.disconnect();
  }
}
function handleResize() {
}
window.confluence = {
  getState: () => state,
  getEngine: () => state.engine,
  render,
  showRules,
  hideRules
};
console.log("[Confluence] Client module loaded. Use window.confluence for debugging.");
//# sourceMappingURL=confluence.bundle.js.map
