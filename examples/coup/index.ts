/**
 * HyperToken Coup Module
 *
 * Bluffing card game for multi-agent RL research on deception.
 */

export {
  CoupGame,
  CoupConfig,
  CoupGameState,
  CoupCard,
  PlayerState,
  GamePhase,
  PendingAction,
  ROLES,
  ACTIONS,
  Role,
  ActionType,
  getActionSpaceSize,
} from "./CoupGame.js";

export { CoupAEC, CoupAECConfig } from "./CoupAEC.js";
