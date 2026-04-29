import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface ExportJob {
  id: string;
  clipId: string;
  config: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  outputUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

interface ExportProgressProps {
  jobId?: string;
  clipId?: string;
  autoRefresh?: boolean;
}

export const ExportProgress = ({ jobId, clipId, autoRefresh = true }: ExportProgressProps) => {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobs();

    if (autoRefresh) {
      const interval = setInterval(loadJobs, 3000); // Poll every 3 seconds
      return () => clearInterval(interval);
    }
  }, [jobId, clipId, autoRefresh]);

  const loadJobs = async () => {
    try {
      let query = supabase
        .from('export_jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (jobId) {
        query = query.eq('id', jobId);
      } else if (clipId) {
        query = query.eq('clip_id', clipId);
      } else {
        query = query.limit(10);
      }

      const { data, error } = await query;

      if (error) throw error;

      setJobs(data || []);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load export jobs:', err);
      setLoading(false);
    }
  };

  const getStatusColor = (status: ExportJob['status']) => {
    switch (status) {
      case 'completed': return '#4ECDC4';
      case 'failed': return '#ff6b6b';
      case 'processing': return '#FFA07A';
      case 'pending': return '#aaa';
      default: return '#666';
    }
  };

  const getStatusIcon = (status: ExportJob['status']) => {
    switch (status) {
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'processing': return '⚙️';
      case 'pending': return '⏳';
      default: return '❓';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const downloadVideo = async (url: string, jobId: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `export-${jobId}.mp4`;
    link.click();
  };

  if (loading) {
    return (
      <div style={{
        padding: '24px',
        textAlign: 'center',
        color: '#aaa',
      }}>
        Loading export jobs...
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div style={{
        padding: '24px',
        textAlign: 'center',
        color: '#aaa',
      }}>
        No export jobs found
      </div>
    );
  }

  return (
    <div style={{
      background: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #333',
        background: '#0a0a0a',
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#fff',
        }}>
          Export Jobs {autoRefresh && '(Auto-refreshing)'}
        </h3>
      </div>

      <div style={{ padding: '16px' }}>
        {jobs.map(job => (
          <div
            key={job.id}
            style={{
              padding: '16px',
              background: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '6px',
              marginBottom: '12px',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>{getStatusIcon(job.status)}</span>
                <span style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: getStatusColor(job.status),
                  textTransform: 'uppercase',
                }}>
                  {job.status}
                </span>
              </div>
              <span style={{ fontSize: '12px', color: '#666' }}>
                {formatDate(job.createdAt)}
              </span>
            </div>

            {/* Progress Bar */}
            {(job.status === 'pending' || job.status === 'processing') && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                }}>
                  <span style={{ fontSize: '12px', color: '#aaa' }}>Progress</span>
                  <span style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold' }}>
                    {job.progress}%
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  background: '#1a1a1a',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${job.progress}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #4ECDC4 0%, #45B7D1 100%)',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
            )}

            {/* Configuration Details */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '8px',
              marginBottom: '12px',
            }}>
              <div style={{ fontSize: '12px' }}>
                <span style={{ color: '#666' }}>Format: </span>
                <span style={{ color: '#fff', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  {job.config.format}
                </span>
              </div>
              <div style={{ fontSize: '12px' }}>
                <span style={{ color: '#666' }}>Resolution: </span>
                <span style={{ color: '#fff', fontWeight: 'bold' }}>
                  {job.config.resolution}
                </span>
              </div>
              <div style={{ fontSize: '12px' }}>
                <span style={{ color: '#666' }}>FPS: </span>
                <span style={{ color: '#fff', fontWeight: 'bold' }}>
                  {job.config.fps}
                </span>
              </div>
            </div>

            {/* Features */}
            <div style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              marginBottom: '12px',
            }}>
              {job.config.includeOverlays && (
                <span style={{
                  padding: '4px 8px',
                  background: '#1a3a3a',
                  border: '1px solid #2a4a4a',
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: '#4ECDC4',
                }}>
                  🎯 Overlays
                </span>
              )}
              {job.config.includeCommentary && (
                <span style={{
                  padding: '4px 8px',
                  background: '#1a3a3a',
                  border: '1px solid #2a4a4a',
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: '#4ECDC4',
                }}>
                  🎙️ Commentary
                </span>
              )}
              {job.config.includeMusic && (
                <span style={{
                  padding: '4px 8px',
                  background: '#1a3a3a',
                  border: '1px solid #2a4a4a',
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: '#4ECDC4',
                }}>
                  🎵 Music
                </span>
              )}
            </div>

            {/* Error Message */}
            {job.status === 'failed' && job.error && (
              <div style={{
                padding: '8px 12px',
                background: '#3a1a1a',
                border: '1px solid #6a2a2a',
                borderRadius: '4px',
                marginBottom: '12px',
              }}>
                <span style={{ fontSize: '12px', color: '#ff6b6b' }}>
                  Error: {job.error}
                </span>
              </div>
            )}

            {/* Download Button */}
            {job.status === 'completed' && job.outputUrl && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => window.open(job.outputUrl, '_blank')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'linear-gradient(135deg, #4ECDC4 0%, #45B7D1 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  🎬 View Video
                </button>
                <button
                  onClick={() => downloadVideo(job.outputUrl!, job.id)}
                  style={{
                    padding: '10px 16px',
                    background: '#2a2a2a',
                    color: '#fff',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  ⬇️ Download
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
