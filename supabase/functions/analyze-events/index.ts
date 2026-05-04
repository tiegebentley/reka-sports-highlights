import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { RekaClient } from '../_shared/reka-client.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type, apikey',
}

const EVENT_PROMPT = `You are a soccer match analyst. Watch this video and list every notable event with precise start and end timestamps in seconds. Events to identify: goal, shot, shot_on_target, save, corner, kickoff, yellow_card, red_card, foul, penalty.

Respond ONLY with a JSON array, no prose. Each entry must have:
- "type": one of the event types above
- "start": start time in seconds (decimal allowed, e.g. 134.5)
- "end": end time in seconds (decimal allowed)
- "description": one short sentence describing what happened
- "confidence": 0.0-1.0 confidence score

Example:
[
  {"type": "goal", "start": 142.3, "end": 158.7, "description": "Player #10 scores from outside the box, top-right corner", "confidence": 0.95},
  {"type": "save", "start": 213.1, "end": 218.4, "description": "Goalkeeper dives left to deflect a low shot", "confidence": 0.88}
]

Be exhaustive. Include every event you see. If unsure, lower the confidence score but still include the event.`

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
