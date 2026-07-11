'use client';

import { useEffect, useState, useCallback, useRef, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getMe, logout } from '@/lib/auth';
import { api, API_URL } from '@/lib/api';
import { Navbar } from '@/components/Navbar';
import { Card } from '@/components/ui';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Batch { id: string; name: string; description?: string; }
interface BatchMembership { id: string; batch: Batch; }
interface Center { id: string; name: string; slug: string; status: string; }
interface CenterMembership {
  id: string;
  role: string;
  isApproved: boolean;
  center: Center;
  batchMemberships: BatchMembership[];
}
interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  globalRole: string;
  centerMemberships: CenterMembership[];
}

const resolveMediaUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('/')) {
    return `${API_URL}${url}`;
  }
  if (url.includes('localhost:3001') && typeof window !== 'undefined') {
    return url.replace(/https?:\/\/localhost:3001/, API_URL);
  }
  return url;
};

interface Video {
  id: string;
  title: string;
  description?: string;
  youtubeId?: string;
  playlistId?: string;
  duration?: number;
  likesCount?: number;
  liked?: boolean;
  publishedAt?: string;
  createdAt: string;
  playlist?: any;
}
interface Chapter { id: string; title: string; videos: Video[]; }
interface Subject { id: string; title: string; chapters: Chapter[]; }
interface Course { id: string; title: string; description?: string; subjects: Subject[]; }
interface Test { id: string; title: string; description?: string; durationMinutes?: number; totalMarks?: number; }
interface YoutubeChannel {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  thumbnail?: string;
  isActive: boolean;
  lastSyncedAt?: string;
  playlistsCount?: number;
  videosCount?: number;
  batchIds?: string[];
  centerId?: string;
  createdAt?: string;
}

function formatRelativeTime(dateString?: string) {
  if (!dateString) return 'recently';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffMonth / 12);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${diffYear}y ago`;
}

function formatDuration(seconds?: number) {
  if (seconds === undefined || seconds === null || seconds <= 0) return '';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// ─── Pending Approval Screen ──────────────────────────────────────────────────
function PendingApprovalScreen({ user, pendingMemberships, onLogout, onRefresh }: {
  user: User; pendingMemberships: CenterMembership[]; onLogout: () => void; onRefresh: () => void;
}) {
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [centerData, setCenterData] = useState<any>(null);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Auto-verify code when it reaches 8 characters (e.g. VS-XXXXXX)
  useEffect(() => {
    const clean = code.trim().toUpperCase();
    if (clean.length >= 8) {
      setVerifying(true);
      setErrorMsg('');
      api<any>(`/centers/by-code/${clean}`)
        .then((data) => {
          setCenterData(data);
          if (data.batches && data.batches.length > 0) {
            setSelectedBatchId(data.batches[0].id);
          }
        })
        .catch((err) => {
          setErrorMsg(err.message || 'Invalid join code');
          setCenterData(null);
        })
        .finally(() => setVerifying(false));
    } else {
      setCenterData(null);
      setErrorMsg('');
    }
  }, [code]);

  async function handleJoinSubmit(e: FormEvent) {
    e.preventDefault();
    if (!centerData || submitting) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      await api('/centers/join-by-code', {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          batchId: selectedBatchId || undefined,
        }),
      });
      setCode('');
      setCenterData(null);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-violet-600 via-indigo-700 to-indigo-900 px-4 py-10 relative overflow-hidden">
      <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-white/5 blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-fuchsia-500/10 blur-[120px] pointer-events-none"></div>
      <div className="max-w-md w-full text-center space-y-6 relative z-10">
        
        {/* State Icon */}
        <div className="w-20 h-20 rounded-full bg-amber-400/20 border-2 border-amber-300/30 flex items-center justify-center mx-auto shadow-2xl backdrop-blur-md">
          <span className="text-4xl">{pendingMemberships.length > 0 ? '⏳' : '🔑'}</span>
        </div>
        
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-white">
            {pendingMemberships.length > 0 ? 'Approval Pending' : 'Join a Center'}
          </h1>
          <p className="mt-2 text-white/70 leading-relaxed text-xs lg:text-sm">
            Hi <strong className="text-white">{user.firstName}</strong>! 
            {pendingMemberships.length > 0 
              ? ' Your registration has been received and is waiting for approval. Please contact the administrator to get approved. Once approved, refresh this page to access your dashboard.' 
              : ' Enter your unique class join code below to request access.'}
          </p>
        </div>

        {/* Pending Requests List */}
        {pendingMemberships.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase text-white/40 tracking-wider text-left px-1">Your Pending Requests</p>
            {pendingMemberships.map((m) => (
              <div key={m.id} className="bg-white/10 border border-white/20 backdrop-blur-md rounded-2xl p-4 text-left">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🏫</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white truncate">{m.center.name}</p>
                    {m.batchMemberships && m.batchMemberships.length > 0 && (
                      <p className="text-[10px] text-white/60 mt-0.5 truncate">
                        Group: {m.batchMemberships.map((bm) => bm.batch.name).join(', ')}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase">Pending</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Join Center Form */}
        <div className="bg-white/10 border border-white/20 backdrop-blur-md rounded-2xl p-5 text-left space-y-4">
          <p className="text-[10px] font-black uppercase text-white/40 tracking-wider">Request Entry</p>
          <form onSubmit={handleJoinSubmit} className="space-y-3.5">
            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs font-semibold">
                ⚠️ {errorMsg}
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-white/60 tracking-wider">Join Code</label>
              <input
                type="text"
                required
                placeholder="e.g. VS-XXXXXX"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm font-black text-white tracking-widest placeholder-white/40 uppercase focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>

            {verifying && (
              <p className="text-[10px] text-white/50 font-bold italic animate-pulse">Checking join code...</p>
            )}

            {centerData && (
              <div className="space-y-3 p-3 bg-white/5 border border-white/10 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
                <p className="text-xs font-black text-amber-300">🏫 Center: {centerData.name}</p>
                
                {centerData.batches && centerData.batches.length > 0 ? (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-white/60 tracking-wider">Select Group / Classroom</label>
                    <select
                      value={selectedBatchId}
                      onChange={(e) => setSelectedBatchId(e.target.value)}
                      className="w-full bg-slate-900 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-300 cursor-pointer"
                    >
                      {centerData.batches.map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-[10px] text-rose-300 font-bold">No batches available in this center.</p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={!centerData || submitting}
              className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-md cursor-pointer ${
                centerData && !submitting
                  ? 'bg-amber-400 hover:bg-amber-500 text-indigo-950 hover:shadow-lg'
                  : 'bg-white/10 text-white/30 cursor-not-allowed border border-white/10'
              }`}
            >
              {submitting ? 'Submitting Request...' : '🔑 Request Entry'}
            </button>
          </form>
        </div>

        <div className="text-center bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-xs text-white/70 font-semibold leading-relaxed">
            Want to open and manage your own institute?
          </p>
          <Link 
            href="/apply-center" 
            className="mt-2.5 inline-block w-full text-center py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black uppercase tracking-wider transition shadow-md cursor-pointer"
          >
            🏫 Apply to open a Center
          </Link>
        </div>

        <p className="text-xs text-white/40">Please check back later or contact your center admin.</p>
        <button onClick={onLogout} className="rounded-xl bg-white/20 hover:bg-white/30 border border-white/30 text-white font-bold px-6 py-2.5 text-sm transition cursor-pointer backdrop-blur-md">Logout</button>
      </div>
    </div>
  );
}

// ─── YouTube IFrame API Player ────────────────────────────────────────────────
// Loads the YouTube JS API so we get full JS control (play/pause/seek all work
// in Chrome DevTools mobile-emulation mode AND on real mobile browsers).
// Falls back to a plain <iframe> after 2 s if the API script is blocked.

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

