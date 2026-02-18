/**
 * Cuttle Web - Browser UI
 */

import { CuttleGame } from './CuttleGame.bundle.js';

console.log('[Cuttle] Version 2024-12-30-v13 loaded');

// ============================================================================
// Constants
// ============================================================================
const MAX_HISTORY = 50;
const TYPEWRITER_SPEED = 25; // ms per character
const AI_THINK_MIN = 800;
const AI_THINK_MAX = 1500;
const PHASE_BANNER_DURATION = 1000;
const RESOLUTION_PAUSE = 600;

// Auto-detect WebSocket server URL based on current page location
function getDefaultServerUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  // Use /ws path for nginx reverse proxy
  return `${protocol}//${host}/ws`;
}

// ============================================================================
// Game State Class - Encapsulates all mutable state
// ============================================================================
class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    // Core game state
    this.game = null;
    this.variant = 'classic';
    this.playerIndex = 1; // Human is player 1 (goes first in 2-player)
    this.selectedCard = null;
    this.gameStartTime = null;
    this.moveHistory = [];

    // Multiplayer state
    this.isMultiplayer = false;
    this.socket = null;
    this.clientId = null;
    this.serverState = null;
    this.serverValidActions = {};
    this.numPlayers = 2;
    this.roomCode = null; // Current room code for room-based multiplayer

    // Animation tracking
    this.prevHandIds = new Set();
    this.prevPointIds = new Set();
    this.prevPermIds = new Set();
    this.lastAction = null;

    // Pacing system
    this.chronicleQueue = [];
    this.isTyping = false;
    this.currentPhase = null;
    this.timerIntervalId = null;
  }

  // Clear timer interval to prevent memory leaks
  clearTimer() {
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }

  // Start a new timer
  startTimer(callback) {
    this.clearTimer();
    this.timerIntervalId = setInterval(callback, 1000);
  }

  // Add to move history with max limit
  addMoveToHistory(action, playerIdx) {
    this.moveHistory.push({ action, playerIndex: playerIdx });
    if (this.moveHistory.length > MAX_HISTORY) {
      this.moveHistory.shift();
      // Also remove oldest DOM entry if it exists
      const firstEntry = elements.moveHistoryEl.querySelector('.history-entry');
      if (firstEntry) firstEntry.remove();
    }
    // Queue for typewriter effect
    this.chronicleQueue.push({ action, playerIndex: playerIdx });
  }

  // Get number of players based on variant
  getNumPlayers() {
    if (this.variant === 'cutthroat') return 3;
    if (this.variant === 'team') return 4;
    return 2;
  }

  // Get all AI player indices
  getAIPlayers() {
    const players = [];
    const numPlayers = this.getNumPlayers();
    for (let i = 0; i < numPlayers; i++) {
      if (i !== this.playerIndex) players.push(i);
    }
    return players;
  }
}

// Global state instance
const state = new GameState();

// ============================================================================
// Accessibility Helpers
// ============================================================================

// Announce to screen readers
function announce(message, priority = 'polite') {
  const announcer = document.getElementById('sr-announcements');
  if (announcer) {
    announcer.setAttribute('aria-live', priority);
    announcer.textContent = message;
    // Clear after announcement
    setTimeout(() => { announcer.textContent = ''; }, 1000);
  }
}

// Focus trap for modals
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

  modal.addEventListener('keydown', handleKeyDown);
  modal._focusTrapHandler = handleKeyDown;
}

// Remove focus trap when modal closes
function releaseFocusTrap(modal) {
  if (modal._focusTrapHandler) {
    modal.removeEventListener('keydown', modal._focusTrapHandler);
    delete modal._focusTrapHandler;
  }
}

// Get accessible card description
function getCardAccessibleName(card) {
  if (!card) return 'Unknown card';
  if (card.isJoker) return 'Joker';

  const rankNames = {
    'A': 'Ace', '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five',
    '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine', '10': 'Ten',
    'J': 'Jack', 'Q': 'Queen', 'K': 'King'
  };
  const suitNames = {
    'clubs': 'of Clubs', 'diamonds': 'of Diamonds',
    'hearts': 'of Hearts', 'spades': 'of Spades'
  };

  const rankName = rankNames[card.rank] || card.rank;
  const suitName = suitNames[card.suit] || card.suit;
  return `${rankName} ${suitName}`;
}

// DOM elements
const elements = {
  startScreen: document.getElementById('start-screen'),
  rulesModal: document.getElementById('rules-modal'),
  gameOverModal: document.getElementById('game-over-modal'),
  gameOverHistory: document.getElementById('game-over-history'),
  pauseModal: document.getElementById('pause-modal'),
  pauseVariantSelect: document.getElementById('pause-variant-select'),
  pauseGameInfo: document.getElementById('pause-game-info'),
  variantSelect: document.getElementById('variant-select'),
  variantLabel: document.getElementById('variant-label'),
  logo: document.querySelector('#header h1'),
  timer: document.getElementById('timer'),
  deckInfo: document.getElementById('deck-info'),
  deck: document.getElementById('deck'),
  deckCount: document.querySelector('.deck-count'),
  scrapTop: document.getElementById('scrap-top'),
  oneoffZone: document.getElementById('oneoff-zone'),
  oneoffCards: document.getElementById('oneoff-cards'),
  sevenZone: document.getElementById('seven-zone'),
  sevenCards: document.getElementById('seven-cards'),
  opponentsContainer: document.getElementById('opponents-container'),
  yourHand: document.getElementById('your-hand'),
  yourPoints: document.getElementById('your-points'),
  yourPermanents: document.getElementById('your-permanents'),
  yourPointsDisplay: document.getElementById('your-points-display'),
  turnIndicator: document.getElementById('turn-indicator'),
  actionPanel: document.getElementById('action-panel'),
  actionButtons: document.getElementById('action-buttons'),
  message: document.getElementById('message'),
  passBtn: document.getElementById('pass-btn'),
  moveHistoryEl: document.getElementById('move-history'),
  rulesText: document.getElementById('rules-text'),
  gameOverTitle: document.getElementById('game-over-title'),
  gameOverMessage: document.getElementById('game-over-message'),
  scrapModal: document.getElementById('scrap-modal'),
  scrapCards: document.getElementById('scrap-cards'),
  scrapInstruction: document.getElementById('scrap-instruction'),
  closeScrap: document.getElementById('close-scrap'),
  previewCard: document.getElementById('preview-card'),
  previewType: document.getElementById('preview-type'),
  previewDesc: document.getElementById('preview-desc'),
  cardPreview: document.getElementById('card-preview'),
  partnerArea: document.getElementById('partner-area'),
  phaseBanner: document.getElementById('phase-banner'),
  // Multiplayer elements
  multiplayerLobby: document.getElementById('multiplayer-lobby'),
  lobbyConnecting: document.getElementById('lobby-connecting'),
  lobbyWaiting: document.getElementById('lobby-waiting'),
  lobbyError: document.getElementById('lobby-error'),
  lobbyErrorText: document.getElementById('lobby-error-text'),
  lobbyStatusText: document.getElementById('lobby-status-text'),
  lobbyPlayers: document.getElementById('lobby-players'),
  serverUrl: document.getElementById('server-url'),
  lobbyConnect: document.getElementById('lobby-connect'),
  lobbyCancel: document.getElementById('lobby-cancel'),
};

// Convenience functions that delegate to state
function getNumPlayers() {
  return state.getNumPlayers();
}

function getAIPlayers() {
  return state.getAIPlayers();
}

// ============================================================================
// Multiplayer Connection
// ============================================================================

function connectToServer(url) {
  if (state.socket) {
    state.socket.close();
  }

  // Use sessionStorage to persist clientId across page refreshes
  // This allows reconnection after accidental refresh
  let storedId = sessionStorage.getItem('cuttle-clientId');
  if (!storedId) {
    storedId = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('cuttle-clientId', storedId);
  }
  state.clientId = storedId;

  showLobbyState('connecting');

  try {
    state.socket = new WebSocket(url);
  } catch (err) {
    showLobbyState('error', 'Invalid server URL');
    return;
  }

  state.socket.addEventListener('open', () => {
    showLobbyState('waiting');
    sendToServer({ cmd: 'describe' });
  });

  state.socket.addEventListener('message', (event) => {
    handleServerMessage(JSON.parse(event.data));
  });

  state.socket.addEventListener('close', () => {
    if (state.isMultiplayer && state.serverState?.gameStarted) {
      showMessage('Disconnected from server!');
    }
  });

  state.socket.addEventListener('error', () => {
    showLobbyState('error', 'Connection failed. Is the server running?');
  });
}

function sendToServer(msg) {
  if (state.socket && state.socket.readyState === WebSocket.OPEN) {
    state.socket.send(JSON.stringify(msg));
  }
}

function handleServerMessage(msg) {
  switch (msg.cmd) {
    case 'welcome':
      // Initial connection - check if we're in a room or need to create/join
      if (msg.state?.inRoom === false) {
        showLobbyState('room-select');
        // Check URL for room code
        const urlParams = new URLSearchParams(window.location.search);
        const roomCode = urlParams.get('room');
        if (roomCode) {
          joinRoom(roomCode);
        }
      } else {
        // Already in a room (legacy single-room server)
        state.serverState = msg.state;
        state.serverValidActions = msg.state.validActions || {};
        updateLobbyPlayers();
      }
      break;

    case 'room:created':
      state.roomCode = msg.roomCode;
      state.playerIndex = 0; // Creator is always player 0
      if (msg.state) {
        state.serverState = msg.state;
        state.serverValidActions = msg.state.validActions || {};
      }
      showRoomCode(msg.roomCode);
      updateLobbyPlayers();
      showLobbyState('waiting');

      // Update URL without reloading
      const createUrl = new URL(window.location);
      createUrl.searchParams.set('room', msg.roomCode);
      window.history.replaceState({}, '', createUrl);
      break;

    case 'room:joined':
      state.roomCode = msg.roomCode;
      state.playerIndex = msg.playerIndex;
      if (msg.state) {
        state.serverState = msg.state;
        state.serverValidActions = msg.state.validActions || {};
      }
      updateLobbyPlayers();
      showLobbyState('waiting');

      // Update URL without reloading
      const joinUrl = new URL(window.location);
      joinUrl.searchParams.set('room', msg.roomCode);
      window.history.replaceState({}, '', joinUrl);
      break;

    case 'room:left':
      state.roomCode = null;
      showLobbyState('room-select');
      // Clear room from URL
      const cleanUrl = new URL(window.location);
      cleanUrl.searchParams.delete('room');
      window.history.replaceState({}, '', cleanUrl);
      break;

    case 'room:error':
      showLobbyState('error', msg.message);
      break;

    case 'room:list':
      updateRoomList(msg.rooms);
      break;

    case 'state':
      // Game state update
      state.serverState = msg.state;
      state.serverValidActions = msg.state.validActions || {};

      // Find which player we are
      if (state.serverState._gameState) {
        const players = state.serverState._gameState.players;
        state.numPlayers = state.serverState._gameState.numPlayers || 2;
        state.variant = state.serverState._gameState.variant || 'classic';

        for (let i = 0; i < state.numPlayers; i++) {
          if (players[i] === state.clientId) {
            state.playerIndex = i;
            break;
          }
        }
      }

      // Check if game just started
      const lobbyVisible = elements.multiplayerLobby && !elements.multiplayerLobby.classList.contains('hidden');
      const gameOverModalVisible = !elements.gameOverModal.classList.contains('hidden');
      const gameStarted = state.serverState._gameState?.gameStarted;
      const isNewGame = state.serverState._gameState?.history?.length === 0;

      if (gameStarted && lobbyVisible) {
        startMultiplayerGame();
      } else if (gameStarted && gameOverModalVisible && isNewGame) {
        // Game was reset while we had game over modal open - start new game
        elements.gameOverModal.classList.add('hidden');
        releaseFocusTrap(elements.gameOverModal);
        startMultiplayerGame();
      } else if (state.isMultiplayer && gameStarted) {
        renderMultiplayer();
      } else if (state.isMultiplayer && !gameStarted && !lobbyVisible) {
        // Game ended and was reset, waiting for players - show lobby
        elements.gameOverModal.classList.add('hidden');
        releaseFocusTrap(elements.gameOverModal);
        elements.multiplayerLobby.classList.remove('hidden');
        elements.gameArea.classList.add('hidden');
        showLobbyState('waiting');
        // Clear local game state
        state.moveHistory = [];
        state.chronicleQueue = [];
        state.lastSyncedHistoryIndex = 0;
        elements.moveHistoryEl.innerHTML = '';
      }

      updateLobbyPlayers();
      updateReadyStatus();
      break;

    case 'error':
      showMessage(`Error: ${msg.message}`);
      break;
  }
}

function updateLobbyPlayers() {
  if (!state.serverState?._gameState) return;

  const players = state.serverState._gameState.players;
  state.numPlayers = state.serverState._gameState.numPlayers || 2;

  elements.lobbyPlayers.innerHTML = '';

  let connectedCount = 0;
  for (let i = 0; i < state.numPlayers; i++) {
    const div = document.createElement('div');
    div.className = 'lobby-player ' + (players[i] ? 'connected' : 'waiting');

    if (players[i] === state.clientId) {
      div.textContent = `Player ${i + 1} (You)`;
    } else if (players[i]) {
      div.textContent = `Player ${i + 1} ✓`;
      connectedCount++;
    } else {
      div.textContent = `Player ${i + 1} ...`;
    }

    elements.lobbyPlayers.appendChild(div);
    if (players[i]) connectedCount++;
  }

  elements.lobbyStatusText.textContent = connectedCount < state.numPlayers
    ? `Waiting for players... (${connectedCount}/${state.numPlayers})`
    : 'Game starting!';
}

function showLobbyState(lobbyState, errorMsg) {
  elements.lobbyConnecting.classList.add('hidden');
  elements.lobbyWaiting.classList.add('hidden');
  elements.lobbyError.classList.add('hidden');
  elements.lobbyConnect.classList.add('hidden');

  // Hide room-specific elements
  const roomSelect = document.getElementById('lobby-room-select');
  const roomCodeDisplay = document.getElementById('lobby-room-code');
  if (roomSelect) roomSelect.classList.add('hidden');
  if (roomCodeDisplay) roomCodeDisplay.classList.add('hidden');

  switch (lobbyState) {
    case 'connecting':
      elements.lobbyConnecting.classList.remove('hidden');
      break;
    case 'waiting':
      elements.lobbyWaiting.classList.remove('hidden');
      if (state.roomCode && roomCodeDisplay) {
        roomCodeDisplay.classList.remove('hidden');
      }
      break;
    case 'room-select':
      // Show room create/join options
      if (roomSelect) {
        roomSelect.classList.remove('hidden');
      } else {
        // Fallback: auto-create room if room UI not available
        createRoom();
      }
      break;
    case 'error':
      elements.lobbyError.classList.remove('hidden');
      elements.lobbyErrorText.textContent = errorMsg || 'Connection failed';
      elements.lobbyConnect.classList.remove('hidden');
      break;
  }
}

// Room management functions
function createRoom(variant) {
  const selectedVariant = variant || elements.variantSelect?.value || 'classic';
  sendToServer({
    cmd: 'room:create',
    variant: selectedVariant,
    clientId: state.clientId
  });
}

function joinRoom(roomCode) {
  const code = roomCode.toUpperCase().trim();
  sendToServer({
    cmd: 'room:join',
    roomCode: code,
    clientId: state.clientId
  });
}

function leaveRoom() {
  sendToServer({ cmd: 'room:leave' });
}

function showRoomCode(roomCode) {
  const roomCodeDisplay = document.getElementById('lobby-room-code');
  const roomCodeText = document.getElementById('room-code-text');
  const roomLink = document.getElementById('room-link');

  if (roomCodeText) {
    roomCodeText.textContent = roomCode;
  }

  if (roomLink) {
    const url = new URL(window.location);
    url.searchParams.set('room', roomCode);
    roomLink.href = url.toString();
    roomLink.textContent = url.toString();
  }

  if (roomCodeDisplay) {
    roomCodeDisplay.classList.remove('hidden');
  }

  // Update lobby status text
  elements.lobbyStatusText.textContent = `Room: ${roomCode} - Waiting for opponent...`;
}

function updateRoomList(rooms) {
  const roomListEl = document.getElementById('room-list');
  if (!roomListEl) return;

  roomListEl.innerHTML = '';

  if (rooms.length === 0) {
    roomListEl.innerHTML = '<p class="no-rooms">No public rooms available</p>';
    return;
  }

  for (const room of rooms) {
    const div = document.createElement('div');
    div.className = 'room-item';
    div.innerHTML = `
      <span class="room-code">${room.roomCode}</span>
      <span class="room-info">${room.memberCount}/${room.maxMembers} players</span>
      <span class="room-variant">${room.variant || 'classic'}</span>
      ${room.hasPassword ? '<span class="room-locked">🔒</span>' : ''}
    `;
    div.addEventListener('click', () => joinRoom(room.roomCode));
    roomListEl.appendChild(div);
  }
}

function copyRoomCode() {
  if (state.roomCode) {
    navigator.clipboard.writeText(state.roomCode).then(() => {
      showMessage('Room code copied!');
    });
  }
}

function copyRoomLink() {
  if (state.roomCode) {
    const url = new URL(window.location);
    url.searchParams.set('room', state.roomCode);
    navigator.clipboard.writeText(url.toString()).then(() => {
      showMessage('Room link copied!');
    });
  }
}

async function startMultiplayerGame() {
  state.isMultiplayer = true;
  state.gameStartTime = Date.now();
  state.moveHistory = [];
  state.selectedCard = null;
  state.lastSyncedHistoryIndex = 0; // Reset chronicle sync

  // Reset animation tracking
  state.prevHandIds = new Set();
  state.prevPointIds = new Set();
  state.prevPermIds = new Set();

  // Reset pacing system
  state.chronicleQueue = [];
  state.isTyping = false;
  state.currentPhase = null;
  elements.moveHistoryEl.innerHTML = '';

  // Hide modals and reset play again button
  releaseFocusTrap(elements.multiplayerLobby);
  elements.multiplayerLobby.classList.add('hidden');
  elements.startScreen.classList.add('hidden');
  elements.gameOverModal.classList.add('hidden');

  // Reset play again button state
  const playAgainBtn = document.getElementById('play-again');
  playAgainBtn.textContent = 'Play Again';
  playAgainBtn.disabled = false;

  // Update variant label
  elements.variantLabel.textContent = state.variant.charAt(0).toUpperCase() + state.variant.slice(1);

  renderMultiplayer();

  // Show game start banner
  await showPhaseBanner('⚔️ BATTLE BEGINS');
  showMessage(getMultiplayerTurnMessage());

  // Start timer (clear any existing interval first)
  state.startTimer(() => {
    elements.timer.textContent = formatTime(state.gameStartTime);
  });
}

