/**
 * Coup - Bluffing Card Game for HyperToken Playground
 *
 * Players bluff about role cards to take powerful actions.
 * Challenge claims at your own risk - if wrong, you lose influence.
 *
 * Roles:
 * - Duke: Tax (take 3 coins), blocks Foreign Aid
 * - Assassin: Assassinate (pay 3, target loses influence)
 * - Captain: Steal (take 2 from another), blocks stealing
 * - Ambassador: Exchange cards, blocks stealing
 * - Contessa: Blocks assassination
 *
 * Last player with influence wins.
 *
 * @implements {GymCompatibleGame}
 */

const ROLES = ['duke', 'assassin', 'captain', 'ambassador', 'contessa'];
const ROLE_SYMBOLS = {
  duke: 'D', assassin: 'A', captain: 'C', ambassador: 'M', contessa: 'S'
};
const ROLE_COLORS = {
  duke: '#9b59b6', assassin: '#2c3e50', captain: '#3498db',
  ambassador: '#27ae60', contessa: '#e74c3c'
};

const STARTING_COINS = 2;
const COUP_COST = 7;
const ASSASSINATE_COST = 3;
const CARDS_PER_ROLE = 3;

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

export class CoupGame {
  constructor({ gameArea, controlsArea, log }) {
    this.gameArea = gameArea;
    this.controlsArea = controlsArea;
    this.log = log;

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

    // Create deck (3 of each role)
    const deck = [];
    for (const role of ROLES) {
      for (let i = 0; i < CARDS_PER_ROLE; i++) {
        deck.push(role);
      }
    }
    const shuffledDeck = this.rng.shuffle(deck);

    // Deal 2 cards to each player
    this.state = {
      players: [
        {
          coins: STARTING_COINS,
          cards: [
            { role: shuffledDeck.pop(), revealed: false },
            { role: shuffledDeck.pop(), revealed: false }
          ],
          alive: true
        },
        {
          coins: STARTING_COINS,
          cards: [
            { role: shuffledDeck.pop(), revealed: false },
            { role: shuffledDeck.pop(), revealed: false }
          ],
          alive: true
        }
      ],
      deck: shuffledDeck,
      currentPlayer: 0,
      phase: 'action',
      pendingAction: null,
      pendingBlock: null,
      mustLoseInfluence: null,
      winner: null,
      lastAction: null,
      turnNumber: 0
    };

    this.updateDisplay();
    this.log('Coup: New game started. Choose your action.');
  }

  getInfluence(playerIndex) {
    return this.state.players[playerIndex].cards.filter(c => !c.revealed).length;
  }

  hasRole(playerIndex, role) {
    return this.state.players[playerIndex].cards.some(c => !c.revealed && c.role === role);
  }

  loseInfluence(playerIndex, cardIndex = null) {
    const player = this.state.players[playerIndex];
    const unrevealed = player.cards.filter(c => !c.revealed);

    if (unrevealed.length === 0) return;

    // If cardIndex not specified, lose first unrevealed card
    if (cardIndex === null) {
      const card = unrevealed[0];
      card.revealed = true;
    } else {
      player.cards[cardIndex].revealed = true;
    }

    // Check if eliminated
    if (this.getInfluence(playerIndex) === 0) {
      player.alive = false;
      this.state.winner = 1 - playerIndex;
      this.state.phase = 'complete';
      this.log(`Coup: Player ${playerIndex === 0 ? 'You' : 'Opponent'} eliminated! ${playerIndex === 0 ? 'Opponent' : 'You'} wins!`);
    }
  }

  // Actions
  doIncome() {
    this.state.players[this.state.currentPlayer].coins += 1;
    this.log(`Coup: ${this.state.currentPlayer === 0 ? 'You' : 'Opponent'} took income (1 coin).`);
    this.endTurn();
  }

  doForeignAid() {
    // Can be blocked by Duke
    this.state.pendingAction = { type: 'foreign_aid', player: this.state.currentPlayer };
    this.state.phase = 'block';
    this.log(`Coup: ${this.state.currentPlayer === 0 ? 'You' : 'Opponent'} attempts Foreign Aid.`);

    if (this.state.currentPlayer === 0) {
      // Wait for AI to decide to block or not
      setTimeout(() => this.aiRespondToAction(), 500);
    }
    this.updateDisplay();
  }

