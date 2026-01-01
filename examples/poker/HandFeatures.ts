/**
 * Rich Hand Feature Extraction for Poker RL
 *
 * Extracts ~80 features from the current game state for RL training:
 *
 * Card Encodings (28 features):
 *   - Hole cards: rank, suit, suited, connected, pocket pair
 *   - Community cards: encoded by position
 *
 * Hand Strength (10 features):
 *   - Current hand rank (0-9)
 *   - Hand rank one-hot encoding
 *
 * Drawing Features (8 features):
 *   - Flush draw, open-ended straight, gutshot
 *   - Backdoor draws
 *   - Overcards
 *
 * Board Texture (8 features):
 *   - Paired, two-paired, trips on board
 *   - Monotone, two-tone
 *   - Connectedness, high card
 *
 * Betting Context (15 features):
 *   - Pot odds, stack-to-pot ratio
 *   - Position, street
 *   - Bet sizes relative to pot
 *
 * History (10 features):
 *   - Actions this street
 *   - Aggression indicators
 */

import { Card, getRankValue, evaluateHand, HandRank } from "./HandEvaluator.js";
import { PokerGameState, PokerPhase } from "./PokerGame.js";

export interface RichObservation {
  features: number[];
  featureNames: string[];
}

const SUITS = ["hearts", "diamonds", "clubs", "spades"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

/**
 * Extract all features for a player's observation
 */
export function extractFeatures(
  state: PokerGameState,
  playerName: string
): RichObservation {
  const features: number[] = [];
  const featureNames: string[] = [];

  const player = state.players.find(p => p.name === playerName);
  const opponent = state.players.find(p => p.name !== playerName);

  if (!player || !opponent) {
    return { features: new Array(80).fill(0), featureNames: [] };
  }

  // === HOLE CARD FEATURES (14) ===
  const holeFeatures = extractHoleCardFeatures(player.holeCards);
  features.push(...holeFeatures.values);
  featureNames.push(...holeFeatures.names);

  // === COMMUNITY CARD FEATURES (10) ===
  const commFeatures = extractCommunityFeatures(state.communityCards);
  features.push(...commFeatures.values);
  featureNames.push(...commFeatures.names);

  // === HAND STRENGTH (12) ===
  const strengthFeatures = extractHandStrength(player.holeCards, state.communityCards);
  features.push(...strengthFeatures.values);
  featureNames.push(...strengthFeatures.names);

  // === DRAWING FEATURES (8) ===
  const drawFeatures = extractDrawingFeatures(player.holeCards, state.communityCards);
  features.push(...drawFeatures.values);
  featureNames.push(...drawFeatures.names);

  // === BOARD TEXTURE (8) ===
  const textureFeatures = extractBoardTexture(state.communityCards);
  features.push(...textureFeatures.values);
  featureNames.push(...textureFeatures.names);

  // === BETTING CONTEXT (16) ===
  const bettingFeatures = extractBettingContext(state, player, opponent);
  features.push(...bettingFeatures.values);
  featureNames.push(...bettingFeatures.names);

  // === POSITION & STREET (6) ===
  const positionFeatures = extractPositionFeatures(state, player);
  features.push(...positionFeatures.values);
  featureNames.push(...positionFeatures.names);

  return { features, featureNames };
}

interface FeatureSet {
  values: number[];
  names: string[];
}

/**
 * Hole card features
 */
function extractHoleCardFeatures(holeCards: Card[]): FeatureSet {
  const values: number[] = [];
  const names: string[] = [];

  if (holeCards.length < 2) {
    return { values: new Array(14).fill(0), names: new Array(14).fill("hole_empty") };
  }

  const [card1, card2] = holeCards;
  const rank1 = getRankValue(card1.rank);
  const rank2 = getRankValue(card2.rank);
  const highRank = Math.max(rank1, rank2);
  const lowRank = Math.min(rank1, rank2);

  // Normalized ranks (2-14 -> 0-1)
  values.push(normalize(highRank, 2, 14));
  names.push("hole_high_rank");

  values.push(normalize(lowRank, 2, 14));
  names.push("hole_low_rank");

  // Suited
  values.push(card1.suit === card2.suit ? 1 : 0);
  names.push("hole_suited");

  // Pocket pair
  values.push(rank1 === rank2 ? 1 : 0);
  names.push("hole_pocket_pair");

  // Gap between cards (0 = connected, 1 = one-gapper, etc.)
  const gap = highRank - lowRank - 1;
  values.push(normalize(Math.min(gap, 10), 0, 10));
  names.push("hole_gap");

  // Premium indicators
  values.push(highRank >= 13 && lowRank >= 13 ? 1 : 0); // AA, KK, AK
  names.push("hole_premium");

  values.push(highRank >= 10 && lowRank >= 10 ? 1 : 0); // Broadway
  names.push("hole_broadway");

  // Connectedness (good for straights)
  values.push(gap <= 2 && lowRank >= 5 ? 1 : 0);
  names.push("hole_connected");

  // Suit encoding (one-hot would be 4 values, use 2 for compactness)
  const suitIdx1 = SUITS.indexOf(card1.suit);
  const suitIdx2 = SUITS.indexOf(card2.suit);
  values.push(normalize(suitIdx1, 0, 3));
  names.push("hole_suit1");
  values.push(normalize(suitIdx2, 0, 3));
  names.push("hole_suit2");

  // High card strength (A=1, K=0.9, etc.)
  values.push(normalize(highRank, 2, 14));
  names.push("hole_highcard_strength");

  // Pair strength if pocket pair
  values.push(rank1 === rank2 ? normalize(rank1, 2, 14) : 0);
  names.push("hole_pair_strength");

  // Suited connector bonus
  values.push(card1.suit === card2.suit && gap <= 1 ? 1 : 0);
  names.push("hole_suited_connector");

  return { values, names };
}

/**
 * Community card features
 */
function extractCommunityFeatures(community: Card[]): FeatureSet {
  const values: number[] = [];
  const names: string[] = [];

  // High card on board
  const ranks = community.map(c => getRankValue(c.rank));
  const maxRank = ranks.length > 0 ? Math.max(...ranks) : 0;
  values.push(normalize(maxRank, 0, 14));
  names.push("board_high_card");

  // Number of community cards (street indicator)
  values.push(normalize(community.length, 0, 5));
  names.push("board_card_count");

  // Average rank
  const avgRank = ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : 0;
  values.push(normalize(avgRank, 2, 14));
  names.push("board_avg_rank");

  // Board has ace
  values.push(ranks.includes(14) ? 1 : 0);
  names.push("board_has_ace");

  // Board has king
  values.push(ranks.includes(13) ? 1 : 0);
  names.push("board_has_king");

  // Low board (all cards < 9)
  values.push(ranks.every(r => r < 9) ? 1 : 0);
  names.push("board_is_low");

  // High board (all cards >= 10)
  values.push(ranks.length > 0 && ranks.every(r => r >= 10) ? 1 : 0);
  names.push("board_is_high");

  // Mixed board
  values.push(maxRank - Math.min(...ranks, 14) >= 6 ? 1 : 0);
  names.push("board_is_mixed");

  // Number of broadway cards (10+)
  const broadwayCount = ranks.filter(r => r >= 10).length;
  values.push(normalize(broadwayCount, 0, 5));
  names.push("board_broadway_count");

  // Number of wheel cards (A-5)
  const wheelCards = ranks.filter(r => r <= 5 || r === 14).length;
  values.push(normalize(wheelCards, 0, 5));
  names.push("board_wheel_count");

  return { values, names };
}

/**
 * Hand strength features
 */
function extractHandStrength(holeCards: Card[], community: Card[]): FeatureSet {
  const values: number[] = [];
  const names: string[] = [];

  const allCards = [...holeCards, ...community];
  const hand = allCards.length >= 5 ? evaluateHand(allCards) : null;

  // Hand rank (0-9)
  const handRank = hand?.rank ?? 0;
  values.push(normalize(handRank, 0, 9));
  names.push("hand_rank");

  // One-hot encoding for hand type (10 values)
  for (let i = 0; i <= 9; i++) {
    values.push(handRank === i ? 1 : 0);
    names.push(`hand_is_${getHandTypeName(i)}`);
  }

  // Made hand (pair or better)
  values.push(handRank >= 1 ? 1 : 0);
  names.push("hand_is_made");

  return { values, names };
}

function getHandTypeName(rank: number): string {
  const names = ["highcard", "pair", "twopair", "trips", "straight", "flush", "fullhouse", "quads", "straightflush", "royalflush"];
  return names[rank] ?? "unknown";
}

/**
 * Drawing features
 */
function extractDrawingFeatures(holeCards: Card[], community: Card[]): FeatureSet {
  const values: number[] = [];
  const names: string[] = [];

  const allCards = [...holeCards, ...community];

  // Flush draw
  const flushDraw = hasFlushDraw(allCards);
  values.push(flushDraw ? 1 : 0);
  names.push("draw_flush");

  // Made flush
  values.push(hasFlush(allCards) ? 1 : 0);
  names.push("has_flush");

  // Open-ended straight draw (8 outs)
  const oesdRaw = hasOESD(allCards);
  values.push(oesdRaw ? 1 : 0);
  names.push("draw_oesd");

  // Gutshot straight draw (4 outs)
  values.push(hasGutshot(allCards) ? 1 : 0);
  names.push("draw_gutshot");

  // Made straight
  values.push(hasStraight(allCards) ? 1 : 0);
  names.push("has_straight");

  // Backdoor flush draw (only on flop)
  values.push(community.length === 3 && hasBackdoorFlush(allCards) ? 1 : 0);
  names.push("draw_backdoor_flush");

  // Overcards (hole cards higher than board)
  const overcards = countOvercards(holeCards, community);
  values.push(normalize(overcards, 0, 2));
  names.push("overcards");

  // Drawing to nuts (flush draw with A or straight draw to nuts)
  values.push(hasNutDraw(holeCards, community) ? 1 : 0);
  names.push("draw_to_nuts");

  return { values, names };
}

/**
 * Board texture features
 */
function extractBoardTexture(community: Card[]): FeatureSet {
  const values: number[] = [];
  const names: string[] = [];

  if (community.length === 0) {
    return { values: new Array(8).fill(0), names: new Array(8).fill("texture_empty") };
  }

  const ranks = community.map(c => getRankValue(c.rank));
  const suits = community.map(c => c.suit);

  // Paired board
  const rankCounts = countOccurrences(ranks);
  const maxRankCount = Math.max(...Object.values(rankCounts));
  values.push(maxRankCount >= 2 ? 1 : 0);
  names.push("board_paired");

  // Two pair on board
  const pairCount = Object.values(rankCounts).filter(c => c >= 2).length;
  values.push(pairCount >= 2 ? 1 : 0);
  names.push("board_two_paired");

  // Trips on board
  values.push(maxRankCount >= 3 ? 1 : 0);
  names.push("board_trips");

  // Monotone (3+ same suit)
  const suitCounts = countOccurrences(suits);
  const maxSuitCount = Math.max(...Object.values(suitCounts));
  values.push(maxSuitCount >= 3 ? 1 : 0);
  names.push("board_monotone");

  // Two-tone (exactly 2 suits)
  values.push(Object.keys(suitCounts).length === 2 ? 1 : 0);
  names.push("board_twotone");

  // Rainbow (3+ suits on flop)
  values.push(Object.keys(suitCounts).length >= 3 ? 1 : 0);
  names.push("board_rainbow");

  // Connected (potential straight)
  const sortedRanks = [...ranks].sort((a, b) => a - b);
  let maxConnect = 1;
  let connect = 1;
  for (let i = 1; i < sortedRanks.length; i++) {
    if (sortedRanks[i] - sortedRanks[i-1] <= 2) {
      connect++;
      maxConnect = Math.max(maxConnect, connect);
    } else {
      connect = 1;
    }
  }
  values.push(normalize(maxConnect, 1, 5));
  names.push("board_connectedness");

  // Wet board (drawing potential)
  const isWet = maxSuitCount >= 2 || maxConnect >= 3;
  values.push(isWet ? 1 : 0);
  names.push("board_wet");

  return { values, names };
}

/**
 * Betting context features
 */
function extractBettingContext(
  state: PokerGameState,
  player: { chips: number; currentBet: number; totalBetThisRound: number; allIn: boolean },
  opponent: { chips: number; currentBet: number; allIn: boolean }
): FeatureSet {
  const values: number[] = [];
  const names: string[] = [];

  const pot = state.pot;
  const toCall = state.currentBet - player.currentBet;
  const effectiveStack = Math.min(player.chips, opponent.chips);
  const totalChips = player.chips + opponent.chips + pot;

  // Pot size (normalized)
  values.push(normalize(pot, 0, totalChips));
  names.push("pot_size");

  // Amount to call (normalized to pot)
  values.push(pot > 0 ? Math.min(toCall / pot, 2) : 0);
  names.push("to_call_ratio");

  // Pot odds (call / (pot + call))
  const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
  values.push(potOdds);
  names.push("pot_odds");

  // Stack to pot ratio (SPR)
  const spr = pot > 0 ? effectiveStack / pot : 10;
  values.push(normalize(Math.min(spr, 20), 0, 20));
  names.push("spr");

  // My stack (normalized)
  values.push(normalize(player.chips, 0, totalChips));
  names.push("my_stack");

  // Opponent stack (normalized)
  values.push(normalize(opponent.chips, 0, totalChips));
  names.push("opp_stack");

  // Stack ratio (my stack / opponent stack)
  const stackRatio = opponent.chips > 0 ? player.chips / opponent.chips : 1;
  values.push(normalize(Math.min(stackRatio, 3), 0, 3));
  names.push("stack_ratio");

  // Am I all-in?
  values.push(player.allIn ? 1 : 0);
  names.push("im_allin");

  // Is opponent all-in?
  values.push(opponent.allIn ? 1 : 0);
  names.push("opp_allin");

  // Facing bet
  values.push(toCall > 0 ? 1 : 0);
  names.push("facing_bet");

  // Bet size relative to pot
  const betToPot = pot > 0 ? toCall / pot : 0;
  values.push(Math.min(betToPot, 2));
  names.push("bet_to_pot");

  // Can check
  values.push(toCall === 0 ? 1 : 0);
  names.push("can_check");

  // Committed to pot (total bet this hand / starting stack)
  values.push(normalize(player.totalBetThisRound, 0, 100));
  names.push("committed");

  // Current bet level
  values.push(normalize(state.currentBet, 0, 100));
  names.push("current_bet");

  // Last raise amount (normalized)
  values.push(normalize(state.lastRaiseAmount, 0, 50));
  names.push("last_raise");

  // Actions this round
  values.push(normalize(state.actionsThisRound, 0, 10));
  names.push("actions_this_round");

  return { values, names };
}

/**
 * Position and street features
 */
function extractPositionFeatures(
  state: PokerGameState,
  player: { isDealer: boolean }
): FeatureSet {
  const values: number[] = [];
  const names: string[] = [];

  // Position (dealer = in position for heads-up post-flop)
  values.push(player.isDealer ? 1 : 0);
  names.push("is_button");

  // Street one-hot encoding
  const phases: PokerPhase[] = ["preflop", "flop", "turn", "river", "showdown", "complete"];
  for (const phase of phases.slice(0, 4)) {
    values.push(state.phase === phase ? 1 : 0);
    names.push(`street_${phase}`);
  }

  // Is showdown
  values.push(state.phase === "showdown" || state.phase === "complete" ? 1 : 0);
  names.push("is_showdown");

  return { values, names };
}

// === Helper Functions ===

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function countOccurrences<T>(arr: T[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of arr) {
    const key = String(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function hasFlushDraw(cards: Card[]): boolean {
  const suitCounts = countOccurrences(cards.map(c => c.suit));
  return Object.values(suitCounts).some(c => c === 4);
}

function hasFlush(cards: Card[]): boolean {
  const suitCounts = countOccurrences(cards.map(c => c.suit));
  return Object.values(suitCounts).some(c => c >= 5);
}

function hasBackdoorFlush(cards: Card[]): boolean {
  const suitCounts = countOccurrences(cards.map(c => c.suit));
  return Object.values(suitCounts).some(c => c === 3);
}

function hasOESD(cards: Card[]): boolean {
  // Open-ended straight draw: 4 consecutive cards
  const ranks = [...new Set(cards.map(c => getRankValue(c.rank)))].sort((a, b) => a - b);

  for (let i = 0; i <= ranks.length - 4; i++) {
    if (ranks[i + 3] - ranks[i] === 3) {
      // 4 consecutive, check if open-ended (not A-2-3-4 or J-Q-K-A)
      const low = ranks[i];
      const high = ranks[i + 3];
      if (low > 2 && high < 14) return true;
    }
  }
  return false;
}

function hasGutshot(cards: Card[]): boolean {
  // Gutshot: 4 cards with one gap
  const ranks = [...new Set(cards.map(c => getRankValue(c.rank)))].sort((a, b) => a - b);

  for (let i = 0; i <= ranks.length - 4; i++) {
    const span = ranks[i + 3] - ranks[i];
    if (span === 4) {
      // 4 cards spanning 5 ranks = one gap
      return true;
    }
  }
  return false;
}

function hasStraight(cards: Card[]): boolean {
  const ranks = [...new Set(cards.map(c => getRankValue(c.rank)))].sort((a, b) => a - b);

  // Check for wheel (A-2-3-4-5)
  if (ranks.includes(14) && ranks.includes(2) && ranks.includes(3) && ranks.includes(4) && ranks.includes(5)) {
    return true;
  }

  // Check normal straights
  for (let i = 0; i <= ranks.length - 5; i++) {
    if (ranks[i + 4] - ranks[i] === 4) {
      return true;
    }
  }
  return false;
}

function countOvercards(holeCards: Card[], community: Card[]): number {
  if (community.length === 0) return 0;

  const boardMax = Math.max(...community.map(c => getRankValue(c.rank)));
  return holeCards.filter(c => getRankValue(c.rank) > boardMax).length;
}

function hasNutDraw(holeCards: Card[], community: Card[]): boolean {
  // Simplified: flush draw with Ace
  const allCards = [...holeCards, ...community];
  const suitCounts: Record<string, Card[]> = {};

  for (const card of allCards) {
    if (!suitCounts[card.suit]) suitCounts[card.suit] = [];
    suitCounts[card.suit].push(card);
  }

  for (const [suit, cards] of Object.entries(suitCounts)) {
    if (cards.length === 4) {
      // Flush draw - check if we have the Ace
      const holeInSuit = holeCards.filter(c => c.suit === suit);
      if (holeInSuit.some(c => c.rank === "A")) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get feature names for documentation
 */
export function getFeatureNames(): string[] {
  // Generate a dummy observation to get names
  const dummyState: PokerGameState = {
    players: [
      { name: "p1", chips: 100, holeCards: [{rank: "A", suit: "hearts"}, {rank: "K", suit: "hearts"}], currentBet: 0, totalBetThisRound: 0, folded: false, allIn: false, isDealer: true },
      { name: "p2", chips: 100, holeCards: [{rank: "2", suit: "clubs"}, {rank: "3", suit: "clubs"}], currentBet: 0, totalBetThisRound: 0, folded: false, allIn: false, isDealer: false },
    ],
    communityCards: [{rank: "Q", suit: "hearts"}, {rank: "J", suit: "hearts"}, {rank: "10", suit: "diamonds"}],
    pot: 10,
    currentBet: 0,
    phase: "flop",
    currentPlayerIndex: 0,
    dealerIndex: 0,
    smallBlind: 1,
    bigBlind: 2,
    lastRaiseAmount: 2,
    actionsThisRound: 0,
    winner: null,
    winningHand: null,
  };

  return extractFeatures(dummyState, "p1").featureNames;
}