function getMultiplayerTurnMessage() {
  const gameData = state.serverState?._gameState?.game;
  if (!gameData) return '';

  const phase = gameData.phase;
  const myActions = state.serverValidActions[state.playerIndex] || [];

  // Handle special phases
  switch (phase) {
    case 'counter':
      // In counter phase, check who can act
      if (myActions.length > 0) {
        return "Counter phase! Play a 2 to counter, or Pass to let it resolve.";
      } else {
        return "Waiting for opponent to counter or pass...";
      }

    case 'resolve_four':
      // Discard 2 cards phase
      const discardingPlayer = gameData.discardingPlayer ?? (1 - gameData.currentPlayer);
      if (discardingPlayer === state.playerIndex) {
        const discardCount = gameData.discardCount || 2;
        return `Discard ${discardCount} card${discardCount > 1 ? 's' : ''} from your hand.`;
      } else {
        return `${getPlayerName(discardingPlayer)} must discard 2 cards...`;
      }

    case 'resolve_five_discard':
      if (gameData.currentPlayer === state.playerIndex) {
        return "Discard 1 card (5 effect).";
      } else {
        return `${getPlayerName(gameData.currentPlayer)} is choosing a card to discard...`;
      }

    case 'resolve_three':
      if (gameData.currentPlayer === state.playerIndex) {
        return "Choose a card from the scrap pile.";
      } else {
        return `${getPlayerName(gameData.currentPlayer)} is retrieving from scrap...`;
      }

    case 'resolve_seven':
    case 'resolve_seven_choose':
      if (gameData.currentPlayer === state.playerIndex) {
        return "Play the revealed card(s) from the 7 effect.";
      } else {
        return `${getPlayerName(gameData.currentPlayer)} is playing from the 7 effect...`;
      }

    case 'resolve_nine':
      if (myActions.length > 0) {
        return "Choose a target for the 9 effect.";
      } else {
        return "Waiting for 9 effect to resolve...";
      }

    case 'royal_response':
      if (myActions.length > 0) {
        return "Royal attack! Play a permanent to block, or Pass.";
      } else {
        return "Waiting for response to royal attack...";
      }

    case 'complete':
      return "Game Over!";

    case 'play':
    default:
      if (gameData.currentPlayer === state.playerIndex) {
        return "Your turn! Click a card to play, or click the deck to draw.";
      } else {
        const opponentName = getPlayerName(gameData.currentPlayer);
        return `${opponentName} is thinking...`;
      }
  }
}

function getPlayerName(idx) {
  if (idx === state.playerIndex) return 'You';
  if (state.variant === 'team') {
    const myTeam = state.playerIndex % 2;
    const theirTeam = idx % 2;
    if (myTeam === theirTeam) return 'Partner';
  }
  return state.numPlayers > 2 ? `Foe ${idx}` : 'Foe';
}

function renderMultiplayer() {
  if (!state.serverState?._gameState?.game) return;

  const gameData = state.serverState._gameState.game;
  if (!gameData.players || !gameData.players[state.playerIndex]) return;

  const obs = createObservationFromServerState(gameData, state.playerIndex);

  // Update deck/scrap info
  elements.deckInfo.textContent = `Deck: ${gameData.deck.length}`;
  elements.deckCount.textContent = gameData.deck.length;

  // Update scrap pile
  elements.scrapTop.innerHTML = '';
  elements.scrapTop.className = 'card empty';
  if (gameData.scrap.length > 0) {
    const topScrap = gameData.scrap[gameData.scrap.length - 1];
    const scrapCard = createCardElement(topScrap, { mini: true });
    scrapCard.style.cursor = 'default';
    elements.scrapTop.innerHTML = '';
    elements.scrapTop.className = '';
    elements.scrapTop.appendChild(scrapCard);
  }

  // Update your hand
  const handFragment = document.createDocumentFragment();
  for (const card of obs.myHand) {
    const cardEl = createCardElement(card);
    cardEl.addEventListener('click', () => handleCardClickMultiplayer(card));
    if (state.selectedCard && state.selectedCard.id === card.id) {
      cardEl.classList.add('selected');
    }
    handFragment.appendChild(cardEl);
  }
  elements.yourHand.innerHTML = '';
  elements.yourHand.appendChild(handFragment);

  // Update your point cards
  const pointsFragment = document.createDocumentFragment();
  for (const pc of obs.myPointCards) {
    const card = createCardElement(pc.card, {
      attachedJacks: pc.attachedJacks?.length || null,
    });
    card.style.cursor = 'default';
    pointsFragment.appendChild(card);
  }
  elements.yourPoints.innerHTML = '';
  elements.yourPoints.appendChild(pointsFragment);

  // Update your permanents
  const permsFragment = document.createDocumentFragment();
  for (const perm of obs.myPermanents) {
    const card = createCardElement(perm.card, { mini: true });
    card.style.cursor = 'default';
    permsFragment.appendChild(card);
  }
  elements.yourPermanents.innerHTML = '';
  elements.yourPermanents.appendChild(permsFragment);

  elements.yourPointsDisplay.textContent = `${obs.myPoints}/${obs.myGoal}`;

  // Update opponents
  elements.opponentsContainer.innerHTML = '';
  for (const opp of obs.opponents) {
    const section = document.createElement('section');
    section.className = 'player-area';
    section.id = `opponent-${opp.index}`;

    const isTurn = gameData.currentPlayer === opp.index;

    // Header
    const header = document.createElement('div');
    header.className = 'player-header';
    header.innerHTML = `
      <span class="player-name">👤 Foe ${opp.index}</span>
      <span class="player-points">${opp.points}/${opp.goal}</span>
      ${isTurn ? '<span class="turn-indicator">THEIR TURN</span>' : ''}
    `;
    section.appendChild(header);

    // Hand row - show actual cards if we have Glasses (8 permanent), otherwise face-down
    const handRow = document.createElement('div');
    handRow.className = 'card-row';
    if (opp.hand && Array.isArray(opp.hand)) {
      // We have Glasses - show actual cards
      for (const card of opp.hand) {
        const cardEl = createCardElement(card, { mini: true });
        cardEl.style.cursor = 'default';
        cardEl.title = `${card.rank} of ${card.suit} (revealed by Glasses)`;
        handRow.appendChild(cardEl);
      }
    } else {
      // No Glasses - show face-down cards
      for (let i = 0; i < opp.handSize; i++) {
        const cardBack = document.createElement('div');
        cardBack.className = 'card card-sprite card-back sprite-back mini';
        cardBack.setAttribute('aria-label', 'Card back');
        handRow.appendChild(cardBack);
      }
    }
    section.appendChild(handRow);

    // Point cards
    const pointsRow = document.createElement('div');
    pointsRow.className = 'card-row';
    for (const pc of opp.pointCards) {
      const card = createCardElement(pc.card, { mini: true });
      card.style.cursor = 'default';
      pointsRow.appendChild(card);
    }
    section.appendChild(pointsRow);

    // Permanents
    const permsRow = document.createElement('div');
    permsRow.className = 'card-row';
    for (const perm of opp.permanents) {
      const card = createCardElement(perm.card, { mini: true });
      card.style.cursor = 'default';
      permsRow.appendChild(card);
    }
    section.appendChild(permsRow);

    elements.opponentsContainer.appendChild(section);
  }

  // Update partner if team variant
  if (state.variant === 'team' && state.numPlayers === 4) {
    const partnerIdx = (state.playerIndex + 2) % 4;
    renderPartnerMultiplayer(gameData, partnerIdx);
  } else {
    elements.partnerArea.classList.add('hidden');
  }

  // Update turn indicator based on phase
  const myActions = state.serverValidActions[state.playerIndex] || [];
  const phase = gameData.phase;
  const hasActions = myActions.length > 0;

  // Determine if player should see turn indicator
  let showTurnIndicator = false;
  let turnIndicatorText = 'YOUR TURN';

  switch (phase) {
    case 'counter':
      if (hasActions) {
        // Check if we have a 2 to counter with
        const hasTwo = obs.myHand.some(c => c.rank === '2');
        if (!hasTwo && myActions.includes('pass')) {
          // Auto-pass if no 2 card - delay slightly for UX
          showMessage("No 2 to counter - auto-passing...");
          setTimeout(() => {
            executeMultiplayerAction('pass');
          }, 500);
        } else {
          showTurnIndicator = true;
          turnIndicatorText = 'COUNTER?';
        }
      }
      break;
    case 'resolve_four':
      const discardingPlayer = gameData.discardingPlayer ?? (1 - gameData.currentPlayer);
      if (discardingPlayer === state.playerIndex) {
        showTurnIndicator = true;
        turnIndicatorText = `DISCARD ${gameData.discardCount || 2}`;
      }
      break;
    case 'resolve_five_discard':
      if (gameData.currentPlayer === state.playerIndex) {
        showTurnIndicator = true;
        turnIndicatorText = 'DISCARD 1';
      }
      break;
    case 'resolve_three':
      if (gameData.currentPlayer === state.playerIndex) {
        showTurnIndicator = true;
        turnIndicatorText = 'RETRIEVE';
      }
      break;
    case 'resolve_seven':
    case 'resolve_seven_choose':
      if (gameData.currentPlayer === state.playerIndex) {
        showTurnIndicator = true;
        turnIndicatorText = 'PLAY FROM 7';
      }
      break;
    case 'royal_response':
      if (hasActions) {
        // Check if we have a 9 to respond with
        const hasNine = obs.myHand.some(c => c.rank === '9');
        if (!hasNine && myActions.includes('pass')) {
          // Auto-pass if no 9 card
          showMessage("No 9 to block - auto-passing...");
          setTimeout(() => {
            executeMultiplayerAction('pass');
          }, 500);
        } else {
          showTurnIndicator = true;
          turnIndicatorText = 'RESPOND';
        }
      }
      break;
    case 'play':
    default:
      if (gameData.currentPlayer === state.playerIndex) {
        showTurnIndicator = true;
        turnIndicatorText = 'YOUR TURN';
      }
      break;
  }

  elements.turnIndicator.classList.toggle('hidden', !showTurnIndicator);
  if (showTurnIndicator) {
    elements.turnIndicator.textContent = turnIndicatorText;
  }

  // Show/hide pass button - show when pass is a valid action
  const canPass = myActions.includes('pass');
  elements.passBtn.classList.toggle('hidden', !canPass);

  // Update message
  showMessage(getMultiplayerTurnMessage());

  // Show one-off zone if needed
  renderOneoffZone(gameData);

  // Show seven zone if needed
  // Create an observation-like object for seven zone rendering
  const sevenObs = {
    sevenDrawnCard: gameData.sevenDrawnCard,
    sevenRevealedCards: gameData.sevenRevealedCards,
  };
  renderSevenZone(gameData, sevenObs);

  // Sync chronicle from server history
  syncChronicleFromServer();

  // Check for game end
  checkMultiplayerGameEnd(gameData);
}

function createObservationFromServerState(gameData, pIdx) {
  const myPlayer = gameData.players[pIdx];
  const myHand = myPlayer.hand;
  const variant = gameData.variant || state.variant;

  // Check if we have glasses (8 permanent)
  const weHaveGlasses = myPlayer.permanents.some(p => p.type === 'eight');
  const glassesTargetPlayer =
    variant === 'cutthroat' &&
    Array.isArray(gameData.glassesPeekTargets) &&
    typeof gameData.glassesPeekTargets[pIdx] === 'number'
      ? gameData.glassesPeekTargets[pIdx]
      : null;

  // Calculate my points
  let myPoints = 0;
  for (const player of gameData.players) {
    for (const pc of player.pointCards) {
      if (pc.controller === pIdx) {
        const rank = pc.card.rank;
        if (rank === 'A') myPoints += 1;
        else if (!['J', 'Q', 'K'].includes(rank)) myPoints += parseInt(rank);
      }
    }
  }

  // Calculate goal based on kings
  const kingCount = myPlayer.permanents.filter(p => p.type === 'king').length;
  const goals = variant === 'cutthroat'
    ? [14, 9, 5, 0]
    : (variant === 'standard' || variant === 'team')
      ? [21, 14, 10, 5, 0]
      : [21, 14, 10, 7, 5];
  const myGoal = goals[Math.min(kingCount, goals.length - 1)];

  // Get point cards I control
  const myPointCards = [];
  for (const player of gameData.players) {
    for (const pc of player.pointCards) {
      if (pc.controller === pIdx) {
        myPointCards.push(pc);
      }
    }
  }

  // Track main opponent for 2-player mode
  let mainOpponentIdx = -1;

  // Opponents' data
  const opponents = [];
  for (let i = 0; i < state.numPlayers; i++) {
    if (i === pIdx) continue;
    if (variant === 'team' && i === (pIdx + 2) % 4) continue; // Skip partner

    const oppPlayer = gameData.players[i];

    // Track first opponent as main opponent
    if (mainOpponentIdx === -1) mainOpponentIdx = i;

    let oppPoints = 0;
    for (const player of gameData.players) {
      for (const pc of player.pointCards) {
        if (pc.controller === i) {
          const rank = pc.card.rank;
          if (rank === 'A') oppPoints += 1;
          else if (!['J', 'Q', 'K'].includes(rank)) oppPoints += parseInt(rank);
        }
      }
    }

    const oppKingCount = oppPlayer.permanents.filter(p => p.type === 'king').length;
    const oppGoal = goals[Math.min(oppKingCount, goals.length - 1)];

    const oppPointCards = [];
    for (const player of gameData.players) {
      for (const pc of player.pointCards) {
        if (pc.controller === i) {
          oppPointCards.push(pc);
        }
      }
    }

    opponents.push({
      playerIndex: i,
      handSize: oppPlayer.hand.length,
      hand:
        !weHaveGlasses
          ? null
          : variant === 'cutthroat'
            ? (glassesTargetPlayer === i ? oppPlayer.hand : null)
            : oppPlayer.hand,
      points: oppPoints,
      goal: oppGoal,
      pointCards: oppPointCards,
      permanents: oppPlayer.permanents,
    });
  }

  // For 2-player compatibility, include opponentHand and opponentHandSize at top level
  const mainOpponent = mainOpponentIdx >= 0 ? gameData.players[mainOpponentIdx] : null;

  return {
    myHand,
    myPoints,
    myGoal,
    myPointCards,
    myPermanents: myPlayer.permanents,
    opponents,
    deckSize: gameData.deck.length,
    scrap: gameData.scrap,
    phase: gameData.phase,
    currentPlayer: gameData.currentPlayer,
    isMyTurn: gameData.currentPlayer === pIdx,
    glassesTargetPlayer,
    // 2-player compatibility fields
    opponentHandSize: mainOpponent ? mainOpponent.hand.length : 0,
    opponentHand:
      !weHaveGlasses || !mainOpponent
        ? null
        : variant === 'cutthroat'
          ? (glassesTargetPlayer === mainOpponentIdx ? mainOpponent.hand : null)
          : mainOpponent.hand,
  };
}

function renderPartnerMultiplayer(gameData, partnerIdx) {
  const partnerPlayer = gameData.players[partnerIdx];

  // Calculate partner's points
  let partnerPoints = 0;
  for (const player of gameData.players) {
    for (const pc of player.pointCards) {
      if (pc.controller === partnerIdx) {
        const rank = pc.card.rank;
        if (rank === 'A') partnerPoints += 1;
        else if (!['J', 'Q', 'K'].includes(rank)) partnerPoints += parseInt(rank);
      }
    }
  }

  const kingCount = partnerPlayer.permanents.filter(p => p.type === 'king').length;
  const goals = [21, 14, 10, 7, 5];
  const partnerGoal = goals[Math.min(kingCount, goals.length - 1)];

  const partnerPointCards = [];
  for (const player of gameData.players) {
    for (const pc of player.pointCards) {
      if (pc.controller === partnerIdx) {
        partnerPointCards.push(pc);
      }
    }
  }

  const isPartnerTurn = gameData.currentPlayer === partnerIdx;

  elements.partnerArea.classList.remove('hidden');
  elements.partnerArea.innerHTML = `
    <div class="player-header">
      <span class="player-name">🤝 Partner</span>
      <span class="player-points">${partnerPoints}/${partnerGoal}</span>
      ${isPartnerTurn ? '<span class="turn-indicator">THEIR TURN</span>' : ''}
    </div>
    <div class="card-row">
      <label>Permanents:</label>
      <div class="permanents" id="partner-permanents"></div>
    </div>
    <div class="card-row">
      <label>Points:</label>
      <div class="point-cards" id="partner-points"></div>
    </div>
    <div class="card-row">
      <label>Hand:</label>
      <div class="hand opponent-hand" id="partner-hand"></div>
    </div>
  `;

  // Render partner's cards
  const partnerHandEl = elements.partnerArea.querySelector('#partner-hand');
  const partnerPointsEl = elements.partnerArea.querySelector('#partner-points');
  const partnerPermsEl = elements.partnerArea.querySelector('#partner-permanents');

  // Hand (face down)
  partnerHandEl.innerHTML = '';
  for (let i = 0; i < partnerPlayer.hand.length; i++) {
    partnerHandEl.appendChild(createCardBack({ mini: true }));
  }

  // Point cards
  partnerPointsEl.innerHTML = '';
  for (const pc of partnerPointCards) {
    const cardEl = createCardElement(pc.card, {
      mini: true,
      attachedJacks: pc.attachedJacks.length || undefined
    });
    partnerPointsEl.appendChild(cardEl);
  }

  // Permanents
  partnerPermsEl.innerHTML = '';
  for (const perm of partnerPlayer.permanents) {
    partnerPermsEl.appendChild(createCardElement(perm.card, { mini: true }));
  }
}

function checkMultiplayerGameEnd(gameData) {
  if (gameData.winner !== null && gameData.winner !== undefined) {
    const won = gameData.winner === state.playerIndex ||
                (state.variant === 'team' && gameData.winner % 2 === state.playerIndex % 2);

    elements.gameOverTitle.textContent = won ? '🎉 Victory!' : '😔 Defeat';
    elements.gameOverMessage.textContent = won
      ? 'Congratulations! You won the battle!'
      : `Player ${gameData.winner + 1} wins. Better luck next time!`;

    populateGameOverChronicle();
    elements.gameOverModal.classList.remove('hidden');
    trapFocus(elements.gameOverModal);
  } else if (gameData.isDraw) {
    elements.gameOverTitle.textContent = '🤝 Draw';
    elements.gameOverMessage.textContent = 'The battle ended in a stalemate!';
    populateGameOverChronicle();
    elements.gameOverModal.classList.remove('hidden');
    trapFocus(elements.gameOverModal);
  }
}

// Update ready status on game over modal
function updateReadyStatus() {
  const readyState = state.serverState?._gameState?.readyForNextGame || {};
  const players = state.serverState?._gameState?.players || {};
  const numPlayers = state.serverState?._gameState?.numPlayers || 2;

  // Find my player index
  let myIndex = -1;
  for (let i = 0; i < numPlayers; i++) {
    if (players[i] === state.clientId) {
      myIndex = i;
      break;
    }
  }

  // Check if opponent is ready
  let opponentReady = false;
  for (let i = 0; i < numPlayers; i++) {
    if (i !== myIndex && players[i] && readyState[i]) {
      opponentReady = true;
      break;
    }
  }

  const btn = document.getElementById('play-again');
  const gameOverModalVisible = !elements.gameOverModal.classList.contains('hidden');

  if (gameOverModalVisible && opponentReady && !readyState[myIndex]) {
    // Opponent is ready but we're not - show prompt
    btn.textContent = 'Opponent is waiting - Play Again?';
    btn.disabled = false;
  } else if (gameOverModalVisible && readyState[myIndex]) {
    // We're ready, waiting for opponent
    btn.textContent = 'Waiting for opponent...';
    btn.disabled = true;
  }
}

