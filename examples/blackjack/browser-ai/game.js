/**
 * Browser Blackjack with ONNX AI opponent
 *
 * This demo shows a trained neural network playing blackjack alongside
 * a human player. Both compete against the dealer independently.
 *
 * The AI uses an ONNX model exported from Stable-Baselines3 training.
 */

// === ONNX Session ===
let onnxSession = null;
let aiMetadata = null;

// === Game State ===
const gameState = {
  deck: [],
  playerHand: [],
  dealerHand: [],
  aiHand: [],
  playerDone: false,
  aiDone: false,
  gameOver: false,
};

// === Statistics ===
const stats = {
  playerWins: 0,
  playerLosses: 0,
  playerPushes: 0,
  aiWins: 0,
  aiLosses: 0,
  aiPushes: 0,
};

// === ONNX Model Loading ===

async function loadModel() {
  const statusEl = document.getElementById("model-status");
  const dotEl = document.getElementById("status-dot");

  try {
    statusEl.textContent = "Loading ONNX model...";

    // Load model - try local file first, then fallback message
    try {
      onnxSession = await ort.InferenceSession.create("./blackjack_policy.onnx");
    } catch (modelError) {
      // Model not found - show helpful message
      statusEl.innerHTML =
        'Model not found. <a href="#setup" style="color: #60a5fa;">See setup instructions</a>';
      dotEl.classList.add("error");
      log("Model file not found. Please export a model first:", "system");
      log("  1. Run: python train_and_export.py", "system");
      log("  2. Copy blackjack_policy.onnx to this folder", "system");
      return;
    }

    // Try to load metadata
    try {
      const response = await fetch("./blackjack_policy.json");
      if (response.ok) {
        aiMetadata = await response.json();
      }
    } catch {
      // Metadata is optional
      aiMetadata = { actions: ["blackjack:hit", "blackjack:stand"] };
    }

    statusEl.textContent = "Model loaded - AI ready!";
    dotEl.classList.add("ready");

    log("ONNX model loaded successfully", "system");
    if (aiMetadata?.actions) {
      log(`Actions: ${aiMetadata.actions.join(", ")}`, "system");
    }
  } catch (error) {
    statusEl.textContent = `Error: ${error.message}`;
    dotEl.classList.add("error");
    console.error("Model loading error:", error);
    log(`Failed to load model: ${error.message}`, "system");
  }
}

// === AI Inference ===

async function getAIAction(observation) {
  if (!onnxSession) {
    // No model loaded - use basic strategy as fallback
    const handValue = observation[0] * 30; // Denormalize
    return handValue < 17 ? 0 : 1; // Hit if < 17, else Stand
  }

  const inputTensor = new ort.Tensor(
    "float32",
    Float32Array.from(observation),
    [1, 7]
  );

  const results = await onnxSession.run({ observation: inputTensor });

  // Handle both 'action_probs' and 'action' output names
  const outputName = Object.keys(results)[0];
  const probs = results[outputName].data;

  // Update AI probability display
  const probsEl = document.getElementById("ai-probs");
  probsEl.innerHTML = `
    Hit: ${(probs[0] * 100).toFixed(1)}% | Stand: ${(probs[1] * 100).toFixed(1)}%
    <div class="prob-bar"><div class="fill" style="width: ${probs[0] * 100}%"></div></div>
  `;

  log(
    `AI thinking: Hit=${(probs[0] * 100).toFixed(1)}%, Stand=${(probs[1] * 100).toFixed(1)}%`,
    "ai"
  );

  // Argmax selection
  return probs[0] > probs[1] ? 0 : 1;
}

function buildAIObservation() {
  const aiValue = getHandValue(gameState.aiHand);
  const dealerUpcard = gameState.dealerHand[0]?.value || 0;
  const isSoft = hasSoftAce(gameState.aiHand);

  // Normalize to match training environment
  return [
    aiValue / 30, // Normalized hand value (0-30 range)
    dealerUpcard / 12, // Dealer upcard (0-12 range)
    isSoft ? 1 : 0, // Soft hand indicator
    0, // Can split (simplified - always 0)
    gameState.deck.length / 312, // Cards remaining (6 deck shoe)
    0.1, // Bet size normalized (fixed)
    1, // Is AI's turn
  ];
}

// === Card Utilities ===

