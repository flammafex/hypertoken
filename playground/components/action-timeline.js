/**
 * Action Timeline Component
 *
 * A horizontal, scrollable timeline showing the history of all dispatched actions,
 * with scrubbing and replay capabilities.
 * Built with Preact + HTM for a build-free reactive UI.
 */

import { h, render } from 'https://esm.sh/preact@10.19.3';
import { useState, useEffect, useRef, useCallback, useMemo } from 'https://esm.sh/preact@10.19.3/hooks';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(h);

// === Utility Functions ===

/**
 * Get color for action based on source
 */
function getActionColor(source) {
  const colors = {
    user: '#60a5fa',    // Blue
    ai: '#4ade80',      // Green
    rule: '#fbbf24',    // Yellow
    network: '#c084fc', // Purple
    system: '#f472b6'   // Pink
  };
  return colors[source] || '#94a3b8';
}

/**
 * Format timestamp relative to now
 */
function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return new Date(timestamp).toLocaleTimeString();
}

/**
 * Format action type for display (namespace:action -> Action)
 */
function formatActionType(type) {
  if (!type) return 'Unknown';
  const parts = type.split(':');
  const action = parts[parts.length - 1];
  return action.charAt(0).toUpperCase() + action.slice(1);
}

/**
 * Get short label for action type
 */
function getActionLabel(type) {
  const labels = {
    'blackjack:deal': 'Deal',
    'blackjack:hit': 'Hit',
    'blackjack:stand': 'Stand',
    'blackjack:dealerPlay': 'Dealer',
    'blackjack:endGame': 'End',
    'tictactoe:move': 'Move',
    'tictactoe:reset': 'Reset',
    'tictactoe:aiMove': 'AI',
    'prisoners:choose': 'Choose',
    'prisoners:resolve': 'Result',
    'prisoners:reset': 'Reset',
    'game:load': 'Load',
    'game:switch': 'Switch'
  };
  return labels[type] || formatActionType(type);
}

/**
 * Deep clone an object
 */
function deepClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    return obj;
  }
}

/**
 * Compute a simple diff between two objects
 */
function computeDiff(before, after) {
  const changes = [];

  const compare = (a, b, path = '') => {
    if (a === b) return;

    const aType = Array.isArray(a) ? 'array' : typeof a;
    const bType = Array.isArray(b) ? 'array' : typeof b;

    if (aType !== bType || aType !== 'object' || a === null || b === null) {
      changes.push({ path: path || 'root', from: a, to: b });
      return;
    }

    const allKeys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key;
      if (!(key in a)) {
        changes.push({ path: newPath, from: undefined, to: b[key], type: 'added' });
      } else if (!(key in b)) {
        changes.push({ path: newPath, from: a[key], to: undefined, type: 'removed' });
      } else if (a[key] !== b[key]) {
        if (typeof a[key] === 'object' && typeof b[key] === 'object') {
          compare(a[key], b[key], newPath);
        } else {
          changes.push({ path: newPath, from: a[key], to: b[key], type: 'changed' });
        }
      }
    }
  };

  compare(before, after);
  return changes.slice(0, 20); // Limit to 20 changes
}

// === Components ===

/**
 * ActionNode - Individual action node on timeline
 */
function ActionNode({ action, index, isSelected, isCurrent, isSignificant, onClick, onHover }) {
  const color = getActionColor(action.meta?.source);
  const label = getActionLabel(action.type);

  return html`
    <div
      class="action-node ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''} ${isSignificant ? 'significant' : ''}"
      style="--action-color: ${color}"
      onClick=${() => onClick(index)}
      onMouseEnter=${() => onHover(action, true)}
      onMouseLeave=${() => onHover(null, false)}
      title="${action.type}"
    >
      <div class="action-dot" />
      ${isSignificant && html`<span class="action-label">${label}</span>`}
    </div>
  `;
}

/**
 * Tooltip - Hover tooltip for action preview
 */
