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
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
} from 'lucide-react'

// Soccer event taxonomy. Each tag has a label + Tailwind colour token used
// for both the pill and the filter chip. Keep in sync with
// supabase/functions/_shared/extract-tags.ts.
const SOCCER_TAGS = [
  { id: 'goal',           label: 'Goal',           cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'shot',           label: 'Shot',           cls: 'bg-sky-100 text-sky-800 border-sky-200' },
  { id: 'shot_on_target', label: 'On Target',      cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'save',           label: 'Save',           cls: 'bg-violet-100 text-violet-800 border-violet-200' },
  { id: 'corner',         label: 'Corner',         cls: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { id: 'kickoff',        label: 'Kickoff',        cls: 'bg-slate-100 text-slate-800 border-slate-200' },
  { id: 'yellow_card',    label: 'Yellow Card',    cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { id: 'red_card',       label: 'Red Card',       cls: 'bg-red-100 text-red-800 border-red-300' },
  { id: 'foul',           label: 'Foul',           cls: 'bg-orange-100 text-orange-800 border-orange-200' },
  { id: 'penalty',        label: 'Penalty',        cls: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200' },
] as const

const TAG_BY_ID = Object.fromEntries(SOCCER_TAGS.map(t => [t.id, t]))

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
  tags: string[] | null
  quality_score: number | null
  start_time: number | null
  end_time: number | null
  aspect_ratio: AspectRatio | null
  resolution: string | null
  processing_mode: ProcessingMode // NEW: sports_analysis or short_form
  segment_start: number | null // for short_form mode manual selection AND per-event source window
  segment_end: number | null
  // Per-event mode: source event metadata persisted by poll-clip-jobs.
  event_type: string | null
  event_description: string | null
  event_confidence: number | null
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
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set())
  // Sort modes: time_asc = chronological (event order in source video),
  // score_desc = highest-quality first (best clips). Default to chronological
  // because that's how the filter UI currently presents counts.
  type ClipSort = 'time_asc' | 'time_desc' | 'score_desc' | 'score_asc'
  const [clipSort, setClipSort] = useState<ClipSort>('time_asc')
  const [editingTagsFor, setEditingTagsFor] = useState<string | null>(null)
  const [editingTagsDraft, setEditingTagsDraft] = useState<Set<string>>(new Set())
  const [analyzingEvents, setAnalyzingEvents] = useState(false)
  const [analyzeEventsResult, setAnalyzeEventsResult] = useState<{
    events: Array<{ type: string; start: number; end: number; description: string; confidence: number }>
    rawResponse?: string
    error?: string
    rekaVideoId?: string
  } | null>(null)

  const toggleTagFilter = (tagId: string) => {
    setTagFilter(prev => {
      const next = new Set(prev)
      if (next.has(tagId)) next.delete(tagId)
      else next.add(tagId)
      return next
    })
  }

  const startEditingTags = (clip: ClipRecord) => {
    setEditingTagsFor(clip.id)
    setEditingTagsDraft(new Set(clip.tags ?? []))
  }

  const toggleDraftTag = (tagId: string) => {
    setEditingTagsDraft(prev => {
      const next = new Set(prev)
      if (next.has(tagId)) next.delete(tagId)
      else next.add(tagId)
      return next
    })
  }

  const saveTags = async (clipId: string) => {
    const nextTags = SOCCER_TAGS.filter(t => editingTagsDraft.has(t.id)).map(t => t.id)
    const { error: saveErr } = await supabase
      .from('clips')
      .update({ tags: nextTags })
      .eq('id', clipId)
    if (saveErr) {
      console.error('Failed to save tags:', saveErr.message)
      return
    }
    setClips(prev => prev.map(c => c.id === clipId ? { ...c, tags: nextTags } : c))
    setEditingTagsFor(null)
  }

  const cancelEditingTags = () => {
    setEditingTagsFor(null)
    setEditingTagsDraft(new Set())
  }

  // Bulk-delete state. Selecting clips reveals an action bar; delete with confirm.
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const toggleClipSelected = (clipId: string) => {
    setSelectedClips(prev => {
      const next = new Set(prev)
      if (next.has(clipId)) next.delete(clipId)
      else next.add(clipId)
      return next
    })
  }

  const clearSelection = () => setSelectedClips(new Set())

  // Inline single-tag mutation. Optimistic update with rollback on DB error.
  // Used for one-click verification — click ×  to remove, click + popover to add.
  const [tagAddOpenFor, setTagAddOpenFor] = useState<string | null>(null)

  const mutateClipTags = async (clipId: string, nextTags: string[]) => {
    const prevSnapshot = clips
    // optimistic
    setClips(prev => prev.map(c => c.id === clipId ? { ...c, tags: nextTags } : c))
    const { error: saveErr } = await supabase
      .from('clips')
      .update({ tags: nextTags })
      .eq('id', clipId)
    if (saveErr) {
      console.error('Failed to update tags:', saveErr.message)
      setClips(prevSnapshot)  // rollback
    }
  }

  // Format seconds (possibly fractional) as "m:ss" — e.g. 132.5 → "2:12".
  const fmtSourceTime = (s: number | null | undefined): string | null => {
    if (s == null || !isFinite(s)) return null
    const total = Math.max(0, Math.floor(s))
    const m = Math.floor(total / 60)
    const sec = total % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const removeTagFromClip = (clipId: string, tagId: string) => {
    const clip = clips.find(c => c.id === clipId)
    if (!clip) return
    const nextTags = (clip.tags ?? []).filter(t => t !== tagId)
    mutateClipTags(clipId, nextTags)
  }

  const addTagToClip = (clipId: string, tagId: string) => {
    const clip = clips.find(c => c.id === clipId)
    if (!clip) return
    const current = clip.tags ?? []
    if (current.includes(tagId)) return
    // Preserve canonical order from SOCCER_TAGS so display order stays stable.
    const nextSet = new Set([...current, tagId])
    const nextTags = SOCCER_TAGS.filter(t => nextSet.has(t.id)).map(t => t.id)
    mutateClipTags(clipId, nextTags)
    setTagAddOpenFor(null)
  }

  const deleteSelectedClips = async () => {
    if (selectedClips.size === 0 || bulkDeleting) return
    const ids = Array.from(selectedClips)
    if (!confirm(`Delete ${ids.length} clip${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    setBulkDeleting(true)
    const prevSnapshot = clips
    // Optimistic remove
    setClips(prev => prev.filter(c => !selectedClips.has(c.id)))
    setSelectedClips(new Set())
    const { error: delErr } = await supabase.from('clips').delete().in('id', ids)
    if (delErr) {
      console.error('Failed to delete clips:', delErr.message)
      setClips(prevSnapshot)
      alert(`Delete failed: ${delErr.message}`)
    }
    setBulkDeleting(false)
  }

  // Apply filter: clip passes if it carries every active filter tag (AND match).
  // Empty filter shows everything. Then sort by chosen order.
  const filteredClips = (() => {
    const filtered = tagFilter.size === 0
      ? clips
      : clips.filter(c => {
          const ct = c.tags ?? []
          for (const t of tagFilter) if (!ct.includes(t)) return false
          return true
        })
    const arr = [...filtered]
    // Sort comparator. nulls sink (undefined treated as -Infinity for desc, +Infinity for asc).
    const cmpNum = (a: number | null | undefined, b: number | null | undefined, asc: boolean) => {
      const av = a == null ? (asc ? Infinity : -Infinity) : a
      const bv = b == null ? (asc ? Infinity : -Infinity) : b
      return asc ? av - bv : bv - av
    }
    switch (clipSort) {
      case 'time_asc':   arr.sort((a, b) => cmpNum(a.segment_start, b.segment_start, true)); break
      case 'time_desc':  arr.sort((a, b) => cmpNum(a.segment_start, b.segment_start, false)); break
      // score_desc = best first; tiebreak by event_confidence
      case 'score_desc': arr.sort((a, b) => cmpNum(a.quality_score, b.quality_score, false) || cmpNum(a.event_confidence, b.event_confidence, false)); break
      case 'score_asc':  arr.sort((a, b) => cmpNum(a.quality_score, b.quality_score, true)  || cmpNum(a.event_confidence, b.event_confidence, true)); break
    }
    return arr
  })()

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
            num_clips: 10,
            aspect_ratio: '16:9',
            resolution: 720,
            prompt: 'Identify every key soccer moment: goals, shots on target, saves by the goalkeeper, cards/bookings (yellow or red), penalties, and major fouls. Generate one clip per distinct event with clear context (build-up + outcome).',
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

  const handleAnalyzeEvents = async () => {
    if (!video) return
    setAnalyzingEvents(true)
    setAnalyzeEventsResult(null)
    try {
      const { data, error: analyzeError } = await supabase.functions.invoke('analyze-events', {
        body: { videoId: video.id },
      })
      if (analyzeError) {
        // The supabase JS client wraps non-2xx responses; the body is on error.context
        let bodyText = ''
        try {
          if (analyzeError.context?.json) {
            const body = await analyzeError.context.json()
            bodyText = body?.error || JSON.stringify(body)
          } else if (analyzeError.context?.text) {
            bodyText = await analyzeError.context.text()
          }
        } catch {
          bodyText = ''
        }
        throw new Error(bodyText || analyzeError.message || 'Edge function error')
      }
      if (!data?.ok) throw new Error(data?.error || 'Unknown error')
      setAnalyzeEventsResult({
        events: data.events || [],
        rawResponse: data.rawResponse,
        rekaVideoId: data.rekaVideoId,
      })
    } catch (err: any) {
      console.error('Error analyzing events:', err)
      setAnalyzeEventsResult({ events: [], error: err.message || String(err) })
    } finally {
      setAnalyzingEvents(false)
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
                <button
                  onClick={handleAnalyzeEvents}
                  disabled={analyzingEvents}
                  className="flex-1 rounded-md border border-input bg-background px-4 py-3 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  title="Beta: ask Reka Q&A to list every event with timestamps. No clipping yet — verifies if Reka returns usable data."
                >
                  {analyzingEvents ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-4 h-4" />
                      List Events (Beta)
                    </>
                  )}
                </button>
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

          {/* Analyze Events (Beta) Result Panel */}
          {analyzeEventsResult && (
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  Detected Events {analyzeEventsResult.events.length > 0 && `(${analyzeEventsResult.events.length})`}
                </h2>
                {analyzeEventsResult.rekaVideoId && (
                  <span className="text-xs text-muted-foreground">Reka video_id: {analyzeEventsResult.rekaVideoId}</span>
                )}
              </div>
              {analyzeEventsResult.error ? (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium mb-1">Analysis failed</p>
                    <p className="font-mono text-xs whitespace-pre-wrap">{analyzeEventsResult.error}</p>
                  </div>
                </div>
              ) : analyzeEventsResult.events.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    No events parsed from response. Reka may have returned non-JSON output. Raw response:
                  </p>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">{analyzeEventsResult.rawResponse}</pre>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b">
                          <th className="py-2 pr-3">Type</th>
                          <th className="py-2 pr-3">Start</th>
                          <th className="py-2 pr-3">End</th>
                          <th className="py-2 pr-3">Duration</th>
                          <th className="py-2 pr-3">Confidence</th>
                          <th className="py-2 pr-3">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyzeEventsResult.events.map((evt, i) => {
                          const tag = TAG_BY_ID[evt.type as keyof typeof TAG_BY_ID]
                          return (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-2 pr-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${tag?.cls || 'bg-muted text-muted-foreground border-border'}`}>
                                  {tag?.label || evt.type}
                                </span>
                              </td>
                              <td className="py-2 pr-3 font-mono text-xs">{evt.start.toFixed(1)}s</td>
                              <td className="py-2 pr-3 font-mono text-xs">{evt.end.toFixed(1)}s</td>
                              <td className="py-2 pr-3 font-mono text-xs">{(evt.end - evt.start).toFixed(1)}s</td>
                              <td className="py-2 pr-3 font-mono text-xs">{(evt.confidence * 100).toFixed(0)}%</td>
                              <td className="py-2 pr-3 text-xs">{evt.description}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <details className="mt-4">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      View raw Reka response
                    </summary>
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64 mt-2">{analyzeEventsResult.rawResponse}</pre>
                  </details>
                </div>
              )}
            </div>
          )}

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
              <>
                {/* Filter chips — multi-select; AND semantics. */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="text-xs text-muted-foreground mr-1">Filter:</span>
                  {SOCCER_TAGS.map(t => {
                    const active = tagFilter.has(t.id)
                    const count = clips.filter(c => (c.tags ?? []).includes(t.id)).length
                    if (count === 0 && !active) return null
                    return (
                      <button
                        key={t.id}
                        onClick={() => toggleTagFilter(t.id)}
                        className={`text-xs px-2 py-1 rounded border transition-opacity ${t.cls} ${active ? 'opacity-100 ring-2 ring-offset-1 ring-current' : 'opacity-70 hover:opacity-100'}`}
                      >
                        {t.label} <span className="opacity-60">({count})</span>
                      </button>
                    )
                  })}
                  {tagFilter.size > 0 && (
                    <button
                      onClick={() => setTagFilter(new Set())}
                      className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
                    >
                      Clear
                    </button>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <label className="text-xs text-muted-foreground" htmlFor="clip-sort">Sort:</label>
                    <select
                      id="clip-sort"
                      value={clipSort}
                      onChange={(e) => setClipSort(e.target.value as ClipSort)}
                      className="text-xs rounded border border-input bg-background px-2 py-1"
                    >
                      <option value="time_asc">Chronological</option>
                      <option value="time_desc">Reverse chronological</option>
                      <option value="score_desc">Best first (score)</option>
                      <option value="score_asc">Lowest score first</option>
                    </select>
                  </div>
                </div>

                {filteredClips.length === 0 && (
                  <p className="text-sm text-muted-foreground italic mb-4">
                    No clips match the selected filters.
                  </p>
                )}

                {/* Bulk-select action bar — only shown when clips are selected, OR
                    a "Select all visible" trigger is always available. */}
                {filteredClips.length > 0 && (
                  <div className="flex items-center gap-2 mb-3 text-xs">
                    {selectedClips.size > 0 ? (
                      <>
                        <span className="font-medium">{selectedClips.size} selected</span>
                        <button
                          onClick={() => setSelectedClips(new Set(filteredClips.map(c => c.id)))}
                          className="text-muted-foreground hover:text-foreground underline"
                        >
                          Select all visible ({filteredClips.length})
                        </button>
                        <button
                          onClick={clearSelection}
                          className="text-muted-foreground hover:text-foreground underline"
                        >
                          Clear
                        </button>
                        <button
                          onClick={deleteSelectedClips}
                          disabled={bulkDeleting}
                          className="ml-auto rounded-md bg-destructive px-3 py-1.5 font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {bulkDeleting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          Delete {selectedClips.size} clip{selectedClips.size === 1 ? '' : 's'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setSelectedClips(new Set(filteredClips.map(c => c.id)))}
                        className="text-muted-foreground hover:text-foreground underline"
                      >
                        Select all visible ({filteredClips.length})
                      </button>
                    )}
                  </div>
                )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredClips.map((clip) => (
                  <div
                    key={clip.id}
                    className={`rounded-lg border bg-muted/50 overflow-hidden relative ${
                      selectedClips.has(clip.id) ? 'ring-2 ring-primary border-primary' : ''
                    }`}
                  >
                    {/* Selection checkbox — overlaid on the video area, top-left. */}
                    <label
                      className="absolute top-2 left-2 z-10 cursor-pointer flex items-center justify-center w-6 h-6 rounded bg-black/50 backdrop-blur-sm hover:bg-black/70 transition-colors"
                      title={selectedClips.has(clip.id) ? 'Deselect' : 'Select for bulk action'}
                    >
                      <input
                        type="checkbox"
                        checked={selectedClips.has(clip.id)}
                        onChange={() => toggleClipSelected(clip.id)}
                        className="w-4 h-4 cursor-pointer accent-primary"
                      />
                    </label>
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
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h3 className="font-semibold text-sm flex-1">{clip.title || 'Untitled Clip'}</h3>
                        {clip.quality_score != null && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {clip.quality_score}/100
                          </span>
                        )}
                      </div>

                      {/* Source timestamp — when in the source video this clip was extracted from.
                          Shown as "m:ss → m:ss" for cross-referencing against the original video. */}
                      {(() => {
                        const startStr = fmtSourceTime(clip.segment_start)
                        const endStr = fmtSourceTime(clip.segment_end)
                        if (!startStr) return null
                        return (
                          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            <span className="font-mono">{startStr}{endStr && ` → ${endStr}`}</span>
                            {clip.event_confidence != null && (
                              <span className="ml-2 opacity-70">conf {Math.round(clip.event_confidence * 100)}%</span>
                            )}
                          </div>
                        )
                      })()}

                      {/* Event tags — pills replace caption/hashtags as primary metadata. */}
                      {editingTagsFor === clip.id ? (
                        <div className="mb-3">
                          <div className="flex flex-wrap gap-1 mb-2">
                            {SOCCER_TAGS.map(t => {
                              const on = editingTagsDraft.has(t.id)
                              return (
                                <button
                                  key={t.id}
                                  onClick={() => toggleDraftTag(t.id)}
                                  className={`text-xs px-2 py-1 rounded border transition-opacity ${t.cls} ${on ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
                                >
                                  {t.label}
                                </button>
                              )
                            })}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveTags(clip.id)}
                              className="flex-1 text-xs rounded-md bg-primary px-2 py-1.5 font-medium text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              Save
                            </button>
                            <button
                              onClick={cancelEditingTags}
                              className="flex-1 text-xs rounded-md border border-input bg-background px-2 py-1.5 font-medium hover:bg-muted flex items-center justify-center gap-1"
                            >
                              <X className="w-3 h-3" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1 mb-3 relative">
                          {(clip.tags && clip.tags.length > 0) ? (
                            clip.tags.map(tagId => {
                              const t = TAG_BY_ID[tagId]
                              if (!t) return null
                              return (
                                <span
                                  key={tagId}
                                  className={`group/tag text-xs pl-2 pr-1 py-1 rounded border ${t.cls} flex items-center gap-1`}
                                >
                                  {t.label}
                                  <button
                                    onClick={() => removeTagFromClip(clip.id, tagId)}
                                    aria-label={`Remove ${t.label} tag`}
                                    title={`Remove ${t.label}`}
                                    className="opacity-50 hover:opacity-100 hover:bg-black/10 rounded-sm p-0.5 transition-opacity"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              )
                            })
                          ) : (
                            <span className="text-xs text-muted-foreground italic">No tags</span>
                          )}
                          {/* Inline add: click + to open a popover of remaining tags. */}
                          {(() => {
                            const current = new Set(clip.tags ?? [])
                            const addable = SOCCER_TAGS.filter(t => !current.has(t.id))
                            if (addable.length === 0) return null
                            const isOpen = tagAddOpenFor === clip.id
                            return (
                              <div className="relative">
                                <button
                                  onClick={() => setTagAddOpenFor(isOpen ? null : clip.id)}
                                  aria-label="Add tag"
                                  title="Add tag"
                                  className="text-xs px-1.5 py-1 rounded border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-foreground hover:text-foreground flex items-center"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                                {isOpen && (
                                  <>
                                    {/* click-away catcher */}
                                    <div
                                      className="fixed inset-0 z-10"
                                      onClick={() => setTagAddOpenFor(null)}
                                    />
                                    <div className="absolute z-20 left-0 top-full mt-1 bg-popover border rounded-md shadow-lg p-1.5 flex flex-wrap gap-1 w-56">
                                      {addable.map(t => (
                                        <button
                                          key={t.id}
                                          onClick={() => addTagToClip(clip.id, t.id)}
                                          className={`text-xs px-2 py-1 rounded border ${t.cls} hover:opacity-80`}
                                        >
                                          {t.label}
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            )
                          })()}
                          <button
                            onClick={() => startEditingTags(clip)}
                            aria-label="Bulk edit tags"
                            title="Bulk edit"
                            className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* Caption/hashtags collapsed by default — tags carry the meaning now. */}
                      {(clip.caption || (clip.hashtags && clip.hashtags.length > 0)) && (
                        <details className="text-xs text-muted-foreground mb-3">
                          <summary className="cursor-pointer hover:text-foreground">Show AI description</summary>
                          {clip.caption && <p className="mt-2">{clip.caption}</p>}
                          {clip.hashtags && clip.hashtags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {clip.hashtags.map((tag, i) => (
                                <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </details>
                      )}
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
              </>
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
