/**
 * Texas Hold'em Poker for HyperToken Playground
 *
 * Heads-up (2-player) no-limit Texas Hold'em.
 *
 * Actions:
 *   0: Fold - Give up the hand
 *   1: Check - Pass (when no bet to call)
 *   2: Call - Match the current bet
 *   3: Raise Half - Raise by half the pot
 *   4: Raise Pot - Raise by the full pot
 *   5: All-In - Bet all remaining chips
 *
 * @implements {GymCompatibleGame}
 */

// Constants
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const SUIT_SYMBOLS = { hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663', spades: '\u2660' };
const ACTION_NAMES = ['Fold', 'Check', 'Call', 'Raise 1/2', 'Raise Pot', 'All-In'];

// Seeded random
class SeededRandom {
  constructor(seed) {
    this.seed = seed ?? Date.now();
  }
  next() {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
  shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

function cardToString(card) {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

function rankValue(rank) {
  const idx = RANKS.indexOf(rank);
  return idx >= 0 ? idx + 2 : 0;
}

export class PokerGame {
  constructor({ gameArea, controlsArea, log }) {
    this.gameArea = gameArea;
    this.controlsArea = controlsArea;
    this.log = log;

    this.smallBlind = 1;
    this.bigBlind = 2;
    this.startingChips = 100;

    this.rng = new SeededRandom();
    this.state = null;
    this._elements = null;
  }

  init() {
    this.render();
    this.resetGame();
  }

  cleanup() {
    this.gameArea.innerHTML = '';
    this.controlsArea.innerHTML = '';
  }

  resetGame(seed = null) {
    if (seed !== null) {
      this.rng = new SeededRandom(seed);
    } else {
      this.rng = new SeededRandom();
    }

    // Create and shuffle deck
    const deck = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ rank, suit });
      }
    }
    const shuffledDeck = this.rng.shuffle(deck);

    // Initialize state
    this.state = {
      players: [
        { name: 'You', chips: this.startingChips, holeCards: [], currentBet: 0, folded: false, allIn: false, isDealer: true },
        { name: 'Opponent', chips: this.startingChips, holeCards: [], currentBet: 0, folded: false, allIn: false, isDealer: false }
      ],
      deck: shuffledDeck,
      communityCards: [],
      pot: 0,
      currentBet: 0,
      phase: 'preflop',
      currentPlayerIndex: 0, // dealer/SB acts first preflop
      dealerIndex: 0,
      lastRaiseAmount: this.bigBlind,
      actionsThisRound: 0,
      winner: null,
      winningHand: null
    };

    // Post blinds - dealer posts SB, other posts BB
    this.postBlind(0, this.smallBlind);
    this.postBlind(1, this.bigBlind);
    this.state.currentBet = this.bigBlind;

    // Deal hole cards
    for (let i = 0; i < 2; i++) {
      for (const player of this.state.players) {
        player.holeCards.push(this.state.deck.pop());
      }
    }

    this.updateDisplay();
    this.log('Poker: New hand dealt. You are the dealer (small blind).');
  }

  postBlind(playerIndex, amount) {
    const player = this.state.players[playerIndex];
    const actualAmount = Math.min(amount, player.chips);
    player.chips -= actualAmount;
    player.currentBet = actualAmount;
    this.state.pot += actualAmount;
    if (player.chips === 0) player.allIn = true;
  }

  getValidActions() {
    if (this.state.phase === 'complete' || this.state.phase === 'showdown') {
      return [false, false, false, false, false, false];
    }

    const player = this.state.players[this.state.currentPlayerIndex];
    const toCall = this.state.currentBet - player.currentBet;
    const canCheck = toCall === 0;
    const canCall = toCall > 0 && player.chips >= toCall;
    const minRaise = Math.max(this.state.lastRaiseAmount, this.bigBlind);
    const canRaise = player.chips > toCall + minRaise;

    return [
      true,                          // Fold always available
      canCheck,                      // Check
      canCall,                       // Call
      canRaise,                      // Raise Half
      canRaise,                      // Raise Pot
      player.chips > 0               // All-in
    ];
  }

  action(actionIndex) {
    const player = this.state.players[this.state.currentPlayerIndex];
    const toCall = this.state.currentBet - player.currentBet;

    switch (actionIndex) {
      case 0: // Fold
        player.folded = true;
        this.endHand(1 - this.state.currentPlayerIndex);
        return;

      case 1: // Check
        if (toCall > 0) return false;
        break;

      case 2: // Call
        this.placeBet(this.state.currentPlayerIndex, toCall);
        break;

      case 3: // Raise Half Pot
        const halfPot = Math.floor(this.state.pot / 2);
        const raiseHalf = Math.max(this.state.lastRaiseAmount, halfPot);
        this.placeBet(this.state.currentPlayerIndex, toCall + raiseHalf);
        this.state.lastRaiseAmount = raiseHalf;
        break;

      case 4: // Raise Pot
        const raisePot = this.state.pot;
        this.placeBet(this.state.currentPlayerIndex, toCall + raisePot);
        this.state.lastRaiseAmount = raisePot;
        break;

      case 5: // All-in
        this.placeBet(this.state.currentPlayerIndex, player.chips);
        break;
    }

    this.state.actionsThisRound++;
    this.advanceAction();
    this.updateDisplay();
    return true;
  }

  placeBet(playerIndex, amount) {
    const player = this.state.players[playerIndex];
    const actualAmount = Math.min(amount, player.chips);
    player.chips -= actualAmount;
    player.currentBet += actualAmount;
    this.state.pot += actualAmount;

    if (player.currentBet > this.state.currentBet) {
      this.state.currentBet = player.currentBet;
    }
    if (player.chips === 0) player.allIn = true;
  }

  advanceAction() {
    // Check if betting round is complete
    const activePlayers = this.state.players.filter(p => !p.folded && !p.allIn);
    const allMatched = activePlayers.every(p => p.currentBet === this.state.currentBet);
    const minActions = this.state.phase === 'preflop' ? 2 : activePlayers.length;

    if (allMatched && this.state.actionsThisRound >= minActions) {
      this.advancePhase();
    } else {
      // Next player
      this.state.currentPlayerIndex = 1 - this.state.currentPlayerIndex;

      // If it's AI's turn, play automatically
      if (this.state.currentPlayerIndex === 1 && this.state.phase !== 'complete') {
        setTimeout(() => this.aiPlay(), 500);
      }
    }
  }

  advancePhase() {
    // Reset betting
    for (const player of this.state.players) {
      player.currentBet = 0;
    }
    this.state.currentBet = 0;
    this.state.actionsThisRound = 0;
    this.state.lastRaiseAmount = this.bigBlind;

    // BB acts first post-flop
    this.state.currentPlayerIndex = 1 - this.state.dealerIndex;

    switch (this.state.phase) {
      case 'preflop':
        // Deal flop
        this.state.communityCards.push(
          this.state.deck.pop(),
          this.state.deck.pop(),
          this.state.deck.pop()
        );
        this.state.phase = 'flop';
        this.log('Poker: Flop dealt.');
        break;

      case 'flop':
        // Deal turn
        this.state.communityCards.push(this.state.deck.pop());
        this.state.phase = 'turn';
        this.log('Poker: Turn dealt.');
        break;

      case 'turn':
        // Deal river
        this.state.communityCards.push(this.state.deck.pop());
        this.state.phase = 'river';
        this.log('Poker: River dealt.');
        break;

      case 'river':
        // Showdown
        this.showdown();
        break;
    }

    // If AI acts first, play
    if (this.state.currentPlayerIndex === 1 && this.state.phase !== 'complete' && this.state.phase !== 'showdown') {
      setTimeout(() => this.aiPlay(), 500);
    }

    this.updateDisplay();
  }

  showdown() {
    this.state.phase = 'showdown';

    // Simple hand evaluation - just compare high cards for now
    const hand0 = this.evaluateHand(0);
    const hand1 = this.evaluateHand(1);

    if (hand0.rank > hand1.rank || (hand0.rank === hand1.rank && hand0.highCard > hand1.highCard)) {
      this.endHand(0, hand0.name);
    } else if (hand1.rank > hand0.rank || (hand1.rank === hand0.rank && hand1.highCard > hand0.highCard)) {
      this.endHand(1, hand1.name);
    } else {
      // Split pot
      this.state.players[0].chips += Math.floor(this.state.pot / 2);
      this.state.players[1].chips += Math.floor(this.state.pot / 2);
      this.state.phase = 'complete';
      this.log('Poker: Split pot!');
    }

    this.updateDisplay();
  }

  evaluateHand(playerIndex) {
    const player = this.state.players[playerIndex];
    const allCards = [...player.holeCards, ...this.state.communityCards];

    // Count ranks and suits
    const rankCounts = {};
    const suitCounts = {};
    for (const card of allCards) {
      rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    }

    const hasFlush = Object.values(suitCounts).some(c => c >= 5);
    const pairs = Object.entries(rankCounts).filter(([, c]) => c === 2).length;
    const trips = Object.entries(rankCounts).filter(([, c]) => c === 3).length;
    const quads = Object.entries(rankCounts).filter(([, c]) => c === 4).length;

    const highCard = Math.max(...allCards.map(c => rankValue(c.rank)));

    // Simple hand ranking
    if (quads > 0) return { rank: 7, name: 'Four of a Kind', highCard };
    if (trips > 0 && pairs > 0) return { rank: 6, name: 'Full House', highCard };
    if (hasFlush) return { rank: 5, name: 'Flush', highCard };
    if (trips > 0) return { rank: 3, name: 'Three of a Kind', highCard };
    if (pairs >= 2) return { rank: 2, name: 'Two Pair', highCard };
    if (pairs === 1) return { rank: 1, name: 'One Pair', highCard };
    return { rank: 0, name: 'High Card', highCard };
  }

  endHand(winnerIndex, handName = null) {
    this.state.winner = winnerIndex;
    this.state.winningHand = handName;
    this.state.players[winnerIndex].chips += this.state.pot;
    this.state.pot = 0;
    this.state.phase = 'complete';

    const winner = this.state.players[winnerIndex];
    if (handName) {
      this.log(`Poker: ${winner.name} wins with ${handName}!`);
    } else {
      this.log(`Poker: ${winner.name} wins (opponent folded)!`);
    }
  }

  aiPlay() {
    if (this.state.currentPlayerIndex !== 1) return;
    if (this.state.phase === 'complete' || this.state.phase === 'showdown') return;

    const valid = this.getValidActions();
    const toCall = this.state.currentBet - this.state.players[1].currentBet;

    // Simple AI: check if possible, call small bets, fold to big bets
    if (valid[1]) { // Check
      this.action(1);
    } else if (valid[2] && toCall <= this.bigBlind * 3) { // Call small bets
      this.action(2);
    } else if (valid[3] && Math.random() < 0.3) { // Sometimes raise
      this.action(3);
    } else if (valid[2]) { // Call
      this.action(2);
    } else { // Fold
      this.action(0);
    }
  }

  // ============================================================================
  // UI Rendering
  // ============================================================================

  render() {
    this.gameArea.innerHTML = `
      <div class="poker-game">
        <div class="poker-opponent">
          <div class="poker-label">Opponent</div>
          <div class="poker-hand opponent-hand"></div>
          <div class="poker-chips" data-player="1"></div>
        </div>

        <div class="poker-table">
          <div class="poker-community"></div>
          <div class="poker-pot"></div>
        </div>

        <div class="poker-player">
          <div class="poker-label">You</div>
          <div class="poker-hand player-hand"></div>
          <div class="poker-chips" data-player="0"></div>
        </div>

        <div class="poker-message"></div>
      </div>
    `;

    this.controlsArea.innerHTML = `
      <button data-action="0" class="btn-secondary">Fold</button>
      <button data-action="1" class="btn-secondary">Check</button>
      <button data-action="2" class="btn-primary">Call</button>
      <button data-action="3" class="btn-primary">Raise 1/2</button>
      <button data-action="4" class="btn-primary">Raise Pot</button>
      <button data-action="5" class="btn-primary">All-In</button>
      <button data-action="new-hand" class="btn-secondary">New Hand</button>
    `;

    this._elements = {
      opponentHand: this.gameArea.querySelector('.opponent-hand'),
      playerHand: this.gameArea.querySelector('.player-hand'),
      opponentChips: this.gameArea.querySelector('[data-player="1"]'),
      playerChips: this.gameArea.querySelector('[data-player="0"]'),
      community: this.gameArea.querySelector('.poker-community'),
      pot: this.gameArea.querySelector('.poker-pot'),
      message: this.gameArea.querySelector('.poker-message')
    };

    // Action buttons
    for (let i = 0; i < 6; i++) {
      const btn = this.controlsArea.querySelector(`[data-action="${i}"]`);
      btn.addEventListener('click', () => {
        if (this.state.currentPlayerIndex === 0) this.action(i);
      });
    }

    this.controlsArea.querySelector('[data-action="new-hand"]')
      .addEventListener('click', () => this.resetGame());
  }

  updateDisplay() {
    if (!this.state || !this._elements) return;

    const isPlayerTurn = this.state.currentPlayerIndex === 0 && this.state.phase !== 'complete';
    const showOpponentCards = this.state.phase === 'showdown' || this.state.phase === 'complete';

    // Render hands
    this._elements.playerHand.innerHTML = this.state.players[0].holeCards
      .map(c => {
        const isRed = c.suit === 'hearts' || c.suit === 'diamonds';
        return `<div class="card ${isRed ? 'red' : ''}">${cardToString(c)}</div>`;
      }).join('');

    this._elements.opponentHand.innerHTML = this.state.players[1].holeCards
      .map(c => {
        const isRed = c.suit === 'hearts' || c.suit === 'diamonds';
        if (showOpponentCards) {
          return `<div class="card ${isRed ? 'red' : ''}">${cardToString(c)}</div>`;
        }
        return `<div class="card hidden">?</div>`;
      }).join('');

    // Community cards
    this._elements.community.innerHTML = this.state.communityCards
      .map(c => {
        const isRed = c.suit === 'hearts' || c.suit === 'diamonds';
        return `<div class="card ${isRed ? 'red' : ''}">${cardToString(c)}</div>`;
      }).join('');

    // Chips and pot
    this._elements.playerChips.textContent = `Chips: ${this.state.players[0].chips}`;
    this._elements.opponentChips.textContent = `Chips: ${this.state.players[1].chips}`;
    this._elements.pot.textContent = `Pot: ${this.state.pot}`;

    // Update buttons
    const validActions = this.getValidActions();
    for (let i = 0; i < 6; i++) {
      const btn = this.controlsArea.querySelector(`[data-action="${i}"]`);
      btn.disabled = !isPlayerTurn || !validActions[i];
    }

    // Message
    if (this.state.phase === 'complete') {
      const winner = this.state.winner === 0 ? 'You win!' : 'Opponent wins!';
      this._elements.message.textContent = this.state.winningHand ?
        `${winner} (${this.state.winningHand})` : winner;
      this._elements.message.className = 'poker-message ' + (this.state.winner === 0 ? 'win' : 'lose');
    } else if (isPlayerTurn) {
      const toCall = this.state.currentBet - this.state.players[0].currentBet;
      this._elements.message.textContent = toCall > 0 ?
        `Your turn - ${toCall} to call` : 'Your turn';
      this._elements.message.className = 'poker-message';
    } else {
      this._elements.message.textContent = "Opponent's turn...";
      this._elements.message.className = 'poker-message';
    }
  }

  // ============================================================================
  // Training Interface
  // ============================================================================

  get name() { return 'poker'; }
  get actionSpace() { return { n: 6 }; }
  getActionLabels() {
    return Object.fromEntries(ACTION_NAMES.map((n, i) => [i, n]));
  }
  getActionCount() { return 6; }

  getState() {
    if (!this.state) return {};
    return {
      phase: this.state.phase,
      pot: this.state.pot,
      currentBet: this.state.currentBet,
      communityCards: this.state.communityCards.map(cardToString),
      players: this.state.players.map(p => ({
        chips: p.chips,
        currentBet: p.currentBet,
        folded: p.folded,
        allIn: p.allIn
      })),
      winner: this.state.winner,
      winningHand: this.state.winningHand
    };
  }

  stateToObservation(state) {
    return new Float32Array([
      state.pot / 200,
      state.players?.[0]?.chips / 100 || 0,
      state.players?.[1]?.chips / 100 || 0,
      state.currentBet / 50,
      state.phase === 'preflop' ? 1 : 0,
      state.phase === 'flop' ? 1 : 0,
      state.phase === 'turn' ? 1 : 0,
      state.phase === 'river' ? 1 : 0
    ]);
  }

  async reset(seed = null) {
    this.resetGame(seed);
    return this.getState();
  }

  async step(actionIdx) {
    if (this.state.phase === 'complete') {
      return {
        observation: this.getState(),
        reward: 0,
        terminated: true,
        truncated: false,
        info: {}
      };
    }

    this.action(actionIdx);

    let reward = 0;
    if (this.state.phase === 'complete') {
      reward = this.state.winner === 0 ? 1 : -1;
    }

    return {
      observation: this.getState(),
      reward,
      terminated: this.state.phase === 'complete',
      truncated: false,
      info: { winner: this.state.winner }
    };
  }
}
