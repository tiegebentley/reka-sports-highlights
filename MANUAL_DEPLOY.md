# Manual Edge Function Deployment

Since CLI authentication isn't working with the access token, here's how to deploy via the Supabase Dashboard:

---

## 🚀 Deploy via Dashboard (Easiest Method)

### Step 1: Navigate to Functions

Go to: https://supabase.com/dashboard/project/nxllstmdmqcaiodoensd/functions

---

### Step 2: Deploy `generate-clips` Function

1. Click **"New Function"** or **"Deploy new function"**

2. Function name: `generate-clips`

3. **Copy and paste this code:**

```typescript
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
  }
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
    const supabaseUrl = Deno.env.get('DB_URL')
    const supabaseServiceKey = Deno.env.get('DB_SERVICE_ROLE_KEY')
    const rekaApiKey = Deno.env.get('REKA_API_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
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

    // Generate clips with Reka
    const clipRequest = {
      video_urls: [video.source_url],
      template: settings?.template || 'moments',
      num_generations: Math.min(settings?.num_clips || 3, 3), // Max 3
      aspect_ratio: settings?.aspect_ratio || '9:16',
      resolution: settings?.resolution || 720,
      prompt: settings?.prompt,
    }

    console.log('[Reka] Sending clip generation request:', clipRequest)

    const clipResponse = await rekaClient.generateClips(clipRequest)

    console.log(`[Reka] Clip generation started: ${clipResponse.id}`)

    // Update job with Reka clip ID
    await supabase
      .from('jobs')
      .update({
        metadata: {
          ...job.metadata,
          reka_clip_id: clipResponse.id,
          reka_status: clipResponse.status,
        },
      })
      .eq('id', job.id)

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
```

4. **Important**: You'll also need to create the `_shared/reka-client.ts` file (see below)

5. Click **Deploy**

---

### Step 3: Create Shared Reka Client

If the dashboard supports shared files:

1. Create file: `_shared/reka-client.ts`

2. **Copy and paste this code:**

```typescript
export interface RekaClipRequest {
  video_urls: string[]
  prompt?: string
  template?: 'moments' | 'compilation'
  num_generations?: number
  duration_range?: {
    min?: number
    max?: number
  }
  source_start_time?: number
  source_end_time?: number
  aspect_ratio?: '9:16' | '16:9' | '4:5' | '1:1'
  resolution?: number
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
```

---

### Step 4: Deploy `upload-video` Function

1. Click **"New Function"** or **"Deploy new function"**

2. Function name: `upload-video`

3. **Run this command to get the code:**
```bash
cat /root/reka-sports-highlights/supabase/functions/upload-video/index.ts
```

4. Copy the output and paste into the dashboard

5. Click **Deploy**

---

### Step 5: Set Environment Variables

1. Go to: https://supabase.com/dashboard/project/nxllstmdmqcaiodoensd/settings/functions

2. Add these environment variables:

```
SUPABASE_URL=https://nxllstmdmqcaiodoensd.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bGxzdG1kbXFjYWlvZG9lbnNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDc5NzYsImV4cCI6MjA5MjEyMzk3Nn0.Xpktu3tuFSqSmH991tXOmyFJiQpBAEivZrlYYbwOeQA
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bGxzdG1kbXFjYWlvZG9lbnNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjU0Nzk3NiwiZXhwIjoyMDkyMTIzOTc2fQ.1_EAnxl5tP7V9kYsANypZArC-Fnd0FwemwzxWvmvkAA
REKA_API_KEY=<YOUR_REKA_API_KEY>
```

---

## ✅ Deployment Complete!

Test your functions:

```bash
curl -X POST 'https://nxllstmdmqcaiodoensd.supabase.co/functions/v1/generate-clips' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bGxzdG1kbXFjYWlvZG9lbnNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDc5NzYsImV4cCI6MjA5MjEyMzk3Nn0.Xpktu3tuFSqSmH991tXOmyFJiQpBAEivZrlYYbwOeQA' \
  -H 'Content-Type: application/json' \
  -d '{"videoId": "test-123", "settings": {"template": "moments"}}'
```

---

## Alternative: Files Location

All function files are ready at:
- `/root/reka-sports-highlights/supabase/functions/generate-clips/index.ts`
- `/root/reka-sports-highlights/supabase/functions/upload-video/index.ts`
- `/root/reka-sports-highlights/supabase/functions/_shared/reka-client.ts`

You can copy these directly from the filesystem.