  doTax() {
    // Duke action - can be challenged
    this.state.pendingAction = { type: 'tax', player: this.state.currentPlayer, claimedRole: 'duke' };
    this.state.phase = 'challenge';
    this.log(`Coup: ${this.state.currentPlayer === 0 ? 'You' : 'Opponent'} claims Duke, attempts Tax.`);

    if (this.state.currentPlayer === 0) {
      setTimeout(() => this.aiRespondToAction(), 500);
    }
    this.updateDisplay();
  }

  doCoup(target) {
    const player = this.state.players[this.state.currentPlayer];
    if (player.coins < COUP_COST) {
      this.log('Coup: Not enough coins for Coup.');
      return;
    }
    player.coins -= COUP_COST;
    this.loseInfluence(target);
    this.log(`Coup: ${this.state.currentPlayer === 0 ? 'You' : 'Opponent'} launched Coup!`);

    if (this.state.phase !== 'complete') {
      this.endTurn();
    }
  }

  doSteal(target) {
    // Captain action - can be challenged or blocked
    this.state.pendingAction = { type: 'steal', player: this.state.currentPlayer, target, claimedRole: 'captain' };
    this.state.phase = 'challenge';
    this.log(`Coup: ${this.state.currentPlayer === 0 ? 'You' : 'Opponent'} claims Captain, attempts to Steal.`);

    if (this.state.currentPlayer === 0) {
      setTimeout(() => this.aiRespondToAction(), 500);
    }
    this.updateDisplay();
  }

  doAssassinate(target) {
    const player = this.state.players[this.state.currentPlayer];
    if (player.coins < ASSASSINATE_COST) {
      this.log('Coup: Not enough coins for Assassinate.');
      return;
    }
    player.coins -= ASSASSINATE_COST;
    this.state.pendingAction = { type: 'assassinate', player: this.state.currentPlayer, target, claimedRole: 'assassin' };
    this.state.phase = 'challenge';
    this.log(`Coup: ${this.state.currentPlayer === 0 ? 'You' : 'Opponent'} claims Assassin, attempts Assassination.`);

    if (this.state.currentPlayer === 0) {
      setTimeout(() => this.aiRespondToAction(), 500);
    }
    this.updateDisplay();
  }

  // Challenge/Block handling
  challenge(challenger) {
    const action = this.state.pendingAction || this.state.pendingBlock;
    if (!action) return;

    const defender = action.player;
    const claimedRole = action.claimedRole;

    this.log(`Coup: ${challenger === 0 ? 'You' : 'Opponent'} challenges the claim of ${claimedRole}!`);

    if (this.hasRole(defender, claimedRole)) {
      // Challenge fails - challenger loses influence
      this.log(`Coup: Challenge failed! ${challenger === 0 ? 'You' : 'Opponent'} revealed ${claimedRole}.`);
      this.loseInfluence(challenger);

      // Defender returns card to deck and draws new one
      const defenderPlayer = this.state.players[defender];
      const cardIndex = defenderPlayer.cards.findIndex(c => !c.revealed && c.role === claimedRole);
      if (cardIndex >= 0) {
        this.state.deck.push(defenderPlayer.cards[cardIndex].role);
        this.state.deck = this.rng.shuffle(this.state.deck);
        defenderPlayer.cards[cardIndex].role = this.state.deck.pop();
      }

      // Action proceeds
      this.resolveAction();
    } else {
      // Challenge succeeds - defender loses influence
      this.log(`Coup: Challenge succeeded! They didn't have ${claimedRole}.`);
      this.loseInfluence(defender);

      // Action fails
      this.state.pendingAction = null;
      this.state.pendingBlock = null;
      if (this.state.phase !== 'complete') {
        this.endTurn();
      }
    }
  }

  passChallenge() {
    // No challenge - action proceeds (or goes to block phase)
    if (this.state.phase === 'challenge') {
      const action = this.state.pendingAction;
      if (action.type === 'steal' || action.type === 'assassinate') {
        // Target can block
        this.state.phase = 'block';
        if (this.state.currentPlayer === 0) {
          setTimeout(() => this.aiRespondToAction(), 500);
        }
      } else {
        this.resolveAction();
      }
    } else if (this.state.phase === 'block') {
      // No block - action proceeds
      this.resolveAction();
    }
    this.updateDisplay();
  }

  block(blocker, claimedRole) {
    this.state.pendingBlock = { player: blocker, claimedRole };
    this.state.phase = 'block_challenge';
    this.log(`Coup: ${blocker === 0 ? 'You' : 'Opponent'} claims ${claimedRole} to block!`);

    if (blocker === 1) {
      // Player can challenge AI's block
      this.updateDisplay();
    } else {
      // AI can challenge player's block
      setTimeout(() => this.aiRespondToBlock(), 500);
    }
  }

