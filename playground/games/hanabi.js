/**
 * Hanabi - Cooperative Card Game for HyperToken Playground
 *
 * Players work together to build firework stacks (1-5 in each of 5 colors).
 * The twist: you can see everyone's cards EXCEPT your own!
 * Players give hints to help each other play the right cards.
 *
 * Actions:
 * - Play a card (hoping it's correct)
 * - Discard a card (to regain an info token)
 * - Give a hint (color or number) to partner
 *
 * @implements {GymCompatibleGame}
 */

const COLORS = ['red', 'yellow', 'green', 'blue', 'white'];
const NUMBERS = [1, 2, 3, 4, 5];
const CARD_COUNTS = { 1: 3, 2: 2, 3: 2, 4: 2, 5: 1 }; // How many of each number per color
const COLOR_SYMBOLS = { red: 'R', yellow: 'Y', green: 'G', blue: 'B', white: 'W' };
const COLOR_HEX = { red: '#e74c3c', yellow: '#f1c40f', green: '#2ecc71', blue: '#3498db', white: '#ecf0f1' };

const MAX_INFO_TOKENS = 8;
const MAX_LIFE_TOKENS = 3;
const HAND_SIZE = 5;

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

export class HanabiGame {
  constructor({ gameArea, controlsArea, log }) {
    this.gameArea = gameArea;
    this.controlsArea = controlsArea;
    this.log = log;

    this.rng = new SeededRandom();
    this.state = null;
    this._elements = null;
    this._selectedCard = null;
    this._hintMode = null;
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

    // Create deck
    const deck = [];
    for (const color of COLORS) {
      for (const num of NUMBERS) {
        const count = CARD_COUNTS[num];
        for (let i = 0; i < count; i++) {
          deck.push({ color, number: num, id: deck.length });
        }
      }
    }
    const shuffledDeck = this.rng.shuffle(deck);

    // Deal hands
    const hands = [[], []];
    for (let i = 0; i < HAND_SIZE; i++) {
      for (let p = 0; p < 2; p++) {
        const card = shuffledDeck.pop();
        hands[p].push({
          ...card,
          knownColor: null,
          knownNumber: null
        });
      }
    }

    // Initialize fireworks
    const fireworks = {};
    for (const color of COLORS) {
      fireworks[color] = 0;
    }

    this.state = {
      deck: shuffledDeck,
      hands,
      fireworks,
      discardPile: [],
      infoTokens: MAX_INFO_TOKENS,
      lifeTokens: MAX_LIFE_TOKENS,
      currentPlayer: 0,
      score: 0,
      isComplete: false,
      finalTurns: -1, // Countdown after deck empty
      lastAction: null
    };

    this._selectedCard = null;
    this._hintMode = null;
    this.updateDisplay();
    this.log('Hanabi: New game started. Work together to build fireworks!');
  }

  getScore() {
    return Object.values(this.state.fireworks).reduce((a, b) => a + b, 0);
  }

  canPlay(card) {
    return this.state.fireworks[card.color] === card.number - 1;
  }

  playCard(cardIndex) {
    const hand = this.state.hands[this.state.currentPlayer];
    const card = hand[cardIndex];

    if (this.canPlay(card)) {
      // Success!
      this.state.fireworks[card.color] = card.number;
      this.state.score = this.getScore();
      this.log(`Hanabi: Played ${card.number}${COLOR_SYMBOLS[card.color]} successfully!`);

      // Bonus info token for completing a 5
      if (card.number === 5 && this.state.infoTokens < MAX_INFO_TOKENS) {
        this.state.infoTokens++;
        this.log('Hanabi: Bonus info token for completing a stack!');
      }
    } else {
      // Fail - lose a life
      this.state.lifeTokens--;
      this.state.discardPile.push(card);
      this.log(`Hanabi: ${card.number}${COLOR_SYMBOLS[card.color]} was wrong! Lost a life.`);

      if (this.state.lifeTokens <= 0) {
        this.state.isComplete = true;
        this.state.score = 0;
        this.log('Hanabi: Game over - no lives left!');
        this.updateDisplay();
        return;
      }
    }

    // Draw new card
    hand.splice(cardIndex, 1);
    if (this.state.deck.length > 0) {
      hand.push({
        ...this.state.deck.pop(),
        knownColor: null,
        knownNumber: null
      });
    }

    this.endTurn();
  }

