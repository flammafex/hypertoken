/**
 * Poker Hand Evaluator
 *
 * Evaluates Texas Hold'em poker hands and compares them.
 * Uses standard poker hand rankings from high to low:
 *   9: Royal Flush     - A-K-Q-J-10 same suit
 *   8: Straight Flush  - 5 consecutive same suit
 *   7: Four of a Kind  - 4 cards same rank
 *   6: Full House      - 3 of a kind + pair
 *   5: Flush           - 5 same suit
 *   4: Straight        - 5 consecutive ranks
 *   3: Three of a Kind - 3 same rank
 *   2: Two Pair        - 2 different pairs
 *   1: One Pair        - 2 same rank
 *   0: High Card       - Nothing
 */

export interface Card {
  rank: string;  // "2"-"10", "J", "Q", "K", "A"
  suit: string;  // "hearts", "diamonds", "clubs", "spades"
}

export interface HandRank {
  rank: number;       // 0-9 hand ranking
  name: string;       // Human-readable name
  tiebreakers: number[];  // For comparing same-rank hands
}

// Rank value mapping (Ace is 14 for normal use, 1 for low straight)
const RANK_VALUES: Record<string, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, "10": 10, "J": 11, "Q": 12, "K": 13, "A": 14
};

// Hand rank names
const HAND_NAMES = [
  "High Card",
  "One Pair",
  "Two Pair",
  "Three of a Kind",
  "Straight",
  "Flush",
  "Full House",
  "Four of a Kind",
  "Straight Flush",
  "Royal Flush"
];

/**
 * Convert card token to Card interface
 */
export function tokenToCard(token: { meta?: { rank?: string; suit?: string } }): Card | null {
  if (!token.meta?.rank || !token.meta?.suit) return null;
  return { rank: token.meta.rank, suit: token.meta.suit };
}

/**
 * Get numeric value for a rank
 */
export function getRankValue(rank: string): number {
  return RANK_VALUES[rank] ?? 0;
}

/**
 * Evaluate the best 5-card hand from any number of cards (typically 7 in Texas Hold'em)
 */
export function evaluateHand(cards: Card[]): HandRank {
  if (cards.length < 5) {
    return { rank: 0, name: "High Card", tiebreakers: cards.map(c => getRankValue(c.rank)).sort((a, b) => b - a) };
  }

  // Generate all 5-card combinations
  const combinations = getCombinations(cards, 5);

  let bestHand: HandRank = { rank: -1, name: "", tiebreakers: [] };

  for (const combo of combinations) {
    const hand = evaluate5Cards(combo);
    if (compareHands(hand, bestHand) > 0) {
      bestHand = hand;
    }
  }

  return bestHand;
}

/**
 * Evaluate exactly 5 cards
 */
function evaluate5Cards(cards: Card[]): HandRank {
  const values = cards.map(c => getRankValue(c.rank)).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);
  const isStraight = checkStraight(values);
  const straightHighCard = isStraight ? getStraightHighCard(values) : 0;

  // Count ranks
  const rankCounts: Record<number, number> = {};
  for (const v of values) {
    rankCounts[v] = (rankCounts[v] || 0) + 1;
  }

  const counts = Object.entries(rankCounts)
    .map(([rank, count]) => ({ rank: parseInt(rank), count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  // Royal Flush
  if (isFlush && isStraight && straightHighCard === 14) {
    return { rank: 9, name: "Royal Flush", tiebreakers: [14] };
  }

  // Straight Flush
  if (isFlush && isStraight) {
    return { rank: 8, name: "Straight Flush", tiebreakers: [straightHighCard] };
  }

  // Four of a Kind
  if (counts[0].count === 4) {
    const kicker = counts[1].rank;
    return { rank: 7, name: "Four of a Kind", tiebreakers: [counts[0].rank, kicker] };
  }

  // Full House
  if (counts[0].count === 3 && counts[1].count === 2) {
    return { rank: 6, name: "Full House", tiebreakers: [counts[0].rank, counts[1].rank] };
  }

  // Flush
  if (isFlush) {
    return { rank: 5, name: "Flush", tiebreakers: values };
  }

  // Straight
  if (isStraight) {
    return { rank: 4, name: "Straight", tiebreakers: [straightHighCard] };
  }

  // Three of a Kind
  if (counts[0].count === 3) {
    const kickers = counts.slice(1).map(c => c.rank);
    return { rank: 3, name: "Three of a Kind", tiebreakers: [counts[0].rank, ...kickers] };
  }

  // Two Pair
  if (counts[0].count === 2 && counts[1].count === 2) {
    const pairs = [counts[0].rank, counts[1].rank].sort((a, b) => b - a);
    const kicker = counts[2].rank;
    return { rank: 2, name: "Two Pair", tiebreakers: [...pairs, kicker] };
  }

  // One Pair
  if (counts[0].count === 2) {
    const kickers = counts.slice(1).map(c => c.rank);
    return { rank: 1, name: "One Pair", tiebreakers: [counts[0].rank, ...kickers] };
  }

  // High Card
  return { rank: 0, name: "High Card", tiebreakers: values };
}

/**
 * Check if values form a straight (including A-2-3-4-5 wheel)
 */
function checkStraight(values: number[]): boolean {
  const sorted = [...new Set(values)].sort((a, b) => b - a);

  if (sorted.length < 5) return false;

  // Check normal straight
  if (sorted[0] - sorted[4] === 4) return true;

  // Check wheel (A-2-3-4-5)
  if (sorted[0] === 14 && sorted[1] === 5 && sorted[2] === 4 && sorted[3] === 3 && sorted[4] === 2) {
    return true;
  }

  return false;
}

/**
 * Get the high card of a straight
 */
function getStraightHighCard(values: number[]): number {
  const sorted = [...new Set(values)].sort((a, b) => b - a);

  // Check wheel - high card is 5, not Ace
  if (sorted[0] === 14 && sorted[1] === 5) {
    return 5;
  }

  return sorted[0];
}

/**
 * Compare two hands. Returns positive if hand1 wins, negative if hand2 wins, 0 if tie.
 */
export function compareHands(hand1: HandRank, hand2: HandRank): number {
  if (hand1.rank !== hand2.rank) {
    return hand1.rank - hand2.rank;
  }

  // Same rank - compare tiebreakers
  for (let i = 0; i < Math.max(hand1.tiebreakers.length, hand2.tiebreakers.length); i++) {
    const t1 = hand1.tiebreakers[i] ?? 0;
    const t2 = hand2.tiebreakers[i] ?? 0;
    if (t1 !== t2) return t1 - t2;
  }

  return 0;
}

/**
 * Generate all k-combinations of an array
 */
function getCombinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];

  function combine(start: number, combo: T[]) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }

    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      combine(i + 1, combo);
      combo.pop();
    }
  }

  combine(0, []);
  return result;
}

/**
 * Get hand rank name
 */
export function getHandName(rank: number): string {
  return HAND_NAMES[rank] ?? "Unknown";
}

/**
 * Format a card for display
 */
export function formatCard(card: Card): string {
  const suitSymbols: Record<string, string> = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠"
  };
  return `${card.rank}${suitSymbols[card.suit] ?? card.suit}`;
}

/**
 * Format multiple cards for display
 */
export function formatCards(cards: Card[]): string {
  return cards.map(formatCard).join(" ");
}
