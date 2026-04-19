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
      // For uploaded files, get public URL from Supabase Storage
      const { data: publicUrlData } = supabase.storage
        .from('video-uploads')
        .getPublicUrl(video.storage_path)

      if (!publicUrlData?.publicUrl) {
        throw new Error('Failed to generate public URL for uploaded video')
      }

      videoUrl = publicUrlData.publicUrl
      console.log(`[Storage] Using public URL: ${videoUrl}`)
    } else if (video.source_url) {
      // For YouTube/Twitch, use source URL directly
      videoUrl = video.source_url
      console.log(`[${video.source_type}] Using source URL: ${videoUrl}`)
    } else {
      throw new Error('Video has no valid URL or storage path')
    }

    // Generate clips with Reka
    const clipRequest = {
      video_urls: [videoUrl],
      template: settings?.template || 'moments',
      num_generations: Math.min(settings?.num_clips || 3, 3), // Max 3
      aspect_ratio: settings?.aspect_ratio || '9:16',
      resolution: settings?.resolution || 720,
      prompt: settings?.prompt,
    }

    console.log('[Reka] Sending clip generation request:', clipRequest)

    const clipResponse = await rekaClient.generateClips(clipRequest)

    console.log(`[Reka] Clip generation started: ${clipResponse.id}`)

    // Update job with Reka clip ID
    await supabase
      .from('jobs')
      .update({
        metadata: {
          ...job.metadata,
          reka_clip_id: clipResponse.id,
          reka_status: clipResponse.status,
        },
      })
      .eq('id', job.id)

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
