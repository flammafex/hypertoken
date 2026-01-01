/**
 * Liar's Dice for HyperToken Playground
 *
 * A bluffing dice game where players make increasingly bold claims
 * about the total dice showing a face value across all players.
 *
 * Gameplay:
 * - Each player has 5 dice (hidden from opponents)
 * - Players take turns making bids: "There are at least X dice showing Y"
 * - Each bid must be higher than the previous (more quantity or higher face)
 * - Call "Liar!" if you think the bid is wrong
 * - Loser of the challenge loses a die
 * - Last player with dice wins
 *
 * @implements {GymCompatibleGame}
 */

const STARTING_DICE = 5;
const FACES = [1, 2, 3, 4, 5, 6];
const DICE_SYMBOLS = ['\u2680', '\u2681', '\u2682', '\u2683', '\u2684', '\u2685']; // Unicode dice

class SeededRandom {
  constructor(seed) {
    this.seed = seed ?? Date.now();
  }
  next() {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
  rollDie() {
    return Math.floor(this.next() * 6) + 1;
  }
}

export class LiarsDiceGame {
  constructor({ gameArea, controlsArea, log }) {
    this.gameArea = gameArea;
    this.controlsArea = controlsArea;
    this.log = log;

    this.rng = new SeededRandom();
    this.state = null;
    this._elements = null;
    this._selectedQuantity = 1;
    this._selectedFace = 2;
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

    this.state = {
      players: [
        { dice: [], diceCount: STARTING_DICE, name: 'You' },
        { dice: [], diceCount: STARTING_DICE, name: 'Opponent' }
      ],
      currentBid: null,
      lastBidder: null,
      currentPlayer: 0,
      phase: 'bid', // 'bid' or 'complete'
      winner: null,
      roundNumber: 1
    };

    this.rollAllDice();
    this._selectedQuantity = 1;
    this._selectedFace = 2;
    this.updateDisplay();
    this.log("Liar's Dice: New game started. Make your bid!");
  }

  rollAllDice() {
    for (const player of this.state.players) {
      player.dice = [];
      for (let i = 0; i < player.diceCount; i++) {
        player.dice.push(this.rng.rollDie());
      }
      player.dice.sort((a, b) => a - b);
    }
    this.log("Liar's Dice: New round - dice rolled!");
  }

  getTotalDice() {
    return this.state.players.reduce((sum, p) => sum + p.diceCount, 0);
  }

  countFace(face) {
    let count = 0;
    for (const player of this.state.players) {
      for (const die of player.dice) {
        // 1s are wild (count as any face)
        if (die === face || die === 1) {
          count++;
        }
      }
    }
    return count;
  }

  isValidBid(quantity, face) {
    if (quantity < 1 || face < 1 || face > 6) return false;
    if (quantity > this.getTotalDice()) return false;

    if (!this.state.currentBid) return true;

    const { quantity: curQ, face: curF } = this.state.currentBid;

    // Higher quantity is always valid
    if (quantity > curQ) return true;

    // Same quantity, higher face
    if (quantity === curQ && face > curF) return true;

    return false;
  }

  makeBid(quantity, face) {
    if (!this.isValidBid(quantity, face)) {
      this.log("Liar's Dice: Invalid bid.");
      return false;
    }

    this.state.currentBid = { quantity, face };
    this.state.lastBidder = this.state.currentPlayer;
    this.log(`Liar's Dice: ${this.state.players[this.state.currentPlayer].name} bids ${quantity}x ${DICE_SYMBOLS[face - 1]}`);

    this.state.currentPlayer = 1 - this.state.currentPlayer;
    this.updateDisplay();

    // AI's turn
    if (this.state.currentPlayer === 1 && this.state.phase === 'bid') {
      setTimeout(() => this.aiTurn(), 800);
    }

    return true;
  }

