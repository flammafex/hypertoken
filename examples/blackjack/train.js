/*
 * examples/blackjack/train.js
 * Runs the HyperToken Gym Environment with full action space
 *
 * Demonstrates:
 * - All 6 actions: Hit, Stand, Double, Split, Surrender, Insurance
 * - Action masking (only choosing valid actions)
 * - Card counting integration
 * - Rich observation space
 */
import { BlackjackEnv, Actions, ObsIndex } from "./BlackjackEnv.js";

// Simple policy that uses basic strategy heuristics
function basicStrategyPolicy(observation, actionMask) {
  const handValue = Math.round(observation[ObsIndex.HAND_VALUE] * 30);
  const dealerValue = Math.round(observation[ObsIndex.DEALER_VALUE] * 12);
  const isSoft = observation[ObsIndex.IS_SOFT] > 0.5;
  const canDouble = actionMask[Actions.DOUBLE];
  const canSplit = actionMask[Actions.SPLIT];
  const canSurrender = actionMask[Actions.SURRENDER];
  const canInsurance = actionMask[Actions.INSURANCE];
  const isBlackjack = observation[ObsIndex.HAND_IS_BLACKJACK] > 0.5;

  // Never take insurance (basic strategy)
  // Skip insurance even if available

  // If we have blackjack, stand
  if (isBlackjack) {
    return Actions.STAND;
  }

  // Surrender on 16 vs dealer 9, 10, A (if allowed)
  if (canSurrender && handValue === 16 && dealerValue >= 9) {
    return Actions.SURRENDER;
  }

  // Surrender on 15 vs dealer 10 (if allowed)
  if (canSurrender && handValue === 15 && dealerValue === 10) {
    return Actions.SURRENDER;
  }

  // Split Aces and 8s
  if (canSplit) {
    // We can check if it's a pair by seeing if split is available
    // For simplicity, always split when available (pairs of same rank)
    if (handValue === 12 || handValue === 16) { // Likely A-A or 8-8
      return Actions.SPLIT;
    }
  }

  // Soft hands (with Ace)
  if (isSoft) {
    if (handValue >= 19) {
      return Actions.STAND;
    }
    if (handValue === 18) {
      if (dealerValue >= 9) {
        return Actions.HIT;
      }
      if (canDouble && dealerValue >= 3 && dealerValue <= 6) {
        return Actions.DOUBLE;
      }
      return Actions.STAND;
    }
    if (handValue === 17) {
      if (canDouble && dealerValue >= 3 && dealerValue <= 6) {
        return Actions.DOUBLE;
      }
      return Actions.HIT;
    }
    // Soft 13-16: Double vs 5-6, otherwise hit
    if (canDouble && dealerValue >= 5 && dealerValue <= 6) {
      return Actions.DOUBLE;
    }
    return Actions.HIT;
  }

  // Hard hands
  if (handValue >= 17) {
    return Actions.STAND;
  }

  if (handValue >= 13 && handValue <= 16) {
    if (dealerValue <= 6) {
      return Actions.STAND;
    }
    return Actions.HIT;
  }

  if (handValue === 12) {
    if (dealerValue >= 4 && dealerValue <= 6) {
      return Actions.STAND;
    }
    return Actions.HIT;
  }

  if (handValue === 11) {
    if (canDouble) {
      return Actions.DOUBLE;
    }
    return Actions.HIT;
  }

  if (handValue === 10) {
    if (canDouble && dealerValue <= 9) {
      return Actions.DOUBLE;
    }
    return Actions.HIT;
  }

  if (handValue === 9) {
    if (canDouble && dealerValue >= 3 && dealerValue <= 6) {
      return Actions.DOUBLE;
    }
    return Actions.HIT;
  }

  // 8 or less: always hit
  return Actions.HIT;
}

// Random policy for comparison
function randomPolicy(observation, actionMask) {
  const validActions = actionMask
    .map((valid, i) => valid ? i : -1)
    .filter(i => i >= 0);

  if (validActions.length === 0) return Actions.STAND;
  return validActions[Math.floor(Math.random() * validActions.length)];
}

const ACTION_NAMES = ['Hit', 'Stand', 'Double', 'Split', 'Surrender', 'Insurance'];

