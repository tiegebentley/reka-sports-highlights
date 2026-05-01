import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  Video,
  Clock,
  Calendar,
  ArrowLeft,
  Scissors,
  Loader2,
  PlayCircle,
  Download,
  Share2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react'

type VideoStatus = 'uploaded' | 'processing' | 'completed' | 'failed'
type SourceType = 'upload' | 'youtube' | 'twitch'
type ProcessingMode = 'sports_analysis' | 'short_form'
type AspectRatio = '1:1' | '4:5' | '9:16' | '16:9'

interface VideoRecord {
  id: string
  user_id: string
  title: string
  source_type: SourceType
  source_url: string | null
  storage_path: string | null
  duration_seconds: number | null
  resolution: string | null
  status: VideoStatus
  processing_mode: ProcessingMode // NEW: determines clip generation workflow
  created_at: string
  updated_at: string
}

interface ClipRecord {
  id: string
  video_id: string
  user_id: string
  reka_clip_id: string | null
  clip_url: string | null
  title: string | null
  caption: string | null
  hashtags: string[] | null
  quality_score: number | null
  start_time: number | null
  end_time: number | null
  aspect_ratio: AspectRatio | null
  resolution: string | null
  processing_mode: ProcessingMode // NEW: sports_analysis or short_form
  segment_start: number | null // NEW: for short_form mode manual selection
  segment_end: number | null // NEW: for short_form mode manual selection
  created_at: string
}

interface JobRecord {
  id: string
  user_id: string
  video_id: string | null
  job_type: 'clip_generation' | 'tagging' | 'analysis'
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  result: any
  error: string | null
  created_at: string
  updated_at: string
}

