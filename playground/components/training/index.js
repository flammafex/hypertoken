/**
 * training/index.js
 *
 * Entry point for AI Training Dashboard components.
 */

export { DashboardWrapper } from './DashboardWrapper.js';
export { UniversalDashboard } from './UniversalDashboard.js';
export { BlackjackDashboard } from './BlackjackDashboard.js';
export { PrisonersDashboard } from './PrisonersDashboard.js';
export { CuttleDashboard } from './CuttleDashboard.js';
export { PokerDashboard } from './PokerDashboard.js';
export { CoupDashboard } from './CoupDashboard.js';
export { HanabiDashboard } from './HanabiDashboard.js';
export { LiarsDiceDashboard } from './LiarsDiceDashboard.js';

export { TrainingSession } from '../../training/TrainingSession.js';

import { h, render } from 'https://esm.sh/preact@10.19.3';
import htm from 'https://esm.sh/htm@3.1.1';

import { UniversalDashboard } from './UniversalDashboard.js';
import { BlackjackDashboard } from './BlackjackDashboard.js';
import { PrisonersDashboard } from './PrisonersDashboard.js';
import { CuttleDashboard } from './CuttleDashboard.js';
import { PokerDashboard } from './PokerDashboard.js';
import { CoupDashboard } from './CoupDashboard.js';
import { HanabiDashboard } from './HanabiDashboard.js';
import { LiarsDiceDashboard } from './LiarsDiceDashboard.js';

const html = htm.bind(h);

/**
 * Factory to get the appropriate dashboard component for a game
 */
export function getDashboardComponent(gameType) {
  switch (gameType) {
    case 'blackjack':
      return BlackjackDashboard;
    case 'prisoners':
      return PrisonersDashboard;
    case 'cuttle':
      return CuttleDashboard;
    case 'poker':
      return PokerDashboard;
    case 'coup':
      return CoupDashboard;
    case 'hanabi':
      return HanabiDashboard;
    case 'liars-dice':
      return LiarsDiceDashboard;
    default:
      return UniversalDashboard;
  }
}

/**
 * Initialize the Training Dashboard in a container
 */
export function initTrainingDashboard(container, props = {}) {
  const Dashboard = getDashboardComponent(props.gameType);

  render(
    html`<${Dashboard} ...${props} />`,
    container
  );

  return () => {
    render(null, container);
  };
}