  passBlock() {
    // Block succeeds - action fails
    this.state.pendingAction = null;
    this.state.pendingBlock = null;
    this.state.phase = 'action';
    this.log('Coup: Block succeeded. Action failed.');
    this.endTurn();
  }

  resolveAction() {
    const action = this.state.pendingAction;
    if (!action) {
      this.endTurn();
      return;
    }

    switch (action.type) {
      case 'tax':
        this.state.players[action.player].coins += 3;
        this.log(`Coup: Tax successful - gained 3 coins.`);
        break;
      case 'foreign_aid':
        this.state.players[action.player].coins += 2;
        this.log(`Coup: Foreign Aid successful - gained 2 coins.`);
        break;
      case 'steal':
        const stolen = Math.min(2, this.state.players[action.target].coins);
        this.state.players[action.target].coins -= stolen;
        this.state.players[action.player].coins += stolen;
        this.log(`Coup: Steal successful - took ${stolen} coins.`);
        break;
      case 'assassinate':
        this.loseInfluence(action.target);
        this.log(`Coup: Assassination successful.`);
        break;
    }

    this.state.pendingAction = null;
    if (this.state.phase !== 'complete') {
      this.endTurn();
    }
  }

  endTurn() {
    this.state.phase = 'action';
    this.state.pendingAction = null;
    this.state.pendingBlock = null;
    this.state.turnNumber++;
    this.state.currentPlayer = 1 - this.state.currentPlayer;

    // Check if game over
    if (this.state.players[0].alive && !this.state.players[1].alive) {
      this.state.winner = 0;
      this.state.phase = 'complete';
    } else if (!this.state.players[0].alive && this.state.players[1].alive) {
      this.state.winner = 1;
      this.state.phase = 'complete';
    }

    this.updateDisplay();

    // AI's turn
    if (this.state.currentPlayer === 1 && this.state.phase === 'action') {
      setTimeout(() => this.aiTurn(), 500);
    }
  }

  // AI Logic
  aiTurn() {
    if (this.state.currentPlayer !== 1) return;
    if (this.state.phase !== 'action') return;

    const ai = this.state.players[1];
    const player = this.state.players[0];

    // Must coup if 10+ coins
    if (ai.coins >= 10) {
      this.doCoup(0);
      return;
    }

    // Coup if possible and advantageous
    if (ai.coins >= COUP_COST && this.getInfluence(0) <= 1) {
      this.doCoup(0);
      return;
    }

    // Assassinate if possible
    if (ai.coins >= ASSASSINATE_COST && this.hasRole(1, 'assassin')) {
      this.doAssassinate(0);
      return;
    }

    // Tax if have Duke
    if (this.hasRole(1, 'duke')) {
      this.doTax();
      return;
    }

    // Steal if have Captain and target has coins
    if (this.hasRole(1, 'captain') && player.coins >= 2) {
      this.doSteal(0);
      return;
    }

    // Otherwise take income
    this.doIncome();
  }

  aiRespondToAction() {
    if (this.state.phase === 'challenge') {
      // Decide whether to challenge player's claim
      // Simple: 30% chance to challenge bluffs
      if (Math.random() < 0.3) {
        this.challenge(1);
      } else {
        this.passChallenge();
      }
    } else if (this.state.phase === 'block') {
      const action = this.state.pendingAction;
      // Decide whether to block
      if (action.type === 'foreign_aid' && this.hasRole(1, 'duke')) {
        this.block(1, 'duke');
      } else if (action.type === 'steal' && (this.hasRole(1, 'captain') || this.hasRole(1, 'ambassador'))) {
        this.block(1, this.hasRole(1, 'captain') ? 'captain' : 'ambassador');
      } else if (action.type === 'assassinate' && this.hasRole(1, 'contessa')) {
        this.block(1, 'contessa');
      } else {
        this.passChallenge();
      }
    }
  }

  aiRespondToBlock() {
    // Decide whether to challenge player's block
    if (Math.random() < 0.3) {
      this.challenge(1);
    } else {
      this.passBlock();
    }
  }

  // ============================================================================
  // UI Rendering
  // ============================================================================

