/**
 * Multiplayer Blackjack Game (Browser-compatible)
 *
 * Supports 2-6 players sharing a shoe, with turn-based gameplay.
 * One human player, rest are AI opponents.
 */

// Inlined standard deck tokens
const STANDARD_DECK = [
  {"id": "hearts-ace", "label": "A", "meta": {"suit": "hearts", "rank": "A", "value": [1, 11], "color": "red"}, "char": "\u{1F0B1}"},
  {"id": "hearts-2", "label": "2", "meta": {"suit": "hearts", "rank": "2", "value": [2], "color": "red"}, "char": "\u{1F0B2}"},
  {"id": "hearts-3", "label": "3", "meta": {"suit": "hearts", "rank": "3", "value": [3], "color": "red"}, "char": "\u{1F0B3}"},
  {"id": "hearts-4", "label": "4", "meta": {"suit": "hearts", "rank": "4", "value": [4], "color": "red"}, "char": "\u{1F0B4}"},
  {"id": "hearts-5", "label": "5", "meta": {"suit": "hearts", "rank": "5", "value": [5], "color": "red"}, "char": "\u{1F0B5}"},
  {"id": "hearts-6", "label": "6", "meta": {"suit": "hearts", "rank": "6", "value": [6], "color": "red"}, "char": "\u{1F0B6}"},
  {"id": "hearts-7", "label": "7", "meta": {"suit": "hearts", "rank": "7", "value": [7], "color": "red"}, "char": "\u{1F0B7}"},
  {"id": "hearts-8", "label": "8", "meta": {"suit": "hearts", "rank": "8", "value": [8], "color": "red"}, "char": "\u{1F0B8}"},
  {"id": "hearts-9", "label": "9", "meta": {"suit": "hearts", "rank": "9", "value": [9], "color": "red"}, "char": "\u{1F0B9}"},
  {"id": "hearts-10", "label": "10", "meta": {"suit": "hearts", "rank": "10", "value": [10], "color": "red"}, "char": "\u{1F0BA}"},
  {"id": "hearts-jack", "label": "J", "meta": {"suit": "hearts", "rank": "J", "value": [10], "color": "red"}, "char": "\u{1F0BB}"},
  {"id": "hearts-queen", "label": "Q", "meta": {"suit": "hearts", "rank": "Q", "value": [10], "color": "red"}, "char": "\u{1F0BD}"},
  {"id": "hearts-king", "label": "K", "meta": {"suit": "hearts", "rank": "K", "value": [10], "color": "red"}, "char": "\u{1F0BE}"},
  {"id": "diamonds-ace", "label": "A", "meta": {"suit": "diamonds", "rank": "A", "value": [1, 11], "color": "red"}, "char": "\u{1F0C1}"},
  {"id": "diamonds-2", "label": "2", "meta": {"suit": "diamonds", "rank": "2", "value": [2], "color": "red"}, "char": "\u{1F0C2}"},
  {"id": "diamonds-3", "label": "3", "meta": {"suit": "diamonds", "rank": "3", "value": [3], "color": "red"}, "char": "\u{1F0C3}"},
  {"id": "diamonds-4", "label": "4", "meta": {"suit": "diamonds", "rank": "4", "value": [4], "color": "red"}, "char": "\u{1F0C4}"},
  {"id": "diamonds-5", "label": "5", "meta": {"suit": "diamonds", "rank": "5", "value": [5], "color": "red"}, "char": "\u{1F0C5}"},
  {"id": "diamonds-6", "label": "6", "meta": {"suit": "diamonds", "rank": "6", "value": [6], "color": "red"}, "char": "\u{1F0C6}"},
  {"id": "diamonds-7", "label": "7", "meta": {"suit": "diamonds", "rank": "7", "value": [7], "color": "red"}, "char": "\u{1F0C7}"},
  {"id": "diamonds-8", "label": "8", "meta": {"suit": "diamonds", "rank": "8", "value": [8], "color": "red"}, "char": "\u{1F0C8}"},
  {"id": "diamonds-9", "label": "9", "meta": {"suit": "diamonds", "rank": "9", "value": [9], "color": "red"}, "char": "\u{1F0C9}"},
  {"id": "diamonds-10", "label": "10", "meta": {"suit": "diamonds", "rank": "10", "value": [10], "color": "red"}, "char": "\u{1F0CA}"},
  {"id": "diamonds-jack", "label": "J", "meta": {"suit": "diamonds", "rank": "J", "value": [10], "color": "red"}, "char": "\u{1F0CB}"},
  {"id": "diamonds-queen", "label": "Q", "meta": {"suit": "diamonds", "rank": "Q", "value": [10], "color": "red"}, "char": "\u{1F0CD}"},
  {"id": "diamonds-king", "label": "K", "meta": {"suit": "diamonds", "rank": "K", "value": [10], "color": "red"}, "char": "\u{1F0CE}"},
  {"id": "clubs-ace", "label": "A", "meta": {"suit": "clubs", "rank": "A", "value": [1, 11], "color": "black"}, "char": "\u{1F0D1}"},
  {"id": "clubs-2", "label": "2", "meta": {"suit": "clubs", "rank": "2", "value": [2], "color": "black"}, "char": "\u{1F0D2}"},
  {"id": "clubs-3", "label": "3", "meta": {"suit": "clubs", "rank": "3", "value": [3], "color": "black"}, "char": "\u{1F0D3}"},
  {"id": "clubs-4", "label": "4", "meta": {"suit": "clubs", "rank": "4", "value": [4], "color": "black"}, "char": "\u{1F0D4}"},
  {"id": "clubs-5", "label": "5", "meta": {"suit": "clubs", "rank": "5", "value": [5], "color": "black"}, "char": "\u{1F0D5}"},
  {"id": "clubs-6", "label": "6", "meta": {"suit": "clubs", "rank": "6", "value": [6], "color": "black"}, "char": "\u{1F0D6}"},
  {"id": "clubs-7", "label": "7", "meta": {"suit": "clubs", "rank": "7", "value": [7], "color": "black"}, "char": "\u{1F0D7}"},
  {"id": "clubs-8", "label": "8", "meta": {"suit": "clubs", "rank": "8", "value": [8], "color": "black"}, "char": "\u{1F0D8}"},
  {"id": "clubs-9", "label": "9", "meta": {"suit": "clubs", "rank": "9", "value": [9], "color": "black"}, "char": "\u{1F0D9}"},
  {"id": "clubs-10", "label": "10", "meta": {"suit": "clubs", "rank": "10", "value": [10], "color": "black"}, "char": "\u{1F0DA}"},
  {"id": "clubs-jack", "label": "J", "meta": {"suit": "clubs", "rank": "J", "value": [10], "color": "black"}, "char": "\u{1F0DB}"},
  {"id": "clubs-queen", "label": "Q", "meta": {"suit": "clubs", "rank": "Q", "value": [10], "color": "black"}, "char": "\u{1F0DD}"},
  {"id": "clubs-king", "label": "K", "meta": {"suit": "clubs", "rank": "K", "value": [10], "color": "black"}, "char": "\u{1F0DE}"},
  {"id": "spades-ace", "label": "A", "meta": {"suit": "spades", "rank": "A", "value": [1, 11], "color": "black"}, "char": "\u{1F0A1}"},
  {"id": "spades-2", "label": "2", "meta": {"suit": "spades", "rank": "2", "value": [2], "color": "black"}, "char": "\u{1F0A2}"},
  {"id": "spades-3", "label": "3", "meta": {"suit": "spades", "rank": "3", "value": [3], "color": "black"}, "char": "\u{1F0A3}"},
  {"id": "spades-4", "label": "4", "meta": {"suit": "spades", "rank": "4", "value": [4], "color": "black"}, "char": "\u{1F0A4}"},
  {"id": "spades-5", "label": "5", "meta": {"suit": "spades", "rank": "5", "value": [5], "color": "black"}, "char": "\u{1F0A5}"},
  {"id": "spades-6", "label": "6", "meta": {"suit": "spades", "rank": "6", "value": [6], "color": "black"}, "char": "\u{1F0A6}"},
  {"id": "spades-7", "label": "7", "meta": {"suit": "spades", "rank": "7", "value": [7], "color": "black"}, "char": "\u{1F0A7}"},
  {"id": "spades-8", "label": "8", "meta": {"suit": "spades", "rank": "8", "value": [8], "color": "black"}, "char": "\u{1F0A8}"},
  {"id": "spades-9", "label": "9", "meta": {"suit": "spades", "rank": "9", "value": [9], "color": "black"}, "char": "\u{1F0A9}"},
  {"id": "spades-10", "label": "10", "meta": {"suit": "spades", "rank": "10", "value": [10], "color": "black"}, "char": "\u{1F0AA}"},
  {"id": "spades-jack", "label": "J", "meta": {"suit": "spades", "rank": "J", "value": [10], "color": "black"}, "char": "\u{1F0AB}"},
  {"id": "spades-queen", "label": "Q", "meta": {"suit": "spades", "rank": "Q", "value": [10], "color": "black"}, "char": "\u{1F0AD}"},
  {"id": "spades-king", "label": "K", "meta": {"suit": "spades", "rank": "K", "value": [10], "color": "black"}, "char": "\u{1F0AE}"}
];

