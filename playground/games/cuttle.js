/**
 * Cuttle - Combat Card Game for HyperToken Playground
 *
 * A 2-player card game where players race to accumulate 21+ points
 * while disrupting opponents using one-off effects, permanents, and scuttling.
 *
 * Card abilities:
 * - A-10: Point cards (worth their rank, A=1)
 * - A: One-off - Move all point cards to scrap
 * - 2: One-off - Destroy a permanent OR counter a one-off
 * - 3: One-off - Retrieve a card from scrap pile
 * - 4: One-off - Opponent discards 2 cards
 * - 5: One-off - Draw 2 cards
 * - 6: One-off - Move all permanents to scrap
 * - 7: One-off - Draw and immediately play a card
 * - 8: Permanent - Opponent's hand is revealed ("glasses")
 * - 9: One-off - Return a card to controller's hand
 * - 10: Point card only (no special effect)
 * - J: Permanent - Take control of target point card
 * - Q: Permanent - Protect your other cards from targeting
 * - K: Permanent - Reduce point goal (21 -> 14 -> 10 -> 7 -> 5)
 *
 * Win: First to reach point goal wins. Draw if 3 consecutive passes.
 *
 * @implements {GymCompatibleGame}
 */

// ============================================================================
// Constants
// ============================================================================

const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_SYMBOLS = { clubs: '\u2663', diamonds: '\u2666', hearts: '\u2665', spades: '\u2660' };
const HAND_LIMIT = 8;
const BASE_GOAL = 21;
const KING_GOALS = [14, 10, 7, 5]; // 1K, 2K, 3K, 4K

// ============================================================================
// Utility Functions
// ============================================================================

function getRankValue(rank) {
  if (rank === 'A') return 1;
  if (rank === 'J') return 11;
  if (rank === 'Q') return 12;
  if (rank === 'K') return 13;
  return parseInt(rank);
}

function getPointValue(rank) {
  const value = getRankValue(rank);
  return value <= 10 ? value : 0;
}

function getSuitValue(suit) {
  return SUITS.indexOf(suit);
}

function canScuttle(attacker, target) {
  const attackerValue = getRankValue(attacker.rank);
  const targetValue = getRankValue(target.rank);
  if (attackerValue > targetValue) return true;
  if (attackerValue === targetValue) {
    return getSuitValue(attacker.suit) > getSuitValue(target.suit);
  }
  return false;
}

function isPointRank(rank) {
  const value = getRankValue(rank);
  return value >= 1 && value <= 10;
}

