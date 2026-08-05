/**
 * Watershed Web Client
 *
 * Browser UI for the CRDT territory game. Demonstrates:
 * - Real-time multiplayer sync via HyperToken Engine
 * - CRDT merge of concurrent writes (contested cells)
 * - Token provenance visualization
 * - Offline editing with seamless reconnection
 */

// Static imports — esbuild bundles these into the output file
import { Engine } from '../../../engine/Engine';
import { IndexedDBAdapter } from '../../../core/storage/IndexedDBAdapter';
import {
  setupWatershedSync,
  getBoard,
  getScores,
  getTimeRemainingSec,
  isGameOver,
} from '../crdt-actions';
import { computeEnergy, ENERGY_PRESETS, DURATION_PRESETS } from '../WatershedGame';

console.log('[Watershed] Modules loaded successfully');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================================
// Application State
// ============================================================================

// Auto-detect WebSocket URL from page location
// In production behind nginx, this becomes wss://yourdomain.com/ws
// In dev, defaults to ws://localhost:3000
function autoDetectWsUrl() {
  if (window.location.protocol === 'file:') return 'ws://localhost:3000';
  const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // If served from standard ports (production behind nginx), use /ws path
  if (window.location.port === '8080' || window.location.port === '') {
    return wsProto + '//' + window.location.host + '/ws';
  }
  return wsProto + '//' + window.location.hostname + ':3000';
}

const state = {
  // Engine
  engine: null,
  connected: false,
  offlineMode: false,

  // Player
  peerId: null,
  playerName: '',
  serverUrl: autoDetectWsUrl(),

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

  // Room / Lobby
  roomCode: null,
  isHost: false,
  lobbyVisible: false,
  registered: false,
  gameReady: false,

  // Energy preset (selected in lobby)
  energyPreset: 'standard',

  // Game length preset (selected in lobby)
  durationPreset: 'sprint',

  // Energy display timer
  energyInterval: null,

  // Bot opponent (single-player mode)
  botEnabled: false,
  botDifficulty: 'normal', // 'easy' | 'normal' | 'hard'
  botTimer: null,
  botPeerId: null,

  // Incremental board rendering — maps tokenId → { element, token } across
  // renders so we can diff and animate additions / removals / changes
  // instead of rebuilding the whole 10×10 grid each frame.
  renderedTokens: new Map(),
  // Maps "x,y" → cell DOM element (rebuilt only when grid dimensions change)
  cellElements: new Map(),
  boardGridKey: '',
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
  btnResume: document.getElementById('btn-resume'),
  btnRules: document.getElementById('btn-rules'),
  btnRulesInline: document.getElementById('btn-rules-inline'),
  btnScan: document.getElementById('btn-scan'),
  btnEnd: document.getElementById('btn-end'),
  btnSave: document.getElementById('btn-save'),
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

  // Room Lobby
  roomLobby: document.getElementById('room-lobby'),
  lobbyConnecting: document.getElementById('lobby-connecting'),
  lobbyRoomSelect: document.getElementById('lobby-room-select'),
  lobbyRoomCode: document.getElementById('lobby-room-code'),
  lobbyWaiting: document.getElementById('lobby-waiting'),
  lobbyError: document.getElementById('lobby-error'),
  lobbyErrorText: document.getElementById('lobby-error-text'),
  lobbyStatusText: document.getElementById('lobby-status-text'),
  lobbyPlayers: document.getElementById('lobby-players'),
  roomCodeText: document.getElementById('room-code-text'),
  roomLink: document.getElementById('room-link'),
  roomCodeInput: document.getElementById('room-code-input'),
  btnCreateRoom: document.getElementById('btn-create-room'),
  btnJoinRoom: document.getElementById('btn-join-room'),
  btnCopyCode: document.getElementById('btn-copy-code'),
  btnCopyLink: document.getElementById('btn-copy-link'),
  btnStartGame: document.getElementById('btn-start-game'),
  btnLobbyRetry: document.getElementById('btn-lobby-retry'),
  btnLobbyCancel: document.getElementById('btn-lobby-cancel'),

  // Energy
  energyBar: document.getElementById('energy-bar'),
  energyFill: document.getElementById('energy-fill'),
  energyValue: document.getElementById('energy-value'),
  energyMax: document.getElementById('energy-max'),
  energyPresetGroup: document.getElementById('energy-preset-group'),

  // Bot opponent
  botToggleGroup: document.getElementById('bot-toggle-group'),

  // Game length
  durationToggleGroup: document.getElementById('duration-toggle-group'),
};

// ============================================================================
// Initialization
// ============================================================================

function initApp() {
  // Load saved preferences
  const savedName = localStorage.getItem('watershed playerName');
  const savedServer = localStorage.getItem('watershed serverUrl');

  if (savedName) elements.playerNameInput.value = savedName;
  if (savedServer) elements.serverUrlInput.value = savedServer;

  // Bind events
  bindEvents();

  // Generate peer ID (will be overwritten by network peerId after connection)
  state.peerId = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.log('[Watershed] App initialized, temp peerId:', state.peerId);

  // Check for existing saves and show Resume button
  checkForSavedGames();
}

async function checkForSavedGames() {
  try {
    const adapter = new IndexedDBAdapter();
    const saves = await adapter.list();
    if (saves.length > 0) {
      const btn = document.getElementById('btn-resume');
      if (btn) {
        btn.style.display = '';
        const latest = saves[0];
        btn.querySelector('span').textContent = `Resume Saved Game (${new Date(latest.timestamp).toLocaleDateString()})`;
      }
    }
  } catch (e) {
    // IndexedDB might not be available
  }
}

async function handleSaveGame() {
  if (!state.engine || !state.storageAdapter) return;
  try {
    await state.engine.persist('watershed-save', 'Manual save');
    announce('Game saved!');
    if (elements.btnSave) {
      elements.btnSave.textContent = 'Saved!';
      setTimeout(() => { elements.btnSave.textContent = 'Save'; }, 2000);
    }
  } catch (e) {
    console.error('[Watershed] Save failed:', e);
    announce('Save failed: ' + e.message);
  }
}