// ============================================================================
// Utility Functions
// ============================================================================

function calculateHandValues(cards) {
  if (!cards || cards.length === 0) return [0];

  let baseValue = 0;
  let aceCount = 0;

  for (const card of cards) {
    const values = card.meta?.value || [0];
    if (values.length > 1) {
      aceCount++;
      baseValue += 1;
    } else {
      baseValue += values[0];
    }
  }

  const possibleValues = [baseValue];
  for (let i = 0; i < aceCount; i++) {
    const newValue = baseValue + 10 * (i + 1);
    if (newValue <= 21) {
      possibleValues.push(newValue);
    }
  }

  return possibleValues;
}

function getBestHandValue(cards) {
  const values = calculateHandValues(cards);
  const validValues = values.filter(v => v <= 21);

  if (validValues.length === 0) {
    return Math.min(...values);
  }

  return Math.max(...validValues);
}

function isBusted(cards) {
  const values = calculateHandValues(cards);
  return values.every(v => v > 21);
}

function isBlackjack(cards) {
  if (cards.length !== 2) return false;
  const values = calculateHandValues(cards);
  return values.includes(21);
}

function isSoftHand(cards) {
  const values = calculateHandValues(cards);
  const bestValue = getBestHandValue(cards);

  if (bestValue > 21) return false;

  return values.length > 1 && values.includes(bestValue);
}

function determineWinner(playerCards, dealerCards) {
  const playerValue = getBestHandValue(playerCards);
  const dealerValue = getBestHandValue(dealerCards);
  const playerBJ = isBlackjack(playerCards);
  const dealerBJ = isBlackjack(dealerCards);

  if (playerBJ && dealerBJ) return "push";
  if (playerBJ) return "player-blackjack";
  if (dealerBJ) return "dealer";
  if (playerValue > 21) return "dealer";
  if (dealerValue > 21) return "player";
  if (playerValue > dealerValue) return "player";
  if (dealerValue > playerValue) return "dealer";
  return "push";
}

function canDoubleDown(cards) {
  return cards.length === 2 && !isBusted(cards);
}

function canSplit(cards) {
  if (cards.length !== 2) return false;
  const rank1 = cards[0].meta?.rank;
  const rank2 = cards[1].meta?.rank;
  return rank1 === rank2;
}

// ============================================================================
// Side Bet Evaluation Functions
// ============================================================================

function evaluatePerfectPairs(playerCards) {
  if (playerCards.length !== 2) {
    return { isPair: false, type: null, payout: 0 };
  }

  const card1 = playerCards[0];
  const card2 = playerCards[1];

  const rank1 = card1.meta.rank;
  const rank2 = card2.meta.rank;
  const suit1 = card1.meta.suit;
  const suit2 = card2.meta.suit;
  const color1 = card1.meta.color;
  const color2 = card2.meta.color;

  if (rank1 !== rank2) {
    return { isPair: false, type: null, payout: 0 };
  }

  // Perfect pair (same suit and rank) - 30:1
  if (suit1 === suit2) {
    return { isPair: true, type: 'perfect', payout: 30 };
  }

  // Colored pair (same color, different suit) - 10:1
  if (color1 === color2) {
    return { isPair: true, type: 'colored', payout: 10 };
  }

  // Mixed pair (different color) - 5:1
  return { isPair: true, type: 'mixed', payout: 5 };
}

function evaluate21Plus3(playerCards, dealerUpCard) {
  if (playerCards.length !== 2 || !dealerUpCard) {
    return { hasWin: false, type: null, payout: 0 };
  }

  const cards = [...playerCards, dealerUpCard];

  const ranks = cards.map(c => c.meta.rank);
  const suits = cards.map(c => c.meta.suit);

  const rankMap = {
    'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
  };

  const rankValues = ranks.map(r => rankMap[r] || 0);
  const sortedValues = [...rankValues].sort((a, b) => a - b);

  const isFlush = suits.every(s => s === suits[0]);
  const isThreeOfKind = ranks.every(r => r === ranks[0]);

  // Check straight
  const isStraight = (
    (sortedValues[1] === sortedValues[0] + 1 && sortedValues[2] === sortedValues[1] + 1) ||
    (sortedValues[0] === 1 && sortedValues[1] === 12 && sortedValues[2] === 13) // Q-K-A
  );

  // Suited three of a kind - 100:1
  if (isThreeOfKind && isFlush) {
    return { hasWin: true, type: 'suited-three-of-kind', payout: 100 };
  }

  // Straight flush - 40:1
  if (isStraight && isFlush) {
    return { hasWin: true, type: 'straight-flush', payout: 40 };
  }

  // Three of a kind - 30:1
  if (isThreeOfKind) {
    return { hasWin: true, type: 'three-of-kind', payout: 30 };
  }

  // Straight - 10:1
  if (isStraight) {
    return { hasWin: true, type: 'straight', payout: 10 };
  }

  // Flush - 5:1
  if (isFlush) {
    return { hasWin: true, type: 'flush', payout: 5 };
  }

  return { hasWin: false, type: null, payout: 0 };
}

