/**
 * Token Canvas Component
 *
 * A 2D spatial visualization and manipulation component for tokens.
 * Renders tokens in zones with drag-and-drop functionality.
 * Built with Preact + HTM and Canvas2D for performance.
 */

import { h, render } from 'https://esm.sh/preact@10.19.3';
import { useState, useEffect, useRef, useCallback, useMemo } from 'https://esm.sh/preact@10.19.3/hooks';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(h);

// === Constants ===

const CARD_WIDTH = 50;
const CARD_HEIGHT = 70;
const CARD_RADIUS = 6;
const GRID_SIZE = 20;

// Default zone layouts for different game types
const ZONE_PRESETS = {
  blackjack: {
    dealerHand: { x: 50, y: 30, width: 300, height: 100, label: 'Dealer' },
    playerHand: { x: 50, y: 200, width: 400, height: 100, label: 'Player' },
    deck: { x: 400, y: 100, width: 80, height: 100, label: 'Deck' }
  },
  tictactoe: {
    cell0: { x: 50, y: 50, width: 70, height: 70, label: '0' },
    cell1: { x: 130, y: 50, width: 70, height: 70, label: '1' },
    cell2: { x: 210, y: 50, width: 70, height: 70, label: '2' },
    cell3: { x: 50, y: 130, width: 70, height: 70, label: '3' },
    cell4: { x: 130, y: 130, width: 70, height: 70, label: '4' },
    cell5: { x: 210, y: 130, width: 70, height: 70, label: '5' },
    cell6: { x: 50, y: 210, width: 70, height: 70, label: '6' },
    cell7: { x: 130, y: 210, width: 70, height: 70, label: '7' },
    cell8: { x: 210, y: 210, width: 70, height: 70, label: '8' }
  },
  generic: {
    hand: { x: 50, y: 200, width: 400, height: 100, label: 'Hand' },
    table: { x: 50, y: 50, width: 400, height: 100, label: 'Table' },
    deck: { x: 500, y: 100, width: 80, height: 100, label: 'Deck' }
  }
};

// === Canvas Rendering Functions ===

/**
 * Render a playing card on the canvas
 */
function renderCard(ctx, token, x, y, faceUp, isSelected, isHovered, isDragging) {
  ctx.save();

  // Card shadow
  if (!isDragging) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
  }

  // Card background
  ctx.beginPath();
  ctx.roundRect(x, y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);

  if (faceUp) {
    ctx.fillStyle = '#ffffff';
  } else {
    // Card back pattern
    ctx.fillStyle = '#1e40af';
  }
  ctx.fill();

  // Reset shadow for border
  ctx.shadowColor = 'transparent';

  // Border
  ctx.strokeStyle = isSelected ? '#22c55e' : isHovered ? '#60a5fa' : '#334155';
  ctx.lineWidth = isSelected ? 2 : 1;
  ctx.stroke();

  if (faceUp && token) {
    const suit = token.suit;
    const rank = token.rank;

    // Suit color
    const isRed = suit === 'hearts' || suit === 'diams' || suit === 'diamonds';
    ctx.fillStyle = isRed ? '#dc2626' : '#1e293b';

    // Suit symbol
    const suitSymbol = {
      hearts: '\u2665',
      diamonds: '\u2666',
      diams: '\u2666',
      clubs: '\u2663',
      spades: '\u2660'
    }[suit] || '?';

    // Rank text - handle both string and numeric ranks
    let rankText = rank;
    if (typeof rank === 'number') {
      rankText = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[rank] || String(rank);
    } else if (rank === 'A') {
      rankText = 'A';
    }

    // Draw rank and suit (top-left)
    ctx.font = 'bold 12px SF Mono, Monaco, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(rankText, x + 4, y + 4);

    ctx.font = '14px serif';
    ctx.fillText(suitSymbol, x + 4, y + 18);

    // Center suit
    ctx.font = '22px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(suitSymbol, x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2 + 2);

    // Bottom-right (inverted)
    ctx.font = 'bold 12px SF Mono, Monaco, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(rankText, x + CARD_WIDTH - 4, y + CARD_HEIGHT - 4);
  } else if (!faceUp) {
    // Card back design
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + 5, y + 5, CARD_WIDTH - 10, CARD_HEIGHT - 10, 4);
    ctx.stroke();

    // Center pattern
    ctx.fillStyle = '#3b82f6';
    ctx.font = '18px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2);
  } else {
    // Generic token (not a card)
    ctx.fillStyle = '#64748b';
    ctx.font = '10px SF Mono, Monaco, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = token?.display || token?.id?.slice(0, 6) || '?';
    ctx.fillText(label, x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2);
  }

  ctx.restore();
}

/**
 * Render a tic-tac-toe piece (X or O)
 */