async function handleResumeGame() {
  try {
    state.engine = new Engine();
    state.storageAdapter = new IndexedDBAdapter();
    state.engine.useStorage(state.storageAdapter);
    setupWatershedSync(state.engine);

    state.engine.on('watershed:updated', handleStateUpdate);
    state.engine.on('watershed:ready', handleGameReady);
    state.engine.on('watershed:started', handleGameStarted);
    state.engine.on('watershed:ended', handleGameEnded);
    state.engine.on('watershed:rejected', handlePlacementRejected);

    const loaded = await state.engine.resume('watershed-save');
    if (loaded) {
      console.log('[Watershed] Game resumed from save');
      state.gameStarted = true;
      state.playerName = 'Resumed Player';
      state.peerId = state.engine.network?.peerId || state.peerId;

      elements.startScreen.classList.add('hidden');
      elements.gameScreen.classList.add('active');
      render();
      announce('Game resumed from save');
    } else {
      announce('No saved game found');
    }
  } catch (e) {
    console.error('[Watershed] Resume failed:', e);
    announce('Resume failed: ' + e.message);
  }
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
  elements.btnSave.addEventListener('click', handleSaveGame);
  elements.btnOffline.addEventListener('click', toggleOfflineMode);
  elements.btnPlayAgain.addEventListener('click', handlePlayAgain);
  elements.btnNewLobby.addEventListener('click', handleNewLobby);

  // Resume button
  if (elements.btnResume) {
    elements.btnResume.addEventListener('click', handleResumeGame);
  }

  // Lobby buttons
  elements.btnCreateRoom?.addEventListener('click', createRoom);
  elements.btnJoinRoom?.addEventListener('click', () => {
    joinRoom(elements.roomCodeInput.value);
  });
  elements.roomCodeInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      joinRoom(elements.roomCodeInput.value);
    }
  });
  // Auto-uppercase + format room code as the user types (visual only; joinRoom also uppercases)
  elements.roomCodeInput?.addEventListener('input', () => {
    const raw = elements.roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    elements.roomCodeInput.value = raw;
  });
  elements.btnCopyCode?.addEventListener('click', copyRoomCode);
  elements.btnCopyLink?.addEventListener('click', copyRoomLink);
  elements.btnStartGame?.addEventListener('click', async () => {
    // Initialize game with selected settings (if not already done)
    const existingState = state.engine.session.state?.watershed;
    if (!existingState) {
      try {
        await state.engine.dispatch('watershed:init', {
          width: 10,
          height: 10,
          durationMs: DURATION_PRESETS[state.durationPreset] || DURATION_PRESETS.sprint,
          energyConfig: ENERGY_PRESETS[state.energyPreset] || ENERGY_PRESETS.standard,
        });
      } catch (e) {
        console.warn('[Watershed] init dispatch failed (likely concurrent):', e.message);
      }
    }

    // Register self if not already registered
    const peerId = state.engine.network?.peerId || state.peerId;
    state.peerId = peerId;
    try {
      state.engine.dispatch('watershed:register', {
        peerId,
        name: state.playerName,
      });
    } catch (e) {
      // Already registered — fine
    }

    // startGame() registers bot (if enabled) and dispatches watershed:start
    startGame();
  });
  elements.btnLobbyCancel?.addEventListener('click', () => {
    state.engine?.disconnect();
    hideLobby();
    elements.startScreen.classList.remove('hidden');
    elements.btnJoin.disabled = false;
    elements.btnJoin.textContent = 'Join Game';
  });
  elements.btnLobbyRetry?.addEventListener('click', () => {
    showLobbyState('room-select');
  });

  // Energy preset selector (lobby)
  if (elements.energyPresetGroup) {
    elements.energyPresetGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-preset');
      if (!btn) return;
      const preset = btn.dataset.preset;
      if (!preset || !ENERGY_PRESETS[preset]) return;
      state.energyPreset = preset;
      elements.energyPresetGroup.querySelectorAll('.btn-preset').forEach((b) => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
    });
  }

  // Bot opponent selector (lobby)
  if (elements.botToggleGroup) {
    elements.botToggleGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-bot-toggle');
      if (!btn) return;
      const bot = btn.dataset.bot;
      if (!bot) return;
      state.botDifficulty = bot;
      state.botEnabled = bot !== 'none';
      // Assign a stable bot peer ID for this game session
      state.botPeerId = state.botEnabled
        ? `bot-${state.botDifficulty}-${Date.now()}`
        : null;
      elements.botToggleGroup.querySelectorAll('.btn-bot-toggle').forEach((b) => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
    });
  }

  // Game length selector (lobby)
  if (elements.durationToggleGroup) {
    elements.durationToggleGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-duration-toggle');
      if (!btn) return;
      const duration = btn.dataset.duration;
      if (!duration || !DURATION_PRESETS[duration]) return;
      state.durationPreset = duration;
      elements.durationToggleGroup.querySelectorAll('.btn-duration-toggle').forEach((b) => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
    });
  }

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
  const serverUrl = elements.serverUrlInput.value.trim() || autoDetectWsUrl();

  // Save preferences
  localStorage.setItem('watershed playerName', name);
  localStorage.setItem('watershed serverUrl', serverUrl);

  state.playerName = name;
  state.serverUrl = serverUrl;

  // Disable join button
  elements.btnJoin.disabled = true;
  elements.btnJoin.textContent = 'Connecting...';

  try {
    // Create engine for browser use
    state.engine = new Engine();

    // Set up persistence with IndexedDB
    state.storageAdapter = new IndexedDBAdapter();
    state.engine.useStorage(state.storageAdapter);

    // Set up Watershed sync
    setupWatershedSync(state.engine);

    // Listen for state updates
    state.engine.on('watershed:updated', handleStateUpdate);
    state.engine.on('watershed:ready', handleGameReady);
    state.engine.on('watershed:started', handleGameStarted);
    state.engine.on('watershed:ended', handleGameEnded);
    state.engine.on('net:ready', handleConnected);
    state.engine.on('net:disconnected', handleDisconnected);
    state.engine.on('net:peer:connected', handlePeerJoined);
    state.engine.on('net:peer:disconnected', handlePeerLeft);
    state.engine.on('watershed:rejected', handlePlacementRejected);

    // Show lobby in connecting state, then connect
    showLobby();
    showLobbyState('connecting');
    elements.startScreen.classList.add('hidden');

    state.engine.connect(state.serverUrl);

    // Register room message handler AFTER connect (network object now exists).
    // Must be registered before net:ready fires (which triggers room join flow).
    state.engine.network?.on('net:message', (evt) => {
      const msg = evt.payload;
      if (!msg || typeof msg.type !== 'string') return;
      switch (msg.type) {
        case 'room:created': {
          state.roomCode = msg.roomCode;
          state.isHost = true;
          showRoomCode(msg.roomCode);
          const createUrl = new URL(window.location);
          createUrl.searchParams.set('room', msg.roomCode);
          window.history.replaceState({}, '', createUrl);
          showLobbyState('waiting');
          updateLobbyPlayers();
          // Don't initialize game yet — host picks settings then clicks Start
          break;
        }
        case 'room:joined': {
          state.roomCode = msg.roomCode;
          state.isHost = false;
          const joinUrl = new URL(window.location);
          joinUrl.searchParams.set('room', msg.roomCode);
          window.history.replaceState({}, '', joinUrl);
          showLobbyState('waiting');
          // Joiner waits for host to start the game (CRDT sync will deliver state)
          break;
        }
        case 'room:error':
          showLobbyState('error', msg.message || 'Room error');
          break;
        case 'room:left':
          state.roomCode = null;
          state.isHost = false;
          showLobbyState('room-select');
          break;
      }
    });
  } catch (error) {
    console.error('[Watershed] Start error:', error);
    showError(`Failed to connect: ${error.message}`);
    elements.btnJoin.disabled = false;
    elements.btnJoin.textContent = 'Join Game';
  }
}

