/**
 * Confluence Web Client
 *
 * Browser UI for the CRDT territory game. Demonstrates:
 * - Real-time multiplayer sync via HyperToken Engine
 * - CRDT merge of concurrent writes (contested cells)
 * - Token provenance visualization
 * - Offline editing with seamless reconnection
 */

// Static imports — esbuild bundles these into the output file
import { Engine } from '../../../engine/Engine';
import {
  setupConfluenceSync,
  getBoard,
  getScores,
  getTimeRemainingSec,
  isGameOver,
} from '../crdt-actions';

console.log('[Confluence] Modules loaded successfully');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================================
// Application State
// ============================================================================

const state = {
  // Engine
  engine: null,
  connected: false,
  offlineMode: false,

  // Player
  peerId: null,
  playerName: '',
  serverUrl: 'ws://localhost:3000',

  // Game
  gameStarted: false,
  gameEnded: false,
  lastPeerId: 0,

  // Interaction
  selectedTokenId: null,
  interactionMode: null, // 'select', 'merge', 'split'
  hoveredTokenId: null,

  // Timer
  timerInterval: null,
  lastTimeUpdate: 0,

  // UI
  showOfflineBanner: true,
};

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {
  // Screens
  startScreen: document.getElementById('start-screen'),
  gameScreen: document.getElementById('game-screen'),
  gameOverScreen: document.getElementById('game-over-screen'),

  // Forms
  startForm: document.getElementById('start-form'),
  playerNameInput: document.getElementById('player-name'),
  serverUrlInput: document.getElementById('server-url'),

  // Buttons
  btnJoin: document.getElementById('btn-join'),
  btnRules: document.getElementById('btn-rules'),
  btnRulesInline: document.getElementById('btn-rules-inline'),
  btnScan: document.getElementById('btn-scan'),
  btnEnd: document.getElementById('btn-end'),
  btnOffline: document.getElementById('btn-offline'),
  btnPlayAgain: document.getElementById('btn-play-again'),
  btnNewLobby: document.getElementById('btn-new-lobby'),
  btnCloseRules: document.getElementById('btn-close-rules'),

  // Modals
  rulesOverlay: document.getElementById('rules-overlay'),

  // Game UI
  gameBoard: document.getElementById('game-board'),
  scorePanel: document.getElementById('score-panel'),
  mobileScorePanel: document.getElementById('mobile-score-panel'),
  timer: document.getElementById('timer'),
  timerValue: document.getElementById('timer-value'),
  syncIndicator: document.getElementById('sync-indicator'),
  syncText: document.getElementById('sync-text'),
  peerCount: document.getElementById('peer-count'),
  instructionText: document.getElementById('instruction-text'),
  offlineBanner: document.getElementById('offline-banner'),
  offlineTitle: document.getElementById('offline-title'),
  offlineDesc: document.getElementById('offline-desc'),

  // Game over
  winnerDisplay: document.getElementById('winner-display'),
  gameOverTitle: document.getElementById('game-over-title'),
  gameOverSubtitle: document.getElementById('game-over-subtitle'),
  finalScores: document.getElementById('final-scores'),

  // Provenance
  provenanceTooltip: document.getElementById('provenance-tooltip'),
  provenanceTree: document.getElementById('provenance-tree'),

  // Accessibility
  srAnnouncements: document.getElementById('sr-announcements'),
};

// ============================================================================
// Initialization
// ============================================================================

function initApp() {
  // Load saved preferences
  const savedName = localStorage.getItem('confluence playerName');
  const savedServer = localStorage.getItem('confluence serverUrl');

  if (savedName) elements.playerNameInput.value = savedName;
  if (savedServer) elements.serverUrlInput.value = savedServer;

  // Bind events
  bindEvents();

  // Generate peer ID (will be overwritten by network peerId after connection)
  state.peerId = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.log('[Confluence] App initialized, temp peerId:', state.peerId);
}

