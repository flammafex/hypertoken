/**
 * Coup - Bluffing/Deception Card Game
 *
 * Players bluff about which role cards they hold to take powerful actions.
 * Other players can challenge claims - but if wrong, they lose influence.
 *
 * Roles:
 * - Duke: Tax (take 3 coins), blocks Foreign Aid
 * - Assassin: Assassinate (pay 3, target loses influence)
 * - Captain: Steal (take 2 from another), blocks stealing
 * - Ambassador: Exchange cards, blocks stealing
 * - Contessa: Blocks assassination
 *
 * Last player with influence wins.
 */

// ============================================================================
// Types
// ============================================================================

export const ROLES = ["duke", "assassin", "captain", "ambassador", "contessa"] as const;
export type Role = (typeof ROLES)[number];

export const ACTIONS = [
  "income",      // Take 1 coin (no role)
  "foreign_aid", // Take 2 coins (blockable by Duke)
  "coup",        // Pay 7, force lose influence (unblockable)
  "tax",         // Duke: Take 3 coins
  "assassinate", // Assassin: Pay 3, target loses influence
  "steal",       // Captain: Take 2 from target
  "exchange",    // Ambassador: Draw 2, keep what you want
] as const;
export type ActionType = (typeof ACTIONS)[number];

export interface CoupCard {
  role: Role;
  revealed: boolean;
}

export interface PlayerState {
  coins: number;
  cards: CoupCard[];
  alive: boolean;
}

export type GamePhase =
  | "action"      // Current player chooses action
  | "challenge"   // Others can challenge the action claim
  | "block"       // Target can attempt to block
  | "block_challenge" // Others can challenge the block
  | "lose_influence"  // Player must choose card to lose
  | "exchange"    // Ambassador choosing cards
  | "complete";

export interface PendingAction {
  type: ActionType;
  player: number;
  target?: number;
  claimedRole?: Role;
}

export interface CoupGameState {
  players: PlayerState[];
  deck: Role[];
  currentPlayer: number;
  phase: GamePhase;
  pendingAction: PendingAction | null;
  pendingBlock: { player: number; claimedRole: Role } | null;
  mustLoseInfluence: number | null;
  exchangeCards: Role[] | null;
  winner: number | null;
  lastAction: string | null;
  turnNumber: number;
}

export interface CoupConfig {
  numPlayers?: number;
  seed?: number | null;
}

// ============================================================================
// Constants
// ============================================================================

const CARDS_PER_ROLE = 3;
const STARTING_COINS = 2;
const COUP_COST = 7;
const ASSASSINATE_COST = 3;
const MUST_COUP_THRESHOLD = 10;

// Which roles can perform which actions
const ACTION_ROLES: Partial<Record<ActionType, Role>> = {
  tax: "duke",
  assassinate: "assassin",
  steal: "captain",
  exchange: "ambassador",
};

// Which roles can block which actions
const BLOCK_ROLES: Record<string, Role[]> = {
  foreign_aid: ["duke"],
  assassinate: ["contessa"],
  steal: ["captain", "ambassador"],
};

// ============================================================================
// Seeded Random
// ============================================================================

class SeededRandom {
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Date.now();
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

// ============================================================================
// CoupGame Class
// ============================================================================

export class CoupGame {
  private config: Required<CoupConfig>;
  private rng: SeededRandom;
  private state: CoupGameState;

  constructor(config: CoupConfig = {}) {
    const numPlayers = config.numPlayers ?? 2;
    if (numPlayers < 2 || numPlayers > 6) {
      throw new Error("Coup requires 2-6 players");
    }

    this.config = {
      numPlayers,
      seed: config.seed ?? null,
    };

    this.rng = new SeededRandom(this.config.seed ?? undefined);
    this.state = this.createInitialState();
  }

  reset(seed?: number): void {
    if (seed !== undefined) {
      this.rng = new SeededRandom(seed);
    } else if (this.config.seed !== null) {
      this.rng = new SeededRandom(this.config.seed);
    } else {
      this.rng = new SeededRandom();
    }
    this.state = this.createInitialState();
  }

