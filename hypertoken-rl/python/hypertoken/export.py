"""
ONNX export utilities for trained policies.

Supports:
- Stable-Baselines3 (PPO, DQN, A2C, SAC)
- Raw PyTorch models
- TensorFlow/Keras models (optional)

Train in Python, deploy anywhere HyperToken runs.
"""

import numpy as np
from pathlib import Path
from typing import Optional, Union, Tuple, Any
import json


def export_sb3_to_onnx(
    model_path: str,
    output_path: str,
    observation_shape: Tuple[int, ...],
    action_type: str = "discrete",  # "discrete" or "continuous"
    opset_version: int = 11,
    metadata: Optional[dict] = None
) -> str:
    """
    Export a Stable-Baselines3 model to ONNX format.

    Args:
        model_path: Path to saved SB3 model (.zip)
        output_path: Output path for .onnx file
        observation_shape: Shape of observation space (e.g., (7,) for blackjack)
        action_type: "discrete" for Discrete, "continuous" for Box
        opset_version: ONNX opset version
        metadata: Optional metadata to embed (env name, action meanings, etc.)

    Returns:
        Path to exported .onnx file

    Example:
        export_sb3_to_onnx(
            "blackjack_ppo.zip",
            "blackjack_policy.onnx",
            observation_shape=(7,),
            metadata={
                "env": "blackjack",
                "actions": ["blackjack:hit", "blackjack:stand"],
                "observation_features": [
                    "player_value", "dealer_value", "soft_hand",
                    "can_split", "cards_remaining", "bet_size", "is_turn"
                ]
            }
        )
    """
    try:
        from stable_baselines3 import PPO, DQN, A2C, SAC
        import torch
        import torch.onnx
    except ImportError as e:
        raise ImportError(
            f"Missing dependency: {e}. "
            "Install with: pip install stable-baselines3 torch"
        )

    # Load model - try different algorithms
    model = None
    algo_used = None
    for algo_cls in [PPO, DQN, A2C, SAC]:
        try:
            model = algo_cls.load(model_path)
            algo_used = algo_cls.__name__
            break
        except Exception:
            continue

    if model is None:
        raise ValueError(f"Could not load model from {model_path}")

    # Extract policy network
    policy = model.policy

    # Create dummy input
    dummy_input = torch.randn(1, *observation_shape)

    # Output path setup
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Wrap policy to output just the action selection
    class PolicyWrapper(torch.nn.Module):
        def __init__(self, policy: Any, action_type: str):
            super().__init__()
            self.policy = policy
            self.action_type = action_type

        def forward(self, obs: torch.Tensor) -> torch.Tensor:
            # Get features
            features = self.policy.extract_features(obs)

            if hasattr(self.policy, 'mlp_extractor'):
                latent_pi, _ = self.policy.mlp_extractor(features)
            else:
                latent_pi = features

            # Get action logits/distribution
            if self.action_type == "discrete":
                action_logits = self.policy.action_net(latent_pi)
                # Return probabilities
                return torch.softmax(action_logits, dim=-1)
            else:
                # Continuous: return mean action
                mean_actions = self.policy.action_net(latent_pi)
                return mean_actions

    wrapped = PolicyWrapper(policy, action_type)
    wrapped.eval()

    # Determine output name based on action type
    output_name = 'action_probs' if action_type == "discrete" else 'action'

    torch.onnx.export(
        wrapped,
        dummy_input,
        str(output_path),
        export_params=True,
        opset_version=opset_version,
        do_constant_folding=True,
        input_names=['observation'],
        output_names=[output_name],
        dynamic_axes={
            'observation': {0: 'batch_size'},
            output_name: {0: 'batch_size'}
        }
    )

    # Save metadata alongside
    if metadata is None:
        metadata = {}

    # Add export info to metadata
    metadata['_export_info'] = {
        'algorithm': algo_used,
        'observation_shape': list(observation_shape),
        'action_type': action_type,
        'opset_version': opset_version,
    }

    metadata_path = output_path.with_suffix('.json')
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f"Exported to {output_path}")
    print(f"   Metadata saved to {metadata_path}")

    return str(output_path)