// Initialize game state (extracted from handleStart). Called after a room is
// created or joined. Host creates the game if none exists; joiners wait for
// the CRDT sync to deliver the existing state.
async function initGameState() {
  // Wait a moment for connection / sync to stabilize
  await sleep(500);

  const existingState = state.engine.session.state?.watershed;
  if (!existingState) {
    console.log('[Watershed] No existing game found, initializing...');
    try {
      await state.engine.dispatch('watershed:init', {
        width: 10,
        height: 10,
        durationMs: DURATION_PRESETS[state.durationPreset] || DURATION_PRESETS.sprint,
        energyConfig: ENERGY_PRESETS[state.energyPreset] || ENERGY_PRESETS.standard,
      });
    } catch (e) {
      // A peer may have already initialized — ignore concurrent init errors
      console.warn('[Watershed] init dispatch failed (likely concurrent):', e.message);
    }
  } else {
    console.log('[Watershed] Found existing game, joining...');
  }

  // Register player (use relay-assigned peerId if available)
  const peerId = state.engine.network?.peerId || state.peerId;
  state.peerId = peerId;
  try {
    state.engine.dispatch('watershed:register', {
      peerId,
      name: state.playerName,
    });
  } catch (e) {
    console.warn('[Watershed] register dispatch failed:', e.message);
  }
}

function handleGameReady() {
  console.log('[Watershed] Game ready — waiting in lobby for host to start');
  state.gameReady = true;
  // Do NOT switch to game screen — stay in lobby so host can pick settings
  // and wait for players. Game screen is shown when handleGameStarted() fires
  // (after host clicks "Start Game" or receives start via CRDT sync).
}

// ============================================================================
// Lobby Management
// ============================================================================

function showLobby() {
  elements.roomLobby.classList.remove('hidden');
  state.lobbyVisible = true;
}

function hideLobby() {
  elements.roomLobby.classList.add('hidden');
  state.lobbyVisible = false;
}

function showLobbyState(stateName, errorMsg) {
  // Hide all lobby states
  elements.lobbyConnecting.classList.add('hidden');
  elements.lobbyRoomSelect.classList.add('hidden');
  elements.lobbyRoomCode.classList.add('hidden');
  elements.lobbyWaiting.classList.add('hidden');
  elements.lobbyError.classList.add('hidden');

  // Show the requested state
  switch (stateName) {
    case 'connecting':
      elements.lobbyConnecting.classList.remove('hidden');
      break;
    case 'room-select':
      elements.lobbyRoomSelect.classList.remove('hidden');
      break;
    case 'room-code':
      elements.lobbyRoomCode.classList.remove('hidden');
      break;
    case 'waiting':
      elements.lobbyWaiting.classList.remove('hidden');
      break;
    case 'error':
      elements.lobbyError.classList.remove('hidden');
      if (errorMsg) elements.lobbyErrorText.textContent = errorMsg;
      break;
  }
}

function showRoomCode(roomCode) {
  elements.roomCodeText.textContent = roomCode;
  const url = new URL(window.location);
  url.searchParams.set('room', roomCode);
  elements.roomLink.href = url.toString();
  elements.roomLink.textContent = url.toString();
}

function updateLobbyPlayers() {
  const watershedState = state.engine?.session?.state?.watershed;
  const players = watershedState?.players || {};
  const playerCount = Object.keys(players).length || 1;

  elements.lobbyStatusText.textContent = `Waiting for players... (${playerCount} connected)`;

  // Build player list — preserve insertion order for stable color assignment
  const parts = [];
  const peerIds = Object.keys(players);
  for (const peerId of peerIds) {
    const p = players[peerId];
    const name = escapeHtml(p?.name || 'Player');
    const color = p?.color || 'var(--success)';
    const isHost = peerId === state.peerId && state.isHost;
    const isYou = peerId === state.peerId;
    const isBot = peerId === state.botPeerId;
    const youTag = isYou ? ' <span class="you-tag">(You)</span>' : '';
    const hostBadge = isHost ? '<span class="host-badge">Host</span>' : '';
    const botClass = isBot ? ' bot-player' : '';
    parts.push(
      `<div class="lobby-player${botClass}" style="--player-color: ${color}">` +
      `<span class="dot"></span>` +
      `<span class="player-label">${name}${youTag}</span>` +
      `${hostBadge}` +
      `</div>`
    );
  }
  if (parts.length === 0) {
    const color = 'var(--success)';
    parts.push(
      `<div class="lobby-player" style="--player-color: ${color}">` +
      `<span class="dot"></span>` +
      `<span class="player-label">${escapeHtml(state.playerName || 'You')} <span class="you-tag">(You)</span></span>` +
      `${state.isHost ? '<span class="host-badge">Host</span>' : ''}` +
      `</div>`
    );
  }

  // Pad with empty slots up to 4 players (Watershed supports 2-4)
  const totalSlots = 4;
  for (let i = parts.length; i < totalSlots; i++) {
    parts.push(
      `<div class="lobby-player empty-slot">` +
      `<span class="dot"></span>` +
      `<span class="player-label">Waiting for player...</span>` +
      `</div>`
    );
  }

  elements.lobbyPlayers.innerHTML = parts.join('');
}

function flashCopied(button) {
  if (!button) return;
  button.classList.add('copied');
  clearTimeout(button._copyTimer);
  button._copyTimer = setTimeout(() => button.classList.remove('copied'), 1500);
}

function copyRoomCode() {
  if (!state.roomCode) return;
  navigator.clipboard.writeText(state.roomCode).then(() => {
    announce('Room code copied to clipboard');
    flashCopied(elements.btnCopyCode);
  }).catch(() => {
    announce('Could not copy room code');
  });
}