function bindEvents() {
  // Start form
  elements.startForm.addEventListener('submit', handleStart);
  elements.btnRules.addEventListener('click', () => showRules());
  elements.btnCloseRules.addEventListener('click', () => hideRules());
  elements.rulesOverlay.addEventListener('click', (e) => {
    if (e.target === elements.rulesOverlay) hideRules();
  });

  // Game controls
  elements.btnRulesInline.addEventListener('click', () => showRules());
  elements.btnEnd.addEventListener('click', handleEndGame);
  elements.btnOffline.addEventListener('click', toggleOfflineMode);
  elements.btnPlayAgain.addEventListener('click', handlePlayAgain);
  elements.btnNewLobby.addEventListener('click', handleNewLobby);

  // Start game button
  const btnStartGame = document.getElementById('btn-start-game');
  if (btnStartGame) btnStartGame.addEventListener('click', startGame);

  // Board interactions
  elements.gameBoard.addEventListener('click', handleBoardClick);
  elements.gameBoard.addEventListener('mouseover', handleBoardHover);
  elements.gameBoard.addEventListener('mouseout', handleBoardHoverOut);

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);

  // Window events
  window.addEventListener('beforeunload', handleUnload);
  window.addEventListener('resize', handleResize);
}

// ============================================================================
// Game Start / Connection
// ============================================================================

async function handleStart(e) {
  e.preventDefault();

  const name = elements.playerNameInput.value.trim() || 'Player';
  const serverUrl = elements.serverUrlInput.value.trim() || 'ws://localhost:3000';

  // Save preferences
  localStorage.setItem('confluence playerName', name);
  localStorage.setItem('confluence serverUrl', serverUrl);

  state.playerName = name;
  state.serverUrl = serverUrl;

  // Disable join button
  elements.btnJoin.disabled = true;
  elements.btnJoin.textContent = 'Connecting...';

  try {
    // Create engine with WASM disabled for browser compatibility
    state.engine = new Engine({ disableWasm: true });

    // Set up Confluence sync
    setupConfluenceSync(state.engine);

    // Listen for state updates
    state.engine.on('confluence:updated', handleStateUpdate);
    state.engine.on('confluence:ready', handleGameReady);
    state.engine.on('confluence:ended', handleGameEnded);
    state.engine.on('net:ready', handleConnected);
    state.engine.on('net:disconnected', handleDisconnected);
    state.engine.on('net:peer:connected', handlePeerJoined);
    state.engine.on('net:peer:disconnected', handlePeerLeft);

    // Connect to relay first
    state.engine.connect(state.serverUrl);

    // Wait a moment for connection, then check if a game already exists
    await sleep(1000);

    const existingState = state.engine.session.state?.confluence;
    if (!existingState) {
      // No game exists yet — we're the first player, initialize the game
      console.log('[Confluence] No existing game found, initializing...');
      await state.engine.dispatch('confluence:init', {
        width: 10,
        height: 10,
        durationMs: 30000,
      });
    } else {
      console.log('[Confluence] Found existing game, joining...');
    }

    // Register player (use relay-assigned peerId if available, otherwise temp)
    const peerId = state.engine.network?.peerId || state.peerId;
    state.peerId = peerId;
    state.engine.dispatch('confluence:register', {
      peerId,
      name: state.playerName,
    });

    announce('Connected to game. Place your tokens!');
  } catch (error) {
    console.error('[Confluence] Start error:', error);
    showError(`Failed to connect: ${error.message}`);
    elements.btnJoin.disabled = false;
    elements.btnJoin.textContent = 'Join Game';
  }
}

function handleGameReady() {
  console.log('[Confluence] Game ready');
  state.gameStarted = true;

  // Show game screen
  elements.startScreen.classList.add('hidden');
  elements.gameScreen.classList.add('active');

  // Show waiting overlay — don't start timer until players join
  showWaitingOverlay();

  // Initial render
  render();
}

