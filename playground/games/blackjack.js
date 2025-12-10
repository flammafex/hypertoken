/**
 * Blackjack game for playground
 */

export class BlackjackGame {
  constructor({ gameArea, controlsArea, log }) {
    this.gameArea = gameArea;
    this.controlsArea = controlsArea;
    this.log = log;

    this.deck = [];
    this.playerHand = [];
    this.dealerHand = [];
    this.gameOver = false;
  }

  init() {
    this.render();
    this.deal();
  }

  cleanup() {
    this.gameArea.innerHTML = '';
    this.controlsArea.innerHTML = '';
  }

  render() {
    this.gameArea.innerHTML = `
      <div class="hand">
        <div class="hand-label">Dealer</div>
        <div id="dealer-cards"></div>
        <div id="dealer-value"></div>
      </div>
      <div class="hand">
        <div class="hand-label">You</div>
        <div id="player-cards"></div>
        <div id="player-value"></div>
      </div>
      <div id="result"></div>
    `;

    this.controlsArea.innerHTML = `
      <button id="btn-hit" class="btn-primary">Hit</button>
      <button id="btn-stand" class="btn-secondary">Stand</button>
      <button id="btn-deal" class="btn-secondary">New Hand</button>
    `;

    // Event listeners
    document.getElementById('btn-hit').addEventListener('click', () => this.hit());
    document.getElementById('btn-stand').addEventListener('click', () => this.stand());
    document.getElementById('btn-deal').addEventListener('click', () => this.deal());
  }

  createDeck() {
    const suits = ['spades', 'hearts', 'diams', 'clubs'];
    const suitSymbols = { spades: '\u2660', hearts: '\u2665', diams: '\u2666', clubs: '\u2663' };
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    this.deck = [];

    for (const suit of suits) {
      for (const rank of ranks) {
        let value = parseInt(rank);
        if (rank === 'A') value = 11;
        else if (['J', 'Q', 'K'].includes(rank)) value = 10;
        this.deck.push({ rank, suit, symbol: suitSymbols[suit], value });
      }
    }

    // Shuffle
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  deal() {
    this.createDeck();
    this.playerHand = [this.deck.pop(), this.deck.pop()];
    this.dealerHand = [this.deck.pop(), this.deck.pop()];
    this.gameOver = false;

    document.getElementById('btn-hit').disabled = false;
    document.getElementById('btn-stand').disabled = false;
    document.getElementById('result').textContent = '';

    this.updateDisplay(false);

    // Check for natural blackjack
    if (this.getValue(this.playerHand) === 21) {
      this.stand();
    }
  }

  hit() {
    if (this.gameOver) return;

    this.playerHand.push(this.deck.pop());
    this.updateDisplay(false);

    if (this.getValue(this.playerHand) > 21) {
      this.endGame('bust');
    } else if (this.getValue(this.playerHand) === 21) {
      this.stand();
    }
  }

  stand() {
    if (this.gameOver) return;

    // Dealer plays
    while (this.getValue(this.dealerHand) < 17) {
      this.dealerHand.push(this.deck.pop());
    }

    this.updateDisplay(true);

    const playerValue = this.getValue(this.playerHand);
    const dealerValue = this.getValue(this.dealerHand);

    if (dealerValue > 21) {
      this.endGame('dealer-bust');
    } else if (playerValue > dealerValue) {
      this.endGame('win');
    } else if (playerValue < dealerValue) {
      this.endGame('lose');
    } else {
      this.endGame('push');
    }
  }

  getValue(hand) {
    let value = hand.reduce((sum, card) => sum + card.value, 0);
    let aces = hand.filter(c => c.rank === 'A').length;

    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }

    return value;
  }

  endGame(result) {
    this.gameOver = true;
    document.getElementById('btn-hit').disabled = true;
    document.getElementById('btn-stand').disabled = true;

    const resultEl = document.getElementById('result');
    const messages = {
      'bust': 'Bust! You lose.',
      'dealer-bust': 'Dealer busts! You win!',
      'win': 'You win!',
      'lose': 'Dealer wins.',
      'push': 'Push (tie).'
    };

    resultEl.textContent = messages[result];
    this.log(`Blackjack: ${messages[result]}`);
  }

  updateDisplay(showDealer) {
    const cardHTML = (card, hidden = false) => {
      if (hidden) return '<div class="card hidden">?</div>';
      const isRed = ['hearts', 'diams'].includes(card.suit);
      return `<div class="card ${isRed ? 'red' : ''}">${card.rank}${card.symbol}</div>`;
    };

    document.getElementById('player-cards').innerHTML =
      this.playerHand.map(c => cardHTML(c)).join('');
    document.getElementById('player-value').textContent =
      `Value: ${this.getValue(this.playerHand)}`;

    document.getElementById('dealer-cards').innerHTML =
      this.dealerHand.map((c, i) => cardHTML(c, i === 1 && !showDealer)).join('');
    document.getElementById('dealer-value').textContent =
      showDealer ? `Value: ${this.getValue(this.dealerHand)}` : '';
  }

  // === Training Interface ===

  async runEpisode() {
    this.deal();

    let reward = 0;
    let win = false;

    // Simple policy: hit if < 17
    while (!this.gameOver) {
      const value = this.getValue(this.playerHand);

      if (value < 17) {
        this.hit();
      } else {
        this.stand();
      }
    }

    // Calculate reward
    const playerValue = this.getValue(this.playerHand);
    const dealerValue = this.getValue(this.dealerHand);

    if (playerValue > 21) {
      reward = -1;
    } else if (dealerValue > 21 || playerValue > dealerValue) {
      reward = 1;
      win = true;
    } else if (playerValue < dealerValue) {
      reward = -1;
    } else {
      reward = 0;
    }

    return { reward, win };
  }
}
