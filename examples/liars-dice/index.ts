/**
 * HyperToken Liar's Dice Module
 *
 * Bluffing dice game for multi-agent RL research on deception and bidding.
 */

export {
  LiarsDiceGame,
  LiarsDiceConfig,
  LiarsDiceGameState,
  Bid,
  PlayerState,
  getActionSpaceSize,
  encodeBid,
  decodeBid,
} from "./LiarsDiceGame.js";

export { LiarsDiceAEC, LiarsDiceAECConfig } from "./LiarsDiceAEC.js";
