import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { RekaClient } from '../_shared/reka-client.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type, apikey',
}

const EVENT_PROMPT = `You are a soccer match analyst. Watch this video and list notable events with precise start and end timestamps in seconds.

EVENT TYPES — pick exactly ONE per event, using these strict definitions:

- "goal": The ball FULLY CROSSES THE GOAL LINE between the posts AND under the crossbar AND play stops to restart at the centre circle. If you cannot see the ball cross the line, OR the goalkeeper/defender stops it, OR play continues without a centre-circle restart, it is NOT a goal.
- "shot_on_target": A shot that was heading on goal but did NOT score — saved, blocked on the line, or hit the frame and stayed out. Use this when there's a save or near-miss on frame.
- "shot": A shot that missed the goal entirely (wide, over, or off target). Do NOT use "shot" if it scored (use "goal") or was saved (use "shot_on_target").
- "save": The goalkeeper actively stops a shot. Use this when the keeper is the focus. (A shot that was saved should produce ONE event — usually "save", or "shot_on_target" if the keeper is incidental.)
- "corner": A corner kick is taken (ball placed at the corner flag, kicked into the box).
- "kickoff": Match start, second-half start, or a restart from the centre circle after a goal.
- "yellow_card": Referee visibly shows a yellow card.
- "red_card": Referee visibly shows a red card.
- "foul": A clear foul whistled by the referee resulting in a free kick (no card shown).
- "penalty": A penalty kick is taken from the spot.

EXCLUSION RULES — these combinations are FORBIDDEN. Do NOT emit two events for the same moment:
- A save means the ball did NOT enter the net. Never emit "goal" and "save" for the same moment.
- A goal means the shot was not stopped. Never emit "goal" and "shot_on_target" for the same moment.
- A foul stops play; emit "foul" OR "yellow_card"/"red_card", not both unless the card is shown clearly.
- A penalty kick can be followed by either a "goal" OR a "save" event (separate timestamps), but the penalty itself is one event.

CONFIDENCE CALIBRATION — be HONEST about uncertainty:
- 0.90-1.00: You can see the action clearly and the outcome is unambiguous.
- 0.70-0.89: You're fairly sure but the camera angle or speed makes it slightly ambiguous.
- 0.50-0.69: You suspect this happened but a key detail (ball crossing line, contact made) wasn't visible.
- Below 0.50: Do NOT include the event.

OUTPUT — Respond ONLY with a JSON array, no prose. Each entry must have:
- "type": one of the event types above
- "start": start time in seconds (decimal allowed, e.g. 134.5)
- "end": end time in seconds (decimal allowed)
- "description": one short sentence describing what happened, including outcome (e.g. "scored", "saved", "missed wide")
- "confidence": 0.0-1.0 per the calibration above

EXAMPLES showing the rules in action:

[
  {"type": "kickoff", "start": 2.0, "end": 5.5, "description": "Match kicks off from the centre circle", "confidence": 0.97},
  {"type": "shot", "start": 87.2, "end": 90.1, "description": "Player shoots from outside the box but the ball goes wide of the right post", "confidence": 0.90},
  {"type": "save", "start": 142.3, "end": 146.7, "description": "Goalkeeper dives left and parries a low driven shot for a corner", "confidence": 0.92},
  {"type": "corner", "start": 152.0, "end": 156.4, "description": "Corner kick swung in from the left flag", "confidence": 0.95},
  {"type": "goal", "start": 213.1, "end": 220.5, "description": "Striker heads the ball into the bottom-right corner; the ball clearly crosses the line and the team celebrates", "confidence": 0.96},
  {"type": "foul", "start": 305.8, "end": 308.2, "description": "Midfielder fouls the attacker; referee blows whistle for a free kick, no card", "confidence": 0.85}
]

Notice: at 142.3 the goalkeeper saved the shot — emitted ONE "save" event, NOT a "goal" or a separate "shot_on_target". At 87.2 the shot missed wide — emitted "shot", NOT "shot_on_target". At 213.1 the ball clearly crossed the line — emitted "goal".

QUALITY OVER QUANTITY. Only include events you can actually verify on the video. It is better to miss an ambiguous event than to fabricate one. If a shot's outcome (saved vs scored vs missed) isn't visible, emit "shot" with low confidence rather than guessing "goal".`

interface AnalyzeEventsRequest {
  videoId: string
}

