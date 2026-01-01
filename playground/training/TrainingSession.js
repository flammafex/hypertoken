/**
 * TrainingSession.js
 *
 * Core training session management for HyperToken AI Training Dashboard.
 * Handles episode execution, metrics tracking, trajectory recording, and policy snapshots.
 */

// === Configuration Constants ===

/** @constant {number} Default number of episodes per training run */
const DEFAULT_TOTAL_EPISODES = 1000;

/** @constant {number} Default batch size for training updates */
const DEFAULT_BATCH_SIZE = 32;

/** @constant {number} Interval for policy evaluation snapshots */
const DEFAULT_EVAL_INTERVAL = 100;

/** @constant {number} Interval for chart UI updates (episodes) */
const DEFAULT_CHART_UPDATE_INTERVAL = 10;

/** @constant {number} Default exploration rate (epsilon for ε-greedy) */
const DEFAULT_EXPLORATION_RATE = 0.1;

/** @constant {number} Default softmax temperature */
const DEFAULT_TEMPERATURE = 1.0;

/** @constant {number} Maximum trajectories to keep in memory */
const MAX_STORED_TRAJECTORIES = 100;

/** @constant {number} Maximum steps per episode before truncation */
const MAX_STEPS_PER_EPISODE = 100;

/** @constant {number} Window size for recent reward statistics */
const STATS_WINDOW_SIZE = 100;

/** @constant {number} Window size for moving average calculation */
const MOVING_AVERAGE_WINDOW = 50;

/** @constant {number} Maximum reward history to return for charts */
const MAX_CHART_HISTORY = 200;

/** @constant {number} Yield interval to prevent UI blocking (episodes) */
const UI_YIELD_INTERVAL = 10;

// === Type Definitions ===

/**
 * @typedef {'idle' | 'running' | 'paused' | 'complete'} TrainingStatus
 */

/**
 * @typedef {'random' | 'heuristic' | 'onnx'} PolicyType
 */

/**
 * @typedef {Object} TrainingConfig
 * @property {number} [totalEpisodes=1000] - Total episodes to run
 * @property {number} [batchSize=32] - Batch size for updates
 * @property {number} [evalInterval=100] - Policy snapshot interval
 * @property {boolean} [recordTrajectories=true] - Whether to record trajectories
 * @property {boolean} [trackActionDistribution=true] - Whether to track action distribution
 * @property {number} [chartUpdateInterval=10] - Chart update interval
 * @property {number} [exploration=0.1] - Exploration rate
 * @property {number} [temperature=1.0] - Softmax temperature
 * @property {PolicyType} [policyType='random'] - Policy type
 * @property {boolean} [verboseLogging=false] - Enable verbose logging
 */

/**
 * @typedef {Object} TrainingMetrics
 * @property {number[]} rewards - Episode rewards
 * @property {number} wins - Total wins
 * @property {number} losses - Total losses
 * @property {number} ties - Total ties
 * @property {number[]} stepsPerEpisode - Steps per episode
 * @property {Object<string, number>} actionCounts - Action frequency counts
 * @property {number[]} episodeDurations - Episode durations in ms
 */

/**
 * @typedef {Object} TrainingStats
 * @property {number} episode - Current episode number
 * @property {number} totalEpisodes - Total episodes to run
 * @property {number} progress - Progress ratio (0-1)
 * @property {TrainingStatus} status - Current training status
 * @property {number} avgReward - Average reward over recent window
 * @property {number} winRate - Win rate (0-1)
 * @property {Object} convergence - Convergence detection result
 */