function showWaitingOverlay() {
  const overlay = document.getElementById('waiting-overlay');
  const urlEl = document.getElementById('waiting-url');
  const playersEl = document.getElementById('waiting-players');

  if (urlEl) urlEl.textContent = state.serverUrl;
  if (playersEl) playersEl.textContent = `Players connected: ${getPlayerCount()}`;

  overlay.classList.add('visible');
}

function hideWaitingOverlay() {
  const overlay = document.getElementById('waiting-overlay');
  overlay.classList.remove('visible');
}

function getPlayerCount() {
  const confluenceState = state.engine?.session?.state?.confluence;
  if (!confluenceState?.players) return 1;
  return Object.keys(confluenceState.players).length;
}

function startGame() {
  hideWaitingOverlay();
  startTimer();
  announce('Game started! Place your tokens!');
}

function handleStateUpdate(event) {
  // Re-render on state update
  requestAnimationFrame(render);
}

function handleConnected(event) {
  state.connected = true;

  // Get actual peerId from network
  const networkPeerId = event?.peerId || state.engine?.network?.peerId;
  if (networkPeerId) {
    state.peerId = networkPeerId;
    console.log('[Confluence] Assigned peerId:', state.peerId);
  }

  updateSyncStatus('connected', 'Connected');
  updatePeerCount();
  console.log('[Confluence] Connected to relay');
}

function handleDisconnected(event) {
  state.connected = false;
  updateSyncStatus('offline', 'Offline');

  if (!state.offlineMode) {
    // Show offline banner if not intentionally offline
    showOfflineBanner('Disconnected', 'Click "Reconnect" to sync with other players');
    elements.btnOffline.textContent = 'Reconnect';
  }
}

function handlePeerJoined(event) {
  const peerId = event?.peerId || event?.payload?.peerId;
  console.log('[Confluence] Peer joined:', peerId);
  updatePeerCount();

  // Update waiting overlay if visible
  const overlay = document.getElementById('waiting-overlay');
  if (overlay && overlay.classList.contains('visible')) {
    const playersEl = document.getElementById('waiting-players');
    if (playersEl) playersEl.textContent = `Players connected: ${getPlayerCount()}`;
  }

  announce('A player joined the game');
}

function handlePeerLeft(event) {
  const peerId = event?.peerId || event?.payload?.peerId;
  console.log('[Confluence] Peer left:', peerId);
  updatePeerCount();
  announce('A player left the game');
}

function updatePeerCount() {
  // Count players from the confluence state (registered players)
  const confluenceState = state.engine?.session?.state?.confluence;
  const playerCount = confluenceState?.players ? Object.keys(confluenceState.players).length : 1;
  elements.peerCount.textContent = `${playerCount} player${playerCount !== 1 ? 's' : ''}`;
}

function handleGameEnded(event) {
  state.gameEnded = true;
  stopTimer();
  showGameOver();
}

// ============================================================================
// Timer
// ============================================================================