function renderTicTacToePiece(ctx, value, x, y, width, height, isSelected, isHovered) {
  if (!value) return;

  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const size = Math.min(width, height) * 0.6;

  ctx.save();
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';

  if (value === 'X') {
    ctx.strokeStyle = '#60a5fa';
    const offset = size / 2;
    ctx.beginPath();
    ctx.moveTo(centerX - offset, centerY - offset);
    ctx.lineTo(centerX + offset, centerY + offset);
    ctx.moveTo(centerX + offset, centerY - offset);
    ctx.lineTo(centerX - offset, centerY + offset);
    ctx.stroke();
  } else if (value === 'O') {
    ctx.strokeStyle = '#f472b6';
    ctx.beginPath();
    ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Render a zone boundary
 */
function renderZone(ctx, zoneName, config, tokenCount, isDropTarget, showLabels) {
  const { x, y, width, height, label } = config;

  ctx.save();

  // Zone background
  ctx.fillStyle = isDropTarget ? 'rgba(74, 222, 128, 0.15)' : 'rgba(30, 41, 59, 0.4)';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 8);
  ctx.fill();

  // Zone border
  ctx.strokeStyle = isDropTarget ? '#22c55e' : '#334155';
  ctx.lineWidth = isDropTarget ? 2 : 1;
  ctx.setLineDash(isDropTarget ? [] : [4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Zone label
  if (showLabels && label) {
    ctx.fillStyle = '#64748b';
    ctx.font = '11px SF Mono, Monaco, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${label} (${tokenCount})`, x + 8, y - 4);
  }

  ctx.restore();
}

/**
 * Render grid overlay
 */
function renderGrid(ctx, width, height, gridSize) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();
}

// === Main Canvas Component ===

function TokenCanvasCore({
  spaceState,
  zoneConfigs,
  gameType = 'generic',
  onTokenClick,
  onTokenDoubleClick,
  onZoneClick,
  onTokenMove,
  onLog,
  showGrid: initialShowGrid = false,
  showLabels: initialShowLabels = true,
  snapToGrid: initialSnapToGrid = true
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationFrameRef = useRef(null);

  // State
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 400 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(initialShowGrid);
  const [showLabels, setShowLabels] = useState(initialShowLabels);
  const [snapToGrid, setSnapToGrid] = useState(initialSnapToGrid);

  // Interaction state
  const [selectedTokens, setSelectedTokens] = useState(new Set());
  const selectedToken = selectedTokens.size > 0 ? { id: Array.from(selectedTokens)[0] } : null;
  const [hoveredToken, setHoveredToken] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Use preset or custom configs
  const configs = useMemo(() => {
    return zoneConfigs || ZONE_PRESETS[gameType] || ZONE_PRESETS.generic;
  }, [zoneConfigs, gameType]);

  // Get all tokens with their zone info
  const getAllTokens = useCallback(() => {
    if (!spaceState) return [];

    const tokens = [];

    // Handle blackjack state structure
    if (spaceState.playerHand) {
      spaceState.playerHand.forEach((card, i) => {
        tokens.push({
          id: `player-${i}`,
          zoneName: 'playerHand',
          token: card,
          x: i * 55,
          y: 10,
          faceUp: true
        });
      });
    }

    if (spaceState.dealerHand) {
      spaceState.dealerHand.forEach((card, i) => {
        tokens.push({
          id: `dealer-${i}`,
          zoneName: 'dealerHand',
          token: card,
          x: i * 55,
          y: 10,
          faceUp: i === 0 || spaceState.gameOver // First card always up, second only when game over
        });
      });
    }

    // Handle deck
    if (spaceState.deck && spaceState.deck.remaining > 0) {
      tokens.push({
        id: 'deck-top',
        zoneName: 'deck',
        token: { display: `${spaceState.deck.remaining}` },
        x: 10,
        y: 10,
        faceUp: false
      });
    }

    // Handle tic-tac-toe board
    if (spaceState.board) {
      spaceState.board.forEach((cell, i) => {
        if (cell.value) {
          tokens.push({
            id: `cell-${i}`,
            zoneName: `cell${i}`,
            token: { value: cell.value },
            x: 0,
            y: 0,
            isTicTacToe: true
          });
        }
      });
    }

    // Handle generic zones structure
    if (spaceState.zones) {
      for (const [zoneName, placements] of Object.entries(spaceState.zones)) {
        for (const placement of placements) {
          tokens.push({
            ...placement,
            zoneName
          });
        }
      }
    }

    return tokens;
  }, [spaceState]);

  // Hit test - find token at canvas position
  const hitTest = useCallback((canvasX, canvasY) => {
    const tokens = getAllTokens();

    // Check in reverse order (top-most first)
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i];
      const zoneConfig = configs[t.zoneName];
      if (!zoneConfig) continue;

      if (t.isTicTacToe) {
        // For tic-tac-toe, the whole cell is the hit area
        if (canvasX >= zoneConfig.x && canvasX <= zoneConfig.x + zoneConfig.width &&
            canvasY >= zoneConfig.y && canvasY <= zoneConfig.y + zoneConfig.height) {
          return t;
        }
      } else {
        const absX = zoneConfig.x + t.x;
        const absY = zoneConfig.y + t.y;

        if (canvasX >= absX && canvasX <= absX + CARD_WIDTH &&
            canvasY >= absY && canvasY <= absY + CARD_HEIGHT) {
          return t;
        }
      }
    }
    return null;
  }, [getAllTokens, configs]);

  // Find zone at position
  const findZoneAt = useCallback((canvasX, canvasY) => {
    for (const [zoneName, config] of Object.entries(configs)) {
      if (canvasX >= config.x && canvasX <= config.x + config.width &&
          canvasY >= config.y && canvasY <= config.y + config.height) {
        return zoneName;
      }
    }
    return null;
  }, [configs]);

  // Convert client coords to canvas coords
  const clientToCanvas = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / zoom - pan.x,
      y: (clientY - rect.top) / zoom - pan.y
    };
  }, [zoom, pan]);

  // Mouse handlers
  const handleMouseDown = useCallback((e) => {
    const pos = clientToCanvas(e.clientX, e.clientY);
    const hit = hitTest(pos.x, pos.y);

    if (hit) {
      // Update internal selection (single for now, parent handles multi-selection)
      setSelectedTokens(new Set([hit.id]));
      setDragging({
        token: hit,
        startX: pos.x,
        startY: pos.y,
        offsetX: pos.x - (configs[hit.zoneName]?.x || 0) - hit.x,
        offsetY: pos.y - (configs[hit.zoneName]?.y || 0) - hit.y
      });
      onTokenClick?.(hit, e);
    } else {
      setSelectedTokens(new Set());
      const zone = findZoneAt(pos.x, pos.y);
      if (zone) {
        onZoneClick?.(zone, configs[zone]);
      }
    }
  }, [hitTest, clientToCanvas, configs, onTokenClick, onZoneClick, findZoneAt]);

  const handleMouseMove = useCallback((e) => {
    const pos = clientToCanvas(e.clientX, e.clientY);
    setMousePos(pos);

    if (dragging) {
      const zone = findZoneAt(pos.x, pos.y);
      setDropTarget(zone);
    } else {
      const hit = hitTest(pos.x, pos.y);
      setHoveredToken(hit);
    }
  }, [dragging, hitTest, findZoneAt, clientToCanvas]);

  const handleMouseUp = useCallback((e) => {
    if (dragging && dropTarget && onTokenMove) {
      const pos = clientToCanvas(e.clientX, e.clientY);
      const targetConfig = configs[dropTarget] || { x: 0, y: 0 };

      let newX = pos.x - targetConfig.x - dragging.offsetX;
      let newY = pos.y - targetConfig.y - dragging.offsetY;

      // Snap to grid
      if (snapToGrid) {
        newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
        newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
      }

      onTokenMove(
        dragging.token.zoneName,
        dropTarget,
        dragging.token.id,
        newX,
        newY
      );
    }

    setDragging(null);
    setDropTarget(null);
  }, [dragging, dropTarget, configs, snapToGrid, onTokenMove, clientToCanvas]);

  const handleDoubleClick = useCallback((e) => {
    const pos = clientToCanvas(e.clientX, e.clientY);
    const hit = hitTest(pos.x, pos.y);

    if (hit) {
      onTokenDoubleClick?.(hit);
    } else {
      const zone = findZoneAt(pos.x, pos.y);
      if (zone) {
        onZoneClick?.(zone, configs[zone], true);
      }
    }
  }, [hitTest, findZoneAt, configs, clientToCanvas, onTokenDoubleClick, onZoneClick]);

  // Handle wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.max(0.5, Math.min(2, z + delta)));
  }, []);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const renderFrame = () => {
      const { width, height } = canvasSize;

      // Clear
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.scale(zoom, zoom);
      ctx.translate(pan.x, pan.y);

      // Draw grid
      if (showGrid) {
        renderGrid(ctx, width / zoom, height / zoom, GRID_SIZE);
      }

      // Draw zones
      for (const [zoneName, config] of Object.entries(configs)) {
        let tokenCount = 0;

        // Count tokens in zone based on game type
        if (zoneName === 'playerHand' && spaceState?.playerHand) {
          tokenCount = spaceState.playerHand.length;
        } else if (zoneName === 'dealerHand' && spaceState?.dealerHand) {
          tokenCount = spaceState.dealerHand.length;
        } else if (zoneName === 'deck' && spaceState?.deck) {
          tokenCount = spaceState.deck.remaining;
        } else if (zoneName.startsWith('cell') && spaceState?.board) {
          const idx = parseInt(zoneName.replace('cell', ''));
          tokenCount = spaceState.board[idx]?.value ? 1 : 0;
        } else if (spaceState?.zones?.[zoneName]) {
          tokenCount = spaceState.zones[zoneName].length;
        }

        const isDropTargetZone = dropTarget === zoneName;
        renderZone(ctx, zoneName, config, tokenCount, isDropTargetZone, showLabels);
      }

      // Draw tokens
      const tokens = getAllTokens();
      for (const t of tokens) {
        // Skip dragged token (render separately)
        if (dragging?.token.id === t.id) continue;

        const zoneConfig = configs[t.zoneName];
        if (!zoneConfig) continue;

        const isSelected = selectedToken?.id === t.id;
        const isHovered = hoveredToken?.id === t.id;

        if (t.isTicTacToe) {
          renderTicTacToePiece(
            ctx,
            t.token.value,
            zoneConfig.x,
            zoneConfig.y,
            zoneConfig.width,
            zoneConfig.height,
            isSelected,
            isHovered
          );
        } else {
          const absX = zoneConfig.x + t.x;
          const absY = zoneConfig.y + t.y;

          renderCard(ctx, t.token, absX, absY, t.faceUp, isSelected, isHovered, false);
        }
      }

      // Draw dragged token on top
      if (dragging && !dragging.token.isTicTacToe) {
        const dragX = mousePos.x - dragging.offsetX;
        const dragY = mousePos.y - dragging.offsetY;

        ctx.globalAlpha = 0.8;
        renderCard(ctx, dragging.token.token, dragX, dragY, dragging.token.faceUp, true, false, true);
        ctx.globalAlpha = 1;
      }

      ctx.restore();

      animationFrameRef.current = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [canvasSize, zoom, pan, showGrid, showLabels, configs, spaceState, getAllTokens, selectedToken, hoveredToken, dragging, dropTarget, mousePos]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ width, height });

        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = width;
          canvas.height = height;
        }
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Zone summary
  const zoneSummary = useMemo(() => {
    return Object.entries(configs).map(([name, config]) => {
      let count = 0;
      if (name === 'playerHand' && spaceState?.playerHand) {
        count = spaceState.playerHand.length;
      } else if (name === 'dealerHand' && spaceState?.dealerHand) {
        count = spaceState.dealerHand.length;
      } else if (name === 'deck' && spaceState?.deck) {
        count = spaceState.deck.remaining;
      } else if (name.startsWith('cell') && spaceState?.board) {
        const idx = parseInt(name.replace('cell', ''));
        count = spaceState.board[idx]?.value ? 1 : 0;
      } else if (spaceState?.zones?.[name]) {
        count = spaceState.zones[name].length;
      }
      return `${config.label || name} (${count})`;
    }).join(' | ');
  }, [configs, spaceState]);

  return html`
    <div class="token-canvas-container" ref=${containerRef}>
      <div class="canvas-toolbar">
        <span class="toolbar-title">Token Canvas</span>
        <div class="toolbar-controls">
          <label class="toolbar-checkbox">
            <input type="checkbox" checked=${showGrid} onChange=${e => setShowGrid(e.target.checked)} />
            <span>Grid</span>
          </label>
          <label class="toolbar-checkbox">
            <input type="checkbox" checked=${snapToGrid} onChange=${e => setSnapToGrid(e.target.checked)} />
            <span>Snap</span>
          </label>
          <label class="toolbar-checkbox">
            <input type="checkbox" checked=${showLabels} onChange=${e => setShowLabels(e.target.checked)} />
            <span>Labels</span>
          </label>
          <div class="zoom-control">
            <button onClick=${() => setZoom(z => Math.max(0.5, z - 0.1))} title="Zoom out">-</button>
            <span class="zoom-value">${Math.round(zoom * 100)}%</span>
            <button onClick=${() => setZoom(z => Math.min(2, z + 0.1))} title="Zoom in">+</button>
          </div>
          <button
            class="toolbar-btn"
            onClick=${() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            title="Reset view"
          >
            Reset
          </button>
        </div>
      </div>

      <canvas
        ref=${canvasRef}
        class="token-canvas ${dragging ? 'dragging' : ''}"
        onMouseDown=${handleMouseDown}
        onMouseMove=${handleMouseMove}
        onMouseUp=${handleMouseUp}
        onMouseLeave=${handleMouseUp}
        onDblClick=${handleDoubleClick}
        onWheel=${handleWheel}
      />

      <div class="canvas-footer">
        <span class="zone-summary">${zoneSummary || 'No zones'}</span>
        ${selectedTokens.size > 0 && html`
          <span class="selected-info">
            Selected: ${selectedTokens.size === 1
              ? (selectedToken?.token?.display || selectedToken?.token?.rank || selectedToken?.id)
              : `${selectedTokens.size} tokens`}
          </span>
          <span class="keyboard-hints">
            <kbd>Del</kbd> remove
            ${selectedTokens.size === 1 && !selectedToken?.isTicTacToe && html`<kbd>F</kbd> flip`}
            <kbd>Esc</kbd> deselect
            <kbd>Shift+click</kbd> multi-select
          </span>
        `}
      </div>
    </div>
  `;
}

