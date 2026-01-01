/**
 * Rule Composer Component
 *
 * Form-based UI for creating and editing rules in the HyperToken playground.
 * Uses Preact + HTM for rendering without a build step.
 */

import { h, render } from 'https://esm.sh/preact@10.19.3';
import { useState, useEffect, useRef, useCallback } from 'https://esm.sh/preact@10.19.3/hooks';
import htm from 'https://esm.sh/htm@3.1.1';

import {
  RuleManager,
  CONDITION_TYPES,
  COMPARATORS,
  COMPARATOR_LABELS,
  ACTION_TYPES,
  createCondition,
  createAction,
  createRule
} from '../rules/RuleManager.js';

import { DSLEditorComponent } from './dsl-editor.js';

const html = htm.bind(h);

// === Styles ===
const styles = `
  .rule-composer {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #0a0a0f;
    color: #e2e8f0;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
  }

  .rule-composer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: rgba(30, 41, 59, 0.5);
    border-bottom: 1px solid #1e293b;
    flex-shrink: 0;
  }

  .rule-composer-title {
    font-size: 14px;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .rule-composer-actions {
    display: flex;
    gap: 8px;
  }

  .btn {
    padding: 6px 12px;
    font-size: 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
    font-weight: 500;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    border: 1px solid #1e293b;
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #e2e8f0;
  }

  .btn-danger {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .btn-danger:hover {
    background: rgba(239, 68, 68, 0.3);
  }

  .btn-sm {
    padding: 4px 8px;
    font-size: 11px;
  }

  .btn-icon {
    padding: 4px;
    min-width: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Rule List */
  .rule-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .rule-list-empty {
    text-align: center;
    padding: 40px 20px;
    color: #64748b;
  }

  .rule-list-empty-icon {
    font-size: 32px;
    margin-bottom: 12px;
    opacity: 0.5;
  }

  .rule-card {
    background: rgba(30, 41, 59, 0.3);
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .rule-card:hover {
    background: rgba(30, 41, 59, 0.5);
    border-color: #334155;
  }

  .rule-card.disabled {
    opacity: 0.5;
  }

  .rule-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .rule-card-name {
    font-weight: 600;
    color: #e2e8f0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .rule-card-toggle {
    width: 36px;
    height: 20px;
    background: #334155;
    border-radius: 10px;
    position: relative;
    cursor: pointer;
    transition: background 0.2s;
  }

  .rule-card-toggle.enabled {
    background: #22c55e;
  }

  .rule-card-toggle::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
  }

  .rule-card-toggle.enabled::after {
    transform: translateX(16px);
  }

  .rule-card-meta {
    display: flex;
    gap: 12px;
    font-size: 11px;
    color: #64748b;
  }

  .rule-card-meta span {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .rule-card-actions {
    display: flex;
    gap: 4px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #1e293b;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .modal {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 12px;
    width: 100%;
    max-width: 900px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #1e293b;
  }

  .modal-title {
    font-size: 16px;
    font-weight: 600;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid #1e293b;
  }

  /* Form Elements */
  .form-group {
    margin-bottom: 16px;
  }

  .form-label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: #94a3b8;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .form-input {
    width: 100%;
    padding: 8px 12px;
    font-size: 13px;
    background: rgba(30, 41, 59, 0.5);
    border: 1px solid #334155;
    border-radius: 6px;
    color: #e2e8f0;
    transition: border-color 0.15s;
  }

  .form-input:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .form-input::placeholder {
    color: #64748b;
  }

  .form-select {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    padding-right: 32px;
  }

  .form-row {
    display: flex;
    gap: 12px;
  }

  .form-row > * {
    flex: 1;
  }

  .form-textarea {
    min-height: 80px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 12px;
    resize: vertical;
  }

  .form-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .form-checkbox input {
    width: 16px;
    height: 16px;
    accent-color: #3b82f6;
  }

  /* Sections */
  .section {
    margin-bottom: 24px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Condition Builder */
  .condition-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .condition-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 12px;
    background: rgba(30, 41, 59, 0.3);
    border: 1px solid #1e293b;
    border-radius: 6px;
  }

  .condition-fields {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .condition-fields .form-input,
  .condition-fields .form-select {
    width: auto;
    min-width: 120px;
  }

  .condition-logic {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
  }

  .condition-logic-btn {
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .condition-logic-btn.active {
    background: #3b82f6;
    color: white;
  }

  .condition-logic-btn:not(.active) {
    background: rgba(255, 255, 255, 0.05);
    color: #64748b;
    border: 1px solid #334155;
  }

  /* Action Builder */
  .action-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .action-item {
    padding: 12px;
    background: rgba(30, 41, 59, 0.3);
    border: 1px solid #1e293b;
    border-radius: 6px;
  }

  .action-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .action-fields {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Code Preview */
  .code-preview {
    background: #0d1117;
    border: 1px solid #1e293b;
    border-radius: 6px;
    padding: 16px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 12px;
    line-height: 1.5;
    overflow-x: auto;
    white-space: pre;
    color: #c9d1d9;
  }

  .code-preview .keyword {
    color: #ff7b72;
  }

  .code-preview .string {
    color: #a5d6ff;
  }

  .code-preview .template {
    color: #a5d6ff;
  }

  .code-preview .comment {
    color: #8b949e;
    font-style: italic;
  }

  .code-preview .boolean {
    color: #79c0ff;
  }

  .code-preview .number {
    color: #79c0ff;
  }

  .code-preview .function {
    color: #d2a8ff;
  }

  .code-preview .property {
    color: #7ee787;
  }

  .code-preview .operator {
    color: #ff7b72;
  }

  .code-preview .punctuation {
    color: #8b949e;
  }

  .btn.copied {
    background: rgba(74, 222, 128, 0.2) !important;
    border-color: rgba(74, 222, 128, 0.4) !important;
    color: #4ade80 !important;
  }

  /* Tabs */
  .tabs {
    display: flex;
    gap: 4px;
    padding: 0 0 12px 0;
    border-bottom: 1px solid #1e293b;
    margin-bottom: 16px;
  }

  .tab {
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    color: #64748b;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .tab:hover {
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.05);
  }

  .tab.active {
    color: #e2e8f0;
    background: rgba(59, 130, 246, 0.2);
  }

  /* Presets */
  .preset-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 8px;
    margin-bottom: 16px;
  }

  .preset-card {
    padding: 12px;
    background: rgba(30, 41, 59, 0.3);
    border: 1px solid #1e293b;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .preset-card:hover {
    background: rgba(30, 41, 59, 0.5);
    border-color: #3b82f6;
  }

  .preset-card-name {
    font-weight: 600;
    margin-bottom: 4px;
  }

  .preset-card-desc {
    font-size: 11px;
    color: #64748b;
  }

  /* Mode Toggle */
  .mode-toggle {
    display: flex;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid #1e293b;
  }

  .mode-toggle-btn {
    padding: 6px 14px;
    background: transparent;
    border: none;
    color: #64748b;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .mode-toggle-btn:hover:not(.active) {
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.05);
  }

  .mode-toggle-btn.active {
    background: #334155;
    color: #e2e8f0;
  }

  .rule-composer-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .rule-composer-body.form-mode {
    overflow-y: auto;
  }
`;