function copyRoomLink() {
  if (!state.roomCode) return;
  const url = new URL(window.location);
  url.searchParams.set('room', state.roomCode);
  navigator.clipboard.writeText(url.toString()).then(() => {
    announce('Link copied to clipboard');
    flashCopied(elements.btnCopyLink);
  }).catch(() => {
    announce('Could not copy link');
  });
}

// ============================================================================
// Room Actions
// ============================================================================

function createRoom() {
  state.engine.network?.broadcast('room:create', {});
}

function joinRoom(roomCode) {
  const code = (roomCode || '').toUpperCase().trim();
  if (!code) {
    showLobbyState('error', 'Please enter a room code');
    return;
  }
  state.engine.network?.broadcast('room:join', { roomCode: code });
}

function leaveRoom() {
  state.engine.network?.broadcast('room:leave', {});
  state.roomCode = null;
  state.isHost = false;
  const url = new URL(window.location);
  url.searchParams.delete('room');
  window.history.replaceState({}, '', url);
}

function getPlayerCount() {
  const watershedState = state.engine?.session?.state?.watershed;
  if (!watershedState?.players) return 1;
  return Object.keys(watershedState.players).length;
}

function startGame() {
  // If a bot opponent is enabled, register the bot as player 2 before
  // starting. The bot dispatches through the engine just like a human —
  // energy, fortification, and CRDT sync all apply to it automatically.
  if (state.botEnabled && state.botPeerId) {
    try {
      state.engine.dispatch('watershed:register', {
        peerId: state.botPeerId,
        name: `AI (${state.botDifficulty})`,
      });
    } catch (e) {
      console.warn('[Watershed] Bot register failed:', e.message);
    }
  }

  // Dispatch watershed:start — syncs to all peers via CRDT
  try {
    state.engine.dispatch('watershed:start', { peerId: state.peerId });
  } catch (e) {
    console.warn('[Watershed] Start dispatch failed:', e.message);
  }
  // handleGameStarted will be called by the event listener
}

function handleGameStarted() {
  console.log('[Watershed] Game started');
  state.gameStarted = true;
  hideLobby();
  elements.startScreen.classList.add('hidden');
  elements.gameScreen.classList.add('active');
  startTimer();
  startEnergyTimer();
  if (state.botEnabled) startBot();
  announce('Game started! Place your tokens!');
  render();
}

function handleStateUpdate(event) {
  const watershedState = state.engine?.session?.state?.watershed;
  
  // Auto-register when joiner receives game state via CRDT sync
  if (watershedState && !state.registered) {
    state.registered = true;
    const peerId = state.engine.network?.peerId || state.peerId;
    state.peerId = peerId;
    try {
      state.engine.dispatch('watershed:register', {
        peerId,
        name: state.playerName,
      });
    } catch (e) {
      // Already registered or game not ready — fine
    }
  }

  // Check if game has started via CRDT sync (remote host clicked Start)
  if (watershedState && watershedState.phase === "playing" && !state.gameStarted) {
    state.gameStarted = true;
    handleGameStarted();
  }

  // Re-render on state update
  requestAnimationFrame(render);
}

function handleConnected(event) {
  state.connected = true;

  // Get actual peerId from network
  const networkPeerId = event?.peerId || state.engine?.network?.peerId;
  if (networkPeerId) {
    state.peerId = networkPeerId;
    console.log('[Watershed] Assigned peerId:', state.peerId);
  }

  updateSyncStatus('connected', 'Connected');
  updatePeerCount();
  console.log('[Watershed] Connected to relay');

  // Check URL for room code — auto-join if present, else show room select
  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get('room');
  if (roomCode) {
    joinRoom(roomCode);
  } else {
    showLobbyState('room-select');
  }
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
  console.log('[Watershed] Peer joined:', peerId);
  updatePeerCount();

  // Update lobby player list if lobby is visible
  if (state.lobbyVisible) {
    updateLobbyPlayers();
  }

  announce('A player joined the room');
}

function handlePeerLeft(event) {
  const peerId = event?.peerId || event?.payload?.peerId;
  console.log('[Watershed] Peer left:', peerId);
  updatePeerCount();

  if (state.lobbyVisible) {
    updateLobbyPlayers();
  }

  announce('A player left the room');
}

function updatePeerCount() {
  // Count players from the watershed state (registered players)
  const watershedState = state.engine?.session?.state?.watershed;
  const playerCount = watershedState?.players ? Object.keys(watershedState.players).length : 1;
  elements.peerCount.textContent = `${playerCount} player${playerCount !== 1 ? 's' : ''}`;
}