function Tooltip({ action, position }) {
  if (!action) return null;

  return html`
    <div class="action-tooltip" style="left: ${position.x}px; top: ${position.y}px">
      <div class="tooltip-type">${action.type}</div>
      <div class="tooltip-meta">
        <span class="tooltip-actor">${action.meta?.actor || 'system'}</span>
        <span class="tooltip-time">${formatTimeAgo(action.meta?.timestamp)}</span>
      </div>
    </div>
  `;
}

/**
 * ActionDetail - Slide-up panel for selected action
 */
function ActionDetail({ action, stateBefore, stateAfter, onClose, onJumpTo }) {
  const [showDiff, setShowDiff] = useState(true);

  const diff = useMemo(() => {
    if (!stateBefore || !stateAfter) return [];
    return computeDiff(stateBefore, stateAfter);
  }, [stateBefore, stateAfter]);

  if (!action) return null;

  return html`
    <div class="action-detail">
      <div class="detail-header">
        <div class="detail-title">
          <span class="detail-type" style="color: ${getActionColor(action.meta?.source)}">${action.type}</span>
          <span class="detail-time">${formatTimeAgo(action.meta?.timestamp)}</span>
        </div>
        <div class="detail-actions">
          <button class="detail-btn" onClick=${onJumpTo} title="View state at this point">
            Jump to
          </button>
          <button class="detail-close" onClick=${onClose}>\u2715</button>
        </div>
      </div>

      <div class="detail-meta">
        <span class="meta-item">
          <span class="meta-label">Actor:</span>
          <span class="meta-value">${action.meta?.actor || 'system'}</span>
        </span>
        <span class="meta-item">
          <span class="meta-label">Source:</span>
          <span class="meta-value">${action.meta?.source || 'unknown'}</span>
        </span>
        <span class="meta-item">
          <span class="meta-label">ID:</span>
          <span class="meta-value mono">${action.meta?.id?.slice(0, 8) || 'n/a'}</span>
        </span>
      </div>

      <div class="detail-tabs">
        <button
          class="tab-btn ${!showDiff ? 'active' : ''}"
          onClick=${() => setShowDiff(false)}
        >
          Payload
        </button>
        <button
          class="tab-btn ${showDiff ? 'active' : ''}"
          onClick=${() => setShowDiff(true)}
        >
          Changes (${diff.length})
        </button>
      </div>

      ${showDiff ? html`
        <div class="detail-diff">
          ${diff.length === 0 ? html`
            <div class="diff-empty">No state changes detected</div>
          ` : diff.map(change => html`
            <div class="diff-item ${change.type || 'changed'}">
              <div class="diff-path">${change.path}</div>
              <div class="diff-values">
                <div class="diff-from">
                  <span class="diff-label">Before:</span>
                  <span class="diff-value">${change.from === undefined ? 'undefined' : JSON.stringify(change.from)}</span>
                </div>
                <div class="diff-arrow">\u2192</div>
                <div class="diff-to">
                  <span class="diff-label">After:</span>
                  <span class="diff-value">${change.to === undefined ? 'undefined' : JSON.stringify(change.to)}</span>
                </div>
              </div>
            </div>
          `)}
        </div>
      ` : html`
        <div class="detail-payload">
          <pre>${JSON.stringify(action.payload || {}, null, 2)}</pre>
        </div>
      `}
    </div>
  `;
}

/**
 * ResizeHandle - Draggable handle for resizing panel height
 */
function TimelineResizeHandle({ onResize }) {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const delta = startYRef.current - e.clientY;
      const newHeight = Math.max(80, Math.min(400, startHeightRef.current + delta));
      onResize(newHeight);
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
    startYRef.current = e.clientY;
    const timeline = e.target.closest('.action-timeline');
    startHeightRef.current = timeline ? timeline.offsetHeight : 120;
  };

  return html`
    <div
      class="timeline-resize-handle ${isDragging ? 'active' : ''}"
      onMouseDown=${handleMouseDown}
    />
  `;
}

