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
    // 'per_event' (default for sports_analysis): detect events first, then clip each one individually.
    // 'broad': legacy behavior — single Reka call with num_generations up to 3.
    mode?: 'per_event' | 'broad'
    min_event_confidence?: number  // default 0.6
    // When set, applied as a flat override across all events. When unset, each
    // event type gets a tuned default (see ROLL_DEFAULTS) — e.g. goals get 10s
    // post-roll for celebrations, kickoffs get 2s pre-roll, etc.
    pre_roll_seconds?: number
    post_roll_seconds?: number
    // For short-form mode: manual segment selection
    segment_start?: number
    segment_end?: number
    max_duration_seconds?: number
    subtitles?: boolean
    // Pre-computed events from a prior analyze-events call. When provided we
    // skip the analyze step entirely and clip directly from these events. This
    // is the "verify then generate" path — user previews events, optionally
    // edits them, then triggers clip generation without re-paying for Q&A.
    events?: DetectedEvent[]
  }
}

interface DetectedEvent {
  type: string
  start: number
  end: number
  description: string
  confidence: number
}

const EVENT_PROMPTS: Record<string, string> = {
  goal: 'Capture this goal with the build-up and the celebration that follows.',
  shot: 'Capture this shot attempt with the build-up and the goalkeeper or defensive reaction.',
  shot_on_target: 'Capture this shot on target with the build-up and goalkeeper save or block.',
  save: 'Capture this goalkeeper save with a moment of build-up before the shot.',
  yellow_card: 'Capture the foul and the referee issuing the yellow card.',
  red_card: 'Capture the foul and the referee issuing the red card.',
  foul: 'Capture the foul and the immediate aftermath.',
  penalty: 'Capture the foul that led to the penalty and the penalty kick itself.',
  corner: 'Capture this corner kick from the delivery to the resolution.',
  kickoff: 'Capture this kickoff and the opening play that follows.',
}

function promptForEvent(ev: DetectedEvent): string {
  return EVENT_PROMPTS[ev.type] || `Capture this ${ev.type.replace(/_/g, ' ')} event clearly.`
}

