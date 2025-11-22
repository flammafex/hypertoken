/**
 * Blackjack Game Implementation using HyperToken Engine
 *
 * This is a simplified single-player blackjack implementation.
 * For multi-agent games with networking support, use MultiagentBlackjackGame.
 *
 * Features:
 * - Single player vs dealer
 * - Standard blackjack rules
 * - Optional betting system integration
 * - Deterministic replay with seeds
 * - Rule-based automatic dealer play
 *
 * @see multiagent-game.js for advanced multi-player support
 */

import { parseTokenSetObject } from '../../core/loaders/tokenSetLoader.js';
import { Stack } from '../../core/Stack.js';
import { Space } from '../../core/Space.js';
import { Engine } from '../../engine/Engine.js';
import { RuleEngine } from '../../engine/RuleEngine.js';
import { Agent } from '../../engine/Agent.js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  getBestHandValue,
  isBusted,
  isBlackjack,
  formatHand,
  determineWinner,
  canDoubleDown,
  canSplit,
  canTakeInsurance
} from './blackjack-utils.js';
import { registerBlackjackRules } from './blackjack-rules.js';
import { SideBetManager } from './side-bets.js';

// Get the directory of this file (works in both source and compiled contexts)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// No ActionRegistry extensions needed - using direct method calls

/**
 * BlackjackGame class - manages game flow for single-player blackjack
 */
export class BlackjackGame {
  constructor({ numStacks = 6, seed = null, initialBankroll = null, minBet = 5, maxBet = 500, variant = 'american' } = {}) {
    // Initialize engine with Chronicle session
    this.engine = new Engine();

    // Game variant: 'american' (default) or 'european'
    // European: Dealer receives only 1 card initially, hole card dealt after player actions
    this.variant = variant;

    // Load standard deck - try multiple paths for source vs dist
    let allTokens = [];
    const possiblePaths = [
      join(__dirname, 'token-sets', 'standard-deck.json'),  // When running from source
      join(__dirname, '..', '..', 'examples', 'blackjack', 'token-sets', 'standard-deck.json')  // When running from dist
    ];

    let deckPath = possiblePaths.find(p => existsSync(p));

    if (!deckPath) {
      console.error("Failed to load deck file: Could not find standard-deck.json in any expected location");
      console.error("Tried paths:", possiblePaths);
    } else {
      try {
        const stackData = JSON.parse(readFileSync(deckPath, 'utf8'));
        const baseTokens = parseTokenSetObject(stackData).tokens;

        // Create multiple decks
        for (let i = 0; i < numStacks; i++) {
          const deckCopy = baseTokens.map(t => ({ ...t, id: `${t.id}-${i}` }));
          allTokens.push(...deckCopy);
        }
      } catch (e) {
        console.error("Failed to load deck file:", e.message);
      }
    }

    // Create stack with new API (requires Chronicle session)
    this.engine.stack = new Stack(this.engine.session, allTokens, { seed, autoInit: true });
    if (seed !== null) {
      this.engine.stack.shuffle(seed);
    }

    // Create zones
    ['agent-hand', 'dealer-hand'].forEach(zone => {
      if (!this.engine.space.zones.includes(zone)) {
        this.engine.space.createZone(zone);
      }
    });

    // Create a simple agent for single-player
    const agent = new Agent("Player");
    agent.resources.bankroll = initialBankroll || 1000;
    agent.resources.currentBet = 0;
    agent.handZone = "agent-hand";
    this.engine._agents.push(agent);

    // Add game state tracking
    this.gameState = {
      dealerTurn: false,
      gameOver: false,
      agentStood: false,
      result: null,
      insuranceOffered: false,
      insuranceTaken: false
    };

    // Betting configuration (if provided)
    this.hasBetting = initialBankroll !== null;
    this.minBet = minBet;
    this.maxBet = maxBet;

    // Side bets manager
    this.sideBetManager = new SideBetManager();

    // Setup rules
    this.ruleEngine = new RuleEngine(this.engine);
    this.engine.useRuleEngine(this.ruleEngine);
    registerBlackjackRules(this.ruleEngine);

    this.debug = false;
  }
  