/**
 * ActionTimeline - Main timeline component
 */
function ActionTimeline({ getHistory, getStateAt, onScrub, onClearHistory }) {
  const [actions, setActions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [viewIndex, setViewIndex] = useState(null); // null = live
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [height, setHeight] = useState(120);
  const [hoveredAction, setHoveredAction] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterActor, setFilterActor] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const scrollRef = useRef();
  const containerRef = useRef();

  // Get unique action types and actors for filter dropdowns
  const { actionTypes, actors } = useMemo(() => {
    const types = new Set();
    const actorSet = new Set();
    actions.forEach(a => {
      if (a.type) types.add(a.type);
      if (a.meta?.actor) actorSet.add(a.meta.actor);
      if (a.meta?.source) actorSet.add(a.meta.source);
    });
    return {
      actionTypes: Array.from(types).sort(),
      actors: Array.from(actorSet).sort()
    };
  }, [actions]);

  // Export actions as JSON
  const handleExport = useCallback(() => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      actionCount: actions.length,
      actions: actions.map(a => ({
        type: a.type,
        payload: a.payload,
        meta: a.meta,
        stateAfter: a.stateAfter
      }))
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `action-history-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [actions]);

  // Filter actions by search term, type, and actor
  const filteredActions = useMemo(() => {
    return actions.filter(action => {
      // Filter by type
      if (filterType !== 'all' && action.type !== filterType) return false;

      // Filter by actor/source
      if (filterActor !== 'all') {
        const matchesActor = action.meta?.actor === filterActor || action.meta?.source === filterActor;
        if (!matchesActor) return false;
      }

      // Filter by search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesType = action.type?.toLowerCase().includes(term);
        const matchesPayload = JSON.stringify(action.payload || {}).toLowerCase().includes(term);
        const matchesActor = action.meta?.actor?.toLowerCase().includes(term);
        const matchesSource = action.meta?.source?.toLowerCase().includes(term);
        if (!matchesType && !matchesPayload && !matchesActor && !matchesSource) return false;
      }

      return true;
    });
  }, [actions, searchTerm, filterType, filterActor]);

  // Check if any filters are active
  const hasActiveFilters = filterType !== 'all' || filterActor !== 'all';

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilterType('all');
    setFilterActor('all');
    setSearchTerm('');
  }, []);

  // Listen for new actions
  useEffect(() => {
    const handler = () => {
      const history = getHistory?.() || [];
      setActions(history);
    };

    window.addEventListener('hypertoken:action', handler);
    // Initial load
    handler();

    return () => window.removeEventListener('hypertoken:action', handler);
  }, [getHistory]);

  // Auto-scroll to latest if following live
  useEffect(() => {
    if (isAutoScroll && viewIndex === null && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [actions.length, viewIndex, isAutoScroll]);

  // Handle scroll to detect user scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 50;
    setIsAutoScroll(isAtEnd);
  }, []);

  // Notify parent when scrubbing
  useEffect(() => {
    if (viewIndex !== null && actions[viewIndex]) {
      onScrub?.(actions[viewIndex].stateAfter, viewIndex);
    } else {
      onScrub?.(null, null); // null = return to live
    }
  }, [viewIndex, actions, onScrub]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle if timeline is focused or no input is focused
      if (document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setViewIndex(prev => {
            const current = prev ?? actions.length - 1;
            return Math.max(0, current - 1);
          });
          setIsAutoScroll(false);
          break;
        case 'ArrowRight':
          e.preventDefault();
          setViewIndex(prev => {
            if (prev === null) return null;
            const next = prev + 1;
            if (next >= actions.length - 1) {
              setIsAutoScroll(true);
              return null;
            }
            return next;
          });
          break;
        case 'Home':
          e.preventDefault();
          if (actions.length > 0) {
            setViewIndex(0);
            setIsAutoScroll(false);
          }
          break;
        case 'End':
          e.preventDefault();
          setViewIndex(null);
          setIsAutoScroll(true);
          break;
        case 'Escape':
          setSelectedIndex(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions.length]);

  const handleNodeClick = useCallback((index) => {
    setSelectedIndex(prev => prev === index ? null : index);
  }, []);

  const handleHover = useCallback((action, isHovering) => {
    if (isHovering && action) {
      setHoveredAction(action);
    } else {
      setHoveredAction(null);
    }
  }, []);

  const handleJumpTo = useCallback(() => {
    if (selectedIndex !== null) {
      setViewIndex(selectedIndex);
      setIsAutoScroll(false);
    }
  }, [selectedIndex]);

  const returnToLive = useCallback(() => {
    setViewIndex(null);
    setSelectedIndex(null);
    setIsAutoScroll(true);
  }, []);

  const handleClear = useCallback(() => {
    onClearHistory?.();
    setSelectedIndex(null);
    setViewIndex(null);
  }, [onClearHistory]);

  // Determine which actions are "significant"
  const significantTypes = useMemo(() => new Set([
    'blackjack:deal', 'blackjack:endGame',
    'tictactoe:reset',
    'prisoners:reset', 'prisoners:resolve',
    'game:load', 'game:switch'
  ]), []);

  // Get state before/after selected action
  const selectedStateBefore = selectedIndex !== null && selectedIndex > 0
    ? actions[selectedIndex - 1]?.stateAfter
    : null;
  const selectedStateAfter = selectedIndex !== null
    ? actions[selectedIndex]?.stateAfter
    : null;

  if (isCollapsed) {
    return html`
      <div class="action-timeline collapsed" ref=${containerRef}>
        <div class="timeline-header">
          <div class="timeline-title">
            <span>Action Timeline</span>
            <span class="action-count">${actions.length} actions</span>
          </div>
          <button class="collapse-btn" onClick=${() => setIsCollapsed(false)} title="Expand">
            \u25B2
          </button>
        </div>
      </div>
    `;
  }

  return html`
    <div class="action-timeline" style="height: ${height}px" ref=${containerRef}>
      <${TimelineResizeHandle} onResize=${setHeight} />

      <div class="timeline-header">
        <div class="timeline-title">
          <span>Action Timeline</span>
          ${viewIndex !== null && html`
            <span class="viewing-badge">
              Viewing: ${formatTimeAgo(actions[viewIndex]?.meta?.timestamp)}
            </span>
          `}
        </div>
        <div class="timeline-controls">
          <div class="search-container">
            <input
              type="text"
              class="search-input"
              placeholder="Search actions..."
              value=${searchTerm}
              onInput=${e => setSearchTerm(e.target.value)}
            />
            ${searchTerm && html`
              <button class="search-clear" onClick=${() => setSearchTerm('')}>\u2715</button>
            `}
          </div>
          <div class="filter-container">
            <button
              class="filter-btn ${hasActiveFilters ? 'active' : ''}"
              onClick=${() => setShowFilters(!showFilters)}
              title="Filter actions"
            >
              \u2630 ${hasActiveFilters ? `(${filteredActions.length})` : ''}
            </button>
            ${showFilters && html`
              <div class="filter-dropdown">
                <div class="filter-group">
                  <label class="filter-label">Action Type</label>
                  <select
                    class="filter-select"
                    value=${filterType}
                    onChange=${e => setFilterType(e.target.value)}
                  >
                    <option value="all">All Types</option>
                    ${actionTypes.map(type => html`
                      <option key=${type} value=${type}>${type}</option>
                    `)}
                  </select>
                </div>
                <div class="filter-group">
                  <label class="filter-label">Actor/Source</label>
                  <select
                    class="filter-select"
                    value=${filterActor}
                    onChange=${e => setFilterActor(e.target.value)}
                  >
                    <option value="all">All Actors</option>
                    ${actors.map(actor => html`
                      <option key=${actor} value=${actor}>${actor}</option>
                    `)}
                  </select>
                </div>
                ${hasActiveFilters && html`
                  <button class="filter-clear-btn" onClick=${clearFilters}>
                    Clear Filters
                  </button>
                `}
              </div>
            `}
          </div>
          ${viewIndex !== null && html`
            <button class="return-live-btn" onClick=${returnToLive}>
              \u25CF Return to Live
            </button>
          `}
          <span class="action-count">${hasActiveFilters || searchTerm ? `${filteredActions.length}/${actions.length}` : actions.length} actions</span>
          ${actions.length > 0 && html`
            <button class="export-btn" onClick=${handleExport} title="Export as JSON">
              Export
            </button>
            <button class="clear-btn" onClick=${handleClear} title="Clear history">
              Clear
            </button>
          `}
          <button class="collapse-btn" onClick=${() => setIsCollapsed(true)} title="Collapse">
            \u25BC
          </button>
        </div>
      </div>

      <div class="timeline-body">
        ${actions.length === 0 ? html`
          <div class="timeline-empty">
            <p>No actions recorded yet</p>
            <p class="empty-hint">Play a game to see actions appear here</p>
          </div>
        ` : filteredActions.length === 0 ? html`
          <div class="timeline-empty">
            <p>No matching actions</p>
            <p class="empty-hint">Try a different search term</p>
          </div>
        ` : html`
          <div
            class="timeline-track"
            ref=${scrollRef}
            onScroll=${handleScroll}
          >
            <div class="track-line" />
            ${filteredActions.map((action) => {
              const originalIndex = actions.indexOf(action);
              return html`
                <${ActionNode}
                  key=${action.meta?.id || originalIndex}
                  action=${action}
                  index=${originalIndex}
                  isSelected=${selectedIndex === originalIndex}
                  isCurrent=${viewIndex === originalIndex}
                  isSignificant=${significantTypes.has(action.type)}
                  onClick=${handleNodeClick}
                  onHover=${handleHover}
                />
              `;
            })}
            ${viewIndex === null && html`
              <div class="live-indicator">
                <span class="live-dot" />
                <span>LIVE</span>
              </div>
            `}
          </div>

          ${viewIndex !== null && html`
            <div class="playhead-indicator">
              Step ${viewIndex + 1} of ${actions.length}
            </div>
          `}
        `}
      </div>

      ${selectedIndex !== null && actions[selectedIndex] && html`
        <${ActionDetail}
          action=${actions[selectedIndex]}
          stateBefore=${selectedStateBefore}
          stateAfter=${selectedStateAfter}
          onClose=${() => setSelectedIndex(null)}
          onJumpTo=${handleJumpTo}
        />
      `}

      ${hoveredAction && html`
        <${Tooltip}
          action=${hoveredAction}
          position=${tooltipPos}
        />
      `}
    </div>
  `;
}

// === Styles ===

const styles = `
.action-timeline {
  background: #0a0a0f;
  border-top: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
  position: relative;
  font-family: 'SF Mono', 'Fira Code', 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  transition: height 0.2s ease;
}

.action-timeline.collapsed {
  height: 40px !important;
}

.timeline-resize-handle {
  position: absolute;
  top: -3px;
  left: 0;
  right: 0;
  height: 6px;
  cursor: ns-resize;
  background: transparent;
  z-index: 10;
}

.timeline-resize-handle:hover,
.timeline-resize-handle.active {
  background: #4ade80;
}

.timeline-header {
  padding: 8px 16px;
  border-bottom: 1px solid #1e293b;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #0d0d14;
  flex-shrink: 0;
}

.timeline-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
  color: #e2e8f0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.viewing-badge {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: normal;
  text-transform: none;
  letter-spacing: normal;
}

.timeline-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.action-count {
  color: #64748b;
  font-size: 11px;
  font-weight: normal;
  text-transform: none;
  letter-spacing: normal;
}

.return-live-btn {
  background: #dc2626;
  color: white;
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  animation: pulse-live 2s infinite;
  font-family: inherit;
}

@keyframes pulse-live {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.return-live-btn:hover {
  background: #ef4444;
}

.search-container {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
  padding: 4px 24px 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  width: 140px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s, width 0.2s;
}

.search-input:focus {
  border-color: #60a5fa;
  width: 180px;
}

.search-input::placeholder {
  color: #64748b;
}

.search-clear {
  position: absolute;
  right: 4px;
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 10px;
  padding: 2px 4px;
}

.search-clear:hover {
  color: #e2e8f0;
}

.filter-container {
  position: relative;
}

.filter-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #64748b;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.filter-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
}

.filter-btn.active {
  background: rgba(96, 165, 250, 0.2);
  border-color: rgba(96, 165, 250, 0.4);
  color: #60a5fa;
}

.filter-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 12px;
  min-width: 180px;
  z-index: 100;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

.filter-group {
  margin-bottom: 10px;
}

.filter-group:last-of-type {
  margin-bottom: 0;
}

.filter-label {
  display: block;
  font-size: 10px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.filter-select {
  width: 100%;
  padding: 6px 8px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 4px;
  color: #e2e8f0;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: #60a5fa;
}

.filter-clear-btn {
  width: 100%;
  margin-top: 10px;
  padding: 6px 8px;
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.3);
  border-radius: 4px;
  color: #f87171;
  font-size: 10px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.filter-clear-btn:hover {
  background: rgba(248, 113, 113, 0.2);
}

.export-btn {
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
  color: #4ade80;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 10px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.export-btn:hover {
  background: rgba(74, 222, 128, 0.2);
  border-color: rgba(74, 222, 128, 0.5);
}

.clear-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #64748b;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 10px;
  cursor: pointer;
  font-family: inherit;
}

.clear-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
}