function cardToString(card) {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

// Seeded random for reproducibility
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

// ============================================================================
// CuttleGame Class
// ============================================================================

export class CuttleGame {
  constructor({ gameArea, controlsArea, log }) {
    this.gameArea = gameArea;
    this.controlsArea = controlsArea;
    this.log = log;

    this.rng = new SeededRandom();
    this.state = null;
    this._elements = null;
    this._selectedCard = null;
    this._actionMode = null; // 'point', 'oneoff', 'permanent', 'scuttle', 'target'
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
    let id = 0;
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ rank, suit, id: id++ });
      }
    }
    const shuffledDeck = this.rng.shuffle(deck);

    // Setup players
    const players = [
      { hand: [], pointCards: [], permanents: [] },
      { hand: [], pointCards: [], permanents: [] }
    ];

    // Deal: player 1 (non-dealer) gets 5, player 0 (dealer) gets 6
    for (let i = 0; i < 5; i++) {
      players[1].hand.push(shuffledDeck.pop());
    }
    for (let i = 0; i < 6; i++) {
      players[0].hand.push(shuffledDeck.pop());
    }

    this.state = {
      players,
      deck: shuffledDeck,
      scrap: [],
      currentPlayer: 1, // Non-dealer goes first
      phase: 'play',
      pendingOneOff: null,
      sevenDrawnCard: null,
      discardCount: 0,
      consecutivePasses: 0,
      winner: null,
      isDraw: false,
      lastAction: null,
      turnNumber: 0
    };

    this._selectedCard = null;
    this._actionMode = null;
    this.updateDisplay();
    this.log('Cuttle: New game started. Player 1 goes first.');
  }

  // ============================================================================
  // Game Logic
  // ============================================================================

  getPointGoal(playerIndex) {
    const kingCount = this.state.players[playerIndex].permanents.filter(p => p.type === 'king').length;
    if (kingCount === 0) return BASE_GOAL;
    return KING_GOALS[Math.min(kingCount - 1, KING_GOALS.length - 1)];
  }

  getPoints(playerIndex) {
    let points = 0;
    for (const player of this.state.players) {
      for (const pc of player.pointCards) {
        if (pc.controller === playerIndex) {
          points += getPointValue(pc.card.rank);
        }
      }
    }
    return points;
  }

  isProtected(playerIndex, cardId) {
    const player = this.state.players[playerIndex];
    const queens = player.permanents.filter(p => p.type === 'queen');
    if (queens.length === 0) return false;
    // Queens protect everything except themselves (but 2+ queens protect each other)
    const isQueen = queens.some(q => q.card.id === cardId);
    if (isQueen && queens.length === 1) return false;
    return true;
  }

  checkWinCondition() {
    for (let i = 0; i < 2; i++) {
      const points = this.getPoints(i);
      const goal = this.getPointGoal(i);
      if (points >= goal) {
        this.state.winner = i;
        this.state.phase = 'complete';
        this.log(`Cuttle: Player ${i} wins with ${points}/${goal} points!`);
        return true;
      }
    }

    if (this.state.consecutivePasses >= 3) {
      this.state.isDraw = true;
      this.state.phase = 'complete';
      this.log('Cuttle: Game is a draw (3 consecutive passes).');
      return true;
    }

    return false;
  }

  advanceTurn() {
    this.state.currentPlayer = 1 - this.state.currentPlayer;
    this.state.turnNumber++;
  }

  // ============================================================================
  // Actions
  // ============================================================================

  draw() {
    if (this.state.phase !== 'play') return false;
    if (this.state.deck.length === 0) return false;

    const player = this.state.players[this.state.currentPlayer];
    if (player.hand.length >= HAND_LIMIT) {
      this.log('Cuttle: Hand limit reached, cannot draw.');
      return false;
    }

    const card = this.state.deck.pop();
    player.hand.push(card);
    this.state.consecutivePasses = 0;
    this.state.lastAction = `Player ${this.state.currentPlayer} drew a card`;
    this.log(`Cuttle: Player ${this.state.currentPlayer} drew a card.`);

    this.advanceTurn();
    this.updateDisplay();
    return true;
  }

  pass() {
    if (this.state.phase !== 'play') return false;
    if (this.state.deck.length > 0) {
      this.log('Cuttle: Cannot pass while deck has cards.');
      return false;
    }

    this.state.consecutivePasses++;
    this.state.lastAction = `Player ${this.state.currentPlayer} passed`;
    this.log(`Cuttle: Player ${this.state.currentPlayer} passed.`);

    if (!this.checkWinCondition()) {
      this.advanceTurn();
    }
    this.updateDisplay();
    return true;
  }

  playPoint(cardId) {
    const player = this.state.players[this.state.currentPlayer];
    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return false;

    const card = player.hand.splice(cardIndex, 1)[0];
    if (!isPointRank(card.rank)) return false;

    player.pointCards.push({
      card,
      attachedJacks: [],
      controller: this.state.currentPlayer
    });

    this.state.consecutivePasses = 0;
    this.state.lastAction = `Player ${this.state.currentPlayer} played ${cardToString(card)} for points`;
    this.log(`Cuttle: Player ${this.state.currentPlayer} played ${cardToString(card)} for ${getPointValue(card.rank)} points.`);

    if (!this.checkWinCondition()) {
      this.advanceTurn();
    }
    this.updateDisplay();
    return true;
  }

  playScuttle(attackerId, targetId) {
    const player = this.state.players[this.state.currentPlayer];
    const opponent = this.state.players[1 - this.state.currentPlayer];

    const attackerIndex = player.hand.findIndex(c => c.id === attackerId);
    if (attackerIndex === -1) return false;

    const attacker = player.hand[attackerIndex];
    if (!isPointRank(attacker.rank)) return false;

    // Find target in opponent's point cards
    let targetPc = null;
    let targetPcIndex = -1;
    for (let i = 0; i < opponent.pointCards.length; i++) {
      if (opponent.pointCards[i].card.id === targetId && opponent.pointCards[i].controller === (1 - this.state.currentPlayer)) {
        targetPc = opponent.pointCards[i];
        targetPcIndex = i;
        break;
      }
    }
    if (!targetPc) return false;

    // Check protection
    if (this.isProtected(1 - this.state.currentPlayer, targetId)) {
      this.log('Cuttle: Target is protected by Queen.');
      return false;
    }

    if (!canScuttle(attacker, targetPc.card)) {
      this.log('Cuttle: Card cannot scuttle that target.');
      return false;
    }

    // Execute scuttle
    player.hand.splice(attackerIndex, 1);
    opponent.pointCards.splice(targetPcIndex, 1);
    this.state.scrap.push(attacker, targetPc.card);

    this.state.consecutivePasses = 0;
    this.state.lastAction = `Player ${this.state.currentPlayer} scuttled ${cardToString(targetPc.card)} with ${cardToString(attacker)}`;
    this.log(`Cuttle: Player ${this.state.currentPlayer} scuttled ${cardToString(targetPc.card)} with ${cardToString(attacker)}.`);

    this.advanceTurn();
    this.updateDisplay();
    return true;
  }

  playPermanent(cardId, targetId = null, destPlayer = null) {
    const player = this.state.players[this.state.currentPlayer];
    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return false;

    const card = player.hand[cardIndex];

    if (card.rank === '8' || card.rank === 'Q' || card.rank === 'K') {
      // Simple permanent
      player.hand.splice(cardIndex, 1);
      player.permanents.push({
        card,
        type: card.rank === '8' ? 'eight' : card.rank === 'Q' ? 'queen' : 'king'
      });

      this.state.consecutivePasses = 0;
      this.state.lastAction = `Player ${this.state.currentPlayer} played ${cardToString(card)} as permanent`;
      this.log(`Cuttle: Player ${this.state.currentPlayer} played ${cardToString(card)} as permanent.`);

      if (!this.checkWinCondition()) {
        this.advanceTurn();
      }
      this.updateDisplay();
      return true;
    }

    if (card.rank === 'J') {
      // Jack - steal a point card
      if (targetId === null) return false;

      const opponent = this.state.players[1 - this.state.currentPlayer];
      let targetPc = null;
      for (const pc of opponent.pointCards) {
        if (pc.card.id === targetId && pc.controller === (1 - this.state.currentPlayer)) {
          targetPc = pc;
          break;
        }
      }
      if (!targetPc) return false;

      if (this.isProtected(1 - this.state.currentPlayer, targetId)) {
        this.log('Cuttle: Target is protected by Queen.');
        return false;
      }

      player.hand.splice(cardIndex, 1);
      targetPc.attachedJacks.push(card);
      targetPc.controller = this.state.currentPlayer;

      this.state.consecutivePasses = 0;
      this.state.lastAction = `Player ${this.state.currentPlayer} stole ${cardToString(targetPc.card)} with Jack`;
      this.log(`Cuttle: Player ${this.state.currentPlayer} stole ${cardToString(targetPc.card)} with Jack.`);

      if (!this.checkWinCondition()) {
        this.advanceTurn();
      }
      this.updateDisplay();
      return true;
    }

    return false;
  }

  playOneOff(cardId, targetType = null, targetId = null) {
    const player = this.state.players[this.state.currentPlayer];
    const opponent = this.state.players[1 - this.state.currentPlayer];
    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return false;

    const card = player.hand[cardIndex];

    switch (card.rank) {
      case 'A': {
        // Scrap all point cards
        const allPointCards = [];
        for (const p of this.state.players) {
          for (const pc of p.pointCards) {
            allPointCards.push(pc.card);
            for (const j of pc.attachedJacks) {
              allPointCards.push(j);
            }
          }
          p.pointCards = [];
        }
        this.state.scrap.push(card, ...allPointCards);
        player.hand.splice(cardIndex, 1);
        this.log(`Cuttle: Player ${this.state.currentPlayer} played Ace - all point cards scrapped!`);
        break;
      }

      case '2': {
        // Destroy a permanent
        if (targetId === null) return false;

        // Find the permanent
        let found = false;
        for (const p of this.state.players) {
          const permIndex = p.permanents.findIndex(pm => pm.card.id === targetId);
          if (permIndex !== -1) {
            const perm = p.permanents.splice(permIndex, 1)[0];
            this.state.scrap.push(card, perm.card);
            player.hand.splice(cardIndex, 1);
            this.log(`Cuttle: Player ${this.state.currentPlayer} destroyed ${cardToString(perm.card)} with Two.`);
            found = true;
            break;
          }
          // Check attached jacks
          for (const pc of p.pointCards) {
            const jackIndex = pc.attachedJacks.findIndex(j => j.id === targetId);
            if (jackIndex !== -1) {
              const jack = pc.attachedJacks.splice(jackIndex, 1)[0];
              // Recalculate controller
              pc.controller = pc.attachedJacks.length % 2 === 0
                ? this.state.players.indexOf(p)
                : 1 - this.state.players.indexOf(p);
              this.state.scrap.push(card, jack);
              player.hand.splice(cardIndex, 1);
              this.log(`Cuttle: Player ${this.state.currentPlayer} destroyed Jack with Two.`);
              found = true;
              break;
            }
          }
          if (found) break;
        }
        if (!found) return false;
        break;
      }

      case '3': {
        // Retrieve from scrap - for now just take the top card
        if (this.state.scrap.length === 0) return false;
        const retrieved = this.state.scrap.pop();
        player.hand.push(retrieved);
        this.state.scrap.push(card);
        player.hand.splice(cardIndex, 1);
        this.log(`Cuttle: Player ${this.state.currentPlayer} retrieved ${cardToString(retrieved)} from scrap.`);
        break;
      }

      case '4': {
        // Opponent discards 2
        if (opponent.hand.length === 0) return false;
        const toDiscard = Math.min(2, opponent.hand.length);
        // For AI: discard random cards
        for (let i = 0; i < toDiscard; i++) {
          const idx = Math.floor(this.rng.next() * opponent.hand.length);
          const discarded = opponent.hand.splice(idx, 1)[0];
          this.state.scrap.push(discarded);
        }
        this.state.scrap.push(card);
        player.hand.splice(cardIndex, 1);
        this.log(`Cuttle: Player ${this.state.currentPlayer} played Four - opponent discarded ${toDiscard} cards.`);
        break;
      }

      case '5': {
        // Draw 2
        if (this.state.deck.length === 0) return false;
        const toDraw = Math.min(2, this.state.deck.length);
        for (let i = 0; i < toDraw; i++) {
          player.hand.push(this.state.deck.pop());
        }
        this.state.scrap.push(card);
        player.hand.splice(cardIndex, 1);
        this.log(`Cuttle: Player ${this.state.currentPlayer} played Five - drew ${toDraw} cards.`);
        break;
      }

      case '6': {
        // Scrap all permanents
        const allPerms = [];
        for (const p of this.state.players) {
          for (const perm of p.permanents) {
            allPerms.push(perm.card);
          }
          p.permanents = [];
        }
        // Also scrap attached jacks
        for (const p of this.state.players) {
          for (const pc of p.pointCards) {
            for (const j of pc.attachedJacks) {
              allPerms.push(j);
            }
            pc.attachedJacks = [];
            // Reset controller to original owner
            pc.controller = this.state.players.indexOf(p);
          }
        }
        this.state.scrap.push(card, ...allPerms);
        player.hand.splice(cardIndex, 1);
        this.log(`Cuttle: Player ${this.state.currentPlayer} played Six - all permanents scrapped!`);
        break;
      }

      case '7': {
        // Draw and play - simplified for playground
        if (this.state.deck.length === 0) return false;
        const drawn = this.state.deck.pop();
        // Auto-play as point if possible
        if (isPointRank(drawn.rank)) {
          player.pointCards.push({
            card: drawn,
            attachedJacks: [],
            controller: this.state.currentPlayer
          });
          this.log(`Cuttle: Player ${this.state.currentPlayer} played Seven - drew and played ${cardToString(drawn)} for points.`);
        } else {
          this.state.scrap.push(drawn);
          this.log(`Cuttle: Player ${this.state.currentPlayer} played Seven - drew ${cardToString(drawn)}, scrapped.`);
        }
        this.state.scrap.push(card);
        player.hand.splice(cardIndex, 1);
        break;
      }

      case '9': {
        // Return target to hand
        if (targetId === null) return false;

        // Find the target
        let found = false;
        for (const p of this.state.players) {
          const pIdx = this.state.players.indexOf(p);

          // Check permanents
          const permIndex = p.permanents.findIndex(pm => pm.card.id === targetId);
          if (permIndex !== -1 && !this.isProtected(pIdx, targetId)) {
            const perm = p.permanents.splice(permIndex, 1)[0];
            p.hand.push(perm.card);
            this.state.scrap.push(card);
            player.hand.splice(cardIndex, 1);
            this.log(`Cuttle: Player ${this.state.currentPlayer} returned ${cardToString(perm.card)} to hand.`);
            found = true;
            break;
          }

          // Check attached jacks
          for (const pc of p.pointCards) {
            const jackIndex = pc.attachedJacks.findIndex(j => j.id === targetId);
            if (jackIndex !== -1) {
              const jackController = pc.attachedJacks.length % 2 === 1 ? (1 - pIdx) : pIdx;
              if (!this.isProtected(jackController, targetId)) {
                const jack = pc.attachedJacks.splice(jackIndex, 1)[0];
                // Return to jack's controller
                this.state.players[jackController].hand.push(jack);
                // Recalculate point card controller
                pc.controller = pc.attachedJacks.length % 2 === 0 ? pIdx : (1 - pIdx);
                this.state.scrap.push(card);
                player.hand.splice(cardIndex, 1);
                this.log(`Cuttle: Player ${this.state.currentPlayer} returned Jack to hand.`);
                found = true;
                break;
              }
            }
          }
          if (found) break;
        }
        if (!found) return false;
        break;
      }

      default:
        return false;
    }

    this.state.consecutivePasses = 0;
    this.state.lastAction = `Player ${this.state.currentPlayer} played ${cardToString(card)} as one-off`;

    if (!this.checkWinCondition()) {
      this.advanceTurn();
    }
    this.updateDisplay();
    return true;
  }

  // ============================================================================
  // UI Rendering
  // ============================================================================

  render() {
    this.gameArea.innerHTML = `
      <div class="cuttle-game">
        <div class="cuttle-opponent">
          <div class="cuttle-label">Opponent</div>
          <div class="cuttle-field">
            <div class="cuttle-permanents" data-player="1"></div>
            <div class="cuttle-points" data-player="1"></div>
          </div>
          <div class="cuttle-hand opponent-hand" data-player="1"></div>
          <div class="cuttle-score" data-player="1"></div>
        </div>

        <div class="cuttle-center">
          <div class="cuttle-deck">
            <div class="cuttle-deck-count"></div>
          </div>
          <div class="cuttle-scrap">
            <div class="cuttle-scrap-count"></div>
          </div>
        </div>

        <div class="cuttle-player">
          <div class="cuttle-label">You</div>
          <div class="cuttle-field">
            <div class="cuttle-permanents" data-player="0"></div>
            <div class="cuttle-points" data-player="0"></div>
          </div>
          <div class="cuttle-hand player-hand" data-player="0"></div>
          <div class="cuttle-score" data-player="0"></div>
        </div>

        <div class="cuttle-message"></div>
      </div>
    `;

    this.controlsArea.innerHTML = `
      <button data-action="draw" class="btn-primary">Draw</button>
      <button data-action="pass" class="btn-secondary">Pass</button>
      <button data-action="cancel" class="btn-secondary" style="display:none">Cancel</button>
      <button data-action="new-game" class="btn-secondary">New Game</button>
    `;

    // Cache elements
    this._elements = {
      opponentHand: this.gameArea.querySelector('.cuttle-hand[data-player="1"]'),
      playerHand: this.gameArea.querySelector('.cuttle-hand[data-player="0"]'),
      opponentPerms: this.gameArea.querySelector('.cuttle-permanents[data-player="1"]'),
      playerPerms: this.gameArea.querySelector('.cuttle-permanents[data-player="0"]'),
      opponentPoints: this.gameArea.querySelector('.cuttle-points[data-player="1"]'),
      playerPoints: this.gameArea.querySelector('.cuttle-points[data-player="0"]'),
      opponentScore: this.gameArea.querySelector('.cuttle-score[data-player="1"]'),
      playerScore: this.gameArea.querySelector('.cuttle-score[data-player="0"]'),
      deckCount: this.gameArea.querySelector('.cuttle-deck-count'),
      scrapCount: this.gameArea.querySelector('.cuttle-scrap-count'),
      message: this.gameArea.querySelector('.cuttle-message'),
      btnDraw: this.controlsArea.querySelector('[data-action="draw"]'),
      btnPass: this.controlsArea.querySelector('[data-action="pass"]'),
      btnCancel: this.controlsArea.querySelector('[data-action="cancel"]'),
      btnNewGame: this.controlsArea.querySelector('[data-action="new-game"]')
    };

    // Event listeners
    this._elements.btnDraw.addEventListener('click', () => {
      if (this.state.currentPlayer === 0) this.draw();
    });
    this._elements.btnPass.addEventListener('click', () => {
      if (this.state.currentPlayer === 0) this.pass();
    });
    this._elements.btnCancel.addEventListener('click', () => {
      this.cancelSelection();
    });
    this._elements.btnNewGame.addEventListener('click', () => {
      this.resetGame();
    });
  }

  updateDisplay() {
    if (!this.state || !this._elements) return;

    const isPlayerTurn = this.state.currentPlayer === 0;

    // Update hands
    this.renderHand(0, this._elements.playerHand, true);
    this.renderHand(1, this._elements.opponentHand, false);

    // Update fields
    this.renderField(0);
    this.renderField(1);

    // Update deck/scrap
    this._elements.deckCount.textContent = `Deck: ${this.state.deck.length}`;
    this._elements.scrapCount.textContent = `Scrap: ${this.state.scrap.length}`;

    // Update scores
    for (let i = 0; i < 2; i++) {
      const scoreEl = i === 0 ? this._elements.playerScore : this._elements.opponentScore;
      const points = this.getPoints(i);
      const goal = this.getPointGoal(i);
      scoreEl.textContent = `${points}/${goal} points`;
    }

    // Update controls
    this._elements.btnDraw.disabled = !isPlayerTurn || this.state.deck.length === 0 ||
      this.state.players[0].hand.length >= HAND_LIMIT || this.state.phase !== 'play';
    this._elements.btnPass.disabled = !isPlayerTurn || this.state.deck.length > 0 || this.state.phase !== 'play';

    // Update message
    if (this.state.winner !== null) {
      this._elements.message.textContent = this.state.winner === 0 ? 'You win!' : 'Opponent wins!';
      this._elements.message.className = 'cuttle-message ' + (this.state.winner === 0 ? 'win' : 'lose');
    } else if (this.state.isDraw) {
      this._elements.message.textContent = 'Game is a draw!';
      this._elements.message.className = 'cuttle-message draw';
    } else if (isPlayerTurn) {
      this._elements.message.textContent = this._actionMode ?
        `Select target for ${this._actionMode}` : 'Your turn - select a card to play';
      this._elements.message.className = 'cuttle-message';
    } else {
      this._elements.message.textContent = "Opponent's turn...";
      this._elements.message.className = 'cuttle-message';
      // AI plays after a short delay
      if (this.state.phase === 'play') {
        setTimeout(() => this.aiPlay(), 500);
      }
    }
  }

  renderHand(playerIndex, container, interactive) {
    const hand = this.state.players[playerIndex].hand;
    const isPlayerTurn = this.state.currentPlayer === playerIndex;

    container.innerHTML = hand.map(card => {
      const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
      const isSelected = this._selectedCard?.id === card.id;
      const canPlay = interactive && isPlayerTurn && this.state.phase === 'play';

      return `<div class="card cuttle-card ${isRed ? 'red' : ''} ${isSelected ? 'selected' : ''} ${canPlay ? 'playable' : ''}"
                   data-card-id="${card.id}"
                   ${!interactive ? 'style="transform: rotateY(180deg);"' : ''}>
                ${interactive ? `${card.rank}${SUIT_SYMBOLS[card.suit]}` : '?'}
              </div>`;
    }).join('');

    if (interactive) {
      container.querySelectorAll('.card').forEach(cardEl => {
        cardEl.addEventListener('click', () => {
          const cardId = parseInt(cardEl.dataset.cardId);
          this.handleCardClick(cardId);
        });
      });
    }
  }

  renderField(playerIndex) {
    const player = this.state.players[playerIndex];
    const permsContainer = playerIndex === 0 ? this._elements.playerPerms : this._elements.opponentPerms;
    const pointsContainer = playerIndex === 0 ? this._elements.playerPoints : this._elements.opponentPoints;

    // Render permanents
    permsContainer.innerHTML = player.permanents.map(perm => {
      const isRed = perm.card.suit === 'hearts' || perm.card.suit === 'diamonds';
      return `<div class="card cuttle-card small ${isRed ? 'red' : ''}"
                   data-card-id="${perm.card.id}" data-type="permanent">
                ${perm.card.rank}${SUIT_SYMBOLS[perm.card.suit]}
              </div>`;
    }).join('');

    // Render point cards (only those controlled by this player)
    const controlledPoints = player.pointCards.filter(pc => pc.controller === playerIndex);
    pointsContainer.innerHTML = controlledPoints.map(pc => {
      const isRed = pc.card.suit === 'hearts' || pc.card.suit === 'diamonds';
      const jacks = pc.attachedJacks.length > 0 ? `<span class="jack-count">J×${pc.attachedJacks.length}</span>` : '';
      return `<div class="card cuttle-card small ${isRed ? 'red' : ''}"
                   data-card-id="${pc.card.id}" data-type="point">
                ${pc.card.rank}${SUIT_SYMBOLS[pc.card.suit]}${jacks}
              </div>`;
    }).join('');

    // Add click handlers for targeting
    [...permsContainer.querySelectorAll('.card'), ...pointsContainer.querySelectorAll('.card')].forEach(cardEl => {
      cardEl.addEventListener('click', () => {
        const cardId = parseInt(cardEl.dataset.cardId);
        this.handleTargetClick(cardId, playerIndex, cardEl.dataset.type);
      });
    });
  }

  handleCardClick(cardId) {
    if (this.state.currentPlayer !== 0 || this.state.phase !== 'play') return;

    const player = this.state.players[0];
    const card = player.hand.find(c => c.id === cardId);
    if (!card) return;

    if (this._selectedCard?.id === cardId) {
      // Same card - show action menu
      this.showCardActions(card);
    } else {
      // Select card
      this._selectedCard = card;
      this._actionMode = null;
      this.updateDisplay();
    }
  }

  showCardActions(card) {
    const actions = [];

    if (isPointRank(card.rank)) {
      actions.push({ label: 'Play for Points', action: () => this.playPoint(card.id) });

      // Check if can scuttle
      const opponent = this.state.players[1];
      const targets = opponent.pointCards.filter(pc =>
        pc.controller === 1 && canScuttle(card, pc.card) && !this.isProtected(1, pc.card.id)
      );
      if (targets.length > 0) {
        actions.push({ label: 'Scuttle', action: () => this.startScuttle(card) });
      }
    }

    // One-off actions
    if (['A', '2', '3', '4', '5', '6', '7', '9'].includes(card.rank)) {
      const canPlayOneOff = this.canPlayOneOff(card);
      if (canPlayOneOff) {
        actions.push({ label: 'Play as One-Off', action: () => this.startOneOff(card) });
      }
    }

    // Permanent actions
    if (['8', 'Q', 'K'].includes(card.rank)) {
      actions.push({ label: 'Play as Permanent', action: () => this.playPermanent(card.id) });
    }
    if (card.rank === 'J') {
      const opponent = this.state.players[1];
      const targets = opponent.pointCards.filter(pc =>
        pc.controller === 1 && !this.isProtected(1, pc.card.id)
      );
      if (targets.length > 0) {
        actions.push({ label: 'Steal Point Card', action: () => this.startJack(card) });
      }
    }

    if (actions.length === 1) {
      actions[0].action();
    } else if (actions.length > 1) {
      // For simplicity, just do the first available action
      // In a full implementation, we'd show a menu
      actions[0].action();
    }

    this._selectedCard = null;
    this._actionMode = null;
  }

  canPlayOneOff(card) {
    switch (card.rank) {
      case 'A': return this.state.players.some(p => p.pointCards.length > 0);
      case '2': return this.state.players.some(p => p.permanents.length > 0) ||
                       this.state.players.some(p => p.pointCards.some(pc => pc.attachedJacks.length > 0));
      case '3': return this.state.scrap.length > 0;
      case '4': return this.state.players[1].hand.length > 0;
      case '5': return this.state.deck.length > 0;
      case '6': return this.state.players.some(p => p.permanents.length > 0);
      case '7': return this.state.deck.length > 0;
      case '9': return this.state.players.some(p => p.permanents.length > 0) ||
                       this.state.players.some(p => p.pointCards.some(pc => pc.attachedJacks.length > 0));
      default: return false;
    }
  }

  startScuttle(card) {
    this._selectedCard = card;
    this._actionMode = 'scuttle';
    this._elements.btnCancel.style.display = '';
    this.updateDisplay();
  }

  startOneOff(card) {
    if (['A', '3', '4', '5', '6', '7'].includes(card.rank)) {
      // No target needed
      this.playOneOff(card.id);
    } else {
      // Need target (2, 9)
      this._selectedCard = card;
      this._actionMode = 'oneoff';
      this._elements.btnCancel.style.display = '';
      this.updateDisplay();
    }
  }

  startJack(card) {
    this._selectedCard = card;
    this._actionMode = 'jack';
    this._elements.btnCancel.style.display = '';
    this.updateDisplay();
  }

  handleTargetClick(cardId, playerIndex, type) {
    if (!this._actionMode || !this._selectedCard) return;

    if (this._actionMode === 'scuttle' && playerIndex === 1 && type === 'point') {
      this.playScuttle(this._selectedCard.id, cardId);
    } else if (this._actionMode === 'oneoff' && (type === 'permanent' || type === 'point')) {
      this.playOneOff(this._selectedCard.id, type, cardId);
    } else if (this._actionMode === 'jack' && playerIndex === 1 && type === 'point') {
      this.playPermanent(this._selectedCard.id, cardId);
    }

    this.cancelSelection();
  }

  cancelSelection() {
    this._selectedCard = null;
    this._actionMode = null;
    this._elements.btnCancel.style.display = 'none';
    this.updateDisplay();
  }

  // ============================================================================
  // AI Player
  // ============================================================================

  aiPlay() {
    if (this.state.currentPlayer !== 1 || this.state.phase !== 'play') return;
    if (this.state.winner !== null || this.state.isDraw) return;

    const player = this.state.players[1];
    const opponent = this.state.players[0];

    // Simple AI strategy
    // 1. Play high point cards
    const pointCards = player.hand.filter(c => isPointRank(c.rank)).sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank));
    if (pointCards.length > 0) {
      // Check if playing highest point card would win
      const highCard = pointCards[0];
      const currentPoints = this.getPoints(1);
      const goal = this.getPointGoal(1);
      if (currentPoints + getPointValue(highCard.rank) >= goal) {
        this.playPoint(highCard.id);
        return;
      }
    }

    // 2. Try to scuttle high value opponent cards
    for (const card of pointCards) {
      for (const pc of opponent.pointCards) {
        if (pc.controller === 0 && canScuttle(card, pc.card) && !this.isProtected(0, pc.card.id)) {
          this.playScuttle(card.id, pc.card.id);
          return;
        }
      }
    }

    // 3. Play Kings for point reduction
    const kings = player.hand.filter(c => c.rank === 'K');
    if (kings.length > 0) {
      this.playPermanent(kings[0].id);
      return;
    }

    // 4. Draw if possible
    if (this.state.deck.length > 0 && player.hand.length < HAND_LIMIT) {
      this.draw();
      return;
    }

    // 5. Play any point card
    if (pointCards.length > 0) {
      this.playPoint(pointCards[0].id);
      return;
    }

    // 6. Pass
    if (this.state.deck.length === 0) {
      this.pass();
      return;
    }

    // 7. Draw as fallback
    if (this.state.deck.length > 0) {
      this.draw();
    }
  }

  // ============================================================================
  // Training Interface (Gym-compatible)
  // ============================================================================

  get name() {
    return 'cuttle';
  }

  get actionSpace() {
    return { n: 100 }; // Simplified action space
  }

  getActionLabels() {
    return {
      0: 'Draw',
      1: 'Pass',
      // Dynamic labels for card plays would be generated based on state
    };
  }

  getActionCount() {
    return 100;
  }

  getState() {
    if (!this.state) return {};

    return {
      currentPlayer: this.state.currentPlayer,
      phase: this.state.phase,
      deckSize: this.state.deck.length,
      scrapSize: this.state.scrap.length,
      player0: {
        handSize: this.state.players[0].hand.length,
        points: this.getPoints(0),
        goal: this.getPointGoal(0),
        permanents: this.state.players[0].permanents.map(p => cardToString(p.card)),
        pointCards: this.state.players[0].pointCards
          .filter(pc => pc.controller === 0)
          .map(pc => cardToString(pc.card))
      },
      player1: {
        handSize: this.state.players[1].hand.length,
        points: this.getPoints(1),
        goal: this.getPointGoal(1),
        permanents: this.state.players[1].permanents.map(p => cardToString(p.card)),
        pointCards: this.state.players[1].pointCards
          .filter(pc => pc.controller === 1)
          .map(pc => cardToString(pc.card))
      },
      winner: this.state.winner,
      isDraw: this.state.isDraw
    };
  }

  stateToObservation(state) {
    // Simplified observation for ML
    return new Float32Array([
      state.player0.points / 21,
      state.player0.goal / 21,
      state.player1.points / 21,
      state.player1.goal / 21,
      state.deckSize / 52,
      state.player0.handSize / 8,
      state.player1.handSize / 8,
      state.currentPlayer,
      state.winner !== null ? 1 : 0
    ]);
  }

  getHeuristicPolicy(state) {
    // Simple heuristic: prefer playing point cards
    const probs = new Array(this.getActionCount()).fill(0.01);
    probs[0] = 0.3; // Draw
    return probs;
  }

  async reset(seed = null) {
    this.resetGame(seed);
    return this.getState();
  }

  async step(action) {
    // Simplified step function
    const prevGameOver = this.state.winner !== null || this.state.isDraw;

    if (prevGameOver) {
      return {
        observation: this.getState(),
        reward: 0,
        terminated: true,
        truncated: false,
        info: { message: 'Game already over' }
      };
    }

    // Action 0 = draw, 1 = pass, others = play cards
    if (action === 0) {
      this.draw();
    } else if (action === 1) {
      this.pass();
    } else {
      // For training, map action to card play
      const player = this.state.players[this.state.currentPlayer];
      if (player.hand.length > 0) {
        const cardIndex = (action - 2) % player.hand.length;
        const card = player.hand[cardIndex];
        if (isPointRank(card.rank)) {
          this.playPoint(card.id);
        } else {
          this.draw(); // Fallback
        }
      }
    }

    // Calculate reward
    let reward = 0;
    if (this.state.winner === 0) {
      reward = 1;
    } else if (this.state.winner === 1) {
      reward = -1;
    } else if (this.state.isDraw) {
      reward = 0;
    }

    return {
      observation: this.getState(),
      reward,
      terminated: this.state.winner !== null || this.state.isDraw,
      truncated: false,
      info: {
        player0Points: this.getPoints(0),
        player1Points: this.getPoints(1)
      }
    };
  }

  async runEpisode() {
    await this.reset();

    const trajectory = [];
    let totalReward = 0;

    while (this.state.winner === null && !this.state.isDraw) {
      const state = this.getState();
      const action = 0; // Simple: always draw

      const result = await this.step(action);

      trajectory.push({
        state,
        action,
        reward: result.reward,
        nextState: result.observation
      });

      totalReward += result.reward;
    }

    return {
      reward: totalReward,
      win: this.state.winner === 0,
      trajectory,
      initialState: trajectory[0]?.state,
      finalState: this.getState(),
      steps: trajectory
    };
  }
}