function evaluateLuckyLadies(playerCards, dealerHasBlackjack = false) {
  if (playerCards.length !== 2) {
    return { hasWin: false, type: null, payout: 0 };
  }

  const value = getBestHandValue(playerCards);
  if (value !== 20) {
    return { hasWin: false, type: null, payout: 0 };
  }

  const card1 = playerCards[0];
  const card2 = playerCards[1];

  // Check for Queen of Hearts pair
  const isQueenOfHearts1 = card1.meta.rank === 'Q' && card1.meta.suit === 'hearts';
  const isQueenOfHearts2 = card2.meta.rank === 'Q' && card2.meta.suit === 'hearts';

  // Queen of Hearts pair with dealer blackjack - 1000:1
  if (isQueenOfHearts1 && isQueenOfHearts2 && dealerHasBlackjack) {
    return { hasWin: true, type: 'queen-hearts-pair-bj', payout: 1000 };
  }

  // Queen of Hearts pair - 125:1
  if (isQueenOfHearts1 && isQueenOfHearts2) {
    return { hasWin: true, type: 'queen-hearts-pair', payout: 125 };
  }

  // Matched 20 (same rank and suit) - 19:1
  if (card1.meta.rank === card2.meta.rank && card1.meta.suit === card2.meta.suit) {
    return { hasWin: true, type: 'matched-20', payout: 19 };
  }

  // Suited 20 (same suit) - 9:1
  if (card1.meta.suit === card2.meta.suit) {
    return { hasWin: true, type: 'suited-20', payout: 9 };
  }

  // Any 20 - 4:1
  return { hasWin: true, type: 'any-20', payout: 4 };
}

function evaluateBusterBlackjack(dealerCards) {
  // Buster pays when dealer busts, based on number of cards
  if (!isBusted(dealerCards)) {
    return { hasWin: false, type: null, payout: 0 };
  }

  const numCards = dealerCards.length;

  // Payouts based on number of cards when dealer busts
  if (numCards >= 8) {
    return { hasWin: true, type: '8-plus-cards', payout: 250 };
  } else if (numCards === 7) {
    return { hasWin: true, type: '7-cards', payout: 100 };
  } else if (numCards === 6) {
    return { hasWin: true, type: '6-cards', payout: 50 };
  } else if (numCards === 5) {
    return { hasWin: true, type: '5-cards', payout: 12 };
  } else if (numCards === 4) {
    return { hasWin: true, type: '4-cards', payout: 4 };
  } else {
    // 3 cards - 2:1
    return { hasWin: true, type: '3-cards', payout: 2 };
  }
}

// Seeded random for deterministic shuffle
class SeededRandom {
  constructor(seed) {
    this.seed = seed ?? Date.now();
  }

  next() {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
}

// ============================================================================
// MultiplayerBlackjackGame Class
// ============================================================================

export class MultiplayerBlackjackGame {
  constructor({
    numPlayers = 4,
    numDecks = 6,
    seed = null,
    initialBankroll = 1000,
    minBet = 5,
    maxBet = 500,
    variant = 'american',
    dealerHitsSoft17 = false,
    allowEarlySurrender = false,
    allowLateSurrender = false,
    allowResplitAces = false,
    humanPlayerIndex = null  // Random if null
  } = {}) {
    this.numDecks = numDecks;
    this.minBet = minBet;
    this.maxBet = maxBet;
    this.variant = variant;
    this.dealerHitsSoft17 = dealerHitsSoft17;
    this.allowEarlySurrender = allowEarlySurrender;
    this.allowLateSurrender = allowLateSurrender;
    this.allowResplitAces = allowResplitAces;

    // Initialize random
    this.random = new SeededRandom(seed);

    // Create shoe
    this.shoe = [];
    this.initializeShoe();
    this.shuffle();

    // Cut card position (~1.5 decks from end)
    this.cutCardPosition = Math.floor(52 * 1.5);
    this.cutCardReached = false;

    // Determine human player seat (random if not specified)
    if (humanPlayerIndex === null) {
      humanPlayerIndex = Math.floor(this.random.next() * numPlayers);
    }
    this.humanPlayerIndex = humanPlayerIndex;

    // Initialize players
    this.players = [];
    for (let i = 0; i < numPlayers; i++) {
      this.players.push({
        id: i,
        name: i === humanPlayerIndex ? 'You' : `Player ${i + 1}`,
        type: i === humanPlayerIndex ? 'human' : 'ai',
        bankroll: initialBankroll,
        currentBet: 0,
        hand: [],
        splitHands: [],
        splitBets: [],
        splitFromAces: [],  // Track which split hands came from aces (for resplit)
        currentSplitHandIndex: -1,
        status: 'waiting', // waiting, betting, playing, stood, busted, blackjack, surrendered, done
        result: null,
        payout: 0,
        insuranceBet: 0,
        insuranceDecision: null, // null = not yet decided, true = took, false = declined
        earlySurrenderDecision: null, // null = not yet decided, true = surrendered, false = declined
        // Side bets
        sideBets: {
          perfectPairs: 0,
          twentyOnePlus3: 0,
          luckyLadies: 0,
          busterBlackjack: 0
        },
        sideBetResults: null
      });
    }

    // Dealer state
    this.dealerHand = [];

    // Game phase
    this.phase = 'betting'; // betting, dealing, early-surrender, insurance, player-turns, dealer, results
    this.activePlayerIndex = -1;
    this.round = 0;
    this.insuranceOffered = false;
    this.insurancePlayerIndex = -1; // Track which player is deciding on insurance
    this.earlySurrenderPlayerIndex = -1; // Track which player is deciding on early surrender

    // Card counting (Hi-Lo system)
    this.runningCount = 0;

    // Burn card state
    this.needsBurn = true;
    this.burnedCard = null;
  }

  initializeShoe() {
    this.shoe = [];
    for (let d = 0; d < this.numDecks; d++) {
      for (const card of STANDARD_DECK) {
        this.shoe.push({
          ...card,
          id: `${card.id}-${d}`,
          faceUp: true
        });
      }
    }
  }

  shuffle() {
    // Fisher-Yates shuffle
    for (let i = this.shoe.length - 1; i > 0; i--) {
      const j = Math.floor(this.random.next() * (i + 1));
      [this.shoe[i], this.shoe[j]] = [this.shoe[j], this.shoe[i]];
    }
    this.cutCardReached = false;
    this.runningCount = 0; // Reset count on shuffle
    this.needsBurn = true; // Need to burn after shuffle
  }

