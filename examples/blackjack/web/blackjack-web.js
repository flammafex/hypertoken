/**
 * Blackjack Web UI
 *
 * A browser-based blackjack game with single-player and multiplayer modes.
 */

import { BlackjackGame } from './BlackjackGame.bundle.min.js';
import { MultiplayerBlackjackGame } from './multiplayer-blackjack-game.js';
import { BasicStrategyAgent, AI_PERSONALITIES, createAIAgent, getPersonality } from './ai-agents-browser.js';

// ============================================================================
// State Management
// ============================================================================

class GameState {
  game = null;
  variant = 'american';
  initialBankroll = 1000;
  currentBet = 10;
  minBet = 5;
  maxBet = 500;
  numDecks = 6;
  phase = 'start'; // start | betting | burning | playing | insurance | result
  isSplit = false;
  seed = null; // Optional seed for deterministic play
  // Betting strategy
  bettingStrategy = 'manual'; // manual | flat | martingale | progressive | percentage
  lastResult = null; // Track last result for strategy calculations
  strategyBaseBet = 10;
  // Side bets
  perfectPairsEnabled = false;
  perfectPairsBet = 5;
  twentyOnePlus3Enabled = false;
  twentyOnePlus3Bet = 5;
  luckyLadiesEnabled = false;
  luckyLadiesBet = 5;
  busterBlackjackEnabled = false;
  busterBlackjackBet = 5;
  royalMatchEnabled = false;
  royalMatchBet = 5;
  superSevensEnabled = false;
  superSevensBet = 5;
  // House rules
  dealerHitsSoft17 = false;
  allowEarlySurrender = false;
  allowLateSurrender = false;
  resplitAces = true;
  // Tools
  showCardCount = false;
  countingSystem = 'hilo'; // hilo | ko | redseven | wonghalves
  // Animation state
  animateDealing = false;
  animateDealerFlip = false;
  lastHitCardId = null;
}

// Multiplayer state
class MultiplayerGameState {
  game = null;                    // MultiplayerBlackjackGame instance
  mode = 'multiplayer';
  numPlayers = 4;
  humanPlayerIndex = null;        // Randomly assigned
  aiAgents = [];                  // AI agent instances
  phase = 'betting';              // betting | dealing | player-turns | dealer | results
  aiTurnDelay = 800;              // ms between AI decisions
  isAnimating = false;            // Prevent actions during animations
}

// Game mode: 'single' or 'multiplayer'
let gameMode = 'single';
const mpState = new MultiplayerGameState();

// ============================================================================
// Betting Strategies
// ============================================================================

const BettingStrategies = {
  manual: {
    name: 'Manual',
    description: 'Set your own bet each hand',
    getNextBet: (state, stats) => state.currentBet
  },

  flat: {
    name: 'Flat Betting',
    description: 'Always bet the same amount ($10)',
    getNextBet: (state, stats) => {
      const bet = 10;
      return Math.min(bet, state.game.bankroll, state.maxBet);
    }
  },

  martingale: {
    name: 'Martingale',
    description: 'Double bet after each loss, reset after win',
    baseBet: 10,
    currentBet: 10,
    getNextBet: function(state, stats) {
      if (state.lastResult === null) {
        this.currentBet = this.baseBet;
      } else if (state.lastResult === 'dealer') {
        // Lost - double the bet
        this.currentBet = Math.min(this.currentBet * 2, state.maxBet, state.game.bankroll);
      } else if (state.lastResult === 'agent' || state.lastResult === 'agent-blackjack') {
        // Won - reset to base
        this.currentBet = this.baseBet;
      }
      // Push - keep same bet
      return Math.min(this.currentBet, state.game.bankroll);
    }
  },

  progressive: {
    name: 'Progressive',
    description: 'Increase bet by $5 after wins, reset after loss',
    baseBet: 10,
    currentBet: 10,
    getNextBet: function(state, stats) {
      if (state.lastResult === null) {
        this.currentBet = this.baseBet;
      } else if (state.lastResult === 'agent' || state.lastResult === 'agent-blackjack') {
        // Won - increase bet
        this.currentBet = Math.min(this.currentBet + 5, 50, state.maxBet, state.game.bankroll);
      } else if (state.lastResult === 'dealer') {
        // Lost - reset to base
        this.currentBet = this.baseBet;
      }
      // Push - keep same bet
      return Math.min(this.currentBet, state.game.bankroll);
    }
  },

  percentage: {
    name: '2% Bankroll',
    description: 'Bet 2% of current bankroll each hand',
    getNextBet: (state, stats) => {
      const bet = Math.floor(state.game.bankroll * 0.02);
      return Math.max(state.minBet, Math.min(bet, state.maxBet, state.game.bankroll));
    }
  },

  dalembert: {
    name: "D'Alembert",
    description: 'Increase by $10 after loss, decrease by $10 after win',
    baseBet: 10,
    unit: 10,
    currentBet: 10,
    getNextBet: function(state, stats) {
      if (state.lastResult === null) {
        this.currentBet = this.baseBet;
      } else if (state.lastResult === 'dealer') {
        // Lost - increase bet by one unit
        this.currentBet = Math.min(this.currentBet + this.unit, state.maxBet, state.game.bankroll);
      } else if (state.lastResult === 'agent' || state.lastResult === 'agent-blackjack') {
        // Won - decrease bet by one unit (but not below base)
        this.currentBet = Math.max(this.baseBet, this.currentBet - this.unit);
      }
      // Push - keep same bet
      return Math.min(this.currentBet, state.game.bankroll);
    }
  },

  fibonacci: {
    name: 'Fibonacci',
    description: 'Follow Fibonacci sequence on losses, back 2 on wins',
    unitBet: 10,
    position: 0,
    sequence: [1, 1, 2, 3, 5, 8, 13, 21, 34, 55],
    getNextBet: function(state, stats) {
      if (state.lastResult === null) {
        this.position = 0;
      } else if (state.lastResult === 'dealer') {
        // Lost - move forward in sequence
        this.position = Math.min(this.position + 1, this.sequence.length - 1);
      } else if (state.lastResult === 'agent' || state.lastResult === 'agent-blackjack') {
        // Won - move back 2 positions
        this.position = Math.max(0, this.position - 2);
      }
      // Push - keep same position
      const bet = this.unitBet * this.sequence[this.position];
      return Math.max(state.minBet, Math.min(bet, state.maxBet, state.game.bankroll));
    }
  },

  labouchere: {
    name: 'Labouchere',
    description: 'Cancellation system with 1-2-3-4 sequence',
    unitBet: 5,
    initialSequence: [1, 2, 3, 4],
    sequence: [1, 2, 3, 4],
    lastBetUnits: 0,
    getNextBet: function(state, stats) {
      // Process previous result
      if (state.lastResult !== null && state.lastResult !== 'push') {
        if (state.lastResult === 'agent' || state.lastResult === 'agent-blackjack') {
          // Won - remove first and last from sequence
          if (this.sequence.length > 1) {
            this.sequence.shift();
            this.sequence.pop();
          } else if (this.sequence.length === 1) {
            this.sequence.shift();
          }
          // If sequence empty, restart cycle
          if (this.sequence.length === 0) {
            this.sequence = [...this.initialSequence];
          }
        } else if (state.lastResult === 'dealer') {
          // Lost - add bet units to end
          this.sequence.push(this.lastBetUnits);
        }
      }

      // Calculate bet: sum of first and last (or just the one if only one left)
      let betUnits;
      if (this.sequence.length === 0) {
        this.sequence = [...this.initialSequence];
        betUnits = this.sequence[0] + this.sequence[this.sequence.length - 1];
      } else if (this.sequence.length === 1) {
        betUnits = this.sequence[0];
      } else {
        betUnits = this.sequence[0] + this.sequence[this.sequence.length - 1];
      }

      this.lastBetUnits = betUnits;
      const bet = betUnits * this.unitBet;
      return Math.max(state.minBet, Math.min(bet, state.maxBet, state.game.bankroll));
    }
  }
};

// ============================================================================
// Sound Effects System (Web Audio API)
// ============================================================================

class SoundManager {
  constructor() {
    this.enabled = true;
    this.volume = 0.3;
    this.audioContext = null;
  }