  /**
   * Start a new round
   */
  deal() {
    // Clear existing hands
    this.engine.space.collectAllInto(this.engine.stack);

    // Reset game state
    this.gameState = {
      dealerTurn: false,
      gameOver: false,
      agentStood: false,
      result: null,
      insuranceOffered: false,
      insuranceTaken: false
    };

    // Deal 2 cards to agent
    for (let i = 0; i < 2; i++) {
      const card = this.engine.stack.draw();
      if (card) this.engine.space.place("agent-hand", card, { faceUp: true });
    }

    // Deal cards to dealer based on variant
    if (this.variant === 'european') {
      // European: Only 1 card initially (face up)
      const d1 = this.engine.stack.draw();
      if (d1) this.engine.space.place("dealer-hand", d1, { faceUp: true });
    } else {
      // American: 2 cards (one face down, one face up)
      const d1 = this.engine.stack.draw();
      const d2 = this.engine.stack.draw();
      if (d1) this.engine.space.place("dealer-hand", d1, { faceUp: false });
      if (d2) this.engine.space.place("dealer-hand", d2, { faceUp: true });
    }

    return this.getGameState();
  }

  /**
   * Agent hits (takes another card)
   */
  hit() {
    if (this.gameState.gameOver) {
      throw new Error("Game is over. Start a new round.");
    }
    if (this.gameState.agentStood) {
      throw new Error("Agent has already stood.");
    }

    const card = this.engine.stack.draw();
    if (card) {
      this.engine.space.place("agent-hand", card, { faceUp: true });
    }

    // Check for bust
    const agentHand = this.engine.space.zone("agent-hand").map(p => p.tokenSnapshot);
    if (isBusted(agentHand)) {
      this.gameState.gameOver = true;
      this.gameState.result = "dealer";
    }

    return this.getGameState();
  }

  /**
   * Agent stands (ends their turn)
   */
  stand() {
    if (this.gameState.gameOver) {
      throw new Error("Game is over. Start a new round.");
    }
    if (this.gameState.agentStood) {
      throw new Error("Agent has already stood.");
    }

    this.gameState.agentStood = true;
    this.gameState.dealerTurn = true;

    // Variant-specific dealer card handling
    if (this.variant === 'european') {
      // European: Deal dealer's hole card now (after player finishes)
      const holeCard = this.engine.stack.draw();
      if (holeCard) this.engine.space.place("dealer-hand", holeCard, { faceUp: true });
    } else {
      // American: Reveal dealer's hidden card
      const dealerHand = this.engine.space.zone("dealer-hand");
      if (dealerHand.length > 0 && dealerHand[0]) {
        this.engine.space.flip("dealer-hand", dealerHand[0].id, true);
      }
    }

    // Play out dealer's hand
    this.playDealerHand();

    return this.getGameState();
  }

  /**
   * Double down - double bet and take exactly one more card
   */
  doubleDown() {
    if (this.gameState.gameOver) {
      throw new Error("Game is over. Start a new round.");
    }
    if (this.gameState.agentStood) {
      throw new Error("Agent has already stood.");
    }

    const agentHand = this.engine.space.zone("agent-hand").map(p => p.tokenSnapshot);
    if (!canDoubleDown(agentHand)) {
      throw new Error("Cannot double down - must have exactly 2 cards.");
    }

    // Double the bet (if betting is enabled)
    const agent = this.engine._agents[0];
    if (this.hasBetting && agent.resources.currentBet > 0) {
      if (agent.resources.bankroll < agent.resources.currentBet) {
        throw new Error("Insufficient funds to double down.");
      }
      agent.resources.bankroll -= agent.resources.currentBet;
      agent.resources.currentBet *= 2;
    }

    // Take exactly one card
    const card = this.engine.stack.draw();
    if (card) {
      this.engine.space.place("agent-hand", card, { faceUp: true });
    }

    // Automatically stand after doubling down
    this.gameState.agentStood = true;
    this.gameState.dealerTurn = true;

    // Check for bust
    const newHand = this.engine.space.zone("agent-hand").map(p => p.tokenSnapshot);
    if (isBusted(newHand)) {
      this.gameState.gameOver = true;
      this.gameState.result = "dealer";
      return this.getGameState();
    }

    // Variant-specific dealer card handling
    if (this.variant === 'european') {
      // European: Deal dealer's hole card now (after player finishes)
      const holeCard = this.engine.stack.draw();
      if (holeCard) this.engine.space.place("dealer-hand", holeCard, { faceUp: true });
    } else {
      // American: Reveal dealer's hidden card
      const dealerHand = this.engine.space.zone("dealer-hand");
      if (dealerHand.length > 0 && dealerHand[0]) {
        this.engine.space.flip("dealer-hand", dealerHand[0].id, true);
      }
    }

    // Play out dealer's hand
    this.playDealerHand();

    return this.getGameState();
  }

