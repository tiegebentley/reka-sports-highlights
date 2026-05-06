// cleanup-reka-videos
//
// Reka caps each user at 180 minutes of indexed video. Earlier analyze-events runs
// re-uploaded the same source video repeatedly because videos.metadata didn't exist
// to cache reka_video_id, so the quota fills with orphans. This function lets us
// list and bulk-delete indexed Reka videos.
//
// Operations:
//   POST {"op": "list"}                     → list all indexed Reka videos
//   POST {"op": "delete", "id": "..."}      → delete one
//   POST {"op": "delete_orphans"}           → delete every Reka video whose id is
//                                             NOT cached in any videos.metadata.reka_video_id
//   POST {"op": "delete_all"}               → delete every Reka video (nuke from orbit)
//
// Auth: deployed --no-verify-jwt; the Reka key never leaves the function.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type, apikey',
}

const REKA_BASE = 'https://vision-agent.api.reka.ai'

interface RekaListResponse {
  videos?: Array<Record<string, unknown>>
  data?: Array<Record<string, unknown>>
  results?: Array<Record<string, unknown>>
  [k: string]: unknown
}

async function rekaList(apiKey: string): Promise<{ status: number; body: any }> {
  // Reka REST list endpoint isn't deeply documented; try the conventional path.
  const resp = await fetch(`${REKA_BASE}/v1/videos`, {
    headers: { 'X-Api-Key': apiKey },
  })
  const text = await resp.text()
  let body: any = text
  try { body = JSON.parse(text) } catch { /* leave as text */ }
  return { status: resp.status, body }
}

async function rekaDelete(apiKey: string, id: string): Promise<{ status: number; body: any }> {
  const resp = await fetch(`${REKA_BASE}/v1/videos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'X-Api-Key': apiKey },
  })
  const text = await resp.text()
  let body: any = text
  try { body = JSON.parse(text) } catch { /* leave as text */ }
  return { status: resp.status, body }
}

function extractIds(listBody: RekaListResponse): string[] {
  const arr =
    (Array.isArray(listBody) ? listBody : null) ||
    listBody.videos ||
    listBody.data ||
    listBody.results ||
    []
  if (!Array.isArray(arr)) return []
  return arr
    .map((v) => (v && (v.id || v.video_id || v.uuid)) as string | undefined)
    .filter((x): x is string => typeof x === 'string')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const rekaApiKey = Deno.env.get('REKA_API_KEY')
    if (!rekaApiKey) throw new Error('Missing REKA_API_KEY')

    const { op, id } = await req.json().catch(() => ({})) as { op?: string; id?: string }
    if (!op) throw new Error('op is required: list | delete | delete_orphans | delete_all')

    if (op === 'list') {
      const { status, body } = await rekaList(rekaApiKey)
      const ids = typeof body === 'object' && body ? extractIds(body) : []
      return new Response(
        JSON.stringify({ ok: status >= 200 && status < 300, status, count: ids.length, ids, raw: body }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    if (op === 'delete') {
      if (!id) throw new Error('id is required for op=delete')
      const { status, body } = await rekaDelete(rekaApiKey, id)
      return new Response(
        JSON.stringify({ ok: status >= 200 && status < 300, status, id, body }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    if (op === 'delete_orphans' || op === 'delete_all') {
      const { status: listStatus, body: listBody } = await rekaList(rekaApiKey)
      if (listStatus < 200 || listStatus >= 300) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Reka list failed', status: listStatus, body: listBody }),
          { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }
      const allIds = typeof listBody === 'object' && listBody ? extractIds(listBody as RekaListResponse) : []

      let toDelete = allIds
      if (op === 'delete_orphans') {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        // metadata column may be missing on old projects — handle gracefully
        const { data: vids, error } = await supabase
          .from('videos')
          .select('metadata')
        if (error) throw new Error(`Failed to read videos.metadata: ${error.message}`)
        const cached = new Set<string>()
        for (const v of vids || []) {
          const rid = (v as any)?.metadata?.reka_video_id
          if (typeof rid === 'string') cached.add(rid)
        }
        toDelete = allIds.filter((rid) => !cached.has(rid))
      }

      // Delete sequentially to be polite — list is usually small.
      const results: Array<{ id: string; status: number; ok: boolean }> = []
      for (const rid of toDelete) {
        const { status, body } = await rekaDelete(rekaApiKey, rid)
        const ok = status >= 200 && status < 300
        results.push({ id: rid, status, ok })
        if (!ok) console.warn(`[cleanup] delete ${rid} → HTTP ${status}: ${JSON.stringify(body).slice(0, 200)}`)
      }

      const deleted = results.filter((r) => r.ok).length
      return new Response(
        JSON.stringify({
          ok: true,
          op,
          totalIndexed: allIds.length,
          targeted: toDelete.length,
          deleted,
          failed: results.length - deleted,
          results,
        }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    throw new Error(`Unknown op: ${op}`)
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
