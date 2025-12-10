"""
Convert HyperToken space definitions to gymnasium/gym spaces.

HyperToken uses simple JSON-serializable space definitions:
    Box:      { shape: [7], low: [...], high: [...] }
    Discrete: { n: 5 }

This module converts them to proper gymnasium Space objects.
"""

from typing import Any, Dict

import numpy as np


def _get_spaces_module():
    """
    Lazily import gymnasium or gym spaces module.

    Returns gymnasium.spaces if available, falls back to gym.spaces.
    """
    try:
        import gymnasium

        return gymnasium.spaces
    except ImportError:
        pass

    try:
        import gym

        return gym.spaces
    except ImportError:
        pass

    raise ImportError(
        "Neither gymnasium nor gym is installed. "
        "Install with: pip install gymnasium"
    )


def convert_space(space_def: Dict[str, Any]):
    """
    Convert a HyperToken space definition to a gymnasium Space.

    Args:
        space_def: Dictionary with space definition from server
            - Box space: { shape: [7], low: [...], high: [...] }
            - Discrete space: { n: 5 }

    Returns:
        gymnasium.spaces.Space (or gym.spaces.Space)

    Raises:
        ValueError: If space format is unknown

    Example:
        >>> space_def = {"n": 5}
        >>> space = convert_space(space_def)
        >>> print(type(space))
        <class 'gymnasium.spaces.Discrete'>

        >>> space_def = {"shape": [7], "low": [0]*7, "high": [1]*7}
        >>> space = convert_space(space_def)
        >>> print(type(space))
        <class 'gymnasium.spaces.Box'>
    """
    spaces = _get_spaces_module()

    # Discrete space
    if "n" in space_def:
        return spaces.Discrete(space_def["n"])

    # Box space
    if "shape" in space_def:
        shape = tuple(space_def["shape"])
        size = int(np.prod(shape)) if shape else 1

        # Default bounds
        low = space_def.get("low")
        high = space_def.get("high")

        if low is None:
            low = [-np.inf] * size
        if high is None:
            high = [np.inf] * size

        low = np.array(low, dtype=np.float32).reshape(shape)
        high = np.array(high, dtype=np.float32).reshape(shape)

        return spaces.Box(low=low, high=high, shape=shape, dtype=np.float32)

    raise ValueError(f"Unknown space format: {space_def}")


def space_to_dict(space) -> Dict[str, Any]:
    """
    Convert a gymnasium Space back to a HyperToken dictionary.

    Args:
        space: gymnasium.spaces.Space object

    Returns:
        Dictionary representation

    Example:
        >>> import gymnasium
        >>> space = gymnasium.spaces.Discrete(5)
        >>> space_to_dict(space)
        {'n': 5}
    """
    spaces = _get_spaces_module()

    if isinstance(space, spaces.Discrete):
        return {"n": int(space.n)}

    if isinstance(space, spaces.Box):
        return {
            "shape": list(space.shape),
            "low": space.low.flatten().tolist(),
            "high": space.high.flatten().tolist(),
        }

    raise ValueError(f"Unknown space type: {type(space)}")