function YouTubePlayer({ videoId, title }: { videoId: string; title: string }) {
  const embedSrc = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&autoplay=1&playsinline=1&controls=1&fs=1`;

  return (
    <div style={{ width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: '1rem', position: 'relative', overflow: 'hidden' }}>
      <iframe
        src={embedSrc}
        title={title}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}


function VideosTab({ centerId, batchIds, isAdmin, onBack }: { centerId: string; batchIds: string[]; isAdmin?: boolean; onBack: () => void }) {
  const [shorts, setShorts] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(0);
  activeIndexRef.current = activeIndex;
  const shortsLengthRef = useRef(0);
  shortsLengthRef.current = shorts.length;

  const fetchShorts = useCallback(async (append = false) => {
    // FRONTEND GUARD: no batch = no access
    if (!isAdmin && batchIds.length === 0) {
      setShorts([]);
      setLoading(false);
      return;
    }
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      // Pass all batchIds so server only returns shorts for user's batches
      const batchQs = !isAdmin && batchIds.length > 0
        ? '&' + batchIds.map((id) => `batchId=${encodeURIComponent(id)}`).join('&')
        : '';
      const data = await api<Video[]>(`/centers/${centerId}/shorts?limit=12${batchQs}`);
      setShorts((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const filtered = data.filter((item) => !existingIds.has(item.id));
        return append ? [...prev, ...filtered] : data;
      });
    } catch (err) {
      console.error('Error fetching shorts:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [centerId, batchIds, isAdmin]);

  useEffect(() => {
    fetchShorts();
  }, [fetchShorts]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollToIndex(Math.min(activeIndex + 1, shorts.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollToIndex(Math.max(activeIndex - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, shorts.length]);

  const scrollToIndex = (index: number) => {
    const slide = containerRef.current?.querySelector(`[data-index="${index}"]`);
    if (slide) slide.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    if (clientHeight === 0) return;
    const newIndex = Math.round(scrollTop / clientHeight);
    if (newIndex !== activeIndexRef.current && newIndex >= 0 && newIndex < shortsLengthRef.current) {
      setActiveIndex(newIndex);
    }
  };

  useEffect(() => {
    if (shorts.length === 0) return;
    setIsPlaying(true);

    if (activeIndex >= shorts.length - 3 && !loadingMore) {
      fetchShorts(true);
    }
  }, [activeIndex, shorts.length, loadingMore, fetchShorts]);

  const togglePlay = () => {
    const video = shorts[activeIndex];
    if (!video?.youtubeId) return;

    const iframe = document.getElementById(`yt-player-${video.youtubeId}`) as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      const func = isPlaying ? 'pauseVideo' : 'playVideo';
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func, args: [] }),
        '*'
      );
      setIsPlaying(!isPlaying);
    }
  };

  const handleShare = (video: Video) => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: video.title,
        url: `https://www.youtube.com/watch?v=${video.youtubeId}`,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${video.youtubeId}`);
      alert('Short video link copied to clipboard!');
    }
  };

  const handleLike = async (video: Video) => {
    try {
      const updated = await api<{ liked: boolean; likesCount: number }>(
        `/centers/${centerId}/videos/${video.id}/like`,
        { method: 'POST' }
      );
      setShorts((prev) =>
        prev.map((v) =>
          v.id === video.id
            ? { ...v, liked: updated.liked, likesCount: updated.likesCount }
            : v
        )
      );
    } catch (err) {
      console.error('Failed to like video:', err);
    }
  };

  if (loading && shorts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm text-slate-400 font-semibold">Loading short videos...</p>
      </div>
    );
  }

  if (shorts.length === 0) {
    return (
      <div className="text-center py-20 bg-white/60 backdrop-blur-xl rounded-3xl border border-white/80 shadow-sm">
        <span className="text-6xl">📺</span>
        <p className="mt-4 text-slate-500 text-sm font-semibold">
          {!isAdmin && batchIds.length === 0
            ? 'You have not been assigned to any group yet. Please contact your admin.'
            : 'No short videos have been assigned to your group yet.'}
        </p>
      </div>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="fixed md:relative top-16 md:top-0 bottom-16 md:bottom-0 left-0 right-0 z-30 md:z-10 bg-slate-950 text-white overflow-hidden select-none flex items-center justify-center md:h-[80vh] md:w-full md:rounded-3xl shadow-xl">
      <div className="relative w-full h-full max-h-screen md:max-h-[85vh] md:w-auto md:aspect-[9/16] md:rounded-3xl overflow-hidden shadow-2xl bg-black border border-white/5">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-full w-full overflow-y-scroll snap-y snap-mandatory select-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {shorts.map((video, idx) => {
            const isActive = idx === activeIndex;
            const embedUrl = `https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&mute=0&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&cc_load_policy=0&origin=${encodeURIComponent(origin)}`;

            return (
              <div
                key={video.id}
                data-index={idx}
                className="relative w-full h-full snap-start snap-always flex items-center justify-center bg-black overflow-hidden"
              >
                {isActive ? (
                  <iframe
                    id={`yt-player-${video.youtubeId}`}
                    src={embedUrl}
                    title={video.title}
                    className="w-full h-full border-none object-cover scale-[1.02]"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div
                    className="absolute inset-0 bg-cover bg-center filter blur-[2px]"
                    style={{ backgroundImage: `url(https://i.ytimg.com/vi/${video.youtubeId}/mqdefault.jpg)` }}
                  />
                )}

                {isActive && (
                  <div onClick={togglePlay} className="absolute inset-0 cursor-pointer z-10 flex items-center justify-center bg-transparent">
                    {!isPlaying && (
                      <div className="p-4 rounded-full bg-black/60 text-white border border-white/10 animate-pulse shadow-xl">
                        <span className="text-2xl">▶</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="absolute bottom-4 left-4 right-16 z-20 pointer-events-none text-white drop-shadow-md pr-2">
                  {video.playlist?.channel?.title && (
                    <span className="inline-block px-2.5 py-0.5 mb-2 text-[9px] font-black uppercase tracking-wider rounded-lg bg-indigo-600/90 backdrop-blur-sm text-white">
                      {video.playlist.channel.title}
                    </span>
                  )}
                  <h3 className="text-xs font-black leading-snug line-clamp-2">{video.title}</h3>
                  {video.description && (
                    <p className="text-[10px] opacity-75 font-semibold line-clamp-1 mt-1">{video.description}</p>
                  )}
                </div>

                {isActive && (
                  <div className="absolute right-3 bottom-8 z-30 flex flex-col items-center gap-4">
                    <button
                      onClick={() => handleLike(video)}
                      className="flex flex-col items-center gap-1 group cursor-pointer"
                    >
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all shadow-md backdrop-blur-md border ${
                        video.liked
                          ? 'bg-pink-500/80 border-pink-400 text-white'
                          : 'bg-white/10 border-white/10 text-white hover:bg-white/20'
                      }`}>
                        <span className="text-lg">{video.liked ? '❤️' : '🤍'}</span>
                      </div>
                      <span className="text-[9px] font-black tracking-wider text-slate-300">
                        {video.likesCount || 0}
                      </span>
                    </button>

                    <button
                      onClick={() => handleShare(video)}
                      className="flex flex-col items-center gap-1 group cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 text-white transition-all shadow-md">
                        <span className="text-base">🔗</span>
                      </div>
                      <span className="text-[9px] font-black tracking-wider text-slate-300">Share</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {activeIndex > 0 && (
          <button
            onClick={() => scrollToIndex(activeIndex - 1)}
            className="absolute top-4 right-4 z-40 w-8 h-8 rounded-xl bg-white/10 border border-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 active:scale-90 transition-all text-white cursor-pointer"
          >
            <span>▲</span>
          </button>
        )}
        {activeIndex < shorts.length - 1 && (
          <button
            onClick={() => scrollToIndex(activeIndex + 1)}
            className="absolute bottom-4 right-4 z-40 w-8 h-8 rounded-xl bg-white/10 border border-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 active:scale-90 transition-all text-white cursor-pointer"
          >
            <span>▼</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── YouTube Channels Tab ──────────────────────────────────────────────────────
function YoutubeChannelsTab({ centerId, batchIds, isAdmin }: { centerId: string; batchIds: string[]; isAdmin?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  // Stable ref for pathname so useEffect closures can read it without adding
  // pathname/router to the effect dependency array (which causes reload on every URL push)
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const routerRef = useRef(router);
  routerRef.current = router;

  const [channels, setChannels] = useState<YoutubeChannel[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [channelSearch, setChannelSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [isPlayingLive, setIsPlayingLive] = useState(false);

  // Keep a stable ref to searchParams so effects can read it without adding it to deps
  // (adding searchParams to deps causes a re-fetch loop when router.replace sets the first video ID)
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  // Simple in-memory cache: cacheKey → Video[] avoids re-fetching on back-navigation
  const videoCacheRef = useRef<Map<string, Video[]>>(new Map());

  // Playlist tabs states
  const [subTab, setSubTab] = useState<'videos' | 'playlists'>('videos');
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);

  // Derive selection states from search params
  const channelIdParam = searchParams.get('channelId');
  const selectedChannel = channels.find((c) => c.channelId === channelIdParam || c.id === channelIdParam) || null;

  const setSelectedChannel = (chan: YoutubeChannel | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (chan) {
      params.set('channelId', chan.channelId);
      params.delete('playlistId');
      params.delete('ytVideoId');
    } else {
      params.delete('channelId');
      params.delete('playlistId');
      params.delete('ytVideoId');
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const playlistIdParam = searchParams.get('playlistId');
  const selectedPlaylist = playlists.find((p) => p.playlistId === playlistIdParam || p.id === playlistIdParam) || null;

  const setSelectedPlaylist = (playlist: any | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (playlist) {
      params.set('playlistId', playlist.playlistId);
      params.delete('ytVideoId');
    } else {
      params.delete('playlistId');
      params.delete('ytVideoId');
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const videoIdParam = searchParams.get('ytVideoId');
  const selectedVideo = videos.find((v) => v.youtubeId === videoIdParam || v.id === videoIdParam) || null;

  const [loadingDesc, setLoadingDesc] = useState(false);

  const loadDescription = () => {
    if (!selectedVideo || loadingDesc) return;
    setLoadingDesc(true);
    api<Video>(`/centers/${centerId}/videos/${selectedVideo.id}`)
      .then((fullVideo) => {
        setVideos((prev) =>
          prev.map((v) => (v.id === fullVideo.id ? { ...v, description: fullVideo.description || '' } : v))
        );
      })
      .catch((err) => console.error('Failed to load video description:', err))
      .finally(() => setLoadingDesc(false));
  };

  // Scroll to player whenever the selected video URL param changes (after navigation settles)
  const prevVideoIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentVideoId = searchParams.get('ytVideoId');
    if (currentVideoId && currentVideoId !== prevVideoIdRef.current) {
      prevVideoIdRef.current = currentVideoId;
      setTimeout(() => {
        const el = document.getElementById('video-player-anchor');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 200);
    }
  }, [searchParams]);

  const setSelectedVideo = (video: Video | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (video) {
      params.set('ytVideoId', video.youtubeId || video.id);
    } else {
      params.delete('ytVideoId');
    }
    router.push(`${pathnameRef.current}?${params.toString()}`, { scroll: false });
  };

  useEffect(() => { setDescExpanded(false); }, [selectedVideo?.id]);

  // Pagination states
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    // FRONTEND GUARD: if user is not an admin and has no batch memberships,
    // they have no channel access — skip the API call entirely and show empty state.
    if (!isAdmin && batchIds.length === 0) {
      setChannels([]);
      setLoading(false);
      return;
    }
    let url = `/centers/${centerId}/youtube/channels`;
    if (!isAdmin) {
      const qs = batchIds.map((id) => `batchId=${encodeURIComponent(id)}`).join('&');
      url += qs ? `?${qs}` : '?noBatch=1'; // noBatch=1 tells server: user has no batch, show nothing unless globally assigned
    }
    api<YoutubeChannel[]>(url).then((data) => {
      const libraryChannel: YoutubeChannel = {
        id: 'library',
        centerId,
        channelId: 'library',
        title: 'Library',
        description: 'Your saved videos and playlists.',
        thumbnail: 'https://lh3.googleusercontent.com/d/1H29tehXjOh3SHbYljfyM2PiLwtzCBAWm?t=' + Date.now(),
        isActive: true,
        createdAt: new Date().toISOString()
      };
      setChannels([libraryChannel, ...data]);
    }).finally(() => setLoading(false));
  }, [centerId, batchIds, isAdmin]);

  useEffect(() => {
    const chanId = selectedChannel?.id;
    const playId = selectedPlaylist?.id;

    if (!chanId) { setVideos([]); setIsPlayingLive(false); return; }

    // --- Fetch from API ---
    setLoadingVideos(true);
    setVideos([]);
    const batchQs = !isAdmin && batchIds.length > 0
      ? '&' + batchIds.map((id) => `batchId=${encodeURIComponent(id)}`).join('&')
      : '';

    const autoSelectFirst = (list: Video[]) => {
      // Read searchParams via ref so this doesn't trigger another render-cycle
      if (!searchParamsRef.current.get('ytVideoId') && list.length > 0) {
        const p = new URLSearchParams(searchParamsRef.current.toString());
        p.set('ytVideoId', list[0].youtubeId || list[0].id);
        routerRef.current.replace(`${pathnameRef.current}?${p.toString()}`, { scroll: false });
      }
    };

    if (playId && selectedPlaylist) {
      api<Video[]>(`/centers/${centerId}/playlists/${playId}/videos`).then((data) => {
        setVideos(data);
        setHasMore(false);
        autoSelectFirst(data);
      }).finally(() => setLoadingVideos(false));
    } else if (chanId === 'library') {
      api<{ videos: Video[], playlists: any[] }>(`/centers/${centerId}/library`).then((data) => {
        setVideos(data.videos);
        setPlaylists(data.playlists);
        setHasMore(false);
        autoSelectFirst(data.videos);
      }).finally(() => setLoadingVideos(false));
    } else {
      // Fetch Page 1
      setPage(1);
      setHasMore(true);
      api<Video[]>(`/centers/${centerId}/videos?channelId=${chanId}&page=1&limit=50${batchQs}`).then((data) => {
        setVideos(data);
        if (data.length < 50) setHasMore(false);
        autoSelectFirst(data);
      }).finally(() => setLoadingVideos(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId, selectedChannel?.id, selectedPlaylist?.id, batchIds, isAdmin]);

  const handleLoadMore = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    const chanId = selectedChannel?.id;
    if (loadingMore || !hasMore || !chanId) return;

    // Capture the current scroll position before the DOM updates
    const currentScrollY = window.scrollY;

    setLoadingMore(true);
    const nextPage = page + 1;
    const batchQs = !isAdmin && batchIds.length > 0
      ? '&' + batchIds.map((id) => `batchId=${encodeURIComponent(id)}`).join('&')
      : '';
    try {
      const data = await api<Video[]>(`/centers/${centerId}/videos?channelId=${chanId}&page=${nextPage}&limit=50${batchQs}`);
      if (data.length < 50) {
        setHasMore(false);
      }
      setVideos((prev) => [...prev, ...data]);
      setPage(nextPage);

      // Force scroll restoration after React finishes rendering the new items
      setTimeout(() => {
        window.scrollTo({ top: currentScrollY });
      }, 50);
    } catch (err) {
      console.error('Failed to load more videos:', err);
    } finally {
      setLoadingMore(false);
    }
  };


  useEffect(() => {
    if (!selectedChannel || selectedChannel.id === 'library' || subTab !== 'playlists') return;
    setLoadingPlaylists(true);
    api<any[]>(`/centers/${centerId}/youtube/channels/${selectedChannel.channelId}/playlists`)
      .then((data) => setPlaylists(data))
      .catch((err) => console.error('Failed to load playlists:', err))
      .finally(() => setLoadingPlaylists(false));
  }, [centerId, selectedChannel, subTab]);

  const handleToggleLike = async (video: Video) => {
    try {
      const res = await api<{ liked: boolean; likesCount: number }>(`/centers/${centerId}/videos/${video.id}/like`, { method: 'POST' });
      setVideos((prev) => {
        if (selectedChannel?.id === 'library' && !res.liked) {
          return prev.filter((v) => v.id !== video.id);
        }
        return prev.map((v) => v.id === video.id ? { ...v, liked: res.liked, likesCount: res.likesCount } : v);
      });
    } catch (err) { console.error('Failed to like video:', err); }
  };

  const handleToggleSavePlaylist = async (e: React.MouseEvent, playlist: any) => {
    e.stopPropagation();
    try {
      const res = await api<{ liked: boolean }>(`/centers/${centerId}/playlists/${playlist.id}/like`, { method: 'POST' });
      setPlaylists((prev) => {
        if (selectedChannel?.id === 'library' && !res.liked) {
          return prev.filter((p) => p.id !== playlist.id);
        }
        return prev.map((p) => p.id === playlist.id ? { ...p, liked: res.liked } : p);
      });
    } catch (err) { console.error('Failed to save playlist:', err); }
  };

  const handleShareVideo = (video: Video) => {
    const shareUrl = `${window.location.origin}/dashboard?tab=youtube&channelId=${selectedChannel?.channelId}&ytVideoId=${video.youtubeId || video.id}`;
    if (navigator.share) {
      navigator.share({ title: video.title, text: `Watch "${video.title}" on VenuTube!`, url: shareUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => alert('Link copied!'));
    }
  };

  const handleSubscribeChannel = () => {
    if (selectedChannel?.channelId) window.open(`https://www.youtube.com/channel/${selectedChannel.channelId}?sub_confirmation=1`, '_blank');
  };

  const handleBackToChannels = () => {
    setSelectedChannel(null);
    setSubTab('videos');
    setSearchQuery('');
    setIsPlayingLive(false);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      <p className="text-sm text-slate-400 font-semibold animate-pulse">Loading channels...</p>
    </div>
  );

  /* ─── CHANNEL GRID (no channel selected) ─── */
  if (!selectedChannel) {
    const filtered = channels.filter((c) =>
      !channelSearch.trim() || c.title.toLowerCase().includes(channelSearch.toLowerCase())
    );
    return (
      <div className="space-y-6">
        {/* Hero header */}
        <div className="text-center pt-4 pb-2">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            📡 <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">YouTube Channels</span>
          </h2>
          <p className="text-xs text-slate-400 font-black uppercase tracking-widest mt-1">Select a channel to start watching</p>
        </div>

        {/* Search */}
        <div className="relative max-w-lg mx-auto">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-base">🔍</span>
          <input
            type="text"
            placeholder="Search channels..."
            value={channelSearch}
            onChange={(e) => setChannelSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/80 backdrop-blur-xl border border-white/80 rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-md"
          />
        </div>

        {channels.length === 0 ? (
          <div className="text-center py-20 bg-white/60 backdrop-blur-xl rounded-3xl border border-white/80">
            <span className="text-5xl">{!isAdmin && batchIds.length === 0 ? '🔒' : '📺'}</span>
            <p className="mt-4 text-slate-700 text-sm font-black">
              {!isAdmin && batchIds.length === 0
                ? 'No group assigned'
                : 'No channels configured'}
            </p>
            <p className="mt-1 text-slate-400 text-xs font-semibold max-w-xs mx-auto">
              {!isAdmin && batchIds.length === 0
                ? 'You have not been added to any batch/group yet. Please contact your admin to get access.'
                : 'No YouTube channels have been configured for this center yet.'}
            </p>
          </div>

        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {filtered.map((chan, i) => (
              <button
                key={chan.id}
                onClick={() => setSelectedChannel(chan)}
                className="group flex flex-col items-center text-center focus:outline-none cursor-pointer"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="relative w-full aspect-[4/5] rounded-[2rem] overflow-hidden shadow-xl group-hover:shadow-2xl group-hover:scale-[1.04] active:scale-95 transition-all duration-300 border border-white/50 bg-slate-100">
                  {chan.thumbnail ? (
                    <img src={chan.thumbnail} alt={chan.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-violet-100">
                      <span className="text-4xl">📡</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <h4 className="font-black text-[11px] sm:text-sm text-slate-900 mt-2.5 group-hover:text-indigo-600 transition-colors line-clamp-1 uppercase tracking-tight">
                  {chan.title}
                </h4>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">
                  {chan.videosCount ? `${chan.videosCount} videos` : 'channel'}
                </p>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full text-center text-slate-400 text-sm font-semibold py-10">No channels match your search.</p>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ─── CHANNEL DETAIL VIEW ─── */
  const baseFilteredVideos = selectedPlaylist ? videos.filter((v) => v.playlistId === selectedPlaylist.id) : videos;
  const filteredVideos = baseFilteredVideos.filter((v) => {
    const q = searchQuery.toLowerCase().trim();
    return !q || v.title.toLowerCase().includes(q) || (v.description && v.description.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-4">
      {/* ── Horizontal channel strip slider ── */}
      <div className="overflow-x-auto pb-1 -mx-1 px-1">
        <div className="flex gap-3 w-max">
          {/* Back button as first item */}
          <button
            onClick={handleBackToChannels}
            className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/80 border-2 border-slate-200 flex items-center justify-center text-slate-600 group-hover:bg-slate-100 group-hover:border-indigo-300 transition-all shadow-md text-xl font-black">
              ←
            </div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Back</span>
          </button>

          {/* Channel pills */}
          {channels.map((chan) => {
            const isActive = chan.channelId === selectedChannel?.channelId || chan.id === selectedChannel?.id;
            return (
              <button
                key={chan.id}
                onClick={() => { setSelectedChannel(chan); setSubTab('videos'); setSearchQuery(''); setIsPlayingLive(false); }}
                className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
              >
                <div className={`w-14 h-14 rounded-2xl overflow-hidden border-2 transition-all shadow-md ${
                  isActive
                    ? 'border-indigo-500 ring-2 ring-indigo-300 scale-110'
                    : 'border-white/50 group-hover:border-indigo-300 group-hover:scale-105'
                }`}>
                  {chan.thumbnail ? (
                    <img src={chan.thumbnail} alt={chan.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-lg">📡</div>
                  )}
                </div>
                <span className={`text-[9px] font-black uppercase tracking-wide max-w-[56px] truncate ${isActive ? 'text-indigo-700' : 'text-slate-400'}`}>
                  {chan.title.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Channel Hero Banner ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 shadow-2xl">
        {selectedChannel.thumbnail && (
          <img src={selectedChannel.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-md scale-110" />
        )}
        <div className="relative z-10 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-white/30 shadow-xl shrink-0 bg-white/10">
            {selectedChannel.thumbnail ? (
              <img src={selectedChannel.thumbnail} alt={selectedChannel.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl">📡</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">YouTube Channel</p>
            <h3 className="font-black text-white text-xl sm:text-2xl leading-tight mt-0.5 line-clamp-1">{selectedChannel.title}</h3>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={handleSubscribeChannel}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black rounded-xl transition shadow-md cursor-pointer"
              >
                🔔 Subscribe on YouTube
              </button>
              <button
                onClick={() => { setIsPlayingLive(true); setSubTab('videos'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-[10px] font-black rounded-xl transition shadow-md cursor-pointer ${
                  isPlayingLive ? 'bg-red-700 ring-2 ring-red-400 animate-pulse' : 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600'
                }`}
              >
                🔴 {isPlayingLive ? 'Watching Live' : 'View Live'}
              </button>
            </div>
          </div>
          {selectedChannel.videosCount && (
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-3 text-center shrink-0 hidden sm:block">
              <p className="text-xl font-black text-white">{selectedChannel.videosCount}</p>
              <p className="text-[9px] font-black text-white/50 uppercase tracking-widest">Videos</p>
            </div>
          )}
        </div>
      </div>
      <div id="video-player-anchor" className="scroll-mt-24" />
      {/* ── Active Video Player Section ── */}
      {loadingVideos ? (
        <div id="video-player-section" className="scroll-mt-20">
          <div style={{ width: '100%', aspectRatio: '16/9', background: '#0f172a', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
            <div style={{ width: 40, height: 40, border: '4px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Loading videos…</p>
          </div>
        </div>
      ) : (selectedVideo || isPlayingLive) ? (
        <div id="video-player-section" className="space-y-3 scroll-mt-20">
          {isPlayingLive ? (
            <div style={{ width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: '1rem', position: 'relative', overflow: 'hidden' }}>
              <iframe
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                src={`https://www.youtube-nocookie.com/embed/live_stream?channel=${selectedChannel.channelId}&autoplay=1&rel=0&playsinline=1&controls=1&fs=1`}
                title={`Live – ${selectedChannel.title}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          ) : selectedVideo?.youtubeId ? (
            <YouTubePlayer key={selectedVideo.youtubeId} videoId={selectedVideo.youtubeId} title={selectedVideo.title} />
          ) : null}

          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 shadow-sm">
            <h2 className="font-black text-slate-900 text-base sm:text-lg leading-snug">
              {isPlayingLive ? `🔴 Live – ${selectedChannel.title}` : selectedVideo?.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-black text-slate-500">
              {isPlayingLive ? (
                <span className="flex items-center gap-1 text-red-500 animate-pulse"><span className="w-2 h-2 rounded-full bg-red-600 inline-block"></span>LIVE NOW</span>
              ) : (
                <>
                  <span>🕐 {formatRelativeTime(selectedVideo?.publishedAt)}</span>
                  <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">📹 VIDEOS</span>
                </>
              )}
            </div>
            {!isPlayingLive && selectedVideo && (
              <div className="flex items-center gap-2 pt-1">
                <button onClick={() => window.open(`https://www.youtube.com/watch?v=${selectedVideo.youtubeId}`, '_blank')} className="w-9 h-9 rounded-xl bg-red-600 hover:bg-red-700 flex items-center justify-center text-white shadow-md transition cursor-pointer text-base" title="Open on YouTube">▶</button>
                <button onClick={() => handleToggleLike(selectedVideo)} className={`w-9 h-9 rounded-xl border flex items-center justify-center text-base transition cursor-pointer ${selectedVideo.liked ? 'bg-pink-50 border-pink-200 text-pink-600' : 'bg-white border-slate-200 text-slate-400 hover:text-pink-500'}`} title="Like">{selectedVideo.liked ? '❤️' : '🤍'}</button>
                <button onClick={() => handleShareVideo(selectedVideo)} className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 text-base transition cursor-pointer" title="Share">🔗</button>
              </div>
            )}
            {!isPlayingLive && selectedVideo && selectedVideo.description === undefined && (
              <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 text-center">
                <button
                  type="button"
                  onClick={loadDescription}
                  disabled={loadingDesc}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer disabled:opacity-50"
                >
                  {loadingDesc ? 'Loading description...' : '📄 Click to view video description'}
                </button>
              </div>
            )}
            {!isPlayingLive && selectedVideo && selectedVideo.description !== undefined && (
              <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Description</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {selectedVideo.description === '' ? (
                    <span className="italic text-slate-400">No description available for this video.</span>
                  ) : descExpanded || selectedVideo.description.length <= 150 ? (
                    selectedVideo.description
                  ) : (
                    `${selectedVideo.description.substring(0, 150)}...`
                  )}
                </p>
                {selectedVideo.description && selectedVideo.description.length > 150 && (
                  <button onClick={() => setDescExpanded(!descExpanded)} className="text-[10px] font-black text-indigo-600 mt-1.5 cursor-pointer hover:text-indigo-800">{descExpanded ? 'Show Less' : 'Show More'}</button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-10 bg-white/60 backdrop-blur-xl rounded-2xl border border-white/80">
          <span className="text-4xl">▶</span>
          <p className="mt-3 text-slate-500 text-sm font-semibold">Select a video below to start watching</p>
        </div>
      )}

      {/* ── Sub tabs + Search ── */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/80 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100">
          {(['videos', 'playlists'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSubTab(t)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-widest transition cursor-pointer ${
                subTab === t
                  ? 'text-indigo-700 border-b-2 border-indigo-600 bg-indigo-50/50'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50/50'
              }`}
            >
              <span>{t === 'videos' ? '▶' : '📁'}</span> {t}
            </button>
          ))}
        </div>
        {subTab === 'videos' && (
          <div className="p-3 border-b border-slate-100/80">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              <input
                type="text"
                placeholder="Search videos in this channel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-1.5 px-1">
              ▶ VIDEOS: {filteredVideos.length} ITEMS
              {selectedPlaylist && (
                <button onClick={() => setSelectedPlaylist(null)} className="ml-3 text-indigo-600 hover:text-indigo-800 cursor-pointer font-black">
                  Clear Playlist ✕
                </button>
              )}
            </p>
          </div>
        )}
      </div>

      {/* ── VIDEOS TAB ── */}
      {subTab === 'videos' && (
        <div className="space-y-4">
          <div className="space-y-2.5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
              {selectedPlaylist ? `📁 ${selectedPlaylist.title}` : 'All Videos'}
            </p>
            {filteredVideos.map((v) => (
              <div
                key={v.id}
                onClick={() => { setSelectedVideo(v); setIsPlayingLive(false); }}
                className={`group flex gap-3 p-3 rounded-2xl cursor-pointer transition-all ${
                  selectedVideo?.id === v.id && !isPlayingLive
                    ? 'bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 shadow-md'
                    : 'bg-white/70 backdrop-blur-md border border-white/80 hover:border-indigo-200 hover:shadow-md'
                }`}
              >
                <div className="relative w-28 sm:w-36 aspect-video rounded-xl overflow-hidden shrink-0 bg-black">
                  {v.youtubeId && (
                    <img src={`https://i.ytimg.com/vi/${v.youtubeId}/mqdefault.jpg`} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  )}
                  {v.duration && (
                    <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">{formatDuration(v.duration)}</span>
                  )}
                  {selectedVideo?.id === v.id && !isPlayingLive && (
                    <div className="absolute inset-0 bg-indigo-900/40 flex items-center justify-center">
                      <span className="text-white text-xl font-black">▶</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 py-0.5">
                  <p className={`text-xs sm:text-sm font-black line-clamp-2 leading-snug ${selectedVideo?.id === v.id && !isPlayingLive ? 'text-indigo-800' : 'text-slate-900 group-hover:text-indigo-700'}`}>{v.title}</p>
                  <p className="text-[9px] text-slate-400 font-bold mt-1.5">{formatRelativeTime(v.publishedAt)}</p>
                  {v.likesCount !== undefined && v.likesCount > 0 && (
                    <p className="text-[9px] text-pink-500 font-black mt-0.5">❤️ {v.likesCount}</p>
                  )}
                </div>
              </div>
            ))}
            {hasMore && (
              <div className="flex justify-center pt-5 pb-3">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-black rounded-xl transition shadow-md hover:shadow-lg cursor-pointer transform active:scale-95 disabled:opacity-50"
                >
                  {loadingMore ? 'Loading...' : 'Load More Videos'}
                </button>
              </div>
            )}
            {filteredVideos.length === 0 && (
              <div className="text-center py-12 bg-white/60 backdrop-blur-xl rounded-2xl border border-white/80">
                <span className="text-3xl">🔍</span>
                <p className="mt-2 text-slate-400 text-sm font-semibold">No videos match your search.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PLAYLISTS TAB ── */}
      {subTab === 'playlists' && (
        <div className="space-y-4">
          {loadingPlaylists ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-sm text-slate-400 font-semibold">Loading playlists...</p>
            </div>
          ) : playlists.length === 0 ? (
            <div className="text-center py-20 bg-white/60 backdrop-blur-xl rounded-3xl border border-white/80">
<p className="text-5xl">📁</p>
              <p className="mt-4 text-slate-500 text-sm font-semibold">No playlists found for this channel.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {playlists.map((pl) => {
                const sampleVid = (pl.videos && pl.videos.length > 0) ? pl.videos[0] : videos.find((v) => v.playlistId === pl.id);
                return (
                  <div
                    key={pl.id}
                    onClick={() => {
                      const params = new URLSearchParams(searchParams.toString());
                      params.set('playlistId', pl.playlistId);
                      setSubTab('videos');
                      setIsPlayingLive(false);
                      if (sampleVid) { params.set('ytVideoId', sampleVid.youtubeId || sampleVid.id); }
                      else { params.delete('ytVideoId'); }
                      router.push(`${pathnameRef.current}?${params.toString()}`, { scroll: false });
                    }}
                    className="group bg-white/70 backdrop-blur-xl rounded-2xl border border-white/80 overflow-hidden hover:shadow-xl transition-all cursor-pointer"
                  >
                    <div className="relative aspect-video bg-black flex items-center justify-center">
                      {pl.thumbnail ? (
                        <img src={resolveMediaUrl(pl.thumbnail)} alt={pl.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : sampleVid ? (
                        <img src={`https://i.ytimg.com/vi/${sampleVid.youtubeId}/mqdefault.jpg`} alt={pl.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <span className="text-3xl">📁</span>
                      )}
                      
                      <button
                        onClick={(e) => handleToggleSavePlaylist(e, pl)}
                        className={`absolute top-2 left-2 z-10 w-8 h-8 rounded-xl flex items-center justify-center backdrop-blur-md shadow-md border transition cursor-pointer ${
                          pl.liked
                            ? 'bg-amber-500/90 border-amber-400 text-white'
                            : 'bg-white/40 border-white/40 text-slate-800 hover:bg-white/60'
                        }`}
                        title={pl.liked ? 'Saved to Library' : 'Save Playlist'}
                      >
                        <span className="text-sm">{pl.liked ? '★' : '☆'}</span>
                      </button>

                      <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                        <span className="text-lg font-black">{pl._count?.videos !== undefined ? pl._count.videos : (pl.videosCount || 0)}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest">Videos</span>
                      </div>
                    </div>
                    <div className="p-3">
                      <h4 className="font-black text-sm text-slate-900 group-hover:text-indigo-700 transition line-clamp-2 leading-snug">{pl.title}</h4>
                      <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mt-1.5">Playlist</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Courses Tab ──────────────────────────────────────────────────────────────
function CoursesTab({ centerId }: { centerId: string }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => { api<Course[]>(`/centers/${centerId}/courses`).then(setCourses).finally(() => setLoading(false)); }, [centerId]);

  if (loading) return <div className="text-teal-600 text-sm py-12 text-center animate-pulse font-semibold">Loading courses...</div>;
  if (courses.length === 0) return (
    <div className="text-center py-20 bg-white/60 backdrop-blur-xl rounded-3xl border border-white/80 shadow-sm">
      <span className="text-6xl">📚</span>
      <p className="mt-4 text-slate-500 text-sm font-semibold">No courses have been added yet.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {courses.map((course) => (
        <div key={course.id} className="bg-gradient-to-br from-teal-50/70 to-emerald-50/40 backdrop-blur-xl rounded-3xl border border-white/80 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.04)] hover:shadow-xl transition-all relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-teal-200/20 to-transparent rounded-bl-full pointer-events-none"></div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shrink-0 text-2xl shadow-md">📖</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-slate-900 text-lg">{course.title}</h3>
              {course.description && <p className="text-xs text-slate-500 mt-1 font-medium">{course.description}</p>}
              <div className="mt-4 space-y-2">
                {(course.subjects || []).map((subject) => (
                  <div key={subject.id}>
                    <button onClick={() => setExpanded((e) => ({ ...e, [subject.id]: !e[subject.id] }))}
                      className="w-full text-left flex items-center gap-2 py-2.5 px-4 bg-white/70 border border-teal-100 rounded-xl hover:bg-teal-50/50 transition-colors cursor-pointer"
                    >
                      <span className="text-teal-500 text-xs font-black">{expanded[subject.id] ? '▼' : '▶'}</span>
                      <span className="text-sm font-bold text-slate-800">{subject.title}</span>
                      <span className="ml-auto text-[10px] font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-100">{subject.chapters?.length || 0} chapters</span>
                    </button>
                    {expanded[subject.id] && (
                      <div className="ml-4 mt-1.5 space-y-1 border-l-2 border-teal-200 pl-3">
                        {(subject.chapters || []).map((ch) => (
                          <div key={ch.id} className="py-2 px-3 text-xs text-slate-600 flex items-center gap-2 bg-white/50 rounded-lg border border-teal-50">
                            <span className="text-teal-400 font-bold">◆</span>{ch.title}
                            <span className="ml-auto text-[10px] font-black text-slate-400">{ch.videos?.length || 0} videos</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Quizzes Tab ──────────────────────────────────────────────────────────────
function QuizzesTab({ centerId }: { centerId: string }) {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api<Test[]>(`/centers/${centerId}/tests`).then(setTests).finally(() => setLoading(false)); }, [centerId]);

  if (loading) return <div className="text-amber-600 text-sm py-12 text-center animate-pulse font-semibold">Loading quizzes...</div>;
  if (tests.length === 0) return (
    <div className="text-center py-20 bg-white/60 backdrop-blur-xl rounded-3xl border border-white/80 shadow-sm">
      <span className="text-6xl">🧪</span>
      <p className="mt-4 text-slate-500 text-sm font-semibold">No quizzes or tests have been created yet.</p>
    </div>
  );

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {tests.map((test) => (
        <div key={test.id} className="bg-gradient-to-br from-amber-50/70 to-orange-50/40 backdrop-blur-xl rounded-3xl border border-white/80 p-5 shadow-[0_4px_20px_rgb(0,0,0,0.04)] hover:shadow-xl transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-amber-200/20 to-transparent rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0 text-xl shadow-md">📝</div>
            <div className="min-w-0">
              <h3 className="font-black text-sm text-slate-900 line-clamp-2">{test.title}</h3>
              {test.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2 font-medium">{test.description}</p>}
              <div className="flex gap-2 mt-3 flex-wrap">
                {test.durationMinutes && <span className="text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-lg">⏱ {test.durationMinutes} min</span>}
                {test.totalMarks && <span className="text-[9px] font-black text-orange-700 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-lg">🏆 {test.totalMarks} marks</span>}
              </div>
            </div>
          </div>
          <button className="mt-5 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all border-0 cursor-pointer">Attempt Quiz →</button>
        </div>
      ))}
    </div>
  );
}

// ─── Progress Tab ─────────────────────────────────────────────────────────────
function ProgressTab({ centerId }: { centerId: string }) {
  const [report, setReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<any>(`/centers/${centerId}/progress/report`)
      .then((d) => setReport(Array.isArray(d) ? d : []))
      .catch(() => setReport([]))
      .finally(() => setLoading(false));
  }, [centerId]);

  if (loading) return <div className="text-violet-600 text-sm py-12 text-center animate-pulse font-semibold">Loading progress...</div>;
  if (report.length === 0) return (
    <div className="text-center py-20 bg-white/60 backdrop-blur-xl rounded-3xl border border-white/80 shadow-sm">
      <span className="text-6xl">📊</span>
      <p className="mt-4 text-slate-500 text-sm font-semibold">No progress yet. Start watching videos to track your journey!</p>
    </div>
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {report.map((item: any, i: number) => (
        <div key={i} className="bg-gradient-to-br from-violet-50/70 to-indigo-50/40 backdrop-blur-xl rounded-3xl border border-white/80 p-5 shadow-[0_4px_20px_rgb(0,0,0,0.04)]">
          <p className="text-sm font-black text-slate-900 line-clamp-1">{item.videoTitle || 'Video'}</p>
          <div className="mt-4">
            <div className="flex justify-between text-[10px] font-black text-violet-600 mb-2"><span>Progress</span><span>{item.progressPercent ?? 0}%</span></div>
            <div className="h-2.5 bg-white/60 border border-violet-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all" style={{ width: `${item.progressPercent ?? 0}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Edit Profile Tab ─────────────────────────────────────────────────────────
function EditProfileTab({ user, onProfileUpdated, onJoinClick }: { user: User; onProfileUpdated: (u: Partial<User>) => void; onJoinClick: () => void }) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error' | ''>('');

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg('');
    try {
      await api('/auth/me/profile', { method: 'PATCH', body: JSON.stringify({ firstName, lastName, phone }) });
      setMsg('Profile updated successfully!'); setMsgType('success');
      onProfileUpdated({ firstName, lastName, phone });
    } catch (err: any) {
      setMsg(err.message || 'Failed to update profile.'); setMsgType('error');
    } finally { setSaving(false); }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setMsg('New passwords do not match.'); setMsgType('error'); return; }
    if (newPassword.length < 8) { setMsg('Password must be at least 8 characters.'); setMsgType('error'); return; }
    setSaving(true); setMsg('');
    try {
      await api('/auth/me/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) });
      setMsg('Password changed successfully!'); setMsgType('success');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      setMsg(err.message || 'Failed to change password.'); setMsgType('error');
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`p-3 rounded-xl text-sm font-semibold border ${
          msgType === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Personal Information Card */}
        <Card className="p-6 bg-white">
          <h3 className="font-extrabold text-indigo-950 text-base mb-5 flex items-center gap-2">
            <span className="text-xl">👤</span> Personal Information
          </h3>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">First Name *</label>
                <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input-devotional" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Last Name *</label>
                <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className="input-devotional" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600">Email Address</label>
              <input type="email" value={user.email} disabled className="input-devotional opacity-50 cursor-not-allowed bg-slate-50" />
              <p className="text-[10px] text-slate-400">Email address cannot be changed.</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600">Phone Number</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-devotional" placeholder="+91 98765 43210" />
            </div>
            <button type="submit" disabled={saving} className="btn-primary px-6 py-2.5 text-sm">
              {saving ? 'Saving...' : '💾 Save Profile'}
            </button>
          </form>
        </Card>

        {/* Change Password Card */}
        <Card className="p-6 bg-white">
          <h3 className="font-extrabold text-indigo-950 text-base mb-5 flex items-center gap-2">
            <span className="text-xl">🔐</span> Change Password
          </h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600">Current Password *</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="input-devotional pr-10" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-sm">
                  {showPw ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600">New Password *</label>
              <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-devotional" placeholder="Min 8 characters" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600">Confirm New Password *</label>
              <input type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-devotional" />
            </div>
            <button type="submit" disabled={saving} className="btn-primary px-6 py-2.5 text-sm">
              {saving ? 'Changing...' : '🔑 Change Password'}
            </button>
          </form>
        </Card>

        {/* Join Another Center Card */}
        <Card className="p-6 bg-gradient-to-br from-indigo-50/50 to-white border border-indigo-100 flex flex-col justify-between min-h-[220px]">
          <div>
            <h3 className="font-extrabold text-indigo-950 text-base mb-2 flex items-center gap-2">
              <span className="text-xl">🏫</span> Join Another Center
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Want to enroll in classes offered by a different center or college? Click below to enter their unique join code and submit your student entry request.
            </p>
          </div>
          <button
            onClick={onJoinClick}
            className="btn-outline border-indigo-200 hover:border-indigo-300 text-indigo-700 hover:bg-indigo-50/50 transition-all text-xs font-black py-3 px-5 rounded-xl uppercase tracking-wider mt-4 w-fit flex items-center gap-2 cursor-pointer"
          >
            <span>➕</span> Request Center Entry
          </button>
        </Card>
      </div>
    </div>
  );
}

const NAV_TABS = [
  { id: 'youtube',  label: 'YouTube Channels', icon: '📡', color: 'from-red-500 to-rose-500',       bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200'    },
  { id: 'videos',   label: 'Shorts',           icon: '📺', color: 'from-teal-500 to-emerald-500',   bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200'   },
  { id: 'profile',  label: 'Edit Profile',     icon: '👤', color: 'from-violet-500 to-indigo-500',  bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
];

// ─── Main Dashboard Page ──────────────────────────────────────────────────────
export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-1 items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm font-semibold">Loading dashboard...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCenterId, setSelectedCenterId] = useState<string>('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [centerData, setCenterData] = useState<any>(null);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const activeTab = searchParams.get('tab') || 'youtube';
  const setActiveTab = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabId);
    router.push(`${pathname}?${params.toString()}`);
  };

  const loadUser = useCallback(async () => {
    try {
      const data = await getMe() as User;
      if (data.globalRole === 'SUPER_ADMIN') { router.replace('/super-admin'); return; }

      setUser(data);
      const firstApproved = data.centerMemberships.find((m) => m.isApproved);
      if (firstApproved) setSelectedCenterId(firstApproved.center.id);
    } catch {
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Check if join query parameter is present to auto-open modal
  useEffect(() => {
    if (searchParams.get('join') === 'true') {
      setShowJoinModal(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('join');
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [searchParams, router, pathname]);



  async function handleLogout() { await logout(); router.push('/login'); }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm font-semibold">Loading your portal...</p>
        </div>
      </div>
    );
  }
  if (!user) return null;

  const approvedMemberships = user.centerMemberships.filter((m) => m.isApproved);
  const pendingMemberships = user.centerMemberships.filter((m) => !m.isApproved);

  if (approvedMemberships.length === 0) {
    return <PendingApprovalScreen user={user} pendingMemberships={pendingMemberships} onLogout={handleLogout} onRefresh={loadUser} />;
  }

  const activeMembership = approvedMemberships.find((m) => m.center.id === selectedCenterId) || approvedMemberships[0];
  const centerId = activeMembership.center.id;

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-teal-50 relative">
      {/* Background blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 rounded-full bg-indigo-300/20 blur-[120px] pointer-events-none -z-10"></div>
      <div className="absolute bottom-20 right-0 w-80 h-80 rounded-full bg-fuchsia-300/20 blur-[100px] pointer-events-none -z-10"></div>
      <div className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-teal-300/15 blur-[90px] pointer-events-none -z-10"></div>

      <Navbar variant="app" onLogout={handleLogout} />

      <div className="flex flex-1 max-w-[1500px] mx-auto w-full px-3 sm:px-4 lg:px-6 py-6 gap-5 relative z-10 pb-28 md:pb-6">

        {/* ── Left Sidebar ── */}
        <aside className="w-56 lg:w-64 shrink-0 hidden md:block">
          <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-4 space-y-1 sticky top-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 rounded-full bg-gradient-to-br from-indigo-200/30 to-purple-200/30 blur-xl pointer-events-none"></div>

            {/* User info */}
            <div className="px-2 pb-5 mb-2 border-b border-slate-100 text-center relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl mx-auto mb-3 shadow-lg">
                {user.firstName.charAt(0)}{user.lastName.charAt(0)}
              </div>
              <p className="text-sm font-black text-slate-900 leading-tight">{user.firstName} {user.lastName}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate font-semibold">{user.email}</p>
              {activeMembership.batchMemberships.length > 0 && (
                <p className="text-[11px] text-violet-700 font-black text-center mt-2 bg-violet-50 border border-violet-100 rounded-xl px-2 py-1">
                  🎓 {activeMembership.batchMemberships.map((bm) => bm.batch.name).join(', ')}
                </p>
              )}
            </div>

            {/* Center selector if multiple */}
            {approvedMemberships.length > 1 && (
              <div className="px-1 pb-3 mb-1 border-b border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1.5 px-1 tracking-wider">Switch Center</p>
                <select
                  value={selectedCenterId}
                  onChange={(e) => setSelectedCenterId(e.target.value)}
                  className="w-full text-xs py-2 px-3 font-semibold bg-white/80 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300"
                >
                  {approvedMemberships.map((m) => (
                    <option key={m.center.id} value={m.center.id}>{m.center.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Admin Console Links */}
            {user.centerMemberships
              .filter((m) => m.isApproved && ['ADMIN', 'TEACHER', 'STAFF'].includes(m.role))
              .map((m) => (
                <div key={m.center.id} className="pt-2 border-t border-slate-100 mt-2">
                  <Link
                    href={`/centers/${m.center.id}`}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-black text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 hover:text-indigo-800 transition cursor-pointer"
                  >
                    <span className="text-xl w-8 h-8 rounded-xl bg-white border border-indigo-200/50 flex items-center justify-center shrink-0">⚙️</span>
                    <span className="truncate">{m.center.name} Console</span>
                  </Link>
                </div>
              ))}



            {/* Nav Items */}
            <p className="text-[9px] font-black text-slate-400 uppercase px-2 pt-2 pb-1.5 tracking-widest">Navigation</p>
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-bold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? `bg-gradient-to-r ${tab.color} text-white shadow-md`
                    : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
                }`}
              >
                <span className={`text-xl w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  activeTab === tab.id ? 'bg-white/20' : tab.bg
                }`}>{tab.icon}</span>
                <span className="truncate">{tab.label}</span>
              </button>
            ))}


            {/* Pending notice */}
            {pendingMemberships.length > 0 && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-2xl">
                <p className="text-[10px] text-amber-700 font-black">
                  ⏳ {pendingMemberships.length} center(s) awaiting approval
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 min-w-0 space-y-5">
          {/* Center Hero Header */}
          <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 rounded-3xl p-5 lg:p-6 text-white shadow-xl relative overflow-hidden flex flex-wrap justify-between items-center gap-4">
            <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 rounded-full bg-white/10 blur-xl pointer-events-none"></div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-white font-black text-lg shadow-md backdrop-blur-md">
                {activeMembership.center.name.charAt(0)}
              </div>
              <div>
                <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Currently Viewing</p>
                <h2 className="font-black text-lg text-white leading-tight">{activeMembership.center.name}</h2>
                <p className="text-xs text-white/70 font-semibold mt-0.5">
                  {NAV_TABS.find((t) => t.id === activeTab)?.icon}&nbsp;
                  {NAV_TABS.find((t) => t.id === activeTab)?.label}
                </p>
              </div>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'videos'   && <VideosTab centerId={centerId} batchIds={activeMembership.batchMemberships.map((bm) => bm.batch.id)} isAdmin={['ADMIN', 'TEACHER', 'STAFF'].includes(activeMembership.role)} onBack={() => setActiveTab('youtube')} />}
          {activeTab === 'youtube'  && (
            <YoutubeChannelsTab
              centerId={centerId}
              batchIds={activeMembership.batchMemberships.map((bm) => bm.batch.id)}
              isAdmin={['ADMIN', 'TEACHER', 'STAFF'].includes(activeMembership.role)}
            />
          )}
          {activeTab === 'courses'  && <CoursesTab centerId={centerId} />}
          {activeTab === 'quizzes'  && <QuizzesTab centerId={centerId} />}
          {activeTab === 'progress' && <ProgressTab centerId={centerId} />}
          {activeTab === 'profile'  && (
            <EditProfileTab
              user={user}
              onProfileUpdated={(updated) => setUser((u) => u ? { ...u, ...updated } : u)}
              onJoinClick={() => setShowJoinModal(true)}
            />
          )}
        </main>
      </div>

      {/* ── Mobile Bottom Tab Bar (hidden on md+) ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-2xl border-t border-white/60 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] safe-bottom">
        <div className="flex items-stretch h-16">
          {NAV_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 relative cursor-pointer transition-all active:scale-95"
              >
                {/* Active indicator bar at top */}
                {isActive && (
                  <span className={`absolute top-0 left-1/4 right-1/4 h-0.5 rounded-full bg-gradient-to-r ${tab.color}`} />
                )}
                {/* Icon bubble */}
                <span className={`w-10 h-7 rounded-xl flex items-center justify-center text-lg transition-all ${
                  isActive
                    ? `bg-gradient-to-br ${tab.color} shadow-md scale-110`
                    : 'scale-100'
                }`}>
                  {tab.icon}
                </span>
                {/* Label */}
                <span className={`text-[9px] font-black uppercase tracking-wide leading-none ${
                  isActive ? 'text-indigo-700' : 'text-slate-400'
                }`}>
                  {tab.label.split(' ')[0]}
                </span>
              </button>
            );
          })}

          {/* Admin Console buttons for mobile */}
          {user.centerMemberships
            .filter((m) => m.isApproved && ['ADMIN', 'TEACHER', 'STAFF'].includes(m.role))
            .map((m) => (
              <Link
                key={m.center.id}
                href={`/centers/${m.center.id}`}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 relative cursor-pointer transition-all active:scale-95"
              >
                <span className="absolute top-0 left-1/4 right-1/4 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0" />
                <span className="w-10 h-7 rounded-xl flex items-center justify-center text-lg bg-indigo-50 border border-indigo-200/60 scale-100">
                  ⚙️
                </span>
                <span className="text-[9px] font-black uppercase tracking-wide leading-none text-indigo-600">
                  Console
                </span>
              </Link>
            ))}
        </div>

      </nav>

      {/* ── Join Center Modal Overlay ── */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 relative">
            <button
              onClick={() => {
                setShowJoinModal(false);
                setCode('');
                setCenterData(null);
                setErrorMsg('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-extrabold text-xl cursor-pointer"
            >
              ×
            </button>

            <div className="text-center">
              <span className="text-3xl">🔑</span>
              <h3 className="font-sans text-lg font-black text-indigo-950 mt-2">Join a New Center</h3>
              <p className="text-xs text-slate-500 mt-1">Enter a class join code to send an access request to the center admin.</p>
            </div>

            <ModalForm
              code={code}
              setCode={setCode}
              verifying={verifying}
              setVerifying={setVerifying}
              centerData={centerData}
              setCenterData={setCenterData}
              selectedBatchId={selectedBatchId}
              setSelectedBatchId={setSelectedBatchId}
              errorMsg={errorMsg}
              setErrorMsg={setErrorMsg}
              submitting={submitting}
              setSubmitting={setSubmitting}
              onClose={() => {
                setShowJoinModal(false);
                setCode('');
                setCenterData(null);
                setErrorMsg('');
                loadUser();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ModalForm({
  code, setCode, verifying, setVerifying, centerData, setCenterData,
  selectedBatchId, setSelectedBatchId, errorMsg, setErrorMsg, submitting, setSubmitting, onClose
}: {
  code: string; setCode: (v: string) => void;
  verifying: boolean; setVerifying: (v: boolean) => void;
  centerData: any; setCenterData: (v: any) => void;
  selectedBatchId: string; setSelectedBatchId: (v: string) => void;
  errorMsg: string; setErrorMsg: (v: string) => void;
  submitting: boolean; setSubmitting: (v: boolean) => void;
  onClose: () => void;
}) {

  // Auto-verify code when it reaches 8 characters (e.g. VS-XXXXXX)
  useEffect(() => {
    const clean = code.trim().toUpperCase();
    if (clean.length >= 8) {
      setVerifying(true);
      setErrorMsg('');
      api<any>(`/centers/by-code/${clean}`)
        .then((data) => {
          setCenterData(data);
          if (data.batches && data.batches.length > 0) {
            setSelectedBatchId(data.batches[0].id);
          }
        })
        .catch((err) => {
          setErrorMsg(err.message || 'Invalid join code');
          setCenterData(null);
        })
        .finally(() => setVerifying(false));
    } else {
      setCenterData(null);
      setErrorMsg('');
    }
  }, [code, setVerifying, setCenterData, setSelectedBatchId, setErrorMsg]);

  async function handleJoinSubmit(e: FormEvent) {
    e.preventDefault();
    if (!centerData || submitting) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      await api('/centers/join-by-code', {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          batchId: selectedBatchId || undefined,
        }),
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleJoinSubmit} className="space-y-4 text-left">
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
          ⚠️ {errorMsg}
        </div>
      )}
      
      <div className="space-y-1">
        <label className="text-xs font-bold text-slate-600">Join Code</label>
        <input
          type="text"
          required
          placeholder="e.g. VS-XXXXXX"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full input-devotional uppercase tracking-widest font-black"
        />
      </div>

      {verifying && (
        <p className="text-[10px] text-indigo-600 font-bold italic animate-pulse">Checking join code...</p>
      )}

      {centerData && (
        <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-xs font-bold text-indigo-950">🏫 Center: <span className="font-black text-indigo-700">{centerData.name}</span></p>
          
          {centerData.batches && centerData.batches.length > 0 ? (
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Select Group / Classroom</label>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
              >
                {centerData.batches.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-[10px] text-rose-600 font-bold">No batches available in this center.</p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!centerData || submitting}
        className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-md cursor-pointer ${
          centerData && !submitting
            ? 'bg-indigo-650 hover:bg-indigo-750 text-white hover:shadow-lg'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none'
        }`}
      >
        {submitting ? 'Submitting Request...' : '🔑 Request Entry'}
      </button>
    </form>
  );
}