export function VideoDetail() {
  const { videoId } = useParams<{ videoId: string }>()
  const navigate = useNavigate()

  const [video, setVideo] = useState<VideoRecord | null>(null)
  const [clips, setClips] = useState<ClipRecord[]>([])
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generatingClips, setGeneratingClips] = useState(false)
  const [polling, setPolling] = useState(false)

  useEffect(() => {
    if (videoId) {
      fetchVideoDetails()
    }
  }, [videoId])

  const fetchVideoDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      // Check auth
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setError('You must be logged in to view video details.')
        setLoading(false)
        return
      }

      // Fetch video
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .single()

      if (videoError) {
        throw videoError
      }

      setVideo(videoData)

      // Fetch clips
      const { data: clipsData, error: clipsError } = await supabase
        .from('clips')
        .select('*')
        .eq('video_id', videoId)
        .order('created_at', { ascending: false })

      if (clipsError && clipsError.code !== 'PGRST116') {
        // PGRST116 = no rows found (ok)
        console.error('Error fetching clips:', clipsError)
      }

      setClips(clipsData || [])

      // Fetch jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .eq('video_id', videoId)
        .order('created_at', { ascending: false })

      if (jobsError && jobsError.code !== 'PGRST116') {
        console.error('Error fetching jobs:', jobsError)
      }

      setJobs(jobsData || [])
    } catch (err: any) {
      console.error('Error fetching video details:', err)
      setError(err.message || 'Failed to load video details')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateClips = async () => {
    if (!video) return

    try {
      setGeneratingClips(true)

      const { data, error: generateError } = await supabase.functions.invoke('generate-clips', {
        body: {
          videoId: video.id,
          settings: {
            template: 'moments',
            num_clips: 3,
            aspect_ratio: '9:16',
            resolution: 720,
          },
        },
      })

      if (generateError) {
        throw generateError
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      console.log('Clip generation started:', data)

      // Update video status
      setVideo({ ...video, status: 'processing' })

      // Refresh jobs list
      await fetchVideoDetails()

      alert(`Clip generation started! Job ID: ${data?.jobId}`)
    } catch (err: any) {
      console.error('Error generating clips:', err)
      alert(`Failed to generate clips: ${err.message}`)
    } finally {
      setGeneratingClips(false)
    }
  }

  const handlePollJobs = async () => {
    try {
      setPolling(true)

      const { data, error: pollError } = await supabase.functions.invoke('poll-clip-jobs')

      if (pollError) {
        throw pollError
      }

      console.log('Poll result:', data)

      // Refresh to see new clips
      await fetchVideoDetails()

      alert(`Polling complete! ${data?.jobsPolled || 0} jobs checked.`)
    } catch (err: any) {
      console.error('Error polling jobs:', err)
      alert(`Failed to poll jobs: ${err.message}`)
    } finally {
      setPolling(false)
    }
  }

  const handleFetchClipUrls = async () => {
    try {
      setPolling(true)

      // Get the reka_clip_id from the first clip (they all share the same one)
      const rekaClipId = clips[0]?.reka_clip_id

      if (!rekaClipId) {
        alert('No Reka clip ID found')
        return
      }

      console.log('Fetching clip URLs for Reka clip ID:', rekaClipId)

      // Call our Edge Function to fetch clip URLs securely
      const { data, error: fetchError } = await supabase.functions.invoke('fetch-clip-urls', {
        body: {
          rekaClipId,
          clipIds: clips.map(c => c.id),
        },
      })

      if (fetchError) {
        throw fetchError
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      console.log('=== FETCH RESULT ===')
      console.log('Success:', data?.success)
      console.log('Clips updated:', data?.clipsUpdated)
      console.log('Clips:', data?.clips)
      console.log('Full data:', data)
      console.log('=== END FETCH RESULT ===')

      if (data?.success) {
        // Force a fresh fetch from database
        setLoading(true)
        await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second for DB
        await fetchVideoDetails()
        setLoading(false)

        if (data.clipsUpdated > 0) {
          alert(`Clip videos fetched successfully! ${data.clipsUpdated} clips updated.`)
        } else {
          alert('No clips were updated. Check console for details.')
        }
      } else {
        alert(data?.message || 'Failed to fetch clip URLs')
      }
    } catch (err: any) {
      console.error('Error fetching clip URLs:', err)
      alert(`Failed to fetch clip URLs: ${err.message}`)
    } finally {
      setPolling(false)
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

  const getStatusColor = (status: VideoStatus | 'queued' | 'processing' | 'completed' | 'failed') => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'queued':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'uploaded':
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border bg-card p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading video details...</p>
        </div>
      </div>
    )
  }

  if (error || !video) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-destructive mb-1">Error loading video</h3>
            <p className="text-sm text-destructive/80">{error || 'Video not found'}</p>
            <button
              onClick={() => navigate('/library')}
              className="mt-3 text-sm font-medium text-destructive hover:underline"
            >
              ← Back to Library
            </button>
          </div>
        </div>
      </div>
    )
  }

  const canGenerateClips = video.status === 'uploaded' && (video.source_url || video.storage_path)
  const hasActiveJobs = jobs.some(j => j.status === 'queued' || j.status === 'processing')

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/library')}
          className="p-2 rounded-md hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-heading font-bold flex-1">{video.title}</h1>
        <span className={`px-3 py-1 rounded-md text-sm font-medium border ${getStatusColor(video.status)}`}>
          {video.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Video Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video Player / Thumbnail */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="aspect-video bg-muted flex items-center justify-center relative">
              <Video className="w-16 h-16 text-muted-foreground" />
              {video.source_type !== 'upload' && video.source_url && (
                <a
                  href={video.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute top-4 right-4 p-3 bg-black/50 hover:bg-black/70 rounded-md text-white transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
              )}
            </div>

            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Video Information</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Source Type</span>
                  <p className="font-medium capitalize">{video.source_type}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p className="font-medium capitalize">{video.status}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Duration</span>
                  <p className="font-medium">{formatDuration(video.duration_seconds)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Resolution</span>
                  <p className="font-medium">{video.resolution || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Uploaded</span>
                  <p className="font-medium">{formatDate(video.created_at)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Clips</span>
                  <p className="font-medium">{clips.length}</p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                {canGenerateClips && (
                  <button
                    onClick={handleGenerateClips}
                    disabled={generatingClips || hasActiveJobs}
                    className="flex-1 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {generatingClips ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Starting...
                      </>
                    ) : hasActiveJobs ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Scissors className="w-4 h-4" />
                        Generate Clips
                      </>
                    )}
                  </button>
                )}
                {hasActiveJobs && (
                  <button
                    onClick={handlePollJobs}
                    disabled={polling}
                    className="rounded-md border border-input bg-background px-4 py-3 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {polling ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Polling...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Check Status
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Clips Grid */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Generated Clips ({clips.length})</h2>
              {clips.length > 0 && clips.some(c => !c.clip_url) && (
                <button
                  onClick={handleFetchClipUrls}
                  disabled={polling}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {polling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Fetching Videos...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Fetch Clip Videos
                    </>
                  )}
                </button>
              )}
            </div>

            {clips.length === 0 ? (
              <div className="text-center py-12">
                <Scissors className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-2">No clips generated yet</p>
                <p className="text-sm text-muted-foreground">
                  Click "Generate Clips" to create highlight clips from this video
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {clips.map((clip) => (
                  <div key={clip.id} className="rounded-lg border bg-muted/50 overflow-hidden">
                    <div className="aspect-video bg-muted flex items-center justify-center">
                      {clip.clip_url ? (
                        <video
                          src={clip.clip_url}
                          controls
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            console.error('Video failed to load:', clip.clip_url, e)
                          }}
                        />
                      ) : (
                        <div className="text-center p-4">
                          <PlayCircle className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">
                            {clip.reka_clip_id ? 'Processing...' : 'No video URL'}
                          </p>
                          {!clip.reka_clip_id && (
                            <button
                              onClick={handlePollJobs}
                              className="mt-2 text-xs text-primary hover:underline"
                            >
                              Click "Check Status" to fetch clip
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-sm mb-2">{clip.title || 'Untitled Clip'}</h3>
                      {clip.caption && (
                        <p className="text-xs text-muted-foreground mb-2">{clip.caption}</p>
                      )}
                      {clip.quality_score && (
                        <div className="text-xs text-muted-foreground mb-2">
                          Quality: {clip.quality_score}/100
                        </div>
                      )}
                      {clip.hashtags && clip.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {clip.hashtags.map((tag, i) => (
                            <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Debug info */}
                      <details className="text-xs text-muted-foreground mb-3">
                        <summary className="cursor-pointer hover:text-foreground">Debug Info</summary>
                        <pre className="mt-2 p-2 bg-muted rounded text-[10px] overflow-auto max-h-32">
                          {JSON.stringify({
                            id: clip.id,
                            clip_url: clip.clip_url,
                            reka_clip_id: clip.reka_clip_id
                          }, null, 2)}
                        </pre>
                      </details>
                      <div className="flex gap-2">
                        {clip.clip_url ? (
                          <>
                            <a
                              href={clip.clip_url}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 text-xs rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-1"
                            >
                              <Download className="w-3 h-3" />
                              Download
                            </a>
                            <button className="flex-1 text-xs rounded-md border border-input bg-background px-3 py-2 font-medium hover:bg-muted transition-colors flex items-center justify-center gap-1">
                              <Share2 className="w-3 h-3" />
                              Share
                            </button>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            Clip URL not available yet
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Jobs */}
        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold mb-4">Processing Jobs ({jobs.length})</h2>

            {jobs.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No processing jobs yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div key={job.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-sm font-medium capitalize">{job.job_type.replace('_', ' ')}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                    </div>
                    {job.progress > 0 && (
                      <div className="mb-2">
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className="bg-primary h-1.5 rounded-full transition-all"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{job.progress}%</p>
                      </div>
                    )}
                    {job.error && (
                      <p className="text-xs text-destructive mt-2">{job.error}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">{formatDate(job.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