  // ============================================================================
  // Card Counting (Hi-Lo System)
  // ============================================================================

  /**
   * Get the Hi-Lo count value for a card.
   * 2-6: +1 (low cards help dealer)
   * 7-9: 0 (neutral)
   * 10-A: -1 (high cards help player)
   */
  getCardCountValue(card) {
    const value = card.meta?.value?.[0];
    if (value >= 2 && value <= 6) return 1;
    if (value >= 7 && value <= 9) return 0;
    return -1; // 10, J, Q, K, A
  }

  /**
   * Update running count when a card is revealed.
   */
  countCard(card) {
    this.runningCount += this.getCardCountValue(card);
  }

  /**
   * Get the current running count.
   */
  getRunningCount() {
    return this.runningCount;
  }

  /**
   * Get the true count (running count / decks remaining).
   */
  getTrueCount() {
    const decksRemaining = this.shoe.length / 52;
    if (decksRemaining < 0.5) {
      return this.runningCount;
    }
    return Math.round((this.runningCount / decksRemaining) * 10) / 10;
  }

  /**
   * Get card counting info for display.
   */
  getCountInfo() {
    return {
      runningCount: this.runningCount,
      trueCount: this.getTrueCount(),
      decksRemaining: Math.round((this.shoe.length / 52) * 10) / 10,
      cardsDealt: (this.numDecks * 52) - this.shoe.length
    };
  }

  // ============================================================================
  // Burn Card
  // ============================================================================

  /**
   * Check if burn card is needed (after shuffle).
   */
  shouldBurnCard() {
    return this.needsBurn;
  }

  /**
   * Burn the top card from the shoe (discard without showing).
   * Called after shuffle, before first deal.
   */
  burnCard() {
    if (!this.needsBurn) {
      return null;
    }

    const card = this.shoe.pop();
    this.countCard(card); // Count burned cards too
    this.burnedCard = { ...card, faceUp: false };
    this.needsBurn = false;
    return this.burnedCard;
  }

  /**
   * Get the last burned card (for display purposes).
   */
  getBurnedCard() {
    return this.burnedCard;
  }

  draw() {
    if (this.shoe.length === 0) {
      this.initializeShoe();
      this.shuffle();
    }

    // Check cut card
    if (this.shoe.length <= this.cutCardPosition && !this.cutCardReached) {
      this.cutCardReached = true;
    }

    const card = this.shoe.pop();
    // Count face-up cards
    if (card.faceUp) {
      this.countCard(card);
    }
    return card;
  }

  shouldReshuffle() {
    return this.cutCardReached;
  }

  reshuffle() {
    this.initializeShoe();
    this.shuffle();
    this.cutCardReached = false;
  }

  // ============================================================================
  // Betting Phase
  // ============================================================================

  setPlayerBet(playerIndex, amount) {
    const player = this.players[playerIndex];
    if (!player) throw new Error(`Invalid player index: ${playerIndex}`);

    if (amount < this.minBet || amount > this.maxBet) {
      throw new Error(`Bet must be between ${this.minBet} and ${this.maxBet}`);
    }
    if (amount > player.bankroll) {
      throw new Error(`Insufficient funds. Bankroll: ${player.bankroll}`);
    }

    player.currentBet = amount;
    player.bankroll -= amount;
    player.status = 'betting';

    return player.bankroll;
  }

  allBetsPlaced() {
    return this.players.every(p => p.currentBet > 0 || p.bankroll < this.minBet);
  }

  getPlayersWithBets() {
    return this.players.filter(p => p.currentBet > 0);
  }

  // ============================================================================
  // Side Bets
  // ============================================================================

  /**
   * Set a side bet for a player. Must be called during betting phase before deal.
   * @param {number} playerIndex - Player placing the bet
   * @param {string} betType - 'perfectPairs', 'twentyOnePlus3', 'luckyLadies', or 'busterBlackjack'
   * @param {number} amount - Bet amount
   */
  setPlayerSideBet(playerIndex, betType, amount) {
    const player = this.players[playerIndex];
    if (!player) throw new Error(`Invalid player index: ${playerIndex}`);

    const validBetTypes = ['perfectPairs', 'twentyOnePlus3', 'luckyLadies', 'busterBlackjack'];
    if (!validBetTypes.includes(betType)) {
      throw new Error(`Invalid side bet type: ${betType}`);
    }

    if (amount < 0) {
      throw new Error('Bet amount must be non-negative');
    }

    // Calculate total side bets including this change
    const currentSideBetTotal = Object.values(player.sideBets).reduce((sum, b) => sum + b, 0);
    const newTotal = currentSideBetTotal - player.sideBets[betType] + amount;

    if (newTotal > player.bankroll) {
      throw new Error(`Insufficient funds for side bet. Bankroll: ${player.bankroll}`);
    }

    // Update side bet (deduct difference from bankroll)
    const difference = amount - player.sideBets[betType];
    player.bankroll -= difference;
    player.sideBets[betType] = amount;

    return player.bankroll;
  }

  /**
   * Clear all side bets for a player (refunding to bankroll).
   */
  clearPlayerSideBets(playerIndex) {
    const player = this.players[playerIndex];
    if (!player) return;

    const totalSideBets = Object.values(player.sideBets).reduce((sum, b) => sum + b, 0);
    player.bankroll += totalSideBets;
    player.sideBets = {
      perfectPairs: 0,
      twentyOnePlus3: 0,
      luckyLadies: 0,
      busterBlackjack: 0
    };
  }

  /**
   * Get total side bets for a player.
   */
  getPlayerSideBetsTotal(playerIndex) {
    const player = this.players[playerIndex];
    if (!player) return 0;
    return Object.values(player.sideBets).reduce((sum, b) => sum + b, 0);
  }

  /**
   * Resolve side bets that can be determined immediately after deal.
   * Called after dealing, before player turns.
   * Resolves: Perfect Pairs, 21+3
   */
  resolveImmediateSideBets() {
    const dealerUpCard = this.getDealerUpCard();

    for (const player of this.getPlayersWithBets()) {
      player.sideBetResults = {
        perfectPairs: null,
        twentyOnePlus3: null,
        luckyLadies: null,
        busterBlackjack: null
      };

      // Perfect Pairs - evaluated on player's first two cards
      if (player.sideBets.perfectPairs > 0) {
        const result = evaluatePerfectPairs(player.hand);
        if (result.isPair) {
          const payout = player.sideBets.perfectPairs * (1 + result.payout);
          player.bankroll += payout;
          player.sideBetResults.perfectPairs = {
            won: true,
            type: result.type,
            payout: payout,
            multiplier: result.payout
          };
        } else {
          player.sideBetResults.perfectPairs = {
            won: false,
            type: null,
            payout: 0,
            multiplier: 0
          };
        }
      }

      // 21+3 - evaluated on player's first two cards + dealer up card
      if (player.sideBets.twentyOnePlus3 > 0) {
        const result = evaluate21Plus3(player.hand, dealerUpCard);
        if (result.hasWin) {
          const payout = player.sideBets.twentyOnePlus3 * (1 + result.payout);
          player.bankroll += payout;
          player.sideBetResults.twentyOnePlus3 = {
            won: true,
            type: result.type,
            payout: payout,
            multiplier: result.payout
          };
        } else {
          player.sideBetResults.twentyOnePlus3 = {
            won: false,
            type: null,
            payout: 0,
            multiplier: 0
          };
        }
      }
    }
  }

