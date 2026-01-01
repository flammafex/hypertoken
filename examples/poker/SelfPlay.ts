/**
 * Self-Play Infrastructure for Poker RL Training
 *
 * Enables training agents through self-play where they learn by playing
 * against themselves or against previous versions.
 *
 * Features:
 * - Agent vs Agent matches
 * - Multiple opponent strategies (random, call-station, aggressive, custom)
 * - Match statistics tracking
 * - Policy hot-swapping for training
 * - Batch game execution for efficiency
 */

import { PokerAEC, PokerAECConfig } from "./PokerAEC.js";

/**
 * Policy function type - takes observation and valid actions, returns action
 */
export type PolicyFunction = (
  observation: number[],
  validActions: boolean[],
  info: PolicyInfo
) => number;

/**
 * Additional info passed to policy functions
 */
export interface PolicyInfo {
  agentName: string;
  phase: string;
  pot: number;
  myChips: number;
  oppChips: number;
}

/**
 * Match result
 */
export interface MatchResult {
  winner: string | null;
  winningHand: string | null;
  player0Reward: number;
  player1Reward: number;
  numHands: number;
  player0Wins: number;
  player1Wins: number;
  ties: number;
}

/**
 * Statistics from multiple matches
 */
export interface SelfPlayStats {
  totalMatches: number;
  totalHands: number;
  player0Wins: number;
  player1Wins: number;
  ties: number;
  player0WinRate: number;
  player1WinRate: number;
  avgHandsPerMatch: number;
  avgRewardPlayer0: number;
  avgRewardPlayer1: number;
}

// ============================================================================
// Built-in Policies
// ============================================================================

/**
 * Random policy - picks uniformly from valid actions
 */
export function randomPolicy(
  _obs: number[],
  validActions: boolean[],
  _info: PolicyInfo
): number {
  const valid = validActions.map((v, i) => v ? i : -1).filter(i => i >= 0);
  if (valid.length === 0) return 0;
  return valid[Math.floor(Math.random() * valid.length)];
}

/**
 * Call-station policy - never folds, always calls/checks
 */
export function callStationPolicy(
  _obs: number[],
  validActions: boolean[],
  _info: PolicyInfo
): number {
  // Prefer check (1), then call (2), then fold (0)
  if (validActions[1]) return 1; // check
  if (validActions[2]) return 2; // call
  return 0; // fold (forced)
}

/**
 * Aggressive policy - raises frequently
 */
export function aggressivePolicy(
  _obs: number[],
  validActions: boolean[],
  _info: PolicyInfo
): number {
  // 70% raise, 20% call/check, 10% fold
  const roll = Math.random();

  if (roll < 0.7) {
    // Try to raise - find highest available raise
    for (let i = validActions.length - 2; i >= 3; i--) {
      if (validActions[i]) return i;
    }
  }

  if (roll < 0.9) {
    // Call or check
    if (validActions[1]) return 1;
    if (validActions[2]) return 2;
  }

  // Fold or first valid action
  if (validActions[0]) return 0;
  return validActions.findIndex(v => v);
}

/**
 * Tight-aggressive (TAG) policy - selective but aggressive when playing
 */
export function tagPolicy(
  obs: number[],
  validActions: boolean[],
  info: PolicyInfo
): number {
  // Use observation features to make decisions
  // Assumes rich observations where obs[0-3] are hole card features
  const holeHighRank = obs[0] ?? 0;  // Normalized high card rank
  const holeSuited = obs[2] ?? 0;    // Is suited
  const pocketPair = obs[3] ?? 0;    // Is pocket pair

  // Calculate hand strength estimate
  const handStrength = holeHighRank * 0.5 + holeSuited * 0.2 + pocketPair * 0.3;

  // Preflop: only play strong hands
  if (info.phase === "preflop") {
    if (handStrength < 0.4) {
      // Weak hand - usually fold, sometimes call
      if (Math.random() < 0.8) {
        if (validActions[1]) return 1; // check if possible
        return 0; // fold
      }
    }
  }

  // With strong hand, raise
  if (handStrength > 0.6 || pocketPair > 0) {
    for (let i = validActions.length - 2; i >= 3; i--) {
      if (validActions[i]) return i;
    }
  }

  // Medium hand - call/check
  if (validActions[1]) return 1;
  if (validActions[2]) return 2;

  // Default fold
  return 0;
}

/**
 * Create a policy that uses a neural network or other model
 */
