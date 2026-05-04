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

    // Multi-segment clipping: split long sports_analysis videos into ~4-min windows
    // so Reka's 3-clip-per-call cap doesn't lose highlights from later in the match.
    // Skipped when caller already specified an explicit segment_start/end (short-form).
    const SEGMENT_TARGET_SECONDS = 240
    const explicitSegment = settings?.segment_start !== undefined && settings?.segment_end !== undefined
    const duration = video.duration_seconds || 0
    const useMultiSegment =
      processingMode === 'sports_analysis' &&
      !explicitSegment &&
      duration > SEGMENT_TARGET_SECONDS

    type Segment = { start: number; end: number }
    const segments: Segment[] = []
    if (useMultiSegment) {
      const n = Math.ceil(duration / SEGMENT_TARGET_SECONDS)
      const windowSize = duration / n
      for (let i = 0; i < n; i++) {
        segments.push({
          start: Math.floor(i * windowSize),
          end: i === n - 1 ? Math.floor(duration) : Math.floor((i + 1) * windowSize),
        })
      }
      console.log(`[Multi-segment] duration=${duration}s → ${n} windows:`, segments)
    }

    if (useMultiSegment) {
      const baseRequest = clipRequest
      const calls = segments.map(async (seg) => {
        const segRequest = {
          ...baseRequest,
          generation_config: {
            ...baseRequest.generation_config,
            source_start_time: seg.start,
            source_end_time: seg.end,
          },
        }
        try {
          const resp = await rekaClient.generateClips(segRequest)
          console.log(`[Reka] Segment ${seg.start}-${seg.end}s started: ${resp.id} (status=${resp.status})`)
          return { ok: true as const, segment: seg, id: resp.id, status: resp.status }
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e)
          console.error(`[Reka] Segment ${seg.start}-${seg.end}s failed:`, errMsg)
          return { ok: false as const, segment: seg, error: errMsg }
        }
      })
      const settled = await Promise.all(calls)
      const successes = settled.filter((r) => r.ok)
      const failures = settled.filter((r) => !r.ok)

      if (successes.length === 0) {
        const errSummary = failures.map((f) => `${f.segment.start}-${f.segment.end}s: ${f.error}`).join('; ')
        await supabase
          .from('jobs')
          .update({
            status: 'failed',
            error: `All ${segments.length} Reka segment calls failed: ${errSummary}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)
        await supabase.from('videos').update({ status: 'uploaded' }).eq('id', videoId)
        throw new Error(`All segments failed: ${errSummary}`)
      }

      const rekaClipIds = successes.map((s) => ({
        id: s.id,
        start: s.segment.start,
        end: s.segment.end,
        status: s.status,
      }))

      const { error: updateErr } = await supabase
        .from('jobs')
        .update({
          metadata: {
            ...job.metadata,
            reka_clip_ids: rekaClipIds,
            reka_status: 'processing',
            multi_segment: true,
            segment_failures: failures.length > 0 ? failures.map((f) => ({ segment: f.segment, error: f.error })) : undefined,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
      if (updateErr) {
        console.error(`[Job ${job.id}] Failed to persist reka_clip_ids:`, updateErr.message)
      }

      return new Response(
        JSON.stringify({
          success: true,
          jobId: job.id,
          multiSegment: true,
          segments: rekaClipIds,
          failedSegments: failures.length,
          message: `Clip generation started across ${successes.length}/${segments.length} segments.`,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
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
