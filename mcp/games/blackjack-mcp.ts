/**
 * Blackjack game wrapper for MCP
 *
 * Thin adapter around examples/blackjack/game.js (BlackjackGame), which uses
 * the real HyperToken Engine/Stack/Space/Agent internally. This wrapper just
 * creates a BlackjackGame, calls its methods, and formats the rich state
 * object returned by getGameState() into a readable string for the LLM.
 */

import { BlackjackGame } from '../../examples/blackjack/game.js';

export class BlackjackMCPGame {
  private game: BlackjackGame | null = null;

  /**
   * Accept an Engine for interface compatibility with the MCP server's
   * GameSession — but BlackjackGame creates its own Engine internally,
   * so this argument is intentionally ignored.
   */
  constructor(_engine?: any) {}

  /**
   * Start a new round. Deals two cards to player and dealer.
   */
  deal(): string {
    // BlackjackGame creates its own Engine; seed with Date.now() for variety.
    // Cast options as any: game.js is untyped JS and infers `seed: null` from
    // its default value, which would reject a number.
    this.game = new BlackjackGame({ numStacks: 6, seed: Date.now() } as any);
    this.game.deal();
    return this.describe();
  }

  /**
   * Take another card.
   */
  hit(): string {
    if (!this.game) {
      return 'No game in progress. Call blackjack_new_game first.';
    }
    try {
      this.game.hit();
    } catch (error) {
      return `Cannot hit: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
    return this.describe();
  }

  /**
   * Keep current hand; dealer plays out.
   */
  stand(): string {
    if (!this.game) {
      return 'No game in progress. Call blackjack_new_game first.';
    }
    try {
      this.game.stand();
    } catch (error) {
      return `Cannot stand: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
    return this.describe();
  }

  /**
   * Format the rich game state into a readable string for the LLM.
   */
  describe(): string {
    if (!this.game) {
      return 'No game in progress. Call blackjack_new_game to start.';
    }

    const state = this.game.getGameState();
    const lines: string[] = [];

    lines.push('+------------------------------+');
    lines.push('|          BLACKJACK           |');
    lines.push('+------------------------------+');

    const dealerValue =
      state.dealerHand.value !== null && state.dealerHand.value !== undefined
        ? `Value: ${state.dealerHand.value}`
        : `Showing: ${state.dealerHand.display}`;
    lines.push(`| Dealer: ${String(state.dealerHand.display).padEnd(20)}|`);
    lines.push(`| ${dealerValue.padEnd(28)}|`);

    lines.push('+------------------------------+');
    lines.push(`| Your Hand: ${String(state.agentHand.display).padEnd(17)}|`);
    lines.push(`| Value: ${String(state.agentHand.value).padEnd(22)}|`);
    lines.push('+------------------------------+');

    if (state.gameOver) {
      lines.push('');
      lines.push(`Result: ${this.formatResult(state.result)}`);
    } else {
      const actions: string[] = [];
      if (state.canHit) actions.push('HIT');
      if (state.canStand) actions.push('STAND');
      if (state.canDouble) actions.push('DOUBLE');
      if (state.canSplit) actions.push('SPLIT');
      lines.push('');
      lines.push(`Your turn. Available actions: ${actions.join(', ') || 'none'}`);
    }

    return lines.join('\n');
  }

  private formatResult(result: string | null): string {
    switch (result) {
      case 'agent-blackjack':
        return 'BLACKJACK! You win 3:2!';
      case 'agent':
        return 'You win!';
      case 'dealer':
        return 'Dealer wins.';
      case 'push':
        return 'Push - tie game.';
      case 'surrender':
        return 'Surrendered - half bet returned.';
      default:
        return result ?? 'unknown';
    }
  }
}
