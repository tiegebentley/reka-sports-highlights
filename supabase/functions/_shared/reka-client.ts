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
    clip_url: string
    title: string
    caption: string
    hashtags: string[]
    quality_score: number
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
}
