#!/usr/bin/env npx ts-node
/**
 * Poker RL Training Example
 *
 * Demonstrates how to use the HyperToken poker environment for RL training.
 * This example shows:
 * - Vectorized environment for batch training
 * - Rich observations (73 features)
 * - Extended actions (10 bet sizes)
 * - Reward shaping for improved learning
 * - Self-play training loop
 *
 * Usage:
 *   npx ts-node examples/poker/train-example.ts
 */

import {
  VectorizedPoker,
  makeVectorizedPoker,
  sampleRandomActions,
} from "./VectorizedPoker.js";
import {
  SelfPlayManager,
  randomPolicy,
  aggressivePolicy,
  callStationPolicy,
  PolicyFunction,
  evaluatePolicies,
} from "./SelfPlay.js";
import { PokerAEC } from "./PokerAEC.js";

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // Vectorized environment settings
  numEnvs: 16,              // Number of parallel environments
  richObservations: true,   // Use 73-feature observations
  extendedActions: true,    // Use 10 bet sizes
  rewardShaping: true,      // Enable reward shaping

  // Training settings
  numEpisodes: 100,         // Training episodes
  stepsPerEpisode: 1000,    // Steps per episode

  // Evaluation settings
  evalMatches: 10,          // Matches for evaluation
};

// ============================================================================
// Simple Policy Network Simulation
// ============================================================================

/**
 * Simulates a simple policy network output
 * In practice, this would be a neural network
 */
function simulateNetworkPolicy(observations: number[][]): number[][] {
  // Simulated network output: action probabilities [numEnvs, numActions]
  const numActions = CONFIG.extendedActions ? 10 : 6;

  return observations.map(obs => {
    // Simple heuristic based on observation features
    // In practice, this would be nn.forward(obs)
    const probs = new Array(numActions).fill(0.1);

    // Slightly favor calling/checking (actions 1, 2)
    probs[1] += 0.2; // check
    probs[2] += 0.2; // call

    // Use some observation features to adjust (simulate learning)
    if (obs.length > 0) {
      const handStrength = obs[0] ?? 0.5;
      if (handStrength > 0.7) {
        // Strong hand - raise more
        for (let i = 3; i < numActions - 1; i++) {
          probs[i] += 0.15;
        }
      } else if (handStrength < 0.3) {
        // Weak hand - fold more
        probs[0] += 0.3;
      }
    }

    // Normalize
    const sum = probs.reduce((a, b) => a + b, 0);
    return probs.map(p => p / sum);
  });
}

/**
 * Select actions from policy outputs with action masks
 */
function selectActions(
  policyOutputs: number[][],
  actionMasks: boolean[][]
): number[] {
  return policyOutputs.map((probs, envIdx) => {
    const mask = actionMasks[envIdx];

    // Mask invalid actions
    const maskedProbs = probs.map((p, i) => mask[i] ? p : 0);
    const sum = maskedProbs.reduce((a, b) => a + b, 0);

    if (sum <= 0) {
      // Fallback to first valid action
      return mask.findIndex(v => v);
    }

    // Sample from distribution
    const normalized = maskedProbs.map(p => p / sum);
    const roll = Math.random();
    let cumsum = 0;
    for (let i = 0; i < normalized.length; i++) {
      cumsum += normalized[i];
      if (roll < cumsum) return i;
    }
    return normalized.length - 1;
  });
}

// ============================================================================
// Training Loop
// ============================================================================

async function trainVectorized(): Promise<void> {
  console.log("\n=== Vectorized Training Demo ===\n");
  console.log(`Environments: ${CONFIG.numEnvs}`);
  console.log(`Rich observations: ${CONFIG.richObservations}`);
  console.log(`Extended actions: ${CONFIG.extendedActions}`);
  console.log(`Reward shaping: ${CONFIG.rewardShaping}`);
  console.log("");

  // Create vectorized environment
  const vecEnv = makeVectorizedPoker(CONFIG.numEnvs, {
    richObservations: CONFIG.richObservations,
    extendedActions: CONFIG.extendedActions,
    rewardShaping: CONFIG.rewardShaping,
    autoReset: true,
  });

  console.log(`Observation size: ${vecEnv.observationSize}`);
  console.log(`Action size: ${vecEnv.actionSize}`);
  console.log(`Actions: ${vecEnv.getActionNames().join(", ")}`);
  console.log("");

  // Training metrics
  let totalSteps = 0;
  let totalReward = 0;
  let episodeRewards: number[] = [];

  console.log("Training...\n");

  for (let episode = 0; episode < CONFIG.numEpisodes; episode++) {
    // Reset all environments
    let observations = await vecEnv.reset();
    let episodeReward = 0;

    for (let step = 0; step < CONFIG.stepsPerEpisode; step++) {
      // Get action masks
      const actionMasks = vecEnv.getActionMasks();

      // Get policy outputs (simulated network)
      const policyOutputs = simulateNetworkPolicy(observations);

      // Select actions
      const actions = selectActions(policyOutputs, actionMasks);

      // Take step
      const result = await vecEnv.step(actions);

      // Accumulate rewards
      const stepReward = result.rewards.reduce((a, b) => a + b, 0);
      episodeReward += stepReward;
      totalReward += stepReward;
      totalSteps += CONFIG.numEnvs;

      // Update observations
      observations = result.observations;

      // In practice, here you would:
      // 1. Store transitions in replay buffer
      // 2. Compute advantages/returns
      // 3. Update policy network
    }

    episodeRewards.push(episodeReward);

    // Log progress every 10 episodes
    if ((episode + 1) % 10 === 0) {
      const avgReward = episodeRewards.slice(-10).reduce((a, b) => a + b, 0) / 10;
      console.log(
        `Episode ${episode + 1}/${CONFIG.numEpisodes} | ` +
        `Steps: ${totalSteps} | ` +
        `Avg Reward (last 10): ${avgReward.toFixed(2)}`
      );
    }
  }

  vecEnv.close();

  console.log("\n=== Training Complete ===");
  console.log(`Total steps: ${totalSteps}`);
  console.log(`Total reward: ${totalReward.toFixed(2)}`);
  console.log(`Avg reward/episode: ${(totalReward / CONFIG.numEpisodes).toFixed(2)}`);
}