  private createInitialState(): CoupGameState {
    // Create deck (3 of each role)
    const deck: Role[] = [];
    for (const role of ROLES) {
      for (let i = 0; i < CARDS_PER_ROLE; i++) {
        deck.push(role);
      }
    }
    const shuffledDeck = this.rng.shuffle(deck);

    // Deal 2 cards to each player
    const players: PlayerState[] = [];
    for (let i = 0; i < this.config.numPlayers; i++) {
      players.push({
        coins: STARTING_COINS,
        cards: [
          { role: shuffledDeck.pop()!, revealed: false },
          { role: shuffledDeck.pop()!, revealed: false },
        ],
        alive: true,
      });
    }

    return {
      players,
      deck: shuffledDeck,
      currentPlayer: 0,
      phase: "action",
      pendingAction: null,
      pendingBlock: null,
      mustLoseInfluence: null,
      exchangeCards: null,
      winner: null,
      lastAction: null,
      turnNumber: 0,
    };
  }

  getState(): CoupGameState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Get observation for a player (can only see own cards, others' revealed cards)
   */
  getObservation(playerIndex: number) {
    const player = this.state.players[playerIndex];

    return {
      myCards: player.cards.map(c => ({ role: c.role, revealed: c.revealed })),
      myCoins: player.coins,
      otherPlayers: this.state.players.map((p, i) => ({
        playerIndex: i,
        coins: p.coins,
        cardCount: p.cards.filter(c => !c.revealed).length,
        revealedCards: p.cards.filter(c => c.revealed).map(c => c.role),
        alive: p.alive,
      })).filter((_, i) => i !== playerIndex),
      currentPlayer: this.state.currentPlayer,
      phase: this.state.phase,
      pendingAction: this.state.pendingAction,
      pendingBlock: this.state.pendingBlock,
      mustLoseInfluence: this.state.mustLoseInfluence,
      exchangeOptions: this.state.exchangeCards && this.state.mustLoseInfluence === playerIndex
        ? this.state.exchangeCards
        : null,
      winner: this.state.winner,
      lastAction: this.state.lastAction,
    };
  }

  get numPlayers(): number {
    return this.config.numPlayers;
  }

  /**
   * Get valid actions for a player in current state
   */
  getValidActions(playerIndex: number): string[] {
    const actions: string[] = [];
    const player = this.state.players[playerIndex];

    if (!player.alive || this.state.winner !== null) {
      return [];
    }

    switch (this.state.phase) {
      case "action":
        if (playerIndex !== this.state.currentPlayer) return [];

        // Must coup if 10+ coins
        if (player.coins >= MUST_COUP_THRESHOLD) {
          for (let t = 0; t < this.config.numPlayers; t++) {
            if (t !== playerIndex && this.state.players[t].alive) {
              actions.push(`coup:${t}`);
            }
          }
          return actions;
        }

        // Basic actions
        actions.push("income");
        actions.push("foreign_aid");

        // Coup if can afford
        if (player.coins >= COUP_COST) {
          for (let t = 0; t < this.config.numPlayers; t++) {
            if (t !== playerIndex && this.state.players[t].alive) {
              actions.push(`coup:${t}`);
            }
          }
        }

        // Role actions (can claim even without the role - bluffing!)
        actions.push("tax"); // Claim Duke

        if (player.coins >= ASSASSINATE_COST) {
          for (let t = 0; t < this.config.numPlayers; t++) {
            if (t !== playerIndex && this.state.players[t].alive) {
              actions.push(`assassinate:${t}`);
            }
          }
        }

        for (let t = 0; t < this.config.numPlayers; t++) {
          if (t !== playerIndex && this.state.players[t].alive && this.state.players[t].coins > 0) {
            actions.push(`steal:${t}`);
          }
        }

        actions.push("exchange");
        break;

      case "challenge":
        // Anyone except action player can challenge
        if (playerIndex === this.state.pendingAction?.player) {
          return [];
        }
        actions.push("challenge");
        actions.push("pass");
        break;

      case "block":
        // Only target can block (for targeted actions) or anyone for foreign_aid
        const pending = this.state.pendingAction;
        if (!pending) return [];

        if (pending.type === "foreign_aid") {
          if (playerIndex !== pending.player) {
            actions.push("block:duke");
            actions.push("pass");
          }
        } else if (pending.target === playerIndex) {
          const blockers = BLOCK_ROLES[pending.type];
          if (blockers) {
            for (const role of blockers) {
              actions.push(`block:${role}`);
            }
          }
          actions.push("pass");
        }
        break;

      case "block_challenge":
        // Anyone except blocker can challenge the block
        if (playerIndex === this.state.pendingBlock?.player) {
          return [];
        }
        actions.push("challenge");
        actions.push("pass");
        break;

      case "lose_influence":
        if (playerIndex !== this.state.mustLoseInfluence) return [];
        const hiddenCards = player.cards
          .map((c, i) => ({ card: c, index: i }))
          .filter(x => !x.card.revealed);
        for (const { index } of hiddenCards) {
          actions.push(`lose:${index}`);
        }
        break;

      case "exchange":
        if (playerIndex !== this.state.currentPlayer) return [];
        // Choose which cards to keep (simplified: just pick indices)
        const numToKeep = player.cards.filter(c => !c.revealed).length;
        const available = this.state.exchangeCards?.length ?? 0;
        // Generate all combinations
        actions.push(...this.generateExchangeChoices(available, numToKeep));
        break;
    }

    return actions;
  }

  private generateExchangeChoices(available: number, keep: number): string[] {
    const choices: string[] = [];
    const indices = Array.from({ length: available }, (_, i) => i);

    function combinations(arr: number[], k: number, start: number, current: number[]): void {
      if (current.length === k) {
        choices.push(`keep:${current.join(",")}`);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        current.push(arr[i]);
        combinations(arr, k, i + 1, current);
        current.pop();
      }
    }

    combinations(indices, keep, 0, []);
    return choices;
  }

  /**
   * Execute an action
   */
  action(playerIndex: number, actionStr: string): { success: boolean; message: string } {
    const valid = this.getValidActions(playerIndex);
    if (!valid.includes(actionStr)) {
      return { success: false, message: `Invalid action: ${actionStr}` };
    }

    const [action, param] = actionStr.split(":");
    let message = "";

    switch (this.state.phase) {
      case "action":
        message = this.handleAction(playerIndex, action, param);
        break;

      case "challenge":
        message = this.handleChallenge(playerIndex, action === "challenge");
        break;

      case "block":
        message = this.handleBlock(playerIndex, action, param);
        break;

      case "block_challenge":
        message = this.handleBlockChallenge(playerIndex, action === "challenge");
        break;

      case "lose_influence":
        message = this.handleLoseInfluence(playerIndex, parseInt(param));
        break;

      case "exchange":
        message = this.handleExchange(playerIndex, param);
        break;
    }

    this.state.lastAction = message;
    this.checkWinner();
    return { success: true, message };
  }

  private handleAction(player: number, action: string, param?: string): string {
    const target = param ? parseInt(param) : undefined;

    switch (action) {
      case "income":
        this.state.players[player].coins += 1;
        this.advanceTurn();
        return `Player ${player} takes income (1 coin)`;

      case "foreign_aid":
        this.state.pendingAction = { type: "foreign_aid", player };
        this.state.phase = "block";
        return `Player ${player} attempts foreign aid`;

      case "coup":
        this.state.players[player].coins -= COUP_COST;
        this.state.mustLoseInfluence = target!;
        this.state.phase = "lose_influence";
        return `Player ${player} coups player ${target}`;

      case "tax":
        this.state.pendingAction = { type: "tax", player, claimedRole: "duke" };
        this.state.phase = "challenge";
        return `Player ${player} claims Duke, takes tax`;

      case "assassinate":
        this.state.players[player].coins -= ASSASSINATE_COST;
        this.state.pendingAction = { type: "assassinate", player, target, claimedRole: "assassin" };
        this.state.phase = "challenge";
        return `Player ${player} claims Assassin, targets ${target}`;

      case "steal":
        this.state.pendingAction = { type: "steal", player, target, claimedRole: "captain" };
        this.state.phase = "challenge";
        return `Player ${player} claims Captain, steals from ${target}`;

      case "exchange":
        this.state.pendingAction = { type: "exchange", player, claimedRole: "ambassador" };
        this.state.phase = "challenge";
        return `Player ${player} claims Ambassador, exchanges`;

      default:
        return "Unknown action";
    }
  }

  private handleChallenge(challenger: number, didChallenge: boolean): string {
    if (!didChallenge) {
      // All players passed - check if action needs blocking
      return this.proceedAfterChallenge();
    }

    const pending = this.state.pendingAction!;
    const claimedRole = pending.claimedRole!;
    const claimant = pending.player;
    const claimantCards = this.state.players[claimant].cards;

    // Check if claimant actually has the role
    const hasRole = claimantCards.some(c => !c.revealed && c.role === claimedRole);

    if (hasRole) {
      // Challenge fails - challenger loses influence
      this.state.mustLoseInfluence = challenger;
      this.state.phase = "lose_influence";
      // Claimant shuffles the revealed card back and draws new
      const cardIndex = claimantCards.findIndex(c => !c.revealed && c.role === claimedRole);
      const card = claimantCards[cardIndex];
      this.state.deck.push(card.role);
      this.state.deck = this.rng.shuffle(this.state.deck);
      claimantCards[cardIndex] = { role: this.state.deck.pop()!, revealed: false };
      return `Player ${challenger} challenges - FAILS! Player ${claimant} had ${claimedRole}`;
    } else {
      // Challenge succeeds - claimant loses influence, action cancelled
      this.state.mustLoseInfluence = claimant;
      this.state.phase = "lose_influence";
      this.state.pendingAction = null;
      // Refund assassination cost if applicable
      if (pending.type === "assassinate") {
        this.state.players[claimant].coins += ASSASSINATE_COST;
      }
      return `Player ${challenger} challenges - SUCCESS! Player ${claimant} didn't have ${claimedRole}`;
    }
  }

  private proceedAfterChallenge(): string {
    const pending = this.state.pendingAction!;

    // Check if action can be blocked
    if (BLOCK_ROLES[pending.type]) {
      this.state.phase = "block";
      return "No challenge - proceeding to block phase";
    }

    // Execute action
    return this.executeAction();
  }

  private handleBlock(blocker: number, action: string, role?: string): string {
    if (action === "pass") {
      // Check if all potential blockers passed
      return this.executeAction();
    }

    this.state.pendingBlock = { player: blocker, claimedRole: role as Role };
    this.state.phase = "block_challenge";
    return `Player ${blocker} blocks with ${role}`;
  }

  private handleBlockChallenge(challenger: number, didChallenge: boolean): string {
    if (!didChallenge) {
      // Block succeeds
      this.state.pendingAction = null;
      this.state.pendingBlock = null;
      this.advanceTurn();
      return "Block successful - action cancelled";
    }

    const block = this.state.pendingBlock!;
    const blockerCards = this.state.players[block.player].cards;
    const hasRole = blockerCards.some(c => !c.revealed && c.role === block.claimedRole);

    if (hasRole) {
      // Block challenge fails
      this.state.mustLoseInfluence = challenger;
      this.state.phase = "lose_influence";
      this.state.pendingAction = null;
      // Shuffle and draw for blocker
      const cardIndex = blockerCards.findIndex(c => !c.revealed && c.role === block.claimedRole);
      this.state.deck.push(blockerCards[cardIndex].role);
      this.state.deck = this.rng.shuffle(this.state.deck);
      blockerCards[cardIndex] = { role: this.state.deck.pop()!, revealed: false };
      return `Block challenge FAILS - blocker had ${block.claimedRole}`;
    } else {
      // Block challenge succeeds - blocker loses influence, action proceeds
      this.state.mustLoseInfluence = block.player;
      this.state.phase = "lose_influence";
      return `Block challenge SUCCESS - blocker didn't have ${block.claimedRole}`;
    }
  }

  private executeAction(): string {
    const pending = this.state.pendingAction!;
    const player = pending.player;

    switch (pending.type) {
      case "foreign_aid":
        this.state.players[player].coins += 2;
        this.advanceTurn();
        return "Foreign aid successful (+2 coins)";

      case "tax":
        this.state.players[player].coins += 3;
        this.advanceTurn();
        return "Tax successful (+3 coins)";

      case "assassinate":
        this.state.mustLoseInfluence = pending.target!;
        this.state.phase = "lose_influence";
        return `Assassination proceeds - player ${pending.target} must lose influence`;

      case "steal":
        const stolen = Math.min(2, this.state.players[pending.target!].coins);
        this.state.players[pending.target!].coins -= stolen;
        this.state.players[player].coins += stolen;
        this.advanceTurn();
        return `Steal successful (${stolen} coins)`;

      case "exchange":
        // Draw 2 cards
        const drawn = [this.state.deck.pop()!, this.state.deck.pop()!];
        const playerCards = this.state.players[player].cards.filter(c => !c.revealed).map(c => c.role);
        this.state.exchangeCards = [...playerCards, ...drawn];
        this.state.phase = "exchange";
        return "Exchange - choose cards to keep";

      default:
        this.advanceTurn();
        return "Action completed";
    }
  }

  private handleLoseInfluence(player: number, cardIndex: number): string {
    const card = this.state.players[player].cards[cardIndex];
    card.revealed = true;

    // Check if player is eliminated
    const hiddenCards = this.state.players[player].cards.filter(c => !c.revealed);
    if (hiddenCards.length === 0) {
      this.state.players[player].alive = false;
    }

    this.state.mustLoseInfluence = null;

    // Check if we need to continue with pending action (block challenge success)
    if (this.state.pendingBlock && this.state.pendingAction) {
      // Block was challenged and failed - execute original action
      const result = this.executeAction();
      this.state.pendingBlock = null;
      return `Player ${player} loses ${card.role}. ${result}`;
    }

    this.state.pendingAction = null;
    this.state.pendingBlock = null;
    this.advanceTurn();
    return `Player ${player} loses ${card.role}`;
  }

  private handleExchange(player: number, keepIndices: string): string {
    const indices = keepIndices.split(",").map(Number);
    const allCards = this.state.exchangeCards!;

    // Keep selected cards
    const keptCards = indices.map(i => allCards[i]);
    const returnedCards = allCards.filter((_, i) => !indices.includes(i));

    // Update player's hidden cards
    let keptIdx = 0;
    for (let i = 0; i < this.state.players[player].cards.length; i++) {
      if (!this.state.players[player].cards[i].revealed) {
        this.state.players[player].cards[i] = { role: keptCards[keptIdx++], revealed: false };
      }
    }

    // Return others to deck
    this.state.deck.push(...returnedCards);
    this.state.deck = this.rng.shuffle(this.state.deck);

    this.state.exchangeCards = null;
    this.state.pendingAction = null;
    this.advanceTurn();
    return "Exchange complete";
  }

  private advanceTurn(): void {
    this.state.phase = "action";
    this.state.turnNumber++;

    // Find next alive player
    let next = (this.state.currentPlayer + 1) % this.config.numPlayers;
    while (!this.state.players[next].alive && next !== this.state.currentPlayer) {
      next = (next + 1) % this.config.numPlayers;
    }
    this.state.currentPlayer = next;
  }

  private checkWinner(): void {
    const alivePlayers = this.state.players
      .map((p, i) => ({ alive: p.alive, index: i }))
      .filter(p => p.alive);

    if (alivePlayers.length === 1) {
      this.state.winner = alivePlayers[0].index;
      this.state.phase = "complete";
    }
  }

  render(): void {
    console.log("\n" + "=".repeat(50));
    console.log("COUP");
    console.log("=".repeat(50));
    console.log(`Turn: ${this.state.turnNumber} | Phase: ${this.state.phase}`);
    console.log(`Current player: ${this.state.currentPlayer}`);

    for (let i = 0; i < this.config.numPlayers; i++) {
      const p = this.state.players[i];
      const marker = i === this.state.currentPlayer ? "→ " : "  ";
      const status = p.alive ? "" : " [ELIMINATED]";
      const cards = p.cards.map(c => c.revealed ? `[${c.role}]` : "?").join(" ");
      console.log(`${marker}Player ${i}: ${p.coins} coins | ${cards}${status}`);
    }

    if (this.state.lastAction) {
      console.log(`\nLast: ${this.state.lastAction}`);
    }
    if (this.state.winner !== null) {
      console.log(`\n*** PLAYER ${this.state.winner} WINS ***`);
    }
  }
}

// ============================================================================
// Action Encoding
// ============================================================================

export function getActionSpaceSize(numPlayers: number): number {
  // Simplified action space:
  // income, foreign_aid, tax, exchange = 4
  // coup, assassinate, steal per target = 3 * (numPlayers - 1)
  // challenge, pass = 2
  // block:duke, block:contessa, block:captain, block:ambassador = 4
  // lose:0, lose:1 = 2
  // keep combinations (up to 6 for exchange) ≈ 15
  return 4 + 3 * (numPlayers - 1) + 2 + 4 + 2 + 15;
}
