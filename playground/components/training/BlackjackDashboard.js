/**
 * BlackjackDashboard.js
 *
 * Specialized training dashboard for Blackjack.
 * Focuses on Basic Strategy, Bust Rates, and House Edge analysis.
 */

import { h } from 'https://esm.sh/preact@10.19.3';
import htm from 'https://esm.sh/htm@3.1.1';

import { DashboardWrapper } from './DashboardWrapper.js';
import { RewardChart, PolicyHeatmap } from './Charts.js';
import { StatItem, formatNumber } from './BaseComponents.js';
import { EpisodeList } from './EpisodeList.js';

const html = htm.bind(h);

export function BlackjackDashboard(props) {
  return html`
    <${DashboardWrapper} title="Blackjack Strategy Lab" ...${props}>
      ${({ stats, session, actionLabels, setShowEpisodeDetail, replayEpisode }) => {
        if (!stats) return html`
          <div class="empty-state">
            <div class="empty-icon">🃏</div>
            <p>Train an agent to master Basic Strategy and minimize the house edge.</p>
          </div>
        `;

        return html`
          <div class="dashboard-grid">
            <div class="charts-column">
              <${RewardChart}
                title="Profit/Loss Trend"
                history=${stats.rewardHistory}
                movingAverage=${stats.movingAverage}
              />
              
              <${PolicyHeatmap}
                snapshots=${session?.policySnapshots}
                gameType="blackjack"
              />
            </div>

            <div class="stats-column">
              <div class="stats-panel">
                <div class="stats-header">Performance Metrics</div>
                <div class="stats-grid">
                  <${StatItem} label="Hands Played" value=${stats.episode.toLocaleString()} />
                  <${StatItem} 
                    label="Win Rate" 
                    value="${(stats.winRate * 100).toFixed(1)}%" 
                    color=${stats.winRate > 0.42 ? '#4ade80' : '#f87171'}
                  />
                  <${StatItem} 
                    label="House Edge" 
                    value="${((0.5 - stats.winRate) * 100).toFixed(2)}%" 
                  />
                  <${StatItem} label="Best Run" value=${stats.bestReward.toFixed(1)} />
                </div>
              </div>

              <div class="strategy-tips">
                <div class="stats-header">Strategy Insights</div>
                <ul class="tips-list">
                  <li>Target Win Rate: ~42.5% (No side bets)</li>
                  <li>Heatmap: Green = Hit, Red = Stand</li>
                  <li>Monitoring for convergence to Basic Strategy...</li>
                </ul>
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
