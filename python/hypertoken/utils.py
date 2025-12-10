"""
Utility functions for HyperToken Python bridge.
"""

import subprocess
import sys
import time
from typing import Optional


def wait_for_server(
    url: str = "ws://localhost:9999",
    timeout: float = 30.0,
    poll_interval: float = 0.5,
) -> bool:
    """
    Wait for the HyperToken server to become available.

    Useful for scripts that start the server programmatically and need
    to wait for it to be ready before connecting.

    Args:
        url: WebSocket URL to check
        timeout: Maximum time to wait in seconds
        poll_interval: Time between connection attempts

    Returns:
        True if server became available, False if timeout

    Example:
        # Start server in background
        import subprocess
        proc = subprocess.Popen(["npx", "tsx", "bridge/server.ts"])

        # Wait for it
        if wait_for_server():
            env = HyperTokenEnv()
        else:
            print("Server failed to start")
    """
    from .client import HyperTokenClient

    start = time.time()
    client = HyperTokenClient(url, timeout=poll_interval)

    while time.time() - start < timeout:
        try:
            client.connect()
            client.disconnect()
            return True
        except Exception:
            time.sleep(poll_interval)

    return False


def start_server(
    env_type: str = "blackjack",
    port: int = 9999,
    verbose: bool = False,
    **env_options,
) -> subprocess.Popen:
    """
    Start a HyperToken server as a subprocess.

    This is a convenience function for programmatically starting servers.
    The server process should be terminated when done.

    Args:
        env_type: Environment type to host
        port: Port to listen on
        verbose: Enable verbose logging
        **env_options: Additional environment options (agents, decks, etc.)

    Returns:
        subprocess.Popen object for the server process

    Example:
        proc = start_server(env_type="blackjack", port=9999, agents=3)

        # Use the server...
        env = HyperTokenEnv(f"ws://localhost:{port}")

        # Cleanup
        proc.terminate()
        proc.wait()
    """
    cmd = [
        "npx",
        "tsx",
        "bridge/server.ts",
        "--env",
        env_type,
        "--port",
        str(port),
    ]

    if verbose:
        cmd.append("--verbose")

    for key, value in env_options.items():
        # Convert Python kwargs to CLI args
        # e.g., num_agents -> --agents
        if key == "num_agents":
            cmd.extend(["--agents", str(value)])
        elif key == "num_decks":
            cmd.extend(["--decks", str(value)])
        elif key == "seed":
            cmd.extend(["--seed", str(value)])

    return subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE if not verbose else None,
        stderr=subprocess.PIPE if not verbose else None,
    )


class ServerManager:
    """
    Context manager for starting and stopping HyperToken servers.

    Automatically starts a server on enter and stops it on exit.

    Example:
        with ServerManager(env_type="blackjack", port=9999) as server:
            env = HyperTokenEnv(f"ws://localhost:{server.port}")
            env.reset()
            # ...

        # Server is automatically stopped
    """

    def __init__(
        self,
        env_type: str = "blackjack",
        port: int = 9999,
        verbose: bool = False,
        start_timeout: float = 30.0,
        **env_options,
    ):
        """
        Initialize server manager.

        Args:
            env_type: Environment type to host
            port: Port to listen on
            verbose: Enable verbose logging
            start_timeout: Max time to wait for server to start
            **env_options: Additional environment options
        """
        self.env_type = env_type
        self.port = port
        self.verbose = verbose
        self.start_timeout = start_timeout
        self.env_options = env_options
        self.process: Optional[subprocess.Popen] = None

    @property
    def url(self) -> str:
        """WebSocket URL for connecting to the server."""
        return f"ws://localhost:{self.port}"

    def __enter__(self) -> "ServerManager":
        """Start the server and wait for it to be ready."""
        self.process = start_server(
            env_type=self.env_type,
            port=self.port,
            verbose=self.verbose,
            **self.env_options,
        )

        if not wait_for_server(self.url, timeout=self.start_timeout):
            self.process.terminate()
            raise RuntimeError(
                f"Server failed to start within {self.start_timeout}s"
            )

        return self

    def __exit__(self, *args) -> None:
        """Stop the server."""
        if self.process:
            self.process.terminate()
            try:
                self.process.wait(timeout=5.0)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()


def measure_latency(
    url: str = "ws://localhost:9999",
    samples: int = 100,
) -> dict:
    """
    Measure round-trip latency to the server.

    Args:
        url: WebSocket URL
        samples: Number of ping samples to collect

    Returns:
        Dict with min, max, mean, median latency in milliseconds

    Example:
        stats = measure_latency()
        print(f"Mean latency: {stats['mean']:.2f}ms")
    """
    import statistics

    from .client import HyperTokenClient

    client = HyperTokenClient(url)
    client.connect()

    latencies = []
    for _ in range(samples):
        latencies.append(client.ping())

    client.disconnect()

    return {
        "min": min(latencies),
        "max": max(latencies),
        "mean": statistics.mean(latencies),
        "median": statistics.median(latencies),
        "samples": samples,
    }