def export_pytorch_to_onnx(
    model: "torch.nn.Module",
    output_path: str,
    observation_shape: Tuple[int, ...],
    opset_version: int = 11,
    metadata: Optional[dict] = None
) -> str:
    """
    Export a raw PyTorch model to ONNX.

    The model should take observation tensor and output action probabilities
    (for discrete) or action values (for continuous).

    Args:
        model: PyTorch nn.Module that takes observations and outputs action probs
        output_path: Output path for .onnx file
        observation_shape: Shape of observation space
        opset_version: ONNX opset version
        metadata: Optional metadata to embed

    Returns:
        Path to exported .onnx file

    Example:
        class MyPolicy(nn.Module):
            def __init__(self):
                super().__init__()
                self.net = nn.Sequential(
                    nn.Linear(7, 64),
                    nn.ReLU(),
                    nn.Linear(64, 2),
                    nn.Softmax(dim=-1)
                )

            def forward(self, obs):
                return self.net(obs)

        model = MyPolicy()
        # ... train ...
        export_pytorch_to_onnx(model, "policy.onnx", (7,))
    """
    import torch

    model.eval()
    dummy_input = torch.randn(1, *observation_shape)

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    torch.onnx.export(
        model,
        dummy_input,
        str(output_path),
        export_params=True,
        opset_version=opset_version,
        do_constant_folding=True,
        input_names=['observation'],
        output_names=['action_probs'],
        dynamic_axes={
            'observation': {0: 'batch_size'},
            'action_probs': {0: 'batch_size'}
        }
    )

    if metadata:
        metadata_path = output_path.with_suffix('.json')
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        print(f"   Metadata saved to {metadata_path}")

    print(f"Exported to {output_path}")
    return str(output_path)


def verify_onnx(onnx_path: str, test_input: Optional[np.ndarray] = None) -> bool:
    """
    Verify an ONNX model loads and runs correctly.

    Args:
        onnx_path: Path to .onnx file
        test_input: Optional test observation to run through model

    Returns:
        True if model is valid

    Example:
        # Basic verification
        verify_onnx("policy.onnx")

        # With test inference
        test_obs = np.array([[0.5, 0.3, 0.0, 0.0, 0.8, 0.1, 1.0]], dtype=np.float32)
        verify_onnx("policy.onnx", test_obs)
    """
    try:
        import onnx
        import onnxruntime as ort
    except ImportError:
        raise ImportError(
            "Missing dependencies. Install with: pip install onnx onnxruntime"
        )

    # Check model is valid
    model = onnx.load(onnx_path)
    onnx.checker.check_model(model)
    print(f"Model structure valid: {onnx_path}")

    # Try running inference
    session = ort.InferenceSession(onnx_path)

    input_info = session.get_inputs()[0]
    input_name = input_info.name
    input_shape = input_info.shape

    output_info = session.get_outputs()[0]
    output_name = output_info.name
    output_shape = output_info.shape

    print(f"   Input:  {input_name} shape={input_shape}")
    print(f"   Output: {output_name} shape={output_shape}")

    if test_input is not None:
        result = session.run([output_name], {input_name: test_input.astype(np.float32)})
        print(f"   Test inference output: {result[0]}")

    return True


def load_onnx_metadata(onnx_path: str) -> Optional[dict]:
    """
    Load metadata JSON file for an ONNX model.

    Args:
        onnx_path: Path to .onnx file (metadata is loaded from .json with same name)

    Returns:
        Metadata dict or None if not found
    """
    metadata_path = Path(onnx_path).with_suffix('.json')
    if metadata_path.exists():
        with open(metadata_path, 'r') as f:
            return json.load(f)
    return None


def create_action_map_from_metadata(metadata: dict) -> dict:
    """
    Create an action index -> action type map from metadata.

    Args:
        metadata: Metadata dict with 'actions' list

    Returns:
        Dict mapping action indices to action type strings

    Example:
        metadata = {"actions": ["blackjack:hit", "blackjack:stand"]}
        action_map = create_action_map_from_metadata(metadata)
        # {0: "blackjack:hit", 1: "blackjack:stand"}
    """
    if 'actions' not in metadata:
        return {}
    return {i: action for i, action in enumerate(metadata['actions'])}