.collapse-btn {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 10px;
}

.collapse-btn:hover {
  color: #e2e8f0;
}

.timeline-body {
  flex: 1;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

.timeline-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #64748b;
}

.empty-hint {
  font-size: 11px;
  color: #475569;
  margin-top: 4px;
}

.timeline-track {
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 12px;
  position: relative;
}

.track-line {
  position: absolute;
  left: 20px;
  right: 20px;
  top: 50%;
  height: 2px;
  background: #1e293b;
  transform: translateY(-50%);
  z-index: 0;
}

.timeline-track::-webkit-scrollbar {
  height: 4px;
}

.timeline-track::-webkit-scrollbar-track {
  background: #1e293b;
}

.timeline-track::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 2px;
}

.action-node {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  z-index: 1;
  flex-shrink: 0;
}

.action-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--action-color, #94a3b8);
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 0 0 2px #0a0a0f;
}

.action-node:hover .action-dot {
  transform: scale(1.4);
  z-index: 10;
}

.action-node.selected .action-dot {
  box-shadow: 0 0 0 2px #0a0a0f, 0 0 0 4px rgba(255, 255, 255, 0.3);
}

.action-node.current .action-dot {
  box-shadow: 0 0 0 2px #0a0a0f, 0 0 0 4px #f472b6;
}

