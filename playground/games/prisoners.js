/**
 * Prisoner's Dilemma game for playground
 */

export class PrisonersDilemmaGame {
  constructor({ gameArea, controlsArea, log }) {
    this.gameArea = gameArea;
    this.controlsArea = controlsArea;
    this.log = log;

    this.history = [];
    this.scores = { player: 0, opponent: 0 };
    this.totalRounds = 10;
  }

  init() {
    this.render();
    this.reset();
  }

  cleanup() {
    this.gameArea.innerHTML = '';
    this.controlsArea.innerHTML = '';
  }

  render() {
    // Use data attributes instead of IDs for container-scoped queries
    this.gameArea.innerHTML = `
      <div class="pd-matrix">
        <div class="pd-cell pd-header"></div>
        <div class="pd-cell pd-header">Opponent: Cooperate</div>
        <div class="pd-cell pd-header">Opponent: Defect</div>

        <div class="pd-cell pd-header">You: Cooperate</div>
        <div class="pd-cell" data-outcome="cc">3, 3</div>
        <div class="pd-cell" data-outcome="cd">0, 5</div>

        <div class="pd-cell pd-header">You: Defect</div>
        <div class="pd-cell" data-outcome="dc">5, 0</div>
        <div class="pd-cell" data-outcome="dd">1, 1</div>
      </div>

      <div style="margin-top: 2rem; text-align: center;">
        <div data-element="scores" style="font-size: 1.2rem; margin-bottom: 1rem;"></div>
        <div data-element="history" style="font-family: monospace; color: #888;"></div>
        <div data-element="result" style="margin-top: 1rem; font-size: 1.1rem;"></div>
      </div>
    `;

    this.controlsArea.innerHTML = `
      <button data-action="cooperate" class="btn-primary">Cooperate</button>
      <button data-action="defect" class="btn-secondary">Defect</button>
      <button data-action="reset" class="btn-secondary">Reset</button>
    `;

    // Cache element references using container-scoped queries
    this._elements = {
      scores: this.gameArea.querySelector('[data-element="scores"]'),
      history: this.gameArea.querySelector('[data-element="history"]'),
      result: this.gameArea.querySelector('[data-element="result"]'),
      cellCC: this.gameArea.querySelector('[data-outcome="cc"]'),
      cellCD: this.gameArea.querySelector('[data-outcome="cd"]'),
      cellDC: this.gameArea.querySelector('[data-outcome="dc"]'),
      cellDD: this.gameArea.querySelector('[data-outcome="dd"]'),
      btnCooperate: this.controlsArea.querySelector('[data-action="cooperate"]'),
      btnDefect: this.controlsArea.querySelector('[data-action="defect"]'),
      btnReset: this.controlsArea.querySelector('[data-action="reset"]')
    };

    this._elements.btnCooperate.addEventListener('click', () => this.play('C'));
    this._elements.btnDefect.addEventListener('click', () => this.play('D'));
    this._elements.btnReset.addEventListener('click', () => this.reset());
  }

  reset() {
    this.history = [];
    this.scores = { player: 0, opponent: 0 };
    this.updateDisplay();
    this.enableButtons(true);
  }

  enableButtons(enabled) {
    if (this._elements?.btnCooperate) this._elements.btnCooperate.disabled = !enabled;
    if (this._elements?.btnDefect) this._elements.btnDefect.disabled = !enabled;
  }

  play(playerChoice) {
    if (this.history.length >= this.totalRounds) return;

    // Opponent uses Tit-for-Tat strategy
    const opponentChoice = this.history.length === 0
      ? 'C'
      : this.history[this.history.length - 1].player;

    // Calculate payoffs
    const payoffs = {
      'CC': [3, 3],
      'CD': [0, 5],
      'DC': [5, 0],
      'DD': [1, 1]
    };

    const key = playerChoice + opponentChoice;
    const [playerPayoff, opponentPayoff] = payoffs[key];

    this.scores.player += playerPayoff;
    this.scores.opponent += opponentPayoff;

    this.history.push({ player: playerChoice, opponent: opponentChoice });

    this.log(`PD: You ${playerChoice === 'C' ? 'cooperated' : 'defected'}, ` +
             `Opponent ${opponentChoice === 'C' ? 'cooperated' : 'defected'} -> ` +
             `+${playerPayoff} points`);

    this.updateDisplay(key);

    // Disable buttons when game is over
    if (this.history.length >= this.totalRounds) {
      this.enableButtons(false);
    }
  }

  updateDisplay(highlight = null) {
    this._elements.scores.textContent =
      `Your Score: ${this.scores.player} | Opponent Score: ${this.scores.opponent}`;

    this._elements.history.textContent =
      this.history.map(h => `${h.player}v${h.opponent}`).join(' ');

    // Highlight cell - remove from all first
    this._elements.cellCC.classList.remove('pd-highlight');
    this._elements.cellCD.classList.remove('pd-highlight');
    this._elements.cellDC.classList.remove('pd-highlight');
    this._elements.cellDD.classList.remove('pd-highlight');

    // Add highlight to the relevant cell
    if (highlight) {
      const cellMap = { cc: this._elements.cellCC, cd: this._elements.cellCD, dc: this._elements.cellDC, dd: this._elements.cellDD };
      cellMap[highlight.toLowerCase()]?.classList.add('pd-highlight');
    }

    if (this.history.length >= this.totalRounds) {
      const winner = this.scores.player > this.scores.opponent ? 'You win!' :
                     this.scores.player < this.scores.opponent ? 'Opponent wins!' : 'Tie!';
      this._elements.result.textContent = `After ${this.history.length} rounds: ${winner}`;
    } else {
      this._elements.result.textContent = `Round ${this.history.length + 1} of ${this.totalRounds}`;
    }
  }