function createDeck() {
  const suits = ["\u2660", "\u2665", "\u2666", "\u2663"]; // Spades, Hearts, Diamonds, Clubs
  const ranks = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
  ];
  const deck = [];

  // Create 6-deck shoe for more realistic play
  for (let d = 0; d < 6; d++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        let value = parseInt(rank);
        if (rank === "A") value = 11;
        else if (["J", "Q", "K"].includes(rank)) value = 10;

        deck.push({
          rank,
          suit,
          value,
          display: rank + suit,
        });
      }
    }
  }

  // Shuffle using Fisher-Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

function getHandValue(hand) {
  let value = hand.reduce((sum, card) => sum + card.value, 0);
  let aces = hand.filter((c) => c.rank === "A").length;

  // Adjust for aces
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }

  return value;
}

function hasSoftAce(hand) {
  const total = hand.reduce((sum, card) => sum + card.value, 0);
  const hasAce = hand.some((c) => c.rank === "A");
  return hasAce && total <= 21;
}

function isBusted(hand) {
  return getHandValue(hand) > 21;
}

// === Game Logic ===

function deal() {
  // Reset or create deck if needed
  if (gameState.deck.length < 52) {
    gameState.deck = createDeck();
    log("Shuffled new 6-deck shoe", "system");
  }

  // Deal cards
  gameState.playerHand = [gameState.deck.pop(), gameState.deck.pop()];
  gameState.dealerHand = [gameState.deck.pop(), gameState.deck.pop()];
  gameState.aiHand = [gameState.deck.pop(), gameState.deck.pop()];

  // Reset state
  gameState.playerDone = false;
  gameState.aiDone = false;
  gameState.gameOver = false;

  // Reset UI
  document.getElementById("result").classList.remove("show");
  document.getElementById("btn-hit").disabled = false;
  document.getElementById("btn-stand").disabled = false;
  document.getElementById("ai-probs").innerHTML = "";

  log("--- New hand dealt ---", "system");
  render();

  // Check for blackjacks
  const playerValue = getHandValue(gameState.playerHand);
  const aiValue = getHandValue(gameState.aiHand);

  if (playerValue === 21) {
    log("Blackjack!", "player");
    playerStand();
  } else if (aiValue === 21) {
    log("AI has Blackjack!", "ai");
  }
}

function playerHit() {
  if (gameState.playerDone || gameState.gameOver) return;

  const card = gameState.deck.pop();
  gameState.playerHand.push(card);
  log(`You hit: ${card.display}`, "player");
  render();

  if (isBusted(gameState.playerHand)) {
    log("You busted!", "player");
    gameState.playerDone = true;
    afterPlayerTurn();
  }
}

function playerStand() {
  if (gameState.playerDone || gameState.gameOver) return;

  log("You stand", "player");
  gameState.playerDone = true;

  document.getElementById("btn-hit").disabled = true;
  document.getElementById("btn-stand").disabled = true;

  afterPlayerTurn();
}

async function afterPlayerTurn() {
  // AI's turn
  await aiTurn();

  // Dealer's turn
  await dealerTurn();

  // Resolve game
  resolveGame();
}

async function aiTurn() {
  if (gameState.aiDone) return;

  log("AI is thinking...", "ai");
  document.getElementById("ai-value").innerHTML =
    '<span class="ai-thinking">Thinking...</span>';

  await sleep(500);

  while (!gameState.aiDone && !isBusted(gameState.aiHand)) {
    const obs = buildAIObservation();
    const action = await getAIAction(obs);

    if (action === 0) {
      // Hit
      const card = gameState.deck.pop();
      gameState.aiHand.push(card);
      log(`AI hits: ${card.display}`, "ai");
      render();

      await sleep(600); // Dramatic pause

      if (isBusted(gameState.aiHand)) {
        log("AI busted!", "ai");
        gameState.aiDone = true;
      }
    } else {
      // Stand
      log("AI stands", "ai");
      gameState.aiDone = true;
    }
  }

  gameState.aiDone = true;
  render();
}

async function dealerTurn() {
  log("Dealer reveals hole card...", "dealer");
  await sleep(500);
  render(true); // Show all dealer cards

  // Dealer hits on 16 or less, stands on 17+
  while (getHandValue(gameState.dealerHand) < 17) {
    await sleep(500);
    const card = gameState.deck.pop();
    gameState.dealerHand.push(card);
    log(`Dealer hits: ${card.display}`, "dealer");
    render(true);
  }

  if (isBusted(gameState.dealerHand)) {
    log("Dealer busted!", "dealer");
  } else {
    log(`Dealer stands with ${getHandValue(gameState.dealerHand)}`, "dealer");
  }
}

