/**
 * PrisonersDashboard.js
 *
 * Specialized training dashboard for the Prisoner's Dilemma (Prison Experiment).
 * Focuses on social metrics: Cooperation Rate, Trust Trends, and Payoff Analysis.
 */

import { h } from 'https://esm.sh/preact@10.19.3';
import { useMemo } from 'https://esm.sh/preact@10.19.3/hooks';
import htm from 'https://esm.sh/htm@3.1.1';

import { DashboardWrapper } from './DashboardWrapper.js';
import { RewardChart } from './Charts.js';
import { StatItem } from './BaseComponents.js';
import { EpisodeList } from './EpisodeList.js';

const html = htm.bind(h);

export function PrisonersDashboard(props) {
  return html`
    <${DashboardWrapper} title="Prison Experiment Monitor" ...${props}>
      ${({ stats, session, actionLabels, setShowEpisodeDetail, replayEpisode }) => {
        if (!stats) return html`
          <div class="empty-state">
            <div class="empty-icon">🤝</div>
            <p>Monitor the emergence of cooperation in social dilemmas.</p>
          </div>
        `;

        // Calculate specialized social metrics
        const socialMetrics = useMemo(() => {
          const distribution = stats.actionDistribution || {};
          const coopRate = distribution['0'] || 0; // Action 0 is Cooperate
          const defectRate = distribution['1'] || 0; // Action 1 is Defect

          // Trust trend: cooperation rate over time (calculated from moving average of action 0)
          // For now, we use the aggregate, but in a real app we'd track this per-episode
          return { coopRate, defectRate };
        }, [stats.actionDistribution]);

        return html`
          <div class="dashboard-grid">
            <div class="charts-column">
              <!-- Trust Chart: Shows the Cooperation Rate trend -->
              <${RewardChart}
                title="Cooperation Trend (Trust)"
                history=${stats.rewardHistory.map(r => (r + 1) / 4)} 
                movingAverage=${stats.movingAverage.map(r => (r + 1) / 4)}
              />
              
              <div class="action-distribution">
                <div class="chart-header">Strategy Distribution</div>
                <div class="action-bars">
                   <div class="action-bar-container">
                    <div
                      class="action-bar"
                      style="height: ${socialMetrics.coopRate * 100}%; background: #4ade80;"
                      title="${(socialMetrics.coopRate * 100).toFixed(1)}%"
                    />
                    <div class="action-label">Cooperate</div>
                    <div class="action-value">${(socialMetrics.coopRate * 100).toFixed(0)}%</div>
                  </div>
                   <div class="action-bar-container">
                    <div
                      class="action-bar"
                      style="height: ${socialMetrics.defectRate * 100}%; background: #f87171;"
                      title="${(socialMetrics.defectRate * 100).toFixed(1)}%"
                    />
                    <div class="action-label">Defect</div>
                    <div class="action-value">${(socialMetrics.defectRate * 100).toFixed(0)}%</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="stats-column">
              <div class="stats-panel">
                <div class="stats-header">Social Metrics</div>
                <div class="stats-grid">
                  <${StatItem} 
                    label="Cooperation Index" 
                    value="${(socialMetrics.coopRate * 100).toFixed(1)}%" 
                    color=${socialMetrics.coopRate > 0.5 ? '#4ade80' : '#f87171'}
                  />
                  <${StatItem} 
                    label="Social Equilibrium" 
                    value=${socialMetrics.coopRate > 0.8 ? 'Altruistic' : socialMetrics.coopRate > 0.4 ? 'Tit-for-Tat' : 'Cynical'} 
                  />
                  <${StatItem} label="Total Rounds" value=${stats.episode.toLocaleString()} />
                  <${StatItem} label="Avg Payoff" value=${stats.avgReward.toFixed(2)} />
                </div>
              </div>

              <div class="payoff-matrix-preview">
                <div class="stats-header">Payoff Matrix</div>
                <div class="pd-matrix small">
                  <div class="pd-cell pd-header"></div>
                  <div class="pd-cell pd-header">C</div>
                  <div class="pd-cell pd-header">D</div>
                  <div class="pd-cell pd-header">C</div>
                  <div class="pd-cell pd-highlight">3, 3</div>
                  <div class="pd-cell">0, 5</div>
                  <div class="pd-cell pd-header">D</div>
                  <div class="pd-cell">5, 0</div>
                  <div class="pd-cell">1, 1</div>
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