export function createModelPolicy(
  predict: (observation: number[]) => number[]
): PolicyFunction {
  return (obs: number[], validActions: boolean[], _info: PolicyInfo): number => {
    // Get action probabilities from model
    const probs = predict(obs);

    // Mask invalid actions
    const maskedProbs = probs.map((p, i) => validActions[i] ? p : 0);
    const sum = maskedProbs.reduce((a, b) => a + b, 0);

    if (sum <= 0) {
      // Fallback to random valid action
      return randomPolicy(obs, validActions, _info);
    }

    // Normalize and sample
    const normalized = maskedProbs.map(p => p / sum);
    const roll = Math.random();
    let cumsum = 0;
    for (let i = 0; i < normalized.length; i++) {
      cumsum += normalized[i];
      if (roll < cumsum) return i;
    }

    return normalized.length - 1;
  };
}

// ============================================================================
// SelfPlayManager
// ============================================================================

export interface SelfPlayConfig {
  /** Environment config */
  envConfig?: PokerAECConfig;
  /** Number of hands per match (default: 100) */
  handsPerMatch?: number;
  /** Seed for reproducibility */
  seed?: number;
}

/**
 * Manager for running self-play matches
 */
export class SelfPlayManager {
  private config: Required<SelfPlayConfig>;
  private stats: SelfPlayStats;
  private matchHistory: MatchResult[] = [];

  constructor(config: SelfPlayConfig = {}) {
    this.config = {
      envConfig: config.envConfig ?? {},
      handsPerMatch: config.handsPerMatch ?? 100,
      seed: config.seed ?? Date.now(),
    };

    this.stats = this.createEmptyStats();
  }

  private createEmptyStats(): SelfPlayStats {
    return {
      totalMatches: 0,
      totalHands: 0,
      player0Wins: 0,
      player1Wins: 0,
      ties: 0,
      player0WinRate: 0,
      player1WinRate: 0,
      avgHandsPerMatch: 0,
      avgRewardPlayer0: 0,
      avgRewardPlayer1: 0,
    };
  }

  /**
   * Run a single match between two policies
   */
  async runMatch(
    policy0: PolicyFunction,
    policy1: PolicyFunction
  ): Promise<MatchResult> {
    const env = new PokerAEC({
      ...this.config.envConfig,
      seed: this.config.seed++,
    });

    let totalReward0 = 0;
    let totalReward1 = 0;
    let handsPlayed = 0;
    let wins0 = 0;
    let wins1 = 0;
    let ties = 0;

    const policies = [policy0, policy1];
    const playerNames = env.possibleAgents;

    for (let hand = 0; hand < this.config.handsPerMatch; hand++) {
      await env.reset();
      handsPlayed++;

      // Play until hand is complete
      while (!env.terminations()[playerNames[0]]) {
        const agent = env.agentSelection();
        const playerIdx = playerNames.indexOf(agent);
        const policy = policies[playerIdx];

        const obs = env.observe(agent);
        const validActions = env.actionMask(agent) ?? [];

        const info: PolicyInfo = {
          agentName: agent,
          phase: env.getPhase(),
          pot: env.getPotSize(),
          myChips: env.getChips(agent),
          oppChips: env.getChips(playerNames[1 - playerIdx]),
        };

        const action = policy(obs, validActions, info);
        await env.step(action);
      }

      // Record rewards
      const rewardsMap = env.rewards();
      const reward0 = rewardsMap[playerNames[0]];
      const reward1 = rewardsMap[playerNames[1]];
      totalReward0 += reward0;
      totalReward1 += reward1;

      // Track wins
      if (reward0 > reward1) wins0++;
      else if (reward1 > reward0) wins1++;
      else ties++;

      // Check if someone is busted
      if (env.getChips(playerNames[0]) <= 0 || env.getChips(playerNames[1]) <= 0) {
        break;
      }
    }

    const result: MatchResult = {
      winner: wins0 > wins1 ? playerNames[0] : wins1 > wins0 ? playerNames[1] : null,
      winningHand: null,
      player0Reward: totalReward0,
      player1Reward: totalReward1,
      numHands: handsPlayed,
      player0Wins: wins0,
      player1Wins: wins1,
      ties,
    };

    this.recordMatch(result);
    return result;
  }

  /**
   * Run multiple matches and return aggregate stats
   */
  async runMatches(
    policy0: PolicyFunction,
    policy1: PolicyFunction,
    numMatches: number
  ): Promise<SelfPlayStats> {
    for (let i = 0; i < numMatches; i++) {
      await this.runMatch(policy0, policy1);
    }
    return this.getStats();
  }

