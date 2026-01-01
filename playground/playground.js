/**
 * HyperToken Playground
 *
 * Interactive demo showcasing HyperToken's capabilities:
 * - Play games manually
 * - Train AI agents in real-time
 * - Visualize learning progress
 * - Debug with State Inspector and Action Timeline
 */

// === Game Modules ===
import { BlackjackGame } from './games/blackjack.js';
import { PrisonersDilemmaGame } from './games/prisoners.js';
import { CuttleGame } from './games/cuttle.js';
import { PokerGame } from './games/poker.js';
import { CoupGame } from './games/coup.js';
import { HanabiGame } from './games/hanabi.js';
import { LiarsDiceGame } from './games/liars-dice.js';

// === IDE Components ===
import { initStateInspector } from './components/state-inspector.js';
import { initActionTimeline } from './components/action-timeline.js';
import { initPeerMonitor } from './components/peer-monitor.js';
import { initRuleComposer } from './components/rule-composer.js';
import { initTrainingDashboard } from './components/training-dashboard.js';
import { initTokenCanvas } from './components/token-canvas.js';

// === Rule Engine ===
import { RuleManager } from './rules/RuleManager.js';

// === Network Simulation ===
import { MockNetworkManager } from './network/MockNetworkManager.js';

// === State ===
const state = {
  currentGame: null,
  currentGameId: null,
  dashboardCleanup: null,  // Cleanup function for training dashboard
  canvasCleanup: null      // Cleanup function for token canvas
};

// === Circular Buffer for Action History ===
// O(1) push and automatic eviction of old entries
class CircularBuffer {
  constructor(capacity) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.head = 0;  // Next write position
    this.size = 0;
  }

  push(item) {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    }
  }

  get(index) {
    if (index < 0 || index >= this.size) return undefined;
    const actualIndex = (this.head - this.size + index + this.capacity) % this.capacity;
    return this.buffer[actualIndex];
  }

  toArray() {
    const result = new Array(this.size);
    for (let i = 0; i < this.size; i++) {
      result[i] = this.get(i);
    }
    return result;
  }

  clear() {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.size = 0;
  }

  get length() {
    return this.size;
  }
}

// === Action History ===
const MAX_HISTORY = 1000;
const actionHistory = new CircularBuffer(MAX_HISTORY);
let viewingHistoricalState = null; // When scrubbing timeline, holds the historical state

// Snapshot configuration
const SNAPSHOT_INTERVAL = 10; // Full snapshot every N actions
let actionsSinceSnapshot = 0;
let lastFullSnapshot = null;

/**
 * Efficient clone utility - uses structuredClone when available (faster than JSON)
 */