class TrainingSession extends EventTarget {
  /**
   * @param {Object} game - Game instance implementing Gym interface
   * @param {TrainingConfig} [config={}] - Training configuration
   */
  constructor(game, config = {}) {
    super();

    this.game = game;
    this.config = {
      totalEpisodes: config.totalEpisodes || DEFAULT_TOTAL_EPISODES,
      batchSize: config.batchSize || DEFAULT_BATCH_SIZE,
      evalInterval: config.evalInterval || DEFAULT_EVAL_INTERVAL,
      recordTrajectories: config.recordTrajectories ?? true,
      trackActionDistribution: config.trackActionDistribution ?? true,
      chartUpdateInterval: config.chartUpdateInterval || DEFAULT_CHART_UPDATE_INTERVAL,
      exploration: config.exploration || DEFAULT_EXPLORATION_RATE,
      temperature: config.temperature || DEFAULT_TEMPERATURE,
      policyType: config.policyType || 'random',
      verboseLogging: config.verboseLogging || false,
      ...config
    };

    /** @type {TrainingStatus} */
    this.status = 'idle';
    this.currentEpisode = 0;
    this.startTime = null;
    this.pauseTime = null;
    this.totalPausedTime = 0;

    /** @type {TrainingMetrics} */
    this.metrics = {
      rewards: [],
      wins: 0,
      losses: 0,
      ties: 0,
      stepsPerEpisode: [],
      actionCounts: {},
      episodeDurations: []
    };

    // Trajectories (last N episodes)
    this.trajectories = [];
    this.maxTrajectories = MAX_STORED_TRAJECTORIES;

    // Policy snapshots for heatmap
    this.policySnapshots = [];

    // ONNX model (if loaded)
    this.onnxAgent = null;

    // Abort controller for stopping training
    this.abortController = null;

    // Lock to prevent race conditions in status transitions
    this._transitionLock = false;
  }

  /**
   * Start or resume training
   */
  async start() {
    // Acquire lock to prevent concurrent status transitions
    if (this._transitionLock || this.status === 'running') return;
    this._transitionLock = true;

    try {
      if (this.status === 'idle' || this.status === 'complete') {
        // Fresh start
        this.reset();
        this.startTime = Date.now();
      } else if (this.status === 'paused') {
        // Resume from pause
        if (this.pauseTime) {
          this.totalPausedTime += Date.now() - this.pauseTime;
          this.pauseTime = null;
        }
      }

      this.status = 'running';
      this.abortController = new AbortController();

      this.dispatchEvent(new CustomEvent('training:start', {
        detail: { config: this.config, episode: this.currentEpisode }
      }));
    } finally {
      this._transitionLock = false;
    }

    await this.runTrainingLoop();
  }

  /**
   * Pause training
   */
  pause() {
    if (this._transitionLock || this.status !== 'running') return;
    this._transitionLock = true;

    try {
      this.status = 'paused';
      this.pauseTime = Date.now();
      this.dispatchEvent(new CustomEvent('training:pause', {
        detail: this.getStats()
      }));
    } finally {
      this._transitionLock = false;
    }
  }

  /**
   * Resume training after pause
   */
  resume() {
    if (this.status !== 'paused') return;
    this.start();
  }

  /**
   * Stop training completely
   */
  stop() {
    if (this._transitionLock) return;
    this._transitionLock = true;

    try {
      if (this.abortController) {
        this.abortController.abort();
      }
      this.status = 'idle';
      this.dispatchEvent(new CustomEvent('training:stop', {
        detail: this.getStats()
      }));
    } finally {
      this._transitionLock = false;
    }
  }

  /**
   * Reset all metrics and state
   */
  reset() {
    this.currentEpisode = 0;
    this.startTime = null;
    this.pauseTime = null;
    this.totalPausedTime = 0;

    this.metrics = {
      rewards: [],
      wins: 0,
      losses: 0,
      ties: 0,
      stepsPerEpisode: [],
      actionCounts: {},
      episodeDurations: []
    };

    this.trajectories = [];
    this.policySnapshots = [];
  }