  init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
      this.enabled = false;
    }
  }

  ensureContext() {
    if (!this.audioContext) {
      this.init();
    }
    // Chrome requires resume() to be called from a user gesture
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext && this.audioContext.state === 'running';
  }

  // Call this on first user interaction to unlock audio
  unlock() {
    this.ensureContext();
    // Play a silent sound to fully unlock the context
    if (this.audioContext && this.audioContext.state === 'running') {
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      gain.gain.value = 0;
      oscillator.connect(gain);
      gain.connect(this.audioContext.destination);
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.001);
    }
  }

  // Generate a simple tone
  playTone(frequency, duration, type = 'sine', volumeMultiplier = 1) {
    if (!this.enabled) return;
    if (!this.ensureContext()) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    const now = this.audioContext.currentTime;
    gainNode.gain.setValueAtTime(this.volume * volumeMultiplier, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  // Generate noise burst (for card sounds)
  playNoise(duration, volumeMultiplier = 1) {
    if (!this.enabled) return;
    if (!this.ensureContext()) return;

    const bufferSize = this.audioContext.sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }

    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    source.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.value = 1000;

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    gainNode.gain.value = this.volume * volumeMultiplier * 0.5;
    source.start();
  }

  // Sound effect methods
  cardDeal() {
    this.playNoise(0.08, 0.8);
  }

  cardFlip() {
    this.playNoise(0.1, 0.6);
    setTimeout(() => this.playTone(800, 0.05, 'sine', 0.3), 50);
  }

  chipClick() {
    this.playTone(1200, 0.05, 'sine', 0.4);
    this.playTone(1800, 0.03, 'sine', 0.2);
  }

  win() {
    // Ascending happy tones
    this.playTone(523, 0.15, 'sine', 0.5); // C5
    setTimeout(() => this.playTone(659, 0.15, 'sine', 0.5), 100); // E5
    setTimeout(() => this.playTone(784, 0.2, 'sine', 0.5), 200); // G5
    setTimeout(() => this.playTone(1047, 0.3, 'sine', 0.6), 300); // C6
  }

  blackjack() {
    // Exciting fanfare
    this.playTone(523, 0.1, 'sine', 0.5);
    setTimeout(() => this.playTone(659, 0.1, 'sine', 0.5), 80);
    setTimeout(() => this.playTone(784, 0.1, 'sine', 0.5), 160);
    setTimeout(() => this.playTone(1047, 0.15, 'sine', 0.6), 240);
    setTimeout(() => this.playTone(1319, 0.2, 'sine', 0.6), 320);
    setTimeout(() => this.playTone(1568, 0.3, 'sine', 0.7), 400);
  }

  lose() {
    // Descending sad tones
    this.playTone(400, 0.2, 'sine', 0.4);
    setTimeout(() => this.playTone(350, 0.2, 'sine', 0.4), 150);
    setTimeout(() => this.playTone(300, 0.3, 'sine', 0.3), 300);
  }

  bust() {
    // Harsh buzz
    this.playTone(150, 0.15, 'sawtooth', 0.3);
    this.playTone(155, 0.15, 'sawtooth', 0.3);
    setTimeout(() => this.playTone(100, 0.2, 'sawtooth', 0.2), 100);
  }

  push() {
    // Neutral tone
    this.playTone(440, 0.15, 'sine', 0.3);
    setTimeout(() => this.playTone(440, 0.15, 'sine', 0.3), 200);
  }

  buttonClick() {
    this.playTone(600, 0.03, 'sine', 0.2);
  }

  burn() {
    // Quick card slide/burn sound
    this.playNoise(0.12, 0.7);
    setTimeout(() => this.playTone(200, 0.08, 'sine', 0.2), 80);
  }

  shuffle() {
    // Longer shuffling sound - multiple card riffles
    for (let i = 0; i < 4; i++) {
      setTimeout(() => this.playNoise(0.15, 0.5), i * 180);
    }
    // Add a satisfying final "thunk"
    setTimeout(() => this.playTone(150, 0.1, 'sine', 0.3), 750);
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}

const sounds = new SoundManager();

// Session statistics tracking
class SessionStats {
  constructor() {
    this.reset();
  }

  reset() {
    this.handsPlayed = 0;
    this.handsWon = 0;
    this.handsLost = 0;
    this.handsPushed = 0;
    this.blackjacks = 0;
    this.splits = 0;
    this.doubles = 0;
    this.insurancesTaken = 0;
    this.insurancesWon = 0;
    this.totalWagered = 0;
    this.totalWon = 0;
    this.totalLost = 0;
    this.biggestWin = 0;
    this.biggestLoss = 0;
    this.maxBankroll = 0;
    this.minBankroll = Infinity;
    this.initialBankroll = 0;
    this.sideBetsWon = 0;
    this.sideBetsPaid = 0;
  }

  startSession(bankroll) {
    this.reset();
    this.initialBankroll = bankroll;
    this.maxBankroll = bankroll;
    this.minBankroll = bankroll;
  }

  recordBet(amount) {
    this.totalWagered += amount;
  }

  recordSideBet(amount) {
    this.totalWagered += amount;
  }

  recordSideBetWin(payout) {
    this.sideBetsWon++;
    this.sideBetsPaid += payout;
  }

  recordDouble() {
    this.doubles++;
  }

  recordSplit() {
    this.splits++;
  }

  recordInsurance(won) {
    this.insurancesTaken++;
    if (won) {
      this.insurancesWon++;
    }
  }

  recordHandResult(result, betAmount, payout, currentBankroll) {
    this.handsPlayed++;

    const netGain = payout - betAmount;

    switch (result) {
      case 'agent-blackjack':
        this.handsWon++;
        this.blackjacks++;
        this.totalWon += netGain;
        if (netGain > this.biggestWin) this.biggestWin = netGain;
        break;
      case 'agent':
        this.handsWon++;
        this.totalWon += netGain;
        if (netGain > this.biggestWin) this.biggestWin = netGain;
        break;
      case 'push':
        this.handsPushed++;
        break;
      case 'dealer':
        this.handsLost++;
        this.totalLost += betAmount;
        if (betAmount > this.biggestLoss) this.biggestLoss = betAmount;
        break;
    }

    // Track bankroll extremes
    if (currentBankroll > this.maxBankroll) this.maxBankroll = currentBankroll;
    if (currentBankroll < this.minBankroll) this.minBankroll = currentBankroll;
  }

  recordSplitResults(results, bets, currentBankroll) {
    for (let i = 0; i < results.length; i++) {
      const result = results[i].result;
      const bet = bets[i] || state.currentBet;

      // Calculate payout
      let payout = 0;
      if (result === 'agent-blackjack') {
        payout = bet + (bet * 1.5);
      } else if (result === 'agent') {
        payout = bet * 2;
      } else if (result === 'push') {
        payout = bet;
      }

      this.recordHandResult(result, bet, payout, currentBankroll);
    }
  }

  getWinRate() {
    if (this.handsPlayed === 0) return 0;
    return ((this.handsWon / this.handsPlayed) * 100).toFixed(1);
  }

  getNetProfit() {
    return this.totalWon - this.totalLost + this.sideBetsPaid;
  }

  getInsuranceWinRate() {
    if (this.insurancesTaken === 0) return 0;
    return ((this.insurancesWon / this.insurancesTaken) * 100).toFixed(1);
  }
}

const state = new GameState();
const stats = new SessionStats();

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {
  // Header
  bankrollDisplay: document.getElementById('bankroll-display'),
  betDisplay: document.getElementById('bet-display'),

  // Dealer
  dealerHand: document.getElementById('dealer-hand'),
  dealerValue: document.getElementById('dealer-value'),

  // Player
  playerHand: document.getElementById('player-hand'),
  playerValue: document.getElementById('player-value'),
  splitHandsContainer: document.getElementById('split-hands-container'),
  splitHands: document.getElementById('split-hands'),

  // Center
  resultBanner: document.getElementById('result-banner'),

  // Controls
  bettingControls: document.getElementById('betting-controls'),
  playingControls: document.getElementById('playing-controls'),
  earlySurrenderControls: document.getElementById('early-surrender-controls'),
  insuranceControls: document.getElementById('insurance-controls'),
  resultControls: document.getElementById('result-controls'),

  // Betting
  betAmount: document.getElementById('bet-amount'),
  betDecrease: document.getElementById('bet-decrease'),
  betIncrease: document.getElementById('bet-increase'),
  dealBtn: document.getElementById('deal-btn'),

  // Playing
  hitBtn: document.getElementById('hit-btn'),
  standBtn: document.getElementById('stand-btn'),
  doubleBtn: document.getElementById('double-btn'),
  splitBtn: document.getElementById('split-btn'),
  surrenderBtn: document.getElementById('surrender-btn'),

  // Early Surrender
  earlySurrenderYes: document.getElementById('early-surrender-yes'),
  earlySurrenderNo: document.getElementById('early-surrender-no'),

  // Insurance
  insuranceYes: document.getElementById('insurance-yes'),
  insuranceNo: document.getElementById('insurance-no'),

  // Result
  newHandBtn: document.getElementById('new-hand-btn'),

  // Status
  message: document.getElementById('message'),

  // Modals
  startScreen: document.getElementById('start-screen'),
  rulesModal: document.getElementById('rules-modal'),
  gameOverModal: document.getElementById('game-over-modal'),

  // Start screen
  startingBankroll: document.getElementById('starting-bankroll'),
  variantSelect: document.getElementById('variant-select'),
  numDecksSelect: document.getElementById('num-decks'),
  strategySelect: document.getElementById('strategy-select'),
  seedInput: document.getElementById('seed-input'),
  hitSoft17Check: document.getElementById('hit-soft-17'),
  allowEarlySurrenderCheck: document.getElementById('allow-early-surrender'),
  allowLateSurrenderCheck: document.getElementById('allow-late-surrender'),
  resplitAcesCheck: document.getElementById('resplit-aces'),
  startGame: document.getElementById('start-game'),
  showRules: document.getElementById('show-rules'),
  closeRules: document.getElementById('close-rules'),

  // Bet limits
  betLimits: document.getElementById('bet-limits'),

  // Game over
  gameOverMessage: document.getElementById('game-over-message'),
  finalStats: document.getElementById('final-stats'),
  restartGame: document.getElementById('restart-game'),

  // Sound toggle
  soundBtn: document.getElementById('sound-btn'),

  // Stats modal
  statsModal: document.getElementById('stats-modal'),
  statsBtn: document.getElementById('stats-btn'),
  closeStats: document.getElementById('close-stats'),
  statHandsPlayed: document.getElementById('stat-hands-played'),
  statHandsWon: document.getElementById('stat-hands-won'),
  statHandsLost: document.getElementById('stat-hands-lost'),
  statPushes: document.getElementById('stat-pushes'),
  statWinRate: document.getElementById('stat-win-rate'),
  statBlackjacks: document.getElementById('stat-blackjacks'),
  statDoubles: document.getElementById('stat-doubles'),
  statSplits: document.getElementById('stat-splits'),
  statInsurances: document.getElementById('stat-insurances'),
  statSideBets: document.getElementById('stat-side-bets'),
  statTotalWagered: document.getElementById('stat-total-wagered'),
  statTotalWon: document.getElementById('stat-total-won'),
  statTotalLost: document.getElementById('stat-total-lost'),
  statNetProfit: document.getElementById('stat-net-profit'),
  statBiggestWin: document.getElementById('stat-biggest-win'),
  statBiggestLoss: document.getElementById('stat-biggest-loss'),
  statMaxBankroll: document.getElementById('stat-max-bankroll'),
  statMinBankroll: document.getElementById('stat-min-bankroll'),

  // Side bets
  sideBetsWrapper: document.getElementById('side-bets-wrapper'),
  sideBetsToggle: document.getElementById('side-bets-toggle'),
  sideBetsCount: document.getElementById('side-bets-count'),
  perfectPairsCheck: document.getElementById('perfect-pairs-check'),
  ppAmount: document.getElementById('pp-amount'),
  ppDecrease: document.getElementById('pp-decrease'),
  ppIncrease: document.getElementById('pp-increase'),
  twentyOnePlus3Check: document.getElementById('twentyone-plus3-check'),
  tpAmount: document.getElementById('tp-amount'),
  tpDecrease: document.getElementById('tp-decrease'),
  tpIncrease: document.getElementById('tp-increase'),
  luckyLadiesCheck: document.getElementById('lucky-ladies-check'),
  llAmount: document.getElementById('ll-amount'),
  llDecrease: document.getElementById('ll-decrease'),
  llIncrease: document.getElementById('ll-increase'),
  busterBlackjackCheck: document.getElementById('buster-blackjack-check'),
  bbAmount: document.getElementById('bb-amount'),
  bbDecrease: document.getElementById('bb-decrease'),
  bbIncrease: document.getElementById('bb-increase'),
  royalMatchCheck: document.getElementById('royal-match-check'),
  rmAmount: document.getElementById('rm-amount'),
  rmDecrease: document.getElementById('rm-decrease'),
  rmIncrease: document.getElementById('rm-increase'),
  superSevensCheck: document.getElementById('super-sevens-check'),
  ssAmount: document.getElementById('ss-amount'),
  ssDecrease: document.getElementById('ss-decrease'),
  ssIncrease: document.getElementById('ss-increase'),

  // Side bet results
  sidebetResults: document.getElementById('sidebet-results'),
  perfectPairsResult: document.getElementById('perfect-pairs-result'),
  twentyOnePlus3Result: document.getElementById('twentyone-plus3-result'),
  luckyLadiesResult: document.getElementById('lucky-ladies-result'),
  busterBlackjackResult: document.getElementById('buster-blackjack-result'),
  royalMatchResult: document.getElementById('royal-match-result'),
  superSevensResult: document.getElementById('super-sevens-result'),

  // Deck count in dealer area
  deckCountLabel: document.getElementById('deck-count-label'),

  // Card counting display
  cardCountDisplay: document.getElementById('card-count-display'),
  runningCount: document.getElementById('running-count'),
  trueCount: document.getElementById('true-count'),
  showCardCountCheck: document.getElementById('show-card-count'),
  countingSystemRow: document.getElementById('counting-system-row'),
  countingSystemSelect: document.getElementById('counting-system'),

  // Multiplayer elements
  gameModeSelect: document.getElementById('game-mode'),
  multiplayerOptions: document.getElementById('multiplayer-options'),
  numPlayersSelect: document.getElementById('num-players'),
  phaseBanner: document.getElementById('phase-banner'),
  phaseText: document.getElementById('phase-text'),
  seatsContainer: document.getElementById('seats-container'),
  playerSeats: document.querySelectorAll('.player-seat'),
  mobileCarousel: document.getElementById('mobile-carousel'),
  carouselTrack: document.getElementById('carousel-track'),
  carouselDots: document.getElementById('carousel-dots'),
  playerSection: document.getElementById('player-section'),
};

// ============================================================================
// Card Rendering
// ============================================================================

const rankToSprite = {
  'A': 'ace',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  'J': 'jack',
  'Q': 'queen',
  'K': 'king'
};

function createCardElement(card, options = {}) {
  const div = document.createElement('div');
  div.className = 'card card-sprite';
  div.dataset.cardId = card.id;

  if (options.faceDown) {
    div.classList.add('sprite-back');
    div.classList.remove('card-sprite');
    div.classList.add('card-back');
  } else {
    const rank = rankToSprite[card.meta.rank] || card.meta.rank.toLowerCase();
    const suit = card.meta.suit;
    div.classList.add(`sprite-${rank}-${suit}`);
  }

  if (options.animate) {
    div.classList.add(options.animate);
  }

  // Accessibility
  div.setAttribute('role', 'listitem');
  if (!options.faceDown) {
    div.setAttribute('aria-label', `${card.label} of ${card.meta.suit}`);
  } else {
    div.setAttribute('aria-label', 'Face down card');
  }

  return div;
}

// ============================================================================
// Rendering Functions
// ============================================================================

/**
 * Updates the side bets toggle button to show count of active bets
 */
function updateSideBetsCount() {
  const count = [
    state.perfectPairsEnabled,
    state.twentyOnePlus3Enabled,
    state.luckyLadiesEnabled,
    state.busterBlackjackEnabled,
    state.royalMatchEnabled,
    state.superSevensEnabled
  ].filter(Boolean).length;

  const countEl = elements.sideBetsCount;
  if (countEl) {
    if (count > 0) {
      countEl.textContent = count;
      countEl.style.display = 'inline';
    } else {
      countEl.style.display = 'none';
    }
  }
}

/**
 * Update side bet amount displays without full re-render.
 * Works in both single-player and multiplayer modes.
 */
function updateSideBetAmounts() {
  elements.ppAmount.textContent = `$${state.perfectPairsBet}`;
  elements.tpAmount.textContent = `$${state.twentyOnePlus3Bet}`;
  elements.llAmount.textContent = `$${state.luckyLadiesBet}`;
  elements.bbAmount.textContent = `$${state.busterBlackjackBet}`;
  elements.rmAmount.textContent = `$${state.royalMatchBet}`;
  elements.ssAmount.textContent = `$${state.superSevensBet}`;
}

function render() {
  if (!state.game) return;

  const gameState = state.isSplit ? state.game.getSplitGameState() : state.game.getGameState();

  // Update header
  elements.bankrollDisplay.textContent = `$${gameState.bankroll}`;
  elements.betDisplay.textContent = `Bet: $${state.currentBet}`;

  // Update deck count label in dealer area
  if (elements.deckCountLabel) {
    elements.deckCountLabel.textContent = gameState.deckCount;
  }

  // Update card count display
  updateCardCountDisplay(gameState);

  // Render hands
  if (state.isSplit) {
    renderSplitHands(gameState);
  } else {
    renderPlayerHand(gameState);
  }

  renderDealerHand(gameState);

  // Update controls
  updateControls(gameState);

  // Update side bet UI
  updateSideBetUI();

  // Update hand values
  updateHandValues(gameState);
}

function renderPlayerHand(gameState) {
  elements.playerHand.innerHTML = '';
  elements.splitHandsContainer.classList.add('hidden');

  const cards = gameState.playerHand.cards;
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const options = {};

    // Add deal animation if this is a fresh deal
    if (state.animateDealing) {
      options.animate = 'deal-animation';
    }
    // Add hit animation for the last card if it was just hit
    else if (state.lastHitCardId && card.id === state.lastHitCardId) {
      options.animate = 'hit-animation';
    }

    const cardEl = createCardElement(card, options);
    elements.playerHand.appendChild(cardEl);
  }
}

function renderSplitHands(gameState) {
  elements.playerHand.innerHTML = '';
  elements.splitHandsContainer.classList.remove('hidden');
  elements.splitHands.innerHTML = '';

  for (let i = 0; i < gameState.splitHands.length; i++) {
    const hand = gameState.splitHands[i];

    const handDiv = document.createElement('div');
    handDiv.className = 'split-hand';
    if (hand.active) {
      handDiv.classList.add('active');
    }

    const header = document.createElement('div');
    header.className = 'hand-header';

    const label = document.createElement('span');
    label.className = 'hand-label';
    label.textContent = `Hand ${i + 1}`;

    const value = document.createElement('span');
    value.className = 'hand-value';
    if (hand.busted) {
      value.textContent = 'BUST';
      value.classList.add('busted');
    } else if (hand.blackjack) {
      value.textContent = '21';
      value.classList.add('blackjack');
    } else {
      value.textContent = hand.value;
    }

    header.appendChild(label);
    header.appendChild(value);

    const cardsDiv = document.createElement('div');
    cardsDiv.className = 'split-hand-cards';

    for (const card of hand.cards) {
      const cardEl = createCardElement(card);
      cardsDiv.appendChild(cardEl);
    }

    handDiv.appendChild(header);
    handDiv.appendChild(cardsDiv);
    elements.splitHands.appendChild(handDiv);
  }
}

function renderDealerHand(gameState) {
  elements.dealerHand.innerHTML = '';

  const dealerCards = gameState.dealerHand.cards;
  const showAll = gameState.gameOver || state.phase === 'result';

  for (let i = 0; i < dealerCards.length; i++) {
    const card = dealerCards[i];
    const isFaceDown = !showAll && i === 0 && state.game.variant === 'american' && !card.faceUp;
    const options = { faceDown: isFaceDown };

    // Add deal animation if this is a fresh deal
    if (state.animateDealing) {
      options.animate = 'deal-animation';
    }
    // Add flip animation for the hole card when it's being revealed
    else if (state.animateDealerFlip && i === 0 && !isFaceDown) {
      options.animate = 'flip-animation';
    }

    const cardEl = createCardElement(card, options);
    elements.dealerHand.appendChild(cardEl);
  }
}

