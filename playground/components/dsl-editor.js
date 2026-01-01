/**
 * DSL Editor Component
 *
 * A text editor for HyperToken rule DSL with syntax highlighting,
 * error display, and bidirectional conversion to/from JSON rules.
 */

import { h, render } from 'https://esm.sh/preact@10.19.3';
import { useState, useEffect, useRef, useMemo, useCallback } from 'https://esm.sh/preact@10.19.3/hooks';
import htm from 'https://esm.sh/htm@3.1.1';

import { DSLParser } from '../rules/DSLParser.js';
import { DSLGenerator } from '../rules/DSLGenerator.js';

const html = htm.bind(h);

// === Styles ===
const styles = `
  .dsl-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 300px;
    background: #0a0a0f;
  }

  .dsl-editor-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid #1e293b;
    flex-shrink: 0;
  }

  .dsl-status {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 500;
  }

  .dsl-status.valid {
    background: rgba(74, 222, 128, 0.2);
    color: #4ade80;
  }

  .dsl-status.invalid {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .dsl-warnings {
    font-size: 11px;
    color: #fbbf24;
  }

  .dsl-toolbar-actions {
    margin-left: auto;
    display: flex;
    gap: 8px;
  }

  .dsl-toolbar-btn {
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    color: #94a3b8;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .dsl-toolbar-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #e2e8f0;
  }

  .dsl-editor-container {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
  }

  .dsl-gutter {
    width: 44px;
    background: #0f172a;
    border-right: 1px solid #1e293b;
    padding: 8px 0;
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 12px;
    line-height: 20px;
    color: #475569;
    user-select: none;
    overflow: hidden;
    flex-shrink: 0;
  }

  .dsl-gutter-line {
    height: 20px;
    text-align: right;
    padding-right: 8px;
    position: relative;
  }

  .dsl-gutter-line.has-error {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .dsl-error-dot {
    position: absolute;
    left: 4px;
    top: 6px;
    width: 6px;
    height: 6px;
    background: #ef4444;
    border-radius: 50%;
  }

  .dsl-editor-scroll {
    flex: 1;
    position: relative;
    overflow: auto;
  }

  .dsl-code-input,
  .dsl-highlight-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    min-height: 100%;
    padding: 8px 12px;
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 13px;
    line-height: 20px;
    tab-size: 2;
    white-space: pre;
    overflow: visible;
    box-sizing: border-box;
  }

  .dsl-code-input {
    background: transparent;
    color: transparent;
    caret-color: #e2e8f0;
    border: none;
    resize: none;
    outline: none;
    z-index: 1;
    min-width: 100%;
  }

  .dsl-highlight-layer {
    background: #0a0a0f;
    color: #e2e8f0;
    pointer-events: none;
    z-index: 0;
    margin: 0;
  }

  /* Syntax highlighting colors */
  .dsl-highlight-layer .kw { color: #c084fc; font-weight: 600; }  /* Keywords */
  .dsl-highlight-layer .str { color: #4ade80; }                    /* Strings */
  .dsl-highlight-layer .num { color: #fb923c; }                    /* Numbers */
  .dsl-highlight-layer .cmt { color: #475569; font-style: italic; } /* Comments */
  .dsl-highlight-layer .op { color: #60a5fa; }                     /* Operators */
  .dsl-highlight-layer .fn { color: #f472b6; }                     /* Functions/actions */
  .dsl-highlight-layer .field { color: #7dd3fc; }                  /* Field category */
  .dsl-highlight-layer .prop { color: #fbbf24; }                   /* Property */
  .dsl-highlight-layer .bool { color: #f472b6; }                   /* Booleans */

  .dsl-error-panel {
    background: rgba(239, 68, 68, 0.1);
    border-top: 1px solid rgba(239, 68, 68, 0.3);
    max-height: 120px;
    overflow-y: auto;
    flex-shrink: 0;
  }

  .dsl-error-header {
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    color: #ef4444;
    border-bottom: 1px solid rgba(239, 68, 68, 0.2);
  }

  .dsl-error-item {
    padding: 6px 12px;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .dsl-error-item:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .dsl-error-line {
    color: #ef4444;
    font-weight: 500;
    min-width: 60px;
  }

  .dsl-error-msg {
    color: #fca5a5;
  }

  .dsl-warning-panel {
    background: rgba(251, 191, 36, 0.1);
    border-top: 1px solid rgba(251, 191, 36, 0.3);
    max-height: 80px;
    overflow-y: auto;
    flex-shrink: 0;
  }

  .dsl-warning-header {
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    color: #fbbf24;
    border-bottom: 1px solid rgba(251, 191, 36, 0.2);
  }

  .dsl-warning-item {
    padding: 4px 12px;
    font-size: 11px;
    color: #fcd34d;
  }

  .dsl-apply-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    border-top: 1px solid #1e293b;
    background: rgba(0, 0, 0, 0.2);
    flex-shrink: 0;
  }

  .dsl-apply-info {
    font-size: 12px;
    color: #64748b;
  }

  .dsl-apply-btn {
    padding: 8px 16px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .dsl-apply-btn:hover {
    background: #2563eb;
  }

  .dsl-apply-btn:disabled {
    background: #334155;
    color: #64748b;
    cursor: not-allowed;
  }
`;

