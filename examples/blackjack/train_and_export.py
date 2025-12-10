"""
Complete workflow: Train in Python, export to ONNX, ready for browser.

This script demonstrates the full HyperToken train -> deploy pipeline:
1. Train an RL agent using Stable-Baselines3
2. Export the trained policy to ONNX format
3. Verify the exported model works correctly
4. Ready to deploy in browser or Node.js

Usage:
    # Start server first:
    # npx tsx bridge/server.ts --env blackjack --port 9999

    python train_and_export.py

    # Or with custom settings:
    python train_and_export.py --timesteps 50000 --output my_policy.onnx
"""

import argparse
import numpy as np
from pathlib import Path

try:
    from stable_baselines3 import PPO
    from stable_baselines3.common.env_checker import check_env
    from stable_baselines3.common.callbacks import EvalCallback
except ImportError:
    print("ERROR: stable-baselines3 not installed.")
    print("Install with: pip install stable-baselines3")
    exit(1)

from gymnasium import Env, spaces

try:
    from hypertoken import HyperTokenClient, export_sb3_to_onnx, verify_onnx
except ImportError:
    # If running from examples directory, try relative import
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent.parent / "python"))
    from hypertoken import HyperTokenClient, export_sb3_to_onnx, verify_onnx


class BlackjackGymWrapper(Env):
    """
    Gymnasium wrapper for HyperToken Blackjack environment.

    Connects to the HyperToken bridge server and provides a standard
    Gymnasium interface for training with Stable-Baselines3.
    """

    metadata = {"render_modes": ["human"]}

    def __init__(self, url: str = "ws://localhost:9999", render_mode: str = None):
        super().__init__()
        self.url = url
        self.render_mode = render_mode
        self.client = HyperTokenClient(url)
        self.client.connect()

        agents = self.client.possible_agents()
        if not agents:
            raise RuntimeError("No agents available from server")
        self.agent_id = agents[0]

        # 7-dimensional observation space (normalized 0-1):
        # [player_value, dealer_value, is_soft, can_split, cards_remaining, bet_size, is_turn]
        self.observation_space = spaces.Box(
            low=0.0, high=1.0, shape=(7,), dtype=np.float32
        )

        # 2 discrete actions: Hit (0), Stand (1)
        self.action_space = spaces.Discrete(2)

        self._last_obs = None

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.client.reset(seed)
        obs = self.client.observe(self.agent_id)
        self._last_obs = np.array(obs, dtype=np.float32)
        return self._last_obs, {}

    def step(self, action):
        self.client.step(int(action))
        obs = self.client.observe(self.agent_id)
        result = self.client.last()

        self._last_obs = np.array(obs, dtype=np.float32)

        return (
            self._last_obs,
            float(result.get("reward", 0.0)),
            bool(result.get("terminated", False)),
            bool(result.get("truncated", False)),
            result.get("info", {})
        )

    def render(self):
        if self.render_mode == "human" and self._last_obs is not None:
            print(f"Observation: {self._last_obs}")

    def close(self):
        self.client.close()


def train_agent(env: Env, timesteps: int = 25000, verbose: int = 1) -> PPO:
    """
    Train a PPO agent on the blackjack environment.

    Args:
        env: Gymnasium environment
        timesteps: Total training timesteps
        verbose: Verbosity level (0=none, 1=info, 2=debug)

    Returns:
        Trained PPO model
    """
    print(f"\nTraining PPO agent for {timesteps:,} timesteps...")

    model = PPO(
        "MlpPolicy",
        env,
        verbose=verbose,
        learning_rate=3e-4,
        n_steps=1024,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.01,  # Encourage exploration
    )

    model.learn(total_timesteps=timesteps)

    return model


def export_model(model: PPO, model_path: str, onnx_path: str) -> str:
    """
    Export trained model to ONNX format.

    Args:
        model: Trained SB3 model
        model_path: Path to save SB3 model (.zip)
        onnx_path: Path to save ONNX model (.onnx)

    Returns:
        Path to exported ONNX file
    """
    # Save SB3 model
    model.save(model_path)
    print(f"Saved SB3 model to {model_path}.zip")

    # Export to ONNX
    print(f"\nExporting to ONNX format...")

    return export_sb3_to_onnx(
        f"{model_path}.zip",
        onnx_path,
        observation_shape=(7,),
        action_type="discrete",
        metadata={
            "env": "blackjack",
            "game": "HyperToken Blackjack",
            "actions": ["blackjack:hit", "blackjack:stand"],
            "observation_features": [
                "player_value_norm",
                "dealer_value_norm",
                "is_soft_hand",
                "can_split",
                "cards_remaining_norm",
                "bet_size_norm",
                "is_my_turn"
            ],
            "observation_ranges": {
                "player_value_norm": [0, 30],
                "dealer_value_norm": [0, 12],
                "is_soft_hand": [0, 1],
                "can_split": [0, 1],
                "cards_remaining_norm": [0, 312],
                "bet_size_norm": [0, 1000],
                "is_my_turn": [0, 1]
            },
            "description": f"Blackjack policy trained with PPO",
            "usage": {
                "browser": "Load with ONNXAgent from hypertoken/interface",
                "nodejs": "npm install onnxruntime-node && use ONNXAgent"
            }
        }
    )


