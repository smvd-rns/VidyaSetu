'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { getMe, logout } from '@/lib/auth';
import { api } from '@/lib/api';
import { Navbar } from '@/components/Navbar';
import { Card, PageShell } from '@/components/ui';

interface Application {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  center: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    phone: string | null;
    email: string | null;
    subscriptionExpiresAt: string | null;
  };
  applicant: { firstName: string; lastName: string; email: string };
}

interface Center {
  id: string;
  name: string;
  slug: string;
  status: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: string | null;
  _count: { memberships: number };
}

interface Batch {
  id: string;
  name: string;
}

interface BatchMembership {
  id: string;
  batch: Batch;
}

interface CenterMembership {
  id: string;
  role: 'ADMIN' | 'TEACHER' | 'STAFF' | 'STUDENT';
  center: {
    id: string;
    name: string;
  };
  batchMemberships: BatchMembership[];
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  globalRole: string;
  isActive: boolean;
  createdAt: string;
  centerMemberships: CenterMembership[];
}

interface YoutubeChannel {
  id: string;
  channelId: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  isActive: boolean;
  lastSyncedAt: string | null;
  center: {
    id: string;
    name: string;
  };
  batches: {
    batch: {
      id: string;
      name: string;
    };
  }[];
}

export default function SuperAdminPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-1 items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm font-semibold">Loading Super Admin Panel...</p>
        </div>
      </div>
    }>
      <SuperAdminContent />
    </Suspense>
  );
}

function SuperAdminContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Core Lists
  const [applications, setApplications] = useState<Application[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [youtubeChannels, setYoutubeChannels] = useState<YoutubeChannel[]>([]);

  // UI States
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [extendDaysInput, setExtendDaysInput] = useState<Record<string, string>>({});
  const [customDateInput, setCustomDateInput] = useState<Record<string, string>>({});
  
  // Users Tab Filters
  const [selectedUserCenterId, setSelectedUserCenterId] = useState('');
  const [selectedUserBatchId, setSelectedUserBatchId] = useState('');
  const [selectedUserRole, setSelectedUserRole] = useState('');

  // YouTube Tab Filters
  const [selectedYtCenterId, setSelectedYtCenterId] = useState('');
  const [selectedYtBatchId, setSelectedYtBatchId] = useState('');

  // YouTube Selection & Sequential Sync States
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [syncProgressText, setSyncProgressText] = useState('');

  const selectedCenterId = searchParams.get('selectedCenterId') || '';
  const setSelectedCenterId = (centerId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (centerId) {
      params.set('selectedCenterId', centerId);
    } else {
      params.delete('selectedCenterId');
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const tab = (searchParams.get('tab') as 'applications' | 'centers' | 'users' | 'youtube') || 'applications';
  const setTab = (newTab: 'applications' | 'centers' | 'users' | 'youtube') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    params.delete('selectedCenterId');
    setSearchQuery(''); // clear query when switching tabs
    setSelectedUserCenterId('');
    setSelectedUserBatchId('');
    setSelectedUserRole('');
    setSelectedYtCenterId('');
    setSelectedYtBatchId('');
    setSelectedChannelIds([]);
    setIsSyncingQueue(false);
    setSyncProgressText('');
    router.push(`${pathname}?${params.toString()}`);
  };

  const loadData = async () => {
    try {
      const me = await getMe();
      if (me.globalRole !== 'SUPER_ADMIN') {
        router.replace('/dashboard');
        return;
      }
      const [apps, ctrs, usrList, ytList] = await Promise.all([
        api<Application[]>('/centers/applications?status=PENDING'),
        api<Center[]>('/centers'),
        api<User[]>('/centers/users'),
        api<YoutubeChannel[]>('/centers/youtube-channels'),
      ]);
      setApplications(apps);
      setCenters(ctrs);
      setUsers(usrList);
      setYoutubeChannels(ytList);
    } catch (err: any) {
      console.error(err);
      if (err && err.statusCode === 401) {
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [router]);

  async function review(id: string, status: 'APPROVED' | 'REJECTED') {
    setActionLoadingId(id);
    try {
      await api(`/centers/applications/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status, trialDays: 14 }),
      });
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function extendSubscription(centerId: string, days: number) {
    setActionLoadingId(`extend-${centerId}`);
    try {
      await api(`/centers/${centerId}/subscription`, {
        method: 'PATCH',
        body: JSON.stringify({ extendDays: days }),
      });
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function setCustomExpirationDate(centerId: string, dateStr: string) {
    if (!dateStr) return;
    setActionLoadingId(`date-${centerId}`);
    try {
      await api(`/centers/${centerId}/subscription`, {
        method: 'PATCH',
        body: JSON.stringify({ subscriptionExpiresAt: new Date(dateStr).toISOString() }),
      });
      await loadData();
      setCustomDateInput(prev => ({ ...prev, [centerId]: '' }));
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function toggleCenterActive(centerId: string, currentStatus: string) {
    setActionLoadingId(`status-${centerId}`);
    try {
      const endpoint = currentStatus === 'SUSPENDED' ? 'activate' : 'suspend';
      await api(`/centers/${centerId}/${endpoint}`, {
        method: 'PATCH',
      });
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleRoleChange(membershipId: string, role: string) {
    setActionLoadingId(`role-${membershipId}`);
    try {
      await api(`/centers/memberships/${membershipId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleSyncSelected() {
    if (selectedChannelIds.length === 0) return;
    setIsSyncingQueue(true);
    
    try {
      const channelsToSync = youtubeChannels.filter((ch) =>
        selectedChannelIds.includes(ch.id)
      );

      for (let i = 0; i < channelsToSync.length; i++) {
        const ch = channelsToSync[i];
        setSyncProgressText(`[${i + 1}/${channelsToSync.length}] Initiating sync for "${ch.title}"...`);
        
        try {
          await api(`/centers/${ch.center.id}/youtube/channels/${ch.channelId}/sync`, {
            method: 'POST',
          });

          let isRunning = true;
          while (isRunning) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const progress = await api<any>(`/centers/${ch.center.id}/youtube/channels/${ch.channelId}/sync-status`);
            
            if (progress.status === 'syncing') {
              const stageText = progress.stage ? ` (${progress.stage})` : '';
              setSyncProgressText(
                `[${i + 1}/${channelsToSync.length}] Syncing "${ch.title}"${stageText}...`
              );
            } else {
              isRunning = false;
            }
          }
        } catch (err: any) {
          console.error(`Failed to sync channel ${ch.title}:`, err);
        }
      }
      setSyncProgressText('All selected channels synchronized successfully!');
      setTimeout(() => setSyncProgressText(''), 5000);
      setSelectedChannelIds([]);
      await loadData();
    } catch (error) {
      console.error('Error during batch sync execution:', error);
    } finally {
      setIsSyncingQueue(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm font-semibold">Loading Portal Data...</p>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const pendingCount = applications.length;
  const totalCenters = centers.length;
  const activeSubs = centers.filter(c => c.subscriptionStatus === 'ACTIVE').length;
  const suspendedCenters = centers.filter(c => c.status === 'SUSPENDED').length;
  const totalUsers = users.length;
  const totalYtChannels = youtubeChannels.length;

  // Extract unique batches from all users (to populate user filters)
  const allBatchesSet = new Set<string>();
  const allBatchMap = new Map<string, string>();
  users.forEach(u => {
    u.centerMemberships.forEach(m => {
      if (!selectedUserCenterId || m.center.id === selectedUserCenterId) {
        m.batchMemberships.forEach(bm => {
          allBatchesSet.add(bm.batch.id);
          allBatchMap.set(bm.batch.id, bm.batch.name);
        });
      }
    });
  });
  const availableUserBatches = Array.from(allBatchesSet).map(id => ({
    id,
    name: allBatchMap.get(id) || 'Unknown Group'
  }));

  // Extract unique batches from all youtube channels (to populate youtube filters)
  const allYtBatchesSet = new Set<string>();
  const allYtBatchMap = new Map<string, string>();
  youtubeChannels.forEach(ch => {
    if (!selectedYtCenterId || ch.center.id === selectedYtCenterId) {
      ch.batches.forEach(b => {
        allYtBatchesSet.add(b.batch.id);
        allYtBatchMap.set(b.batch.id, b.batch.name);
      });
    }
  });
  const availableYtBatches = Array.from(allYtBatchesSet).map(id => ({
    id,
    name: allYtBatchMap.get(id) || 'Unknown Group'
  }));

  const filteredChannels = youtubeChannels.filter(ch => {
    const matchesSearch = ch.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      ch.channelId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCenter = !selectedYtCenterId || ch.center.id === selectedYtCenterId;

    const matchesBatch = !selectedYtBatchId || 
      ch.batches.some(b => b.batch.id === selectedYtBatchId);

    return matchesSearch && matchesCenter && matchesBatch;
  });

  return (
    <div className="flex flex-1 flex-col bg-gradient-to-br from-indigo-100 via-purple-100 to-fuchsia-100 min-h-screen">
      <Navbar variant="app" onLogout={handleLogout} />

      <PageShell maxWidth="xl">
        {/* Header Section */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-violet-600 animate-pulse" />
              <p className="text-xs font-black text-violet-600 uppercase tracking-widest">VenuTube Engine</p>
            </div>
            <h1 className="font-sans text-3xl font-black tracking-tight text-indigo-950 mt-1 drop-shadow-sm">
              Super Admin Console
            </h1>
          </div>
          <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md border border-white/60 shadow-sm px-4 py-2 rounded-2xl">
            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-violet-500 to-fuchsia-600 flex items-center justify-center text-white font-extrabold text-sm shadow-sm">
              👑
            </div>
            <div>
              <p className="text-sm font-black text-indigo-950 leading-tight">Root Admin</p>
              <p className="text-xs text-indigo-900/60 font-bold">System Operator</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white border border-white/20 rounded-2xl p-4 shadow-md relative overflow-hidden group">
            <p className="text-xs font-black text-amber-100 uppercase tracking-wider">Pending Apps</p>
            <p className="text-3xl font-black mt-2">{pendingCount}</p>
            <p className="text-xs text-amber-100/80 mt-1">Needs review</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border border-white/20 rounded-2xl p-4 shadow-md relative overflow-hidden group">
            <p className="text-xs font-black text-blue-100 uppercase tracking-wider">Centers</p>
            <p className="text-3xl font-black mt-2">{totalCenters}</p>
            <p className="text-xs text-blue-100/80 mt-1">{suspendedCenters} Suspended</p>
          </div>

          <div className="bg-gradient-to-br from-violet-500 to-purple-600 text-white border border-white/20 rounded-2xl p-4 shadow-md relative overflow-hidden group">
            <p className="text-xs font-black text-violet-100 uppercase tracking-wider">Users</p>
            <p className="text-3xl font-black mt-2">{totalUsers}</p>
            <p className="text-xs text-violet-100/80 mt-1">Total members</p>
          </div>

          <div className="bg-gradient-to-br from-rose-400 to-pink-500 text-white border border-white/20 rounded-2xl p-4 shadow-md relative overflow-hidden group">
            <p className="text-xs font-black text-rose-100 uppercase tracking-wider">YouTube</p>
            <p className="text-3xl font-black mt-2">{totalYtChannels}</p>
            <p className="text-xs text-rose-100/80 mt-1">Linked channels</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white border border-white/20 rounded-2xl p-4 shadow-md relative overflow-hidden group col-span-2 lg:col-span-1">
            <p className="text-xs font-black text-emerald-100 uppercase tracking-wider">Active Subs</p>
            <p className="text-3xl font-black mt-2">{activeSubs}</p>
            <p className="text-xs text-emerald-100/80 mt-1">Paid licenses</p>
          </div>
        </div>

        {/* Tab Switcher - Pill Style */}
        <div className="mb-6 bg-white/40 backdrop-blur-md p-1.5 rounded-2xl flex flex-wrap gap-1.5 border border-white/60 shadow-sm">
          {(['applications', 'centers', 'users', 'youtube'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 min-w-[120px] rounded-xl py-2.5 text-sm font-black capitalize transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                tab === t
                  ? 'bg-white text-indigo-900 shadow-md ring-1 ring-black/5'
                  : 'text-indigo-900/60 hover:text-indigo-900 hover:bg-white/40'
              }`}
            >
              <span>
                {t === 'applications' && '📥'}
                {t === 'centers' && '🏫'}
                {t === 'users' && '👤'}
                {t === 'youtube' && '📡'}
              </span>
              <span>
                {t === 'applications' && 'Applications'}
                {t === 'centers' && 'Centers'}
                {t === 'users' && 'Users'}
                {t === 'youtube' && 'YouTube'}
              </span>
              {t === 'applications' && pendingCount > 0 && (
                <span className="h-5 min-w-5 px-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full flex items-center justify-center text-xs font-black shrink-0 shadow-sm">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search Bar & Filters for Users Tab */}
        {tab === 'users' && (
          <div className="mb-6 bg-white/40 backdrop-blur-md p-4 rounded-2xl border border-white/60 shadow-sm flex flex-wrap gap-3 items-center">
            {/* Search */}
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-indigo-100 rounded-xl text-sm py-2.5 px-4 flex-1 min-w-[200px] text-indigo-950 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm"
            />

            {/* Center Filter */}
            <select
              value={selectedUserCenterId}
              onChange={(e) => {
                setSelectedUserCenterId(e.target.value);
                setSelectedUserBatchId(''); // Reset batch selection when center changes
              }}
              className="bg-white border border-indigo-100 rounded-xl text-sm py-2.5 px-3 text-indigo-950 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer shadow-sm"
            >
              <option value="">All Centers</option>
              {centers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Group Filter */}
            <select
              value={selectedUserBatchId}
              onChange={(e) => setSelectedUserBatchId(e.target.value)}
              className="bg-white border border-indigo-100 rounded-xl text-sm py-2.5 px-3 text-indigo-950 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer shadow-sm"
            >
              <option value="">All Groups (Batches)</option>
              {availableUserBatches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            {/* Role Filter */}
            <select
              value={selectedUserRole}
              onChange={(e) => setSelectedUserRole(e.target.value)}
              className="bg-white border border-indigo-100 rounded-xl text-sm py-2.5 px-3 text-indigo-950 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer shadow-sm"
            >
              <option value="">All Roles</option>
              <option value="STUDENT">Student</option>
              <option value="TEACHER">Teacher</option>
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        )}

        {/* Search Bar & Filters for YouTube Tab */}
        {tab === 'youtube' && (
          <div className="space-y-4 mb-6">
            <div className="bg-white/40 backdrop-blur-md p-4 rounded-2xl border border-white/60 shadow-sm flex flex-wrap gap-3 items-center">
              {/* Search */}
              <input
                type="text"
                placeholder="Search channels by title or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white border border-indigo-100 rounded-xl text-sm py-2.5 px-4 flex-1 min-w-[200px] text-indigo-950 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm"
              />

              {/* Center Filter */}
              <select
                value={selectedYtCenterId}
                onChange={(e) => {
                  setSelectedYtCenterId(e.target.value);
                  setSelectedYtBatchId(''); // Reset batch selection when center changes
                }}
                className="bg-white border border-indigo-100 rounded-xl text-sm py-2.5 px-3 text-indigo-950 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer shadow-sm"
              >
                <option value="">All Centers</option>
                {centers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {/* Group Filter */}
              <select
                value={selectedYtBatchId}
                onChange={(e) => setSelectedYtBatchId(e.target.value)}
                className="bg-white border border-indigo-100 rounded-xl text-sm py-2.5 px-3 text-indigo-950 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer shadow-sm"
              >
                <option value="">All Groups (Batches)</option>
                {availableYtBatches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Action Bar for manual bulk sync */}
            <div className="bg-white/50 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/60 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <input
                  type="checkbox"
                  id="select-all-channels"
                  checked={filteredChannels.length > 0 && filteredChannels.every(ch => selectedChannelIds.includes(ch.id))}
                  disabled={isSyncingQueue}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const allVisibleIds = filteredChannels.map(ch => ch.id);
                      setSelectedChannelIds(allVisibleIds);
                    } else {
                      setSelectedChannelIds([]);
                    }
                  }}
                  className="h-4 w-4 rounded border-indigo-100 text-indigo-600 focus:ring-indigo-400 cursor-pointer disabled:opacity-50"
                />
                <label htmlFor="select-all-channels" className="text-xs font-black text-indigo-955 select-none cursor-pointer uppercase tracking-wider">
                  Select All Visible ({filteredChannels.length})
                </label>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {selectedChannelIds.length > 0 && (
                  <span className="text-xs font-extrabold text-indigo-900/60">
                    {selectedChannelIds.length} channel(s) selected
                  </span>
                )}
                <button
                  type="button"
                  disabled={isSyncingQueue || selectedChannelIds.length === 0}
                  onClick={handleSyncSelected}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-500 text-white text-xs font-black px-4 py-2.5 rounded-xl transition shadow-md hover:shadow-lg disabled:shadow-none cursor-pointer active:scale-95 disabled:scale-100"
                >
                  {isSyncingQueue ? 'Syncing...' : '📡 Sync Selected'}
                </button>
              </div>
            </div>

            {/* Sync Progress Alert */}
            {syncProgressText && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin shrink-0" />
                <span className="text-xs font-extrabold text-indigo-900 leading-snug">{syncProgressText}</span>
              </div>
            )}
          </div>
        )}

        {/* Search Bar for other tabs */}
        {tab === 'centers' && (
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search centers by name or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/70 backdrop-blur-md border border-white text-indigo-950 placeholder:text-indigo-900/40 rounded-2xl py-4 px-5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
            />
          </div>
        )}

        {/* Tab: Applications */}
        {tab === 'applications' && (
          <div className="space-y-3">
            {applications.length === 0 ? (
              <div className="text-center py-12 bg-white/50 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm flex flex-col items-center justify-center">
                <span className="text-4xl mb-3">🎉</span>
                <h3 className="font-black text-indigo-950 text-sm">All caught up!</h3>
                <p className="text-[10px] text-indigo-900/60 mt-1 max-w-xs font-semibold">No pending center registrations require approval at this time.</p>
              </div>
            ) : (
              applications.map((app) => (
                <div key={app.id} className="bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl p-4 shadow-sm hover:shadow transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-sans text-base font-black text-indigo-950 leading-snug truncate">{app.center.name}</h3>
                      <span className="text-[9px] font-black uppercase bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full shrink-0 border border-orange-200">Pending Review</span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-indigo-950/70 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <span>👤</span>
                        <span className="truncate">Applicant: <span className="font-extrabold text-indigo-950">{app.applicant.firstName} {app.applicant.lastName}</span> ({app.applicant.email})</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>📅</span>
                        <span>Applied: {new Date(app.createdAt).toLocaleDateString()}</span>
                      </div>
                      {(app.center.city || app.center.state) && (
                        <div className="flex items-center gap-1.5 col-span-1 sm:col-span-2">
                          <span>📍</span>
                          <span>Location: {app.center.city || ''}{app.center.city && app.center.state ? ', ' : ''}{app.center.state || ''}</span>
                        </div>
                      )}
                      {(app.center.email || app.center.phone) && (
                        <div className="flex items-center gap-1.5 col-span-1 sm:col-span-2">
                          <span>📞</span>
                          <span>Contact: {app.center.email || 'N/A'} | {app.center.phone || 'N/A'}</span>
                        </div>
                      )}
                    </div>

                    {app.message && (
                      <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-3 text-[10px] font-semibold text-orange-900 italic relative mt-2">
                        <span className="absolute -top-2 left-3 bg-orange-100 text-orange-800 text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-orange-200">Applicant Message</span>
                        "{app.message}"
                      </div>
                    )}
                  </div>
                  
                  <div className="flex md:flex-col gap-2 shrink-0 w-full md:w-auto">
                    <button
                      type="button"
                      disabled={actionLoadingId === app.id}
                      onClick={() => review(app.id, 'APPROVED')}
                      className="flex-1 md:w-28 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-extrabold text-[11px] py-2 px-3 shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {actionLoadingId === app.id ? 'Approving...' : '✔️ Approve'}
                    </button>
                    <button
                      type="button"
                      disabled={actionLoadingId === app.id}
                      onClick={() => review(app.id, 'REJECTED')}
                      className="flex-1 md:w-28 rounded-xl bg-white/50 border border-red-200 text-red-600 font-extrabold text-[11px] py-2 px-3 hover:bg-red-50 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Centers */}
        {tab === 'centers' && (
          selectedCenterId ? (
            <CenterUsersView
              centerId={selectedCenterId}
              centers={centers}
              users={users}
              actionLoadingId={actionLoadingId}
              handleRoleChange={handleRoleChange}
              onBack={() => setSelectedCenterId(null)}
            />
          ) : (
            <div className="space-y-4">
              {centers
                .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.slug.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((c) => {
                  const isSuspended = c.status === 'SUSPENDED';
                  return (
                    <div key={c.id} className="bg-white/80 backdrop-blur-xl border border-white rounded-2xl p-4 shadow-sm hover:shadow-md transition flex flex-col gap-3">
                      {/* Row 1: Header Info & Extend Buttons */}
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        {/* Left: Name, Slug, Badges */}
                        <div 
                          className="flex items-center gap-3 cursor-pointer hover:opacity-85 select-none"
                          onClick={() => setSelectedCenterId(c.id)}
                        >
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-100 to-violet-100 text-indigo-700 font-black flex items-center justify-center uppercase shrink-0 border border-white shadow-sm text-sm">
                            {c.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-black text-indigo-950 text-base leading-tight hover:underline">{c.name}</h4>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase shrink-0 border shadow-sm ${
                              isSuspended 
                                ? 'bg-red-50 text-red-700 border-red-200' 
                                : c.status === 'APPROVED' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-orange-50 text-orange-700 border-orange-200'
                            }`}>
                              {c.status}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-black uppercase shrink-0 border shadow-sm ${
                              c.subscriptionStatus === 'ACTIVE' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : c.subscriptionStatus === 'TRIAL'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}>
                              {c.subscriptionStatus}
                            </span>
                          </div>
                          <p className="text-[11px] text-indigo-900/60 font-semibold uppercase mt-0.5">slug: {c.slug}</p>
                        </div>
                      </div>

                      {/* Right: Quick Extend buttons */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-900/60 uppercase mr-1">Extend:</span>
                        <button
                          onClick={() => extendSubscription(c.id, 30)}
                          disabled={actionLoadingId === `extend-${c.id}`}
                          className="bg-white hover:bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1.5 rounded-lg transition shadow-sm cursor-pointer"
                        >
                          +30D
                        </button>
                        <button
                          onClick={() => extendSubscription(c.id, 90)}
                          disabled={actionLoadingId === `extend-${c.id}`}
                          className="bg-white hover:bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1.5 rounded-lg transition shadow-sm cursor-pointer"
                        >
                          +90D
                        </button>
                        <button
                          onClick={() => extendSubscription(c.id, 365)}
                          disabled={actionLoadingId === `extend-${c.id}`}
                          className="bg-white hover:bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1.5 rounded-lg transition shadow-sm cursor-pointer"
                        >
                          +1Y
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/centers/${c.id}`);
                          }}
                          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-sm cursor-pointer ml-2"
                        >
                          Manage Center →
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Stats & Date Picker & Actions */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pt-2.5 border-t border-indigo-900/5">
                      {/* Left: Capacity, Expiration, Suspend Button */}
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold text-indigo-950">
                        <div>
                          <span className="text-indigo-900/50 font-black uppercase text-[10px] block">Capacity</span>
                          <span className="font-extrabold">{c._count.memberships} active users</span>
                        </div>
                        <div>
                          <span className="text-indigo-900/50 font-black uppercase text-[10px] block">Expires</span>
                          <span className="font-extrabold">
                            {c.subscriptionExpiresAt 
                              ? new Date(c.subscriptionExpiresAt).toLocaleDateString() 
                              : 'Never'}
                          </span>
                        </div>
                        <button
                          onClick={() => toggleCenterActive(c.id, c.status)}
                          disabled={actionLoadingId === `status-${c.id}`}
                          className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg transition cursor-pointer border shadow-sm ${
                            isSuspended 
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200' 
                              : 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200'
                          }`}
                        >
                          {actionLoadingId === `status-${c.id}` ? 'Updating...' : isSuspended ? 'Reactivate' : 'Suspend'}
                        </button>
                      </div>

                      {/* Right: Custom Expiration Date Inline */}
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <span className="text-xs font-bold text-indigo-900/60 uppercase whitespace-nowrap">Custom Date:</span>
                        <input
                          type="date"
                          value={customDateInput[c.id] || ''}
                          onChange={(e) => setCustomDateInput(prev => ({ ...prev, [c.id]: e.target.value }))}
                          className="bg-white border border-indigo-100 rounded-lg text-xs py-1.5 px-2.5 w-36 text-indigo-950 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm"
                        />
                        <button
                          onClick={() => setCustomExpirationDate(c.id, customDateInput[c.id])}
                          disabled={actionLoadingId === `date-${c.id}` || !customDateInput[c.id]}
                          className="bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white font-extrabold text-xs px-3 py-1.5 rounded-lg transition shrink-0 cursor-pointer disabled:opacity-50 shadow-sm"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          )
        )}

        {/* Tab: Users */}
        {tab === 'users' && (
          <div className="space-y-4">
            {users
              .filter(u => {
                const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
                const matchesSearch = fullName.includes(searchQuery.toLowerCase()) || 
                  u.email.toLowerCase().includes(searchQuery.toLowerCase());

                // Center filter
                const matchesCenter = !selectedUserCenterId || 
                  u.centerMemberships.some(m => m.center.id === selectedUserCenterId);

                // Role filter
                const matchesRole = !selectedUserRole || 
                  u.centerMemberships.some(m => m.role === selectedUserRole);

                // Batch filter
                const matchesBatch = !selectedUserBatchId || 
                  u.centerMemberships.some(m => m.batchMemberships.some(bm => bm.batch.id === selectedUserBatchId));

                return matchesSearch && matchesCenter && matchesRole && matchesBatch;
              })
              .map((u) => (
                <div key={u.id} className="bg-white/80 backdrop-blur-xl border border-white rounded-2xl p-4 shadow-sm hover:shadow transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Column: Profile */}
                  <div className="flex items-center gap-3 min-w-[240px] shrink-0">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-fuchsia-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm border border-white/50">
                      {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-indigo-950 text-base leading-tight">{u.firstName} {u.lastName}</h4>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase shrink-0 border shadow-sm ${
                          u.globalRole === 'SUPER_ADMIN' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white/80 text-indigo-900/60 border-indigo-900/10'
                        }`}>
                          {u.globalRole}
                        </span>
                      </div>
                      <p className="text-xs text-indigo-900/60 font-semibold mt-0.5">{u.email}</p>
                    </div>
                  </div>

                  {/* Right Column: Memberships */}
                  <div className="flex-1 min-w-0">
                    {u.centerMemberships.length === 0 ? (
                      <p className="text-xs text-indigo-900/50 font-semibold italic">No center assignments.</p>
                    ) : (
                      <div className="space-y-2">
                        {u.centerMemberships.map((m) => (
                          <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                            <div className="min-w-0 flex items-center gap-2">
                              <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold text-xs px-2.5 py-0.5 rounded-lg shadow-sm">
                                {m.center.name}
                              </span>
                              {m.batchMemberships.length > 0 && (
                                <span className="bg-fuchsia-50 border border-fuchsia-100 text-fuchsia-600 font-black text-xs px-2.5 py-0.5 rounded-lg shadow-sm">
                                  Group: {m.batchMemberships.map((bm) => bm.batch.name).join(', ')}
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0">
                              <label className="text-xs font-black text-indigo-900/50 uppercase">Role:</label>
                              <select
                                value={m.role}
                                disabled={actionLoadingId === `role-${m.id}`}
                                onChange={(e) => handleRoleChange(m.id, e.target.value)}
                                className="bg-white border border-indigo-100 rounded-lg text-xs py-1.5 px-2.5 w-28 text-indigo-950 font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer shadow-sm"
                              >
                                <option value="STUDENT">Student</option>
                                <option value="TEACHER">Teacher</option>
                                <option value="STAFF">Staff</option>
                                <option value="ADMIN">Admin</option>
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Tab: YouTube API */}
        {tab === 'youtube' && (
          <div className="space-y-4">
            {filteredChannels.length === 0 ? (
              <div className="text-center py-12 bg-white/50 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm flex flex-col items-center justify-center">
                <span className="text-4xl mb-3">📡</span>
                <h3 className="font-black text-indigo-955 text-sm">No channels found</h3>
                <p className="text-[10px] text-indigo-900/60 mt-1 max-w-xs font-semibold">Try adjusting your filters or search query.</p>
              </div>
            ) : (
              filteredChannels.map((ch) => (
                <div key={ch.id} className="bg-white/80 backdrop-blur-xl border border-white rounded-2xl p-4 shadow-sm hover:shadow transition flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedChannelIds.includes(ch.id)}
                      disabled={isSyncingQueue}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedChannelIds(prev => [...prev, ch.id]);
                        } else {
                          setSelectedChannelIds(prev => prev.filter(id => id !== ch.id));
                        }
                      }}
                      className="h-4 w-4 rounded border-indigo-100 text-indigo-600 focus:ring-indigo-400 cursor-pointer disabled:opacity-50 shrink-0 mr-2"
                    />
                    {ch.thumbnail ? (
                      <img src={ch.thumbnail} alt="" className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-sm shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 font-black flex items-center justify-center shrink-0 border-2 border-white shadow-sm text-sm">📡</div>
                    )}
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-indigo-950 text-sm truncate leading-snug">{ch.title}</h4>
                      <p className="text-xs text-indigo-900/50 font-black truncate mt-1">ID: {ch.channelId}</p>
                      
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-xs font-black uppercase text-indigo-900/60">
                        <span className="bg-white/60 border border-white text-indigo-700 px-2 py-0.5 rounded-full shadow-sm">🏫 {ch.center.name}</span>
                        {ch.batches.length > 0 && (
                          <span className="bg-violet-100 border border-violet-200 text-violet-700 px-2 py-0.5 rounded-full shadow-sm">
                            🎓 {ch.batches.map((b) => b.batch.name).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
 
                  <div className="w-full sm:w-auto border-t sm:border-t-0 sm:border-l border-indigo-900/5 pt-3 sm:pt-0 sm:pl-4 shrink-0 flex flex-col gap-1.5 text-left sm:text-right text-xs">
                    <p className="text-xs font-black text-indigo-900/50 uppercase tracking-wider">Sync State</p>
                    <p className="font-extrabold text-indigo-955 mt-0.5">
                      {ch.isActive ? '🟢 Active Auto-Sync' : '🔴 Idle'}
                    </p>
                    <p className="text-xs text-indigo-900/60 font-bold">
                      Last: {ch.lastSyncedAt ? new Date(ch.lastSyncedAt).toLocaleString() : 'Never'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </PageShell>
    </div>
  );
}

interface CenterUsersViewProps {
  centerId: string;
  centers: Center[];
  users: User[];
  actionLoadingId: string | null;
  handleRoleChange: (membershipId: string, role: string) => void;
  onBack: () => void;
}

function CenterUsersView({
  centerId,
  centers,
  users,
  actionLoadingId,
  handleRoleChange,
  onBack,
}: CenterUsersViewProps) {
  const [search, setSearch] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  const center = centers.find(c => c.id === centerId);
  const centerUsers = users.filter(u =>
    u.centerMemberships.some(m => m.center.id === centerId)
  );

  // Extract unique batches in this center
  const batchesSet = new Set<string>();
  const batchMap = new Map<string, string>();
  centerUsers.forEach(u => {
    const membership = u.centerMemberships.find(m => m.center.id === centerId);
    if (membership) {
      membership.batchMemberships.forEach(bm => {
        batchesSet.add(bm.batch.id);
        batchMap.set(bm.batch.id, bm.batch.name);
      });
    }
  });
  const availableBatches = Array.from(batchesSet).map(id => ({
    id,
    name: batchMap.get(id) || 'Unknown Group'
  }));

  const filtered = centerUsers.filter(u => {
    const membership = u.centerMemberships.find(m => m.center.id === centerId);
    if (!membership) return false;

    const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(search.toLowerCase()) || 
      u.email.toLowerCase().includes(search.toLowerCase());

    const matchesRole = !selectedRole || membership.role === selectedRole;
    const matchesBatch = !selectedBatchId || 
      membership.batchMemberships.some(bm => bm.batch.id === selectedBatchId);

    return matchesSearch && matchesRole && matchesBatch;
  });

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="bg-white/80 backdrop-blur-xl border border-white rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="h-8 w-8 rounded-lg border border-indigo-100 hover:bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm cursor-pointer shadow-sm"
          >
            ←
          </button>
          <div>
            <h3 className="text-lg font-black text-indigo-950">{center?.name || 'Center Detail'}</h3>
            <p className="text-xs text-indigo-900/60 font-semibold mt-0.5">
              Viewing all users inside this center ({filtered.length} shown of {centerUsers.length})
            </p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white/60 backdrop-blur-md border border-white/60 rounded-2xl p-3 flex flex-wrap gap-2 items-center shadow-sm">
        {/* Search */}
        <input
          type="text"
          placeholder="Search center users by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white border border-indigo-100 rounded-xl text-xs py-2 px-3 flex-1 min-w-[200px] text-indigo-950 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm"
        />

        {/* Group Filter */}
        <select
          value={selectedBatchId}
          onChange={(e) => setSelectedBatchId(e.target.value)}
          className="bg-white border border-indigo-100 rounded-xl text-xs py-2 px-3 text-indigo-950 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer shadow-sm"
        >
          <option value="">All Groups (Classrooms)</option>
          {availableBatches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        {/* Role Filter */}
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="bg-white border border-indigo-100 rounded-xl text-xs py-2 px-3 text-indigo-950 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer shadow-sm"
        >
          <option value="">All Roles</option>
          <option value="STUDENT">Student</option>
          <option value="TEACHER">Teacher</option>
          <option value="STAFF">Staff</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-10 bg-white/50 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm flex flex-col items-center justify-center">
            <span className="text-3xl mb-2">👤</span>
            <h3 className="font-black text-indigo-950 text-sm">No users found</h3>
            <p className="text-[10px] text-indigo-900/60 mt-1 max-w-xs font-semibold">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          filtered.map(u => {
            const membership = u.centerMemberships.find(m => m.center.id === centerId)!;
            return (
              <div key={u.id} className="bg-white/80 backdrop-blur-xl border border-white rounded-2xl p-3 shadow-sm hover:shadow transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-fuchsia-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-sm border border-white/50">
                    {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-indigo-950 text-sm leading-tight">{u.firstName} {u.lastName}</h4>
                    <p className="text-[10px] font-semibold text-indigo-900/60 truncate">{u.email}</p>
                    {membership.batchMemberships.length > 0 && (
                      <p className="text-[9px] text-fuchsia-600 font-bold mt-1">
                        Group: {membership.batchMemberships.map((bm) => bm.batch.name).join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-indigo-900/5 pt-2 sm:pt-0">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-black uppercase shrink-0 border ${
                    membership.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white/80 text-indigo-900/60 border-indigo-900/10'
                  }`}>
                    {membership.role}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <label className="text-[8px] font-black text-indigo-900/50 uppercase">Role</label>
                    <select
                      value={membership.role}
                      disabled={actionLoadingId === `role-${membership.id}`}
                      onChange={(e) => handleRoleChange(membership.id, e.target.value)}
                      className="bg-white border border-indigo-100 rounded-md text-[9px] py-1 px-1.5 w-24 text-indigo-950 font-extrabold focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer shadow-sm"
                    >
                      <option value="STUDENT">Student</option>
                      <option value="TEACHER">Teacher</option>
                      <option value="STAFF">Staff</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
