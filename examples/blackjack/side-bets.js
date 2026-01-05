/**
 * Side Bets for Blackjack
 *
 * Implements popular side bets:
 * - Perfect Pairs: Pays if player's first 2 cards are a pair
 * - 21+3: Pays based on 3-card poker hand (player's 2 cards + dealer's up card)
 */

/**
 * Check and evaluate Perfect Pairs side bet
 * @param {Array} playerCards - Player's first two cards
 * @returns {object} - { isPair: boolean, type: string, payout: number }
 */
export function evaluatePerfectPairs(playerCards) {
  if (playerCards.length !== 2) {
    return { isPair: false, type: null, payout: 0 };
  }

  const card1 = playerCards[0];
  const card2 = playerCards[1];

  // Extract rank and suit
  const rank1 = card1.meta.rank;
  const rank2 = card2.meta.rank;
  const suit1 = card1.meta.suit;
  const suit2 = card2.meta.suit;
  const color1 = card1.meta.color;
  const color2 = card2.meta.color;

  // Not a pair if ranks don't match
  if (rank1 !== rank2) {
    return { isPair: false, type: null, payout: 0 };
  }

  // Perfect pair (same suit and rank) - 30:1
  // Note: This is rare with multiple decks but possible
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

/**
 * Check and evaluate 21+3 side bet
 * @param {Array} playerCards - Player's first two cards
 * @param {object} dealerUpCard - Dealer's up card
 * @returns {object} - { hasWin: boolean, type: string, payout: number }
 */
export function evaluate21Plus3(playerCards, dealerUpCard) {
  if (playerCards.length !== 2 || !dealerUpCard) {
    return { hasWin: false, type: null, payout: 0 };
  }

  const cards = [...playerCards, dealerUpCard];

  // Extract ranks and suits
  const ranks = cards.map(c => c.meta.rank);
  const suits = cards.map(c => c.meta.suit);

  // Convert ranks to numeric values for straight checking
  const rankValues = ranks.map(rankToValue);
  const sortedValues = [...rankValues].sort((a, b) => a - b);

  // Check for flush (all same suit)
  const isFlush = suits.every(s => s === suits[0]);

  // Check for straight
  const isStraight = checkStraight(sortedValues);

  // Check for three of a kind
  const isThreeOfKind = ranks.every(r => r === ranks[0]);

  // Suited three of a kind (perfect three of a kind, same suit) - 100:1
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

/**
 * Convert card rank to numeric value for straight checking
 * @param {string} rank - Card rank
 * @returns {number}
 */
function rankToValue(rank) {
  const rankMap = {
    'A': 1,  // Ace can be 1 or 14 for straights
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    '10': 10,
    'J': 11,
    'Q': 12,
    'K': 13
  };
  return rankMap[rank] || 0;
}

/**
 * Check if three cards form a straight
 * @param {Array} sortedValues - Sorted numeric card values
 * @returns {boolean}
 */
function checkStraight(sortedValues) {
  // Regular straight (e.g., 5-6-7)
  if (sortedValues[1] === sortedValues[0] + 1 &&
      sortedValues[2] === sortedValues[1] + 1) {
    return true;
  }

  // Ace-high straight (Q-K-A becomes 12-13-14)
  if (sortedValues[0] === 1 && sortedValues[1] === 12 && sortedValues[2] === 13) {
    return true; // Q-K-A
  }

  return false;
}

/**
 * Check and evaluate Royal Match side bet
 *
 * Royal Match pays when the player's first two cards are suited,
 * with a bonus for a suited King and Queen ("Royal Match").
 *
 * Payouts:
 * - Royal Match (suited K-Q): 25:1
 * - Suited cards (any two suited): 2.5:1 (pays 5:2)
 *
 * @param {Array} playerCards - Player's first two cards
 * @returns {object} - { hasWin: boolean, type: string, payout: number }
 */
export function evaluateRoyalMatch(playerCards) {
  if (playerCards.length !== 2) {
    return { hasWin: false, type: null, payout: 0 };
  }

  const card1 = playerCards[0];
  const card2 = playerCards[1];

  const rank1 = card1.meta.rank;
  const rank2 = card2.meta.rank;
  const suit1 = card1.meta.suit;
  const suit2 = card2.meta.suit;

  // Must be suited for any payout
  if (suit1 !== suit2) {
    return { hasWin: false, type: null, payout: 0 };
  }

  // Check for Royal Match (K-Q suited)
  const isKingQueen = (rank1 === 'K' && rank2 === 'Q') ||
                      (rank1 === 'Q' && rank2 === 'K');

  if (isKingQueen) {
    return { hasWin: true, type: 'royal-match', payout: 25 };
  }

  // Any other suited pair pays 2.5:1 (we'll use 2.5 as multiplier)
  return { hasWin: true, type: 'suited', payout: 2.5 };
}

/**
 * Check and evaluate Super Sevens side bet
 *
 * Super Sevens pays based on the number of 7s in the player's hand.
 * The bet is evaluated progressively as cards are dealt.
 * For simplicity, this evaluates at initial deal (2 cards) or after hit (3 cards).
 *
 * Payouts (2-card evaluation):
 * - One 7: 3:1
 * - Two unsuited 7s: 50:1
 * - Two suited 7s: 100:1
 *
 * Payouts (3-card evaluation - if dealer has 7 up):
 * - Three unsuited 7s: 500:1
 * - Three suited 7s: 5000:1
 *
 * @param {Array} playerCards - Player's cards (first 2 or 3)
 * @param {object} dealerUpCard - Dealer's up card (optional, for 3-card eval)
 * @returns {object} - { hasWin: boolean, type: string, payout: number }
 */
export function evaluateSuperSevens(playerCards, dealerUpCard = null) {
  if (playerCards.length < 2) {
    return { hasWin: false, type: null, payout: 0 };
  }

  // Find all 7s in player's hand
  const sevens = playerCards.filter(card => card.meta.rank === '7');
  const numSevens = sevens.length;

  // No 7s = no win
  if (numSevens === 0) {
    return { hasWin: false, type: null, payout: 0 };
  }

  // Check if dealer's up card is also a 7 (for three 7s bonus)
  const dealerHasSeven = dealerUpCard && dealerUpCard.meta.rank === '7';

  // Three 7s (player has 2 sevens + dealer up card is 7)
  if (numSevens === 2 && dealerHasSeven) {
    const allSevens = [...sevens, dealerUpCard];
    const allSameSuit = allSevens.every(card => card.meta.suit === allSevens[0].meta.suit);

    if (allSameSuit) {
      return { hasWin: true, type: 'three-suited-sevens', payout: 5000 };
    }
    return { hasWin: true, type: 'three-unsuited-sevens', payout: 500 };
  }

  // Two 7s in player's hand
  if (numSevens === 2) {
    const sameSuit = sevens[0].meta.suit === sevens[1].meta.suit;

    if (sameSuit) {
      return { hasWin: true, type: 'two-suited-sevens', payout: 100 };
    }
    return { hasWin: true, type: 'two-unsuited-sevens', payout: 50 };
  }

  // One 7 in player's hand
  if (numSevens === 1) {
    return { hasWin: true, type: 'one-seven', payout: 3 };
  }

  return { hasWin: false, type: null, payout: 0 };
}

/**
 * Side Bet Manager - tracks and resolves side bets
 */
export class SideBetManager {
  constructor() {
    this.perfectPairsBet = 0;
    this.twentyOnePlus3Bet = 0;
    this.royalMatchBet = 0;
    this.superSevensBet = 0;
    this.stats = {
      perfectPairsPlaced: 0,
      perfectPairsWon: 0,
      perfectPairsTotalWagered: 0,
      perfectPairsTotalWon: 0,
      twentyOnePlus3Placed: 0,
      twentyOnePlus3Won: 0,
      twentyOnePlus3TotalWagered: 0,
      twentyOnePlus3TotalWon: 0,
      royalMatchPlaced: 0,
      royalMatchWon: 0,
      royalMatchTotalWagered: 0,
      royalMatchTotalWon: 0,
      superSevensPlaced: 0,
      superSevensWon: 0,
      superSevensTotalWagered: 0,
      superSevensTotalWon: 0
    };
  }

  /**
   * Place Perfect Pairs side bet
   * @param {number} amount - Bet amount
   */
  placePerfectPairsBet(amount) {
    this.perfectPairsBet = amount;
    this.stats.perfectPairsPlaced++;
    this.stats.perfectPairsTotalWagered += amount;
  }

  /**
   * Place 21+3 side bet
   * @param {number} amount - Bet amount
   */
  place21Plus3Bet(amount) {
    this.twentyOnePlus3Bet = amount;
    this.stats.twentyOnePlus3Placed++;
    this.stats.twentyOnePlus3TotalWagered += amount;
  }

  /**
   * Place Royal Match side bet
   * @param {number} amount - Bet amount
   */
  placeRoyalMatchBet(amount) {
    this.royalMatchBet = amount;
    this.stats.royalMatchPlaced++;
    this.stats.royalMatchTotalWagered += amount;
  }

  /**
   * Place Super Sevens side bet
   * @param {number} amount - Bet amount
   */
  placeSuperSevensBet(amount) {
    this.superSevensBet = amount;
    this.stats.superSevensPlaced++;
    this.stats.superSevensTotalWagered += amount;
  }

  /**
   * Resolve Perfect Pairs bet
   * @param {Array} playerCards - Player's first two cards
   * @returns {object} - Resolution details
   */
  resolvePerfectPairs(playerCards) {
    if (this.perfectPairsBet === 0) {
      return { win: false, payout: 0, type: null };
    }

    const result = evaluatePerfectPairs(playerCards);

    if (result.isPair) {
      const payout = this.perfectPairsBet * result.payout;
      this.stats.perfectPairsWon++;
      this.stats.perfectPairsTotalWon += payout;

      const bet = this.perfectPairsBet;
      this.perfectPairsBet = 0;

      return {
        win: true,
        payout: payout + bet, // Return bet + winnings
        type: result.type,
        multiplier: result.payout
      };
    }

    this.perfectPairsBet = 0;
    return { win: false, payout: 0, type: null };
  }

  /**
   * Resolve 21+3 bet
   * @param {Array} playerCards - Player's first two cards
   * @param {object} dealerUpCard - Dealer's up card
   * @returns {object} - Resolution details
   */
  resolve21Plus3(playerCards, dealerUpCard) {
    if (this.twentyOnePlus3Bet === 0) {
      return { win: false, payout: 0, type: null };
    }

    const result = evaluate21Plus3(playerCards, dealerUpCard);

    if (result.hasWin) {
      const payout = this.twentyOnePlus3Bet * result.payout;
      this.stats.twentyOnePlus3Won++;
      this.stats.twentyOnePlus3TotalWon += payout;

      const bet = this.twentyOnePlus3Bet;
      this.twentyOnePlus3Bet = 0;

      return {
        win: true,
        payout: payout + bet, // Return bet + winnings
        type: result.type,
        multiplier: result.payout
      };
    }

    this.twentyOnePlus3Bet = 0;
    return { win: false, payout: 0, type: null };
  }

  /**
   * Resolve Royal Match bet
   * @param {Array} playerCards - Player's first two cards
   * @returns {object} - Resolution details
   */
  resolveRoyalMatch(playerCards) {
    if (this.royalMatchBet === 0) {
      return { win: false, payout: 0, type: null };
    }

    const result = evaluateRoyalMatch(playerCards);

    if (result.hasWin) {
      const payout = this.royalMatchBet * result.payout;
      this.stats.royalMatchWon++;
      this.stats.royalMatchTotalWon += payout;

      const bet = this.royalMatchBet;
      this.royalMatchBet = 0;

      return {
        win: true,
        payout: payout + bet, // Return bet + winnings
        type: result.type,
        multiplier: result.payout
      };
    }

    this.royalMatchBet = 0;
    return { win: false, payout: 0, type: null };
  }

  /**
   * Resolve Super Sevens bet
   * @param {Array} playerCards - Player's cards (first 2)
   * @param {object} dealerUpCard - Dealer's up card (for 3-seven bonus)
   * @returns {object} - Resolution details
   */
  resolveSuperSevens(playerCards, dealerUpCard = null) {
    if (this.superSevensBet === 0) {
      return { win: false, payout: 0, type: null };
    }

    const result = evaluateSuperSevens(playerCards, dealerUpCard);

    if (result.hasWin) {
      const payout = this.superSevensBet * result.payout;
      this.stats.superSevensWon++;
      this.stats.superSevensTotalWon += payout;

      const bet = this.superSevensBet;
      this.superSevensBet = 0;

      return {
        win: true,
        payout: payout + bet, // Return bet + winnings
        type: result.type,
        multiplier: result.payout
      };
    }

    this.superSevensBet = 0;
    return { win: false, payout: 0, type: null };
  }

  /**
   * Clear all bets (called at start of new round)
   */
  clearBets() {
    this.perfectPairsBet = 0;
    this.twentyOnePlus3Bet = 0;
    this.royalMatchBet = 0;
    this.superSevensBet = 0;
  }

  /**
   * Get statistics
   * @returns {object}
   */
  getStats() {
    return {
      ...this.stats,
      perfectPairsWinRate: this.stats.perfectPairsPlaced > 0
        ? ((this.stats.perfectPairsWon / this.stats.perfectPairsPlaced) * 100).toFixed(1)
        : 0,
      perfectPairsROI: this.stats.perfectPairsTotalWagered > 0
        ? ((this.stats.perfectPairsTotalWon - this.stats.perfectPairsTotalWagered) / this.stats.perfectPairsTotalWagered * 100).toFixed(1)
        : 0,
      twentyOnePlus3WinRate: this.stats.twentyOnePlus3Placed > 0
        ? ((this.stats.twentyOnePlus3Won / this.stats.twentyOnePlus3Placed) * 100).toFixed(1)
        : 0,
      twentyOnePlus3ROI: this.stats.twentyOnePlus3TotalWagered > 0
        ? ((this.stats.twentyOnePlus3TotalWon - this.stats.twentyOnePlus3TotalWagered) / this.stats.twentyOnePlus3TotalWagered * 100).toFixed(1)
        : 0,
      royalMatchWinRate: this.stats.royalMatchPlaced > 0
        ? ((this.stats.royalMatchWon / this.stats.royalMatchPlaced) * 100).toFixed(1)
        : 0,
      royalMatchROI: this.stats.royalMatchTotalWagered > 0
        ? ((this.stats.royalMatchTotalWon - this.stats.royalMatchTotalWagered) / this.stats.royalMatchTotalWagered * 100).toFixed(1)
        : 0,
      superSevensWinRate: this.stats.superSevensPlaced > 0
        ? ((this.stats.superSevensWon / this.stats.superSevensPlaced) * 100).toFixed(1)
        : 0,
      superSevensROI: this.stats.superSevensTotalWagered > 0
        ? ((this.stats.superSevensTotalWon - this.stats.superSevensTotalWagered) / this.stats.superSevensTotalWagered * 100).toFixed(1)
        : 0
    };
  }
}

/**
 * Format side bet results for display
 * @param {object} perfectPairsResult - Perfect Pairs resolution result
 * @param {object} twentyOnePlus3Result - 21+3 resolution result
 * @param {object} royalMatchResult - Royal Match resolution result (optional)
 * @param {object} superSevensResult - Super Sevens resolution result (optional)
 * @returns {string}
 */
export function formatSideBetResults(perfectPairsResult, twentyOnePlus3Result, royalMatchResult = null, superSevensResult = null) {
  let output = '\n🎰 SIDE BETS:\n';
  let hasWin = false;

  if (perfectPairsResult && perfectPairsResult.win) {
    hasWin = true;
    const typeLabels = {
      'perfect': '🌟 Perfect Pair',
      'colored': '🎨 Colored Pair',
      'mixed': '🔀 Mixed Pair'
    };
    output += `  ${typeLabels[perfectPairsResult.type]} - ${perfectPairsResult.multiplier}:1 - Win: $${perfectPairsResult.payout}\n`;
  }

  if (twentyOnePlus3Result && twentyOnePlus3Result.win) {
    hasWin = true;
    const typeLabels = {
      'suited-three-of-kind': '💎 Suited Three of a Kind',
      'straight-flush': '🔥 Straight Flush',
      'three-of-kind': '🎯 Three of a Kind',
      'straight': '📏 Straight',
      'flush': '💧 Flush'
    };
    output += `  ${typeLabels[twentyOnePlus3Result.type]} - ${twentyOnePlus3Result.multiplier}:1 - Win: $${twentyOnePlus3Result.payout}\n`;
  }

  if (royalMatchResult && royalMatchResult.win) {
    hasWin = true;
    const typeLabels = {
      'royal-match': '👑 Royal Match (K-Q Suited)',
      'suited': '♠️ Suited Cards'
    };
    output += `  ${typeLabels[royalMatchResult.type]} - ${royalMatchResult.multiplier}:1 - Win: $${royalMatchResult.payout}\n`;
  }

  if (superSevensResult && superSevensResult.win) {
    hasWin = true;
    const typeLabels = {
      'three-suited-sevens': '🌟 Three Suited 7s',
      'three-unsuited-sevens': '🎰 Three 7s',
      'two-suited-sevens': '💎 Two Suited 7s',
      'two-unsuited-sevens': '🎲 Two 7s',
      'one-seven': '7️⃣ One 7'
    };
    output += `  ${typeLabels[superSevensResult.type]} - ${superSevensResult.multiplier}:1 - Win: $${superSevensResult.payout}\n`;
  }

  if (!hasWin) {
    output += '  No winning side bets\n';
  }

  return output;
}
