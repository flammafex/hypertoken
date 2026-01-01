# Build Your First Game

This tutorial walks you through building a complete game with HyperToken. You'll create **High Card**, a simple two-player card game where the highest card wins.

**Time:** 15 minutes
**Prerequisites:** Completed [Getting Started](./GETTING_STARTED.md)

## What You'll Learn

- Creating tokens (cards)
- Building a deck with Stack
- Drawing and comparing cards
- Game loop basics
- Adding a simple AI opponent

---

## Step 1: Project Setup

Create a new file in the examples directory:

```bash
mkdir -p examples/high-card
touch examples/high-card/high-card.js
```

Add the basic imports:

```javascript
// examples/high-card/high-card.js
import { Token } from '../../core/Token.js';
import { Stack } from '../../core/Stack.js';
import { Chronicle } from '../../core/Chronicle.js';
import * as readline from 'readline';
```

---

## Step 2: Create the Deck

A standard deck has 52 cards. Let's create them as Tokens:

```javascript
function createDeck() {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const cards = [];

  let index = 0;
  for (const suit of suits) {
    for (const rank of ranks) {
      cards.push(new Token({
        id: `${rank}-${suit}`,
        label: `${rank} of ${suit}`,
        group: suit,
        meta: {
          suit,
          rank,
          // Numeric value for comparison (2=2, ..., A=14)
          value: ranks.indexOf(rank) + 2
        },
        index: index++
      }));
    }
  }

  return cards;
}
```

**Key concepts:**
- Each card is a `Token` with a unique `id`
- `meta` stores game-specific data (suit, rank, value)
- `group` categorizes cards (useful for filtering)

---

## Step 3: Initialize the Game

Create the Chronicle (state container) and Stack (deck):

```javascript
function initGame() {
  // Chronicle manages synchronized state
  const session = new Chronicle();

  // Stack is our deck of cards
  const deck = new Stack(session, createDeck());

  // Shuffle the deck
  deck.shuffle();

  return {
    session,
    deck,
    scores: { player: 0, computer: 0 },
    round: 0
  };
}
```

---

## Step 4: Game Logic

Add the core game functions:

```javascript
function getCardDisplay(card) {
  const suitSymbols = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
  };
  return `${card.meta.rank}${suitSymbols[card.meta.suit]}`;
}

function playRound(game) {
  game.round++;

  // Check if deck has enough cards
  if (game.deck.size < 2) {
    return null; // Game over
  }

  // Both players draw a card
  const playerCard = game.deck.draw();
  const computerCard = game.deck.draw();

  // Determine winner
  let winner;
  if (playerCard.meta.value > computerCard.meta.value) {
    winner = 'player';
    game.scores.player++;
  } else if (computerCard.meta.value > playerCard.meta.value) {
    winner = 'computer';
    game.scores.computer++;
  } else {
    winner = 'tie';
  }

  return {
    round: game.round,
    playerCard,
    computerCard,
    winner
  };
}

function displayResult(result, game) {
  console.log(`\n--- Round ${result.round} ---`);
  console.log(`You drew:      ${getCardDisplay(result.playerCard)}`);
  console.log(`Computer drew: ${getCardDisplay(result.computerCard)}`);

  if (result.winner === 'player') {
    console.log('You win this round!');
  } else if (result.winner === 'computer') {
    console.log('Computer wins this round!');
  } else {
    console.log("It's a tie!");
  }

  console.log(`Score: You ${game.scores.player} - ${game.scores.computer} Computer`);
  console.log(`Cards remaining: ${game.deck.size}`);
}
```

---

## Step 5: Main Game Loop

Create the interactive game loop:

```javascript
async function main() {
  console.log('╔════════════════════════════════════╗');
  console.log('║         HIGH CARD                  ║');
  console.log('║   Highest card wins the round!     ║');
  console.log('╚════════════════════════════════════╝');

  const game = initGame();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const askQuestion = (question) => {
    return new Promise((resolve) => {
      rl.question(question, resolve);
    });
  };

  console.log(`\nDeck shuffled! ${game.deck.size} cards ready.`);

  while (true) {
    const answer = await askQuestion('\nPress Enter to draw (or "q" to quit): ');

    if (answer.toLowerCase() === 'q') {
      break;
    }

    const result = playRound(game);

    if (!result) {
      console.log('\n=== GAME OVER ===');
      break;
    }

    displayResult(result, game);
  }

  // Final results
  console.log('\n╔════════════════════════════════════╗');
  console.log('║         FINAL SCORE                ║');
  console.log('╚════════════════════════════════════╝');
  console.log(`You: ${game.scores.player}`);
  console.log(`Computer: ${game.scores.computer}`);

  if (game.scores.player > game.scores.computer) {
    console.log('\n🎉 YOU WIN! 🎉');
  } else if (game.scores.computer > game.scores.player) {
    console.log('\n💻 Computer wins!');
  } else {
    console.log("\n🤝 It's a tie!");
  }

  rl.close();
}

main().catch(console.error);
```

---

## Step 6: Run Your Game

Add a script to `package.json`:

```json
{
  "scripts": {
    "high-card": "node examples/high-card/high-card.js"
  }
}
```

Run it:

```bash
npm run high-card
```

You should see:

```
╔════════════════════════════════════╗
║         HIGH CARD                  ║
║   Highest card wins the round!     ║
╚════════════════════════════════════╝

Deck shuffled! 52 cards ready.

Press Enter to draw (or "q" to quit):
```