  discardCard(cardIndex) {
    if (this.state.infoTokens >= MAX_INFO_TOKENS) {
      this.log('Hanabi: Cannot discard - info tokens full.');
      return;
    }

    const hand = this.state.hands[this.state.currentPlayer];
    const card = hand[cardIndex];

    this.state.discardPile.push(card);
    this.state.infoTokens++;
    this.log(`Hanabi: Discarded ${card.number}${COLOR_SYMBOLS[card.color]}. Gained info token.`);

    // Draw new card
    hand.splice(cardIndex, 1);
    if (this.state.deck.length > 0) {
      hand.push({
        ...this.state.deck.pop(),
        knownColor: null,
        knownNumber: null
      });
    }

    this.endTurn();
  }

  giveHint(targetPlayer, hintType, hintValue) {
    if (this.state.infoTokens <= 0) {
      this.log('Hanabi: No info tokens left!');
      return;
    }

    if (targetPlayer === this.state.currentPlayer) {
      this.log('Hanabi: Cannot give hint to yourself!');
      return;
    }

    const hand = this.state.hands[targetPlayer];
    let matchCount = 0;

    for (const card of hand) {
      if (hintType === 'color' && card.color === hintValue) {
        card.knownColor = hintValue;
        matchCount++;
      } else if (hintType === 'number' && card.number === hintValue) {
        card.knownNumber = hintValue;
        matchCount++;
      }
    }

    if (matchCount === 0) {
      this.log(`Hanabi: No cards match that hint.`);
      return;
    }

    this.state.infoTokens--;
    const hintStr = hintType === 'color' ? COLOR_SYMBOLS[hintValue] : hintValue;
    this.log(`Hanabi: Gave hint: ${matchCount} card(s) are ${hintStr}`);

    this.endTurn();
  }

  endTurn() {
    // Check for game end conditions
    if (this.state.score === 25) {
      this.state.isComplete = true;
      this.log('Hanabi: Perfect score! You win!');
      this.updateDisplay();
      return;
    }

    // Deck empty - start countdown
    if (this.state.deck.length === 0 && this.state.finalTurns === -1) {
      this.state.finalTurns = 2; // Each player gets one more turn
    }

    if (this.state.finalTurns > 0) {
      this.state.finalTurns--;
      if (this.state.finalTurns <= 0) {
        this.state.isComplete = true;
        this.log(`Hanabi: Game over! Final score: ${this.state.score}/25`);
        this.updateDisplay();
        return;
      }
    }

    this.state.currentPlayer = 1 - this.state.currentPlayer;
    this._selectedCard = null;
    this._hintMode = null;
    this.updateDisplay();

    // AI turn
    if (this.state.currentPlayer === 1 && !this.state.isComplete) {
      setTimeout(() => this.aiTurn(), 800);
    }
  }

  aiTurn() {
    if (this.state.currentPlayer !== 1) return;
    if (this.state.isComplete) return;

    const hand = this.state.hands[1];

    // Try to play a known safe card
    for (let i = 0; i < hand.length; i++) {
      const card = hand[i];
      if (card.knownColor && card.knownNumber) {
        if (this.canPlay(card)) {
          this.playCard(i);
          return;
        }
      }
    }

    // Try to play if we know the number and it might work
    for (let i = 0; i < hand.length; i++) {
      const card = hand[i];
      if (card.knownNumber) {
        // Check if any stack needs this number
        const needed = COLORS.some(c => this.state.fireworks[c] === card.knownNumber - 1);
        if (needed && Math.random() < 0.5) {
          this.playCard(i);
          return;
        }
      }
    }

    // Give a hint if possible
    if (this.state.infoTokens > 0) {
      const playerHand = this.state.hands[0];
      // Find a useful hint - card that can be played
      for (const card of playerHand) {
        if (this.canPlay(card)) {
          if (Math.random() < 0.5) {
            this.giveHint(0, 'number', card.number);
          } else {
            this.giveHint(0, 'color', card.color);
          }
          return;
        }
      }
      // Random hint
      const randomCard = playerHand[Math.floor(Math.random() * playerHand.length)];
      if (Math.random() < 0.5) {
        this.giveHint(0, 'number', randomCard.number);
      } else {
        this.giveHint(0, 'color', randomCard.color);
      }
      return;
    }

    // Discard a card we know is useless
    for (let i = 0; i < hand.length; i++) {
      const card = hand[i];
      if (card.knownNumber && this.state.fireworks[card.knownColor || 'red'] >= card.knownNumber) {
        this.discardCard(i);
        return;
      }
    }

    // Discard oldest unknown card
    this.discardCard(0);
  }