  callLiar() {
    if (!this.state.currentBid) {
      this.log("Liar's Dice: No bid to challenge.");
      return;
    }

    const { quantity, face } = this.state.currentBid;
    const actualCount = this.countFace(face);

    this.log(`Liar's Dice: ${this.state.players[this.state.currentPlayer].name} calls LIAR!`);
    this.log(`Liar's Dice: Bid was ${quantity}x ${DICE_SYMBOLS[face - 1]}, actual count: ${actualCount}`);

    let loser;
    if (actualCount >= quantity) {
      // Bid was valid - challenger loses
      loser = this.state.currentPlayer;
      this.log(`Liar's Dice: Bid was correct! ${this.state.players[loser].name} loses a die.`);
    } else {
      // Bid was a lie - bidder loses
      loser = this.state.lastBidder;
      this.log(`Liar's Dice: It was a lie! ${this.state.players[loser].name} loses a die.`);
    }

    // Loser loses a die
    this.state.players[loser].diceCount--;

    // Check for elimination
    if (this.state.players[loser].diceCount <= 0) {
      this.state.winner = 1 - loser;
      this.state.phase = 'complete';
      this.log(`Liar's Dice: ${this.state.players[this.state.winner].name} wins!`);
    } else {
      // New round
      this.state.roundNumber++;
      this.state.currentBid = null;
      this.state.lastBidder = null;
      this.state.currentPlayer = loser; // Loser starts next round
      this.rollAllDice();
    }

    this.updateDisplay();

    // AI's turn if applicable
    if (this.state.currentPlayer === 1 && this.state.phase === 'bid') {
      setTimeout(() => this.aiTurn(), 800);
    }
  }

  aiTurn() {
    if (this.state.currentPlayer !== 1) return;
    if (this.state.phase !== 'bid') return;

    const aiDice = this.state.players[1].dice;
    const totalDice = this.getTotalDice();

    // Count AI's own dice
    const myCounts = {};
    for (let f = 1; f <= 6; f++) myCounts[f] = 0;
    for (const d of aiDice) myCounts[d]++;

    // If no current bid, make an initial bid based on own dice
    if (!this.state.currentBid) {
      // Find most common face (excluding 1s)
      let bestFace = 2, bestCount = 0;
      for (let f = 2; f <= 6; f++) {
        const count = myCounts[f] + myCounts[1]; // Include wilds
        if (count > bestCount) {
          bestCount = count;
          bestFace = f;
        }
      }
      this.makeBid(Math.max(1, bestCount), bestFace);
      return;
    }

    const { quantity, face } = this.state.currentBid;

    // Estimate probability of bid being true
    const myCountOfFace = myCounts[face] + myCounts[1];
    const opponentDice = this.state.players[0].diceCount;
    const expectedOpponentCount = opponentDice / 3; // ~33% chance per face including wilds
    const estimatedTotal = myCountOfFace + expectedOpponentCount;

    // Decide to call or raise
    if (quantity > estimatedTotal + 2) {
      // Probably a lie
      if (Math.random() < 0.7) {
        this.callLiar();
        return;
      }
    }

    // Try to make a valid bid
    // Option 1: Same quantity, higher face
    for (let f = face + 1; f <= 6; f++) {
      if (this.isValidBid(quantity, f) && myCounts[f] + myCounts[1] >= 1) {
        this.makeBid(quantity, f);
        return;
      }
    }

    // Option 2: Higher quantity
    const newQuantity = quantity + 1;
    if (newQuantity <= totalDice) {
      // Find best face for new quantity
      let bestFace = 2;
      let bestCount = 0;
      for (let f = 2; f <= 6; f++) {
        const count = myCounts[f] + myCounts[1];
        if (count > bestCount) {
          bestCount = count;
          bestFace = f;
        }
      }
      if (this.isValidBid(newQuantity, bestFace)) {
        this.makeBid(newQuantity, bestFace);
        return;
      }
      // Try any valid face
      for (let f = 2; f <= 6; f++) {
        if (this.isValidBid(newQuantity, f)) {
          this.makeBid(newQuantity, f);
          return;
        }
      }
    }

    // No good options - call liar
    this.callLiar();
  }

