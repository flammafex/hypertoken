/*
 * examples/blackjack/train.js
 * Runs the HyperToken Gym Environment
 */
import { BlackjackEnv } from "./BlackjackEnv.js";

async function runTraining() {
  console.log("🏋️ Initializing Blackjack Gym Environment...");
  const env = new BlackjackEnv("TrainerBot");
  
  let totalReward = 0;
  const episodes = 10;

  for (let episode = 1; episode <= episodes; episode++) {
    console.log(`\n--- Episode ${episode} ---`);
    
    // 1. Reset
    let obs = await env.reset();
    let done = false;
    let steps = 0;

    env.render();

    // 2. Step Loop
    while (!done && steps < 10) { // Safety break
      // Random Policy: 0 (Hit) or 1 (Stand)
      const action = Math.random() < 0.5 ? 0 : 1; 
      console.log(`Action: ${action === 0 ? "Hit" : "Stand"}`);
      
      const result = await env.step(action);
      
      obs = result.observation;
      done = result.terminated;
      totalReward += result.reward;
      steps++;

      if (result.reward !== 0) console.log(`💰 Reward: ${result.reward}`);
      env.render();
    }
  }

  console.log(`\n🏁 Training Complete.`);
  console.log(`Total Reward: ${totalReward}`);
}

runTraining();