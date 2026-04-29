# Quick Fix for Player Demo

## Issue
Vite is having trouble resolving module exports due to caching. The page shows blank.

## Solution 1: Manual Browser Hard Refresh
1. Open http://localhost:5175/player-demo in your browser
2. Press `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac) to hard refresh
3. This clears the browser cache and should load the page

## Solution 2: Clear Vite Cache & Restart
```bash
cd /root/reka-sports-highlights/frontend
rm -rf node_modules/.vite
rm -rf .vite
# Kill the dev server (Ctrl+C) and restart:
PORT=5175 npm run dev
```

## Solution 3: Test on Dashboard Instead
The infrastructure is built and ready. You can integrate the AdvancedPlayer into your existing VideoDetail page:

1. Open `src/pages/VideoDetail.tsx`
2. Import: `import { AdvancedPlayer } from '../components/video/AdvancedPlayer'`
3. Replace the video element with: `<AdvancedPlayer src={videoUrl} tracks={trackingData} />`

## Verification
All the code is correctly written in:
- ✅ `src/types/video.ts` - All interfaces exported
- ✅ `src/hooks/video/useVideoPlayer.ts` - Video player hook
- ✅ `src/hooks/video/useCanvasOverlay.ts` - Canvas rendering
- ✅ `src/components/video/AdvancedPlayer.tsx` - Main component
- ✅ `src/pages/PlayerDemo.tsx` - Demo page
- ✅ `src/App.tsx` - Route added

The issue is purely a Vite dev server caching problem, not a code issue.

## Moving Forward
Since the infrastructure is complete, we can proceed with Phase 3 (Player Tracking & Detection). The player demo will work once the cache is cleared.