  // ============================================================================
  // UI Rendering
  // ============================================================================

  render() {
    this.gameArea.innerHTML = `
      <div class="dice-game">
        <div class="dice-opponent">
          <div class="dice-label">Opponent's Dice</div>
          <div class="dice-container opponent-dice"></div>
          <div class="dice-count" data-player="1"></div>
        </div>

        <div class="dice-bid-area">
          <div class="dice-current-bid"></div>
        </div>

        <div class="dice-player">
          <div class="dice-label">Your Dice</div>
          <div class="dice-container player-dice"></div>
          <div class="dice-count" data-player="0"></div>
        </div>

        <div class="dice-message"></div>
      </div>
    `;

    this.controlsArea.innerHTML = `
      <div class="bid-controls">
        <div class="bid-input">
          <label>Quantity:</label>
          <button data-qty="-1">-</button>
          <span class="qty-display">1</span>
          <button data-qty="+1">+</button>
        </div>
        <div class="bid-input">
          <label>Face:</label>
          <button data-face="-1">-</button>
          <span class="face-display">${DICE_SYMBOLS[1]}</span>
          <button data-face="+1">+</button>
        </div>
      </div>
      <button data-action="bid" class="btn-primary">Make Bid</button>
      <button data-action="liar" class="btn-primary">Call Liar!</button>
      <button data-action="new-game" class="btn-secondary">New Game</button>
    `;

    this._elements = {
      opponentDice: this.gameArea.querySelector('.opponent-dice'),
      playerDice: this.gameArea.querySelector('.player-dice'),
      opponentCount: this.gameArea.querySelector('[data-player="1"]'),
      playerCount: this.gameArea.querySelector('[data-player="0"]'),
      currentBid: this.gameArea.querySelector('.dice-current-bid'),
      message: this.gameArea.querySelector('.dice-message'),
      qtyDisplay: this.controlsArea.querySelector('.qty-display'),
      faceDisplay: this.controlsArea.querySelector('.face-display')
    };

    // Quantity buttons
    this.controlsArea.querySelector('[data-qty="-1"]').addEventListener('click', () => {
      this._selectedQuantity = Math.max(1, this._selectedQuantity - 1);
      this.updateBidDisplay();
    });
    this.controlsArea.querySelector('[data-qty="+1"]').addEventListener('click', () => {
      this._selectedQuantity = Math.min(this.getTotalDice(), this._selectedQuantity + 1);
      this.updateBidDisplay();
    });

    // Face buttons
    this.controlsArea.querySelector('[data-face="-1"]').addEventListener('click', () => {
      this._selectedFace = Math.max(1, this._selectedFace - 1);
      this.updateBidDisplay();
    });
    this.controlsArea.querySelector('[data-face="+1"]').addEventListener('click', () => {
      this._selectedFace = Math.min(6, this._selectedFace + 1);
      this.updateBidDisplay();
    });

    // Action buttons
    this.controlsArea.querySelector('[data-action="bid"]').addEventListener('click', () => {
      if (this.state.currentPlayer === 0) {
        this.makeBid(this._selectedQuantity, this._selectedFace);
      }
    });
    this.controlsArea.querySelector('[data-action="liar"]').addEventListener('click', () => {
      if (this.state.currentPlayer === 0 && this.state.currentBid) {
        this.callLiar();
      }
    });
    this.controlsArea.querySelector('[data-action="new-game"]').addEventListener('click', () => {
      this.resetGame();
    });
  }

  updateBidDisplay() {
    if (this._elements) {
      this._elements.qtyDisplay.textContent = this._selectedQuantity;
      this._elements.faceDisplay.textContent = DICE_SYMBOLS[this._selectedFace - 1];
    }
  }