  // === Training Interface ===

  // Game name for identification
  get name() {
    return 'prisoners';
  }

  // Action space definition
  get actionSpace() {
    return { n: 2 }; // Cooperate, Defect
  }

  // Get action labels for UI
  getActionLabels() {
    return { 0: 'Cooperate', 1: 'Defect' };
  }

  // Get number of actions
  getActionCount() {
    return 2;
  }

  // Get current game state
  getState() {
    return {
      round: this.history.length,
      totalRounds: this.totalRounds,
      playerScore: this.scores.player,
      opponentScore: this.scores.opponent,
      history: [...this.history],
      lastOpponentMove: this.history.length > 0
        ? this.history[this.history.length - 1].opponent
        : null,
      gameOver: this.history.length >= this.totalRounds
    };
  }

  // Convert state to observation array for ML
  stateToObservation(state) {
    const obs = [
      state.round / state.totalRounds,           // Normalized round
      state.playerScore / (state.totalRounds * 5), // Normalized player score
      state.opponentScore / (state.totalRounds * 5), // Normalized opponent score
      state.lastOpponentMove === 'C' ? 1 : state.lastOpponentMove === 'D' ? 0 : 0.5
    ];

    // Add last 5 opponent moves
    for (let i = 0; i < 5; i++) {
      const idx = state.history.length - 1 - i;
      if (idx >= 0) {
        obs.push(state.history[idx].opponent === 'C' ? 1 : 0);
      } else {
        obs.push(0.5);
      }
    }

    return new Float32Array(obs);
  }

  // Heuristic policy for training (Tit-for-Tat based)
  getHeuristicPolicy(state) {
    // Tit-for-Tat: cooperate if opponent cooperated last, defect otherwise
    if (state.lastOpponentMove === null || state.lastOpponentMove === 'C') {
      return [0.8, 0.2]; // High probability of cooperate
    } else {
      return [0.2, 0.8]; // High probability of defect
    }
  }

  // Reset game and return initial observation (Gym interface)
  async resetGame(seed = null) {
    this.history = [];
    this.scores = { player: 0, opponent: 0 };
    return this.getState();
  }

  // Step function (Gym interface)
  async step(action) {
    if (this.history.length >= this.totalRounds) {
      return {
        observation: this.getState(),
        reward: 0,
        terminated: true,
        truncated: false,
        info: { message: 'Game already over' }
      };
    }

    // Convert action to choice
    const playerChoice = action === 0 ? 'C' : 'D';

    // Opponent uses Tit-for-Tat
    const opponentChoice = this.history.length === 0
      ? 'C'
      : this.history[this.history.length - 1].player;

    // Calculate payoffs
    const payoffs = {
      'CC': [3, 3],
      'CD': [0, 5],
      'DC': [5, 0],
      'DD': [1, 1]
    };

    const key = playerChoice + opponentChoice;
    const [playerPayoff, opponentPayoff] = payoffs[key];

    this.scores.player += playerPayoff;
    this.scores.opponent += opponentPayoff;
    this.history.push({ player: playerChoice, opponent: opponentChoice });

    const terminated = this.history.length >= this.totalRounds;

    return {
      observation: this.getState(),
      reward: playerPayoff - opponentPayoff, // Relative reward
      terminated,
      truncated: false,
      info: {
        playerChoice,
        opponentChoice,
        playerPayoff,
        opponentPayoff,
        round: this.history.length
      }
    };
  }

  async runEpisode() {
    this.reset();

    const trajectory = [];

    // Use a mix of strategies to show learning potential
    const strategies = ['random', 'tit-for-tat', 'always-cooperate', 'always-defect'];
    const strategy = strategies[Math.floor(Math.random() * strategies.length)];

    for (let i = 0; i < this.totalRounds; i++) {
      const state = this.getState();
      let playerChoice;
      let action;

      switch (strategy) {
        case 'random':
          action = Math.random() < 0.5 ? 0 : 1;
          playerChoice = action === 0 ? 'C' : 'D';
          break;
        case 'tit-for-tat':
          const lastOpp = this.history.length === 0
            ? 'C'
            : this.history[this.history.length - 1].opponent;
          playerChoice = lastOpp;
          action = playerChoice === 'C' ? 0 : 1;
          break;
        case 'always-cooperate':
          playerChoice = 'C';
          action = 0;
          break;
        case 'always-defect':
          playerChoice = 'D';
          action = 1;
          break;
        default:
          action = Math.random() < 0.5 ? 0 : 1;
          playerChoice = action === 0 ? 'C' : 'D';
      }

      const opponentChoice = this.history.length === 0
        ? 'C'
        : this.history[this.history.length - 1].player;

      const payoffs = { 'CC': [3, 3], 'CD': [0, 5], 'DC': [5, 0], 'DD': [1, 1] };
      const [playerPayoff, opponentPayoff] = payoffs[playerChoice + opponentChoice];

      this.scores.player += playerPayoff;
      this.scores.opponent += opponentPayoff;
      this.history.push({ player: playerChoice, opponent: opponentChoice });

      trajectory.push({
        state,
        action,
        reward: playerPayoff - opponentPayoff,
        nextState: this.getState()
      });
    }

    this.updateDisplay();

    const totalReward = this.scores.player - this.scores.opponent;
    const win = this.scores.player > this.scores.opponent;

    return {
      reward: totalReward,
      win,
      trajectory,
      initialState: trajectory[0]?.state,
      finalState: this.getState(),
      steps: trajectory
    };
  }
}