def test_inference(onnx_path: str) -> None:
    """
    Test ONNX inference with sample observations.
    """
    try:
        import onnxruntime as ort
    except ImportError:
        print("WARNING: onnxruntime not installed, skipping inference test")
        return

    print("\nTesting ONNX inference...")

    session = ort.InferenceSession(onnx_path)

    # Test cases representing different game situations
    test_cases = [
        # [player_val, dealer_val, soft, split, cards, bet, turn]
        ([0.40, 0.20, 0.0, 0.0, 0.9, 0.1, 1.0], "Low hand (12) vs dealer 2 - should likely HIT"),
        ([0.53, 0.30, 0.0, 0.0, 0.9, 0.1, 1.0], "Hand 16 vs dealer 4 - borderline"),
        ([0.67, 0.20, 0.0, 0.0, 0.9, 0.1, 1.0], "Hand 20 vs dealer 2 - should STAND"),
        ([0.70, 0.50, 0.0, 0.0, 0.9, 0.1, 1.0], "Hand 21 vs dealer 6 - should STAND"),
        ([0.40, 0.50, 1.0, 0.0, 0.8, 0.1, 1.0], "Soft 12 vs dealer 6 - soft hand"),
        ([0.57, 0.83, 1.0, 0.0, 0.8, 0.1, 1.0], "Soft 17 vs dealer 10 - tricky soft hand"),
    ]

    for obs, description in test_cases:
        input_tensor = np.array([obs], dtype=np.float32)
        probs = session.run(None, {"observation": input_tensor})[0][0]
        action = "HIT" if probs[0] > probs[1] else "STAND"
        confidence = max(probs) * 100
        print(f"   {description}")
        print(f"      -> {action} ({confidence:.1f}% confidence, probs: [{probs[0]:.3f}, {probs[1]:.3f}])")
        print()


def main():
    parser = argparse.ArgumentParser(
        description="Train a blackjack agent and export to ONNX"
    )
    parser.add_argument(
        "--url",
        default="ws://localhost:9999",
        help="WebSocket URL for HyperToken bridge server"
    )
    parser.add_argument(
        "--timesteps",
        type=int,
        default=25000,
        help="Number of training timesteps"
    )
    parser.add_argument(
        "--output",
        default="blackjack_policy.onnx",
        help="Output path for ONNX model"
    )
    parser.add_argument(
        "--model-name",
        default="blackjack_ppo",
        help="Name for saved SB3 model"
    )
    parser.add_argument(
        "--verbose",
        type=int,
        default=1,
        help="Verbosity level (0=none, 1=info, 2=debug)"
    )
    parser.add_argument(
        "--skip-verify",
        action="store_true",
        help="Skip ONNX verification step"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("HyperToken: Train -> Export -> Browser Workflow")
    print("=" * 60)

    # === Step 1: Connect and train ===
    print(f"\nStep 1: Connecting to {args.url}...")

    try:
        env = BlackjackGymWrapper(args.url)
    except Exception as e:
        print(f"\nERROR: Could not connect to HyperToken server at {args.url}")
        print(f"       {e}")
        print("\nMake sure the bridge server is running:")
        print("  npx tsx bridge/server.ts --env blackjack --port 9999")
        return 1

    print("Connected successfully!")

    # === Step 2: Train ===
    print(f"\nStep 2: Training agent...")
    model = train_agent(env, timesteps=args.timesteps, verbose=args.verbose)

    # === Step 3: Export ===
    print(f"\nStep 3: Exporting to ONNX...")
    onnx_path = export_model(model, args.model_name, args.output)

    # === Step 4: Verify ===
    if not args.skip_verify:
        print(f"\nStep 4: Verifying ONNX model...")
        test_obs = np.array([[0.5, 0.3, 0.0, 0.0, 0.8, 0.1, 1.0]], dtype=np.float32)
        verify_onnx(onnx_path, test_obs)

        # Run inference tests
        test_inference(onnx_path)

    # === Done ===
    print("\n" + "=" * 60)
    print("Export complete!")
    print(f"   ONNX Model:  {onnx_path}")
    print(f"   Metadata:    {Path(onnx_path).with_suffix('.json')}")
    print(f"   SB3 Model:   {args.model_name}.zip")
    print("\nNext steps:")
    print("   1. Copy the .onnx and .json files to your web assets")
    print("   2. Load with ONNXAgent in the browser:")
    print("      const ai = new ONNXAgent();")
    print(f"      await ai.load('{args.output}');")
    print("   3. Use with HyperToken Agent system:")
    print("      const bot = new Agent('Bot', { agent: ai });")
    print("      await bot.think(engine);")
    print("=" * 60)

    env.close()
    return 0


if __name__ == "__main__":
    exit(main())