// Sync chronicle from server history
function syncChronicleFromServer() {
  const serverHistory = state.serverState?._gameState?.history || [];
  const lastSyncedIndex = state.lastSyncedHistoryIndex || 0;

  // Add any new entries from the server
  for (let i = lastSyncedIndex; i < serverHistory.length; i++) {
    const entry = serverHistory[i];
    // Use the message from server, don't try to reformat
    addToHistory(entry.message, entry.playerIndex);
  }

  // Update the synced index
  state.lastSyncedHistoryIndex = serverHistory.length;
}

function disconnectFromServer() {
  if (state.socket) {
    state.socket.close();
    state.socket = null;
  }
  state.isMultiplayer = false;
  state.serverState = null;
  state.serverValidActions = {};
  state.clientId = null;
  state.lastSyncedHistoryIndex = 0; // Reset sync index
  // Clear stored clientId so next game gets a fresh ID
  sessionStorage.removeItem('cuttle-clientId');
}

// Multiplayer action execution
async function executeMultiplayerAction(action) {
  sendToServer({
    cmd: 'dispatch',
    type: 'cuttle:action',
    payload: { action, clientId: state.clientId }
  });

  // Note: Chronicle is synced from server history, not added locally

  hideActionPanel();
  clearTargetHighlights();
  state.selectedCard = null;
}

// Data-driven action descriptions for chronicle/history
const ACTION_DESCRIPTIONS = {
  draw: 'Draw a card',
  pass: 'Pass',
  point: 'Play for points',
  oneoff: 'Play one-off',
  permanent: 'Play permanent',
  scuttle: 'Scuttle',
  counter: 'Counter',
  choose: 'Retrieve from scrap',
  discard: 'Discard',
  five_discard: 'Discard (for 5)',
  three_retrieve: 'Retrieve from scrap',
  nine_target: 'Target permanent',
  nine_response: 'Block Royal',
  joker: 'Steal royal'
};

function formatActionForHistory(action) {
  const actionType = action.split(':')[0];
  return ACTION_DESCRIPTIONS[actionType] || action;
}

// Suit symbols
const suitSymbols = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' };
const suitColors = { clubs: 'black', diamonds: 'red', hearts: 'red', spades: 'black' };

// ============================================================================
// Card Rendering
// ============================================================================

// SVG card filename mappings
const rankToFilename = {
  'A': 'ace', '2': '2', '3': '3', '4': '4', '5': '5',
  '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
  'J': 'jack', 'Q': 'queen', 'K': 'king'
};

function createCardElement(card, options = {}) {
  const div = document.createElement('div');
  div.className = 'card card-sprite';
  div.dataset.cardId = card.id;

  // Store card data for preview access
  div._cardData = card;

  // Accessibility attributes
  const accessibleName = getCardAccessibleName(card);
  div.setAttribute('role', options.interactive !== false ? 'option' : 'img');
  div.setAttribute('aria-label', accessibleName);
  if (options.interactive !== false) {
    div.setAttribute('tabindex', '0');
  }

  // Add sprite position class
  let spriteClass;
  if (card.isJoker) {
    // Use red joker for hearts, black joker for spades
    spriteClass = card.suit === 'hearts' ? 'sprite-red-joker' : 'sprite-black-joker';
    div.classList.add('joker');
  } else {
    const rankName = rankToFilename[card.rank];
    spriteClass = `sprite-${rankName}-${card.suit}`;
    div.dataset.rank = card.rank;
    div.dataset.suit = card.suit;
  }
  div.classList.add(spriteClass);

  if (options.mini) div.classList.add('mini');
  if (options.attachedJacks) {
    const jackSpan = document.createElement('span');
    jackSpan.className = 'attached-jacks';
    jackSpan.textContent = `J×${options.attachedJacks}`;
    jackSpan.setAttribute('aria-label', `${options.attachedJacks} Jacks attached`);
    div.appendChild(jackSpan);
  }

  // Add card preview handlers (unless disabled or on touch device)
  const isTouchDevice = window.matchMedia('(hover: none)').matches || window.matchMedia('(pointer: coarse)').matches;
  if (options.noPreview !== true && !isTouchDevice) {
    div.addEventListener('mouseenter', (e) => showCardPreview(card, e));
    div.addEventListener('mousemove', (e) => {
      previewMouseX = e.clientX;
      previewMouseY = e.clientY;
      updatePreviewPosition();
    });
    div.addEventListener('mouseleave', () => clearCardPreview());
  }

  return div;
}

function createCardBack(options = {}) {
  const div = document.createElement('div');
  div.className = 'card card-sprite card-back sprite-back';
  div.setAttribute('aria-label', 'Card back');

  if (options.mini) div.classList.add('mini');
  return div;
}

// Card info for preview panel
function getCardInfo(card) {
  if (card.isJoker) {
    return {
      type: 'Permanent',
      desc: 'Steal any royal (J, Q, K) from an opponent. Attach to the stolen card.'
    };
  }

  const rank = card.rank;

  // Card effects vary by variant
  const effects = {
    'A': { type: 'Point / One-Off', desc: 'Point: 1 point\nOne-Off: Destroy ALL point cards in play' },
    '2': { type: 'Point / One-Off', desc: 'Point: 2 points\nOne-Off: Destroy a permanent OR counter a one-off' },
    '3': { type: 'Point / One-Off', desc: 'Point: 3 points\nOne-Off: Retrieve any card from the scrap pile' },
    '4': { type: 'Point / One-Off', desc: 'Point: 4 points\nOne-Off: Opponent discards 2 cards from hand' },
    '5': { type: 'Point / One-Off', desc: state.variant === 'classic' ? 'Point: 5 points\nOne-Off: Draw 2 cards' : 'Point: 5 points\nOne-Off: Discard 1, then draw 3' },
    '6': { type: 'Point / One-Off', desc: 'Point: 6 points\nOne-Off: Destroy ALL permanents in play' },
    '7': { type: 'Point / One-Off', desc: state.variant === 'classic' ? 'Point: 7 points\nOne-Off: Draw 1 and play it immediately' : 'Point: 7 points\nOne-Off: Reveal top 2, choose 1 to play' },
    '8': {
      type: 'Point / Permanent',
      desc: state.variant === 'cutthroat'
        ? 'Point: 8 points\nPermanent: "Glasses" - Peek one opponent hand at any time'
        : 'Point: 8 points\nPermanent: "Glasses" - See opponent hand'
    },
    '9': {
      type: 'Point / One-Off',
      desc: state.variant === 'classic'
        ? 'Point: 9 points\nOne-Off: Return a permanent to hand'
        : state.variant === 'cutthroat'
          ? 'Point: 9 points\nOne-Off: Return a permanent + freeze + owner skips turn'
          : 'Point: 9 points\nOne-Off: Return a permanent to hand (frozen until next turn)'
    },
    '10': { type: 'Point', desc: 'Point: 10 points\nCan also scuttle lower point cards' },
    'J': { type: 'Permanent', desc: 'Steal control of an opponent\'s point card. Attach to the stolen card.' },
    'Q': { type: 'Permanent', desc: 'Protect your other cards from being targeted by opponents.' },
    'K': {
      type: 'Permanent',
      desc: (state.variant === 'standard' || state.variant === 'team')
        ? 'Reduce your goal: 21→14→10→5→0\nMultiple Kings stack!'
        : state.variant === 'cutthroat'
          ? 'Reduce your goal: 14→9→5→0\nMultiple Kings stack!'
          : 'Reduce your goal: 21→14→10→7→5\nMultiple Kings stack!'
    },
  };

  return effects[rank] || { type: 'Card', desc: '' };
}

// Floating preview tooltip - track current mouse position
let previewMouseX = 0;
let previewMouseY = 0;

function updatePreviewPosition() {
  if (!elements.cardPreview.classList.contains('visible')) return;

  const preview = elements.cardPreview;
  const padding = 15;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Get preview dimensions
  const rect = preview.getBoundingClientRect();
  const previewWidth = rect.width || 180;
  const previewHeight = rect.height || 250;

  // Position to the right of cursor by default
  let x = previewMouseX + padding;
  let y = previewMouseY - previewHeight / 2;

  // If would go off right edge, show on left of cursor
  if (x + previewWidth > viewportWidth - padding) {
    x = previewMouseX - previewWidth - padding;
  }

  // Keep within vertical bounds
  if (y < padding) y = padding;
  if (y + previewHeight > viewportHeight - padding) {
    y = viewportHeight - previewHeight - padding;
  }

  preview.style.left = `${x}px`;
  preview.style.top = `${y}px`;
}

// Show card in floating preview tooltip
function showCardPreview(card, event) {
  if (!card) {
    clearCardPreview();
    return;
  }

  // Create a larger version of the card (no preview on preview card)
  const cardEl = createCardElement(card, { noPreview: true });
  elements.previewCard.innerHTML = '';
  elements.previewCard.appendChild(cardEl);

  // Show card info
  const info = getCardInfo(card);
  elements.previewType.textContent = info.type;
  elements.previewDesc.textContent = info.desc;

  // Show and position the tooltip
  elements.cardPreview.classList.add('visible');
  if (event) {
    previewMouseX = event.clientX;
    previewMouseY = event.clientY;
  }
  updatePreviewPosition();
}

function clearCardPreview() {
  elements.previewCard.innerHTML = '';
  elements.previewType.textContent = '';
  elements.previewDesc.textContent = '';
  elements.cardPreview.classList.remove('visible');
}

// ============================================================================
// Game Rendering
// ============================================================================

function renderOpponents(obs, gameState, hasGlasses) {
  elements.opponentsContainer.innerHTML = '';

  if (!obs) {
    console.error('renderOpponents: obs is undefined');
    return;
  }

  // Get opponents list - use obs.opponents for 3+ players, construct for 2-player
  let opponents;
  if (obs.opponents && obs.opponents.length > 0) {
    opponents = obs.opponents;
  } else if (obs.opponentHandSize !== undefined) {
    // 2-player mode: construct opponent from legacy fields
    const oppIndex = 1 - state.playerIndex;
    opponents = [{
      playerIndex: oppIndex,
      handSize: obs.opponentHandSize || 0,
      hand: obs.opponentHand || null, // Only present if we have Glasses
      points: obs.opponentPoints || 0,
      goal: obs.opponentGoal || 21,
      pointCards: obs.opponentPointCards || [],
      permanents: obs.opponentPermanents || [],
    }];
  } else {
    console.error('renderOpponents: No opponent data available');
    return;
  }

  for (const opp of opponents) {
    // In Team variant, skip the teammate - they're rendered separately at the bottom
    const isTeammate = state.variant === 'team' && obs.teammateIndex === opp.playerIndex;
    if (isTeammate) continue;

    const section = document.createElement('section');
    section.className = 'player-area';
    section.id = `opponent-${opp.playerIndex}`;

    const isTurn = gameState.currentPlayer === opp.playerIndex;
    const isSkipped = obs.skipTurnPlayers && obs.skipTurnPlayers.includes(opp.playerIndex);

    // Header
    const header = document.createElement('div');
    header.className = 'player-header';
    const playerIcon = '👤';
    const playerLabel = `Foe ${opp.playerIndex}`;
    header.innerHTML = `
      <span class="player-name">${playerIcon} ${playerLabel}</span>
      <span class="player-points">${opp.points}/${opp.goal}</span>
      ${isTurn ? '<span class="turn-indicator">THEIR TURN</span>' : ''}
      ${isSkipped ? '<span class="turn-indicator" style="background:#666;">SKIP</span>' : ''}
    `;
    if (state.variant === 'cutthroat' && hasGlasses) {
      const isPeekTarget = obs.glassesTargetPlayer === opp.playerIndex;
      const peekHint = document.createElement('span');
      peekHint.className = 'turn-indicator';
      peekHint.style.background = isPeekTarget ? '#1f7a1f' : '#444';
      peekHint.textContent = isPeekTarget ? 'PEEKING' : 'PEEK';
      header.appendChild(peekHint);
      section.style.cursor = 'pointer';
      section.title = `Select Player ${opp.playerIndex} as glasses peek target`;
      section.addEventListener('click', () => {
        const peekAction = `peek:${opp.playerIndex}`;
        if (state.isMultiplayer) {
          const myActions = state.serverValidActions[state.playerIndex] || [];
          if (myActions.includes(peekAction)) {
            executeMultiplayerAction(peekAction);
          }
          return;
        }
        const actions = state.game.getValidActions(state.playerIndex);
        if (actions.includes(peekAction)) {
          const result = state.game.action(state.playerIndex, peekAction);
          if (result.success) {
            addToHistory(`Peek at Player ${opp.playerIndex}`, state.playerIndex);
            render();
          }
        }
      });
    }
    section.appendChild(header);

    // Hand row
    const handRow = document.createElement('div');
    handRow.className = 'card-row';
    const handLabel = document.createElement('label');
    handLabel.textContent = 'Hand:';
    handRow.appendChild(handLabel);

    const handContainer = document.createElement('div');
    handContainer.className = 'hand opponent-hand';

    // If we have Glasses AND the opponent's hand is revealed, show the cards
    if (hasGlasses && opp.hand && Array.isArray(opp.hand)) {
      for (const card of opp.hand) {
        const cardEl = createCardElement(card, { mini: true });
        cardEl.style.cursor = 'default';
        handContainer.appendChild(cardEl);
      }
    } else {
      // Show face-down cards
      for (let i = 0; i < opp.handSize; i++) {
        handContainer.appendChild(createCardBack({ mini: true }));
      }
    }
    handRow.appendChild(handContainer);
    section.appendChild(handRow);

    // Points row - show all cards this opponent controls
    const pointsRow = document.createElement('div');
    pointsRow.className = 'card-row';
    const pointsLabel = document.createElement('label');
    pointsLabel.textContent = 'Points:';
    pointsRow.appendChild(pointsLabel);

    const pointsContainer = document.createElement('div');
    pointsContainer.className = 'point-cards';

    // Cards from their own pointCards that they control
    for (const pc of opp.pointCards) {
      if (pc.controller === opp.playerIndex) {
        const card = createCardElement(pc.card, {
          mini: true,
          attachedJacks: pc.attachedJacks.length || null,
        });
        card.style.cursor = 'default';
        pointsContainer.appendChild(card);
      }
    }

    // Cards stolen from the human player (in obs.myPointCards but controlled by this opponent)
    const myObs = state.game.getObservation(state.playerIndex);
    for (const pc of myObs.myPointCards) {
      if (pc.controller === opp.playerIndex) {
        const card = createCardElement(pc.card, {
          mini: true,
          attachedJacks: pc.attachedJacks.length || null,
        });
        card.style.cursor = 'default';
        card.title = 'Stolen from you';
        pointsContainer.appendChild(card);
      }
    }

    // Cards stolen from other opponents
    for (const other of opponents) {
      if (other.playerIndex === opp.playerIndex) continue;
      for (const pc of other.pointCards) {
        if (pc.controller === opp.playerIndex) {
          const card = createCardElement(pc.card, {
            mini: true,
            attachedJacks: pc.attachedJacks.length || null,
          });
          card.style.cursor = 'default';
          card.title = `Stolen from P${other.playerIndex}`;
          pointsContainer.appendChild(card);
        }
      }
    }

    pointsRow.appendChild(pointsContainer);
    section.appendChild(pointsRow);

    // Permanents row
    const permRow = document.createElement('div');
    permRow.className = 'card-row';
    const permLabel = document.createElement('label');
    permLabel.textContent = 'Permanents:';
    permRow.appendChild(permLabel);

    const permContainer = document.createElement('div');
    permContainer.className = 'permanents';
    for (const perm of opp.permanents) {
      const card = createCardElement(perm.card, { mini: true });
      card.style.cursor = 'default';
      permContainer.appendChild(card);
    }
    permRow.appendChild(permContainer);
    section.appendChild(permRow);

    elements.opponentsContainer.appendChild(section);
  }
}

// Render the partner area (Team variant only) - shown next to "You" at the bottom
function renderPartner(obs, gameState, hasGlasses) {
  // Hide partner area if not Team variant
  if (state.variant !== 'team' || !obs || obs.teammateIndex === undefined) {
    elements.partnerArea.classList.add('hidden');
    elements.partnerArea.innerHTML = '';
    return;
  }

  // Find the partner in opponents list
  const opponents = obs.opponents || [];
  const partner = opponents.find(o => o.playerIndex === obs.teammateIndex);
  if (!partner) {
    elements.partnerArea.classList.add('hidden');
    return;
  }

  elements.partnerArea.classList.remove('hidden');
  elements.partnerArea.innerHTML = '';

  const isTurn = gameState.currentPlayer === partner.playerIndex;
  const isSkipped = obs.skipTurnPlayers && obs.skipTurnPlayers.includes(partner.playerIndex);

  // Header
  const header = document.createElement('div');
  header.className = 'player-header';
  header.innerHTML = `
    <span class="player-name">🤝 Partner</span>
    <span class="player-points">${partner.points}/${partner.goal}</span>
    ${isTurn ? '<span class="turn-indicator">THEIR TURN</span>' : ''}
    ${isSkipped ? '<span class="turn-indicator" style="background:#666;">SKIP</span>' : ''}
  `;
  elements.partnerArea.appendChild(header);

  // Hand row
  const handRow = document.createElement('div');
  handRow.className = 'card-row';
  const handLabel = document.createElement('label');
  handLabel.textContent = 'Hand:';
  handRow.appendChild(handLabel);

  const handContainer = document.createElement('div');
  handContainer.className = 'hand opponent-hand';

  if (hasGlasses && partner.hand && Array.isArray(partner.hand)) {
    for (const card of partner.hand) {
      const cardEl = createCardElement(card, { mini: true });
      cardEl.style.cursor = 'default';
      handContainer.appendChild(cardEl);
    }
  } else {
    for (let i = 0; i < partner.handSize; i++) {
      handContainer.appendChild(createCardBack({ mini: true }));
    }
  }
  handRow.appendChild(handContainer);
  elements.partnerArea.appendChild(handRow);

  // Points row
  const pointsRow = document.createElement('div');
  pointsRow.className = 'card-row';
  const pointsLabel = document.createElement('label');
  pointsLabel.textContent = 'Points:';
  pointsRow.appendChild(pointsLabel);

  const pointsContainer = document.createElement('div');
  pointsContainer.className = 'point-cards';

  for (const pc of partner.pointCards) {
    if (pc.controller === partner.playerIndex) {
      const card = createCardElement(pc.card, {
        mini: true,
        attachedJacks: pc.attachedJacks.length || null,
      });
      card.style.cursor = 'default';
      pointsContainer.appendChild(card);
    }
  }
  pointsRow.appendChild(pointsContainer);
  elements.partnerArea.appendChild(pointsRow);

  // Permanents row
  const permRow = document.createElement('div');
  permRow.className = 'card-row';
  const permLabel = document.createElement('label');
  permLabel.textContent = 'Permanents:';
  permRow.appendChild(permLabel);

  const permContainer = document.createElement('div');
  permContainer.className = 'permanents';
  for (const perm of partner.permanents) {
    const card = createCardElement(perm.card, { mini: true });
    card.style.cursor = 'default';
    permContainer.appendChild(card);
  }
  permRow.appendChild(permContainer);
  elements.partnerArea.appendChild(permRow);
}