function updateHandValues(gameState) {
  // Player value
  if (state.isSplit) {
    elements.playerValue.textContent = '';
  } else {
    const pv = gameState.playerHand;
    if (pv.busted) {
      elements.playerValue.textContent = 'BUST';
      elements.playerValue.classList.add('busted');
      elements.playerValue.classList.remove('blackjack');
    } else if (pv.blackjack) {
      elements.playerValue.textContent = 'BLACKJACK!';
      elements.playerValue.classList.add('blackjack');
      elements.playerValue.classList.remove('busted');
    } else {
      elements.playerValue.textContent = pv.value;
      elements.playerValue.classList.remove('busted', 'blackjack');
    }
  }

  // Dealer value
  const dv = gameState.dealerHand;
  const showAll = gameState.gameOver || state.phase === 'result';

  if (showAll) {
    if (dv.busted) {
      elements.dealerValue.textContent = 'BUST';
      elements.dealerValue.classList.add('busted');
    } else if (dv.blackjack) {
      elements.dealerValue.textContent = 'BLACKJACK!';
      elements.dealerValue.classList.add('blackjack');
    } else {
      elements.dealerValue.textContent = dv.value;
      elements.dealerValue.classList.remove('busted', 'blackjack');
    }
  } else {
    elements.dealerValue.textContent = dv.visibleValue || '?';
    elements.dealerValue.classList.remove('busted', 'blackjack');
  }
}

function updateControls(gameState) {
  // Hide all control groups first
  elements.bettingControls.classList.add('hidden');
  elements.playingControls.classList.add('hidden');
  elements.insuranceControls.classList.add('hidden');
  elements.resultControls.classList.add('hidden');

  switch (state.phase) {
    case 'betting':
      elements.bettingControls.classList.remove('hidden');
      updateBettingControls();
      break;

    case 'insurance':
      elements.insuranceControls.classList.remove('hidden');
      break;

    case 'playing':
      elements.playingControls.classList.remove('hidden');
      updatePlayingControls(gameState);
      break;

    case 'result':
      elements.resultControls.classList.remove('hidden');
      break;
  }
}

function updateBettingControls() {
  elements.betAmount.textContent = `$${state.currentBet}`;

  const bankroll = state.game ? state.game.bankroll : state.initialBankroll;
  const isAutoStrategy = state.bettingStrategy !== 'manual';

  // Disable bet adjustments for automated strategies
  elements.betDecrease.disabled = isAutoStrategy || state.currentBet <= state.minBet;
  elements.betIncrease.disabled = isAutoStrategy || state.currentBet >= state.maxBet || state.currentBet >= bankroll;

  // Disable deal if insufficient funds
  elements.dealBtn.disabled = state.currentBet > bankroll;
}

function updatePlayingControls(gameState) {
  elements.hitBtn.disabled = !gameState.canHit;
  elements.standBtn.disabled = !gameState.canStand;
  elements.doubleBtn.disabled = !gameState.canDouble;
  elements.splitBtn.disabled = !gameState.canSplit;
  elements.surrenderBtn.disabled = !gameState.canSurrender;

  // Hide split if in split mode (can't split again from main controls)
  if (state.isSplit) {
    elements.splitBtn.style.display = 'none';
    // Show re-split if available
    if (gameState.canReSplit) {
      elements.splitBtn.style.display = '';
      elements.splitBtn.disabled = false;
    }
  } else {
    elements.splitBtn.style.display = '';
  }

  // Hide surrender if not allowed, update styling based on surrender type
  const surrenderAllowed = state.allowEarlySurrender || state.allowLateSurrender;
  elements.surrenderBtn.style.display = surrenderAllowed ? '' : 'none';

  // Update surrender button styling and badge based on type available
  const surrenderText = elements.surrenderBtn.querySelector('.surrender-text');
  const surrenderBadge = elements.surrenderBtn.querySelector('.surrender-type-badge');

  // Reset classes
  elements.surrenderBtn.classList.remove('early-surrender', 'late-surrender');

  if (gameState.canEarlySurrender) {
    // Early surrender is available - show urgent styling
    elements.surrenderBtn.classList.add('early-surrender');
    if (surrenderBadge) surrenderBadge.textContent = 'Early';
  } else if (gameState.canSurrender && state.allowLateSurrender) {
    // Late surrender is available
    elements.surrenderBtn.classList.add('late-surrender');
    if (surrenderBadge) surrenderBadge.textContent = 'Late';
  } else {
    // No surrender available, clear badge
    if (surrenderBadge) surrenderBadge.textContent = '';
  }
}

function updateSideBetUI() {
  // Update side bet amounts
  elements.ppAmount.textContent = `$${state.perfectPairsBet}`;
  elements.tpAmount.textContent = `$${state.twentyOnePlus3Bet}`;
  elements.llAmount.textContent = `$${state.luckyLadiesBet}`;
  elements.bbAmount.textContent = `$${state.busterBlackjackBet}`;
  elements.rmAmount.textContent = `$${state.royalMatchBet}`;
  elements.ssAmount.textContent = `$${state.superSevensBet}`;

  // Update checkbox states
  elements.perfectPairsCheck.checked = state.perfectPairsEnabled;
  elements.twentyOnePlus3Check.checked = state.twentyOnePlus3Enabled;
  elements.luckyLadiesCheck.checked = state.luckyLadiesEnabled;
  elements.busterBlackjackCheck.checked = state.busterBlackjackEnabled;
  elements.royalMatchCheck.checked = state.royalMatchEnabled;
  elements.superSevensCheck.checked = state.superSevensEnabled;

  // Update active class on side bet containers
  const ppContainer = elements.perfectPairsCheck.closest('.side-bet');
  const tpContainer = elements.twentyOnePlus3Check.closest('.side-bet');
  const llContainer = elements.luckyLadiesCheck.closest('.side-bet');
  const bbContainer = elements.busterBlackjackCheck.closest('.side-bet');
  const rmContainer = elements.royalMatchCheck.closest('.side-bet');
  const ssContainer = elements.superSevensCheck.closest('.side-bet');

  if (ppContainer) {
    ppContainer.classList.toggle('active', state.perfectPairsEnabled);
  }
  if (tpContainer) {
    tpContainer.classList.toggle('active', state.twentyOnePlus3Enabled);
  }
  if (llContainer) {
    llContainer.classList.toggle('active', state.luckyLadiesEnabled);
  }
  if (bbContainer) {
    bbContainer.classList.toggle('active', state.busterBlackjackEnabled);
  }
  if (rmContainer) {
    rmContainer.classList.toggle('active', state.royalMatchEnabled);
  }
  if (ssContainer) {
    ssContainer.classList.toggle('active', state.superSevensEnabled);
  }

  // Disable side bet buttons based on bankroll
  const bankroll = state.game ? state.game.bankroll : state.initialBankroll;
  const totalBets = state.currentBet +
    (state.perfectPairsEnabled ? state.perfectPairsBet : 0) +
    (state.twentyOnePlus3Enabled ? state.twentyOnePlus3Bet : 0) +
    (state.luckyLadiesEnabled ? state.luckyLadiesBet : 0) +
    (state.busterBlackjackEnabled ? state.busterBlackjackBet : 0) +
    (state.royalMatchEnabled ? state.royalMatchBet : 0) +
    (state.superSevensEnabled ? state.superSevensBet : 0);

  elements.ppDecrease.disabled = state.perfectPairsBet <= state.minBet;
  elements.ppIncrease.disabled = state.perfectPairsBet >= 50 || (totalBets + 5) > bankroll;
  elements.tpDecrease.disabled = state.twentyOnePlus3Bet <= state.minBet;
  elements.tpIncrease.disabled = state.twentyOnePlus3Bet >= 50 || (totalBets + 5) > bankroll;
  elements.llDecrease.disabled = state.luckyLadiesBet <= state.minBet;
  elements.llIncrease.disabled = state.luckyLadiesBet >= 50 || (totalBets + 5) > bankroll;
  elements.bbDecrease.disabled = state.busterBlackjackBet <= state.minBet;
  elements.bbIncrease.disabled = state.busterBlackjackBet >= 50 || (totalBets + 5) > bankroll;
  elements.rmDecrease.disabled = state.royalMatchBet <= state.minBet;
  elements.rmIncrease.disabled = state.royalMatchBet >= 50 || (totalBets + 5) > bankroll;
  elements.ssDecrease.disabled = state.superSevensBet <= state.minBet;
  elements.ssIncrease.disabled = state.superSevensBet >= 50 || (totalBets + 5) > bankroll;

  // Update deal button disabled state to account for side bets
  elements.dealBtn.disabled = totalBets > bankroll;
}

function updateCardCountDisplay(gameState) {
  if (!elements.cardCountDisplay) return;

  // Only show if card counting is explicitly enabled and count info is available
  const shouldShow = state.showCardCount === true && gameState && gameState.countInfo;

  if (shouldShow) {
    elements.cardCountDisplay.classList.remove('hidden');

    const { runningCount, trueCount } = gameState.countInfo;

    // Update values
    elements.runningCount.textContent = runningCount >= 0 ? `+${runningCount}` : runningCount;
    elements.trueCount.textContent = trueCount >= 0 ? `+${trueCount}` : trueCount;

    // Color-code based on favorability
    // Positive = good for player (green), Negative = good for house (red)
    const rcClass = runningCount > 0 ? 'positive' : runningCount < 0 ? 'negative' : 'neutral';
    const tcClass = trueCount > 0 ? 'positive' : trueCount < 0 ? 'negative' : 'neutral';

    elements.runningCount.className = `count-value ${rcClass}`;
    elements.trueCount.className = `count-value ${tcClass}`;
  } else {
    elements.cardCountDisplay.classList.add('hidden');
  }
}

function updateStatsDisplay() {
  if (!elements.statHandsPlayed) return;

  elements.statHandsPlayed.textContent = stats.handsPlayed;
  elements.statHandsWon.textContent = stats.handsWon;
  elements.statHandsLost.textContent = stats.handsLost;
  elements.statPushes.textContent = stats.handsPushed;
  elements.statWinRate.textContent = `${stats.getWinRate()}%`;
  elements.statBlackjacks.textContent = stats.blackjacks;
  elements.statDoubles.textContent = stats.doubles;
  elements.statSplits.textContent = stats.splits;

  const insuranceText = stats.insurancesTaken > 0
    ? `${stats.insurancesWon}/${stats.insurancesTaken} (${stats.getInsuranceWinRate()}%)`
    : '0';
  elements.statInsurances.textContent = insuranceText;

  elements.statSideBets.textContent = stats.sideBetsWon;
  elements.statTotalWagered.textContent = `$${stats.totalWagered.toFixed(0)}`;
  elements.statTotalWon.textContent = `$${stats.totalWon.toFixed(0)}`;
  elements.statTotalLost.textContent = `$${stats.totalLost.toFixed(0)}`;

  const netProfit = stats.getNetProfit();
  elements.statNetProfit.textContent = `${netProfit >= 0 ? '+' : ''}$${netProfit.toFixed(0)}`;
  elements.statNetProfit.classList.toggle('profit', netProfit >= 0);
  elements.statNetProfit.classList.toggle('loss', netProfit < 0);

  elements.statBiggestWin.textContent = `$${stats.biggestWin.toFixed(0)}`;
  elements.statBiggestLoss.textContent = `$${stats.biggestLoss.toFixed(0)}`;
  elements.statMaxBankroll.textContent = `$${stats.maxBankroll.toFixed(0)}`;
  elements.statMinBankroll.textContent = stats.minBankroll === Infinity ? '$0' : `$${stats.minBankroll.toFixed(0)}`;
}

function showStatsModal() {
  updateStatsDisplay();
  elements.statsModal.classList.remove('hidden');
}

function hideStatsModal() {
  elements.statsModal.classList.add('hidden');
}

// ============================================================================
// Result Display
// ============================================================================

function showResult(result) {
  state.phase = 'result';

  // Track last result for betting strategies
  state.lastResult = result;

  let message = '';
  let bannerClass = '';

  if (state.isSplit) {
    // Show split results
    const splitState = state.game.getSplitGameState();
    const wins = splitState.results.filter(r => r.result === 'agent' || r.result === 'agent-blackjack').length;
    const losses = splitState.results.filter(r => r.result === 'dealer').length;
    const pushes = splitState.results.filter(r => r.result === 'push').length;

    // For split hands, set lastResult based on overall outcome
    if (wins > losses) {
      state.lastResult = 'agent';
    } else if (losses > wins) {
      state.lastResult = 'dealer';
    } else {
      state.lastResult = 'push';
    }

    // Record split results in stats
    stats.recordSplitResults(splitState.results, state.game.splitBets, state.game.bankroll);

    if (wins > losses) {
      message = `Won ${wins} hand${wins > 1 ? 's' : ''}!`;
      bannerClass = 'win';
    } else if (losses > wins) {
      message = `Lost ${losses} hand${losses > 1 ? 's' : ''}`;
      bannerClass = 'lose';
    } else {
      message = 'Push';
      bannerClass = 'push';
    }
  } else {
    // Calculate payout for stats
    let payout = 0;
    if (result === 'agent-blackjack') {
      payout = state.currentBet + (state.currentBet * 1.5);
    } else if (result === 'agent') {
      payout = state.currentBet * 2;
    } else if (result === 'push') {
      payout = state.currentBet;
    } else if (result === 'surrender') {
      payout = state.currentBet / 2; // Get half back
    }

    // Record hand result
    stats.recordHandResult(result, state.currentBet, payout, state.game.bankroll);

    switch (result) {
      case 'agent-blackjack':
        message = 'BLACKJACK!';
        bannerClass = 'blackjack';
        break;
      case 'agent':
        message = 'You Win!';
        bannerClass = 'win';
        break;
      case 'dealer':
        message = 'Dealer Wins';
        bannerClass = 'lose';
        break;
      case 'push':
        message = 'Push';
        bannerClass = 'push';
        break;
      case 'surrender':
        message = 'Surrendered';
        bannerClass = 'surrender';
        break;
    }
  }

  elements.resultBanner.textContent = message;
  elements.resultBanner.className = `result-banner ${bannerClass}`;
  elements.resultBanner.classList.remove('hidden');

  // Play result sound
  switch (bannerClass) {
    case 'blackjack':
      sounds.blackjack();
      break;
    case 'win':
      sounds.win();
      break;
    case 'lose':
      // Check if player busted for different sound
      const gameState = state.isSplit ? state.game.getSplitGameState() : state.game.getGameState();
      if (!state.isSplit && gameState.playerHand.busted) {
        sounds.bust();
      } else {
        sounds.lose();
      }
      break;
    case 'push':
      sounds.push();
      break;
    case 'surrender':
      sounds.push(); // Neutral sound for surrender
      break;
  }

  // Resolve dealer-dependent side bets (Lucky Ladies, Buster Blackjack)
  const dealerSideBetResults = state.game.resolveDealerDependentSideBets();
  if (dealerSideBetResults) {
    // Update display with all side bet results (including newly resolved ones)
    displaySideBetResults(state.game.sideBetResults);
  }

  // Update message with payout info
  const bankroll = state.game.bankroll;
  elements.message.textContent = `Bankroll: $${bankroll}`;
  elements.message.classList.add('important');

  render();

  // Check for game over (broke)
  if (state.game.isBroke()) {
    setTimeout(showGameOver, 1500);
  }
}