function startTimer() {
  stopTimer();

  const updateTimer = () => {
    const seconds = getTimeRemainingSec(state.engine);
    elements.timerValue.textContent = seconds;

    // Update urgency styling
    elements.timer.classList.remove('warning', 'critical');
    if (seconds <= 10 && seconds > 5) {
      elements.timer.classList.add('warning');
    } else if (seconds <= 5) {
      elements.timer.classList.add('critical');
    }

    // Check for game end
    if (seconds <= 0 && !state.gameEnded) {
      // Dispatch confluence:end to compute winner and sync to peers
      try {
        state.engine.dispatch('confluence:end', { peerId: state.peerId });
      } catch (e) {
        // Game may have already ended via peer sync
      }
      handleGameEnded();
    }
  };

  updateTimer();
  state.timerInterval = setInterval(updateTimer, 100);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

// ============================================================================
// Board Rendering
// ============================================================================

function render() {
  if (!state.engine?.session?.state?.confluence) return;

  const board = getBoard(state.engine);
  const scores = getScores(state.engine);

  renderBoard(board);
  renderScores(scores);
  renderInstructions();
}

function renderBoard(board) {
  if (!board) return;

  // Clear board
  elements.gameBoard.innerHTML = '';

  // Create cells
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const cell = board.cells[y][x];
      const cellEl = document.createElement('div');
      cellEl.className = 'cell';
      cellEl.dataset.x = x;
      cellEl.dataset.y = y;
      cellEl.setAttribute('role', 'gridcell');
      cellEl.setAttribute('aria-label', `Cell ${x}, ${y}${cell.contested ? ', contested' : ''}`);
      cellEl.setAttribute('tabindex', '0');

      // Contested styling
      if (cell.contested) {
        cellEl.classList.add('contested');
      }

      // Highlight modes
      if (state.interactionMode === 'split' && cell.tokens.length === 0) {
        const selectedToken = getTokenById(state.selectedTokenId);
        if (selectedToken && isAdjacent(selectedToken, x, y)) {
          cellEl.classList.add('highlighted');
          cellEl.classList.add('targetable');
        }
      }

      // Render tokens
      if (cell.tokens.length > 0) {
        const container = document.createElement('div');
        container.className = 'token-container';

        for (const token of cell.tokens) {
          const tokenEl = createTokenElement(token);
          container.appendChild(tokenEl);
        }

        cellEl.appendChild(container);
      }

      elements.gameBoard.appendChild(cellEl);
    }
  }
}

function createTokenElement(token) {
  const tokenEl = document.createElement('div');
  tokenEl.className = `token strength-${token.strength}`;
  tokenEl.dataset.tokenId = token.id;
  tokenEl.textContent = token.strength;
  tokenEl.setAttribute('role', 'button');
  tokenEl.setAttribute('tabindex', '0');
  tokenEl.setAttribute('aria-label', `Your token, strength ${token.strength}`);

  // Get player color
  const playerState = state.engine.session.state.confluence.players[token.playerId];
  const color = playerState?.color || '#888888';
  tokenEl.style.color = color;
  tokenEl.style.setProperty('--player-color', color);

  // Current player highlighting
  if (token.playerId === state.peerId) {
    tokenEl.setAttribute('aria-label', `Your token, strength ${token.strength}`);
  } else {
    tokenEl.setAttribute('aria-label', `Opponent token, strength ${token.strength}`);
  }

  // Selected state
  if (state.selectedTokenId === token.id) {
    tokenEl.classList.add('selected');
  }

  // Merge target highlighting
  if (state.interactionMode === 'merge' && state.selectedTokenId) {
    const selectedToken = getTokenById(state.selectedTokenId);
    if (selectedToken &&
        selectedToken.playerId === token.playerId &&
        selectedToken.id !== token.id &&
        isAdjacent(selectedToken, token.x, token.y)) {
      tokenEl.classList.add('merge-target');
    }
  }

  // Event listeners
  tokenEl.addEventListener('click', (e) => {
    e.stopPropagation();
    handleTokenClick(token);
  });

  tokenEl.addEventListener('mouseenter', () => {
    state.hoveredTokenId = token.id;
    showProvenance(token);
  });

  tokenEl.addEventListener('mouseleave', () => {
    state.hoveredTokenId = null;
    hideProvenance();
  });

  return tokenEl;
}

