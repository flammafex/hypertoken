/**
 * UniversalDashboard.js
 *
 * The default, all-purpose training dashboard implementation.
 */

import { h } from 'https://esm.sh/preact@10.19.3';
import htm from 'https://esm.sh/htm@3.1.1';

import { DashboardWrapper } from './DashboardWrapper.js';
import { RewardChart, PolicyHeatmap } from './Charts.js';
import { ActionDistribution, StatItem, formatNumber } from './BaseComponents.js';
import { EpisodeList } from './EpisodeList.js';

const html = htm.bind(h);

export function UniversalDashboard(props) {
  return html`
    <${DashboardWrapper} ...${props}>
      ${({ stats, session, actionLabels, setShowEpisodeDetail, replayEpisode }) => {
        if (!stats) return html`
          <div class="empty-state">
            <div class="empty-icon">📊</div>
            <p>Configure training parameters and click "Train" to begin.</p>
          </div>
        `;

        return html`
          <div class="dashboard-grid">
            <div class="charts-column">
              <${RewardChart}
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
                <div class="stats-header">Statistics</div>
                <div class="stats-grid">
                  <${StatItem} label="Episodes" value=${stats.episode.toLocaleString()} />
                  <${StatItem} label="Total Reward" value=${formatNumber(stats.totalReward, 0)} />
                  <${StatItem} label="Avg Reward (100)" value=${stats.avgReward.toFixed(2)} />
                  <${StatItem} label="Best Episode" value=${stats.bestReward.toFixed(1)} />
                  <${StatItem} label="Win Rate" value="${(stats.winRate * 100).toFixed(1)}%" />
                  <${StatItem}
                    label="Convergence"
                    value=${stats.convergence?.label || '--'}
                    color=${stats.convergence?.color}
                  />
                  <${StatItem}
                    label="Steps/Episode"
                    value="Mean: ${stats.avgSteps.toFixed(1)} | Std: ${stats.stepsStdDev.toFixed(1)}"
                    fullWidth=${true}
                  />
                </div>
              </div>
            </div>
          </div>

          <${EpisodeList}
            trajectories=${stats.trajectories}
            onSelect=${setShowEpisodeDetail}
            onReplay=${replayEpisode}
          />

          ${props.gameType === 'blackjack' && session?.policySnapshots?.length > 0 && html`
            <${PolicyHeatmap}
              snapshots=${session.policySnapshots}
              gameType=${props.gameType}
            />
          `}
        `;
      }}
    </${DashboardWrapper}>
  `;
}