// === Token Detail Modal ===

function TokenDetailModal({ token, zones, onFlip, onMove, onRemove, onClose }) {
  if (!token) return null;

  const t = token.token || {};
  const suitSymbols = {
    hearts: '\u2665', diamonds: '\u2666', diams: '\u2666', clubs: '\u2663', spades: '\u2660'
  };
  const suitNames = {
    hearts: 'Hearts', diamonds: 'Diamonds', diams: 'Diamonds', clubs: 'Clubs', spades: 'Spades'
  };

  const suitSymbol = suitSymbols[t.suit] || '?';
  const suitName = suitNames[t.suit] || t.suit || 'Unknown';
  const isRed = t.suit === 'hearts' || t.suit === 'diams' || t.suit === 'diamonds';

  let rankName = t.rank;
  if (typeof t.rank === 'number') {
    rankName = { 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' }[t.rank] || String(t.rank);
  } else if (t.rank) {
    rankName = { 'A': 'Ace', 'J': 'Jack', 'Q': 'Queen', 'K': 'King' }[t.rank] || t.rank;
  }

  const handleBackdropClick = (e) => {
    if (e.target.classList.contains('token-detail-modal')) {
      onClose();
    }
  };

  return html`
    <div class="token-detail-modal" onClick=${handleBackdropClick}>
      <div class="token-detail-content">
        <div class="detail-header">
          <span>Token Details</span>
          <button class="close-btn" onClick=${onClose}>\u00d7</button>
        </div>

        <div class="detail-body">
          <div class="card-preview ${isRed ? 'red' : 'black'}">
            ${token.faceUp ? html`
              <div class="preview-rank">${t.rank || '?'}</div>
              <div class="preview-suit">${suitSymbol}</div>
            ` : html`
              <div class="preview-back">?</div>
            `}
          </div>

          <div class="card-info">
            <h3>${rankName || 'Unknown'} of ${suitName}</h3>
            <p class="card-value">Value: ${t.value || (typeof t.rank === 'number' ? Math.min(t.rank, 10) : '?')}</p>
          </div>

          <div class="detail-section">
            <h4>Placement</h4>
            <ul>
              <li><span class="detail-label">Zone:</span> ${token.zoneName}</li>
              <li><span class="detail-label">Position:</span> (${Math.round(token.x)}, ${Math.round(token.y)})</li>
              <li><span class="detail-label">Face:</span> ${token.faceUp ? 'Up' : 'Down'}</li>
              <li><span class="detail-label">ID:</span> ${token.id}</li>
            </ul>
          </div>

          ${t.id || t.index !== undefined ? html`
            <div class="detail-section">
              <h4>Token</h4>
              <ul>
                ${t.id && html`<li><span class="detail-label">Token ID:</span> ${t.id}</li>`}
                ${t.index !== undefined && html`<li><span class="detail-label">Index:</span> ${t.index}</li>`}
              </ul>
            </div>
          ` : null}
        </div>

        <div class="detail-actions">
          <button class="action-btn" onClick=${() => onFlip?.(token)}>
            ${token.faceUp ? '\u25bc Flip Down' : '\u25b2 Flip Up'}
          </button>
          <select
            class="action-select"
            onChange=${e => e.target.value && onMove?.(token, e.target.value)}
            value=""
          >
            <option value="">Move to...</option>
            ${zones.filter(z => z !== token.zoneName).map(z => html`
              <option value=${z}>${z}</option>
            `)}
          </select>
          <button class="action-btn danger" onClick=${() => onRemove?.(token)}>
            Remove
          </button>
        </div>
      </div>
    </div>
  `;
}

// === Zone Editor Modal ===

function ZoneEditorModal({ zoneName, config, tokenCount, onUpdate, onClear, onDelete, onLayout, onClose }) {
  const [label, setLabel] = useState(config?.label || zoneName);
  const [x, setX] = useState(config?.x || 0);
  const [y, setY] = useState(config?.y || 0);
  const [width, setWidth] = useState(config?.width || 100);
  const [height, setHeight] = useState(config?.height || 100);

  const handleSave = () => {
    onUpdate?.(zoneName, { label, x, y, width, height });
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target.classList.contains('zone-editor-modal')) {
      onClose();
    }
  };

  return html`
    <div class="zone-editor-modal" onClick=${handleBackdropClick}>
      <div class="zone-editor-content">
        <div class="editor-header">
          <span>Zone: ${zoneName}</span>
          <button class="close-btn" onClick=${onClose}>\u00d7</button>
        </div>

        <div class="editor-body">
          <div class="form-group">
            <label>Label</label>
            <input
              type="text"
              value=${label}
              onInput=${e => setLabel(e.target.value)}
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>X</label>
              <input type="number" value=${x} onInput=${e => setX(parseInt(e.target.value) || 0)} />
            </div>
            <div class="form-group">
              <label>Y</label>
              <input type="number" value=${y} onInput=${e => setY(parseInt(e.target.value) || 0)} />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Width</label>
              <input type="number" value=${width} onInput=${e => setWidth(parseInt(e.target.value) || 0)} />
            </div>
            <div class="form-group">
              <label>Height</label>
              <input type="number" value=${height} onInput=${e => setHeight(parseInt(e.target.value) || 0)} />
            </div>
          </div>

          <div class="form-section">
            <h4>Layout</h4>
            <div class="layout-buttons">
              <button onClick=${() => onLayout?.(zoneName, 'fan')}>Fan</button>
              <button onClick=${() => onLayout?.(zoneName, 'stack')}>Stack</button>
              <button onClick=${() => onLayout?.(zoneName, 'spread')}>Spread</button>
              <button onClick=${() => onLayout?.(zoneName, 'grid')}>Grid</button>
            </div>
          </div>

          <div class="zone-stats">
            Contains: ${tokenCount} tokens
          </div>
        </div>

        <div class="editor-footer">
          <button class="footer-btn danger" onClick=${() => { onClear?.(zoneName); }}>
            Clear Zone
          </button>
          <button class="footer-btn danger" onClick=${() => { onDelete?.(zoneName); onClose(); }}>
            Delete Zone
          </button>
          <button class="footer-btn primary" onClick=${handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  `;
}