  // ============================================================================
  // UI Rendering
  // ============================================================================

  render() {
    this.gameArea.innerHTML = `
      <div class="hanabi-game">
        <div class="hanabi-fireworks">
          ${COLORS.map(c => `<div class="hanabi-stack" data-color="${c}" style="border-color:${COLOR_HEX[c]}">
            <span class="hanabi-stack-label">${COLOR_SYMBOLS[c]}</span>
            <span class="hanabi-stack-value">0</span>
          </div>`).join('')}
        </div>

        <div class="hanabi-info">
          <span class="hanabi-tokens">Info: <span class="info-count">${MAX_INFO_TOKENS}</span></span>
          <span class="hanabi-lives">Lives: <span class="life-count">${MAX_LIFE_TOKENS}</span></span>
          <span class="hanabi-deck">Deck: <span class="deck-count">50</span></span>
        </div>

        <div class="hanabi-partner">
          <div class="hanabi-label">Partner's Hand (you can see these)</div>
          <div class="hanabi-hand partner-hand"></div>
        </div>

        <div class="hanabi-player">
          <div class="hanabi-label">Your Hand (you can't see these)</div>
          <div class="hanabi-hand player-hand"></div>
        </div>

        <div class="hanabi-message"></div>
      </div>
    `;

    this.controlsArea.innerHTML = `
      <button data-action="play" class="btn-primary">Play</button>
      <button data-action="discard" class="btn-secondary">Discard</button>
      <button data-action="hint-color" class="btn-secondary">Hint Color</button>
      <button data-action="hint-number" class="btn-secondary">Hint Number</button>
      <button data-action="new-game" class="btn-secondary">New Game</button>
    `;

    this._elements = {
      fireworks: this.gameArea.querySelectorAll('.hanabi-stack'),
      infoCount: this.gameArea.querySelector('.info-count'),
      lifeCount: this.gameArea.querySelector('.life-count'),
      deckCount: this.gameArea.querySelector('.deck-count'),
      partnerHand: this.gameArea.querySelector('.partner-hand'),
      playerHand: this.gameArea.querySelector('.player-hand'),
      message: this.gameArea.querySelector('.hanabi-message')
    };

    this.controlsArea.querySelector('[data-action="play"]')
      .addEventListener('click', () => {
        if (this._selectedCard !== null) {
          this.playCard(this._selectedCard);
        }
      });

    this.controlsArea.querySelector('[data-action="discard"]')
      .addEventListener('click', () => {
        if (this._selectedCard !== null) {
          this.discardCard(this._selectedCard);
        }
      });

    this.controlsArea.querySelector('[data-action="hint-color"]')
      .addEventListener('click', () => {
        this._hintMode = 'color';
        this.updateDisplay();
      });

    this.controlsArea.querySelector('[data-action="hint-number"]')
      .addEventListener('click', () => {
        this._hintMode = 'number';
        this.updateDisplay();
      });

    this.controlsArea.querySelector('[data-action="new-game"]')
      .addEventListener('click', () => this.resetGame());
  }

