#!/usr/bin/env python3
"""
Train a Stable-Baselines3 agent on HyperToken Blackjack.

This example demonstrates how to wrap HyperToken environments for use
with Stable-Baselines3, a popular reinforcement learning library.

Prerequisites:
    pip install hypertoken[sb3]

Usage:
    # Start the server first:
    npx tsx bridge/server.ts --env blackjack --port 9999

    # Then run training:
    python train_sb3.py
"""

import numpy as np

try:
    from stable_baselines3 import PPO
    from stable_baselines3.common.env_checker import check_env
except ImportError:
    print("Stable-Baselines3 not installed. Install with:")
    print("  pip install stable-baselines3")
    exit(1)

try:
    from gymnasium import Env
    from gymnasium import spaces
except ImportError:
    from gym import Env
    from gym import spaces

from hypertoken import HyperTokenClient


class BlackjackGymWrapper(Env):
    """
    Gymnasium wrapper for single-agent training on HyperToken Blackjack.

    Wraps the multi-agent AEC environment as a single-agent gym environment
    by controlling only the first agent. Other agents can be controlled by
    fixed policies or treated as part of the environment dynamics.

    Actions:
        0: Hit - Take another card
        1: Stand - End turn with current hand
        2: Double - Double bet, take one card, stand
        3: Split - Split pair into two hands
        4: Insurance - Take insurance bet
    """

    def __init__(self, url: str = "ws://localhost:9999"):
        """
        Initialize the wrapper.

        Args:
            url: WebSocket URL of the HyperToken EnvServer
        """
        super().__init__()

        self.client = HyperTokenClient(url)
        self.client.connect()

        # Get agent info from server
        agents = self.client.possible_agents()
        self.agent_id = agents[0]  # Train as first agent

        # Get space definitions
        obs_space = self.client.observation_space(self.agent_id)
        act_space = self.client.action_space(self.agent_id)

        # Convert to gymnasium spaces
        self.observation_space = spaces.Box(
            low=np.array(obs_space.get("low", [0] * 7), dtype=np.float32),
            high=np.array(obs_space.get("high", [1] * 7), dtype=np.float32),
            dtype=np.float32,
        )
        self.action_space = spaces.Discrete(act_space["n"])

        self._episode_reward = 0.0

    def reset(self, seed=None, options=None):
        """Reset the environment."""
        super().reset(seed=seed)
        self.client.reset(seed)
        self._episode_reward = 0.0

        obs = self.client.observe(self.agent_id)
        return np.array(obs, dtype=np.float32), {}

    def step(self, action):
        """Execute one step."""
        # Get action mask to validate action
        mask = self.client.action_mask(self.agent_id)
        if mask is not None and not mask[action]:
            # Invalid action - default to stand (usually valid)
            action = 1

        self.client.step(int(action))

        obs = self.client.observe(self.agent_id)
        result = self.client.last()

        reward = float(result.get("reward", 0.0))
        terminated = bool(result.get("terminated", False))
        truncated = bool(result.get("truncated", False))
        info = dict(result.get("info", {}))

        self._episode_reward += reward

        return (
            np.array(obs, dtype=np.float32),
            reward,
            terminated,
            truncated,
            info,
        )

    def close(self):
        """Close the environment."""
        self.client.close()


def main():
    """Run training example."""
    print("=" * 60)
    print("HyperToken Blackjack - Stable-Baselines3 Training")
    print("=" * 60)

    print("\nCreating environment...")
    env = BlackjackGymWrapper()

    print("Checking environment compatibility...")
    try:
        check_env(env, warn=True)
        print("  Environment check passed!")
    except Exception as e:
        print(f"  Warning: {e}")

    print("\nTraining PPO agent...")
    print("  This will take a few minutes...\n")

    model = PPO(
        "MlpPolicy",
        env,
        verbose=1,
        learning_rate=3e-4,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        tensorboard_log="./logs/blackjack_ppo",
    )

    # Train for a shorter time for demo purposes
    model.learn(total_timesteps=10_000)

    print("\nSaving model...")
    model.save("blackjack_ppo")
    print("  Model saved to: blackjack_ppo.zip")

    print("\nEvaluating trained agent...")
    evaluate_agent(env, model, episodes=50)

    env.close()
    print("\nDone!")


def evaluate_agent(env, model, episodes=100):
    """Evaluate a trained agent."""
    total_reward = 0
    wins = 0

    for ep in range(episodes):
        obs, _ = env.reset()
        done = False
        ep_reward = 0

        while not done:
            action, _ = model.predict(obs, deterministic=True)
            obs, reward, term, trunc, info = env.step(action)
            ep_reward += reward
            done = term or trunc

        total_reward += ep_reward
        if ep_reward > 0:
            wins += 1

    avg_reward = total_reward / episodes
    win_rate = wins / episodes * 100

    print(f"  Episodes: {episodes}")
    print(f"  Average reward: {avg_reward:.2f}")
    print(f"  Win rate: {win_rate:.1f}%")


if __name__ == "__main__":
    main()