  /**
   * Resolve side bets that depend on dealer's hand.
   * Called after dealer plays, in resolveAllBets.
   * Resolves: Lucky Ladies, Buster Blackjack
   */
  resolveDealerDependentSideBets() {
    const dealerHasBlackjack = isBlackjack(this.dealerHand);
    const dealerBusted = isBusted(this.dealerHand);

    for (const player of this.getPlayersWithBets()) {
      if (!player.sideBetResults) {
        player.sideBetResults = {
          perfectPairs: null,
          twentyOnePlus3: null,
          luckyLadies: null,
          busterBlackjack: null
        };
      }

      // Lucky Ladies - needs dealer blackjack info for max payout
      if (player.sideBets.luckyLadies > 0) {
        const result = evaluateLuckyLadies(player.hand, dealerHasBlackjack);
        if (result.hasWin) {
          const payout = player.sideBets.luckyLadies * (1 + result.payout);
          player.bankroll += payout;
          player.sideBetResults.luckyLadies = {
            won: true,
            type: result.type,
            payout: payout,
            multiplier: result.payout
          };
        } else {
          player.sideBetResults.luckyLadies = {
            won: false,
            type: null,
            payout: 0,
            multiplier: 0
          };
        }
      }

      // Buster Blackjack - pays when dealer busts
      if (player.sideBets.busterBlackjack > 0) {
        const result = evaluateBusterBlackjack(this.dealerHand);
        if (result.hasWin) {
          const payout = player.sideBets.busterBlackjack * (1 + result.payout);
          player.bankroll += payout;
          player.sideBetResults.busterBlackjack = {
            won: true,
            type: result.type,
            payout: payout,
            multiplier: result.payout
          };
        } else {
          player.sideBetResults.busterBlackjack = {
            won: false,
            type: null,
            payout: 0,
            multiplier: 0
          };
        }
      }
    }
  }

  // ============================================================================
  // Dealing Phase
  // ============================================================================

  deal() {
    this.phase = 'dealing';
    this.round++;

    // Burn card if needed (after shuffle)
    if (this.shouldBurnCard()) {
      this.burnCard();
    }

    // Reset hands, insurance, surrender, and side bet results for all players
    for (const player of this.players) {
      player.hand = [];
      player.splitHands = [];
      player.splitBets = [];
      player.splitFromAces = [];
      player.currentSplitHandIndex = -1;
      player.status = player.currentBet > 0 ? 'playing' : 'waiting';
      player.result = null;
      player.payout = 0;
      player.insuranceBet = 0;
      player.insuranceDecision = null;
      player.earlySurrenderDecision = null;
      player.sideBetResults = null;
    }

    // Reset dealer, insurance, and early surrender state
    this.dealerHand = [];
    this.insuranceOffered = false;
    this.insurancePlayerIndex = -1;
    this.earlySurrenderPlayerIndex = -1;

    // Deal 2 cards to each player with a bet
    const activePlayers = this.getPlayersWithBets();
    for (let cardNum = 0; cardNum < 2; cardNum++) {
      for (const player of activePlayers) {
        player.hand.push(this.draw());
      }
      // Deal to dealer
      if (this.variant === 'european' && cardNum === 0) {
        this.dealerHand.push({ ...this.draw(), faceUp: true });
      } else if (this.variant === 'american') {
        this.dealerHand.push({
          ...this.draw(),
          faceUp: cardNum === 1 // First card face down, second face up
        });
      }
    }

    // European: only one dealer card dealt initially
    if (this.variant === 'european') {
      // Second dealer card dealt later
    }

    // Check for player blackjacks
    for (const player of activePlayers) {
      if (isBlackjack(player.hand)) {
        player.status = 'blackjack';
      }
    }

    // Resolve immediate side bets (Perfect Pairs, 21+3)
    this.resolveImmediateSideBets();

    // Check if early surrender should be offered (before dealer checks for blackjack)
    if (this.allowEarlySurrender && this.canOfferEarlySurrender()) {
      this.phase = 'early-surrender';
      this.earlySurrenderPlayerIndex = this.findNextEarlySurrenderPlayer(-1);
      return this.getGameState();
    }

    // Check if insurance should be offered (dealer shows Ace in American variant)
    if (this.canOfferInsurance()) {
      this.phase = 'insurance';
      this.insuranceOffered = true;
      this.insurancePlayerIndex = this.findNextInsurancePlayer(-1);
    } else {
      // Start player turns
      this.phase = 'player-turns';
      this.activePlayerIndex = this.findNextActivePlayer(-1);
    }

    return this.getGameState();
  }

  // ============================================================================
  // Early Surrender Phase
  // ============================================================================

  /**
   * Check if early surrender can be offered.
   * Early surrender is offered before dealer checks for blackjack.
   */
  canOfferEarlySurrender() {
    if (!this.allowEarlySurrender) return false;
    // Early surrender available for any player who has bet and isn't blackjack
    return this.players.some(p =>
      p.currentBet > 0 && p.status === 'playing' && !isBlackjack(p.hand)
    );
  }

  findNextEarlySurrenderPlayer(fromIndex) {
    for (let i = fromIndex + 1; i < this.players.length; i++) {
      const player = this.players[i];
      // Player must have a bet, be playing, not have blackjack, and not yet decided
      if (player.currentBet > 0 &&
          player.status === 'playing' &&
          !isBlackjack(player.hand) &&
          player.earlySurrenderDecision === null) {
        return i;
      }
    }
    return -1;
  }

  isEarlySurrenderPhase() {
    return this.phase === 'early-surrender';
  }

  isHumanEarlySurrenderTurn() {
    return this.phase === 'early-surrender' && this.earlySurrenderPlayerIndex === this.humanPlayerIndex;
  }

  /**
   * Player takes early surrender - forfeit half bet before dealer blackjack check.
   */
  takeEarlySurrender(playerIndex) {
    if (this.phase !== 'early-surrender') {
      throw new Error('Not in early surrender phase');
    }

    const player = this.players[playerIndex];
    if (!player || player.currentBet === 0) {
      throw new Error('Invalid player for early surrender');
    }

    // Return half the bet
    player.bankroll += player.currentBet / 2;
    player.status = 'surrendered';
    player.result = 'surrender';
    player.payout = player.currentBet / 2;
    player.earlySurrenderDecision = true;

    return this.advanceEarlySurrenderPhase();
  }

