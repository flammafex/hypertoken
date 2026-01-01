/**
 * Blackjack game for playground
 *
 * Implements the Gym-compatible game interface for AI training:
 * - reset(): Initialize game state, returns observation
 * - step(action): Execute action, returns {observation, reward, terminated, truncated, info}
 * - getState(): Get current game state
 * - getActionLabels(): Map action indices to human-readable names
 *
 * @implements {GymCompatibleGame}
 */

/**
 * @typedef {Object} Card
 * @property {string} rank - Card rank (A, 2-10, J, Q, K)
 * @property {string} suit - Card suit (spades, hearts, diams, clubs)
 * @property {string} symbol - Unicode suit symbol
 * @property {number} value - Numeric value (1-11)
 */

/**
 * @typedef {Object} BlackjackState
 * @property {number} playerValue - Current player hand value
 * @property {number} dealerShowing - Dealer's visible card value
 * @property {boolean} usableAce - Whether player has a usable ace
 * @property {Array<{rank: string, suit: string}>} playerHand - Player's cards
 * @property {Card|null} dealerUpCard - Dealer's visible card
 * @property {boolean} gameOver - Whether game has ended
 * @property {number} deckRemaining - Cards remaining in deck
 */

/**
 * @typedef {Object} StepResult
 * @property {BlackjackState} observation - Current game state
 * @property {number} reward - Reward for this step (-1, 0, or 1)
 * @property {boolean} terminated - Whether episode ended naturally
 * @property {boolean} truncated - Whether episode was cut short
 * @property {Object} info - Additional information
 */

/**
 * @typedef {Object} GameConfig
 * @property {HTMLElement} gameArea - Container for game display
 * @property {HTMLElement} controlsArea - Container for game controls
 * @property {Function} log - Logging function
 */

export class BlackjackGame {
  /**
   * @param {GameConfig} config
   */
  constructor({ gameArea, controlsArea, log }) {
    this.gameArea = gameArea;
    this.controlsArea = controlsArea;
    this.log = log;

    /** @type {Card[]} */
    this.deck = [];
    /** @type {Card[]} */
    this.playerHand = [];
    /** @type {Card[]} */
    this.dealerHand = [];
    /** @type {boolean} */
    this.gameOver = false;
    /** @type {Object<string, HTMLElement>} */
    this._elements = null;
  }

  init() {
    this.render();
    this.deal();
  }

  cleanup() {
    this.gameArea.innerHTML = '';
    this.controlsArea.innerHTML = '';
  }

  render() {
    // Use data attributes instead of IDs for container-scoped queries
    this.gameArea.innerHTML = `
      <div class="hand">
        <div class="hand-label">Dealer</div>
        <div data-element="dealer-cards"></div>
        <div data-element="dealer-value"></div>
      </div>
      <div class="hand">
        <div class="hand-label">You</div>
        <div data-element="player-cards"></div>
        <div data-element="player-value"></div>
      </div>
      <div data-element="result"></div>
    `;

    this.controlsArea.innerHTML = `
      <button data-action="hit" class="btn-primary">Hit</button>
      <button data-action="stand" class="btn-secondary">Stand</button>
      <button data-action="deal" class="btn-secondary">New Hand</button>
    `;

    // Cache element references using container-scoped queries
    this._elements = {
      dealerCards: this.gameArea.querySelector('[data-element="dealer-cards"]'),
      dealerValue: this.gameArea.querySelector('[data-element="dealer-value"]'),
      playerCards: this.gameArea.querySelector('[data-element="player-cards"]'),
      playerValue: this.gameArea.querySelector('[data-element="player-value"]'),
      result: this.gameArea.querySelector('[data-element="result"]'),
      btnHit: this.controlsArea.querySelector('[data-action="hit"]'),
      btnStand: this.controlsArea.querySelector('[data-action="stand"]'),
      btnDeal: this.controlsArea.querySelector('[data-action="deal"]')
    };

    // Event listeners using cached references
    this._elements.btnHit.addEventListener('click', () => this.hit());
    this._elements.btnStand.addEventListener('click', () => this.stand());
    this._elements.btnDeal.addEventListener('click', () => this.deal());
  }

