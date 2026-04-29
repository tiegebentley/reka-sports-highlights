# Browser Cache Fix

## Issue
You're seeing this error:
```
Uncaught SyntaxError: The requested module '/src/types/video.ts' does not provide an export named 'VideoPlayerState'
```

## Root Cause
This is a **browser cache issue**, not a code issue. The file `src/types/video.ts` correctly exports `VideoPlayerState` on line 23, but your browser is holding onto an old cached version.

## Solution: Hard Refresh

### Chrome/Edge (Windows/Linux):
1. Press `Ctrl + Shift + R`
2. Or: `Ctrl + F5`

### Chrome/Edge (Mac):
1. Press `Cmd + Shift + R`
2. Or: `Cmd + Shift + Delete` → Clear cache → Reload

### Firefox (Windows/Linux):
1. Press `Ctrl + Shift + R`
2. Or: `Ctrl + F5`

### Firefox (Mac):
1. Press `Cmd + Shift + R`

### Safari (Mac):
1. Press `Cmd + Option + R`
2. Or: `Cmd + Option + E` → Empty caches → Reload

## Alternative: Clear Site Data

1. Open DevTools (F12)
2. Go to Application tab (Chrome) or Storage tab (Firefox)
3. Click "Clear site data" or "Clear storage"
4. Reload the page

## Verify Fix

After hard refresh, you should see:
- No errors in console
- HMR updates working
- Pages loading correctly
- TrackingStudio accessible at `/videos/{videoId}/track`

## Why This Happens

Vite's Hot Module Replacement (HMR) caches transformed modules in the browser. When you create new exports, sometimes the browser doesn't invalidate the old cache entries, causing import errors even though the file is correct.

This is a known Vite development behavior and doesn't affect production builds.
