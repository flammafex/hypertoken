/**
 * HyperToken Playground
 *
 * Interactive demo showcasing HyperToken's capabilities:
 * - Play games manually
 * - Train AI agents in real-time
 * - Visualize learning progress
 */

// === Game Modules ===
import { BlackjackGame } from './games/blackjack.js';
import { TicTacToeGame } from './games/tictactoe.js';
import { PrisonersDilemmaGame } from './games/prisoners.js';

// === State ===
const state = {
  currentGame: null,
  training: false,
  trainingController: null,
  episodes: 0,
  rewards: [],
  wins: 0,
  chart: null
};

// === DOM Elements ===
const elements = {
  gameSelect: document.getElementById('game-select'),
  gameArea: document.getElementById('game-area'),
  gameControls: document.getElementById('game-controls'),
  btnTrain: document.getElementById('btn-train'),
  btnStop: document.getElementById('btn-stop'),
  progressFill: document.getElementById('progress-fill'),
  statEpisode: document.getElementById('stat-episode'),
  statReward: document.getElementById('stat-reward'),
  statWinrate: document.getElementById('stat-winrate'),
  rewardChart: document.getElementById('reward-chart'),
  console: document.getElementById('console')
};

// === Games Registry ===
const games = {
  blackjack: BlackjackGame,
  tictactoe: TicTacToeGame,
  prisoners: PrisonersDilemmaGame
};

// === Console Logging ===
function log(message, type = '') {
  const line = document.createElement('div');
  line.className = `console-line ${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  elements.console.appendChild(line);
  elements.console.scrollTop = elements.console.scrollHeight;

  // Keep last 100 lines
  while (elements.console.children.length > 100) {
    elements.console.removeChild(elements.console.firstChild);
  }
}

// === Chart Setup ===
function initChart() {
  const ctx = elements.rewardChart.getContext('2d');

  state.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Episode Reward',
        data: [],
        borderColor: '#4ade80',
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0
      }, {
        label: 'Moving Avg (50)',
        data: [],
        borderColor: '#60a5fa',
        borderWidth: 2,
        fill: false,
        tension: 0.4,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      scales: {
        x: {
          display: false
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.1)' },
          ticks: { color: '#888' }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#888' }
        }
      }
    }
  });
}

function updateChart(episode, reward) {
  const maxPoints = 200;

  state.chart.data.labels.push(episode);
  state.chart.data.datasets[0].data.push(reward);

  // Calculate moving average
  const windowSize = 50;
  const data = state.chart.data.datasets[0].data;
  const avg = data.length >= windowSize
    ? data.slice(-windowSize).reduce((a, b) => a + b) / windowSize
    : data.reduce((a, b) => a + b) / data.length;
  state.chart.data.datasets[1].data.push(avg);

  // Trim old data
  if (state.chart.data.labels.length > maxPoints) {
    state.chart.data.labels.shift();
    state.chart.data.datasets[0].data.shift();
    state.chart.data.datasets[1].data.shift();
  }

  state.chart.update('none');
}

function resetChart() {
  state.chart.data.labels = [];
  state.chart.data.datasets[0].data = [];
  state.chart.data.datasets[1].data = [];
  state.chart.update();
}

// === Game Management ===
function loadGame(gameId) {
  // Cleanup previous game
  if (state.currentGame) {
    state.currentGame.cleanup?.();
  }

  // Stop any training
  stopTraining();

  // Create new game
  const GameClass = games[gameId];
  if (!GameClass) {
    log(`Unknown game: ${gameId}`, 'error');
    return;
  }

  state.currentGame = new GameClass({
    gameArea: elements.gameArea,
    controlsArea: elements.gameControls,
    log
  });

  state.currentGame.init();

  log(`Loaded ${gameId}`, 'info');
  resetStats();
}

// === Training ===
async function startTraining() {
  if (state.training || !state.currentGame) return;

  state.training = true;
  state.trainingController = new AbortController();

  elements.btnTrain.disabled = true;
  elements.btnStop.disabled = false;

  resetStats();
  resetChart();

  const totalEpisodes = 1000;
  log(`Starting training for ${totalEpisodes} episodes...`, 'info');

  try {
    for (let ep = 1; ep <= totalEpisodes; ep++) {
      if (!state.training) break;

      // Run one episode
      const result = await state.currentGame.runEpisode();

      // Update stats
      state.episodes = ep;
      state.rewards.push(result.reward);
      if (result.win) state.wins++;

      // Update UI
      const avgReward = state.rewards.slice(-100).reduce((a, b) => a + b, 0) /
                        Math.min(state.rewards.length, 100);
      const winRate = (state.wins / ep * 100).toFixed(1);

      elements.statEpisode.textContent = ep;
      elements.statReward.textContent = avgReward.toFixed(2);
      elements.statWinrate.textContent = `${winRate}%`;
      elements.progressFill.style.width = `${(ep / totalEpisodes) * 100}%`;

      updateChart(ep, result.reward);

      // Log periodically
      if (ep % 100 === 0) {
        log(`Episode ${ep}: Avg Reward = ${avgReward.toFixed(2)}, Win Rate = ${winRate}%`);
      }

      // Yield to UI
      if (ep % 10 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    if (state.training) {
      log('Training complete!', 'success');
    }
  } catch (error) {
    log(`Training error: ${error.message}`, 'error');
    console.error(error);
  }

  state.training = false;
  elements.btnTrain.disabled = false;
  elements.btnStop.disabled = true;
}

function stopTraining() {
  if (!state.training) return;

  state.training = false;
  state.trainingController?.abort();

  elements.btnTrain.disabled = false;
  elements.btnStop.disabled = true;

  log('Training stopped', 'info');
}

function resetStats() {
  state.episodes = 0;
  state.rewards = [];
  state.wins = 0;

  elements.statEpisode.textContent = '0';
  elements.statReward.textContent = '0.0';
  elements.statWinrate.textContent = '0%';
  elements.progressFill.style.width = '0%';
}

// === Event Handlers ===
elements.gameSelect.addEventListener('change', (e) => {
  loadGame(e.target.value);
});

elements.btnTrain.addEventListener('click', startTraining);
elements.btnStop.addEventListener('click', stopTraining);

// === Initialize ===
initChart();
loadGame('blackjack');

log('HyperToken Playground initialized', 'success');
log('Select a game and play manually, or click "Train AI" to watch learning!');