function efficientClone(obj) {
  try {
    // structuredClone is faster and handles more types than JSON
    if (typeof structuredClone === 'function') {
      return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    // Fallback for circular references or non-serializable data
    return obj;
  }
}

/**
 * Record an action to the history with smart state snapshotting
 * - Full snapshots every SNAPSHOT_INTERVAL actions
 * - Lightweight snapshots (state reference) for intermediate actions
 */
function recordAction(type, payload = {}, meta = {}) {
  const currentState = getGameState();
  actionsSinceSnapshot++;

  // Determine if we need a full snapshot
  const needsFullSnapshot = actionsSinceSnapshot >= SNAPSHOT_INTERVAL || actionHistory.length === 0;

  let stateAfter;
  if (needsFullSnapshot) {
    // Full snapshot - clone the complete state
    stateAfter = efficientClone(currentState);
    lastFullSnapshot = stateAfter;
    actionsSinceSnapshot = 0;
  } else {
    // Lightweight snapshot - only capture changed fields for common game states
    // For simplicity and reliability, we still clone but mark it as incremental
    stateAfter = efficientClone(currentState);
  }

  const action = {
    type,
    payload,
    meta: {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      actor: meta.actor || 'system',
      source: meta.source || 'user',
      isFullSnapshot: needsFullSnapshot,
      ...meta
    },
    stateAfter
  };

  // CircularBuffer automatically evicts old entries (O(1) operation)
  actionHistory.push(action);

  // Notify timeline
  window.dispatchEvent(new CustomEvent('hypertoken:action', { detail: action }));

  return action;
}

/**
 * Clear action history (called on game switch)
 */
function clearActionHistory() {
  actionHistory.clear();
  viewingHistoricalState = null;
  actionsSinceSnapshot = 0;
  lastFullSnapshot = null;
  window.dispatchEvent(new CustomEvent('hypertoken:action', { detail: null }));
}

/**
 * Deep clone utility (kept for backward compatibility)
 */
function deepClone(obj) {
  return efficientClone(obj);
}

// Expose for timeline
window.__HYPERTOKEN_HISTORY__ = () => actionHistory.toArray();

// === DOM Elements ===
const elements = {
  gameSelect: document.getElementById('game-select'),
  gameArea: document.getElementById('game-area'),
  gameControls: document.getElementById('game-controls'),
  console: document.getElementById('console'),
  trainingDashboard: document.getElementById('training-dashboard-container'),
  tokenCanvas: document.getElementById('token-canvas-container')
};

// === Games Registry ===
const games = {
  blackjack: BlackjackGame,
  prisoners: PrisonersDilemmaGame,
  cuttle: CuttleGame,
  poker: PokerGame,
  coup: CoupGame,
  hanabi: HanabiGame,
  'liars-dice': LiarsDiceGame
};

// === State Extraction ===
/**
 * Extract the current game state for the State Inspector
 * Each game has different state properties, so we need to handle them individually
 */
function getGameState() {
  const game = state.currentGame;
  if (!game) return {};

  // Extract state based on game type
  if (game instanceof BlackjackGame) {
    return {
      gameType: 'blackjack',
      gameOver: game.gameOver,
      deck: {
        remaining: game.deck?.length || 0,
        cards: game.deck?.slice(0, 5).map(c => `${c.rank}${c.symbol}`) || []
      },
      playerHand: game.playerHand?.map(c => ({
        display: `${c.rank}${c.symbol}`,
        rank: c.rank,
        suit: c.suit,
        value: c.value
      })) || [],
      playerValue: game.playerHand ? game.getValue(game.playerHand) : 0,
      dealerHand: game.dealerHand?.map(c => ({
        display: `${c.rank}${c.symbol}`,
        rank: c.rank,
        suit: c.suit,
        value: c.value
      })) || [],
      dealerValue: game.dealerHand ? game.getValue(game.dealerHand) : 0
    };
  }

  if (game instanceof PrisonersDilemmaGame) {
    return {
      gameType: 'prisoners_dilemma',
      totalRounds: game.totalRounds,
      currentRound: game.history?.length + 1 || 1,
      scores: { ...game.scores },
      history: game.history?.map((h, i) => ({
        round: i + 1,
        player: h.player,
        opponent: h.opponent
      })) || []
    };
  }

  if (game instanceof CuttleGame) {
    const gameState = game.getState();
    return {
      gameType: 'cuttle',
      currentPlayer: gameState.currentPlayer,
      phase: gameState.phase,
      deckSize: gameState.deckSize,
      scrapSize: gameState.scrapSize,
      player: gameState.player0,
      opponent: gameState.player1,
      winner: gameState.winner,
      isDraw: gameState.isDraw
    };
  }

  if (game instanceof PokerGame) {
    const gameState = game.getState();
    return {
      gameType: 'poker',
      phase: gameState.phase,
      pot: gameState.pot,
      currentBet: gameState.currentBet,
      communityCards: gameState.communityCards,
      player: gameState.players?.[0],
      opponent: gameState.players?.[1],
      winner: gameState.winner,
      winningHand: gameState.winningHand
    };
  }

  if (game instanceof CoupGame) {
    const gameState = game.getState();
    return {
      gameType: 'coup',
      phase: gameState.phase,
      currentPlayer: gameState.currentPlayer,
      players: gameState.players,
      winner: gameState.winner,
      pendingAction: gameState.pendingAction
    };
  }

  if (game instanceof HanabiGame) {
    const gameState = game.getState();
    return {
      gameType: 'hanabi',
      currentPlayer: gameState.currentPlayer,
      infoTokens: gameState.infoTokens,
      lifeTokens: gameState.lifeTokens,
      fireworks: gameState.fireworks,
      score: gameState.score,
      deckSize: gameState.deckSize,
      isComplete: gameState.isComplete
    };
  }

  if (game instanceof LiarsDiceGame) {
    const gameState = game.getState();
    return {
      gameType: 'liars-dice',
      currentPlayer: gameState.currentPlayer,
      currentBid: gameState.currentBid,
      players: gameState.players,
      winner: gameState.winner,
      phase: gameState.phase
    };
  }

  // Fallback: return all enumerable properties
  const gameState = {};
  for (const key of Object.keys(game)) {
    if (!key.startsWith('_') && typeof game[key] !== 'function') {
      gameState[key] = game[key];
    }
  }
  return gameState;
}

/**
 * Get state for inspector - returns historical state if scrubbing, otherwise live state
 */
function getInspectorState() {
  if (viewingHistoricalState !== null) {
    return viewingHistoricalState;
  }
  return getGameState();
}

// Expose getState globally for debugging
window.__HYPERTOKEN_STATE__ = getGameState;

// === Game Method Wrapping ===
/**
 * Wrap game methods to emit actions automatically
 */
function wrapGameMethods(game, gameId) {
  if (gameId === 'blackjack') {
    // Wrap deal
    const originalDeal = game.deal.bind(game);
    game.deal = function() {
      const result = originalDeal();
      recordAction('blackjack:deal', {
        playerCards: game.playerHand?.length || 0,
        dealerCards: game.dealerHand?.length || 0
      }, { actor: 'dealer', source: 'rule' });
      return result;
    };

    // Wrap hit
    const originalHit = game.hit.bind(game);
    game.hit = function() {
      const prevCount = game.playerHand?.length || 0;
      const result = originalHit();
      const newCard = game.playerHand?.[game.playerHand.length - 1];
      recordAction('blackjack:hit', {
        card: newCard ? `${newCard.rank}${newCard.symbol}` : null,
        newValue: game.getValue(game.playerHand)
      }, { actor: 'player', source: 'user' });
      return result;
    };

    // Wrap stand
    const originalStand = game.stand.bind(game);
    game.stand = function() {
      recordAction('blackjack:stand', {
        playerValue: game.getValue(game.playerHand)
      }, { actor: 'player', source: 'user' });
      const result = originalStand();
      // Record dealer play
      recordAction('blackjack:dealerPlay', {
        dealerValue: game.getValue(game.dealerHand),
        dealerCards: game.dealerHand?.length || 0
      }, { actor: 'dealer', source: 'rule' });
      return result;
    };

    // Wrap endGame
    const originalEndGame = game.endGame.bind(game);
    game.endGame = function(result) {
      const ret = originalEndGame(result);
      recordAction('blackjack:endGame', {
        result,
        playerValue: game.getValue(game.playerHand),
        dealerValue: game.getValue(game.dealerHand)
      }, { actor: 'system', source: 'rule' });
      return ret;
    };
  }

  if (gameId === 'prisoners') {
    // Wrap play
    const originalPlay = game.play.bind(game);
    game.play = function(playerChoice) {
      const round = game.history.length + 1;
      const result = originalPlay(playerChoice);
      const lastMove = game.history[game.history.length - 1];
      recordAction('prisoners:choose', {
        round,
        playerChoice,
        opponentChoice: lastMove?.opponent,
        playerScore: game.scores.player,
        opponentScore: game.scores.opponent
      }, { actor: 'player', source: 'user' });
      return result;
    };

    // Wrap reset
    const originalReset = game.reset.bind(game);
    game.reset = function() {
      const result = originalReset();
      recordAction('prisoners:reset', {}, { actor: 'system', source: 'user' });
      return result;
    };
  }

  if (gameId === 'cuttle') {
    // Wrap draw
    const originalDraw = game.draw.bind(game);
    game.draw = function() {
      const result = originalDraw();
      if (result) {
        recordAction('cuttle:draw', {
          player: game.state.currentPlayer === 0 ? 1 : 0 // Previous player drew
        }, { actor: 'player', source: 'user' });
      }
      return result;
    };

    // Wrap pass
    const originalPass = game.pass.bind(game);
    game.pass = function() {
      const result = originalPass();
      if (result) {
        recordAction('cuttle:pass', {}, { actor: 'player', source: 'user' });
      }
      return result;
    };

    // Wrap playPoint
    const originalPlayPoint = game.playPoint.bind(game);
    game.playPoint = function(cardId) {
      const result = originalPlayPoint(cardId);
      if (result) {
        recordAction('cuttle:point', {
          cardId,
          player: game.state.currentPlayer === 0 ? 1 : 0
        }, { actor: 'player', source: 'user' });
      }
      return result;
    };

    // Wrap playScuttle
    const originalPlayScuttle = game.playScuttle.bind(game);
    game.playScuttle = function(attackerId, targetId) {
      const result = originalPlayScuttle(attackerId, targetId);
      if (result) {
        recordAction('cuttle:scuttle', {
          attackerId,
          targetId
        }, { actor: 'player', source: 'user' });
      }
      return result;
    };

    // Wrap playPermanent
    const originalPlayPermanent = game.playPermanent.bind(game);
    game.playPermanent = function(cardId, targetId, destPlayer) {
      const result = originalPlayPermanent(cardId, targetId, destPlayer);
      if (result) {
        recordAction('cuttle:permanent', {
          cardId,
          targetId
        }, { actor: 'player', source: 'user' });
      }
      return result;
    };

    // Wrap playOneOff
    const originalPlayOneOff = game.playOneOff.bind(game);
    game.playOneOff = function(cardId, targetType, targetId) {
      const result = originalPlayOneOff(cardId, targetType, targetId);
      if (result) {
        recordAction('cuttle:oneoff', {
          cardId,
          targetType,
          targetId
        }, { actor: 'player', source: 'user' });
      }
      return result;
    };

    // Wrap resetGame
    const originalResetGame = game.resetGame.bind(game);
    game.resetGame = function(seed) {
      const result = originalResetGame(seed);
      recordAction('cuttle:reset', {}, { actor: 'system', source: 'user' });
      return result;
    };
  }

  return game;
}

// === Console Logging ===
function log(message, type = '') {
  const line = document.createElement('div');
  line.className = `console-line ${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  elements.console.appendChild(line);
  elements.console.scrollTop = elements.console.scrollHeight;

  // Keep last 100 lines
  while (elements.console.children.length > 100) {
    elements.console.removeChild(elements.console.firstChild);
  }
}

// === Training Dashboard Setup ===
function initTrainingDashboardForGame(game, gameId) {
  // Cleanup previous dashboard
  if (state.dashboardCleanup) {
    state.dashboardCleanup();
    state.dashboardCleanup = null;
  }

  // Initialize new dashboard
  if (elements.trainingDashboard) {
    state.dashboardCleanup = initTrainingDashboard(elements.trainingDashboard, {
      game,
      gameType: gameId,
      actionLabels: game.getActionLabels?.(),
      onLog: log
    });
  }
}

// === Token Canvas Setup ===
function initTokenCanvasForGame(game, gameId) {
  // Cleanup previous canvas
  if (state.canvasCleanup) {
    state.canvasCleanup();
    state.canvasCleanup = null;
  }

  // Initialize new canvas
  if (elements.tokenCanvas) {
    state.canvasCleanup = initTokenCanvas(elements.tokenCanvas, {
      getSpaceState: getGameState,
      gameType: gameId,
      onLog: log
    });
  }
}

// === Game Management ===
function loadGame(gameId) {
  // Cleanup previous game
  if (state.currentGame) {
    state.currentGame.cleanup?.();
  }

  // Cleanup previous training dashboard
  if (state.dashboardCleanup) {
    state.dashboardCleanup();
    state.dashboardCleanup = null;
  }

  // Cleanup previous token canvas
  if (state.canvasCleanup) {
    state.canvasCleanup();
    state.canvasCleanup = null;
  }

  // Clear action history for new game
  clearActionHistory();

  // Clear historical view
  viewingHistoricalState = null;

  // Create new game
  const GameClass = games[gameId];
  if (!GameClass) {
    log(`Unknown game: ${gameId}`, 'error');
    return;
  }

  state.currentGame = new GameClass({
    gameArea: elements.gameArea,
    controlsArea: elements.gameControls,
    log
  });

  // Wrap game methods to emit actions
  wrapGameMethods(state.currentGame, gameId);
  state.currentGameId = gameId;

  state.currentGame.init();

  // Initialize training dashboard for this game
  initTrainingDashboardForGame(state.currentGame, gameId);

  // Initialize token canvas for this game
  initTokenCanvasForGame(state.currentGame, gameId);

  // Record game load action
  recordAction('game:load', { gameId }, { actor: 'system', source: 'user' });

  log(`Loaded ${gameId}`, 'info');
}


// === Timeline Scrubbing Handler ===
function handleTimelineScrub(historicalState, index) {
  if (historicalState === null) {
    // Return to live
    viewingHistoricalState = null;
  } else {
    // Viewing historical state
    viewingHistoricalState = historicalState;
  }
  // State Inspector will pick this up on next poll via getInspectorState()
}

// === Event Handlers ===
elements.gameSelect.addEventListener('change', (e) => {
  loadGame(e.target.value);
});

// === Initialize ===
loadGame('blackjack');

// Initialize State Inspector
const inspectorContainer = document.getElementById('state-inspector-container');
if (inspectorContainer) {
  initStateInspector(inspectorContainer, getInspectorState);
}

// Initialize Action Timeline
const timelineContainer = document.getElementById('action-timeline-container');
if (timelineContainer) {
  initActionTimeline(timelineContainer, {
    getHistory: () => actionHistory.toArray(),
    onScrub: handleTimelineScrub,
    onClearHistory: clearActionHistory
  });
}

// === Network Manager ===
const networkManager = new MockNetworkManager();

// Expose globally for debugging
window.__HYPERTOKEN_NETWORK__ = networkManager;

// Initialize Peer Monitor
const peerMonitorContainer = document.getElementById('peer-monitor-container');
if (peerMonitorContainer) {
  initPeerMonitor(peerMonitorContainer, networkManager);
}

// Start network simulation
networkManager.connect();
networkManager.startDemoSimulation();

// === Rule Manager ===
const ruleManager = new RuleManager();

// Expose globally for debugging
window.__HYPERTOKEN_RULES__ = ruleManager;

// Initialize Rule Composer
const ruleComposerContainer = document.getElementById('rule-composer-container');
if (ruleComposerContainer) {
  initRuleComposer(ruleComposerContainer, ruleManager);
}

log('HyperToken Playground initialized', 'success');
log('Select a game and use the Training Dashboard to begin AI training!');
