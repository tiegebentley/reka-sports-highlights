# Reka.ai Integration - Quick Start

## 1. Install Deno (if needed)
```bash
curl -fsSL https://deno.land/install.sh | sh
export PATH="/root/.deno/bin:$PATH"
```

## 2. Configure Environment
```bash
cd /root/reka-sports-highlights/supabase
cp .env.example .env

# Edit .env and add your keys
nano .env
```

## 3. Test Reka API
```bash
export REKA_API_KEY=your-api-key-here

deno run --allow-net --allow-env \
  functions/_shared/test-reka.ts
```

## 4. Deploy Edge Function
```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy
supabase functions deploy generate-clips
```

## 5. Test Edge Function
```bash
curl -i --location --request POST \
  'https://your-project.supabase.co/functions/v1/generate-clips' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "videoId": "test-video-id",
    "settings": {
      "template": "moments",
      "num_clips": 3,
      "aspect_ratio": "9:16"
    }
  }'
```

## 6. Monitor Jobs
```bash
# In Supabase SQL Editor
SELECT * FROM jobs
WHERE job_type = 'clip_generation'
ORDER BY created_at DESC
LIMIT 10;
```

## API Reference

### POST /functions/v1/generate-clips
```typescript
{
  videoId: string
  settings?: {
    template?: 'moments' | 'compilation'
    num_clips?: number              // 1-3
    aspect_ratio?: '9:16' | '16:9' | '4:5' | '1:1'
    resolution?: number             // 240-1080
    prompt?: string
  }
}
```

### Response
```typescript
{
  success: true
  jobId: string                     // Track in Supabase
  rekaClipId: string                // Reka job ID
  status: string                    // 'processing', etc.
  message: string
}
```

## File Locations
- **Client**: `functions/_shared/reka-client.ts`
- **Test**: `functions/_shared/test-reka.ts`
- **Function**: `functions/generate-clips/index.ts`
- **Docs**: `functions/README.md`
- **Integration**: `REKA_INTEGRATION.md`

## Troubleshooting

### "REKA_API_KEY not set"
```bash
export REKA_API_KEY=your-key-here
```

### Type check failed
```bash
deno check functions/_shared/reka-client.ts
```

### Function deployment failed
```bash
supabase functions deploy generate-clips --debug
```

## Support
- Reka Docs: https://docs.reka.ai/vision/overview
- Supabase Docs: https://supabase.com/docs/guides/functions
- Deno Docs: https://deno.land/manual