function showGameOver() {
  elements.gameOverMessage.textContent = "You've run out of chips!";

  // Show summary stats
  const netProfit = stats.getNetProfit();
  const profitText = netProfit >= 0 ? `+$${netProfit.toFixed(0)}` : `-$${Math.abs(netProfit).toFixed(0)}`;

  elements.finalStats.innerHTML = `
    <div style="text-align: left; margin: 15px 0;">
      <div>Hands Played: ${stats.handsPlayed}</div>
      <div>Won: ${stats.handsWon} | Lost: ${stats.handsLost} | Push: ${stats.handsPushed}</div>
      <div>Win Rate: ${stats.getWinRate()}%</div>
      <div>Blackjacks: ${stats.blackjacks}</div>
      <div style="margin-top: 10px;">Total Wagered: $${stats.totalWagered.toFixed(0)}</div>
      <div>Net Result: ${profitText}</div>
    </div>
  `;
  elements.gameOverModal.classList.remove('hidden');
}

// ============================================================================
// Game Actions
// ============================================================================

function initGame() {
  state.game = new BlackjackGame({
    numDecks: state.numDecks,
    initialBankroll: state.initialBankroll,
    minBet: state.minBet,
    maxBet: state.maxBet,
    variant: state.variant,
    seed: state.seed,
    dealerHitsSoft17: state.dealerHitsSoft17,
    allowEarlySurrender: state.allowEarlySurrender,
    allowLateSurrender: state.allowLateSurrender,
    resplitAces: state.resplitAces
  });

  state.phase = 'betting';
  state.isSplit = false;
  state.lastResult = null;

  // Reset strategy state
  if (BettingStrategies.martingale.currentBet) {
    BettingStrategies.martingale.currentBet = BettingStrategies.martingale.baseBet;
  }
  if (BettingStrategies.progressive.currentBet) {
    BettingStrategies.progressive.currentBet = BettingStrategies.progressive.baseBet;
  }

  // Set initial bet based on strategy
  if (state.bettingStrategy !== 'manual') {
    state.currentBet = BettingStrategies[state.bettingStrategy].getNextBet(state, stats);
  } else {
    state.currentBet = Math.min(10, state.game.bankroll);
  }

  // Start fresh stats session
  stats.startSession(state.initialBankroll);

  // Update bet limits display
  if (elements.betLimits) {
    elements.betLimits.textContent = `($${state.minBet} - $${state.maxBet})`;
  }

  elements.resultBanner.classList.add('hidden');

  // Show strategy info if not manual
  if (state.bettingStrategy !== 'manual') {
    const strategy = BettingStrategies[state.bettingStrategy];
    elements.message.textContent = `Strategy: ${strategy.name} - ${strategy.description}`;
  } else {
    elements.message.textContent = 'Place your bet and click Deal!';
  }
  elements.message.classList.remove('important');

  render();
}

function deal() {
  // Calculate total bets
  const totalBet = state.currentBet +
    (state.perfectPairsEnabled ? state.perfectPairsBet : 0) +
    (state.twentyOnePlus3Enabled ? state.twentyOnePlus3Bet : 0) +
    (state.luckyLadiesEnabled ? state.luckyLadiesBet : 0) +
    (state.busterBlackjackEnabled ? state.busterBlackjackBet : 0);

  if (totalBet > state.game.bankroll) {
    elements.message.textContent = 'Insufficient funds!';
    return;
  }

  // Play chip sound for bet placement
  sounds.chipClick();

  // Check if we need to burn a card first
  if (state.game.shouldBurnCard()) {
    state.phase = 'burning';
    elements.message.textContent = 'Burning card...';

    // Show burn banner
    elements.resultBanner.textContent = 'BURN CARD';
    elements.resultBanner.className = 'result-banner burn';
    elements.resultBanner.classList.remove('hidden');

    // Play burn sound and perform burn
    sounds.burn();
    state.game.burnCard();

    render();

    // After brief delay, continue with deal
    setTimeout(() => {
      elements.resultBanner.classList.add('hidden');
      performDeal();
    }, 800);
  } else {
    performDeal();
  }
}

function performDeal() {
  // Place main bet
  state.game.placeBet(state.currentBet);
  stats.recordBet(state.currentBet);

  // Place side bets
  if (state.perfectPairsEnabled) {
    state.game.placePerfectPairsBet(state.perfectPairsBet);
    stats.recordSideBet(state.perfectPairsBet);
  }
  if (state.twentyOnePlus3Enabled) {
    state.game.place21Plus3Bet(state.twentyOnePlus3Bet);
    stats.recordSideBet(state.twentyOnePlus3Bet);
  }
  if (state.luckyLadiesEnabled) {
    state.game.placeLuckyLadiesBet(state.luckyLadiesBet);
    stats.recordSideBet(state.luckyLadiesBet);
  }
  if (state.busterBlackjackEnabled) {
    state.game.placeBusterBlackjackBet(state.busterBlackjackBet);
    stats.recordSideBet(state.busterBlackjackBet);
  }
  if (state.royalMatchEnabled && state.game.placeRoyalMatchBet) {
    state.game.placeRoyalMatchBet(state.royalMatchBet);
    stats.recordSideBet(state.royalMatchBet);
  }
  if (state.superSevensEnabled && state.game.placeSuperSevensBet) {
    state.game.placeSuperSevensBet(state.superSevensBet);
    stats.recordSideBet(state.superSevensBet);
  }

  // Deal cards with animation
  state.game.deal();
  state.animateDealing = true;
  state.lastHitCardId = null;

  // Play card deal sounds with staggered timing
  sounds.cardDeal();
  setTimeout(() => sounds.cardDeal(), 150);
  setTimeout(() => sounds.cardDeal(), 300);
  setTimeout(() => sounds.cardDeal(), 450);

  // Resolve side bets immediately after deal
  const sideBetResults = state.game.resolveSideBets();
  displaySideBetResults(sideBetResults);

  state.isSplit = false;
  elements.resultBanner.classList.add('hidden');

  // Check for insurance opportunity
  const gameState = state.game.getGameState();
  if (gameState.canInsurance) {
    state.phase = 'insurance';
    elements.message.textContent = 'Dealer shows an Ace. Insurance?';
  } else {
    state.phase = 'playing';
    elements.message.textContent = 'Your turn. Hit, Stand, Double, or Split?';
  }

  // Check for immediate blackjack
  if (gameState.gameOver) {
    showResult(gameState.result);
    return;
  }

  render();

  // Clear animation flag after animations complete
  setTimeout(() => {
    state.animateDealing = false;
  }, 600);
}

function displaySideBetResults(results) {
  if (!results) {
    elements.sidebetResults.classList.add('hidden');
    return;
  }

  let hasResults = false;

  // Perfect Pairs result
  if (results.perfectPairs) {
    if (results.perfectPairs.win) {
      const typeLabels = {
        'perfect': 'Perfect Pair',
        'colored': 'Colored Pair',
        'mixed': 'Mixed Pair'
      };
      elements.perfectPairsResult.textContent = `${typeLabels[results.perfectPairs.type]} - Won $${results.perfectPairs.payout}!`;
      elements.perfectPairsResult.className = 'sidebet-result win';
      hasResults = true;
      // Record side bet win
      stats.recordSideBetWin(results.perfectPairs.payout);
    } else {
      elements.perfectPairsResult.textContent = 'Perfect Pairs - No pair';
      elements.perfectPairsResult.className = 'sidebet-result lose';
      hasResults = true;
    }
  } else {
    elements.perfectPairsResult.textContent = '';
  }

  // 21+3 result
  if (results.twentyOnePlus3) {
    if (results.twentyOnePlus3.win) {
      const typeLabels = {
        'suited-three-of-kind': 'Suited Trips',
        'straight-flush': 'Straight Flush',
        'three-of-kind': 'Three of a Kind',
        'straight': 'Straight',
        'flush': 'Flush'
      };
      elements.twentyOnePlus3Result.textContent = `21+3: ${typeLabels[results.twentyOnePlus3.type]} - Won $${results.twentyOnePlus3.payout}!`;
      elements.twentyOnePlus3Result.className = 'sidebet-result win';
      hasResults = true;
      // Record side bet win
      stats.recordSideBetWin(results.twentyOnePlus3.payout);
    } else {
      elements.twentyOnePlus3Result.textContent = '21+3 - No hand';
      elements.twentyOnePlus3Result.className = 'sidebet-result lose';
      hasResults = true;
    }
  } else {
    elements.twentyOnePlus3Result.textContent = '';
  }

  // Lucky Ladies result (resolved after hand ends)
  if (results.luckyLadies) {
    if (results.luckyLadies.win) {
      const typeLabels = {
        'queen-hearts-pair-bj': 'Q\u2665 Pair + BJ',
        'queen-hearts-pair': 'Q\u2665 Pair',
        'matched-20': 'Matched 20',
        'suited-20': 'Suited 20',
        'any-20': 'Any 20'
      };
      elements.luckyLadiesResult.textContent = `Lucky Ladies: ${typeLabels[results.luckyLadies.type]} - Won $${results.luckyLadies.payout}!`;
      elements.luckyLadiesResult.className = 'sidebet-result win';
      hasResults = true;
      stats.recordSideBetWin(results.luckyLadies.payout);
    } else {
      elements.luckyLadiesResult.textContent = 'Lucky Ladies - No 20';
      elements.luckyLadiesResult.className = 'sidebet-result lose';
      hasResults = true;
    }
  } else {
    elements.luckyLadiesResult.textContent = '';
  }

  // Buster Blackjack result (resolved after dealer plays)
  if (results.busterBlackjack) {
    if (results.busterBlackjack.win) {
      const typeLabels = {
        '3-cards': '3-Card Bust',
        '4-cards': '4-Card Bust',
        '5-cards': '5-Card Bust',
        '6-cards': '6-Card Bust',
        '7-cards': '7-Card Bust',
        '8-plus-cards': '8+ Card Bust'
      };
      elements.busterBlackjackResult.textContent = `Buster: ${typeLabels[results.busterBlackjack.type]} - Won $${results.busterBlackjack.payout}!`;
      elements.busterBlackjackResult.className = 'sidebet-result win';
      hasResults = true;
      stats.recordSideBetWin(results.busterBlackjack.payout);
    } else {
      elements.busterBlackjackResult.textContent = 'Buster - Dealer did not bust';
      elements.busterBlackjackResult.className = 'sidebet-result lose';
      hasResults = true;
    }
  } else {
    elements.busterBlackjackResult.textContent = '';
  }

  // Royal Match result
  if (results.royalMatch) {
    if (results.royalMatch.win) {
      const typeLabels = {
        'royal-match': 'Royal Match (K-Q)',
        'suited': 'Suited Cards'
      };
      elements.royalMatchResult.textContent = `Royal Match: ${typeLabels[results.royalMatch.type]} - Won $${results.royalMatch.payout}!`;
      elements.royalMatchResult.className = 'sidebet-result win';
      hasResults = true;
      stats.recordSideBetWin(results.royalMatch.payout);
    } else {
      elements.royalMatchResult.textContent = 'Royal Match - Not suited';
      elements.royalMatchResult.className = 'sidebet-result lose';
      hasResults = true;
    }
  } else {
    elements.royalMatchResult.textContent = '';
  }

  // Super Sevens result
  if (results.superSevens) {
    if (results.superSevens.win) {
      const typeLabels = {
        'three-suited-sevens': 'Three Suited 7s',
        'three-unsuited-sevens': 'Three 7s',
        'two-suited-sevens': 'Two Suited 7s',
        'two-unsuited-sevens': 'Two 7s',
        'one-seven': 'One 7'
      };
      elements.superSevensResult.textContent = `Super 7s: ${typeLabels[results.superSevens.type]} - Won $${results.superSevens.payout}!`;
      elements.superSevensResult.className = 'sidebet-result win';
      hasResults = true;
      stats.recordSideBetWin(results.superSevens.payout);
    } else {
      elements.superSevensResult.textContent = 'Super 7s - No 7s';
      elements.superSevensResult.className = 'sidebet-result lose';
      hasResults = true;
    }
  } else {
    elements.superSevensResult.textContent = '';
  }

  if (hasResults) {
    elements.sidebetResults.classList.remove('hidden');
  } else {
    elements.sidebetResults.classList.add('hidden');
  }
}

function hit() {
  try {
    // Play button click sound
    sounds.buttonClick();

    if (state.isSplit) {
      state.game.hitSplitHand(state.game.currentSplitHandIndex);
    } else {
      state.game.hit();
    }

    const gameState = state.isSplit ? state.game.getSplitGameState() : state.game.getGameState();

    // Get the ID of the last card dealt for animation
    if (!state.isSplit && gameState.playerHand.cards.length > 0) {
      state.lastHitCardId = gameState.playerHand.cards[gameState.playerHand.cards.length - 1].id;
    }

    // Play card deal sound
    sounds.cardDeal();

    if (gameState.gameOver) {
      showResult(gameState.result);
    } else {
      render();
      // Clear hit animation flag after animation completes
      setTimeout(() => {
        state.lastHitCardId = null;
      }, 400);
    }
  } catch (e) {
    elements.message.textContent = e.message;
  }
}

function stand() {
  try {
    // Play button click sound
    sounds.buttonClick();

    if (state.isSplit) {
      state.game.standSplitHand(state.game.currentSplitHandIndex);
    } else {
      state.game.stand();
    }

    const gameState = state.isSplit ? state.game.getSplitGameState() : state.game.getGameState();

    // Trigger dealer flip animation when revealing hole card
    if (gameState.gameOver) {
      state.animateDealerFlip = true;
      sounds.cardFlip();

      // Render first to show the flip animation
      render();

      // Show result after flip animation
      setTimeout(() => {
        state.animateDealerFlip = false;
        showResult(gameState.result);
      }, 500);
    } else {
      render();
    }
  } catch (e) {
    elements.message.textContent = e.message;
  }
}

function double() {
  try {
    // Play button click and chip sounds
    sounds.buttonClick();
    sounds.chipClick();

    stats.recordDouble();
    stats.recordBet(state.currentBet); // Record the additional bet
    state.game.doubleDown();

    const gameState = state.isSplit ? state.game.getSplitGameState() : state.game.getGameState();

    // Get the ID of the last card dealt for animation
    if (state.isSplit) {
      // For split hands, find the hand that was just doubled (it will have 3 cards)
      for (const hand of gameState.splitHands) {
        if (hand.cards.length === 3) {
          state.lastHitCardId = hand.cards[2].id;
          break;
        }
      }
    } else if (gameState.playerHand.cards.length > 0) {
      state.lastHitCardId = gameState.playerHand.cards[gameState.playerHand.cards.length - 1].id;
    }

    // Play card deal sound
    sounds.cardDeal();

    if (gameState.gameOver) {
      // Trigger dealer flip animation when revealing hole card
      state.animateDealerFlip = true;
      sounds.cardFlip();

      // Render first to show animations
      render();

      setTimeout(() => {
        state.animateDealerFlip = false;
        state.lastHitCardId = null;
        showResult(gameState.result);
      }, 500);
    } else {
      render();
      setTimeout(() => {
        state.lastHitCardId = null;
      }, 400);
    }
  } catch (e) {
    elements.message.textContent = e.message;
  }
}

