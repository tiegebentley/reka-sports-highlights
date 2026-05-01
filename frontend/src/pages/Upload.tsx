import { useState, useRef, useEffect } from 'react'
import { Upload as UploadIcon, Link as LinkIcon, Loader2, CheckCircle, AlertCircle, X, FileVideo, Info, Sparkles, Scissors as ScissorsIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getVideoMetadata, estimateProcessingTime, formatBytes, formatTime } from '../lib/videoPreprocessing'
import type { ProcessingMode, AspectRatio } from '../types'

type UploadMethod = 'file' | 'url' | 'batch'
type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

interface BatchFile {
  id: string
  file: File
  title: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  progress: number
}

interface VideoInfo {
  duration: number
  width: number
  height: number
  size: number
  estimatedProcessingTime: number
  recommendation: string
}

export function Upload() {
  const [method, setMethod] = useState<UploadMethod>('file')
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [title, setTitle] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [analyzingVideo, setAnalyzingVideo] = useState(false)
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([])
  const [authDebug, setAuthDebug] = useState<string>('')
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('sports_analysis')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const batchInputRef = useRef<HTMLInputElement>(null)

  // Debug auth state
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const { data: { user } } = await supabase.auth.getUser()
      setAuthDebug(`Session: ${session ? 'Yes' : 'No'}, User: ${user ? user.email : 'None'}`)
    }
    checkAuth()
  }, [])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setTitle(file.name.replace(/\.[^/.]+$/, '')) // Set title from filename

      // Analyze video metadata
      setAnalyzingVideo(true)
      try {
        const metadata = await getVideoMetadata(file)
        const estimate = estimateProcessingTime(metadata)

        setVideoInfo({
          duration: metadata.duration,
          width: metadata.width,
          height: metadata.height,
          size: metadata.size,
          estimatedProcessingTime: estimate.estimatedSeconds,
          recommendation: estimate.recommendation,
        })
      } catch (err) {
        console.error('Failed to analyze video:', err)
        setVideoInfo(null)
      } finally {
        setAnalyzingVideo(false)
      }
    }
  }

  const handleBatchFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newBatchFiles: BatchFile[] = files
      .filter(file => file.type.startsWith('video/'))
      .map(file => ({
        id: Math.random().toString(36).substring(7),
        file,
        title: file.name.replace(/\.[^/.]+$/, ''),
        status: 'pending' as const,
        progress: 0,
      }))

    setBatchFiles(prev => [...prev, ...newBatchFiles])
  }

  const removeBatchFile = (id: string) => {
    setBatchFiles(prev => prev.filter(f => f.id !== id))
  }

  const updateBatchFileTitle = (id: string, newTitle: string) => {
    setBatchFiles(prev =>
      prev.map(f => f.id === id ? { ...f, title: newTitle } : f)
    )
  }

  const handleBatchUpload = async () => {
    const pendingFiles = batchFiles.filter(f => f.status === 'pending')

    if (pendingFiles.length === 0) {
      setError('No files to upload')
      return
    }

    try {
      // Check auth
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('You must be logged in to upload videos')
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('No user found')
      }

      // Upload files sequentially
      for (const batchFile of pendingFiles) {
        try {
          // Update status to uploading
          setBatchFiles(prev =>
            prev.map(f => f.id === batchFile.id ? { ...f, status: 'uploading' as const, progress: 0 } : f)
          )

          // Call upload-video Edge Function
          const response = await supabase.functions.invoke('upload-video', {
            body: {
              title: batchFile.title,
              sourceType: 'upload',
              fileName: batchFile.file.name,
              processingMode,
              aspectRatio: processingMode === 'short_form' ? aspectRatio : '9:16',
            },
          })

          if (response.error) {
            throw new Error(response.error.message || 'Upload failed')
          }

          const data = response.data

          if (!data || data.error) {
            throw new Error(data?.error || 'Unknown error from server')
          }

          // Upload file to storage
          if (data.uploadUrl) {
            setBatchFiles(prev =>
              prev.map(f => f.id === batchFile.id ? { ...f, progress: 50 } : f)
            )

            const uploadResponse = await fetch(data.uploadUrl, {
              method: 'PUT',
              body: batchFile.file,
              headers: {
                'Content-Type': batchFile.file.type,
              },
            })

            if (!uploadResponse.ok) {
              throw new Error('Failed to upload file to storage')
            }
          }

          // Mark as success
          setBatchFiles(prev =>
            prev.map(f => f.id === batchFile.id ? { ...f, status: 'success' as const, progress: 100 } : f)
          )
        } catch (err: any) {
          console.error(`Error uploading ${batchFile.title}:`, err)
          setBatchFiles(prev =>
            prev.map(f => f.id === batchFile.id ? { ...f, status: 'error' as const, error: err.message } : f)
          )
        }
      }

      // Show completion message
      const successCount = batchFiles.filter(f => f.status === 'success').length
      const errorCount = batchFiles.filter(f => f.status === 'error').length

      alert(`Batch upload complete!\nSuccess: ${successCount}\nFailed: ${errorCount}`)
    } catch (err: any) {
      setError(err.message || 'Batch upload failed')
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file)
      setTitle(file.name.replace(/\.[^/.]+$/, ''))
    }
  }

  const handleFileUpload = async () => {
    if (!selectedFile || !title) {
      setError('Please select a file and enter a title')
      return
    }

    setStatus('uploading')
    setError(null)

    try {
      // Get authenticated user - check session first
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('You must be logged in to upload videos. Please sign in at /login')
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError) {
        throw new Error(`Auth error: ${authError.message}`)
      }

      if (!user) {
        throw new Error('No user found. Your session may have expired. Please log in again.')
      }

      // Call upload-video Edge Function (Supabase client auto-adds auth)
      const response = await supabase.functions.invoke('upload-video', {
        body: {
          title,
          sourceType: 'upload',
          fileName: selectedFile.name,
          processingMode,
          aspectRatio: processingMode === 'short_form' ? aspectRatio : '9:16',
        },
      })

      console.log('Full response:', response)

      if (response.error) {
        console.error('Edge Function Error:', response.error)

        // Try to read the response body to get the actual error message
        let errorMsg = 'Unknown error'
        try {
          const responseBody = await response.error.context.json()
          console.log('Error response body:', responseBody)
          errorMsg = responseBody.error || response.error.message
        } catch (e) {
          errorMsg = response.error.message
        }

        throw new Error(`Upload failed: ${errorMsg}`)
      }

      const data = response.data

      console.log('Upload response data:', data)

      if (!data || data.error) {
        throw new Error(data?.error || 'Unknown error from server')
      }

      // Upload file to storage using signed URL
      if (data.uploadUrl) {
        const uploadResponse = await fetch(data.uploadUrl, {
          method: 'PUT',
          body: selectedFile,
          headers: {
            'Content-Type': selectedFile.type,
          },
        })

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload file to storage')
        }
      }

      setStatus('success')
      setSelectedFile(null)
      setTitle('')

      // Reset after 3 seconds
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err: any) {
      setError(err.message || 'Upload failed')
      setStatus('error')
    }
  }

  const handleUrlUpload = async () => {
    if (!videoUrl || !title) {
      setError('Please enter both URL and title')
      return
    }

    setStatus('uploading')
    setError(null)

    try {
      // Get authenticated user - check session first
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('You must be logged in to upload videos. Please sign in at /login')
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError) {
        throw new Error(`Auth error: ${authError.message}`)
      }

      if (!user) {
        throw new Error('No user found. Your session may have expired. Please log in again.')
      }

      // Detect source type
      const sourceType = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')
        ? 'youtube'
        : videoUrl.includes('twitch.tv')
        ? 'twitch'
        : 'upload'

      // Call upload-video Edge Function (Supabase client auto-adds auth)
      const { data, error: uploadError } = await supabase.functions.invoke('upload-video', {
        body: {
          title,
          sourceType,
          sourceUrl: videoUrl,
          processingMode,
          aspectRatio: processingMode === 'short_form' ? aspectRatio : '9:16',
        },
      })

      if (uploadError) {
        console.error('Edge Function Error:', uploadError)
        console.error('Error details:', JSON.stringify(uploadError, null, 2))
        throw new Error(`Upload failed: ${uploadError.message || 'Unknown error'}`)
      }

      console.log('Upload response:', data)

      if (!data || data.error) {
        throw new Error(data?.error || 'Unknown error from server')
      }

      setStatus('success')
      setVideoUrl('')
      setTitle('')

      // Reset after 3 seconds
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err: any) {
      setError(err.message || 'Upload failed')
      setStatus('error')
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-heading font-bold mb-6">Upload Video</h1>

      {/* Auth Debug Info */}
      {authDebug && (
        <div className="max-w-2xl mx-auto mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
          🔍 Auth Debug: {authDebug}
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        {/* Method Selector */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMethod('file')}
            className={`flex-1 rounded-lg px-4 py-2 font-medium transition-colors ${
              method === 'file'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            <UploadIcon className="inline-block w-4 h-4 mr-2" />
            Single File
          </button>
          <button
            onClick={() => setMethod('batch')}
            className={`flex-1 rounded-lg px-4 py-2 font-medium transition-colors ${
              method === 'batch'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            <FileVideo className="inline-block w-4 h-4 mr-2" />
            Batch Upload
          </button>
          <button
            onClick={() => setMethod('url')}
            className={`flex-1 rounded-lg px-4 py-2 font-medium transition-colors ${
              method === 'url'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            <LinkIcon className="inline-block w-4 h-4 mr-2" />
            From URL
          </button>
        </div>

        {/* File Upload */}
        {method === 'file' && (
          <div className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border-2 border-dashed border-border p-12 text-center cursor-pointer hover:border-primary transition-colors"
            >
              <UploadIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">
                {selectedFile ? selectedFile.name : 'Upload your sports video'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop or click to select a video file
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Video Info Display */}
            {analyzingVideo && (
              <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Analyzing video...</p>
              </div>
            )}

            {videoInfo && !analyzingVideo && (
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <h4 className="font-semibold text-sm">Video Information</h4>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div className="text-muted-foreground">Duration:</div>
                      <div className="font-medium">{formatTime(videoInfo.duration)}</div>

                      <div className="text-muted-foreground">Resolution:</div>
                      <div className="font-medium">{videoInfo.width}x{videoInfo.height}</div>

                      <div className="text-muted-foreground">File Size:</div>
                      <div className="font-medium">{formatBytes(videoInfo.size)}</div>

                      <div className="text-muted-foreground">Est. Processing:</div>
                      <div className="font-medium">{formatTime(videoInfo.estimatedProcessingTime)}</div>
                    </div>

                    <div className={`text-xs p-2 rounded ${
                      videoInfo.recommendation.startsWith('⚠️')
                        ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                        : 'bg-green-50 text-green-800 border border-green-200'
                    }`}>
                      {videoInfo.recommendation}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Video Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter video title"
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </div>

            {/* Processing Mode Selector */}
            <div>
              <label className="block text-sm font-medium mb-3">Processing Mode</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setProcessingMode('sports_analysis')}
                  className={`relative rounded-lg border-2 p-4 text-left transition-all ${
                    processingMode === 'sports_analysis'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Sparkles className={`w-5 h-5 mt-0.5 ${
                      processingMode === 'sports_analysis' ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-1">Sports Analysis</h4>
                      <p className="text-xs text-muted-foreground">
                        AI automatically detects player moments, key highlights, and game events
                      </p>
                    </div>
                  </div>
                  {processingMode === 'sports_analysis' && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle className="w-4 h-4 text-primary fill-current" />
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setProcessingMode('short_form')}
                  className={`relative rounded-lg border-2 p-4 text-left transition-all ${
                    processingMode === 'short_form'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <ScissorsIcon className={`w-5 h-5 mt-0.5 ${
                      processingMode === 'short_form' ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-1">Short-form Clipping</h4>
                      <p className="text-xs text-muted-foreground">
                        Manual segment selection with captions and custom aspect ratios
                      </p>
                    </div>
                  </div>
                  {processingMode === 'short_form' && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle className="w-4 h-4 text-primary fill-current" />
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Aspect Ratio Selector (only for short-form mode) */}
            {processingMode === 'short_form' && (
              <div>
                <label className="block text-sm font-medium mb-2">Aspect Ratio</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['1:1', '4:5', '9:16', '16:9'] as AspectRatio[]).map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setAspectRatio(ratio)}
                      className={`rounded-md border-2 px-3 py-2 text-sm font-medium transition-all ${
                        aspectRatio === ratio
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {aspectRatio === '1:1' && '• Square - Instagram posts'}
                  {aspectRatio === '4:5' && '• Portrait - Instagram feed'}
                  {aspectRatio === '9:16' && '• Vertical - Stories, Reels, TikTok'}
                  {aspectRatio === '16:9' && '• Landscape - YouTube, Twitter'}
                </p>
              </div>
            )}

            <button
              onClick={handleFileUpload}
              disabled={!selectedFile || !title || status === 'uploading'}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'uploading' ? (
                <>
                  <Loader2 className="inline-block w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : status === 'success' ? (
                <>
                  <CheckCircle className="inline-block w-4 h-4 mr-2" />
                  Uploaded!
                </>
              ) : (
                'Upload Video'
              )}
            </button>
          </div>
        )}

        {/* URL Upload */}
        {method === 'url' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Video URL</label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or https://twitch.tv/..."
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Supports YouTube and Twitch URLs
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Video Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter video title"
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </div>

            <button
              onClick={handleUrlUpload}
              disabled={!videoUrl || !title || status === 'uploading'}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'uploading' ? (
                <>
                  <Loader2 className="inline-block w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : status === 'success' ? (
                <>
                  <CheckCircle className="inline-block w-4 h-4 mr-2" />
                  Added!
                </>
              ) : (
                'Add Video'
              )}
            </button>
          </div>
        )}

        {/* Batch Upload */}
        {method === 'batch' && (
          <div className="space-y-4">
            <div
              onClick={() => batchInputRef.current?.click()}
              className="rounded-lg border-2 border-dashed border-border p-12 text-center cursor-pointer hover:border-primary transition-colors"
            >
              <FileVideo className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Upload Multiple Videos</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Click to select multiple video files
              </p>
              <input
                ref={batchInputRef}
                type="file"
                accept="video/*"
                multiple
                onChange={handleBatchFileSelect}
                className="hidden"
              />
            </div>

            {/* Batch Files List */}
            {batchFiles.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold">Files to Upload ({batchFiles.length})</h3>
                {batchFiles.map((batchFile) => (
                  <div
                    key={batchFile.id}
                    className="rounded-lg border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={batchFile.title}
                          onChange={(e) => updateBatchFileTitle(batchFile.id, e.target.value)}
                          disabled={batchFile.status !== 'pending'}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                          placeholder="Video title"
                        />
                        <p className="text-xs text-muted-foreground mt-1">{batchFile.file.name}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {batchFile.status === 'pending' && (
                          <button
                            onClick={() => removeBatchFile(batchFile.id)}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        {batchFile.status === 'uploading' && (
                          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                        )}
                        {batchFile.status === 'success' && (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        )}
                        {batchFile.status === 'error' && (
                          <AlertCircle className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {batchFile.status === 'uploading' && batchFile.progress > 0 && (
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${batchFile.progress}%` }}
                        />
                      </div>
                    )}

                    {/* Error Message */}
                    {batchFile.error && (
                      <p className="text-xs text-destructive">{batchFile.error}</p>
                    )}
                  </div>
                ))}

                <button
                  onClick={handleBatchUpload}
                  disabled={batchFiles.filter(f => f.status === 'pending').length === 0}
                  className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <UploadIcon className="w-4 h-4" />
                  Upload {batchFiles.filter(f => f.status === 'pending').length} Videos
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