function renderScores(scores) {
  if (!scores) return;

  const createScoreCard = (score, isMobile = false) => {
    const card = document.createElement('div');
    card.className = 'player-score';
    card.style.setProperty('--player-color', score.color);

    const isCurrentPlayer = score.playerId === state.peerId;
    if (isCurrentPlayer) {
      card.classList.add('current-player');
    }

    const maxTerritory = 100; // 10x10 grid
    const territoryPercent = Math.min(100, (score.controlledCells / maxTerritory) * 100);

    card.innerHTML = `
      <div class="player-score-header">
        <span class="player-name">
          <span class="player-color-dot" style="background: ${score.color}"></span>
          ${escapeHtml(score.name)}${isCurrentPlayer ? ' (You)' : ''}
        </span>
      </div>
      <div class="player-stats">
        <div class="stat">
          <div class="stat-value">${score.controlledCells}</div>
          <div class="stat-label">Controlled</div>
        </div>
        <div class="stat">
          <div class="stat-value">${score.contestedCells}</div>
          <div class="stat-label">Contested</div>
        </div>
      </div>
      <div class="territory-bar">
        <div class="territory-fill" style="width: ${territoryPercent}%; background: ${score.color}"></div>
      </div>
    `;

    return card;
  };

  // Desktop panel
  elements.scorePanel.innerHTML = '';
  for (const score of scores) {
    elements.scorePanel.appendChild(createScoreCard(score));
  }

  // Mobile panel
  elements.mobileScorePanel.innerHTML = '';
  for (const score of scores) {
    const mobileCard = createScoreCard(score, true);
    mobileCard.style.flex = '0 0 120px';
    mobileCard.style.padding = '12px';
    elements.mobileScorePanel.appendChild(mobileCard);
  }
}

function renderInstructions() {
  let text = 'Click an empty cell to place a token';

  if (state.selectedTokenId) {
    const token = getTokenById(state.selectedTokenId);
    if (token) {
      if (token.strength >= 2) {
        text = 'Click adjacent empty cell to SPLIT, or another token to MERGE';
      } else {
        text = 'Click adjacent token to MERGE, or ESC to deselect';
      }
    }
  }

  if (state.offlineMode) {
    text += ' [OFFLINE MODE - changes will sync on reconnect]';
  }

  elements.instructionText.textContent = text;
}

// ============================================================================
// Interaction Handling
// ============================================================================

function handleBoardClick(e) {
  const cell = e.target.closest('.cell');
  if (!cell) return;

  const x = parseInt(cell.dataset.x);
  const y = parseInt(cell.dataset.y);

  if (state.selectedTokenId) {
    // Try to split
    const token = getTokenById(state.selectedTokenId);
    if (token && token.strength >= 2) {
      handleSplit(token, x, y);
    }
    clearSelection();
  } else {
    // Place token
    handlePlace(x, y);
  }
}

function handleTokenClick(token) {
  if (token.playerId !== state.peerId) {
    // Can only interact with own tokens
    return;
  }

  if (state.selectedTokenId === token.id) {
    // Deselect
    clearSelection();
  } else if (state.selectedTokenId) {
    // Try to merge
    const selectedToken = getTokenById(state.selectedTokenId);
    if (selectedToken && selectedToken.playerId === token.playerId) {
      handleMerge(selectedToken, token);
      clearSelection();
    } else {
      // Select new token
      selectToken(token.id);
    }
  } else {
    // Select token
    selectToken(token.id);
  }
}

function handlePlace(x, y) {
  if (!state.engine || state.gameEnded) return;

  try {
    state.engine.dispatch('confluence:place', {
      x,
      y,
      peerId: state.peerId,
    });
    announce('Token placed');
  } catch (error) {
    console.warn('[Confluence] Place failed:', error.message);
  }
}

function handleMerge(tokenA, tokenB) {
  if (!state.engine || state.gameEnded) return;

  try {
    state.engine.dispatch('confluence:merge', {
      tokenIdA: tokenA.id,
      tokenIdB: tokenB.id,
      peerId: state.peerId,
    });
    announce('Tokens merged');
  } catch (error) {
    console.warn('[Confluence] Merge failed:', error.message);
    showError(`Cannot merge: ${error.message}`);
  }
}