// === Main Wrapper Component ===

function TokenCanvasPanel({ getSpaceState, gameType, onLog }) {
  const [spaceState, setSpaceState] = useState(null);
  const [selectedTokens, setSelectedTokens] = useState(new Set());
  const [editingZone, setEditingZone] = useState(null);
  const [zoneConfigs, setZoneConfigs] = useState(null);

  const prevStateRef = useRef(null);
  const panelRef = useRef(null);

  // Helper to get first selected token (for backwards compatibility)
  const selectedToken = useMemo(() => {
    if (selectedTokens.size === 0) return null;
    const firstId = Array.from(selectedTokens)[0];
    // Return token-like object with the id
    return { id: firstId };
  }, [selectedTokens]);

  // Poll for state changes
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const newState = getSpaceState?.();
        if (newState && JSON.stringify(newState) !== JSON.stringify(prevStateRef.current)) {
          setSpaceState(newState);
          prevStateRef.current = newState;
        }
      } catch (err) {
        console.error('Token Canvas state error:', err);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [getSpaceState]);

  // Keyboard shortcuts: Delete to remove, F to flip, Escape to deselect, A to select all
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in an input
      if (document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      // Ignore if a modal is open
      if (editingZone) return;

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          if (selectedTokens.size > 0) {
            e.preventDefault();
            const count = selectedTokens.size;
            onLog?.(`Removed ${count} token${count > 1 ? 's' : ''}`, 'info');
            setSelectedTokens(new Set());
          }
          break;
        case 'f':
        case 'F':
          if (selectedTokens.size > 0) {
            e.preventDefault();
            const count = selectedTokens.size;
            onLog?.(`Flipped ${count} token${count > 1 ? 's' : ''}`, 'info');
            // Note: In a real implementation, this would dispatch an action to flip the cards
            setSelectedTokens(new Set());
          }
          break;
        case 'Escape':
          if (selectedTokens.size > 0) {
            e.preventDefault();
            setSelectedTokens(new Set());
          }
          break;
        case 'a':
        case 'A':
          // Ctrl/Cmd+A to select all
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            // Select all tokens from current space state
            // This would need to iterate through all tokens in the state
            onLog?.('Select all tokens', 'info');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTokens, editingZone, onLog]);

  // Determine game type from state
  const effectiveGameType = useMemo(() => {
    if (gameType) return gameType;
    if (spaceState?.gameType) return spaceState.gameType;
    if (spaceState?.playerHand) return 'blackjack';
    if (spaceState?.board) return 'tictactoe';
    return 'generic';
  }, [gameType, spaceState]);

  // Get current configs
  const currentConfigs = useMemo(() => {
    return zoneConfigs || ZONE_PRESETS[effectiveGameType] || ZONE_PRESETS.generic;
  }, [zoneConfigs, effectiveGameType]);

  // Get zone names
  const zoneNames = useMemo(() => Object.keys(currentConfigs), [currentConfigs]);

  // Handlers
  const handleTokenClick = useCallback((token, event) => {
    const tokenId = token.id;

    if (event?.shiftKey) {
      // Shift+click: Toggle token in selection (add/remove from set)
      setSelectedTokens(prev => {
        const next = new Set(prev);
        if (next.has(tokenId)) {
          next.delete(tokenId);
        } else {
          next.add(tokenId);
        }
        return next;
      });
    } else if (event?.ctrlKey || event?.metaKey) {
      // Ctrl/Cmd+click: Add to selection without clearing
      setSelectedTokens(prev => {
        const next = new Set(prev);
        next.add(tokenId);
        return next;
      });
    } else {
      // Regular click: Toggle single selection
      setSelectedTokens(prev => {
        if (prev.size === 1 && prev.has(tokenId)) {
          return new Set();
        }
        return new Set([tokenId]);
      });
    }
  }, []);

  const handleTokenDoubleClick = useCallback((token) => {
    setSelectedTokens(new Set([token.id]));
  }, []);

  const handleZoneClick = useCallback((zoneName, config, isDoubleClick) => {
    if (isDoubleClick) {
      setEditingZone({ name: zoneName, config });
    }
  }, []);

  const handleTokenMove = useCallback((fromZone, toZone, tokenId, x, y) => {
    onLog?.(`Moved token ${tokenId} from ${fromZone} to ${toZone}`, 'info');
    // In a real implementation, this would dispatch an action to the engine
  }, [onLog]);

  const handleFlip = useCallback((token) => {
    onLog?.(`Flipped token ${token.id}`, 'info');
    setSelectedTokens(new Set());
  }, [onLog]);

  const handleMove = useCallback((token, targetZone) => {
    onLog?.(`Moved token ${token.id} to ${targetZone}`, 'info');
    setSelectedTokens(new Set());
  }, [onLog]);

  const handleRemove = useCallback((token) => {
    onLog?.(`Removed token ${token.id}`, 'info');
    setSelectedTokens(new Set());
  }, [onLog]);

  const handleZoneUpdate = useCallback((zoneName, updates) => {
    setZoneConfigs(prev => ({
      ...(prev || ZONE_PRESETS[effectiveGameType] || ZONE_PRESETS.generic),
      [zoneName]: { ...currentConfigs[zoneName], ...updates }
    }));
    onLog?.(`Updated zone ${zoneName}`, 'info');
  }, [currentConfigs, effectiveGameType, onLog]);

  const handleZoneClear = useCallback((zoneName) => {
    onLog?.(`Cleared zone ${zoneName}`, 'info');
  }, [onLog]);

  const handleZoneDelete = useCallback((zoneName) => {
    onLog?.(`Deleted zone ${zoneName}`, 'info');
    setEditingZone(null);
  }, [onLog]);

  const handleLayout = useCallback((zoneName, pattern) => {
    onLog?.(`Applied ${pattern} layout to ${zoneName}`, 'info');
  }, [onLog]);

  // Get token count for zone
  const getZoneTokenCount = useCallback((zoneName) => {
    if (!spaceState) return 0;
    if (zoneName === 'playerHand') return spaceState.playerHand?.length || 0;
    if (zoneName === 'dealerHand') return spaceState.dealerHand?.length || 0;
    if (zoneName === 'deck') return spaceState.deck?.remaining || 0;
    if (zoneName.startsWith('cell')) {
      const idx = parseInt(zoneName.replace('cell', ''));
      return spaceState.board?.[idx]?.value ? 1 : 0;
    }
    return spaceState.zones?.[zoneName]?.length || 0;
  }, [spaceState]);

  return html`
    <div class="token-canvas-wrapper">
      <${TokenCanvasCore}
        spaceState=${spaceState}
        zoneConfigs=${currentConfigs}
        gameType=${effectiveGameType}
        onTokenClick=${handleTokenClick}
        onTokenDoubleClick=${handleTokenDoubleClick}
        onZoneClick=${handleZoneClick}
        onTokenMove=${handleTokenMove}
        onLog=${onLog}
      />

      ${selectedToken && html`
        <${TokenDetailModal}
          token=${selectedToken}
          zones=${zoneNames}
          onFlip=${handleFlip}
          onMove=${handleMove}
          onRemove=${handleRemove}
          onClose=${() => setSelectedTokens(new Set())}
        />
      `}

      ${editingZone && html`
        <${ZoneEditorModal}
          zoneName=${editingZone.name}
          config=${editingZone.config}
          tokenCount=${getZoneTokenCount(editingZone.name)}
          onUpdate=${handleZoneUpdate}
          onClear=${handleZoneClear}
          onDelete=${handleZoneDelete}
          onLayout=${handleLayout}
          onClose=${() => setEditingZone(null)}
        />
      `}
    </div>
  `;
}