function split() {
  try {
    // Play button click and chip sounds
    sounds.buttonClick();
    sounds.chipClick();

    stats.recordSplit();
    stats.recordBet(state.currentBet); // Record the additional bet for split

    if (state.isSplit) {
      // Re-split
      const splitState = state.game.getSplitGameState();
      state.game.reSplit(splitState.currentHand);
    } else {
      state.game.split();
      state.isSplit = true;
    }

    // Play card sounds for split
    sounds.cardDeal();
    setTimeout(() => sounds.cardDeal(), 200);

    // Check if game is already over (happens when splitting aces - auto-resolves)
    const splitState = state.game.getSplitGameState();
    if (splitState.gameOver) {
      // Ace split auto-resolved - show results after brief delay for card animation
      elements.message.textContent = 'Split aces - one card each...';
      render();
      setTimeout(() => {
        showResult(splitState.results[0]?.result || 'push');
      }, 600);
      return;
    }

    elements.message.textContent = 'Playing split hands...';
    render();
  } catch (e) {
    elements.message.textContent = e.message;
  }
}

function surrender() {
  try {
    sounds.buttonClick();

    // Check if early surrender is available
    const gameState = state.game.getGameState();
    if (gameState.canEarlySurrender) {
      state.game.earlySurrender();
    } else {
      state.game.surrender();
    }

    const newGameState = state.game.getGameState();

    // Show surrender result
    showResult(newGameState.result);
  } catch (e) {
    elements.message.textContent = e.message;
  }
}

function takeInsurance(take) {
  try {
    // Play button click sound
    sounds.buttonClick();

    let result;

    if (take) {
      sounds.chipClick(); // Chip sound for placing insurance bet
      state.game.takeInsurance();
      result = state.game.checkDealerBlackjack();
      // Record insurance taken
      stats.recordInsurance(result.dealerHasBlackjack);
    } else {
      result = state.game.declineInsurance();
    }

    // Check if dealer had blackjack - flip card to reveal
    if (result.dealerHasBlackjack) {
      state.animateDealerFlip = true;
      sounds.cardFlip();

      if (take) {
        elements.message.textContent = 'Dealer has Blackjack! Insurance pays 2:1.';
      } else {
        elements.message.textContent = 'Dealer has Blackjack!';
      }

      // Render first to show flip animation
      render();

      setTimeout(() => {
        state.animateDealerFlip = false;
        showResult(result.result);
      }, 500);
      return;
    }

    // Dealer doesn't have blackjack - continue playing
    if (take) {
      elements.message.textContent = 'No dealer Blackjack. Insurance lost. Your turn.';
    } else {
      elements.message.textContent = 'No dealer Blackjack. Your turn.';
    }

    state.phase = 'playing';
    render();
  } catch (e) {
    elements.message.textContent = e.message;
  }
}

function newHand() {
  state.isSplit = false;
  elements.sidebetResults.classList.add('hidden');
  elements.message.classList.remove('important');

  // Check if we need to reshuffle (cut card was reached)
  if (state.game.shouldReshuffle()) {
    // Show shuffling banner
    elements.resultBanner.textContent = 'SHUFFLING...';
    elements.resultBanner.className = 'result-banner shuffle';
    elements.resultBanner.classList.remove('hidden');
    elements.message.textContent = 'Cut card reached. Reshuffling the shoe...';

    // Play shuffle sound
    sounds.shuffle();

    // Perform reshuffle after animation
    setTimeout(() => {
      state.game.reshuffle();
      elements.resultBanner.classList.add('hidden');
      proceedToNewHand();
    }, 1000);
  } else {
    elements.resultBanner.classList.add('hidden');
    proceedToNewHand();
  }
}

function proceedToNewHand() {
  state.phase = 'betting';

  // Apply betting strategy
  if (state.bettingStrategy !== 'manual') {
    state.currentBet = BettingStrategies[state.bettingStrategy].getNextBet(state, stats);
    const strategy = BettingStrategies[state.bettingStrategy];
    elements.message.textContent = `${strategy.name}: Next bet $${state.currentBet}`;
  } else {
    elements.message.textContent = 'Place your bet and click Deal!';
    // Adjust bet if needed for manual mode
    if (state.currentBet > state.game.bankroll) {
      state.currentBet = Math.max(state.minBet, state.game.bankroll);
    }
  }

  render();
}

function adjustBet(delta) {
  const step = delta > 0 ? 5 : -5;
  const newBet = state.currentBet + step;

  // Get the correct bankroll based on game mode
  let bankroll;
  if (gameMode === 'multiplayer' && mpState.game) {
    const human = mpState.game.players[mpState.humanPlayerIndex];
    bankroll = human ? human.bankroll : state.initialBankroll;
  } else if (state.game) {
    bankroll = state.game.bankroll;
  } else {
    bankroll = state.initialBankroll;
  }

  if (newBet >= state.minBet && newBet <= state.maxBet && newBet <= bankroll) {
    state.currentBet = newBet;
    sounds.chipClick();

    if (gameMode === 'multiplayer') {
      elements.betAmount.textContent = `$${state.currentBet}`;
      renderMultiplayer();
    } else {
      render();
    }
  }
}

// ============================================================================
// Multiplayer Functions
// ============================================================================

function initMultiplayerGame() {
  gameMode = 'multiplayer';

  // Start stats session for multiplayer
  stats.startSession(state.initialBankroll);

  const numPlayers = mpState.numPlayers;

  // Create the multiplayer game
  mpState.game = new MultiplayerBlackjackGame({
    numPlayers,
    numDecks: state.numDecks,
    seed: state.seed,
    initialBankroll: state.initialBankroll,
    minBet: state.minBet,
    maxBet: state.maxBet,
    variant: state.variant,
    dealerHitsSoft17: state.dealerHitsSoft17,
    allowEarlySurrender: state.allowEarlySurrender,
    allowLateSurrender: state.allowLateSurrender,
    allowResplitAces: state.resplitAces
  });

  mpState.humanPlayerIndex = mpState.game.humanPlayerIndex;

  // Create AI agents for non-human players
  mpState.aiAgents = [];
  let aiIndex = 0;
  for (let i = 0; i < numPlayers; i++) {
    if (i === mpState.humanPlayerIndex) {
      mpState.aiAgents.push(null);
    } else {
      const agent = createAIAgent(aiIndex);
      mpState.aiAgents.push(agent);
      // Update player name from personality
      mpState.game.players[i].name = agent.name;
      aiIndex++;
    }
  }

  // Switch to multiplayer UI
  switchToMultiplayerUI();

  // Start betting phase
  mpState.phase = 'betting';
  showPhaseBanner('Place Your Bets');

  // Auto-bet for AI players
  autoPlaceAIBets();

  renderMultiplayer();
}

function switchToMultiplayerUI() {
  // Hide single-player section
  elements.playerSection.classList.add('hidden');
  elements.splitHandsContainer.classList.add('hidden');

  // Show multiplayer seats (desktop) and carousel (mobile)
  // CSS media queries will control which one is actually visible
  elements.seatsContainer.classList.remove('hidden');
  elements.mobileCarousel.classList.remove('hidden');

  // Hide unused seats
  const numPlayers = mpState.numPlayers;
  elements.playerSeats.forEach((seat, i) => {
    if (i < numPlayers) {
      seat.style.display = '';
    } else {
      seat.style.display = 'none';
    }
  });

  // Update header to show "Multiplayer"
  elements.betDisplay.textContent = 'Multiplayer';
}

function switchToSinglePlayerUI() {
  // Show single-player section
  elements.playerSection.classList.remove('hidden');

  // Hide multiplayer elements
  elements.seatsContainer.classList.add('hidden');
  elements.mobileCarousel.classList.add('hidden');
  elements.phaseBanner.classList.add('hidden');
}

function showPhaseBanner(text) {
  elements.phaseText.textContent = text;
  elements.phaseBanner.classList.remove('hidden');
}

function hidePhaseBanner() {
  elements.phaseBanner.classList.add('hidden');
}

function autoPlaceAIBets() {
  const gameState = mpState.game.getGameState();

  for (let i = 0; i < gameState.players.length; i++) {
    const player = gameState.players[i];
    if (player.type === 'ai' && mpState.aiAgents[i]) {
      const agent = mpState.aiAgents[i];
      const bet = agent.getBetAmount(player.bankroll, mpState.game.minBet, mpState.game.maxBet);
      if (bet > 0 && bet <= player.bankroll) {
        mpState.game.setPlayerBet(i, bet);
      }
    }
  }
}

function renderMultiplayer() {
  const gameState = mpState.game.getGameState();

  // Update each seat
  gameState.players.forEach((player, i) => {
    renderPlayerSeat(i, player, gameState);
  });

  // Update dealer (reuse existing dealer rendering)
  renderDealerHandMP(gameState.dealer);

  // Update bankroll display for human player
  const human = gameState.players[mpState.humanPlayerIndex];
  elements.bankrollDisplay.textContent = `$${human.bankroll}`;

  // Update deck count
  if (elements.deckCountLabel) {
    elements.deckCountLabel.textContent = gameState.deckCount;
  }

  // Update card count display
  updateCardCountDisplay(gameState);

  // Update controls
  updateMultiplayerControls();

  // Update mobile carousel if visible
  if (window.innerWidth <= 768) {
    renderMobileCarousel(gameState);
  }
}

function renderPlayerSeat(index, player, gameState) {
  const seat = elements.playerSeats[index];
  if (!seat) return;

  const isHuman = index === mpState.humanPlayerIndex;
  const isActive = (index === gameState.activePlayerIndex && mpState.phase === 'player-turns') ||
                   (index === gameState.insurancePlayerIndex && mpState.phase === 'insurance');

  // Update classes
  seat.classList.toggle('active', isActive);
  seat.classList.toggle('human', isHuman);

  // Update name and badge
  const nameEl = seat.querySelector('.seat-name');
  const badgeEl = seat.querySelector('.seat-badge');
  if (nameEl) nameEl.textContent = player.name;
  if (badgeEl) {
    badgeEl.textContent = isHuman ? 'YOU' : 'AI';
    badgeEl.classList.toggle('you', isHuman);
  }

  // Update bankroll and bet
  const bankrollEl = seat.querySelector('.seat-bankroll');
  const betEl = seat.querySelector('.seat-bet');
  if (bankrollEl) bankrollEl.textContent = `$${player.bankroll}`;
  if (betEl) {
    let betText = player.currentBet > 0 ? `Bet: $${player.currentBet}` : 'No bet';
    if (player.insuranceBet > 0) {
      betText += ` (Ins: $${player.insuranceBet})`;
    }
    // Show side bets if any
    const sideBetTotal = Object.values(player.sideBets || {}).reduce((sum, b) => sum + b, 0);
    if (sideBetTotal > 0) {
      betText += ` +$${sideBetTotal} sides`;
    }
    betEl.textContent = betText;
  }

  // Update side bet results display
  const sideBetResultsEl = seat.querySelector('.seat-sidebets');
  if (sideBetResultsEl) {
    sideBetResultsEl.innerHTML = '';
    if (player.sideBetResults) {
      const results = player.sideBetResults;
      const resultItems = [];

      if (results.perfectPairs) {
        if (results.perfectPairs.won) {
          resultItems.push(`<span class="sidebet-win">PP: +$${Math.floor(results.perfectPairs.payout)}</span>`);
        } else if (player.sideBets?.perfectPairs > 0) {
          resultItems.push(`<span class="sidebet-lose">PP: Lost</span>`);
        }
      }
      if (results.twentyOnePlus3) {
        if (results.twentyOnePlus3.won) {
          resultItems.push(`<span class="sidebet-win">21+3: +$${Math.floor(results.twentyOnePlus3.payout)}</span>`);
        } else if (player.sideBets?.twentyOnePlus3 > 0) {
          resultItems.push(`<span class="sidebet-lose">21+3: Lost</span>`);
        }
      }
      if (results.luckyLadies) {
        if (results.luckyLadies.won) {
          resultItems.push(`<span class="sidebet-win">LL: +$${Math.floor(results.luckyLadies.payout)}</span>`);
        } else if (player.sideBets?.luckyLadies > 0) {
          resultItems.push(`<span class="sidebet-lose">LL: Lost</span>`);
        }
      }
      if (results.busterBlackjack) {
        if (results.busterBlackjack.won) {
          resultItems.push(`<span class="sidebet-win">BB: +$${Math.floor(results.busterBlackjack.payout)}</span>`);
        } else if (player.sideBets?.busterBlackjack > 0) {
          resultItems.push(`<span class="sidebet-lose">BB: Lost</span>`);
        }
      }

      if (resultItems.length > 0) {
        sideBetResultsEl.innerHTML = resultItems.join(' ');
      }
    }
  }

  // Update hand - handle split hands
  const handEl = seat.querySelector('.seat-hand');
  const valueEl = seat.querySelector('.seat-value');

  if (handEl) {
    handEl.innerHTML = '';

    if (player.splitHands && player.splitHands.length > 0) {
      // Render split hands
      player.splitHands.forEach((splitHand, idx) => {
        const splitDiv = document.createElement('div');
        splitDiv.className = 'seat-split-hand';
        if (splitHand.active) {
          splitDiv.classList.add('active');
        }
        if (splitHand.busted) {
          splitDiv.classList.add('busted');
        }

        // Cards for this split hand
        const cardsDiv = document.createElement('div');
        cardsDiv.className = 'seat-split-cards';
        splitHand.cards.forEach(card => {
          const cardEl = createCardElement(card);
          cardEl.classList.add('mini-card');
          cardsDiv.appendChild(cardEl);
        });
        splitDiv.appendChild(cardsDiv);

        // Value for this split hand
        const valSpan = document.createElement('span');
        valSpan.className = 'seat-split-value';
        valSpan.textContent = splitHand.value;
        if (splitHand.busted) valSpan.classList.add('busted');
        if (splitHand.blackjack) valSpan.classList.add('blackjack');
        splitDiv.appendChild(valSpan);

        handEl.appendChild(splitDiv);
      });

      // Hide main value element when showing split hands
      if (valueEl) {
        valueEl.textContent = '';
        valueEl.classList.remove('blackjack', 'busted');
      }
    } else if (player.hand.cards.length > 0) {
      // Render regular hand
      player.hand.cards.forEach(card => {
        const cardEl = createCardElement(card);
        cardEl.classList.add('mini-card');
        handEl.appendChild(cardEl);
      });

      // Update value
      if (valueEl) {
        valueEl.textContent = player.hand.value;
        valueEl.classList.toggle('blackjack', player.hand.blackjack);
        valueEl.classList.toggle('busted', player.hand.busted);
      }
    } else {
      // No cards
      if (valueEl) {
        valueEl.textContent = '';
        valueEl.classList.remove('blackjack', 'busted');
      }
    }
  }

  // Update status
  const statusEl = seat.querySelector('.seat-status');
  if (statusEl) {
    let statusText = '';
    let statusClass = '';

    if (mpState.phase === 'results' && player.result) {
      if (typeof player.result === 'string') {
        if (player.result === 'player' || player.result === 'player-blackjack') {
          statusText = `Won $${player.payout}`;
          statusClass = 'won';
        } else if (player.result === 'dealer') {
          statusText = 'Lost';
          statusClass = 'lost';
        } else if (player.result === 'push') {
          statusText = 'Push';
          statusClass = 'push';
        }
      }
    } else if (player.status === 'busted') {
      statusText = 'Busted';
      statusClass = 'lost';
    } else if (player.status === 'blackjack') {
      statusText = 'Blackjack!';
      statusClass = 'won';
    } else if (player.status === 'stood') {
      statusText = 'Stand';
    } else if (isActive) {
      statusText = 'Playing...';
    }

    statusEl.textContent = statusText;
    statusEl.className = 'seat-status ' + statusClass;
  }
}