/**
 * Simple syntax highlighting for DSL
 */
function highlightDSL(code) {
  // Escape HTML first
  let escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Apply highlighting in order of specificity
  return escaped
    // Comments (must be first to avoid highlighting inside comments)
    .replace(/(--.*$)/gm, '<span class="cmt">$1</span>')
    // Strings
    .replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, '<span class="str">"$1"</span>')
    .replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '<span class="str">\'$1\'</span>')
    // Keywords (case insensitive)
    .replace(/\b(RULE|WHEN|THEN|AND|OR|PRIORITY|ONCE)\b/gi,
      '<span class="kw">$1</span>')
    // Booleans
    .replace(/\b(true|false|null)\b/gi, '<span class="bool">$1</span>')
    // Numbers (not inside strings - simplified)
    .replace(/\b(-?\d+(?:\.\d+)?)\b/g, '<span class="num">$1</span>')
    // Action keywords
    .replace(/\b(dispatch|set|call|log)\b/gi, '<span class="fn">$1</span>')
    // Comparators
    .replace(/\b(contains|startsWith|endsWith|isEmpty|isNotEmpty|matches)\b/gi,
      '<span class="op">$1</span>')
    // Operators
    .replace(/(!=|&lt;=|&gt;=|==|=|&lt;|&gt;)/g, '<span class="op">$1</span>')
    // Field categories
    .replace(/\b(action|stack|agent|space|gameState|game|state)\./gi,
      '<span class="field">$1</span>.')
    // Properties after dot
    .replace(/\.(\w+)/g, '.<span class="prop">$1</span>');
}

/**
 * Error gutter component
 */
function ErrorGutter({ errors, lineCount, scrollTop }) {
  const lines = Array.from({ length: lineCount }, (_, i) => i + 1);
  const errorLines = new Set(errors.map(e => e.line));

  return html`
    <div class="dsl-gutter" style="margin-top: ${-scrollTop}px;">
      ${lines.map(num => html`
        <div
          key=${num}
          class="dsl-gutter-line ${errorLines.has(num) ? 'has-error' : ''}"
          title=${errors.find(e => e.line === num)?.message || ''}
        >
          ${errorLines.has(num) && html`<span class="dsl-error-dot" />`}
          ${num}
        </div>
      `)}
    </div>
  `;
}

/**
 * Main DSL Editor component
 */
