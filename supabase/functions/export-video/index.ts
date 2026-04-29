import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExportRequest {
  clipId: string;
  config: {
    format: 'mp4' | 'webm' | 'mov';
    resolution: '1080p' | '720p' | '480p';
    fps: 30 | 60;
    includeOverlays: boolean;
    includeCommentary: boolean;
    includeMusic: boolean;
    transitions?: 'fade' | 'slide' | 'none';
    musicUrl?: string;
    musicVolume?: number;
    introText?: string;
    outroText?: string;
  };
}

interface ExportJob {
  id: string;
  clipId: string;
  userId: string;
  config: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  outputUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

const RESOLUTION_MAP = {
  '1080p': { width: 1920, height: 1080 },
  '720p': { width: 1280, height: 720 },
  '480p': { width: 854, height: 480 },
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { clipId, config }: ExportRequest = await req.json();

    if (!clipId || !config) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: clipId, config' }),
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

    // Get clip details
    const { data: clip, error: clipError } = await supabase
      .from('clips')
      .select('*, videos(storage_path)')
      .eq('id', clipId)
      .single();

    if (clipError || !clip) {
      return new Response(
        JSON.stringify({ error: 'Clip not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create export job
    const { data: exportJob, error: jobError } = await supabase
      .from('export_jobs')
      .insert({
        clip_id: clipId,
        user_id: user.id,
        config,
        status: 'pending',
        progress: 0,
      })
      .select()
      .single();

    if (jobError) {
      console.error('Failed to create export job:', jobError);
      return new Response(
        JSON.stringify({ error: 'Failed to create export job' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Start processing asynchronously
    processExport(exportJob.id, clip, config, supabase).catch(err => {
      console.error('Export processing error:', err);
    });

    return new Response(
      JSON.stringify({
        success: true,
        jobId: exportJob.id,
        message: 'Export job created. Processing will begin shortly.',
      }),
      {
        status: 202,
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

async function processExport(
  jobId: string,
  clip: any,
  config: ExportRequest['config'],
  supabase: any
) {
  try {
    // Update status to processing
    await supabase
      .from('export_jobs')
      .update({ status: 'processing', progress: 10 })
      .eq('id', jobId);

    // Get video file from storage
    const { data: videoData, error: downloadError } = await supabase.storage
      .from('videos')
      .download(clip.videos.storage_path);

    if (downloadError) throw downloadError;

    const videoBuffer = await videoData.arrayBuffer();
    const inputPath = `/tmp/input_${jobId}.mp4`;
    const outputPath = `/tmp/output_${jobId}.${config.format}`;

    // Write input video to temp file
    await Deno.writeFile(inputPath, new Uint8Array(videoBuffer));

    // Update progress
    await supabase
      .from('export_jobs')
      .update({ progress: 30 })
      .eq('id', jobId);

    // Build FFmpeg command
    const resolution = RESOLUTION_MAP[config.resolution];
    const ffmpegArgs = [
      '-i', inputPath,
      '-vf', `scale=${resolution.width}:${resolution.height}`,
      '-r', config.fps.toString(),
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
    ];

    // Add commentary audio if requested
    if (config.includeCommentary) {
      const { data: commentary } = await supabase
        .from('commentary_tracks')
        .select('audio_url')
        .eq('clip_id', clip.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (commentary?.audio_url) {
        // Download commentary audio
        const audioResponse = await fetch(commentary.audio_url);
        const audioBuffer = await audioResponse.arrayBuffer();
        const audioPath = `/tmp/commentary_${jobId}.mp3`;
        await Deno.writeFile(audioPath, new Uint8Array(audioBuffer));

        ffmpegArgs.push('-i', audioPath);
        ffmpegArgs.push('-filter_complex', '[0:a][1:a]amix=inputs=2:duration=first[aout]');
        ffmpegArgs.push('-map', '0:v', '-map', '[aout]');
      }
    }

    // Add music if requested
    if (config.includeMusic && config.musicUrl) {
      // Download background music
      const musicResponse = await fetch(config.musicUrl);
      const musicBuffer = await musicResponse.arrayBuffer();
      const musicPath = `/tmp/music_${jobId}.mp3`;
      await Deno.writeFile(musicPath, new Uint8Array(musicBuffer));

      const musicVolume = config.musicVolume || 0.3;
      ffmpegArgs.push('-i', musicPath);
      ffmpegArgs.push(
        '-filter_complex',
        `[1:a]volume=${musicVolume}[music];[0:a][music]amix=inputs=2:duration=first[aout]`
      );
      ffmpegArgs.push('-map', '0:v', '-map', '[aout]');
    }

    // Output settings
    ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k');
    ffmpegArgs.push('-movflags', '+faststart'); // Web optimization
    ffmpegArgs.push('-y'); // Overwrite output
    ffmpegArgs.push(outputPath);

    // Update progress
    await supabase
      .from('export_jobs')
      .update({ progress: 50 })
      .eq('id', jobId);

    // Run FFmpeg (Note: FFmpeg must be available in the Deno environment)
    // For production, use a Docker image with FFmpeg installed
    const process = new Deno.Command('ffmpeg', { args: ffmpegArgs });
    const { code, stdout, stderr } = await process.output();

    if (code !== 0) {
      const errorText = new TextDecoder().decode(stderr);
      throw new Error(`FFmpeg failed: ${errorText}`);
    }

    // Update progress
    await supabase
      .from('export_jobs')
      .update({ progress: 80 })
      .eq('id', jobId);

    // Read output file
    const outputBuffer = await Deno.readFile(outputPath);

    // Upload to storage
    const outputFileName = `exports/${clip.id}/${jobId}.${config.format}`;
    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(outputFileName, outputBuffer, {
        contentType: `video/${config.format}`,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(outputFileName);

    // Update job as completed
    await supabase
      .from('export_jobs')
      .update({
        status: 'completed',
        progress: 100,
        output_url: urlData.publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    // Cleanup temp files
    try {
      await Deno.remove(inputPath);
      await Deno.remove(outputPath);
    } catch (err) {
      console.warn('Cleanup error:', err);
    }

  } catch (error) {
    console.error('Processing error:', error);

    // Update job as failed
    await supabase
      .from('export_jobs')
      .update({
        status: 'failed',
        error: error.message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }
}
