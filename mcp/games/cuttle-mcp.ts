/**
 * Cuttle game wrapper for MCP
 *
 * Thin adapter around examples/cuttle/CuttleGame.ts. CuttleGame is a
 * standalone implementation (it does not use the HyperToken Engine
 * internally — this is intentional and documented). The wrapper exposes
 * an LLM-friendly index-picking interface: list actions as a numbered
 * menu, then pick by index. After the human acts, the AI (simple random
 * picker, same as examples/cuttle/cli.js's getRandomAction) plays its
 * turn, including any counter/resolution phases, before returning state.
 *
 * Only the 2-player `classic` variant is supported in the MCP wrapper.
 */

import { CuttleGame } from '../../examples/cuttle/CuttleGame.js';

const HUMAN_INDEX = 0;
const AI_INDEX = 1;

export class CuttleMCPGame {
  private game: CuttleGame | null = null;
  private lastMessages: string[] = [];

  constructor(_engine?: any) {}

  /**
   * Start a new classic 2-player game.
   * The `variant` argument is accepted for interface symmetry but only
   * `classic` (the default) is supported here.
   */
  newGame(variant?: string): string {
    const v = variant && variant !== '' ? variant : 'classic';
    if (v !== 'classic') {
      return `Unsupported variant "${v}". The MCP wrapper only supports "classic" 2-player Cuttle.`;
    }
    this.game = new CuttleGame({ variant: 'classic' });
    this.game.reset();
    this.lastMessages = ['New classic Cuttle game started. You are Player 0.'];

    // In classic 2-player, Player 1 (non-dealer) goes first. So the AI
    // acts first.
    this.playAiUntilHumanTurn();

    return this.describe();
  }

  /**
   * List the human's currently valid actions as a numbered menu.
   */
  listActions(): string {
    if (!this.game) {
      return 'No game in progress. Call cuttle_new_game first.';
    }
    const actions = this.humanActions();
    if (actions.length === 0) {
      return 'No actions available. The game may be over, or it is not your turn.';
    }
    const lines = actions.map((a, i) => `${i}. ${this.formatAction(a)}`);
    return 'Available actions:\n' + lines.join('\n');
  }

  /**
   * Pick an action by index from the current valid action list.
   */
  pickAction(index: number): string {
    if (!this.game) {
      return 'No game in progress. Call cuttle_new_game first.';
    }

    const actions = this.humanActions();
    if (index < 0 || index >= actions.length) {
      return `Invalid index ${index}. Valid range: 0-${actions.length - 1}.\n` + this.listActions();
    }

    const action = actions[index];
    const result = this.game.action(HUMAN_INDEX, action);
    this.lastMessages.push(`You: ${result.message}`);

    if (!result.success) {
      return `${result.message}\n\n` + this.describe();
    }

    // After the human acts, play out any AI turns / resolution phases
    // until it's the human's turn again or the game ends.
    this.playAiUntilHumanTurn();

    return this.describe();
  }

  /**
   * Format the current observable state for the human player.
   */
  describe(): string {
    if (!this.game) {
      return 'No game in progress. Call cuttle_new_game to start.';
    }

    const obs = this.game.getObservation(HUMAN_INDEX);
    const state = this.game.getState();

    const lines: string[] = [];

    lines.push('=== CUTTLE (classic, 2-player) ===');
    lines.push(`Turn: ${state.turnNumber} | Phase: ${state.phase}`);
    lines.push(`Deck: ${obs.deckSize} cards | Scrap: ${obs.scrap.length} cards`);

    // Opponent
    lines.push('');
    lines.push(`Opponent (Player ${AI_INDEX}):`);
    lines.push(`  Points: ${obs.opponentPoints}/${obs.opponentGoal}`);
    lines.push(`  Hand: ${obs.opponentHandSize} cards${obs.opponentHand ? ' (revealed by 8): ' + obs.opponentHand.map(this.cardStr).join(' ') : ''}`);
    lines.push(`  Point cards: ${this.formatPointCards(obs.opponentPointCards, AI_INDEX) || '(none)'}`);
    lines.push(`  Permanents: ${obs.opponentPermanents.map((p) => this.cardStr(p.card)).join(' ') || '(none)'}`);

    // You
    const yourTurn = state.currentPlayer === HUMAN_INDEX && state.phase !== 'complete';
    lines.push('');
    lines.push(`You (Player ${HUMAN_INDEX})${yourTurn ? ' [YOUR TURN]' : ''}:`);
    lines.push(`  Points: ${obs.myPoints}/${obs.myGoal}`);
    lines.push(`  Hand: ${obs.myHand.map(this.cardStr).join(' ') || '(empty)'}`);
    lines.push(`  Point cards: ${this.formatPointCards(obs.myPointCards, HUMAN_INDEX) || '(none)'}`);
    lines.push(`  Permanents: ${obs.myPermanents.map((p) => this.cardStr(p.card)).join(' ') || '(none)'}`);

    // Pending one-off / counter info
    if (obs.pendingOneOff) {
      const po = obs.pendingOneOff;
      lines.push('');
      lines.push(`Pending one-off: ${this.cardStr(po.card)} (played by Player ${po.player}) — counter phase`);
    }

    // Recent messages
    if (this.lastMessages.length > 0) {
      lines.push('');
      lines.push('Recent events:');
      const recent = this.lastMessages.slice(-5);
      for (const m of recent) {
        lines.push(`  - ${m}`);
      }
    }

    // Game end
    if (state.winner !== null) {
      lines.push('');
      if (state.winner === HUMAN_INDEX) {
        lines.push('*** YOU WIN! ***');
      } else {
        lines.push(`*** Player ${state.winner} wins. ***`);
      }
    } else if (state.isDraw) {
      lines.push('');
      lines.push('*** GAME IS A DRAW ***');
    } else if (yourTurn) {
      lines.push('');
      lines.push('Use cuttle_list_actions to see your options, then cuttle_pick_action.');
    }

    return lines.join('\n');
  }

