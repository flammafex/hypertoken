// CuttleGame.ts
var SUITS = ["clubs", "diamonds", "hearts", "spades"];
var RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
var HAND_LIMIT_2PLAYER = 8;
var HAND_LIMIT_CUTTHROAT = 7;
var HAND_LIMIT_TEAM = 7;
var BASE_GOAL = 21;
var BASE_GOAL_CUTTHROAT = 14;
var BASE_GOAL_TEAM = 21;
var KING_GOALS_CLASSIC = [14, 10, 7, 5];
var KING_GOALS_CUTTHROAT = [9, 5, 0];
var KING_GOALS_TEAM = [14, 10, 5, 0];
function getRankValue(rank) {
  if (rank === "A") return 1;
  if (rank === "J") return 11;
  if (rank === "Q") return 12;
  if (rank === "K") return 13;
  return parseInt(rank);
}
function getPointValue(rank) {
  const value = getRankValue(rank);
  return value <= 10 ? value : 0;
}
function getSuitValue(suit) {
  return SUITS.indexOf(suit);
}
function canScuttle(attacker, target) {
  const attackerValue = getRankValue(attacker.rank);
  const targetValue = getRankValue(target.rank);
  if (attackerValue > targetValue) return true;
  if (attackerValue === targetValue) {
    return getSuitValue(attacker.suit) > getSuitValue(target.suit);
  }
  return false;
}
function isPointRank(rank) {
  const value = getRankValue(rank);
  return value >= 1 && value <= 10;
}
function cardToString(card) {
  return `${card.rank}${card.suit[0].toUpperCase()}`;
}
var SeededRandom = class {
  seed;
  constructor(seed) {
    this.seed = seed ?? Date.now();
  }
  next() {
    this.seed = this.seed * 1103515245 + 12345 & 2147483647;
    return this.seed / 2147483647;
  }
  shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
};
var CuttleGame = class {
  config;
  rng;
  state;
  constructor(config = {}) {
    const variant = config.variant ?? "classic";
    const defaultHandLimit = variant === "cutthroat" ? HAND_LIMIT_CUTTHROAT : variant === "team" ? HAND_LIMIT_TEAM : HAND_LIMIT_2PLAYER;
    this.config = {
      seed: config.seed ?? null,
      handLimit: config.handLimit ?? defaultHandLimit,
      variant
    };
    this.rng = new SeededRandom(this.config.seed ?? void 0);
    this.state = this.createInitialState();
  }
  get variant() {
    return this.config.variant;
  }
  reset(seed) {
    if (seed !== void 0) {
      this.rng = new SeededRandom(seed);
    } else if (this.config.seed !== null) {
      this.rng = new SeededRandom(this.config.seed);
    } else {
      this.rng = new SeededRandom();
    }
    this.state = this.createInitialState();
  }
  createInitialState() {
    const deck = [];
    let id = 0;
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ rank, suit, id: id++ });
      }
    }
    if (this.config.variant === "cutthroat" || this.config.variant === "team") {
      deck.push({ rank: "A", suit: "hearts", id: id++, isJoker: true });
      deck.push({ rank: "A", suit: "spades", id: id++, isJoker: true });
    }
    const shuffledDeck = this.rng.shuffle(deck);
    const numPlayers = this.config.variant === "cutthroat" ? 3 : this.config.variant === "team" ? 4 : 2;
    const players = [];
    for (let i = 0; i < numPlayers; i++) {
      players.push({ hand: [], pointCards: [], permanents: [] });
    }
    if (this.config.variant === "team") {
      for (let i = 0; i < 5; i++) {
        for (let p = 0; p < 4; p++) {
          players[p].hand.push(shuffledDeck.pop());
        }
      }
    } else if (this.config.variant === "cutthroat") {
      for (let i = 0; i < 5; i++) {
        for (let p = 0; p < 3; p++) {
          players[p].hand.push(shuffledDeck.pop());
        }
      }
    } else {
      for (let i = 0; i < 5; i++) {
        players[1].hand.push(shuffledDeck.pop());
      }
      for (let i = 0; i < 6; i++) {
        players[0].hand.push(shuffledDeck.pop());
      }
    }
    return {
      players,
      deck: shuffledDeck,
      scrap: [],
      currentPlayer: 1,
      // Non-dealer goes first (Player left of dealer in Cutthroat)
      phase: "play",
      pendingOneOff: null,
      pendingRoyal: null,
      sevenDrawnCard: null,
      sevenRevealedCards: null,
      fiveDiscardPending: false,
      frozenCardIds: [],
      discardCount: 0,
      discardingPlayer: null,
      skipTurnPlayers: [],
      consecutivePasses: 0,
      winner: null,
      isDraw: false,
      lastAction: null,
      turnNumber: 0
    };
  }
  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }
  /**
   * Get the point goal for a player (affected by Kings)
   */
  getPointGoal(playerIndex) {
    const kingCount = this.state.players[playerIndex].permanents.filter(
      (p) => p.type === "king"
    ).length;
    const baseGoal = this.config.variant === "cutthroat" ? BASE_GOAL_CUTTHROAT : this.config.variant === "team" ? BASE_GOAL_TEAM : BASE_GOAL;
    if (kingCount === 0) return baseGoal;
    let kingGoals;
    if (this.config.variant === "cutthroat") {
      kingGoals = KING_GOALS_CUTTHROAT;
    } else if (this.config.variant === "standard" || this.config.variant === "team") {
      kingGoals = KING_GOALS_TEAM;
    } else {
      kingGoals = KING_GOALS_CLASSIC;
    }
    return kingGoals[Math.min(kingCount - 1, kingGoals.length - 1)];
  }
  /**
   * Get total points for a player
   */
  getPoints(playerIndex) {
    let points = 0;
    for (const player of this.state.players) {
      for (const pc of player.pointCards) {
        if (pc.controller === playerIndex) {
          points += getPointValue(pc.card.rank);
        }
      }
    }
    return points;
  }
  /**
   * Check if a player's cards are protected by a Queen
   */
  isProtected(playerIndex, cardId) {
    const player = this.state.players[playerIndex];
    const queens = player.permanents.filter((p) => p.type === "queen");
    if (queens.length === 0) return false;
    const isQueen = queens.some((q) => q.card.id === cardId);
    if (isQueen && queens.length === 1) return false;
    return true;
  }
  /**
   * Get observation for a player
   */
  getObservation(playerIndex) {
    const player = this.state.players[playerIndex];
    const numPlayers = this.state.players.length;
    const weHaveGlasses = player.permanents.some((p) => p.type === "eight");
    const opponents = [];
    for (let i = 0; i < numPlayers; i++) {
      if (i === playerIndex) continue;
      const opp = this.state.players[i];
      opponents.push({
        playerIndex: i,
        handSize: opp.hand.length,
        hand: weHaveGlasses ? opp.hand : null,
        pointCards: opp.pointCards,
        permanents: opp.permanents,
        points: this.getPoints(i),
        goal: this.getPointGoal(i)
      });
    }
    const mainOpponentIndex = numPlayers === 2 ? 1 - playerIndex : (playerIndex + 1) % numPlayers;
    const mainOpponent = this.state.players[mainOpponentIndex];
    return {
      myHand: player.hand,
      myPointCards: player.pointCards,
      myPermanents: player.permanents,
      myPoints: this.getPoints(playerIndex),
      myGoal: this.getPointGoal(playerIndex),
      // Array of all opponents (for 3+ player games)
      opponents,
      // Legacy 2-player fields (main opponent for backwards compatibility)
      opponentHandSize: mainOpponent.hand.length,
      opponentHand: weHaveGlasses ? mainOpponent.hand : null,
      opponentPointCards: mainOpponent.pointCards,
      opponentPermanents: mainOpponent.permanents,
      opponentPoints: this.getPoints(mainOpponentIndex),
      opponentGoal: this.getPointGoal(mainOpponentIndex),
      deckSize: this.state.deck.length,
      scrap: this.state.scrap,
      currentPlayer: this.state.currentPlayer,
      phase: this.state.phase,
      pendingOneOff: this.state.pendingOneOff,
      pendingRoyal: this.state.pendingRoyal,
      sevenDrawnCard: this.state.phase === "resolve_seven" && this.state.currentPlayer === playerIndex ? this.state.sevenDrawnCard : null,
      sevenRevealedCards: this.state.phase === "resolve_seven_choose" && this.state.currentPlayer === playerIndex ? this.state.sevenRevealedCards : null,
      fiveDiscardPending: this.state.fiveDiscardPending,
      frozenCardIds: this.state.frozenCardIds,
      discardCount: this.state.discardCount,
      discardingPlayer: this.state.discardingPlayer,
      skipTurnPlayers: this.state.skipTurnPlayers,
      consecutivePasses: this.state.consecutivePasses,
      winner: this.state.winner,
      isDraw: this.state.isDraw,
      lastAction: this.state.lastAction,
      variant: this.config.variant,
      numPlayers,
      // Team variant fields
      myTeam: this.config.variant === "team" ? this.getTeam(playerIndex) : null,
      teammateIndex: this.config.variant === "team" ? this.getTeammate(playerIndex) : null,
      winningTeam: this.config.variant === "team" && this.state.winner !== null ? this.getTeam(this.state.winner) : null
    };
  }
  get numPlayers() {
    return this.config.variant === "cutthroat" ? 3 : this.config.variant === "team" ? 4 : 2;
  }
  /**
   * Get the teammate's player index (Team variant only)
   * Teams: 0 & 2 vs 1 & 3 (players sitting across from each other)
   */
  getTeammate(playerIndex) {
    return (playerIndex + 2) % 4;
  }
  /**
   * Get the team number for a player (0 or 1)
   * Team 0: Players 0 & 2
   * Team 1: Players 1 & 3
   */
  getTeam(playerIndex) {
    return playerIndex % 2;
  }
  /**
   * Check if a card is frozen (can't be played this turn) - standard/cutthroat only
   */
  isCardFrozen(cardId) {
    if (this.config.variant === "classic") return false;
    return this.state.frozenCardIds.includes(cardId);
  }
  /**
   * Get adjacent players for a given player
   * In Cutthroat (3-player): all other players are adjacent
   * In Team (4-player): all other players are adjacent (Jacks can target anyone)
   */
  getAdjacentPlayers(playerIndex) {
    const numPlayers = this.state.players.length;
    if (numPlayers === 2) return [1 - playerIndex];
    return Array.from({ length: numPlayers }, (_, i) => i).filter((i) => i !== playerIndex);
  }
  /**
   * Get opponent players (not on the same team) for Team variant
   */
  getOpponents(playerIndex) {
    const numPlayers = this.state.players.length;
    if (this.config.variant !== "team") {
      return Array.from({ length: numPlayers }, (_, i) => i).filter((i) => i !== playerIndex);
    }
    const myTeam = this.getTeam(playerIndex);
    return Array.from({ length: numPlayers }, (_, i) => i).filter(
      (i) => this.getTeam(i) !== myTeam
    );
  }
  /**
   * Check if a card is a Joker
   */
  isJoker(card) {
    return card.isJoker === true;
  }
  /**
   * Get all targetable royals for Joker (8, Q, K, or attached Jacks from opponents)
   */
  getJokerTargets(playerIndex) {
    const targets = [];
    for (let i = 0; i < this.state.players.length; i++) {
      if (i === playerIndex) continue;
      const player = this.state.players[i];
      for (const perm of player.permanents) {
        if (perm.type === "queen" || perm.type === "king") {
          if (!this.isProtected(i, perm.card.id)) {
            targets.push({ card: perm.card, owner: i, type: "permanent" });
          }
        }
      }
    }
    for (const player of this.state.players) {
      for (const pc of player.pointCards) {
        for (const jack of pc.attachedJacks) {
          const jackController = this.getJackController(pc, jack);
          if (jackController !== playerIndex && !this.isProtected(jackController, jack.id)) {
            targets.push({ card: jack, owner: jackController, type: "jack" });
          }
        }
      }
    }
    return targets;
  }
  /**
   * Get all point cards that can be targeted (not protected by queen)
   */
  getTargetablePointCards(targetPlayer) {
    const result = [];
    for (const player of this.state.players) {
      for (const pc of player.pointCards) {
        if (pc.controller === targetPlayer) {
          if (!this.isProtected(targetPlayer, pc.card.id)) {
            result.push(pc);
          }
        }
      }
    }
    return result;
  }
  /**
   * Get all permanents that can be targeted (not protected by queen)
   */
  getTargetablePermanents(targetPlayer) {
    return this.state.players[targetPlayer].permanents.filter(
      (p) => !this.isProtected(targetPlayer, p.card.id)
    );
  }
  /**
   * Get valid actions for a player in current state
   */
  getValidActions(playerIndex) {
    const actions = [];
    const player = this.state.players[playerIndex];
    const numPlayers = this.state.players.length;
    if (this.state.winner !== null || this.state.isDraw) {
      return [];
    }
    switch (this.state.phase) {
      case "play":
        if (playerIndex !== this.state.currentPlayer) return [];
        if (this.state.deck.length > 0 && player.hand.length < this.config.handLimit) {
          actions.push("draw");
        }
        if (this.state.deck.length === 0) {
          actions.push("pass");
        }
        for (const card of player.hand) {
          if (this.isCardFrozen(card.id)) continue;
          if (this.isJoker(card)) {
            const jokerTargets = this.getJokerTargets(playerIndex);
            if (this.config.variant === "team") {
              for (const target of jokerTargets) {
                for (let destPlayer = 0; destPlayer < numPlayers; destPlayer++) {
                  if (destPlayer !== target.owner) {
                    actions.push(`joker:${card.id}:${target.card.id}:${destPlayer}`);
                  }
                }
              }
            } else {
              for (const target of jokerTargets) {
                actions.push(`joker:${card.id}:${target.card.id}`);
              }
            }
            continue;
          }
          if (isPointRank(card.rank)) {
            actions.push(`point:${card.id}`);
          }
          switch (card.rank) {
            case "A":
              if (this.getAllPointCardsInPlay().length > 0) {
                actions.push(`oneoff:${card.id}`);
              }
              break;
            case "2":
              for (const p of this.state.players) {
                for (const perm of p.permanents) {
                  if (!this.isProtected(this.state.players.indexOf(p), perm.card.id)) {
                    actions.push(`oneoff:${card.id}:permanent:${perm.card.id}`);
                  }
                }
              }
              for (const p of this.state.players) {
                for (const pc of p.pointCards) {
                  for (const jack of pc.attachedJacks) {
                    const jackController = this.getJackController(pc, jack);
                    if (!this.isProtected(jackController, jack.id)) {
                      actions.push(`oneoff:${card.id}:permanent:${jack.id}`);
                    }
                  }
                }
              }
              break;
            case "3":
              if (this.state.scrap.length > 0) {
                actions.push(`oneoff:${card.id}`);
              }
              break;
            case "4":
              if (numPlayers === 2) {
                const opponent = this.state.players[1 - playerIndex];
                if (opponent.hand.length > 0) {
                  actions.push(`oneoff:${card.id}`);
                }
              } else {
                for (let i = 0; i < numPlayers; i++) {
                  if (i !== playerIndex && this.state.players[i].hand.length > 0) {
                    actions.push(`oneoff:${card.id}:target:${i}`);
                  }
                }
              }
              break;
            case "5":
              if (this.state.deck.length > 0) {
                actions.push(`oneoff:${card.id}`);
              }
              break;
            case "6":
              if (this.getAllPermanentsInPlay().length > 0) {
                actions.push(`oneoff:${card.id}`);
              }
              break;
            case "7":
              if (this.state.deck.length > 0) {
                actions.push(`oneoff:${card.id}`);
              }
              break;
            case "9":
              for (const p of this.state.players) {
                const pIdx = this.state.players.indexOf(p);
                for (const perm of p.permanents) {
                  if (!this.isProtected(pIdx, perm.card.id)) {
                    actions.push(`oneoff:${card.id}:card:${perm.card.id}`);
                  }
                }
                for (const pc of p.pointCards) {
                  for (const jack of pc.attachedJacks) {
                    const jackController = this.getJackController(pc, jack);
                    if (!this.isProtected(jackController, jack.id)) {
                      actions.push(`oneoff:${card.id}:card:${jack.id}`);
                    }
                  }
                  if (this.config.variant === "classic") {
                    if (!this.isProtected(pc.controller, pc.card.id)) {
                      actions.push(`oneoff:${card.id}:card:${pc.card.id}`);
                    }
                  }
                }
              }
              break;
          }
          switch (card.rank) {
            case "8":
              actions.push(`permanent:${card.id}`);
              break;
            case "J":
              if (this.config.variant === "team") {
                for (let targetPlayer = 0; targetPlayer < numPlayers; targetPlayer++) {
                  for (const pc of this.getTargetablePointCards(targetPlayer)) {
                    for (let destPlayer = 0; destPlayer < numPlayers; destPlayer++) {
                      if (destPlayer !== pc.controller) {
                        actions.push(`permanent:${card.id}:${pc.card.id}:${destPlayer}`);
                      }
                    }
                  }
                }
                for (const pc of player.pointCards) {
                  if (pc.controller !== playerIndex && !this.isProtected(pc.controller, pc.card.id)) {
                    for (let destPlayer = 0; destPlayer < numPlayers; destPlayer++) {
                      if (destPlayer !== pc.controller) {
                        actions.push(`permanent:${card.id}:${pc.card.id}:${destPlayer}`);
                      }
                    }
                  }
                }
              } else if (this.config.variant === "cutthroat") {
                const adjacentPlayers = this.getAdjacentPlayers(playerIndex);
                for (const adjPlayer of adjacentPlayers) {
                  for (const pc of this.getTargetablePointCards(adjPlayer)) {
                    actions.push(`permanent:${card.id}:${pc.card.id}`);
                  }
                }
                for (const pc of player.pointCards) {
                  if (pc.controller !== playerIndex && adjacentPlayers.includes(pc.controller)) {
                    if (!this.isProtected(pc.controller, pc.card.id)) {
                      actions.push(`permanent:${card.id}:${pc.card.id}`);
                    }
                  }
                }
              } else {
                for (const pc of this.getTargetablePointCards(1 - playerIndex)) {
                  actions.push(`permanent:${card.id}:${pc.card.id}`);
                }
                for (const pc of player.pointCards) {
                  if (pc.controller !== playerIndex && !this.isProtected(pc.controller, pc.card.id)) {
                    actions.push(`permanent:${card.id}:${pc.card.id}`);
                  }
                }
              }
              break;
            case "Q":
            case "K":
              actions.push(`permanent:${card.id}`);
              break;
          }
          if (isPointRank(card.rank)) {
            for (let oppIdx = 0; oppIdx < numPlayers; oppIdx++) {
              if (oppIdx === playerIndex) continue;
              const oppPlayer = this.state.players[oppIdx];
              for (const pc of oppPlayer.pointCards) {
                if (pc.controller === oppIdx && canScuttle(card, pc.card)) {
                  actions.push(`scuttle:${card.id}:${pc.card.id}`);
                }
              }
            }
            for (const pc of player.pointCards) {
              if (pc.controller !== playerIndex && canScuttle(card, pc.card)) {
                actions.push(`scuttle:${card.id}:${pc.card.id}`);
              }
            }
          }
        }
        break;
      case "counter":
        if (!this.state.pendingOneOff) return [];
        const oneOffPlayer = this.state.pendingOneOff.player;
        let counteringPlayer;
        if (this.state.pendingOneOff.counterChain.length % 2 === 0) {
          if (this.state.pendingOneOff.targetPlayer !== void 0) {
            counteringPlayer = this.state.pendingOneOff.targetPlayer;
          } else if (this.state.pendingOneOff.target) {
            counteringPlayer = this.findCardOwner(this.state.pendingOneOff.target.cardId);
            if (counteringPlayer === -1) {
              counteringPlayer = (oneOffPlayer + 1) % numPlayers;
            }
          } else {
            if (numPlayers === 2) {
              counteringPlayer = 1 - oneOffPlayer;
            } else {
              counteringPlayer = (oneOffPlayer + 1) % numPlayers;
            }
          }
        } else {
          counteringPlayer = oneOffPlayer;
        }
        if (playerIndex !== counteringPlayer) return [];
        for (const card of player.hand) {
          if (card.rank === "2") {
            actions.push(`counter:${card.id}`);
          }
        }
        actions.push("pass");
        break;
      case "resolve_three":
        if (playerIndex !== this.state.currentPlayer) return [];
        for (const card of this.state.scrap) {
          actions.push(`choose:${card.id}`);
        }
        break;
      case "resolve_four":
        const discardingPlayer = this.state.discardingPlayer ?? 1 - this.state.currentPlayer;
        if (playerIndex !== discardingPlayer) return [];
        for (const card of player.hand) {
          actions.push(`discard:${card.id}`);
        }
        break;
      case "resolve_five_discard":
        if (playerIndex !== this.state.currentPlayer) return [];
        for (const card of player.hand) {
          actions.push(`five_discard:${card.id}`);
        }
        break;
      case "resolve_seven":
        if (playerIndex !== this.state.currentPlayer) return [];
        if (!this.state.sevenDrawnCard) return [];
        const drawnCard = this.state.sevenDrawnCard;
        const sevenActions = this.getSevenPlayActions(playerIndex, drawnCard);
        if (sevenActions.length === 0) {
          actions.push("scrap_seven");
        } else {
          actions.push(...sevenActions);
        }
        break;
      case "resolve_seven_choose":
        if (playerIndex !== this.state.currentPlayer) return [];
        if (!this.state.sevenRevealedCards || this.state.sevenRevealedCards.length === 0) return [];
        for (const card of this.state.sevenRevealedCards) {
          const cardActions = this.getSevenPlayActions(playerIndex, card);
          if (cardActions.length > 0) {
            actions.push(...cardActions);
          }
        }
        if (actions.length === 0 && this.state.sevenRevealedCards.length > 0) {
          for (const card of this.state.sevenRevealedCards) {
            actions.push(`scrap_seven:${card.id}`);
          }
        }
        break;
      case "resolve_nine":
        break;
      case "royal_response":
        if (!this.state.pendingRoyal) return [];
        if (!this.state.pendingRoyal.respondersRemaining.includes(playerIndex)) return [];
        for (const card of player.hand) {
          if (card.rank === "9") {
            actions.push(`nine_response:${card.id}`);
          }
        }
        actions.push("pass");
        break;
    }
    return actions;
  }
  /**
   * Get valid actions for playing the 7's drawn card
   */
  getSevenPlayActions(playerIndex, card) {
    const actions = [];
    const opponent = this.state.players[1 - playerIndex];
    if (this.isJoker(card)) {
      const jokerTargets = this.getJokerTargets(playerIndex);
      if (this.config.variant === "team") {
        const numPlayers = this.state.players.length;
        for (const target of jokerTargets) {
          for (let destPlayer = 0; destPlayer < numPlayers; destPlayer++) {
            if (destPlayer !== target.owner) {
              actions.push(`seven_joker:${card.id}:${target.card.id}:${destPlayer}`);
            }
          }
        }
      } else {
        for (const target of jokerTargets) {
          actions.push(`seven_joker:${card.id}:${target.card.id}`);
        }
      }
      return actions;
    }
    if (isPointRank(card.rank)) {
      actions.push(`seven_point:${card.id}`);
    }
    switch (card.rank) {
      case "A":
        if (this.getAllPointCardsInPlay().length > 0) {
          actions.push(`seven_oneoff:${card.id}`);
        }
        break;
      case "2":
        for (const p of this.state.players) {
          for (const perm of p.permanents) {
            if (!this.isProtected(this.state.players.indexOf(p), perm.card.id)) {
              actions.push(`seven_oneoff:${card.id}:permanent:${perm.card.id}`);
            }
          }
        }
        for (const p of this.state.players) {
          for (const pc of p.pointCards) {
            for (const jack of pc.attachedJacks) {
              const jackController = this.getJackController(pc, jack);
              if (!this.isProtected(jackController, jack.id)) {
                actions.push(`seven_oneoff:${card.id}:permanent:${jack.id}`);
              }
            }
          }
        }
        break;
      case "3":
        if (this.state.scrap.length > 0) {
          actions.push(`seven_oneoff:${card.id}`);
        }
        break;
      case "4":
        if (opponent.hand.length > 0) {
          actions.push(`seven_oneoff:${card.id}`);
        }
        break;
      case "5":
        if (this.state.deck.length > 0) {
          actions.push(`seven_oneoff:${card.id}`);
        }
        break;
      case "6":
        if (this.getAllPermanentsInPlay().length > 0) {
          actions.push(`seven_oneoff:${card.id}`);
        }
        break;
      case "7":
        if (this.state.deck.length > 0) {
          actions.push(`seven_oneoff:${card.id}`);
        }
        break;
      case "9":
        for (const p of this.state.players) {
          const pIdx = this.state.players.indexOf(p);
          for (const perm of p.permanents) {
            if (!this.isProtected(pIdx, perm.card.id)) {
              actions.push(`seven_oneoff:${card.id}:card:${perm.card.id}`);
            }
          }
          for (const pc of p.pointCards) {
            for (const jack of pc.attachedJacks) {
              const jackController = this.getJackController(pc, jack);
              if (!this.isProtected(jackController, jack.id)) {
                actions.push(`seven_oneoff:${card.id}:card:${jack.id}`);
              }
            }
            if (this.config.variant !== "standard") {
              if (!this.isProtected(pc.controller, pc.card.id)) {
                actions.push(`seven_oneoff:${card.id}:card:${pc.card.id}`);
              }
            }
          }
        }
        break;
    }
    switch (card.rank) {
      case "8":
      case "Q":
      case "K":
        actions.push(`seven_permanent:${card.id}`);
        break;
      case "J":
        if (this.config.variant === "team") {
          const numPlayers = this.state.players.length;
          for (const p of this.state.players) {
            for (const pc of p.pointCards) {
              if (!this.isProtected(pc.controller, pc.card.id)) {
                for (let destPlayer = 0; destPlayer < numPlayers; destPlayer++) {
                  if (destPlayer !== pc.controller) {
                    actions.push(`seven_permanent:${card.id}:${pc.card.id}:${destPlayer}`);
                  }
                }
              }
            }
          }
        } else {
          for (const p of this.state.players) {
            for (const pc of p.pointCards) {
              if (!this.isProtected(pc.controller, pc.card.id)) {
                actions.push(`seven_permanent:${card.id}:${pc.card.id}`);
              }
            }
          }
        }
        break;
    }
    if (isPointRank(card.rank)) {
      for (const p of this.state.players) {
        for (const pc of p.pointCards) {
          if (pc.controller !== playerIndex && canScuttle(card, pc.card)) {
            actions.push(`seven_scuttle:${card.id}:${pc.card.id}`);
          }
        }
      }
    }
    return actions;
  }
  getAllPointCardsInPlay() {
    const result = [];
    for (const player of this.state.players) {
      result.push(...player.pointCards);
    }
    return result;
  }
  getAllPermanentsInPlay() {
    const result = [];
    for (const player of this.state.players) {
      result.push(...player.permanents);
    }
    for (const player of this.state.players) {
      for (const pc of player.pointCards) {
        for (const jack of pc.attachedJacks) {
          result.push({ card: jack, type: "joker" });
        }
      }
    }
    return result;
  }
  getJackController(pointCard, jack) {
    const jackIndex = pointCard.attachedJacks.indexOf(jack);
    const originalOwner = this.findCardOriginalOwner(pointCard.card.id);
    return (originalOwner + jackIndex + 1) % 2;
  }
  findCardOriginalOwner(cardId) {
    for (let i = 0; i < this.state.players.length; i++) {
      if (this.state.players[i].pointCards.some((pc) => pc.card.id === cardId)) {
        return i;
      }
    }
    return 0;
  }
  /**
   * Execute an action
   */
  action(playerIndex, actionStr) {
    const valid = this.getValidActions(playerIndex);
    if (!valid.includes(actionStr)) {
      return { success: false, message: `Invalid action: ${actionStr}` };
    }
    const parts = actionStr.split(":");
    const actionType = parts[0];
    let message = "";
    this.state.consecutivePasses = actionType === "pass" ? this.state.consecutivePasses + 1 : 0;
    switch (this.state.phase) {
      case "play":
        message = this.handlePlayPhase(playerIndex, actionType, parts);
        break;
      case "counter":
        message = this.handleCounterPhase(playerIndex, actionType, parts);
        break;
      case "resolve_three":
        message = this.handleResolveThree(playerIndex, parts);
        break;
      case "resolve_four":
        message = this.handleResolveFour(playerIndex, parts);
        break;
      case "resolve_five_discard":
        message = this.handleResolveFiveDiscard(playerIndex, parts);
        break;
      case "resolve_seven":
        message = this.handleResolveSeven(playerIndex, actionType, parts);
        break;
      case "resolve_seven_choose":
        message = this.handleResolveSevenChoose(playerIndex, actionType, parts);
        break;
      case "royal_response":
        message = this.handleRoyalResponse(playerIndex, actionType, parts);
        break;
    }
    this.state.lastAction = message;
    this.checkGameEnd();
    return { success: true, message };
  }
  handlePlayPhase(player, action, parts) {
    switch (action) {
      case "draw":
        const drawnCard = this.state.deck.pop();
        this.state.players[player].hand.push(drawnCard);
        this.advanceTurn();
        return `Player ${player} draws a card`;
      case "pass":
        if (this.state.consecutivePasses >= 3) {
          this.state.isDraw = true;
          this.state.phase = "complete";
          return "Game ends in a draw (3 consecutive passes)";
        }
        this.advanceTurn();
        return `Player ${player} passes`;
      case "point": {
        const cardId = parseInt(parts[1]);
        const card = this.removeCardFromHand(player, cardId);
        this.state.players[player].pointCards.push({
          card,
          attachedJacks: [],
          controller: player
        });
        this.advanceTurn();
        return `Player ${player} plays ${cardToString(card)} for ${getPointValue(card.rank)} points`;
      }
      case "oneoff": {
        const cardId = parseInt(parts[1]);
        const card = this.removeCardFromHand(player, cardId);
        let target;
        let targetPlayer;
        if (parts.length > 3 && parts[2] !== "target") {
          target = { cardId: parseInt(parts[3]), type: parts[2] };
        }
        if (parts.length > 2 && parts[2] === "target") {
          targetPlayer = parseInt(parts[3]);
        }
        this.state.pendingOneOff = {
          card,
          player,
          target,
          targetPlayer,
          counterChain: []
        };
        this.state.phase = "counter";
        return `Player ${player} plays ${cardToString(card)} as one-off`;
      }
      case "permanent": {
        const cardId = parseInt(parts[1]);
        const card = this.removeCardFromHand(player, cardId);
        if (card.rank === "J") {
          const targetId = parseInt(parts[2]);
          const targetPc = this.findPointCard(targetId);
          if (targetPc) {
            targetPc.attachedJacks.push(card);
            if (this.config.variant === "team" && parts.length > 3) {
              const destinationPlayer = parseInt(parts[3]);
              targetPc.controller = destinationPlayer;
              this.advanceTurn();
              return `Player ${player} plays ${cardToString(card)} to transfer point card to Player ${destinationPlayer}`;
            } else {
              targetPc.controller = player;
              this.advanceTurn();
              return `Player ${player} plays ${cardToString(card)} on point card`;
            }
          }
          this.advanceTurn();
          return `Player ${player} plays ${cardToString(card)} on point card`;
        } else {
          const type = card.rank === "8" ? "eight" : card.rank === "Q" ? "queen" : "king";
          if (this.config.variant === "team") {
            const opponents = this.getOpponents(player);
            const respondersWithNine = opponents.filter(
              (oppIdx) => this.state.players[oppIdx].hand.some((c) => c.rank === "9")
            );
            if (respondersWithNine.length > 0) {
              this.state.pendingRoyal = {
                card,
                player,
                type,
                respondersRemaining: respondersWithNine
              };
              this.state.phase = "royal_response";
              return `Player ${player} plays ${cardToString(card)} as Royal - opponents may respond`;
            }
          }
          this.state.players[player].permanents.push({ card, type });
          this.advanceTurn();
          return `Player ${player} plays ${cardToString(card)} as permanent`;
        }
      }
      case "scuttle": {
        const attackerId = parseInt(parts[1]);
        const targetId = parseInt(parts[2]);
        const attackerCard = this.removeCardFromHand(player, attackerId);
        const targetPc = this.findPointCard(targetId);
        if (targetPc) {
          this.removePointCard(targetId);
          this.state.scrap.push(attackerCard, targetPc.card, ...targetPc.attachedJacks);
        }
        this.advanceTurn();
        return `Player ${player} scuttles with ${cardToString(attackerCard)}`;
      }
      case "joker": {
        const jokerId = parseInt(parts[1]);
        const targetCardId = parseInt(parts[2]);
        const destinationPlayer = this.config.variant === "team" && parts.length > 3 ? parseInt(parts[3]) : player;
        const jokerCard = this.removeCardFromHand(player, jokerId);
        for (let i = 0; i < this.state.players.length; i++) {
          const permIndex = this.state.players[i].permanents.findIndex(
            (p) => p.card.id === targetCardId
          );
          if (permIndex >= 0) {
            const stolenPerm = this.state.players[i].permanents.splice(permIndex, 1)[0];
            this.state.players[destinationPlayer].permanents.push({
              card: stolenPerm.card,
              type: stolenPerm.type,
              stolenFromPlayer: i
            });
            this.state.scrap.push(jokerCard);
            this.advanceTurn();
            if (destinationPlayer === player) {
              return `Player ${player} uses Joker to steal ${cardToString(stolenPerm.card)} from Player ${i}`;
            } else {
              return `Player ${player} uses Joker to transfer ${cardToString(stolenPerm.card)} from Player ${i} to Player ${destinationPlayer}`;
            }
          }
          for (const pc of this.state.players[i].pointCards) {
            const jackIndex = pc.attachedJacks.findIndex((j) => j.id === targetCardId);
            if (jackIndex >= 0) {
              const stolenJack = pc.attachedJacks.splice(jackIndex, 1)[0];
              this.state.players[destinationPlayer].hand.push(stolenJack);
              const originalOwner = this.findCardOriginalOwner(pc.card.id);
              pc.controller = pc.attachedJacks.length % 2 === 0 ? originalOwner : (originalOwner + 1) % this.state.players.length;
              this.state.scrap.push(jokerCard);
              this.advanceTurn();
              if (destinationPlayer === player) {
                return `Player ${player} uses Joker to steal ${cardToString(stolenJack)} from Player ${i}`;
              } else {
                return `Player ${player} uses Joker to transfer ${cardToString(stolenJack)} from Player ${i} to Player ${destinationPlayer}`;
              }
            }
          }
        }
        this.advanceTurn();
        return `Player ${player} plays Joker (no valid target found)`;
      }
      default:
        return "Unknown action";
    }
  }
  handleCounterPhase(player, action, parts) {
    if (!this.state.pendingOneOff) return "No pending one-off";
    if (action === "pass") {
      if (this.state.pendingOneOff.counterChain.length % 2 === 0) {
        return this.resolveOneOff();
      } else {
        this.state.scrap.push(
          this.state.pendingOneOff.card,
          ...this.state.pendingOneOff.counterChain
        );
        this.state.pendingOneOff = null;
        this.state.phase = "play";
        this.advanceTurn();
        return "One-off was countered";
      }
    }
    if (action === "counter") {
      const cardId = parseInt(parts[1]);
      const card = this.removeCardFromHand(player, cardId);
      this.state.pendingOneOff.counterChain.push(card);
      return `Player ${player} counters with ${cardToString(card)}`;
    }
    return "Unknown counter action";
  }
  resolveOneOff() {
    const pending = this.state.pendingOneOff;
    const player = pending.player;
    const card = pending.card;
    this.state.scrap.push(card, ...pending.counterChain);
    let message = "";
    switch (card.rank) {
      case "A":
        for (const p of this.state.players) {
          for (const pc of p.pointCards) {
            this.state.scrap.push(pc.card, ...pc.attachedJacks);
          }
          p.pointCards = [];
        }
        message = "All point cards moved to scrap";
        this.state.phase = "play";
        this.advanceTurn();
        break;
      case "2":
        if (pending.target) {
          this.removePermanent(pending.target.cardId);
        }
        message = "Permanent destroyed";
        this.state.phase = "play";
        this.advanceTurn();
        break;
      case "3":
        this.state.phase = "resolve_three";
        message = "Choose a card from scrap";
        break;
      case "4": {
        const targetOpponentIndex = pending.targetPlayer !== void 0 ? pending.targetPlayer : 1 - player;
        const targetOpponent = this.state.players[targetOpponentIndex];
        this.state.discardCount = Math.min(2, targetOpponent.hand.length);
        this.state.discardingPlayer = targetOpponentIndex;
        if (this.state.discardCount > 0) {
          this.state.phase = "resolve_four";
          message = `Player ${targetOpponentIndex} must discard ${this.state.discardCount} cards`;
        } else {
          this.state.phase = "play";
          this.state.discardingPlayer = null;
          this.advanceTurn();
          message = `Player ${targetOpponentIndex} has no cards to discard`;
        }
        break;
      }
      case "5":
        if (this.config.variant !== "classic") {
          const playerHand = this.state.players[player].hand;
          if (playerHand.length === 0) {
            const toDraw = Math.min(3, this.state.deck.length);
            for (let i = 0; i < toDraw; i++) {
              this.state.players[player].hand.push(this.state.deck.pop());
            }
            message = `Player ${player} draws ${toDraw} cards`;
            this.state.phase = "play";
            this.advanceTurn();
          } else {
            this.state.fiveDiscardPending = true;
            this.state.phase = "resolve_five_discard";
            message = `Player ${player} must discard a card, then draws 3`;
          }
        } else {
          const toDraw = Math.min(2, this.state.deck.length);
          for (let i = 0; i < toDraw; i++) {
            this.state.players[player].hand.push(this.state.deck.pop());
          }
          message = `Player ${player} draws ${toDraw} cards`;
          this.state.phase = "play";
          this.advanceTurn();
        }
        break;
      case "6":
        for (const p of this.state.players) {
          for (const perm of p.permanents) {
            this.state.scrap.push(perm.card);
          }
          p.permanents = [];
          for (const pc of p.pointCards) {
            this.state.scrap.push(...pc.attachedJacks);
            pc.attachedJacks = [];
            pc.controller = this.state.players.indexOf(p);
          }
        }
        message = "All permanents moved to scrap";
        this.state.phase = "play";
        this.advanceTurn();
        break;
      case "7":
        if (this.config.variant !== "classic") {
          if (this.state.deck.length >= 2) {
            const card1 = this.state.deck.pop();
            const card2 = this.state.deck.pop();
            this.state.sevenRevealedCards = [card1, card2];
            this.state.phase = "resolve_seven_choose";
            this.state.currentPlayer = player;
            message = `Player ${player} reveals ${cardToString(card1)} and ${cardToString(card2)} - choose one to play`;
          } else if (this.state.deck.length === 1) {
            const drawnCard = this.state.deck.pop();
            this.state.sevenDrawnCard = drawnCard;
            this.state.phase = "resolve_seven";
            this.state.currentPlayer = player;
            message = `Player ${player} draws ${cardToString(drawnCard)} and must play it`;
          } else {
            this.state.phase = "play";
            this.advanceTurn();
            message = "Deck is empty";
          }
        } else {
          if (this.state.deck.length > 0) {
            const drawnCard = this.state.deck.pop();
            this.state.sevenDrawnCard = drawnCard;
            this.state.phase = "resolve_seven";
            this.state.currentPlayer = player;
            message = `Player ${player} draws ${cardToString(drawnCard)} and must play it`;
          } else {
            this.state.phase = "play";
            this.advanceTurn();
            message = "Deck is empty";
          }
        }
        break;
      case "9": {
        if (pending.target) {
          const targetCardId = pending.target.cardId;
          let targetOwner = null;
          for (let i = 0; i < this.state.players.length; i++) {
            const p = this.state.players[i];
            if (p.permanents.some((perm) => perm.card.id === targetCardId)) {
              targetOwner = i;
              break;
            }
            for (const pc of p.pointCards) {
              if (pc.card.id === targetCardId || pc.attachedJacks.some((j) => j.id === targetCardId)) {
                targetOwner = i;
                break;
              }
            }
            if (targetOwner !== null) break;
          }
          this.returnCardToHand(targetCardId);
          if (this.config.variant !== "classic") {
            this.state.frozenCardIds.push(targetCardId);
          }
          if (this.config.variant === "cutthroat" && targetOwner !== null && targetOwner !== player) {
            if (!this.state.skipTurnPlayers.includes(targetOwner)) {
              this.state.skipTurnPlayers.push(targetOwner);
            }
          }
        }
        if (this.config.variant === "cutthroat") {
          message = "Permanent returned to hand (frozen + owner skips next turn)";
        } else if (this.config.variant === "standard") {
          message = "Permanent returned to hand (frozen until next turn)";
        } else {
          message = "Card returned to hand";
        }
        this.state.phase = "play";
        this.advanceTurn();
        break;
      }
    }
    this.state.pendingOneOff = null;
    return message;
  }
  handleResolveThree(player, parts) {
    const cardId = parseInt(parts[1]);
    const cardIndex = this.state.scrap.findIndex((c) => c.id === cardId);
    if (cardIndex >= 0) {
      const card = this.state.scrap.splice(cardIndex, 1)[0];
      this.state.players[player].hand.push(card);
    }
    this.state.phase = "play";
    this.advanceTurn();
    return `Player ${player} retrieves card from scrap`;
  }
  handleResolveFour(player, parts) {
    const cardId = parseInt(parts[1]);
    const card = this.removeCardFromHand(player, cardId);
    this.state.scrap.push(card);
    this.state.discardCount--;
    if (this.state.discardCount === 0 || this.state.players[player].hand.length === 0) {
      this.state.phase = "play";
      this.state.discardingPlayer = null;
      this.advanceTurn();
      return `Player ${player} finishes discarding`;
    }
    return `Player ${player} discards ${cardToString(card)}`;
  }
  handleResolveFiveDiscard(player, parts) {
    const cardId = parseInt(parts[1]);
    const card = this.removeCardFromHand(player, cardId);
    this.state.scrap.push(card);
    let drawn = 0;
    const maxDraw = Math.min(3, this.state.deck.length);
    for (let i = 0; i < maxDraw; i++) {
      if (this.state.players[player].hand.length < this.config.handLimit) {
        this.state.players[player].hand.push(this.state.deck.pop());
        drawn++;
      }
    }
    this.state.fiveDiscardPending = false;
    this.state.phase = "play";
    this.advanceTurn();
    return `Player ${player} discards ${cardToString(card)}, draws ${drawn} cards`;
  }
  handleResolveSeven(player, action, parts) {
    const card = this.state.sevenDrawnCard;
    this.state.sevenDrawnCard = null;
    if (action === "scrap_seven") {
      this.state.scrap.push(card);
      this.state.phase = "play";
      this.advanceTurn();
      return `Card scrapped (could not be played)`;
    }
    const playType = action.replace("seven_", "");
    switch (playType) {
      case "point":
        this.state.players[player].pointCards.push({
          card,
          attachedJacks: [],
          controller: player
        });
        break;
      case "oneoff": {
        const target = parts.length > 3 ? { cardId: parseInt(parts[3]), type: parts[2] } : void 0;
        this.state.pendingOneOff = {
          card,
          player,
          target,
          counterChain: []
        };
        this.state.phase = "counter";
        return `Player ${player} plays ${cardToString(card)} as one-off from 7`;
      }
      case "permanent": {
        if (card.rank === "J") {
          const targetId = parseInt(parts[2]);
          const targetPc = this.findPointCard(targetId);
          if (targetPc) {
            targetPc.attachedJacks.push(card);
            if (this.config.variant === "team" && parts.length > 3) {
              targetPc.controller = parseInt(parts[3]);
            } else {
              targetPc.controller = player;
            }
          }
        } else {
          const type = card.rank === "8" ? "eight" : card.rank === "Q" ? "queen" : "king";
          this.state.players[player].permanents.push({ card, type });
        }
        break;
      }
      case "scuttle": {
        const targetId = parseInt(parts[2]);
        const targetPc = this.findPointCard(targetId);
        if (targetPc) {
          this.removePointCard(targetId);
          this.state.scrap.push(card, targetPc.card, ...targetPc.attachedJacks);
        }
        break;
      }
      case "joker": {
        const targetCardId = parseInt(parts[2]);
        const destinationPlayer = this.config.variant === "team" && parts.length > 3 ? parseInt(parts[3]) : player;
        for (let i = 0; i < this.state.players.length; i++) {
          const permIndex = this.state.players[i].permanents.findIndex(
            (p) => p.card.id === targetCardId
          );
          if (permIndex >= 0) {
            const stolenPerm = this.state.players[i].permanents.splice(permIndex, 1)[0];
            this.state.players[destinationPlayer].permanents.push({
              card: stolenPerm.card,
              type: stolenPerm.type,
              stolenFromPlayer: i
            });
            this.state.scrap.push(card);
            this.state.phase = "play";
            this.advanceTurn();
            if (destinationPlayer === player) {
              return `Player ${player} uses Joker from 7 to steal ${cardToString(stolenPerm.card)} from Player ${i}`;
            } else {
              return `Player ${player} uses Joker from 7 to transfer ${cardToString(stolenPerm.card)} from Player ${i} to Player ${destinationPlayer}`;
            }
          }
          for (const pc of this.state.players[i].pointCards) {
            const jackIndex = pc.attachedJacks.findIndex((j) => j.id === targetCardId);
            if (jackIndex >= 0) {
              const stolenJack = pc.attachedJacks.splice(jackIndex, 1)[0];
              this.state.players[destinationPlayer].hand.push(stolenJack);
              const originalOwner = this.findCardOriginalOwner(pc.card.id);
              pc.controller = pc.attachedJacks.length % 2 === 0 ? originalOwner : (originalOwner + 1) % this.state.players.length;
              this.state.scrap.push(card);
              this.state.phase = "play";
              this.advanceTurn();
              if (destinationPlayer === player) {
                return `Player ${player} uses Joker from 7 to steal ${cardToString(stolenJack)} from Player ${i}`;
              } else {
                return `Player ${player} uses Joker from 7 to transfer ${cardToString(stolenJack)} from Player ${i} to Player ${destinationPlayer}`;
              }
            }
          }
        }
        this.state.scrap.push(card);
        break;
      }
    }
    this.state.phase = "play";
    this.advanceTurn();
    return `Player ${player} plays ${cardToString(card)} from 7`;
  }
  handleResolveSevenChoose(player, action, parts) {
    if (!this.state.sevenRevealedCards || this.state.sevenRevealedCards.length === 0) {
      return "No cards to choose from";
    }
    if (action === "scrap_seven") {
      const cardId2 = parseInt(parts[1]);
      const cardIndex = this.state.sevenRevealedCards.findIndex((c) => c.id === cardId2);
      if (cardIndex >= 0) {
        const scrappedCard = this.state.sevenRevealedCards.splice(cardIndex, 1)[0];
        this.state.scrap.push(scrappedCard);
        if (this.state.sevenRevealedCards.length > 0) {
          this.state.deck.push(this.state.sevenRevealedCards[0]);
        }
      }
      this.state.sevenRevealedCards = null;
      this.state.phase = "play";
      this.advanceTurn();
      return "Card scrapped (could not be played)";
    }
    const playType = action.replace("seven_", "");
    const cardId = parseInt(parts[1]);
    const chosenIndex = this.state.sevenRevealedCards.findIndex((c) => c.id === cardId);
    if (chosenIndex < 0) {
      return "Invalid card choice";
    }
    const chosenCard = this.state.sevenRevealedCards[chosenIndex];
    const otherCard = this.state.sevenRevealedCards[1 - chosenIndex];
    if (otherCard) {
      this.state.deck.push(otherCard);
    }
    this.state.sevenRevealedCards = null;
    switch (playType) {
      case "point":
        this.state.players[player].pointCards.push({
          card: chosenCard,
          attachedJacks: [],
          controller: player
        });
        break;
      case "oneoff": {
        const target = parts.length > 3 ? { cardId: parseInt(parts[3]), type: parts[2] } : void 0;
        this.state.pendingOneOff = {
          card: chosenCard,
          player,
          target,
          counterChain: []
        };
        this.state.phase = "counter";
        return `Player ${player} plays ${cardToString(chosenCard)} as one-off from 7`;
      }
      case "permanent": {
        if (chosenCard.rank === "J") {
          const targetId = parseInt(parts[2]);
          const targetPc = this.findPointCard(targetId);
          if (targetPc) {
            targetPc.attachedJacks.push(chosenCard);
            if (this.config.variant === "team" && parts.length > 3) {
              targetPc.controller = parseInt(parts[3]);
            } else {
              targetPc.controller = player;
            }
          }
        } else {
          const type = chosenCard.rank === "8" ? "eight" : chosenCard.rank === "Q" ? "queen" : "king";
          this.state.players[player].permanents.push({ card: chosenCard, type });
        }
        break;
      }
      case "scuttle": {
        const targetId = parseInt(parts[2]);
        const targetPc = this.findPointCard(targetId);
        if (targetPc) {
          this.removePointCard(targetId);
          this.state.scrap.push(chosenCard, targetPc.card, ...targetPc.attachedJacks);
        }
        break;
      }
      case "joker": {
        const targetCardId = parseInt(parts[2]);
        const destinationPlayer = this.config.variant === "team" && parts.length > 3 ? parseInt(parts[3]) : player;
        for (let i = 0; i < this.state.players.length; i++) {
          const permIndex = this.state.players[i].permanents.findIndex(
            (p) => p.card.id === targetCardId
          );
          if (permIndex >= 0) {
            const stolenPerm = this.state.players[i].permanents.splice(permIndex, 1)[0];
            this.state.players[destinationPlayer].permanents.push({
              card: stolenPerm.card,
              type: stolenPerm.type,
              stolenFromPlayer: i
            });
            this.state.scrap.push(chosenCard);
            this.state.phase = "play";
            this.advanceTurn();
            if (destinationPlayer === player) {
              return `Player ${player} uses Joker from 7 to steal ${cardToString(stolenPerm.card)} from Player ${i}`;
            } else {
              return `Player ${player} uses Joker from 7 to transfer ${cardToString(stolenPerm.card)} from Player ${i} to Player ${destinationPlayer}`;
            }
          }
          for (const pc of this.state.players[i].pointCards) {
            const jackIndex = pc.attachedJacks.findIndex((j) => j.id === targetCardId);
            if (jackIndex >= 0) {
              const stolenJack = pc.attachedJacks.splice(jackIndex, 1)[0];
              this.state.players[destinationPlayer].hand.push(stolenJack);
              const originalOwner = this.findCardOriginalOwner(pc.card.id);
              pc.controller = pc.attachedJacks.length % 2 === 0 ? originalOwner : (originalOwner + 1) % this.state.players.length;
              this.state.scrap.push(chosenCard);
              this.state.phase = "play";
              this.advanceTurn();
              if (destinationPlayer === player) {
                return `Player ${player} uses Joker from 7 to steal ${cardToString(stolenJack)} from Player ${i}`;
              } else {
                return `Player ${player} uses Joker from 7 to transfer ${cardToString(stolenJack)} from Player ${i} to Player ${destinationPlayer}`;
              }
            }
          }
        }
        this.state.scrap.push(chosenCard);
        break;
      }
    }
    this.state.phase = "play";
    this.advanceTurn();
    return `Player ${player} plays ${cardToString(chosenCard)} from 7`;
  }
  /**
   * Handle Nine response to Royal in Team variant
   * Players can play Nine to bounce the Royal back to owner's hand (not frozen)
   * Or pass to decline responding
   */
  handleRoyalResponse(player, action, parts) {
    if (!this.state.pendingRoyal) return "No pending Royal";
    const pending = this.state.pendingRoyal;
    if (action === "nine_response") {
      const nineId = parseInt(parts[1]);
      const nineCard = this.removeCardFromHand(player, nineId);
      this.state.scrap.push(nineCard);
      this.state.players[pending.player].hand.push(pending.card);
      this.state.pendingRoyal = null;
      this.state.phase = "play";
      this.advanceTurn();
      return `Player ${player} responds with ${cardToString(nineCard)} - Royal returned to Player ${pending.player}'s hand`;
    }
    if (action === "pass") {
      this.state.pendingRoyal.respondersRemaining = pending.respondersRemaining.filter(
        (p) => p !== player
      );
      if (this.state.pendingRoyal.respondersRemaining.length === 0) {
        this.state.players[pending.player].permanents.push({
          card: pending.card,
          type: pending.type
        });
        this.state.pendingRoyal = null;
        this.state.phase = "play";
        this.advanceTurn();
        return `No response - ${cardToString(pending.card)} takes effect`;
      }
      return `Player ${player} passes on responding to Royal`;
    }
    return "Unknown royal response action";
  }
  removeCardFromHand(player, cardId) {
    const hand = this.state.players[player].hand;
    const index = hand.findIndex((c) => c.id === cardId);
    if (index >= 0) {
      return hand.splice(index, 1)[0];
    }
    return void 0;
  }
  findPointCard(cardId) {
    for (const player of this.state.players) {
      for (const pc of player.pointCards) {
        if (pc.card.id === cardId) return pc;
      }
    }
    return void 0;
  }
  /**
   * Find the owner of a card (permanent, point card, or attached jack)
   * Returns player index or -1 if not found
   */
  findCardOwner(cardId) {
    for (let i = 0; i < this.state.players.length; i++) {
      const player = this.state.players[i];
      for (const perm of player.permanents) {
        if (perm.card.id === cardId) return i;
      }
      for (const pc of player.pointCards) {
        if (pc.card.id === cardId) return i;
        for (const jack of pc.attachedJacks) {
          if (jack.id === cardId) {
            return pc.controller;
          }
        }
      }
    }
    return -1;
  }
  removePointCard(cardId) {
    for (const player of this.state.players) {
      const index = player.pointCards.findIndex((pc) => pc.card.id === cardId);
      if (index >= 0) {
        player.pointCards.splice(index, 1);
        return;
      }
    }
  }
  removePermanent(cardId) {
    for (const player of this.state.players) {
      const index = player.permanents.findIndex((p) => p.card.id === cardId);
      if (index >= 0) {
        const perm = player.permanents.splice(index, 1)[0];
        this.state.scrap.push(perm.card);
        return;
      }
    }
    for (const player of this.state.players) {
      for (const pc of player.pointCards) {
        const jackIndex = pc.attachedJacks.findIndex((j) => j.id === cardId);
        if (jackIndex >= 0) {
          const jack = pc.attachedJacks.splice(jackIndex, 1)[0];
          this.state.scrap.push(jack);
          const originalOwner = this.state.players.indexOf(player);
          pc.controller = pc.attachedJacks.length % 2 === 0 ? originalOwner : 1 - originalOwner;
          return;
        }
      }
    }
  }
  returnCardToHand(cardId) {
    for (let i = 0; i < this.state.players.length; i++) {
      const player = this.state.players[i];
      const permIndex = player.permanents.findIndex((p) => p.card.id === cardId);
      if (permIndex >= 0) {
        const perm = player.permanents.splice(permIndex, 1)[0];
        player.hand.push(perm.card);
        return;
      }
    }
    for (let i = 0; i < this.state.players.length; i++) {
      const player = this.state.players[i];
      const pcIndex = player.pointCards.findIndex((pc) => pc.card.id === cardId);
      if (pcIndex >= 0) {
        const pc = player.pointCards.splice(pcIndex, 1)[0];
        player.hand.push(pc.card);
        this.state.scrap.push(...pc.attachedJacks);
        return;
      }
    }
    for (const player of this.state.players) {
      for (const pc of player.pointCards) {
        const jackIndex = pc.attachedJacks.findIndex((j) => j.id === cardId);
        if (jackIndex >= 0) {
          const jack = pc.attachedJacks.splice(jackIndex, 1)[0];
          const jackController = (this.state.players.indexOf(player) + jackIndex + 1) % 2;
          this.state.players[jackController].hand.push(jack);
          const originalOwner = this.state.players.indexOf(player);
          pc.controller = pc.attachedJacks.length % 2 === 0 ? originalOwner : 1 - originalOwner;
          return;
        }
      }
    }
  }
  advanceTurn() {
    this.state.turnNumber++;
    const numPlayers = this.state.players.length;
    let nextPlayer = (this.state.currentPlayer + 1) % numPlayers;
    let skipsChecked = 0;
    while (this.state.skipTurnPlayers.includes(nextPlayer) && skipsChecked < numPlayers) {
      this.state.skipTurnPlayers = this.state.skipTurnPlayers.filter((p) => p !== nextPlayer);
      nextPlayer = (nextPlayer + 1) % numPlayers;
      skipsChecked++;
    }
    this.state.currentPlayer = nextPlayer;
    this.state.discardingPlayer = null;
    if (this.config.variant !== "classic" && this.state.frozenCardIds.length > 0) {
      const currentPlayer = this.state.currentPlayer;
      const currentPlayerHand = this.state.players[currentPlayer].hand;
      const currentPlayerCardIds = new Set(currentPlayerHand.map((c) => c.id));
      this.state.frozenCardIds = this.state.frozenCardIds.filter(
        (id) => !currentPlayerCardIds.has(id)
      );
    }
  }
  checkGameEnd() {
    if (this.state.phase === "complete") return;
    const numPlayers = this.state.players.length;
    const passesNeeded = numPlayers === 2 ? 3 : numPlayers;
    if (this.state.consecutivePasses >= passesNeeded) {
      this.state.isDraw = true;
      this.state.phase = "complete";
      return;
    }
    for (let i = 0; i < numPlayers; i++) {
      const points = this.getPoints(i);
      const goal = this.getPointGoal(i);
      if (goal === 0) {
        this.state.winner = i;
        this.state.phase = "complete";
        return;
      }
      if (points >= goal) {
        this.state.winner = i;
        this.state.phase = "complete";
        return;
      }
    }
  }
  /**
   * Get the winning team (0 or 1) if the game is over, or null if not a team game
   */
  getWinningTeam() {
    if (this.config.variant !== "team") return null;
    if (this.state.winner === null) return null;
    return this.getTeam(this.state.winner);
  }
  render() {
    console.log("\n" + "=".repeat(60));
    console.log(`CUTTLE (${this.config.variant})`);
    console.log("=".repeat(60));
    console.log(`Turn: ${this.state.turnNumber} | Phase: ${this.state.phase}`);
    console.log(`Current player: ${this.state.currentPlayer}`);
    console.log(`Deck: ${this.state.deck.length} cards | Scrap: ${this.state.scrap.length} cards`);
    for (let i = 0; i < this.state.players.length; i++) {
      const p = this.state.players[i];
      const marker = i === this.state.currentPlayer ? "-> " : "   ";
      const points = this.getPoints(i);
      const goal = this.getPointGoal(i);
      const skipMarker = this.state.skipTurnPlayers.includes(i) ? " [SKIP]" : "";
      console.log(`
${marker}Player ${i}: ${points}/${goal} points${skipMarker}`);
      console.log(`   Hand (${p.hand.length}): ${p.hand.map((c) => c.isJoker ? "\u{1F0CF}" : cardToString(c)).join(" ")}`);
      console.log(
        `   Points: ${p.pointCards.filter((pc) => pc.controller === i).map((pc) => cardToString(pc.card) + (pc.attachedJacks.length > 0 ? `(J\xD7${pc.attachedJacks.length})` : "")).join(" ")}`
      );
      console.log(`   Permanents: ${p.permanents.map((pm) => pm.card.isJoker ? "\u{1F0CF}" : cardToString(pm.card)).join(" ")}`);
    }
    if (this.state.lastAction) {
      console.log(`
Last: ${this.state.lastAction}`);
    }
    if (this.state.winner !== null) {
      console.log(`
*** PLAYER ${this.state.winner} WINS ***`);
    }
    if (this.state.isDraw) {
      console.log(`
*** GAME IS A DRAW ***`);
    }
  }
};
function getMaxActionSpaceSize() {
  return 500;
}
export {
  CuttleGame,
  RANKS,
  SUITS,
  getMaxActionSpaceSize
};
