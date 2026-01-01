/**
 * State Inspector Component
 *
 * A real-time, collapsible tree view for inspecting HyperToken game state.
 * Built with Preact + HTM for a build-free reactive UI.
 */

import { h, render, Component } from 'https://esm.sh/preact@10.19.3';
import { useState, useEffect, useRef, useCallback, useMemo } from 'https://esm.sh/preact@10.19.3/hooks';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(h);

// === Error Boundary ===

/**
 * ErrorBoundary - Catches render errors and displays fallback UI
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('State Inspector error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return html`
        <div class="inspector-error">
          <div class="inspector-error-icon">⚠️</div>
          <div class="inspector-error-title">State Inspector Error</div>
          <div class="inspector-error-message">${this.state.error?.message || 'An unexpected error occurred'}</div>
          <button
            class="inspector-error-retry"
            onClick=${() => this.setState({ hasError: false, error: null })}
          >
            Retry
          </button>
        </div>
      `;
    }
    return this.props.children;
  }
}

// === Utility Functions ===

/**
 * Get the type of a value for display purposes
 */
function getValueType(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Deep comparison to find changed paths between two objects
 */
function detectChanges(prev, next, path = 'root', changes = new Set()) {
  if (prev === next) return changes;

  const prevType = getValueType(prev);
  const nextType = getValueType(next);

  if (prevType !== nextType) {
    changes.add(path);
    return changes;
  }

  if (nextType === 'object' || nextType === 'array') {
    const prevKeys = prev ? Object.keys(prev) : [];
    const nextKeys = next ? Object.keys(next) : [];
    const allKeys = new Set([...prevKeys, ...nextKeys]);

    for (const key of allKeys) {
      const childPath = `${path}.${key}`;
      const prevVal = prev?.[key];
      const nextVal = next?.[key];

      if (prevVal !== nextVal) {
        if (getValueType(prevVal) === 'object' || getValueType(prevVal) === 'array' ||
            getValueType(nextVal) === 'object' || getValueType(nextVal) === 'array') {
          detectChanges(prevVal, nextVal, childPath, changes);
        } else {
          changes.add(childPath);
        }
      }
    }
  } else if (prev !== next) {
    changes.add(path);
  }

  return changes;
}

/**
 * Format a value for display
 */
function formatValue(value) {
  const type = getValueType(value);

  switch (type) {
    case 'string':
      return `"${value.length > 50 ? value.slice(0, 50) + '...' : value}"`;
    case 'number':
    case 'boolean':
      return String(value);
    case 'null':
      return 'null';
    case 'undefined':
      return 'undefined';
    case 'array':
      return `Array(${value.length})`;
    case 'object':
      return `{${Object.keys(value).length} keys}`;
    default:
      return String(value);
  }
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(value) {
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}

// === Components ===

/**
 * TreeNode - Renders a single node in the state tree
 */
function TreeNode({ name, value, path, expandedPaths, toggleExpand, changedPaths, pinnedPaths, togglePin, depth = 0 }) {
  const type = getValueType(value);
  const isExpandable = type === 'object' || type === 'array';
  const isExpanded = expandedPaths.has(path);
  const isChanged = changedPaths.has(path);
  const isPinned = pinnedPaths?.has(path);
  const [copied, setCopied] = useState(false);

  const handleToggle = useCallback((e) => {
    e.stopPropagation();
    if (isExpandable) {
      toggleExpand(path);
    }
  }, [isExpandable, toggleExpand, path]);

  const handleCopy = useCallback(async (e) => {
    e.stopPropagation();
    const success = await copyToClipboard(value);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    }
  }, [value]);

  const handlePin = useCallback((e) => {
    e.stopPropagation();
    if (togglePin) {
      togglePin(path);
    }
  }, [togglePin, path]);

  // Get children for expandable nodes
  const children = useMemo(() => {
    if (!isExpandable || !isExpanded) return null;

    const entries = Object.entries(value);
    if (entries.length === 0) return html`<div class="tree-empty">empty</div>`;

    return entries.map(([key, val]) => html`
      <${TreeNode}
        key=${key}
        name=${key}
        value=${val}
        path=${`${path}.${key}`}
        expandedPaths=${expandedPaths}
        toggleExpand=${toggleExpand}
        changedPaths=${changedPaths}
        pinnedPaths=${pinnedPaths}
        togglePin=${togglePin}
        depth=${depth + 1}
      />
    `);
  }, [isExpandable, isExpanded, value, path, expandedPaths, toggleExpand, changedPaths, pinnedPaths, togglePin, depth]);

  // Type-specific class for syntax coloring
  const typeClass = `tree-${type}`;

  // Arrow indicator for expandable nodes
  const arrow = isExpandable
    ? html`<span class="tree-arrow ${isExpanded ? 'expanded' : ''}">${isExpanded ? '\u25BC' : '\u25B6'}</span>`
    : html`<span class="tree-arrow-spacer"></span>`;

  // Array length or object key count badge
  const badge = type === 'array'
    ? html`<span class="tree-badge">[${value.length}]</span>`
    : type === 'object'
    ? html`<span class="tree-badge">{${Object.keys(value).length}}</span>`
    : null;

  return html`
    <div class="tree-node ${isChanged ? 'changed' : ''} ${isPinned ? 'pinned' : ''}" style="--depth: ${depth}">
      <div class="tree-row" onClick=${handleToggle}>
        ${arrow}
        <span class="tree-key">${name}</span>
        <span class="tree-colon">:</span>
        ${badge}
        ${!isExpandable || !isExpanded ? html`
          <span class="${typeClass} tree-value">${formatValue(value)}</span>
        ` : null}
        ${togglePin && depth > 0 && html`
          <button class="tree-pin ${isPinned ? 'pinned' : ''}" onClick=${handlePin} title="${isPinned ? 'Unpin' : 'Pin to top'}">
            ${isPinned ? '\u2605' : '\u2606'}
          </button>
        `}
        <button class="tree-copy ${copied ? 'copied' : ''}" onClick=${handleCopy} title="Copy value">
          ${copied ? '\u2713' : '\u2398'}
        </button>
      </div>
      ${isExpanded && children ? html`
        <div class="tree-children">
          ${children}
        </div>
      ` : null}
    </div>
  `;
}

/**
 * StateInspector - Main component for the State Inspector panel
 */
function StateInspector({ getState, isCollapsed, onToggleCollapse, width, onResize }) {
  const [state, setState] = useState({});
  const [expandedPaths, setExpandedPaths] = useState(new Set(['root', 'root.playerHand', 'root.dealerHand', 'root.board']));
  const [changedPaths, setChangedPaths] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [pinnedPaths, setPinnedPaths] = useState(new Set());
  const changeTimeoutRef = useRef(null);

  // Toggle pin for a path
  const togglePin = useCallback((path) => {
    setPinnedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Get value at a path from state
  const getValueAtPath = useCallback((obj, path) => {
    const parts = path.split('.').slice(1); // Remove 'root' prefix
    let current = obj;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  }, []);

  // Poll for state changes with efficient serialization
  useEffect(() => {
    let prevStateJson = null;

    const interval = setInterval(() => {
      try {
        const newState = getState?.() || {};

        // Serialize once and reuse for both comparison and storage
        const newStateJson = JSON.stringify(newState);

        // Only parse and detect changes if the serialized form differs
        if (prevStateJson !== null && prevStateJson !== newStateJson) {
          const prevState = JSON.parse(prevStateJson);
          const changes = detectChanges(prevState, newState);
          if (changes.size > 0) {
            setChangedPaths(changes);

            // Clear change highlights after animation
            if (changeTimeoutRef.current) {
              clearTimeout(changeTimeoutRef.current);
            }
            changeTimeoutRef.current = setTimeout(() => {
              setChangedPaths(new Set());
            }, 600);
          }
        }

        setState(newState);
        prevStateJson = newStateJson;
      } catch (err) {
        console.error('State Inspector error:', err);
      }
    }, 100);

    return () => {
      clearInterval(interval);
      if (changeTimeoutRef.current) {
        clearTimeout(changeTimeoutRef.current);
      }
    };
  }, [getState]);

  const toggleExpand = useCallback((path) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allPaths = new Set(['root']);

    const collectPaths = (obj, path) => {
      if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
          const childPath = `${path}.${key}`;
          allPaths.add(childPath);
          collectPaths(obj[key], childPath);
        });
      }
    };

    collectPaths(state, 'root');
    setExpandedPaths(allPaths);
  }, [state]);

  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set(['root']));
  }, []);

  // Filter state based on search term
  const filteredState = useMemo(() => {
    if (!searchTerm.trim()) return state;

    const term = searchTerm.toLowerCase();

    const filterObj = (obj, parentMatch = false) => {
      if (obj === null || typeof obj !== 'object') return obj;

      const result = Array.isArray(obj) ? [] : {};
      let hasMatch = false;

      for (const [key, value] of Object.entries(obj)) {
        const keyMatches = key.toLowerCase().includes(term);
        const valueMatches = typeof value === 'string' && value.toLowerCase().includes(term);

        if (keyMatches || valueMatches || parentMatch) {
          result[key] = filterObj(value, keyMatches || parentMatch);
          hasMatch = true;
        } else if (typeof value === 'object' && value !== null) {
          const filtered = filterObj(value, false);
          if (Object.keys(filtered).length > 0) {
            result[key] = filtered;
            hasMatch = true;
          }
        }
      }

      return hasMatch || parentMatch ? result : (Array.isArray(obj) ? [] : {});
    };

    return filterObj(state);
  }, [state, searchTerm]);

  if (isCollapsed) {
    return html`
      <div class="state-inspector collapsed" onClick=${onToggleCollapse}>
        <div class="inspector-collapsed-label">
          <span class="inspector-expand-icon">\u25B6</span>
          <span>State</span>
        </div>
      </div>
    `;
  }

  const isEmpty = Object.keys(state).length === 0;

  return html`
    <div class="state-inspector" style="width: ${width}px">
      <div class="inspector-header">
        <div class="inspector-title">
          <button class="inspector-collapse-btn" onClick=${onToggleCollapse} title="Collapse panel">
            \u25C0
          </button>
          <span>State Inspector</span>
        </div>
        <div class="inspector-actions">
          <button class="inspector-btn" onClick=${expandAll} title="Expand all">\u229E</button>
          <button class="inspector-btn" onClick=${collapseAll} title="Collapse all">\u229F</button>
        </div>
      </div>

      <div class="inspector-search">
        <input
          type="text"
          placeholder="Filter keys..."
          value=${searchTerm}
          onInput=${(e) => setSearchTerm(e.target.value)}
        />
        ${searchTerm && html`
          <button class="search-clear" onClick=${() => setSearchTerm('')}>\u2715</button>
        `}
      </div>

      <div class="inspector-tree">
        ${isEmpty ? html`
          <div class="inspector-empty">
            <p>No state available</p>
            <p class="inspector-empty-hint">Select a game to view its state</p>
          </div>
        ` : html`
          ${pinnedPaths.size > 0 && html`
            <div class="pinned-section">
              <div class="pinned-header">
                <span>\u2605 Pinned</span>
                <button class="pinned-clear" onClick=${() => setPinnedPaths(new Set())} title="Clear all pins">\u2715</button>
              </div>
              ${Array.from(pinnedPaths).map(path => {
                const pathParts = path.split('.');
                const name = pathParts[pathParts.length - 1];
                const value = getValueAtPath(state, path);
                return html`
                  <div class="pinned-item" key=${path}>
                    <span class="pinned-path">${path.replace('root.', '')}</span>
                    <span class="pinned-value tree-${getValueType(value)}">${formatValue(value)}</span>
                    <button class="pinned-unpin" onClick=${() => togglePin(path)} title="Unpin">\u2715</button>
                  </div>
                `;
              })}
            </div>
          `}
          <${TreeNode}
            name="state"
            value=${filteredState}
            path="root"
            expandedPaths=${expandedPaths}
            toggleExpand=${toggleExpand}
            changedPaths=${changedPaths}
            pinnedPaths=${pinnedPaths}
            togglePin=${togglePin}
            depth=${0}
          />
        `}
      </div>

      <${ResizeHandle} onResize=${onResize} />
    </div>
  `;
}