function resolveGame() {
  gameState.gameOver = true;

  const playerValue = getHandValue(gameState.playerHand);
  const aiValue = getHandValue(gameState.aiHand);
  const dealerValue = getHandValue(gameState.dealerHand);

  const playerBust = playerValue > 21;
  const aiBust = aiValue > 21;
  const dealerBust = dealerValue > 21;

  // Determine results
  let playerResult, aiResult;

  if (playerBust) {
    playerResult = "LOSE";
    stats.playerLosses++;
  } else if (dealerBust || playerValue > dealerValue) {
    playerResult = "WIN";
    stats.playerWins++;
  } else if (playerValue === dealerValue) {
    playerResult = "PUSH";
    stats.playerPushes++;
  } else {
    playerResult = "LOSE";
    stats.playerLosses++;
  }

  if (aiBust) {
    aiResult = "LOSE";
    stats.aiLosses++;
  } else if (dealerBust || aiValue > dealerValue) {
    aiResult = "WIN";
    stats.aiWins++;
  } else if (aiValue === dealerValue) {
    aiResult = "PUSH";
    stats.aiPushes++;
  } else {
    aiResult = "LOSE";
    stats.aiLosses++;
  }

  // Display results
  const resultEl = document.getElementById("result");
  resultEl.classList.add("show");

  const playerResultEl = document.getElementById("result-player");
  const aiResultEl = document.getElementById("result-ai");
  const dealerResultEl = document.getElementById("result-dealer");

  playerResultEl.textContent = `${playerResult} (${playerValue})`;
  playerResultEl.className = `value ${playerResult.toLowerCase()}`;

  aiResultEl.textContent = `${aiResult} (${aiValue})`;
  aiResultEl.className = `value ${aiResult.toLowerCase()}`;

  dealerResultEl.textContent = dealerBust ? `BUST (${dealerValue})` : dealerValue;
  dealerResultEl.className = "value";

  // Update stats display
  document.getElementById("stats").textContent =
    `Wins: ${stats.playerWins} | Losses: ${stats.playerLosses} | Pushes: ${stats.playerPushes}`;

  log(`Results: You=${playerResult}, AI=${aiResult}`, "system");
}

// === Rendering ===

function render(showDealerHole = false) {
  // Determine if we should show dealer's hole card
  const showDealer = showDealerHole || gameState.playerDone;

  // Player hand
  document.getElementById("player-hand").innerHTML = gameState.playerHand
    .map((c) => cardHTML(c))
    .join("");
  document.getElementById("player-value").innerHTML =
    `Value: <strong>${getHandValue(gameState.playerHand)}</strong>` +
    (hasSoftAce(gameState.playerHand) ? " (soft)" : "");

  // Dealer hand
  document.getElementById("dealer-hand").innerHTML = gameState.dealerHand
    .map((c, i) => (i === 1 && !showDealer ? cardHTML(c, true) : cardHTML(c)))
    .join("");
  document.getElementById("dealer-value").innerHTML = showDealer
    ? `Value: <strong>${getHandValue(gameState.dealerHand)}</strong>`
    : `Showing: <strong>${gameState.dealerHand[0]?.value || "?"}</strong>`;

  // AI hand
  document.getElementById("ai-hand").innerHTML = gameState.aiHand
    .map((c) => cardHTML(c))
    .join("");

  const aiValueEl = document.getElementById("ai-value");
  if (!aiValueEl.querySelector(".ai-thinking")) {
    aiValueEl.innerHTML =
      `Value: <strong>${getHandValue(gameState.aiHand)}</strong>` +
      (hasSoftAce(gameState.aiHand) ? " (soft)" : "") +
      (gameState.aiDone ? " - done" : "");
  }
}

function cardHTML(card, hidden = false) {
  if (hidden) {
    return '<span class="card hidden"></span>';
  }
  const isRed = ["\u2665", "\u2666"].includes(card.suit);
  return `<span class="card ${isRed ? "red" : ""}">${card.display}</span>`;
}

// === Utilities ===

function log(msg, type = "system") {
  const logEl = document.getElementById("log");
  const entry = document.createElement("div");
  entry.className = `entry ${type}`;
  entry.textContent = msg;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// === Expose to Window ===

window.playerHit = playerHit;
window.playerStand = playerStand;
window.deal = deal;

// === Initialize ===

loadModel().then(() => {
  deal();
});
