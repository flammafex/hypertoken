/**
 * training-dashboard.js
 *
 * AI Training Dashboard component for HyperToken IDE.
 * Provides comprehensive training visualization, controls, and episode inspection.
 */

import { h, render } from 'https://esm.sh/preact@10.19.3';
import { useState, useEffect, useRef, useMemo, useCallback } from 'https://esm.sh/preact@10.19.3/hooks';
import htm from 'https://esm.sh/htm@3.1.1';

import { TrainingSession } from '../training/TrainingSession.js';

const html = htm.bind(h);

// ============================================================================
// Utility Functions
// ============================================================================

function formatDuration(ms) {
  if (!ms || ms === Infinity || isNaN(ms)) return '--:--';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatNumber(num, decimals = 1) {
  if (num === undefined || num === null || isNaN(num)) return '--';
  if (Math.abs(num) >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (Math.abs(num) >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toFixed(decimals);
}

// ============================================================================
// Progress Bar Component
// ============================================================================

function ProgressBar({ progress, episode, total, eta, speed, elapsed, status }) {
  const etaStr = formatDuration(eta);
  const elapsedStr = formatDuration(elapsed);

  return html`
    <div class="training-progress">
      <div class="progress-bar">
        <div
          class="progress-fill ${status}"
          style="width: ${Math.min(progress * 100, 100)}%"
        ></div>
      </div>
      <div class="progress-info">
        <span class="progress-episode">
          Episode ${episode.toLocaleString()}/${total.toLocaleString()}
          (${(progress * 100).toFixed(1)}%)
        </span>
        <span class="progress-timing">
          ETA: ${etaStr} | Speed: ${speed.toFixed(0)} ep/s | Elapsed: ${elapsedStr}
        </span>
      </div>
    </div>
  `;
}

// ============================================================================
// Reward Chart Component (Canvas-based)
// ============================================================================

function RewardChart({ history, movingAverage, movingAvgWindow = 50, onCanvasRef }) {
  const canvasRef = useRef();

  // Expose canvas ref for export
  useEffect(() => {
    if (canvasRef.current && onCanvasRef) {
      onCanvasRef(canvasRef.current);
    }
  }, [onCanvasRef]);

  useEffect(() => {
    if (!canvasRef.current || history.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    // Calculate bounds with padding
    const allValues = [...history, ...(movingAverage || [])];
    let min = Math.min(...allValues);
    let max = Math.max(...allValues);

    // Add padding to bounds
    const padding = (max - min) * 0.1 || 1;
    min -= padding;
    max += padding;
    const range = max - min || 1;

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw zero line if visible
    if (min < 0 && max > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      const zeroY = height - ((0 - min) / range) * height;
      ctx.moveTo(0, zeroY);
      ctx.lineTo(width, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw episode rewards (faint)
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    history.forEach((reward, i) => {
      const x = (i / (history.length - 1 || 1)) * width;
      const y = height - ((reward - min) / range) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw moving average (bold)
    if (movingAverage && movingAverage.length > 0) {
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      movingAverage.forEach((avg, i) => {
        const x = (i / (movingAverage.length - 1 || 1)) * width;
        const y = height - ((avg - min) / range) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Draw axis labels
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(max.toFixed(1), 4, 12);
    ctx.fillText(min.toFixed(1), 4, height - 4);
  }, [history, movingAverage]);

  const latest = history[history.length - 1];
  const best = history.length > 0 ? Math.max(...history) : 0;

  return html`
    <div class="chart-container reward-chart">
      <div class="chart-header">
        <span class="chart-title">Reward</span>
        <span class="chart-legend">
          <span class="legend-item episode">Episode</span>
          <span class="legend-item avg">Avg (${movingAvgWindow})</span>
        </span>
      </div>
      <canvas ref=${canvasRef} width="400" height="120" />
      <div class="chart-footer">
        <span>Latest: ${latest !== undefined ? latest.toFixed(1) : '--'}</span>
        <span>Best: ${best.toFixed(1)}</span>
      </div>
    </div>
  `;
}

// ============================================================================
// Action Distribution Bar Chart
// ============================================================================

function ActionDistribution({ distribution, actionLabels = {} }) {
  const actions = Object.entries(distribution);
  const maxValue = Math.max(...actions.map(([, v]) => v), 0.01);

  if (actions.length === 0) {
    return html`
      <div class="action-distribution empty">
        <div class="chart-header">Action Distribution</div>
        <div class="empty-message">No actions recorded yet</div>
      </div>
    `;
  }

  return html`
    <div class="action-distribution">
      <div class="chart-header">Action Distribution</div>
      <div class="action-bars">
        ${actions.map(([action, prob]) => html`
          <div class="action-bar-container" key=${action}>
            <div
              class="action-bar"
              style="height: ${(prob / maxValue) * 100}%"
              title="${(prob * 100).toFixed(1)}%"
            />
            <div class="action-label">${actionLabels[action] || `A${action}`}</div>
            <div class="action-value">${(prob * 100).toFixed(0)}%</div>
          </div>
        `)}
      </div>
    </div>
  `;
}

// ============================================================================
// Statistics Panel
// ============================================================================

function StatsPanel({ stats }) {
  if (!stats) return null;

  const { convergence } = stats;

  return html`
    <div class="stats-panel">
      <div class="stats-header">Statistics</div>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">${stats.episode.toLocaleString()}</div>
          <div class="stat-label">Episodes</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${formatNumber(stats.totalReward, 0)}</div>
          <div class="stat-label">Total Reward</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${stats.avgReward.toFixed(2)}</div>
          <div class="stat-label">Avg Reward (100)</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${stats.bestReward.toFixed(1)}</div>
          <div class="stat-label">Best Episode</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${(stats.winRate * 100).toFixed(1)}%</div>
          <div class="stat-label">Win Rate</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" style="color: ${convergence?.color || '#64748b'}">
            ${convergence?.label || '--'}
          </div>
          <div class="stat-label">Convergence</div>
        </div>
        <div class="stat-item full-width">
          <div class="stat-value">
            Mean: ${stats.avgSteps.toFixed(1)} | Std: ${stats.stepsStdDev.toFixed(1)}
          </div>
          <div class="stat-label">Steps/Episode</div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// Episode List Component
// ============================================================================

function EpisodeList({ trajectories, onSelect, onReplay }) {
  if (!trajectories || trajectories.length === 0) {
    return html`
      <div class="episode-list">
        <div class="list-header">Recent Episodes</div>
        <div class="list-content empty">
          <span>Episodes will appear here during training</span>
        </div>
      </div>
    `;
  }

  return html`
    <div class="episode-list">
      <div class="list-header">
        <span>Recent Episodes</span>
        <span class="episode-count">${trajectories.length} recorded</span>
      </div>
      <div class="list-content">
        ${trajectories.slice().reverse().map(traj => html`
          <div class="episode-item" key=${traj.episode}>
            <span class="episode-num">#${traj.episode}</span>
            <span class="episode-reward ${traj.outcome}">
              ${traj.totalReward >= 0 ? '+' : ''}${traj.totalReward.toFixed(1)}
            </span>
            <span class="episode-steps">${traj.steps?.length || 0} steps</span>
            <span class="episode-outcome ${traj.outcome}">${traj.outcome}</span>
            <div class="episode-actions">
              <button
                onClick=${() => onReplay && onReplay(traj)}
                title="Replay episode"
                class="btn-icon"
              >▶</button>
              <button
                onClick=${() => onSelect && onSelect(traj)}
                title="View details"
                class="btn-icon"
              >📋</button>
            </div>
          </div>
        `)}
      </div>
    </div>
  `;
}

// ============================================================================
// Policy Heatmap Component (for Blackjack-style games)
// ============================================================================

function PolicyHeatmap({ snapshots, metric = 'hitProb', gameType }) {
  const canvasRef = useRef();
  const latestSnapshot = snapshots?.[snapshots.length - 1];

  useEffect(() => {
    if (!canvasRef.current || !latestSnapshot?.samples?.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Clear
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameType !== 'blackjack') return;

    // Draw heatmap for Blackjack
    const cellWidth = canvas.width / 10;
    const cellHeight = canvas.height / 18;

    for (const sample of latestSnapshot.samples) {
      if (sample.playerValue === undefined) continue;

      const x = (sample.dealerCard - 1) * cellWidth;
      const y = (21 - sample.playerValue) * cellHeight;

      const value = sample[metric] || 0;
      // Green (low) to Red (high) for hit probability
      const hue = (1 - value) * 120;
      ctx.fillStyle = `hsl(${hue}, 70%, 45%)`;
      ctx.fillRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);

      // Draw value text for larger cells
      if (cellWidth > 20 && cellHeight > 15) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          (value * 100).toFixed(0),
          x + cellWidth / 2,
          y + cellHeight / 2 + 3
        );
      }
    }

    // Draw axis labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';

    // Dealer cards (x-axis)
    for (let d = 1; d <= 10; d++) {
      const label = d === 1 ? 'A' : d === 10 ? 'T' : String(d);
      ctx.textAlign = 'center';
      ctx.fillText(label, (d - 0.5) * cellWidth, canvas.height + 12);
    }

    // Player values (y-axis)
    for (let p = 4; p <= 21; p += 2) {
      ctx.textAlign = 'right';
      ctx.fillText(String(p), -4, (21 - p + 0.5) * cellHeight + 3);
    }
  }, [latestSnapshot, metric, gameType]);

  if (!latestSnapshot || gameType !== 'blackjack') {
    return html`
      <div class="policy-heatmap">
        <div class="chart-header">Policy Heatmap</div>
        <div class="heatmap-placeholder">
          ${gameType === 'blackjack'
            ? 'Policy heatmap will appear after evaluation interval...'
            : 'Heatmap available for Blackjack only'}
        </div>
      </div>
    `;
  }

  return html`
    <div class="policy-heatmap">
      <div class="chart-header">
        <span>Policy: ${metric === 'hitProb' ? 'Hit' : 'Stand'} Probability</span>
        <span class="snapshot-info">Episode ${latestSnapshot.episode}</span>
      </div>
      <div class="heatmap-wrapper">
        <div class="y-axis-label">Player Value</div>
        <div class="heatmap-container">
          <canvas ref=${canvasRef} width="300" height="270" />
        </div>
        <div class="x-axis-label">Dealer Showing</div>
      </div>
      <div class="heatmap-legend">
        <span class="legend-low">0%</span>
        <div class="legend-gradient"></div>
        <span class="legend-high">100%</span>
      </div>
    </div>
  `;
}

// ============================================================================
// Configuration Modal
// ============================================================================

function ConfigModal({ config, onSave, onCancel, onStartTraining }) {
  const [localConfig, setLocalConfig] = useState({ ...config });

  const handleChange = (key, value) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (start = false) => {
    onSave(localConfig);
    if (start) {
      onStartTraining(localConfig);
    }
  };

  return html`
    <div class="modal-overlay" onClick=${onCancel}>
      <div class="modal config-modal" onClick=${e => e.stopPropagation()}>
        <div class="modal-header">
          <h3>Training Configuration</h3>
          <button class="btn-close" onClick=${onCancel}>×</button>
        </div>

        <div class="modal-body">
          <div class="config-section">
            <h4>Episodes</h4>
            <div class="config-grid">
              <label>
                <span>Total Episodes:</span>
                <input
                  type="number"
                  value=${localConfig.totalEpisodes}
                  onInput=${e => handleChange('totalEpisodes', parseInt(e.target.value) || 1000)}
                  min="1"
                  max="100000"
                />
              </label>
              <label>
                <span>Eval Interval:</span>
                <input
                  type="number"
                  value=${localConfig.evalInterval}
                  onInput=${e => handleChange('evalInterval', parseInt(e.target.value) || 100)}
                  min="1"
                />
                <small>episodes</small>
              </label>
            </div>
          </div>

          <div class="config-section">
            <h4>Policy</h4>
            <div class="config-grid">
              <label class="radio-group">
                <span>Type:</span>
                <div class="radio-options">
                  <label>
                    <input
                      type="radio"
                      name="policyType"
                      value="random"
                      checked=${localConfig.policyType === 'random'}
                      onChange=${e => handleChange('policyType', e.target.value)}
                    />
                    Random
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="policyType"
                      value="heuristic"
                      checked=${localConfig.policyType === 'heuristic'}
                      onChange=${e => handleChange('policyType', e.target.value)}
                    />
                    Heuristic
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="policyType"
                      value="onnx"
                      checked=${localConfig.policyType === 'onnx'}
                      onChange=${e => handleChange('policyType', e.target.value)}
                    />
                    ONNX Model
                  </label>
                </div>
              </label>
              <label>
                <span>Exploration (ε):</span>
                <input
                  type="number"
                  value=${localConfig.exploration}
                  onInput=${e => handleChange('exploration', parseFloat(e.target.value) || 0.1)}
                  min="0"
                  max="1"
                  step="0.05"
                />
                <small>(0-1)</small>
              </label>
              <label>
                <span>Temperature:</span>
                <input
                  type="number"
                  value=${localConfig.temperature}
                  onInput=${e => handleChange('temperature', parseFloat(e.target.value) || 1.0)}
                  min="0.1"
                  max="10"
                  step="0.1"
                />
                <small>(softmax)</small>
              </label>
            </div>
          </div>

          <div class="config-section">
            <h4>Logging</h4>
            <div class="config-checkboxes">
              <label>
                <input
                  type="checkbox"
                  checked=${localConfig.recordTrajectories}
                  onChange=${e => handleChange('recordTrajectories', e.target.checked)}
                />
                Record episode trajectories
              </label>
              <label>
                <input
                  type="checkbox"
                  checked=${localConfig.trackActionDistribution}
                  onChange=${e => handleChange('trackActionDistribution', e.target.checked)}
                />
                Track action distribution
              </label>
              <label>
                <input
                  type="checkbox"
                  checked=${localConfig.verboseLogging}
                  onChange=${e => handleChange('verboseLogging', e.target.checked)}
                />
                Verbose console output
              </label>
            </div>
            <label>
              <span>Chart update interval:</span>
              <input
                type="number"
                value=${localConfig.chartUpdateInterval}
                onInput=${e => handleChange('chartUpdateInterval', parseInt(e.target.value) || 10)}
                min="1"
                max="100"
              />
              <small>episodes</small>
            </label>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" onClick=${onCancel}>Cancel</button>
          <button class="btn-secondary" onClick=${() => handleSubmit(false)}>Apply</button>
          <button class="btn-primary" onClick=${() => handleSubmit(true)}>Apply & Start Training</button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// Episode Detail Modal
// ============================================================================

function EpisodeDetailModal({ trajectory, actionLabels, onClose, onPrev, onNext, onReplay }) {
  if (!trajectory) return null;

  return html`
    <div class="modal-overlay" onClick=${onClose}>
      <div class="modal episode-detail-modal" onClick=${e => e.stopPropagation()}>
        <div class="modal-header">
          <h3>Episode #${trajectory.episode} Details</h3>
          <button class="btn-close" onClick=${onClose}>×</button>
        </div>

        <div class="modal-body">
          <div class="episode-summary">
            <div class="summary-item">
              <span class="label">Reward:</span>
              <span class="value ${trajectory.outcome}">${trajectory.totalReward.toFixed(1)}</span>
            </div>
            <div class="summary-item">
              <span class="label">Steps:</span>
              <span class="value">${trajectory.steps?.length || 0}</span>
            </div>
            <div class="summary-item">
              <span class="label">Outcome:</span>
              <span class="value ${trajectory.outcome}">${trajectory.outcome?.toUpperCase()}</span>
            </div>
          </div>

          ${trajectory.initialState && html`
            <div class="initial-state">
              <span class="label">Initial State:</span>
              <code>${JSON.stringify(trajectory.initialState)}</code>
            </div>
          `}

          <div class="trajectory-table-wrapper">
            <h4>Trajectory</h4>
            <table class="trajectory-table">
              <thead>
                <tr>
                  <th>Step</th>
                  <th>State</th>
                  <th>Action</th>
                  <th>Reward</th>
                  <th>Probabilities</th>
                </tr>
              </thead>
              <tbody>
                ${(trajectory.steps || []).map(step => html`
                  <tr key=${step.step}>
                    <td class="step-num">${step.step + 1}</td>
                    <td class="step-state">
                      <code>${typeof step.state === 'object' ? JSON.stringify(step.state) : step.state}</code>
                    </td>
                    <td class="step-action">
                      ${actionLabels?.[step.action] || `Action ${step.action}`}
                    </td>
                    <td class="step-reward ${step.reward > 0 ? 'positive' : step.reward < 0 ? 'negative' : ''}">
                      ${step.reward !== undefined ? (step.reward >= 0 ? '+' : '') + step.reward.toFixed(1) : '--'}
                    </td>
                    <td class="step-probs">
                      ${step.actionProbs
                        ? step.actionProbs.map((p, i) => html`
                            <span class="prob ${i === step.action ? 'selected' : ''}">
                              ${actionLabels?.[i] || `A${i}`}: ${(p * 100).toFixed(0)}%
                            </span>
                          `)
                        : '--'}
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" onClick=${onPrev} disabled=${!onPrev}>◀ Prev</button>
          <button class="btn-primary" onClick=${() => onReplay && onReplay(trajectory)}>▶ Replay</button>
          <button class="btn-secondary" onClick=${onNext} disabled=${!onNext}>Next ▶</button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// Main Training Dashboard Component
// ============================================================================

function TrainingDashboard({ game, gameType, actionLabels: initialActionLabels, onLog }) {
  // Session state
  const [session, setSession] = useState(null);
  const [stats, setStats] = useState(null);

  // UI state
  const [showConfig, setShowConfig] = useState(false);
  const [showEpisodeDetail, setShowEpisodeDetail] = useState(null);
  const [selectedEpisodeIndex, setSelectedEpisodeIndex] = useState(-1);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [importedRuns, setImportedRuns] = useState([]);

  // Refs
  const rewardChartRef = useRef(null);
  const fileInputRef = useRef(null);

  // Configuration
  const [config, setConfig] = useState({
    totalEpisodes: 1000,
    evalInterval: 100,
    exploration: 0.1,
    temperature: 1.0,
    policyType: 'random',
    recordTrajectories: true,
    trackActionDistribution: true,
    chartUpdateInterval: 10,
    verboseLogging: false
  });

  // Derive action labels from game or use defaults
  const actionLabels = useMemo(() => {
    if (initialActionLabels) return initialActionLabels;

    const labels = game?.actionLabels || game?.getActionLabels?.();
    if (labels) return labels;

    // Default labels based on game type
    switch (gameType) {
      case 'blackjack':
        return { 0: 'Hit', 1: 'Stand', 2: 'Double', 3: 'Split', 4: 'Insurance' };
      case 'tictactoe':
        return { 0: '0', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8' };
      case 'prisoners':
        return { 0: 'Cooperate', 1: 'Defect' };
      default:
        return {};
    }
  }, [game, gameType, initialActionLabels]);

  // Create training session
  const createSession = useCallback((cfg) => {
    if (!game) {
      onLog?.('No game selected');
      return null;
    }

    const newSession = new TrainingSession(game, cfg);

    newSession.addEventListener('training:start', () => {
      onLog?.(`Training started: ${cfg.totalEpisodes} episodes`);
    });

    newSession.addEventListener('training:progress', (e) => {
      setStats(e.detail);
    });

    newSession.addEventListener('training:pause', () => {
      onLog?.('Training paused');
    });

    newSession.addEventListener('training:stop', () => {
      onLog?.('Training stopped');
    });

    newSession.addEventListener('training:complete', (e) => {
      setStats(e.detail);
      onLog?.(`Training complete! Final win rate: ${(e.detail.winRate * 100).toFixed(1)}%`);
    });

    newSession.addEventListener('policy:snapshot', () => {
      // Force re-render to update heatmap
      setStats(s => ({ ...s }));
    });

    return newSession;
  }, [game, onLog]);

  // Start training
  const startTraining = useCallback((cfg = config) => {
    // Stop existing session
    if (session) {
      session.stop();
    }

    const newSession = createSession(cfg);
    if (newSession) {
      setSession(newSession);
      setStats(null);
      newSession.start();
    }
  }, [session, config, createSession]);

  // Pause training
  const pauseTraining = useCallback(() => {
    session?.pause();
    setStats(session?.getStats());
  }, [session]);

  // Resume training
  const resumeTraining = useCallback(() => {
    session?.resume();
  }, [session]);

  // Stop training
  const stopTraining = useCallback(() => {
    session?.stop();
    setStats(session?.getStats());
  }, [session]);

  // Export results as JSON
  const exportResults = useCallback(() => {
    if (!session) return;

    const data = session.exportResults();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `training-${gameType}-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
    onLog?.('Training results exported as JSON');
    setShowExportMenu(false);
  }, [session, gameType, onLog]);

  // Export training curves as CSV
  const exportCSV = useCallback(() => {
    if (!stats?.rewardHistory?.length) return;

    const rows = [['Episode', 'Reward', 'MovingAverage']];
    const history = stats.rewardHistory;
    const movingAvg = stats.movingAverage || [];

    history.forEach((reward, i) => {
      rows.push([
        i + 1,
        reward.toFixed(4),
        movingAvg[i] !== undefined ? movingAvg[i].toFixed(4) : ''
      ]);
    });

    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `training-curves-${gameType}-${Date.now()}.csv`;
    a.click();

    URL.revokeObjectURL(url);
    onLog?.('Training curves exported as CSV');
    setShowExportMenu(false);
  }, [stats, gameType, onLog]);

  // Export reward chart as PNG
  const exportPNG = useCallback(() => {
    if (!rewardChartRef.current) {
      onLog?.('Chart not available for export');
      return;
    }

    const canvas = rewardChartRef.current;
    const dataUrl = canvas.toDataURL('image/png');

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `training-chart-${gameType}-${Date.now()}.png`;
    a.click();

    onLog?.('Training chart exported as PNG');
    setShowExportMenu(false);
  }, [gameType, onLog]);

  // Import previous training run
  const handleImport = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);

        // Validate the imported data has required fields
        if (!data.rewardHistory || !Array.isArray(data.rewardHistory)) {
          onLog?.('Invalid training data: missing rewardHistory');
          return;
        }

        // Create a synthetic stats object from imported data
        const importedStats = {
          episode: data.rewardHistory.length,
          totalEpisodes: data.config?.totalEpisodes || data.rewardHistory.length,
          progress: 1,
          rewardHistory: data.rewardHistory,
          movingAverage: data.movingAverage || [],
          actionDistribution: data.actionDistribution || {},
          totalReward: data.rewardHistory.reduce((a, b) => a + b, 0),
          avgReward: data.rewardHistory.slice(-100).reduce((a, b) => a + b, 0) / Math.min(100, data.rewardHistory.length),
          bestReward: Math.max(...data.rewardHistory),
          winRate: data.winRate || 0,
          avgSteps: data.avgSteps || 0,
          stepsStdDev: data.stepsStdDev || 0,
          trajectories: data.trajectories || [],
          convergence: data.convergence || { label: 'Imported', color: '#94a3b8' },
          importedAt: new Date().toISOString(),
          originalFile: file.name
        };

        setImportedRuns(prev => [...prev, importedStats]);
        onLog?.(`Imported training run: ${file.name} (${data.rewardHistory.length} episodes)`);

        // Optionally load as current stats if no session is running
        if (!session || session.status === 'idle' || session.status === 'complete') {
          setStats(importedStats);
          onLog?.('Loaded imported run as current view');
        }
      } catch (err) {
        onLog?.(`Failed to import: ${err.message}`);
      }
    };
    reader.readAsText(file);

    // Reset file input
    e.target.value = '';
  }, [session, onLog]);

  // Clear imported runs
  const clearImportedRuns = useCallback(() => {
    setImportedRuns([]);
    onLog?.('Cleared imported runs');
  }, [onLog]);

  // Switch to imported run view
  const viewImportedRun = useCallback((run) => {
    setStats(run);
    onLog?.(`Viewing imported run from ${run.originalFile}`);
  }, [onLog]);

  // Replay episode
  const replayEpisode = useCallback((trajectory) => {
    onLog?.(`Replaying episode #${trajectory.episode}`);
    // Dispatch event for other components to handle
    window.dispatchEvent(new CustomEvent('training:replay', {
      detail: { trajectory }
    }));
  }, [onLog]);

  // Navigate episodes in detail modal
  const navigateEpisode = useCallback((direction) => {
    const trajectories = stats?.trajectories || [];
    const currentIndex = trajectories.findIndex(t => t.episode === showEpisodeDetail?.episode);
    const newIndex = currentIndex + direction;

    if (newIndex >= 0 && newIndex < trajectories.length) {
      setShowEpisodeDetail(trajectories[newIndex]);
    }
  }, [stats, showEpisodeDetail]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (session?.status === 'running') pauseTraining();
          else if (session?.status === 'paused') resumeTraining();
          break;
        case 'Escape':
          if (showExportMenu) setShowExportMenu(false);
          else if (showConfig) setShowConfig(false);
          else if (showEpisodeDetail) setShowEpisodeDetail(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session, pauseTraining, resumeTraining, showConfig, showEpisodeDetail, showExportMenu]);

  // Close export menu when clicking outside
  useEffect(() => {
    if (!showExportMenu) return;

    const handleClickOutside = (e) => {
      if (!e.target.closest('.export-dropdown')) {
        setShowExportMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showExportMenu]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      session?.stop();
    };
  }, []);

  const status = session?.status || 'idle';

  return html`
    <div class="training-dashboard">
      <div class="dashboard-header">
        <h2>AI Training Dashboard</h2>
        <div class="header-controls">
          ${status === 'idle' || status === 'complete' ? html`
            <button class="btn-train" onClick=${() => startTraining()}>▶ Train</button>
          ` : status === 'running' ? html`
            <button class="btn-pause" onClick=${pauseTraining}>⏸ Pause</button>
          ` : status === 'paused' ? html`
            <button class="btn-resume" onClick=${resumeTraining}>▶ Resume</button>
          ` : null}
          <button
            class="btn-stop"
            onClick=${stopTraining}
            disabled=${status === 'idle'}
          >⏹ Stop</button>
          <button class="btn-config" onClick=${() => setShowConfig(true)} title="Configure">⚙</button>

          <input
            type="file"
            ref=${fileInputRef}
            accept=".json"
            style="display: none"
            onChange=${handleImport}
          />
          <button
            class="btn-import"
            onClick=${() => fileInputRef.current?.click()}
            title="Import training run"
          >📤 Import</button>

          ${stats && html`
            <div class="export-dropdown">
              <button
                class="btn-export"
                onClick=${() => setShowExportMenu(!showExportMenu)}
                title="Export options"
              >📥 Export ▾</button>
              ${showExportMenu && html`
                <div class="export-menu">
                  <button onClick=${exportResults}>Export JSON (full)</button>
                  <button onClick=${exportCSV}>Export CSV (curves)</button>
                  <button onClick=${exportPNG}>Export PNG (chart)</button>
                </div>
              `}
            </div>
          `}
        </div>
      </div>

      ${importedRuns.length > 0 && html`
        <div class="imported-runs-bar">
          <span class="imported-label">Imported Runs:</span>
          ${importedRuns.map((run, i) => html`
            <button
              key=${i}
              class="imported-run-btn ${stats === run ? 'active' : ''}"
              onClick=${() => viewImportedRun(run)}
              title="${run.originalFile}"
            >
              ${run.originalFile?.slice(0, 15) || `Run ${i + 1}`}
              (${run.episode} ep)
            </button>
          `)}
          <button class="btn-clear-imports" onClick=${clearImportedRuns} title="Clear imported runs">✕</button>
        </div>
      `}

      ${stats && html`
        <${ProgressBar}
          progress=${stats.progress}
          episode=${stats.episode}
          total=${stats.totalEpisodes}
          eta=${stats.eta}
          speed=${stats.episodesPerSecond}
          elapsed=${stats.elapsedTime}
          status=${status}
        />

        <div class="dashboard-grid">
          <div class="charts-column">
            <${RewardChart}
              history=${stats.rewardHistory}
              movingAverage=${stats.movingAverage}
              movingAvgWindow=${50}
              onCanvasRef=${(ref) => { rewardChartRef.current = ref; }}
            />
            <${ActionDistribution}
              distribution=${stats.actionDistribution}
              actionLabels=${actionLabels}
            />
          </div>

          <div class="stats-column">
            <${StatsPanel} stats=${stats} />
          </div>
        </div>

        <${EpisodeList}
          trajectories=${stats.trajectories}
          onSelect=${(traj) => setShowEpisodeDetail(traj)}
          onReplay=${replayEpisode}
        />

        ${gameType === 'blackjack' && session?.policySnapshots?.length > 0 && html`
          <${PolicyHeatmap}
            snapshots=${session.policySnapshots}
            gameType=${gameType}
          />
        `}
      `}

      ${!stats && html`
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <p>Configure training parameters and click "Train" to begin.</p>
          <p class="hint">Press <kbd>Space</kbd> to pause/resume during training</p>
          <button class="btn-config-start" onClick=${() => setShowConfig(true)}>
            ⚙ Configure Training
          </button>
        </div>
      `}

      ${showConfig && html`
        <${ConfigModal}
          config=${config}
          onSave=${setConfig}
          onCancel=${() => setShowConfig(false)}
          onStartTraining=${(cfg) => {
            setShowConfig(false);
            startTraining(cfg);
          }}
        />
      `}

      ${showEpisodeDetail && html`
        <${EpisodeDetailModal}
          trajectory=${showEpisodeDetail}
          actionLabels=${actionLabels}
          onClose=${() => setShowEpisodeDetail(null)}
          onPrev=${() => navigateEpisode(-1)}
          onNext=${() => navigateEpisode(1)}
          onReplay=${replayEpisode}
        />
      `}
    </div>
  `;
}

// ============================================================================
// CSS Styles
// ============================================================================

const styles = `
/* Training Dashboard Base */
.training-dashboard {
  background: #0a0a0f;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 16px;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  color: #e2e8f0;
  min-height: 400px;
}

/* Dashboard Header */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #1e293b;
}

.dashboard-header h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
}

.header-controls {
  display: flex;
  gap: 8px;
}

.header-controls button {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-train, .btn-resume {
  background: #22c55e;
  color: white;
}

.btn-train:hover, .btn-resume:hover {
  background: #16a34a;
}

.btn-pause {
  background: #eab308;
  color: black;
}

.btn-pause:hover {
  background: #ca8a04;
}

.btn-stop {
  background: #ef4444;
  color: white;
}

.btn-stop:hover {
  background: #dc2626;
}

.btn-stop:disabled {
  background: #374151;
  color: #6b7280;
  cursor: not-allowed;
}

.btn-config {
  background: #374151;
  color: #e2e8f0;
  width: 32px;
  padding: 6px;
}

.btn-config:hover {
  background: #4b5563;
}

.btn-import {
  background: #374151;
  color: #e2e8f0;
}

.btn-import:hover {
  background: #4b5563;
}

.export-dropdown {
  position: relative;
}

.btn-export {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
  border: 1px solid rgba(74, 222, 128, 0.3);
}

.btn-export:hover {
  background: rgba(74, 222, 128, 0.25);
}

.export-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 4px;
  min-width: 160px;
  z-index: 100;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

.export-menu button {
  display: block;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  color: #e2e8f0;
  text-align: left;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s;
}

.export-menu button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.imported-runs-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(96, 165, 250, 0.1);
  border: 1px solid rgba(96, 165, 250, 0.2);
  border-radius: 6px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.imported-label {
  color: #60a5fa;
  font-size: 11px;
  font-weight: 500;
}

.imported-run-btn {
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #e2e8f0;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
}

.imported-run-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.imported-run-btn.active {
  background: rgba(96, 165, 250, 0.3);
  border-color: #60a5fa;
  color: #60a5fa;
}

.btn-clear-imports {
  padding: 4px 8px;
  background: rgba(248, 113, 113, 0.2);
  border: none;
  border-radius: 4px;
  color: #f87171;
  font-size: 12px;
  cursor: pointer;
  margin-left: auto;
}

.btn-clear-imports:hover {
  background: rgba(248, 113, 113, 0.3);
}

/* Progress Bar */
.training-progress {
  margin-bottom: 16px;
}

.progress-bar {
  height: 8px;
  background: #1e293b;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #4ade80);
  transition: width 0.3s ease;
  border-radius: 4px;
}

.progress-fill.paused {
  background: linear-gradient(90deg, #eab308, #facc15);
}

.progress-fill.complete {
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 11px;
  color: #94a3b8;
}

/* Dashboard Grid */
.dashboard-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

@media (max-width: 800px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

/* Charts */
.chart-container {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  color: #e2e8f0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.chart-title {
  font-weight: 600;
}

.chart-legend {
  display: flex;
  gap: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: #94a3b8;
  text-transform: none;
}

.legend-item.episode::before {
  content: '';
  width: 12px;
  height: 2px;
  background: rgba(74, 222, 128, 0.5);
}

.legend-item.avg::before {
  content: '';
  width: 12px;
  height: 2px;
  background: #60a5fa;
}

.chart-container canvas {
  width: 100%;
  height: 120px;
  border-radius: 4px;
  background: #0a0a0f;
}

.chart-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 11px;
  color: #64748b;
}

/* Action Distribution */
.action-distribution {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  padding: 12px;
}

.action-distribution.empty {
  min-height: 100px;
  display: flex;
  flex-direction: column;
}

.action-distribution .empty-message {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  font-style: italic;
}

.action-bars {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 80px;
  padding-top: 12px;
  gap: 4px;
}

.action-bar-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  max-width: 50px;
}

.action-bar {
  width: 100%;
  max-width: 30px;
  background: linear-gradient(180deg, #60a5fa, #3b82f6);
  border-radius: 2px 2px 0 0;
  transition: height 0.3s ease;
  min-height: 2px;
}

.action-label {
  margin-top: 4px;
  font-size: 10px;
  color: #94a3b8;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.action-value {
  font-size: 10px;
  color: #64748b;
}

/* Stats Panel */
.stats-panel {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  padding: 12px;
  height: fit-content;
}

.stats-header {
  color: #e2e8f0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
  font-weight: 600;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat-item {
  text-align: center;
}

.stat-item.full-width {
  grid-column: 1 / -1;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #e2e8f0;
}

.stat-label {
  font-size: 10px;
  color: #64748b;
  margin-top: 2px;
}

/* Episode List */
.episode-list {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 16px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  color: #e2e8f0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.episode-count {
  font-weight: normal;
  color: #64748b;
  text-transform: none;
}

.list-content {
  max-height: 180px;
  overflow-y: auto;
}

.list-content.empty {
  padding: 20px;
  text-align: center;
  color: #64748b;
  font-style: italic;
}

.episode-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid #1e293b;
  transition: background 0.15s;
}

.episode-item:hover {
  background: rgba(255, 255, 255, 0.02);
}

.episode-item:last-child {
  border-bottom: none;
}

.episode-num {
  color: #64748b;
  width: 50px;
  font-weight: 500;
}

.episode-reward {
  font-weight: 600;
  width: 60px;
}

.episode-reward.win {
  color: #4ade80;
}

.episode-reward.loss {
  color: #f87171;
}

.episode-reward.tie {
  color: #94a3b8;
}

.episode-steps {
  color: #64748b;
  width: 60px;
}

.episode-outcome {
  font-size: 10px;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 3px;
  flex: 1;
}

.episode-outcome.win {
  background: rgba(74, 222, 128, 0.2);
  color: #4ade80;
}

.episode-outcome.loss {
  background: rgba(248, 113, 113, 0.2);
  color: #f87171;
}

.episode-outcome.tie {
  background: rgba(148, 163, 184, 0.2);
  color: #94a3b8;
}

.episode-actions {
  display: flex;
  gap: 4px;
}

.btn-icon {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 3px;
  color: #e2e8f0;
  cursor: pointer;
  font-size: 10px;
  transition: background 0.15s;
}

.btn-icon:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Policy Heatmap */
.policy-heatmap {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  padding: 12px;
}

.heatmap-placeholder {
  padding: 40px;
  text-align: center;
  color: #64748b;
  font-style: italic;
}

.heatmap-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  position: relative;
  padding: 20px 30px;
}

.heatmap-container {
  border: 1px solid #1e293b;
  border-radius: 4px;
}

.heatmap-container canvas {
  display: block;
  border-radius: 4px;
}

.y-axis-label,
.x-axis-label {
  font-size: 10px;
  color: #64748b;
}

.y-axis-label {
  position: absolute;
  left: 0;
  top: 50%;
  transform: rotate(-90deg) translateX(-50%);
  transform-origin: center center;
}

.x-axis-label {
  margin-top: 4px;
}

.snapshot-info {
  font-size: 10px;
  color: #64748b;
  font-weight: normal;
}

.heatmap-legend {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 10px;
  color: #94a3b8;
}

.legend-gradient {
  width: 100px;
  height: 10px;
  background: linear-gradient(90deg, hsl(120, 70%, 45%), hsl(60, 70%, 45%), hsl(0, 70%, 45%));
  border-radius: 2px;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #64748b;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state p {
  margin: 8px 0;
}

.empty-state .hint {
  font-size: 11px;
  color: #475569;
}

.empty-state kbd {
  background: #1e293b;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: inherit;
}

.btn-config-start {
  margin-top: 20px;
  padding: 12px 24px;
  background: #3b82f6;
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-config-start:hover {
  background: #2563eb;
}

/* Modal Base */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal {
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 12px;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #1e293b;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #e2e8f0;
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #64748b;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.btn-close:hover {
  color: #e2e8f0;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #1e293b;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #374151;
  color: #e2e8f0;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-secondary:hover {
  background: #4b5563;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Config Modal */
.config-modal {
  max-width: 500px;
}

.config-section {
  margin-bottom: 24px;
}

.config-section:last-child {
  margin-bottom: 0;
}

.config-section h4 {
  margin: 0 0 12px 0;
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.config-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-grid label {
  display: flex;
  align-items: center;
  gap: 12px;
}

.config-grid label > span {
  min-width: 120px;
  color: #e2e8f0;
}

.config-grid input[type="number"] {
  width: 100px;
  padding: 6px 10px;
  background: #1e293b;
  border: 1px solid #374151;
  border-radius: 4px;
  color: #e2e8f0;
  font-family: inherit;
  font-size: 12px;
}

.config-grid input[type="number"]:focus {
  outline: none;
  border-color: #3b82f6;
}

.config-grid small {
  color: #64748b;
  font-size: 11px;
}

.radio-group {
  flex-direction: column;
  align-items: flex-start !important;
}

.radio-options {
  display: flex;
  gap: 16px;
  margin-top: 4px;
}

.radio-options label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.radio-options input[type="radio"] {
  accent-color: #3b82f6;
}

.config-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.config-checkboxes label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #e2e8f0;
}

.config-checkboxes input[type="checkbox"] {
  accent-color: #3b82f6;
  width: 14px;
  height: 14px;
}

/* Episode Detail Modal */
.episode-detail-modal {
  max-width: 700px;
}

.episode-summary {
  display: flex;
  gap: 24px;
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-item .label {
  font-size: 10px;
  text-transform: uppercase;
  color: #64748b;
}

.summary-item .value {
  font-size: 18px;
  font-weight: 600;
  color: #e2e8f0;
}

.summary-item .value.win {
  color: #4ade80;
}

.summary-item .value.loss {
  color: #f87171;
}

.summary-item .value.tie {
  color: #94a3b8;
}

.initial-state {
  margin-bottom: 20px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
}

.initial-state .label {
  font-size: 10px;
  text-transform: uppercase;
  color: #64748b;
  display: block;
  margin-bottom: 6px;
}

.initial-state code {
  font-size: 11px;
  color: #94a3b8;
  word-break: break-all;
}

.trajectory-table-wrapper {
  overflow-x: auto;
}

.trajectory-table-wrapper h4 {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: #94a3b8;
  text-transform: uppercase;
}

.trajectory-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.trajectory-table th {
  text-align: left;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.3);
  color: #94a3b8;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 10px;
}

.trajectory-table td {
  padding: 8px 12px;
  border-bottom: 1px solid #1e293b;
  color: #e2e8f0;
}

.trajectory-table tr:last-child td {
  border-bottom: none;
}

.step-num {
  color: #64748b;
  font-weight: 500;
}

.step-state code {
  font-size: 10px;
  color: #94a3b8;
  background: rgba(0, 0, 0, 0.3);
  padding: 2px 4px;
  border-radius: 2px;
}

.step-reward.positive {
  color: #4ade80;
}

.step-reward.negative {
  color: #f87171;
}

.step-probs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.step-probs .prob {
  font-size: 10px;
  color: #64748b;
}

.step-probs .prob.selected {
  color: #60a5fa;
  font-weight: 600;
}

/* Scrollbar styling */
.training-dashboard ::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.training-dashboard ::-webkit-scrollbar-track {
  background: transparent;
}

.training-dashboard ::-webkit-scrollbar-thumb {
  background: #374151;
  border-radius: 3px;
}

.training-dashboard ::-webkit-scrollbar-thumb:hover {
  background: #4b5563;
}
`;

// ============================================================================
// Initialization Function
// ============================================================================

export function initTrainingDashboard(container, { game, gameType, actionLabels, onLog } = {}) {
  // Inject styles
  if (!document.getElementById('training-dashboard-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'training-dashboard-styles';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  // Render component
  render(
    html`<${TrainingDashboard}
      game=${game}
      gameType=${gameType}
      actionLabels=${actionLabels}
      onLog=${onLog}
    />`,
    container
  );

  // Return cleanup function
  return () => {
    render(null, container);
  };
}

// Export components for external use
export { TrainingDashboard, TrainingSession };
