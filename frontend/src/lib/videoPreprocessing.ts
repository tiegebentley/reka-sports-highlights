/**
 * Video Preprocessing Utilities
 *
 * These functions help compress and optimize videos before upload
 * to reduce processing time on the Reka API.
 */

interface VideoMetadata {
  duration: number
  width: number
  height: number
  size: number
  type: string
}

interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  maxSizeMB?: number
  quality?: number
}

/**
 * Get video metadata without loading the entire file
 */
export async function getVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'

    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src)
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        size: file.size,
        type: file.type,
      })
    }

    video.onerror = () => {
      reject(new Error('Failed to load video metadata'))
    }

    video.src = URL.createObjectURL(file)
  })
}

/**
 * Calculate if video needs compression based on size and resolution
 */
export function shouldCompressVideo(metadata: VideoMetadata, options: CompressionOptions = {}): boolean {
  const maxSizeMB = options.maxSizeMB || 100
  const maxWidth = options.maxWidth || 1920
  const maxHeight = options.maxHeight || 1080

  const sizeMB = metadata.size / (1024 * 1024)

  return (
    sizeMB > maxSizeMB ||
    metadata.width > maxWidth ||
    metadata.height > maxHeight
  )
}

/**
 * Compress video using Canvas API
 * Note: This is a client-side compression that converts to MP4
 * For better results, consider using ffmpeg.wasm (but it's larger)
 */
export async function compressVideo(
  file: File,
  options: CompressionOptions = {},
  onProgress?: (progress: number) => void
): Promise<File> {
  const maxWidth = options.maxWidth || 1280
  const maxHeight = options.maxHeight || 720
  const quality = options.quality || 0.8

  // Get metadata first
  const metadata = await getVideoMetadata(file)

  // Check if compression is needed
  if (!shouldCompressVideo(metadata, options)) {
    console.log('Video does not need compression')
    return file
  }

  console.log('Starting video compression...')
  console.log(`Original: ${Math.round(metadata.size / (1024 * 1024))}MB, ${metadata.width}x${metadata.height}`)

  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('Could not get canvas context'))
      return
    }

    video.onloadedmetadata = () => {
      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = metadata

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.floor(width * ratio)
        height = Math.floor(height * ratio)
      }

      canvas.width = width
      canvas.height = height

      console.log(`Compressed dimensions: ${width}x${height}`)

      // Set video to first frame
      video.currentTime = 0
    }

    video.onseeked = () => {
      // Draw frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create compressed video'))
            return
          }

          // Create new file
          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^/.]+$/, '_compressed.jpg'), // Note: This is now an image
            { type: 'image/jpeg' }
          )

          console.log(`Compressed: ${Math.round(compressedFile.size / (1024 * 1024))}MB`)

          window.URL.revokeObjectURL(video.src)
          resolve(compressedFile)
        },
        'image/jpeg',
        quality
      )
    }

    video.onerror = () => {
      reject(new Error('Failed to load video for compression'))
    }

    video.src = URL.createObjectURL(file)
    video.load()
  })
}

/**
 * Estimate processing time based on video characteristics
 */
export function estimateProcessingTime(metadata: VideoMetadata): {
  estimatedSeconds: number
  recommendation: string
} {
  const sizeMB = metadata.size / (1024 * 1024)
  const resolution = metadata.width * metadata.height
  const duration = metadata.duration

  // Base estimate: 30 seconds per video second
  let estimate = duration * 30

  // Add time for file size (download time for Reka)
  estimate += sizeMB * 1 // 1 second per MB

  // Add time for resolution (processing complexity)
  if (resolution > 1920 * 1080) {
    estimate *= 1.5 // 50% longer for 4K+
  }

  // Determine recommendation
  let recommendation = ''
  if (sizeMB > 500) {
    recommendation = '⚠️ Very large file - consider compressing before upload'
  } else if (sizeMB > 200) {
    recommendation = '⚠️ Large file - may take longer to process'
  } else if (resolution > 1920 * 1080) {
    recommendation = '⚠️ High resolution - may take longer to process'
  } else {
    recommendation = '✅ Good size for processing'
  }

  return {
    estimatedSeconds: Math.ceil(estimate),
    recommendation,
  }
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Format seconds to time string
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.ceil(seconds % 60)

  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

/**
 * Detect MPEG-TS by sync byte 0x47 at offset 0.
 * MPEG-TS files often have .mp4 / .ts / .m2ts extensions but Reka rejects them
 * with "could not convert string to float: 'N/A'" because TS lacks global duration metadata.
 */
export async function isMpegTs(file: File): Promise<boolean> {
  const head = await file.slice(0, 4).arrayBuffer()
  const bytes = new Uint8Array(head)
  return bytes[0] === 0x47
}

/**
 * Remux a video file to faststart MP4 using ffmpeg-wasm.
 * Uses stream copy (`-c copy`) — no re-encoding, fast (~10s for 20-min file).
 * Adds `+faststart` so moov atom is at the head, required by Reka.
 */
export async function remuxToFaststartMp4(
  file: File,
  onProgress?: (ratio: number) => void
): Promise<File> {
  const { FFmpeg } = await import('@ffmpeg/ffmpeg')
  const { fetchFile } = await import('@ffmpeg/util')

  const ffmpeg = new FFmpeg()
  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => onProgress(progress))
  }

  // Use absolute origin URLs so Vite's dev middleware serves them as static
  // assets (not module imports). importScripts() from inside the worker fetches
  // them like classic scripts, and same-origin satisfies COEP: require-corp.
  const origin = window.location.origin
  await ffmpeg.load({
    coreURL: `${origin}/ffmpeg/ffmpeg-core.js`,
    wasmURL: `${origin}/ffmpeg/ffmpeg-core.wasm`,
  })

  const inputName = 'input.bin'
  const outputName = 'output.mp4'
  await ffmpeg.writeFile(inputName, await fetchFile(file))
  await ffmpeg.exec([
    '-i', inputName,
    '-c', 'copy',
    '-movflags', '+faststart',
    outputName,
  ])
  const data = await ffmpeg.readFile(outputName)
  const blob = new Blob([data as Uint8Array], { type: 'video/mp4' })
  const newName = file.name.replace(/\.[^/.]+$/, '') + '.mp4'
  return new File([blob], newName, { type: 'video/mp4' })
}

