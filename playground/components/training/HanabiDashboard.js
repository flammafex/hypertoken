/**
 * HanabiDashboard.js
 *
 * Specialized training dashboard for Hanabi.
 * Focuses on Information State (Clues) and Fireworks progress.
 */

import { h } from 'https://esm.sh/preact@10.19.3';
import htm from 'https://esm.sh/htm@3.1.1';

import { DashboardWrapper } from './DashboardWrapper.js';
import { RewardChart } from './Charts.js';
import { StatItem, ActionDistribution } from './BaseComponents.js';
import { EpisodeList } from './EpisodeList.js';

const html = htm.bind(h);

export function HanabiDashboard(props) {
  return html`
    <${DashboardWrapper} title="Hanabi Coordination Monitor" ...${props}>
      ${({ stats, session, actionLabels, setShowEpisodeDetail, replayEpisode }) => {
        if (!stats) return html`
          <div class="empty-state">
            <div class="empty-icon">🎆</div>
            <p>Track team coordination and information sharing efficiency.</p>
          </div>
        `;

        return html`
          <div class="dashboard-grid">
            <div class="charts-column">
              <${RewardChart}
                title="Team Score Trend"
                history=${stats.rewardHistory}
                movingAverage=${stats.movingAverage}
              />
              <${ActionDistribution}
                distribution=${stats.actionDistribution}
                actionLabels=${actionLabels}
              />
            </div>

            <div class="stats-column">
              <div class="stats-panel">
                <div class="stats-header">Team Metrics</div>
                <div class="stats-grid">
                  <${StatItem} label="Sessions" value=${stats.episode.toLocaleString()} />
                  <${StatItem} label="Avg Score" value=${stats.avgScore ? stats.avgScore.toFixed(1) : '--'} />
                  <${StatItem} label="Max Score" value=${stats.bestReward !== undefined ? (stats.bestReward * 25).toFixed(0) : '--'} />
                  <${StatItem} label="Coordination" value="${(1 - (stats.stepsStdDev / 50)).toFixed(2)}" />
                </div>
              </div>
            </div>
          </div>

          <${EpisodeList}
            trajectories=${stats.trajectories}
            onSelect=${setShowEpisodeDetail}
            onReplay=${replayEpisode}
          />
        `;
      }}
    </${DashboardWrapper}>
  `;
}
