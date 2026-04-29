import { useState } from 'react';
import { ExportConfig } from '../components/export/ExportConfig';
import { ExportProgress } from '../components/export/ExportProgress';

export const ExportDemo = () => {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const handleExportStarted = (jobId: string) => {
    setActiveJobId(jobId);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      padding: '40px 20px',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '40px',
          color: '#fff',
        }}>
          <h1 style={{
            fontSize: '48px',
            fontWeight: 'bold',
            marginBottom: '16px',
            background: 'linear-gradient(135deg, #4ECDC4 0%, #45B7D1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Video Export Pipeline
          </h1>
          <p style={{
            fontSize: '18px',
            color: '#aaa',
            maxWidth: '600px',
            margin: '0 auto',
          }}>
            Render professional sports videos with player tracking overlays,
            AI commentary, background music, and custom transitions.
          </p>
        </div>

        {/* Two-column layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: activeJobId ? '1fr 1fr' : '1fr',
          gap: '24px',
          marginBottom: '48px',
        }}>
          {/* Export Configuration */}
          <ExportConfig
            clipId="demo-clip-123"
            onExportStarted={handleExportStarted}
          />

          {/* Export Progress (only show if job started) */}
          {activeJobId && (
            <ExportProgress
              jobId={activeJobId}
              autoRefresh={true}
            />
          )}
        </div>

        {/* All Export Jobs */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{
            color: '#fff',
            fontSize: '28px',
            fontWeight: 'bold',
            marginBottom: '24px',
          }}>
            Recent Exports
          </h2>
          <ExportProgress autoRefresh={true} />
        </div>

        {/* Feature Highlights */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          marginBottom: '48px',
        }}>
          {[
            {
              icon: '🎬',
              title: 'Professional Rendering',
              description: 'FFmpeg-powered video processing with customizable quality settings',
            },
            {
              icon: '🎯',
              title: 'Player Tracking Overlays',
              description: 'Bounding boxes, player names, and jersey numbers rendered in real-time',
            },
            {
              icon: '🎙️',
              title: 'AI Commentary Integration',
              description: 'Seamlessly blend ElevenLabs-generated commentary with video',
            },
            {
              icon: '🎵',
              title: 'Background Music',
              description: 'Add custom music tracks with adjustable volume mixing',
            },
            {
              icon: '⚙️',
              title: 'Background Processing',
              description: 'Asynchronous job queue with real-time progress tracking',
            },
            {
              icon: '📊',
              title: 'Multiple Formats',
              description: 'Export to MP4, WebM, or MOV with various resolutions and frame rates',
            },
          ].map((feature, index) => (
            <div
              key={index}
              style={{
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '8px',
                padding: '24px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>
                {feature.icon}
              </div>
              <h3 style={{
                color: '#fff',
                fontSize: '18px',
                fontWeight: 'bold',
                marginBottom: '8px',
              }}>
                {feature.title}
              </h3>
              <p style={{
                color: '#aaa',
                fontSize: '14px',
                lineHeight: '1.6',
              }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Technical Details */}
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '24px',
        }}>
          <h3 style={{
            color: '#fff',
            fontSize: '20px',
            fontWeight: 'bold',
            marginBottom: '16px',
          }}>
            Export Pipeline Architecture
          </h3>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#4ECDC4',
            background: '#0a0a0a',
            padding: '16px',
            borderRadius: '4px',
            overflowX: 'auto',
            lineHeight: '1.8',
          }}>
            <div>1. User Configuration → Export Config UI</div>
            <div>2. Create Export Job → Supabase Database</div>
            <div>3. Trigger Edge Function → export-video Function</div>
            <div>4. Download Source Files → Video + Commentary + Music</div>
            <div>5. FFmpeg Processing → Apply Filters, Overlays, Audio Mixing</div>
            <div>6. Upload Rendered Video → Supabase Storage</div>
            <div>7. Update Job Status → progress: 100%, status: 'completed'</div>
            <div>8. User Downloads → Public URL or Direct Download</div>
          </div>
        </div>

        {/* Setup Instructions */}
        <div style={{
          background: '#2a2a1a',
          border: '1px solid #4a4a2a',
          borderRadius: '6px',
          padding: '24px',
          color: '#e6db74',
        }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold' }}>
            ⚙️ Setup Required for Production
          </h4>
          <ol style={{ margin: '0', paddingLeft: '24px', lineHeight: '2' }}>
            <li>Deploy Edge Function with FFmpeg-enabled Docker image</li>
            <li>Configure Supabase Storage bucket permissions</li>
            <li>Apply database migration:
              <code style={{
                display: 'block',
                marginTop: '8px',
                padding: '8px',
                background: '#1a1a0a',
                borderRadius: '4px',
                fontSize: '12px',
              }}>
                supabase db push
              </code>
            </li>
            <li>Test with sample clip and monitor export job status</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