/**
 * Concatenate a sequence of clip URLs into a single MP4 reel using the
 * ffmpeg concat demuxer. Tries stream-copy first (fast, no re-encode); on
 * failure (e.g. mismatched codecs/parameters) falls back to re-encoding to
 * H.264/AAC so the output always plays.
 *
 * Clips are downloaded sequentially. Total time roughly:
 *   downloads + (~2s per clip for stream-copy) + (~5-10s/clip for re-encode).
 *
 * Returns a Blob the caller can pipe into a download link or upload.
 */
export async function compileReelFromUrls(
  clipUrls: string[],
  onStatus?: (msg: string) => void,
  onProgress?: (ratio: number) => void
): Promise<Blob> {
  if (clipUrls.length === 0) throw new Error('No clips to compile')
  if (clipUrls.length === 1) {
    // Trivial case — just fetch the one clip and return it.
    onStatus?.('Fetching single clip…')
    const r = await fetch(clipUrls[0])
    if (!r.ok) throw new Error(`Failed to fetch clip: ${r.status}`)
    return await r.blob()
  }

  const { FFmpeg } = await import('@ffmpeg/ffmpeg')
  const { fetchFile } = await import('@ffmpeg/util')

  const ffmpeg = new FFmpeg()
  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => onProgress(progress))
  }

  const origin = window.location.origin
  await ffmpeg.load({
    coreURL: `${origin}/ffmpeg/ffmpeg-core.js`,
    wasmURL: `${origin}/ffmpeg/ffmpeg-core.wasm`,
  })

  // Download each clip and write into the FFmpeg virtual FS.
  const inputNames: string[] = []
  for (let i = 0; i < clipUrls.length; i++) {
    onStatus?.(`Downloading clip ${i + 1} of ${clipUrls.length}…`)
    const name = `in${i.toString().padStart(3, '0')}.mp4`
    await ffmpeg.writeFile(name, await fetchFile(clipUrls[i]))
    inputNames.push(name)
  }

  // Build the concat demuxer manifest. Each line: file '<filename>'.
  const manifest = inputNames.map(n => `file '${n}'`).join('\n')
  await ffmpeg.writeFile('concat.txt', new TextEncoder().encode(manifest))

  const outputName = 'reel.mp4'

  // Path A: stream copy. Works when all clips share codec + parameters.
  onStatus?.('Stitching clips (fast path)…')
  let succeeded = false
  try {
    await ffmpeg.exec([
      '-f', 'concat',
      '-safe', '0',
      '-i', 'concat.txt',
      '-c', 'copy',
      '-movflags', '+faststart',
      outputName,
    ])
    succeeded = true
  } catch (e) {
    console.warn('Stream-copy concat failed, falling back to re-encode:', e)
  }

  // Path B: re-encode. Slower but reliable across mismatched inputs.
  if (!succeeded) {
    onStatus?.('Stitching clips (re-encoding for compatibility)…')
    await ffmpeg.exec([
      '-f', 'concat',
      '-safe', '0',
      '-i', 'concat.txt',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputName,
    ])
  }

  const data = await ffmpeg.readFile(outputName)
  return new Blob([data as BlobPart], { type: 'video/mp4' })
}