function handleGameEnded(event) {
  state.gameEnded = true;
  stopTimer();
  stopEnergyTimer();
  stopBot();

  // Auto-save the final game state
  if (state.engine && state.storageAdapter) {
    state.engine.persist('watershed-save', 'Game over save').catch(() => {});
  }

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
      // Dispatch watershed:end to compute winner and sync to peers
      try {
        state.engine.dispatch('watershed:end', { peerId: state.peerId });
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
// Energy Display
// ============================================================================

function startEnergyTimer() {
  stopEnergyTimer();
  // Recompute energy frequently so the bar visibly regenerates.
  state.energyInterval = setInterval(renderEnergy, 100);
  renderEnergy();
}

function stopEnergyTimer() {
  if (state.energyInterval) {
    clearInterval(state.energyInterval);
    state.energyInterval = null;
  }
}

function getEnergyConfig() {
  const watershedState = state.engine?.session?.state?.watershed;
  return watershedState?.config?.energy || ENERGY_PRESETS.standard;
}

function renderEnergy() {
  if (!elements.energyFill) return;
  const watershedState = state.engine?.session?.state?.watershed;
  if (!watershedState) return;

  const player = watershedState.players?.[state.peerId];
  const cfg = getEnergyConfig();
  const max = cfg.max ?? 15;
  const placeCost = cfg.placeCost ?? 1;

  if (!player) {
    elements.energyFill.style.width = '0%';
    elements.energyValue.textContent = '0';
    elements.energyMax.textContent = String(max);
    return;
  }

  const current = computeEnergy(player, cfg);
  const pct = Math.max(0, Math.min(100, (current / max) * 100));

  elements.energyFill.style.width = `${pct}%`;
  elements.energyValue.textContent = String(Math.floor(current));
  elements.energyMax.textContent = String(max);

  // Color shift: green → yellow → red as energy depletes
  elements.energyBar.classList.remove('energy-low', 'energy-mid', 'energy-full', 'energy-depleted');
  if (current < placeCost) {
    elements.energyBar.classList.add('energy-depleted');
  } else if (pct < 34) {
    elements.energyBar.classList.add('energy-low');
  } else if (pct < 67) {
    elements.energyBar.classList.add('energy-mid');
  } else {
    elements.energyBar.classList.add('energy-full');
  }
}

function handlePlacementRejected(event) {
  const reason = event?.reason || event?.payload?.reason;
  if (reason === 'insufficient_energy') {
    announce('Not enough energy!');
    if (elements.energyBar) {
      elements.energyBar.classList.remove('shake');
      // Force reflow to restart animation
      void elements.energyBar.offsetWidth;
      elements.energyBar.classList.add('shake');
      setTimeout(() => elements.energyBar.classList.remove('shake'), 500);
    }
    return;
  }
  if (reason === 'fortified') {
    announce('That cell is fortified — cannot be contested!');
    showError('Fortified cell — cannot place here');
  }
}

// ============================================================================
// AI Opponent (Bot)
// ============================================================================
//
// The bot is a client-side player that dispatches through the engine just
// like a human. Energy, fortification, and CRDT sync all apply to it. In a
// multiplayer game only the host's client runs the bot; its actions sync to
// other peers via CRDT.

const BOT_INTERVALS = { easy: 1500, normal: 1000, hard: 700 };

function startBot() {
  stopBot();
  if (!state.botPeerId) return;
  const interval = BOT_INTERVALS[state.botDifficulty] || 1000;
  state.botTimer = setInterval(runBotTick, interval);
  // Don't fire immediately — let the first tick happen after the interval
  // so the human has a moment to act first.
}

function stopBot() {
  if (state.botTimer) {
    clearInterval(state.botTimer);
    state.botTimer = null;
  }
}

function runBotTick() {
  if (!state.engine || state.gameEnded || !state.botPeerId) return;
  const watershedState = state.engine?.session?.state?.watershed;
  if (!watershedState || watershedState.phase !== 'playing') return;

  const board = getBoard(state.engine);
  if (!board) return;

  const cfg = watershedState.config?.energy || ENERGY_PRESETS.standard;
  const botPlayer = watershedState.players?.[state.botPeerId];
  if (!botPlayer) return;

  const energy = computeEnergy(botPlayer, cfg);
  if (energy < (cfg.placeCost ?? 1)) return; // wait for regen

  // Gather token lists
  const ownTokens = [];
  const opponentTokens = [];
  for (const t of Object.values(watershedState.tokens || {})) {
    const consumed = watershedState.consumed[t.id];
    if (consumed && Object.keys(consumed).length > 0) continue;
    if (t.playerId === state.botPeerId) ownTokens.push(t);
    else opponentTokens.push(t);
  }

  const move = getBotMove(state.botDifficulty, board, ownTokens, opponentTokens, energy, cfg, watershedState);
  if (!move) return;

  try {
    if (move.action === 'place') {
      state.engine.dispatch('watershed:place', { x: move.x, y: move.y, peerId: state.botPeerId });
    } else if (move.action === 'merge') {
      state.engine.dispatch('watershed:merge', {
        tokenIdA: move.tokenIdA,
        tokenIdB: move.tokenIdB,
        peerId: state.botPeerId,
      });
    }
  } catch (e) {
    // Move was rejected (energy, fortification, etc.) — silently retry next tick
  }
}

/**
 * Decide a bot move based on difficulty.
 * Returns { action: 'place', x, y } | { action: 'merge', tokenIdA, tokenIdB } | null
 */
function getBotMove(difficulty, board, ownTokens, opponentTokens, energy, cfg, watershedState) {
  if (difficulty === 'easy') return getEasyMove(board, ownTokens, cfg, energy);
  if (difficulty === 'hard') return getHardMove(board, ownTokens, opponentTokens, cfg, energy, watershedState);
  return getNormalMove(board, ownTokens, opponentTokens, cfg, energy);
}

// --- Helpers --------------------------------------------------------------

function isCellEmpty(board, x, y) {
  if (x < 0 || y < 0 || x >= board.width || y >= board.height) return false;
  return board.cells[y][x].tokens.length === 0;
}

function isCellFortifiedByOpponent(board, x, y, selfId) {
  if (x < 0 || y < 0 || x >= board.width || y >= board.height) return false;
  const cell = board.cells[y][x];
  for (const t of cell.tokens) {
    if (t.playerId !== selfId && t.strength >= 3) return true;
  }
  return false;
}

function getNeighbors(x, y, w, h) {
  const out = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) out.push([nx, ny]);
    }
  }
  return out;
}

function randomChoice(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Collect all empty cells on the board. */
function getEmptyCells(board) {
  const out = [];
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      if (board.cells[y][x].tokens.length === 0) out.push([x, y]);
    }
  }
  return out;
}

/** Empty cells adjacent to at least one of the bot's own tokens. */
function getEmptyCellsNearOwn(board, ownTokens) {
  const set = new Set();
  for (const t of ownTokens) {
    for (const [nx, ny] of getNeighbors(t.x, t.y, board.width, board.height)) {
      if (board.cells[ny][nx].tokens.length === 0) set.add(`${nx},${ny}`);
    }
  }
  return [...set].map((s) => s.split(',').map(Number));
}

/** Find a pair of adjacent own tokens that can be merged (both < strength 3). */
function findMergeOp(ownTokens) {
  for (const a of ownTokens) {
    if (a.strength >= 3) continue;
    for (const b of ownTokens) {
      if (a.id === b.id || b.strength >= 3) continue;
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);
      if (dx <= 1 && dy <= 1 && (dx + dy > 0)) {
        return { tokenIdA: a.id, tokenIdB: b.id };
      }
    }
  }
  return null;
}

/** Find a merge that produces a strength-3 (fortified) token. */
function findFortifyOp(ownTokens) {
  for (const a of ownTokens) {
    if (a.strength + 1 < 3) continue; // need a +1 partner to reach 3 → a must be strength 2
    if (a.strength !== 2) continue;
    for (const b of ownTokens) {
      if (a.id === b.id || b.strength !== 1) continue;
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);
      if (dx <= 1 && dy <= 1 && (dx + dy > 0)) {
        return { tokenIdA: a.id, tokenIdB: b.id };
      }
    }
  }
  return null;
}

// --- Easy -----------------------------------------------------------------

function getEasyMove(board, ownTokens, cfg, energy) {
  if (energy < (cfg.placeCost ?? 1)) return null;
  const empty = getEmptyCells(board);
  if (empty.length === 0) return null;

  // 50% random, 50% near own tokens (if any)
  const nearOwn = getEmptyCellsNearOwn(board, ownTokens);
  if (nearOwn.length > 0 && Math.random() < 0.5) {
    const [x, y] = randomChoice(nearOwn);
    return { action: 'place', x, y };
  }
  const [x, y] = randomChoice(empty);
  return { action: 'place', x, y };
}

