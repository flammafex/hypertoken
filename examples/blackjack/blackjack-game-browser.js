/**
 * Browser-compatible Blackjack Game
 *
 * A standalone version that doesn't require Node.js file system operations.
 * Uses inlined deck data and simplified state management.
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
// Utility Functions (from blackjack-utils.js)
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

function formatHand(cards, hideFirst = false) {
  if (!cards || cards.length === 0) return "Empty hand";

  const cardStrings = cards.map((card, i) => {
    if (hideFirst && i === 0) {
      return "[Hidden]";
    }
    return `${card.char} ${card.label}`;
  });

  if (hideFirst) {
    const visibleCards = cards.slice(1);
    const visibleValue = getBestHandValue(visibleCards);
    return `${cardStrings.join(", ")} (showing: ${visibleValue})`;
  }

  const value = getBestHandValue(cards);
  const soft = isSoftHand(cards);
  const valueStr = soft ? `soft ${value}` : value;

  return `${cardStrings.join(", ")} (${valueStr})`;
}

function determineWinner(agentCards, dealerCards) {
  const agentValue = getBestHandValue(agentCards);
  const dealerValue = getBestHandValue(dealerCards);
  const agentBJ = isBlackjack(agentCards);
  const dealerBJ = isBlackjack(dealerCards);

  if (agentBJ && dealerBJ) return "push";
  if (agentBJ) return "agent-blackjack";
  if (dealerBJ) return "dealer";
  if (agentValue > 21) return "dealer";
  if (dealerValue > 21) return "agent";
  if (agentValue > dealerValue) return "agent";
  if (dealerValue > agentValue) return "dealer";
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

function canTakeInsurance(dealerCards) {
  if (!dealerCards || dealerCards.length === 0) return false;
  const visibleCard = dealerCards.length > 1 ? dealerCards[1] : dealerCards[0];
  return visibleCard.meta?.rank === 'A';
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

// ============================================================================
// Seeded Random (for deterministic shuffle)
// ============================================================================

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
// BlackjackGame Class
// ============================================================================

export class BlackjackGame {
  constructor({ numDecks = 6, seed = null, initialBankroll = 1000, minBet = 5, maxBet = 500, variant = 'american', dealerHitsSoft17 = false, allowSurrender = false, resplitAces = true } = {}) {
    this.variant = variant;
    this.numDecks = numDecks;
    this.minBet = minBet;
    this.maxBet = maxBet;
    this.dealerHitsSoft17 = dealerHitsSoft17;
    this.allowSurrender = allowSurrender;
    this.resplitAces = resplitAces;

    // Initialize random
    this.random = new SeededRandom(seed);

    // Create shoe with multiple decks
    this.shoe = [];
    this.initializeShoe();

    // Player state
    this.bankroll = initialBankroll;
    this.currentBet = 0;

    // Hands
    this.playerHand = [];
    this.dealerHand = [];

    // Split hands
    this.splitHands = [];
    this.splitBets = [];
    this.splitFromAces = false; // Track if current split is from aces
    this.currentSplitHandIndex = -1;

    // Cut card - placed ~1.5 decks from end (78 cards for 6-deck shoe)
    this.cutCardPosition = Math.floor(52 * 1.5);
    this.cutCardReached = false;

    // Game state
    this.gameState = {
      dealerTurn: false,
      gameOver: false,
      playerStood: false,
      result: null,
      insuranceOffered: false,
      insuranceTaken: false,
      insuranceBet: 0
    };

    // Side bets
    this.perfectPairsBet = 0;
    this.twentyOnePlus3Bet = 0;
    this.luckyLadiesBet = 0;
    this.busterBlackjackBet = 0;
    this.sideBetResults = null;

    // Shuffle the shoe
    this.shuffle();

    // Burn card state
    this.needsBurn = true; // Need to burn after fresh shuffle
    this.burnedCard = null;

    // Card counting (Hi-Lo system)
    // 2-6: +1, 7-9: 0, 10-A: -1
    this.runningCount = 0;
  }

  placePerfectPairsBet(amount) {
    if (amount > this.bankroll) {
      throw new Error(`Insufficient funds for Perfect Pairs bet. Bankroll: ${this.bankroll}`);
    }
    this.bankroll -= amount;
    this.perfectPairsBet = amount;
    return this.bankroll;
  }

  place21Plus3Bet(amount) {
    if (amount > this.bankroll) {
      throw new Error(`Insufficient funds for 21+3 bet. Bankroll: ${this.bankroll}`);
    }
    this.bankroll -= amount;
    this.twentyOnePlus3Bet = amount;
    return this.bankroll;
  }

  placeLuckyLadiesBet(amount) {
    if (amount > this.bankroll) {
      throw new Error(`Insufficient funds for Lucky Ladies bet. Bankroll: ${this.bankroll}`);
    }
    this.bankroll -= amount;
    this.luckyLadiesBet = amount;
    return this.bankroll;
  }

  placeBusterBlackjackBet(amount) {
    if (amount > this.bankroll) {
      throw new Error(`Insufficient funds for Buster Blackjack bet. Bankroll: ${this.bankroll}`);
    }
    this.bankroll -= amount;
    this.busterBlackjackBet = amount;
    return this.bankroll;
  }

  resolveSideBets() {
    if (this.playerHand.length !== 2) {
      return null;
    }

    const results = {
      perfectPairs: null,
      twentyOnePlus3: null
    };

    // Resolve Perfect Pairs
    if (this.perfectPairsBet > 0) {
      const ppResult = evaluatePerfectPairs(this.playerHand);
      if (ppResult.isPair) {
        const payout = this.perfectPairsBet * ppResult.payout + this.perfectPairsBet;
        this.bankroll += payout;
        results.perfectPairs = {
          win: true,
          type: ppResult.type,
          multiplier: ppResult.payout,
          payout: payout
        };
      } else {
        results.perfectPairs = { win: false, type: null, payout: 0 };
      }
      this.perfectPairsBet = 0;
    }

    // Resolve 21+3
    if (this.twentyOnePlus3Bet > 0) {
      // Get dealer's up card
      const dealerUpCard = this.variant === 'european'
        ? this.dealerHand[0]
        : this.dealerHand[1];

      const tpResult = evaluate21Plus3(this.playerHand, dealerUpCard);
      if (tpResult.hasWin) {
        const payout = this.twentyOnePlus3Bet * tpResult.payout + this.twentyOnePlus3Bet;
        this.bankroll += payout;
        results.twentyOnePlus3 = {
          win: true,
          type: tpResult.type,
          multiplier: tpResult.payout,
          payout: payout
        };
      } else {
        results.twentyOnePlus3 = { win: false, type: null, payout: 0 };
      }
      this.twentyOnePlus3Bet = 0;
    }

    this.sideBetResults = results;
    return results;
  }

  /**
   * Resolve side bets that depend on dealer's final hand.
   * Called after dealer plays their hand.
   * @returns {object} Results for Lucky Ladies and Buster Blackjack
   */
  resolveDealerDependentSideBets() {
    const results = {
      luckyLadies: null,
      busterBlackjack: null
    };

    // Resolve Lucky Ladies (depends on dealer blackjack for top payout)
    if (this.luckyLadiesBet > 0) {
      const dealerHasBJ = isBlackjack(this.dealerHand);
      const llResult = evaluateLuckyLadies(this.playerHand, dealerHasBJ);
      if (llResult.hasWin) {
        const payout = this.luckyLadiesBet * llResult.payout + this.luckyLadiesBet;
        this.bankroll += payout;
        results.luckyLadies = {
          win: true,
          type: llResult.type,
          multiplier: llResult.payout,
          payout: payout
        };
      } else {
        results.luckyLadies = { win: false, type: null, payout: 0 };
      }
      this.luckyLadiesBet = 0;
    }

    // Resolve Buster Blackjack (pays when dealer busts)
    if (this.busterBlackjackBet > 0) {
      const bbResult = evaluateBusterBlackjack(this.dealerHand);
      if (bbResult.hasWin) {
        const payout = this.busterBlackjackBet * bbResult.payout + this.busterBlackjackBet;
        this.bankroll += payout;
        results.busterBlackjack = {
          win: true,
          type: bbResult.type,
          multiplier: bbResult.payout,
          payout: payout
        };
      } else {
        results.busterBlackjack = { win: false, type: null, payout: 0 };
      }
      this.busterBlackjackBet = 0;
    }

    // Merge with existing side bet results
    if (this.sideBetResults) {
      this.sideBetResults = { ...this.sideBetResults, ...results };
    } else {
      this.sideBetResults = results;
    }

    return results;
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
    this.needsBurn = true;
    this.runningCount = 0; // Reset count on shuffle
  }

  /**
   * Get the Hi-Lo count value for a card.
   * 2-6: +1 (low cards help dealer)
   * 7-9: 0 (neutral)
   * 10, J, Q, K, A: -1 (high cards help player)
   */
  getCardCountValue(card) {
    const rank = card.meta?.rank;
    if (['2', '3', '4', '5', '6'].includes(rank)) {
      return 1;
    } else if (['10', 'J', 'Q', 'K', 'A'].includes(rank)) {
      return -1;
    }
    return 0; // 7, 8, 9 are neutral
  }

  /**
   * Count a card (add its value to running count).
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
   * True count is more accurate for betting decisions.
   */
  getTrueCount() {
    const decksRemaining = this.shoe.length / 52;
    if (decksRemaining < 0.5) {
      // Avoid division by very small numbers
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

  /**
   * Check if a burn card is needed before dealing.
   * @returns {boolean} True if burn card should be performed
   */
  shouldBurnCard() {
    return this.needsBurn;
  }

  /**
   * Burn the top card from the shoe (discard without showing).
   * Called after shuffle, before first deal.
   * @returns {object} The burned card (face down)
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
   * @returns {object|null} The burned card or null
   */
  getBurnedCard() {
    return this.burnedCard;
  }

  draw() {
    if (this.shoe.length === 0) {
      this.initializeShoe();
      this.shuffle();
      // Note: mid-game reshuffle burn is handled automatically by shuffle()
    }

    // Check if we've reached the cut card
    if (this.shoe.length <= this.cutCardPosition && !this.cutCardReached) {
      this.cutCardReached = true;
    }

    const card = this.shoe.pop();
    this.countCard(card); // Count every card dealt
    return card;
  }

  /**
   * Check if reshuffle is needed (cut card was reached).
   * Should be called after each hand completes.
   */
  shouldReshuffle() {
    return this.cutCardReached;
  }

  /**
   * Perform reshuffle after cut card reached.
   */
  reshuffle() {
    this.initializeShoe();
    this.shuffle();
    this.cutCardReached = false;
  }

  placeBet(amount) {
    if (amount < this.minBet || amount > this.maxBet) {
      throw new Error(`Bet must be between ${this.minBet} and ${this.maxBet}`);
    }
    if (amount > this.bankroll) {
      throw new Error(`Insufficient funds. Bankroll: ${this.bankroll}`);
    }
    this.currentBet = amount;
    this.bankroll -= amount;
    return this.bankroll;
  }

  deal() {
    // Reset hands
    this.playerHand = [];
    this.dealerHand = [];
    this.splitHands = [];
    this.splitBets = [];
    this.currentSplitHandIndex = -1;

    // Reset game state
    this.gameState = {
      dealerTurn: false,
      gameOver: false,
      playerStood: false,
      result: null,
      insuranceOffered: false,
      insuranceTaken: false,
      insuranceBet: 0
    };

    // Clear previous side bet results (but keep pending bets)
    this.sideBetResults = null;

    // Deal 2 cards to player
    this.playerHand.push(this.draw());
    this.playerHand.push(this.draw());

    // Deal cards to dealer based on variant
    if (this.variant === 'european') {
      // European: Only 1 card initially (face up)
      this.dealerHand.push({ ...this.draw(), faceUp: true });
    } else {
      // American: 2 cards (one face down, one face up)
      this.dealerHand.push({ ...this.draw(), faceUp: false });
      this.dealerHand.push({ ...this.draw(), faceUp: true });
    }

    // Check for insurance opportunity (American only)
    if (this.variant === 'american' && canTakeInsurance(this.dealerHand)) {
      this.gameState.insuranceOffered = true;
    }

    // Check for player blackjack
    if (isBlackjack(this.playerHand)) {
      this.standAndResolve();
    }

    return this.getGameState();
  }

  hit() {
    if (this.gameState.gameOver) {
      throw new Error("Game is over. Start a new round.");
    }
    if (this.gameState.playerStood) {
      throw new Error("Player has already stood.");
    }

    // If playing split hands
    if (this.splitHands.length > 0 && this.currentSplitHandIndex >= 0) {
      return this.hitSplitHand(this.currentSplitHandIndex);
    }

    this.playerHand.push(this.draw());

    if (isBusted(this.playerHand)) {
      this.gameState.gameOver = true;
      this.gameState.result = "dealer";
    }

    return this.getGameState();
  }

  stand() {
    if (this.gameState.gameOver) {
      throw new Error("Game is over. Start a new round.");
    }
    if (this.gameState.playerStood) {
      throw new Error("Player has already stood.");
    }

    // If playing split hands
    if (this.splitHands.length > 0 && this.currentSplitHandIndex >= 0) {
      return this.standSplitHand(this.currentSplitHandIndex);
    }

    this.standAndResolve();
    return this.getGameState();
  }

  standAndResolve() {
    this.gameState.playerStood = true;
    this.gameState.dealerTurn = true;

    // Reveal dealer's hidden card
    if (this.variant === 'european') {
      this.dealerHand.push({ ...this.draw(), faceUp: true });
    } else {
      if (this.dealerHand[0]) {
        this.dealerHand[0].faceUp = true;
      }
    }

    // Resolve insurance
    if (this.gameState.insuranceTaken) {
      this.resolveInsurance();
    }

    // Play dealer hand
    this.playDealerHand();
  }

  doubleDown() {
    if (this.gameState.gameOver) {
      throw new Error("Game is over. Start a new round.");
    }
    if (this.gameState.playerStood) {
      throw new Error("Player has already stood.");
    }

    const hand = this.splitHands.length > 0 ? this.splitHands[this.currentSplitHandIndex] : this.playerHand;

    if (!canDoubleDown(hand)) {
      throw new Error("Cannot double down - must have exactly 2 cards.");
    }

    if (this.bankroll < this.currentBet) {
      throw new Error("Insufficient funds to double down.");
    }

    // Double the bet
    this.bankroll -= this.currentBet;

    if (this.splitHands.length > 0) {
      this.splitBets[this.currentSplitHandIndex] *= 2;
    } else {
      this.currentBet *= 2;
    }

    // Take exactly one card
    if (this.splitHands.length > 0) {
      this.splitHands[this.currentSplitHandIndex].push(this.draw());
      // Auto-advance to next hand (doubling ends play on this hand)
      this.advanceToNextSplitHand();
      return this.getSplitGameState();
    } else {
      this.playerHand.push(this.draw());

      if (isBusted(this.playerHand)) {
        this.gameState.gameOver = true;
        this.gameState.result = "dealer";
      } else {
        this.standAndResolve();
      }
      return this.getGameState();
    }
  }

  split() {
    if (this.gameState.gameOver) {
      throw new Error("Game is over. Start a new round.");
    }
    if (this.gameState.playerStood) {
      throw new Error("Player has already stood.");
    }

    if (!canSplit(this.playerHand)) {
      throw new Error("Cannot split - must have exactly 2 cards of the same rank.");
    }

    if (this.bankroll < this.currentBet) {
      throw new Error("Insufficient funds to split.");
    }

    // Check if splitting aces
    const splittingAces = this.playerHand[0].meta.rank === 'A';

    // Deduct split bet
    this.bankroll -= this.currentBet;

    // Create split hands
    this.splitHands = [
      [this.playerHand[0]],
      [this.playerHand[1]]
    ];
    this.splitBets = [this.currentBet, this.currentBet];
    this.splitFromAces = splittingAces;
    this.currentSplitHandIndex = 0;

    // Deal one card to each split hand
    this.splitHands[0].push(this.draw());
    this.splitHands[1].push(this.draw());

    // Clear main hand
    this.playerHand = [];

    // If splitting aces, player gets only one card per hand - auto resolve
    if (splittingAces) {
      this.currentSplitHandIndex = -1;
      this.resolveSplitHands();
    }

    return this.getSplitGameState();
  }

  hitSplitHand(handIndex) {
    if (handIndex >= this.splitHands.length) {
      throw new Error(`Invalid hand index: ${handIndex}`);
    }

    // Cannot hit on split aces
    if (this.splitFromAces) {
      throw new Error("Cannot hit on split aces - one card only.");
    }

    this.splitHands[handIndex].push(this.draw());

    if (isBusted(this.splitHands[handIndex])) {
      this.advanceToNextSplitHand();
    }

    return this.getSplitGameState();
  }

  standSplitHand(handIndex) {
    if (handIndex >= this.splitHands.length) {
      throw new Error(`Invalid hand index: ${handIndex}`);
    }

    this.advanceToNextSplitHand();
    return this.getSplitGameState();
  }

  advanceToNextSplitHand() {
    this.currentSplitHandIndex++;

    if (this.currentSplitHandIndex >= this.splitHands.length) {
      // All split hands played, resolve
      this.currentSplitHandIndex = -1;
      this.resolveSplitHands();
    }
  }

  resolveSplitHands() {
    this.gameState.dealerTurn = true;

    // Reveal dealer's hidden card
    if (this.variant === 'european') {
      this.dealerHand.push({ ...this.draw(), faceUp: true });
    } else {
      if (this.dealerHand[0]) {
        this.dealerHand[0].faceUp = true;
      }
    }

    // Play dealer hand
    this.playDealerHand();

    // Calculate results for each split hand
    const results = [];
    let totalPayout = 0;

    for (let i = 0; i < this.splitHands.length; i++) {
      const hand = this.splitHands[i];
      const bet = this.splitBets[i];

      let result;
      if (isBusted(hand)) {
        result = "dealer";
      } else {
        result = determineWinner(hand, this.dealerHand);
        // 21 on split aces is NOT blackjack - pays 1:1 only
        if (result === "agent-blackjack" && this.splitFromAces) {
          result = "agent";
        }
      }

      results.push({
        handIndex: i,
        result,
        cards: hand,
        value: getBestHandValue(hand),
        busted: isBusted(hand)
      });

      // Calculate payout (split hands never get 3:2)
      if (result === "agent-blackjack") {
        // This can still happen for non-ace splits getting blackjack
        // But per Vegas rules, split hands don't get 3:2 even then
        totalPayout += bet * 2; // Pay 1:1 for split blackjack
      } else if (result === "agent") {
        totalPayout += bet * 2;
      } else if (result === "push") {
        totalPayout += bet;
      }
    }

    this.bankroll += totalPayout;
    this.gameState.gameOver = true;
    this.gameState.splitResults = results;
  }

  reSplit(handIndex) {
    if (this.splitHands.length >= 4) {
      throw new Error("Maximum 4 hands reached. Cannot split further.");
    }

    const hand = this.splitHands[handIndex];
    if (!canSplit(hand)) {
      throw new Error("Cannot re-split - must have exactly 2 cards of the same rank.");
    }

    if (this.bankroll < this.currentBet) {
      throw new Error("Insufficient funds to re-split.");
    }

    this.bankroll -= this.currentBet;

    // Split the hand
    const newHand = [hand.pop()];
    newHand.push(this.draw());
    hand.push(this.draw());

    // Insert new hand after current
    this.splitHands.splice(handIndex + 1, 0, newHand);
    this.splitBets.splice(handIndex + 1, 0, this.currentBet);

    return this.getSplitGameState();
  }

  takeInsurance(amount = null) {
    if (this.variant === 'european') {
      throw new Error("Insurance not available in European blackjack variant.");
    }

    if (!this.gameState.insuranceOffered) {
      throw new Error("Insurance not available.");
    }

    if (this.gameState.insuranceTaken) {
      throw new Error("Insurance already taken.");
    }

    const insuranceAmount = amount !== null ? amount : this.currentBet / 2;

    if (insuranceAmount > this.currentBet / 2) {
      throw new Error(`Insurance bet cannot exceed half of original bet ($${this.currentBet / 2})`);
    }
    if (insuranceAmount > this.bankroll) {
      throw new Error(`Insufficient funds for insurance. Bankroll: ${this.bankroll}`);
    }

    this.bankroll -= insuranceAmount;
    this.gameState.insuranceBet = insuranceAmount;
    this.gameState.insuranceTaken = true;

    return this.getGameState();
  }

  /**
   * Check dealer's hole card for blackjack after insurance decision.
   * In American blackjack, dealer peeks after insurance is offered/declined.
   * If dealer has blackjack, hand ends immediately.
   *
   * @returns {object} Game state with dealerHasBlackjack flag
   */
  checkDealerBlackjack() {
    if (this.variant !== 'american') {
      return { dealerHasBlackjack: false, ...this.getGameState() };
    }

    // Only check if insurance was offered (dealer shows Ace)
    if (!this.gameState.insuranceOffered) {
      return { dealerHasBlackjack: false, ...this.getGameState() };
    }

    // Mark insurance as resolved (no longer offered)
    this.gameState.insuranceOffered = false;

    // Check if dealer has blackjack
    if (isBlackjack(this.dealerHand)) {
      // Reveal dealer's hole card
      if (this.dealerHand[0]) {
        this.dealerHand[0].faceUp = true;
      }

      // Resolve insurance bet
      if (this.gameState.insuranceTaken && this.gameState.insuranceBet > 0) {
        // Insurance pays 2:1
        this.bankroll += this.gameState.insuranceBet * 3;
        this.gameState.insuranceBet = 0;
      }

      // Check if player also has blackjack (push on main bet)
      if (isBlackjack(this.playerHand)) {
        this.bankroll += this.currentBet; // Return main bet
        this.gameState.result = 'push';
      } else {
        // Dealer wins main bet
        this.gameState.result = 'dealer';
      }

      this.gameState.gameOver = true;
      return { dealerHasBlackjack: true, ...this.getGameState() };
    }

    // Dealer doesn't have blackjack - insurance bet is lost (already deducted)
    // Game continues normally
    this.gameState.insuranceBet = 0; // Clear the bet (already lost)
    return { dealerHasBlackjack: false, ...this.getGameState() };
  }

  /**
   * Decline insurance and check dealer for blackjack.
   * Convenience method that handles declining + peeking in one call.
   */
  declineInsurance() {
    if (!this.gameState.insuranceOffered) {
      throw new Error("Insurance not available.");
    }

    // Mark as not taken but check for dealer blackjack
    this.gameState.insuranceOffered = false;

    // Check if dealer has blackjack
    if (isBlackjack(this.dealerHand)) {
      // Reveal dealer's hole card
      if (this.dealerHand[0]) {
        this.dealerHand[0].faceUp = true;
      }

      // Check if player also has blackjack (push)
      if (isBlackjack(this.playerHand)) {
        this.bankroll += this.currentBet;
        this.gameState.result = 'push';
      } else {
        this.gameState.result = 'dealer';
      }

      this.gameState.gameOver = true;
      return { dealerHasBlackjack: true, ...this.getGameState() };
    }

    return { dealerHasBlackjack: false, ...this.getGameState() };
  }

  resolveInsurance() {
    if (!this.gameState.insuranceBet) return;

    if (isBlackjack(this.dealerHand)) {
      // Insurance pays 2:1
      this.bankroll += this.gameState.insuranceBet * 3;
    }

    this.gameState.insuranceBet = 0;
  }

  /**
   * Late surrender - forfeit half the bet and end the hand.
   * Only available on first two cards, before any other action.
   */
  surrender() {
    if (!this.allowSurrender) {
      throw new Error("Surrender is not allowed.");
    }
    if (this.gameState.gameOver) {
      throw new Error("Game is over. Start a new round.");
    }
    if (this.gameState.playerStood) {
      throw new Error("Player has already stood.");
    }
    if (this.playerHand.length !== 2) {
      throw new Error("Surrender only available on first two cards.");
    }
    if (this.splitHands.length > 0) {
      throw new Error("Cannot surrender after splitting.");
    }

    // Return half the bet
    this.bankroll += this.currentBet / 2;
    this.gameState.gameOver = true;
    this.gameState.result = 'surrender';

    return this.getGameState();
  }

  /**
   * Check if surrender is available for current hand state.
   */
  canSurrender() {
    return this.allowSurrender &&
           !this.gameState.gameOver &&
           !this.gameState.playerStood &&
           this.playerHand.length === 2 &&
           this.splitHands.length === 0;
  }

  playDealerHand() {
    let dealerValue = getBestHandValue(this.dealerHand);

    // Dealer hits on 16 or less, stands on 17+ (or hits soft 17 if enabled)
    while (dealerValue < 17 || (this.dealerHitsSoft17 && dealerValue === 17 && isSoftHand(this.dealerHand))) {
      this.dealerHand.push({ ...this.draw(), faceUp: true });
      dealerValue = getBestHandValue(this.dealerHand);
    }

    this.gameState.dealerTurn = false;
    this.gameState.gameOver = true;

    // Determine final result (only if not split)
    if (this.splitHands.length === 0) {
      this.gameState.result = determineWinner(this.playerHand, this.dealerHand);

      // Calculate payout
      let payout = 0;
      if (this.gameState.result === "agent-blackjack") {
        payout = this.currentBet + (this.currentBet * 1.5);
      } else if (this.gameState.result === "agent") {
        payout = this.currentBet * 2;
      } else if (this.gameState.result === "push") {
        payout = this.currentBet;
      }

      this.bankroll += payout;
    }
  }

  getGameState() {
    const showFullDealer = this.gameState.gameOver || this.gameState.dealerTurn;

    // Get visible dealer cards
    const visibleDealerCards = this.dealerHand.filter((c, i) => {
      if (showFullDealer) return true;
      return c.faceUp;
    });

    const canTakeActions = !this.gameState.gameOver &&
                           !this.gameState.playerStood &&
                           !isBusted(this.playerHand) &&
                           !isBlackjack(this.playerHand) &&
                           this.splitHands.length === 0;

    return {
      playerHand: {
        cards: this.playerHand,
        value: getBestHandValue(this.playerHand),
        busted: isBusted(this.playerHand),
        blackjack: isBlackjack(this.playerHand),
        display: formatHand(this.playerHand)
      },
      dealerHand: {
        cards: this.dealerHand,
        visibleCards: showFullDealer ? this.dealerHand : visibleDealerCards,
        value: showFullDealer ? getBestHandValue(this.dealerHand) : null,
        visibleValue: getBestHandValue(visibleDealerCards),
        busted: showFullDealer ? isBusted(this.dealerHand) : null,
        blackjack: showFullDealer ? isBlackjack(this.dealerHand) : null,
        display: formatHand(this.dealerHand, !showFullDealer)
      },
      bankroll: this.bankroll,
      currentBet: this.currentBet,
      gameOver: this.gameState.gameOver,
      result: this.gameState.result,
      canHit: canTakeActions,
      canStand: canTakeActions,
      canDouble: canTakeActions && canDoubleDown(this.playerHand) && this.bankroll >= this.currentBet,
      canSplit: canTakeActions && canSplit(this.playerHand) && this.bankroll >= this.currentBet && this.splitHands.length === 0,
      canSurrender: this.canSurrender(),
      canInsurance: this.variant === 'american' &&
                    this.playerHand.length === 2 &&
                    !this.gameState.insuranceTaken &&
                    this.gameState.insuranceOffered,
      variant: this.variant,
      isSplit: this.splitHands.length > 0,
      deckCount: this.shoe.length,
      needsBurn: this.needsBurn,
      burnedCard: this.burnedCard,
      sideBetResults: this.sideBetResults,
      pendingSideBets: {
        perfectPairs: this.perfectPairsBet,
        twentyOnePlus3: this.twentyOnePlus3Bet,
        luckyLadies: this.luckyLadiesBet,
        busterBlackjack: this.busterBlackjackBet
      },
      cutCardReached: this.cutCardReached,
      countInfo: this.getCountInfo()
    };
  }

  getSplitGameState() {
    const showFullDealer = this.gameState.gameOver || this.gameState.dealerTurn;

    const visibleDealerCards = this.dealerHand.filter((c, i) => {
      if (showFullDealer) return true;
      return c.faceUp;
    });

    const splitHandStates = this.splitHands.map((hand, i) => ({
      cards: hand,
      value: getBestHandValue(hand),
      busted: isBusted(hand),
      blackjack: isBlackjack(hand),
      display: formatHand(hand),
      active: i === this.currentSplitHandIndex,
      canReSplit: canSplit(hand) && this.splitHands.length < 4 && this.bankroll >= this.currentBet &&
                  (this.resplitAces || hand[0].meta.rank !== 'A')
    }));

    const currentHand = this.currentSplitHandIndex >= 0 ? this.splitHands[this.currentSplitHandIndex] : null;
    const canTakeActions = !this.gameState.gameOver &&
                           this.currentSplitHandIndex >= 0 &&
                           currentHand &&
                           !isBusted(currentHand);

    // Cannot hit/double on split aces
    const canHitOrDouble = canTakeActions && !this.splitFromAces;

    return {
      splitHands: splitHandStates,
      splitFromAces: this.splitFromAces,
      dealerHand: {
        cards: this.dealerHand,
        visibleCards: showFullDealer ? this.dealerHand : visibleDealerCards,
        value: showFullDealer ? getBestHandValue(this.dealerHand) : null,
        visibleValue: getBestHandValue(visibleDealerCards),
        busted: showFullDealer ? isBusted(this.dealerHand) : null,
        blackjack: showFullDealer ? isBlackjack(this.dealerHand) : null,
        display: formatHand(this.dealerHand, !showFullDealer)
      },
      bankroll: this.bankroll,
      currentBet: this.currentBet,
      currentHand: this.currentSplitHandIndex,
      splitHandsCount: this.splitHands.length,
      gameOver: this.gameState.gameOver,
      results: this.gameState.splitResults || [],
      canHit: canHitOrDouble,
      canStand: canTakeActions,
      canDouble: canHitOrDouble && currentHand && canDoubleDown(currentHand) && this.bankroll >= this.currentBet,
      canReSplit: canTakeActions && currentHand && canSplit(currentHand) && this.splitHands.length < 4 && this.bankroll >= this.currentBet &&
                  (this.resplitAces || currentHand[0].meta.rank !== 'A'),
      variant: this.variant,
      deckCount: this.shoe.length,
      cutCardReached: this.cutCardReached,
      countInfo: this.getCountInfo()
    };
  }

  getResultMessage() {
    const result = this.gameState.result;
    if (!result) return null;

    switch (result) {
      case "agent-blackjack":
        return "BLACKJACK! You win 3:2!";
      case "agent":
        return "You win!";
      case "dealer":
        return "Dealer wins.";
      case "push":
        return "Push - tie game.";
      default:
        return null;
    }
  }

  newRound() {
    // Reshuffle if running low
    if (this.shoe.length < 52) {
      this.initializeShoe();
      this.shuffle();
    }

    // Keep current bet if sufficient funds
    if (this.currentBet > this.bankroll) {
      this.currentBet = this.bankroll;
    }

    return this.deal();
  }

  isBroke() {
    return this.bankroll < this.minBet;
  }
}

// Export for browser use
if (typeof window !== 'undefined') {
  window.BlackjackGame = BlackjackGame;
}
