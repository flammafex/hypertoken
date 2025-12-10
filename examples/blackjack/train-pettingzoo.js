/*
 * examples/blackjack/train-pettingzoo.js
 * Multi-agent training using PettingZoo AEC interface
 *
 * Demonstrates the AEC (Agent Environment Cycle) training loop where
 * agents take turns acting sequentially.
 */
import { BlackjackAEC, ACTION_HIT, ACTION_STAND, ACTION_DOUBLE } from "./BlackjackAEC.js";

/**
 * Simple policy that uses basic blackjack strategy
 * @param {number[]} observation - [handValue, dealerUpcard, isSoft, canDouble, canSplit, canInsurance, deckRatio]
 * @param {boolean[]} actionMask - Valid actions [Hit, Stand, Double, Split, Insurance]
 * @returns {number} Action to take
 */
function basicStrategyPolicy(observation, actionMask) {
  const handValue = observation[0] * 30; // Denormalize
  const dealerUpcard = observation[1] * 11; // Denormalize
  const isSoft = observation[2] > 0.5;
  const canDouble = actionMask[ACTION_DOUBLE];

  // Simplified basic strategy
  if (isSoft) {
    // Soft hands (Ace counted as 11)
    if (handValue >= 19) return ACTION_STAND;
    if (handValue === 18) {
      if (dealerUpcard >= 9) return ACTION_HIT;
      return ACTION_STAND;
    }
    // Soft 17 or less - hit
    return ACTION_HIT;
  }

  // Hard hands
  if (handValue >= 17) return ACTION_STAND;

  if (handValue >= 12 && handValue <= 16) {
    // Stand against dealer 2-6, hit against 7+
    if (dealerUpcard >= 2 && dealerUpcard <= 6) return ACTION_STAND;
    return ACTION_HIT;
  }

  if (handValue === 11) {
    // Double down on 11 if possible
    if (canDouble) return ACTION_DOUBLE;
    return ACTION_HIT;
  }

  if (handValue === 10) {
    // Double down on 10 against dealer 2-9 if possible
    if (canDouble && dealerUpcard >= 2 && dealerUpcard <= 9) return ACTION_DOUBLE;
    return ACTION_HIT;
  }

  if (handValue === 9) {
    // Double down on 9 against dealer 3-6 if possible
    if (canDouble && dealerUpcard >= 3 && dealerUpcard <= 6) return ACTION_DOUBLE;
    return ACTION_HIT;
  }

  // Hit on 8 or less
  return ACTION_HIT;
}

/**
 * Random policy for comparison
 * @param {number[]} observation
 * @param {boolean[]} actionMask
 * @returns {number}
 */
function randomPolicy(observation, actionMask) {
  // Only consider Hit and Stand for simplicity
  const validActions = [ACTION_HIT, ACTION_STAND].filter((a) => actionMask[a]);
  if (validActions.length === 0) return ACTION_STAND;
  return validActions[Math.floor(Math.random() * validActions.length)];
}

/**
 * Run training episodes with the AEC environment
 */
async function runTraining() {
  console.log("=== PettingZoo AEC Multi-Agent Blackjack Training ===\n");

  const env = new BlackjackAEC({
    numAgents: 2,
    numDecks: 6,
    initialBankroll: 1000,
    defaultBet: 10,
    agentNames: ["BasicStrategy", "RandomAgent"],
  });

  const episodes = 100;
  const results = {
    BasicStrategy: { wins: 0, losses: 0, ties: 0, totalReward: 0 },
    RandomAgent: { wins: 0, losses: 0, ties: 0, totalReward: 0 },
  };

  // Assign policies to agents
  const policies = {
    BasicStrategy: basicStrategyPolicy,
    RandomAgent: randomPolicy,
  };

  for (let episode = 1; episode <= episodes; episode++) {
    // Reset environment
    await env.reset();

    // AEC loop - agents take turns
    let done = false;
    let steps = 0;
    const maxSteps = 50; // Safety limit

    while (!done && steps < maxSteps) {
      const agent = env.agentSelection();
      if (!agent) break;

      // Check if this agent is terminated
      const terminations = env.terminations();
      if (terminations[agent]) {
        break;
      }

      // Get observation and action mask
      const observation = env.observe(agent);
      const actionMask = env.actionMask(agent) || [true, true, false, false, false];

      // Get action from policy
      const policy = policies[agent];
      const action = policy(observation, actionMask);

      // Step environment
      await env.step(action);

      // Check if all agents are done
      const allTerminations = env.terminations();
      done = Object.values(allTerminations).every((t) => t);

      steps++;
    }

    // Collect rewards
    const rewards = env.cumulativeRewards();

    for (const agent of env.possibleAgents) {
      const reward = rewards[agent] || 0;
      results[agent].totalReward += reward;

      if (reward > 0) results[agent].wins++;
      else if (reward < 0) results[agent].losses++;
      else results[agent].ties++;
    }

    // Log progress every 10 episodes
    if (episode % 10 === 0) {
      console.log(`Episode ${episode}/${episodes} complete`);
    }
  }

  // Print final results
  console.log("\n=== Training Results ===\n");

  for (const agent of env.possibleAgents) {
    const r = results[agent];
    const avgReward = r.totalReward / episodes;
    const winRate = ((r.wins / episodes) * 100).toFixed(1);

    console.log(`${agent}:`);
    console.log(`  Wins: ${r.wins}, Losses: ${r.losses}, Ties: ${r.ties}`);
    console.log(`  Win Rate: ${winRate}%`);
    console.log(`  Total Reward: $${r.totalReward.toFixed(2)}`);
    console.log(`  Avg Reward/Episode: $${avgReward.toFixed(2)}\n`);
  }

  return results;
}

/**
 * Run a demo game with rendering
 */
async function runDemo() {
  console.log("=== Demo Game ===\n");

  const env = new BlackjackAEC({
    numAgents: 2,
    numDecks: 6,
    initialBankroll: 1000,
    defaultBet: 10,
    agentNames: ["Player1", "Player2"],
  });

  await env.reset();
  env.render();

  const policies = {
    Player1: basicStrategyPolicy,
    Player2: randomPolicy,
  };

  let done = false;
  let steps = 0;

  while (!done && steps < 20) {
    const agent = env.agentSelection();
    if (!agent) break;

    const terminations = env.terminations();
    if (terminations[agent]) break;

    const observation = env.observe(agent);
    const actionMask = env.actionMask(agent) || [true, true, false, false, false];
    const policy = policies[agent];
    const action = policy(observation, actionMask);

    const actionNames = ["Hit", "Stand", "Double", "Split", "Insurance"];
    console.log(`${agent} chooses: ${actionNames[action]}`);

    await env.step(action);
    env.render();

    done = Object.values(env.terminations()).every((t) => t);
    steps++;
  }

  // Show final results
  const rewards = env.cumulativeRewards();
  console.log("=== Final Rewards ===");
  for (const [agent, reward] of Object.entries(rewards)) {
    console.log(`${agent}: $${reward}`);
  }
}

// Main execution
console.log("Starting PettingZoo AEC Training...\n");

runDemo()
  .then(() => {
    console.log("\n--- Starting Full Training ---\n");
    return runTraining();
  })
  .then(() => {
    console.log("Training complete!");
  })
  .catch((err) => {
    console.error("Error:", err);
  });