// --- Normal ---------------------------------------------------------------

function getNormalMove(board, ownTokens, opponentTokens, cfg, energy) {
  // 20% chance to merge if a merge opportunity exists
  const mergeOp = findMergeOp(ownTokens);
  if (mergeOp && Math.random() < 0.2) {
    return { action: 'merge', ...mergeOp };
  }

  if (energy < (cfg.placeCost ?? 1)) return null;

  // Prefer cells adjacent to own tokens (build clusters for merging)
  const nearOwn = getEmptyCellsNearOwn(board, ownTokens);
  // Filter out cells adjacent to opponent's fortified tokens
  const safe = nearOwn.filter(([x, y]) => {
    for (const [nx, ny] of getNeighbors(x, y, board.width, board.height)) {
      const ncell = board.cells[ny][nx];
      for (const t of ncell.tokens) {
        if (t.playerId !== state.botPeerId && t.strength >= 3) return false;
      }
    }
    return true;
  });

  const pool = safe.length > 0 ? safe : (nearOwn.length > 0 ? nearOwn : getEmptyCells(board));
  if (pool.length === 0) return null;
  const [x, y] = randomChoice(pool);
  return { action: 'place', x, y };
}

// --- Hard -----------------------------------------------------------------

function getHardMove(board, ownTokens, opponentTokens, cfg, energy, watershedState) {
  // Priority 1: merge to strength-3 (fortify) when possible
  const fortify = findFortifyOp(ownTokens);
  if (fortify) return { action: 'merge', ...fortify };

  // Priority 2: merge to strength-2 when possible (concentrate scoring)
  const mergeOp = findMergeOp(ownTokens);
  if (mergeOp) return { action: 'merge', ...mergeOp };

  if (energy < (cfg.placeCost ?? 1)) return null;

  // Priority 3: place on a cell that would create influence (empty cell
  // adjacent to exactly one of our tokens and no opponent tokens).
  const empty = getEmptyCells(board);
  const influenceCells = [];
  const clusterCells = [];
  for (const [x, y] of empty) {
    let ownAdj = 0, oppAdj = 0;
    for (const [nx, ny] of getNeighbors(x, y, board.width, board.height)) {
      const ncell = board.cells[ny][nx];
      for (const t of ncell.tokens) {
        if (t.playerId === state.botPeerId) ownAdj++;
        else oppAdj++;
      }
    }
    if (ownAdj > 0 && oppAdj === 0) influenceCells.push([x, y, ownAdj]);
    else if (ownAdj > 0) clusterCells.push([x, y]);
  }

  if (influenceCells.length > 0) {
    // Pick the one with the most own-adjacency (most influence)
    influenceCells.sort((a, b) => b[2] - a[2]);
    const [x, y] = influenceCells[0];
    return { action: 'place', x, y };
  }

  // Priority 4: cluster near own tokens for future merging
  if (clusterCells.length > 0) {
    const [x, y] = randomChoice(clusterCells);
    return { action: 'place', x, y };
  }

  // Priority 5: block opponent clusters — place adjacent to an opponent token
  // (but not on a fortified cell)
  const blockCells = [];
  for (const [x, y] of empty) {
    let oppAdj = 0;
    for (const [nx, ny] of getNeighbors(x, y, board.width, board.height)) {
      const ncell = board.cells[ny][nx];
      for (const t of ncell.tokens) {
        if (t.playerId !== state.botPeerId) oppAdj++;
      }
    }
    if (oppAdj > 0) blockCells.push([x, y]);
  }
  if (blockCells.length > 0) {
    const [x, y] = randomChoice(blockCells);
    return { action: 'place', x, y };
  }

  // Fallback: random empty cell
  if (empty.length > 0) {
    const [x, y] = randomChoice(empty);
    return { action: 'place', x, y };
  }
  return null;
}

// ============================================================================
// Board Rendering
// ============================================================================
//
// Incremental rendering: the 10×10 cell grid is built once (and rebuilt only
// when dimensions change). Tokens are tracked by ID across renders in
// `state.renderedTokens` so we can diff and animate:
//   - new token  → entrance scale-in + ping ring ripple in player color
//   - removed    → fade-out + scale-down (consumed by merge/split)
//   - changed    → pulse (strength changed) + reposition (x/y changed)

function resetBoardRender() {
  elements.gameBoard.innerHTML = '';
  state.cellElements.clear();
  state.renderedTokens.clear();
  state.boardGridKey = '';
}

function render() {
  if (!state.engine?.session?.state?.watershed) return;

  const board = getBoard(state.engine);
  const scores = getScores(state.engine);

  renderBoard(board);
  renderScores(scores);
  renderInstructions();
  renderEnergy();
}

