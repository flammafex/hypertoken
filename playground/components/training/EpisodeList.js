/**
 * EpisodeList.js
 *
 * A list of recent training episodes with inspection and replay.
 */

import { h } from 'https://esm.sh/preact@10.19.3';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(h);

export function EpisodeList({ trajectories, onSelect, onReplay }) {
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