  /**
   * Player declines early surrender.
   */
  declineEarlySurrender(playerIndex) {
    if (this.phase !== 'early-surrender') {
      throw new Error('Not in early surrender phase');
    }

    const player = this.players[playerIndex];
    if (!player) {
      throw new Error('Invalid player');
    }

    player.earlySurrenderDecision = false;
    return this.advanceEarlySurrenderPhase();
  }

  advanceEarlySurrenderPhase() {
    // Find next player who needs to decide
    this.earlySurrenderPlayerIndex = this.findNextEarlySurrenderPlayer(this.earlySurrenderPlayerIndex);

    if (this.earlySurrenderPlayerIndex === -1) {
      // All players decided, move to insurance or player turns
      return this.finishEarlySurrenderPhase();
    }

    return this.getGameState();
  }

  finishEarlySurrenderPhase() {
    // Check if insurance should be offered
    if (this.canOfferInsurance()) {
      this.phase = 'insurance';
      this.insuranceOffered = true;
      this.insurancePlayerIndex = this.findNextInsurancePlayer(-1);
    } else {
      // Start player turns
      this.phase = 'player-turns';
      this.activePlayerIndex = this.findNextActivePlayer(-1);

      // If no active players (all surrendered or blackjack), go to dealer
      if (this.activePlayerIndex === -1) {
        this.playDealerHand();
      }
    }

    return this.getGameState();
  }

  // ============================================================================
  // Insurance Phase
  // ============================================================================

  canOfferInsurance() {
    if (this.variant !== 'american') return false;
    // Check if dealer's up card (second card, index 1) is an Ace
    const dealerUpCard = this.dealerHand[1];
    return dealerUpCard && dealerUpCard.meta && dealerUpCard.meta.rank === 'A';
  }

  getDealerUpCard() {
    // In American variant, the face-up card is the second one
    if (this.variant === 'american' && this.dealerHand.length >= 2) {
      return this.dealerHand[1];
    }
    // In European, it's the first (and only visible) card
    return this.dealerHand[0];
  }

  findNextInsurancePlayer(fromIndex) {
    const activePlayers = this.getPlayersWithBets();
    for (let i = fromIndex + 1; i < this.players.length; i++) {
      const player = this.players[i];
      // Player must have a bet and not yet decided on insurance
      if (player.currentBet > 0 && player.insuranceDecision === null) {
        return i;
      }
    }
    return -1;
  }

  isInsurancePhase() {
    return this.phase === 'insurance';
  }

  isHumanInsuranceTurn() {
    return this.phase === 'insurance' && this.insurancePlayerIndex === this.humanPlayerIndex;
  }

  takeInsurance(playerIndex) {
    if (this.phase !== 'insurance') {
      throw new Error('Not in insurance phase');
    }

    const player = this.players[playerIndex];
    if (!player || player.currentBet === 0) {
      throw new Error('Invalid player for insurance');
    }

    // Insurance costs half the original bet
    const insuranceCost = Math.floor(player.currentBet / 2);

    if (insuranceCost > player.bankroll) {
      // Can't afford insurance, auto-decline
      player.insuranceDecision = false;
    } else {
      player.insuranceBet = insuranceCost;
      player.bankroll -= insuranceCost;
      player.insuranceDecision = true;
    }

    return this.advanceInsurancePhase();
  }

  declineInsurance(playerIndex) {
    if (this.phase !== 'insurance') {
      throw new Error('Not in insurance phase');
    }

    const player = this.players[playerIndex];
    if (!player) {
      throw new Error('Invalid player');
    }

    player.insuranceDecision = false;
    return this.advanceInsurancePhase();
  }

  advanceInsurancePhase() {
    // Find next player who needs to decide
    this.insurancePlayerIndex = this.findNextInsurancePlayer(this.insurancePlayerIndex);

    if (this.insurancePlayerIndex === -1) {
      // All players decided, check for dealer blackjack
      return this.resolveInsurance();
    }

    return this.getGameState();
  }

  resolveInsurance() {
    const dealerHasBlackjack = isBlackjack(this.dealerHand);

    if (dealerHasBlackjack) {
      // Reveal dealer's hole card and count it
      this.dealerHand[0].faceUp = true;
      this.countCard(this.dealerHand[0]);

      // Pay insurance bets (2:1)
      for (const player of this.players) {
        if (player.insuranceDecision === true) {
          // Insurance pays 2:1
          const insurancePayout = player.insuranceBet * 3; // Original bet + 2x winnings
          player.bankroll += insurancePayout;
        }
      }

      // Resolve main bets - players with blackjack push, others lose
      for (const player of this.getPlayersWithBets()) {
        if (player.status === 'blackjack') {
          // Push - return bet
          player.bankroll += player.currentBet;
          player.payout = player.currentBet;
          player.result = 'push';
        } else {
          // Lose to dealer blackjack
          player.payout = 0;
          player.result = 'dealer';
        }
        player.status = 'done';
      }

      this.phase = 'results';
      return { ...this.getGameState(), dealerBlackjack: true };
    }

    // No dealer blackjack - insurance bets lost, continue to player turns
    // (Insurance bets already deducted from bankroll)
    this.phase = 'player-turns';
    this.activePlayerIndex = this.findNextActivePlayer(-1);

    return { ...this.getGameState(), dealerBlackjack: false };
  }

  // ============================================================================
  // Player Turn Management
  // ============================================================================

  findNextActivePlayer(fromIndex) {
    for (let i = fromIndex + 1; i < this.players.length; i++) {
      const player = this.players[i];
      if (player.currentBet > 0 && player.status === 'playing') {
        return i;
      }
    }
    return -1; // No more active players
  }

  nextPlayerTurn() {
    this.activePlayerIndex = this.findNextActivePlayer(this.activePlayerIndex);

    if (this.activePlayerIndex === -1) {
      // All players done, dealer's turn
      this.playDealerHand();
    }

    return this.getGameState();
  }

  isPlayerTurn(playerIndex) {
    return this.phase === 'player-turns' && this.activePlayerIndex === playerIndex;
  }

  isHumanTurn() {
    return this.isPlayerTurn(this.humanPlayerIndex);
  }

  getActivePlayer() {
    if (this.activePlayerIndex < 0) return null;
    return this.players[this.activePlayerIndex];
  }

  // ============================================================================
  // Player Actions
  // ============================================================================

  validateAction(playerIndex) {
    if (this.phase !== 'player-turns') {
      throw new Error(`Cannot take action during ${this.phase} phase`);
    }
    if (playerIndex !== this.activePlayerIndex) {
      throw new Error(`Not player ${playerIndex}'s turn. Active player: ${this.activePlayerIndex}`);
    }
    const player = this.players[playerIndex];
    if (player.status !== 'playing') {
      throw new Error(`Player ${playerIndex} cannot take action. Status: ${player.status}`);
    }
  }

  getCurrentHand(player) {
    if (player.splitHands.length > 0 && player.currentSplitHandIndex >= 0) {
      return player.splitHands[player.currentSplitHandIndex];
    }
    return player.hand;
  }