function handleSplit(token, targetX, targetY) {
  if (!state.engine || state.gameEnded) return;

  // Check if target is adjacent and empty
  const board = getBoard(state.engine);
  if (!board) return;

  const targetCell = board.cells[targetY][targetX];
  if (targetCell.tokens.length > 0) {
    showError('Target cell is not empty');
    return;
  }

  if (!isAdjacent(token, targetX, targetY)) {
    showError('Target must be adjacent');
    return;
  }

  try {
    state.engine.dispatch('confluence:split', {
      tokenId: token.id,
      targetX,
      targetY,
      peerId: state.peerId,
    });
    announce('Token split');
  } catch (error) {
    console.warn('[Confluence] Split failed:', error.message);
    showError(`Cannot split: ${error.message}`);
  }
}

function selectToken(tokenId) {
  state.selectedTokenId = tokenId;
  const token = getTokenById(tokenId);

  if (token && token.strength >= 2) {
    state.interactionMode = 'split';
    announce('Token selected. Click adjacent empty cell to split.');
  } else {
    state.interactionMode = 'merge';
    announce('Token selected. Click adjacent token to merge.');
  }

  render();
}

function clearSelection() {
  state.selectedTokenId = null;
  state.interactionMode = null;
  render();
  renderInstructions();
}

function handleBoardHover(e) {
  // Could add hover effects here
}

function handleBoardHoverOut(e) {
  // Could remove hover effects here
}

function handleKeyboard(e) {
  if (e.key === 'Escape') {
    clearSelection();
    hideProvenance();
  }
}

// ============================================================================
// Provenance Visualization
// ============================================================================

function showProvenance(token) {
  const confluenceState = state.engine?.session?.state?.confluence;
  if (!confluenceState) return;

  // Import getProvenanceTree from ConfluenceGame
  // For now, build simple tree from token data
  const tree = buildProvenanceTree(confluenceState, token.id);

  if (!tree || (!tree.parents && !token._mergedFrom && !token._splitFrom)) {
    hideProvenance();
    return;
  }

  elements.provenanceTree.innerHTML = '';

  // Show current token
  const currentNode = document.createElement('div');
  currentNode.className = 'provenance-node';
  const player = confluenceState.players[token.playerId];
  currentNode.innerHTML = `
    <span class="dot" style="background: ${player?.color || '#888'}"></span>
    <span>Strength ${token.strength}</span>
    <span class="type">Current</span>
    <span class="coords">(${token.x}, ${token.y})</span>
  `;
  elements.provenanceTree.appendChild(currentNode);

  // Show parents
  if (tree.parents && tree.parents.length > 0) {
    for (const parent of tree.parents) {
      const parentNode = document.createElement('div');
      parentNode.className = 'provenance-node';
      const parentPlayer = confluenceState.players[parent.token.playerId];
      const parentType = parent.token._mergedFrom ? 'Merged' : 'Split';
      parentNode.innerHTML = `
        <span class="dot" style="background: ${parentPlayer?.color || '#888'}"></span>
        <span>Strength ${parent.token.strength}</span>
        <span class="type">${parentType}</span>
        <span class="coords">(${parent.token.x}, ${parent.token.y})</span>
      `;
      elements.provenanceTree.appendChild(parentNode);
    }
  }

  // Position tooltip near cursor
  elements.provenanceTooltip.classList.add('visible');
  elements.provenanceTooltip.setAttribute('aria-hidden', 'false');
}

function hideProvenance() {
  elements.provenanceTooltip.classList.remove('visible');
  elements.provenanceTooltip.setAttribute('aria-hidden', 'true');
}

function buildProvenanceTree(confluenceState, tokenId, visited = new Set()) {
  if (visited.has(tokenId)) return null;
  visited.add(tokenId);

  const token = confluenceState.tokens[tokenId];
  if (!token) return null;

  const parents = [];

  // Check mergedFrom
  if (token._mergedFrom) {
    for (const parentId of token._mergedFrom) {
      const parent = buildProvenanceTree(confluenceState, parentId, visited);
      if (parent) parents.push(parent);
    }
  }

  // Check splitFrom
  if (token._splitFrom) {
    const parent = buildProvenanceTree(confluenceState, token._splitFrom, visited);
    if (parent) parents.push(parent);
  }

  return { token, parents };
}