---

## Complete Code

Here's the full `high-card.js`:

```javascript
// examples/high-card/high-card.js
import { Token } from '../../core/Token.js';
import { Stack } from '../../core/Stack.js';
import { Chronicle } from '../../core/Chronicle.js';
import * as readline from 'readline';

// Create a standard 52-card deck
function createDeck() {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const cards = [];

  let index = 0;
  for (const suit of suits) {
    for (const rank of ranks) {
      cards.push(new Token({
        id: `${rank}-${suit}`,
        label: `${rank} of ${suit}`,
        group: suit,
        meta: { suit, rank, value: ranks.indexOf(rank) + 2 },
        index: index++
      }));
    }
  }
  return cards;
}

// Initialize game state
function initGame() {
  const session = new Chronicle();
  const deck = new Stack(session, createDeck());
  deck.shuffle();
  return { session, deck, scores: { player: 0, computer: 0 }, round: 0 };
}

// Display a card
function getCardDisplay(card) {
  const symbols = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
  return `${card.meta.rank}${symbols[card.meta.suit]}`;
}

// Play one round
function playRound(game) {
  game.round++;
  if (game.deck.size < 2) return null;

  const playerCard = game.deck.draw();
  const computerCard = game.deck.draw();

  let winner;
  if (playerCard.meta.value > computerCard.meta.value) {
    winner = 'player';
    game.scores.player++;
  } else if (computerCard.meta.value > playerCard.meta.value) {
    winner = 'computer';
    game.scores.computer++;
  } else {
    winner = 'tie';
  }

  return { round: game.round, playerCard, computerCard, winner };
}

// Display round result
function displayResult(result, game) {
  console.log(`\n--- Round ${result.round} ---`);
  console.log(`You drew:      ${getCardDisplay(result.playerCard)}`);
  console.log(`Computer drew: ${getCardDisplay(result.computerCard)}`);
  console.log(result.winner === 'player' ? 'You win!' :
              result.winner === 'computer' ? 'Computer wins!' : "Tie!");
  console.log(`Score: You ${game.scores.player} - ${game.scores.computer} Computer`);
}

// Main game loop
async function main() {
  console.log('╔════════════════════════════════════╗');
  console.log('║         HIGH CARD                  ║');
  console.log('╚════════════════════════════════════╝');

  const game = initGame();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((r) => rl.question(q, r));

  console.log(`\n${game.deck.size} cards ready.`);

  while (true) {
    const answer = await ask('\nPress Enter to draw (q to quit): ');
    if (answer.toLowerCase() === 'q') break;

    const result = playRound(game);
    if (!result) { console.log('\nGame over!'); break; }
    displayResult(result, game);
  }

  console.log(`\nFinal: You ${game.scores.player} - ${game.scores.computer} Computer`);
  console.log(game.scores.player > game.scores.computer ? '🎉 You win!' :
              game.scores.player < game.scores.computer ? '💻 Computer wins!' : '🤝 Tie!');
  rl.close();
}

main();
```

---

## Next Steps

You've built a working game! Here's how to extend it:

### Add Betting

Track chips and place bets each round:

```javascript
const game = {
  // ... existing state
  chips: { player: 100, computer: 100 },
  currentBet: 0
};

function placeBet(game, amount) {
  if (amount > game.chips.player) {
    return false; // Can't afford
  }
  game.currentBet = amount;
  game.chips.player -= amount;
  game.chips.computer -= amount;
  return true;
}

function awardWinner(game, winner) {
  const pot = game.currentBet * 2;
  if (winner === 'player') {
    game.chips.player += pot;
  } else if (winner === 'computer') {
    game.chips.computer += pot;
  } else {
    // Tie - return bets
    game.chips.player += game.currentBet;
    game.chips.computer += game.currentBet;
  }
}
```

### Add Space for Visual Layout

Use Space to manage card positions:

```javascript
import { Space } from '../../core/Space.js';

const board = new Space(session, 'game-board');
board.createZone('player-area');
board.createZone('computer-area');
board.createZone('discard');

// Place drawn cards in zones
const placement = board.place('player-area', playerCard, { faceUp: true });
board.place('computer-area', computerCard, { faceUp: true });

// Move to discard after round
board.move('player-area', 'discard', placement.id);
```

### Add Multiplayer

Connect two players over the network:

```javascript
import { Engine } from '../../engine/Engine.js';

const engine = new Engine({ stack: deck });
engine.connect('ws://localhost:8080');

engine.on('net:ready', () => {
  console.log('Connected to server!');
});

// Dispatch actions through engine for sync
await engine.dispatch('stack:draw');
```

### Use Engine for Full Game

Migrate to Engine for action dispatch and event handling:

```javascript
const engine = new Engine({ stack: deck });

// Use actions
await engine.dispatch('stack:shuffle');
const card = await engine.dispatch('stack:draw');

// Listen for events
engine.on('state:updated', () => {
  // Re-render game state
});
```

---

## Learn More

- [Architecture Guide](./ARCHITECTURE.md) - How components work together
- [Blackjack Example](../examples/blackjack/README.md) - Full card game with AI
- [Cuttle Example](../examples/cuttle/) - Combat card game
- [Actions Reference](../engine/ACTIONS.md) - All available actions