// === Styles ===

const styles = `
.token-canvas-wrapper {
  height: 100%;
  position: relative;
}

.token-canvas-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0a0a0f;
  border: 1px solid #1e293b;
  border-radius: 8px;
  overflow: hidden;
}

.canvas-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid #1e293b;
  flex-shrink: 0;
}

.toolbar-title {
  font-weight: 600;
  color: #e2e8f0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.toolbar-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.toolbar-checkbox {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #94a3b8;
  cursor: pointer;
}

.toolbar-checkbox input {
  cursor: pointer;
  accent-color: #4ade80;
}

.toolbar-btn {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #94a3b8;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #e2e8f0;
}

.zoom-control {
  display: flex;
  align-items: center;
  gap: 4px;
}

.zoom-control button {
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: #e2e8f0;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.zoom-control button:hover {
  background: rgba(255, 255, 255, 0.2);
}

.zoom-value {
  min-width: 40px;
  text-align: center;
  font-size: 11px;
  color: #94a3b8;
}

.token-canvas {
  flex: 1;
  cursor: grab;
  display: block;
}

.token-canvas:active,
.token-canvas.dragging {
  cursor: grabbing;
}

.canvas-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid #1e293b;
  flex-shrink: 0;
}

.zone-summary {
  font-size: 11px;
  color: #64748b;
}

.selected-info {
  font-size: 11px;
  color: #4ade80;
}

.keyboard-hints {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  color: #64748b;
  margin-left: 12px;
  padding-left: 12px;
  border-left: 1px solid #334155;
}

.keyboard-hints kbd {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 3px;
  padding: 1px 5px;
  font-family: inherit;
  font-size: 9px;
  color: #94a3b8;
  margin-right: 2px;
}

/* Token Detail Modal */
.token-detail-modal {
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
}

.token-detail-content {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 12px;
  width: 90%;
  max-width: 340px;
  overflow: hidden;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid #1e293b;
  font-weight: 600;
  color: #e2e8f0;
  font-size: 13px;
}

.close-btn {
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 18px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
}

.detail-body {
  padding: 16px;
}

.card-preview {
  width: 70px;
  height: 98px;
  background: #ffffff;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  font-family: serif;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.card-preview.red {
  color: #dc2626;
}

.card-preview.black {
  color: #1e293b;
}

.preview-rank {
  font-size: 18px;
  font-weight: bold;
}

.preview-suit {
  font-size: 28px;
}

.preview-back {
  font-size: 28px;
  color: #3b82f6;
}

.card-info {
  text-align: center;
  margin-bottom: 16px;
}

.card-info h3 {
  margin: 0;
  color: #e2e8f0;
  font-size: 15px;
}

.card-value {
  margin: 4px 0 0;
  color: #94a3b8;
  font-size: 12px;
}

.detail-section {
  margin-bottom: 16px;
}

.detail-section h4 {
  margin: 0 0 8px;
  color: #94a3b8;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-section ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.detail-section li {
  font-size: 12px;
  color: #e2e8f0;
  padding: 4px 0;
  border-bottom: 1px solid #1e293b;
}

.detail-section li:last-child {
  border-bottom: none;
}

.detail-label {
  color: #64748b;
  margin-right: 8px;
}

.detail-actions {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #1e293b;
}

.action-btn {
  flex: 1;
  padding: 8px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid #334155;
  border-radius: 4px;
  color: #e2e8f0;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.action-btn.danger {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
  color: #f87171;
}

.action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.3);
}

.action-select {
  flex: 1;
  padding: 8px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid #334155;
  border-radius: 4px;
  color: #e2e8f0;
  font-size: 11px;
  cursor: pointer;
}

.action-select option {
  background: #0f172a;
}

/* Zone Editor Modal */
.zone-editor-modal {
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
}

.zone-editor-content {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 12px;
  width: 90%;
  max-width: 380px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid #1e293b;
  font-weight: 600;
  color: #e2e8f0;
  font-size: 13px;
}

.editor-body {
  padding: 16px;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 10px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-group input {
  width: 100%;
  padding: 8px 12px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 4px;
  color: #e2e8f0;
  font-size: 13px;
}

.form-group input:focus {
  outline: none;
  border-color: #4ade80;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-row .form-group {
  flex: 1;
}

.form-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #1e293b;
}

.form-section h4 {
  margin: 0 0 8px;
  color: #e2e8f0;
  font-size: 12px;
}

.layout-buttons {
  display: flex;
  gap: 8px;
}

.layout-buttons button {
  flex: 1;
  padding: 8px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid #334155;
  border-radius: 4px;
  color: #e2e8f0;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.layout-buttons button:hover {
  background: rgba(255, 255, 255, 0.15);
}

.zone-stats {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #1e293b;
  font-size: 12px;
  color: #64748b;
}

.editor-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #1e293b;
}

.footer-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.footer-btn.primary {
  background: #3b82f6;
  color: white;
  margin-left: auto;
}

.footer-btn.primary:hover {
  background: #2563eb;
}

.footer-btn.danger {
  background: transparent;
  border: 1px solid rgba(239, 68, 68, 0.5);
  color: #f87171;
}

.footer-btn.danger:hover {
  background: rgba(239, 68, 68, 0.2);
}
`;

// === Export ===

/**
 * Initialize the Token Canvas component
 * @param {HTMLElement} container - Container element to render into
 * @param {Object} options - Configuration options
 * @param {Function} options.getSpaceState - Function that returns the current space/game state
 * @param {string} options.gameType - Type of game ('blackjack', 'tictactoe', 'generic')
 * @param {Function} options.onLog - Logging callback
 * @returns {Function} Cleanup function
 */
export function initTokenCanvas(container, options = {}) {
  // Inject styles
  if (!document.getElementById('token-canvas-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'token-canvas-styles';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  // Render component
  render(html`<${TokenCanvasPanel} ...${options} />`, container);

  // Return cleanup function
  return () => {
    render(null, container);
  };
}

export { TokenCanvasPanel, TokenCanvasCore, ZONE_PRESETS, CARD_WIDTH, CARD_HEIGHT };