// ============================================================================
// Offline Mode Demo
// ============================================================================

function toggleOfflineMode() {
  if (!state.engine) return;

  if (state.offlineMode) {
    // Reconnect
    state.engine.connect(state.serverUrl);
    state.offlineMode = false;
    elements.btnOffline.textContent = 'Go Offline';
    elements.btnOffline.setAttribute('aria-pressed', 'false');
    elements.offlineBanner.classList.remove('offline-mode');
    elements.offlineTitle.textContent = 'Reconnected!';
    elements.offlineDesc.textContent = 'CRDT merged your offline changes with the network state';

    setTimeout(() => {
      hideOfflineBanner();
    }, 3000);
  } else {
    // Disconnect
    state.engine.disconnect();
    state.offlineMode = true;
    elements.btnOffline.textContent = 'Reconnect';
    elements.btnOffline.setAttribute('aria-pressed', 'true');
    elements.offlineBanner.classList.add('offline-mode');
    elements.offlineTitle.textContent = 'Offline Mode';
    elements.offlineDesc.textContent = 'Place tokens locally. They will sync when you reconnect.';

    showOfflineBanner('Offline Mode Active', 'Place tokens locally - they will merge on reconnect');
  }

  renderInstructions();
}

function showOfflineBanner(title, desc) {
  if (!state.showOfflineBanner) return;

  elements.offlineTitle.textContent = title;
  elements.offlineDesc.textContent = desc;
  elements.offlineBanner.classList.add('visible');
}

function hideOfflineBanner() {
  elements.offlineBanner.classList.remove('visible');
}

// ============================================================================
// Game Over
// ============================================================================

function showGameOver() {
  const confluenceState = state.engine?.session?.state?.confluence;
  if (!confluenceState) return;

  // Hide provenance tooltip
  elements.provenanceTooltip.classList.remove('visible');
  elements.provenanceTooltip.setAttribute('aria-hidden', 'true');

  const scores = getScores(state.engine);
  const winner = confluenceState.winner;

  // Determine winner display
  const winnerPlayer = winner ? confluenceState.players[winner] : null;
  const isTie = !winner && scores.length > 0;
  const isWinner = winner === state.peerId;

  elements.winnerDisplay.classList.toggle('tie', isTie);
  elements.winnerDisplay.classList.toggle('defeat', !isWinner && !isTie);

  if (isWinner) {
    elements.gameOverTitle.textContent = 'Victory!';
    elements.gameOverTitle.style.color = '';
    elements.gameOverSubtitle.textContent = `${winnerPlayer.name} controls the most territory!`;
  } else if (isTie) {
    elements.gameOverTitle.textContent = 'Draw!';
    elements.gameOverTitle.style.color = '';
    elements.gameOverSubtitle.textContent = 'Multiple players tied for first place';
  } else {
    elements.gameOverTitle.textContent = 'Defeat';
    elements.gameOverTitle.style.color = 'var(--accent-red, #e94560)';
    elements.gameOverSubtitle.textContent = `${winnerPlayer?.name || 'Opponent'} controls the most territory!`;
  }

  // Render final scores
  elements.finalScores.innerHTML = '';

  // Sort by controlled cells
  const sortedScores = [...scores].sort((a, b) => b.controlledCells - a.controlledCells);

  for (const score of sortedScores) {
    const card = document.createElement('div');
    card.className = 'final-score-card';

    if (score.playerId === winner) {
      card.classList.add('winner');
    }

    card.innerHTML = `
      <span class="player-color-dot" style="background: ${score.color}"></span>
      <div class="player-name">${escapeHtml(score.name)}${score.playerId === state.peerId ? ' (You)' : ''}</div>
      <div class="score-value">${score.controlledCells}</div>
      <div class="score-label">Territory</div>
    `;

    elements.finalScores.appendChild(card);
  }

  // Show game over screen
  elements.gameOverScreen.classList.add('active');
  announce(`Game over! ${winnerPlayer ? winnerPlayer.name + ' wins!' : 'It\'s a tie!'}`);
}

