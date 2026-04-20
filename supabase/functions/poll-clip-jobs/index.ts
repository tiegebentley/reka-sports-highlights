import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { RekaClient } from '../_shared/reka-client.ts'

serve(async (req) => {
  // Handle CORS
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const rekaApiKey = Deno.env.get('REKA_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const rekaClient = new RekaClient(rekaApiKey)

    // Get all processing/queued jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('*')
      .in('status', ['queued', 'processing'])
      .eq('job_type', 'clip_generation')

    if (jobsError) {
      throw jobsError
    }

    console.log(`Found ${jobs?.length || 0} jobs to poll`)

    const results = []

    for (const job of jobs || []) {
      try {
        const rekaClipId = job.metadata?.reka_clip_id

        if (!rekaClipId) {
          console.warn(`Job ${job.id} has no reka_clip_id`)
          continue
        }

        console.log(`Polling Reka for clip ${rekaClipId}`)

        // Check status with Reka
        const clipStatus = await rekaClient.getClipStatus(rekaClipId)

        console.log(`[Reka] Clip ${rekaClipId} status:`, clipStatus.status)
        console.log(`[Reka] Full response:`, JSON.stringify(clipStatus, null, 2))

        // Update job based on Reka status
        if (clipStatus.status === 'completed') {
          // Extract clips and save to database
          const clips = clipStatus.output || []

          for (const clip of clips) {
            await supabase.from('clips').insert({
              video_id: job.video_id,
              user_id: job.user_id,
              reka_clip_id: rekaClipId,
              clip_url: clip.video_url,  // Reka returns video_url
              title: clip.title,
              caption: clip.caption,
              hashtags: clip.hashtags,
              quality_score: clip.ai_score,  // Reka returns ai_score
            })
          }

          // Update job status
          await supabase
            .from('jobs')
            .update({
              status: 'completed',
              progress: 100,
              result: { clips },
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id)

          // Update video status
          await supabase
            .from('videos')
            .update({ status: 'completed' })
            .eq('id', job.video_id)

          results.push({ jobId: job.id, status: 'completed', clipsCount: clips.length })
        } else if (clipStatus.status === 'failed') {
          await supabase
            .from('jobs')
            .update({
              status: 'failed',
              error: clipStatus.error || 'Reka clip generation failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id)

          await supabase
            .from('videos')
            .update({ status: 'failed' })
            .eq('id', job.video_id)

          results.push({ jobId: job.id, status: 'failed', error: clipStatus.error })
        } else {
          // Still processing - update progress if available
          await supabase
            .from('jobs')
            .update({
              status: 'processing',
              metadata: {
                ...job.metadata,
                reka_status: clipStatus.status,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id)

          results.push({ jobId: job.id, status: 'processing' })
        }
      } catch (err) {
        console.error(`Error polling job ${job.id}:`, err)
        results.push({ jobId: job.id, status: 'error', error: String(err) })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        jobsPolled: results.length,
        results,
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
