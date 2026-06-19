"""
WebSocket client for HyperToken environment server.

This module provides a low-level client for communicating with the
HyperToken EnvServer via WebSocket using JSON messages.
"""

import json
import time
from typing import Any, Dict, List, Optional

import numpy as np

try:
    import websocket
except ImportError:
    raise ImportError(
        "websocket-client is required. Install with: pip install websocket-client"
    )


class HyperTokenClient:
    """
    Low-level WebSocket client for HyperToken EnvServer.

    This client handles the raw communication with the server.
    For a higher-level PettingZoo-compatible interface, use HyperTokenAECEnv.

    Example:
        client = HyperTokenClient("ws://localhost:9999")
        client.connect()

        client.reset(seed=42)
        obs = client.observe("player_0")
        client.step(0)  # Hit

        client.close()
    """

    def __init__(self, url: str = "ws://localhost:9999", timeout: float = 30.0):
        """
        Initialize the client.

        Args:
            url: WebSocket URL of the HyperToken EnvServer
            timeout: Connection and receive timeout in seconds
        """
        self.url = url
        self.timeout = timeout
        self.ws: Optional[websocket.WebSocket] = None

    def connect(self) -> None:
        """Establish WebSocket connection to the server."""
        if self.ws is not None:
            self.disconnect()

        self.ws = websocket.create_connection(
            self.url,
            timeout=self.timeout,
        )

    def disconnect(self) -> None:
        """Close WebSocket connection."""
        if self.ws:
            try:
                self.ws.close()
            except Exception:
                pass
            self.ws = None

    def _send(self, cmd: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send a command and receive response.

        Args:
            cmd: Command dictionary to send

        Returns:
            Response dictionary from server

        Raises:
            RuntimeError: If not connected or server returns error
        """
        if not self.ws:
            raise RuntimeError("Not connected. Call connect() first.")

        self.ws.send(json.dumps(cmd))
        response = json.loads(self.ws.recv())

        if "error" in response:
            raise RuntimeError(f"Server error: {response['error']}")

        return response

    # =========================================================================
    # Environment API
    # =========================================================================

    def reset(self, seed: Optional[int] = None) -> None:
        """
        Reset the environment.

        Args:
            seed: Optional random seed for reproducibility
        """
        cmd: Dict[str, Any] = {"cmd": "reset"}
        if seed is not None:
            cmd["seed"] = seed
        self._send(cmd)

    def step(self, action: int) -> None:
        """
        Execute an action for the current agent.

        Args:
            action: Action ID to execute
        """
        self._send({"cmd": "step", "action": action})

    def observe(self, agent: str) -> np.ndarray:
        """
        Get observation for a specific agent.

        Args:
            agent: Agent name

        Returns:
            Observation as numpy array
        """
        response = self._send({"cmd": "observe", "agent": agent})
        return np.array(response["observation"], dtype=np.float32)

    def last(self) -> Dict[str, Any]:
        """
        Get the last step result for the current agent.

        Returns:
            Dict with observation, reward, terminated, truncated, info
        """
        return self._send({"cmd": "last"})

    def agents(self) -> List[str]:
        """
        Get list of currently active agents.

        Returns:
            List of active agent names
        """
        return self._send({"cmd": "agents"})["agents"]

    def possible_agents(self) -> List[str]:
        """
        Get list of all possible agents.

        Returns:
            List of all agent names
        """
        return self._send({"cmd": "possible_agents"})["possible_agents"]

    def agent_selection(self) -> str:
        """
        Get the name of the agent whose turn it is.

        Returns:
            Current agent name
        """
        return self._send({"cmd": "agent_selection"})["agent"]

    def observation_space(self, agent: str) -> Dict[str, Any]:
        """
        Get observation space definition for an agent.

        Args:
            agent: Agent name

        Returns:
            Space definition dict (shape, low, high or n)
        """
        return self._send({"cmd": "observation_space", "agent": agent})["space"]

    def action_space(self, agent: str) -> Dict[str, Any]:
        """
        Get action space definition for an agent.

        Args:
            agent: Agent name

        Returns:
            Space definition dict (n for discrete)
        """
        return self._send({"cmd": "action_space", "agent": agent})["space"]

    def rewards(self) -> Dict[str, float]:
        """
        Get rewards for all agents from the last step.

        Returns:
            Dict mapping agent names to rewards
        """
        return self._send({"cmd": "rewards"})["rewards"]

    def terminations(self) -> Dict[str, bool]:
        """
        Get termination status for all agents.

        Returns:
            Dict mapping agent names to termination status
        """
        return self._send({"cmd": "terminations"})["terminations"]

    def truncations(self) -> Dict[str, bool]:
        """
        Get truncation status for all agents.

        Returns:
            Dict mapping agent names to truncation status
        """
        return self._send({"cmd": "truncations"})["truncations"]

    def infos(self) -> Dict[str, Dict[str, Any]]:
        """
        Get info dictionaries for all agents.

        Returns:
            Dict mapping agent names to info dicts
        """
        return self._send({"cmd": "infos"})["infos"]

    def action_mask(self, agent: str) -> Optional[np.ndarray]:
        """
        Get action mask for an agent.

        Args:
            agent: Agent name

        Returns:
            Boolean array of valid actions, or None if not supported
        """
        response = self._send({"cmd": "action_mask", "agent": agent})
        mask = response.get("mask")
        return np.array(mask, dtype=bool) if mask else None

    def render(self) -> None:
        """Render the environment (server-side console output)."""
        self._send({"cmd": "render"})

    def close(self) -> None:
        """Close the environment and disconnect."""
        try:
            self._send({"cmd": "close"})
        except Exception:
            pass
        self.disconnect()

    def ping(self) -> float:
        """
        Measure round-trip latency to the server.

        Returns:
            Round-trip time in milliseconds
        """
        start = time.time()
        self._send({"cmd": "ping"})
        return (time.time() - start) * 1000

    def env_info(self) -> Dict[str, Any]:
        """
        Get full environment information.

        Returns:
            Dict with env_type, possible_agents, spaces, etc.
        """
        return self._send({"cmd": "env_info"})

    # =========================================================================
    # Context Manager
    # =========================================================================

    def __enter__(self) -> "HyperTokenClient":
        """Context manager entry."""
        self.connect()
        return self

    def __exit__(self, *args) -> None:
        """Context manager exit."""
        self.close()
