'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/app/components/Header';
import { Avatar } from '@/app/components/Avatar';
import { useUser } from '@/app/contexts/UserContext';

interface Project { id: string; name: string; description: string | null; created_at: string; }
interface RefScreen { id: string; name: string; mime_type: string; }
interface MockupSummary { id: string; version: number; proposal_content: string; description: string | null; created_at: string; }
interface MockupDetail extends MockupSummary { html_content: string; }
interface Member { id: string; user_id: string; user_name: string; user_color: string; user_role: string; role: string; }
interface Comment { id: string; user_id: string; user_name: string; user_color: string; content: string; created_at: string; }
interface ChatMsg { id: string; user_id: string; user_name: string; user_color: string; content: string; created_at: string; }

type LeftTab = 'generate' | 'history' | 'members' | 'refs';
type RightTab = 'comments' | 'chat';

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { currentUser, allUsers, refreshUsers } = useUser();

  // Project data
  const [project, setProject] = useState<Project | null>(null);
  const [refScreens, setRefScreens] = useState<RefScreen[]>([]);
  const [mockups, setMockups] = useState<MockupSummary[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMockup, setSelectedMockup] = useState<MockupDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // UI state
  const [leftTab, setLeftTab] = useState<LeftTab>('generate');
  const [rightTab, setRightTab] = useState<RightTab>('comments');
  const [rightOpen, setRightOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Generate
  const [proposalContent, setProposalContent] = useState('');
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  // Upload
  const [uploadingScreen, setUploadingScreen] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [screenName, setScreenName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Members
  const [addingMember, setAddingMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatText, setChatText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const lastChatTime = useRef<string | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) { router.push('/'); return; }
      const data = await res.json();
      setProject(data.project);
      setRefScreens(data.refScreens);
      setMockups(data.mockups);
    } catch { router.push('/'); }
    finally { setLoading(false); }
  }, [id, router]);

  const fetchMembers = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/members`);
    if (res.ok) setMembers(await res.json());
  }, [id]);

  const fetchComments = useCallback(async (mockupId: string) => {
    const res = await fetch(`/api/mockups/${mockupId}/comments`);
    if (res.ok) setComments(await res.json());
  }, []);

  const fetchChat = useCallback(async (initial = false) => {
    const url = initial || !lastChatTime.current
      ? `/api/projects/${id}/chat`
      : `/api/projects/${id}/chat?since=${encodeURIComponent(lastChatTime.current)}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const msgs: ChatMsg[] = await res.json();
    if (msgs.length === 0) return;
    if (initial) {
      setChatMessages(msgs);
    } else {
      setChatMessages((prev) => [...prev, ...msgs]);
    }
    lastChatTime.current = msgs[msgs.length - 1].created_at;
  }, [id]);

  useEffect(() => { fetchProject(); fetchMembers(); }, [fetchProject, fetchMembers]);

  useEffect(() => {
    fetchChat(true);
    const interval = setInterval(() => fetchChat(false), 3000);
    return () => clearInterval(interval);
  }, [fetchChat]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (selectedMockup) fetchComments(selectedMockup.id);
  }, [selectedMockup, fetchComments]);

  async function loadMockupDetail(mockupId: string) {
    const res = await fetch(`/api/mockups/${mockupId}`);
    if (res.ok) {
      const data = await res.json();
      setSelectedMockup(data);
      fetchComments(data.id);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerateError('');
    if (!proposalContent.trim()) { setGenerateError('기획안 내용을 입력해주세요.'); return; }
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalContent, description }),
      });
      const data = await res.json();
      if (!res.ok) { setGenerateError(data.error || '생성 실패'); return; }
      setSelectedMockup({ id: data.id, version: data.version, proposal_content: proposalContent, html_content: data.htmlContent, description: description || null, created_at: new Date().toISOString() });
      setProposalContent('');
      setDescription('');
      fetchProject();
      setLeftTab('history');
      setComments([]);
    } catch { setGenerateError('네트워크 오류가 발생했습니다.'); }
    finally { setGenerating(false); }
  }

  async function handleUploadScreen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploadingScreen(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', screenName || file.name);
      const res = await fetch(`/api/projects/${id}/reference-screens`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error || '업로드 실패'); return; }
      setScreenName('');
      fetchProject();
    } catch { setUploadError('업로드 중 오류가 발생했습니다.'); }
    finally { setUploadingScreen(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }

  async function handleDeleteScreen(screenId: string) {
    if (!confirm('이 참조 화면을 삭제하시겠습니까?')) return;
    await fetch(`/api/projects/${id}/reference-screens`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ screenId }) });
    fetchProject();
  }

  async function handleDeleteMockup(mockupId: string) {
    if (!confirm('이 목업 버전을 삭제하시겠습니까?')) return;
    await fetch(`/api/mockups/${mockupId}`, { method: 'DELETE' });
    if (selectedMockup?.id === mockupId) { setSelectedMockup(null); setComments([]); }
    fetchProject();
  }

  async function handleAddMember() {
    if (!selectedUserId) return;
    setAddingMember(true);
    try {
      const res = await fetch(`/api/projects/${id}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: selectedUserId }) });
      if (res.ok) { setSelectedUserId(''); fetchMembers(); }
    } finally { setAddingMember(false); }
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm('이 담당자를 프로젝트에서 제거하시겠습니까?')) return;
    await fetch(`/api/projects/${id}/members`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
    fetchMembers();
  }

  async function handlePostComment(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser || !commentText.trim() || !selectedMockup) return;
    setPostingComment(true);
    try {
      const res = await fetch(`/api/mockups/${selectedMockup.id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id, content: commentText }) });
      if (res.ok) { setCommentText(''); fetchComments(selectedMockup.id); }
    } finally { setPostingComment(false); }
  }

  async function handleDeleteComment(commentId: string) {
    await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
    if (selectedMockup) fetchComments(selectedMockup.id);
  }

  async function handleSendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser || !chatText.trim()) return;
    setSendingChat(true);
    try {
      const res = await fetch(`/api/projects/${id}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id, content: chatText }) });
      if (res.ok) { setChatText(''); fetchChat(false); }
    } finally { setSendingChat(false); }
  }

  const availableToAdd = allUsers.filter((u) => !members.some((m) => m.user_id === u.id));

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }
  if (!project) return null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header breadcrumb={[{ label: project.name }]} />

      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 56px)' }}>

        {/* ── LEFT SIDEBAR ── */}
        <aside className="w-72 bg-white border-r border-slate-200 flex flex-col overflow-hidden shrink-0">

          {/* Tab bar */}
          <div className="flex border-b border-slate-100 shrink-0">
            {(['refs', 'generate', 'history', 'members'] as LeftTab[]).map((tab) => {
              const labels: Record<LeftTab, string> = { refs: '참조', generate: '생성', history: '히스토리', members: '담당자' };
              return (
                <button
                  key={tab}
                  onClick={() => setLeftTab(tab)}
                  className={`flex-1 py-2.5 text-[11px] font-medium transition-colors ${leftTab === tab ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {labels[tab]}
                  {tab === 'history' && mockups.length > 0 && (
                    <span className="ml-1 text-[10px] bg-slate-100 text-slate-500 rounded-full px-1">{mockups.length}</span>
                  )}
                  {tab === 'members' && members.length > 0 && (
                    <span className="ml-1 text-[10px] bg-indigo-100 text-indigo-600 rounded-full px-1">{members.length}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── REFS TAB ── */}
          {leftTab === 'refs' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className="text-xs text-slate-500">
                기존 화면 최대 3개를 등록하면 AI가 스타일을 참고해 목업을 생성합니다.
              </p>
              {refScreens.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {refScreens.map((screen) => (
                    <div key={screen.id} className="relative group aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/reference-screens/${screen.id}`} alt={screen.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                        <button onClick={() => handleDeleteScreen(screen.id)} className="opacity-0 group-hover:opacity-100 p-1 bg-red-500 text-white rounded-full transition-opacity">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1.5 py-0.5">
                        <p className="text-white text-[10px] truncate">{screen.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {refScreens.length < 3 && (
                <div className="space-y-2">
                  {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
                  <input
                    type="text"
                    value={screenName}
                    onChange={(e) => setScreenName(e.target.value)}
                    placeholder="화면 이름 (선택)"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <label className={`flex items-center justify-center gap-2 w-full py-2 border-2 border-dashed rounded-lg cursor-pointer text-xs transition-colors ${uploadingScreen ? 'border-slate-200 text-slate-300' : 'border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600'}`}>
                    {uploadingScreen ? (
                      <><div className="w-3 h-3 border border-indigo-600 border-t-transparent rounded-full animate-spin" />업로드 중...</>
                    ) : (
                      <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>화면 추가 ({refScreens.length}/3)</>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUploadScreen} className="hidden" disabled={uploadingScreen} />
                  </label>
                </div>
              )}
              {refScreens.length === 3 && (
                <p className="text-xs text-indigo-600 text-center">참조 화면 3개가 모두 등록되었습니다.</p>
              )}
            </div>
          )}

          {/* ── GENERATE TAB ── */}
          {leftTab === 'generate' && (
            <div className="flex-1 overflow-y-auto p-4">
              <form onSubmit={handleGenerate} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">버전 메모 (선택)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="예: 로그인 화면 v1"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    기획안 내용 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={proposalContent}
                    onChange={(e) => setProposalContent(e.target.value)}
                    placeholder={`화면에 대한 기획안을 입력하세요.\n\n예시:\n- 화면명: 고객 대시보드\n- 목적: 구매내역, 포인트, 배송현황 한눈에 보기\n- 구성:\n  1) 상단: 환영 메시지 + 포인트\n  2) 중단: 최근 주문 목록\n  3) 하단: 배송 추적`}
                    rows={14}
                    className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                {generateError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{generateError}</p>}
                <button
                  type="submit"
                  disabled={generating}
                  className={`w-full py-2.5 text-sm font-medium rounded-lg transition-all ${generating ? 'bg-indigo-400 text-white cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                >
                  {generating ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      생성 중...
                    </span>
                  ) : '목업 생성하기'}
                </button>
                {refScreens.length > 0 && (
                  <p className="text-xs text-indigo-500 text-center">참조 화면 {refScreens.length}개 스타일 반영</p>
                )}
              </form>
            </div>
          )}

          {/* ── HISTORY TAB ── */}
          {leftTab === 'history' && (
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {mockups.length === 0 ? (
                <p className="p-5 text-center text-xs text-slate-400">아직 생성된 목업이 없습니다.</p>
              ) : (
                mockups.map((mockup) => (
                  <div
                    key={mockup.id}
                    onClick={() => loadMockupDetail(mockup.id)}
                    className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${selectedMockup?.id === mockup.id ? 'bg-indigo-50 border-l-2 border-indigo-600' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-bold text-indigo-600">v{mockup.version}</span>
                          {mockup.description && <span className="text-xs text-slate-700 truncate">{mockup.description}</span>}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">{mockup.proposal_content}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{new Date(mockup.created_at).toLocaleString('ko-KR')}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteMockup(mockup.id); }}
                        className="p-1 text-slate-300 hover:text-red-500 transition-colors shrink-0"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── MEMBERS TAB ── */}
          {leftTab === 'members' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-slate-700 mb-2">프로젝트 담당자</h3>
                {members.length === 0 ? (
                  <p className="text-xs text-slate-400">아직 담당자가 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div key={member.id} className="flex items-center gap-2.5 p-2 bg-slate-50 rounded-lg">
                        <Avatar name={member.user_name} color={member.user_color} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate">{member.user_name}</p>
                          {member.user_role && member.user_role !== 'member' && (
                            <p className="text-[10px] text-slate-400 truncate">{member.user_role}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveMember(member.user_id)}
                          className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-xs font-semibold text-slate-700 mb-2">담당자 추가</h3>
                {availableToAdd.length === 0 ? (
                  <p className="text-xs text-slate-400">추가할 수 있는 사용자가 없습니다. 헤더에서 새 사용자를 먼저 만드세요.</p>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="">사용자 선택...</option>
                      {availableToAdd.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}{u.role && u.role !== 'member' ? ` (${u.role})` : ''}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddMember}
                      disabled={!selectedUserId || addingMember}
                      className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      추가
                    </button>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-400">
                  새 사용자는 상단 헤더의 사용자 선택 메뉴에서 추가할 수 있습니다.
                </p>
              </div>
            </div>
          )}
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-100 min-w-0">
          {generating ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-600 font-medium">AI가 목업을 생성하고 있습니다...</p>
                <p className="text-slate-400 text-sm mt-1">
                  {refScreens.length > 0 ? `참조 화면 ${refScreens.length}개의 스타일을 분석 중입니다.` : '잠시만 기다려주세요.'}
                </p>
              </div>
            </div>
          ) : selectedMockup ? (
            <>
              <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-3 shrink-0">
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">v{selectedMockup.version}</span>
                {selectedMockup.description && <span className="text-sm font-medium text-slate-700">{selectedMockup.description}</span>}
                <div className="ml-auto flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                    {(['desktop', 'mobile'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setViewMode(m)}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${viewMode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                      >
                        {m === 'desktop' ? '데스크톱' : '모바일'}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const blob = new Blob([selectedMockup.html_content], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `mockup-v${selectedMockup.version}.html`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    HTML
                  </button>
                  <button
                    onClick={() => setRightOpen(!rightOpen)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${rightOpen ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    {rightOpen ? '패널 닫기' : '의견/채팅'}
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto flex items-start justify-center p-6">
                <div
                  className={`bg-white shadow-xl rounded-lg overflow-hidden transition-all duration-300 ${viewMode === 'mobile' ? 'w-[390px]' : 'w-full max-w-5xl'}`}
                  style={{ minHeight: '600px' }}
                >
                  <iframe
                    srcDoc={selectedMockup.html_content}
                    className="w-full border-0"
                    style={{ height: viewMode === 'mobile' ? '844px' : '800px' }}
                    title={`목업 v${selectedMockup.version}`}
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-sm">
                <div className="w-20 h-20 bg-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-700 mb-2">목업 미리보기</h3>
                <p className="text-sm text-slate-400">
                  왼쪽 &apos;생성&apos; 탭에서 기획안을 입력하거나<br />
                  &apos;히스토리&apos; 탭에서 기존 버전을 선택하세요.
                </p>
              </div>
            </div>
          )}
        </main>

        {/* ── RIGHT PANEL (Comments + Chat) ── */}
        {rightOpen && (
          <aside className="w-80 bg-white border-l border-slate-200 flex flex-col overflow-hidden shrink-0">
            {/* Right Tab bar */}
            <div className="flex border-b border-slate-100 shrink-0">
              {(['comments', 'chat'] as RightTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setRightTab(tab)}
                  className={`flex-1 py-3 text-xs font-medium transition-colors ${rightTab === tab ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {tab === 'comments' ? `의견 ${selectedMockup ? `(${comments.length})` : ''}` : '채팅'}
                </button>
              ))}
            </div>

            {/* ── COMMENTS ── */}
            {rightTab === 'comments' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {!selectedMockup ? (
                  <div className="flex-1 flex items-center justify-center p-4">
                    <p className="text-xs text-slate-400 text-center">목업 버전을 선택하면<br />의견을 작성할 수 있습니다.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                      {comments.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                          <p className="text-xs text-slate-400">아직 의견이 없습니다.<br />첫 번째 의견을 남겨보세요!</p>
                        </div>
                      ) : (
                        comments.map((comment) => (
                          <div key={comment.id} className="flex gap-2.5">
                            <Avatar name={comment.user_name} color={comment.user_color} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs font-semibold text-slate-800">{comment.user_name}</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-slate-400">{new Date(comment.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                                  {currentUser?.id === comment.user_id && (
                                    <button onClick={() => handleDeleteComment(comment.id)} className="p-0.5 text-slate-300 hover:text-red-500 transition-colors">
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-slate-700 bg-slate-50 rounded-lg px-3 py-2">{comment.content}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="p-3 border-t border-slate-100 shrink-0">
                      {!currentUser ? (
                        <p className="text-xs text-slate-400 text-center">의견을 남기려면 상단에서 사용자를 선택하세요.</p>
                      ) : (
                        <form onSubmit={handlePostComment} className="space-y-2">
                          <div className="flex gap-2 items-start">
                            <Avatar name={currentUser.name} color={currentUser.color} size="sm" />
                            <textarea
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              placeholder="의견을 입력하세요..."
                              rows={2}
                              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment(e); } }}
                              className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={postingComment || !commentText.trim()}
                            className="w-full py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                          >
                            {postingComment ? '작성 중...' : '의견 남기기'}
                          </button>
                        </form>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── CHAT ── */}
            {rightTab === 'chat' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {chatMessages.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <p className="text-xs text-slate-400 text-center">채팅을 시작해보세요!</p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => {
                      const isMe = currentUser?.id === msg.user_id;
                      return (
                        <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                          <Avatar name={msg.user_name} color={msg.user_color} size="sm" />
                          <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                            {!isMe && <span className="text-[10px] text-slate-500 px-1">{msg.user_name}</span>}
                            <div className={`px-3 py-2 rounded-2xl text-xs ${isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm'}`}>
                              {msg.content}
                            </div>
                            <span className="text-[10px] text-slate-400 px-1">
                              {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-3 border-t border-slate-100 shrink-0">
                  {!currentUser ? (
                    <p className="text-xs text-slate-400 text-center">채팅하려면 상단에서 사용자를 선택하세요.</p>
                  ) : (
                    <form onSubmit={handleSendChat} className="flex gap-2">
                      <input
                        type="text"
                        value={chatText}
                        onChange={(e) => setChatText(e.target.value)}
                        placeholder="메시지 입력..."
                        className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="submit"
                        disabled={sendingChat || !chatText.trim()}
                        className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