function renderDealerHandMP(dealer) {
  elements.dealerHand.innerHTML = '';

  dealer.visibleCards.forEach((card, i) => {
    const cardEl = createCardElement(card);
    elements.dealerHand.appendChild(cardEl);
  });

  // Show hidden card indicator if needed
  if (dealer.cards.length > dealer.visibleCards.length) {
    const hiddenEl = document.createElement('div');
    hiddenEl.className = 'card card-back';
    elements.dealerHand.insertBefore(hiddenEl, elements.dealerHand.firstChild);
  }

  // Update dealer value
  if (dealer.value !== null) {
    elements.dealerValue.textContent = dealer.value;
    elements.dealerValue.classList.toggle('busted', dealer.busted);
    elements.dealerValue.classList.toggle('blackjack', dealer.blackjack);
  } else if (dealer.visibleValue) {
    elements.dealerValue.textContent = dealer.visibleValue;
    elements.dealerValue.classList.remove('busted', 'blackjack');
  } else {
    elements.dealerValue.textContent = '';
  }
}

function updateMultiplayerControls() {
  const gameState = mpState.game.getGameState();
  const isHumanTurn = gameState.isHumanTurn;

  // Hide insurance, early surrender, and side bets by default
  elements.insuranceControls.classList.add('hidden');
  if (elements.earlySurrenderControls) {
    elements.earlySurrenderControls.classList.add('hidden');
  }
  if (elements.sideBetsWrapper) {
    elements.sideBetsWrapper.classList.add('hidden');
  }

  if (mpState.phase === 'betting') {
    // Show betting controls
    elements.bettingControls.classList.remove('hidden');
    elements.playingControls.classList.add('hidden');
    elements.resultControls.classList.add('hidden');

    // Show side bets wrapper during betting phase
    if (elements.sideBetsWrapper) {
      elements.sideBetsWrapper.classList.remove('hidden');
    }

    // Update bet amount display
    const human = gameState.players[mpState.humanPlayerIndex];
    elements.betAmount.textContent = `$${state.currentBet}`;

    // Enable deal button if human has placed bet
    elements.dealBtn.disabled = false;
    elements.dealBtn.textContent = 'Place Bet & Deal';

  } else if (mpState.phase === 'early-surrender') {
    // Early surrender phase - show early surrender controls for human
    elements.bettingControls.classList.add('hidden');
    elements.playingControls.classList.add('hidden');
    elements.resultControls.classList.add('hidden');

    if (gameState.isHumanEarlySurrenderTurn && elements.earlySurrenderControls) {
      elements.earlySurrenderControls.classList.remove('hidden');
    }

  } else if (mpState.phase === 'insurance') {
    // Insurance phase - show insurance controls for human
    elements.bettingControls.classList.add('hidden');
    elements.playingControls.classList.add('hidden');
    elements.resultControls.classList.add('hidden');

    if (gameState.isHumanInsuranceTurn) {
      elements.insuranceControls.classList.remove('hidden');
    }

  } else if (mpState.phase === 'player-turns' && isHumanTurn) {
    // Show playing controls for human
    elements.bettingControls.classList.add('hidden');
    elements.playingControls.classList.remove('hidden');
    elements.resultControls.classList.add('hidden');

    // Update button states based on available actions
    const actions = mpState.game.getAvailableActions(mpState.humanPlayerIndex);
    elements.hitBtn.disabled = !actions.includes('hit');
    elements.standBtn.disabled = !actions.includes('stand');
    elements.doubleBtn.disabled = !actions.includes('double');
    elements.splitBtn.disabled = !actions.includes('split');

    // Show surrender button if available
    if (actions.includes('surrender')) {
      elements.surrenderBtn.classList.remove('hidden');
      elements.surrenderBtn.disabled = false;
    } else {
      elements.surrenderBtn.classList.add('hidden');
    }

  } else if (mpState.phase === 'player-turns') {
    // AI is playing - disable all controls
    elements.bettingControls.classList.add('hidden');
    elements.playingControls.classList.remove('hidden');
    elements.resultControls.classList.add('hidden');

    elements.hitBtn.disabled = true;
    elements.standBtn.disabled = true;
    elements.doubleBtn.disabled = true;
    elements.splitBtn.disabled = true;

  } else if (mpState.phase === 'results') {
    // Show result controls
    elements.bettingControls.classList.add('hidden');
    elements.playingControls.classList.add('hidden');
    elements.resultControls.classList.remove('hidden');
  }
}

function renderMobileCarousel(gameState) {
  if (!elements.carouselTrack || !elements.carouselDots) return;

  // Clear existing
  elements.carouselTrack.innerHTML = '';
  elements.carouselDots.innerHTML = '';

  gameState.players.forEach((player, i) => {
    const isHuman = i === mpState.humanPlayerIndex;
    const isActive = (i === gameState.activePlayerIndex && mpState.phase === 'player-turns') ||
                     (i === gameState.insurancePlayerIndex && mpState.phase === 'insurance');

    // Build bet text with insurance and side bet info
    let betText = player.currentBet > 0 ? `Bet: $${player.currentBet}` : 'No bet';
    if (player.insuranceBet > 0) {
      betText += ` (Ins: $${player.insuranceBet})`;
    }
    const sideBetTotal = Object.values(player.sideBets || {}).reduce((sum, b) => sum + b, 0);
    if (sideBetTotal > 0) {
      betText += ` +$${sideBetTotal} sides`;
    }

    // Build side bet results HTML
    let sideBetsHtml = '';
    if (player.sideBetResults) {
      const results = player.sideBetResults;
      const items = [];
      if (results.perfectPairs?.won) {
        items.push(`<span class="sidebet-win">PP: +$${Math.floor(results.perfectPairs.payout)}</span>`);
      } else if (player.sideBets?.perfectPairs > 0 && results.perfectPairs) {
        items.push(`<span class="sidebet-lose">PP: Lost</span>`);
      }
      if (results.twentyOnePlus3?.won) {
        items.push(`<span class="sidebet-win">21+3: +$${Math.floor(results.twentyOnePlus3.payout)}</span>`);
      } else if (player.sideBets?.twentyOnePlus3 > 0 && results.twentyOnePlus3) {
        items.push(`<span class="sidebet-lose">21+3: Lost</span>`);
      }
      if (results.luckyLadies?.won) {
        items.push(`<span class="sidebet-win">LL: +$${Math.floor(results.luckyLadies.payout)}</span>`);
      } else if (player.sideBets?.luckyLadies > 0 && results.luckyLadies) {
        items.push(`<span class="sidebet-lose">LL: Lost</span>`);
      }
      if (results.busterBlackjack?.won) {
        items.push(`<span class="sidebet-win">BB: +$${Math.floor(results.busterBlackjack.payout)}</span>`);
      } else if (player.sideBets?.busterBlackjack > 0 && results.busterBlackjack) {
        items.push(`<span class="sidebet-lose">BB: Lost</span>`);
      }
      if (items.length > 0) {
        sideBetsHtml = items.join(' ');
      }
    }

    // Create carousel card
    const card = document.createElement('div');
    card.className = 'carousel-card';
    if (isHuman) card.classList.add('human');
    if (isActive) card.classList.add('active');

    // Determine if we show split hands or regular hand
    const hasSplitHands = player.splitHands && player.splitHands.length > 0;
    const valueDisplay = hasSplitHands ? '' : (player.hand.value || '');
    const valueClasses = hasSplitHands ? '' : `${player.hand.blackjack ? 'blackjack' : ''} ${player.hand.busted ? 'busted' : ''}`;

    card.innerHTML = `
      <div class="seat-header">
        <span class="seat-name">${player.name}</span>
        <span class="seat-badge ${isHuman ? 'you' : ''}">${isHuman ? 'YOU' : 'AI'}</span>
      </div>
      <div class="seat-bankroll">$${player.bankroll}</div>
      <div class="seat-bet">${betText}</div>
      <div class="seat-hand"></div>
      <div class="seat-value ${valueClasses}">${valueDisplay}</div>
      <div class="seat-sidebets">${sideBetsHtml}</div>
    `;

    // Add cards to hand - handle split hands
    const handEl = card.querySelector('.seat-hand');
    if (hasSplitHands) {
      player.splitHands.forEach((splitHand, idx) => {
        const splitDiv = document.createElement('div');
        splitDiv.className = 'seat-split-hand';
        if (splitHand.active) splitDiv.classList.add('active');
        if (splitHand.busted) splitDiv.classList.add('busted');

        const cardsDiv = document.createElement('div');
        cardsDiv.className = 'seat-split-cards';
        splitHand.cards.forEach(cardData => {
          const cardEl = createCardElement(cardData);
          cardEl.classList.add('mini-card');
          cardsDiv.appendChild(cardEl);
        });
        splitDiv.appendChild(cardsDiv);

        const valSpan = document.createElement('span');
        valSpan.className = 'seat-split-value';
        valSpan.textContent = splitHand.value;
        if (splitHand.busted) valSpan.classList.add('busted');
        if (splitHand.blackjack) valSpan.classList.add('blackjack');
        splitDiv.appendChild(valSpan);

        handEl.appendChild(splitDiv);
      });
    } else {
      player.hand.cards.forEach(cardData => {
        const cardEl = createCardElement(cardData);
        handEl.appendChild(cardEl);
      });
    }

    elements.carouselTrack.appendChild(card);

    // Create dot
    const dot = document.createElement('div');
    dot.className = 'carousel-dot';
    if (isHuman) dot.classList.add('human');
    if (isActive) dot.classList.add('active');
    dot.addEventListener('click', () => scrollToCarouselCard(i));
    elements.carouselDots.appendChild(dot);
  });

  // Scroll to active player
  if (gameState.activePlayerIndex >= 0) {
    scrollToCarouselCard(gameState.activePlayerIndex);
  }
}

function scrollToCarouselCard(index) {
  const cards = elements.carouselTrack.querySelectorAll('.carousel-card');
  if (cards[index]) {
    cards[index].scrollIntoView({ behavior: 'smooth', inline: 'center' });
  }
}

// Multiplayer game flow
async function startMultiplayerRound() {
  mpState.phase = 'betting';
  showPhaseBanner('Place Your Bets');

  // Auto-bet for AI
  autoPlaceAIBets();

  renderMultiplayer();
}

async function multiplayerDeal() {
  if (!mpState.game) return;

  // Place human bet
  const human = mpState.game.players[mpState.humanPlayerIndex];
  if (human.currentBet === 0) {
    mpState.game.setPlayerBet(mpState.humanPlayerIndex, state.currentBet);
  }

  // Record main bet in stats
  stats.recordBet(state.currentBet);

  // Transfer human's side bets from global state to multiplayer game
  const humanIdx = mpState.humanPlayerIndex;
  if (state.perfectPairsEnabled && state.perfectPairsBet > 0) {
    try {
      mpState.game.setPlayerSideBet(humanIdx, 'perfectPairs', state.perfectPairsBet);
      stats.recordSideBet(state.perfectPairsBet);
    } catch (e) { console.warn('Could not place Perfect Pairs bet:', e.message); }
  }
  if (state.twentyOnePlus3Enabled && state.twentyOnePlus3Bet > 0) {
    try {
      mpState.game.setPlayerSideBet(humanIdx, 'twentyOnePlus3', state.twentyOnePlus3Bet);
      stats.recordSideBet(state.twentyOnePlus3Bet);
    } catch (e) { console.warn('Could not place 21+3 bet:', e.message); }
  }
  if (state.luckyLadiesEnabled && state.luckyLadiesBet > 0) {
    try {
      mpState.game.setPlayerSideBet(humanIdx, 'luckyLadies', state.luckyLadiesBet);
      stats.recordSideBet(state.luckyLadiesBet);
    } catch (e) { console.warn('Could not place Lucky Ladies bet:', e.message); }
  }
  if (state.busterBlackjackEnabled && state.busterBlackjackBet > 0) {
    try {
      mpState.game.setPlayerSideBet(humanIdx, 'busterBlackjack', state.busterBlackjackBet);
      stats.recordSideBet(state.busterBlackjackBet);
    } catch (e) { console.warn('Could not place Buster Blackjack bet:', e.message); }
  }

  // Deal cards
  const gameState = mpState.game.deal();

  sounds.cardDeal();
  hidePhaseBanner();
  renderMultiplayer();

  // Wait a moment
  await delay(500);

  // Check if early surrender is offered (before dealer blackjack check)
  if (gameState.phase === 'early-surrender') {
    mpState.phase = 'early-surrender';
    await handleMultiplayerEarlySurrender();
  } else if (gameState.phase === 'insurance') {
    mpState.phase = 'insurance';
    await handleMultiplayerInsurance();
  } else if (gameState.phase === 'player-turns') {
    mpState.phase = 'player-turns';
    // Start player turns
    await playAllPlayerTurns();
  } else if (gameState.phase === 'results') {
    // All players have blackjack or surrendered
    mpState.phase = 'results';
    showMultiplayerResults();
  }
}