// Render the one-off zone showing pending one-offs and counter chain
function renderOneoffZone(state) {
  if (!state.pendingOneOff) {
    elements.oneoffZone.classList.add('hidden');
    return;
  }

  elements.oneoffZone.classList.remove('hidden');
  elements.oneoffCards.innerHTML = '';

  const pending = state.pendingOneOff;

  // Show the original one-off card
  const mainCard = createCardElement(pending.card, { mini: true });
  mainCard.style.cursor = 'default';
  mainCard.title = `P${pending.player}'s one-off`;
  elements.oneoffCards.appendChild(mainCard);

  // Show the counter chain (2s played back and forth)
  for (let i = 0; i < pending.counterChain.length; i++) {
    const counterCard = pending.counterChain[i];

    // Add arrow between cards
    const arrow = document.createElement('span');
    arrow.className = 'counter-arrow';
    arrow.textContent = '→';
    elements.oneoffCards.appendChild(arrow);

    const cardEl = createCardElement(counterCard, { mini: true });
    cardEl.style.cursor = 'default';
    // Determine who played this counter (alternates)
    const counterPlayer = i % 2 === 0
      ? (pending.targetPlayer ?? (pending.player + 1) % getNumPlayers())
      : pending.player;
    cardEl.title = `P${counterPlayer}'s counter`;
    elements.oneoffCards.appendChild(cardEl);
  }

  // Update the label to show status
  const labelEl = elements.oneoffZone.querySelector('.oneoff-label');
  if (labelEl) {
    if (pending.counterChain.length === 0) {
      labelEl.textContent = 'One-Off';
    } else {
      labelEl.textContent = `Counter ×${pending.counterChain.length}`;
    }
  }
}

// Render the seven zone showing revealed/drawn cards from 7 effect
function renderSevenZone(gameState, obs) {
  const isSevenPhase = gameState.phase === 'resolve_seven' || gameState.phase === 'resolve_seven_choose';

  // Use global state.playerIndex, not the game state (which doesn't have playerIndex)
  if (!isSevenPhase || gameState.currentPlayer !== state.playerIndex) {
    elements.sevenZone.classList.add('hidden');
    return;
  }

  // Get the cards to display
  let cards = [];
  let labelText = 'Play from 7';

  if (gameState.phase === 'resolve_seven' && obs.sevenDrawnCard) {
    // Classic: single drawn card that must be played
    cards = [obs.sevenDrawnCard];
    labelText = 'Must Play';
  } else if (gameState.phase === 'resolve_seven_choose' && obs.sevenRevealedCards) {
    // Standard: choose one of two revealed cards
    cards = obs.sevenRevealedCards;
    labelText = 'Choose One';
  }

  if (cards.length === 0) {
    elements.sevenZone.classList.add('hidden');
    return;
  }

  elements.sevenZone.classList.remove('hidden');
  elements.sevenCards.innerHTML = '';

  // Update label
  const labelEl = elements.sevenZone.querySelector('.seven-label');
  if (labelEl) {
    labelEl.textContent = labelText;
  }

  // Display the cards
  for (const card of cards) {
    const cardEl = createCardElement(card);
    cardEl.addEventListener('click', () => handleSevenCardClick(card));
    elements.sevenCards.appendChild(cardEl);
  }
}

// Handle clicking a card in the seven zone
function handleSevenCardClick(card) {
  if (state.isMultiplayer) {
    handleSevenCardClickMultiplayer(card);
    return;
  }

  if (!state.game) return;

  const gameState = state.game.getState();
  if (gameState.phase !== 'resolve_seven' && gameState.phase !== 'resolve_seven_choose') return;
  if (gameState.currentPlayer !== state.playerIndex) return;

  // Get valid actions for this card
  const actions = state.game.getValidActions(state.playerIndex);
  const cardActions = actions.filter(a => {
    const parts = a.split(':');
    // seven_* actions have cardId as second part
    if (parts.length > 1 && parseInt(parts[1]) === card.id) return true;
    return false;
  });

  if (cardActions.length === 0) {
    showMessage('No valid plays for this card.');
    return;
  }

  if (cardActions.length === 1) {
    // Only one option - execute it directly
    executeSevenAction(cardActions[0]);
  } else {
    // Multiple options - show action panel
    state.selectedCard = card;
    elements.actionButtons.innerHTML = '';
    for (const action of cardActions) {
      const btn = document.createElement('button');
      btn.textContent = formatAction(action);
      btn.addEventListener('click', () => executeSevenAction(action));
      elements.actionButtons.appendChild(btn);
    }
    elements.actionPanel.classList.remove('hidden');
  }
}

// Handle clicking a card in the seven zone (multiplayer)
function handleSevenCardClickMultiplayer(card) {
  const gameData = state.serverState?._gameState?.game;
  if (!gameData) return;

  if (gameData.phase !== 'resolve_seven' && gameData.phase !== 'resolve_seven_choose') return;
  if (gameData.currentPlayer !== state.playerIndex) return;

  // Get valid actions for this card from server
  const actions = state.serverValidActions[state.playerIndex] || [];
  const cardActions = actions.filter(a => {
    const parts = a.split(':');
    // seven_* actions have cardId as second part
    if (parts.length > 1 && parseInt(parts[1]) === card.id) return true;
    // scrap_seven:cardId also matches
    if (a.startsWith('scrap_seven:') && parseInt(parts[1]) === card.id) return true;
    return false;
  });

  if (cardActions.length === 0) {
    showMessage('No valid plays for this card.');
    return;
  }

  if (cardActions.length === 1) {
    // Only one option - execute it directly
    executeMultiplayerAction(cardActions[0]);
  } else {
    // Multiple options - show action panel
    state.selectedCard = card;
    elements.actionButtons.innerHTML = '';
    for (const action of cardActions) {
      const btn = document.createElement('button');
      btn.textContent = formatAction(action);
      btn.addEventListener('click', () => executeMultiplayerAction(action));
      elements.actionButtons.appendChild(btn);
    }
    elements.actionPanel.classList.remove('hidden');
  }
}

// Execute a seven action
async function executeSevenAction(action) {
  const actionStr = formatAction(action);
  const result = state.game.action(state.playerIndex, action);

  if (!result.success) {
    showMessage(`Error: ${result.message}`);
    return;
  }

  addToHistory(actionStr, state.playerIndex);
  hideActionPanel();
  state.selectedCard = null;
  render();

  if (checkGameEnd()) return;
  await runAITurn();
}

// Show the scrap pile browser
function showScrapBrowser(selectable = false) {
  if (!state.game) return;

  const obs = state.game.getObservation(state.playerIndex);
  const scrap = obs.scrap || [];

  elements.scrapCards.innerHTML = '';

  if (scrap.length === 0) {
    elements.scrapCards.innerHTML = '<p style="color: var(--text-dim);">Scrap pile is empty</p>';
  } else {
    // Show cards from oldest to newest (bottom to top)
    for (const card of scrap) {
      const cardEl = createCardElement(card);
      if (selectable) {
        cardEl.addEventListener('click', () => selectScrapCard(card));
      } else {
        cardEl.style.cursor = 'default';
      }
      elements.scrapCards.appendChild(cardEl);
    }
  }

  // Update instruction text and styling
  if (selectable) {
    elements.scrapInstruction.textContent = 'Click a card to retrieve it.';
    elements.scrapCards.classList.remove('view-only');
  } else {
    elements.scrapInstruction.textContent = `${scrap.length} card${scrap.length !== 1 ? 's' : ''} in scrap.`;
    elements.scrapCards.classList.add('view-only');
  }

  // Show/hide close button based on whether selection is required
  elements.closeScrap.style.display = selectable ? 'none' : 'block';

  elements.scrapModal.classList.remove('hidden');
  trapFocus(elements.scrapModal);
}

// Hide the scrap browser
function hideScrapBrowser() {
  releaseFocusTrap(elements.scrapModal);
  elements.scrapModal.classList.add('hidden');
}

// Show scrap browser for multiplayer mode
function showScrapBrowserMultiplayer(selectable = false) {
  const gameData = state.serverState?._gameState?.game;
  if (!gameData) return;

  const scrap = gameData.scrap || [];

  elements.scrapCards.innerHTML = '';

  if (scrap.length === 0) {
    elements.scrapCards.innerHTML = '<p style="color: var(--text-dim);">Scrap pile is empty</p>';
  } else {
    for (const card of scrap) {
      const cardEl = createCardElement(card);
      if (selectable) {
        cardEl.addEventListener('click', () => selectScrapCardMultiplayer(card));
      } else {
        cardEl.style.cursor = 'default';
      }
      elements.scrapCards.appendChild(cardEl);
    }
  }

  if (selectable) {
    elements.scrapInstruction.textContent = 'Click a card to retrieve it.';
    elements.scrapCards.classList.remove('view-only');
  } else {
    elements.scrapInstruction.textContent = `${scrap.length} card${scrap.length !== 1 ? 's' : ''} in scrap.`;
    elements.scrapCards.classList.add('view-only');
  }

  elements.closeScrap.style.display = selectable ? 'none' : 'block';
  elements.scrapModal.classList.remove('hidden');
  trapFocus(elements.scrapModal);
}

// Handle scrap card selection in multiplayer
async function selectScrapCardMultiplayer(card) {
  const gameData = state.serverState?._gameState?.game;
  if (!gameData || gameData.phase !== 'resolve_three') return;

  executeMultiplayerAction(`choose:${card.id}`);
  hideScrapBrowser();
}

// Handle scrap card selection (for 3 one-off)
async function selectScrapCard(card) {
  const gameState = state.game.getState();
  if (gameState.phase !== 'resolve_three') return;

  const action = `choose:${card.id}`;
  const result = state.game.action(state.playerIndex, action);

  if (result.success) {
    addToHistory(`Retrieve ${card.rank}${suitSymbols[card.suit]}`, state.playerIndex);
    hideScrapBrowser();
    render();

    if (checkGameEnd()) return;
    await runAITurn();
  } else {
    showMessage(`Error: ${result.message}`);
  }
}

function render() {
  if (!state.game) return;

  const gameState = state.game.getState();
  const obs = state.game.getObservation(state.playerIndex);

  // Check if we have "Glasses" (8 permanent) - reveals opponent hands
  const hasGlasses = obs.myPermanents.some(p => {
    const rank = p.card.rank;
    return rank === '8' || rank === 8;
  });

  // Update header info
  elements.timer.textContent = formatTime(state.gameStartTime);
  elements.deckInfo.textContent = `Deck: ${obs.deckSize}`;
  elements.deckCount.textContent = obs.deckSize;

  // Update deck visual
  if (obs.deckSize === 0) {
    elements.deck.className = 'card empty';
    elements.deck.innerHTML = '<span class="deck-count">0</span>';
  } else {
    elements.deck.className = 'card card-sprite card-back sprite-back';
    elements.deck.innerHTML = `<span class="deck-count">${obs.deckSize}</span>`;
  }

  // Scrap pile top card
  elements.scrapTop.innerHTML = '';
  elements.scrapTop.className = 'card empty';
  if (obs.scrap.length > 0) {
    const topScrap = obs.scrap[obs.scrap.length - 1];
    const scrapCard = createCardElement(topScrap, { mini: true });
    scrapCard.style.cursor = 'default';
    elements.scrapTop.innerHTML = '';
    elements.scrapTop.className = '';
    elements.scrapTop.appendChild(scrapCard);
  }

  // One-off zone (pending one-offs waiting to resolve)
  renderOneoffZone(gameState);

  // Seven zone (revealed cards from 7 effect)
  renderSevenZone(gameState, obs);

  // Render opponents (works for 2+ players)
  renderOpponents(obs, gameState, hasGlasses);

  // Render partner (Team variant only - shown next to "You" at the bottom)
  renderPartner(obs, gameState, hasGlasses);

  // Your hand - track new cards for animation (batch with DocumentFragment)
  const currentHandIds = new Set(obs.myHand.map(c => c.id));
  const handFragment = document.createDocumentFragment();
  for (const card of obs.myHand) {
    const cardEl = createCardElement(card);
    cardEl.addEventListener('click', () => handleCardClick(card));
    if (state.selectedCard && state.selectedCard.id === card.id) {
      cardEl.classList.add('selected');
    }
    // Animate new cards (drawn)
    if (!state.prevHandIds.has(card.id) && state.prevHandIds.size > 0) {
      cardEl.classList.add('card-draw');
      setTimeout(() => cardEl.classList.remove('card-draw'), 400);
    }
    handFragment.appendChild(cardEl);
  }
  elements.yourHand.innerHTML = '';
  elements.yourHand.appendChild(handFragment);
  state.prevHandIds = currentHandIds;

  // Your points (cards you control) - track for animations (batch with DocumentFragment)
  const currentPointIds = new Set();
  const pointsFragment = document.createDocumentFragment();
  // Your own point cards that you still control
  for (const pc of obs.myPointCards) {
    if (pc.controller === state.playerIndex) {
      currentPointIds.add(pc.card.id);
      const card = createCardElement(pc.card, {
        attachedJacks: pc.attachedJacks.length || null,
      });
      card.style.cursor = 'default';
      // Animate new point cards
      if (!state.prevPointIds.has(pc.card.id) && state.prevPointIds.size > 0) {
        card.classList.add('card-play');
        setTimeout(() => card.classList.remove('card-play'), 300);
      }
      pointsFragment.appendChild(card);
    }
  }
  // Cards you've stolen from opponents
  const opponents = obs.opponents || [];
  for (const opp of opponents) {
    for (const pc of opp.pointCards) {
      if (pc.controller === state.playerIndex) {
        const card = createCardElement(pc.card, {
          attachedJacks: pc.attachedJacks.length || null,
        });
        card.style.cursor = 'default';
        card.title = `Stolen from P${opp.playerIndex}`;
        pointsFragment.appendChild(card);
      }
    }
  }
  // For 2-player legacy mode only (when obs.opponents is not available)
  if (obs.opponentPointCards && (!obs.opponents || obs.opponents.length === 0)) {
    for (const pc of obs.opponentPointCards) {
      if (pc.controller === state.playerIndex) {
        currentPointIds.add(pc.card.id);
        const card = createCardElement(pc.card, {
          attachedJacks: pc.attachedJacks.length || null,
        });
        card.style.cursor = 'default';
        card.title = 'Stolen from opponent';
        pointsFragment.appendChild(card);
      }
    }
  }
  elements.yourPoints.innerHTML = '';
  elements.yourPoints.appendChild(pointsFragment);
  state.prevPointIds = currentPointIds;

  // Your permanents - track for animations (batch with DocumentFragment)
  const currentPermIds = new Set(obs.myPermanents.map(p => p.card.id));
  const permsFragment = document.createDocumentFragment();
  for (const perm of obs.myPermanents) {
    const card = createCardElement(perm.card);
    card.style.cursor = 'default';
    // Animate new permanents
    if (!state.prevPermIds.has(perm.card.id) && state.prevPermIds.size > 0) {
      card.classList.add('card-play');
      setTimeout(() => card.classList.remove('card-play'), 300);
    }
    permsFragment.appendChild(card);
  }
  elements.yourPermanents.innerHTML = '';
  elements.yourPermanents.appendChild(permsFragment);
  state.prevPermIds = currentPermIds;

  // Update your points display
  elements.yourPointsDisplay.textContent = `${obs.myPoints}/${obs.myGoal}`;

  // Check for phase changes and show banners
  const prevPhase = state.currentPhase;
  state.currentPhase = gameState.phase;
  const currentPhase = gameState.phase;
  if (prevPhase !== currentPhase && prevPhase !== null) {
    // Show banner for significant phase transitions
    const phaseBanners = {
      'counter': '🛡️ COUNTER PHASE',
      'resolve_four': '📤 DISCARD PHASE',
      'resolve_three': '🌟 SCRAP RETRIEVAL',
      'resolve_seven': '✨ SEVEN REVEALED',
      'resolve_seven_choose': '✨ CHOOSE YOUR FATE',
    };
    // Show "YOUR TURN" when transitioning to play phase and it's human's turn
    if (currentPhase === 'play' && gameState.currentPlayer === state.playerIndex) {
      showPhaseBanner('⚔️ YOUR TURN');
    } else if (phaseBanners[currentPhase]) {
      showPhaseBanner(phaseBanners[currentPhase]);
    }
  }

  // Turn indicator and pass button
  const humanTurn = isHumanTurn();
  if (humanTurn) {
    elements.turnIndicator.classList.remove('hidden');
    if (currentPhase === 'counter') {
      elements.turnIndicator.textContent = 'COUNTER?';
      // Show pass button in counter phase
      elements.passBtn.classList.remove('hidden');
      // Show what one-off is pending
      if (gameState.pendingOneOff) {
        const pendingDesc = describePendingOneOff(gameState.pendingOneOff, obs);
        showMessage(pendingDesc);
      }
    } else if (currentPhase === 'resolve_four') {
      elements.turnIndicator.textContent = 'DISCARD 2';
      elements.passBtn.classList.add('hidden');
      showMessage('You must discard 2 cards from your hand.');
    } else if (currentPhase === 'resolve_five_discard') {
      elements.turnIndicator.textContent = 'DISCARD 1';
      elements.passBtn.classList.add('hidden');
      showMessage('Discard 1 card from your hand, then draw 3.');
    } else if (currentPhase === 'resolve_seven' || currentPhase === 'resolve_seven_choose') {
      elements.turnIndicator.textContent = 'PICK CARD';
      elements.passBtn.classList.add('hidden');
      showMessage('Choose one of the revealed cards to play.');
    } else if (currentPhase === 'resolve_three') {
      elements.turnIndicator.textContent = 'PICK SCRAP';
      elements.passBtn.classList.add('hidden');
      showMessage('Choose a card from the scrap pile. Click the scrap pile to browse.');
      // Auto-show the scrap browser
      showScrapBrowser(true);
    } else if (currentPhase === 'resolve_nine') {
      elements.turnIndicator.textContent = 'TARGET';
      elements.passBtn.classList.add('hidden');
      showMessage('Choose a permanent to return to its owner\'s hand.');
    } else {
      elements.turnIndicator.textContent = 'YOUR TURN';
      elements.passBtn.classList.add('hidden');
    }
  } else {
    elements.turnIndicator.classList.add('hidden');
    elements.passBtn.classList.add('hidden');
  }

  // Note: Move history is now updated via addToHistory queue system
  // renderMoveHistory is only called on game start for initial population
}

function renderMoveHistory() {
  // Only used for initial render (game start or reload)
  // Ongoing entries use addToHistory with typewriter queue
  elements.moveHistoryEl.innerHTML = '';
  state.chronicleQueue = []; // Clear queue on full render
  for (let i = 0; i < state.moveHistory.length; i++) {
    const entry = state.moveHistory[i];
    const div = document.createElement('div');
    const isHero = entry.playerIndex === state.playerIndex;
    div.className = 'history-entry ' + (isHero ? 'hero' : 'enemy');
    if (i === state.moveHistory.length - 1) div.className += ' latest';
    div.textContent = formatChronicleEntry(entry.action, entry.playerIndex);
    elements.moveHistoryEl.appendChild(div);
  }
}