  render() {
    this.gameArea.innerHTML = `
      <div class="coup-game">
        <div class="coup-opponent">
          <div class="coup-label">Opponent</div>
          <div class="coup-cards" data-player="1"></div>
          <div class="coup-coins" data-player="1"></div>
        </div>

        <div class="coup-player">
          <div class="coup-label">You</div>
          <div class="coup-cards" data-player="0"></div>
          <div class="coup-coins" data-player="0"></div>
        </div>

        <div class="coup-message"></div>
      </div>
    `;

    this.controlsArea.innerHTML = `
      <button data-action="income" class="btn-secondary">Income</button>
      <button data-action="foreign_aid" class="btn-secondary">Foreign Aid</button>
      <button data-action="tax" class="btn-primary">Tax (Duke)</button>
      <button data-action="steal" class="btn-primary">Steal (Captain)</button>
      <button data-action="assassinate" class="btn-primary">Assassinate</button>
      <button data-action="coup" class="btn-primary">Coup</button>
      <button data-action="challenge" class="btn-secondary" style="display:none">Challenge</button>
      <button data-action="pass" class="btn-secondary" style="display:none">Pass</button>
      <button data-action="block" class="btn-secondary" style="display:none">Block</button>
      <button data-action="new-game" class="btn-secondary">New Game</button>
    `;

    this._elements = {
      opponentCards: this.gameArea.querySelector('[data-player="1"].coup-cards'),
      playerCards: this.gameArea.querySelector('[data-player="0"].coup-cards'),
      opponentCoins: this.gameArea.querySelector('[data-player="1"].coup-coins'),
      playerCoins: this.gameArea.querySelector('[data-player="0"].coup-coins'),
      message: this.gameArea.querySelector('.coup-message'),
      btnIncome: this.controlsArea.querySelector('[data-action="income"]'),
      btnForeignAid: this.controlsArea.querySelector('[data-action="foreign_aid"]'),
      btnTax: this.controlsArea.querySelector('[data-action="tax"]'),
      btnSteal: this.controlsArea.querySelector('[data-action="steal"]'),
      btnAssassinate: this.controlsArea.querySelector('[data-action="assassinate"]'),
      btnCoup: this.controlsArea.querySelector('[data-action="coup"]'),
      btnChallenge: this.controlsArea.querySelector('[data-action="challenge"]'),
      btnPass: this.controlsArea.querySelector('[data-action="pass"]'),
      btnBlock: this.controlsArea.querySelector('[data-action="block"]'),
      btnNewGame: this.controlsArea.querySelector('[data-action="new-game"]')
    };

    this._elements.btnIncome.addEventListener('click', () => this.doIncome());
    this._elements.btnForeignAid.addEventListener('click', () => this.doForeignAid());
    this._elements.btnTax.addEventListener('click', () => this.doTax());
    this._elements.btnSteal.addEventListener('click', () => this.doSteal(1));
    this._elements.btnAssassinate.addEventListener('click', () => this.doAssassinate(1));
    this._elements.btnCoup.addEventListener('click', () => this.doCoup(1));
    this._elements.btnChallenge.addEventListener('click', () => this.challenge(0));
    this._elements.btnPass.addEventListener('click', () => {
      if (this.state.phase === 'block_challenge') {
        this.passBlock();
      } else {
        this.passChallenge();
      }
    });
    this._elements.btnBlock.addEventListener('click', () => {
      const action = this.state.pendingAction;
      if (action?.type === 'foreign_aid') this.block(0, 'duke');
      else if (action?.type === 'steal') this.block(0, 'captain');
      else if (action?.type === 'assassinate') this.block(0, 'contessa');
    });
    this._elements.btnNewGame.addEventListener('click', () => this.resetGame());
  }