  hit(playerIndex) {
    this.validateAction(playerIndex);
    const player = this.players[playerIndex];
    const hand = this.getCurrentHand(player);

    hand.push(this.draw());

    if (isBusted(hand)) {
      if (player.splitHands.length > 0) {
        // Advance to next split hand or end
        this.advanceToNextSplitHand(player);
      } else {
        player.status = 'busted';
        this.nextPlayerTurn();
      }
    }

    return this.getGameState();
  }

  stand(playerIndex) {
    this.validateAction(playerIndex);
    const player = this.players[playerIndex];

    if (player.splitHands.length > 0) {
      this.advanceToNextSplitHand(player);
    } else {
      player.status = 'stood';
      this.nextPlayerTurn();
    }

    return this.getGameState();
  }

  doubleDown(playerIndex) {
    this.validateAction(playerIndex);
    const player = this.players[playerIndex];
    const hand = this.getCurrentHand(player);

    if (!canDoubleDown(hand)) {
      throw new Error("Cannot double down - must have exactly 2 cards.");
    }

    const additionalBet = player.splitHands.length > 0
      ? player.splitBets[player.currentSplitHandIndex]
      : player.currentBet;

    if (player.bankroll < additionalBet) {
      throw new Error("Insufficient funds to double down.");
    }

    // Double the bet
    player.bankroll -= additionalBet;
    if (player.splitHands.length > 0) {
      player.splitBets[player.currentSplitHandIndex] *= 2;
    } else {
      player.currentBet *= 2;
    }

    // Take exactly one card
    hand.push(this.draw());

    if (player.splitHands.length > 0) {
      this.advanceToNextSplitHand(player);
    } else {
      if (isBusted(hand)) {
        player.status = 'busted';
      } else {
        player.status = 'stood';
      }
      this.nextPlayerTurn();
    }

    return this.getGameState();
  }

  split(playerIndex) {
    this.validateAction(playerIndex);
    const player = this.players[playerIndex];

    // Check if splitting from a split hand (resplit)
    const isResplit = player.splitHands.length > 0 && player.currentSplitHandIndex >= 0;
    const handToSplit = isResplit ? player.splitHands[player.currentSplitHandIndex] : player.hand;

    if (!canSplit(handToSplit)) {
      throw new Error("Cannot split - must have exactly 2 cards of the same rank.");
    }

    const betAmount = isResplit ? player.splitBets[player.currentSplitHandIndex] : player.currentBet;

    if (player.bankroll < betAmount) {
      throw new Error("Insufficient funds to split.");
    }

    // Check if splitting aces
    const isSplittingAces = handToSplit[0].meta?.rank === 'A';

    // Deduct split bet
    player.bankroll -= betAmount;

    if (isResplit) {
      // Resplitting - replace current hand with two new hands
      const currentIdx = player.currentSplitHandIndex;
      const card1 = handToSplit[0];
      const card2 = handToSplit[1];

      // Insert new hand after current, then replace current
      player.splitHands.splice(currentIdx, 1, [card1], [card2]);
      player.splitBets.splice(currentIdx, 1, betAmount, betAmount);
      player.splitFromAces.splice(currentIdx, 1, isSplittingAces, isSplittingAces);

      // Deal one card to each new split hand
      player.splitHands[currentIdx].push(this.draw());
      player.splitHands[currentIdx + 1].push(this.draw());

      // Stay on current hand (first of the new split)
    } else {
      // Initial split from main hand
      player.splitHands = [
        [handToSplit[0]],
        [handToSplit[1]]
      ];
      player.splitBets = [player.currentBet, player.currentBet];
      player.splitFromAces = [isSplittingAces, isSplittingAces];
      player.currentSplitHandIndex = 0;

      // Deal one card to each split hand
      player.splitHands[0].push(this.draw());
      player.splitHands[1].push(this.draw());

      // Clear main hand
      player.hand = [];
    }

    return this.getGameState();
  }

  /**
   * Late surrender - forfeit half the bet and end the hand.
   * Only available on first two cards, before any other action.
   */
  surrender(playerIndex) {
    this.validateAction(playerIndex);
    const player = this.players[playerIndex];

    if (!this.canSurrender(playerIndex)) {
      throw new Error("Cannot surrender - only available on first two cards before any action.");
    }

    // Return half the bet
    player.bankroll += player.currentBet / 2;
    player.status = 'surrendered';
    player.result = 'surrender';
    player.payout = player.currentBet / 2;

    this.nextPlayerTurn();
    return this.getGameState();
  }

  /**
   * Check if surrender is available for a player.
   */
  canSurrender(playerIndex) {
    if (!this.allowLateSurrender) return false;
    if (this.phase !== 'player-turns') return false;
    if (playerIndex !== this.activePlayerIndex) return false;

    const player = this.players[playerIndex];
    if (player.status !== 'playing') return false;

    // Can only surrender on first two cards
    if (player.hand.length !== 2) return false;

    // Can't surrender after splitting
    if (player.splitHands.length > 0) return false;

    return true;
  }

  advanceToNextSplitHand(player) {
    player.currentSplitHandIndex++;

    if (player.currentSplitHandIndex >= player.splitHands.length) {
      // All split hands played
      player.currentSplitHandIndex = -1;
      player.status = 'stood';
      this.nextPlayerTurn();
    }
  }

  // ============================================================================
  // Dealer Phase
  // ============================================================================

  playDealerHand() {
    this.phase = 'dealer';

    // Check if any players need dealer to play (not all busted)
    const needsDealerPlay = this.players.some(p =>
      p.currentBet > 0 && (p.status === 'stood' || p.status === 'blackjack')
    );

    // Reveal hole card (American) or deal second card (European)
    if (this.variant === 'european') {
      this.dealerHand.push({ ...this.draw(), faceUp: true });
    } else {
      if (this.dealerHand[0] && !this.dealerHand[0].faceUp) {
        this.dealerHand[0].faceUp = true;
        this.countCard(this.dealerHand[0]); // Count revealed hole card
      }
    }

    // Dealer plays if any player needs resolution
    if (needsDealerPlay) {
      let dealerValue = getBestHandValue(this.dealerHand);

      while (dealerValue < 17 ||
             (this.dealerHitsSoft17 && dealerValue === 17 && isSoftHand(this.dealerHand))) {
        this.dealerHand.push({ ...this.draw(), faceUp: true });
        dealerValue = getBestHandValue(this.dealerHand);
      }
    }

    // Resolve all bets
    this.resolveAllBets();
  }

