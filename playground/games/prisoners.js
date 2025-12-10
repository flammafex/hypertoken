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
    this.gameArea.innerHTML = `
      <div class="pd-matrix">
        <div class="pd-cell pd-header"></div>
        <div class="pd-cell pd-header">Opponent: Cooperate</div>
        <div class="pd-cell pd-header">Opponent: Defect</div>

        <div class="pd-cell pd-header">You: Cooperate</div>
        <div class="pd-cell" id="cc">3, 3</div>
        <div class="pd-cell" id="cd">0, 5</div>

        <div class="pd-cell pd-header">You: Defect</div>
        <div class="pd-cell" id="dc">5, 0</div>
        <div class="pd-cell" id="dd">1, 1</div>
      </div>

      <div style="margin-top: 2rem; text-align: center;">
        <div id="pd-scores" style="font-size: 1.2rem; margin-bottom: 1rem;"></div>
        <div id="pd-history" style="font-family: monospace; color: #888;"></div>
        <div id="pd-result" style="margin-top: 1rem; font-size: 1.1rem;"></div>
      </div>
    `;

    this.controlsArea.innerHTML = `
      <button id="btn-cooperate" class="btn-primary">Cooperate</button>
      <button id="btn-defect" class="btn-secondary">Defect</button>
      <button id="btn-reset" class="btn-secondary">Reset</button>
    `;

    document.getElementById('btn-cooperate').addEventListener('click', () => this.play('C'));
    document.getElementById('btn-defect').addEventListener('click', () => this.play('D'));
    document.getElementById('btn-reset').addEventListener('click', () => this.reset());
  }

  reset() {
    this.history = [];
    this.scores = { player: 0, opponent: 0 };
    this.updateDisplay();
    this.enableButtons(true);
  }

  enableButtons(enabled) {
    const cooperateBtn = document.getElementById('btn-cooperate');
    const defectBtn = document.getElementById('btn-defect');
    if (cooperateBtn) cooperateBtn.disabled = !enabled;
    if (defectBtn) defectBtn.disabled = !enabled;
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
    document.getElementById('pd-scores').textContent =
      `Your Score: ${this.scores.player} | Opponent Score: ${this.scores.opponent}`;

    document.getElementById('pd-history').textContent =
      this.history.map(h => `${h.player}v${h.opponent}`).join(' ');

    // Highlight cell
    ['cc', 'cd', 'dc', 'dd'].forEach(id => {
      document.getElementById(id).classList.remove('pd-highlight');
    });
    if (highlight) {
      document.getElementById(highlight.toLowerCase()).classList.add('pd-highlight');
    }

    const result = document.getElementById('pd-result');
    if (this.history.length >= this.totalRounds) {
      const winner = this.scores.player > this.scores.opponent ? 'You win!' :
                     this.scores.player < this.scores.opponent ? 'Opponent wins!' : 'Tie!';
      result.textContent = `After ${this.history.length} rounds: ${winner}`;
    } else {
      result.textContent = `Round ${this.history.length + 1} of ${this.totalRounds}`;
    }
  }

  // === Training Interface ===

  async runEpisode() {
    // Simulate 10 rounds with evolving strategy vs Tit-for-Tat
    this.reset();

    // Use a mix of strategies to show learning potential
    const strategies = ['random', 'tit-for-tat', 'always-cooperate', 'always-defect'];
    const strategy = strategies[Math.floor(Math.random() * strategies.length)];

    for (let i = 0; i < this.totalRounds; i++) {
      let playerChoice;

      switch (strategy) {
        case 'random':
          playerChoice = Math.random() < 0.5 ? 'C' : 'D';
          break;
        case 'tit-for-tat':
          playerChoice = this.history.length === 0
            ? 'C'
            : this.history[this.history.length - 1].opponent;
          break;
        case 'always-cooperate':
          playerChoice = 'C';
          break;
        case 'always-defect':
          playerChoice = 'D';
          break;
        default:
          playerChoice = Math.random() < 0.5 ? 'C' : 'D';
      }

      const opponentChoice = this.history.length === 0
        ? 'C'
        : this.history[this.history.length - 1].player;

      const payoffs = { 'CC': [3, 3], 'CD': [0, 5], 'DC': [5, 0], 'DD': [1, 1] };
      const [playerPayoff, opponentPayoff] = payoffs[playerChoice + opponentChoice];

      this.scores.player += playerPayoff;
      this.scores.opponent += opponentPayoff;
      this.history.push({ player: playerChoice, opponent: opponentChoice });
    }

    this.updateDisplay();

    const reward = this.scores.player - this.scores.opponent;
    const win = this.scores.player > this.scores.opponent;

    return { reward, win };
  }
}