async function handleMultiplayerEarlySurrender() {
  showPhaseBanner('Early Surrender?');
  renderMultiplayer();

  // Process each player's early surrender decision
  while (mpState.game.phase === 'early-surrender') {
    const gameState = mpState.game.getGameState();
    const playerIndex = gameState.earlySurrenderPlayerIndex;

    if (playerIndex < 0) break;

    const player = mpState.game.players[playerIndex];

    if (player.type === 'ai') {
      // AI uses basic strategy - generally decline early surrender
      // (Early surrender is very favorable, AI might take it vs 10/A)
      const dealerUpCard = mpState.game.getDealerUpCard();
      const dealerValue = dealerUpCard?.meta?.value?.[0] || 10;
      const playerState = mpState.game.getPlayerState(playerIndex);
      const playerValue = playerState.hand.value;

      // Basic strategy: early surrender 16 vs 10/A, 15 vs 10
      let shouldSurrender = false;
      if (playerValue === 16 && (dealerValue === 10 || dealerUpCard?.meta?.rank === 'A')) {
        shouldSurrender = true;
      } else if (playerValue === 15 && dealerValue === 10) {
        shouldSurrender = true;
      }

      await delay(400);
      if (shouldSurrender) {
        mpState.game.takeEarlySurrender(playerIndex);
      } else {
        mpState.game.declineEarlySurrender(playerIndex);
      }
      renderMultiplayer();
    } else {
      // Human turn - show early surrender controls and wait
      showPhaseBanner('Early Surrender?');
      renderMultiplayer();
      return; // Exit and wait for human input
    }
  }

  // Early surrender phase complete - continue to next phase
  await finishEarlySurrenderPhase();
}

async function finishEarlySurrenderPhase() {
  const gameState = mpState.game.getGameState();

  hidePhaseBanner();

  // Check next phase
  if (gameState.phase === 'insurance') {
    mpState.phase = 'insurance';
    await handleMultiplayerInsurance();
  } else if (gameState.phase === 'player-turns') {
    mpState.phase = 'player-turns';
    await playAllPlayerTurns();
  } else if (gameState.phase === 'results') {
    mpState.phase = 'results';
    showMultiplayerResults();
  }
}

async function handleMultiplayerInsurance() {
  showPhaseBanner('Insurance?');
  renderMultiplayer();

  // Process each player's insurance decision
  while (mpState.game.phase === 'insurance') {
    const gameState = mpState.game.getGameState();
    const playerIndex = gameState.insurancePlayerIndex;

    if (playerIndex < 0) break;

    const player = mpState.game.players[playerIndex];

    if (player.type === 'ai') {
      // AI always declines insurance (basic strategy)
      await delay(400);
      mpState.game.declineInsurance(playerIndex);
      renderMultiplayer();
    } else {
      // Human turn - show insurance controls and wait
      showPhaseBanner('Insurance?');
      renderMultiplayer();
      return; // Exit and wait for human input
    }
  }

  // Insurance phase complete - check result
  await finishInsurancePhase();
}

async function finishInsurancePhase() {
  const gameState = mpState.game.getGameState();
  const dealerHasBlackjack = gameState.phase === 'results';

  // Record insurance stats for human if they took insurance
  const humanPlayer = mpState.game.players[mpState.humanPlayerIndex];
  if (humanPlayer.insuranceDecision === true) {
    stats.recordInsurance(dealerHasBlackjack);
  }

  // Check if dealer had blackjack - if phase is 'results', dealer had blackjack
  if (dealerHasBlackjack) {
    // Dealer has blackjack - show result
    sounds.cardFlip();
    showPhaseBanner('Dealer Blackjack!');
    mpState.phase = 'results';
    renderMultiplayer();
    await delay(2000);
    showMultiplayerResults();
  } else {
    // No dealer blackjack - continue to player turns
    hidePhaseBanner();
    mpState.phase = 'player-turns';
    renderMultiplayer();
    await delay(500);
    await playAllPlayerTurns();
  }
}

function multiplayerTakeInsurance() {
  if (mpState.game.phase !== 'insurance') return;

  const humanIndex = mpState.humanPlayerIndex;
  sounds.chipClick();
  const result = mpState.game.takeInsurance(humanIndex);
  renderMultiplayer();

  // Continue insurance phase
  continueInsurancePhase();
}

function multiplayerDeclineInsurance() {
  if (mpState.game.phase !== 'insurance') return;

  const humanIndex = mpState.humanPlayerIndex;
  mpState.game.declineInsurance(humanIndex);
  renderMultiplayer();

  // Continue insurance phase
  continueInsurancePhase();
}

async function continueInsurancePhase() {
  // Check if more players need to decide
  const gameState = mpState.game.getGameState();

  if (gameState.phase === 'insurance') {
    // Continue with AI decisions
    await handleMultiplayerInsurance();
  } else {
    // Insurance resolved
    await finishInsurancePhase();
  }
}

async function playAllPlayerTurns() {
  const gameState = mpState.game.getGameState();

  while (mpState.game.activePlayerIndex >= 0) {
    const playerIndex = mpState.game.activePlayerIndex;
    const player = mpState.game.players[playerIndex];

    // Skip players who are already done
    if (player.status !== 'playing') {
      mpState.game.nextPlayerTurn();
      continue;
    }

    showPhaseBanner(`${player.name}'s Turn`);
    renderMultiplayer();

    if (player.type === 'ai') {
      await playAITurn(playerIndex);
    } else {
      // Human turn - wait for input
      hidePhaseBanner();
      renderMultiplayer();
      return; // Exit and wait for human action
    }
  }

  // All players done - dealer's turn
  await playDealerTurn();
}

async function playAITurn(playerIndex) {
  const agent = mpState.aiAgents[playerIndex];
  if (!agent) return;

  await delay(mpState.aiTurnDelay);

  while (mpState.game.canPlayerAct(playerIndex)) {
    const gameState = mpState.game.getGameState();
    const player = gameState.players[playerIndex];
    const dealerUpCard = mpState.game.getDealerUpCard();
    const availableActions = mpState.game.getAvailableActions(playerIndex);

    const action = agent.decide(player, dealerUpCard, availableActions);

    // Execute action and check for bust immediately after
    // (status may change to 'done' if AI is last player and game resolves)
    let didBust = false;

    switch (action) {
      case 'hit':
        mpState.game.hit(playerIndex);
        sounds.cardDeal();
        // Check bust immediately
        const hitPlayerState = mpState.game.getPlayerState(playerIndex);
        didBust = hitPlayerState.hand.busted;
        break;
      case 'stand':
        mpState.game.stand(playerIndex);
        break;
      case 'double':
        mpState.game.doubleDown(playerIndex);
        sounds.cardDeal();
        // Check bust immediately
        const doublePlayerState = mpState.game.getPlayerState(playerIndex);
        didBust = doublePlayerState.hand.busted;
        break;
      case 'split':
        mpState.game.split(playerIndex);
        sounds.chipClick();
        break;
      case 'surrender':
        mpState.game.surrender(playerIndex);
        sounds.lose();
        break;
    }

    renderMultiplayer();

    if (didBust) {
      sounds.bust();
    }

    await delay(mpState.aiTurnDelay);

    // Exit loop if game has already resolved (AI was last player)
    if (mpState.game.phase !== 'player-turns') {
      break;
    }
  }

  // Advance to next player only if still in player-turns phase
  if (mpState.game.phase === 'player-turns' && mpState.game.activePlayerIndex === playerIndex) {
    mpState.game.nextPlayerTurn();
  }
}

async function playDealerTurn() {
  mpState.phase = 'dealer';
  showPhaseBanner("Dealer's Turn");
  renderMultiplayer();

  await delay(500);

  // Dealer plays automatically in the game engine
  // Just need to update display
  mpState.phase = 'results';

  const gameState = mpState.game.getGameState();
  renderDealerHandMP(gameState.dealer);

  // Update AI agents with results
  gameState.players.forEach((player, i) => {
    if (mpState.aiAgents[i]) {
      mpState.aiAgents[i].updateResult(player.result);
    }
  });

  await delay(500);

  // Show results
  showMultiplayerResults();
}

function showMultiplayerResults() {
  hidePhaseBanner();
  mpState.phase = 'results';

  const gameState = mpState.game.getGameState();
  const human = gameState.players[mpState.humanPlayerIndex];

  // Show result banner for human
  let resultText = '';
  let resultClass = '';

  if (typeof human.result === 'string') {
    if (human.result === 'player-blackjack') {
      resultText = 'BLACKJACK!';
      resultClass = 'blackjack';
      sounds.blackjack();
    } else if (human.result === 'player') {
      resultText = 'YOU WIN!';
      resultClass = 'win';
      sounds.win();
    } else if (human.result === 'dealer') {
      resultText = 'YOU LOSE';
      resultClass = 'lose';
      sounds.lose();
    } else if (human.result === 'push') {
      resultText = 'PUSH';
      resultClass = 'push';
    } else if (human.result === 'surrender') {
      resultText = 'SURRENDERED';
      resultClass = 'lose';
    }
  }

  if (resultText) {
    elements.resultBanner.textContent = resultText;
    elements.resultBanner.className = `result-banner ${resultClass}`;
    elements.resultBanner.classList.remove('hidden');
  }

  // Calculate side bet winnings
  let sideBetWinnings = 0;
  let sideBetMessages = [];
  if (human.sideBetResults) {
    const sbr = human.sideBetResults;
    if (sbr.perfectPairs?.won) {
      sideBetWinnings += sbr.perfectPairs.payout;
      sideBetMessages.push(`PP +$${Math.floor(sbr.perfectPairs.payout)}`);
    }
    if (sbr.twentyOnePlus3?.won) {
      sideBetWinnings += sbr.twentyOnePlus3.payout;
      sideBetMessages.push(`21+3 +$${Math.floor(sbr.twentyOnePlus3.payout)}`);
    }
    if (sbr.luckyLadies?.won) {
      sideBetWinnings += sbr.luckyLadies.payout;
      sideBetMessages.push(`LL +$${Math.floor(sbr.luckyLadies.payout)}`);
    }
    if (sbr.busterBlackjack?.won) {
      sideBetWinnings += sbr.busterBlackjack.payout;
      sideBetMessages.push(`BB +$${Math.floor(sbr.busterBlackjack.payout)}`);
    }
  }

  // Update message
  let message = '';
  if (human.payout > 0 && human.result !== 'surrender') {
    message = `You won $${human.payout}!`;
  } else if (human.result === 'push') {
    message = 'Push - bet returned.';
  } else if (human.result === 'surrender') {
    message = `Surrendered - half bet ($${human.payout}) returned.`;
  } else {
    message = 'Better luck next time!';
  }

  // Add side bet results to message
  if (sideBetMessages.length > 0) {
    message += ' Side bets: ' + sideBetMessages.join(', ');
  }

  elements.message.textContent = message;

  // Record stats for human player
  const humanPlayerData = mpState.game.players[mpState.humanPlayerIndex];

  if (Array.isArray(human.result)) {
    // Split hands - record each split hand result
    for (let i = 0; i < human.result.length; i++) {
      const splitResult = human.result[i];
      const splitBet = humanPlayerData.splitBets[i] || state.currentBet;

      // Map result values: player/player-blackjack → agent/agent-blackjack
      let mappedResult = splitResult;
      if (splitResult === 'player') mappedResult = 'agent';
      if (splitResult === 'player-blackjack') mappedResult = 'agent-blackjack';

      // Calculate payout for this split hand
      let splitPayout = 0;
      if (splitResult === 'player-blackjack') {
        splitPayout = splitBet + (splitBet * 1.5);
      } else if (splitResult === 'player') {
        splitPayout = splitBet * 2;
      } else if (splitResult === 'push') {
        splitPayout = splitBet;
      }

      stats.recordHandResult(mappedResult, splitBet, splitPayout, humanPlayerData.bankroll);
    }
  } else if (human.result) {
    // Single hand result
    // Map result values
    let mappedResult = human.result;
    if (human.result === 'player') mappedResult = 'agent';
    if (human.result === 'player-blackjack') mappedResult = 'agent-blackjack';
    if (human.result === 'surrender') mappedResult = 'dealer'; // Count surrender as loss

    stats.recordHandResult(mappedResult, state.currentBet, human.payout, humanPlayerData.bankroll);
  }

  // Record side bet wins
  if (human.sideBetResults) {
    const sbr = human.sideBetResults;
    if (sbr.perfectPairs?.won) stats.recordSideBetWin(sbr.perfectPairs.payout);
    if (sbr.twentyOnePlus3?.won) stats.recordSideBetWin(sbr.twentyOnePlus3.payout);
    if (sbr.luckyLadies?.won) stats.recordSideBetWin(sbr.luckyLadies.payout);
    if (sbr.busterBlackjack?.won) stats.recordSideBetWin(sbr.busterBlackjack.payout);
    if (sbr.royalMatch?.won) stats.recordSideBetWin(sbr.royalMatch.payout);
    if (sbr.superSevens?.won) stats.recordSideBetWin(sbr.superSevens.payout);
  }

  renderMultiplayer();
}

function multiplayerNewRound() {
  elements.resultBanner.classList.add('hidden');

  // Check for reshuffle
  if (mpState.game.shouldReshuffle()) {
    elements.resultBanner.textContent = 'SHUFFLING...';
    elements.resultBanner.className = 'result-banner shuffle';
    elements.resultBanner.classList.remove('hidden');
    sounds.shuffle();

    setTimeout(() => {
      mpState.game.reshuffle();
      elements.resultBanner.classList.add('hidden');
      mpState.game.newRound();
      startMultiplayerRound();
    }, 1000);
  } else {
    mpState.game.newRound();
    startMultiplayerRound();
  }
}

// Human multiplayer actions
function multiplayerHit() {
  if (!mpState.game.isHumanTurn()) return;

  mpState.game.hit(mpState.humanPlayerIndex);

  // Check if player busted IMMEDIATELY after hit
  // (status may already be 'done' if human was last player and game resolved)
  const player = mpState.game.players[mpState.humanPlayerIndex];
  const playerState = mpState.game.getPlayerState(mpState.humanPlayerIndex);
  const didBust = player.status === 'busted' || (player.status === 'done' && playerState.hand.busted);

  sounds.cardDeal();
  renderMultiplayer();

  if (didBust) {
    sounds.bust();
  }

  // Check if turn is over (game engine may have already advanced)
  if (!mpState.game.canPlayerAct(mpState.humanPlayerIndex)) {
    // Only call nextPlayerTurn if game hasn't already processed it
    if (mpState.game.phase === 'player-turns') {
      mpState.game.nextPlayerTurn();
    }
    continueAfterHumanTurn();
  }
}

function multiplayerStand() {
  if (!mpState.game.isHumanTurn()) return;

  mpState.game.stand(mpState.humanPlayerIndex);
  renderMultiplayer();
  continueAfterHumanTurn();
}