  createDeck() {
    const suits = ['spades', 'hearts', 'diams', 'clubs'];
    const suitSymbols = { spades: '\u2660', hearts: '\u2665', diams: '\u2666', clubs: '\u2663' };
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    this.deck = [];

    for (const suit of suits) {
      for (const rank of ranks) {
        let value = parseInt(rank);
        if (rank === 'A') value = 11;
        else if (['J', 'Q', 'K'].includes(rank)) value = 10;
        this.deck.push({ rank, suit, symbol: suitSymbols[suit], value });
      }
    }

    // Shuffle
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  deal() {
    this.createDeck();
    this.playerHand = [this.deck.pop(), this.deck.pop()];
    this.dealerHand = [this.deck.pop(), this.deck.pop()];
    this.gameOver = false;

    this._elements.btnHit.disabled = false;
    this._elements.btnStand.disabled = false;
    this._elements.result.textContent = '';

    this.updateDisplay(false);

    // Check for natural blackjack
    if (this.getValue(this.playerHand) === 21) {
      this.stand();
    }
  }

  hit() {
    if (this.gameOver) return;

    this.playerHand.push(this.deck.pop());
    this.updateDisplay(false);

    if (this.getValue(this.playerHand) > 21) {
      this.endGame('bust');
    } else if (this.getValue(this.playerHand) === 21) {
      this.stand();
    }
  }

  stand() {
    if (this.gameOver) return;

    // Dealer plays
    while (this.getValue(this.dealerHand) < 17) {
      this.dealerHand.push(this.deck.pop());
    }

    this.updateDisplay(true);

    const playerValue = this.getValue(this.playerHand);
    const dealerValue = this.getValue(this.dealerHand);

    if (dealerValue > 21) {
      this.endGame('dealer-bust');
    } else if (playerValue > dealerValue) {
      this.endGame('win');
    } else if (playerValue < dealerValue) {
      this.endGame('lose');
    } else {
      this.endGame('push');
    }
  }

  getValue(hand) {
    let value = hand.reduce((sum, card) => sum + card.value, 0);
    let aces = hand.filter(c => c.rank === 'A').length;

    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }

    return value;
  }

  endGame(result) {
    this.gameOver = true;
    this._elements.btnHit.disabled = true;
    this._elements.btnStand.disabled = true;

    const messages = {
      'bust': 'Bust! You lose.',
      'dealer-bust': 'Dealer busts! You win!',
      'win': 'You win!',
      'lose': 'Dealer wins.',
      'push': 'Push (tie).'
    };

    this._elements.result.textContent = messages[result];
    this.log(`Blackjack: ${messages[result]}`);
  }

  updateDisplay(showDealer) {
    const cardHTML = (card, hidden = false) => {
      if (hidden) return '<div class="card hidden">?</div>';
      const isRed = ['hearts', 'diams'].includes(card.suit);
      return `<div class="card ${isRed ? 'red' : ''}">${card.rank}${card.symbol}</div>`;
    };

    this._elements.playerCards.innerHTML =
      this.playerHand.map(c => cardHTML(c)).join('');
    this._elements.playerValue.textContent =
      `Value: ${this.getValue(this.playerHand)}`;

    this._elements.dealerCards.innerHTML =
      this.dealerHand.map((c, i) => cardHTML(c, i === 1 && !showDealer)).join('');
    this._elements.dealerValue.textContent =
      showDealer ? `Value: ${this.getValue(this.dealerHand)}` : '';
  }

  // === Training Interface ===

  // Game name for identification
  get name() {
    return 'blackjack';
  }

  // Action space definition
  get actionSpace() {
    return { n: 2 }; // Hit, Stand
  }

  // Get action labels for UI
  getActionLabels() {
    return { 0: 'Hit', 1: 'Stand' };
  }

  // Get number of actions
  getActionCount() {
    return 2;
  }

  // Get current game state as observation
  getState() {
    const playerValue = this.getValue(this.playerHand);
    const dealerShowing = this.dealerHand.length > 0 ? this.dealerHand[0].value : 0;
    const usableAce = this.playerHand.some(c => c.rank === 'A') &&
                      this.playerHand.reduce((sum, c) => sum + c.value, 0) <= 21;

    return {
      playerValue,
      dealerShowing,
      usableAce,
      playerHand: this.playerHand.map(c => ({ rank: c.rank, suit: c.suit })),
      dealerUpCard: this.dealerHand[0] || null,
      gameOver: this.gameOver,
      deckRemaining: this.deck.length
    };
  }

