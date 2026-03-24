/**
 * LiarsDiceDashboard.js
 *
 * Specialized training dashboard for Liar's Dice.
 * Focuses on Dice Counts, Bid Accuracy, and Bluff detection.
 */

import { h } from 'https://esm.sh/preact@10.19.3';
import htm from 'https://esm.sh/htm@3.1.1';

import { DashboardWrapper } from './DashboardWrapper.js';
import { RewardChart } from './Charts.js';
import { StatItem, ActionDistribution } from './BaseComponents.js';
import { EpisodeList } from './EpisodeList.js';

const html = htm.bind(h);

export function LiarsDiceDashboard(props) {
  return html`
    <${DashboardWrapper} title="Liar's Dice Probability Monitor" ...${props}>
      ${({ stats, session, actionLabels, setShowEpisodeDetail, replayEpisode }) => {
        if (!stats) return html`
          <div class="empty-state">
            <div class="empty-icon">🎲</div>
            <p>Monitor the agent's probability estimation and bluffing tactics.</p>
          </div>
        `;

        return html`
          <div class="dashboard-grid">
            <div class="charts-column">
              <${RewardChart}
                title="Dice Retention"
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
                <div class="stats-header">Game Metrics</div>
                <div class="stats-grid">
                  <${StatItem} label="Matches" value=${stats.episode.toLocaleString()} />
                  <${StatItem} label="Win Rate" value="${(stats.winRate * 100).toFixed(1)}%" />
                  <${StatItem} label="Challenge Rate" value="${(stats.actionDistribution?.['0'] || 0).toFixed(2)}" />
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