  /**
   * Take insurance bet
   */
  takeInsurance(amount = null) {
    // Insurance not available in European variant (dealer only has 1 card)
    if (this.variant === 'european') {
      throw new Error("Insurance not available in European blackjack variant.");
    }

    const dealerHand = this.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);
    if (!canTakeInsurance(dealerHand)) {
      throw new Error("Insurance not available - dealer must show an Ace.");
    }

    if (this.gameState.insuranceTaken) {
      throw new Error("Insurance already taken.");
    }

    const agent = this.engine._agents[0];
    const insuranceAmount = amount !== null ? amount : agent.resources.currentBet / 2;

    // Validate insurance bet
    if (insuranceAmount > agent.resources.currentBet / 2) {
      throw new Error(`Insurance bet cannot exceed half of original bet ($${agent.resources.currentBet / 2})`);
    }
    if (insuranceAmount > agent.resources.bankroll) {
      throw new Error(`Insufficient funds for insurance. Bankroll: ${agent.resources.bankroll}`);
    }

    // Place insurance bet
    agent.resources.bankroll -= insuranceAmount;
    agent.resources.insuranceBet = insuranceAmount;
    this.gameState.insuranceTaken = true;
    this.gameState.insuranceOffered = true;

    return this.getGameState();
  }

  /**
   * Resolve insurance bet (called internally)
   */
  resolveInsurance() {
    const agent = this.engine._agents[0];
    if (!agent.resources.insuranceBet) return;

    const dealerHand = this.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);
    const dealerHasBlackjack = isBlackjack(dealerHand);

    if (dealerHasBlackjack) {
      // Insurance pays 2:1
      const payout = agent.resources.insuranceBet * 3;
      agent.resources.bankroll += payout;
    }

    agent.resources.insuranceBet = 0;
  }

  /**
   * Split hand into two separate hands
   */
  split() {
    if (this.gameState.gameOver) {
      throw new Error("Game is over. Start a new round.");
    }
    if (this.gameState.agentStood) {
      throw new Error("Agent has already stood.");
    }

    const agentHand = this.engine.space.zone("agent-hand").map(p => p.tokenSnapshot);
    if (!canSplit(agentHand)) {
      throw new Error("Cannot split - must have exactly 2 cards of the same rank.");
    }

    const agent = this.engine._agents[0];
    if (this.hasBetting) {
      if (agent.resources.bankroll < agent.resources.currentBet) {
        throw new Error("Insufficient funds to split.");
      }
      // Deduct split bet
      agent.resources.bankroll -= agent.resources.currentBet;
    }

    // Create split hand zone
    if (!this.engine.space.zones.includes("agent-hand-split")) {
      this.engine.space.createZone("agent-hand-split");
    }

    // Get the current placements and move second card to split hand
    // We need to get the placement objects before moving to avoid index issues
    const agentHandPlacements = this.engine.space.zone("agent-hand");
    const firstCardPlacement = agentHandPlacements[0];
    const secondCardPlacement = agentHandPlacements[1];

    if (agentHandPlacements.length >= 2 && secondCardPlacement) {
      // Move the second card to the split hand
      this.engine.space.move(secondCardPlacement.id, "agent-hand", "agent-hand-split");
    }

    // Deal one new card to each hand
    const card1 = this.engine.stack.draw();
    const card2 = this.engine.stack.draw();
    if (card1) this.engine.space.place("agent-hand", card1, { faceUp: true });
    if (card2) this.engine.space.place("agent-hand-split", card2, { faceUp: true });

    // Track that we have a split
    this.gameState.hasSplit = true;
    this.gameState.currentSplitHand = 0; // 0 = first hand, 1 = second hand
    this.gameState.splitHandsCount = 2;
    this.gameState.splitHandZones = ["agent-hand", "agent-hand-split"];

    return this.getSplitGameState();
  }

  /**
   * Re-split a hand (split again after initial split)
   * @param {number} handIndex - Which split hand to re-split (0 or 1)
   */
  reSplit(handIndex = 0) {
    if (!this.gameState.hasSplit) {
      throw new Error("No split hands to re-split.");
    }

    if (this.gameState.splitHandsCount >= 4) {
      throw new Error("Maximum 4 hands reached. Cannot split further.");
    }

    const handZone = this.gameState.splitHandZones[handIndex];
    const handCards = this.engine.space.zone(handZone).map(p => p.tokenSnapshot);

    if (!canSplit(handCards)) {
      throw new Error("Cannot re-split - hand must have exactly 2 cards of the same rank.");
    }

    const agent = this.engine._agents[0];
    if (this.hasBetting) {
      if (agent.resources.bankroll < agent.resources.currentBet) {
        throw new Error("Insufficient funds to re-split.");
      }
      // Deduct re-split bet
      agent.resources.bankroll -= agent.resources.currentBet;
    }

    // Create new split hand zone
    const newSplitZone = `agent-hand-split-${this.gameState.splitHandsCount}`;
    if (!this.engine.space.zones.includes(newSplitZone)) {
      this.engine.space.createZone(newSplitZone);
    }

    // Move second card to new split hand
    const handPlacements = this.engine.space.zone(handZone);
    if (handPlacements.length >= 2) {
      const secondCard = handPlacements[1];
      this.engine.space.move(secondCard.id, handZone, newSplitZone);
    }

    // Deal one card to each hand
    const card1 = this.engine.stack.draw();
    const card2 = this.engine.stack.draw();
    if (card1) this.engine.space.place(handZone, card1, { faceUp: true });
    if (card2) this.engine.space.place(newSplitZone, card2, { faceUp: true });

    // Update split hands tracking
    this.gameState.splitHandsCount++;
    this.gameState.splitHandZones.push(newSplitZone);

    return this.getSplitGameState();
  }

  /**
   * Get game state for split hands
   */
  getSplitGameState() {
    const dealerHand = this.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);
    const showFullDealer = this.gameState.gameOver || this.gameState.dealerTurn;

    // Build split hands array dynamically based on actual split hands
    const splitHands = [];
    const handZones = this.gameState.splitHandZones || ["agent-hand", "agent-hand-split"];

    // Initialize handStates if not exists
    if (!this.gameState.splitHandStates) {
      this.gameState.splitHandStates = handZones.map(() => ({ stood: false, busted: false }));
    }

    for (let i = 0; i < handZones.length; i++) {
      const zone = handZones[i];
      const cards = this.engine.space.zone(zone).map(p => p.tokenSnapshot);
      const handState = this.gameState.splitHandStates[i] || { stood: false, busted: false };

      if (cards.length > 0) {
        splitHands.push({
          zone,
          cards,
          value: getBestHandValue(cards),
          busted: isBusted(cards) || handState.busted,
          blackjack: isBlackjack(cards),
          display: formatHand(cards),
          canReSplit: canSplit(cards) && (this.gameState.splitHandsCount || 2) < 4,
          stood: handState.stood,
          active: i === this.gameState.currentSplitHand && !handState.stood && !handState.busted
        });
      }
    }

    return {
      splitHands,
      dealerHand: {
        cards: dealerHand,
        value: showFullDealer ? getBestHandValue(dealerHand) : null,
        busted: showFullDealer ? isBusted(dealerHand) : null,
        blackjack: showFullDealer ? isBlackjack(dealerHand) : null,
        display: formatHand(dealerHand, !showFullDealer)
      },
      currentHand: this.gameState.currentSplitHand,
      splitHandsCount: this.gameState.splitHandsCount || 2,
      gameOver: this.gameState.gameOver,
      results: this.gameState.splitResults || []
    };
  }

  /**
   * Hit on a specific split hand
   * @param {number} handIndex - Index of the hand to hit (0, 1, 2, or 3)
   */
  hitSplitHand(handIndex = null) {
    if (!this.gameState.hasSplit) {
      throw new Error("No split hands available.");
    }

    // Use current hand if not specified
    const index = handIndex !== null ? handIndex : this.gameState.currentSplitHand;
    const handZone = this.gameState.splitHandZones[index];

    if (!handZone) {
      throw new Error(`Invalid hand index: ${index}`);
    }

    // Check if this hand can still be played
    const handState = this.gameState.splitHandStates[index];
    if (handState.stood) {
      throw new Error("Cannot hit - hand has already stood.");
    }
    if (handState.busted) {
      throw new Error("Cannot hit - hand is busted.");
    }

    // Draw and place card
    const card = this.engine.stack.draw();
    if (card) {
      this.engine.space.place(handZone, card, { faceUp: true });
    }

    // Check for bust
    const handCards = this.engine.space.zone(handZone).map(p => p.tokenSnapshot);
    if (isBusted(handCards)) {
      this.gameState.splitHandStates[index].busted = true;
      // Auto-advance to next hand if busted
      this.advanceToNextSplitHand();
    }

    return this.getSplitGameState();
  }

  /**
   * Stand on a specific split hand
   * @param {number} handIndex - Index of the hand to stand (0, 1, 2, or 3)
   */
  standSplitHand(handIndex = null) {
    if (!this.gameState.hasSplit) {
      throw new Error("No split hands available.");
    }

    // Use current hand if not specified
    const index = handIndex !== null ? handIndex : this.gameState.currentSplitHand;

    if (index < 0 || index >= this.gameState.splitHandsCount) {
      throw new Error(`Invalid hand index: ${index}`);
    }

    // Mark hand as stood
    this.gameState.splitHandStates[index].stood = true;

    // Advance to next hand or finish
    this.advanceToNextSplitHand();

    return this.getSplitGameState();
  }

  /**
   * Double down on a specific split hand
   * @param {number} handIndex - Index of the hand to double (0, 1, 2, or 3)
   */
  doubleDownSplitHand(handIndex = null) {
    if (!this.gameState.hasSplit) {
      throw new Error("No split hands available.");
    }

    // Use current hand if not specified
    const index = handIndex !== null ? handIndex : this.gameState.currentSplitHand;
    const handZone = this.gameState.splitHandZones[index];

    if (!handZone) {
      throw new Error(`Invalid hand index: ${index}`);
    }

    const handCards = this.engine.space.zone(handZone).map(p => p.tokenSnapshot);
    if (!canDoubleDown(handCards)) {
      throw new Error("Cannot double down - must have exactly 2 cards.");
    }

    // Double the bet (if betting is enabled)
    const agent = this.engine._agents[0];
    if (this.hasBetting && agent.resources.currentBet > 0) {
      if (agent.resources.bankroll < agent.resources.currentBet) {
        throw new Error("Insufficient funds to double down.");
      }
      agent.resources.bankroll -= agent.resources.currentBet;
      // Note: We track the doubled bet in the BettingManager in cli.js
    }

    // Take exactly one card
    const card = this.engine.stack.draw();
    if (card) {
      this.engine.space.place(handZone, card, { faceUp: true });
    }

    // Check for bust
    const newHandCards = this.engine.space.zone(handZone).map(p => p.tokenSnapshot);
    if (isBusted(newHandCards)) {
      this.gameState.splitHandStates[index].busted = true;
    }

    // Automatically stand after doubling down
    this.gameState.splitHandStates[index].stood = true;

    // Advance to next hand
    this.advanceToNextSplitHand();

    return this.getSplitGameState();
  }

  /**
   * Advance to next split hand or finish all hands
   * @private
   */
  advanceToNextSplitHand() {
    // Find next hand that hasn't stood and isn't busted
    for (let i = this.gameState.currentSplitHand + 1; i < this.gameState.splitHandsCount; i++) {
      const handState = this.gameState.splitHandStates[i];
      if (!handState.stood && !handState.busted) {
        this.gameState.currentSplitHand = i;
        return;
      }
    }

    // All hands complete - play dealer hand
    this.gameState.dealerTurn = true;

    // Variant-specific dealer card handling
    if (this.variant === 'european') {
      // European: Deal dealer's hole card now (after all players finish)
      const holeCard = this.engine.stack.draw();
      if (holeCard) this.engine.space.place("dealer-hand", holeCard, { faceUp: true });
    } else {
      // American: Reveal dealer's hidden card
      const dealerHand = this.engine.space.zone("dealer-hand");
      if (dealerHand.length > 0 && dealerHand[0]) {
        this.engine.space.flip("dealer-hand", dealerHand[0].id, true);
      }
    }

    // Play out dealer's hand
    this.playDealerHand();

    // Resolve all split hands
    this.resolveSplitHands();
  }

  /**
   * Resolve all split hands and calculate payouts
   * @private
   */
  resolveSplitHands() {
    const dealerCards = this.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);
    const agent = this.engine._agents[0];
    const results = [];

    for (let i = 0; i < this.gameState.splitHandsCount; i++) {
      const handZone = this.gameState.splitHandZones[i];
      const handCards = this.engine.space.zone(handZone).map(p => p.tokenSnapshot);
      const handState = this.gameState.splitHandStates[i];

      let result;
      if (handState.busted) {
        result = "dealer";
      } else {
        result = determineWinner(handCards, dealerCards);
      }

      results.push({
        handIndex: i,
        result,
        cards: handCards,
        value: getBestHandValue(handCards),
        busted: handState.busted
      });

      // Calculate payout (if betting enabled)
      if (this.hasBetting) {
        let payout = 0;
        const betAmount = agent.resources.currentBet;

        if (result === "agent-blackjack") {
          payout = betAmount + (betAmount * 1.5);
        } else if (result === "agent") {
          payout = betAmount * 2;
        } else if (result === "push") {
          payout = betAmount;
        }

        if (payout > 0) {
          agent.resources.bankroll += payout;
        }
      }
    }

    this.gameState.splitResults = results;
    this.gameState.gameOver = true;
  }

  /**
   * Place Perfect Pairs side bet
   * @param {number} amount - Bet amount
   */
  placePerfectPairsBet(amount) {
    const agent = this.engine._agents[0];
    if (this.hasBetting && agent.resources.bankroll < amount) {
      throw new Error(`Insufficient funds for Perfect Pairs bet. Bankroll: ${agent.resources.bankroll}`);
    }

    if (this.hasBetting) {
      agent.resources.bankroll -= amount;
    }

    this.sideBetManager.placePerfectPairsBet(amount);
  }

  /**
   * Place 21+3 side bet
   * @param {number} amount - Bet amount
   */
  place21Plus3Bet(amount) {
    const agent = this.engine._agents[0];
    if (this.hasBetting && agent.resources.bankroll < amount) {
      throw new Error(`Insufficient funds for 21+3 bet. Bankroll: ${agent.resources.bankroll}`);
    }

    if (this.hasBetting) {
      agent.resources.bankroll -= amount;
    }

    this.sideBetManager.place21Plus3Bet(amount);
  }

  /**
   * Resolve all side bets (called after initial deal)
   * @returns {object} - Side bet results
   */
  resolveSideBets() {
    const playerCards = this.engine.space.zone("agent-hand").map(p => p.tokenSnapshot);
    const dealerHand = this.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);

    // Get dealer's up card (second card in American, first in European)
    const dealerUpCard = this.variant === 'european' ? dealerHand[0] : dealerHand[1];

    // Resolve Perfect Pairs
    const perfectPairsResult = this.sideBetManager.resolvePerfectPairs(playerCards);
    if (perfectPairsResult.win && this.hasBetting) {
      const agent = this.engine._agents[0];
      agent.resources.bankroll += perfectPairsResult.payout;
    }

    // Resolve 21+3
    const twentyOnePlus3Result = this.sideBetManager.resolve21Plus3(playerCards, dealerUpCard);
    if (twentyOnePlus3Result.win && this.hasBetting) {
      const agent = this.engine._agents[0];
      agent.resources.bankroll += twentyOnePlus3Result.payout;
    }

    return {
      perfectPairs: perfectPairsResult,
      twentyOnePlus3: twentyOnePlus3Result
    };
  }

  /**
   * Play out dealer's hand automatically
   */
  playDealerHand() {
    let dealerCards = this.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);
    let dealerValue = getBestHandValue(dealerCards);

    // Dealer hits on 16 or less, stands on 17+
    while (dealerValue < 17) {
      const card = this.engine.stack.draw();
      if (!card) break;

      this.engine.space.place("dealer-hand", card, { faceUp: true });
      dealerCards = this.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);
      dealerValue = getBestHandValue(dealerCards);
    }

    this.gameState.dealerTurn = false;
    this.gameState.gameOver = true;

    // Determine final result
    const agentHand = this.engine.space.zone("agent-hand").map(p => p.tokenSnapshot);
    this.gameState.result = determineWinner(agentHand, dealerCards);
  }
  
  /**
   * Get current game state
   */
  getGameState() {
    const agentHand = this.engine.space.zone("agent-hand").map(p => p.tokenSnapshot);
    const dealerHand = this.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);

    const agentValue = getBestHandValue(agentHand);
    const agentBusted = isBusted(agentHand);
    const agentBlackjack = isBlackjack(agentHand);

    // Only show dealer's up card if game is not over
    const showFullDealer = this.gameState.gameOver || this.gameState.dealerTurn;

    // Check available actions
    const canTakeActions = !this.gameState.gameOver &&
                           !this.gameState.agentStood &&
                           !agentBusted &&
                           !agentBlackjack;

    return {
      agentHand: {
        cards: agentHand,
        value: agentValue,
        busted: agentBusted,
        blackjack: agentBlackjack,
        display: formatHand(agentHand)
      },
      dealerHand: {
        cards: dealerHand,
        value: showFullDealer ? getBestHandValue(dealerHand) : null,
        busted: showFullDealer ? isBusted(dealerHand) : null,
        blackjack: showFullDealer ? isBlackjack(dealerHand) : null,
        display: formatHand(dealerHand, !showFullDealer)
      },
      gameOver: this.gameState.gameOver,
      result: this.gameState.result,
      canHit: canTakeActions,
      canStand: canTakeActions,
      canDouble: canTakeActions && canDoubleDown(agentHand),
      canSplit: canTakeActions && canSplit(agentHand),
      canInsurance: this.variant === 'american' &&
                    agentHand.length === 2 &&
                    !this.gameState.insuranceOffered &&
                    canTakeInsurance(dealerHand),
      variant: this.variant
    };
  }

  /**
   * Start a fresh round (collect and reshuffle)
   */
  newRound() {
    this.engine.space.collectAllInto(this.engine.stack);
    if (this.engine.stack.size < 52) {
      this.engine.stack.shuffle();
    }
    return this.deal();
  }
  
  /**
   * Get formatted result message
   */
  getResultMessage() {
    const result = this.gameState.result;
    if (!result) return null;

    switch (result) {
      case "agent-blackjack":
        return "🎉 BLACKJACK! You win 3:2!";
      case "agent":
        return "🎉 You win!";
      case "dealer":
        return "😞 Dealer wins.";
      case "push":
        return "🤝 Push - tie game.";
      default:
        return null;
    }
  }

  /**
   * Get betting statistics (if betting is enabled)
   */
  getStats() {
    if (!this.hasBetting) {
      return null;
    }

    const agent = this.engine._agents[0];
    const netProfit = agent.resources.bankroll - (this.hasBetting ? agent.resources.bankroll : 1000);

    return {
      handsPlayed: 0, // Would need to track this
      currentBankroll: agent.resources.bankroll,
      netProfit,
      winRate: 0
    };
  }

  /**
   * Check if player can afford to continue (betting mode only)
   */
  isBroke() {
    if (!this.hasBetting) return false;
    const agent = this.engine._agents[0];
    return agent.resources.bankroll < this.minBet;
  }
}