interface ParsedEvent {
  type: string
  start: number
  end: number
  description: string
  confidence: number
}

function parseEventsFromResponse(text: string): { events: ParsedEvent[]; raw: string } {
  // Reka may wrap JSON in markdown fences or add prose despite our instructions.
  // Strip fences, find the first [ and last ] and parse the slice.
  let cleaned = text.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const firstBracket = cleaned.indexOf('[')
  const lastBracket = cleaned.lastIndexOf(']')
  if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
    return { events: [], raw: text }
  }
  const slice = cleaned.slice(firstBracket, lastBracket + 1)
  try {
    const parsed = JSON.parse(slice)
    if (!Array.isArray(parsed)) return { events: [], raw: text }
    const events = parsed
      .filter((e: any) => e && typeof e.start === 'number' && typeof e.end === 'number' && typeof e.type === 'string')
      .map((e: any) => ({
        type: String(e.type),
        start: Number(e.start),
        end: Number(e.end),
        description: String(e.description || ''),
        confidence: typeof e.confidence === 'number' ? e.confidence : 0.5,
      }))
    return { events, raw: text }
  } catch {
    return { events: [], raw: text }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const { videoId }: AnalyzeEventsRequest = await req.json()
    if (!videoId) throw new Error('videoId is required')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const rekaApiKey = Deno.env.get('REKA_API_KEY')
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Missing Supabase configuration')
    if (!rekaApiKey) throw new Error('Missing Reka API key')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const rekaClient = new RekaClient(rekaApiKey)

    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single()
    if (videoError || !video) throw new Error(`Video not found: ${videoError?.message}`)

    // Build a video URL Reka can fetch
    let videoUrl: string
    if (video.source_type === 'upload' && video.storage_path) {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('video-uploads')
        .createSignedUrl(video.storage_path, 60 * 60 * 6)
      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error(`Failed to sign storage URL: ${signedUrlError?.message}`)
      }
      videoUrl = signedUrlData.signedUrl
    } else if (video.source_url) {
      videoUrl = video.source_url
    } else {
      throw new Error('Video has no usable source (no storage_path and no source_url)')
    }

    // Reuse a previously-uploaded Reka video_id if we already indexed this video
    let rekaVideoId: string | undefined = video.metadata?.reka_video_id
    let uploadResponse: any = null

    if (!rekaVideoId) {
      console.log(`[analyze-events] Uploading video ${videoId} to Reka for indexing`)
      const upload = await rekaClient.uploadVideoForIndexing(videoUrl)
      rekaVideoId = upload.videoId
      uploadResponse = upload.raw

      // Persist the Reka video_id so subsequent analyze calls skip the upload step
      await supabase
        .from('videos')
        .update({
          metadata: { ...(video.metadata || {}), reka_video_id: rekaVideoId, reka_upload_response: upload.raw },
        })
        .eq('id', videoId)
    }

    // Best-effort: poll indexing status until ready (or 90s timeout)
    const indexStart = Date.now()
    let indexingStatus: any = null
    while (Date.now() - indexStart < 90_000) {
      try {
        indexingStatus = await rekaClient.getVideoStatus(rekaVideoId!)
        const status = String(indexingStatus.status || indexingStatus.indexing_status || '').toLowerCase()
        if (status === 'ready' || status === 'indexed' || status === 'completed' || status === 'success') break
        if (status === 'failed' || status === 'error') {
          throw new Error(`Reka indexing failed: ${JSON.stringify(indexingStatus)}`)
        }
      } catch (err) {
        // If status endpoint shape differs, fall through and try Q&A directly
        console.warn(`[analyze-events] Status check failed (continuing): ${err instanceof Error ? err.message : err}`)
        break
      }
      await new Promise((r) => setTimeout(r, 3000))
    }

    // Run Q&A
    console.log(`[analyze-events] Running Q&A on Reka video_id ${rekaVideoId}`)
    const responseText = await rekaClient.videoQA(rekaVideoId!, EVENT_PROMPT)
    const { events, raw } = parseEventsFromResponse(responseText)

    return new Response(
      JSON.stringify({
        ok: true,
        videoId,
        rekaVideoId,
        eventCount: events.length,
        events,
        rawResponse: raw,
        uploadResponse,
        indexingStatus,
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (error: any) {
    console.error('[analyze-events] error:', error)
    return new Response(
      JSON.stringify({ ok: false, error: error?.message || String(error) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
