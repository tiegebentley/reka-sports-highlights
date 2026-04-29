import { useState } from 'react';
import { AdvancedPlayer } from '../components/video/AdvancedPlayer';

// Temporary workaround for browser cache issue
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

// Sample tracking data for demo
const sampleTracks: PlayerTrack[] = [
  {
    id: '1',
    playerId: 'player-1',
    playerName: 'Alex Johnson',
    playerNumber: 10,
    color: '#FF6B6B',
    detectionMethod: 'ai',
    boxes: Array.from({ length: 300 }, (_, i) => ({
      frame: i,
      timestamp: i / 30,
      x: 100 + Math.sin(i / 20) * 50,
      y: 100 + Math.cos(i / 15) * 30,
      width: 60,
      height: 120,
      confidence: 0.92 + Math.random() * 0.08,
    })),
  },
  {
    id: '2',
    playerId: 'player-2',
    playerName: 'Sarah Miller',
    playerNumber: 7,
    color: '#4ECDC4',
    detectionMethod: 'ai',
    boxes: Array.from({ length: 300 }, (_, i) => ({
      frame: i,
      timestamp: i / 30,
      x: 300 + Math.cos(i / 25) * 60,
      y: 200 + Math.sin(i / 20) * 40,
      width: 55,
      height: 115,
      confidence: 0.88 + Math.random() * 0.12,
    })),
  },
  {
    id: '3',
    playerId: 'player-3',
    playerName: 'Marcus Brown',
    playerNumber: 23,
    color: '#95E1D3',
    detectionMethod: 'manual',
    boxes: Array.from({ length: 300 }, (_, i) => ({
      frame: i,
      timestamp: i / 30,
      x: 500 + Math.sin(i / 18) * 70,
      y: 150 + Math.cos(i / 22) * 50,
      width: 58,
      height: 118,
      confidence: 1.0,
    })),
  },
];

export const PlayerDemo = () => {
  const [videoSrc] = useState<string>(
    // Sample video URL - replace with your own
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
  );

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, marginBottom: '0.5rem' }}>Advanced Player Demo</h1>
        <p style={{ margin: 0, color: '#666' }}>
          Try the controls below to explore player tracking, spotlights, and AI detection
        </p>
      </div>

      <AdvancedPlayer
        src={videoSrc}
        tracks={sampleTracks}
        onTimeUpdate={(time) => {
          // You can use this for custom logic
          // console.log('Current time:', time);
        }}
      />

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f5f5f5', borderRadius: '8px' }}>
        <h2 style={{ marginTop: 0 }}>Features Demonstrated</h2>
        <ul>
          <li><strong>Player Tracking:</strong> See bounding boxes following 3 sample players</li>
          <li><strong>Spotlight Mode:</strong> Click "Spotlight" on any player to highlight them</li>
          <li><strong>Filters:</strong> Toggle boxes, labels, IDs, names, and confidence scores</li>
          <li><strong>Playback Controls:</strong> Frame-by-frame stepping, speed control</li>
          <li><strong>Zoom:</strong> Enable zoom and select a player to follow</li>
          <li><strong>Detection Methods:</strong> AI-detected (Alex, Sarah) vs Manual (Marcus)</li>
        </ul>
      </div>

      <div style={{ marginTop: '1rem', padding: '1rem', background: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107' }}>
        <h3 style={{ marginTop: 0 }}>📝 Note</h3>
        <p style={{ margin: 0 }}>
          This is a demo with simulated tracking data. In production:
        </p>
        <ul style={{ marginBottom: 0 }}>
          <li>Player tracking data comes from Reka.ai Vision API</li>
          <li>Bounding boxes are synchronized with actual video frames</li>
          <li>Real player names, numbers, and positions from your database</li>
          <li>Manual corrections available for AI misdetections</li>
        </ul>
      </div>
    </div>
  );
};
