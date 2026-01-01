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

/**
 * Test Suite for Prisoner's Dilemma Implementation
 * 
 * Tests game mechanics, strategies, tournament logic, and edge cases
 */

// Mock Engine for standalone testing
class MockEngine {
  constructor() {
    this._agents = [];
    this._gameState = {};
    this.history = [];
    this.listeners = new Map();
  }
  
  dispatch(type, payload = {}) {
    const action = { type, payload };
    
    // Handle actions
    if (type === 'game:start') {
      this._gameState.started = true;
    } else if (type === 'agent:create') {
      const agent = {
        id: `p-${Date.now()}-${Math.random()}`,
        name: payload.name,
        agent: payload.agent,
        resources: {}
      };
      this._agents.push(agent);
      return agent;
    } else if (type === 'agent:giveResource') {
      const agent = this._agents.find(p => p.name === payload.name);
      if (agent) {
        agent.resources[payload.resource] = 
          (agent.resources[payload.resource] || 0) + payload.amount;
      }
    } else if (type === 'game:end') {
      this._gameState.ended = true;
      this._gameState.winner = payload.winner;
      this.emit('game:end', { payload });
    }
    
    this.history.push(action);
    this.emit('engine:action', { payload: action });
    return action;
  }

  registerAgent(agent) {
    this._agents.push(agent);
    return agent;
  }

  getAgents() {
    return this._agents;
  }

  setGameState(key, value) {
    this._gameState[key] = value;
  }

  getGameState(key) {
    return this._gameState[key];
  }

  getAllGameState() {
    return { ...this._gameState };
  }

  resetGameState() {
    this._gameState = {};
    this.history = [];
  }

  recordAction(action) {
    this.history.push(action);
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const handler of this.listeners.get(event)) {
        handler(data);
      }
    }
  }

  async nextTurn() {
    // Mock implementation
  }
}

import { createGame, COOPERATE, DEFECT, PAYOFFS } from './prisoners-dilemma.js';
import { Tournament } from './tournament.js';
import * as strategies from './strategies.js';

