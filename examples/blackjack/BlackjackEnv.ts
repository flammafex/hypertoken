/*
 * examples/blackjack/BlackjackEnv.ts
 * Fixed: Trigger dealer play on Stand to capture rewards
 */
import { GymEnvironment, Observation, StepResult, Space } from "../../interface/Gym.js";
import { Engine } from "../../engine/Engine.js";
import { MultiagentBlackjackGame } from "./multiagent-game.js";
import { Agent } from "../../engine/Agent.js";
import { IEngineAgent } from "../../engine/types.js";
import { getBestHandValue, isSoftHand } from "./blackjack-utils.js";

export class BlackjackEnv extends GymEnvironment {
  engine: Engine;
  game: MultiagentBlackjackGame;
  agentName: string;
  
  private _lastBankroll: number = 1000;

  constructor(agentName = "Agent") {
    super();
    this.agentName = agentName;
    
    this.engine = new Engine();
    this.game = new MultiagentBlackjackGame(this.engine, {
      isHost: true,
      numAgents: 1,
      agentNames: [agentName] as any,
      initialBankroll: 1000,
      numStacks: 6
    });
  }

  get observationSpace(): Space {
    return { shape: [7], low: [0,0,0,0,0,0,0], high: [1,1,1,1,1,1,1] };
  }

  get actionSpace(): Space {
    return { n: 2, shape: [] }; // 0: Hit, 1: Stand
  }

  async reset(seed?: number): Promise<Observation> {
    if (this.engine.stack) {
      if (this.engine.stack.size < 52) {
        this.engine.space.collectAllInto(this.engine.stack);
        this.engine.stack.shuffle(seed);
      }
    }

    const p = this.getAgent();
    p.resources.currentBet = 10; 
    this._lastBankroll = p.resources.bankroll;

    this.game.deal();
    return this._observe();
  }

  async step(action: number): Promise<StepResult> {
    const p = this.getAgent();
    
    if (action === 0) { // Hit
      this.game.hit();
    } else if (action === 1) { // Stand
      this.game.stand();
      // FIX: If we stand, immediately play dealer to resolve bets
      // In a real multiagent game this waits, but for Gym we force it.
      this.game.playDealer();
    }

    // If agent busted, hit() logic advances turn, which stops loop
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
    const p = this.getAgent();
    console.log(`
    State: [${obs.map(n => n.toFixed(2)).join(", ")}]
    Hand:  ${this._getHandString()}
    Value: ${this._getHandValue()}
    Bank:  $${p.resources.bankroll}
    `);
  }

  // --- Helpers ---

  private getAgent(): IEngineAgent {
    return this.engine._agents.find(p => p.name === this.agentName)!;
  }

  private _getHandValue(): number {
    const p = this.getAgent();
    const zoneName = p.handZone || `agent-0-hand`;
    const cards = this.engine.space.zone(zoneName).map(pl => pl.tokenSnapshot);
    return getBestHandValue(cards);
  }

  private _getHandString(): string {
    const p = this.getAgent();
    const zoneName = p.handZone || `agent-0-hand`;
    const cards = this.engine.space.zone(zoneName);
    return cards.map(c => c.tokenSnapshot.label).join(", ");
  }

  private _observe(): Observation {
    const p = this.getAgent();
    const dealerHand = this.engine.space.zone("dealer-hand");
    const zoneName = p.handZone || `agent-0-hand`;
    
    const agentCards = this.engine.space.zone(zoneName).map(pl => pl.tokenSnapshot);
    const dealerCards = dealerHand.map(pl => pl.tokenSnapshot);
    
    const agentVal = getBestHandValue(agentCards);
    const dealerVisible = dealerHand.filter(c => c.faceUp).map(c => c.tokenSnapshot);
    const dealerVal = getBestHandValue(dealerVisible);

    return [
      this.normalize(agentVal, 0, 30),              
      this.normalize(dealerVal, 0, 12),              
      isSoftHand(agentCards) ? 1 : 0,               
      0,                                             
      this.normalize(this.engine.stack?.size ?? 0, 0, 312), 
      this.normalize(p.resources.currentBet, 0, 1000),     
      this.engine.loop.activeAgent?.name === p.name ? 1 : 0 
    ];
  }
}