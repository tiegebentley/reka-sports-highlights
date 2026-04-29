import { useEffect, useRef } from 'react';
import { PlayerHeatmap } from '../../types/stats';

interface HeatmapVisualizerProps {
  heatmap: PlayerHeatmap;
  width?: number;
  height?: number;
  colorScheme?: 'blue' | 'red' | 'green' | 'heat';
  showGrid?: boolean;
}

export const HeatmapVisualizer = ({
  heatmap,
  width = 680,
  height = 1050,
  colorScheme = 'heat',
  showGrid = false,
}: HeatmapVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Standard soccer pitch dimensions (68m x 105m)
  const PITCH_WIDTH = 68;
  const PITCH_HEIGHT = 105;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Calculate cell size
    const cellWidth = width / heatmap.gridWidth;
    const cellHeight = height / heatmap.gridHeight;

    // Draw pitch background
    ctx.fillStyle = '#1a5230'; // Dark green pitch
    ctx.fillRect(0, 0, width, height);

    // Draw pitch markings
    drawPitchMarkings(ctx, width, height);

    // Draw heatmap
    const maxIntensity = heatmap.maxIntensity;

    for (const [key, intensity] of Object.entries(heatmap.heatmapData)) {
      const [x, y] = key.split('_').map(Number);

      // Normalize intensity (0-1)
      const normalizedIntensity = intensity / maxIntensity;

      // Get color based on scheme
      const color = getHeatmapColor(normalizedIntensity, colorScheme);

      // Draw cell
      ctx.fillStyle = color;
      ctx.fillRect(
        x * cellWidth,
        y * cellHeight,
        cellWidth,
        cellHeight
      );
    }

    // Draw grid if enabled
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;

      for (let x = 0; x <= heatmap.gridWidth; x++) {
        ctx.beginPath();
        ctx.moveTo(x * cellWidth, 0);
        ctx.lineTo(x * cellWidth, height);
        ctx.stroke();
      }

      for (let y = 0; y <= heatmap.gridHeight; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * cellHeight);
        ctx.lineTo(width, y * cellHeight);
        ctx.stroke();
      }
    }
  }, [heatmap, width, height, colorScheme, showGrid]);

  return (
    <div style={{
      background: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '8px',
      padding: '16px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '12px' }}>
        <h4 style={{
          margin: '0 0 8px 0',
          fontSize: '16px',
          fontWeight: 'bold',
          color: '#fff',
        }}>
          Player Movement Heatmap
        </h4>
        <p style={{
          margin: 0,
          fontSize: '12px',
          color: '#666',
        }}>
          Intensity shows areas of highest activity
        </p>
      </div>

      {/* Canvas */}
      <div style={{
        position: 'relative',
        display: 'inline-block',
        borderRadius: '4px',
        overflow: 'hidden',
        border: '1px solid #444',
      }}>
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            maxWidth: '100%',
            height: 'auto',
          }}
        />
      </div>

      {/* Legend */}
      <div style={{ marginTop: '16px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}>
          <span style={{ fontSize: '12px', color: '#aaa', minWidth: '60px' }}>Low</span>
          <div style={{
            flex: 1,
            height: '20px',
            borderRadius: '4px',
            background: getGradient(colorScheme),
          }} />
          <span style={{ fontSize: '12px', color: '#aaa', minWidth: '60px', textAlign: 'right' }}>High</span>
        </div>
        <div style={{ fontSize: '11px', color: '#666', textAlign: 'center' }}>
          Activity Intensity
        </div>
      </div>

      {/* Stats */}
      <div style={{
        marginTop: '12px',
        padding: '12px',
        background: '#2a2a2a',
        borderRadius: '4px',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px',
      }}>
        <div>
          <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>
            Max Intensity
          </div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>
            {heatmap.maxIntensity}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>
            Active Cells
          </div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>
            {Object.keys(heatmap.heatmapData).length}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Draw standard soccer pitch markings
 */
function drawPitchMarkings(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;

  // Outer boundary
  ctx.strokeRect(0, 0, width, height);

  // Center line
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  // Center circle
  const centerX = width / 2;
  const centerY = height / 2;
  const circleRadius = (9.15 / 68) * width; // 9.15m radius

  ctx.beginPath();
  ctx.arc(centerX, centerY, circleRadius, 0, 2 * Math.PI);
  ctx.stroke();

  // Center spot
  ctx.beginPath();
  ctx.arc(centerX, centerY, 3, 0, 2 * Math.PI);
  ctx.fill();

  // Penalty areas (16.5m)
  const penaltyAreaWidth = (40.32 / 68) * width;
  const penaltyAreaHeight = (16.5 / 105) * height;
  const penaltyAreaX = (width - penaltyAreaWidth) / 2;

  // Top penalty area
  ctx.strokeRect(penaltyAreaX, 0, penaltyAreaWidth, penaltyAreaHeight);

  // Bottom penalty area
  ctx.strokeRect(penaltyAreaX, height - penaltyAreaHeight, penaltyAreaWidth, penaltyAreaHeight);

  // Goal areas (5.5m)
  const goalAreaWidth = (18.32 / 68) * width;
  const goalAreaHeight = (5.5 / 105) * height;
  const goalAreaX = (width - goalAreaWidth) / 2;

  // Top goal area
  ctx.strokeRect(goalAreaX, 0, goalAreaWidth, goalAreaHeight);

  // Bottom goal area
  ctx.strokeRect(goalAreaX, height - goalAreaHeight, goalAreaWidth, goalAreaHeight);

  // Penalty spots
  const penaltySpotY = (11 / 105) * height;

  ctx.beginPath();
  ctx.arc(centerX, penaltySpotY, 3, 0, 2 * Math.PI);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(centerX, height - penaltySpotY, 3, 0, 2 * Math.PI);
  ctx.fill();
}

/**
 * Get heatmap color based on intensity and color scheme
 */
function getHeatmapColor(intensity: number, scheme: string): string {
  if (intensity === 0) return 'rgba(0, 0, 0, 0)';

  // Ensure minimum visibility
  const alpha = Math.max(0.3, intensity);

  switch (scheme) {
    case 'blue':
      return `rgba(69, 183, 209, ${alpha})`;
    case 'red':
      return `rgba(255, 107, 107, ${alpha})`;
    case 'green':
      return `rgba(78, 205, 196, ${alpha})`;
    case 'heat':
    default:
      // Heat map: blue -> cyan -> yellow -> red
      if (intensity < 0.25) {
        return `rgba(69, 183, 209, ${alpha})`;
      } else if (intensity < 0.5) {
        return `rgba(78, 205, 196, ${alpha})`;
      } else if (intensity < 0.75) {
        return `rgba(255, 160, 122, ${alpha})`;
      } else {
        return `rgba(255, 107, 107, ${alpha})`;
      }
  }
}

/**
 * Get gradient for legend
 */
function getGradient(scheme: string): string {
  switch (scheme) {
    case 'blue':
      return 'linear-gradient(90deg, rgba(69, 183, 209, 0.3) 0%, rgba(69, 183, 209, 1) 100%)';
    case 'red':
      return 'linear-gradient(90deg, rgba(255, 107, 107, 0.3) 0%, rgba(255, 107, 107, 1) 100%)';
    case 'green':
      return 'linear-gradient(90deg, rgba(78, 205, 196, 0.3) 0%, rgba(78, 205, 196, 1) 100%)';
    case 'heat':
    default:
      return 'linear-gradient(90deg, rgba(69, 183, 209, 0.3) 0%, rgba(78, 205, 196, 0.6) 33%, rgba(255, 160, 122, 0.8) 66%, rgba(255, 107, 107, 1) 100%)';
  }
}