function renderBoard(board) {
  if (!board) return;

  // Ensure the cell grid exists and matches the current board dimensions.
  // Only rebuild the grid when dimensions change — not on every render.
  const gridKey = `${board.width}x${board.height}`;
  if (state.boardGridKey !== gridKey) {
    resetBoardRender();
    state.boardGridKey = gridKey;

    elements.gameBoard.style.gridTemplateColumns = `repeat(${board.width}, var(--cell-size))`;
    elements.gameBoard.style.gridTemplateRows = `repeat(${board.height}, var(--cell-size))`;

    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const cellEl = document.createElement('div');
        cellEl.className = 'cell';
        cellEl.dataset.x = x;
        cellEl.dataset.y = y;
        cellEl.setAttribute('role', 'gridcell');
        cellEl.setAttribute('aria-label', `Cell ${x}, ${y}`);
        cellEl.setAttribute('tabindex', '0');
        // Token container holds 0+ tokens for this cell (contested cells
        // can have multiple). Persist across renders so tokens can be
        // added/removed individually.
        const container = document.createElement('div');
        container.className = 'token-container';
        cellEl.appendChild(container);
        elements.gameBoard.appendChild(cellEl);
        state.cellElements.set(`${x},${y}`, cellEl);
      }
    }
  }

  // Update per-cell state (contested, highlights) — cheap, do every render.
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const cell = board.cells[y][x];
      const cellEl = state.cellElements.get(`${x},${y}`);
      if (!cellEl) continue;

      cellEl.classList.toggle('contested', !!cell.contested);
      cellEl.setAttribute('aria-label', `Cell ${x}, ${y}${cell.contested ? ', contested' : ''}`);

      // Split-target highlight (depends on selection, recomputed each render)
      cellEl.classList.remove('highlighted', 'targetable');
      if (state.interactionMode === 'split' && cell.tokens.length === 0) {
        const selectedToken = getTokenById(state.selectedTokenId);
        if (selectedToken && isAdjacent(selectedToken, x, y)) {
          cellEl.classList.add('highlighted');
          cellEl.classList.add('targetable');
        }
      }
    }
  }

  // --- Token diff ---
  // Build a map of currently-active tokens from the board state.
  const currentTokens = new Map(); // tokenId → token
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      for (const t of board.cells[y][x].tokens) {
        currentTokens.set(t.id, t);
      }
    }
  }

  // (a) Remove tokens that are no longer active (consumed by merge/split).
  for (const [tokenId, entry] of state.renderedTokens) {
    if (!currentTokens.has(tokenId)) {
      const el = entry.element;
      el.classList.add('token-exiting');
      // Detach from layout immediately so siblings reflow, but keep the
      // element alive briefly to play the exit animation.
      el.style.pointerEvents = 'none';
      setTimeout(() => { el.remove(); }, 180);
      state.renderedTokens.delete(tokenId);
    }
  }

  // (b) Add or update tokens that are active.
  for (const [tokenId, token] of currentTokens) {
    const existing = state.renderedTokens.get(tokenId);
    if (existing) {
      // (d) Update if changed (strength, position, selection, merge-target).
      updateTokenElement(existing, token);
    } else {
      // (c) New token — create with entrance animation + ping ring.
      const cellEl = state.cellElements.get(`${token.x},${token.y}`);
      if (!cellEl) continue;
      const container = cellEl.querySelector('.token-container');
      const tokenEl = createTokenElement(token);
      container.appendChild(tokenEl);

      // Ping ring — a ripple in the player's color, more prominent for
      // remote placements. We can't always tell local vs remote reliably
      // (CRDT sync doesn't tag the origin), so animate all new tokens.
      const playerState = state.engine.session.state.watershed.players[token.playerId];
      const color = playerState?.color || '#888888';
      const ping = document.createElement('span');
      ping.className = 'token-ping-ring';
      ping.style.setProperty('--ping-color', color);
      cellEl.appendChild(ping);
      // Remove the ping ring after the animation completes.
      setTimeout(() => { ping.remove(); }, 650);

      state.renderedTokens.set(tokenId, { element: tokenEl, token });
    }
  }
}

function createTokenElement(token) {
  const tokenEl = document.createElement('div');
  tokenEl.className = `token strength-${token.strength} token-entering`;
  tokenEl.dataset.tokenId = token.id;
  tokenEl.textContent = token.strength;
  tokenEl.setAttribute('role', 'button');
  tokenEl.setAttribute('tabindex', '0');
  tokenEl.setAttribute('aria-label', `Your token, strength ${token.strength}`);

  // Get player color
  const playerState = state.engine.session.state.watershed.players[token.playerId];
  const color = playerState?.color || '#888888';
  tokenEl.style.color = color;
  tokenEl.style.setProperty('--player-color', color);

  // Current player highlighting
  if (token.playerId === state.peerId) {
    tokenEl.setAttribute('aria-label', `Your token, strength ${token.strength}`);
  } else {
    tokenEl.setAttribute('aria-label', `Opponent token, strength ${token.strength}`);
  }

  // Fortified: strength-3 tokens lock their cell — can't be contested.
  // Add a shield badge and class so CSS can render the defensive indicator.
  if (token.strength >= 3) {
    tokenEl.classList.add('fortified');
    tokenEl.setAttribute('aria-label',
      token.playerId === state.peerId
        ? `Your fortified token, strength ${token.strength} — cannot be contested`
        : `Opponent fortified token, strength ${token.strength} — cannot be contested or placed on`);
    const shield = document.createElement('span');
    shield.className = 'fortified-shield';
    shield.setAttribute('aria-hidden', 'true');
    shield.textContent = '🛡';
    tokenEl.appendChild(shield);
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

  // Drop the entering class once the entrance animation has played so it
  // doesn't replay on subsequent class updates.
  setTimeout(() => { tokenEl.classList.remove('token-entering'); }, 320);

  return tokenEl;
}

/**
 * Update an already-rendered token element in place when its underlying
 * token data changes (strength after merge, position, selection state, or
 * merge-target highlight). Pulses on strength change.
 */
function updateTokenElement(entry, token) {
  const el = entry.element;
  const prev = entry.token;

  // Strength changed (e.g., merged from strength-1 → strength-2) — pulse.
  if (prev.strength !== token.strength) {
    el.className = `token strength-${token.strength} token-pulsing`;
    el.textContent = String(token.strength);
    // Re-apply fortified class + shield if it became strength-3
    if (token.strength >= 3) {
      el.classList.add('fortified');
      if (!el.querySelector('.fortified-shield')) {
        const shield = document.createElement('span');
        shield.className = 'fortified-shield';
        shield.setAttribute('aria-hidden', 'true');
        shield.textContent = '🛡';
        el.appendChild(shield);
      }
      el.setAttribute('aria-label',
        token.playerId === state.peerId
          ? `Your fortified token, strength ${token.strength} — cannot be contested`
          : `Opponent fortified token, strength ${token.strength} — cannot be contested or placed on`);
    } else {
      el.classList.remove('fortified');
      const shield = el.querySelector('.fortified-shield');
      if (shield) shield.remove();
    }
    // Update player color in case ownership somehow changed
    const playerState = state.engine.session.state.watershed.players[token.playerId];
    const color = playerState?.color || '#888888';
    el.style.color = color;
    el.style.setProperty('--player-color', color);
    setTimeout(() => { el.classList.remove('token-pulsing'); }, 220);
  }

  // Position changed — move to a new cell's container.
  if (prev.x !== token.x || prev.y !== token.y) {
    const newCell = state.cellElements.get(`${token.x},${token.y}`);
    if (newCell) {
      const container = newCell.querySelector('.token-container');
      container.appendChild(el);
    }
  }

  // Selection / merge-target highlight (depends on UI state, recompute each render)
  el.classList.remove('selected', 'merge-target');
  if (state.selectedTokenId === token.id) {
    el.classList.add('selected');
  }
  if (state.interactionMode === 'merge' && state.selectedTokenId) {
    const selectedToken = getTokenById(state.selectedTokenId);
    if (selectedToken &&
        selectedToken.playerId === token.playerId &&
        selectedToken.id !== token.id &&
        isAdjacent(selectedToken, token.x, token.y)) {
      el.classList.add('merge-target');
    }
  }

  entry.token = token;
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
    const scoreValue = score.score ?? 0;

    card.innerHTML = `
      <div class="player-score-header">
        <span class="player-name">
          <span class="player-color-dot" style="background: ${score.color}"></span>
          ${escapeHtml(score.name)}${isCurrentPlayer ? ' (You)' : ''}
        </span>
      </div>
      <div class="player-stats">
        <div class="stat stat-score">
          <div class="stat-value">${scoreValue}</div>
          <div class="stat-label">Score</div>
        </div>
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
    state.engine.dispatch('watershed:place', {
      x,
      y,
      peerId: state.peerId,
    });
    announce('Token placed');
  } catch (error) {
    console.warn('[Watershed] Place failed:', error.message);
  }
}

function handleMerge(tokenA, tokenB) {
  if (!state.engine || state.gameEnded) return;

  try {
    state.engine.dispatch('watershed:merge', {
      tokenIdA: tokenA.id,
      tokenIdB: tokenB.id,
      peerId: state.peerId,
    });
    announce('Tokens merged');
  } catch (error) {
    console.warn('[Watershed] Merge failed:', error.message);
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
    state.engine.dispatch('watershed:split', {
      tokenId: token.id,
      targetX,
      targetY,
      peerId: state.peerId,
    });
    announce('Token split');
  } catch (error) {
    console.warn('[Watershed] Split failed:', error.message);
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
  const watershedState = state.engine?.session?.state?.watershed;
  if (!watershedState) return;

  // Import getProvenanceTree from WatershedGame
  // For now, build simple tree from token data
  const tree = buildProvenanceTree(watershedState, token.id);

  if (!tree || (!tree.parents && !token._mergedFrom && !token._splitFrom)) {
    hideProvenance();
    return;
  }

  elements.provenanceTree.innerHTML = '';

  // Show current token
  const currentNode = document.createElement('div');
  currentNode.className = 'provenance-node';
  const player = watershedState.players[token.playerId];
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
      const parentPlayer = watershedState.players[parent.token.playerId];
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

function buildProvenanceTree(watershedState, tokenId, visited = new Set()) {
  if (visited.has(tokenId)) return null;
  visited.add(tokenId);

  const token = watershedState.tokens[tokenId];
  if (!token) return null;

  const parents = [];

  // Check mergedFrom
  if (token._mergedFrom) {
    for (const parentId of token._mergedFrom) {
      const parent = buildProvenanceTree(watershedState, parentId, visited);
      if (parent) parents.push(parent);
    }
  }

  // Check splitFrom
  if (token._splitFrom) {
    const parent = buildProvenanceTree(watershedState, token._splitFrom, visited);
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
  const watershedState = state.engine?.session?.state?.watershed;
  if (!watershedState) return;

  // Hide provenance tooltip
  elements.provenanceTooltip.classList.remove('visible');
  elements.provenanceTooltip.setAttribute('aria-hidden', 'true');

  const scores = getScores(state.engine);
  const winner = watershedState.winner;

  // Determine winner display
  const winnerPlayer = winner ? watershedState.players[winner] : null;
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
    elements.gameOverTitle.style.color = '';
    elements.gameOverSubtitle.textContent = `${winnerPlayer?.name || 'Opponent'} controls the most territory!`;
  }

  // Render final scores
  elements.finalScores.innerHTML = '';

  // Sort by strength-weighted score
  const sortedScores = [...scores].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  for (const score of sortedScores) {
    const card = document.createElement('div');
    card.className = 'final-score-card';

    if (score.playerId === winner) {
      card.classList.add('winner');
    }

    card.innerHTML = `
      <span class="player-color-dot" style="background: ${score.color}"></span>
      <div class="player-name">${escapeHtml(score.name)}${score.playerId === state.peerId ? ' (You)' : ''}</div>
      <div class="score-value">${score.score ?? 0}</div>
      <div class="score-label">Score</div>
      <div class="score-sub">(${score.controlledCells} cells)</div>
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
    state.engine.dispatch('watershed:end', {
      peerId: state.peerId,
    });
  } catch (error) {
    console.warn('[Watershed] End game failed:', error.message);
  }
}

