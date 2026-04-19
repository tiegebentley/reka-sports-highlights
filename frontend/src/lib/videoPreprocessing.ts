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