// Test utilities
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║          PRISONER\'S DILEMMA TEST SUITE                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    for (const { name, fn } of this.tests) {
      try {
        await fn();
        this.passed++;
        console.log(`✓ ${name}`);
      } catch (error) {
        this.failed++;
        console.log(`✗ ${name}`);
        console.log(`  Error: ${error.message}`);
        if (error.stack) {
          console.log(`  ${error.stack.split('\n').slice(1, 3).join('\n  ')}`);
        }
      }
    }

    console.log('\n' + '─'.repeat(60));
    console.log(`Tests: ${this.passed + this.failed}`);
    console.log(`Passed: ${this.passed} ✓`);
    console.log(`Failed: ${this.failed} ${this.failed > 0 ? '✗' : ''}`);
    console.log('─'.repeat(60) + '\n');

    return this.failed === 0;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected} but got ${actual}`);
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

const runner = new TestRunner();

// ----------------------------------------------------------------------------
// GAME MECHANICS TESTS
// ----------------------------------------------------------------------------

runner.test('Game initializes with correct payoffs', () => {
  const engine = new MockEngine();
  const game = createGame(engine);
  
  assert(game, 'Game should be created');
  assertEqual(PAYOFFS.CC.p1, 3, 'CC payoff should be 3');
  assertEqual(PAYOFFS.CD.p1, 0, 'CD payoff should be 0');
  assertEqual(PAYOFFS.DC.p1, 5, 'DC payoff should be 5');
  assertEqual(PAYOFFS.DD.p1, 1, 'DD payoff should be 1');
});

runner.test('Game accepts custom payoffs', async () => {
  const engine = new MockEngine();
  const customPayoffs = {
    CC: { p1: 4, p2: 4 },
    CD: { p1: 0, p2: 6 },
    DC: { p1: 6, p2: 0 },
    DD: { p1: 2, p2: 2 }
  };
  
  const game = createGame(engine, { rounds: 1, payoffs: customPayoffs });
  game.initialize(
    { name: 'P1', strategy: strategies.alwaysCooperate },
    { name: 'P2', strategy: strategies.alwaysCooperate }
  );
  
  await game.playGame();
  const results = game.getResults();
  
  assertEqual(results.scores.P1, 4, 'Custom CC payoff should be 4');
});

runner.test('Game plays specified number of rounds', async () => {
  const engine = new MockEngine();
  const game = createGame(engine, { rounds: 10 });
  
  game.initialize(
    { name: 'P1', strategy: strategies.alwaysCooperate },
    { name: 'P2', strategy: strategies.alwaysDefect }
  );
  
  await game.playGame();
  const results = game.getResults();
  
  assertEqual(results.history.length, 10, 'Should play exactly 10 rounds');
});

runner.test('Game correctly scores mutual cooperation', async () => {
  const engine = new MockEngine();
  const game = createGame(engine, { rounds: 5 });
  
  game.initialize(
    { name: 'P1', strategy: strategies.alwaysCooperate },
    { name: 'P2', strategy: strategies.alwaysCooperate }
  );
  
  await game.playGame();
  const results = game.getResults();
  
  assertEqual(results.scores.P1, 15, 'P1 should score 3*5 = 15');
  assertEqual(results.scores.P2, 15, 'P2 should score 3*5 = 15');
});

runner.test('Game correctly scores mutual defection', async () => {
  const engine = new MockEngine();
  const game = createGame(engine, { rounds: 5 });
  
  game.initialize(
    { name: 'P1', strategy: strategies.alwaysDefect },
    { name: 'P2', strategy: strategies.alwaysDefect }
  );
  
  await game.playGame();
  const results = game.getResults();
  
  assertEqual(results.scores.P1, 5, 'P1 should score 1*5 = 5');
  assertEqual(results.scores.P2, 5, 'P2 should score 1*5 = 5');
});

runner.test('Game correctly scores exploitation', async () => {
  const engine = new MockEngine();
  const game = createGame(engine, { rounds: 5 });
  
  game.initialize(
    { name: 'P1', strategy: strategies.alwaysDefect },
    { name: 'P2', strategy: strategies.alwaysCooperate }
  );
  
  await game.playGame();
  const results = game.getResults();
  
  assertEqual(results.scores.P1, 25, 'P1 should score 5*5 = 25');
  assertEqual(results.scores.P2, 0, 'P2 should score 0*5 = 0');
});

// ----------------------------------------------------------------------------
// STRATEGY BEHAVIOR TESTS
// ----------------------------------------------------------------------------

runner.test('Always Cooperate always returns cooperate', () => {
  for (let i = 0; i < 10; i++) {
    const move = strategies.alwaysCooperate([], []);
    assertEqual(move, COOPERATE, 'Should always cooperate');
  }
});

runner.test('Always Defect always returns defect', () => {
  for (let i = 0; i < 10; i++) {
    const move = strategies.alwaysDefect([], []);
    assertEqual(move, DEFECT, 'Should always defect');
  }
});

runner.test('Tit for Tat cooperates first', () => {
  const move = strategies.titForTat([], []);
  assertEqual(move, COOPERATE, 'Should cooperate on first move');
});

runner.test('Tit for Tat copies opponent', () => {
  let move = strategies.titForTat([COOPERATE], [COOPERATE]);
  assertEqual(move, COOPERATE, 'Should copy cooperate');
  
  move = strategies.titForTat([COOPERATE, DEFECT], [COOPERATE, DEFECT]);
  assertEqual(move, DEFECT, 'Should copy defect');
});

runner.test('Grudger never forgives after defection', () => {
  const history = [COOPERATE, COOPERATE, COOPERATE, DEFECT, COOPERATE];
  
  for (let i = 0; i < 10; i++) {
    const move = strategies.grudger([], history);
    assertEqual(move, DEFECT, 'Should defect forever after opponent defects');
  }
});

runner.test('Tit for Two Tats requires two defections', () => {
  let move = strategies.titForTwoTats([COOPERATE], [DEFECT]);
  assertEqual(move, COOPERATE, 'Should cooperate after one defection');
  
  move = strategies.titForTwoTats([COOPERATE, COOPERATE], [DEFECT, DEFECT]);
  assertEqual(move, DEFECT, 'Should defect after two defections');
  
  move = strategies.titForTwoTats([COOPERATE, COOPERATE, DEFECT], [DEFECT, COOPERATE, COOPERATE]);
  assertEqual(move, COOPERATE, 'Should cooperate if opponent didn\'t defect twice in a row');
});

runner.test('Suspicious Tit for Tat defects first', () => {
  const move = strategies.suspiciousTitForTat([], []);
  assertEqual(move, DEFECT, 'Should defect on first move');
  
  const move2 = strategies.suspiciousTitForTat([DEFECT], [COOPERATE]);
  assertEqual(move2, COOPERATE, 'Should then copy opponent');
});

runner.test('Pavlov switches on bad outcomes', () => {
  // Good outcome (CC = 3) - should repeat
  let move = strategies.pavlov([COOPERATE], [COOPERATE]);
  assertEqual(move, COOPERATE, 'Should repeat cooperate after CC');
  
  // Bad outcome (CD = 0) - should switch
  move = strategies.pavlov([COOPERATE], [DEFECT]);
  assertEqual(move, DEFECT, 'Should switch to defect after CD');
  
  // Good outcome (DC = 5) - should repeat
  move = strategies.pavlov([DEFECT], [COOPERATE]);
  assertEqual(move, DEFECT, 'Should repeat defect after DC');
  
  // Bad outcome (DD = 1) - should switch
  move = strategies.pavlov([DEFECT], [DEFECT]);
  assertEqual(move, COOPERATE, 'Should switch to cooperate after DD');
});

runner.test('Prober executes initial probe sequence', () => {
  const move1 = strategies.prober([], []);
  assertEqual(move1, DEFECT, 'First move should be defect');
  
  const move2 = strategies.prober([DEFECT], [COOPERATE]);
  assertEqual(move2, COOPERATE, 'Second move should be cooperate');
  
  const move3 = strategies.prober([DEFECT, COOPERATE], [COOPERATE, COOPERATE]);
  assertEqual(move3, COOPERATE, 'Third move should be cooperate');
});

runner.test('Prober exploits weak opponents', () => {
  // Opponent cooperated on rounds 2 and 3
  const oppHistory = [DEFECT, COOPERATE, COOPERATE, COOPERATE];
  const ownHistory = [DEFECT, COOPERATE, COOPERATE];
  
  const move = strategies.prober(ownHistory, oppHistory);
  assertEqual(move, DEFECT, 'Should exploit weak opponent');
});

runner.test('Adaptive matches cooperation rate', async () => {
  // Need at least 5 moves before it starts adapting
  const oppHistory = [COOPERATE, COOPERATE, COOPERATE, COOPERATE, COOPERATE];
  const ownHistory = [COOPERATE, COOPERATE, COOPERATE, COOPERATE, COOPERATE];
  
  let cooperations = 0;
  const samples = 100;
  
  for (let i = 0; i < samples; i++) {
    const move = strategies.adaptive(ownHistory, oppHistory);
    if (move === COOPERATE) cooperations++;
  }
  
  const rate = cooperations / samples;
  assert(rate > 0.8, `Should cooperate ~100% when opponent always cooperates (got ${rate})`);
});

runner.test('Soft Majority uses ≥ threshold', () => {
  // Exactly 50% cooperation
  let move = strategies.softMajority([], [COOPERATE, DEFECT]);
  assertEqual(move, COOPERATE, 'Should cooperate at 50%');
  
  // More cooperation
  move = strategies.softMajority([], [COOPERATE, COOPERATE, DEFECT]);
  assertEqual(move, COOPERATE, 'Should cooperate above 50%');
  
  // Less cooperation
  move = strategies.softMajority([], [COOPERATE, DEFECT, DEFECT]);
  assertEqual(move, DEFECT, 'Should defect below 50%');
});

runner.test('Hard Majority uses > threshold', () => {
  // Exactly 50% cooperation
  let move = strategies.hardMajority([], [COOPERATE, DEFECT]);
  assertEqual(move, DEFECT, 'Should defect at 50%');
  
  // More cooperation
  move = strategies.hardMajority([], [COOPERATE, COOPERATE, DEFECT]);
  assertEqual(move, COOPERATE, 'Should cooperate above 50%');
});

// ----------------------------------------------------------------------------
// TOURNAMENT LOGIC TESTS
// ----------------------------------------------------------------------------

runner.test('Tournament runs all matchups', async () => {
  const engine = new MockEngine();
  const tournament = new Tournament(engine, { rounds: 10, verbose: false });
  
  tournament.addStrategy('TFT', strategies.titForTat);
  tournament.addStrategy('AC', strategies.alwaysCooperate);
  tournament.addStrategy('AD', strategies.alwaysDefect);
  
  await tournament.run();
  const results = tournament.getResults();
  
  // 3 strategies = 3 matchups (round-robin)
  assertEqual(results.standings.length, 3, 'Should have results for 3 strategies');
  assertEqual(results.totalGames, 3, 'Should have 3 total games');
});

runner.test('Tournament calculates statistics correctly', async () => {
  const engine = new MockEngine();
  const tournament = new Tournament(engine, { rounds: 10, verbose: false });
  
  tournament.addStrategy('AC', strategies.alwaysCooperate);
  tournament.addStrategy('AD', strategies.alwaysDefect);
  
  await tournament.run();
  const results = tournament.getResults();
  
  const acResults = results.standings.find(s => s.name === 'AC');
  assert(acResults.totalScore !== undefined, 'Should have total score');
  assert(acResults.avgScore !== undefined, 'Should have average score');
  assert(acResults.wins !== undefined, 'Should have win count');
  assert(acResults.cooperationRate !== undefined, 'Should have cooperation rate');
});

runner.test('Tournament cooperation rate calculation', async () => {
  const engine = new MockEngine();
  const tournament = new Tournament(engine, { rounds: 100, verbose: false });
  
  tournament.addStrategy('AC', strategies.alwaysCooperate);
  tournament.addStrategy('AD', strategies.alwaysDefect);
  
  await tournament.run();
  const results = tournament.getResults();
  
  const acResults = results.standings.find(s => s.name === 'AC');
  const adResults = results.standings.find(s => s.name === 'AD');
  
  assertEqual(parseFloat(acResults.cooperationRate), 100, 'Always Cooperate should have 100% cooperation');
  assertEqual(parseFloat(adResults.cooperationRate), 0, 'Always Defect should have 0% cooperation');
});

// ----------------------------------------------------------------------------
// EDGE CASES
// ----------------------------------------------------------------------------

runner.test('Game handles single round', async () => {
  const engine = new MockEngine();
  const game = createGame(engine, { rounds: 1 });
  
  game.initialize(
    { name: 'P1', strategy: strategies.titForTat },
    { name: 'P2', strategy: strategies.alwaysDefect }
  );
  
  await game.playGame();
  const results = game.getResults();
  
  assertEqual(results.history.length, 1, 'Should have 1 round');
});

runner.test('Strategies handle empty history', () => {
  const strategyList = [
    strategies.titForTat,
    strategies.titForTwoTats,
    strategies.generousTitForTat,
    strategies.grudger,
    strategies.pavlov,
    strategies.suspiciousTitForTat,
    strategies.adaptive,
    strategies.gradual,
    strategies.prober,
    strategies.softMajority,
    strategies.hardMajority
  ];
  
  for (const strategy of strategyList) {
    const move = strategy([], []);
    assert(move === COOPERATE || move === DEFECT, 
      `Strategy ${strategy.name} should return valid move on empty history`);
  }
});

runner.test('Random strategy produces varied results', () => {
  const results = new Set();
  for (let i = 0; i < 100; i++) {
    results.add(strategies.random());
  }
  
  assert(results.size === 2, 'Random should produce both C and D');
});

runner.test('All 14 strategies are registered', () => {
  const strategyList = strategies.listStrategies();
  assertEqual(strategyList.length, 14, 'Should have exactly 14 strategies');
  
  const expectedStrategies = [
    'alwaysCooperate', 'alwaysDefect', 'random',
    'titForTat', 'titForTwoTats', 'generousTitForTat',
    'grudger', 'pavlov', 'suspiciousTitForTat',
    'adaptive', 'gradual', 'prober',
    'softMajority', 'hardMajority'
  ];
  
  const registeredKeys = Object.keys(strategies.STRATEGIES);
  for (const key of expectedStrategies) {
    assert(registeredKeys.includes(key), `Strategy ${key} should be registered`);
  }
});

runner.test('getStrategy returns correct function', () => {
  const tft = strategies.getStrategy('titForTat');
  assert(tft === strategies.titForTat, 'Should return correct strategy function');
  
  const invalid = strategies.getStrategy('nonexistent');
  assertEqual(invalid, undefined, 'Should return undefined for invalid strategy');
});

// ----------------------------------------------------------------------------
// INTEGRATION TESTS
// ----------------------------------------------------------------------------

runner.test('Full tournament with all strategies', async () => {
  const engine = new MockEngine();
  const tournament = new Tournament(engine, { rounds: 50, verbose: false });
  
  // Add all strategies
  const strategyList = strategies.listStrategies();
  for (const { key, name } of strategyList) {
    tournament.addStrategy(name, strategies.STRATEGIES[key].fn);
  }
  
  await tournament.run();
  const results = tournament.getResults();
  
  assertEqual(results.standings.length, 14, 'Should have results for all 14 strategies');
  
  // Check that all strategies have valid scores
  for (const standing of results.standings) {
    assert(standing.totalScore >= 0, `${standing.name} should have non-negative score`);
    const coopRate = parseFloat(standing.cooperationRate);
    assert(coopRate >= 0 && coopRate <= 100, 
      `${standing.name} should have valid cooperation rate`);
  }
});

runner.test('Tournament produces deterministic results (except Random)', async () => {
  const engine1 = new MockEngine();
  const tournament1 = new Tournament(engine1, { rounds: 20, verbose: false });
  
  tournament1.addStrategy('TFT', strategies.titForTat);
  tournament1.addStrategy('AC', strategies.alwaysCooperate);
  tournament1.addStrategy('Grudger', strategies.grudger);
  
  await tournament1.run();
  const results1 = tournament1.getResults();
  
  const engine2 = new MockEngine();
  const tournament2 = new Tournament(engine2, { rounds: 20, verbose: false });
  
  tournament2.addStrategy('TFT', strategies.titForTat);
  tournament2.addStrategy('AC', strategies.alwaysCooperate);
  tournament2.addStrategy('Grudger', strategies.grudger);
  
  await tournament2.run();
  const results2 = tournament2.getResults();
  
  const tft1 = results1.standings.find(s => s.name === 'TFT');
  const tft2 = results2.standings.find(s => s.name === 'TFT');
  
  assertEqual(tft1.totalScore, tft2.totalScore, 
    'Deterministic strategies should produce same results');
});

// ============================================================================
// RUN TESTS
// ============================================================================

async function main() {
  const success = await runner.run();
  process.exit(success ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});