// Generate dramatic Dragon Quest-style chronicle entries
function formatChronicleEntry(action, pIndex) {
  const isHero = pIndex === state.playerIndex;
  // In Team variant: distinguish Partner from Foes
  // In Cutthroat (3 players): distinguish between foes
  const obs = state.game ? state.game.getObservation(state.playerIndex) : null;
  const isPartner = state.variant === 'team' && obs && obs.teammateIndex === pIndex;
  let foeLabel;
  if (isPartner) {
    foeLabel = 'Partner';
  } else if (getNumPlayers() > 2) {
    foeLabel = `Foe ${pIndex}`;
  } else {
    foeLabel = 'Foe';
  }
  const actor = isHero ? 'Hero' : foeLabel;
  const actorPossessive = isHero ? "Hero's" : `${foeLabel}'s`;
  const target = isHero ? 'the Foe' : 'the Hero';
  const targetPossessive = isHero ? "Foe's" : "Hero's";

  // Helper to convert card notation (7H, KS, etc.) to symbols (7♥, K♠)
  const cardToSymbol = (cardStr) => {
    if (!cardStr) return '?';
    // Already has symbols
    if (cardStr.includes('♠') || cardStr.includes('♥') || cardStr.includes('♦') || cardStr.includes('♣')) {
      return cardStr;
    }
    const suitMap = { 'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠' };
    const match = cardStr.match(/^(\d+|[AJQK]+)([HDCS])$/i);
    if (match) {
      return `${match[1]}${suitMap[match[2].toUpperCase()] || match[2]}`;
    }
    return cardStr;
  };

  // Parse the action to extract card info
  // Actions come in formats like:
  // From human: "9♠ → Return YOUR Q♥ to hand", "5♣ as point"
  // From AI: "plays 7H for 7 points", "plays 8S as permanent"

  // Draw actions
  if (action === 'Draw' || action === 'Draw a card' || action === 'draws a card') {
    return isHero
      ? '🎴 Hero draws from the mystical deck!'
      : `🎴 ${actor} reaches for a card...`;
  }

  // AI format: "plays XY for N points" (point card)
  const aiPointMatch = action.match(/plays (\w+) for (\d+) points?/i);
  if (aiPointMatch) {
    const card = cardToSymbol(aiPointMatch[1]);
    const points = aiPointMatch[2];
    return isHero
      ? `💎 Hero claims ${card} for ${points} points!`
      : `💎 ${actor} hoards ${card} worth ${points} points!`;
  }

  // AI format: "plays XY as permanent" (8, Q, K)
  const aiPermMatch = action.match(/plays (\w+) as permanent/i);
  if (aiPermMatch) {
    const card = cardToSymbol(aiPermMatch[1]);
    const rank = aiPermMatch[1].match(/^(\d+|[AJQK])/)?.[1];
    if (rank === '8') {
      return isHero
        ? `👓 Hero equips ${card}! The Spectacles of Truth reveal all!`
        : `👓 ${actor} dons ${card}! Your hand is exposed!`;
    } else if (rank === 'Q') {
      return isHero
        ? `👑 Hero summons ${card}! Royal protection surrounds the realm!`
        : `👑 ${actor} deploys ${card}! A protective aura forms...`;
    } else if (rank === 'K') {
      return isHero
        ? `🏰 Hero crowns ${card}! Victory draws 5 points closer!`
        : `🏰 ${actor} plays ${card}! The goal shifts in their favor...`;
    }
    return isHero ? `🎪 Hero plays ${card} as permanent!` : `🎪 ${actor} establishes ${card}!`;
  }

  // AI format: "plays XY on point card" (Jack)
  const aiJackMatch = action.match(/plays (\w+) on point card/i);
  if (aiJackMatch) {
    const card = cardToSymbol(aiJackMatch[1]);
    return isHero
      ? `🎭 Hero plays ${card}! A point card is STOLEN!`
      : `🎭 ${actor} plays ${card}! A point card is snatched away!`;
  }

  // AI format: "plays XY as one-off"
  const aiOneoffMatch = action.match(/plays (\w+) as one-off/i);
  if (aiOneoffMatch) {
    const card = cardToSymbol(aiOneoffMatch[1]);
    const rank = aiOneoffMatch[1].match(/^(\d+|[AJQK])/)?.[1];
    const effects = {
      'A': { hero: `⚡ Hero plays ${card}! ALL point cards are OBLITERATED!`, foe: `⚡ ${actor} plays ${card}! Points crumble to dust!` },
      '2': { hero: `🔥 Hero unleashes ${card}!`, foe: `🔥 ${actor} attacks with ${card}!` },
      '3': { hero: `🌟 Hero invokes ${card}! A card rises from the scrap!`, foe: `🌟 ${actor} channels ${card}! Something stirs in the scrap pile...` },
      '4': { hero: `💨 Hero casts ${card}! ${target} must discard 2 cards!`, foe: `💨 ${actor} plays ${card}! Hero must surrender 2 cards!` },
      '5': { hero: `🔮 Hero channels ${card}! Sacrifice 1, draw 3!`, foe: `🔮 ${actor} invokes ${card}! Cards shift and flow...` },
      '6': { hero: `💥 Hero summons ${card}! ALL permanents are ANNIHILATED!`, foe: `💥 ${actor} unleashes ${card}! Permanents shatter!` },
      '7': { hero: `✨ Hero reveals ${card}! Fate shows its cards...`, foe: `✨ ${actor} plays ${card}! The deck's secrets are exposed!` },
      '9': { hero: `🌀 Hero casts ${card}! A permanent is BANISHED!`, foe: `🌀 ${actor} invokes ${card}! A permanent returns to hand!` },
    };
    if (rank && effects[rank]) {
      return isHero ? effects[rank].hero : effects[rank].foe;
    }
    return isHero ? `⚡ Hero plays ${card} one-off!` : `⚡ ${actor} plays ${card} one-off!`;
  }

  // AI format: "scuttles with XY"
  const aiScuttleMatch = action.match(/scuttles with (\w+)/i);
  if (aiScuttleMatch) {
    const card = cardToSymbol(aiScuttleMatch[1]);
    return isHero
      ? `⚔️ Hero's ${card} SCUTTLES an enemy point card!`
      : `⚔️ ${actorPossessive} ${card} SCUTTLES your point card!`;
  }

  // AI format: "counters with XY"
  const aiCounterMatch = action.match(/counters with (\w+)/i);
  if (aiCounterMatch) {
    const card = cardToSymbol(aiCounterMatch[1]);
    return isHero
      ? `🛡️ Hero counters with ${card}! The spell is BLOCKED!`
      : `🛡️ ${actor} counters with ${card}! The magic is disrupted!`;
  }

  // AI format: "discards XY"
  const aiDiscardMatch = action.match(/discards (\w+)/i);
  if (aiDiscardMatch) {
    const card = cardToSymbol(aiDiscardMatch[1]);
    return isHero
      ? `📤 Hero reluctantly discards ${card}...`
      : `📤 ${actor} discards ${card}...`;
  }

  // AI format: "passes"
  if (action === 'passes') {
    return isHero
      ? '⏳ Hero watches and waits...'
      : `⏳ ${actor} hesitates...`;
  }

  // AI format: "must discard a card, then draws 3" (5 one-off resolution)
  if (action.includes('must discard a card, then draws')) {
    return isHero
      ? '🔮 Hero channels the Five! Sacrifice 1, draw 3!'
      : `🔮 ${actor} invokes the Five! Cards shift and flow...`;
  }

  // AI format: "discards XY, draws N cards" (5 one-off completed)
  const discardDrawMatch = action.match(/discards (\w+), draws (\d+)/i);
  if (discardDrawMatch) {
    const card = cardToSymbol(discardDrawMatch[1]);
    const drawCount = discardDrawMatch[2];
    return isHero
      ? `🔮 Hero sacrifices ${card} and draws ${drawCount} cards!`
      : `🔮 ${actor} sacrifices ${card} and draws ${drawCount} cards!`;
  }

  // AI format: "must discard N cards" (4 one-off target)
  if (action.includes('must discard') && action.includes('cards')) {
    const countMatch = action.match(/must discard (\d+)/);
    const count = countMatch ? countMatch[1] : '2';
    return isHero
      ? `💨 Hero must surrender ${count} cards!`
      : `💨 ${actor} must surrender ${count} cards!`;
  }

  // AI format: "draws N cards"
  const drawsMatch = action.match(/draws (\d+) cards/i);
  if (drawsMatch) {
    const count = drawsMatch[1];
    return isHero
      ? `🎴 Hero draws ${count} cards from the deck!`
      : `🎴 ${actor} draws ${count} cards...`;
  }

  // Pass actions
  if (action === 'Pass' || action.includes('Auto-pass')) {
    return isHero
      ? '⏳ Hero watches and waits...'
      : `⏳ ${actor} hesitates...`;
  }

  // Counter actions
  if (action.includes('Counter with')) {
    const cardMatch = action.match(/Counter with (.+)/);
    const card = cardMatch ? cardMatch[1] : '2';
    return isHero
      ? `🛡️ Hero counters with ${card}! The spell is BLOCKED!`
      : `🛡️ ${actor} counters with ${card}! The magic is disrupted!`;
  }

  // Point plays
  if (action.includes('as point') || action.includes('for') && action.includes('point')) {
    const cardMatch = action.match(/^(\S+)/);
    const card = cardMatch ? cardMatch[1] : '?';
    const pointMatch = action.match(/(\d+)\s*point/);
    const points = pointMatch ? pointMatch[1] : '';
    return isHero
      ? `💎 Hero claims ${card}${points ? ` for ${points} points` : ''}!`
      : `💎 ${actor} hoards ${card}${points ? ` worth ${points} points` : ''}!`;
  }

  // Scuttle actions
  if (action.includes('scuttles')) {
    const match = action.match(/^(\S+) scuttles (\S+)/);
    if (match) {
      return isHero
        ? `⚔️ ${actorPossessive} ${match[1]} SCUTTLES ${targetPossessive} ${match[2]}!`
        : `⚔️ ${actorPossessive} ${match[1]} SCUTTLES ${targetPossessive} ${match[2]}!`;
    }
  }

  // Jack steal actions
  if (action.includes('→ steal') || action.includes('→ Steal')) {
    const match = action.match(/^(\S+) → [sS]teal (\S+)/);
    if (match) {
      return isHero
        ? `🎭 Hero plays ${match[1]}! The ${match[2]} is STOLEN!`
        : `🎭 ${actor} plays ${match[1]}! The ${match[2]} is snatched away!`;
    }
  }

  // Joker steal
  if (action.includes('🃏 Steal')) {
    const match = action.match(/🃏 Steal (.+)/);
    const tgt = match ? match[1] : 'royal';
    return isHero
      ? `🃏 Hero unleashes the JOKER! The ${tgt} is stolen!`
      : `🃏 ${actor} plays the dreaded JOKER! The ${tgt} is taken!`;
  }

  // 9 one-off (return to hand)
  if (action.includes('→ Return')) {
    const match = action.match(/^(\S+) → Return (\S+) (\S+) to hand/);
    if (match) {
      const playedCard = match[1];
      const owner = match[2]; // YOUR or P0's
      const targetCard = match[3];
      const isTargetHero = owner === 'YOUR';
      return isHero
        ? `🌀 Hero casts ${playedCard}! ${isTargetHero ? 'Your' : `${actor}'s`} ${targetCard} is BANISHED to hand!`
        : `🌀 ${actor} invokes ${playedCard}! ${isTargetHero ? 'Your' : `${actor}'s`} ${targetCard} returns to hand!`;
    }
  }

  // 2 one-off (destroy)
  if (action.includes('→ Destroy')) {
    const match = action.match(/^(\S+) → Destroy (\S+) (\S+)/);
    if (match) {
      const playedCard = match[1];
      const owner = match[2];
      const targetCard = match[3];
      const isTargetHero = owner === 'YOUR';
      return isHero
        ? `🔥 Hero unleashes ${playedCard}! ${isTargetHero ? 'Your' : `${actor}'s`} ${targetCard} is DESTROYED!`
        : `🔥 ${actor} attacks with ${playedCard}! ${isTargetHero ? 'Your' : `${actor}'s`} ${targetCard} is obliterated!`;
    }
  }

  // Generic one-off effects
  if (action.includes('one-off')) {
    const cardMatch = action.match(/^(\S+)/);
    const card = cardMatch ? cardMatch[1] : '?';
    const rank = card.match(/^(\d+|[AJQK])/)?.[1];

    const effects = {
      'A': { hero: `⚡ Hero plays ${card}! ALL point cards are OBLITERATED!`, foe: `⚡ ${actor} plays ${card}! Points crumble to dust!` },
      '3': { hero: `🌟 Hero invokes ${card}! A card rises from the scrap!`, foe: `🌟 ${actor} channels ${card}! Something stirs in the scrap pile...` },
      '4': { hero: `💨 Hero casts ${card}! ${target} must discard 2 cards!`, foe: `💨 ${actor} plays ${card}! Hero must surrender 2 cards!` },
      '5': { hero: `🔮 Hero channels ${card}! Sacrifice 1, draw 3!`, foe: `🔮 ${actor} invokes ${card}! Cards shift and flow...` },
      '6': { hero: `💥 Hero summons ${card}! ALL permanents are ANNIHILATED!`, foe: `💥 ${actor} unleashes ${card}! Permanents shatter!` },
      '7': { hero: `✨ Hero reveals ${card}! Fate shows its cards...`, foe: `✨ ${actor} plays ${card}! The deck's secrets are exposed!` },
    };

    if (rank && effects[rank]) {
      return isHero ? effects[rank].hero : effects[rank].foe;
    }
    return isHero ? `⚡ Hero plays ${card} one-off!` : `⚡ ${actor} plays ${card} one-off!`;
  }

  // Permanent plays (8, Q, K)
  if (action.includes('permanent')) {
    const cardMatch = action.match(/^(\S+)/);
    const card = cardMatch ? cardMatch[1] : '?';
    const rank = card.match(/^(\d+|[AJQK])/)?.[1];

    if (rank === '8') {
      return isHero
        ? `👓 Hero equips ${card}! The Spectacles of Truth reveal all!`
        : `👓 ${actor} dons ${card}! Your hand is exposed!`;
    } else if (rank === 'Q') {
      return isHero
        ? `👑 Hero summons ${card}! Royal protection surrounds the realm!`
        : `👑 ${actor} deploys ${card}! A protective aura forms...`;
    } else if (rank === 'K') {
      return isHero
        ? `🏰 Hero crowns ${card}! Victory draws 5 points closer!`
        : `🏰 ${actor} plays ${card}! The goal shifts in their favor...`;
    }
    return isHero ? `🎪 Hero plays ${card} as permanent!` : `🎪 ${actor} establishes ${card}!`;
  }

  // Retrieve from scrap
  if (action.includes('Retrieve')) {
    const cardMatch = action.match(/Retrieve (.+)/);
    const card = cardMatch ? cardMatch[1] : 'a card';
    return isHero
      ? `🌟 Hero retrieves ${card} from the fallen!`
      : `🌟 ${actor} reclaims ${card} from the scrap!`;
  }

  // Discard
  if (action.includes('Discard')) {
    const cardMatch = action.match(/Discard (.+)/);
    const card = cardMatch ? cardMatch[1] : 'a card';
    return isHero
      ? `📤 Hero reluctantly discards ${card}...`
      : `📤 ${actor} discards ${card}...`;
  }

  // Seven sub-actions
  if (action.startsWith('(7)')) {
    const subAction = action.replace('(7) ', '');
    return `✨ [From the Seven] ${formatChronicleEntry(subAction, pIndex).replace(/^[^\s]+ /, '')}`;
  }

  // All permanents destroyed (resolution message)
  if (action.includes('All permanents')) {
    return '💥 The battlefield trembles! ALL PERMANENTS are swept away!';
  }

  // Resolution messages (from one-off effects resolving)
  if (action === 'Permanent destroyed') {
    return '💥 A permanent is DESTROYED!';
  }
  if (action === 'One-off was countered') {
    return '🛡️ The one-off was COUNTERED!';
  }
  if (action === 'All point cards moved to scrap') {
    return '💀 ALL point cards crumble to dust!';
  }

  // Fallback - just make it slightly more dramatic
  return isHero ? `⚔️ Hero: ${action}` : `⚔️ ${actor}: ${action}`;
}

