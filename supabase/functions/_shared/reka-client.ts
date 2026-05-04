export interface RekaClipRequest {
  video_urls: string[]
  prompt?: string
  template?: 'moments' | 'compilation'
  num_generations?: number // 1-3
  duration_range?: {
    min?: number
    max?: number // default: 90, max: 600
  }
  source_start_time?: number
  source_end_time?: number
  aspect_ratio?: '9:16' | '16:9' | '4:5' | '1:1'
  resolution?: number // 240-1080, default: 720
  subtitles_enabled?: boolean
}

export interface RekaClipResponse {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  output?: {
    video_url: string  // Reka uses video_url, not clip_url
    title: string
    caption: string
    hashtags: string[]
    ai_score: number  // Reka uses ai_score, not quality_score
  }[]
  error?: string
}

export class RekaClient {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
    this.baseUrl = 'https://vision-agent.api.reka.ai'
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: {
          'X-Api-Key': this.apiKey,
        },
      })
      return response.ok
    } catch (error) {
      console.error('Reka health check failed:', error)
      return false
    }
  }

  async generateClips(request: RekaClipRequest): Promise<RekaClipResponse> {
    const response = await fetch(`${this.baseUrl}/v1/clips`, {
      method: 'POST',
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Reka API error (${response.status}): ${errorBody}`)
    }

    return await response.json()
  }

  async getClipStatus(clipId: string): Promise<RekaClipResponse> {
    const response = await fetch(`${this.baseUrl}/v1/clips/${clipId}`, {
      headers: {
        'X-Api-Key': this.apiKey,
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Reka API error (${response.status}): ${errorBody}`)
    }

    return await response.json()
  }

  async pollClipCompletion(
    clipId: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000
  ): Promise<RekaClipResponse> {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getClipStatus(clipId)

      if (status.status === 'completed' || status.status === 'failed') {
        return status
      }

      console.log(`[Reka] Polling attempt ${i + 1}/${maxAttempts} - Status: ${status.status}`)
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }

    throw new Error(`Clip generation timeout after ${maxAttempts} attempts`)
  }

  /**
   * Upload + index a video for Q&A. Reka /v1/videos/upload requires multipart
   * form-data with `index` as a form field and the video URL or file in another field.
   * Try multiple URL field names since docs are unclear.
   */
  async uploadVideoForIndexing(videoUrl: string): Promise<{ videoId: string; raw: any }> {
    const url = `${this.baseUrl}/v1/videos/upload`

    const attempts: Array<{ label: string; build: () => FormData }> = [
      { label: 'multipart video_url+index=true', build: () => {
        const fd = new FormData()
        fd.append('video_url', videoUrl)
        fd.append('index', 'true')
        return fd
      }},
      { label: 'multipart url+index=true', build: () => {
        const fd = new FormData()
        fd.append('url', videoUrl)
        fd.append('index', 'true')
        return fd
      }},
      { label: 'json {url, index:true}', build: () => {
        // Some Reka endpoints accept JSON; fall through to a raw JSON attempt
        const fd = new FormData()
        ;(fd as any).__json = { url: videoUrl, index: true }
        return fd
      }},
      { label: 'json {video_url, index:true}', build: () => {
        const fd = new FormData()
        ;(fd as any).__json = { video_url: videoUrl, index: true }
        return fd
      }},
    ]

    const allErrors: string[] = []
    for (const attempt of attempts) {
      const fd = attempt.build()
      const isJson = (fd as any).__json
      const response = isJson
        ? await fetch(url, {
            method: 'POST',
            headers: { 'X-Api-Key': this.apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify(isJson),
          })
        : await fetch(url, {
            method: 'POST',
            headers: { 'X-Api-Key': this.apiKey }, // let fetch set multipart boundary
            body: fd,
          })
      const text = await response.text()
      if (response.ok) {
        let parsed: any = {}
        try { parsed = JSON.parse(text) } catch { /* */ }
        const videoId = parsed.video_id || parsed.id || parsed._id || parsed.uuid
        if (!videoId) throw new Error(`Reka upload succeeded but response has no id field: ${text}`)
        console.log(`[Reka] Upload succeeded with body shape: ${attempt.label}`)
        return { videoId, raw: parsed }
      }
      const errLine = `[${attempt.label}] HTTP ${response.status}: ${text}`
      allErrors.push(errLine)
      console.warn(`[Reka] Upload attempt failed: ${errLine}`)
    }
    throw new Error(`Reka video upload failed all body shapes:\n${allErrors.join('\n')}`)
  }

  /**
   * Q&A on an indexed video. Returns the chat_response string.
   */
  async videoQA(videoId: string, prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v1/qa/chat`, {
      method: 'POST',
      headers: { 'X-Api-Key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_id: videoId,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`Reka Q&A error (${response.status}): ${text}`)
    }
    let parsed: any = {}
    try { parsed = JSON.parse(text) } catch { /* */ }
    return parsed.chat_response || parsed.response || text
  }

  /**
   * Get indexing status for an uploaded video. Best-guess endpoint shape;
   * returns the parsed response so caller can branch on whatever field exists.
   */
  async getVideoStatus(videoId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/v1/videos/${videoId}`, {
      headers: { 'X-Api-Key': this.apiKey },
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`Reka video status error (${response.status}): ${text}`)
    }
    try { return JSON.parse(text) } catch { return { raw: text } }
  }
}