// === Preset Rules ===
const RULE_PRESETS = [
  {
    name: 'Blackjack Stand on 17',
    description: 'AI stands when hand value is 17 or higher',
    rule: {
      name: 'Stand on 17+',
      description: 'Conservative blackjack strategy',
      conditions: [
        { type: 'gameState', field: 'handValue', comparator: 'greaterOrEqual', value: '17' }
      ],
      actions: [
        { type: 'dispatch', actionType: 'STAND', payload: {} }
      ]
    }
  },
  {
    name: 'Blackjack Hit on Low',
    description: 'AI hits when hand value is 11 or lower',
    rule: {
      name: 'Hit on Low Hand',
      description: 'Always hit on 11 or below',
      conditions: [
        { type: 'gameState', field: 'handValue', comparator: 'lessOrEqual', value: '11' }
      ],
      actions: [
        { type: 'dispatch', actionType: 'HIT', payload: {} }
      ]
    }
  },
  {
    name: 'Tic-Tac-Toe Center First',
    description: 'Take center square if available',
    rule: {
      name: 'Center First',
      description: 'Classic opening strategy',
      conditions: [
        { type: 'gameState', field: 'board[4]', comparator: 'equals', value: 'null' }
      ],
      actions: [
        { type: 'dispatch', actionType: 'MOVE', payload: { position: 4 } }
      ]
    }
  },
  {
    name: 'Log All Actions',
    description: 'Log every action for debugging',
    rule: {
      name: 'Debug Logger',
      description: 'Logs all dispatched actions',
      conditions: [
        { type: 'custom', customCode: 'action != null' }
      ],
      actions: [
        { type: 'log', message: 'Action dispatched:' }
      ]
    }
  }
];