function handleEndGame() {
  if (!state.engine || state.gameEnded) return;

  try {
    state.engine.dispatch('confluence:end', {
      peerId: state.peerId,
    });
  } catch (error) {
    console.warn('[Confluence] End game failed:', error.message);
  }
}

function handlePlayAgain() {
  // Reset game state
  state.gameEnded = false;
  state.gameStarted = false;
  state.selectedTokenId = null;
  state.interactionMode = null;

  // Hide game over screen
  elements.gameOverScreen.classList.remove('active');

  // Reinitialize game
  state.engine.dispatch('confluence:init', {
    width: 10,
    height: 10,
    durationMs: 30000,
  });

  // Re-register
  state.engine.dispatch('confluence:register', {
    peerId: state.peerId,
    name: state.playerName,
  });

  // Restart timer
  startTimer();

  announce('New game started!');
}

function handleNewLobby() {
  // Full reset
  if (state.engine) {
    state.engine.disconnect();
  }

  state.gameEnded = false;
  state.gameStarted = false;
  state.connected = false;
  state.selectedTokenId = null;
  state.interactionMode = null;

  // Show start screen
  elements.gameOverScreen.classList.remove('active');
  elements.gameScreen.classList.remove('active');
  elements.startScreen.classList.remove('hidden');

  // Reset button
  elements.btnJoin.disabled = false;
  elements.btnJoin.textContent = 'Join Game';

  announce('Returned to lobby');
}

// ============================================================================
// Rules Modal
// ============================================================================

function showRules() {
  elements.rulesOverlay.classList.add('active');
  trapFocus(elements.rulesOverlay);
}

function hideRules() {
  elements.rulesOverlay.classList.remove('active');
  releaseFocusTrap(elements.rulesOverlay);
}

// ============================================================================
// Utilities
// ============================================================================

function getTokenById(tokenId) {
  const confluenceState = state.engine?.session?.state?.confluence;
  if (!confluenceState) return null;

  const token = confluenceState.tokens[tokenId];
  if (!token) return null;

  // Check if consumed
  const consumed = confluenceState.consumed[tokenId];
  if (consumed && Object.keys(consumed).length > 0) return null;

  return token;
}

function isAdjacent(token, x, y) {
  const dx = Math.abs(token.x - x);
  const dy = Math.abs(token.y - y);
  return (dx <= 1 && dy <= 1) && (dx + dy > 0);
}

function updateSyncStatus(status, text) {
  elements.syncIndicator.className = `sync-indicator ${status}`;
  elements.syncText.textContent = text;

  if (status === 'connected') {
    updatePeerCount();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function announce(message) {
  elements.srAnnouncements.textContent = message;
  setTimeout(() => {
    elements.srAnnouncements.textContent = '';
  }, 1000);
}

function showError(message) {
  console.error('[Confluence]', message);
  announce(`Error: ${message}`);
  // Could show a toast notification here
}

function trapFocus(modal) {
  const focusableElements = modal.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  firstElement.focus();

  const handleKeyDown = (e) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  modal._focusTrapHandler = handleKeyDown;
  modal.addEventListener('keydown', handleKeyDown);
}

function releaseFocusTrap(modal) {
  if (modal._focusTrapHandler) {
    modal.removeEventListener('keydown', modal._focusTrapHandler);
    delete modal._focusTrapHandler;
  }
}

function handleUnload() {
  if (state.engine) {
    state.engine.disconnect();
  }
}

function handleResize() {
  // Could adjust board size here if needed
}

// ============================================================================
// Exports (for debugging)
// ============================================================================

window.confluence = {
  getState: () => state,
  getEngine: () => state.engine,
  render,
  showRules,
  hideRules,
};

console.log('[Confluence] Client module loaded. Use window.confluence for debugging.');

// Initialize after all declarations are in scope
initApp();