function handlePlayAgain() {
  // Reset game state
  state.gameEnded = false;
  state.gameStarted = false;
  state.selectedTokenId = null;
  state.interactionMode = null;

  // Clear the board so the new game's tokens animate in fresh
  resetBoardRender();

  // Hide game over screen
  elements.gameOverScreen.classList.remove('active');

  // Reinitialize game
  state.engine.dispatch('watershed:init', {
    width: 10,
    height: 10,
    durationMs: DURATION_PRESETS[state.durationPreset] || DURATION_PRESETS.sprint,
    energyConfig: ENERGY_PRESETS[state.energyPreset] || ENERGY_PRESETS.standard,
  });

  // Re-register human player
  state.engine.dispatch('watershed:register', {
    peerId: state.peerId,
    name: state.playerName,
  });

  // Re-register bot if enabled (new peer ID for the new game)
  if (state.botEnabled) {
    state.botPeerId = `bot-${state.botDifficulty}-${Date.now()}`;
    try {
      state.engine.dispatch('watershed:register', {
        peerId: state.botPeerId,
        name: `AI (${state.botDifficulty})`,
      });
    } catch (e) {
      console.warn('[Watershed] Bot re-register failed:', e.message);
    }
  }

  // Restart timer
  startTimer();
  if (state.botEnabled) startBot();

  announce('New game started!');
}

function handleNewLobby() {
  // Full reset
  if (state.engine) {
    // Try to leave the room gracefully
    try { leaveRoom(); } catch (e) { /* ignore */ }
    state.engine.disconnect();
  }

  stopBot();
  resetBoardRender();
  state.gameEnded = false;
  state.gameStarted = false;
  state.gameReady = false;
  state.registered = false;
  state.connected = false;
  state.selectedTokenId = null;
  state.interactionMode = null;
  state.roomCode = null;
  state.isHost = false;

  // Clear room param from URL
  const url = new URL(window.location);
  url.searchParams.delete('room');
  window.history.replaceState({}, '', url);

  // Show start screen
  hideLobby();
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
  const watershedState = state.engine?.session?.state?.watershed;
  if (!watershedState) return null;

  const token = watershedState.tokens[tokenId];
  if (!token) return null;

  // Check if consumed
  const consumed = watershedState.consumed[tokenId];
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
  console.error('[Watershed]', message);
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
  stopBot();
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

window.watershed = {
  getState: () => state,
  getEngine: () => state.engine,
  getRoomCode: () => state.roomCode,
  isHost: () => state.isHost,
  render,
  showRules,
  hideRules,
  startBot,
  stopBot,
};

console.log('[Watershed] Client module loaded. Use window.watershed for debugging.');

// Initialize after all declarations are in scope
initApp();