  /**
   * Main training loop
   */
  async runTrainingLoop() {
    const signal = this.abortController?.signal;

    while (this.status === 'running' && this.currentEpisode < this.config.totalEpisodes) {
      // Check for abort
      if (signal?.aborted) break;

      const episodeStart = performance.now();

      // Run single episode
      const trajectory = await this.runEpisode();

      const episodeDuration = performance.now() - episodeStart;

      // Update metrics
      this.currentEpisode++;
      this.metrics.rewards.push(trajectory.totalReward);
      this.metrics.stepsPerEpisode.push(trajectory.steps.length);
      this.metrics.episodeDurations.push(episodeDuration);

      if (trajectory.outcome === 'win') this.metrics.wins++;
      else if (trajectory.outcome === 'loss') this.metrics.losses++;
      else this.metrics.ties++;

      // Track action distribution
      if (this.config.trackActionDistribution) {
        for (const step of trajectory.steps) {
          const actionKey = String(step.action);
          this.metrics.actionCounts[actionKey] =
            (this.metrics.actionCounts[actionKey] || 0) + 1;
        }
      }

      // Store trajectory
      if (this.config.recordTrajectories) {
        this.trajectories.push(trajectory);
        if (this.trajectories.length > this.maxTrajectories) {
          this.trajectories.shift();
        }
      }

      // Emit progress
      if (this.currentEpisode % this.config.chartUpdateInterval === 0) {
        this.dispatchEvent(new CustomEvent('training:progress', {
          detail: this.getStats()
        }));
      }

      // Snapshot policy periodically
      if (this.currentEpisode % this.config.evalInterval === 0) {
        await this.snapshotPolicy();
      }

      // Verbose logging
      if (this.config.verboseLogging) {
        console.log(`Episode ${this.currentEpisode}: reward=${trajectory.totalReward.toFixed(2)}, outcome=${trajectory.outcome}, steps=${trajectory.steps.length}`);
      }

      // Yield to UI periodically to prevent blocking
      if (this.currentEpisode % UI_YIELD_INTERVAL === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    if (this.currentEpisode >= this.config.totalEpisodes) {
      this.status = 'complete';
      this.dispatchEvent(new CustomEvent('training:complete', {
        detail: this.getStats()
      }));
    }
  }

  /**
   * Run a single episode
   */
  async runEpisode() {
    const trajectory = {
      episode: this.currentEpisode + 1,
      steps: [],
      totalReward: 0,
      outcome: null,
      initialState: null,
      timestamp: Date.now()
    };

    // Check if game has step-based interface
    if (typeof this.game.reset === 'function' && typeof this.game.step === 'function') {
      // Use Gym-style interface
      return await this.runGymEpisode(trajectory);
    } else if (typeof this.game.runEpisode === 'function') {
      // Use legacy runEpisode interface
      return await this.runLegacyEpisode(trajectory);
    } else {
      throw new Error('Game must implement either reset/step or runEpisode interface');
    }
  }

  /**
   * Run episode using Gym-style step interface
   */
  async runGymEpisode(trajectory) {
    // Reset game
    const initialObs = await this.game.reset();
    trajectory.initialState = this.serializeState(initialObs);

    let done = false;
    let stepCount = 0;

    while (!done && stepCount < MAX_STEPS_PER_EPISODE) {
      const state = this.game.getState ? this.game.getState() : initialObs;

      // Get action probabilities
      const actionProbs = await this.getActionProbabilities(state);

      // Select action
      const action = this.selectAction(actionProbs);

      // Step environment
      const result = await this.game.step(action);

      // Record step
      trajectory.steps.push({
        step: stepCount,
        state: this.serializeState(state),
        action: action,
        actionProbs: actionProbs,
        reward: result.reward,
        nextState: this.serializeState(result.observation || result.state)
      });

      trajectory.totalReward += result.reward;
      done = result.terminated || result.truncated || result.done;
      stepCount++;
    }

    // Determine outcome
    trajectory.outcome = this.determineOutcome(trajectory.totalReward);

    return trajectory;
  }

  /**
   * Run episode using legacy runEpisode interface
   */
  async runLegacyEpisode(trajectory) {
    const result = await this.game.runEpisode();

    trajectory.totalReward = result.reward;
    trajectory.outcome = result.win ? 'win' : (result.reward < 0 ? 'loss' : 'tie');

    // Try to extract trajectory data if available
    if (result.trajectory) {
      trajectory.steps = result.trajectory;
    } else if (result.steps) {
      trajectory.steps = result.steps;
    } else {
      // Create minimal step record
      trajectory.steps = [{
        step: 0,
        state: result.initialState || null,
        action: null,
        actionProbs: null,
        reward: result.reward,
        nextState: result.finalState || null
      }];
    }

    trajectory.initialState = result.initialState || null;

    return trajectory;
  }

  /**
   * Determine outcome based on reward
   */
  determineOutcome(reward) {
    if (reward > 0) return 'win';
    if (reward < 0) return 'loss';
    return 'tie';
  }

  /**
   * Get action probabilities for a given state
   */
  async getActionProbabilities(state) {
    const numActions = this.game.actionSpace?.n || this.game.getActionCount?.() || 2;

    switch (this.config.policyType) {
      case 'onnx':
        if (this.onnxAgent) {
          try {
            const obs = this.stateToObservation(state);
            const probs = await this.onnxAgent.predict(obs);
            return Array.from(probs);
          } catch (e) {
            console.warn('ONNX prediction failed, falling back to random:', e);
            return new Array(numActions).fill(1 / numActions);
          }
        }
        return new Array(numActions).fill(1 / numActions);

      case 'heuristic':
        if (typeof this.game.getHeuristicPolicy === 'function') {
          return this.game.getHeuristicPolicy(state);
        }
        return new Array(numActions).fill(1 / numActions);

      case 'random':
      default:
        return new Array(numActions).fill(1 / numActions);
    }
  }

  /**
   * Select action from probabilities using exploration strategy
   */
  selectAction(probs) {
    // ε-greedy exploration
    if (Math.random() < this.config.exploration) {
      return Math.floor(Math.random() * probs.length);
    }

    // Temperature-scaled softmax sampling
    if (this.config.temperature !== 1.0) {
      const scaledProbs = probs.map(p => Math.pow(p, 1 / this.config.temperature));
      const sum = scaledProbs.reduce((a, b) => a + b, 0);
      const normalizedProbs = scaledProbs.map(p => p / sum);

      const r = Math.random();
      let cumulative = 0;
      for (let i = 0; i < normalizedProbs.length; i++) {
        cumulative += normalizedProbs[i];
        if (r < cumulative) return i;
      }
      return normalizedProbs.length - 1;
    }

    // Greedy selection
    return probs.indexOf(Math.max(...probs));
  }

  /**
   * Serialize state to JSON-compatible format
   */
  serializeState(state) {
    if (state === null || state === undefined) return null;
    if (Array.isArray(state)) return [...state];
    if (state instanceof Float32Array || state instanceof Float64Array) {
      return Array.from(state);
    }
    if (typeof state === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(state)) {
        result[key] = this.serializeState(value);
      }
      return result;
    }
    return state;
  }

  /**
   * Convert game state to observation array for ONNX
   */
  stateToObservation(state) {
    if (Array.isArray(state)) return new Float32Array(state);
    if (state instanceof Float32Array) return state;

    // Game-specific state conversion
    if (typeof this.game.stateToObservation === 'function') {
      return this.game.stateToObservation(state);
    }

    // Generic object-to-array conversion
    if (typeof state === 'object') {
      const values = [];
      const flatten = (obj) => {
        for (const v of Object.values(obj)) {
          if (typeof v === 'number') values.push(v);
          else if (typeof v === 'boolean') values.push(v ? 1 : 0);
          else if (Array.isArray(v)) v.forEach(x => flatten({ x }));
          else if (typeof v === 'object' && v !== null) flatten(v);
        }
      };
      flatten(state);
      return new Float32Array(values);
    }

    return new Float32Array([state]);
  }

  /**
   * Snapshot policy for heatmap visualization
   */
  async snapshotPolicy() {
    const snapshot = {
      episode: this.currentEpisode,
      timestamp: Date.now(),
      samples: []
    };

    // Game-specific state space sampling
    const gameName = this.game.name || this.game.constructor.name.toLowerCase();

    if (gameName.includes('blackjack')) {
      // Sample Blackjack state space: player value x dealer card
      for (let playerVal = 4; playerVal <= 21; playerVal++) {
        for (let dealerCard = 1; dealerCard <= 10; dealerCard++) {
          // Create synthetic state
          const state = {
            playerValue: playerVal,
            dealerShowing: dealerCard,
            usableAce: false,
            canDouble: playerVal <= 11,
            canSplit: false
          };

          const probs = await this.getActionProbabilities(state);

          snapshot.samples.push({
            playerValue: playerVal,
            dealerCard: dealerCard,
            hitProb: probs[0] || 0,
            standProb: probs[1] || 0,
            doubleProb: probs[2] || 0
          });
        }
      }
    } else if (gameName.includes('tictactoe')) {
      // Sample TicTacToe positions
      // Just store current action distribution
      snapshot.samples.push({
        actionDistribution: this.getActionDistribution()
      });
    } else if (gameName.includes('prisoner')) {
      // Sample Prisoner's Dilemma strategies
      snapshot.samples.push({
        cooperateRate: this.metrics.actionCounts['0'] /
          (Object.values(this.metrics.actionCounts).reduce((a, b) => a + b, 0) || 1)
      });
    }

    this.policySnapshots.push(snapshot);

    this.dispatchEvent(new CustomEvent('policy:snapshot', {
      detail: snapshot
    }));
  }

  /**
   * Load ONNX model for policy evaluation
   */
  async loadONNXModel(modelPath) {
    try {
      // Dynamically import ONNXAgent if available
      const { ONNXAgent } = await import('../../interface/ONNXAgent.js');
      this.onnxAgent = new ONNXAgent();
      await this.onnxAgent.load(modelPath);
      this.config.policyType = 'onnx';

      this.dispatchEvent(new CustomEvent('model:loaded', {
        detail: { modelPath }
      }));

      return true;
    } catch (e) {
      console.error('Failed to load ONNX model:', e);
      return false;
    }
  }

  /**
   * Get comprehensive training statistics
   */
  getStats() {
    const rewards = this.metrics.rewards;
    const recent = rewards.slice(-STATS_WINDOW_SIZE);

    // Calculate statistics
    const totalReward = rewards.reduce((a, b) => a + b, 0);
    const avgReward = recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
    const bestReward = rewards.length > 0 ? Math.max(...rewards) : 0;
    const worstReward = rewards.length > 0 ? Math.min(...rewards) : 0;
    const latestReward = rewards[rewards.length - 1] || 0;

    // Standard deviation of recent rewards
    const rewardStdDev = recent.length > 1
      ? Math.sqrt(recent.reduce((sum, r) => sum + Math.pow(r - avgReward, 2), 0) / recent.length)
      : 0;

    // Steps per episode stats
    const stepsPerEp = this.metrics.stepsPerEpisode;
    const avgSteps = stepsPerEp.length > 0
      ? stepsPerEp.reduce((a, b) => a + b, 0) / stepsPerEp.length
      : 0;
    const stepsStdDev = stepsPerEp.length > 1
      ? Math.sqrt(stepsPerEp.reduce((sum, s) => sum + Math.pow(s - avgSteps, 2), 0) / stepsPerEp.length)
      : 0;

    return {
      // Progress
      episode: this.currentEpisode,
      totalEpisodes: this.config.totalEpisodes,
      progress: this.currentEpisode / this.config.totalEpisodes,
      status: this.status,

      // Rewards
      totalReward,
      avgReward,
      bestReward,
      worstReward,
      latestReward,
      rewardStdDev,

      // Win/Loss
      wins: this.metrics.wins,
      losses: this.metrics.losses,
      ties: this.metrics.ties,
      winRate: this.currentEpisode > 0 ? this.metrics.wins / this.currentEpisode : 0,

      // Steps
      avgSteps,
      stepsStdDev,

      // Action distribution
      actionDistribution: this.getActionDistribution(),

      // Timing
      elapsedTime: this.getElapsedTime(),
      episodesPerSecond: this.getEpisodesPerSecond(),
      eta: this.getETA(),

      // Analysis
      convergence: this.detectConvergence(),

      // Data for charts
      rewardHistory: rewards.slice(-MAX_CHART_HISTORY),
      movingAverage: this.calculateMovingAverage(rewards, MOVING_AVERAGE_WINDOW).slice(-MAX_CHART_HISTORY),
      trajectories: this.trajectories.slice(-UI_YIELD_INTERVAL),

      // Policy snapshots
      policySnapshots: this.policySnapshots
    };
  }

  /**
   * Get action distribution as percentages
   */
  getActionDistribution() {
    const total = Object.values(this.metrics.actionCounts).reduce((a, b) => a + b, 0);
    if (total === 0) return {};

    const dist = {};
    for (const [action, count] of Object.entries(this.metrics.actionCounts)) {
      dist[action] = count / total;
    }
    return dist;
  }

  /**
   * Calculate moving average of rewards
   */
  calculateMovingAverage(rewards, windowSize) {
    if (rewards.length === 0) return [];

    const result = [];
    for (let i = 0; i < rewards.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = rewards.slice(start, i + 1);
      result.push(window.reduce((a, b) => a + b, 0) / window.length);
    }
    return result;
  }

  /**
   * Get elapsed training time (excluding pauses)
   */
  getElapsedTime() {
    if (!this.startTime) return 0;

    let elapsed = Date.now() - this.startTime - this.totalPausedTime;
    if (this.pauseTime) {
      elapsed -= (Date.now() - this.pauseTime);
    }
    return Math.max(0, elapsed);
  }

  /**
   * Get episodes per second rate
   */
  getEpisodesPerSecond() {
    const elapsed = this.getElapsedTime() / 1000;
    if (elapsed === 0 || this.currentEpisode === 0) return 0;
    return this.currentEpisode / elapsed;
  }

  /**
   * Estimate time remaining
   */
  getETA() {
    const eps = this.getEpisodesPerSecond();
    if (eps === 0) return Infinity;
    const remaining = this.config.totalEpisodes - this.currentEpisode;
    return (remaining / eps) * 1000; // ms
  }

  /**
   * Detect training convergence
   */
  detectConvergence() {
    const rewards = this.metrics.rewards;

    if (rewards.length < STATS_WINDOW_SIZE) {
      return { status: 'insufficient_data', label: '⚪ Gathering data...', color: '#64748b' };
    }

    const recent = rewards.slice(-STATS_WINDOW_SIZE);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length;
    const stdDev = Math.sqrt(variance);

    // Compare to earlier window
    if (rewards.length < STATS_WINDOW_SIZE * 2) {
      return { status: 'warming_up', label: '⚪ Warming up...', color: '#64748b' };
    }

    const earlier = rewards.slice(-STATS_WINDOW_SIZE * 2, -STATS_WINDOW_SIZE);
    const earlierMean = earlier.reduce((a, b) => a + b, 0) / earlier.length;

    // Trend detection
    const improvement = mean - earlierMean;
    const relativeImprovement = earlierMean !== 0 ? improvement / Math.abs(earlierMean) : 0;

    // Coefficient of variation for stability
    const cv = mean !== 0 ? stdDev / Math.abs(mean) : stdDev;

    if (relativeImprovement > 0.1) {
      return { status: 'improving', label: '🟢 Improving', color: '#4ade80' };
    }
    if (relativeImprovement < -0.1) {
      return { status: 'degrading', label: '🔴 Degrading', color: '#f87171' };
    }
    if (cv < 0.2) {
      return { status: 'converged', label: '🟣 Converged', color: '#a78bfa' };
    }
    return { status: 'stable', label: '🔵 Stable', color: '#60a5fa' };
  }

  /**
   * Export training results to JSON
   */
  exportResults() {
    return {
      config: this.config,
      metrics: {
        ...this.metrics,
        rewardHistory: this.metrics.rewards
      },
      stats: this.getStats(),
      trajectories: this.trajectories,
      policySnapshots: this.policySnapshots,
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Import previous training results
   */
  importResults(data) {
    if (data.config) this.config = { ...this.config, ...data.config };
    if (data.metrics) {
      this.metrics = {
        rewards: data.metrics.rewardHistory || data.metrics.rewards || [],
        wins: data.metrics.wins || 0,
        losses: data.metrics.losses || 0,
        ties: data.metrics.ties || 0,
        stepsPerEpisode: data.metrics.stepsPerEpisode || [],
        actionCounts: data.metrics.actionCounts || {},
        episodeDurations: data.metrics.episodeDurations || []
      };
      this.currentEpisode = this.metrics.rewards.length;
    }
    if (data.trajectories) this.trajectories = data.trajectories;
    if (data.policySnapshots) this.policySnapshots = data.policySnapshots;

    this.dispatchEvent(new CustomEvent('training:imported', {
      detail: this.getStats()
    }));
  }
}

export { TrainingSession };