async function runTraining(episodes = 100, policy = 'basic', verbose = false) {
  console.log("🏋️ Initializing Blackjack Gym Environment...\n");
  console.log(`📊 Configuration:`);
  console.log(`   Episodes: ${episodes}`);
  console.log(`   Policy: ${policy}`);
  console.log(`   Actions: ${ACTION_NAMES.join(', ')}`);
  console.log(`   Observation Space: 19 features`);
  console.log();

  const env = new BlackjackEnv({
    agentName: "TrainerBot",
    initialBankroll: 1000,
    numDecks: 6,
    baseBet: 10,
    allowSurrender: true
  });

  let totalReward = 0;
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let surrenders = 0;
  let doubles = 0;
  let splits = 0;
  let blackjacks = 0;

  const policyFn = policy === 'basic' ? basicStrategyPolicy : randomPolicy;

  for (let episode = 1; episode <= episodes; episode++) {
    let obs = await env.reset();
    let done = false;
    let steps = 0;
    let episodeReward = 0;
    let episodeActions = [];

    if (verbose) {
      console.log(`\n--- Episode ${episode} ---`);
      env.render();
    }

    while (!done && steps < 20) {
      const actionMask = env.getActionMask();
      const action = policyFn(obs, actionMask);

      episodeActions.push(ACTION_NAMES[action]);

      if (verbose) {
        console.log(`Action: ${ACTION_NAMES[action]}`);
      }

      const result = await env.step(action);

      obs = result.observation;
      done = result.terminated;
      episodeReward += result.reward;
      steps++;

      // Track action stats
      if (action === Actions.DOUBLE) doubles++;
      if (action === Actions.SPLIT) splits++;
      if (action === Actions.SURRENDER) surrenders++;

      if (verbose && result.reward !== 0) {
        console.log(`💰 Reward: ${result.reward}`);
        env.render();
      }
    }

    totalReward += episodeReward;

    // Track outcomes
    if (episodeReward > 0) {
      wins++;
      if (obs[ObsIndex.HAND_IS_BLACKJACK] > 0.5 || episodeReward >= 15) {
        blackjacks++;
      }
    } else if (episodeReward < 0) {
      if (episodeActions.includes('Surrender')) {
        // Already counted
      } else {
        losses++;
      }
    } else {
      pushes++;
    }

    // Progress update every 10%
    if (episode % Math.max(1, Math.floor(episodes / 10)) === 0) {
      const winRate = ((wins / episode) * 100).toFixed(1);
      console.log(`Episode ${episode}/${episodes} | Win Rate: ${winRate}% | Bankroll: $${(1000 + totalReward).toFixed(0)}`);
    }
  }

  // Final statistics
  console.log(`\n${"=".repeat(50)}`);
  console.log(`🏁 Training Complete - ${episodes} Episodes`);
  console.log(`${"=".repeat(50)}`);
  console.log(`\n📈 Results:`);
  console.log(`   Total Reward:  ${totalReward >= 0 ? '+' : ''}$${totalReward.toFixed(0)}`);
  console.log(`   Final Bankroll: $${(1000 + totalReward).toFixed(0)}`);
  console.log(`   ROI: ${((totalReward / (episodes * 10)) * 100).toFixed(2)}%`);

  console.log(`\n🎯 Hand Outcomes:`);
  console.log(`   Wins:       ${wins} (${((wins / episodes) * 100).toFixed(1)}%)`);
  console.log(`   Losses:     ${losses} (${((losses / episodes) * 100).toFixed(1)}%)`);
  console.log(`   Pushes:     ${pushes} (${((pushes / episodes) * 100).toFixed(1)}%)`);
  console.log(`   Blackjacks: ${blackjacks}`);
  console.log(`   Surrenders: ${surrenders}`);

  console.log(`\n🎰 Special Plays:`);
  console.log(`   Doubles: ${doubles}`);
  console.log(`   Splits:  ${splits}`);

  return { totalReward, wins, losses, pushes };
}

// Parse command line arguments
const args = process.argv.slice(2);
let episodes = 100;
let policy = 'basic';
let verbose = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--episodes' || args[i] === '-e') {
    episodes = parseInt(args[i + 1]) || 100;
    i++;
  } else if (args[i] === '--policy' || args[i] === '-p') {
    policy = args[i + 1] === 'random' ? 'random' : 'basic';
    i++;
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    verbose = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Blackjack RL Training Script

Usage: node train.js [options]

Options:
  -e, --episodes <n>   Number of episodes to run (default: 100)
  -p, --policy <type>  Policy to use: 'basic' or 'random' (default: basic)
  -v, --verbose        Show detailed output for each hand
  -h, --help           Show this help message

Examples:
  node train.js -e 1000 -p basic
  node train.js --episodes 500 --verbose
  node train.js -p random -e 100
`);
    process.exit(0);
  }
}

runTraining(episodes, policy, verbose);
