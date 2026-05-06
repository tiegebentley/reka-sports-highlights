import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { RekaClient } from '../_shared/reka-client.ts'
import { extractSoccerTags } from '../_shared/extract-tags.ts'

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

    // Get all processing/queued jobs with video data
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('*, videos(*)')
      .in('status', ['queued', 'processing'])
      .eq('job_type', 'clip_generation')

    if (jobsError) {
      throw jobsError
    }

    console.log(`Found ${jobs?.length || 0} jobs to poll`)

    const results = []

    for (const job of jobs || []) {
      try {
        // Multi-segment jobs persist an array of {id, start, end, status, ...event metadata}.
        // Per-event jobs additionally carry event_type/description/confidence per segment so
        // we can tag each inserted clip row with the originating event.
        // Legacy single-segment jobs persist a string reka_clip_id.
        const rekaClipIds: Array<{
          id: string
          start?: number
          end?: number
          status?: string
          event_type?: string
          event_description?: string
          event_confidence?: number
        }> | undefined = job.metadata?.reka_clip_ids
        const legacyRekaClipId: string | undefined = job.metadata?.reka_clip_id

        if (!rekaClipIds && !legacyRekaClipId) {
          // Zombie job — generate-clips inserted the row but never persisted
          // a reka_clip_id (timeout, crash, or Reka call failure). After 3 min
          // mark it failed so the UI can recover.
          const ageMs = Date.now() - new Date(job.created_at).getTime()
          if (ageMs > 3 * 60 * 1000) {
            console.warn(`Job ${job.id} stuck without reka_clip_id for ${Math.round(ageMs / 1000)}s — marking failed`)
            await supabase
              .from('jobs')
              .update({
                status: 'failed',
                error: 'Clip generation never registered with Reka (likely edge function timeout). Please retry.',
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.id)
            await supabase
              .from('videos')
              .update({ status: 'uploaded' })
              .eq('id', job.video_id)
            results.push({ jobId: job.id, status: 'failed', error: 'zombie' })
          } else {
            console.warn(`Job ${job.id} has no reka_clip_id yet (age ${Math.round(ageMs / 1000)}s) — waiting`)
          }
          continue
        }

        const video = job.videos
        const processingMode = video?.processing_mode || 'sports_analysis'
        const aspectRatio = job.result?.aspectRatio || '9:16'

        // Build a uniform list of segments to poll
        type SegmentToPoll = {
          id: string
          start?: number
          end?: number
          event_type?: string
          event_description?: string
          event_confidence?: number
        }
        const segmentsToPoll: SegmentToPoll[] = rekaClipIds
          ? rekaClipIds.map((s) => ({
              id: s.id,
              start: s.start,
              end: s.end,
              event_type: s.event_type,
              event_description: s.event_description,
              event_confidence: s.event_confidence,
            }))
          : [
              {
                id: legacyRekaClipId!,
                start: job.metadata?.settings?.segment_start,
                end: job.metadata?.settings?.segment_end,
              },
            ]

        type SegResult =
          | { ok: true; segment: SegmentToPoll; clips: any[]; rekaStatus: string; payload: any }
          | { ok: false; segment: SegmentToPoll; rekaStatus: string; error?: string; payload: any }
          | { ok: 'pending'; segment: SegmentToPoll; rekaStatus: string; payload: any }

        const segResults: SegResult[] = await Promise.all(
          segmentsToPoll.map(async (seg) => {
            try {
              const status = await rekaClient.getClipStatus(seg.id)
              console.log(
                `[Reka] Clip ${seg.id} (${seg.start ?? '?'}-${seg.end ?? '?'}s) status=${status.status} keys=${Object.keys(status).join(',')}`
              )
              if (status.status === 'completed') {
                return { ok: true as const, segment: seg, clips: status.output || [], rekaStatus: status.status, payload: status }
              } else if (status.status === 'failed') {
                console.error(`[Reka] Segment ${seg.id} FAILED — raw payload:`, JSON.stringify(status))
                return {
                  ok: false as const,
                  segment: seg,
                  rekaStatus: status.status,
                  error: status.error || `Reka failure with no error field (see payload)`,
                  payload: status,
                }
              } else {
                return { ok: 'pending' as const, segment: seg, rekaStatus: status.status, payload: status }
              }
            } catch (e) {
              const errMsg = e instanceof Error ? e.message : String(e)
              console.error(`[Reka] Poll error for ${seg.id}:`, errMsg)
              return { ok: 'pending' as const, segment: seg, rekaStatus: 'error', payload: { error: errMsg } }
            }
          })
        )

        // Snapshot the latest raw Reka payload for every segment on every poll so we
        // can inspect from SQL while the job is still processing — not just terminal.
        const lastRekaSnapshot = segResults.map((r) => ({
          segment: r.segment,
          status: r.rekaStatus,
          payload: r.payload,
          polled_at: new Date().toISOString(),
        }))

        const completedSegs = segResults.filter((r): r is Extract<SegResult, { ok: true }> => r.ok === true)
        const failedSegs = segResults.filter((r): r is Extract<SegResult, { ok: false }> => r.ok === false)
        const pendingSegs = segResults.filter((r) => r.ok === 'pending')

        // Insert clips for any newly-completed segments not already inserted.
        // We dedupe by (reka_clip_id, clip_url) — Reka returns the same clip URL
        // each poll, so re-inserting would duplicate rows.
        const completedRekaIds = completedSegs.map((s) => s.segment.id)
        let alreadyInserted: Array<{ reka_clip_id: string; clip_url: string }> = []
        if (completedRekaIds.length > 0) {
          const { data: existing } = await supabase
            .from('clips')
            .select('reka_clip_id, clip_url')
            .eq('video_id', job.video_id)
            .in('reka_clip_id', completedRekaIds)
          alreadyInserted = existing || []
        }
        const insertedKey = (rekaId: string, url: string) => `${rekaId}::${url}`
        const insertedSet = new Set(alreadyInserted.map((r) => insertedKey(r.reka_clip_id, r.clip_url)))

        let totalClipsInserted = 0
        for (const seg of completedSegs) {
          for (const clip of seg.clips) {
            if (insertedSet.has(insertedKey(seg.segment.id, clip.video_url))) continue
            const tags = extractSoccerTags({
              title: clip.title,
              caption: clip.caption,
              hashtags: clip.hashtags,
              anchor: seg.segment.event_type ?? null,
            })
            const { error: insertErr } = await supabase.from('clips').insert({
              video_id: job.video_id,
              user_id: job.user_id,
              reka_clip_id: seg.segment.id,
              clip_url: clip.video_url,
              title: clip.title,
              caption: clip.caption,
              hashtags: clip.hashtags,
              tags,
              quality_score: clip.ai_score,
              processing_mode: processingMode,
              aspect_ratio: aspectRatio,
              segment_start: seg.segment.start,
              segment_end: seg.segment.end,
              event_type: seg.segment.event_type ?? null,
              event_description: seg.segment.event_description ?? null,
              event_confidence: seg.segment.event_confidence ?? null,
            })
            if (insertErr) {
              console.error(`Failed to insert clip from segment ${seg.segment.id}:`, insertErr.message)
            } else {
              totalClipsInserted++
            }
          }
        }

        // A job is terminal only when every segment is terminal (completed or failed).
        if (pendingSegs.length === 0) {
          if (completedSegs.length > 0) {
            // At least one segment produced clips → mark job completed.
            // Surface segment failures in metadata for debugging without failing the job.
            await supabase
              .from('jobs')
              .update({
                status: 'completed',
                progress: 100,
                result: {
                  ...(job.result || {}),
                  segments_completed: completedSegs.length,
                  segments_failed: failedSegs.length,
                  total_segments: segResults.length,
                },
                metadata: {
                  ...job.metadata,
                  reka_status: 'completed',
                  last_reka_status_payload: lastRekaSnapshot,
                  segment_failures: failedSegs.length > 0
                    ? failedSegs.map((f) => ({ segment: f.segment, error: f.error, payload: f.payload }))
                    : undefined,
                },
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.id)
            await supabase.from('videos').update({ status: 'completed' }).eq('id', job.video_id)
            results.push({
              jobId: job.id,
              status: 'completed',
              clipsCount: totalClipsInserted,
              segmentsCompleted: completedSegs.length,
              segmentsFailed: failedSegs.length,
            })
          } else {
            // All segments failed
            const errSummary = failedSegs
              .map((f) => `${f.segment.start ?? '?'}-${f.segment.end ?? '?'}s: ${f.error}`)
              .join('; ')
            await supabase
              .from('jobs')
              .update({
                status: 'failed',
                error: `All ${failedSegs.length} segments failed: ${errSummary}`,
                metadata: {
                  ...job.metadata,
                  reka_status: 'failed',
                  last_reka_status_payload: lastRekaSnapshot,
                  segment_failures: failedSegs.map((f) => ({ segment: f.segment, error: f.error, payload: f.payload })),
                },
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.id)
            await supabase.from('videos').update({ status: 'failed' }).eq('id', job.video_id)
            results.push({ jobId: job.id, status: 'failed', error: errSummary })
          }
        } else {
          // Still pending — update progress proportional to completed segments.
          const progress = Math.floor((completedSegs.length / segResults.length) * 95)
          await supabase
            .from('jobs')
            .update({
              status: 'processing',
              progress,
              metadata: {
                ...job.metadata,
                reka_status: 'processing',
                last_reka_status_payload: lastRekaSnapshot,
                segments_completed: completedSegs.length,
                segments_failed: failedSegs.length,
                segments_pending: pendingSegs.length,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id)
          results.push({
            jobId: job.id,
            status: 'processing',
            segmentsCompleted: completedSegs.length,
            segmentsFailed: failedSegs.length,
            segmentsPending: pendingSegs.length,
          })
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
