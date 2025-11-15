/**
 * Blackjack hand evaluation utilities
 */

/**
 * Calculate all possible hand values (handling Ace as 1 or 11)
 * @param {Array} cards - Array of card tokens
 * @returns {Array<number>} - All possible hand values
 */
export function calculateHandValues(cards) {
  if (!cards || cards.length === 0) return [0];
  
  let baseValue = 0;
  let aceCount = 0;
  
  for (const card of cards) {
    const values = card.meta?.value || [0];
    if (values.length > 1) {
      // This is an Ace
      aceCount++;
      baseValue += 1; // Start with Ace as 1
    } else {
      baseValue += values[0];
    }
  }
  
  // Generate all possible values by treating Aces as 1 or 11
  const possibleValues = [baseValue];
  
  for (let i = 0; i < aceCount; i++) {
    const newValue = baseValue + 10 * (i + 1);
    if (newValue <= 21) {
      possibleValues.push(newValue);
    }
  }
  
  return possibleValues;
}

/**
 * Get the best valid hand value (closest to 21 without busting)
 * @param {Array} cards - Array of card tokens
 * @returns {number} - Best hand value
 */
export function getBestHandValue(cards) {
  const values = calculateHandValues(cards);
  const validValues = values.filter(v => v <= 21);
  
  if (validValues.length === 0) {
    // Busted - return lowest value
    return Math.min(...values);
  }
  
  // Return highest valid value
  return Math.max(...validValues);
}

/**
 * Check if hand is busted (all values > 21)
 * @param {Array} cards - Array of card tokens
 * @returns {boolean}
 */
export function isBusted(cards) {
  const values = calculateHandValues(cards);
  return values.every(v => v > 21);
}

/**
 * Check if hand is blackjack (21 with exactly 2 cards)
 * @param {Array} cards - Array of card tokens
 * @returns {boolean}
 */
export function isBlackjack(cards) {
  if (cards.length !== 2) return false;
  const values = calculateHandValues(cards);
  return values.includes(21);
}

/**
 * Check if hand is soft (contains an Ace counted as 11)
 * @param {Array} cards - Array of card tokens
 * @returns {boolean}
 */
export function isSoftHand(cards) {
  const values = calculateHandValues(cards);
  const bestValue = getBestHandValue(cards);
  
  if (bestValue > 21) return false;
  
  // If we have multiple valid values and the best one uses an Ace as 11
  return values.length > 1 && values.includes(bestValue);
}

/**
 * Format hand for display
 * @param {Array} cards - Array of card tokens
 * @param {boolean} hideFirst - Hide first card (for dealer's hand)
 * @returns {string}
 */
export function formatHand(cards, hideFirst = false) {
  if (!cards || cards.length === 0) return "Empty hand";
  
  const cardStrings = cards.map((card, i) => {
    if (hideFirst && i === 0) {
      return "[Hidden]";
    }
    return `${card.char} ${card.label}${card.group ? ' of ' + card.group : ''}`;
  });
  
  if (hideFirst) {
    const visibleCards = cards.slice(1);
    const visibleValue = getBestHandValue(visibleCards);
    return `${cardStrings.join(", ")} (showing: ${visibleValue})`;
  }
  
  const value = getBestHandValue(cards);
  const soft = isSoftHand(cards);
  const valueStr = soft ? `soft ${value}` : value;
  
  return `${cardStrings.join(", ")} (${valueStr})`;
}

/**
 * Determine winner between player and dealer hands
 * @param {Array} playerCards
 * @param {Array} dealerCards
 * @returns {string} - "player", "dealer", "push", or "player-blackjack"
 */
export function determineWinner(playerCards, dealerCards) {
  const playerValue = getBestHandValue(playerCards);
  const dealerValue = getBestHandValue(dealerCards);
  const playerBJ = isBlackjack(playerCards);
  const dealerBJ = isBlackjack(dealerCards);
  
  // Both blackjack = push
  if (playerBJ && dealerBJ) return "push";
  
  // Player blackjack wins
  if (playerBJ) return "player-blackjack";
  
  // Dealer blackjack wins
  if (dealerBJ) return "dealer";
  
  // Player busted
  if (playerValue > 21) return "dealer";
  
  // Dealer busted
  if (dealerValue > 21) return "player";
  
  // Compare values
  if (playerValue > dealerValue) return "player";
  if (dealerValue > playerValue) return "dealer";
  
  return "push";
}