.action-node.significant .action-dot {
  width: 16px;
  height: 16px;
}

.action-label {
  font-size: 9px;
  color: #64748b;
  white-space: nowrap;
  position: absolute;
  top: 100%;
  margin-top: 2px;
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #4ade80;
  font-size: 10px;
  font-weight: 600;
  padding-left: 8px;
  flex-shrink: 0;
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4ade80;
  animation: live-pulse 1.5s infinite;
}

@keyframes live-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.playhead-indicator {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(244, 114, 182, 0.2);
  color: #f472b6;
  padding: 2px 12px;
  border-radius: 4px;
  font-size: 10px;
}

/* Action Detail Panel */
.action-detail {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px;
  min-width: 320px;
  max-width: 450px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.detail-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-type {
  font-weight: 600;
  font-size: 13px;
}

.detail-time {
  font-size: 10px;
  color: #64748b;
}

.detail-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.detail-btn {
  background: rgba(96, 165, 250, 0.2);
  color: #60a5fa;
  border: none;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
}

.detail-btn:hover {
  background: rgba(96, 165, 250, 0.3);
}

.detail-close {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
}

.detail-close:hover {
  color: #e2e8f0;
}

.detail-meta {
  display: flex;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px solid #334155;
  margin-bottom: 8px;
}

.meta-item {
  display: flex;
  gap: 4px;
  font-size: 11px;
}

.meta-label {
  color: #64748b;
}

.meta-value {
  color: #e2e8f0;
}

.meta-value.mono {
  font-family: inherit;
}

.detail-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}