/**
 * ResizeHandle - Draggable handle for resizing the panel
 */
function ResizeHandle({ onResize }) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const delta = e.clientX - startXRef.current;
      const newWidth = Math.max(200, Math.min(600, startWidthRef.current + delta));
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onResize]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    const inspector = e.target.closest('.state-inspector');
    startWidthRef.current = inspector ? inspector.offsetWidth : 300;
  };

  return html`
    <div
      class="resize-handle ${isDragging ? 'active' : ''}"
      onMouseDown=${handleMouseDown}
    />
  `;
}

/**
 * StateInspectorPanel - Wrapper that manages panel state
 */
function StateInspectorPanel({ getState }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [width, setWidth] = useState(300);

  return html`
    <${StateInspector}
      getState=${getState}
      isCollapsed=${isCollapsed}
      onToggleCollapse=${() => setIsCollapsed(!isCollapsed)}
      width=${width}
      onResize=${setWidth}
    />
  `;
}

// === Styles ===

const styles = `
.state-inspector {
  background: #0a0a0f;
  border-right: 1px solid #1e293b;
  font-family: 'SF Mono', 'Fira Code', 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  min-width: 200px;
  max-width: 600px;
}

.state-inspector.collapsed {
  width: 32px !important;
  min-width: 32px;
  cursor: pointer;
  transition: background 0.2s;
}

.state-inspector.collapsed:hover {
  background: #111118;
}

.inspector-collapsed-label {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  padding: 12px 8px;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.inspector-expand-icon {
  font-size: 10px;
}

.inspector-header {
  padding: 12px;
  border-bottom: 1px solid #1e293b;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #0d0d14;
}

.inspector-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #e2e8f0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.inspector-collapse-btn {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  font-size: 10px;
  transition: color 0.2s;
}

.inspector-collapse-btn:hover {
  color: #e2e8f0;
}

.inspector-actions {
  display: flex;
  gap: 4px;
}

.inspector-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #64748b;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 4px;
  transition: all 0.2s;
}

.inspector-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
}

.inspector-search {
  padding: 8px 12px;
  border-bottom: 1px solid #1e293b;
  position: relative;
}

.inspector-search input {
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 6px 28px 6px 8px;
  color: #e2e8f0;
  font-family: inherit;
  font-size: 11px;
}

.inspector-search input:focus {
  outline: none;
  border-color: #4ade80;
}

.inspector-search input::placeholder {
  color: #475569;
}

.search-clear {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  font-size: 10px;
}

.search-clear:hover {
  color: #e2e8f0;
}

.inspector-tree {
  flex: 1;
  overflow: auto;
  padding: 8px 0;
}

.inspector-empty {
  padding: 24px;
  text-align: center;
  color: #64748b;
}

.inspector-empty-hint {
  font-size: 11px;
  margin-top: 8px;
  color: #475569;
}

.tree-node {
  padding-left: calc(var(--depth, 0) * 16px);
}

.tree-row {
  display: flex;
  align-items: center;
  padding: 2px 8px;
  cursor: default;
  border-radius: 2px;
  transition: background 0.1s;
}

.tree-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

.tree-arrow {
  width: 16px;
  font-size: 8px;
  color: #64748b;
  cursor: pointer;
  transition: transform 0.15s;
  user-select: none;
}

.tree-arrow.expanded {
  transform: rotate(0deg);
}

.tree-arrow-spacer {
  width: 16px;
}

.tree-key {
  color: #7dd3fc;
  margin-right: 4px;
}

.tree-colon {
  color: #64748b;
  margin-right: 6px;
}

.tree-badge {
  color: #64748b;
  font-size: 10px;
  margin-right: 6px;
}

.tree-value {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-string { color: #4ade80; }
.tree-number { color: #fb923c; }
.tree-boolean { color: #c084fc; }
.tree-null, .tree-undefined { color: #64748b; font-style: italic; }
.tree-array, .tree-object { color: #94a3b8; }

.tree-copy {
  opacity: 0;
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 2px 4px;
  font-size: 10px;
  margin-left: auto;
  transition: all 0.2s;
}

.tree-row:hover .tree-copy {
  opacity: 1;
}

.tree-copy:hover {
  color: #e2e8f0;
}

.tree-copy.copied {
  color: #4ade80;
  opacity: 1;
}

.tree-pin {
  opacity: 0;
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 2px 4px;
  font-size: 10px;
  transition: all 0.2s;
}

.tree-row:hover .tree-pin {
  opacity: 1;
}

.tree-pin:hover {
  color: #fbbf24;
}

.tree-pin.pinned {
  opacity: 1;
  color: #fbbf24;
}

.tree-node.pinned > .tree-row {
  background: rgba(251, 191, 36, 0.05);
}

/* Pinned Section */
.pinned-section {
  background: rgba(251, 191, 36, 0.05);
  border: 1px solid rgba(251, 191, 36, 0.2);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 12px;
}

.pinned-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  color: #fbbf24;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(251, 191, 36, 0.2);
}

.pinned-clear {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 10px;
  padding: 2px 4px;
}

.pinned-clear:hover {
  color: #f87171;
}

.pinned-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 11px;
}

.pinned-path {
  color: #7dd3fc;
  font-weight: 500;
}

.pinned-value {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pinned-unpin {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 10px;
  padding: 2px 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.pinned-item:hover .pinned-unpin {
  opacity: 1;
}

.pinned-unpin:hover {
  color: #f87171;
}

.tree-children {
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  margin-left: 7px;
}

.tree-empty {
  color: #475569;
  font-style: italic;
  padding: 2px 8px 2px 24px;
}

.tree-node.changed > .tree-row {
  animation: highlight-change 0.6s ease-out;
}

@keyframes highlight-change {
  0% { background: rgba(74, 222, 128, 0.3); }
  100% { background: transparent; }
}

.resize-handle {
  position: absolute;
  right: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  background: transparent;
  z-index: 10;
}

.resize-handle:hover,
.resize-handle.active {
  background: #4ade80;
}

/* Scrollbar styling */
.inspector-tree::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.inspector-tree::-webkit-scrollbar-track {
  background: transparent;
}

.inspector-tree::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.inspector-tree::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Error boundary styles */
.inspector-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  height: 100%;
  background: #0a0a0f;
}

.inspector-error-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.inspector-error-title {
  font-size: 14px;
  font-weight: 600;
  color: #f87171;
  margin-bottom: 8px;
}

.inspector-error-message {
  font-size: 11px;
  color: #64748b;
  margin-bottom: 16px;
  max-width: 200px;
  word-break: break-word;
}

.inspector-error-retry {
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.3);
  color: #f87171;
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s;
}

.inspector-error-retry:hover {
  background: rgba(248, 113, 113, 0.2);
  border-color: rgba(248, 113, 113, 0.5);
}
`;

// === Export ===

/**
 * Initialize the State Inspector panel
 * @param {HTMLElement} container - Container element to render into
 * @param {Function} getState - Function that returns the current game state
 */
export function initStateInspector(container, getState) {
  // Inject styles
  if (!document.getElementById('state-inspector-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'state-inspector-styles';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  // Render component wrapped in ErrorBoundary
  render(html`
    <${ErrorBoundary}>
      <${StateInspectorPanel} getState=${getState} />
    </${ErrorBoundary}>
  `, container);
}

export { StateInspector, StateInspectorPanel };