// === Sub-Components ===

function ConditionBuilder({ conditions, logic, onChange, onLogicChange }) {
  const addCondition = () => {
    onChange([...conditions, createCondition()]);
  };

  const updateCondition = (index, updates) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    onChange(newConditions);
  };

  const removeCondition = (index) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  return html`
    <div class="section">
      <div class="section-header">
        <span class="section-title">Conditions</span>
        <button class="btn btn-secondary btn-sm" onClick=${addCondition}>+ Add</button>
      </div>

      ${conditions.length > 1 && html`
        <div class="condition-logic">
          <span style="color: #64748b; font-size: 12px;">Match:</span>
          <button
            class="condition-logic-btn ${logic === 'AND' ? 'active' : ''}"
            onClick=${() => onLogicChange('AND')}
          >ALL (AND)</button>
          <button
            class="condition-logic-btn ${logic === 'OR' ? 'active' : ''}"
            onClick=${() => onLogicChange('OR')}
          >ANY (OR)</button>
        </div>
      `}

      <div class="condition-list">
        ${conditions.map((cond, index) => html`
          <div class="condition-item" key=${cond.id}>
            <div class="condition-fields">
              <select
                class="form-input form-select"
                value=${cond.type}
                onChange=${(e) => updateCondition(index, { type: e.target.value })}
              >
                <option value="action">Action</option>
                <option value="stack">Stack</option>
                <option value="agent">Agent</option>
                <option value="space">Space</option>
                <option value="gameState">Game State</option>
                <option value="custom">Custom</option>
              </select>

              ${cond.type !== 'custom' ? html`
                <input
                  class="form-input"
                  type="text"
                  placeholder="field (e.g., type, value)"
                  value=${cond.field}
                  onChange=${(e) => updateCondition(index, { field: e.target.value })}
                />

                <select
                  class="form-input form-select"
                  value=${cond.comparator}
                  onChange=${(e) => updateCondition(index, { comparator: e.target.value })}
                >
                  ${Object.entries(COMPARATOR_LABELS).map(([key, label]) => html`
                    <option value=${key}>${label}</option>
                  `)}
                </select>

                ${!['exists', 'notExists'].includes(cond.comparator) && html`
                  <input
                    class="form-input"
                    type="text"
                    placeholder="value"
                    value=${cond.value}
                    onChange=${(e) => updateCondition(index, { value: e.target.value })}
                  />
                `}
              ` : html`
                <input
                  class="form-input"
                  type="text"
                  placeholder="JavaScript expression"
                  value=${cond.customCode}
                  style="flex: 1; min-width: 300px;"
                  onChange=${(e) => updateCondition(index, { customCode: e.target.value })}
                />
              `}
            </div>

            <button
              class="btn btn-danger btn-icon btn-sm"
              onClick=${() => removeCondition(index)}
              title="Remove condition"
            >×</button>
          </div>
        `)}

        ${conditions.length === 0 && html`
          <div style="text-align: center; padding: 20px; color: #64748b;">
            No conditions. Rule will always match.
          </div>
        `}
      </div>
    </div>
  `;
}