function formatTime(startTime) {
  if (!startTime) return '0:00';
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function addToHistory(action, pIndex) {
  state.addMoveToHistory(action, pIndex);
  processChronicleQueue();
}

// ============================================================================
// Action Handling
// ============================================================================

// Check if it's the human player's turn to act (any phase)
function isHumanTurn() {
  if (!state.game) return false;
  // Ignore out-of-turn utility actions (peek) when determining turn ownership.
  const actions = state.game.getValidActions(state.playerIndex);
  return actions.some((a) => !a.startsWith('peek:'));
}

function handleCardClick(card) {
  if (state.isMultiplayer) {
    handleCardClickMultiplayer(card);
    return;
  }

  const gameState = state.game.getState();

  // Check if it's human's turn to act
  if (!isHumanTurn()) {
    showMessage("It's not your turn yet.");
    return;
  }

  if (state.selectedCard && state.selectedCard.id === card.id) {
    // Deselect
    state.selectedCard = null;
    hideActionPanel();
    clearTargetHighlights();
  } else {
    // Select and show actions
    state.selectedCard = card;
    showActionsForCard(card);
  }
  render();
}

function handleCardClickMultiplayer(card) {
  const gameData = state.serverState?._gameState?.game;
  if (!gameData) return;

  // Check if it's our turn
  const myActions = state.serverValidActions[state.playerIndex] || [];
  if (myActions.length === 0) {
    showMessage("It's not your turn yet.");
    return;
  }

  if (state.selectedCard && state.selectedCard.id === card.id) {
    // Deselect
    state.selectedCard = null;
    hideActionPanel();
    clearTargetHighlights();
  } else {
    // Select and show actions
    state.selectedCard = card;
    showActionsForCardMultiplayer(card);
  }
  renderMultiplayer();
}

// Extract target card IDs from valid actions for a selected card
function getTargetCardIds(cardId) {
  if (!state.game) return new Set();

  const actions = state.game.getValidActions(state.playerIndex);
  const targetIds = new Set();

  for (const action of actions) {
    const parts = action.split(':');
    if (parts.length < 2) continue;

    const actionCardId = parseInt(parts[1]);
    if (actionCardId !== cardId) continue;

    // Parse different action formats to find targets
    // scuttle:cardId:targetId
    // permanent:cardId:targetId (Jack)
    // oneoff:cardId:permanent:targetId
    // oneoff:cardId:pointCard:targetId
    // joker:cardId:targetId
    // oneoff:cardId:target:playerIndex (4 targeting player - no card target)

    if (parts[0] === 'scuttle' && parts.length > 2) {
      targetIds.add(parseInt(parts[2]));
    } else if (parts[0] === 'permanent' && parts.length > 2) {
      targetIds.add(parseInt(parts[2]));
    } else if (parts[0] === 'joker' && parts.length > 2) {
      targetIds.add(parseInt(parts[2]));
    } else if (parts[0] === 'oneoff' && parts.length > 3) {
      if (parts[2] === 'permanent' || parts[2] === 'pointCard') {
        targetIds.add(parseInt(parts[3]));
      }
    }
  }

  return targetIds;
}

// Highlight valid targets for the selected card
function highlightTargets(cardId) {
  const targetIds = getTargetCardIds(cardId);

  if (targetIds.size === 0) {
    clearTargetHighlights();
    return;
  }

  // Add targeting mode to game area
  document.getElementById('game-area').classList.add('targeting-mode');

  // Mark targetable cards
  document.querySelectorAll('.card[data-card-id]').forEach(cardEl => {
    const id = parseInt(cardEl.dataset.cardId);
    if (targetIds.has(id)) {
      cardEl.classList.add('targetable');
    }
  });
}

// Clear all target highlights
function clearTargetHighlights() {
  document.getElementById('game-area').classList.remove('targeting-mode');
  document.querySelectorAll('.card.targetable').forEach(el => {
    el.classList.remove('targetable');
  });
}

function showActionsForCard(card) {
  const actions = state.game.getValidActions(state.playerIndex);
  const cardActions = actions.filter((a) => {
    const parts = a.split(':');
    if (parts.length > 1 && parseInt(parts[1]) === card.id) return true;
    return false;
  });

  if (cardActions.length === 0) {
    showMessage('No valid actions for this card.');
    hideActionPanel();
    return;
  }

  // Highlight valid targets for this card
  highlightTargets(card.id);

  elements.actionButtons.innerHTML = '';
  for (const action of cardActions) {
    const btn = document.createElement('button');
    btn.textContent = formatAction(action);
    btn.addEventListener('click', () => executeAction(action));
    elements.actionButtons.appendChild(btn);
  }

  elements.actionPanel.classList.remove('hidden');
}

function showActionsForCardMultiplayer(card) {
  const myActions = state.serverValidActions[state.playerIndex] || [];
  const cardActions = myActions.filter((a) => {
    const parts = a.split(':');
    if (parts.length > 1 && parseInt(parts[1]) === card.id) return true;
    return false;
  });

  if (cardActions.length === 0) {
    showMessage('No valid actions for this card.');
    hideActionPanel();
    return;
  }

  // Highlight valid targets for this card
  highlightTargetsMultiplayer(card.id);

  elements.actionButtons.innerHTML = '';
  for (const action of cardActions) {
    const btn = document.createElement('button');
    btn.textContent = formatAction(action);
    btn.addEventListener('click', () => executeMultiplayerAction(action));
    elements.actionButtons.appendChild(btn);
  }

  elements.actionPanel.classList.remove('hidden');
}

function highlightTargetsMultiplayer(cardId) {
  const myActions = state.serverValidActions[state.playerIndex] || [];
  const targetIds = new Set();

  for (const action of myActions) {
    const parts = action.split(':');
    if (parts.length < 2) continue;

    const actionCardId = parseInt(parts[1]);
    if (actionCardId !== cardId) continue;

    if (parts[0] === 'scuttle' && parts.length > 2) {
      targetIds.add(parseInt(parts[2]));
    } else if (parts[0] === 'permanent' && parts.length > 2) {
      targetIds.add(parseInt(parts[2]));
    } else if (parts[0] === 'joker' && parts.length > 2) {
      targetIds.add(parseInt(parts[2]));
    } else if (parts[0] === 'oneoff' && parts.length > 3) {
      if (parts[2] === 'permanent' || parts[2] === 'pointCard') {
        targetIds.add(parseInt(parts[3]));
      }
    }
  }

  if (targetIds.size === 0) {
    clearTargetHighlights();
    return;
  }

  document.getElementById('game-area').classList.add('targeting-mode');
  document.querySelectorAll('.card[data-card-id]').forEach(cardEl => {
    const id = parseInt(cardEl.dataset.cardId);
    if (targetIds.has(id)) {
      cardEl.classList.add('targetable');
    }
  });
}

function hideActionPanel() {
  elements.actionPanel.classList.add('hidden');
  state.selectedCard = null;
  clearTargetHighlights();
}

// Find a card by ID and return it with owner info
function findCardById(cardId) {
  // Get observation from local game or create from server state
  let obs;
  if (state.game) {
    obs = state.game.getObservation(state.playerIndex);
  } else if (state.isMultiplayer && state.serverState?._gameState?.game) {
    obs = createObservationFromServerState(state.serverState._gameState.game, state.playerIndex);
  } else {
    return null;
  }

  // Check my hand
  let card = obs.myHand.find(c => c.id === cardId);
  if (card) return { ...card, owner: state.playerIndex };

  // Check my point cards
  for (const pc of obs.myPointCards || []) {
    if (pc.card.id === cardId) return { ...pc.card, owner: state.playerIndex };
    for (const jack of pc.attachedJacks || []) {
      if (jack.id === cardId) return { ...jack, owner: pc.controller };
    }
  }

  // Check my permanents
  for (const perm of obs.myPermanents || []) {
    if (perm.card.id === cardId) return { ...perm.card, owner: state.playerIndex };
  }

  // Check opponents
  const opponents = obs.opponents || [];
  for (const opp of opponents) {
    // Opponent hand (if visible)
    if (opp.hand) {
      card = opp.hand.find(c => c.id === cardId);
      if (card) return { ...card, owner: opp.playerIndex };
    }
    // Opponent point cards
    for (const pc of opp.pointCards || []) {
      if (pc.card.id === cardId) return { ...pc.card, owner: opp.playerIndex };
      for (const jack of pc.attachedJacks || []) {
        if (jack.id === cardId) return { ...jack, owner: pc.controller };
      }
    }
    // Opponent permanents
    for (const perm of opp.permanents || []) {
      if (perm.card.id === cardId) return { ...perm.card, owner: opp.playerIndex };
    }
  }

  // Check legacy 2-player fields
  if (obs.opponentPointCards) {
    for (const pc of obs.opponentPointCards) {
      if (pc.card.id === cardId) return { ...pc.card, owner: 1 - state.playerIndex };
      for (const jack of pc.attachedJacks || []) {
        if (jack.id === cardId) return { ...jack, owner: pc.controller };
      }
    }
  }
  if (obs.opponentPermanents) {
    for (const perm of obs.opponentPermanents) {
      if (perm.card.id === cardId) return { ...perm.card, owner: 1 - state.playerIndex };
    }
  }

  // Check scrap
  for (const c of obs.scrap || []) {
    if (c.id === cardId) return { ...c, owner: undefined };
  }

  return null;
}

function formatAction(action) {
  const parts = action.split(':');
  const actionType = parts[0];

  // Try to find the card for more descriptive output
  let cardStr = '';
  if (parts.length > 1) {
    const cardId = parseInt(parts[1]);
    // Use findCardById which works with both local and server state
    const card = findCardById(cardId);
    if (card) {
      cardStr = card.isJoker ? '🃏' : `${card.rank}${suitSymbols[card.suit]}`;
    }
  }

  switch (actionType) {
    case 'draw': return 'Draw';
    case 'point': return cardStr ? `${cardStr} as point` : 'Play as point';
    case 'oneoff': {
      // Check for targeted one-offs
      if (parts.length > 2) {
        const targetType = parts[2];
        if (targetType === 'target') {
          // 4 one-off targeting a player: oneoff:cardId:target:playerIndex
          const targetPlayer = parseInt(parts[3]);
          const playerName = targetPlayer === state.playerIndex ? 'yourself' : `P${targetPlayer}`;
          return cardStr ? `${cardStr} one-off → ${playerName}` : `One-off → ${playerName}`;
        } else if (targetType === 'permanent' || targetType === 'pointCard' || targetType === 'card') {
          // 2 or 9 one-off targeting a card: oneoff:cardId:permanent:targetCardId or oneoff:cardId:card:targetCardId
          const targetCardId = parseInt(parts[3]);
          const targetCard = findCardById(targetCardId);
          if (targetCard) {
            const targetStr = targetCard.isJoker ? '🃏' : `${targetCard.rank}${suitSymbols[targetCard.suit]}`;
            const isYours = targetCard.owner === state.playerIndex;
            const ownerLabel = isYours ? 'YOUR' : `P${targetCard.owner}'s`;

            // Get the card rank to determine what effect this is
            const playedCard = findCardById(parseInt(parts[1]));
            const playedRank = playedCard?.rank;

            if (playedRank === '2') {
              // 2 destroys a permanent
              return cardStr ? `${cardStr} → Destroy ${ownerLabel} ${targetStr}` : `Destroy ${ownerLabel} ${targetStr}`;
            } else if (playedRank === '9') {
              // 9 returns to hand + skips turn
              return cardStr ? `${cardStr} → Return ${ownerLabel} ${targetStr} to hand` : `Return ${ownerLabel} ${targetStr} to hand`;
            } else {
              // Generic fallback
              return cardStr ? `${cardStr} → target ${ownerLabel} ${targetStr}` : `Target ${ownerLabel} ${targetStr}`;
            }
          }
        }
      }
      return cardStr ? `${cardStr} one-off` : 'Play as one-off';
    }
    case 'permanent': {
      // Check for Jack targeting a point card: permanent:cardId:targetCardId[:destPlayerId]
      if (parts.length > 2) {
        const targetCardId = parseInt(parts[2]);
        const targetCard = findCardById(targetCardId);
        if (targetCard) {
          const targetStr = targetCard.isJoker ? '🃏' : `${targetCard.rank}${suitSymbols[targetCard.suit]}`;
          const ownerStr = targetCard.owner !== undefined ?
            (targetCard.owner === state.playerIndex ? '(yours)' : `(P${targetCard.owner})`) : '';

          // Team variant: check for destination player (parts[3])
          if (parts.length > 3 && state.variant === 'team') {
            const destPlayer = parseInt(parts[3]);
            const destLabel = destPlayer === state.playerIndex ? 'yourself' :
              (destPlayer === state.game?.getObservation(state.playerIndex)?.teammateIndex ? 'Partner' : `Foe ${destPlayer}`);
            return cardStr ? `${cardStr} → give ${targetStr} to ${destLabel}` : `Give ${targetStr} to ${destLabel}`;
          }
          return cardStr ? `${cardStr} → steal ${targetStr} ${ownerStr}`.trim() : `Steal ${targetStr}`;
        }
      }
      return cardStr ? `${cardStr} permanent` : 'Play as permanent';
    }
    case 'scuttle': {
      // scuttle:cardId:targetCardId
      if (parts.length > 2) {
        const targetCardId = parseInt(parts[2]);
        const targetCard = findCardById(targetCardId);
        if (targetCard) {
          const targetStr = targetCard.isJoker ? '🃏' : `${targetCard.rank}${suitSymbols[targetCard.suit]}`;
          const ownerStr = targetCard.owner !== undefined ? `(P${targetCard.owner})` : '';
          return cardStr ? `${cardStr} scuttles ${targetStr} ${ownerStr}`.trim() : `Scuttle ${targetStr}`;
        }
      }
      return cardStr ? `Scuttle with ${cardStr}` : 'Scuttle';
    }
    case 'counter': return cardStr ? `Counter with ${cardStr}` : 'Counter';
    case 'pass': return 'Pass';
    case 'discard': return cardStr ? `Discard ${cardStr}` : 'Discard';
    case 'five_discard': return cardStr ? `Discard ${cardStr} (for 5)` : 'Discard (for 5)';
    case 'three_retrieve': return cardStr ? `Retrieve ${cardStr}` : 'Retrieve from scrap';
    case 'nine_target': return 'Target permanent';
    case 'joker': {
      // joker:jokerId:targetId[:destPlayerId] - find the target card
      const targetId = parseInt(parts[2]);
      let targetStr = 'royal';
      if (state.game) {
        const obs = state.game.getObservation(state.playerIndex);
        // Search opponent permanents and point cards for the target
        const allPlayers = obs.opponents ? [...obs.opponents] : [];
        for (const opp of allPlayers) {
          for (const perm of (opp.permanents || [])) {
            if (perm.card.id === targetId) {
              targetStr = `${perm.card.rank}${suitSymbols[perm.card.suit]}`;
            }
          }
          for (const pc of (opp.pointCards || [])) {
            for (const jack of (pc.attachedJacks || [])) {
              if (jack.id === targetId) {
                targetStr = `J${suitSymbols[jack.suit]}`;
              }
            }
          }
        }
        // Also check own point cards for attached jacks
        for (const pc of obs.myPointCards || []) {
          for (const jack of (pc.attachedJacks || [])) {
            if (jack.id === targetId) {
              targetStr = `J${suitSymbols[jack.suit]}`;
            }
          }
        }
      }

      // Team variant: check for destination player (parts[3])
      if (parts.length > 3 && state.variant === 'team') {
        const destPlayer = parseInt(parts[3]);
        const obs = state.game?.getObservation(state.playerIndex);
        const destLabel = destPlayer === state.playerIndex ? 'yourself' :
          (destPlayer === obs?.teammateIndex ? 'Partner' : `Foe ${destPlayer}`);
        return `🃏 Give ${targetStr} to ${destLabel}`;
      }
      return `🃏 Steal ${targetStr}`;
    }
    case 'nine_response': {
      // Nine response to Royal: nine_response:cardId
      return cardStr ? `${cardStr} → Block Royal!` : '9 → Block Royal!';
    }
    default:
      if (actionType.startsWith('seven_')) {
        return `(7) ${formatAction(actionType.replace('seven_', '') + ':' + parts.slice(1).join(':'))}`;
      }
      return action;
  }
}

// Describe what a pending one-off does
function describePendingOneOff(pending, obs) {
  if (!pending || !pending.card) return 'Unknown one-off pending.';

  const card = pending.card;
  const rank = card.rank;
  const playerLabel = pending.player === state.playerIndex ? 'You' : `P${pending.player}`;
  const cardStr = card.isJoker ? '🃏 Joker' : `${rank}${suitSymbols[card.suit]}`;

  let effectDescription = '';
  const counters = pending.counterChain?.length || 0;
  const counterInfo = counters > 0 ? ` (${counters} counter${counters > 1 ? 's' : ''} played)` : '';

  // Build specific descriptions based on rank and target
  if (rank === '2' && pending.target?.cardId !== undefined) {
    // 2 targets a specific permanent
    const targetCard = findCardById(pending.target.cardId);
    if (targetCard) {
      const targetStr = targetCard.isJoker ? '🃏' : `${targetCard.rank}${suitSymbols[targetCard.suit]}`;
      const isYours = targetCard.owner === state.playerIndex;
      const ownerLabel = isYours ? 'YOUR' : `P${targetCard.owner}'s`;
      effectDescription = `Destroy ${ownerLabel} ${targetStr}`;
    } else {
      effectDescription = 'Destroy a permanent';
    }
  } else if (rank === '9' && pending.target?.cardId !== undefined) {
    // 9 targets a specific permanent
    const targetCard = findCardById(pending.target.cardId);
    if (targetCard) {
      const targetStr = targetCard.isJoker ? '🃏' : `${targetCard.rank}${suitSymbols[targetCard.suit]}`;
      const isYours = targetCard.owner === state.playerIndex;
      const ownerLabel = isYours ? 'YOUR' : `P${targetCard.owner}'s`;
      effectDescription = `Return ${ownerLabel} ${targetStr} to hand`;
    } else {
      effectDescription = 'Return a permanent to hand';
    }
  } else if (rank === '4' && pending.target !== undefined) {
    // 4 targets a player
    const targetPlayer = typeof pending.target === 'object' ? pending.target.player : pending.target;
    const targetLabel = targetPlayer === state.playerIndex ? 'YOU' : `P${targetPlayer}`;
    effectDescription = `Force ${targetLabel} to discard 2 cards`;
  } else {
    // Default effects for non-targeted one-offs
    const effects = {
      'A': 'Destroy ALL point cards',
      '2': 'Destroy a permanent',
      '3': 'Retrieve a card from scrap',
      '4': 'Force opponent to discard 2 cards',
      '5': 'Discard 1, draw 3',
      '6': 'Destroy ALL permanents',
      '7': 'Play from top 2 deck cards',
      '9': 'Return a permanent to hand',
    };
    effectDescription = effects[rank] || 'Unknown effect';
  }

  return `⚡ ${playerLabel} played ${cardStr}: ${effectDescription}${counterInfo}. Counter with a 2 or Pass.`;
}

async function executeAction(action) {
  const actionStr = formatAction(action);
  const result = state.game.action(state.playerIndex, action);

  if (!result.success) {
    showMessage(`Error: ${result.message}`);
    return;
  }

  addToHistory(actionStr, state.playerIndex);
  hideActionPanel();
  state.selectedCard = null;
  render();

  // Check for game end
  if (checkGameEnd()) return;

  // AI turn
  await runAITurn();
}

// ============================================================================
// AI Heuristics - Strategic Action Selection
// ============================================================================

/**
 * Get the point value of a card rank
 */
function getCardPointValue(rank) {
  if (rank === 'A') return 1;
  if (['J', 'Q', 'K'].includes(rank)) return 0;
  return parseInt(rank) || 0;
}

/**
 * Find a card by ID in the observation data (for AI scoring)
 */
function findCardInObservation(cardId, obs) {
  // Check hand
  let card = obs.myHand.find(c => c.id === cardId);
  if (card) return card;

  // Check seven revealed/drawn cards
  if (obs.sevenDrawnCard && obs.sevenDrawnCard.id === cardId) return obs.sevenDrawnCard;
  if (obs.sevenRevealedCards) {
    card = obs.sevenRevealedCards.find(c => c.id === cardId);
    if (card) return card;
  }

  // Check scrap
  card = obs.scrap.find(c => c.id === cardId);
  if (card) return card;

  return null;
}

/**
 * Calculate threat level from opponents (0-1 scale)
 * Higher = more urgent to act defensively
 */
function calculateThreatLevel(obs) {
  let maxThreat = 0;

  // Check all opponents
  for (const opp of obs.opponents) {
    const progress = opp.points / opp.goal;
    maxThreat = Math.max(maxThreat, progress);
  }

  return maxThreat;
}

/**
 * Check if an opponent has a Queen (protects from one-offs targeting their stuff)
 */
function opponentHasQueen(obs, opponentIndex) {
  const opp = obs.opponents.find(o => o.playerIndex === opponentIndex);
  if (!opp) return false;
  return opp.permanents.some(p => p.type === 'queen');
}

/**
 * Get the total point value an opponent has on the board
 */
function getOpponentBoardValue(obs, opponentIndex) {
  const opp = obs.opponents.find(o => o.playerIndex === opponentIndex);
  if (!opp) return 0;

  let value = 0;
  for (const pc of opp.pointCards) {
    // Only count cards they control
    if (pc.controller === opponentIndex) {
      value += getCardPointValue(pc.card.rank);
    }
  }
  return value;
}

/**
 * Score an action for the AI
 * Higher score = better action
 */
function scoreAction(action, obs, gameState) {
  const parts = action.split(':');
  const actionType = parts[0];
  const cardId = parts[1] ? parseInt(parts[1]) : null;
  const targetId = parts[2] ? parseInt(parts[2]) : null;

  const card = cardId ? findCardInObservation(cardId, obs) : null;
  const threatLevel = calculateThreatLevel(obs);
  const pointsToWin = obs.myGoal - obs.myPoints;

  // Base scores by action type
  let score = 0;

  // =========================================================================
  // WINNING MOVES - Highest priority
  // =========================================================================

  if (actionType === 'point' && card) {
    const pointValue = getCardPointValue(card.rank);
    if (pointValue >= pointsToWin) {
      return 10000; // Instant win!
    }
    // Score based on how close this gets us to winning
    score = 100 + pointValue * 10;
    // Bonus if we're close to winning
    if (obs.myPoints + pointValue >= obs.myGoal * 0.7) {
      score += 50;
    }
  }

  // =========================================================================
  // SCUTTLING - Deny opponent points
  // =========================================================================

  if (actionType === 'scuttle' && card) {
    // Find target card value
    let targetValue = 0;
    for (const opp of obs.opponents) {
      for (const pc of opp.pointCards) {
        if (pc.card.id === targetId) {
          targetValue = getCardPointValue(pc.card.rank);
          break;
        }
      }
    }

    // Base score for scuttling
    score = 80 + targetValue * 8;

    // Higher priority if opponent is close to winning
    if (threatLevel > 0.6) {
      score += 100 * threatLevel;
    }

    // Prefer scuttling high-value targets
    if (targetValue >= 8) score += 30;
  }

  // =========================================================================
  // ONE-OFFS - Tactical plays
  // =========================================================================

  if (actionType === 'oneoff' && card) {
    const rank = card.rank;

    switch (rank) {
      case 'A': // Destroy all point cards
        // Great if opponent has many points
        let totalOppPoints = 0;
        for (const opp of obs.opponents) {
          totalOppPoints += opp.points;
        }
        if (totalOppPoints > obs.myPoints + 5) {
          score = 200 + totalOppPoints * 5;
        } else if (totalOppPoints > 10) {
          score = 100 + totalOppPoints * 3;
        } else {
          score = 20; // Not worth it if opponent has few points
        }
        break;

      case '2': // Destroy target permanent (when used as one-off)
        score = 60;
        // Prioritize destroying Kings (reduces their goal) and Queens (protection)
        // Target info would be in parts[2] if specified
        break;

      case '3': // Retrieve from scrap
        score = 40;
        // Better if there are good cards in scrap
        if (obs.scrap.some(c => ['K', 'Q', 'A'].includes(c.rank))) {
          score = 70;
        }
        break;

      case '4': // Force opponent to discard 2
        score = 55;
        // Better against opponent with many cards
        const targetOpp = obs.opponents[0]; // Primary opponent
        if (targetOpp && targetOpp.handSize >= 5) {
          score = 85;
        }
        break;

      case '5': // Discard 1, draw 3
        score = 50;
        // Better if we have low hand size
        if (obs.myHand.length <= 3) {
          score = 75;
        }
        break;

      case '6': // Destroy all permanents
        let totalPermValue = 0;
        for (const opp of obs.opponents) {
          totalPermValue += opp.permanents.length * 15;
          // Extra value for destroying Kings
          totalPermValue += opp.permanents.filter(p => p.type === 'king').length * 20;
        }
        // Subtract value of our own permanents
        totalPermValue -= obs.myPermanents.length * 10;
        score = Math.max(10, 50 + totalPermValue);
        break;

      case '7': // Draw and play from deck
        score = 65;
        break;

      case '9': // Return permanent to hand
        score = 70;
        // Prioritize bouncing Kings
        break;
    }

    // Boost one-offs when opponent is threatening
    if (threatLevel > 0.7 && ['A', '6', '9'].includes(rank)) {
      score += 80;
    }
  }

  // =========================================================================
  // PERMANENTS - Long-term advantage
  // =========================================================================

  if (actionType === 'permanent' && card) {
    const rank = card.rank;

    switch (rank) {
      case 'K': // King reduces goal
        // Very valuable! Each King makes winning easier
        const currentKings = obs.myPermanents.filter(p => p.type === 'king').length;
        score = 180 - currentKings * 30; // Less valuable if we already have Kings
        // Even more valuable if we're behind
        if (obs.myPoints < obs.opponents[0]?.points) {
          score += 40;
        }
        break;

      case 'Q': // Queen protects from targeting
        score = 90;
        // More valuable if opponent has targeting cards (we can't always know)
        if (!obs.myPermanents.some(p => p.type === 'queen')) {
          score += 20; // First Queen is most valuable
        }
        break;

      case '8': // Glasses - see opponent's hand
        score = 45;
        break;
    }
  }

  // =========================================================================
  // JACK - Steal point cards
  // =========================================================================

  if (actionType === 'permanent' && card && card.rank === 'J') {
    // Jack targets a point card to steal
    let targetValue = 0;
    for (const opp of obs.opponents) {
      for (const pc of opp.pointCards) {
        if (pc.card.id === targetId) {
          targetValue = getCardPointValue(pc.card.rank);
          break;
        }
      }
    }
    score = 120 + targetValue * 10;

    // Check if this would win the game
    if (obs.myPoints + targetValue >= obs.myGoal) {
      return 9500; // Almost as good as direct win
    }
  }

  // =========================================================================
  // COUNTER DECISIONS
  // =========================================================================

  if (actionType === 'counter') {
    const pending = gameState.pendingOneOff;
    if (pending) {
      const oneOffRank = pending.card.rank;

      // Always counter Aces and 6s if they hurt us significantly
      if (oneOffRank === 'A' && obs.myPoints > 10) {
        score = 300; // Counter the Ace!
      } else if (oneOffRank === '6' && obs.myPermanents.length >= 2) {
        score = 250; // Protect our permanents
      } else if (oneOffRank === '4') {
        score = 150; // Counter discard
      } else if (oneOffRank === '9' && obs.myPermanents.some(p => p.type === 'king')) {
        score = 200; // Protect our King
      } else {
        score = 50; // Generic counter value
      }
    }
  }

  if (actionType === 'pass') {
    // Passing is usually low priority, but sometimes correct
    if (gameState.phase === 'counter') {
      // In counter phase, passing is often fine if the one-off isn't too scary
      score = 30;
    } else {
      score = 5;
    }
  }

  // =========================================================================
  // DRAWING - Default action when nothing better
  // =========================================================================

  if (actionType === 'draw') {
    score = 25;
    // Drawing is better with low hand size
    if (obs.myHand.length <= 2) {
      score = 45;
    }
    // Drawing is worse when close to winning (should be playing cards)
    if (pointsToWin <= 5) {
      score = 10;
    }
  }

  // =========================================================================
  // DISCARD DECISIONS (for 4 and 5 effects)
  // =========================================================================

  if (actionType === 'discard' || actionType === 'five_discard') {
    if (card) {
      // Prefer discarding low-value cards
      const pointValue = getCardPointValue(card.rank);
      // Invert: lower point value = higher score for discarding
      score = 100 - pointValue * 8;
      // Never want to discard Kings or Queens
      if (['K', 'Q'].includes(card.rank)) {
        score = 5;
      }
    }
  }

  // =========================================================================
  // CHOOSE FROM SCRAP (for 3 effect)
  // =========================================================================

  if (actionType === 'choose') {
    if (card) {
      // Prefer retrieving high-value cards
      if (card.rank === 'K') score = 150;
      else if (card.rank === 'Q') score = 120;
      else if (card.rank === 'A') score = 100;
      else if (['2', '9'].includes(card.rank)) score = 80;
      else score = 30 + getCardPointValue(card.rank) * 5;
    }
  }

  // =========================================================================
  // SEVEN ACTIONS - Play from revealed cards
  // =========================================================================

  if (actionType.startsWith('seven_')) {
    // Strip 'seven_' prefix and score the underlying action
    const subAction = action.replace('seven_', '');
    score = scoreAction(subAction, obs, gameState);
    // Slight bonus since we're forced to play something
    score += 5;
  }

  if (actionType === 'scrap_seven') {
    // Scrapping is usually bad, only do if card is truly useless
    score = 15;
  }

  // =========================================================================
  // JOKER (Cutthroat/Team variants)
  // =========================================================================

  if (actionType === 'joker') {
    // Stealing a royal is powerful
    score = 200;
  }

  // =========================================================================
  // THREAT-BASED ADJUSTMENTS
  // =========================================================================

  // If opponent is very close to winning, boost aggressive/defensive actions
  if (threatLevel > 0.8) {
    if (['scuttle', 'oneoff', 'counter'].includes(actionType)) {
      score *= 1.5;
    }
  }

  // Add small random factor to break ties (1-5 points)
  score += Math.random() * 5;

  return score;
}

/**
 * Select the best action from a list using heuristic scoring
 */
function selectBestAction(actions, obs, gameState) {
  if (actions.length === 0) return null;
  if (actions.length === 1) return actions[0];

  let bestAction = actions[0];
  let bestScore = -Infinity;

  for (const action of actions) {
    const score = scoreAction(action, obs, gameState);
    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }

  return bestAction;
}

// ============================================================================
// End AI Heuristics
// ============================================================================

async function runAITurn() {
  const aiPlayers = getAIPlayers();
  let iterations = 0;
  const maxIterations = 100; // Prevent infinite loops

  while (iterations < maxIterations) {
    iterations++;
    if (checkGameEnd()) return;

    const gameState = state.game.getState();

    // Determine which AI should act based on phase
    let actingAI = null;

    if (gameState.phase === 'play') {
      // Normal play phase - current player acts
      if (aiPlayers.includes(gameState.currentPlayer)) {
        actingAI = gameState.currentPlayer;
      }
    } else if (gameState.phase === 'counter') {
      // Counter phase - special logic
      actingAI = getCounterPhaseAI(gameState);
    } else if (gameState.phase === 'royal_response') {
      // Royal response phase - find AI responder
      actingAI = getRoyalResponseAI(gameState);
    } else if (gameState.phase === 'resolve_four') {
      // Discard phase - discardingPlayer acts
      const discardingPlayer = gameState.discardingPlayer ?? ((gameState.currentPlayer + 1) % getNumPlayers());
      if (aiPlayers.includes(discardingPlayer)) {
        actingAI = discardingPlayer;
      }
    } else {
      // Other resolve phases - current player acts
      if (aiPlayers.includes(gameState.currentPlayer)) {
        actingAI = gameState.currentPlayer;
      }
    }

    if (actingAI === null || actingAI === undefined) {
      // It's the human player's turn
      hideThinking();
      break;
    }

    // Show AI thinking with dramatic delay
    showThinking(actingAI);
    await delay(getAIThinkTime());
    hideThinking();

    const actions = state.game.getValidActions(actingAI);
    const turnActions = actions.filter((a) => !a.startsWith('peek:'));
    if (turnActions.length === 0) {
      // No valid actions, skip
      break;
    }

    // Use heuristic AI to select best action
    const obs = state.game.getObservation(actingAI);
    const action = selectBestAction(turnActions, obs, gameState);
    const result = state.game.action(actingAI, action);

    if (result.success) {
      // Use the game's result message which includes card details
      // Strip "Player N " prefix since we add our own
      let msg = result.message || formatAction(action);
      msg = msg.replace(/^Player \d+ /, '');
      addToHistory(msg, actingAI);

      // Add resolution pause for impactful actions
      if (action.includes('oneoff') || action.includes('scuttle') || action.includes('counter')) {
        await delay(RESOLUTION_PAUSE);
      }
    } else {
      console.error('AI action failed:', result.message);
      break;
    }

    render();
    await delay(300);

    if (checkGameEnd()) return;

    // Check if it's now human's turn (in any phase)
    if (isHumanTurn()) {
      break;
    }
  }

  if (iterations >= maxIterations) {
    console.error('AI turn exceeded max iterations');
  }

  // Update message based on current phase
  const finalState = state.game.getState();
  if (finalState.phase === 'counter') {
    // Check if human can counter (has a 2)
    const obs = state.game.getObservation(state.playerIndex);
    const hasTwo = obs.myHand.some(c => c.rank === '2');
    if (!hasTwo && isHumanTurn()) {
      // Auto-pass if human has no 2
      showMessage("No 2 to counter - auto-passing...");
      await delay(500);
      const result = state.game.action(state.playerIndex, 'pass');
      if (result.success) {
        addToHistory('Auto-pass (no 2)', state.playerIndex);
        render();
        if (checkGameEnd()) return;
        await runAITurn(); // Continue with AI turns
        return;
      }
    }
    showMessage("Counter phase - play a 2 to counter or Pass.");
  } else if (finalState.phase === 'resolve_four') {
    showMessage("You must discard 2 cards. Click cards to discard.");
  } else if (finalState.phase === 'resolve_five_discard') {
    showMessage("Discard 1 card for the 5 effect.");
  } else if (finalState.phase === 'resolve_three') {
    showMessage("Choose a card from the scrap pile.");
    showScrapBrowser(true);
  } else if (finalState.phase === 'resolve_nine') {
    showMessage("Choose a permanent to return to hand.");
  } else if (finalState.phase === 'resolve_seven' || finalState.phase === 'resolve_seven_choose') {
    showMessage("Choose a card to play from the revealed cards.");
  } else if (finalState.phase === 'royal_response') {
    // Team variant: can respond to opponent's Royal with a 9
    const pending = finalState.pendingRoyal;
    if (pending) {
      const royalCard = pending.card;
      const royalStr = `${royalCard.rank}${suitSymbols[royalCard.suit]}`;
      const obs = state.game.getObservation(state.playerIndex);
      const isPartner = state.variant === 'team' && obs && obs.teammateIndex === pending.player;
      const playerLabel = isPartner ? 'Partner' : `Foe ${pending.player}`;
      showMessage(`${playerLabel} plays ${royalStr}! Play a 9 to block or Pass.`);
    } else {
      showMessage("Royal response phase - play a 9 to block or Pass.");
    }
  } else {
    showMessage("Your turn! Click a card or the deck.");
  }
}

function getCounterPhaseAI(gameState) {
  if (gameState.phase !== 'counter' || !gameState.pendingOneOff) return null;

  // Let the game engine decide - find which AI has valid actions
  const aiPlayers = getAIPlayers();
  for (const ai of aiPlayers) {
    const actions = state.game.getValidActions(ai);
    if (actions.some((a) => !a.startsWith('peek:'))) {
      return ai;
    }
  }
  return null;
}

function getRoyalResponseAI(gameState) {
  if (gameState.phase !== 'royal_response' || !gameState.pendingRoyal) return null;

  // Find which AI is in the responders list
  const aiPlayers = getAIPlayers();
  for (const ai of aiPlayers) {
    if (gameState.pendingRoyal.respondersRemaining.includes(ai)) {
      return ai;
    }
  }
  return null;
}

function populateGameOverChronicle() {
  // Build chronicle from moveHistory array (not DOM) to avoid partial typewriter text
  elements.gameOverHistory.innerHTML = '';
  for (const entry of state.moveHistory) {
    const div = document.createElement('div');
    const isHero = entry.playerIndex === state.playerIndex;
    div.className = 'history-entry ' + (isHero ? 'hero' : 'enemy');
    div.textContent = formatChronicleEntry(entry.action, entry.playerIndex);
    elements.gameOverHistory.appendChild(div);
  }
  // Scroll to the bottom to show the most recent moves
  elements.gameOverHistory.scrollTop = elements.gameOverHistory.scrollHeight;
}

function checkGameEnd() {
  const gameState = state.game.getState();
  const obs = state.game.getObservation(state.playerIndex);

  if (gameState.winner !== null && gameState.winner !== undefined) {
    const elapsed = formatTime(state.gameStartTime);

    // Team variant: check if our team won
    if (state.variant === 'team') {
      const myTeam = obs.myTeam;
      const winningTeam = obs.winningTeam;
      if (winningTeam === myTeam) {
        elements.gameOverTitle.textContent = '🎉 Your Team Wins!';
        const whoScored = gameState.winner === state.playerIndex ? 'You' : 'Your Partner';
        elements.gameOverMessage.textContent = `${whoScored} reached the goal! Time: ${elapsed}`;
      } else {
        elements.gameOverTitle.textContent = '😔 Your Team Lost';
        elements.gameOverMessage.textContent = `The opposing team won. Time: ${elapsed}`;
      }
    } else {
      // Standard win/lose
      if (gameState.winner === state.playerIndex) {
        elements.gameOverTitle.textContent = '🎉 You Win!';
        elements.gameOverMessage.textContent = `Congratulations! Time: ${elapsed}`;
      } else {
        elements.gameOverTitle.textContent = '😔 You Lost';
        elements.gameOverMessage.textContent = `Better luck next time! Time: ${elapsed}`;
      }
    }
    populateGameOverChronicle();
    elements.gameOverModal.classList.remove('hidden');
    trapFocus(elements.gameOverModal);
    return true;
  }

  if (gameState.isDraw) {
    elements.gameOverTitle.textContent = '🤝 Draw!';
    elements.gameOverMessage.textContent = 'The game ended in a draw.';
    populateGameOverChronicle();
    elements.gameOverModal.classList.remove('hidden');
    trapFocus(elements.gameOverModal);
    return true;
  }

  return false;
}

function showMessage(msg, announceToSR = true) {
  elements.message.textContent = msg;
  // Also announce important messages to screen readers
  if (announceToSR && msg) {
    announce(msg);
  }
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Typewriter effect for chronicle entries
async function typewriterEffect(element, text) {
  state.isTyping = true;
  element.textContent = '';
  element.classList.add('typing');

  for (let i = 0; i < text.length; i++) {
    element.textContent += text[i];
    // Scroll to bottom as we type
    elements.moveHistoryEl.scrollTop = elements.moveHistoryEl.scrollHeight;
    await delay(TYPEWRITER_SPEED);
  }

  element.classList.remove('typing');
  state.isTyping = false;
}

// Process chronicle queue
async function processChronicleQueue() {
  if (state.isTyping || state.chronicleQueue.length === 0) return;

  const entry = state.chronicleQueue.shift();
  const div = document.createElement('div');
  const isHero = entry.playerIndex === state.playerIndex;
  div.className = 'history-entry ' + (isHero ? 'hero' : 'enemy') + ' latest';

  // Remove 'latest' from previous entries
  const prevLatest = elements.moveHistoryEl.querySelector('.latest');
  if (prevLatest) prevLatest.classList.remove('latest');

  elements.moveHistoryEl.appendChild(div);

  const text = formatChronicleEntry(entry.action, entry.playerIndex);
  await typewriterEffect(div, text);

  // Continue processing queue
  if (state.chronicleQueue.length > 0) {
    await delay(200); // Brief pause between entries
    processChronicleQueue();
  }
}

// Show phase announcement banner
async function showPhaseBanner(text) {
  elements.phaseBanner.textContent = text;
  elements.phaseBanner.classList.remove('hidden');

  // Announce to screen readers (assertive for phase changes)
  announce(text, 'assertive');

  // Trigger reflow for animation
  void elements.phaseBanner.offsetWidth;
  elements.phaseBanner.classList.add('visible');

  await delay(PHASE_BANNER_DURATION);

  elements.phaseBanner.classList.remove('visible');
  await delay(200); // Wait for fade
  elements.phaseBanner.classList.add('hidden');
}

// Show AI thinking message
function showThinking(aiIndex) {
  const obs = state.game ? state.game.getObservation(state.playerIndex) : null;
  const isPartner = state.variant === 'team' && obs && obs.teammateIndex === aiIndex;
  let label;
  if (isPartner) {
    label = 'Partner';
  } else if (getNumPlayers() > 2) {
    label = `Foe ${aiIndex}`;
  } else {
    label = 'Foe';
  }
  elements.message.textContent = `🤔 ${label} is pondering...`;
  elements.message.classList.add('thinking');
}

function hideThinking() {
  elements.message.classList.remove('thinking');
}

// Random AI think time
function getAIThinkTime() {
  return AI_THINK_MIN + Math.random() * (AI_THINK_MAX - AI_THINK_MIN);
}

// ============================================================================
// Game Setup
// ============================================================================

async function startGame() {
  state.variant = elements.variantSelect.value;
  elements.variantLabel.textContent = state.variant.charAt(0).toUpperCase() + state.variant.slice(1);

  state.game = new CuttleGame({ variant: state.variant });
  state.gameStartTime = Date.now();
  state.moveHistory = [];
  state.selectedCard = null;

  // Reset animation tracking
  state.prevHandIds = new Set();
  state.prevPointIds = new Set();
  state.prevPermIds = new Set();

  // Reset pacing system
  state.chronicleQueue = [];
  state.isTyping = false;
  state.currentPhase = null;
  elements.moveHistoryEl.innerHTML = '';

  releaseFocusTrap(elements.startScreen);
  elements.startScreen.classList.add('hidden');
  elements.gameOverModal.classList.add('hidden');

  render();

  // Show dramatic game start banner and wait for it
  await showPhaseBanner('⚔️ BATTLE BEGINS');
  showMessage("Your turn! Click a card to play, or click the deck to draw.");

  // Start timer update (clear any existing interval first)
  state.startTimer(() => {
    elements.timer.textContent = formatTime(state.gameStartTime);
  });
}

// ============================================================================
// Event Listeners
// ============================================================================

// Keyboard shortcuts
document.addEventListener('keydown', async (e) => {
  // Don't handle shortcuts if a modal is open
  const modalOpen = !elements.startScreen.classList.contains('hidden') ||
                    !elements.rulesModal.classList.contains('hidden') ||
                    !elements.gameOverModal.classList.contains('hidden') ||
                    !elements.pauseModal.classList.contains('hidden') ||
                    !elements.scrapModal.classList.contains('hidden');

  if (modalOpen) {
    // Escape closes modals (with proper focus trap release)
    if (e.key === 'Escape') {
      if (!elements.rulesModal.classList.contains('hidden')) {
        releaseFocusTrap(elements.rulesModal);
        elements.rulesModal.classList.add('hidden');
      }
      if (!elements.pauseModal.classList.contains('hidden')) {
        releaseFocusTrap(elements.pauseModal);
        elements.pauseModal.classList.add('hidden');
      }
      if (!elements.scrapModal.classList.contains('hidden')) {
        releaseFocusTrap(elements.scrapModal);
        elements.scrapModal.classList.add('hidden');
      }
    }
    return;
  }

  // Handle multiplayer keyboard shortcuts
  if (state.isMultiplayer) {
    const myActions = state.serverValidActions[state.playerIndex] || [];
    const gameData = state.serverState?._gameState?.game;
    if (!gameData) return;

    switch (e.key) {
      case ' ': // Space - draw a card
      case 'Spacebar':
        e.preventDefault();
        if (myActions.includes('draw')) {
          executeMultiplayerAction('draw');
        }
        break;

      case 'Escape':
        // Cancel selection
        if (state.selectedCard) {
          state.selectedCard = null;
          hideActionPanel();
          clearTargetHighlights();
          renderMultiplayer();
        }
        break;

      case 'p':
      case 'P':
        // Pass
        if (myActions.includes('pass')) {
          executeMultiplayerAction('pass');
        }
        break;

      case '1': case '2': case '3': case '4':
      case '5': case '6': case '7': case '8':
        // Number keys select cards in hand
        if (myActions.length === 0) break;
        const obs = createObservationFromServerState(gameData, state.playerIndex);
        const cardIndex = parseInt(e.key) - 1;
        if (cardIndex < obs.myHand.length) {
          const card = obs.myHand[cardIndex];
          if (state.selectedCard && state.selectedCard.id === card.id) {
            // Deselect
            state.selectedCard = null;
            hideActionPanel();
            clearTargetHighlights();
          } else {
            // Select
            state.selectedCard = card;
            showActionsForCardMultiplayer(card);
          }
          renderMultiplayer();
        }
        break;
    }
    return;
  }

  // Single player keyboard shortcuts
  if (!state.game) return;

  const gameState = state.game.getState();

  switch (e.key) {
    case ' ': // Space - draw a card
    case 'Spacebar':
      e.preventDefault();
      if (gameState.phase === 'play' && gameState.currentPlayer === state.playerIndex) {
        const actions = state.game.getValidActions(state.playerIndex);
        if (actions.includes('draw')) {
          const result = state.game.action(state.playerIndex, 'draw');
          if (result.success) {
            addToHistory('Draw a card', state.playerIndex);
            hideActionPanel();
            clearTargetHighlights();
            render();
            if (checkGameEnd()) return;
            await runAITurn();
          }
        }
      }
      break;

    case 'Escape':
      // Cancel selection
      if (state.selectedCard) {
        state.selectedCard = null;
        hideActionPanel();
        clearTargetHighlights();
        render();
      }
      break;

    case 'p':
    case 'P':
      // Pass (in counter phase)
      if (gameState.phase === 'counter' && isHumanTurn()) {
        const actions = state.game.getValidActions(state.playerIndex);
        if (actions.includes('pass')) {
          const result = state.game.action(state.playerIndex, 'pass');
          if (result.success) {
            addToHistory('Pass', state.playerIndex);
            render();
            if (checkGameEnd()) return;
            await runAITurn();
          }
        }
      }
      break;

    case '1': case '2': case '3': case '4':
    case '5': case '6': case '7': case '8':
      // Number keys select cards in hand
      if (!isHumanTurn()) break;
      const obs = state.game.getObservation(state.playerIndex);
      const cardIndex = parseInt(e.key) - 1;
      if (cardIndex < obs.myHand.length) {
        const card = obs.myHand[cardIndex];
        if (state.selectedCard && state.selectedCard.id === card.id) {
          // Deselect
          state.selectedCard = null;
          hideActionPanel();
          clearTargetHighlights();
        } else {
          // Select
          state.selectedCard = card;
          showActionsForCard(card);
        }
        render();
      }
      break;
  }
});

// Start game button (vs AI)
document.getElementById('start-game').addEventListener('click', startGame);

// Start multiplayer button
document.getElementById('start-multiplayer').addEventListener('click', () => {
  releaseFocusTrap(elements.startScreen);
  elements.startScreen.classList.add('hidden');
  elements.multiplayerLobby.classList.remove('hidden');
  trapFocus(elements.multiplayerLobby);
  const serverUrl = elements.serverUrl.value || getDefaultServerUrl();
  connectToServer(serverUrl);
});

// Lobby connect button (retry connection)
elements.lobbyConnect.addEventListener('click', () => {
  const serverUrl = elements.serverUrl.value || getDefaultServerUrl();
  connectToServer(serverUrl);
});

// Lobby cancel button
elements.lobbyCancel.addEventListener('click', () => {
  disconnectFromServer();
  releaseFocusTrap(elements.multiplayerLobby);
  elements.multiplayerLobby.classList.add('hidden');
  elements.startScreen.classList.remove('hidden');
  trapFocus(elements.startScreen);
});

// Room create button
document.getElementById('create-room-btn')?.addEventListener('click', () => {
  createRoom();
});

// Room join button
document.getElementById('join-room-btn')?.addEventListener('click', () => {
  const input = document.getElementById('room-code-input');
  if (input && input.value.trim()) {
    joinRoom(input.value.trim());
  }
});

// Room code input - join on Enter
document.getElementById('room-code-input')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const input = e.target;
    if (input.value.trim()) {
      joinRoom(input.value.trim());
    }
  }
});