.tab-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid transparent;
  color: #64748b;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
}

.tab-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.tab-btn.active {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: #e2e8f0;
}

.detail-payload {
  background: #0f172a;
  padding: 8px;
  border-radius: 4px;
  max-height: 120px;
  overflow: auto;
}

.detail-payload pre {
  margin: 0;
  color: #94a3b8;
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-all;
}

.detail-diff {
  background: #0f172a;
  padding: 8px;
  border-radius: 4px;
  max-height: 120px;
  overflow: auto;
}

.diff-empty {
  color: #64748b;
  font-size: 11px;
  text-align: center;
  padding: 8px;
}

.diff-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  font-size: 11px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  margin-bottom: 6px;
}

.diff-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.diff-path {
  color: #7dd3fc;
  font-weight: 600;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.diff-values {
  display: flex;
  align-items: center;
  gap: 8px;
}

.diff-from, .diff-to {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 8px;
  border-radius: 3px;
  min-width: 0;
}

.diff-from {
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.2);
}

.diff-to {
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.2);
}

.diff-label {
  font-size: 9px;
  color: #64748b;
  text-transform: uppercase;
}

.diff-arrow {
  color: #64748b;
  flex-shrink: 0;
  font-size: 14px;
}

.diff-value {
  color: #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'SF Mono', monospace;
  font-size: 11px;
}

