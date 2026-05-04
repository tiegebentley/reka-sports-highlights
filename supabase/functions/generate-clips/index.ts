import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { RekaClient } from '../_shared/reka-client.ts'

interface GenerateClipsRequest {
  videoId: string
  settings?: {
    template?: 'moments' | 'compilation'
    num_clips?: number
    aspect_ratio?: '9:16' | '16:9' | '4:5' | '1:1'
    resolution?: number
    prompt?: string
    // For short-form mode: manual segment selection
    segment_start?: number
    segment_end?: number
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type, apikey',
      },
    })
  }

  try {
    const { videoId, settings }: GenerateClipsRequest = await req.json()

    if (!videoId) {
      throw new Error('videoId is required')
    }

    // Initialize database client
    // Note: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are reserved and automatically provided
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const rekaApiKey = Deno.env.get('REKA_API_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration (reserved variables not found)')
    }

    if (!rekaApiKey) {
      throw new Error('Missing Reka API key')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const rekaClient = new RekaClient(rekaApiKey)

    // Get video from database
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single()

    if (videoError || !video) {
      throw new Error(`Video not found: ${videoError?.message || 'Unknown error'}`)
    }

    // Clear prior clips for this video so regeneration replaces rather than accumulates
    const { error: deleteClipsError } = await supabase
      .from('clips')
      .delete()
      .eq('video_id', videoId)
    if (deleteClipsError) {
      console.warn(`Failed to clear prior clips for video ${videoId}:`, deleteClipsError.message)
    }

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        user_id: video.user_id,
        video_id: videoId,
        job_type: 'clip_generation',
        status: 'processing',
        metadata: {
          settings,
          started_at: new Date().toISOString(),
        },
      })
      .select()
      .single()

    if (jobError || !job) {
      throw new Error(`Failed to create job: ${jobError?.message || 'Unknown error'}`)
    }

    console.log(`[Job ${job.id}] Starting clip generation for video ${videoId}`)

    // Determine video URL for Reka
    let videoUrl: string

    if (video.source_type === 'upload' && video.storage_path) {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('video-uploads')
        .createSignedUrl(video.storage_path, 60 * 60 * 6)

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error(`Failed to generate signed URL for uploaded video: ${signedUrlError?.message ?? 'unknown error'}`)
      }

      videoUrl = signedUrlData.signedUrl
      console.log(`[Storage] Using signed URL (6h TTL)`)
    } else if (video.source_url) {
      // For YouTube/Twitch, use source URL directly
      videoUrl = video.source_url
      console.log(`[${video.source_type}] Using source URL: ${videoUrl}`)
    } else {
      throw new Error('Video has no valid URL or storage path')
    }

    // Get processing mode from video (defaults to sports_analysis for backward compatibility)
    const processingMode = video.processing_mode || 'sports_analysis'

    // Determine aspect ratio based on mode and settings
    let aspectRatio = settings?.aspect_ratio || '9:16'
    if (processingMode === 'short_form' && !settings?.aspect_ratio) {
      // For short-form without explicit settings, this will be set per-clip by the frontend
      aspectRatio = '9:16' // default
    }

    // Generate clips with Reka
    // NB: Reka expects generation_config / rendering_config as nested objects.
    // Flat top-level keys (other than video_urls/prompt) are silently ignored.
    const clipRequest: any = {
      video_urls: [videoUrl],
      prompt: settings?.prompt || (processingMode === 'sports_analysis'
        ? 'Detect key moments, player highlights, and important game events'
        : undefined),
      generation_config: {
        template: processingMode === 'sports_analysis' ? (settings?.template || 'moments') : 'moments',
        num_generations: Math.min(settings?.num_clips || 3, 3), // Reka caps at 3 per request
        max_duration_seconds: settings?.max_duration_seconds || 90,
      },
      rendering_config: {
        aspect_ratio: aspectRatio,
        resolution: settings?.resolution || 720,
        subtitles: settings?.subtitles ?? true,
      },
    }

    // For short-form mode with manual segment selection
    if (processingMode === 'short_form' && settings?.segment_start !== undefined && settings?.segment_end !== undefined) {
      clipRequest.generation_config.source_start_time = settings.segment_start
      clipRequest.generation_config.source_end_time = settings.segment_end
      console.log(`[Short-form] Using segment: ${settings.segment_start}s - ${settings.segment_end}s`)
    }

    console.log(`[Reka] Sending clip generation request (${processingMode} mode):`, JSON.stringify(clipRequest))

    let clipResponse
    try {
      clipResponse = await rekaClient.generateClips(clipRequest)
    } catch (rekaErr) {
      const errMsg = rekaErr instanceof Error ? rekaErr.message : String(rekaErr)
      console.error(`[Reka] generateClips threw: ${errMsg}`)
      await supabase
        .from('jobs')
        .update({
          status: 'failed',
          error: `Reka request failed: ${errMsg}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
      await supabase
        .from('videos')
        .update({ status: 'uploaded' })
        .eq('id', videoId)
      throw rekaErr
    }

    console.log(`[Reka] Clip generation started: ${clipResponse.id} (status=${clipResponse.status})`)

    // Update job with Reka clip ID — critical for poll-clip-jobs to find this job
    const { error: updateErr } = await supabase
      .from('jobs')
      .update({
        metadata: {
          ...job.metadata,
          reka_clip_id: clipResponse.id,
          reka_status: clipResponse.status,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
    if (updateErr) {
      console.error(`[Job ${job.id}] Failed to persist reka_clip_id ${clipResponse.id}:`, updateErr.message)
    }

    // Note: Polling is handled by a separate worker/scheduled function
    // to avoid blocking this request. The client should poll the job status.

    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        rekaClipId: clipResponse.id,
        status: clipResponse.status,
        message: 'Clip generation started. Poll the job status to check progress.',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    console.error('[Error]', error)

    const errorMessage = error instanceof Error ? error.message : String(error)

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})