function DSLEditorComponent({
  rules = [],
  onApply,
  ruleManager
}) {
  const parser = useMemo(() => new DSLParser(), []);
  const generator = useMemo(() => new DSLGenerator(), []);

  const [code, setCode] = useState('');
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [parsedRules, setParsedRules] = useState([]);
  const [isValid, setIsValid] = useState(true);
  const [scrollTop, setScrollTop] = useState(0);
  const [isDirty, setIsDirty] = useState(false);

  const textareaRef = useRef(null);
  const highlightRef = useRef(null);
  const scrollRef = useRef(null);
  const parseTimerRef = useRef(null);

  // Generate DSL from rules on mount or when rules change
  useEffect(() => {
    const generated = generator.generateAll(rules);
    setCode(generated);
    setIsDirty(false);

    // Parse to validate
    const result = parser.parse(generated);
    setErrors(result.errors);
    setWarnings(result.warnings);
    setParsedRules(result.rules);
    setIsValid(result.errors.length === 0);
  }, [rules]);

  // Sync scroll between textarea and highlight layer
  const syncScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollTop(scrollRef.current.scrollTop);
      if (highlightRef.current) {
        highlightRef.current.scrollTop = scrollRef.current.scrollTop;
        highlightRef.current.scrollLeft = scrollRef.current.scrollLeft;
      }
    }
  }, []);

  // Handle text changes with debounced parsing
  const handleChange = useCallback((e) => {
    const newCode = e.target.value;
    setCode(newCode);
    setIsDirty(true);

    // Debounced parsing
    if (parseTimerRef.current) {
      clearTimeout(parseTimerRef.current);
    }

    parseTimerRef.current = setTimeout(() => {
      const result = parser.parse(newCode);
      setErrors(result.errors);
      setWarnings(result.warnings);
      setParsedRules(result.rules);
      setIsValid(result.errors.length === 0);
    }, 300);
  }, [parser]);

  // Handle apply button
  const handleApply = useCallback(() => {
    if (!isValid || parsedRules.length === 0) return;

    if (onApply) {
      onApply(parsedRules);
    }
    setIsDirty(false);
  }, [isValid, parsedRules, onApply]);

  // Handle copy
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
  }, [code]);

  // Handle regenerate
  const handleRegenerate = useCallback(() => {
    const generated = generator.generateAll(rules);
    setCode(generated);
    setIsDirty(false);

    const result = parser.parse(generated);
    setErrors(result.errors);
    setWarnings(result.warnings);
    setParsedRules(result.rules);
    setIsValid(result.errors.length === 0);
  }, [rules, generator, parser]);

  // Jump to error line
  const jumpToLine = useCallback((lineNumber) => {
    if (!textareaRef.current) return;

    const lines = code.split('\n');
    let pos = 0;
    for (let i = 0; i < lineNumber - 1 && i < lines.length; i++) {
      pos += lines[i].length + 1;
    }

    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(pos, pos);

    // Scroll to line
    const lineHeight = 20;
    const targetScroll = (lineNumber - 5) * lineHeight;
    if (scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, targetScroll);
    }
  }, [code]);

  // Handle tab key
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newCode = code.substring(0, start) + '  ' + code.substring(end);
      setCode(newCode);
      setIsDirty(true);

      // Restore cursor position
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = start + 2;
      }, 0);
    }
  }, [code]);

  // Generate highlighted HTML
  const highlightedCode = useMemo(() => {
    return highlightDSL(code) + '\n';
  }, [code]);

  const lineCount = code.split('\n').length;

  return html`
    <div class="dsl-editor">
      <div class="dsl-editor-toolbar">
        <span class="dsl-status ${isValid ? 'valid' : 'invalid'}">
          ${isValid ? '✓ Valid' : `✗ ${errors.length} error${errors.length !== 1 ? 's' : ''}`}
        </span>
        ${warnings.length > 0 && html`
          <span class="dsl-warnings">
            ⚠ ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}
          </span>
        `}
        ${isValid && parsedRules.length > 0 && html`
          <span style="font-size: 11px; color: #64748b;">
            ${parsedRules.length} rule${parsedRules.length !== 1 ? 's' : ''} parsed
          </span>
        `}
        <div class="dsl-toolbar-actions">
          <button class="dsl-toolbar-btn" onClick=${handleCopy} title="Copy DSL to clipboard">
            Copy
          </button>
          <button class="dsl-toolbar-btn" onClick=${handleRegenerate} title="Regenerate from current rules">
            Regenerate
          </button>
        </div>
      </div>

      <div class="dsl-editor-container">
        <${ErrorGutter}
          errors=${errors}
          lineCount=${lineCount}
          scrollTop=${scrollTop}
        />

        <div class="dsl-editor-scroll" ref=${scrollRef} onScroll=${syncScroll}>
          <pre
            class="dsl-highlight-layer"
            ref=${highlightRef}
            dangerouslySetInnerHTML=${{ __html: highlightedCode }}
          />
          <textarea
            ref=${textareaRef}
            class="dsl-code-input"
            value=${code}
            onInput=${handleChange}
            onKeyDown=${handleKeyDown}
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            placeholder="-- Type your rules here or use the form editor"
          />
        </div>
      </div>

      ${errors.length > 0 && html`
        <div class="dsl-error-panel">
          <div class="dsl-error-header">Errors</div>
          ${errors.map((err, i) => html`
            <div
              key=${i}
              class="dsl-error-item"
              onClick=${() => jumpToLine(err.line)}
            >
              <span class="dsl-error-line">Line ${err.line}:</span>
              <span class="dsl-error-msg">${err.message}</span>
            </div>
          `)}
        </div>
      `}

      ${warnings.length > 0 && errors.length === 0 && html`
        <div class="dsl-warning-panel">
          <div class="dsl-warning-header">Warnings</div>
          ${warnings.map((warn, i) => html`
            <div key=${i} class="dsl-warning-item">
              ${warn.line ? `Line ${warn.line}: ` : ''}${warn.message}
            </div>
          `)}
        </div>
      `}

      <div class="dsl-apply-bar">
        <span class="dsl-apply-info">
          ${isDirty
            ? 'Changes not applied'
            : isValid && parsedRules.length > 0
              ? `${parsedRules.length} rule${parsedRules.length !== 1 ? 's' : ''} ready`
              : 'Edit DSL above'
          }
        </span>
        <button
          class="dsl-apply-btn"
          onClick=${handleApply}
          disabled=${!isValid || parsedRules.length === 0}
        >
          Apply Changes
        </button>
      </div>
    </div>
  `;
}

/**
 * Initialize DSL Editor
 */
export function initDSLEditor(container, { rules, onApply, ruleManager }) {
  // Inject styles
  const styleId = 'dsl-editor-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  // Render component
  render(
    html`<${DSLEditorComponent}
      rules=${rules}
      onApply=${onApply}
      ruleManager=${ruleManager}
    />`,
    container
  );

  return {
    destroy: () => {
      render(null, container);
    },
    update: (newProps) => {
      render(
        html`<${DSLEditorComponent}
          rules=${newProps.rules || rules}
          onApply=${newProps.onApply || onApply}
          ruleManager=${newProps.ruleManager || ruleManager}
        />`,
        container
      );
    }
  };
}

export { DSLEditorComponent, highlightDSL };
export default initDSLEditor;