  updateDisplay() {
    if (!this.state || !this._elements) return;

    const isPlayerTurn = this.state.currentPlayer === 0;
    const isActionPhase = this.state.phase === 'action';
    const isChallengePhase = this.state.phase === 'challenge' || this.state.phase === 'block_challenge';
    const isBlockPhase = this.state.phase === 'block';

    // Render cards
    for (let p = 0; p < 2; p++) {
      const container = p === 0 ? this._elements.playerCards : this._elements.opponentCards;
      const player = this.state.players[p];

      container.innerHTML = player.cards.map(card => {
        const color = ROLE_COLORS[card.role];
        const symbol = ROLE_SYMBOLS[card.role];
        const revealed = card.revealed;

        if (p === 0 || revealed) {
          return `<div class="coup-card ${revealed ? 'revealed' : ''}" style="background:${color}">
            <span class="coup-role">${card.role}</span>
            <span class="coup-symbol">${symbol}</span>
          </div>`;
        } else {
          return `<div class="coup-card hidden">?</div>`;
        }
      }).join('');
    }

    // Coins
    this._elements.playerCoins.textContent = `Coins: ${this.state.players[0].coins}`;
    this._elements.opponentCoins.textContent = `Coins: ${this.state.players[1].coins}`;

    // Update action buttons visibility
    const showActions = isPlayerTurn && isActionPhase;
    this._elements.btnIncome.style.display = showActions ? '' : 'none';
    this._elements.btnForeignAid.style.display = showActions ? '' : 'none';
    this._elements.btnTax.style.display = showActions ? '' : 'none';
    this._elements.btnSteal.style.display = showActions ? '' : 'none';
    this._elements.btnAssassinate.style.display = showActions ? '' : 'none';
    this._elements.btnCoup.style.display = showActions ? '' : 'none';

    // Disable buttons based on coins
    this._elements.btnAssassinate.disabled = this.state.players[0].coins < ASSASSINATE_COST;
    this._elements.btnCoup.disabled = this.state.players[0].coins < COUP_COST;

    // Must coup at 10+
    if (this.state.players[0].coins >= 10) {
      this._elements.btnIncome.disabled = true;
      this._elements.btnForeignAid.disabled = true;
      this._elements.btnTax.disabled = true;
      this._elements.btnSteal.disabled = true;
      this._elements.btnAssassinate.disabled = true;
    }

    // Challenge/Pass/Block buttons
    const showChallenge = !isPlayerTurn && isChallengePhase;
    const showBlock = !isPlayerTurn && isBlockPhase && this.state.pendingAction?.target === 0;

    this._elements.btnChallenge.style.display = showChallenge ? '' : 'none';
    this._elements.btnPass.style.display = (showChallenge || showBlock) ? '' : 'none';
    this._elements.btnBlock.style.display = showBlock ? '' : 'none';

    // Message
    if (this.state.phase === 'complete') {
      this._elements.message.textContent = this.state.winner === 0 ? 'You win!' : 'Opponent wins!';
      this._elements.message.className = 'coup-message ' + (this.state.winner === 0 ? 'win' : 'lose');
    } else if (isChallengePhase && !isPlayerTurn) {
      this._elements.message.textContent = 'Opponent made a claim. Challenge or pass?';
      this._elements.message.className = 'coup-message';
    } else if (isBlockPhase && this.state.pendingAction?.target === 0) {
      this._elements.message.textContent = `You can block with ${this.getBlockRoles(this.state.pendingAction.type)}`;
      this._elements.message.className = 'coup-message';
    } else if (isPlayerTurn && isActionPhase) {
      this._elements.message.textContent = 'Your turn - choose an action';
      this._elements.message.className = 'coup-message';
    } else {
      this._elements.message.textContent = "Opponent's turn...";
      this._elements.message.className = 'coup-message';
    }
  }

  getBlockRoles(actionType) {
    const blocks = {
      foreign_aid: 'Duke',
      steal: 'Captain/Ambassador',
      assassinate: 'Contessa'
    };
    return blocks[actionType] || '';
  }

  // ============================================================================
  // Training Interface
  // ============================================================================

  get name() { return 'coup'; }
  get actionSpace() { return { n: 10 }; }
  getActionLabels() {
    return {
      0: 'Income', 1: 'Foreign Aid', 2: 'Tax', 3: 'Steal',
      4: 'Assassinate', 5: 'Coup', 6: 'Challenge', 7: 'Pass', 8: 'Block', 9: 'Exchange'
    };
  }
  getActionCount() { return 10; }

  getState() {
    if (!this.state) return {};
    return {
      phase: this.state.phase,
      currentPlayer: this.state.currentPlayer,
      players: this.state.players.map(p => ({
        coins: p.coins,
        influence: p.cards.filter(c => !c.revealed).length,
        alive: p.alive
      })),
      winner: this.state.winner,
      pendingAction: this.state.pendingAction
    };
  }

  async reset(seed = null) {
    this.resetGame(seed);
    return this.getState();
  }

  async step(action) {
    // Simplified step for training
    if (this.state.phase === 'complete') {
      return { observation: this.getState(), reward: 0, terminated: true, truncated: false, info: {} };
    }

    // Map action to game action
    if (this.state.phase === 'action' && this.state.currentPlayer === 0) {
      switch (action) {
        case 0: this.doIncome(); break;
        case 1: this.doForeignAid(); break;
        case 2: this.doTax(); break;
        case 3: this.doSteal(1); break;
        case 4: this.doAssassinate(1); break;
        case 5: this.doCoup(1); break;
      }
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
