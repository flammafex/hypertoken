/*
 * Copyright 2025 The Carpocratian Church of Commonality and Equality, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Classic Prisoner's Dilemma Strategies
 * 
 * Collection of well-known strategies from game theory literature
 */

import { COOPERATE, DEFECT } from './prisoners-dilemma.js';

/**
 * ALWAYS COOPERATE
 * The altruist - always cooperates regardless of opponent's behavior
 */
export function alwaysCooperate() {
  return COOPERATE;
}

/**
 * ALWAYS DEFECT
 * The pure defector - always defects regardless of opponent's behavior
 */
export function alwaysDefect() {
  return DEFECT;
}

/**
 * RANDOM
 * Chooses randomly with 50/50 probability
 */
export function random() {
  return Math.random() < 0.5 ? COOPERATE : DEFECT;
}

/**
 * TIT FOR TAT
 * Classic winning strategy - cooperate first, then copy opponent's last move
 * Winner of Axelrod's first tournament
 */
export function titForTat(ownHistory, opponentHistory) {
  if (opponentHistory.length === 0) {
    return COOPERATE; // Start with cooperation
  }
  return opponentHistory[opponentHistory.length - 1]; // Copy last move
}

/**
 * TIT FOR TWO TATS
 * More forgiving than Tit for Tat - only retaliates after two defections
 */
export function titForTwoTats(ownHistory, opponentHistory) {
  if (opponentHistory.length < 2) {
    return COOPERATE;
  }
  
  const last = opponentHistory[opponentHistory.length - 1];
  const secondLast = opponentHistory[opponentHistory.length - 2];
  
  if (last === DEFECT && secondLast === DEFECT) {
    return DEFECT;
  }
  
  return COOPERATE;
}

/**
 * GENEROUS TIT FOR TAT
 * Like Tit for Tat but occasionally forgives defections (10% chance)
 */
export function generousTitForTat(ownHistory, opponentHistory) {
  if (opponentHistory.length === 0) {
    return COOPERATE;
  }
  
  const lastOpponentMove = opponentHistory[opponentHistory.length - 1];
  
  if (lastOpponentMove === DEFECT) {
    // 10% chance to forgive
    if (Math.random() < 0.1) {
      return COOPERATE;
    }
  }
  
  return lastOpponentMove;
}

/**
 * GRUDGER (Grim Trigger)
 * Cooperates until opponent defects once, then defects forever
 */
export function grudger(ownHistory, opponentHistory) {
  if (opponentHistory.includes(DEFECT)) {
    return DEFECT; // Never forgive
  }
  return COOPERATE;
}

/**
 * PAVLOV (Win-Stay, Lose-Shift)
 * Repeats if got good payoff (3 or 5), switches if got bad payoff (0 or 1)
 */
export function pavlov(ownHistory, opponentHistory) {
  if (ownHistory.length === 0) {
    return COOPERATE;
  }
  
  const lastOwn = ownHistory[ownHistory.length - 1];
  const lastOpp = opponentHistory[opponentHistory.length - 1];
  
  // Calculate last payoff
  const key = lastOwn + lastOpp;
  const payoffs = {
    CC: 3, CD: 0, DC: 5, DD: 1
  };
  const lastPayoff = payoffs[key];
  
  // Win-Stay: if payoff was good (3 or 5), repeat
  if (lastPayoff === 3 || lastPayoff === 5) {
    return lastOwn;
  }
  
  // Lose-Shift: if payoff was bad (0 or 1), switch
  return lastOwn === COOPERATE ? DEFECT : COOPERATE;
}

/**
 * SUSPICIOUS TIT FOR TAT
 * Like Tit for Tat but starts with defection
 */
export function suspiciousTitForTat(ownHistory, opponentHistory) {
  if (opponentHistory.length === 0) {
    return DEFECT; // Start with defection
  }
  return opponentHistory[opponentHistory.length - 1];
}

/**
 * ADAPTIVE
 * Tracks opponent's cooperation rate and matches it
 */
export function adaptive(ownHistory, opponentHistory) {
  if (opponentHistory.length < 5) {
    return COOPERATE; // Start cooperatively
  }
  
  // Calculate opponent's recent cooperation rate (last 10 moves)
  const recent = opponentHistory.slice(-10);
  const coopRate = recent.filter(m => m === COOPERATE).length / recent.length;
  
  // Match opponent's cooperation rate
  return Math.random() < coopRate ? COOPERATE : DEFECT;
}

/**
 * GRADUAL
 * Punishes defection with increasing retaliation, then forgives
 */