function ActionBuilder({ actions, onChange }) {
  const addAction = () => {
    onChange([...actions, createAction()]);
  };

  const updateAction = (index, updates) => {
    const newActions = [...actions];
    newActions[index] = { ...newActions[index], ...updates };
    onChange(newActions);
  };

  const removeAction = (index) => {
    onChange(actions.filter((_, i) => i !== index));
  };

  const updatePayload = (index, key, value) => {
    const newActions = [...actions];
    const payload = { ...newActions[index].payload };
    if (value === '') {
      delete payload[key];
    } else {
      payload[key] = value;
    }
    newActions[index] = { ...newActions[index], payload };
    onChange(newActions);
  };

  return html`
    <div class="section">
      <div class="section-header">
        <span class="section-title">Actions</span>
        <button class="btn btn-secondary btn-sm" onClick=${addAction}>+ Add</button>
      </div>

      <div class="action-list">
        ${actions.map((action, index) => html`
          <div class="action-item" key=${action.id}>
            <div class="action-header">
              <select
                class="form-input form-select"
                style="width: auto; min-width: 150px;"
                value=${action.type}
                onChange=${(e) => updateAction(index, { type: e.target.value })}
              >
                <option value="dispatch">Dispatch Action</option>
                <option value="setProperty">Set Property</option>
                <option value="callMethod">Call Method</option>
                <option value="log">Log Message</option>
                <option value="custom">Custom Code</option>
              </select>

              <button
                class="btn btn-danger btn-icon btn-sm"
                onClick=${() => removeAction(index)}
                title="Remove action"
              >×</button>
            </div>

            <div class="action-fields">
              ${action.type === 'dispatch' && html`
                <div class="form-row">
                  <div>
                    <label class="form-label">Action Type</label>
                    <input
                      class="form-input"
                      type="text"
                      placeholder="e.g., HIT, STAND, MOVE"
                      value=${action.actionType}
                      onChange=${(e) => updateAction(index, { actionType: e.target.value })}
                    />
                  </div>
                  <div>
                    <label class="form-label">Payload (JSON)</label>
                    <input
                      class="form-input"
                      type="text"
                      placeholder='e.g., {"position": 4}'
                      value=${JSON.stringify(action.payload || {})}
                      onChange=${(e) => {
                        try {
                          const payload = JSON.parse(e.target.value || '{}');
                          updateAction(index, { payload });
                        } catch {}
                      }}
                    />
                  </div>
                </div>
              `}

              ${action.type === 'setProperty' && html`
                <div class="form-row">
                  <div>
                    <label class="form-label">Property Path</label>
                    <input
                      class="form-input"
                      type="text"
                      placeholder="e.g., score, player.health"
                      value=${action.property}
                      onChange=${(e) => updateAction(index, { property: e.target.value })}
                    />
                  </div>
                  <div>
                    <label class="form-label">Value</label>
                    <input
                      class="form-input"
                      type="text"
                      placeholder="e.g., 100, true, 'active'"
                      value=${action.value}
                      onChange=${(e) => updateAction(index, { value: e.target.value })}
                    />
                  </div>
                </div>
              `}

              ${action.type === 'callMethod' && html`
                <div class="form-row">
                  <div>
                    <label class="form-label">Method</label>
                    <input
                      class="form-input"
                      type="text"
                      placeholder="e.g., agent.move, dispatch"
                      value=${action.method}
                      onChange=${(e) => updateAction(index, { method: e.target.value })}
                    />
                  </div>
                  <div>
                    <label class="form-label">Arguments (comma-separated)</label>
                    <input
                      class="form-input"
                      type="text"
                      placeholder="e.g., 'up', 5"
                      value=${(action.args || []).join(', ')}
                      onChange=${(e) => updateAction(index, {
                        args: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      })}
                    />
                  </div>
                </div>
              `}

              ${action.type === 'log' && html`
                <div>
                  <label class="form-label">Message</label>
                  <input
                    class="form-input"
                    type="text"
                    placeholder="Log message..."
                    value=${action.message}
                    onChange=${(e) => updateAction(index, { message: e.target.value })}
                  />
                </div>
              `}

              ${action.type === 'custom' && html`
                <div>
                  <label class="form-label">Custom JavaScript</label>
                  <textarea
                    class="form-input form-textarea"
                    placeholder="// Your code here..."
                    value=${action.customCode}
                    onChange=${(e) => updateAction(index, { customCode: e.target.value })}
                  />
                </div>
              `}
            </div>
          </div>
        `)}

        ${actions.length === 0 && html`
          <div style="text-align: center; padding: 20px; color: #64748b;">
            No actions. Add at least one action.
          </div>
        `}
      </div>
    </div>
  `;
}