  resolveAllBets() {
    this.phase = 'results';

    // Resolve dealer-dependent side bets (Lucky Ladies, Buster Blackjack)
    this.resolveDealerDependentSideBets();

    for (const player of this.players) {
      if (player.currentBet === 0) continue;

      if (player.splitHands.length > 0) {
        // Resolve split hands
        let totalPayout = 0;
        player.result = [];

        for (let i = 0; i < player.splitHands.length; i++) {
          const hand = player.splitHands[i];
          const bet = player.splitBets[i];
          let result;

          if (isBusted(hand)) {
            result = 'dealer';
          } else {
            result = determineWinner(hand, this.dealerHand);
            // Split blackjack pays 1:1, not 3:2
            if (result === 'player-blackjack') {
              result = 'player';
            }
          }

          let payout = 0;
          if (result === 'player') {
            payout = bet * 2;
          } else if (result === 'push') {
            payout = bet;
          }

          totalPayout += payout;
          player.result.push({ handIndex: i, result, payout });
        }

        player.bankroll += totalPayout;
        player.payout = totalPayout;
      } else {
        // Single hand resolution
        let result;
        if (player.status === 'busted') {
          result = 'dealer';
        } else {
          result = determineWinner(player.hand, this.dealerHand);
        }

        let payout = 0;
        if (result === 'player-blackjack') {
          payout = player.currentBet + (player.currentBet * 1.5);
        } else if (result === 'player') {
          payout = player.currentBet * 2;
        } else if (result === 'push') {
          payout = player.currentBet;
        }

        player.bankroll += payout;
        player.result = result;
        player.payout = payout;
      }

      player.status = 'done';
    }

    return this.getGameState();
  }

  // ============================================================================
  // New Round
  // ============================================================================

  newRound() {
    // Check reshuffle
    if (this.shouldReshuffle()) {
      this.reshuffle();
    }

    // Reset for new round
    this.phase = 'betting';
    this.activePlayerIndex = -1;

    for (const player of this.players) {
      player.hand = [];
      player.splitHands = [];
      player.splitBets = [];
      player.splitFromAces = [];
      player.currentSplitHandIndex = -1;
      player.currentBet = 0;
      player.status = 'waiting';
      player.result = null;
      player.payout = 0;
      player.earlySurrenderDecision = null;
      // Reset side bets
      player.sideBets = {
        perfectPairs: 0,
        twentyOnePlus3: 0,
        luckyLadies: 0,
        busterBlackjack: 0
      };
      player.sideBetResults = null;
    }

    this.dealerHand = [];

    return this.getGameState();
  }

  // ============================================================================
  // State Getters
  // ============================================================================

  getGameState() {
    const showFullDealer = this.phase === 'dealer' || this.phase === 'results';

    const playerStates = this.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      bankroll: p.bankroll,
      currentBet: p.currentBet,
      hand: {
        cards: p.hand,
        value: getBestHandValue(p.hand),
        busted: isBusted(p.hand),
        blackjack: isBlackjack(p.hand)
      },
      splitHands: p.splitHands.map((hand, hi) => ({
        cards: hand,
        value: getBestHandValue(hand),
        busted: isBusted(hand),
        blackjack: isBlackjack(hand),
        active: hi === p.currentSplitHandIndex
      })),
      status: p.status,
      result: p.result,
      payout: p.payout,
      isActive: i === this.activePlayerIndex,
      isHuman: i === this.humanPlayerIndex,
      canAct: this.canPlayerAct(i),
      insuranceBet: p.insuranceBet,
      insuranceDecision: p.insuranceDecision,
      earlySurrenderDecision: p.earlySurrenderDecision,
      sideBets: { ...p.sideBets },
      sideBetResults: p.sideBetResults
    }));

    const dealerState = {
      cards: this.dealerHand,
      visibleCards: showFullDealer
        ? this.dealerHand
        : this.dealerHand.filter(c => c.faceUp),
      value: showFullDealer ? getBestHandValue(this.dealerHand) : null,
      visibleValue: getBestHandValue(this.dealerHand.filter(c => c.faceUp)),
      busted: showFullDealer ? isBusted(this.dealerHand) : null,
      blackjack: showFullDealer ? isBlackjack(this.dealerHand) : null
    };

    return {
      phase: this.phase,
      round: this.round,
      activePlayerIndex: this.activePlayerIndex,
      humanPlayerIndex: this.humanPlayerIndex,
      insurancePlayerIndex: this.insurancePlayerIndex,
      insuranceOffered: this.insuranceOffered,
      isHumanInsuranceTurn: this.isHumanInsuranceTurn(),
      earlySurrenderPlayerIndex: this.earlySurrenderPlayerIndex,
      isHumanEarlySurrenderTurn: this.isHumanEarlySurrenderTurn(),
      players: playerStates,
      dealer: dealerState,
      deckCount: this.shoe.length,
      cutCardReached: this.cutCardReached,
      allBetsPlaced: this.allBetsPlaced(),
      isHumanTurn: this.isHumanTurn(),
      countInfo: this.getCountInfo(),
      needsBurn: this.needsBurn,
      burnedCard: this.burnedCard
    };
  }

  getPlayerState(playerIndex) {
    return this.getGameState().players[playerIndex];
  }

  getDealerUpCard() {
    const visibleCards = this.dealerHand.filter(c => c.faceUp);
    return visibleCards.length > 0 ? visibleCards[0] : null;
  }

  canPlayerAct(playerIndex) {
    if (this.phase !== 'player-turns') return false;
    if (playerIndex !== this.activePlayerIndex) return false;

    const player = this.players[playerIndex];
    if (player.status !== 'playing') return false;

    const hand = this.getCurrentHand(player);
    return !isBusted(hand) && !isBlackjack(hand);
  }

  getAvailableActions(playerIndex) {
    if (!this.canPlayerAct(playerIndex)) return [];

    const player = this.players[playerIndex];
    const hand = this.getCurrentHand(player);
    const actions = ['hit', 'stand'];

    // Can double if 2 cards and enough funds
    const currentBet = player.splitHands.length > 0
      ? player.splitBets[player.currentSplitHandIndex]
      : player.currentBet;

    if (canDoubleDown(hand) && player.bankroll >= currentBet) {
      actions.push('double');
    }

    // Can split if 2 matching cards and enough funds
    if (player.splitHands.length === 0 && canSplit(player.hand) && player.bankroll >= player.currentBet) {
      // Initial split from main hand
      actions.push('split');
    } else if (player.splitHands.length > 0 && player.currentSplitHandIndex >= 0) {
      // Check for resplit aces
      const currentHand = player.splitHands[player.currentSplitHandIndex];
      const isFromAces = player.splitFromAces[player.currentSplitHandIndex];
      const currentBet = player.splitBets[player.currentSplitHandIndex];

      if (this.allowResplitAces && isFromAces && canSplit(currentHand) && player.bankroll >= currentBet) {
        actions.push('split');
      }
    }

    // Can surrender if allowed and on first two cards
    if (this.canSurrender(playerIndex)) {
      actions.push('surrender');
    }

    return actions;
  }
}

// Export utilities for AI agents
export { getBestHandValue, isBusted, isBlackjack, isSoftHand, canDoubleDown, canSplit };

// Browser global export
if (typeof window !== 'undefined') {
  window.MultiplayerBlackjackGame = MultiplayerBlackjackGame;
}
