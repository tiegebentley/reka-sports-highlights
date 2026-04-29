import { useRef, useEffect, useCallback } from 'react';

// Temporary workaround for browser cache issue - inline type definitions
interface BoundingBox {
  frame: number;
  timestamp: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

interface PlayerTrack {
  id: string;
  playerId: string;
  playerName: string;
  playerNumber?: number;
  color: string;
  boxes: BoundingBox[];
  detectionMethod: 'ai' | 'manual';
}

interface CanvasOverlayOptions {
  showBoxes: boolean;
  showLabels: boolean;
  showIDs: boolean;
  showNames: boolean;
  showConfidence: boolean;
}

interface SpotlightOptions {
  enabled: boolean;
  trackId: string | null;
  radius: number;
  opacity: number;
}

interface ZoomOptions {
  enabled: boolean;
  trackId: string | null;
  scale: number;
  smoothing: number;
}

export interface UseCanvasOverlayOptions {
  videoElement: HTMLVideoElement | null;
  tracks: PlayerTrack[];
  overlayOptions: CanvasOverlayOptions;
  spotlightOptions?: SpotlightOptions;
  zoomOptions?: ZoomOptions;
}

export const useCanvasOverlay = ({
  videoElement,
  tracks,
  overlayOptions,
  spotlightOptions,
  zoomOptions,
}: UseCanvasOverlayOptions) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  // Get current frame number from video time
  const getCurrentFrame = useCallback((currentTime: number, fps: number = 30): number => {
    return Math.floor(currentTime * fps);
  }, []);

  // Find bounding box for current frame
  const getBoxAtFrame = useCallback((track: PlayerTrack, frame: number) => {
    // Find exact frame or nearest
    let nearestBox = track.boxes[0];
    let minDistance = Math.abs(track.boxes[0]?.frame - frame);

    for (const box of track.boxes) {
      const distance = Math.abs(box.frame - frame);
      if (distance < minDistance) {
        minDistance = distance;
        nearestBox = box;
      }
      if (box.frame === frame) {
        return box;
      }
    }

    return minDistance <= 5 ? nearestBox : null; // Only show if within 5 frames
  }, []);

  // Draw bounding box
  const drawBoundingBox = useCallback((
    ctx: CanvasRenderingContext2D,
    track: PlayerTrack,
    box: NonNullable<ReturnType<typeof getBoxAtFrame>>,
    videoWidth: number,
    videoHeight: number,
  ) => {
    const { x, y, width, height, confidence } = box;

    // Scale coordinates to canvas size
    const scaleX = ctx.canvas.width / videoWidth;
    const scaleY = ctx.canvas.height / videoHeight;

    const scaledX = x * scaleX;
    const scaledY = y * scaleY;
    const scaledWidth = width * scaleX;
    const scaledHeight = height * scaleY;

    // Draw box
    if (overlayOptions.showBoxes) {
      ctx.strokeStyle = track.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
    }

    // Draw label background
    if (overlayOptions.showLabels || overlayOptions.showNames || overlayOptions.showIDs) {
      const labels = [];
      if (overlayOptions.showNames) labels.push(track.playerName);
      if (overlayOptions.showIDs) labels.push(`#${track.playerNumber || '?'}`);
      if (overlayOptions.showConfidence) labels.push(`${(confidence * 100).toFixed(0)}%`);

      const labelText = labels.join(' • ');
      ctx.font = '14px Arial';
      const textWidth = ctx.measureText(labelText).width;

      ctx.fillStyle = track.color;
      ctx.fillRect(scaledX, scaledY - 25, textWidth + 10, 20);

      ctx.fillStyle = 'white';
      ctx.fillText(labelText, scaledX + 5, scaledY - 10);
    }
  }, [overlayOptions]);

  // Draw spotlight effect
  const drawSpotlight = useCallback((
    ctx: CanvasRenderingContext2D,
    track: PlayerTrack,
    box: NonNullable<ReturnType<typeof getBoxAtFrame>>,
    videoWidth: number,
    videoHeight: number,
  ) => {
    if (!spotlightOptions?.enabled || spotlightOptions.trackId !== track.id) return;

    const scaleX = ctx.canvas.width / videoWidth;
    const scaleY = ctx.canvas.height / videoHeight;

    const centerX = (box.x + box.width / 2) * scaleX;
    const centerY = (box.y + box.height / 2) * scaleY;
    const radius = spotlightOptions.radius * scaleX;

    // Create radial gradient
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 0, 0)');
    gradient.addColorStop(1, `rgba(255, 255, 0, ${spotlightOptions.opacity})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Draw circle outline
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
  }, [spotlightOptions]);

  // Main render loop
  const render = useCallback(() => {
    if (!canvasRef.current || !videoElement) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;

    if (videoWidth === 0 || videoHeight === 0) return;

    // Clear canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Get current frame
    const currentFrame = getCurrentFrame(videoElement.currentTime);

    // Draw all tracks
    for (const track of tracks) {
      const box = getBoxAtFrame(track, currentFrame);
      if (!box) continue;

      drawBoundingBox(ctx, track, box, videoWidth, videoHeight);
      drawSpotlight(ctx, track, box, videoWidth, videoHeight);
    }

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(render);
  }, [videoElement, tracks, overlayOptions, spotlightOptions, getCurrentFrame, getBoxAtFrame, drawBoundingBox, drawSpotlight]);

  // Start/stop render loop
  useEffect(() => {
    if (videoElement) {
      render();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [videoElement, render]);

  // Resize canvas to match video
  useEffect(() => {
    if (!canvasRef.current || !videoElement) return;

    const resizeCanvas = () => {
      if (canvasRef.current && videoElement) {
        const rect = videoElement.getBoundingClientRect();
        canvasRef.current.width = rect.width;
        canvasRef.current.height = rect.height;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [videoElement]);

  return { canvasRef };
};