// ============================================================================
// Self-Play Evaluation
// ============================================================================

async function evaluateSelfPlay(): Promise<void> {
  console.log("\n=== Self-Play Evaluation Demo ===\n");

  // Create policies for comparison
  const policies: { name: string; fn: PolicyFunction }[] = [
    { name: "Random", fn: randomPolicy },
    { name: "CallStation", fn: callStationPolicy },
    { name: "Aggressive", fn: aggressivePolicy },
  ];

  console.log("Evaluating policy matchups...\n");

  // Round-robin tournament
  for (let i = 0; i < policies.length; i++) {
    for (let j = i + 1; j < policies.length; j++) {
      const p1 = policies[i];
      const p2 = policies[j];

      const stats = await evaluatePolicies(
        p1.fn,
        p2.fn,
        CONFIG.evalMatches,
        {
          envConfig: {
            richObservations: true,
            rewardShaping: true,
          },
          handsPerMatch: 50,
        }
      );

      console.log(`${p1.name} vs ${p2.name}:`);
      console.log(`  ${p1.name} wins: ${stats.player0Wins} (${(stats.player0WinRate * 100).toFixed(1)}%)`);
      console.log(`  ${p2.name} wins: ${stats.player1Wins} (${(stats.player1WinRate * 100).toFixed(1)}%)`);
      console.log(`  Ties: ${stats.ties}`);
      console.log(`  Avg reward ${p1.name}: ${stats.avgRewardPlayer0.toFixed(2)}`);
      console.log(`  Avg reward ${p2.name}: ${stats.avgRewardPlayer1.toFixed(2)}`);
      console.log("");
    }
  }
}

// ============================================================================
// Single Environment Demo
// ============================================================================

async function demoSingleEnv(): Promise<void> {
  console.log("\n=== Single Environment Demo ===\n");

  const env = new PokerAEC({
    richObservations: true,
    extendedActions: true,
    rewardShaping: true,
  });

  console.log("Environment features:");
  console.log(`  Observation features: ${env.getFeatureNames().length}`);
  console.log(`  Actions: ${env.getActionNames().join(", ")}`);
  console.log(`  Reward shaping: ${env.hasRewardShaping()}`);
  console.log("");

  // Play one hand
  await env.reset();
  console.log("Playing one hand...");

  let stepCount = 0;
  while (!env.terminations()[env.possibleAgents[0]]) {
    const agent = env.agentSelection();
    const obs = env.observe(agent);
    const mask = env.actionMask(agent);

    // Random valid action
    const validActions = mask.map((v, i) => v ? i : -1).filter(i => i >= 0);
    const action = validActions[Math.floor(Math.random() * validActions.length)];

    console.log(`  Step ${++stepCount}: ${agent} takes action ${env.getActionNames()[action]}`);

    await env.step(action);
  }

  console.log("\nHand complete!");
  const rewards = env.rewards();
  const infos = env.infos();

  for (const agent of env.possibleAgents) {
    console.log(`  ${agent}: reward=${rewards[agent].toFixed(2)}, winner=${infos[agent].winner}`);

    const shaped = env.getShapedReward(agent);
    if (shaped) {
      console.log(`    Base reward: ${shaped.baseReward.toFixed(2)}`);
      console.log(`    Shaped reward: ${shaped.shapedReward.toFixed(2)}`);
      console.log(`    Components: fold=${shaped.components.foldSavings.toFixed(3)}, ` +
                  `equity=${shaped.components.potEquity.toFixed(3)}, ` +
                  `action=${shaped.components.actionQuality.toFixed(3)}`);
    }
  }

  env.close();
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║     HYPERTOKEN POKER RL TRAINING EXAMPLE         ║");
  console.log("╚══════════════════════════════════════════════════╝");

  try {
    // Demo single environment with reward shaping
    await demoSingleEnv();

    // Demo vectorized training
    await trainVectorized();

    // Demo self-play evaluation
    await evaluateSelfPlay();

    console.log("\n✓ All demos completed successfully!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
