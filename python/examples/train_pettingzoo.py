#!/usr/bin/env python3
"""
Train multiple agents using PettingZoo AEC API.

This example demonstrates the standard PettingZoo AEC loop for
multi-agent environments where agents take turns acting.

Prerequisites:
    pip install hypertoken

Usage:
    # Start the server first (with 3 agents):
    npx tsx bridge/server.ts --env blackjack --agents 3 --port 9999

    # Then run:
    python train_pettingzoo.py
"""

import numpy as np
from hypertoken import HyperTokenAECEnv


def random_policy(observation, action_space, action_mask=None):
    """Random policy that respects action mask."""
    if action_mask is not None:
        # Sample from valid actions only
        valid_actions = np.where(action_mask)[0]
        if len(valid_actions) > 0:
            return np.random.choice(valid_actions)
    return action_space.sample()


def basic_strategy_policy(observation, action_space, action_mask=None):
    """
    Basic blackjack strategy based on hand value.

    Observation format:
        [handValue, dealerUpcard, isSoft, canDouble, canSplit, canInsurance, deckRatio]
        All values normalized to 0-1 range.
    """
    # Denormalize hand value: 0-1 maps to roughly 0-30
    hand_value = int(observation[0] * 30)

    # Denormalize dealer upcard: 0-1 maps to 0-11
    dealer_upcard = int(observation[1] * 11)

    is_soft = observation[2] > 0.5
    can_double = observation[3] > 0.5
    can_split = observation[4] > 0.5

    # Basic strategy
    action = 1  # Default: stand

    if is_soft:
        # Soft hand strategy
        if hand_value < 18:
            action = 0  # Hit
        elif hand_value == 18 and dealer_upcard in [9, 10, 11]:
            action = 0  # Hit
    else:
        # Hard hand strategy
        if hand_value < 12:
            action = 0  # Hit
        elif hand_value < 17:
            if dealer_upcard >= 7:
                action = 0  # Hit
            else:
                action = 1  # Stand
        else:
            action = 1  # Stand

    # Double down opportunity
    if can_double and hand_value in [10, 11]:
        if dealer_upcard < 10:
            action = 2  # Double

    # Validate against mask
    if action_mask is not None:
        if not action_mask[action]:
            # Fall back to hit or stand
            if action_mask[0]:
                action = 0
            elif action_mask[1]:
                action = 1
            else:
                # Pick any valid action
                valid = np.where(action_mask)[0]
                action = valid[0] if len(valid) > 0 else 1

    return action


def run_episode(env, policies):
    """
    Run a single episode with the given policies.

    Args:
        env: HyperTokenAECEnv instance
        policies: Dict mapping agent names to policy functions

    Returns:
        Dict of final rewards per agent
    """
    env.reset()

    for agent in env.agent_iter():
        obs, reward, terminated, truncated, info = env.last()

        if terminated or truncated:
            action = None
        else:
            action_mask = env.action_mask(agent)
            policy = policies.get(agent, random_policy)
            action = policy(obs, env.action_space(agent), action_mask)

        env.step(action)

    return env.rewards()


def main():
    """Run multi-agent training example."""
    print("=" * 60)
    print("HyperToken Blackjack - PettingZoo Multi-Agent Training")
    print("=" * 60)

    print("\nConnecting to HyperToken environment...")

    with HyperTokenAECEnv("ws://localhost:9999") as env:
        print(f"  Connected!")
        print(f"  Agents: {env.possible_agents}")
        print(f"  Observation space: {env.observation_space(env.possible_agents[0])}")
        print(f"  Action space: {env.action_space(env.possible_agents[0])}")

        # Define policies for each agent
        # Agent 0 uses basic strategy, others use random
        policies = {}
        for i, agent in enumerate(env.possible_agents):
            if i == 0:
                policies[agent] = basic_strategy_policy
            else:
                policies[agent] = random_policy

        print(f"\nPolicies:")
        for agent, policy in policies.items():
            print(f"  {agent}: {policy.__name__}")

        # Run episodes
        num_episodes = 100
        agent_rewards = {agent: [] for agent in env.possible_agents}

        print(f"\nRunning {num_episodes} episodes...")
        for episode in range(num_episodes):
            rewards = run_episode(env, policies)

            for agent, reward in rewards.items():
                agent_rewards[agent].append(reward)

            if (episode + 1) % 20 == 0:
                print(f"  Episode {episode + 1}/{num_episodes}")

        # Print results
        print("\n" + "=" * 60)
        print("Results")
        print("=" * 60)

        for agent in env.possible_agents:
            rewards = agent_rewards[agent]
            avg_reward = np.mean(rewards)
            win_rate = np.mean([1 if r > 0 else 0 for r in rewards]) * 100
            policy_name = policies[agent].__name__

            print(f"\n{agent} ({policy_name}):")
            print(f"  Average reward: {avg_reward:.2f}")
            print(f"  Win rate: {win_rate:.1f}%")
            print(f"  Total earnings: {sum(rewards):.2f}")

        # Compare basic strategy vs random
        print("\n" + "=" * 60)
        print("Policy Comparison")
        print("=" * 60)

        basic_agent = env.possible_agents[0]
        random_agents = env.possible_agents[1:]

        basic_avg = np.mean(agent_rewards[basic_agent])
        random_avg = np.mean([np.mean(agent_rewards[a]) for a in random_agents])

        print(f"  Basic strategy avg reward: {basic_avg:.2f}")
        print(f"  Random policy avg reward: {random_avg:.2f}")
        print(f"  Improvement: {((basic_avg - random_avg) / abs(random_avg) * 100) if random_avg != 0 else 0:.1f}%")


if __name__ == "__main__":
    main()
