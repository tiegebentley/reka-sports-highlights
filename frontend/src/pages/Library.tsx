import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Video, Clock, Calendar, ExternalLink, Upload as UploadIcon, Loader2, AlertCircle, PlayCircle, Scissors, CheckCircle2, Trash2, ChevronLeft, ChevronRight, ArrowUpDown, RefreshCw, AlertTriangle } from 'lucide-react'

type VideoStatus = 'uploaded' | 'processing' | 'completed' | 'failed'
type SourceType = 'upload' | 'youtube' | 'twitch'
type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc'

interface VideoRecord {
  id: string
  user_id: string
  title: string
  source_type: SourceType
  source_url: string | null
  storage_path: string | null
  duration_seconds: number | null
  file_size_bytes: number | null
  resolution: string | null
  status: VideoStatus
  created_at: string
  updated_at: string
}

interface ProcessingJob {
  videoId: string
  jobId: string
  startTime: number
  estimatedDuration: number
  timeoutWarningShown: boolean
}

export function Library() {
  const [videos, setVideos] = useState<VideoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generatingClips, setGeneratingClips] = useState<Set<string>>(new Set())
  const [deletingVideo, setDeletingVideo] = useState<string | null>(null)
  const [processingJobs, setProcessingJobs] = useState<Map<string, ProcessingJob>>(new Map())

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [sortBy, setSortBy] = useState<SortOption>('date_desc')
  const [totalCount, setTotalCount] = useState(0)

  const navigate = useNavigate()

  useEffect(() => {
    fetchVideos()
  }, [currentPage, itemsPerPage, sortBy])

  const fetchVideos = async () => {
    try {
      setLoading(true)
      setError(null)

      // Check auth
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setError('You must be logged in to view your videos.')
        setLoading(false)
        return
      }

      // Get total count
      const { count } = await supabase
        .from('videos')
        .select('*', { count: 'exact', head: true })

      setTotalCount(count || 0)

      // Determine sort column and direction
      const [sortColumn, sortDirection] = sortBy === 'date_desc' ? ['created_at', false]
        : sortBy === 'date_asc' ? ['created_at', true]
        : sortBy === 'name_asc' ? ['title', true]
        : ['title', false]

      // Fetch paginated and sorted videos
      const from = (currentPage - 1) * itemsPerPage
      const to = from + itemsPerPage - 1

      const { data, error: fetchError } = await supabase
        .from('videos')
        .select('*')
        .order(sortColumn as 'created_at' | 'title', { ascending: sortDirection })
        .range(from, to)

      if (fetchError) {
        throw fetchError
      }

      setVideos(data || [])
    } catch (err: any) {
      console.error('Error fetching videos:', err)
      setError(err.message || 'Failed to load videos')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteVideo = async (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent navigation to detail page

    if (!confirm('Are you sure you want to delete this video? This will also delete all associated clips and cannot be undone.')) {
      return
    }

    try {
      setDeletingVideo(videoId)

      const { data: videoRow } = await supabase
        .from('videos')
        .select('storage_path')
        .eq('id', videoId)
        .maybeSingle()

      const { error: deleteError } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId)

      if (deleteError) {
        throw deleteError
      }

      if (videoRow?.storage_path) {
        const { error: storageError } = await supabase.storage
          .from('video-uploads')
          .remove([videoRow.storage_path])
        if (storageError) {
          console.warn('Storage cleanup failed (DB row already deleted):', storageError)
        }
      }

      // Remove from local state
      setVideos(prev => prev.filter(v => v.id !== videoId))
      setTotalCount(prev => prev - 1)

      // If current page is empty after deletion, go to previous page
      if (videos.length === 1 && currentPage > 1) {
        setCurrentPage(prev => prev - 1)
      }
    } catch (err: any) {
      console.error('Error deleting video:', err)
      alert(`Failed to delete video: ${err.message}`)
    } finally {
      setDeletingVideo(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Unknown'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown'
    const mb = bytes / (1024 * 1024)
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`
    if (mb < 1024) return `${mb.toFixed(1)} MB`
    return `${(mb / 1024).toFixed(2)} GB`
  }

  const estimateProcessingTime = (video: VideoRecord): number => {
    // If we don't have duration, use a default estimate of 3-5 minutes
    if (!video.duration_seconds) {
      // Base estimate: 3 minutes if no file size info
      let estimate = 180

      // Adjust based on file size if available
      if (video.file_size_bytes) {
        const sizeMB = video.file_size_bytes / (1024 * 1024)
        // Larger files likely have longer videos or higher resolution
        if (sizeMB > 100) estimate = 300 // 5 minutes
        if (sizeMB > 200) estimate = 420 // 7 minutes
      }

      return estimate
    }

    // Base estimate: 30 seconds per video second
    let estimate = video.duration_seconds * 30

    // Adjust for file size if available (larger files take longer to download/process)
    if (video.file_size_bytes) {
      const sizeMB = video.file_size_bytes / (1024 * 1024)
      // Add 1 second per MB for processing overhead
      estimate += sizeMB * 1
    }

    // Minimum 1 minute, maximum 10 minutes
    return Math.max(60, Math.min(600, estimate))
  }

  const formatTimeRemaining = (seconds: number) => {
    if (seconds < 60) return `${Math.ceil(seconds)}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${Math.ceil(secs)}s`
  }

  const getStatusColor = (status: VideoStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'uploaded':
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getSourceIcon = (sourceType: SourceType) => {
    switch (sourceType) {
      case 'youtube':
        return <PlayCircle className="w-4 h-4" />
      case 'twitch':
        return <Video className="w-4 h-4" />
      case 'upload':
      default:
        return <UploadIcon className="w-4 h-4" />
    }
  }

  const pollJobStatus = async (jobId: string, videoId: string, video: VideoRecord, maxAttempts = 120) => {
    let attempts = 0
    const estimatedTime = estimateProcessingTime(video)
    const startTime = Date.now()
    const TEN_MINUTES = 10 * 60 * 1000 // 10 minutes in ms

    // Track this job
    setProcessingJobs(prev => new Map(prev).set(videoId, {
      videoId,
      jobId,
      startTime,
      estimatedDuration: estimatedTime,
      timeoutWarningShown: false
    }))

    const poll = async () => {
      try {
        // First, trigger the poll-clip-jobs function to check Reka status
        await supabase.functions.invoke('poll-clip-jobs', { body: {} })

        // Then check the job status from database
        const { data: job, error } = await supabase
          .from('jobs')
          .select('*')
          .eq('id', jobId)
          .single()

        if (error) {
          console.error('Error fetching job:', error)
          return
        }

        const elapsed = Date.now() - startTime

        console.log(`Job ${jobId} status:`, job.status, `Elapsed: ${Math.floor(elapsed / 1000)}s`)

        // Check for 10-minute timeout warning
        if (elapsed > TEN_MINUTES) {
          setProcessingJobs(prev => {
            const updated = new Map(prev)
            const jobData = updated.get(videoId)
            if (jobData && !jobData.timeoutWarningShown) {
              alert(`⚠️ Processing is taking longer than expected (${Math.floor(elapsed / 1000 / 60)} minutes).\n\nThis video might be particularly complex or the Reka API is experiencing high load. The job will continue processing, but you may want to check back later.`)
              updated.set(videoId, { ...jobData, timeoutWarningShown: true })
            }
            return updated
          })
        }

        if (job.status === 'completed') {
          // Job completed - clean up tracking
          setProcessingJobs(prev => {
            const updated = new Map(prev)
            updated.delete(videoId)
            return updated
          })

          // Update video status
          setVideos(prev => prev.map(v =>
            v.id === videoId ? { ...v, status: 'completed' } : v
          ))

          // Refresh the page to show clips
          await fetchVideos()

          const totalTime = Math.floor(elapsed / 1000)
          alert(`✅ Clip generation completed in ${formatTimeRemaining(totalTime)}!`)
          return
        }

        if (job.status === 'failed') {
          // Job failed - clean up tracking
          setProcessingJobs(prev => {
            const updated = new Map(prev)
            updated.delete(videoId)
            return updated
          })

          setVideos(prev => prev.map(v =>
            v.id === videoId ? { ...v, status: 'failed' } : v
          ))

          alert(`❌ Clip generation failed: ${job.error || 'Unknown error'}`)
          return
        }

        // Continue polling if still processing or queued
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000) // Poll every 10 seconds
        } else {
          console.warn('Job polling timeout reached')
          setProcessingJobs(prev => {
            const updated = new Map(prev)
            updated.delete(videoId)
            return updated
          })
          alert('⏱️ Maximum polling time reached. The job may still be processing. Use the "Check Status" button to manually check progress.')
        }
      } catch (err) {
        console.error('Error polling job status:', err)
      }
    }

    // Start polling
    setTimeout(poll, 10000) // First poll after 10 seconds
  }

  const manualCheckStatus = async (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    try {
      // Find the job for this video
      const { data: job, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('video_id', videoId)
        .eq('job_type', 'clip_generation')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !job) {
        alert('No active job found for this video.')
        return
      }

      // Trigger the poll function
      await supabase.functions.invoke('poll-clip-jobs', { body: {} })

      // Refresh to get updated status
      await fetchVideos()

      if (job.status === 'completed') {
        alert('✅ Job completed! Clips are ready.')
      } else if (job.status === 'failed') {
        alert(`❌ Job failed: ${job.error || 'Unknown error'}`)
      } else {
        const jobData = processingJobs.get(videoId)
        if (jobData) {
          const elapsed = Date.now() - jobData.startTime
          const remaining = Math.max(0, jobData.estimatedDuration - elapsed / 1000)
          alert(`⏳ Still processing...\n\nElapsed: ${formatTimeRemaining(elapsed / 1000)}\nEstimated remaining: ${formatTimeRemaining(remaining)}\n\nJob ID: ${job.id}\nReka Clip ID: ${job.metadata?.reka_clip_id || 'Not yet submitted'}`)
        } else {
          const elapsed = Date.now() - new Date(job.created_at).getTime()
          const rekaClipId = job.metadata?.reka_clip_id
          alert(`⏳ Still processing...\n\nStatus: ${job.status}\nElapsed: ${formatTimeRemaining(elapsed / 1000)}\nJob ID: ${job.id}\nReka Clip ID: ${rekaClipId || 'Not yet submitted'}\n\n${rekaClipId ? 'This job has been submitted to Reka. It may be taking longer than expected. Consider checking back in a few minutes.' : 'Job is queued but not yet submitted to Reka.'}`)
        }
      }
    } catch (err: any) {
      console.error('Error checking status:', err)
      alert(`Failed to check status: ${err.message}`)
    }
  }

  const handleGenerateClips = async (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent navigation to detail page

    try {
      // Check if there's already an active job for this video
      const { data: existingJobs, error: jobCheckError } = await supabase
        .from('jobs')
        .select('*')
        .eq('video_id', videoId)
        .eq('job_type', 'clip_generation')
        .in('status', ['queued', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1)

      if (jobCheckError) {
        console.error('Error checking for existing jobs:', jobCheckError)
      }

      if (existingJobs && existingJobs.length > 0) {
        const existingJob = existingJobs[0]
        const video = videos.find(v => v.id === videoId)

        alert(`A clip generation job is already running for this video.\n\nJob started: ${new Date(existingJob.created_at).toLocaleString()}\n\nUse the "Check Status" button to see current progress.`)

        // Update video status to processing if it's not already
        if (video && video.status !== 'processing') {
          await supabase
            .from('videos')
            .update({ status: 'processing' })
            .eq('id', videoId)

          setVideos(prev => prev.map(v =>
            v.id === videoId ? { ...v, status: 'processing' as VideoStatus } : v
          ))
        }

        // Start polling for the existing job
        if (video) {
          pollJobStatus(existingJob.id, videoId, video)
        }

        return
      }

      setGeneratingClips(prev => new Set(prev).add(videoId))

      const response = await supabase.functions.invoke('generate-clips', {
        body: {
          videoId,
          settings: {
            template: 'moments',
            num_clips: 10,
            aspect_ratio: '16:9',
            resolution: 720,
            prompt: 'Identify every key soccer moment: goals, shots on target, saves by the goalkeeper, cards/bookings (yellow or red), penalties, and major fouls. Generate one clip per distinct event with clear context (build-up + outcome).',
          },
        },
      })

      console.log('Full response:', response)

      if (response.error) {
        console.error('Edge Function Error:', response.error)

        // Try to get more error details from the response
        let errorMsg = 'Unknown error'
        if (response.error.message) {
          errorMsg = response.error.message
        }

        // If there's context, try to extract the error
        if (response.error.context) {
          try {
            const contextBody = await response.error.context.text()
            console.error('Error context:', contextBody)
            const parsed = JSON.parse(contextBody)
            if (parsed.error) {
              errorMsg = parsed.error
            }
          } catch (e) {
            console.error('Could not parse error context:', e)
          }
        }

        throw new Error(errorMsg)
      }

      const data = response.data

      if (!data || data.error || !data.success) {
        throw new Error(data?.error || 'Unknown error from server')
      }

      console.log('Clip generation started:', data)

      // Update video status to processing in database
      await supabase
        .from('videos')
        .update({ status: 'processing' })
        .eq('id', videoId)

      // Update video status to processing in local state
      const updatedVideos = videos.map(v =>
        v.id === videoId ? { ...v, status: 'processing' as VideoStatus } : v
      )
      setVideos(updatedVideos)

      // Get the video record to pass to pollJobStatus
      const video = videos.find(v => v.id === videoId)
      if (!video) return

      // Start polling for job status
      pollJobStatus(data.jobId, videoId, video)
    } catch (err: any) {
      console.error('Error generating clips:', err)

      let errorMessage = err.message || 'Unknown error'

      // Special handling for duplicate request error
      if (errorMessage.includes('Duplicate request') || errorMessage.includes('409')) {
        errorMessage = 'A clip generation job is already running for this video. Please wait for it to complete or use the "Check Status" button to check progress.'
      }

      alert(`Failed to generate clips: ${errorMessage}`)
    } finally {
      setGeneratingClips(prev => {
        const newSet = new Set(prev)
        newSet.delete(videoId)
        return newSet
      })
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-heading font-bold mb-6">Video Library</h1>
        <div className="rounded-lg border bg-card p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading your videos...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-heading font-bold mb-6">Video Library</h1>
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-destructive mb-1">Error loading videos</h3>
            <p className="text-sm text-destructive/80">{error}</p>
            {error.includes('logged in') && (
              <button
                onClick={() => navigate('/login')}
                className="mt-3 text-sm font-medium text-destructive hover:underline"
              >
                Go to Login →
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-heading font-bold mb-6">Video Library</h1>
        <div className="rounded-lg border bg-card p-12 text-center">
          <Video className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No videos yet</h3>
          <p className="text-muted-foreground mb-6">Upload your first sports video to get started!</p>
          <button
            onClick={() => navigate('/upload')}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <UploadIcon className="w-4 h-4" />
            Upload Video
          </button>
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil(totalCount / itemsPerPage)
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalCount)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">Video Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCount} {totalCount === 1 ? 'video' : 'videos'} total
          </p>
        </div>
        <button
          onClick={() => navigate('/upload')}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <UploadIcon className="w-4 h-4" />
          Upload New
        </button>
      </div>

      {/* Sort and Filter Controls */}
      {totalCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as SortOption)
                setCurrentPage(1) // Reset to first page on sort change
              }}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1) // Reset to first page on items per page change
              }}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((video) => {
          const isGenerating = generatingClips.has(video.id)
          const isDeleting = deletingVideo === video.id
          const canGenerateClips = video.status === 'uploaded' && (video.source_url || video.storage_path)

          return (
            <div
              key={video.id}
              onClick={() => navigate(`/videos/${video.id}`)}
              className="rounded-lg border bg-card hover:shadow-lg transition-shadow cursor-pointer overflow-hidden group"
            >
              {/* Thumbnail Placeholder */}
              <div className="aspect-video bg-muted flex items-center justify-center relative overflow-hidden">
                <Video className="w-12 h-12 text-muted-foreground group-hover:scale-110 transition-transform" />

                {/* Action Buttons */}
                <div className="absolute top-2 right-2 flex gap-2">
                  {video.source_type !== 'upload' && video.source_url && (
                    <a
                      href={video.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 bg-black/50 hover:bg-black/70 rounded-md text-white transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={(e) => handleDeleteVideo(video.id, e)}
                    disabled={isDeleting}
                    className="p-2 bg-red-500/80 hover:bg-red-600 rounded-md text-white transition-colors disabled:opacity-50"
                    title="Delete video"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Video Info */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-semibold text-lg line-clamp-2 flex-1">{video.title}</h3>
                  <span className={`px-2 py-1 rounded-md text-xs font-medium border ${getStatusColor(video.status)}`}>
                    {video.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-2">
                    {getSourceIcon(video.source_type)}
                    <span className="capitalize">{video.source_type}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(video.created_at)}</span>
                  </div>

                  {video.duration_seconds && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{formatDuration(video.duration_seconds)}</span>
                    </div>
                  )}

                  {video.resolution && (
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4" />
                      <span>{video.resolution}</span>
                    </div>
                  )}
                </div>

                {/* Generate Clips Button */}
                {canGenerateClips && (
                  <button
                    onClick={(e) => handleGenerateClips(video.id, e)}
                    disabled={isGenerating}
                    className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Scissors className="w-4 h-4" />
                        Generate Clips
                      </>
                    )}
                  </button>
                )}

                {video.status === 'processing' && (
                  <div className="space-y-2">
                    <div className="w-full rounded-md bg-blue-100 text-blue-800 px-3 py-2 text-sm font-medium">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </div>
                      {(() => {
                        const jobData = processingJobs.get(video.id)
                        if (jobData) {
                          const elapsed = (Date.now() - jobData.startTime) / 1000
                          const remaining = Math.max(0, jobData.estimatedDuration - elapsed)
                          const progress = Math.min(100, (elapsed / jobData.estimatedDuration) * 100)

                          return (
                            <div className="space-y-1">
                              <div className="w-full bg-blue-200 rounded-full h-1.5">
                                <div
                                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-1000"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <div className="text-xs text-center">
                                Est. {formatTimeRemaining(remaining)} remaining
                              </div>
                            </div>
                          )
                        }
                        return null
                      })()}
                    </div>
                    <button
                      onClick={(e) => manualCheckStatus(video.id, e)}
                      className="w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Check Status
                    </button>
                  </div>
                )}

                {video.status === 'completed' && (
                  <div className="space-y-2">
                    <div className="w-full rounded-md bg-green-100 text-green-800 px-3 py-2 text-sm font-medium flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Clips Ready
                    </div>
                    {/* Routes to the video page where the verify-then-generate flow lives.
                        Direct regeneration here would bypass match context + event verification
                        and undo our quality work. */}
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/videos/${video.id}`) }}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-center gap-2"
                    >
                      <PlayCircle className="w-4 h-4" />
                      Open & Manage
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination Controls */}
      {totalCount > 0 && totalPages > 1 && (
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg border bg-card">
          <div className="text-sm text-muted-foreground">
            Showing {startItem} to {endItem} of {totalCount} videos
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-md border border-input bg-background hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1">
              {/* First page */}
              {currentPage > 2 && (
                <>
                  <button
                    onClick={() => setCurrentPage(1)}
                    className="px-3 py-1.5 rounded-md border border-input bg-background hover:bg-muted transition-colors text-sm"
                  >
                    1
                  </button>
                  {currentPage > 3 && (
                    <span className="px-2 text-muted-foreground">...</span>
                  )}
                </>
              )}

              {/* Current and surrounding pages */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(currentPage - 2 + i, totalPages))
                if (pageNum < 1 || pageNum > totalPages) return null
                if (pageNum === 1 && currentPage > 2) return null
                if (pageNum === totalPages && currentPage < totalPages - 1) return null

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${
                      currentPage === pageNum
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-input bg-background hover:bg-muted'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}

              {/* Last page */}
              {currentPage < totalPages - 1 && (
                <>
                  {currentPage < totalPages - 2 && (
                    <span className="px-2 text-muted-foreground">...</span>
                  )}
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    className="px-3 py-1.5 rounded-md border border-input bg-background hover:bg-muted transition-colors text-sm"
                  >
                    {totalPages}
                  </button>
                </>
              )}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-md border border-input bg-background hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