function CodePreview({ rule, ruleManager }) {
  const code = ruleManager.generateCode(rule);

  // Enhanced syntax highlighting with more token types
  const highlightedCode = useMemo(() => {
    let result = code
      // Escape HTML first
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Apply highlighting in order (most specific first)
    result = result
      // Comments
      .replace(/(\/\/.*)/g, '<span class="comment">$1</span>')
      // Strings (single and double quotes)
      .replace(/'([^'\\]|\\.)*'/g, '<span class="string">$&</span>')
      .replace(/"([^"\\]|\\.)*"/g, '<span class="string">$&</span>')
      // Template literals
      .replace(/`([^`\\]|\\.)*`/g, '<span class="template">$&</span>')
      // Keywords
      .replace(/\b(const|let|var|return|if|else|function|async|await|new|this|throw|try|catch|finally)\b/g, '<span class="keyword">$1</span>')
      // Boolean and null
      .replace(/\b(true|false|null|undefined)\b/g, '<span class="boolean">$1</span>')
      // Numbers
      .replace(/\b(\d+\.?\d*)\b/g, '<span class="number">$1</span>')
      // Function calls
      .replace(/\b([a-zA-Z_$][\w$]*)\s*\(/g, '<span class="function">$1</span>(')
      // Properties after dot
      .replace(/\.([a-zA-Z_$][\w$]*)/g, '.<span class="property">$1</span>')
      // Arrow functions
      .replace(/=&gt;/g, '<span class="operator">=&gt;</span>')
      // Operators
      .replace(/(\{|\}|\[|\]|===|!==|==|!=|&amp;&amp;|\|\||\.\.\.)/g, '<span class="punctuation">$1</span>');

    return result;
  }, [code]);

  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [code]);

  return html`
    <div class="section">
      <div class="section-header">
        <span class="section-title">Generated Code</span>
        <button
          class="btn btn-secondary btn-sm ${copied ? 'copied' : ''}"
          onClick=${handleCopy}
        >${copied ? 'Copied!' : 'Copy'}</button>
      </div>
      <pre class="code-preview" dangerouslySetInnerHTML=${{ __html: highlightedCode }}></pre>
    </div>
  `;
}

function RuleEditor({ rule, ruleManager, onSave, onClose }) {
  const [editedRule, setEditedRule] = useState({ ...rule });
  const [activeTab, setActiveTab] = useState('conditions');

  const updateRule = (updates) => {
    setEditedRule({ ...editedRule, ...updates });
  };

  const handleSave = () => {
    onSave(editedRule);
  };

  return html`
    <div class="modal-overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Edit Rule</span>
          <button class="btn btn-secondary btn-icon" onClick=${onClose}>×</button>
        </div>

        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Rule Name</label>
              <input
                class="form-input"
                type="text"
                placeholder="My Rule"
                value=${editedRule.name}
                onChange=${(e) => updateRule({ name: e.target.value })}
              />
            </div>
            <div class="form-group" style="max-width: 100px;">
              <label class="form-label">Priority</label>
              <input
                class="form-input"
                type="number"
                value=${editedRule.priority}
                onChange=${(e) => updateRule({ priority: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Description</label>
            <input
              class="form-input"
              type="text"
              placeholder="What does this rule do?"
              value=${editedRule.description}
              onChange=${(e) => updateRule({ description: e.target.value })}
            />
          </div>

          <div class="form-group">
            <label class="form-checkbox">
              <input
                type="checkbox"
                checked=${editedRule.once}
                onChange=${(e) => updateRule({ once: e.target.checked })}
              />
              <span>Run only once (disable after first match)</span>
            </label>
          </div>

          <div class="tabs">
            <button
              class="tab ${activeTab === 'conditions' ? 'active' : ''}"
              onClick=${() => setActiveTab('conditions')}
            >Conditions</button>
            <button
              class="tab ${activeTab === 'actions' ? 'active' : ''}"
              onClick=${() => setActiveTab('actions')}
            >Actions</button>
            <button
              class="tab ${activeTab === 'preview' ? 'active' : ''}"
              onClick=${() => setActiveTab('preview')}
            >Code Preview</button>
          </div>

          ${activeTab === 'conditions' && html`
            <${ConditionBuilder}
              conditions=${editedRule.conditions}
              logic=${editedRule.conditionLogic}
              onChange=${(conditions) => updateRule({ conditions })}
              onLogicChange=${(logic) => updateRule({ conditionLogic: logic })}
            />
          `}

          ${activeTab === 'actions' && html`
            <${ActionBuilder}
              actions=${editedRule.actions}
              onChange=${(actions) => updateRule({ actions })}
            />
          `}

          ${activeTab === 'preview' && html`
            <${CodePreview} rule=${editedRule} ruleManager=${ruleManager} />
          `}
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" onClick=${onClose}>Cancel</button>
          <button class="btn btn-primary" onClick=${handleSave}>Save Rule</button>
        </div>
      </div>
    </div>
  `;
}

function PresetsModal({ ruleManager, onClose }) {
  const applyPreset = (preset) => {
    const rule = createRule(preset.rule.name);
    rule.description = preset.rule.description;
    rule.conditions = preset.rule.conditions.map(c => ({
      ...createCondition(c.type),
      ...c
    }));
    rule.actions = preset.rule.actions.map(a => ({
      ...createAction(a.type),
      ...a
    }));
    ruleManager.addRule(rule);
    onClose();
  };

  return html`
    <div class="modal-overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal" style="max-width: 600px;">
        <div class="modal-header">
          <span class="modal-title">Rule Presets</span>
          <button class="btn btn-secondary btn-icon" onClick=${onClose}>×</button>
        </div>

        <div class="modal-body">
          <p style="color: #64748b; margin-bottom: 16px;">
            Choose a preset to quickly add a common rule pattern:
          </p>

          <div class="preset-list">
            ${RULE_PRESETS.map(preset => html`
              <div class="preset-card" onClick=${() => applyPreset(preset)}>
                <div class="preset-card-name">${preset.name}</div>
                <div class="preset-card-desc">${preset.description}</div>
              </div>
            `)}
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" onClick=${onClose}>Close</button>
        </div>
      </div>
    </div>
  `;
}

// === Main Component ===

function RuleComposer({ ruleManager }) {
  const [rules, setRules] = useState([]);
  const [editingRule, setEditingRule] = useState(null);
  const [showPresets, setShowPresets] = useState(false);
  const [mode, setMode] = useState('form'); // 'form' | 'dsl'

  // Refresh rules from manager
  const refreshRules = useCallback(() => {
    setRules(ruleManager.getRules());
  }, [ruleManager]);

  useEffect(() => {
    refreshRules();

    // Listen for rule changes
    const handleChange = () => refreshRules();
    ruleManager.addEventListener('rule:added', handleChange);
    ruleManager.addEventListener('rule:updated', handleChange);
    ruleManager.addEventListener('rule:deleted', handleChange);
    ruleManager.addEventListener('rules:cleared', handleChange);

    return () => {
      ruleManager.removeEventListener('rule:added', handleChange);
      ruleManager.removeEventListener('rule:updated', handleChange);
      ruleManager.removeEventListener('rule:deleted', handleChange);
      ruleManager.removeEventListener('rules:cleared', handleChange);
    };
  }, [ruleManager, refreshRules]);

  const handleNewRule = () => {
    const rule = ruleManager.addRule();
    setEditingRule(rule);
  };

  const handleEditRule = (rule) => {
    setEditingRule({ ...rule });
  };

  const handleSaveRule = (rule) => {
    if (ruleManager.getRule(rule.id)) {
      ruleManager.updateRule(rule.id, rule);
    } else {
      ruleManager.addRule(rule);
    }
    setEditingRule(null);
  };

  const handleDeleteRule = (id, e) => {
    e.stopPropagation();
    if (confirm('Delete this rule?')) {
      ruleManager.deleteRule(id);
    }
  };

  const handleDuplicateRule = (id, e) => {
    e.stopPropagation();
    ruleManager.duplicateRule(id);
  };

  const handleToggleRule = (id, e) => {
    e.stopPropagation();
    ruleManager.toggleRule(id);
  };

  const handleExport = () => {
    const json = ruleManager.exportRules();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hypertoken-rules.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        const text = await file.text();
        const count = ruleManager.importRules(text);
        if (count > 0) {
          alert(`Imported ${count} rule(s)`);
        } else {
          alert('Failed to import rules');
        }
      }
    };
    input.click();
  };

  // Handle applying rules from DSL editor
  const handleApplyDSL = useCallback((parsedRules) => {
    if (!parsedRules || parsedRules.length === 0) return;

    // Clear existing rules and add parsed ones
    ruleManager.clearAll();
    for (const rule of parsedRules) {
      ruleManager.addRule(rule);
    }
  }, [ruleManager]);

  return html`
    <div class="rule-composer">
      <div class="rule-composer-header">
        <span class="rule-composer-title">Rule Composer</span>

        <div class="mode-toggle">
          <button
            class="mode-toggle-btn ${mode === 'form' ? 'active' : ''}"
            onClick=${() => setMode('form')}
          >Form</button>
          <button
            class="mode-toggle-btn ${mode === 'dsl' ? 'active' : ''}"
            onClick=${() => setMode('dsl')}
          >DSL</button>
        </div>

        <div class="rule-composer-actions">
          ${mode === 'form' && html`
            <button class="btn btn-secondary btn-sm" onClick=${() => setShowPresets(true)}>Presets</button>
            <button class="btn btn-secondary btn-sm" onClick=${handleImport}>Import</button>
            <button class="btn btn-secondary btn-sm" onClick=${handleExport}>Export</button>
            <button class="btn btn-primary btn-sm" onClick=${handleNewRule}>+ New</button>
          `}
        </div>
      </div>

      ${mode === 'form' && html`
      <div class="rule-list">
        ${rules.length === 0 ? html`
          <div class="rule-list-empty">
            <div class="rule-list-empty-icon">📋</div>
            <p>No rules yet</p>
            <p style="font-size: 12px; margin-top: 8px;">
              Create a new rule or choose from presets to get started.
            </p>
          </div>
        ` : rules.map(rule => html`
          <div
            class="rule-card ${!rule.enabled ? 'disabled' : ''}"
            key=${rule.id}
            onClick=${() => handleEditRule(rule)}
          >
            <div class="rule-card-header">
              <span class="rule-card-name">
                ${rule.name}
                ${rule.once && html`<span style="font-size: 10px; color: #f59e0b;">(once)</span>`}
              </span>
              <div
                class="rule-card-toggle ${rule.enabled ? 'enabled' : ''}"
                onClick=${(e) => handleToggleRule(rule.id, e)}
              />
            </div>

            ${rule.description && html`
              <p style="color: #64748b; font-size: 12px; margin-bottom: 8px;">
                ${rule.description}
              </p>
            `}

            <div class="rule-card-meta">
              <span>${rule.conditions.length} condition${rule.conditions.length !== 1 ? 's' : ''}</span>
              <span>${rule.actions.length} action${rule.actions.length !== 1 ? 's' : ''}</span>
              ${rule.priority !== 0 && html`<span>Priority: ${rule.priority}</span>`}
            </div>

            <div class="rule-card-actions">
              <button
                class="btn btn-secondary btn-sm"
                onClick=${(e) => handleDuplicateRule(rule.id, e)}
              >Duplicate</button>
              <button
                class="btn btn-danger btn-sm"
                onClick=${(e) => handleDeleteRule(rule.id, e)}
              >Delete</button>
            </div>
          </div>
        `)}
      </div>
      `}

      ${mode === 'dsl' && html`
        <${DSLEditorComponent}
          rules=${rules}
          onApply=${handleApplyDSL}
          ruleManager=${ruleManager}
        />
      `}

      ${editingRule && html`
        <${RuleEditor}
          rule=${editingRule}
          ruleManager=${ruleManager}
          onSave=${handleSaveRule}
          onClose=${() => setEditingRule(null)}
        />
      `}

      ${showPresets && html`
        <${PresetsModal}
          ruleManager=${ruleManager}
          onClose=${() => setShowPresets(false)}
        />
      `}
    </div>
  `;
}

// === Export ===

export function initRuleComposer(container, ruleManager) {
  // Inject styles
  const styleId = 'rule-composer-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  // Render component
  render(html`<${RuleComposer} ruleManager=${ruleManager} />`, container);

  return {
    destroy: () => {
      render(null, container);
    }
  };
}

export { RuleManager };
export default initRuleComposer;
