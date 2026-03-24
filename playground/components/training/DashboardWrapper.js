/**
 * DashboardWrapper.js
 *
 * A base component that provides the common frame and logic for AI Training Dashboards.
 */

import { h } from 'https://esm.sh/preact@10.19.3';
import { useState, useEffect, useCallback, useMemo, useRef } from 'https://esm.sh/preact@10.19.3/hooks';
import htm from 'https://esm.sh/htm@3.1.1';

import { TrainingSession } from '../../training/TrainingSession.js';
import { ProgressBar } from './BaseComponents.js';
import { ConfigModal, EpisodeDetailModal } from './Modals.js';

const html = htm.bind(h);

export function DashboardWrapper({
  title = "AI Training Dashboard",
  game,
  gameType,
  actionLabels: initialActionLabels,
  onLog,
  children // This is where the game-specific content goes
}) {
  // Session state
  const [session, setSession] = useState(null);
  const [stats, setStats] = useState(null);

  // UI state
  const [showConfig, setShowConfig] = useState(false);
  const [showEpisodeDetail, setShowEpisodeDetail] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Refs
  const fileInputRef = useRef(null);

  // Configuration
  const [config, setConfig] = useState({
    totalEpisodes: 1000,
    evalInterval: 100,
    exploration: 0.1,
    temperature: 1.0,
    policyType: 'random',
    recordTrajectories: true,
    trackActionDistribution: true,
    chartUpdateInterval: 10,
    verboseLogging: false
  });

  // Derive action labels
  const actionLabels = useMemo(() => {
    if (initialActionLabels) return initialActionLabels;
    return game?.actionLabels || game?.getActionLabels?.() || {};
  }, [game, initialActionLabels]);

  // Create training session
  const createSession = useCallback((cfg) => {
    if (!game) {
      onLog?.('No game selected');
      return null;
    }

    const newSession = new TrainingSession(game, cfg);

    newSession.addEventListener('training:start', () => {
      onLog?.(`Training started: ${cfg.totalEpisodes} episodes`);
    });

    newSession.addEventListener('training:progress', (e) => {
      setStats(e.detail);
    });

    newSession.addEventListener('training:pause', () => {
      onLog?.('Training paused');
    });

    newSession.addEventListener('training:stop', () => {
      onLog?.('Training stopped');
    });

    newSession.addEventListener('training:complete', (e) => {
      setStats(e.detail);
      onLog?.(`Training complete! Final win rate: ${(e.detail.winRate * 100).toFixed(1)}%`);
    });

    return newSession;
  }, [game, onLog]);

  // Start training
  const startTraining = useCallback((cfg = config) => {
    if (session) session.stop();
    const newSession = createSession(cfg);
    if (newSession) {
      setSession(newSession);
      setStats(null);
      newSession.start();
    }
  }, [session, config, createSession]);

  const pauseTraining = useCallback(() => session?.pause(), [session]);
  const resumeTraining = useCallback(() => session?.resume(), [session]);
  const stopTraining = useCallback(() => session?.stop(), [session]);

  // Export
  const exportResults = useCallback(() => {
    if (!session) return;
    const data = session.exportResults();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `training-${gameType}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onLog?.('Training results exported as JSON');
    setShowExportMenu(false);
  }, [session, gameType, onLog]);

  // Navigation
  const navigateEpisode = useCallback((direction) => {
    const trajectories = stats?.trajectories || [];
    const currentIndex = trajectories.findIndex(t => t.episode === showEpisodeDetail?.episode);
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < trajectories.length) {
      setShowEpisodeDetail(trajectories[newIndex]);
    }
  }, [stats, showEpisodeDetail]);

  const replayEpisode = useCallback((trajectory) => {
    onLog?.(`Replaying episode #${trajectory.episode}`);
    window.dispatchEvent(new CustomEvent('training:replay', { detail: { trajectory } }));
  }, [onLog]);

  useEffect(() => {
    return () => session?.stop();
  }, [session]);

  const status = session?.status || 'idle';

  return html`
    <div class="training-dashboard">
      <div class="dashboard-header">
        <h2>${title}</h2>
        <div class="header-controls">
          ${status === 'idle' || status === 'complete' ? html`
            <button class="btn-train" onClick=${() => startTraining()}>▶ Train</button>
          ` : status === 'running' ? html`
            <button class="btn-pause" onClick=${pauseTraining}>⏸ Pause</button>
          ` : status === 'paused' ? html`
            <button class="btn-resume" onClick=${resumeTraining}>▶ Resume</button>
          ` : null}
          <button class="btn-stop" onClick=${stopTraining} disabled=${status === 'idle'}>⏹ Stop</button>
          <button class="btn-config" onClick=${() => setShowConfig(true)} title="Configure">⚙</button>

          <div class="export-dropdown">
            <button
              class="btn-export"
              onClick=${() => setShowExportMenu(!showExportMenu)}
              title="Export options"
              disabled=${!stats}
            >📥 Export ▾</button>
            ${showExportMenu && html`
              <div class="export-menu">
                <button onClick=${exportResults}>Export JSON</button>
              </div>
            `}
          </div>
        </div>
      </div>

      ${stats && html`
        <${ProgressBar}
          progress=${stats.progress}
          episode=${stats.episode}
          total=${stats.totalEpisodes}
          eta=${stats.eta}
          speed=${stats.episodesPerSecond}
          elapsed=${stats.elapsedTime}
          status=${status}
        />
      `}

      <div class="dashboard-content">
        ${children({ stats, session, actionLabels, setShowEpisodeDetail, replayEpisode })}
      </div>

      ${showConfig && html`
        <${ConfigModal}
          config=${config}
          onSave=${setConfig}
          onCancel=${() => setShowConfig(false)}
          onStartTraining=${(cfg) => {
            setShowConfig(false);
            startTraining(cfg);
          }}
        />
      `}

      ${showEpisodeDetail && html`
        <${EpisodeDetailModal}
          trajectory=${showEpisodeDetail}
          actionLabels=${actionLabels}
          onClose=${() => setShowEpisodeDetail(null)}
          onPrev=${() => navigateEpisode(-1)}
          onNext=${() => navigateEpisode(1)}
          onReplay=${replayEpisode}
        />
      `}
    </div>
  `;
}