// Copy room code button
document.getElementById('copy-room-code')?.addEventListener('click', copyRoomCode);

// Copy room link button
document.getElementById('copy-room-link')?.addEventListener('click', copyRoomLink);

// Variant select - update rules button text
const showRulesBtn = document.getElementById('show-rules');
elements.variantSelect.addEventListener('change', () => {
  const selectedVariant = elements.variantSelect.value;
  const variantName = selectedVariant.charAt(0).toUpperCase() + selectedVariant.slice(1);
  showRulesBtn.textContent = `View ${variantName} Rules`;
});

// Play again button
document.getElementById('play-again').addEventListener('click', () => {
  releaseFocusTrap(elements.gameOverModal);

  if (state.isMultiplayer) {
    // Send ready signal to server
    sendToServer({
      cmd: 'dispatch',
      type: 'cuttle:ready',
      payload: { clientId: state.clientId }
    });
    // Update button to show we're waiting
    const btn = document.getElementById('play-again');
    btn.textContent = 'Waiting for opponent...';
    btn.disabled = true;
    return;
  }

  elements.gameOverModal.classList.add('hidden');
  elements.startScreen.classList.remove('hidden');
});

// Show rules button
document.getElementById('show-rules').addEventListener('click', () => {
  // Use selected variant from dropdown (game might not be started yet)
  const selectedVariant = elements.variantSelect.value;
  elements.rulesText.innerHTML = getRulesHTML(selectedVariant);
  elements.rulesModal.classList.remove('hidden');
  trapFocus(elements.rulesModal);
});