function multiplayerDouble() {
  if (!mpState.game.isHumanTurn()) return;

  // Record stats before doubling
  stats.recordDouble();
  stats.recordBet(state.currentBet); // Record the additional bet

  mpState.game.doubleDown(mpState.humanPlayerIndex);

  // Check if player busted IMMEDIATELY after double
  // (status may already be 'done' if human was last player and game resolved)
  const player = mpState.game.players[mpState.humanPlayerIndex];
  const playerState = mpState.game.getPlayerState(mpState.humanPlayerIndex);
  const didBust = player.status === 'busted' || (player.status === 'done' && playerState.hand.busted);

  sounds.cardDeal();
  renderMultiplayer();

  if (didBust) {
    sounds.bust();
  }

  continueAfterHumanTurn();
}

function multiplayerSplit() {
  if (!mpState.game.isHumanTurn()) return;

  mpState.game.split(mpState.humanPlayerIndex);
  sounds.chipClick();

  // Record split in stats
  stats.recordSplit();
  stats.recordBet(state.currentBet); // Splitting requires additional bet

  renderMultiplayer();
}

function multiplayerSurrender() {
  if (!mpState.game.isHumanTurn()) return;
  if (!mpState.game.canSurrender(mpState.humanPlayerIndex)) return;

  mpState.game.surrender(mpState.humanPlayerIndex);
  sounds.lose();
  renderMultiplayer();
  continueAfterHumanTurn();
}

async function continueAfterHumanTurn() {
  // Continue with remaining players
  await delay(300);
  await playAllPlayerTurns();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Event Listeners
// ============================================================================

function setupEventListeners() {
  // Start screen
  elements.startGame.addEventListener('click', () => {
    // Unlock audio on first user interaction (Chrome autoplay policy)
    sounds.unlock();

    state.initialBankroll = parseInt(elements.startingBankroll.value);
    state.variant = elements.variantSelect.value;
    state.numDecks = parseInt(elements.numDecksSelect.value);
    state.bettingStrategy = elements.strategySelect.value;
    // Parse seed - null if empty, otherwise the number
    const seedValue = elements.seedInput.value.trim();
    state.seed = seedValue ? parseInt(seedValue) : null;
    // House rules
    state.dealerHitsSoft17 = elements.hitSoft17Check.checked;
    state.allowEarlySurrender = elements.allowEarlySurrenderCheck.checked;
    state.allowLateSurrender = elements.allowLateSurrenderCheck.checked;
    state.resplitAces = elements.resplitAcesCheck.checked;

    // Tools
    state.showCardCount = elements.showCardCountCheck ? elements.showCardCountCheck.checked === true : false;
    state.countingSystem = elements.countingSystemSelect ? elements.countingSystemSelect.value : 'hilo';

    elements.startScreen.classList.add('hidden');

    // Check game mode
    const selectedMode = elements.gameModeSelect ? elements.gameModeSelect.value : 'single';
    if (selectedMode === 'multiplayer') {
      // Get number of players
      mpState.numPlayers = elements.numPlayersSelect ? parseInt(elements.numPlayersSelect.value) : 4;
      gameMode = 'multiplayer';
      initMultiplayerGame();
    } else {
      gameMode = 'single';
      switchToSinglePlayerUI();
      initGame();
    }
  });

  // Game mode toggle - show/hide multiplayer options
  if (elements.gameModeSelect) {
    elements.gameModeSelect.addEventListener('change', (e) => {
      if (elements.multiplayerOptions) {
        if (e.target.value === 'multiplayer') {
          elements.multiplayerOptions.classList.remove('hidden');
        } else {
          elements.multiplayerOptions.classList.add('hidden');
        }
      }
    });
  }

  // Show/hide counting system selector based on checkbox
  elements.showCardCountCheck.addEventListener('change', (e) => {
    if (elements.countingSystemRow) {
      elements.countingSystemRow.style.display = e.target.checked ? 'flex' : 'none';
    }
  });

  elements.showRules.addEventListener('click', () => {
    elements.rulesModal.classList.remove('hidden');
  });

  elements.closeRules.addEventListener('click', () => {
    elements.rulesModal.classList.add('hidden');
  });

  // Sound toggle
  elements.soundBtn.addEventListener('click', () => {
    const enabled = sounds.toggle();
    elements.soundBtn.textContent = enabled ? 'Sound: On' : 'Sound: Off';
    if (enabled) {
      sounds.buttonClick();
    }
  });

  // Stats modal
  elements.statsBtn.addEventListener('click', showStatsModal);
  elements.closeStats.addEventListener('click', hideStatsModal);

  // Betting controls
  elements.betDecrease.addEventListener('click', () => adjustBet(-1));
  elements.betIncrease.addEventListener('click', () => adjustBet(1));
  elements.dealBtn.addEventListener('click', () => {
    if (gameMode === 'multiplayer') {
      multiplayerDeal();
    } else {
      deal();
    }
  });

  // Side bets toggle for mobile
  elements.sideBetsToggle.addEventListener('click', () => {
    const wrapper = elements.sideBetsWrapper;
    const toggle = elements.sideBetsToggle;
    const isExpanded = wrapper.classList.contains('expanded');

    if (isExpanded) {
      wrapper.classList.remove('expanded');
      toggle.classList.remove('expanded');
      toggle.setAttribute('aria-expanded', 'false');
    } else {
      wrapper.classList.add('expanded');
      toggle.classList.add('expanded');
      toggle.setAttribute('aria-expanded', 'true');
    }
  });

  // Side bet controls - use updateSideBetAmounts() to work in both modes
  elements.perfectPairsCheck.addEventListener('change', (e) => {
    state.perfectPairsEnabled = e.target.checked;
    updateSideBetsCount();
  });

  elements.ppDecrease.addEventListener('click', () => {
    if (state.perfectPairsBet > state.minBet) {
      state.perfectPairsBet -= 5;
      updateSideBetAmounts();
    }
  });

  elements.ppIncrease.addEventListener('click', () => {
    if (state.perfectPairsBet < 50) {
      state.perfectPairsBet += 5;
      updateSideBetAmounts();
    }
  });

  elements.twentyOnePlus3Check.addEventListener('change', (e) => {
    state.twentyOnePlus3Enabled = e.target.checked;
    updateSideBetsCount();
  });

  elements.tpDecrease.addEventListener('click', () => {
    if (state.twentyOnePlus3Bet > state.minBet) {
      state.twentyOnePlus3Bet -= 5;
      updateSideBetAmounts();
    }
  });

  elements.tpIncrease.addEventListener('click', () => {
    if (state.twentyOnePlus3Bet < 50) {
      state.twentyOnePlus3Bet += 5;
      updateSideBetAmounts();
    }
  });

  elements.luckyLadiesCheck.addEventListener('change', (e) => {
    state.luckyLadiesEnabled = e.target.checked;
    updateSideBetsCount();
  });

  elements.llDecrease.addEventListener('click', () => {
    if (state.luckyLadiesBet > state.minBet) {
      state.luckyLadiesBet -= 5;
      updateSideBetAmounts();
    }
  });

  elements.llIncrease.addEventListener('click', () => {
    if (state.luckyLadiesBet < 50) {
      state.luckyLadiesBet += 5;
      updateSideBetAmounts();
    }
  });

  elements.busterBlackjackCheck.addEventListener('change', (e) => {
    state.busterBlackjackEnabled = e.target.checked;
    updateSideBetsCount();
  });

  elements.bbDecrease.addEventListener('click', () => {
    if (state.busterBlackjackBet > state.minBet) {
      state.busterBlackjackBet -= 5;
      updateSideBetAmounts();
    }
  });

  elements.bbIncrease.addEventListener('click', () => {
    if (state.busterBlackjackBet < 50) {
      state.busterBlackjackBet += 5;
      updateSideBetAmounts();
    }
  });

  elements.royalMatchCheck.addEventListener('change', (e) => {
    state.royalMatchEnabled = e.target.checked;
    updateSideBetsCount();
  });

  elements.rmDecrease.addEventListener('click', () => {
    if (state.royalMatchBet > state.minBet) {
      state.royalMatchBet -= 5;
      updateSideBetAmounts();
    }
  });

  elements.rmIncrease.addEventListener('click', () => {
    if (state.royalMatchBet < 50) {
      state.royalMatchBet += 5;
      updateSideBetAmounts();
    }
  });

  elements.superSevensCheck.addEventListener('change', (e) => {
    state.superSevensEnabled = e.target.checked;
    updateSideBetsCount();
  });

  elements.ssDecrease.addEventListener('click', () => {
    if (state.superSevensBet > state.minBet) {
      state.superSevensBet -= 5;
      updateSideBetAmounts();
    }
  });

  elements.ssIncrease.addEventListener('click', () => {
    if (state.superSevensBet < 50) {
      state.superSevensBet += 5;
      updateSideBetAmounts();
    }
  });

  // Playing controls
  elements.hitBtn.addEventListener('click', () => {
    if (gameMode === 'multiplayer') {
      multiplayerHit();
    } else {
      hit();
    }
  });
  elements.standBtn.addEventListener('click', () => {
    if (gameMode === 'multiplayer') {
      multiplayerStand();
    } else {
      stand();
    }
  });
  elements.doubleBtn.addEventListener('click', () => {
    if (gameMode === 'multiplayer') {
      multiplayerDouble();
    } else {
      double();
    }
  });
  elements.splitBtn.addEventListener('click', () => {
    if (gameMode === 'multiplayer') {
      multiplayerSplit();
    } else {
      split();
    }
  });
  elements.surrenderBtn.addEventListener('click', () => {
    if (gameMode === 'multiplayer') {
      multiplayerSurrender();
    } else {
      surrender();
    }
  });

  // Insurance controls
  elements.insuranceYes.addEventListener('click', () => {
    if (gameMode === 'multiplayer') {
      multiplayerTakeInsurance();
    } else {
      takeInsurance(true);
    }
  });
  elements.insuranceNo.addEventListener('click', () => {
    if (gameMode === 'multiplayer') {
      multiplayerDeclineInsurance();
    } else {
      takeInsurance(false);
    }
  });

  // Early surrender controls (multiplayer only)
  elements.earlySurrenderYes.addEventListener('click', () => {
    if (gameMode === 'multiplayer' && mpState.phase === 'early-surrender' && mpState.game.isHumanEarlySurrenderTurn()) {
      mpState.game.takeEarlySurrender(mpState.humanPlayerIndex);
      renderMultiplayer();
      handleMultiplayerEarlySurrender();
    }
  });
  elements.earlySurrenderNo.addEventListener('click', () => {
    if (gameMode === 'multiplayer' && mpState.phase === 'early-surrender' && mpState.game.isHumanEarlySurrenderTurn()) {
      mpState.game.declineEarlySurrender(mpState.humanPlayerIndex);
      renderMultiplayer();
      handleMultiplayerEarlySurrender();
    }
  });

  // Result controls
  elements.newHandBtn.addEventListener('click', () => {
    if (gameMode === 'multiplayer') {
      multiplayerNewRound();
    } else {
      newHand();
    }
  });

  // Game over
  elements.restartGame.addEventListener('click', () => {
    elements.gameOverModal.classList.add('hidden');
    elements.startScreen.classList.remove('hidden');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (elements.startScreen.classList.contains('hidden') === false) return;
    if (elements.gameOverModal.classList.contains('hidden') === false) return;

    const key = e.key.toLowerCase();

    // Multiplayer keyboard shortcuts
    if (gameMode === 'multiplayer') {
      if (mpState.phase === 'betting') {
        if (key === 'enter' || key === ' ') {
          e.preventDefault();
          multiplayerDeal();
        }
      } else if (mpState.phase === 'player-turns' && mpState.game && mpState.game.isHumanTurn()) {
        switch (key) {
          case 'h':
            e.preventDefault();
            if (!elements.hitBtn.disabled) multiplayerHit();
            break;
          case 's':
            e.preventDefault();
            if (!elements.standBtn.disabled) multiplayerStand();
            break;
          case 'd':
            e.preventDefault();
            if (!elements.doubleBtn.disabled) multiplayerDouble();
            break;
          case 'p':
            e.preventDefault();
            if (!elements.splitBtn.disabled) multiplayerSplit();
            break;
        }
      } else if (mpState.phase === 'insurance' && mpState.game && mpState.game.isHumanInsuranceTurn()) {
        if (key === 'y') {
          e.preventDefault();
          multiplayerTakeInsurance();
        } else if (key === 'n') {
          e.preventDefault();
          multiplayerDeclineInsurance();
        }
      } else if (mpState.phase === 'early-surrender' && mpState.game && mpState.game.isHumanEarlySurrenderTurn()) {
        if (key === 'r' || key === 'y') {
          e.preventDefault();
          mpState.game.takeEarlySurrender(mpState.humanPlayerIndex);
          renderMultiplayer();
          handleMultiplayerEarlySurrender();
        } else if (key === 'n') {
          e.preventDefault();
          mpState.game.declineEarlySurrender(mpState.humanPlayerIndex);
          renderMultiplayer();
          handleMultiplayerEarlySurrender();
        }
      } else if (mpState.phase === 'results') {
        if (key === 'n' || key === 'enter' || key === ' ') {
          e.preventDefault();
          multiplayerNewRound();
        }
      }
      return;
    }

    // Single-player keyboard shortcuts
    if (state.phase === 'betting') {
      if (key === 'enter' || key === ' ') {
        e.preventDefault();
        deal();
      }
    } else if (state.phase === 'playing') {
      switch (key) {
        case 'h':
          e.preventDefault();
          if (!elements.hitBtn.disabled) hit();
          break;
        case 's':
          e.preventDefault();
          if (!elements.standBtn.disabled) stand();
          break;
        case 'd':
          e.preventDefault();
          if (!elements.doubleBtn.disabled) double();
          break;
        case 'p':
          e.preventDefault();
          if (!elements.splitBtn.disabled) split();
          break;
        case 'r':
          e.preventDefault();
          if (!elements.surrenderBtn.disabled && elements.surrenderBtn.style.display !== 'none') surrender();
          break;
      }
    } else if (state.phase === 'insurance') {
      if (key === 'y') {
        e.preventDefault();
        takeInsurance(true);
      } else if (key === 'n') {
        e.preventDefault();
        takeInsurance(false);
      }
    } else if (state.phase === 'result') {
      if (key === 'n' || key === 'enter' || key === ' ') {
        e.preventDefault();
        newHand();
      }
    }
  });

  // Close modals on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!elements.rulesModal.classList.contains('hidden')) {
        elements.rulesModal.classList.add('hidden');
      }
      if (!elements.statsModal.classList.contains('hidden')) {
        hideStatsModal();
      }
    }
  });
}

// ============================================================================
// Initialization
// ============================================================================

function init() {
  setupEventListeners();

  // Show start screen
  elements.startScreen.classList.remove('hidden');
}

// Start the app
init();