  // ---- Internal helpers ----

  private humanActions(): string[] {
    if (!this.game) return [];
    const all = this.game.getValidActions(HUMAN_INDEX);
    // Exclude peek actions (cutthroat-only, not relevant in classic).
    return all.filter((a) => !a.startsWith('peek:'));
  }

  /**
   * Repeatedly play AI actions / auto-passes until it's the human's turn
   * to act or the game ends. Handles counter chains, resolve_four (AI
   * discarding), resolve_seven, etc.
   */
  private playAiUntilHumanTurn(): void {
    if (!this.game) return;
    let safety = 0;
    while (safety++ < 50) {
      const state = this.game.getState();
      if (state.winner !== null || state.isDraw || state.phase === 'complete') {
        return;
      }

      // Determine who should act in the current phase.
      const actor = this.currentActor(state);
      if (actor === HUMAN_INDEX) {
        return; // Human's turn — stop and let them pick.
      }

      // AI's turn (or AI must counter / discard). Pick a random action.
      const actions = this.game
        .getValidActions(AI_INDEX)
        .filter((a) => !a.startsWith('peek:'));
      if (actions.length === 0) {
        // Nothing for AI to do — bail to avoid infinite loop.
        return;
      }
      const action = actions[Math.floor(Math.random() * actions.length)];
      const result = this.game.action(AI_INDEX, action);
      this.lastMessages.push(`AI: ${result.message}`);
      if (!result.success) {
        return;
      }
    }
  }

  /**
   * Determine which player should act in the current phase.
   * Returns HUMAN_INDEX, AI_INDEX, or -1 if no one can act.
   */
  private currentActor(state: any): number {
    if (!this.game) return -1;
    switch (state.phase as string) {
      case 'play':
        return state.currentPlayer as number;
      case 'counter': {
        if (!state.pendingOneOff) return -1;
        const chainLen = state.pendingOneOff.counterChain.length;
        // Even chain: target's turn to counter; odd: original player.
        return chainLen % 2 === 0
          ? 1 - state.pendingOneOff.player
          : state.pendingOneOff.player;
      }
      case 'resolve_four':
        // discardingPlayer must discard.
        return state.discardingPlayer ?? (1 - state.currentPlayer);
      case 'resolve_three':
      case 'resolve_five_discard':
      case 'resolve_seven':
      case 'resolve_seven_choose':
        return state.currentPlayer;
      default:
        return state.currentPlayer;
    }
  }

  private cardStr(card: any): string {
    if (!card) return '?';
    if (card.isJoker) return 'Joker';
    const suitSymbols: Record<string, string> = {
      clubs: '♣',
      diamonds: '♦',
      hearts: '♥',
      spades: '♠',
    };
    return `${card.rank}${suitSymbols[card.suit] ?? card.suit[0]}`;
  }

  private formatPointCards(pcs: any[], controller: number): string {
    if (!pcs) return '';
    return pcs
      .filter((pc) => pc.controller === controller)
      .map((pc) => {
        const base = this.cardStr(pc.card);
        if (pc.attachedJacks && pc.attachedJacks.length > 0) {
          return `${base}(J×${pc.attachedJacks.length})`;
        }
        return base;
      })
      .join(' ');
  }

  /**
   * Render an action string in a human/LLM-readable form.
   */
  private formatAction(action: string): string {
    if (!this.game) return action;
    const obs = this.game.getObservation(HUMAN_INDEX);
    const parts = action.split(':');

    const findCard = (id: string): string => {
      const cid = parseInt(id, 10);
      const search: any[] = [
        ...obs.myHand,
        ...obs.myPointCards.map((p: any) => p.card),
        ...obs.myPermanents.map((p: any) => p.card),
        ...obs.opponentPointCards.map((p: any) => p.card),
        ...obs.opponentPermanents.map((p: any) => p.card),
        ...obs.scrap,
      ];
      for (const c of search) {
        if (c && c.id === cid) return this.cardStr(c);
      }
      return `card#${id}`;
    };

    switch (parts[0]) {
      case 'draw':
        return 'draw a card';
      case 'pass':
        return 'pass';
      case 'point':
        return `play ${findCard(parts[1])} as point card`;
      case 'oneoff':
        if (parts[2] === 'target') {
          return `play ${findCard(parts[1])} one-off targeting Player ${parts[3]}`;
        }
        if (parts.length > 3) {
          return `play ${findCard(parts[1])} one-off targeting ${findCard(parts[3])}`;
        }
        return `play ${findCard(parts[1])} as one-off`;
      case 'permanent':
        if (parts.length > 2) {
          return `play ${findCard(parts[1])} (Jack) on ${findCard(parts[2])}`;
        }
        return `play ${findCard(parts[1])} as permanent`;
      case 'scuttle':
        return `scuttle ${findCard(parts[2])} with ${findCard(parts[1])}`;
      case 'counter':
        return `counter with ${findCard(parts[1])}`;
      case 'choose':
        return `retrieve ${findCard(parts[1])} from scrap`;
      case 'discard':
        return `discard ${findCard(parts[1])}`;
      case 'five_discard':
        return `discard ${findCard(parts[1])} (then draw 3)`;
      case 'scrap_seven':
        if (parts.length > 1) return `scrap ${findCard(parts[1])} (can't play it)`;
        return "scrap drawn card (can't play it)";
      default:
        return action;
    }
  }
}