// Close rules button
document.getElementById('close-rules').addEventListener('click', () => {
  releaseFocusTrap(elements.rulesModal);
  elements.rulesModal.classList.add('hidden');
});

// Cancel action button
document.getElementById('cancel-action').addEventListener('click', () => {
  hideActionPanel();
  clearTargetHighlights();
  state.selectedCard = null;
  if (state.isMultiplayer) {
    renderMultiplayer();
  } else {
    render();
  }
});

// Pass button (for counter phase)
elements.passBtn.addEventListener('click', async () => {
  if (state.isMultiplayer) {
    const myActions = state.serverValidActions[state.playerIndex] || [];
    if (myActions.includes('pass')) {
      executeMultiplayerAction('pass');
    } else {
      showMessage("Can't pass right now.");
    }
    return;
  }

  const actions = state.game.getValidActions(state.playerIndex);
  const passAction = actions.find(a => a === 'pass');

  if (!passAction) {
    showMessage("Can't pass right now.");
    return;
  }

  const result = state.game.action(state.playerIndex, 'pass');
  if (result.success) {
    addToHistory('Pass', state.playerIndex);
    render();

    if (checkGameEnd()) return;
    await runAITurn();
  }
});

// Deck click (draw)
elements.deck.addEventListener('click', async () => {
  if (state.isMultiplayer) {
    const myActions = state.serverValidActions[state.playerIndex] || [];
    if (myActions.includes('draw')) {
      executeMultiplayerAction('draw');
    } else {
      const gameData = state.serverState?._gameState?.game;
      if (gameData?.currentPlayer !== state.playerIndex) {
        showMessage("It's not your turn.");
      } else {
        showMessage("Can't draw right now.");
      }
    }
    return;
  }

  const gameState = state.game.getState();
  if (gameState.currentPlayer !== state.playerIndex || gameState.phase !== 'play') {
    showMessage("It's not your turn.");
    return;
  }

  const actions = state.game.getValidActions(state.playerIndex);
  const drawAction = actions.find((a) => a === 'draw');

  if (!drawAction) {
    showMessage("Can't draw right now.");
    return;
  }

  const result = state.game.action(state.playerIndex, 'draw');
  if (result.success) {
    addToHistory('Draw a card', state.playerIndex);
    hideActionPanel();
    render();

    if (checkGameEnd()) return;
    await runAITurn();
  }
});

// Scrap pile click (view scrap)
document.getElementById('scrap').addEventListener('click', () => {
  if (state.isMultiplayer) {
    const gameData = state.serverState?._gameState?.game;
    if (!gameData) return;
    if (gameData.phase === 'resolve_three' && gameData.currentPlayer === state.playerIndex) {
      showScrapBrowserMultiplayer(true);
    } else {
      showScrapBrowserMultiplayer(false);
    }
    return;
  }

  if (!state.game) return;
  const gameState = state.game.getState();
  // In resolve_three phase, show selectable scrap browser
  if (gameState.phase === 'resolve_three' && gameState.currentPlayer === state.playerIndex) {
    showScrapBrowser(true);
  } else {
    // Otherwise just view the scrap pile
    showScrapBrowser(false);
  }
});

// Close scrap modal
elements.closeScrap.addEventListener('click', hideScrapBrowser);

// Variant label click - show rules for current game variant
elements.variantLabel.addEventListener('click', () => {
  if (!state.game && !state.isMultiplayer) return; // Only works during a game
  elements.rulesText.innerHTML = getRulesHTML(state.variant);
  elements.rulesModal.classList.remove('hidden');
  trapFocus(elements.rulesModal);
});

// Logo click - show pause modal
elements.logo.addEventListener('click', () => {
  if (!state.game && !state.isMultiplayer) return; // Only works during a game
  // Update pause modal with current game info
  const elapsed = formatTime(state.gameStartTime);
  let myPoints = 0;
  let myGoal = 21;

  if (state.isMultiplayer) {
    const gameData = state.serverState?._gameState?.game;
    if (gameData) {
      const obs = createObservationFromServerState(gameData, state.playerIndex);
      myPoints = obs.myPoints;
      myGoal = obs.myGoal;
    }
  } else if (state.game) {
    const obs = state.game.getObservation(state.playerIndex);
    myPoints = obs.myPoints;
    myGoal = obs.myGoal;
  }

  elements.pauseGameInfo.textContent = `${state.variant.charAt(0).toUpperCase() + state.variant.slice(1)} • ${elapsed} • ${myPoints}/${myGoal} pts`;
  elements.pauseVariantSelect.value = state.variant;
  elements.pauseModal.classList.remove('hidden');
  trapFocus(elements.pauseModal);
});

// Resume game button
document.getElementById('resume-game').addEventListener('click', () => {
  releaseFocusTrap(elements.pauseModal);
  elements.pauseModal.classList.add('hidden');
});

// New game button (from pause modal)
document.getElementById('new-game').addEventListener('click', () => {
  releaseFocusTrap(elements.pauseModal);
  elements.pauseModal.classList.add('hidden');

  // Disconnect from multiplayer if connected
  if (state.isMultiplayer) {
    disconnectFromServer();
  }

  // Update main variant select to match pause modal selection
  elements.variantSelect.value = elements.pauseVariantSelect.value;
  // Trigger the rules button text update
  const variantName = elements.pauseVariantSelect.value.charAt(0).toUpperCase() + elements.pauseVariantSelect.value.slice(1);
  document.getElementById('show-rules').textContent = `View ${variantName} Rules`;
  // Show start screen
  elements.startScreen.classList.remove('hidden');
  trapFocus(elements.startScreen);
  state.game = null;
});

// Show rules from pause modal
document.getElementById('pause-show-rules').addEventListener('click', () => {
  elements.rulesText.innerHTML = getRulesHTML(elements.pauseVariantSelect.value);
  elements.rulesModal.classList.remove('hidden');
  trapFocus(elements.rulesModal);
});

// ============================================================================
// Rules Text
// ============================================================================

function getRulesHTML(variant) {
  if (variant === 'cutthroat') {
    return `
      <h3>Objective</h3>
      <p>Be first to accumulate 14+ points in point cards.</p>

      <h3>Setup</h3>
      <p>54-card deck (with 2 Jokers), each player gets 5 cards. Hand limit is 7.</p>

      <h3>Point Cards (A-10)</h3>
      <p>Play for points equal to rank (A=1)</p>

      <h3>One-Off Effects</h3>
      <ul>
        <li><b>A</b> - Destroy ALL point cards</li>
        <li><b>2</b> - Destroy a permanent OR counter another one-off</li>
        <li><b>3</b> - Retrieve any card from the scrap pile</li>
        <li><b>4</b> - Target ONE opponent to discard 2 cards</li>
        <li><b>5</b> - Discard 1 card, then draw 3</li>
        <li><b>6</b> - Destroy ALL permanents</li>
        <li><b>7</b> - Reveal top 2, choose 1 to play, other goes back</li>
        <li><b>9</b> - Return a PERMANENT + owner SKIPS next turn</li>
      </ul>

      <h3>Permanents</h3>
      <ul>
        <li><b>8</b> - "Glasses" - Peek one opponent's hand at any time</li>
        <li><b>J</b> - Steal control of any opponent's point card</li>
        <li><b>Q</b> - Protect your other cards from being targeted</li>
        <li><b>K</b> - Reduce goal: 14 → 9 → 5 → 0 (3 Kings = instant win)</li>
        <li><b>🃏</b> - JOKER: Steal a royal (J, Q, K) from any opponent</li>
      </ul>

      <h3>Scuttling</h3>
      <p>Use a higher card to destroy any opponent's point card.</p>
    `;
  }

  const goal = variant === 'cutthroat' ? '14' : '21';
  const fiveRule = (variant === 'standard' || variant === 'team') ? 'Discard 1 card, then draw 3' : 'Draw 2 cards';
  const sevenRule = (variant === 'standard' || variant === 'team') ? 'Reveal top 2 cards, choose 1 to play' : 'Draw and must play immediately';
  const nineRule = variant === 'classic'
    ? "Return a PERMANENT to hand"
    : variant === 'cutthroat'
      ? "Return a PERMANENT + owner skips next turn"
      : "Return a PERMANENT to hand (can't play it next turn)";

  return `
    <h3>Objective</h3>
    <p>Be first to accumulate ${goal}+ points in point cards.</p>

    <h3>Point Cards (A-10)</h3>
    <p>Play for points equal to rank (A=1)</p>

    <h3>One-Off Effects</h3>
    <ul>
      <li><b>A</b> - Destroy ALL point cards</li>
      <li><b>2</b> - Destroy a permanent OR counter another one-off</li>
      <li><b>3</b> - Retrieve any card from the scrap pile</li>
      <li><b>4</b> - Opponent discards 2 cards from hand</li>
      <li><b>5</b> - ${fiveRule}</li>
      <li><b>6</b> - Destroy ALL permanents</li>
      <li><b>7</b> - ${sevenRule}</li>
      <li><b>9</b> - ${nineRule}</li>
    </ul>

    <h3>Permanents</h3>
    <ul>
      <li><b>8</b> - "Glasses" - Opponent's hand is revealed to you</li>
      <li><b>J</b> - Steal control of a point card</li>
      <li><b>Q</b> - Protect your other cards from being targeted</li>
      <li><b>K</b> - ${(variant === 'standard' || variant === 'team') ? 'Reduce your goal: 21 → 14 → 10 → 5 → 0' : 'Reduce your goal: 21 → 14 → 10 → 7 → 5'}</li>
    </ul>

    <h3>Scuttling</h3>
    <p>Use a higher card from hand to destroy opponent's point card. Both go to scrap.</p>
  `;
}

// Initial setup
elements.rulesText.innerHTML = getRulesHTML('classic');
