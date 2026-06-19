"""
HyperToken Python Bridge

A Python package for interacting with HyperToken game environments
via WebSocket. Compatible with PettingZoo and gymnasium APIs.

Installation:
    pip install hypertoken

    # With optional dependencies
    pip install hypertoken[gymnasium]
    pip install hypertoken[sb3]
    pip install hypertoken[all]

Quick Start:
    # Start the HyperToken server first:
    # npx tsx bridge/server.ts --env blackjack --port 9999

    from hypertoken import HyperTokenEnv

    env = HyperTokenEnv("ws://localhost:9999")
    env.reset()

    for agent in env.agent_iter():
        obs, reward, term, trunc, info = env.last()
        if term or trunc:
            action = None
        else:
            action = env.action_space(agent).sample()
        env.step(action)

    env.close()

For more examples, see the `examples/` directory.
"""

from .env import HyperTokenEnv, HyperTokenAECEnv, HyperTokenParallelEnv
from .client import HyperTokenClient
from .spaces import convert_space
from .export import (
    export_sb3_to_onnx,
    export_pytorch_to_onnx,
    verify_onnx,
    load_onnx_metadata,
    create_action_map_from_metadata,
)

__version__ = "0.1.0"
__all__ = [
    # Environments
    "HyperTokenEnv",
    "HyperTokenAECEnv",
    "HyperTokenParallelEnv",
    "HyperTokenClient",
    "convert_space",
    # Export utilities
    "export_sb3_to_onnx",
    "export_pytorch_to_onnx",
    "verify_onnx",
    "load_onnx_metadata",
    "create_action_map_from_metadata",
]