.diff-from .diff-value {
  color: #f87171;
}

.diff-to .diff-value {
  color: #4ade80;
}

.diff-item.added .diff-from {
  opacity: 0.4;
}

.diff-item.removed .diff-to {
  opacity: 0.4;
}

/* Tooltip */
.action-tooltip {
  position: fixed;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 8px 12px;
  z-index: 1000;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  transform: translateX(-50%) translateY(-100%);
  margin-top: -8px;
}

.tooltip-type {
  color: #e2e8f0;
  font-weight: 500;
  font-size: 12px;
  margin-bottom: 4px;
}

.tooltip-meta {
  display: flex;
  gap: 12px;
  font-size: 10px;
}

.tooltip-actor {
  color: #7dd3fc;
}

.tooltip-time {
  color: #64748b;
}

/* Responsive */
@media (max-width: 768px) {
  .action-detail {
    left: 16px;
    right: 16px;
    transform: none;
    min-width: auto;
    max-width: none;
  }
}
`;

// === Export ===

/**
 * Initialize the Action Timeline panel
 * @param {HTMLElement} container - Container element to render into
 * @param {Function} getHistory - Function that returns action history array
 * @param {Function} onScrub - Callback when user scrubs to a different point
 * @param {Function} onClearHistory - Callback when user clears history
 */
export function initActionTimeline(container, { getHistory, onScrub, onClearHistory }) {
  // Inject styles
  if (!document.getElementById('action-timeline-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'action-timeline-styles';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  // Render component
  render(
    html`<${ActionTimeline}
      getHistory=${getHistory}
      onScrub=${onScrub}
      onClearHistory=${onClearHistory}
    />`,
    container
  );
}

export { ActionTimeline };
