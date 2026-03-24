/**
 * Modals.js
 *
 * Configuration and detail modals for AI Training.
 */

import { h } from 'https://esm.sh/preact@10.19.3';
import { useState } from 'https://esm.sh/preact@10.19.3/hooks';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(h);

// ============================================================================
// Configuration Modal
// ============================================================================

export function ConfigModal({ config, onSave, onCancel, onStartTraining }) {
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
            </div>
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

export function EpisodeDetailModal({ trajectory, actionLabels, onClose, onPrev, onNext, onReplay }) {
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

          <div class="trajectory-table-wrapper">
            <h4>Trajectory</h4>
            <table class="trajectory-table">
              <thead>
                <tr>
                  <th>Step</th>
                  <th>State</th>
                  <th>Action</th>
                  <th>Reward</th>
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