  updateDisplay() {
    if (!this.state || !this._elements) return;

    const isPlayerTurn = this.state.currentPlayer === 0 && this.state.phase === 'bid';
    const showOpponentDice = this.state.phase === 'complete';

    // Render dice
    this._elements.playerDice.innerHTML = this.state.players[0].dice
      .map(d => `<span class="die">${DICE_SYMBOLS[d - 1]}</span>`).join('');

    this._elements.opponentDice.innerHTML = this.state.players[1].dice
      .map(d => showOpponentDice ?
        `<span class="die">${DICE_SYMBOLS[d - 1]}</span>` :
        `<span class="die hidden">?</span>`
      ).join('');

    // Dice counts
    this._elements.playerCount.textContent = `${this.state.players[0].diceCount} dice`;
    this._elements.opponentCount.textContent = `${this.state.players[1].diceCount} dice`;

    // Current bid
    if (this.state.currentBid) {
      const { quantity, face } = this.state.currentBid;
      this._elements.currentBid.textContent = `Current Bid: ${quantity}x ${DICE_SYMBOLS[face - 1]}`;
    } else {
      this._elements.currentBid.textContent = 'No bid yet';
    }

    // Update bid controls
    this.updateBidDisplay();

    // Enable/disable buttons
    const btnBid = this.controlsArea.querySelector('[data-action="bid"]');
    const btnLiar = this.controlsArea.querySelector('[data-action="liar"]');

    btnBid.disabled = !isPlayerTurn || !this.isValidBid(this._selectedQuantity, this._selectedFace);
    btnLiar.disabled = !isPlayerTurn || !this.state.currentBid;

    // Message
    if (this.state.phase === 'complete') {
      this._elements.message.textContent = this.state.winner === 0 ? 'You win!' : 'Opponent wins!';
      this._elements.message.className = 'dice-message ' + (this.state.winner === 0 ? 'win' : 'lose');
    } else if (isPlayerTurn) {
      this._elements.message.textContent = this.state.currentBid ?
        'Make a higher bid or call Liar!' : 'Make the first bid';
      this._elements.message.className = 'dice-message';
    } else {
      this._elements.message.textContent = "Opponent's turn...";
      this._elements.message.className = 'dice-message';
    }
  }

  // ============================================================================
  // Training Interface
  // ============================================================================

  get name() { return 'liars-dice'; }
  get actionSpace() { return { n: 61 }; } // 0=liar, 1-60=bids (qty 1-10, face 1-6)
  getActionLabels() {
    const labels = { 0: 'Call Liar' };
    let idx = 1;
    for (let q = 1; q <= 10; q++) {
      for (let f = 1; f <= 6; f++) {
        labels[idx++] = `Bid ${q}x${f}`;
      }
    }
    return labels;
  }
  getActionCount() { return 61; }

  getState() {
    if (!this.state) return {};
    return {
      currentPlayer: this.state.currentPlayer,
      currentBid: this.state.currentBid,
      players: this.state.players.map(p => ({
        diceCount: p.diceCount
      })),
      winner: this.state.winner,
      phase: this.state.phase
    };
  }

  async reset(seed = null) {
    this.resetGame(seed);
    return this.getState();
  }

  async step(action) {
    if (this.state.phase === 'complete') {
      return { observation: this.getState(), reward: 0, terminated: true, truncated: false, info: {} };
    }

    if (action === 0 && this.state.currentBid) {
      this.callLiar();
    } else if (action > 0) {
      const bidIdx = action - 1;
      const quantity = Math.floor(bidIdx / 6) + 1;
      const face = (bidIdx % 6) + 1;
      this.makeBid(quantity, face);
    }

    let reward = 0;
    if (this.state.phase === 'complete') {
      reward = this.state.winner === 0 ? 1 : -1;
    }

    return {
      observation: this.getState(),
      reward,
      terminated: this.state.phase === 'complete',
      truncated: false,
      info: {}
    };
  }
}
