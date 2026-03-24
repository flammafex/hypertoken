/**
 * Charts.js
 *
 * Specialized visualization components for AI Training.
 */

import { h } from 'https://esm.sh/preact@10.19.3';
import { useEffect, useRef } from 'https://esm.sh/preact@10.19.3/hooks';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(h);

// ============================================================================
// Reward Chart Component
// ============================================================================

export function RewardChart({ history, movingAverage, movingAvgWindow = 50, onCanvasRef, title = "Reward" }) {
  const canvasRef = useRef();

  useEffect(() => {
    if (canvasRef.current && onCanvasRef) {
      onCanvasRef(canvasRef.current);
    }
  }, [onCanvasRef]);

  useEffect(() => {
    if (!canvasRef.current || history.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    // Calculate bounds with padding
    const allValues = [...history, ...(movingAverage || [])];
    let min = Math.min(...allValues);
    let max = Math.max(...allValues);

    // Add padding to bounds
    const padding = (max - min) * 0.1 || 1;
    min -= padding;
    max += padding;
    const range = max - min || 1;

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw zero line if visible
    if (min < 0 && max > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      const zeroY = height - ((0 - min) / range) * height;
      ctx.moveTo(0, zeroY);
      ctx.lineTo(width, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw episode values (faint)
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    history.forEach((val, i) => {
      const x = (i / (history.length - 1 || 1)) * width;
      const y = height - ((val - min) / range) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw moving average (bold)
    if (movingAverage && movingAverage.length > 0) {
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      movingAverage.forEach((avg, i) => {
        const x = (i / (movingAverage.length - 1 || 1)) * width;
        const y = height - ((avg - min) / range) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Draw axis labels
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(max.toFixed(1), 4, 12);
    ctx.fillText(min.toFixed(1), 4, height - 4);
  }, [history, movingAverage]);

  const latest = history[history.length - 1];
  const best = history.length > 0 ? Math.max(...history) : 0;

  return html`
    <div class="chart-container reward-chart">
      <div class="chart-header">
        <span class="chart-title">${title}</span>
        <span class="chart-legend">
          <span class="legend-item episode">Episode</span>
          <span class="legend-item avg">Avg (${movingAvgWindow})</span>
        </span>
      </div>
      <canvas ref=${canvasRef} width="600" height="180" style="width: 100%; height: auto;" />
      <div class="chart-footer">
        <span>Latest: ${latest !== undefined ? latest.toFixed(1) : '--'}</span>
        <span>Best: ${best.toFixed(1)}</span>
      </div>
    </div>
  `;
}

// ============================================================================
// Policy Heatmap Component (for Blackjack-style games)
// ============================================================================

export function PolicyHeatmap({ snapshots, metric = 'hitProb', gameType }) {
  const canvasRef = useRef();
  const latestSnapshot = snapshots?.[snapshots.length - 1];

  useEffect(() => {
    if (!canvasRef.current || !latestSnapshot?.samples?.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Clear
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameType !== 'blackjack') return;

    // Draw heatmap for Blackjack
    const cellWidth = canvas.width / 10;
    const cellHeight = canvas.height / 18;

    for (const sample of latestSnapshot.samples) {
      if (sample.playerValue === undefined) continue;

      const x = (sample.dealerCard - 1) * cellWidth;
      const y = (21 - sample.playerValue) * cellHeight;

      const value = sample[metric] || 0;
      // Green (low) to Red (high) for hit probability
      const hue = (1 - value) * 120;
      ctx.fillStyle = `hsl(${hue}, 70%, 45%)`;
      ctx.fillRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);

      // Draw value text for larger cells
      if (cellWidth > 20 && cellHeight > 15) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          (value * 100).toFixed(0),
          x + cellWidth / 2,
          y + cellHeight / 2 + 3
        );
      }
    }

    // Draw axis labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';

    // Dealer cards (x-axis)
    for (let d = 1; d <= 10; d++) {
      const label = d === 1 ? 'A' : d === 10 ? 'T' : String(d);
      ctx.textAlign = 'center';
      ctx.fillText(label, (d - 0.5) * cellWidth, canvas.height + 12);
    }

    // Player values (y-axis)
    for (let p = 4; p <= 21; p += 2) {
      ctx.textAlign = 'right';
      ctx.fillText(String(p), -4, (21 - p + 0.5) * cellHeight + 3);
    }
  }, [latestSnapshot, metric, gameType]);

  if (!latestSnapshot || gameType !== 'blackjack') {
    return html`
      <div class="policy-heatmap">
        <div class="chart-header">Policy Heatmap</div>
        <div class="heatmap-placeholder">
          ${gameType === 'blackjack'
            ? 'Policy heatmap will appear after evaluation interval...'
            : 'Heatmap available for Blackjack only'}
        </div>
      </div>
    `;
  }

  return html`
    <div class="policy-heatmap">
      <div class="chart-header">
        <span>Policy: ${metric === 'hitProb' ? 'Hit' : 'Stand'} Probability</span>
        <span class="snapshot-info">Episode ${latestSnapshot.episode}</span>
      </div>
      <div class="heatmap-wrapper">
        <div class="y-axis-label">Player Value</div>
        <div class="heatmap-container">
          <canvas ref=${canvasRef} width="400" height="360" style="width: 100%; height: auto;" />
        </div>
        <div class="x-axis-label">Dealer Showing</div>
      </div>
      <div class="heatmap-legend">
        <span class="legend-low">0%</span>
        <div class="legend-gradient"></div>
        <span class="legend-high">100%</span>
      </div>
    </div>
  `;
}
