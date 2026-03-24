/**
 * CoupDashboard.js
 *
 * Specialized training dashboard for Coup.
 * Focuses on Influence, Role Bluffing, and Coins.
 */

import { h } from 'https://esm.sh/preact@10.19.3';
import htm from 'https://esm.sh/htm@3.1.1';

import { DashboardWrapper } from './DashboardWrapper.js';
import { RewardChart } from './Charts.js';
import { StatItem, ActionDistribution } from './BaseComponents.js';
import { EpisodeList } from './EpisodeList.js';

const html = htm.bind(h);

export function CoupDashboard(props) {
  return html`
    <${DashboardWrapper} title="Coup Court Monitor" ...${props}>
      ${({ stats, session, actionLabels, setShowEpisodeDetail, replayEpisode }) => {
        if (!stats) return html`
          <div class="empty-state">
            <div class="empty-icon">🏰</div>
            <p>Monitor the agent's deceptive strategies and influence management.</p>
          </div>
        `;

        return html`
          <div class="dashboard-grid">
            <div class="charts-column">
              <${RewardChart}
                title="Influence Retention"
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
                  <${StatItem} label="Games" value=${stats.episode.toLocaleString()} />
                  <${StatItem} label="Avg Duration" value="${stats.avgSteps.toFixed(1)} steps" />
                  <${StatItem} label="Win Rate" value="${(stats.winRate * 100).toFixed(1)}%" />
                  <${StatItem} label="Coup Frequency" value="${(stats.actionDistribution?.['Coup'] || 0).toFixed(2)}" />
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
