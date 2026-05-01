import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface UploadVideoRequest {
  title: string
  sourceType: 'upload' | 'youtube' | 'twitch'
  sourceUrl?: string
  fileName?: string
  processingMode?: 'sports_analysis' | 'short_form'
  aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9'
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
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')

    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      )
    }

    // Initialize database client with user context
    // Note: SUPABASE_URL and SUPABASE_ANON_KEY are reserved and automatically provided
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase configuration (reserved variables not found)')
    }

    // Client for user operations (with user auth context)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Client for admin operations (storage operations bypass RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: `Unauthorized: ${authError?.message || 'No user found'}` }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      )
    }

    const { title, sourceType, sourceUrl, fileName, processingMode, aspectRatio }: UploadVideoRequest = await req.json()

    if (!title || !sourceType) {
      throw new Error('Missing required fields: title, sourceType')
    }

    // Set defaults for new fields
    const finalProcessingMode = processingMode || 'sports_analysis'
    const finalAspectRatio = aspectRatio || '9:16'

    // Validate based on source type
    if (sourceType !== 'upload' && !sourceUrl) {
      throw new Error('sourceUrl is required for YouTube/Twitch videos')
    }

    if (sourceType === 'upload' && !fileName) {
      throw new Error('fileName is required for direct uploads')
    }

    let storagePath = null
    let videoUrl = sourceUrl

    // For direct uploads, generate signed upload URL
    if (sourceType === 'upload' && fileName) {
      const timestamp = Date.now()
      const fileExtension = fileName.split('.').pop()
      storagePath = `${user.id}/${timestamp}_${fileName}`

      // Create a signed upload URL (valid for 60 minutes)
      // Use admin client to bypass RLS on storage operations
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('video-uploads')
        .createSignedUploadUrl(storagePath, {
          upsert: false,
        })

      if (uploadError) {
        console.error('[Storage Error]', uploadError)
        throw new Error(`Failed to create upload URL: ${uploadError.message}`)
      }

      // Get the public URL for the uploaded file (after upload completes)
      const { data: publicUrlData } = supabaseAdmin.storage
        .from('video-uploads')
        .getPublicUrl(storagePath)

      videoUrl = publicUrlData.publicUrl
    }

    // Create video record in database
    console.log('[Database Insert] Attempting to insert video record:', {
      user_id: user.id,
      title,
      source_type: sourceType,
      source_url: videoUrl,
      storage_path: storagePath,
      status: 'uploaded',
      processing_mode: finalProcessingMode,
    })

    const { data: video, error: videoError } = await supabase
      .from('videos')
      .insert({
        user_id: user.id,
        title,
        source_type: sourceType,
        source_url: videoUrl,
        storage_path: storagePath,
        status: 'uploaded',
        processing_mode: finalProcessingMode,
      })
      .select()
      .single()

    if (videoError || !video) {
      console.error('[Database Error]', videoError)
      throw new Error(`Failed to create video record: ${videoError?.message || 'Unknown error'}`)
    }

    console.log(`[Video ${video.id}] Created for user ${user.id}`)

    // For URL-based videos (YouTube/Twitch), create initial job
    // Store processing mode in job metadata for later use
    if (sourceType !== 'upload') {
      await supabase.from('jobs').insert({
        user_id: user.id,
        video_id: video.id,
        job_type: 'clip_generation',
        status: 'queued',
        progress: 0,
        result: {
          processingMode: finalProcessingMode,
          aspectRatio: finalAspectRatio,
        },
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        video: {
          id: video.id,
          title: video.title,
          sourceType: video.source_type,
          sourceUrl: video.source_url,
          status: video.status,
          processingMode: finalProcessingMode,
          aspectRatio: finalAspectRatio,
        },
        // For uploads, include the signed URL
        ...(sourceType === 'upload' && {
          uploadUrl: (await supabaseAdmin.storage.from('video-uploads').createSignedUploadUrl(storagePath!, { upsert: false })).data?.signedUrl,
          uploadPath: storagePath,
        }),
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

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
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
