// Edge Function: Detect Players in Video using Reka.ai Vision API

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BoundingBox {
  frame: number;
  timestamp: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

interface PlayerDetection {
  player_id: string | null;
  jersey_number: number | null;
  boxes: BoundingBox[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { video_id } = await req.json();

    if (!video_id) {
      throw new Error('video_id is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get video details
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', video_id)
      .single();

    if (videoError) throw videoError;

    // Update job status to processing
    const { data: job } = await supabase
      .from('jobs')
      .insert({
        user_id: video.user_id,
        video_id: video_id,
        job_type: 'player_detection',
        status: 'processing',
        progress: 0,
      })
      .select()
      .single();

    // Get signed URL for video
    const { data: signedUrlData } = await supabase
      .storage
      .from('videos')
      .createSignedUrl(video.storage_path, 3600); // 1 hour expiry

    if (!signedUrlData) {
      throw new Error('Failed to get signed URL for video');
    }

    const videoUrl = signedUrlData.signedUrl;

    // Call Reka Vision API
    const rekaApiKey = Deno.env.get('REKA_API_KEY');
    if (!rekaApiKey) {
      throw new Error('REKA_API_KEY not configured');
    }

    console.log('Calling Reka API for video:', video_id);

    const rekaResponse = await fetch('https://api.reka.ai/v1/qa/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${rekaApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_url: videoUrl,
        question: `Analyze this sports video and detect all players on the field. For each player:
1. Track their position throughout the video with bounding boxes (x, y, width, height) for every frame they appear
2. Try to identify their jersey number if visible
3. Provide confidence scores for each detection
4. Return data in JSON format with this structure:
{
  "players": [
    {
      "id": "player_1",
      "jersey_number": 10,
      "frames": [
        {"frame": 0, "timestamp": 0.0, "x": 100, "y": 200, "width": 50, "height": 120, "confidence": 0.95}
      ]
    }
  ]
}`,
      }),
    });

    if (!rekaResponse.ok) {
      const errorText = await rekaResponse.text();
      throw new Error(`Reka API error: ${errorText}`);
    }

    const rekaData = await rekaResponse.json();

    // Update job progress
    await supabase
      .from('jobs')
      .update({ progress: 50 })
      .eq('id', job.id);

    // Process Reka response and extract player detections
    const detections = parseRekaResponse(rekaData);

    // Store tracking data for each detected player
    for (const detection of detections) {
      // Create or get player profile
      let playerId = detection.player_id;

      if (!playerId && detection.jersey_number) {
        // Try to find existing player by jersey number
        const { data: existingPlayer } = await supabase
          .from('players')
          .select('id')
          .eq('user_id', video.user_id)
          .eq('number', detection.jersey_number)
          .maybeSingle();

        if (existingPlayer) {
          playerId = existingPlayer.id;
        } else {
          // Create new player profile
          const { data: newPlayer } = await supabase
            .from('players')
            .insert({
              user_id: video.user_id,
              name: `Player #${detection.jersey_number}`,
              number: detection.jersey_number,
              stats: {},
            })
            .select()
            .single();

          playerId = newPlayer?.id || null;
        }
      }

      // Store video tracking data
      const { error: trackError } = await supabase
        .from('video_tracks')
        .insert({
          video_id: video_id,
          player_id: playerId,
          detection_method: 'ai',
          frame_data: detection.boxes,
        });

      if (trackError) {
        console.error('Error storing track data:', trackError);
      }
    }

    // Update job to completed
    await supabase
      .from('jobs')
      .update({
        status: 'completed',
        progress: 100,
        result: {
          players_detected: detections.length,
          total_frames: detections[0]?.boxes.length || 0,
        },
      })
      .eq('id', job.id);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        players_detected: detections.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in detect-players:', error);

    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Helper function to parse Reka API response
function parseRekaResponse(rekaData: any): PlayerDetection[] {
  // Parse JSON from Reka's text response
  const responseText = rekaData.choices?.[0]?.message?.content || rekaData.answer || '';

  try {
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      if (parsed.players && Array.isArray(parsed.players)) {
        return parsed.players.map((p: any) => ({
          player_id: null,
          jersey_number: p.jersey_number || null,
          boxes: p.frames || [],
        }));
      }
    }
  } catch (e) {
    console.error('Failed to parse Reka response as JSON:', e);
  }

  // Fallback: return empty array
  return [];
}