// Per-event-type pre/post roll defaults. Reasoning:
// - Goals deserve the longest post-roll for celebrations (10s).
// - Saves and shots-on-target need a beat after to see the rebound or restart (6-7s).
// - Kickoffs are restarts; minimal pre-roll, brief post to see the first pass (2/4).
// - Fouls need post-roll for the ref's reaction and the free-kick setup (5).
// - Cards: post-roll matters more than pre-roll — we want to see the player walk away.
// - Penalties bracket the prep + the kick + the outcome (8/10).
// - Corners: pre to see the placement, post to see the resolution.
// User-supplied pre_roll_seconds / post_roll_seconds, when set, override these.
const ROLL_DEFAULTS: Record<string, { pre: number; post: number }> = {
  goal:           { pre: 7,  post: 10 },
  shot:           { pre: 7,  post: 5  },
  shot_on_target: { pre: 7,  post: 7  },
  save:           { pre: 6,  post: 6  },
  corner:         { pre: 5,  post: 8  },
  kickoff:        { pre: 2,  post: 4  },
  yellow_card:    { pre: 4,  post: 7  },
  red_card:       { pre: 4,  post: 8  },
  foul:           { pre: 5,  post: 5  },
  penalty:        { pre: 8,  post: 10 },
}
const FALLBACK_ROLL = { pre: 7, post: 7 }
function rollForEventType(type: string): { pre: number; post: number } {
  return ROLL_DEFAULTS[type] ?? FALLBACK_ROLL
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

    // ─────────────────────────────────────────────────────────────────────────
    // PER-EVENT MODE: detect events via analyze-events first, then fan out one
    // tight Reka /v1/clips call per event. Yields one clip per discrete moment
    // (goal, save, card, etc.) instead of 3 broad highlight reels.
    // ─────────────────────────────────────────────────────────────────────────
    const explicitSegment_perEvent = settings?.segment_start !== undefined && settings?.segment_end !== undefined
    const usePerEvent =
      processingMode === 'sports_analysis' &&
      !explicitSegment_perEvent &&
      (settings?.mode ?? 'per_event') === 'per_event'

    if (usePerEvent) {
      const minConf = settings?.min_event_confidence ?? 0.6
      // When the user explicitly sets pre_roll_seconds/post_roll_seconds, use
      // that as a flat override. Otherwise look up per-event defaults so each
      // event type gets framing tuned to its rhythm (goal celebrations vs.
      // kickoff openers vs. card walk-aways).
      const userPreRoll = settings?.pre_roll_seconds
      const userPostRoll = settings?.post_roll_seconds

      // PATH A: caller supplied a pre-computed event list (from a prior
      // List Events run). Skip the analyze call entirely.
      // PATH B: no events provided — invoke analyze-events as before.
      let allEvents: DetectedEvent[]
      const suppliedEvents = settings?.events
      if (Array.isArray(suppliedEvents) && suppliedEvents.length > 0) {
        // Defensive validation: keep only entries with the required shape.
        allEvents = suppliedEvents
          .filter((e: any) =>
            e &&
            typeof e.type === 'string' &&
            typeof e.start === 'number' &&
            typeof e.end === 'number'
          )
          .map((e: any) => ({
            type: String(e.type),
            start: Number(e.start),
            end: Number(e.end),
            description: typeof e.description === 'string' ? e.description : '',
            confidence: typeof e.confidence === 'number' ? e.confidence : 0.8,
          }))
        console.log(`[per-event] Using ${allEvents.length} pre-supplied events; skipping analyze-events call`)
      } else {
        console.log(`[per-event] Invoking analyze-events for video ${videoId}`)
        const analyzeResp = await fetch(`${supabaseUrl}/functions/v1/analyze-events`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ videoId }),
        })

        if (!analyzeResp.ok) {
          const errBody = await analyzeResp.text()
          await supabase
            .from('jobs')
            .update({
              status: 'failed',
              error: `analyze-events failed (${analyzeResp.status}): ${errBody.slice(0, 500)}`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id)
          await supabase.from('videos').update({ status: 'uploaded' }).eq('id', videoId)
          throw new Error(`analyze-events failed: ${errBody.slice(0, 200)}`)
        }

        const analyzeJson = await analyzeResp.json() as {
          ok: boolean
          events?: DetectedEvent[]
          error?: string
        }

        if (!analyzeJson.ok || !Array.isArray(analyzeJson.events)) {
          await supabase
            .from('jobs')
            .update({
              status: 'failed',
              error: `analyze-events returned no events: ${analyzeJson.error || 'unknown'}`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id)
          await supabase.from('videos').update({ status: 'uploaded' }).eq('id', videoId)
          throw new Error(`analyze-events returned no events`)
        }

        allEvents = analyzeJson.events
      }
      const events = allEvents
        .filter((e) => e.confidence >= minConf)
        .filter((e) => e.end > e.start)
        .sort((a, b) => a.start - b.start)

      console.log(`[per-event] analyze-events returned ${allEvents.length} events; ${events.length} pass confidence ≥ ${minConf}`)

      if (events.length === 0) {
        await supabase
          .from('jobs')
          .update({
            status: 'failed',
            error: `No events detected at confidence ≥ ${minConf}. Total returned: ${allEvents.length}.`,
            metadata: {
              ...job.metadata,
              per_event: true,
              events_total: allEvents.length,
              events_kept: 0,
              all_events: allEvents,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)
        await supabase.from('videos').update({ status: 'uploaded' }).eq('id', videoId)
        throw new Error('No events detected above confidence threshold')
      }

      // Fan out one Reka /v1/clips call per event with a tight time window.
      // Throttle in batches of 5 to stay polite with Reka rate limits.
      const BATCH = 5
      type EventCall =
        | { ok: true; event: DetectedEvent; id: string; status: string; clipStart: number; clipEnd: number }
        | { ok: false; event: DetectedEvent; error: string; clipStart: number; clipEnd: number }

      const settled: EventCall[] = []
      for (let i = 0; i < events.length; i += BATCH) {
        const batch = events.slice(i, i + BATCH)
        const batchResults: EventCall[] = await Promise.all(
          batch.map(async (ev) => {
            // Reka requires source_start_time/source_end_time as INTEGERS — fractional
            // seconds (e.g. 131.4) trigger HTTP 400 validation errors. Round outward
            // to slightly widen the window rather than truncate the event.
            const roll = rollForEventType(ev.type)
            const preRoll = userPreRoll ?? roll.pre
            const postRoll = userPostRoll ?? roll.post
            const clipStart = Math.max(0, Math.floor(ev.start - preRoll))
            const clipEnd = Math.ceil(ev.end + postRoll)
            const req = {
              video_urls: [videoUrl],
              prompt: promptForEvent(ev),
              generation_config: {
                template: 'moments',
                num_generations: 1,
                max_duration_seconds: Math.min(90, Math.ceil(clipEnd - clipStart) + 10),
                source_start_time: clipStart,
                source_end_time: clipEnd,
              },
              rendering_config: {
                aspect_ratio: aspectRatio,
                resolution: settings?.resolution || 720,
                subtitles: settings?.subtitles ?? true,
              },
            }
            try {
              const resp = await rekaClient.generateClips(req)
              console.log(`[per-event] ${ev.type} ${ev.start.toFixed(1)}-${ev.end.toFixed(1)}s → reka_id=${resp.id}`)
              return { ok: true as const, event: ev, id: resp.id, status: resp.status, clipStart, clipEnd }
            } catch (e) {
              const errMsg = e instanceof Error ? e.message : String(e)
              console.error(`[per-event] ${ev.type} ${ev.start.toFixed(1)}s failed: ${errMsg}`)
              return { ok: false as const, event: ev, error: errMsg, clipStart, clipEnd }
            }
          })
        )
        settled.push(...batchResults)
      }

      const successes = settled.filter((s): s is Extract<EventCall, { ok: true }> => s.ok)
      const failures = settled.filter((s): s is Extract<EventCall, { ok: false }> => !s.ok)

      if (successes.length === 0) {
        const errSummary = failures.slice(0, 5).map((f) => `${f.event.type}@${f.event.start.toFixed(1)}: ${f.error}`).join('; ')
        await supabase
          .from('jobs')
          .update({
            status: 'failed',
            error: `All ${failures.length} per-event Reka calls failed: ${errSummary}`,
            metadata: {
              ...job.metadata,
              per_event: true,
              events_total: allEvents.length,
              events_kept: events.length,
              event_failures: failures.map((f) => ({ event: f.event, error: f.error })),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)
        await supabase.from('videos').update({ status: 'uploaded' }).eq('id', videoId)
        throw new Error(`All per-event calls failed: ${errSummary}`)
      }

      // Persist segments in the same shape poll-clip-jobs already understands,
      // augmented with event metadata so the poller can attach it to clip rows.
      const rekaClipIds = successes.map((s) => ({
        id: s.id,
        start: s.clipStart,
        end: s.clipEnd,
        status: s.status,
        event_type: s.event.type,
        event_description: s.event.description,
        event_confidence: s.event.confidence,
      }))

      const { error: updateErr } = await supabase
        .from('jobs')
        .update({
          metadata: {
            ...job.metadata,
            reka_clip_ids: rekaClipIds,
            reka_status: 'processing',
            per_event: true,
            multi_segment: true,
            events_total: allEvents.length,
            events_kept: events.length,
            event_failures: failures.length > 0 ? failures.map((f) => ({ event: f.event, error: f.error })) : undefined,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
      if (updateErr) {
        console.error(`[Job ${job.id}] Failed to persist per-event reka_clip_ids:`, updateErr.message)
      }

      return new Response(
        JSON.stringify({
          success: true,
          jobId: job.id,
          mode: 'per_event',
          eventsDetected: allEvents.length,
          eventsKept: events.length,
          rekaCallsStarted: successes.length,
          rekaCallsFailed: failures.length,
          message: `Per-event clipping started for ${successes.length}/${events.length} events.`,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
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
