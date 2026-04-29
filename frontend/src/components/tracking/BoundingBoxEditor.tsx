import { useState, useRef, useEffect, useCallback } from 'react';
import type { EditableBoundingBox, PlayerProfile } from '../../types/tracking';

interface BoundingBoxEditorProps {
  videoElement: HTMLVideoElement | null;
  boxes: EditableBoundingBox[];
  players: PlayerProfile[];
  currentFrame: number;
  editMode: 'select' | 'draw' | 'delete';
  selectedBoxId: string | null;
  onBoxUpdate: (boxId: string, updates: Partial<EditableBoundingBox>) => void;
  onBoxDelete: (boxId: string) => void;
  onBoxCreate: (box: Omit<EditableBoundingBox, 'id'>) => void;
  onBoxSelect: (boxId: string | null) => void;
}

export const BoundingBoxEditor = ({
  videoElement,
  boxes,
  players,
  currentFrame,
  editMode,
  selectedBoxId,
  onBoxUpdate,
  onBoxDelete,
  onBoxCreate,
  onBoxSelect,
}: BoundingBoxEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [newBox, setNewBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Get boxes for current frame
  const currentBoxes = boxes.filter(box => box.frame === currentFrame);

  // Resize canvas to match video dimensions
  useEffect(() => {
    if (!canvasRef.current || !videoElement) return;

    const resizeCanvas = () => {
      const canvas = canvasRef.current!;
      const rect = videoElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [videoElement]);

  // Get player color by ID
  const getPlayerColor = useCallback((playerId: string | null): string => {
    if (!playerId) return '#888888';
    const player = players.find(p => p.id === playerId);
    return player?.color || '#888888';
  }, [players]);

  // Convert video coordinates to canvas coordinates
  const videoToCanvas = useCallback((x: number, y: number): { x: number; y: number } => {
    if (!canvasRef.current || !videoElement) return { x, y };
    const scaleX = canvasRef.current.width / videoElement.videoWidth;
    const scaleY = canvasRef.current.height / videoElement.videoHeight;
    return { x: x * scaleX, y: y * scaleY };
  }, [videoElement]);

  // Convert canvas coordinates to video coordinates
  const canvasToVideo = useCallback((x: number, y: number): { x: number; y: number } => {
    if (!canvasRef.current || !videoElement) return { x, y };
    const scaleX = videoElement.videoWidth / canvasRef.current.width;
    const scaleY = videoElement.videoHeight / canvasRef.current.height;
    return { x: x * scaleX, y: y * scaleY };
  }, [videoElement]);

  // Check if point is inside a box
  const isPointInBox = useCallback((px: number, py: number, box: EditableBoundingBox): boolean => {
    const { x, y } = videoToCanvas(box.x, box.y);
    const { x: x2, y: y2 } = videoToCanvas(box.x + box.width, box.y + box.height);
    return px >= x && px <= x2 && py >= y && py <= y2;
  }, [videoToCanvas]);

  // Get resize handle at point
  const getResizeHandle = useCallback((px: number, py: number, box: EditableBoundingBox): string | null => {
    const handleSize = 10;
    const { x, y } = videoToCanvas(box.x, box.y);
    const { x: x2, y: y2 } = videoToCanvas(box.x + box.width, box.y + box.height);

    if (Math.abs(px - x) < handleSize && Math.abs(py - y) < handleSize) return 'nw';
    if (Math.abs(px - x2) < handleSize && Math.abs(py - y) < handleSize) return 'ne';
    if (Math.abs(px - x) < handleSize && Math.abs(py - y2) < handleSize) return 'sw';
    if (Math.abs(px - x2) < handleSize && Math.abs(py - y2) < handleSize) return 'se';
    if (Math.abs(px - x) < handleSize && py > y && py < y2) return 'w';
    if (Math.abs(px - x2) < handleSize && py > y && py < y2) return 'e';
    if (Math.abs(py - y) < handleSize && px > x && px < x2) return 'n';
    if (Math.abs(py - y2) < handleSize && px > x && px < x2) return 's';

    return null;
  }, [videoToCanvas]);

  // Draw all boxes
  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Draw each box
    for (const box of currentBoxes) {
      const { x, y } = videoToCanvas(box.x, box.y);
      const { x: x2, y: y2 } = videoToCanvas(box.x + box.width, box.y + box.height);
      const width = x2 - x;
      const height = y2 - y;

      const color = getPlayerColor(box.playerId);
      const isSelected = box.id === selectedBoxId;

      // Draw box
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeRect(x, y, width, height);

      // Draw filled background with transparency
      ctx.fillStyle = `${color}20`;
      ctx.fillRect(x, y, width, height);

      // Draw resize handles if selected
      if (isSelected) {
        ctx.fillStyle = color;
        const handleSize = 8;
        // Corners
        ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(x2 - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(x - handleSize / 2, y2 - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(x2 - handleSize / 2, y2 - handleSize / 2, handleSize, handleSize);
        // Edges
        ctx.fillRect(x - handleSize / 2, (y + y2) / 2 - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(x2 - handleSize / 2, (y + y2) / 2 - handleSize / 2, handleSize, handleSize);
        ctx.fillRect((x + x2) / 2 - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
        ctx.fillRect((x + x2) / 2 - handleSize / 2, y2 - handleSize / 2, handleSize, handleSize);
      }

      // Draw label
      const player = players.find(p => p.id === box.playerId);
      const label = player ? `${player.name} #${player.number || '?'}` : 'Unassigned';
      ctx.fillStyle = color;
      ctx.fillRect(x, y - 24, ctx.measureText(label).width + 12, 24);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '14px sans-serif';
      ctx.fillText(label, x + 6, y - 6);

      // Draw confidence
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px sans-serif';
      ctx.fillText(`${Math.round(box.confidence * 100)}%`, x + 6, y2 - 6);
    }

    // Draw new box being created
    if (newBox) {
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(newBox.x, newBox.y, newBox.width, newBox.height);
      ctx.setLineDash([]);
    }
  }, [currentBoxes, selectedBoxId, players, getPlayerColor, videoToCanvas, newBox]);

  // Mouse down handler
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (editMode === 'draw') {
      setNewBox({ x, y, width: 0, height: 0 });
      setDragStart({ x, y });
      return;
    }

    if (editMode === 'delete') {
      const clickedBox = currentBoxes.find(box => isPointInBox(x, y, box));
      if (clickedBox) {
        onBoxDelete(clickedBox.id);
      }
      return;
    }

    // Select mode
    const selectedBox = currentBoxes.find(box => box.id === selectedBoxId);
    if (selectedBox) {
      const handle = getResizeHandle(x, y, selectedBox);
      if (handle) {
        setIsResizing(true);
        setResizeHandle(handle);
        setDragStart({ x, y });
        return;
      }
    }

    const clickedBox = currentBoxes.find(box => isPointInBox(x, y, box));
    if (clickedBox) {
      onBoxSelect(clickedBox.id);
      setIsDragging(true);
      setDragStart({ x, y });
    } else {
      onBoxSelect(null);
    }
  };

  // Mouse move handler
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !dragStart) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (editMode === 'draw' && newBox) {
      setNewBox({
        x: Math.min(dragStart.x, x),
        y: Math.min(dragStart.y, y),
        width: Math.abs(x - dragStart.x),
        height: Math.abs(y - dragStart.y),
      });
      return;
    }

    const selectedBox = currentBoxes.find(box => box.id === selectedBoxId);
    if (!selectedBox) return;

    const dx = x - dragStart.x;
    const dy = y - dragStart.y;

    if (isResizing && resizeHandle) {
      const { x: vx, y: vy } = canvasToVideo(dx, dy);
      const updates: Partial<EditableBoundingBox> = {};

      if (resizeHandle.includes('n')) {
        updates.y = selectedBox.y + vy;
        updates.height = selectedBox.height - vy;
      }
      if (resizeHandle.includes('s')) {
        updates.height = selectedBox.height + vy;
      }
      if (resizeHandle.includes('w')) {
        updates.x = selectedBox.x + vx;
        updates.width = selectedBox.width - vx;
      }
      if (resizeHandle.includes('e')) {
        updates.width = selectedBox.width + vx;
      }

      onBoxUpdate(selectedBox.id, updates);
      setDragStart({ x, y });
    } else if (isDragging) {
      const { x: vx, y: vy } = canvasToVideo(dx, dy);
      onBoxUpdate(selectedBox.id, {
        x: selectedBox.x + vx,
        y: selectedBox.y + vy,
      });
      setDragStart({ x, y });
    }
  };

  // Mouse up handler
  const handleMouseUp = () => {
    if (editMode === 'draw' && newBox && newBox.width > 10 && newBox.height > 10) {
      const { x, y } = canvasToVideo(newBox.x, newBox.y);
      const { x: x2, y: y2 } = canvasToVideo(newBox.x + newBox.width, newBox.y + newBox.height);

      onBoxCreate({
        frame: currentFrame,
        timestamp: videoElement?.currentTime || 0,
        x,
        y,
        width: x2 - x,
        height: y2 - y,
        confidence: 1.0, // Manual boxes have 100% confidence
        playerId: null,
      });
    }

    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
    setDragStart(null);
    setNewBox(null);
  };

  return (
    <canvas
      ref={canvasRef}
      className="bounding-box-editor"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        cursor: editMode === 'draw' ? 'crosshair' : editMode === 'delete' ? 'not-allowed' : isDragging ? 'grabbing' : 'grab',
        zIndex: 2,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
};
