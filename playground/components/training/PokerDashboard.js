/**
 * PokerDashboard.js
 *
 * Specialized training dashboard for Texas Hold'em.
 * Focuses on Pot Odds, Bluff Frequency, and Hand Strength analysis.
 */

import { h } from 'https://esm.sh/preact@10.19.3';
import htm from 'https://esm.sh/htm@3.1.1';

import { DashboardWrapper } from './DashboardWrapper.js';
import { RewardChart } from './Charts.js';
import { StatItem, ActionDistribution } from './BaseComponents.js';
import { EpisodeList } from './EpisodeList.js';

const html = htm.bind(h);

export function PokerDashboard(props) {
  return html`
    <${DashboardWrapper} title="Poker Strategy Monitor" ...${props}>
      ${({ stats, session, actionLabels, setShowEpisodeDetail, replayEpisode }) => {
        if (!stats) return html`
          <div class="empty-state">
            <div class="empty-icon">🃏</div>
            <p>Analyze the agent's bluffing behavior and pot management.</p>
          </div>
        `;

        return html`
          <div class="dashboard-grid">
            <div class="charts-column">
              <${RewardChart}
                title="Bankroll Trend"
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
                <div class="stats-header">Poker Metrics</div>
                <div class="stats-grid">
                  <${StatItem} label="Hands" value=${stats.episode.toLocaleString()} />
                  <${StatItem} label="Avg Pot" value=${stats.avgReward.toFixed(2)} />
                  <${StatItem} label="Aggression" value="${( (stats.actionDistribution?.['2'] || 0) + (stats.actionDistribution?.['3'] || 0) ).toFixed(2)}" />
                  <${StatItem} label="Win Rate" value="${(stats.winRate * 100).toFixed(1)}%" />
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
