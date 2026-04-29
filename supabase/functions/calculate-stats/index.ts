import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrackPoint {
  frame: number;
  timestamp: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PlayerTrack {
  playerId: string;
  points: TrackPoint[];
}

interface StatsRequest {
  videoId: string;
  clipId?: string;
  calculateHeatmaps?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { videoId, clipId, calculateHeatmaps = true }: StatsRequest = await req.json();

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: videoId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify video ownership
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('id, duration, fps')
      .eq('id', videoId)
      .eq('user_id', user.id)
      .single();

    if (videoError || !video) {
      return new Response(
        JSON.stringify({ error: 'Video not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all tracking data for this video
    const { data: tracks, error: tracksError } = await supabase
      .from('video_tracks')
      .select(`
        id,
        player_id,
        track_data,
        players (
          id,
          name,
          number
        )
      `)
      .eq('video_id', videoId);

    if (tracksError) {
      throw tracksError;
    }

    if (!tracks || tracks.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No tracking data found for this video',
          stats: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate stats for each player
    const playerStats = [];
    const heatmaps = [];

    for (const track of tracks) {
      const playerId = track.player_id;
      const trackData = track.track_data as TrackPoint[];

      if (!trackData || trackData.length === 0) {
        continue;
      }

      // Calculate movement stats
      const movementStats = calculateMovementStats(trackData, video.fps);

      // Calculate possession stats (simplified - based on tracking presence)
      const possessionStats = calculatePossessionStats(trackData, video.duration);

      // Create player stats record
      const stats = {
        player_id: playerId,
        video_id: videoId,
        clip_id: clipId || null,
        time_played_seconds: Math.round(trackData.length / (video.fps || 30)),
        touches: trackData.length, // Each tracked frame = potential touch
        distance_covered_meters: movementStats.totalDistance,
        average_speed_kmh: movementStats.averageSpeed,
        max_speed_kmh: movementStats.maxSpeed,
        sprints: movementStats.sprints,
        possession_seconds: possessionStats.possessionTime,
        // Other stats would come from manual input or advanced AI analysis
        goals: 0,
        assists: 0,
        shots: 0,
        shots_on_target: 0,
        passes_attempted: 0,
        passes_completed: 0,
        key_passes: 0,
        dribbles_attempted: 0,
        dribbles_successful: 0,
        tackles: 0,
        interceptions: 0,
        clearances: 0,
        blocks: 0,
        dispossessed: 0,
        fouls_committed: 0,
        fouls_won: 0,
      };

      // Insert or update player stats
      const { data: insertedStats, error: statsError } = await supabase
        .from('player_stats')
        .upsert(stats, {
          onConflict: 'player_id,video_id',
        })
        .select()
        .single();

      if (statsError) {
        console.error('Failed to insert player stats:', statsError);
      } else {
        playerStats.push(insertedStats);
      }

      // Calculate heatmap if requested
      if (calculateHeatmaps) {
        const heatmapData = generateHeatmap(trackData);

        const { data: insertedHeatmap, error: heatmapError } = await supabase
          .from('player_heatmaps')
          .insert({
            player_id: playerId,
            video_id: videoId,
            heatmap_data: heatmapData,
            grid_width: 100,
            grid_height: 100,
            max_intensity: Math.max(...Object.values(heatmapData as Record<string, number>)),
          })
          .select()
          .single();

        if (heatmapError) {
          console.error('Failed to insert heatmap:', heatmapError);
        } else {
          heatmaps.push(insertedHeatmap);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Calculated stats for ${playerStats.length} players`,
        playerStats,
        heatmaps: calculateHeatmaps ? heatmaps : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Calculate movement statistics from tracking data
 */
function calculateMovementStats(trackData: TrackPoint[], fps: number = 30) {
  let totalDistance = 0;
  let maxSpeed = 0;
  let sprints = 0;
  const speeds: number[] = [];

  const SPRINT_THRESHOLD_KMH = 20; // Speed threshold for counting as a sprint
  const PITCH_WIDTH_METERS = 68; // Standard soccer pitch width
  const PITCH_HEIGHT_METERS = 105; // Standard soccer pitch height

  for (let i = 1; i < trackData.length; i++) {
    const prev = trackData[i - 1];
    const curr = trackData[i];

    // Calculate distance in normalized coordinates (0-1)
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const normalizedDistance = Math.sqrt(dx * dx + dy * dy);

    // Convert to meters (assuming standard pitch dimensions)
    const distanceMeters = normalizedDistance * Math.sqrt(
      PITCH_WIDTH_METERS * PITCH_WIDTH_METERS +
      PITCH_HEIGHT_METERS * PITCH_HEIGHT_METERS
    );

    totalDistance += distanceMeters;

    // Calculate speed (km/h)
    const timeDelta = (curr.timestamp - prev.timestamp) || (1 / fps);
    const speedKmh = (distanceMeters / timeDelta) * 3.6; // m/s to km/h

    speeds.push(speedKmh);

    if (speedKmh > maxSpeed) {
      maxSpeed = speedKmh;
    }

    if (speedKmh > SPRINT_THRESHOLD_KMH) {
      sprints++;
    }
  }

  const averageSpeed = speeds.length > 0
    ? speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length
    : 0;

  return {
    totalDistance: Math.round(totalDistance * 100) / 100,
    averageSpeed: Math.round(averageSpeed * 100) / 100,
    maxSpeed: Math.round(maxSpeed * 100) / 100,
    sprints,
  };
}

/**
 * Calculate possession statistics
 */
function calculatePossessionStats(trackData: TrackPoint[], videoDuration: number) {
  // Simplified: time tracked = time in possession
  const possessionTime = trackData.length > 0
    ? trackData[trackData.length - 1].timestamp - trackData[0].timestamp
    : 0;

  return {
    possessionTime: Math.round(possessionTime),
  };
}

/**
 * Generate heatmap from tracking data
 */
function generateHeatmap(trackData: TrackPoint[]): Record<string, number> {
  const GRID_SIZE = 100;
  const heatmap: Record<string, number> = {};

  for (const point of trackData) {
    // Convert normalized coordinates (0-1) to grid coordinates
    const gridX = Math.floor(point.x * GRID_SIZE);
    const gridY = Math.floor(point.y * GRID_SIZE);

    // Clamp to grid bounds
    const clampedX = Math.max(0, Math.min(GRID_SIZE - 1, gridX));
    const clampedY = Math.max(0, Math.min(GRID_SIZE - 1, gridY));

    const key = `${clampedX}_${clampedY}`;
    heatmap[key] = (heatmap[key] || 0) + 1;
  }

  return heatmap;
}
