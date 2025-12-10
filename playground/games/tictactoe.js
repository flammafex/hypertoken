/**
 * Tic-Tac-Toe game for playground
 */

export class TicTacToeGame {
  constructor({ gameArea, controlsArea, log }) {
    this.gameArea = gameArea;
    this.controlsArea = controlsArea;
    this.log = log;

    this.board = Array(9).fill(null);
    this.currentPlayer = 'X';
    this.gameOver = false;
    this.winner = null;
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
      <div class="ttt-board" id="ttt-board"></div>
      <div id="ttt-status" style="margin-top: 1rem; font-size: 1.2rem;"></div>
    `;

    this.controlsArea.innerHTML = `
      <button id="btn-reset" class="btn-secondary">New Game</button>
    `;

    document.getElementById('btn-reset').addEventListener('click', () => this.reset());
    this.renderBoard();
  }

  renderBoard() {
    const boardEl = document.getElementById('ttt-board');
    boardEl.innerHTML = this.board.map((cell, i) => `
      <button class="ttt-cell ${cell?.toLowerCase() || ''}" data-index="${i}" ${this.gameOver || cell ? 'disabled' : ''}>
        ${cell || ''}
      </button>
    `).join('');

    boardEl.querySelectorAll('.ttt-cell').forEach(cell => {
      cell.addEventListener('click', () => this.makeMove(parseInt(cell.dataset.index)));
    });

    const status = document.getElementById('ttt-status');
    if (this.gameOver) {
      status.textContent = this.winner ? `${this.winner} wins!` : "It's a draw!";
    } else {
      status.textContent = `${this.currentPlayer}'s turn`;
    }
  }

  reset() {
    this.board = Array(9).fill(null);
    this.currentPlayer = 'X';
    this.gameOver = false;
    this.winner = null;
    this.renderBoard();
  }

  makeMove(index) {
    if (this.gameOver || this.board[index]) return;

    this.board[index] = this.currentPlayer;

    const winner = this.checkWinner();
    if (winner) {
      this.gameOver = true;
      this.winner = winner;
      this.log(`Tic-Tac-Toe: ${winner} wins!`);
    } else if (this.board.every(cell => cell)) {
      this.gameOver = true;
      this.winner = null;
      this.log("Tic-Tac-Toe: Draw!");
    } else {
      this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';

      // AI plays O
      if (this.currentPlayer === 'O' && !this.gameOver) {
        setTimeout(() => this.aiMove(), 300);
      }
    }

    this.renderBoard();
  }

  aiMove() {
    // Simple AI: try to win, block, or random
    const validMoves = this.board
      .map((cell, i) => cell === null ? i : null)
      .filter(i => i !== null);

    if (validMoves.length === 0) return;

    // Try to win
    for (const move of validMoves) {
      this.board[move] = 'O';
      if (this.checkWinner() === 'O') {
        this.board[move] = null;
        this.makeMove(move);
        return;
      }
      this.board[move] = null;
    }

    // Try to block
    for (const move of validMoves) {
      this.board[move] = 'X';
      if (this.checkWinner() === 'X') {
        this.board[move] = null;
        this.makeMove(move);
        return;
      }
      this.board[move] = null;
    }

    // Take center if available
    if (validMoves.includes(4)) {
      this.makeMove(4);
      return;
    }

    // Random move
    const move = validMoves[Math.floor(Math.random() * validMoves.length)];
    this.makeMove(move);
  }

  checkWinner() {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
      [0, 4, 8], [2, 4, 6]              // diagonals
    ];

    for (const [a, b, c] of lines) {
      if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
        return this.board[a];
      }
    }

    return null;
  }

  // === Training Interface ===

  async runEpisode() {
    this.reset();

    // Two players: X uses simple heuristics, O uses random
    while (!this.gameOver) {
      const validMoves = this.board
        .map((cell, i) => cell === null ? i : null)
        .filter(i => i !== null);

      if (validMoves.length === 0) break;

      let move;

      if (this.currentPlayer === 'X') {
        // X tries to win/block/center/random
        move = this.findBestMove(validMoves, 'X', 'O');
      } else {
        // O plays randomly
        move = validMoves[Math.floor(Math.random() * validMoves.length)];
      }

      this.board[move] = this.currentPlayer;

      if (this.checkWinner()) {
        this.gameOver = true;
        this.winner = this.currentPlayer;
      } else if (this.board.every(cell => cell)) {
        this.gameOver = true;
      } else {
        this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
      }
    }

    this.renderBoard();

    // Reward from X's perspective
    let reward = 0;
    let win = false;

    if (this.winner === 'X') {
      reward = 1;
      win = true;
    } else if (this.winner === 'O') {
      reward = -1;
    }

    return { reward, win };
  }

  findBestMove(validMoves, player, opponent) {
    // Try to win
    for (const move of validMoves) {
      this.board[move] = player;
      if (this.checkWinner() === player) {
        this.board[move] = null;
        return move;
      }
      this.board[move] = null;
    }

    // Try to block
    for (const move of validMoves) {
      this.board[move] = opponent;
      if (this.checkWinner() === opponent) {
        this.board[move] = null;
        return move;
      }
      this.board[move] = null;
    }

    // Take center
    if (validMoves.includes(4)) return 4;

    // Take corner
    const corners = [0, 2, 6, 8].filter(c => validMoves.includes(c));
    if (corners.length > 0) {
      return corners[Math.floor(Math.random() * corners.length)];
    }

    // Random
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }
}