  /**
   * Run a single hand (for step-by-step training)
   */
  async runHand(
    policy0: PolicyFunction,
    policy1: PolicyFunction,
    env?: PokerAEC
  ): Promise<{ env: PokerAEC; rewards: [number, number]; done: boolean }> {
    if (!env) {
      env = new PokerAEC({
        ...this.config.envConfig,
        seed: this.config.seed++,
      });
      await env.reset();
    }

    const policies = [policy0, policy1];
    const playerNames = env.possibleAgents;

    // Play until hand is complete
    while (!env.terminations()[playerNames[0]]) {
      const agent = env.agentSelection();
      const playerIdx = playerNames.indexOf(agent);
      const policy = policies[playerIdx];

      const obs = env.observe(agent);
      const validActions = env.actionMask(agent) ?? [];

      const info: PolicyInfo = {
        agentName: agent,
        phase: env.getPhase(),
        pot: env.getPotSize(),
        myChips: env.getChips(agent),
        oppChips: env.getChips(playerNames[1 - playerIdx]),
      };

      const action = policy(obs, validActions, info);
      await env.step(action);
    }

    const rewardsMap = env.rewards();
    const rewards: [number, number] = [
      rewardsMap[playerNames[0]],
      rewardsMap[playerNames[1]],
    ];

    // Check if match should continue
    const done = env.getChips(playerNames[0]) <= 0 || env.getChips(playerNames[1]) <= 0;

    return { env, rewards, done };
  }

  /**
   * Record a match result
   */
  private recordMatch(result: MatchResult): void {
    this.matchHistory.push(result);
    this.updateStats(result);
  }

  /**
   * Update running statistics
   */
  private updateStats(result: MatchResult): void {
    this.stats.totalMatches++;
    this.stats.totalHands += result.numHands;
    this.stats.player0Wins += result.player0Wins;
    this.stats.player1Wins += result.player1Wins;
    this.stats.ties += result.ties;

    const totalGames = this.stats.player0Wins + this.stats.player1Wins + this.stats.ties;
    this.stats.player0WinRate = this.stats.player0Wins / totalGames;
    this.stats.player1WinRate = this.stats.player1Wins / totalGames;
    this.stats.avgHandsPerMatch = this.stats.totalHands / this.stats.totalMatches;

    // Update average rewards
    const totalReward0 = this.matchHistory.reduce((sum, m) => sum + m.player0Reward, 0);
    const totalReward1 = this.matchHistory.reduce((sum, m) => sum + m.player1Reward, 0);
    this.stats.avgRewardPlayer0 = totalReward0 / this.stats.totalMatches;
    this.stats.avgRewardPlayer1 = totalReward1 / this.stats.totalMatches;
  }

  /**
   * Get current statistics
   */
  getStats(): SelfPlayStats {
    return { ...this.stats };
  }

  /**
   * Get match history
   */
  getMatchHistory(): MatchResult[] {
    return [...this.matchHistory];
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = this.createEmptyStats();
    this.matchHistory = [];
  }

  /**
   * Print statistics to console
   */
  printStats(): void {
    const s = this.stats;
    console.log("\n=== Self-Play Statistics ===");
    console.log(`Total Matches: ${s.totalMatches}`);
    console.log(`Total Hands: ${s.totalHands}`);
    console.log(`Avg Hands/Match: ${s.avgHandsPerMatch.toFixed(1)}`);
    console.log("");
    console.log(`Player 0 Wins: ${s.player0Wins} (${(s.player0WinRate * 100).toFixed(1)}%)`);
    console.log(`Player 1 Wins: ${s.player1Wins} (${(s.player1WinRate * 100).toFixed(1)}%)`);
    console.log(`Ties: ${s.ties}`);
    console.log("");
    console.log(`Avg Reward P0: ${s.avgRewardPlayer0.toFixed(2)}`);
    console.log(`Avg Reward P1: ${s.avgRewardPlayer1.toFixed(2)}`);
    console.log("============================\n");
  }
}

/**
 * Convenience function to run a quick evaluation
 */
export async function evaluatePolicies(
  policy0: PolicyFunction,
  policy1: PolicyFunction,
  numMatches: number = 10,
  config?: SelfPlayConfig
): Promise<SelfPlayStats> {
  const manager = new SelfPlayManager(config);
  return manager.runMatches(policy0, policy1, numMatches);
}
