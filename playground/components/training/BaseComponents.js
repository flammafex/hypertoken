/**
 * BaseComponents.js
 *
 * Core UI primitives for AI Training Dashboards in HyperToken IDE.
 */

import { h } from 'https://esm.sh/preact@10.19.3';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(h);

// ============================================================================
// Utility Functions
// ============================================================================

export function formatDuration(ms) {
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

export function formatNumber(num, decimals = 1) {
  if (num === undefined || num === null || isNaN(num)) return '--';
  if (Math.abs(num) >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (Math.abs(num) >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toFixed(decimals);
}

// ============================================================================
// UI Components
// ============================================================================

export function ProgressBar({ progress, episode, total, eta, speed, elapsed, status }) {
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

export function StatItem({ label, value, color, fullWidth }) {
  return html`
    <div class="stat-item ${fullWidth ? 'full-width' : ''}">
      <div class="stat-value" style=${color ? { color } : {}}>${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  `;
}

export function ActionDistribution({ distribution, actionLabels = {} }) {
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
