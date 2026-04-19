# Supabase Edge Functions - Reka Sports Highlights

This directory contains Edge Functions for the Reka Sports Highlights platform.

## Setup

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env and add your credentials
   ```

3. **Test Reka.ai integration**:
   ```bash
   # Set your API key
   export REKA_API_KEY=your-api-key-here

   # Run the test script
   deno run --allow-net --allow-env supabase/functions/_shared/test-reka.ts
   ```

## Edge Functions

### `generate-clips`

Generates video clips using Reka.ai Vision Agent.

**Endpoint**: `POST /functions/v1/generate-clips`

**Request**:
```json
{
  "videoId": "uuid-of-video",
  "settings": {
    "template": "moments",
    "num_clips": 3,
    "aspect_ratio": "9:16",
    "resolution": 720,
    "prompt": "Create engaging highlights from this sports video"
  }
}
```

**Response**:
```json
{
  "success": true,
  "jobId": "uuid-of-job",
  "rekaClipId": "reka-clip-id",
  "status": "processing",
  "message": "Clip generation started. Poll the job status to check progress."
}
```

## Local Development

1. **Start Supabase locally**:
   ```bash
   supabase start
   ```

2. **Serve functions locally**:
   ```bash
   supabase functions serve
   ```

3. **Test the function**:
   ```bash
   curl -i --location --request POST 'http://localhost:54321/functions/v1/generate-clips' \
     --header 'Authorization: Bearer YOUR_ANON_KEY' \
     --header 'Content-Type: application/json' \
     --data '{"videoId":"test-video-id","settings":{"template":"moments"}}'
   ```

## Deployment

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy generate-clips
```

## Environment Variables

The following environment variables are required:

- `DB_URL`: Your Supabase project URL
- `DB_SERVICE_ROLE_KEY`: Service role key for admin operations
- `REKA_API_KEY`: Reka.ai Vision Agent API key

## Architecture

```
_shared/
  ├── reka-client.ts    # Reka.ai API client
  └── test-reka.ts      # Integration test script

generate-clips/
  └── index.ts          # Clip generation Edge Function
```

## Reka.ai Vision Agent

### API Documentation
- Base URL: `https://vision-agent.api.reka.ai`
- Docs: https://docs.reka.ai/vision/overview

### Features
- **Templates**: `moments` (highlight moments) or `compilation` (full compilation)
- **Aspect Ratios**: 9:16 (vertical), 16:9 (horizontal), 4:5 (Instagram), 1:1 (square)
- **Resolution**: 240-1080p (default: 720p)
- **Generations**: 1-3 clips per request
- **Auto-captioning**: Optional subtitle generation

### Workflow
1. Submit video URL(s) to `/v1/clips`
2. Receive clip generation job ID
3. Poll `/v1/clips/{id}` for status
4. Download completed clips when status is `completed`

## Troubleshooting

### Reka API Health Check Fails
- Verify your API key is correct
- Check network connectivity
- Ensure the API endpoint is accessible

### Function Deployment Fails
- Verify Supabase CLI is installed and authenticated
- Check function syntax with `deno check`
- Review Supabase project settings

### Clip Generation Timeout
- Increase `REKA_POLL_MAX_ATTEMPTS` (default: 60)
- Increase `REKA_POLL_INTERVAL_MS` (default: 5000ms)
- Check video length and complexity

## Next Steps

1. Implement a background worker for polling clip status
2. Add webhook support for completion notifications
3. Create a scheduled function to check pending jobs
4. Add retry logic for failed generations
5. Implement clip storage in Supabase Storage
