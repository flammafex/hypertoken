/**
 * Tic-Tac-Toe game wrapper for MCP
 */

import { Engine } from '../../engine/Engine.js';

export class TicTacToeGame {
  private engine: Engine;
  private board: (string | null)[] = Array(9).fill(null);
  private currentPlayer: string = 'X';
  private gameOver: boolean = false;
  private winner: string | null = null;

  constructor(engine: Engine) {
    this.engine = engine;
  }

  reset(): string {
    this.board = Array(9).fill(null);
    this.currentPlayer = 'X';
    this.gameOver = false;
    this.winner = null;
    return 'New game started. You are X. Your move!';
  }

  makeMove(position: number): string {
    if (this.gameOver) {
      return 'Game is over. Start a new game!';
    }

    if (position < 0 || position > 8) {
      return 'Invalid position. Use 0-8.';
    }

    if (this.board[position] !== null) {
      return 'That position is already taken!';
    }

    // Player move
    this.board[position] = this.currentPlayer;

    // Check win
    const winner = this.checkWinner();
    if (winner) {
      this.gameOver = true;
      this.winner = winner;
      return `${winner} wins!`;
    }

    // Check draw
    if (this.board.every(cell => cell !== null)) {
      this.gameOver = true;
      return "It's a draw!";
    }

    // AI move (smarter: check for win/block, then center, then corners, then edges)
    this.currentPlayer = 'O';
    const aiMove = this.getAIMove();
    this.board[aiMove] = 'O';

    // Check win again
    const aiWinner = this.checkWinner();
    if (aiWinner) {
      this.gameOver = true;
      this.winner = aiWinner;
      return `O moved to ${aiMove}. O wins!`;
    }

    // Check draw
    if (this.board.every(cell => cell !== null)) {
      this.gameOver = true;
      return `O moved to ${aiMove}. It's a draw!`;
    }

    this.currentPlayer = 'X';
    return `O moved to ${aiMove}. Your turn!`;
  }

  private getAIMove(): number {
    // Check if AI can win
    const winMove = this.findWinningMove('O');
    if (winMove !== -1) return winMove;

    // Block player's winning move
    const blockMove = this.findWinningMove('X');
    if (blockMove !== -1) return blockMove;

    // Prefer center > corners > edges
    const preferences = [4, 0, 2, 6, 8, 1, 3, 5, 7];
    for (const pos of preferences) {
      if (this.board[pos] === null) return pos;
    }
    return 0;
  }

  private findWinningMove(player: string): number {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];

    for (const [a, b, c] of lines) {
      const cells = [this.board[a], this.board[b], this.board[c]];
      const playerCount = cells.filter(cell => cell === player).length;
      const emptyCount = cells.filter(cell => cell === null).length;

      if (playerCount === 2 && emptyCount === 1) {
        // Find the empty cell
        if (this.board[a] === null) return a;
        if (this.board[b] === null) return b;
        if (this.board[c] === null) return c;
      }
    }

    return -1;
  }

  private checkWinner(): string | null {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];

    for (const [a, b, c] of lines) {
      if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
        return this.board[a];
      }
    }

    return null;
  }

  describe(): string {
    const cell = (i: number): string => this.board[i] || String(i);

    let state = `
+---+---+---+
| ${cell(0)} | ${cell(1)} | ${cell(2)} |
+---+---+---+
| ${cell(3)} | ${cell(4)} | ${cell(5)} |
+---+---+---+
| ${cell(6)} | ${cell(7)} | ${cell(8)} |
+---+---+---+`;

    if (this.gameOver) {
      if (this.winner) {
        state += `\n\n${this.winner} wins!`;
      } else {
        state += `\n\nDraw!`;
      }
    } else if (this.board.some(cell => cell !== null)) {
      state += `\n\nYour turn (X). Pick a position (0-8)`;
    } else {
      state += `\n\nStart a new game!`;
    }

    return state;
  }
}
