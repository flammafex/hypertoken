"""
PettingZoo-compatible environment wrappers for HyperToken.

This module provides environment classes that follow the PettingZoo API,
allowing HyperToken environments to be used with standard multi-agent RL
libraries and training frameworks.

Classes:
    HyperTokenAECEnv: PettingZoo AEC (Agent Environment Cycle) compatible
    HyperTokenParallelEnv: PettingZoo Parallel API compatible
    HyperTokenEnv: Alias for HyperTokenAECEnv
"""

from typing import Any, Dict, Iterator, List, Optional, Tuple

import numpy as np

from .client import HyperTokenClient
from .spaces import convert_space


class HyperTokenAECEnv:
    """
    PettingZoo AEC (Agent Environment Cycle) compatible environment.

    This environment follows the PettingZoo AEC API where agents take turns
    acting sequentially. It connects to a HyperToken EnvServer via WebSocket.

    Example:
        env = HyperTokenAECEnv("ws://localhost:9999")
        env.reset()

        for agent in env.agent_iter():
            obs, reward, term, trunc, info = env.last()
            if term or trunc:
                action = None
            else:
                action = env.action_space(agent).sample()
            env.step(action)

        env.close()

    Attributes:
        metadata: Environment metadata dict
        possible_agents: List of all possible agent names
        agents: List of currently active agent names
        num_agents: Number of currently active agents
        agent_selection: Current agent whose turn it is
    """

    metadata = {
        "render_modes": ["human"],
        "name": "hypertoken_aec_v0",
        "is_parallelizable": False,
    }

    def __init__(
        self,
        url: str = "ws://localhost:9999",
        render_mode: Optional[str] = None,
        auto_connect: bool = True,
    ):
        """
        Initialize the environment.

        Args:
            url: WebSocket URL of the HyperToken EnvServer
            render_mode: Rendering mode ("human" or None)
            auto_connect: Whether to connect immediately (default: True)
        """
        self.client = HyperTokenClient(url)
        self.render_mode = render_mode
        self._connected = False

        # Cache for space info (populated on connect)
        self._possible_agents: List[str] = []
        self._observation_spaces: Dict[str, Any] = {}
        self._action_spaces: Dict[str, Any] = {}

        if auto_connect:
            self._connect_and_init()

    def _connect_and_init(self) -> None:
        """Connect to server and cache environment info."""
        if self._connected:
            return

        self.client.connect()
        self._connected = True

        # Get environment info
        self._possible_agents = self.client.possible_agents()

        # Cache spaces for all agents
        for agent in self._possible_agents:
            obs_space_def = self.client.observation_space(agent)
            act_space_def = self.client.action_space(agent)
            self._observation_spaces[agent] = convert_space(obs_space_def)
            self._action_spaces[agent] = convert_space(act_space_def)

    # =========================================================================
    # Agent Properties
    # =========================================================================

    @property
    def possible_agents(self) -> List[str]:
        """List of all possible agents (constant throughout episode)."""
        return list(self._possible_agents)

    @property
    def agents(self) -> List[str]:
        """List of currently active (non-terminated) agents."""
        if not self._connected:
            return []
        return self.client.agents()

    @property
    def num_agents(self) -> int:
        """Number of currently active agents."""
        return len(self.agents)

    @property
    def agent_selection(self) -> str:
        """Name of the agent whose turn it currently is."""
        if not self._connected:
            return ""
        return self.client.agent_selection()

    # =========================================================================
    # Space Methods
    # =========================================================================

    def observation_space(self, agent: str):
        """
        Get observation space for an agent.

        Args:
            agent: Agent name

        Returns:
            gymnasium.spaces.Space object
        """
        return self._observation_spaces[agent]

    def action_space(self, agent: str):
        """
        Get action space for an agent.

        Args:
            agent: Agent name

        Returns:
            gymnasium.spaces.Space object
        """
        return self._action_spaces[agent]

    # =========================================================================
    # Core API
    # =========================================================================

    def reset(
        self,
        seed: Optional[int] = None,
        options: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Reset the environment to initial state.

        Args:
            seed: Optional random seed for reproducibility
            options: Additional options (unused, for API compatibility)
        """
        if not self._connected:
            self._connect_and_init()

        self.client.reset(seed)

        if self.render_mode == "human":
            self.render()

    def step(self, action: Optional[int]) -> None:
        """
        Execute action for the current agent.

        After stepping, agent_selection will return the next agent.
        If action is None (for terminated agents), this is a no-op.

        Args:
            action: Action ID to execute, or None for terminated agents
        """
        if action is not None:
            self.client.step(int(action))

        if self.render_mode == "human":
            self.render()

    def observe(self, agent: str) -> np.ndarray:
        """
        Get observation for a specific agent.

        Args:
            agent: Agent name

        Returns:
            Observation as numpy array
        """
        return self.client.observe(agent)

    def last(
        self, observe: bool = True
    ) -> Tuple[Optional[np.ndarray], float, bool, bool, Dict[str, Any]]:
        """
        Get the last step results for the current agent.

        This is the primary method for getting step results in AEC environments.

        Args:
            observe: Whether to include observation (default: True)

        Returns:
            Tuple of (observation, reward, terminated, truncated, info)
            observation is None if observe=False
        """
        result = self.client.last()
        agent = self.agent_selection

        obs = self.observe(agent) if observe else None
        reward = float(result.get("reward", 0.0))
        terminated = bool(result.get("terminated", False))
        truncated = bool(result.get("truncated", False))
        info = dict(result.get("info", {}))

        return obs, reward, terminated, truncated, info

    # =========================================================================
    # State Queries
    # =========================================================================

    def rewards(self) -> Dict[str, float]:
        """Get rewards for all agents from the last step."""
        return self.client.rewards()

    def terminations(self) -> Dict[str, bool]:
        """Get termination status for all agents."""
        return self.client.terminations()

    def truncations(self) -> Dict[str, bool]:
        """Get truncation status for all agents."""
        return self.client.truncations()

    def infos(self) -> Dict[str, Dict[str, Any]]:
        """Get info dictionaries for all agents."""
        return self.client.infos()

    def action_mask(self, agent: str) -> Optional[np.ndarray]:
        """
        Get action mask indicating valid actions for an agent.

        Args:
            agent: Agent name

        Returns:
            Boolean numpy array where True = valid action,
            or None if action masking is not supported
        """
        return self.client.action_mask(agent)

    # =========================================================================
    # Iteration
    # =========================================================================

    def agent_iter(self, max_iter: int = 2**63) -> Iterator[str]:
        """
        Iterate over agents in AEC order.

        Yields agents until all are terminated/truncated or max_iter is reached.
        This is the standard way to run an episode in AEC environments.

        Args:
            max_iter: Maximum number of iterations (default: very large)

        Yields:
            Agent names in turn order

        Example:
            for agent in env.agent_iter():
                obs, reward, term, trunc, info = env.last()
                if term or trunc:
                    action = None
                else:
                    action = policy(obs)
                env.step(action)
        """
        count = 0
        while self.agents and count < max_iter:
            agent = self.agent_selection
            yield agent
            count += 1

    # =========================================================================
    # Rendering & Cleanup
    # =========================================================================

    def render(self) -> None:
        """Render the environment (server-side console output)."""
        self.client.render()

    def close(self) -> None:
        """Close the environment and release resources."""
        if self._connected:
            self.client.close()
            self._connected = False

    # =========================================================================
    # Context Manager
    # =========================================================================

    def __enter__(self) -> "HyperTokenAECEnv":
        """Context manager entry."""
        if not self._connected:
            self._connect_and_init()
        return self

    def __exit__(self, *args) -> None:
        """Context manager exit."""
        self.close()


# Convenience alias
HyperTokenEnv = HyperTokenAECEnv


class HyperTokenParallelEnv:
    """
    PettingZoo Parallel API compatible environment.

    In the Parallel API, all agents act simultaneously each step.
    Actions are provided as a dict mapping agent names to actions.

    Note: This wraps the AEC environment and simulates parallel execution.
    For true parallel environments, use PettingZooParallel on the server.

    Example:
        env = HyperTokenParallelEnv("ws://localhost:9999")
        observations, infos = env.reset()

        while env.agents:
            actions = {
                agent: policy(obs)
                for agent, obs in observations.items()
            }
            observations, rewards, terms, truncs, infos = env.step(actions)

        env.close()
    """

    metadata = {
        "render_modes": ["human"],
        "name": "hypertoken_parallel_v0",
        "is_parallelizable": True,
    }

    def __init__(
        self,
        url: str = "ws://localhost:9999",
        render_mode: Optional[str] = None,
    ):
        """
        Initialize the parallel environment.

        Args:
            url: WebSocket URL of the HyperToken EnvServer
            render_mode: Rendering mode ("human" or None)
        """
        # Use AEC env internally
        self._aec_env = HyperTokenAECEnv(url, render_mode, auto_connect=True)
        self.render_mode = render_mode

    # =========================================================================
    # Properties (delegated to AEC env)
    # =========================================================================

    @property
    def possible_agents(self) -> List[str]:
        """List of all possible agents."""
        return self._aec_env.possible_agents

    @property
    def agents(self) -> List[str]:
        """List of currently active agents."""
        return self._aec_env.agents

    @property
    def num_agents(self) -> int:
        """Number of currently active agents."""
        return self._aec_env.num_agents

    def observation_space(self, agent: str):
        """Get observation space for an agent."""
        return self._aec_env.observation_space(agent)

    def action_space(self, agent: str):
        """Get action space for an agent."""
        return self._aec_env.action_space(agent)

    # =========================================================================
    # Core API
    # =========================================================================

    def reset(
        self,
        seed: Optional[int] = None,
        options: Optional[Dict[str, Any]] = None,
    ) -> Tuple[Dict[str, np.ndarray], Dict[str, Dict[str, Any]]]:
        """
        Reset the environment.

        Args:
            seed: Optional random seed
            options: Additional options (unused)

        Returns:
            Tuple of (observations, infos) for all agents
        """
        self._aec_env.reset(seed, options)

        observations = {
            agent: self._aec_env.observe(agent) for agent in self.agents
        }
        infos = self._aec_env.infos()

        return observations, infos

    def step(
        self, actions: Dict[str, int]
    ) -> Tuple[
        Dict[str, np.ndarray],
        Dict[str, float],
        Dict[str, bool],
        Dict[str, bool],
        Dict[str, Dict[str, Any]],
    ]:
        """
        Execute actions for all agents simultaneously.

        Args:
            actions: Dict mapping agent names to action IDs

        Returns:
            Tuple of (observations, rewards, terminations, truncations, infos)
            Each is a dict keyed by agent name.
        """
        # Execute actions sequentially (simulating parallel)
        # In a true parallel env, the server would handle this atomically
        for agent in list(self.agents):
            if agent in actions:
                action = actions[agent]
                # We need to step through AEC style but only execute our action
                # when it's that agent's turn
                current = self._aec_env.agent_selection
                if current == agent:
                    self._aec_env.step(action)

        # Collect results for all agents
        current_agents = self.agents
        observations = {
            agent: self._aec_env.observe(agent) for agent in current_agents
        }
        rewards = self._aec_env.rewards()
        terminations = self._aec_env.terminations()
        truncations = self._aec_env.truncations()
        infos = self._aec_env.infos()

        return observations, rewards, terminations, truncations, infos

    # =========================================================================
    # Additional Methods
    # =========================================================================

    def state(self) -> Dict[str, np.ndarray]:
        """Get observations for all agents."""
        return {agent: self._aec_env.observe(agent) for agent in self.agents}

    def action_mask(self, agent: str) -> Optional[np.ndarray]:
        """Get action mask for an agent."""
        return self._aec_env.action_mask(agent)

    def render(self) -> None:
        """Render the environment."""
        self._aec_env.render()

    def close(self) -> None:
        """Close the environment."""
        self._aec_env.close()

    def __enter__(self) -> "HyperTokenParallelEnv":
        """Context manager entry."""
        return self

    def __exit__(self, *args) -> None:
        """Context manager exit."""
        self.close()
