import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { RekaClient } from '../_shared/reka-client.ts'

interface FetchClipUrlsRequest {
  rekaClipId: string
  clipIds: string[]
}

serve(async (req) => {
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
    const { rekaClipId, clipIds }: FetchClipUrlsRequest = await req.json()

    if (!rekaClipId || !clipIds || clipIds.length === 0) {
      throw new Error('rekaClipId and clipIds are required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const rekaApiKey = Deno.env.get('REKA_API_KEY')!

    if (!supabaseUrl || !supabaseServiceKey || !rekaApiKey) {
      throw new Error('Missing environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const rekaClient = new RekaClient(rekaApiKey)

    console.log(`Fetching clip status from Reka: ${rekaClipId}`)

    // Get clip status from Reka
    const clipStatus = await rekaClient.getClipStatus(rekaClipId)

    console.log('=== REKA RESPONSE START ===')
    console.log('Status:', clipStatus.status)
    console.log('Output length:', clipStatus.output?.length || 0)
    console.log('Full response:', JSON.stringify(clipStatus, null, 2))
    console.log('=== REKA RESPONSE END ===')

    if (clipStatus.status !== 'completed') {
      return new Response(
        JSON.stringify({
          success: false,
          status: clipStatus.status,
          message: `Clips are still ${clipStatus.status}. Please try again later.`,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    if (!clipStatus.output || clipStatus.output.length === 0) {
      console.error('ERROR: No clips in Reka output!')
      throw new Error('No clips found in Reka response')
    }

    console.log(`Found ${clipStatus.output.length} clips from Reka`)
    console.log(`Received ${clipIds.length} clip IDs to update`)

    // Update clips in database
    const updates = []
    for (let i = 0; i < clipStatus.output.length && i < clipIds.length; i++) {
      const rekaClip = clipStatus.output[i]
      const clipId = clipIds[i]

      console.log(`Updating clip ${i + 1}/${clipStatus.output.length}:`, {
        clipId,
        video_url: rekaClip.video_url,
        clip_url: rekaClip.video_url,  // Store in clip_url column
        title: rekaClip.title,
        ai_score: rekaClip.ai_score
      })

      const { data: updateData, error: updateError } = await supabase
        .from('clips')
        .update({
          clip_url: rekaClip.video_url,  // Reka API returns video_url
          quality_score: rekaClip.ai_score,  // Reka API returns ai_score
        })
        .eq('id', clipId)
        .select()

      if (updateError) {
        console.error(`ERROR updating clip ${clipId}:`, updateError)
      } else {
        console.log(`SUCCESS updating clip ${clipId}:`, updateData)
        updates.push({ clipId, clip_url: rekaClip.video_url })
      }
    }

    console.log(`Successfully updated ${updates.length} clips`)

    return new Response(
      JSON.stringify({
        success: true,
        clipsUpdated: updates.length,
        clips: updates,
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
        error: error instanceof Error ? error.message : String(error),
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
