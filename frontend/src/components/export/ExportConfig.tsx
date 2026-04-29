import { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface ExportConfigProps {
  clipId: string;
  onExportStarted?: (jobId: string) => void;
}

export const ExportConfig = ({ clipId, onExportStarted }: ExportConfigProps) => {
  const [config, setConfig] = useState({
    format: 'mp4' as 'mp4' | 'webm' | 'mov',
    resolution: '1080p' as '1080p' | '720p' | '480p',
    fps: 30 as 30 | 60,
    includeOverlays: true,
    includeCommentary: true,
    includeMusic: false,
    transitions: 'fade' as 'fade' | 'slide' | 'none',
    musicUrl: '',
    musicVolume: 0.3,
    introText: '',
    outroText: '',
  });

  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfigChange = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleStartExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const { data, error: exportError } = await supabase.functions.invoke('export-video', {
        body: {
          clipId,
          config,
        },
      });

      if (exportError) throw exportError;

      if (data?.jobId) {
        if (onExportStarted) {
          onExportStarted(data.jobId);
        }
      }
    } catch (err: any) {
      console.error('Export failed:', err);
      setError(err.message || 'Failed to start export');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{
      background: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '8px',
      padding: '24px',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <h2 style={{ margin: '0 0 24px 0', fontSize: '24px', fontWeight: 'bold' }}>
        Export Settings
      </h2>

      {/* Format Selection */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>
          Video Format
        </label>
        <div style={{ display: 'flex', gap: '12px' }}>
          {(['mp4', 'webm', 'mov'] as const).map(format => (
            <button
              key={format}
              onClick={() => handleConfigChange('format', format)}
              style={{
                flex: 1,
                padding: '12px',
                background: config.format === format ? '#4ECDC4' : '#2a2a2a',
                color: config.format === format ? '#0a0a0a' : '#fff',
                border: config.format === format ? 'none' : '1px solid #444',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {format}
            </button>
          ))}
        </div>
      </div>

      {/* Resolution Selection */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>
          Resolution
        </label>
        <div style={{ display: 'flex', gap: '12px' }}>
          {(['1080p', '720p', '480p'] as const).map(res => (
            <button
              key={res}
              onClick={() => handleConfigChange('resolution', res)}
              style={{
                flex: 1,
                padding: '12px',
                background: config.resolution === res ? '#4ECDC4' : '#2a2a2a',
                color: config.resolution === res ? '#0a0a0a' : '#fff',
                border: config.resolution === res ? 'none' : '1px solid #444',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              {res}
              <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>
                {res === '1080p' && '1920×1080'}
                {res === '720p' && '1280×720'}
                {res === '480p' && '854×480'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* FPS Selection */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>
          Frame Rate
        </label>
        <div style={{ display: 'flex', gap: '12px' }}>
          {([30, 60] as const).map(fps => (
            <button
              key={fps}
              onClick={() => handleConfigChange('fps', fps)}
              style={{
                flex: 1,
                padding: '12px',
                background: config.fps === fps ? '#4ECDC4' : '#2a2a2a',
                color: config.fps === fps ? '#0a0a0a' : '#fff',
                border: config.fps === fps ? 'none' : '1px solid #444',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              {fps} FPS
            </button>
          ))}
        </div>
      </div>

      {/* Feature Toggles */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '12px', fontSize: '14px', color: '#aaa' }}>
          Include Features
        </label>

        {[
          { key: 'includeOverlays', label: 'Player Tracking Overlays', icon: '🎯' },
          { key: 'includeCommentary', label: 'AI Commentary Audio', icon: '🎙️' },
          { key: 'includeMusic', label: 'Background Music', icon: '🎵' },
        ].map(({ key, label, icon }) => (
          <div
            key={key}
            onClick={() => handleConfigChange(key, !config[key as keyof typeof config])}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px',
              background: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '6px',
              marginBottom: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <input
              type="checkbox"
              checked={config[key as keyof typeof config] as boolean}
              readOnly
              style={{ marginRight: '12px', width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '20px', marginRight: '12px' }}>{icon}</span>
            <span style={{ fontSize: '14px' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Music URL (conditional) */}
      {config.includeMusic && (
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>
            Background Music URL
          </label>
          <input
            type="url"
            value={config.musicUrl}
            onChange={(e) => handleConfigChange('musicUrl', e.target.value)}
            placeholder="https://example.com/music.mp3"
            style={{
              width: '100%',
              padding: '12px',
              background: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '14px',
              marginBottom: '12px',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ fontSize: '14px', color: '#aaa', minWidth: '100px' }}>
              Music Volume: {Math.round(config.musicVolume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.musicVolume}
              onChange={(e) => handleConfigChange('musicVolume', parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      )}

      {/* Transitions */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>
          Transitions
        </label>
        <select
          value={config.transitions}
          onChange={(e) => handleConfigChange('transitions', e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            background: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '14px',
          }}
        >
          <option value="none">None</option>
          <option value="fade">Fade</option>
          <option value="slide">Slide</option>
        </select>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '12px',
          background: '#3a1a1a',
          border: '1px solid #6a2a2a',
          borderRadius: '6px',
          color: '#ff6b6b',
          marginBottom: '16px',
          fontSize: '14px',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Export Button */}
      <button
        onClick={handleStartExport}
        disabled={isExporting}
        style={{
          width: '100%',
          padding: '16px',
          background: isExporting ? '#333' : 'linear-gradient(135deg, #4ECDC4 0%, #45B7D1 100%)',
          color: isExporting ? '#666' : '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: isExporting ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {isExporting ? '⏳ Starting Export...' : '🎬 Start Export'}
      </button>

      {/* Export Info */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        background: '#2a2a1a',
        border: '1px solid #4a4a2a',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#aaa',
      }}>
        <strong style={{ color: '#e6db74' }}>ℹ️ Note:</strong> Export processing happens in the background.
        You'll be able to track progress and download the video when complete.
      </div>
    </div>
  );
};
