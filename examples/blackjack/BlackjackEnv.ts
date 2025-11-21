/*
 * examples/blackjack/BlackjackEnv.ts
 * Fixed: Trigger dealer play on Stand to capture rewards
 */
import { GymEnvironment, Observation, StepResult, Space } from "../../interface/Gym.js";
import { Engine } from "../../engine/Engine.js";
import { MultiplayerBlackjackGame } from "./multiplayer-game.js";
import { Player } from "../../engine/Player.js";
import { getBestHandValue, isSoftHand } from "./blackjack-utils.js";

export class BlackjackEnv extends GymEnvironment {
  engine: Engine;
  game: MultiplayerBlackjackGame;
  agentName: string;
  
  private _lastBankroll: number = 1000;

  constructor(agentName = "Agent") {
    super();
    this.agentName = agentName;
    
    this.engine = new Engine();
    this.game = new MultiplayerBlackjackGame(this.engine, {
      isHost: true,
      numPlayers: 1,
      playerNames: [agentName] as any,
      initialBankroll: 1000,
      numDecks: 6
    });
  }

  get observationSpace(): Space {
    return { shape: [7], low: [0,0,0,0,0,0,0], high: [1,1,1,1,1,1,1] };
  }

  get actionSpace(): Space {
    return { n: 2, shape: [] }; // 0: Hit, 1: Stand
  }

  async reset(seed?: number): Promise<Observation> {
    if (this.engine.deck) {
      if (this.engine.deck.size < 52) {
        this.engine.table.collectAllInto(this.engine.deck);
        this.engine.deck.shuffle(seed);
      }
    }

    const p = this.getPlayer();
    p.resources.currentBet = 10; 
    this._lastBankroll = p.resources.bankroll;

    this.game.deal();
    return this._observe();
  }

  async step(action: number): Promise<StepResult> {
    const p = this.getPlayer();
    
    if (action === 0) { // Hit
      this.game.hit();
    } else if (action === 1) { // Stand
      this.game.stand();
      // FIX: If we stand, immediately play dealer to resolve bets
      // In a real multiplayer game this waits, but for Gym we force it.
      this.game.playDealer();
    }

    // If player busted, hit() logic advances turn, which stops loop
    // playDealer() also resolves bets.
    
    const isRoundOver = !this.engine.loop.running || this.engine.loop.phase === "dealer";
    
    const currentBankroll = p.resources.bankroll;
    let reward = currentBankroll - this._lastBankroll;
    this._lastBankroll = currentBankroll;

    return {
      observation: this._observe(),
      reward: reward,
      terminated: isRoundOver,
      truncated: false,
      info: { 
        hand: this._getHandString(),
        bankroll: currentBankroll 
      }
    };
  }

  render(): void {
    const obs = this._observe();
    const p = this.getPlayer();
    console.log(`
    State: [${obs.map(n => n.toFixed(2)).join(", ")}]
    Hand:  ${this._getHandString()}
    Value: ${this._getHandValue()}
    Bank:  $${p.resources.bankroll}
    `);
  }

  // --- Helpers ---

  private getPlayer(): Player {
    return this.engine._players.find(p => p.name === this.agentName)!;
  }

  private _getHandValue(): number {
    const p = this.getPlayer();
    const zoneName = p.handZone || `player-0-hand`;
    const cards = this.engine.table.zone(zoneName).map(pl => pl.tokenSnapshot);
    return getBestHandValue(cards);
  }

  private _getHandString(): string {
    const p = this.getPlayer();
    const zoneName = p.handZone || `player-0-hand`;
    const cards = this.engine.table.zone(zoneName);
    return cards.map(c => c.tokenSnapshot.label).join(", ");
  }

  private _observe(): Observation {
    const p = this.getPlayer();
    const dealerHand = this.engine.table.zone("dealer-hand");
    const zoneName = p.handZone || `player-0-hand`;
    
    const playerCards = this.engine.table.zone(zoneName).map(pl => pl.tokenSnapshot);
    const dealerCards = dealerHand.map(pl => pl.tokenSnapshot);
    
    const playerVal = getBestHandValue(playerCards);
    const dealerVisible = dealerHand.filter(c => c.faceUp).map(c => c.tokenSnapshot);
    const dealerVal = getBestHandValue(dealerVisible);

    return [
      this.normalize(playerVal, 0, 30),              
      this.normalize(dealerVal, 0, 12),              
      isSoftHand(playerCards) ? 1 : 0,               
      0,                                             
      this.normalize(this.engine.deck?.size ?? 0, 0, 312), 
      this.normalize(p.resources.currentBet, 0, 1000),     
      this.engine.loop.activePlayer?.name === p.name ? 1 : 0 
    ];
  }
}