import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { TrackingEditor } from '../components/tracking/TrackingEditor';
import type { EditableBoundingBox, PlayerProfile } from '../types/tracking';

interface VideoTrackData {
  id: string;
  video_id: string;
  player_id: string | null;
  detection_method: 'ai' | 'manual';
  frame_data: Array<{
    frame: number;
    timestamp: number;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }>;
}

interface PlayerData {
  id: string;
  name: string;
  number?: number;
  photo_url?: string;
  team_id?: string;
}

export const TrackingStudio = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [boxes, setBoxes] = useState<EditableBoundingBox[]>([]);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load video and tracking data
  useEffect(() => {
    const loadData = async () => {
      if (!videoId) {
        setError('No video ID provided');
        setLoading(false);
        return;
      }

      try {
        // Get video details
        const { data: video, error: videoError } = await supabase
          .from('videos')
          .select('*')
          .eq('id', videoId)
          .single();

        if (videoError) throw videoError;

        // Get signed URL for video
        const { data: signedUrlData } = await supabase
          .storage
          .from('videos')
          .createSignedUrl(video.storage_path, 3600); // 1 hour

        if (signedUrlData) {
          setVideoUrl(signedUrlData.signedUrl);
        }

        // Get existing tracking data
        const { data: trackData, error: trackError } = await supabase
          .from('video_tracks')
          .select('*')
          .eq('video_id', videoId);

        if (trackError) throw trackError;

        // Get players
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;

        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('*')
          .eq('user_id', userId);

        if (playerError) throw playerError;

        // Convert tracking data to editable boxes
        const editableBoxes: EditableBoundingBox[] = [];
        const colorPalette = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
        let colorIndex = 0;

        (trackData as VideoTrackData[]).forEach(track => {
          track.frame_data.forEach(box => {
            editableBoxes.push({
              id: `box-${track.id}-${box.frame}`,
              frame: box.frame,
              timestamp: box.timestamp,
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
              confidence: box.confidence,
              playerId: track.player_id,
            });
          });
        });

        // Convert players to profiles
        const playerProfiles: PlayerProfile[] = (playerData as PlayerData[]).map(player => ({
          id: player.id,
          name: player.name,
          number: player.number,
          photoUrl: player.photo_url,
          teamId: player.team_id,
          color: colorPalette[colorIndex++ % colorPalette.length],
        }));

        setBoxes(editableBoxes);
        setPlayers(playerProfiles);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load tracking data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setLoading(false);
      }
    };

    loadData();
  }, [videoId]);

  // Save tracking data
  const handleSave = async (updatedBoxes: EditableBoundingBox[], updatedPlayers: PlayerProfile[]) => {
    if (!videoId) throw new Error('No video ID');

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error('Not authenticated');

    try {
      // 1. Save/update players
      for (const player of updatedPlayers) {
        // Check if player exists
        const { data: existingPlayer } = await supabase
          .from('players')
          .select('id')
          .eq('id', player.id)
          .maybeSingle();

        if (existingPlayer) {
          // Update existing player
          await supabase
            .from('players')
            .update({
              name: player.name,
              number: player.number,
              photo_url: player.photoUrl,
              team_id: player.teamId,
            })
            .eq('id', player.id);
        } else {
          // Create new player
          await supabase
            .from('players')
            .insert({
              id: player.id,
              user_id: userId,
              name: player.name,
              number: player.number,
              photo_url: player.photoUrl,
              team_id: player.teamId,
              stats: {},
            });
        }
      }

      // 2. Group boxes by player and save as tracks
      const boxesByPlayer = updatedBoxes.reduce((acc, box) => {
        const playerId = box.playerId || 'unassigned';
        if (!acc[playerId]) acc[playerId] = [];
        acc[playerId].push(box);
        return acc;
      }, {} as Record<string, EditableBoundingBox[]>);

      // Delete existing tracks for this video
      await supabase
        .from('video_tracks')
        .delete()
        .eq('video_id', videoId);

      // Insert new tracks
      for (const [playerId, playerBoxes] of Object.entries(boxesByPlayer)) {
        const frameData = playerBoxes.map(box => ({
          frame: box.frame,
          timestamp: box.timestamp,
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          confidence: box.confidence,
        }));

        await supabase
          .from('video_tracks')
          .insert({
            video_id: videoId,
            player_id: playerId === 'unassigned' ? null : playerId,
            detection_method: 'manual', // Mark as manually edited
            frame_data: frameData,
          });
      }

      alert('Tracking data saved successfully!');
    } catch (err) {
      console.error('Failed to save:', err);
      throw err;
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0a0a0a',
        color: '#fff'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
          <div>Loading tracking studio...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0a0a0a',
        color: '#fff'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
          <div style={{ fontSize: '18px', marginBottom: '16px' }}>{error}</div>
          <button
            onClick={() => navigate('/library')}
            style={{
              padding: '12px 24px',
              background: '#4ECDC4',
              color: '#0a0a0a',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  if (!videoUrl) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0a0a0a',
        color: '#fff'
      }}>
        <div>Failed to load video</div>
      </div>
    );
  }

  return (
    <TrackingEditor
      videoUrl={videoUrl}
      initialBoxes={boxes}
      initialPlayers={players}
      onSave={handleSave}
      videoId={videoId}
    />
  );
};