export function gradual(ownHistory, opponentHistory) {
  // Count how many times opponent has defected
  const defections = opponentHistory.filter(m => m === DEFECT).length;
  
  if (defections === 0) {
    return COOPERATE;
  }
  
  // Check if we're in punishment phase
  const totalRounds = ownHistory.length;
  let punishmentRounds = 0;
  
  // Count consecutive defections we've made recently
  for (let i = ownHistory.length - 1; i >= 0; i--) {
    if (ownHistory[i] === DEFECT) {
      punishmentRounds++;
    } else {
      break;
    }
  }
  
  // Punish with N defections for Nth opponent defection
  if (punishmentRounds < defections) {
    return DEFECT;
  }
  
  // After punishment, forgive with 2 cooperations
  const forgivenessRounds = 2;
  const cooperationsSinceDefection = ownHistory.slice(-forgivenessRounds)
    .filter(m => m === COOPERATE).length;
  
  if (cooperationsSinceDefection < forgivenessRounds) {
    return COOPERATE;
  }
  
  // Check if opponent defected again
  if (opponentHistory[opponentHistory.length - 1] === DEFECT) {
    return DEFECT;
  }
  
  return COOPERATE;
}

/**
 * PROBER
 * Tests opponent with initial sequence, then plays Tit for Tat
 */
export function prober(ownHistory, opponentHistory) {
  // Initial probe: D, C, C
  if (ownHistory.length === 0) return DEFECT;
  if (ownHistory.length === 1) return COOPERATE;
  if (ownHistory.length === 2) return COOPERATE;
  
  // If opponent cooperated on rounds 2 and 3, always defect
  if (opponentHistory[1] === COOPERATE && opponentHistory[2] === COOPERATE) {
    return DEFECT;
  }
  
  // Otherwise play Tit for Tat
  return opponentHistory[opponentHistory.length - 1];
}

/**
 * SOFT MAJORITY
 * Cooperates if opponent has cooperated more than defected
 */
export function softMajority(ownHistory, opponentHistory) {
  if (opponentHistory.length === 0) {
    return COOPERATE;
  }
  
  const cooperations = opponentHistory.filter(m => m === COOPERATE).length;
  const defections = opponentHistory.filter(m => m === DEFECT).length;
  
  return cooperations >= defections ? COOPERATE : DEFECT;
}

/**
 * HARD MAJORITY
 * Cooperates only if opponent has cooperated strictly more than defected
 */
export function hardMajority(ownHistory, opponentHistory) {
  if (opponentHistory.length === 0) {
    return COOPERATE;
  }
  
  const cooperations = opponentHistory.filter(m => m === COOPERATE).length;
  const defections = opponentHistory.filter(m => m === DEFECT).length;
  
  return cooperations > defections ? COOPERATE : DEFECT;
}

/**
 * Strategy registry for easy access
 */
export const STRATEGIES = {
  alwaysCooperate: {
    name: 'Always Cooperate',
    fn: alwaysCooperate,
    description: 'Always cooperates, regardless of opponent'
  },
  alwaysDefect: {
    name: 'Always Defect',
    fn: alwaysDefect,
    description: 'Always defects, regardless of opponent'
  },
  random: {
    name: 'Random',
    fn: random,
    description: 'Chooses randomly with 50/50 probability'
  },
  titForTat: {
    name: 'Tit for Tat',
    fn: titForTat,
    description: 'Cooperate first, then copy opponent\'s last move'
  },
  titForTwoTats: {
    name: 'Tit for Two Tats',
    fn: titForTwoTats,
    description: 'Only retaliates after two consecutive defections'
  },
  generousTitForTat: {
    name: 'Generous Tit for Tat',
    fn: generousTitForTat,
    description: 'Like Tit for Tat but occasionally forgives (10%)'
  },
  grudger: {
    name: 'Grudger',
    fn: grudger,
    description: 'Cooperates until defected against, then defects forever'
  },
  pavlov: {
    name: 'Pavlov',
    fn: pavlov,
    description: 'Win-stay, lose-shift strategy'
  },
  suspiciousTitForTat: {
    name: 'Suspicious Tit for Tat',
    fn: suspiciousTitForTat,
    description: 'Like Tit for Tat but starts with defection'
  },
  adaptive: {
    name: 'Adaptive',
    fn: adaptive,
    description: 'Matches opponent\'s cooperation rate'
  },
  gradual: {
    name: 'Gradual',
    fn: gradual,
    description: 'Escalating punishment followed by forgiveness'
  },
  prober: {
    name: 'Prober',
    fn: prober,
    description: 'Tests opponent, exploits if weak, otherwise Tit for Tat'
  },
  softMajority: {
    name: 'Soft Majority',
    fn: softMajority,
    description: 'Cooperates if opponent cooperated at least half the time'
  },
  hardMajority: {
    name: 'Hard Majority',
    fn: hardMajority,
    description: 'Cooperates only if opponent cooperated majority of time'
  }
};

/**
 * Get strategy by name
 */
export function getStrategy(name) {
  return STRATEGIES[name]?.fn;
}

/**
 * List all available strategies
 */
export function listStrategies() {
  return Object.entries(STRATEGIES).map(([key, data]) => ({
    key,
    name: data.name,
    description: data.description
  }));
}

export default {
  alwaysCooperate,
  alwaysDefect,
  random,
  titForTat,
  titForTwoTats,
  generousTitForTat,
  grudger,
  pavlov,
  suspiciousTitForTat,
  adaptive,
  gradual,
  prober,
  softMajority,
  hardMajority,
  STRATEGIES,
  getStrategy,
  listStrategies
};