  // Convert state to observation array for ML
  stateToObservation(state) {
    return new Float32Array([
      state.playerValue / 21,           // Normalized player value
      state.dealerShowing / 11,         // Normalized dealer showing
      state.usableAce ? 1 : 0,          // Has usable ace
      state.gameOver ? 1 : 0,           // Game over flag
      state.deckRemaining / 52          // Deck remaining ratio
    ]);
  }

  /**
   * Get heuristic policy for training baseline (basic strategy)
   * @param {BlackjackState} state - Current game state
   * @returns {number[]} Probability distribution over actions [hit, stand]
   */
  getHeuristicPolicy(state) {
    const playerValue = state.playerValue || this.getValue(this.playerHand);
    const dealerShowing = state.dealerShowing ||
                          (this.dealerHand.length > 0 ? this.dealerHand[0].value : 0);

    // Basic strategy simplified
    let hitProb = 0;

    if (playerValue <= 11) {
      hitProb = 1.0; // Always hit on 11 or less
    } else if (playerValue === 12) {
      hitProb = dealerShowing >= 4 && dealerShowing <= 6 ? 0.2 : 0.8;
    } else if (playerValue >= 13 && playerValue <= 16) {
      hitProb = dealerShowing >= 7 ? 0.9 : 0.1;
    } else if (playerValue >= 17) {
      hitProb = 0.0; // Never hit on 17+
    }

    return [hitProb, 1 - hitProb]; // [Hit, Stand]
  }

  /**
   * Reset game and return initial observation (Gym interface)
   * Async for interface consistency with potentially async game implementations
   * @param {number|null} [seed=null] - Optional random seed (not yet implemented)
   * @returns {Promise<BlackjackState>} Initial game state
   */
  async reset(seed = null) {
    if (seed !== null) {
      // Could implement seeded random here
    }
    this.deal();
    return this.getState();
  }

  /**
   * Execute an action and return the result (Gym interface)
   * Async for interface consistency with potentially async game implementations
   * @param {number} action - Action index (0=hit, 1=stand)
   * @returns {Promise<StepResult>} Step result with observation, reward, and termination status
   */
  async step(action) {
    const prevGameOver = this.gameOver;

    if (this.gameOver) {
      return {
        observation: this.getState(),
        reward: 0,
        terminated: true,
        truncated: false,
        info: { message: 'Game already over' }
      };
    }

    // Execute action
    if (action === 0) {
      this.hit();
    } else if (action === 1) {
      this.stand();
    }

    // Calculate reward
    let reward = 0;
    if (this.gameOver) {
      const playerValue = this.getValue(this.playerHand);
      const dealerValue = this.getValue(this.dealerHand);

      if (playerValue > 21) {
        reward = -1; // Bust
      } else if (dealerValue > 21 || playerValue > dealerValue) {
        reward = 1; // Win
      } else if (playerValue < dealerValue) {
        reward = -1; // Lose
      } else {
        reward = 0; // Push
      }
    }

    return {
      observation: this.getState(),
      reward,
      terminated: this.gameOver,
      truncated: false,
      info: {
        playerValue: this.getValue(this.playerHand),
        dealerValue: this.gameOver ? this.getValue(this.dealerHand) : null,
        action: action === 0 ? 'hit' : 'stand'
      }
    };
  }

  async runEpisode() {
    this.deal();

    const trajectory = [];
    let totalReward = 0;

    // Simple policy: hit if < 17
    while (!this.gameOver) {
      const state = this.getState();
      const value = this.getValue(this.playerHand);
      const action = value < 17 ? 0 : 1; // 0=hit, 1=stand

      const prevGameOver = this.gameOver;

      if (action === 0) {
        this.hit();
      } else {
        this.stand();
      }

      // Calculate step reward
      let stepReward = 0;
      if (this.gameOver && !prevGameOver) {
        const playerValue = this.getValue(this.playerHand);
        const dealerValue = this.getValue(this.dealerHand);

        if (playerValue > 21) {
          stepReward = -1;
        } else if (dealerValue > 21 || playerValue > dealerValue) {
          stepReward = 1;
        } else if (playerValue < dealerValue) {
          stepReward = -1;
        }
      }

      trajectory.push({
        state,
        action,
        reward: stepReward,
        nextState: this.getState()
      });

      totalReward += stepReward;
    }

    return {
      reward: totalReward,
      win: totalReward > 0,
      trajectory,
      initialState: trajectory[0]?.state,
      finalState: this.getState(),
      steps: trajectory
    };
  }
}
