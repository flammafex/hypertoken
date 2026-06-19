/**
 * Cuttle Crypto Utilities
 *
 * Provides encryption/decryption for hidden information in CRDT-synced Cuttle.
 * Uses E2EEncryption (ECDH + AES-GCM) to encrypt card hands for specific players.
 *
 * Flow:
 * 1. Both players initialize E2EEncryption and exchange public keys
 * 2. Host shuffles and deals, encrypts each player's hand with their key
 * 3. Encrypted hands go in CRDT — everyone sees them, only owner can decrypt
 * 4. When a card is played, it's revealed as plaintext (public state)
 */

import { E2EEncryption } from "../../network/E2EEncryption.js";

/**
 * Encrypt a single card for a specific player.
 * @param e2e - The encryptor's E2EEncryption instance
 * @param recipientPeerId - The peer ID of the player who should be able to decrypt
 * @param card - The card to encrypt
 * @returns Encrypted card reference, or null if encryption fails
 */
export async function encryptCard(e2e, recipientPeerId, card) {
  const encrypted = await e2e.encryptJSON(recipientPeerId, card);
  if (!encrypted) return null;
  return {
    recipientPeerId,
    senderPeerId: e2e.localPeerId,
    iv: encrypted.iv,
    data: encrypted.data,
    // Store card id in plaintext so peers can track hand size
    cardId: card.id,
  };
}

/**
 * Encrypt an entire hand for a specific player.
 * @param e2e - The encryptor's E2EEncryption instance
 * @param recipientPeerId - The peer ID of the player who should be able to decrypt
 * @param hand - Array of cards to encrypt
 * @returns Array of encrypted card references
 */
export async function encryptHand(e2e, recipientPeerId, hand) {
  const encrypted = [];
  for (const card of hand) {
    const enc = await encryptCard(e2e, recipientPeerId, card);
    if (enc) encrypted.push(enc);
  }
  return encrypted;
}

/**
 * Decrypt an encrypted hand.
 * @param e2e - The decryptor's E2EEncryption instance
 * @param senderPeerId - The peer ID of the player who encrypted
 * @param encryptedHand - Array of encrypted card references
 * @returns Array of decrypted cards
 */
export async function decryptHand(e2e, senderPeerId, encryptedHand) {
  const cards = [];
  for (const enc of encryptedHand) {
    const card = await e2e.decryptJSON(senderPeerId, {
      iv: enc.iv,
      data: enc.data,
    });
    if (card) {
      cards.push(card);
    }
  }
  return cards;
}

/**
 * Compute a commitment hash for a card (for deck commitments).
 * Uses SHA-256. The commitment hides the card but allows verification on reveal.
 * @param card - The card to commit to
 * @returns Base64 hash string
 */
export async function hashCard(card) {
  const data = new TextEncoder().encode(JSON.stringify(card));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hashBuffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Verify that a revealed card matches its commitment.
 * @param card - The revealed card
 * @param commitment - The prior commitment hash
 * @returns true if the card matches the commitment
 */
export async function verifyCard(card, commitment) {
  const hash = await hashCard(card);
  return hash === commitment;
}

/**
 * Create deck commitments (hash of each card, preserving order).
 * The deck order is hidden — peers only see hashes, not actual cards.
 * @param deck - Array of cards
 * @returns Array of commitment hashes (same order as deck)
 */
export async function commitDeck(deck) {
  const commitments = [];
  for (const card of deck) {
    commitments.push(await hashCard(card));
  }
  return commitments;
}

/**
 * Create a sanitized game state for CRDT sync.
 * Replaces plaintext hands with encrypted hands.
 * Keeps deck as-is for now (deck encryption requires host-authoritative draws).
 *
 * @param gameState - Full CuttleGameState from CuttleGame.getState()
 * @param e2e - The encryptor's E2EEncryption instance
 * @param peerIds - Array of peer IDs indexed by player index
 * @returns Sanitized state with encrypted hands
 */
export async function sanitizeForSync(gameState, e2e, peerIds) {
  const sanitized = JSON.parse(JSON.stringify(gameState));

  // Encrypt each player's hand
  for (let i = 0; i < sanitized.players.length; i++) {
    const peerId = peerIds[i];
    const hand = gameState.players[i].hand;

    if (hand && hand.length > 0 && peerId && e2e.hasSession(peerId)) {
      // We have the actual cards AND can encrypt for this player
      sanitized.players[i].hand = await encryptHand(e2e, peerId, hand);
      sanitized.players[i].handEncrypted = true;
    } else if (hand && hand.length > 0) {
      // We have cards but can't encrypt (no session — e.g., own hand)
      // Replace with count only — don't leave plaintext in CRDT
      sanitized.players[i].handCount = hand.length;
      sanitized.players[i].hand = [];
      sanitized.players[i].handEncrypted = false;
    }
    // If hand is already empty (we don't have the cards), leave as-is
  }

  return sanitized;
}

/**
 * Load a sanitized state from CRDT into a local CuttleGame.
 * Decrypts the local player's hand, leaves opponent's hand encrypted.
 *
 * @param syncedState - The state from Chronicle (may have encrypted hands)
 * @param e2e - The decryptor's E2EEncryption instance
 * @param myPlayerIndex - Which player index is the local player
 * @param hostPeerId - The peer ID of the host (who encrypted)
 * @returns State with local hand decrypted, opponent hand cleared
 */
export async function loadFromSync(syncedState, e2e, myPlayerIndex, hostPeerId) {
  const state = JSON.parse(JSON.stringify(syncedState));

  // Decrypt my hand
  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];
    if (player.handEncrypted && Array.isArray(player.hand)) {
      if (i === myPlayerIndex && e2e.hasSession(hostPeerId)) {
        // This is my hand — decrypt it
        player.hand = await decryptHand(e2e, hostPeerId, player.hand);
        player.handEncrypted = false;
      } else {
        // Opponent's hand — can't decrypt, just track count
        player.handCount = player.hand.length;
        player.hand = [];
        player.handEncrypted = false;
      }
    }
  }

  return state;
}
