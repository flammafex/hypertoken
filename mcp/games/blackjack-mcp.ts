/**
 * Blackjack game wrapper for MCP
 */

import { Engine } from '../../engine/Engine.js';

interface Card {
  rank: string;
  suit: string;
  value: number;
  display: string;
}

export class BlackjackGame {
  private engine: Engine;
  private deck: Card[] = [];
  private playerHand: Card[] = [];
  private dealerHand: Card[] = [];
  private gameOver: boolean = false;
  private result: string = '';

  constructor(engine: Engine) {
    this.engine = engine;
  }

  private createDeck(): void {
    const suits = ['\u2660', '\u2665', '\u2666', '\u2663'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    this.deck = [];

    for (const suit of suits) {
      for (const rank of ranks) {
        let value = parseInt(rank);
        if (rank === 'A') value = 11;
        else if (['J', 'Q', 'K'].includes(rank)) value = 10;
        this.deck.push({ rank, suit, value, display: `${rank}${suit}` });
      }
    }

    // Shuffle
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  private getValue(hand: Card[]): number {
    let value = hand.reduce((sum, card) => sum + card.value, 0);
    let aces = hand.filter(c => c.rank === 'A').length;

    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }

    return value;
  }

  deal(): string {
    this.createDeck();
    this.playerHand = [this.deck.pop()!, this.deck.pop()!];
    this.dealerHand = [this.deck.pop()!, this.deck.pop()!];
    this.gameOver = false;
    this.result = '';

    if (this.getValue(this.playerHand) === 21) {
      this.gameOver = true;
      this.result = 'BLACKJACK';
      return 'Blackjack! You win!';
    }

    return 'Cards dealt. Your turn!';
  }

  hit(): string {
    if (this.gameOver) {
      return 'Game is over. Start a new game!';
    }

    const card = this.deck.pop()!;
    this.playerHand.push(card);

    const value = this.getValue(this.playerHand);

    if (value > 21) {
      this.gameOver = true;
      this.result = 'BUST';
      return `You drew ${card.display}. Bust! You went over 21.`;
    }

    if (value === 21) {
      return `You drew ${card.display}. 21! Perfect.`;
    }

    return `You drew ${card.display}.`;
  }

  stand(): string {
    if (this.gameOver) {
      return 'Game is over. Start a new game!';
    }

    // Dealer plays
    while (this.getValue(this.dealerHand) < 17) {
      this.dealerHand.push(this.deck.pop()!);
    }

    const playerValue = this.getValue(this.playerHand);
    const dealerValue = this.getValue(this.dealerHand);

    this.gameOver = true;

    if (dealerValue > 21) {
      this.result = 'WIN';
      return `Dealer busts with ${dealerValue}! You win!`;
    }

    if (playerValue > dealerValue) {
      this.result = 'WIN';
      return `You win! ${playerValue} beats ${dealerValue}.`;
    }

    if (playerValue < dealerValue) {
      this.result = 'LOSE';
      return `Dealer wins. ${dealerValue} beats ${playerValue}.`;
    }

    this.result = 'PUSH';
    return `Push! Both have ${playerValue}.`;
  }

  describe(): string {
    const formatHand = (hand: Card[], hideSecond: boolean = false): string => {
      return hand.map((c, i) => {
        if (hideSecond && i === 1 && !this.gameOver) return '??';
        return c.display;
      }).join(' ');
    };

    const playerValue = this.getValue(this.playerHand);
    const dealerValue = this.gameOver
      ? this.getValue(this.dealerHand)
      : this.dealerHand[0]?.value ?? 0;

    const dealerDisplay = formatHand(this.dealerHand, true);
    const playerDisplay = formatHand(this.playerHand);

    let state = `
+------------------------------+
|         BLACKJACK            |
+------------------------------+
| Dealer: ${dealerDisplay.padEnd(20)}|
| ${this.gameOver ? `Value: ${dealerValue}`.padEnd(28) : `Showing: ${dealerValue}`.padEnd(28)}|
+------------------------------+
| Your Hand: ${playerDisplay.padEnd(17)}|
| Value: ${playerValue.toString().padEnd(22)}|
+------------------------------+`;

    if (this.gameOver) {
      state += `\n\nResult: ${this.result}`;
    } else if (this.playerHand.length > 0) {
      state += `\n\nYour turn: HIT or STAND?`;
    } else {
      state += `\n\nStart a new game!`;
    }

    return state;
  }
}
