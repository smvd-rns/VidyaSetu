'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useParams, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getMe } from '@/lib/auth';
import { api } from '@/lib/api';
import { Navbar } from '@/components/Navbar';
import { Card, PageShell, FormField } from '@/components/ui';

interface CenterDetails {
  id: string;
  name: string;
  status: string;
  subscriptionStatus: string;
  joinCode?: string;
  _count: { memberships: number; courses: number; batches: number };
}

export default function CenterPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-1 items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm font-semibold">Loading center portal...</p>
        </div>
      </div>
    }>
      <CenterContent />
    </Suspense>
  );
}

function CenterContent() {
  const { centerId } = useParams<{ centerId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [center, setCenter] = useState<CenterDetails | null>(null);
  const [role, setRole] = useState<string>('');
  const [user, setUser] = useState<any>(null);
  const [previewMode, setPreviewMode] = useState<boolean>(false);

  const [activeTab, setActiveTabState] = useState('overview');
  const [manageCourseId, setManageCourseId] = useState<string | null>(null);
  const [manageBatchId, setManageBatchId] = useState<string | null>(null);
  const [manageTestId, setManageTestId] = useState<string | null>(null);

  // Members search & filters
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [batchStudentSearchQuery, setBatchStudentSearchQuery] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState('');
  const [memberBatchFilter, setMemberBatchFilter] = useState('');
  
  // Batch edit states
  const [isEditingBatchInfo, setIsEditingBatchInfo] = useState(false);
  const [editBatchName, setEditBatchName] = useState('');
  const [editBatchDesc, setEditBatchDesc] = useState('');
  const [openBatchSelectUserId, setOpenBatchSelectUserId] = useState<string | null>(null);
  const [batchActionLoadingMap, setBatchActionLoadingMap] = useState<Record<string, boolean>>({});
  const [tabLoading, setTabLoading] = useState(false);

  // Sync state from URL search params on mount or when URL changes
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTabState(tab);
    setManageCourseId(searchParams.get('manageCourse'));
    setManageBatchId(searchParams.get('manageBatch'));
    setManageTestId(searchParams.get('manageTest'));
  }, [searchParams]);

  const setActiveTab = (tabId: string) => {
    setActiveTabState(tabId);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabId);
    router.push(`${pathname}?${params.toString()}`);
  };

  // States for Admin lists
  const [members, setMembers] = useState<any[]>([]);
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [progressReport, setProgressReport] = useState<any[]>([]);
  const [ytChannels, setYtChannels] = useState<any[]>([]);
  const [syncedVideos, setSyncedVideos] = useState<any[]>([]);

  // Form inputs
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('STUDENT');
  const [batchName, setBatchName] = useState('');
  const [batchDesc, setBatchDesc] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  const [testTitle, setTestTitle] = useState('');
  const [testDesc, setTestDesc] = useState('');
  const [testDuration, setTestDuration] = useState(30);
  const [testMarks, setTestMarks] = useState(100);
  const [testPassing, setTestPassing] = useState(40);
  const [customCode, setCustomCode] = useState('');

  // Custom builders state (URL backed)
  const selectedManageCourse = courses.find((c) => c.id === manageCourseId) || null;
  const setSelectedManageCourse = (course: any) => {
    const params = new URLSearchParams(searchParams.toString());
    if (course) {
      setManageCourseId(course.id);
      params.set('manageCourse', course.id);
    } else {
      setManageCourseId(null);
      params.delete('manageCourse');
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const selectedManageBatch = batches.find((b) => b.id === manageBatchId) || null;
  const setSelectedManageBatch = (batch: any) => {
    const params = new URLSearchParams(searchParams.toString());
    if (batch) {
      setManageBatchId(batch.id);
      params.set('manageBatch', batch.id);
    } else {
      setManageBatchId(null);
      params.delete('manageBatch');
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const [assigningTeacherId, setAssigningTeacherId] = useState('');
  const [assigningStudentId, setAssigningStudentId] = useState('');
  const [newSubTitle, setNewSubTitle] = useState('');
  const [newChapTitle, setNewChapTitle] = useState('');
  const [newVidTitle, setNewVidTitle] = useState('');
  const [newVidYtId, setNewVidYtId] = useState('');
  const [newVidDuration, setNewVidDuration] = useState(15);
  const [activeChapterId, setActiveChapterId] = useState('');
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteUrl, setNewNoteUrl] = useState('');
  const [linkMode, setLinkMode] = useState<'manual' | 'synced'>('manual');

  // Test builder state (URL backed)
  const selectedManageTest = tests.find((t) => t.id === manageTestId) || null;
  const setSelectedManageTest = (test: any) => {
    const params = new URLSearchParams(searchParams.toString());
    if (test) {
      setManageTestId(test.id);
      params.set('manageTest', test.id);
    } else {
      setManageTestId(null);
      params.delete('manageTest');
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const [newQText, setNewQText] = useState('');
  const [newQMarks, setNewQMarks] = useState(1);
  const [newQType, setNewQType] = useState<'MCQ' | 'TRUE_FALSE'>('MCQ');
  const [opt1, setOpt1] = useState('');
  const [opt1Correct, setOpt1Correct] = useState(false);
  const [opt2, setOpt2] = useState('');
  const [opt2Correct, setOpt2Correct] = useState(false);
  const [opt3, setOpt3] = useState('');
  const [opt3Correct, setOpt3Correct] = useState(false);
  const [opt4, setOpt4] = useState('');
  const [opt4Correct, setOpt4Correct] = useState(false);

  // YouTube channels form & edit state
  const [ytChanId, setYtChanId] = useState('');
  const [ytChanTitle, setYtChanTitle] = useState('');
  const [ytChanDesc, setYtChanDesc] = useState('');
  const [ytChanThumb, setYtChanThumb] = useState('');
  const [ytSelectedBatchIds, setYtSelectedBatchIds] = useState<string[]>([]);
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [syncingMap, setSyncingMap] = useState<Record<string, boolean>>({});
  const [syncProgressMap, setSyncProgressMap] = useState<Record<string, any>>({});
  const syncIntervalRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Media library & Uploading state
  const [mediaLibrary, setMediaLibrary] = useState<any[]>([]);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Student Portal views (URL backed)
  const selectedCourse = courses.find((c) => c.id === searchParams.get('courseId')) || null;
  const setSelectedCourse = (course: any) => {
    const params = new URLSearchParams(searchParams.toString());
    if (course) params.set('courseId', course.id);
    else params.delete('courseId');
    router.push(`${pathname}?${params.toString()}`);
  };

  // Find activeVideo inside selectedCourse's videos
  const videoId = searchParams.get('videoId');
  let activeVideo = null;
  if (selectedCourse && videoId) {
    for (const sub of selectedCourse.subjects || []) {
      for (const chap of sub.chapters || []) {
        const found = chap.videos?.find((v: any) => v.id === videoId);
        if (found) {
          activeVideo = found;
          break;
        }
      }
      if (activeVideo) break;
    }
  }
  const setActiveVideo = (vid: any) => {
    const params = new URLSearchParams(searchParams.toString());
    if (vid) params.set('videoId', vid.id);
    else params.delete('videoId');
    router.push(`${pathname}?${params.toString()}`);
  };

  const activeTest = tests.find((t) => t.id === searchParams.get('testId')) || null;
  const setActiveTest = (test: any) => {
    const params = new URLSearchParams(searchParams.toString());
    if (test) params.set('testId', test.id);
    else params.delete('testId');
    router.push(`${pathname}?${params.toString()}`);
  };
  const [testQuestions, setTestQuestions] = useState<any[]>([]);
  const [studentAnswers, setStudentAnswers] = useState<Record<string, string>>({});
  const [testResultSummary, setTestResultSummary] = useState<any>(null);
  const [timer, setTimer] = useState<number>(0);
  const [timerInterval, setTimerInterval] = useState<any>(null);

  // Error/Success banners
  const [bannerMsg, setBannerMsg] = useState('');
  const [bannerType, setBannerType] = useState<'success' | 'error' | ''>('');

  // Custom Confirmation Modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmCallback, setConfirmCallback] = useState<(() => void) | null>(null);

  function triggerConfirm(msg: string, callback: () => void) {
    setConfirmMessage(msg);
    setConfirmCallback(() => callback);
    setShowConfirmModal(true);
  }

  useEffect(() => {
    async function load() {
      try {
        const me = await getMe();
        setUser(me);
        const membership = me.centerMemberships.find((m: any) => m.center.id === centerId);
        if (me.globalRole !== 'SUPER_ADMIN' && !membership) {
          router.replace('/dashboard');
          return;
        }
        const memberRole = membership?.role ?? 'SUPER_ADMIN';

        // Students should use the student dashboard — not this admin panel
        if (memberRole === 'STUDENT') {
          router.replace('/dashboard');
          return;
        }

        setRole(memberRole);
        const data = await api<CenterDetails>(`/centers/${centerId}`);
        setCenter(data);
      } catch {
        router.replace('/dashboard');
      }
    }
    load();
  }, [centerId, router]);

  // Load Tab Content dynamically
  useEffect(() => {
    if (!center) return;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'TEACHER', 'STAFF'].includes(role);

    async function loadTabData() {
      setTabLoading(true);
      try {
        if (isAdmin) {
          if (activeTab === 'members') {
            await Promise.all([fetchMembers(), fetchPendingMembers(), fetchBatches()]);
          } else if (activeTab === 'pending') {
            await fetchPendingMembers();
          } else if (activeTab === 'batches') {
            await Promise.all([fetchBatches(), fetchMembers()]);
          } else if (activeTab === 'courses') {
            await Promise.all([fetchCourses(), fetchSyncedVideos()]);
          } else if (activeTab === 'tests') {
            await fetchTests();
          } else if (activeTab === 'reports') {
            await fetchProgressReport();
          } else if (activeTab === 'youtube') {
            await Promise.all([fetchYoutubeChannels(), fetchMediaLibrary(), fetchBatches()]);
          }
        } else {
          await Promise.all([fetchCourses(), fetchTests()]);
        }
      } catch (err) {
        console.error('Error fetching tab data:', err);
      } finally {
        setTabLoading(false);
      }
    }

    loadTabData();
  }, [center, activeTab, role]);

  const showBanner = (msg: string, type: 'success' | 'error') => {
    setBannerMsg(msg);
    setBannerType(type);
    setTimeout(() => {
      setBannerMsg('');
      setBannerType('');
    }, 4000);
  };

  // Fetch API Handlers
  async function fetchMembers() {
    try {
      const data = await api<any[]>(`/centers/${centerId}/members`);
      setMembers(data);
    } catch { }
  }

  async function handleUpdateMemberRole(membershipId: string, newRole: string) {
    try {
      await api(`/centers/${centerId}/members/${membershipId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      showBanner('Member role updated successfully', 'success');
      fetchMembers();
    } catch (err) {
      console.error(err);
      showBanner('Failed to update member role', 'error');
    }
  }

  async function fetchPendingMembers() {
    try {
      const data = await api<any[]>(`/centers/${centerId}/pending-members`);
      setPendingMembers(data);
    } catch { }
  }

  async function fetchBatches() {
    try {
      const data = await api<any[]>(`/centers/${centerId}/batches`);
      setBatches(data);
      if (selectedManageBatch) {
        const fresh = data.find((b) => b.id === selectedManageBatch.id);
        if (fresh) setSelectedManageBatch(fresh);
      }
    } catch { }
  }

  async function fetchCourses() {
    try {
      const data = await api<any[]>(`/centers/${centerId}/courses`);
      setCourses(data);
      if (selectedManageCourse) {
        const fresh = data.find((c) => c.id === selectedManageCourse.id);
        if (fresh) setSelectedManageCourse(fresh);
      }
    } catch { }
  }

  async function fetchSyncedVideos() {
    try {
      const data = await api<any[]>(`/centers/${centerId}/videos`);
      setSyncedVideos(data.filter((v) => v.playlistId && !v.chapterId));
    } catch { }
  }

  async function fetchTests() {
    try {
      const data = await api<any[]>(`/centers/${centerId}/tests`);
      setTests(data);
      if (selectedManageTest) {
        const fresh = data.find((t) => t.id === selectedManageTest.id);
        if (fresh) setSelectedManageTest(fresh);
      }
    } catch { }
  }

  async function fetchProgressReport() {
    try {
      const data = await api<any[]>(`/centers/${centerId}/progress/report`);
      setProgressReport(data);
    } catch { }
  }

  async function fetchYoutubeChannels() {
    try {
      const data = await api<any[]>(`/centers/${centerId}/youtube/channels`);
      setYtChannels(data);
    } catch { }
  }

  async function fetchMediaLibrary() {
    try {
      const data = await api<any[]>(`/centers/${centerId}/media`);
      setMediaLibrary(data);
    } catch { }
  }

  // Admin Actions
  async function handleInviteMember(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(`/centers/${centerId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      setInviteEmail('');
      showBanner('Member invited successfully!', 'success');
      fetchMembers();
    } catch {
      showBanner('Failed to invite member.', 'error');
    }
  }

  async function handleApproveMember(membershipId: string) {
    try {
      await api(`/centers/${centerId}/members/${membershipId}/approve`, {
        method: 'PATCH',
      });
      showBanner('Student registration approved!', 'success');
      fetchPendingMembers();
      fetchMembers();
    } catch {
      showBanner('Failed to approve student.', 'error');
    }
  }

  async function handleRejectMember(membershipId: string) {
    triggerConfirm(
      'Are you sure you want to reject and remove this pending student registration?',
      async () => {
        try {
          await api(`/centers/${centerId}/members/${membershipId}`, {
            method: 'DELETE',
          });
          showBanner('Student registration rejected.', 'success');
          fetchPendingMembers();
        } catch {
          showBanner('Failed to reject registration.', 'error');
        }
      }
    );
  }

  const [creatingBatch, setCreatingBatch] = useState(false);

  async function handleCreateBatch(e: React.FormEvent) {
    e.preventDefault();
    if (creatingBatch) return;
    setCreatingBatch(true);
    try {
      await api(`/centers/${centerId}/batches`, {
        method: 'POST',
        body: JSON.stringify({ name: batchName, description: batchDesc }),
      });
      setBatchName('');
      setBatchDesc('');
      showBanner('Classroom group created successfully!', 'success');
      fetchBatches();
    } catch (err: any) {
      showBanner(err.message || 'Failed to create classroom group.', 'error');
    } finally {
      setCreatingBatch(false);
    }
  }

  async function handleDeleteBatch(batchId: string) {
    triggerConfirm(
      'Are you sure you want to permanently delete this classroom/group? All student and teacher assignments to this classroom will be removed.',
      async () => {
        try {
          await api(`/centers/${centerId}/batches/${batchId}`, {
            method: 'DELETE',
          });
          showBanner('Classroom group deleted successfully.', 'success');
          setSelectedManageBatch(null);
          fetchBatches();
        } catch {
          showBanner('Failed to delete classroom group.', 'error');
        }
      }
    );
  }

  async function handleUpdateBatchInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedManageBatch) return;
    try {
      await api(`/centers/${centerId}/batches/${selectedManageBatch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editBatchName, description: editBatchDesc }),
      });
      showBanner('Classroom details updated successfully!', 'success');
      setIsEditingBatchInfo(false);
      fetchBatches();
    } catch (err: any) {
      showBanner(err.message || 'Failed to update classroom details.', 'error');
    }
  }

  async function handleAssignBatchMember(batchId: string, memberId: string) {
    if (!memberId) return;
    const key = `${memberId}-${batchId}`;
    setBatchActionLoadingMap(prev => ({ ...prev, [key]: true }));
    try {
      await api(`/centers/${centerId}/batches/${batchId}/members`, {
        method: 'POST',
        body: JSON.stringify({ membershipId: memberId }),
      });
      showBanner('Member assigned to classroom group successfully!', 'success');
      setAssigningTeacherId('');
      setAssigningStudentId('');
      fetchBatches();
      fetchMembers();
    } catch {
      showBanner('Failed to assign member to batch.', 'error');
    } finally {
      setBatchActionLoadingMap(prev => ({ ...prev, [key]: false }));
    }
  }

  async function handleRemoveBatchMember(batchId: string, memberId: string, skipConfirm = false) {
    const performRemove = async () => {
      const key = `${memberId}-${batchId}`;
      setBatchActionLoadingMap(prev => ({ ...prev, [key]: true }));
      try {
        await api(`/centers/${centerId}/batches/${batchId}/members/${memberId}`, {
          method: 'DELETE',
        });
        showBanner('Member removed from classroom group.', 'success');
        fetchBatches();
        fetchMembers();
      } catch {
        showBanner('Failed to remove batch member.', 'error');
      } finally {
        setBatchActionLoadingMap(prev => ({ ...prev, [key]: false }));
      }
    };

    if (skipConfirm) {
      performRemove();
    } else {
      triggerConfirm(
        'Are you sure you want to remove this member from this classroom/group?',
        performRemove
      );
    }
  }

  async function handleCreateCourse(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(`/centers/${centerId}/courses`, {
        method: 'POST',
        body: JSON.stringify({ title: courseTitle, description: courseDesc }),
      });
      setCourseTitle('');
      setCourseDesc('');
      showBanner('Course added successfully!', 'success');
      fetchCourses();
    } catch {
      showBanner('Failed to create course.', 'error');
    }
  }

  async function handleCreateTest(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(`/centers/${centerId}/tests`, {
        method: 'POST',
        body: JSON.stringify({
          title: testTitle,
          description: testDesc,
          durationMinutes: Number(testDuration),
          totalMarks: Number(testMarks),
          passingMarks: Number(testPassing),
        }),
      });
      setTestTitle('');
      setTestDesc('');
      showBanner('MCQ Test created successfully!', 'success');
      fetchTests();
    } catch {
      showBanner('Failed to create test.', 'error');
    }
  }

  // Curriculum Builder Actions
  async function handleAddSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubTitle.trim() || !selectedManageCourse) return;
    try {
      await api(`/centers/${centerId}/courses/${selectedManageCourse.id}/subjects`, {
        method: 'POST',
        body: JSON.stringify({ title: newSubTitle }),
      });
      setNewSubTitle('');
      showBanner('Subject added!', 'success');
      fetchCourses();
    } catch {
      showBanner('Failed to add subject.', 'error');
    }
  }

  async function handleAddChapter(subjectId: string) {
    if (!newChapTitle.trim()) return;
    try {
      await api(`/centers/${centerId}/subjects/${subjectId}/chapters`, {
        method: 'POST',
        body: JSON.stringify({ title: newChapTitle }),
      });
      setNewChapTitle('');
      showBanner('Chapter added!', 'success');
      fetchCourses();
    } catch {
      showBanner('Failed to add chapter.', 'error');
    }
  }

  async function handleAddVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!newVidTitle.trim() || !newVidYtId.trim() || !activeChapterId) return;
    try {
      await api(`/centers/${centerId}/chapters/${activeChapterId}/videos`, {
        method: 'POST',
        body: JSON.stringify({
          title: newVidTitle,
          youtubeId: newVidYtId,
          duration: Number(newVidDuration),
        }),
      });
      setNewVidTitle('');
      setNewVidYtId('');
      setActiveChapterId('');
      showBanner('Video linked successfully!', 'success');
      fetchCourses();
    } catch {
      showBanner('Failed to add video.', 'error');
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteUrl.trim() || !activeChapterId) return;
    try {
      await api(`/centers/${centerId}/chapters/${activeChapterId}/notes`, {
        method: 'POST',
        body: JSON.stringify({
          title: newNoteTitle,
          fileUrl: newNoteUrl,
          fileName: newNoteTitle + '.pdf',
          contentType: 'PDF',
        }),
      });
      setNewNoteTitle('');
      setNewNoteUrl('');
      setActiveChapterId('');
      showBanner('PDF Note uploaded!', 'success');
      fetchCourses();
    } catch {
      showBanner('Failed to add note.', 'error');
    }
  }

  // Question Creator Actions
  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!newQText.trim() || !selectedManageTest) return;
    const opts = [
      { text: opt1, isCorrect: opt1Correct },
      { text: opt2, isCorrect: opt2Correct },
    ];
    if (opt3.trim()) opts.push({ text: opt3, isCorrect: opt3Correct });
    if (opt4.trim()) opts.push({ text: opt4, isCorrect: opt4Correct });

    try {
      await api(`/centers/${centerId}/tests/${selectedManageTest.id}/questions`, {
        method: 'POST',
        body: JSON.stringify({
          text: newQText,
          type: newQType,
          marks: Number(newQMarks),
          options: opts,
        }),
      });
      setNewQText('');
      setOpt1('');
      setOpt2('');
      setOpt3('');
      setOpt4('');
      setOpt1Correct(false);
      setOpt2Correct(false);
      setOpt3Correct(false);
      setOpt4Correct(false);
      showBanner('MCQ Question added!', 'success');
      fetchTests();
    } catch {
      showBanner('Failed to add question.', 'error');
    }
  }

  // YouTube Channel management (Link, Edit, Delete, Sync)
  async function handleLinkYoutubeChannel(e: React.FormEvent) {
    e.preventDefault();
    if (!ytChanId.trim() || !ytChanTitle.trim()) return;
    const isEditing = editingChannelId !== null;
    try {
      await api(`/centers/${centerId}/youtube/channels`, {
        method: 'POST',
        body: JSON.stringify({
          channelId: ytChanId,
          title: ytChanTitle,
          description: ytChanDesc,
          thumbnail: ytChanThumb,
          batchIds: ytSelectedBatchIds,
        }),
      });
      setYtChanId('');
      setYtChanTitle('');
      setYtChanDesc('');
      setYtChanThumb('');
      setYtSelectedBatchIds([]);
      setEditingChannelId(null);
      showBanner(isEditing ? 'YouTube channel updated!' : 'YouTube channel linked!', 'success');
      fetchYoutubeChannels();
    } catch (err: any) {
      console.error('Failed to save YouTube channel details:', err);
      showBanner(err?.message || 'Failed to save YouTube channel details.', 'error');
    }
  }

  async function handleDeleteYoutubeChannel(channelId: string) {
    triggerConfirm(
      'Are you sure you want to delete this YouTube channel link? Synced videos linked to chapters will remain, but the sync mapping will be lost.',
      async () => {
        try {
          await api(`/centers/${centerId}/youtube/channels/${channelId}`, {
            method: 'DELETE',
          });
          showBanner('YouTube channel link removed successfully.', 'success');
          fetchYoutubeChannels();
        } catch {
          showBanner('Failed to delete YouTube channel.', 'error');
        }
      }
    );
  }

  async function handleSyncYoutubeVideos(channelId: string, force = false) {
    // Clear any existing interval for this channel
    if (syncIntervalRefs.current[channelId]) {
      clearInterval(syncIntervalRefs.current[channelId]);
      delete syncIntervalRefs.current[channelId];
    }
    setSyncingMap((prev) => ({ ...prev, [channelId]: true }));
    setSyncProgressMap((prev) => ({ ...prev, [channelId]: null }));

    try {
      const url = `/centers/${centerId}/youtube/channels/${channelId}/sync${force ? '?force=true' : ''}`;
      const res = await api<any>(url, { method: 'POST' });

      if (!res?.started) {
        setSyncingMap((prev) => ({ ...prev, [channelId]: false }));
        showBanner(res?.message || 'Could not start sync.', 'error');
        return;
      }

      // Guard flag: ensures stopPolling fires exactly once per sync session
      let stopped = false;
      const stopPolling = (status: string) => {
        if (stopped) return;
        stopped = true;
        clearInterval(syncIntervalRefs.current[channelId]);
        delete syncIntervalRefs.current[channelId];
        setSyncingMap((prev) => ({ ...prev, [channelId]: false }));
        // Keep progress card visible for 4s then clear it
        setTimeout(() => {
          setSyncProgressMap((prev) => {
            const next = { ...prev };
            delete next[channelId];
            return next;
          });
        }, 4000);
      };

      // Start polling status every 1s
      const intervalId = setInterval(async () => {
        try {
          const progress = await api<any>(`/centers/${centerId}/youtube/channels/${channelId}/sync-status`);
          setSyncProgressMap((prev) => ({ ...prev, [channelId]: progress }));

          if (progress.status === 'completed') {
            stopPolling('completed');
            showBanner(`Successfully synced ${progress.syncedCount || progress.videosProcessed || 0} videos!`, 'success');
            fetchYoutubeChannels();
            fetchSyncedVideos();
          } else if (progress.status === 'failed') {
            stopPolling('failed');
            showBanner(progress.errorMessage || 'Sync failed.', 'error');
          } else if (progress.status === 'cancelled') {
            stopPolling('cancelled');
            showBanner('Sync was stopped.', 'error');
          }
          // NOTE: Do NOT stop on 'idle' — backend may still be writing the 'completed' status
        } catch {
          stopPolling('error');
        }
      }, 1000);

      syncIntervalRefs.current[channelId] = intervalId;

      // Safety: auto-stop polling after 5 minutes to prevent runaway API calls
      setTimeout(() => stopPolling('timeout'), 5 * 60 * 1000);
    } catch (err) {
      showBanner((err as { message?: string })?.message || 'Sync failed. Verify API Key configuration.', 'error');
      setSyncingMap((prev) => ({ ...prev, [channelId]: false }));
    }
  }

  async function handleCancelSync(channelId: string) {
    try {
      await api<any>(`/centers/${centerId}/youtube/channels/${channelId}/sync`, { method: 'DELETE' });
    } catch { /* ignore */ }
    // The polling loop will detect status === 'cancelled' and stop itself
  }

  function startEditYoutubeChannel(chan: any) {
    setEditingChannelId(chan.id);
    setYtChanId(chan.channelId);
    setYtChanTitle(chan.title);
    setYtChanDesc(chan.description || '');
    setYtChanThumb(chan.thumbnail || '');
    setYtSelectedBatchIds(chan.batchIds || []);
  }

  function cancelEditYoutubeChannel() {
    setEditingChannelId(null);
    setYtChanId('');
    setYtChanTitle('');
    setYtChanDesc('');
    setYtChanThumb('');
    setYtSelectedBatchIds([]);
  }

  // Join Code actions
  function handleRegenerateJoinCode() {
    triggerConfirm(
      'Are you sure you want to regenerate the join code? The existing code will stop working immediately.',
      async () => {
        try {
          const res = await api<any>(`/centers/${centerId}/join-code`, {
            method: 'PATCH',
            body: JSON.stringify({ code: '' }),
          });
          showBanner('Join code regenerated successfully!', 'success');
          setCenter((prev: any) => prev ? { ...prev, joinCode: res.joinCode } : null);
        } catch {
          showBanner('Failed to regenerate join code.', 'error');
        }
      }
    );
  }

  async function handleSetCustomJoinCode(e: React.FormEvent) {
    e.preventDefault();
    if (!customCode.trim()) return;
    try {
      const res = await api<any>(`/centers/${centerId}/join-code`, {
        method: 'PATCH',
        body: JSON.stringify({ code: customCode.trim() }),
      });
      showBanner('Custom join code set successfully!', 'success');
      setCenter((prev: any) => prev ? { ...prev, joinCode: res.joinCode } : null);
      setCustomCode('');
    } catch (err: any) {
      showBanner(err.message || 'Failed to set custom join code.', 'error');
    }
  }

  // Student Test Taking Handlers
  function startTest(test: any) {
    setActiveTest(test);
    setTestQuestions(test.questions || []);
    setStudentAnswers({});
    setTestResultSummary(null);
    setTimer(test.durationMinutes * 60);

    if (timerInterval) clearInterval(timerInterval);
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          submitTestDirectly(test.id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setTimerInterval(interval);
  }

  async function submitTestDirectly(testId: string) {
    clearInterval(timerInterval);
    try {
      const answersArray = Object.entries(studentAnswers).map(([qId, ansId]) => ({
        questionId: qId,
        selectedAnswerId: ansId,
      }));
      const result = await api<any>(`/centers/${centerId}/tests/${testId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers: answersArray }),
      });
      setTestResultSummary(result);
      showBanner('Test submitted successfully!', 'success');
      fetchTests();
    } catch {
      showBanner('Failed to submit test results.', 'error');
    }
  }

  // Track progress on Video Viewed
  async function markVideoCompleted(videoId: string) {
    try {
      await api(`/centers/${centerId}/progress/${videoId}`, {
        method: 'POST',
        body: JSON.stringify({ completed: true, watchTimeSec: 180, completionPct: 100 }),
      });
      showBanner('Lecture marked complete!', 'success');
    } catch { }
  }

  if (!center) return null;

  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'TEACHER', 'STAFF'].includes(role);
  const renderAsAdmin = isAdmin && !previewMode;

  return (
    <div className="flex flex-1 flex-col bg-gradient-to-br from-indigo-100 via-purple-100 to-fuchsia-100 min-h-screen relative">
      <Navbar variant="app" onLogout={() => router.push('/dashboard')} />

      <PageShell maxWidth="full">
        {/* Custom Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md scale-95 transform rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 transition-all">
              <div className="flex items-center gap-3 text-amber-600">
                <span className="text-2xl">⚠️</span>
                <h3 className="font-sans text-lg font-bold text-indigo-950">Confirm Action</h3>
              </div>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                {confirmMessage}
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    setConfirmCallback(null);
                  }}
                  className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (confirmCallback) confirmCallback();
                    setShowConfirmModal(false);
                    setConfirmCallback(null);
                  }}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white cursor-pointer transition"
                >
                  Yes, Proceed
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Media Library Modal */}
        {showLibraryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-2xl scale-95 transform rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 transition-all flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center pb-3 border-b">
                <h3 className="font-sans text-lg font-bold text-indigo-950 flex items-center gap-2">
                  <span>🖼️ Media Library</span>
                  <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {mediaLibrary.length} images
                  </span>
                </h3>
                <button
                  onClick={() => setShowLibraryModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer"
                >
                  &times;
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4">
                {mediaLibrary.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    No images uploaded yet. Upload a thumbnail first.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                    {mediaLibrary.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setYtChanThumb(item.fileUrl);
                          setShowLibraryModal(false);
                        }}
                        className={`group border rounded-xl overflow-hidden cursor-pointer hover:border-indigo-500 hover:shadow transition-all relative flex flex-col justify-between aspect-square bg-slate-50 ${
                          ytChanThumb === item.fileUrl ? 'ring-2 ring-indigo-600 border-indigo-600' : 'border-slate-200'
                        }`}
                      >
                        <img
                          src={item.fileUrl}
                          alt={item.fileName}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[10px] text-white truncate font-medium text-center">
                            {item.fileName}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t flex justify-end gap-3">
                <button
                  onClick={() => setShowLibraryModal(false)}
                  className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 cursor-pointer transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Banner Messages (Toast Pop-up) */}
        {bannerMsg && (
          <div className="fixed top-6 right-6 z-[9999] max-w-sm w-full bg-white/95 rounded-2xl shadow-2xl border border-slate-100 p-4.5 flex gap-3.5 items-start backdrop-blur-md transition-all duration-300 animate-slide-in">
            <div className={`h-9 w-9 rounded-full shrink-0 flex items-center justify-center ${
              bannerType === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
            }`}>
              {bannerType === 'success' ? (
                <span className="text-lg">✅</span>
              ) : (
                <span className="text-lg">❌</span>
              )}
            </div>
            <div className="flex-1 min-w-0 pr-2">
              <p className={`text-xs font-bold uppercase tracking-wider ${
                bannerType === 'success' ? 'text-emerald-800' : 'text-red-800'
              }`}>
                {bannerType === 'success' ? 'Success' : 'Error'}
              </p>
              <p className="text-sm font-semibold text-slate-600 mt-1 leading-snug">
                {bannerMsg}
              </p>
            </div>
            <button
              onClick={() => { setBannerMsg(''); setBannerType(''); }}
              className="text-slate-400 hover:text-slate-600 cursor-pointer shrink-0 text-sm font-bold ml-1.5 p-1 rounded-lg hover:bg-slate-100/80 transition"
            >
              ✕
            </button>
          </div>
        )}

        {/* Floating Decorative blobs for Student View */}
        {!renderAsAdmin && (
          <>
            <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-indigo-300/30 blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-fuchsia-300/30 blur-[120px] pointer-events-none"></div>
            <div className="absolute top-1/2 left-1/3 w-80 h-80 rounded-full bg-violet-300/20 blur-[110px] pointer-events-none"></div>
          </>
        )}
        {/* Student Welcome Hero Banner */}
        {!renderAsAdmin && (
          <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 rounded-3xl p-6 lg:p-8 text-white shadow-xl mb-8 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-1/3 -mb-12 w-48 h-48 rounded-full bg-fuchsia-500/10 blur-xl pointer-events-none"></div>
            <div>
              <span className="text-[10px] bg-white/20 text-white font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider">Student Dashboard</span>
              <h1 className="font-sans text-3xl lg:text-4xl font-black mt-2 tracking-tight">Learn, Grow &amp; Achieve!</h1>
              <p className="text-sm font-semibold text-white/80 mt-1 max-w-xl">Welcome back to {center.name}. Select a course below to jump back into learning or attempt a quiz to challenge your skills.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto shrink-0 relative z-10">
              <div className="flex items-center gap-3 bg-white/10 p-3.5 rounded-2xl border border-white/10 backdrop-blur-md">
                <span className="text-3xl">🎒</span>
                <div>
                  <p className="text-[10px] font-black text-white/60 uppercase">Enrolled In</p>
                  <p className="text-sm font-black truncate max-w-[150px]">{center.name}</p>
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={() => {
                    setPreviewMode(false);
                    setSelectedCourse(null);
                    setActiveVideo(null);
                    setActiveTest(null);
                  }}
                  className="rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-wider bg-white text-indigo-950 hover:bg-slate-100 transition shadow-md border-0 active:scale-95 cursor-pointer text-center"
                >
                  ⚙️ Admin Console
                </button>
              )}
            </div>
          </div>
        )}

        {/* Header bar (Compact for Students, Standard for Admins) */}
        <div className={`mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-indigo-900/10 pb-5 pt-2 ${!renderAsAdmin ? 'hidden md:flex' : ''}`}>
          <div>
            <Link href="/dashboard" className="text-xs font-black text-violet-600 uppercase tracking-widest hover:underline flex items-center gap-1">
              ← Main Dashboard
            </Link>
            <h1 className="font-sans text-3xl font-black tracking-tight text-indigo-950 mt-1.5 drop-shadow-sm">{center.name}</h1>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-xs font-bold text-indigo-900/60 capitalize">Role: <span className="font-black text-indigo-900">{role.toLowerCase()}</span></p>
              {isAdmin && (
                <span className="text-indigo-900/20">|</span>
              )}
              {isAdmin && (
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-sm ${
                  previewMode ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-violet-50 text-violet-700 border-violet-200'
                }`}>
                  {previewMode ? 'Student View Preview' : 'Management Mode'}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && renderAsAdmin && (
              <button
                onClick={() => {
                  setPreviewMode(!previewMode);
                  setSelectedCourse(null);
                  setActiveVideo(null);
                  setActiveTest(null);
                }}
                className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition shadow-md border border-white cursor-pointer active:scale-95 bg-white/80 backdrop-blur-md text-indigo-950 hover:bg-white/90"
              >
                👁️ Switch to Student View
              </button>
            )}
            {isAdmin && (
              <div className="bg-emerald-55 border border-emerald-200 text-emerald-700 text-xs font-black px-3 py-2 rounded-xl uppercase tracking-wider shadow-sm">
                Subscription: {center.subscriptionStatus}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic layout for Admin Panel vs. Student Portal */}
        {renderAsAdmin ? (
          <div className="flex flex-col md:flex-row gap-6 lg:gap-8 items-start">
            {/* Left Sidebar Navigation */}
            <div className="w-full md:w-64 lg:w-72 shrink-0 bg-white/70 backdrop-blur-xl rounded-3xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-3 lg:p-4 space-y-1.5 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 rounded-full bg-gradient-to-br from-indigo-300/40 to-purple-300/40 blur-3xl pointer-events-none"></div>
              <p className="text-[10px] font-black text-indigo-950/40 uppercase tracking-widest px-3 mb-3 mt-1">Navigation</p>
              {[
                { id: 'overview', label: 'Overview', icon: '📊' },
                { id: 'members', label: 'Students & Faculty', icon: '👥' },
                { id: 'pending', label: 'Pending Approvals', count: pendingMembers.length, icon: '🔑' },
                { id: 'batches', label: 'Batches / Standards', icon: '🏫' },
                { id: 'youtube', label: 'YouTube channels', icon: '🎥' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setActiveTab(t.id);
                    setSelectedManageCourse(null);
                    setSelectedManageBatch(null);
                    setSelectedManageTest(null);
                    cancelEditYoutubeChannel();
                  }}
                  className={`w-full flex items-center justify-start gap-3 px-4 py-3.5 rounded-2xl text-sm font-black transition-all duration-300 cursor-pointer border border-transparent ${
                    activeTab === t.id
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 border-indigo-400/20'
                      : 'text-slate-600 hover:text-indigo-950 hover:bg-white/80 hover:shadow-sm hover:border-white'
                  }`}
                >
                  <span className={`text-xl shrink-0 transition-transform duration-300 ${activeTab === t.id ? 'scale-110 drop-shadow-md' : 'grayscale-[50%]'}`}>{t.icon}</span>
                  <span className="text-left leading-tight whitespace-normal">{t.label}</span>
                  {t.count !== undefined && t.count > 0 && (
                    <span className={`ml-auto text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-sm ${activeTab === t.id ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'}`}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Right Side: Tab Contents */}
            <div className="flex-1 min-w-0 w-full">
              {tabLoading ? (
                <div className="flex flex-col items-center justify-center py-28 bg-white/40 backdrop-blur-md rounded-3xl border border-white/60 shadow-sm space-y-4 animate-in fade-in duration-300">
                  <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-650 rounded-full animate-spin"></div>
                  <p className="text-xs font-black text-indigo-950/50 uppercase tracking-widest">Loading Center Records...</p>
                </div>
              ) : (
                <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500">
                  {/* Tab: Overview */}
                  {activeTab === 'overview' && (
              <div className="space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid gap-4 sm:grid-cols-2 lg:gap-6">
                  <div className="rounded-3xl border border-white bg-gradient-to-br from-indigo-50/80 to-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                    <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 text-8xl pointer-events-none">👥</div>
                    <div className="relative z-10">
                      <p className="text-5xl font-black text-indigo-950 mb-2 drop-shadow-sm">{center._count.memberships}</p>
                      <p className="text-xs font-extrabold text-indigo-900/50 uppercase tracking-widest">Total Members</p>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-white bg-gradient-to-br from-purple-50/80 to-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                    <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] transform group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 text-8xl pointer-events-none">🏫</div>
                    <div className="relative z-10">
                      <p className="text-5xl font-black text-purple-950 mb-2 drop-shadow-sm">{center._count.batches}</p>
                      <p className="text-xs font-extrabold text-purple-900/50 uppercase tracking-widest">Academic Batches</p>
                    </div>
                  </div>
                </div>

                {/* Join Code Card */}
                <div className="rounded-3xl border border-white bg-white/70 backdrop-blur-xl p-6 lg:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.06)] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-indigo-100/50 to-transparent rounded-bl-full pointer-events-none"></div>
                  
                  <div className="relative z-10">
                    <h3 className="font-sans text-xl font-black text-indigo-950 mb-2 flex flex-wrap items-center gap-3">
                      <span className="text-2xl">🔑</span>
                      <span>Center Join Code</span>
                      <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-sm">Student Signups</span>
                    </h3>
                    <p className="text-sm font-medium text-slate-500 mb-6 max-w-2xl leading-relaxed">
                      Share this unique code with your students. When they enter it in their dashboard, they will automatically request approval to join this center.
                    </p>

                    <div className="flex flex-wrap items-center gap-4 bg-slate-50/50 p-2 rounded-2xl border border-slate-100 inline-flex">
                      <div className="bg-white border border-slate-200 shadow-sm rounded-xl px-5 py-2.5 font-mono font-extrabold text-2xl text-indigo-950 tracking-widest select-all">
                        {center.joinCode || 'NO CODE SET'}
                      </div>

                      <button
                        onClick={handleRegenerateJoinCode}
                        className="btn-outline text-xs px-4 py-2.5 bg-white shadow-sm hover:shadow-md transition-shadow rounded-xl font-bold flex items-center gap-2"
                      >
                        <span className="text-base">🔄</span> Regenerate
                      </button>

                      <div className="w-px h-8 bg-slate-200 mx-2 hidden sm:block"></div>

                      <form onSubmit={handleSetCustomJoinCode} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Custom Code"
                          value={customCode}
                          onChange={(e) => setCustomCode(e.target.value)}
                          className="input-devotional text-sm py-2.5 w-40 uppercase font-bold bg-white shadow-sm rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                        />
                        <button type="submit" className="btn-primary text-xs py-2.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all font-bold">
                          Save
                        </button>
                      </form>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-white bg-white/70 backdrop-blur-xl p-6 lg:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.06)] relative overflow-hidden">
                  <h3 className="font-sans text-xl font-black text-indigo-950 mb-2">College Console Settings</h3>
                  <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-3xl">
                    Welcome to the central academic panel for <strong className="text-indigo-900">{center.name}</strong>. Use the navigation tabs on the left to manage center registrations, schedule online test modules, add study materials, and audit student engagement indexes.
                  </p>
                </div>
              </div>
            )}

            {/* Tab: Members */}
            {activeTab === 'members' && (
              <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 space-y-4">
                  <h3 className="font-sans text-lg font-black text-indigo-950">Active Registrations</h3>
                  
                  {/* Filters Bar */}
                  <div className="bg-gradient-to-br from-emerald-50/60 to-teal-50/40 backdrop-blur-xl p-4 rounded-3xl border border-white/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex flex-wrap gap-3 items-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-100/30 to-transparent rounded-bl-full pointer-events-none"></div>
                    <div className="relative z-10 flex-1 min-w-[200px] flex items-center bg-white rounded-2xl shadow-sm border border-emerald-100/50 px-3 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-200 focus-within:border-emerald-300 transition-all">
                      <span className="text-emerald-600/50 font-bold px-1">🔍</span>
                      <input
                        type="text"
                        placeholder="Search name or email..."
                        value={memberSearchQuery}
                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                        className="bg-transparent text-sm py-2.5 px-2 flex-1 text-emerald-950 font-bold focus:outline-none w-full"
                      />
                    </div>
                    
                    <select
                      value={memberRoleFilter}
                      onChange={(e) => setMemberRoleFilter(e.target.value)}
                      className="bg-white border border-emerald-100/50 rounded-2xl text-xs py-3 px-4 text-emerald-950 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-300 cursor-pointer shadow-sm relative z-10 appearance-none"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23059669'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundPosition: `right 0.75rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1em 1em`, paddingRight: `2.5rem` }}
                    >
                      <option value="">All Roles</option>
                      <option value="STUDENT">Student</option>
                      <option value="TEACHER">Teacher</option>
                      <option value="STAFF">Staff</option>
                      <option value="ADMIN">Admin</option>
                    </select>

                    <select
                      value={memberBatchFilter}
                      onChange={(e) => setMemberBatchFilter(e.target.value)}
                      className="bg-white border border-emerald-100/50 rounded-2xl text-xs py-3 px-4 text-emerald-950 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-300 cursor-pointer shadow-sm relative z-10 appearance-none"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23059669'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundPosition: `right 0.75rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1em 1em`, paddingRight: `2.5rem` }}
                    >
                      <option value="">All Groups</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] divide-y divide-emerald-900/5 mt-6">
                    {(() => {
                      const filteredMembers = members
                        .filter(m => m.isApproved !== false)
                        .filter(m => {
                          const fullName = `${m.user.firstName} ${m.user.lastName}`.toLowerCase();
                          const matchesSearch = fullName.includes(memberSearchQuery.toLowerCase()) ||
                            m.user.email.toLowerCase().includes(memberSearchQuery.toLowerCase());
                          
                          const matchesRole = !memberRoleFilter || m.role === memberRoleFilter;
                          
                          const matchesBatch = !memberBatchFilter ||
                            (m.batchMemberships && m.batchMemberships.some((bm: any) => bm.batchId === memberBatchFilter));

                          return matchesSearch && matchesRole && matchesBatch;
                        });

                      if (filteredMembers.length === 0) {
                        return <div className="p-10 text-center text-emerald-950/40 font-semibold italic text-sm">No active registrations found matching filters.</div>;
                      }

                      return filteredMembers.map((m) => (
                        <div key={m.id} className="flex flex-wrap justify-between items-center p-5 gap-4 hover:bg-emerald-50/20 transition-colors">
                          <div className="min-w-0 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-emerald-700 font-black text-lg border border-emerald-200/50 shadow-inner shrink-0">
                              {m.user.firstName[0]}{m.user.lastName[0]}
                            </div>
                            <div>
                              <p className="font-extrabold text-emerald-950 text-base leading-tight">{m.user.firstName} {m.user.lastName}</p>
                              <p className="text-xs text-emerald-950/50 font-bold mt-0.5">{m.user.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 relative">
                            {/* Role Select */}
                            <select
                              value={m.role}
                              onChange={(e) => handleUpdateMemberRole(m.id, e.target.value)}
                              disabled={role !== 'ADMIN' && role !== 'SUPER_ADMIN'}
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-black uppercase shadow-sm border focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer ${
                                m.role === 'ADMIN' 
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-150' 
                                  : m.role === 'TEACHER' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-150' 
                                    : m.role === 'STAFF'
                                      ? 'bg-purple-50 text-purple-700 border-purple-150'
                                      : 'bg-slate-50 text-slate-700 border-slate-150'
                              }`}
                            >
                              <option value="STUDENT">Student</option>
                              <option value="TEACHER">Teacher</option>
                              <option value="STAFF">Staff</option>
                              <option value="ADMIN">Admin</option>
                            </select>

                            {/* Batches Dropdown with Checkboxes (tick boxes) for Teacher and Student */}
                            {(m.role === 'TEACHER' || m.role === 'STUDENT') && (role === 'ADMIN' || role === 'SUPER_ADMIN') && (
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setOpenBatchSelectUserId(openBatchSelectUserId === m.id ? null : m.id)}
                                  className="bg-white border border-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl uppercase tracking-wider shadow-sm flex items-center gap-1.5 hover:bg-slate-50 transition-all cursor-pointer"
                                >
                                  <span>🎒 Batches ({m.batchMemberships?.length || 0})</span>
                                  <span className="text-[10px] text-slate-400 transition-transform duration-200" style={{ transform: openBatchSelectUserId === m.id ? 'rotate(180deg)' : 'none' }}>▼</span>
                                </button>
                                {openBatchSelectUserId === m.id && (
                                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-150 rounded-2xl shadow-xl z-50 p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 pb-1 border-b border-slate-100 flex justify-between items-center">
                                      <span>Assign Batches</span>
                                      <button 
                                        type="button" 
                                        onClick={() => setOpenBatchSelectUserId(null)}
                                        className="text-slate-400 hover:text-slate-650 font-extrabold text-xs"
                                      >
                                        ×
                                      </button>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto space-y-1.5 py-1">
                                      {batches.map((b) => {
                                        const isAssigned = m.batchMemberships?.some((bm: any) => bm.batchId === b.id);
                                        const isLoading = batchActionLoadingMap[`${m.id}-${b.id}`];
                                        return (
                                          <label 
                                            key={b.id} 
                                            className={`flex items-center gap-2.5 px-2 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-xs font-bold text-slate-700 select-none transition-all ${
                                              isLoading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isAssigned}
                                              disabled={isLoading}
                                              onChange={() => {
                                                if (isAssigned) {
                                                  handleRemoveBatchMember(b.id, m.id, true);
                                                } else {
                                                  handleAssignBatchMember(b.id, m.id);
                                                }
                                              }}
                                              className="w-4.5 h-4.5 rounded text-indigo-650 border-slate-350 focus:ring-indigo-500 cursor-pointer"
                                            />
                                            <span className="truncate flex items-center gap-1.5">
                                              {b.name}
                                              {isLoading && (
                                                <span className="w-3 h-3 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin inline-block"></span>
                                              )}
                                            </span>
                                          </label>
                                        );
                                      })}
                                      {batches.length === 0 && (
                                        <div className="text-center text-[10px] text-slate-400 py-3 italic font-semibold">No batches found.</div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                <div>
                  <Card className="p-5">
                    <h3 className="font-sans text-base font-bold text-indigo-950 mb-4">Enroll New Member</h3>
                    <form onSubmit={handleInviteMember} className="space-y-4">
                      <FormField label="Email address" required>
                        <input
                          type="email"
                          required
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className="input-devotional"
                          placeholder="e.g., student@college.edu"
                        />
                      </FormField>
                      <FormField label="Role Assign" required>
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          className="input-devotional font-semibold"
                        >
                          <option value="STUDENT">Student</option>
                          <option value="TEACHER">Teacher</option>
                          <option value="STAFF">Staff / Coordinator</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </FormField>
                      <button type="submit" className="btn-primary w-full mt-2">
                        Add Member
                      </button>
                    </form>
                  </Card>
                </div>
              </div>
            )}

            {/* Tab: Pending Approvals */}
            {activeTab === 'pending' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col mb-2">
                  <h3 className="font-sans text-xl font-black text-amber-950 flex items-center gap-2">
                    <span className="text-2xl drop-shadow-sm">⏳</span> Pending Registrations
                  </h3>
                  <p className="text-xs font-bold text-amber-950/60 mt-1 max-w-2xl leading-relaxed">Students who joined using the Center Join Code and requested a Class Standard allocation. Action required.</p>
                </div>
                
                <div className="bg-gradient-to-br from-amber-50/70 to-orange-50/40 backdrop-blur-xl rounded-3xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.03)] divide-y divide-amber-900/10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-amber-100/40 to-transparent rounded-bl-full pointer-events-none"></div>
                  
                  {pendingMembers.length === 0 ? (
                    <div className="p-10 text-center text-amber-950/40 font-semibold italic text-sm relative z-10">No pending student approval requests.</div>
                  ) : (
                    pendingMembers.map((pm) => (
                      <div key={pm.id} className="flex flex-wrap justify-between items-center p-6 gap-6 hover:bg-amber-100/20 transition-colors relative z-10">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-amber-700 font-black text-xl border border-amber-200/50 shadow-inner shrink-0 transform -rotate-3">
                            {pm.user.firstName[0]}{pm.user.lastName[0]}
                          </div>
                          <div>
                            <p className="font-extrabold text-amber-950 text-base">{pm.user.firstName} {pm.user.lastName}</p>
                            <p className="text-xs text-amber-950/60 font-bold mt-0.5">{pm.user.email}</p>
                            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] uppercase font-black text-amber-950/40 tracking-wider">Requested:</span>
                              {pm.batchMemberships?.map((bm: any) => (
                                <span key={bm.batchId} className="bg-white text-amber-700 border border-amber-200/50 text-xs font-black px-2.5 py-1 rounded-lg shadow-sm">
                                  {bm.batch.name}
                                </span>
                              )) || <span className="text-xs text-red-500 font-black">None Selected</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleApproveMember(pm.id)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <span>✓</span> Approve
                          </button>
                          <button
                            onClick={() => handleRejectMember(pm.id)}
                            className="bg-white hover:bg-red-50 border border-red-100 text-red-600 text-xs font-black px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab: Batches / Standards */}
            {activeTab === 'batches' && (
              <div className={selectedManageBatch ? "w-full animate-in fade-in slide-in-from-bottom-4 duration-500" : "grid gap-6 md:grid-cols-3 animate-in fade-in slide-in-from-bottom-4 duration-500"}>
                <div className={selectedManageBatch ? "w-full space-y-6" : "md:col-span-2 space-y-6"}>
                  {selectedManageBatch ? (
                    <div className="bg-gradient-to-br from-white to-fuchsia-50/20 backdrop-blur-xl rounded-3xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 lg:p-8 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-fuchsia-100/30 to-transparent rounded-bl-full pointer-events-none"></div>
                      
                      <button 
                        onClick={() => { setSelectedManageBatch(null); setBatchStudentSearchQuery(''); }} 
                        className="text-xs font-black text-fuchsia-600 hover:text-fuchsia-800 transition-colors mb-6 uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                      >
                        ← Back to Classrooms
                      </button>
                      
                      {isEditingBatchInfo ? (
                        <form onSubmit={handleUpdateBatchInfo} className="mb-8 pb-6 border-b border-fuchsia-100/50 space-y-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <FormField label="Classroom Standard Name" required>
                              <input
                                type="text"
                                required
                                value={editBatchName}
                                onChange={(e) => setEditBatchName(e.target.value)}
                                className="input-devotional text-sm py-2.5 bg-white shadow-sm border-slate-200 focus:border-fuchsia-500 focus:ring-fuchsia-200"
                              />
                            </FormField>
                            <FormField label="Description">
                              <input
                                type="text"
                                value={editBatchDesc}
                                onChange={(e) => setEditBatchDesc(e.target.value)}
                                className="input-devotional text-sm py-2.5 bg-white shadow-sm border-slate-200 focus:border-fuchsia-500 focus:ring-fuchsia-200"
                              />
                            </FormField>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
                            >
                              Save Details
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsEditingBatchInfo(false)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-wrap justify-between items-center gap-4 mb-8 pb-6 border-b border-fuchsia-100/50">
                          <div>
                            <span className="text-[10px] bg-fuchsia-100 text-fuchsia-700 font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-sm">Classroom Standard</span>
                            <h3 className="font-sans text-3xl font-black text-indigo-950 flex items-center gap-2 mt-2">
                              <span>🏫</span> {selectedManageBatch.name}
                            </h3>
                            <p className="text-sm font-semibold text-slate-500 mt-2 max-w-2xl leading-relaxed">
                              {selectedManageBatch.description || 'No description provided.'}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditBatchName(selectedManageBatch.name);
                                setEditBatchDesc(selectedManageBatch.description || '');
                                setIsEditingBatchInfo(true);
                              }}
                              className="bg-white border border-fuchsia-200 hover:bg-fuchsia-50 text-fuchsia-650 text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer shadow-sm flex items-center gap-1.5"
                            >
                              ✏️ Edit Details
                            </button>
                            <button
                              onClick={() => handleDeleteBatch(selectedManageBatch.id)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer border border-rose-100 shadow-sm flex items-center gap-1.5"
                            >
                              🗑️ Delete Classroom
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Management & Instructors Panel */}
                      <div className="grid gap-6 md:grid-cols-3 mb-8">
                        {/* Teachers / Instructors (Col span 2) */}
                        <div className="md:col-span-2 rounded-3xl border border-emerald-100/60 bg-gradient-to-br from-emerald-50/40 to-white p-6 shadow-[0_4px_20px_rgb(0,0,0,0.02)] relative overflow-hidden">
                          <h4 className="font-black text-emerald-950 text-base mb-4 flex items-center gap-2">
                            <span>🎓</span> Instructors / Teachers Assigned
                          </h4>
                          
                          <div className="grid gap-3 sm:grid-cols-2">
                            {selectedManageBatch.memberships?.filter((m: any) => m.membership?.role === 'TEACHER').length === 0 ? (
                              <p className="text-xs font-semibold text-slate-400 py-3 italic col-span-2">No teachers assigned to this classroom yet.</p>
                            ) : (
                              selectedManageBatch.memberships?.filter((m: any) => m.membership?.role === 'TEACHER').map((bm: any) => (
                                <div key={bm.id} className="flex justify-between items-center bg-white border border-emerald-100/50 p-3.5 rounded-2xl shadow-sm hover:shadow transition-shadow">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
                                      {bm.membership.user.firstName[0]}
                                    </div>
                                    <div>
                                      <p className="font-extrabold text-emerald-950 text-xs">{bm.membership.user.firstName} {bm.membership.user.lastName}</p>
                                      <p className="text-[10px] text-emerald-900/50 font-bold">{bm.membership.user.email}</p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleRemoveBatchMember(selectedManageBatch.id, bm.membershipId)}
                                    className="text-rose-500 hover:text-rose-700 text-xs font-extrabold cursor-pointer hover:underline"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Add Teacher to Batch */}
                        <div className="rounded-3xl border border-emerald-100/60 bg-white p-6 shadow-[0_4px_20px_rgb(0,0,0,0.02)] flex flex-col justify-between">
                          <div>
                            <h4 className="font-black text-emerald-950 text-base mb-2">Assign Instructor</h4>
                            <p className="text-xs text-slate-400 font-semibold mb-4">Choose an instructor to assign to this classroom standard.</p>
                          </div>
                          <div className="space-y-3">
                            <select
                              value={assigningTeacherId}
                              onChange={(e) => setAssigningTeacherId(e.target.value)}
                              className="w-full text-xs py-2.5 px-3 bg-white font-bold rounded-xl border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-350 cursor-pointer shadow-sm"
                            >
                              <option value="">-- Choose Teacher --</option>
                              {members
                                .filter((m) => m.role === 'TEACHER' && !selectedManageBatch.memberships?.some((bm: any) => bm.membershipId === m.id))
                                .map((t) => (
                                  <option key={t.id} value={t.id}>{t.user.firstName} {t.user.lastName}</option>
                                ))}
                            </select>
                            <button
                              onClick={() => handleAssignBatchMember(selectedManageBatch.id, assigningTeacherId)}
                              className="btn-primary w-full text-xs py-2.5 font-bold bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/10 rounded-xl border-0"
                            >
                              Assign Teacher
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Enrolled Students Table View */}
                      <div className="bg-gradient-to-br from-fuchsia-50/50 to-indigo-50/30 border border-fuchsia-100/50 rounded-3xl p-6 shadow-[0_4px_25px_rgb(0,0,0,0.02)]">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                          <div>
                            <h4 className="font-black text-indigo-950 text-lg flex items-center gap-2">
                              <span>🎒</span> Enrolled Students
                              <span className="bg-fuchsia-100 text-fuchsia-700 text-xs px-2.5 py-0.5 rounded-full font-black">
                                {selectedManageBatch.memberships?.filter((m: any) => m.membership?.role === 'STUDENT').length || 0}
                              </span>
                            </h4>
                            <p className="text-xs text-slate-400 font-semibold mt-1">Manage and view all students currently allocated to this classroom standard.</p>
                          </div>

                          {/* Quick Actions & Search */}
                          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                            <div className="relative z-10 flex-1 sm:flex-initial min-w-[200px] flex items-center bg-white rounded-2xl shadow-sm border border-fuchsia-100/60 px-3 overflow-hidden focus-within:ring-2 focus-within:ring-fuchsia-200 transition-all">
                              <span className="text-fuchsia-600/50 font-bold px-1 text-xs">🔍</span>
                              <input
                                type="text"
                                placeholder="Search enrolled students..."
                                value={batchStudentSearchQuery}
                                onChange={(e) => setBatchStudentSearchQuery(e.target.value)}
                                className="bg-transparent text-xs py-2 px-1.5 flex-1 text-indigo-950 font-bold focus:outline-none w-full"
                              />
                            </div>

                            <div className="flex gap-2 w-full sm:w-auto">
                              <select
                                value={assigningStudentId}
                                onChange={(e) => setAssigningStudentId(e.target.value)}
                                className="bg-white border border-fuchsia-200 rounded-2xl text-xs py-2 px-3.5 text-indigo-950 font-bold focus:outline-none focus:ring-2 focus:ring-fuchsia-200 cursor-pointer shadow-sm max-w-[200px]"
                              >
                                <option value="">-- Choose Student --</option>
                                {members
                                  .filter((m) => m.role === 'STUDENT' && !selectedManageBatch.memberships?.some((bm: any) => bm.membershipId === m.id))
                                  .map((s) => (
                                    <option key={s.id} value={s.id}>{s.user.firstName} {s.user.lastName}</option>
                                  ))}
                              </select>
                              <button
                                onClick={() => handleAssignBatchMember(selectedManageBatch.id, assigningStudentId)}
                                className="btn-primary text-xs py-2 px-4 font-bold shadow-md rounded-2xl bg-fuchsia-600 hover:bg-fuchsia-700 border-0"
                              >
                                Enroll Student
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Students Table */}
                        <div className="bg-white rounded-2xl border border-fuchsia-100/40 overflow-hidden shadow-sm">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-fuchsia-50/40 border-b border-fuchsia-100/30">
                                <tr>
                                  <th className="px-6 py-4.5 font-black text-indigo-950 uppercase tracking-wider text-[10px]">Student Name</th>
                                  <th className="px-6 py-4.5 font-black text-indigo-950 uppercase tracking-wider text-[10px]">Email Address</th>
                                  <th className="px-6 py-4.5 font-black text-indigo-950 uppercase tracking-wider text-[10px] text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-fuchsia-100/20">
                                {(() => {
                                  const filteredStudents = selectedManageBatch.memberships?.filter((m: any) => {
                                    const isStudent = m.membership?.role === 'STUDENT';
                                    if (!isStudent) return false;
                                    const fullName = `${m.membership.user.firstName} ${m.membership.user.lastName}`.toLowerCase();
                                    return fullName.includes(batchStudentSearchQuery.toLowerCase()) || 
                                      m.membership.user.email.toLowerCase().includes(batchStudentSearchQuery.toLowerCase());
                                  });

                                  if (!filteredStudents || filteredStudents.length === 0) {
                                    return (
                                      <tr>
                                        <td colSpan={3} className="px-6 py-12 text-center text-slate-400 font-semibold italic text-sm">
                                          {batchStudentSearchQuery ? 'No enrolled students match your search.' : 'No students enrolled in this classroom standard.'}
                                        </td>
                                      </tr>
                                    );
                                  }

                                  return filteredStudents.map((bm: any) => (
                                    <tr key={bm.id} className="hover:bg-fuchsia-50/10 transition-colors">
                                      <td className="px-6 py-3.5">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-black text-xs border border-indigo-200/50">
                                            {bm.membership.user.firstName[0]}
                                          </div>
                                          <div className="font-extrabold text-indigo-950">
                                            {bm.membership.user.firstName} {bm.membership.user.lastName}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-6 py-3.5 font-semibold text-slate-500">
                                        {bm.membership.user.email}
                                      </td>
                                      <td className="px-6 py-3.5 text-right">
                                        <button
                                          onClick={() => handleRemoveBatchMember(selectedManageBatch.id, bm.membershipId)}
                                          className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-black px-3.5 py-1.5 rounded-xl border border-rose-100 transition shadow-sm inline-flex items-center gap-1 cursor-pointer"
                                        >
                                          Remove Enrollment
                                        </button>
                                      </td>
                                    </tr>
                                  ));
                                })()}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <h3 className="font-sans text-lg font-black text-indigo-950">Active Classrooms & Groups</h3>
                      <div className="grid gap-4 sm:grid-cols-2 lg:gap-6">
                        {batches.length === 0 ? (
                          <div className="col-span-2 bg-white/70 backdrop-blur-md rounded-3xl border border-white/60 p-8 text-center text-indigo-950/40 font-semibold italic text-sm">No classroom groups created yet.</div>
                        ) : (
                          batches.map((b) => (
                            <div
                              key={b.id}
                              className="rounded-3xl border border-white bg-gradient-to-br from-fuchsia-50/60 to-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-xl hover:border-fuchsia-200 cursor-pointer transition-all duration-300 group relative overflow-hidden"
                              onClick={() => setSelectedManageBatch(b)}
                            >
                              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-fuchsia-100/30 to-transparent rounded-bl-full pointer-events-none"></div>
                              <div className="flex justify-between items-start z-10 relative">
                                <h4 className="font-black text-indigo-950 text-base group-hover:text-fuchsia-700 transition-colors">{b.name}</h4>
                                <span className="text-[10px] bg-fuchsia-100 text-fuchsia-700 font-extrabold px-2.5 py-0.5 rounded-lg uppercase tracking-wider shadow-sm">Manage</span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1.5 font-medium line-clamp-2 leading-relaxed z-10 relative">
                                {b.description || 'No description provided.'}
                              </p>
                              <div className="mt-5 pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400 font-bold z-10 relative">
                                <span className="flex items-center gap-1"><span className="text-indigo-500">🎒</span> {b.memberships?.filter((m: any) => m.membership?.role === 'STUDENT').length || 0} Students</span>
                                <span className="flex items-center gap-1"><span className="text-emerald-500">🎓</span> {b.memberships?.filter((m: any) => m.membership?.role === 'TEACHER').length || 0} Teachers</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {!selectedManageBatch && (
                  <div>
                    <div className="rounded-3xl border border-white bg-gradient-to-br from-rose-50/50 to-white backdrop-blur-xl p-5 lg:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.05)] relative overflow-hidden">
                      <div className="absolute top-0 right-0 -mr-12 -mt-12 w-24 h-24 rounded-full bg-gradient-to-br from-rose-200/50 to-orange-200/50 blur-xl pointer-events-none"></div>
                      <h3 className="font-sans text-base font-black text-indigo-950 mb-4 flex items-center gap-2">
                        <span>🆕</span> Create Classroom / Group
                      </h3>
                      <form onSubmit={handleCreateBatch} className="space-y-4 relative z-10">
                        <FormField label="Standard / Group Name" required>
                          <input
                            type="text"
                            required
                            value={batchName}
                            onChange={(e) => setBatchName(e.target.value)}
                            className="input-devotional text-sm py-2.5 bg-white shadow-sm border-slate-200 focus:border-rose-500 focus:ring-rose-200"
                            placeholder="e.g., Standard 10-A"
                          />
                        </FormField>
                        <FormField label="Description">
                          <textarea
                            value={batchDesc}
                            onChange={(e) => setBatchDesc(e.target.value)}
                            className="input-devotional h-20 resize-none text-sm py-2.5 bg-white shadow-sm border-slate-200 focus:border-rose-500 focus:ring-rose-200"
                            placeholder="Classroom group summary..."
                          ></textarea>
                        </FormField>
                        <button 
                          type="submit" 
                          disabled={creatingBatch} 
                          className="btn-primary w-full py-2.5 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white shadow-md hover:shadow-lg transition-all rounded-xl font-bold border-0"
                        >
                          {creatingBatch ? 'Creating Group...' : 'Create Group'}
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Courses */}
            {activeTab === 'courses' && (
              <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 space-y-4">
                  {selectedManageCourse ? (
                    <div>
                      <button onClick={() => setSelectedManageCourse(null)} className="text-xs font-bold text-indigo-600 hover:underline mb-4 uppercase">
                        ← Back to course list
                      </button>
                      <h3 className="font-sans text-xl font-bold text-indigo-950">{selectedManageCourse.title} Curriculum</h3>

                      {/* Course builder form */}
                      <Card className="mt-6 p-4">
                        <form onSubmit={handleAddSubject} className="flex gap-2 items-end">
                          <div className="flex-1">
                            <FormField label="Add New Subject" required>
                              <input
                                type="text"
                                required
                                value={newSubTitle}
                                onChange={(e) => setNewSubTitle(e.target.value)}
                                className="input-devotional"
                                placeholder="e.g. Mathematics II"
                              />
                            </FormField>
                          </div>
                          <button type="submit" className="btn-primary py-2.5">Add Subject</button>
                        </form>
                      </Card>

                      <div className="space-y-4 mt-6">
                        {selectedManageCourse.subjects?.map((sub: any) => (
                          <div key={sub.id} className="bg-white rounded-xl border p-4 shadow-sm">
                            <div className="flex justify-between items-center border-b pb-2 mb-4">
                              <h4 className="font-bold text-indigo-950 text-base">{sub.title}</h4>
                            </div>

                            {/* Add Chapter Form */}
                            <div className="flex gap-2 items-center mb-4">
                              <input
                                type="text"
                                value={newChapTitle}
                                onChange={(e) => setNewChapTitle(e.target.value)}
                                className="input-devotional text-xs py-1.5"
                                placeholder="New chapter title..."
                              />
                              <button
                                onClick={() => handleAddChapter(sub.id)}
                                className="btn-outline text-xs px-3 py-1.5 shrink-0"
                              >
                                + Add Chapter
                              </button>
                            </div>

                            {/* Chapters list */}
                            <div className="space-y-3">
                              {sub.chapters?.map((chap: any) => (
                                <div key={chap.id} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                  <h5 className="font-semibold text-slate-800 text-sm">{chap.title}</h5>

                                  {/* Link Video / Upload Note */}
                                  <div className="mt-3 flex gap-2 flex-wrap">
                                    <button
                                      onClick={() => {
                                        setActiveChapterId(chap.id);
                                        setNewVidTitle('');
                                        setNewVidYtId('');
                                        setLinkMode('manual');
                                      }}
                                      className="text-xs font-bold bg-indigo-55 text-indigo-700 px-2 py-1.5 rounded hover:bg-indigo-100 transition"
                                    >
                                      + Link Video Lecture
                                    </button>
                                    <button
                                      onClick={() => {
                                        setActiveChapterId(chap.id);
                                        setNewNoteTitle('note'); // trigger state
                                        setNewNoteUrl('');
                                      }}
                                      className="text-xs font-bold bg-emerald-50 text-emerald-700 px-2 py-1.5 rounded hover:bg-emerald-100 transition"
                                    >
                                      + Add PDF Notes
                                    </button>
                                  </div>

                                  {/* Forms for additions */}
                                  {activeChapterId === chap.id && newNoteTitle !== 'note' && (
                                    <form onSubmit={handleAddVideo} className="mt-3 p-3 bg-white border rounded space-y-2">
                                      <p className="text-xs font-bold text-indigo-950">Add Lecture Video</p>

                                      <div className="flex gap-4 border-b pb-2 mb-2 text-xs">
                                        <label className="flex items-center gap-1 cursor-pointer">
                                          <input type="radio" checked={linkMode === 'manual'} onChange={() => setLinkMode('manual')} />
                                          Manual Entry
                                        </label>
                                        <label className="flex items-center gap-1 cursor-pointer">
                                          <input type="radio" checked={linkMode === 'synced'} onChange={() => setLinkMode('synced')} />
                                          Select Synced Video
                                        </label>
                                      </div>

                                      {linkMode === 'synced' ? (
                                        <FormField label="Choose Synced Video" required>
                                          <select
                                            className="input-devotional text-xs py-1 font-semibold"
                                            onChange={(e) => {
                                              const selected = syncedVideos.find((v) => v.youtubeId === e.target.value);
                                              if (selected) {
                                                setNewVidTitle(selected.title);
                                                setNewVidYtId(selected.youtubeId);
                                              }
                                            }}
                                          >
                                            <option value="">-- Select from Pool --</option>
                                            {syncedVideos.map((v) => (
                                              <option key={v.id} value={v.youtubeId}>{v.title}</option>
                                            ))}
                                          </select>
                                        </FormField>
                                      ) : null}

                                      <input
                                        type="text"
                                        required
                                        placeholder="Video Title"
                                        value={newVidTitle}
                                        onChange={(e) => setNewVidTitle(e.target.value)}
                                        className="input-devotional text-xs py-1"
                                      />
                                      <input
                                        type="text"
                                        required
                                        placeholder="YouTube ID (e.g. dQw4w9WgXcQ)"
                                        value={newVidYtId}
                                        onChange={(e) => setNewVidYtId(e.target.value)}
                                        className="input-devotional text-xs py-1"
                                      />
                                      <div className="flex justify-end gap-2">
                                        <button type="button" onClick={() => setActiveChapterId('')} className="text-xs font-bold text-slate-400">Cancel</button>
                                        <button type="submit" className="btn-primary text-xs py-1 px-3">Save Video</button>
                                      </div>
                                    </form>
                                  )}

                                  {activeChapterId === chap.id && newNoteTitle === 'note' && (
                                    <form onSubmit={handleAddNote} className="mt-3 p-3 bg-white border rounded space-y-2">
                                      <p className="text-xs font-bold text-emerald-950">Upload Note</p>
                                      <input
                                        type="text"
                                        required
                                        placeholder="Notes Title"
                                        value={newNoteTitle === 'note' ? '' : newNoteTitle}
                                        onChange={(e) => setNewNoteTitle(e.target.value)}
                                        className="input-devotional text-xs py-1"
                                      />
                                      <input
                                        type="text"
                                        required
                                        placeholder="PDF URL"
                                        value={newNoteUrl}
                                        onChange={(e) => setNewNoteUrl(e.target.value)}
                                        className="input-devotional text-xs py-1"
                                      />
                                      <div className="flex justify-end gap-2">
                                        <button type="button" onClick={() => { setActiveChapterId(''); setNewNoteTitle(''); }} className="text-xs font-bold text-slate-400">Cancel</button>
                                        <button type="submit" className="btn-primary text-xs py-1 px-3">Save Note</button>
                                      </div>
                                    </form>
                                  )}

                                  {/* List lectures & notes inside chapter */}
                                  <div className="mt-2 pl-3 border-l-2 border-indigo-100 space-y-1">
                                    {chap.videos?.map((vid: any) => (
                                      <div key={vid.id} className="text-xs text-slate-600 flex justify-between py-1 border-b last:border-0 border-slate-100">
                                        <span>▶ {vid.title}</span>
                                        <span className="font-semibold text-slate-400">{vid.youtubeId}</span>
                                      </div>
                                    ))}
                                    {chap.notes?.map((n: any) => (
                                      <div key={n.id} className="text-xs text-slate-600 flex justify-between py-1">
                                        <span>📄 {n.title} (PDF)</span>
                                        <a href={n.fileUrl} target="_blank" rel="noreferrer" className="text-indigo-600 font-bold hover:underline">View</a>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <h3 className="font-sans text-xl font-black text-violet-950 mb-6 flex items-center gap-2">
                        <span className="text-2xl drop-shadow-sm">📚</span> Active Courses
                      </h3>
                      
                      {courses.length === 0 ? (
                        <div className="bg-gradient-to-br from-violet-50/70 to-purple-50/40 backdrop-blur-xl rounded-3xl border border-white/80 p-10 text-center text-violet-950/40 font-semibold italic text-sm shadow-[0_8px_30px_rgb(0,0,0,0.02)]">No courses listed yet.</div>
                      ) : (
                        <div className="grid gap-4">
                          {courses.map((c) => (
                            <div key={c.id} className="bg-gradient-to-br from-violet-50/60 to-purple-50/40 backdrop-blur-xl rounded-3xl border border-white/80 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:bg-violet-100/20 transition-all relative overflow-hidden group">
                              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-violet-100/40 to-transparent rounded-bl-full pointer-events-none transform group-hover:scale-110 transition-transform duration-500"></div>
                              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                  <h4 className="font-black text-lg text-violet-950 flex items-center gap-2">
                                    <span className="text-violet-500">◈</span> {c.title}
                                  </h4>
                                  <p className="text-sm font-bold text-violet-950/50 mt-1 max-w-xl">{c.description}</p>
                                </div>
                                <div className="mt-4 md:mt-0 flex gap-2 shrink-0">
                                  <button
                                    onClick={() => setSelectedManageCourse(c)}
                                    className="bg-white border border-violet-100 text-violet-600 hover:bg-violet-50 hover:text-violet-700 text-xs font-black px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-1.5"
                                  >
                                    <span>⚙️</span> Edit Curriculum ({c.subjects?.length || 0} Subjects)
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <div className="rounded-3xl border border-white bg-gradient-to-br from-violet-50/50 to-white backdrop-blur-xl p-5 lg:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.05)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-12 -mt-12 w-24 h-24 rounded-full bg-gradient-to-br from-violet-200/50 to-purple-200/50 blur-xl pointer-events-none"></div>
                    <h3 className="font-sans text-base font-black text-violet-950 mb-4 flex items-center gap-2">
                      <span>✨</span> Add Academic Course
                    </h3>
                    <form onSubmit={handleCreateCourse} className="space-y-4 relative z-10">
                      <FormField label="Course Title" required>
                        <input
                          type="text"
                          required
                          value={courseTitle}
                          onChange={(e) => setCourseTitle(e.target.value)}
                          className="input-devotional text-sm py-2.5 bg-white shadow-sm border-slate-200 focus:border-violet-500 focus:ring-violet-200"
                          placeholder="e.g., Data Structures & Algorithms"
                        />
                      </FormField>
                      <FormField label="Description">
                        <textarea
                          value={courseDesc}
                          onChange={(e) => setCourseDesc(e.target.value)}
                          className="input-devotional h-20 resize-none text-sm py-2.5 bg-white shadow-sm border-slate-200 focus:border-violet-500 focus:ring-violet-200"
                          placeholder="Course overview details..."
                        ></textarea>
                      </FormField>
                      <button type="submit" className="btn-primary w-full py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-md hover:shadow-lg transition-all rounded-xl font-bold border-0">
                        Create Course
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Tests */}
            {activeTab === 'tests' && (
              <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 space-y-4">
                  {selectedManageTest ? (
                    <div>
                      <button onClick={() => setSelectedManageTest(null)} className="text-xs font-bold text-indigo-600 hover:underline mb-4 uppercase">
                        ← Back to test list
                      </button>
                      <h3 className="font-sans text-xl font-bold text-indigo-950">{selectedManageTest.title} Questions</h3>

                      {/* Add MCQ question form */}
                      <Card className="mt-4 p-4">
                        <h4 className="font-bold text-slate-800 text-sm mb-3">Add MCQ Question</h4>
                        <form onSubmit={handleAddQuestion} className="space-y-3">
                          <FormField label="Question text" required>
                            <input
                              type="text"
                              required
                              value={newQText}
                              onChange={(e) => setNewQText(e.target.value)}
                              className="input-devotional"
                              placeholder="e.g. What is the complexity of binary search?"
                            />
                          </FormField>
                          <div className="grid grid-cols-2 gap-2">
                            <FormField label="Marks" required>
                              <input
                                type="number"
                                required
                                value={newQMarks}
                                onChange={(e) => setNewQMarks(Number(e.target.value))}
                                className="input-devotional"
                              />
                            </FormField>
                            <FormField label="Type" required>
                              <select
                                value={newQType}
                                onChange={(e: any) => setNewQType(e.target.value)}
                                className="input-devotional font-semibold"
                              >
                                <option value="MCQ">Multiple Choice (MCQ)</option>
                                <option value="TRUE_FALSE">True / False</option>
                              </select>
                            </FormField>
                          </div>

                          <div className="space-y-2 mt-3">
                            <p className="text-xs font-bold text-slate-500">Answer Options (Check the correct option)</p>
                            <div className="flex gap-2 items-center">
                              <input type="checkbox" checked={opt1Correct} onChange={(e) => setOpt1Correct(e.target.checked)} />
                              <input type="text" placeholder="Option A" required value={opt1} onChange={(e) => setOpt1(e.target.value)} className="input-devotional text-xs py-1" />
                            </div>
                            <div className="flex gap-2 items-center">
                              <input type="checkbox" checked={opt2Correct} onChange={(e) => setOpt2Correct(e.target.checked)} />
                              <input type="text" placeholder="Option B" required value={opt2} onChange={(e) => setOpt2(e.target.value)} className="input-devotional text-xs py-1" />
                            </div>
                            <div className="flex gap-2 items-center">
                              <input type="checkbox" checked={opt3Correct} onChange={(e) => setOpt3Correct(e.target.checked)} />
                              <input type="text" placeholder="Option C (Optional)" value={opt3} onChange={(e) => setOpt3(e.target.value)} className="input-devotional text-xs py-1" />
                            </div>
                            <div className="flex gap-2 items-center">
                              <input type="checkbox" checked={opt4Correct} onChange={(e) => setOpt4Correct(e.target.checked)} />
                              <input type="text" placeholder="Option D (Optional)" value={opt4} onChange={(e) => setOpt4(e.target.value)} className="input-devotional text-xs py-1" />
                            </div>
                          </div>

                          <button type="submit" className="btn-primary w-full mt-3">Add MCQ Question</button>
                        </form>
                      </Card>

                      {/* Display existing test questions */}
                      <div className="space-y-4 mt-6">
                        {selectedManageTest.questions?.map((q: any, idx: number) => (
                          <div key={q.id} className="bg-white rounded-xl border p-4 shadow-sm">
                            <p className="font-semibold text-slate-800 text-sm">{idx + 1}. {q.text} ({q.marks} Marks)</p>
                            <div className="mt-2 pl-3 border-l-2 border-indigo-100 space-y-1">
                              {q.options?.map((opt: any) => (
                                <div key={opt.id} className={`text-xs ${opt.isCorrect ? 'text-emerald-600 font-bold' : 'text-slate-500'}`}>
                                  • {opt.text} {opt.isCorrect ? '(Correct)' : ''}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <h3 className="font-sans text-xl font-black text-rose-950 mb-6 flex items-center gap-2">
                        <span className="text-2xl drop-shadow-sm">📝</span> Scheduled Tests
                      </h3>
                      <div className="grid gap-4">
                        {tests.length === 0 ? (
                          <div className="bg-gradient-to-br from-rose-50/70 to-red-50/40 backdrop-blur-xl rounded-3xl border border-white/80 p-10 text-center text-rose-950/40 font-semibold italic text-sm shadow-[0_8px_30px_rgb(0,0,0,0.02)]">No tests scheduled.</div>
                        ) : (
                          tests.map((t) => (
                            <div key={t.id} className="bg-gradient-to-br from-rose-50/60 to-red-50/40 backdrop-blur-xl rounded-3xl border border-white/80 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:bg-rose-100/20 transition-all relative overflow-hidden group">
                              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-rose-100/40 to-transparent rounded-bl-full pointer-events-none transform group-hover:scale-110 transition-transform duration-500"></div>
                              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                  <h4 className="font-black text-lg text-rose-950 flex items-center gap-2">
                                    <span className="text-rose-500">❖</span> {t.title}
                                  </h4>
                                  <div className="flex gap-2 items-center flex-wrap mt-2">
                                    <span className="bg-white border border-rose-100 text-rose-700 text-[10px] uppercase font-black px-2 py-0.5 rounded-lg shadow-sm">
                                      ⏱️ {t.durationMinutes} mins
                                    </span>
                                    <span className="bg-white border border-rose-100 text-rose-700 text-[10px] uppercase font-black px-2 py-0.5 rounded-lg shadow-sm">
                                      🎯 {t.totalMarks} Marks
                                    </span>
                                    <span className="bg-white border border-rose-100 text-rose-700 text-[10px] uppercase font-black px-2 py-0.5 rounded-lg shadow-sm">
                                      ✅ Pass: {t.passingMarks}
                                    </span>
                                    <span className="bg-rose-100 border border-rose-200 text-rose-800 text-[10px] uppercase font-black px-2 py-0.5 rounded-lg shadow-sm">
                                      {t.questions?.length || 0} Questions
                                    </span>
                                  </div>
                                </div>
                                <div className="mt-4 md:mt-0 flex gap-2 shrink-0">
                                  <button
                                    onClick={() => setSelectedManageTest(t)}
                                    className="bg-white border border-rose-100 text-rose-600 hover:bg-rose-50 hover:text-rose-700 text-xs font-black px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-1.5"
                                  >
                                    <span>⚙️</span> Manage Questions
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="rounded-3xl border border-white bg-gradient-to-br from-rose-50/50 to-white backdrop-blur-xl p-5 lg:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.05)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-12 -mt-12 w-24 h-24 rounded-full bg-gradient-to-br from-rose-200/50 to-red-200/50 blur-xl pointer-events-none"></div>
                    <h3 className="font-sans text-base font-black text-rose-950 mb-4 flex items-center gap-2">
                      <span>✨</span> Create Test Module
                    </h3>
                    <form onSubmit={handleCreateTest} className="space-y-4 relative z-10">
                      <FormField label="Test Title" required>
                        <input
                          type="text"
                          required
                          value={testTitle}
                          onChange={(e) => setTestTitle(e.target.value)}
                          className="input-devotional text-sm py-2.5 bg-white shadow-sm border-slate-200 focus:border-rose-500 focus:ring-rose-200"
                          placeholder="e.g., Mid-Term Examination"
                        />
                      </FormField>
                      <FormField label="Description">
                        <textarea
                          value={testDesc}
                          onChange={(e) => setTestDesc(e.target.value)}
                          className="input-devotional h-16 resize-none text-sm py-2.5 bg-white shadow-sm border-slate-200 focus:border-rose-500 focus:ring-rose-200"
                          placeholder="Instructions..."
                        ></textarea>
                      </FormField>
                      <div className="grid grid-cols-3 gap-3">
                        <FormField label="Minutes" required>
                          <input
                            type="number"
                            required
                            value={testDuration}
                            onChange={(e) => setTestDuration(Number(e.target.value))}
                            className="input-devotional text-sm py-2.5 bg-white shadow-sm border-slate-200 focus:border-rose-500 focus:ring-rose-200"
                          />
                        </FormField>
                        <FormField label="Marks" required>
                          <input
                            type="number"
                            required
                            value={testMarks}
                            onChange={(e) => setTestMarks(Number(e.target.value))}
                            className="input-devotional text-sm py-2.5 bg-white shadow-sm border-slate-200 focus:border-rose-500 focus:ring-rose-200"
                          />
                        </FormField>
                        <FormField label="Pass" required>
                          <input
                            type="number"
                            required
                            value={testPassing}
                            onChange={(e) => setTestPassing(Number(e.target.value))}
                            className="input-devotional text-sm py-2.5 bg-white shadow-sm border-slate-200 focus:border-rose-500 focus:ring-rose-200"
                          />
                        </FormField>
                      </div>
                      <button type="submit" className="btn-primary w-full py-2.5 bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 text-white shadow-md hover:shadow-lg transition-all rounded-xl font-bold border-0 mt-2">
                        Create Test
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: YouTube channels */}
            {activeTab === 'youtube' && (
              <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <h3 className="font-sans text-xl font-black text-red-950 flex items-center gap-2">
                    <span className="text-2xl drop-shadow-sm">▶️</span> Linked YouTube Channels
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {ytChannels.length === 0 ? (
                      <div className="col-span-2 bg-gradient-to-br from-red-50/70 to-rose-50/40 backdrop-blur-xl rounded-3xl border border-white/80 p-10 text-center text-red-950/40 font-semibold italic text-sm shadow-[0_8px_30px_rgb(0,0,0,0.02)]">No YouTube channels linked to this center yet.</div>
                    ) : (
                      ytChannels.map((c) => (
                        <Card key={c.id} className="p-4 hover:shadow-md transition relative flex flex-col justify-between">
                          <div className="flex gap-3 items-start">
                            {c.thumbnail ? (
                              <img
                                src={c.thumbnail}
                                alt={c.title}
                                className="h-12 w-12 rounded-full object-cover border border-slate-200 shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://www.youtube.com/s/desktop/82d92138/img/logos/favicon_144x144.png';
                                }}
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-extrabold text-sm shrink-0">
                                YT
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-indigo-950 text-sm leading-tight">{c.title}</h4>
                                {syncProgressMap[c.channelId]?.status === 'syncing' && (
                                  <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-extrabold px-1.5 py-0.5 rounded animate-pulse">
                                    ⚡ DEEP SYNCING
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5 select-all">ID: {c.channelId}</p>
                              
                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                                  📁 {c.playlistsCount || 0} Playlists
                                </span>
                                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                                  🎥 {c.videosCount || 0} Videos Synced
                                </span>
                              </div>

                              {c.batchIds && c.batchIds.length > 0 && (
                                <div className="mt-2.5 flex flex-wrap gap-1 items-center">
                                  <span className="text-[9px] font-extrabold text-slate-400 mr-0.5 uppercase tracking-wider">Batches:</span>
                                  {c.batchIds.map((bid: string) => {
                                    const batchName = batches.find((b) => b.id === bid)?.name || 'Unknown';
                                    return (
                                      <span key={bid} className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-indigo-900 rounded border border-slate-200/60">
                                        {batchName}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                              
                              <p className="text-[9px] font-semibold text-slate-400 mt-2">
                                🕒 Last Synced: <span className="text-slate-600 font-bold">{c.lastSyncedAt ? new Date(c.lastSyncedAt).toLocaleString() : 'Never'}</span>
                              </p>

                              <p className="text-xs text-slate-500 mt-3 line-clamp-2">{c.description || 'No description provided.'}</p>

                              {/* Real-time Progress Card */}
                              {syncProgressMap[c.channelId] && (
                                <div className={`border rounded-xl p-3.5 mt-3 ${
                                  syncProgressMap[c.channelId].status === 'completed' ? 'bg-emerald-50/50 border-emerald-200' :
                                  syncProgressMap[c.channelId].status === 'cancelled' ? 'bg-orange-50/50 border-orange-200' :
                                  syncProgressMap[c.channelId].status === 'failed' ? 'bg-red-50/50 border-red-200' :
                                  'bg-indigo-50/50 border-indigo-100/80 animate-pulse'
                                }`}>
                                  {/* Row 1: Stage label + badges */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-1 border-b border-indigo-100/50">
                                    <div className="flex items-center gap-1.5 text-indigo-800 text-xs font-extrabold min-w-0">
                                      {syncProgressMap[c.channelId].status === 'syncing' && (
                                        <svg className="animate-spin h-3.5 w-3.5 text-indigo-600 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                      )}
                                      <span className="truncate uppercase tracking-wider">
                                        {syncProgressMap[c.channelId].status === 'completed' && '✅ SYNC COMPLETE'}
                                        {syncProgressMap[c.channelId].status === 'cancelled' && '⛔ SYNC STOPPED'}
                                        {syncProgressMap[c.channelId].status === 'failed' && '❌ SYNC FAILED'}
                                        {syncProgressMap[c.channelId].status === 'syncing' && (
                                          <>
                                            {syncProgressMap[c.channelId].stage === 'fetching_playlists' && 'SCANNING PLAYLISTS'}
                                            {syncProgressMap[c.channelId].stage === 'fetching_videos' && 'FETCHING NEW VIDEOS'}
                                            {syncProgressMap[c.channelId].stage === 'fetching_durations' && 'DURATION ANALYSIS'}
                                            {syncProgressMap[c.channelId].stage === 'saving_to_db' && 'DATABASE WRITEBACK'}
                                            {(!syncProgressMap[c.channelId].stage || syncProgressMap[c.channelId].stage === 'initiating') && 'INITIATING...'}
                                          </>
                                        )}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                                      {/* Sync mode badge */}
                                      {syncProgressMap[c.channelId].syncMode && (
                                        <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded tracking-wider uppercase ${
                                          syncProgressMap[c.channelId].syncMode === 'INCREMENTAL'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-amber-100 text-amber-800'
                                        }`}>
                                          {syncProgressMap[c.channelId].syncMode === 'INCREMENTAL' ? '⚡ INCREMENTAL' : '🔄 FULL SCAN'}
                                        </span>
                                      )}
                                      <span className="bg-indigo-100 text-indigo-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded tracking-wider uppercase">
                                        {syncProgressMap[c.channelId].engine || 'LOCAL'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Since date for incremental */}
                                  {syncProgressMap[c.channelId].sinceDate && (
                                    <p className="text-[9px] text-slate-500 mb-2">
                                      Checking videos since <span className="font-bold text-slate-700">{new Date(syncProgressMap[c.channelId].sinceDate).toLocaleString()}</span>
                                    </p>
                                  )}

                                  {/* Progress bar */}
                                  <div>
                                    <div className="flex justify-between text-[10px] font-bold text-slate-600">
                                      <span>Playlists: {syncProgressMap[c.channelId].playlistsProcessed}/{syncProgressMap[c.channelId].playlistsTotal || 1}</span>
                                      {syncProgressMap[c.channelId].stage === 'saving_to_db' && (
                                        <span className="text-amber-600 font-extrabold animate-pulse">Saving: {syncProgressMap[c.channelId].videosProcessed} synced</span>
                                      )}
                                    </div>
                                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1.5">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-300 ${
                                          syncProgressMap[c.channelId].status === 'completed' ? 'bg-emerald-500' :
                                          syncProgressMap[c.channelId].status === 'cancelled' ? 'bg-orange-400' :
                                          syncProgressMap[c.channelId].status === 'failed' ? 'bg-red-400' :
                                          'bg-amber-500'
                                        }`}
                                        style={{ 
                                          width: `${
                                            syncProgressMap[c.channelId].status === 'completed' ? 100 :
                                            syncProgressMap[c.channelId].playlistsTotal 
                                              ? (syncProgressMap[c.channelId].playlistsProcessed / syncProgressMap[c.channelId].playlistsTotal) * 100 
                                              : 10 
                                          }%` 
                                        }}
                                      ></div>
                                    </div>
                                  </div>

                                  {/* New videos count */}
                                  <div className="text-emerald-700 text-[10px] font-medium flex items-center gap-1 mt-2">
                                    <span>✓ {syncProgressMap[c.channelId].videosTotal || syncProgressMap[c.channelId].videosProcessed || 0} new video(s) found</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                            {syncingMap[c.channelId] ? (
                              <button
                                type="button"
                                onClick={() => handleCancelSync(c.channelId)}
                                className="text-xs font-bold text-red-500 hover:text-red-700 transition cursor-pointer flex items-center gap-1"
                              >
                                ⛔ Stop Sync
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSyncYoutubeVideos(c.channelId)}
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-800 transition cursor-pointer"
                              >
                                Sync Playlists &amp; Videos
                              </button>
                            )}

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => startEditYoutubeChannel(c)}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteYoutubeChannel(c.channelId)}
                                className="text-xs font-bold text-red-600 hover:text-red-800 transition cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <div className="rounded-3xl border border-white bg-gradient-to-br from-red-50/50 to-white backdrop-blur-xl p-5 lg:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.05)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-12 -mt-12 w-24 h-24 rounded-full bg-gradient-to-br from-red-200/50 to-rose-200/50 blur-xl pointer-events-none"></div>
                    <h3 className="font-sans text-base font-black text-red-950 mb-4 flex items-center gap-2">
                      <span>🔗</span> {editingChannelId ? 'Edit YouTube Channel' : 'Link YouTube Channel'}
                    </h3>
                    <form onSubmit={handleLinkYoutubeChannel} className="space-y-4 relative z-10">
                      <FormField label="Channel ID" required>
                        <input
                          type="text"
                          required
                          disabled={editingChannelId !== null}
                          value={ytChanId}
                          onChange={(e) => setYtChanId(e.target.value)}
                          className="input-devotional text-sm py-2.5 bg-white shadow-sm border-slate-200 focus:border-red-500 focus:ring-red-200 disabled:bg-slate-100 disabled:text-slate-400"
                          placeholder="e.g. UC_x5XG1OV2P6uZZ5FSM9Ttw"
                        />
                      </FormField>
                      <FormField label="Channel Name" required>
                        <input
                          type="text"
                          required
                          value={ytChanTitle}
                          onChange={(e) => setYtChanTitle(e.target.value)}
                          className="input-devotional text-sm py-2.5 bg-white shadow-sm border-slate-200 focus:border-red-500 focus:ring-red-200"
                          placeholder="e.g. Computer Science Lectures"
                        />
                      </FormField>
                      <FormField label="Channel Photo URL (Avatar)" hint="Upload, pick from library, or enter URL">
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={ytChanThumb}
                            onChange={(e) => setYtChanThumb(e.target.value)}
                            className="input-devotional text-sm py-2 bg-white shadow-sm border-slate-200 focus:border-red-500 focus:ring-red-200"
                            placeholder="https://example.com/photo.jpg or upload below"
                          />
                          <div className="flex gap-2 items-center flex-wrap">
                            <label className="btn-outline px-3 py-1.5 text-xs font-bold bg-white cursor-pointer select-none border-slate-200 text-slate-700 hover:bg-slate-50">
                              📁 Upload Photo
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={isUploading}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setIsUploading(true);
                                  try {
                                    const { compressImage } = await import('@/lib/image-compressor');
                                    const compressedBlob = await compressImage(file, 100);
                                    const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });
                                    const formData = new FormData();
                                    formData.append('file', compressedFile);
                                    const res = await api<any>(`/centers/${centerId}/media/upload`, {
                                      method: 'POST',
                                      body: formData,
                                    });
                                    setYtChanThumb(res.fileUrl);
                                    fetchMediaLibrary();
                                    showBanner('Image uploaded & compressed successfully!', 'success');
                                  } catch (err: any) {
                                    showBanner(err.message || 'Failed to upload image.', 'error');
                                  } finally {
                                    setIsUploading(false);
                                  }
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowLibraryModal(true)}
                              className="btn-outline px-3 py-1.5 text-xs font-bold bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            >
                              🖼️ Media Library
                            </button>
                            {isUploading && (
                              <span className="text-xs font-bold text-red-500 animate-pulse bg-red-50 px-2 py-1 rounded">Uploading...</span>
                            )}
                          </div>
                          {ytChanThumb && (
                            <div className="relative w-16 h-16 rounded-xl border border-red-100 overflow-hidden mt-2 bg-slate-50 shadow-sm">
                              <img src={ytChanThumb} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>
                      </FormField>
                      <FormField label="Description">
                        <textarea
                          value={ytChanDesc}
                          onChange={(e) => setYtChanDesc(e.target.value)}
                          className="input-devotional h-20 resize-none text-sm py-2.5 bg-white shadow-sm border-slate-200 focus:border-red-500 focus:ring-red-200"
                          placeholder="Brief notes about content uploaded here..."
                        ></textarea>
                      </FormField>
                      <FormField label="Assign to Batches / Standards" hint="Select which batches can view this channel">
                        <div className="space-y-1.5 max-h-36 overflow-y-auto border border-red-100 rounded-xl p-3 bg-red-50/30">
                          {batches.length === 0 ? (
                            <p className="text-xs text-red-900/50 font-bold italic">No batches created in this center.</p>
                          ) : (
                            batches.map((b) => {
                              const checked = ytSelectedBatchIds.includes(b.id);
                              return (
                                <label key={b.id} className="flex items-center gap-2.5 text-xs font-bold text-red-950 cursor-pointer select-none hover:bg-white p-1.5 rounded-lg transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setYtSelectedBatchIds([...ytSelectedBatchIds, b.id]);
                                      } else {
                                        setYtSelectedBatchIds(ytSelectedBatchIds.filter((id) => id !== b.id));
                                      }
                                    }}
                                    className="rounded border-red-300 text-red-600 focus:ring-red-500 h-4 w-4 shadow-sm"
                                  />
                                  <span>{b.name}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </FormField>
                      <div className="flex gap-2 pt-2">
                        <button type="submit" className="btn-primary flex-1 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-md hover:shadow-lg transition-all rounded-xl font-bold border-0">
                          {editingChannelId ? 'Update Channel' : 'Link Channel'}
                        </button>
                        {editingChannelId && (
                          <button
                            type="button"
                            onClick={cancelEditYoutubeChannel}
                            className="btn-outline px-5 py-2.5 text-sm font-bold border-slate-200 hover:bg-slate-50 rounded-xl"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Reports */}
            {activeTab === 'reports' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col mb-2">
                  <h3 className="font-sans text-xl font-black text-cyan-950 flex items-center gap-2">
                    <span className="text-2xl drop-shadow-sm">📊</span> Student Completion Statistics
                  </h3>
                  <p className="text-xs font-bold text-cyan-950/60 mt-1 max-w-2xl leading-relaxed">Overview of video lecture completions, watch times, and recent activity across all batches.</p>
                </div>

                <div className="bg-gradient-to-br from-cyan-50/70 to-sky-50/40 backdrop-blur-xl rounded-3xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-cyan-100/40 to-transparent rounded-bl-full pointer-events-none"></div>
                  
                  <div className="overflow-x-auto relative z-10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-white/60 border-b border-cyan-100/50">
                        <tr>
                          <th className="px-6 py-4 font-black text-cyan-950 uppercase tracking-wider text-[10px]">Student Name</th>
                          <th className="px-6 py-4 font-black text-cyan-950 uppercase tracking-wider text-[10px]">Lecture Content</th>
                          <th className="px-6 py-4 font-black text-cyan-950 uppercase tracking-wider text-[10px]">Watch Time</th>
                          <th className="px-6 py-4 font-black text-cyan-950 uppercase tracking-wider text-[10px]">Status</th>
                          <th className="px-6 py-4 font-black text-cyan-950 uppercase tracking-wider text-[10px]">Last Active</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cyan-900/5">
                        {progressReport.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-10 text-center text-cyan-950/40 font-semibold italic">No completion logs recorded.</td>
                          </tr>
                        ) : (
                          progressReport.map((p) => (
                            <tr key={p.id} className="hover:bg-cyan-50/30 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-extrabold text-cyan-950">{p.membership.user.firstName} {p.membership.user.lastName}</div>
                                <div className="text-[10px] text-cyan-950/50 font-bold mt-0.5">{p.membership.user.email}</div>
                              </td>
                              <td className="px-6 py-4 font-semibold text-slate-700">{p.video.title}</td>
                              <td className="px-6 py-4 font-bold text-slate-600">{Math.round(p.watchTimeSec / 60)} mins</td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm border ${
                                  p.completed 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' 
                                    : 'bg-amber-50 text-amber-700 border-amber-200/50'
                                }`}>
                                  {p.completed ? '✓ Completed' : '▶ Watching'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-xs font-bold text-slate-500">{new Date(p.lastViewedAt).toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
          </div>
        ) : (
          /* Student Portal Layout (Rendered for students, OR for admins in preview mode) */
          <div className="space-y-6">
            {activeTest ? (
              /* ─── MCQ Test Screen ─── */
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl border border-indigo-800/40 p-6 lg:p-8 shadow-2xl text-white">
                <div className="flex flex-wrap justify-between items-center border-b border-white/10 pb-4 mb-6 gap-4">
                  <div>
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Active Quiz</span>
                    <h2 className="font-sans text-xl font-bold text-white mt-1">{activeTest.title}</h2>
                    <p className="text-sm text-slate-400 mt-0.5">{activeTest.description}</p>
                  </div>
                  <div className="bg-red-500/20 border border-red-400/30 text-red-300 text-sm font-extrabold px-4 py-2 rounded-2xl backdrop-blur-md">
                    ⏱ {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')} remaining
                  </div>
                </div>

                <div className="space-y-6">
                  {testQuestions.map((q, idx) => (
                    <div key={q.id} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                      <p className="font-semibold text-white text-sm">{idx + 1}. {q.text}</p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {q.options?.map((opt: any) => (
                          <label
                            key={opt.id}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${studentAnswers[q.id] === opt.id
                              ? 'border-indigo-400 bg-indigo-500/20 text-white'
                              : 'border-white/10 hover:bg-white/5 text-slate-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name={q.id}
                              value={opt.id}
                              checked={studentAnswers[q.id] === opt.id}
                              onChange={() => setStudentAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                              className="text-indigo-400 focus:ring-indigo-400"
                            />
                            <span className="text-sm font-medium">{opt.text}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {testResultSummary ? (
                  <div className="mt-8 p-6 bg-white/5 rounded-2xl border border-white/10 text-center">
                    <h3 className="font-sans text-lg font-bold text-white">Quiz Results</h3>
                    <p className="text-5xl font-extrabold mt-3 text-indigo-300">{testResultSummary.score} <span className="text-2xl text-slate-400">/ {testResultSummary.totalMarks}</span></p>
                    <p className="text-sm text-slate-400 mt-1">Score: {testResultSummary.percentage}%</p>
                    <p className={`text-base font-bold mt-4 uppercase ${testResultSummary.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                      {testResultSummary.passed ? '🎉 PASSED' : '✗ FAILED'}
                    </p>
                    <button
                      onClick={() => { setActiveTest(null); setTestResultSummary(null); }}
                      className="mt-6 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white font-bold px-8 py-3 text-sm transition shadow-lg cursor-pointer border-0"
                    >
                      Back to Courses
                    </button>
                  </div>
                ) : (
                  <div className="mt-6 flex flex-wrap justify-end gap-3">
                    <button
                      onClick={() => { clearInterval(timerInterval); setActiveTest(null); }}
                      className="rounded-2xl border border-white/20 text-slate-300 hover:bg-white/10 px-6 py-2.5 text-sm font-bold cursor-pointer transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => submitTestDirectly(activeTest.id)}
                      className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold px-6 py-2.5 text-sm cursor-pointer transition shadow-lg border-0"
                    >
                      Submit Answers
                    </button>
                  </div>
                )}
              </div>
            ) : activeVideo ? (
              /* ─── Cinema Video Player ─── */
              <div className="bg-gradient-to-br from-slate-950 to-slate-900 rounded-3xl overflow-hidden border border-slate-700/30 shadow-2xl text-white">
                {/* Top bar */}
                <div className="flex flex-wrap justify-between items-center px-5 py-4 border-b border-white/10 gap-3">
                  <div>
                    <span className="text-[10px] font-black text-teal-400 uppercase tracking-widest">▶ Now Playing</span>
                    <h3 className="text-base font-bold mt-0.5 text-white leading-tight">{activeVideo.title}</h3>
                  </div>
                  <button
                    onClick={() => setActiveVideo(null)}
                    className="rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold px-4 py-2 cursor-pointer transition border border-white/10"
                  >
                    ✕ Close Player
                  </button>
                </div>

                {/* Main content: video + playlist */}
                <div className="flex flex-col lg:flex-row">
                  {/* Video area */}
                  <div className="flex-1 p-4 lg:p-6">
                    <div className="aspect-video w-full rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl bg-black">
                      <iframe
                        className="h-full w-full"
                        src={`https://www.youtube-nocookie.com/embed/${activeVideo.youtubeId}?autoplay=1&rel=0&modestbranding=1`}
                        title={activeVideo.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap justify-between items-center gap-3">
                      <p className="text-xs text-slate-400">YouTube ID: <span className="font-semibold text-slate-300">{activeVideo.youtubeId}</span></p>
                      <button
                        onClick={() => markVideoCompleted(activeVideo.id)}
                        className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-xs font-bold px-5 py-2 transition cursor-pointer border-0 shadow-md"
                      >
                        ✓ Mark Complete
                      </button>
                    </div>
                  </div>

                  {/* Playlist sidebar */}
                  <div className="w-full lg:w-72 xl:w-80 border-t lg:border-t-0 lg:border-l border-white/10 bg-slate-900/80 flex flex-col max-h-[500px] lg:max-h-none lg:h-auto overflow-y-auto">
                    <div className="px-4 py-3 border-b border-white/10 sticky top-0 bg-slate-900/95 backdrop-blur-md z-10">
                      <h4 className="font-bold text-teal-400 text-xs uppercase tracking-wider">📋 Playlist</h4>
                    </div>
                    <div className="p-3 space-y-4 flex-1">
                      {selectedCourse?.subjects?.map((sub: any) => (
                        <div key={sub.id} className="space-y-2">
                          <p className="text-[10px] font-bold text-slate-500 uppercase px-1">{sub.title}</p>
                          {sub.chapters?.map((chap: any) => (
                            <div key={chap.id} className="pl-2 border-l border-slate-700/60 space-y-1">
                              <p className="text-xs font-bold text-slate-400 py-1">{chap.title}</p>
                              {chap.videos?.map((vid: any) => (
                                <button
                                  key={vid.id}
                                  onClick={() => { setActiveVideo(vid); markVideoCompleted(vid.id); }}
                                  className={`w-full text-left text-xs p-2.5 rounded-lg transition flex items-center gap-2 ${activeVideo.id === vid.id
                                    ? 'bg-teal-500/20 border border-teal-400/40 text-teal-300 font-bold'
                                    : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  <span className="text-teal-500 shrink-0">{activeVideo.id === vid.id ? '▶' : '○'}</span>
                                  <span className="truncate">{vid.title}</span>
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ─── Course List + Quiz Sidebar ─── */
              <div className="grid gap-6 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Curriculum area (2/3 width on large screens) */}
                <div className="lg:col-span-2 space-y-5">
                  {selectedCourse ? (
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/80 p-5 lg:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.05)] relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-teal-100/30 to-transparent rounded-bl-full pointer-events-none"></div>

                      <button
                        onClick={() => { setSelectedCourse(null); setActiveVideo(null); }}
                        className="text-xs font-black text-teal-600 hover:text-teal-800 transition-colors mb-4 uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                      >
                        ← Back to Courses
                      </button>

                      <h2 className="font-sans text-2xl lg:text-3xl font-black text-slate-900 mb-1">{selectedCourse.title}</h2>
                      <p className="text-sm font-medium text-slate-500 mb-6 max-w-2xl">{selectedCourse.description}</p>

                      <div className="space-y-5">
                        {selectedCourse.subjects?.map((sub: any) => (
                          <div key={sub.id} className="bg-gradient-to-br from-teal-50/60 to-emerald-50/20 border border-teal-100/50 rounded-2xl p-5 shadow-sm">
                            <h3 className="font-black text-teal-950 border-b border-teal-100 pb-3 mb-4 text-sm flex items-center gap-2">
                              <span>📖</span> {sub.title}
                            </h3>
                            {sub.chapters?.map((chap: any) => (
                              <div key={chap.id} className="mb-5 last:mb-0 bg-white/70 backdrop-blur-sm p-4 rounded-xl border border-white/60 shadow-sm">
                                <h4 className="font-extrabold text-slate-800 text-sm mb-3 flex items-center gap-1.5">
                                  <span className="text-teal-500 text-xs">◆</span> {chap.title}
                                </h4>
                                <div className="space-y-2 ml-3">
                                  {chap.videos?.map((vid: any) => (
                                    <div key={vid.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-slate-100 bg-white hover:bg-teal-50/30 hover:border-teal-100 transition-all shadow-sm">
                                      <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-teal-500 font-bold shrink-0">▶</span>
                                        <button
                                          onClick={() => { setActiveVideo(vid); markVideoCompleted(vid.id); }}
                                          className="text-sm font-extrabold text-slate-900 hover:text-teal-700 hover:underline text-left truncate"
                                        >
                                          {vid.title}
                                        </button>
                                      </div>
                                      <button
                                        onClick={() => { setActiveVideo(vid); markVideoCompleted(vid.id); }}
                                        className="text-[10px] font-black bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-100 px-2.5 py-1 rounded-lg transition shrink-0 cursor-pointer"
                                      >
                                        Watch
                                      </button>
                                    </div>
                                  ))}
                                  {chap.notes?.map((n: any) => (
                                    <div key={n.id} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/30 border border-emerald-100/50 text-xs shadow-inner">
                                      <span className="font-bold text-slate-700 flex items-center gap-2">
                                        <span>📄</span> {n.title}
                                      </span>
                                      <a
                                        href={n.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-black text-emerald-600 hover:text-emerald-800 hover:underline shrink-0"
                                      >
                                        Open Notes
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-sans text-xl font-black text-slate-800 mb-5 flex items-center gap-2">
                        <span>📚</span> Your Courses
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {courses.length === 0 ? (
                          <div className="col-span-2 bg-white/70 backdrop-blur-xl border border-white/80 p-8 text-center text-slate-400 font-semibold italic rounded-3xl shadow-sm">No courses assigned to your batch yet.</div>
                        ) : (
                          courses.map((c) => (
                            <div key={c.id} className="bg-gradient-to-br from-teal-50/70 to-emerald-50/40 backdrop-blur-xl rounded-3xl border border-white/80 p-5 shadow-[0_4px_20px_rgb(0,0,0,0.04)] hover:shadow-xl hover:translate-y-[-2px] transition-all flex flex-col justify-between group relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-teal-200/30 to-transparent rounded-bl-full pointer-events-none transform group-hover:scale-110 transition-transform"></div>
                              <div className="relative z-10">
                                <span className="text-2xl">🎓</span>
                                <h4 className="font-black text-lg text-slate-900 group-hover:text-teal-800 transition-colors mt-2">{c.title}</h4>
                                <p className="text-xs text-slate-500 mt-2 font-medium line-clamp-3 leading-relaxed">{c.description}</p>
                              </div>
                              <button
                                onClick={() => { setSelectedCourse(c); setActiveVideo(null); }}
                                className="relative z-10 w-full mt-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold rounded-xl border-0 shadow-md hover:shadow-lg transition-all text-sm cursor-pointer"
                              >
                                Start Learning →
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Quizzes Sidebar (1/3 width on large) */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="rounded-3xl border border-white/80 bg-gradient-to-br from-amber-50/60 to-orange-50/30 backdrop-blur-xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.05)] relative overflow-hidden sticky top-6">
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-20 h-20 rounded-full bg-gradient-to-br from-amber-200/40 to-orange-200/40 blur-xl pointer-events-none"></div>
                    <h3 className="font-sans text-base font-black text-amber-950 mb-4 flex items-center gap-2 relative z-10">
                      <span>📝</span> Quizzes &amp; Tests
                    </h3>
                    <div className="space-y-3 relative z-10">
                      {tests.length === 0 ? (
                        <p className="text-xs font-semibold text-amber-900/40 text-center py-6 italic">No tests active yet.</p>
                      ) : (
                        tests.map((t) => (
                          <div key={t.id} className="bg-white border border-amber-100 p-4 rounded-2xl shadow-sm hover:shadow transition-shadow">
                            <h4 className="font-black text-sm text-slate-900">{t.title}</h4>
                            <div className="flex gap-2 items-center flex-wrap mt-2">
                              <span className="bg-amber-50 border border-amber-100 text-amber-700 text-[9px] uppercase font-black px-2 py-0.5 rounded-lg shadow-sm">
                                ⏱️ {t.durationMinutes} mins
                              </span>
                              <span className="bg-orange-50 border border-orange-100 text-orange-700 text-[9px] uppercase font-black px-2 py-0.5 rounded-lg shadow-sm">
                                🎯 {t.totalMarks} Marks
                              </span>
                            </div>
                            <button
                              onClick={() => startTest(t)}
                              className="w-full text-xs py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl border-0 shadow-md hover:shadow-lg transition-all mt-3 cursor-pointer"
                            >
                              Attempt Quiz →
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </PageShell>
    </div>
  );
}