  updateDisplay() {
    if (!this.state || !this._elements) return;

    const isPlayerTurn = this.state.currentPlayer === 0 && !this.state.isComplete;

    // Update fireworks
    for (const el of this._elements.fireworks) {
      const color = el.dataset.color;
      el.querySelector('.hanabi-stack-value').textContent = this.state.fireworks[color];
    }

    // Update info
    this._elements.infoCount.textContent = this.state.infoTokens;
    this._elements.lifeCount.textContent = this.state.lifeTokens;
    this._elements.deckCount.textContent = this.state.deck.length;

    // Render partner's hand (visible)
    this._elements.partnerHand.innerHTML = this.state.hands[1].map((card, i) => {
      const color = COLOR_HEX[card.color];
      return `<div class="hanabi-card" style="background:${color}" data-index="${i}">
        <span class="hanabi-num">${card.number}</span>
        ${card.knownColor ? `<span class="hint-marker color">${COLOR_SYMBOLS[card.knownColor]}</span>` : ''}
        ${card.knownNumber ? `<span class="hint-marker number">${card.knownNumber}</span>` : ''}
      </div>`;
    }).join('');

    // Render player's hand (hidden, but show hints)
    this._elements.playerHand.innerHTML = this.state.hands[0].map((card, i) => {
      const isSelected = this._selectedCard === i;
      const hints = [];
      if (card.knownColor) hints.push(COLOR_SYMBOLS[card.knownColor]);
      if (card.knownNumber) hints.push(card.knownNumber);

      return `<div class="hanabi-card hidden ${isSelected ? 'selected' : ''}" data-index="${i}">
        <span class="hanabi-num">?</span>
        ${hints.length > 0 ? `<span class="hint-info">${hints.join(' ')}</span>` : ''}
      </div>`;
    }).join('');

    // Card click handlers
    if (isPlayerTurn) {
      this._elements.playerHand.querySelectorAll('.hanabi-card').forEach(el => {
        el.addEventListener('click', () => {
          this._selectedCard = parseInt(el.dataset.index);
          this.updateDisplay();
        });
      });

      if (this._hintMode) {
        this._elements.partnerHand.querySelectorAll('.hanabi-card').forEach(el => {
          el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.index);
            const card = this.state.hands[1][idx];
            if (this._hintMode === 'color') {
              this.giveHint(1, 'color', card.color);
            } else {
              this.giveHint(1, 'number', card.number);
            }
          });
        });
      }
    }

    // Message
    if (this.state.isComplete) {
      const msg = this.state.score === 25 ? 'Perfect score!' :
                  this.state.lifeTokens <= 0 ? 'Game over - explosion!' :
                  `Final score: ${this.state.score}/25`;
      this._elements.message.textContent = msg;
      this._elements.message.className = 'hanabi-message ' + (this.state.score >= 20 ? 'win' : 'lose');
    } else if (this._hintMode) {
      this._elements.message.textContent = `Click a partner's card to hint its ${this._hintMode}`;
      this._elements.message.className = 'hanabi-message';
    } else if (isPlayerTurn) {
      this._elements.message.textContent = this._selectedCard !== null ?
        'Play, Discard, or select another card' : 'Select a card from your hand';
      this._elements.message.className = 'hanabi-message';
    } else {
      this._elements.message.textContent = "Partner's turn...";
      this._elements.message.className = 'hanabi-message';
    }
  }

  // ============================================================================
  // Training Interface
  // ============================================================================

  get name() { return 'hanabi'; }
  get actionSpace() { return { n: 20 }; }
  getActionLabels() {
    const labels = {};
    for (let i = 0; i < 5; i++) labels[i] = `Play ${i + 1}`;
    for (let i = 0; i < 5; i++) labels[i + 5] = `Discard ${i + 1}`;
    for (let i = 0; i < 5; i++) labels[i + 10] = `Hint Color ${COLORS[i]}`;
    for (let i = 0; i < 5; i++) labels[i + 15] = `Hint Number ${i + 1}`;
    return labels;
  }
  getActionCount() { return 20; }

  getState() {
    if (!this.state) return {};
    return {
      currentPlayer: this.state.currentPlayer,
      infoTokens: this.state.infoTokens,
      lifeTokens: this.state.lifeTokens,
      fireworks: { ...this.state.fireworks },
      score: this.state.score,
      deckSize: this.state.deck.length,
      isComplete: this.state.isComplete
    };
  }

  async reset(seed = null) {
    this.resetGame(seed);
    return this.getState();
  }

  async step(action) {
    if (this.state.isComplete) {
      return { observation: this.getState(), reward: 0, terminated: true, truncated: false, info: {} };
    }

    if (action < 5) {
      this.playCard(action);
    } else if (action < 10) {
      this.discardCard(action - 5);
    } else if (action < 15 && this.state.infoTokens > 0) {
      this.giveHint(1 - this.state.currentPlayer, 'color', COLORS[action - 10]);
    } else if (action < 20 && this.state.infoTokens > 0) {
      this.giveHint(1 - this.state.currentPlayer, 'number', action - 14);
    }

    return {
      observation: this.getState(),
      reward: this.state.isComplete ? this.state.score / 25 : 0,
      terminated: this.state.isComplete,
      truncated: false,
      info: { score: this.state.score }
    };
  }
}
