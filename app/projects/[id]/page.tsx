'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface RefScreen {
  id: string;
  project_id: string;
  name: string;
  mime_type: string;
  created_at: string;
}

interface MockupVersion {
  id: string;
  project_id: string;
  version: number;
  proposal_content: string;
  description: string | null;
  created_at: string;
}

interface MockupDetail extends MockupVersion {
  html_content: string;
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [refScreens, setRefScreens] = useState<RefScreen[]>([]);
  const [mockups, setMockups] = useState<MockupVersion[]>([]);
  const [selectedMockup, setSelectedMockup] = useState<MockupDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [proposalContent, setProposalContent] = useState('');
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  const [uploadingScreen, setUploadingScreen] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [screenName, setScreenName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) {
        router.push('/');
        return;
      }
      const data = await res.json();
      setProject(data.project);
      setRefScreens(data.refScreens);
      setMockups(data.mockups);
    } catch {
      router.push('/');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  async function loadMockupDetail(mockupId: string) {
    const res = await fetch(`/api/mockups/${mockupId}`);
    if (res.ok) {
      const data = await res.json();
      setSelectedMockup(data);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerateError('');
    if (!proposalContent.trim()) {
      setGenerateError('기획안 내용을 입력해주세요.');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalContent, description }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(data.error || '생성 실패');
        return;
      }
      setSelectedMockup({
        id: data.id,
        project_id: id,
        version: data.version,
        proposal_content: proposalContent,
        html_content: data.htmlContent,
        description: description || null,
        created_at: new Date().toISOString(),
      });
      setProposalContent('');
      setDescription('');
      fetchProject();
      setActiveTab('history');
    } catch {
      setGenerateError('네트워크 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
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
      const res = await fetch(`/api/projects/${id}/reference-screens`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || '업로드 실패');
        return;
      }
      setScreenName('');
      fetchProject();
    } catch {
      setUploadError('업로드 중 오류가 발생했습니다.');
    } finally {
      setUploadingScreen(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDeleteScreen(screenId: string) {
    if (!confirm('이 참조 화면을 삭제하시겠습니까?')) return;
    await fetch(`/api/projects/${id}/reference-screens`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screenId }),
    });
    fetchProject();
  }

  async function handleDeleteMockup(mockupId: string) {
    if (!confirm('이 목업 버전을 삭제하시겠습니까?')) return;
    await fetch(`/api/mockups/${mockupId}`, { method: 'DELETE' });
    if (selectedMockup?.id === mockupId) setSelectedMockup(null);
    fetchProject();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-full px-6 h-14 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm">대시보드</span>
          </Link>
          <span className="text-slate-200">/</span>
          <h1 className="font-semibold text-slate-900 text-sm truncate">{project.name}</h1>
          {project.description && (
            <span className="text-slate-400 text-xs hidden md:block truncate max-w-xs">{project.description}</span>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 56px)' }}>
        {/* Left Sidebar */}
        <aside className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-y-auto shrink-0">
          {/* Reference Screens */}
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900">참조 화면</h2>
              <span className="text-xs text-slate-400">{refScreens.length}/3</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              기존 화면을 등록하면 AI가 스타일을 참고해 목업을 생성합니다.
            </p>

            {refScreens.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {refScreens.map((screen) => (
                  <div key={screen.id} className="relative group aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/reference-screens/${screen.id}`}
                      alt={screen.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <button
                        onClick={() => handleDeleteScreen(screen.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 bg-red-500 text-white rounded-full transition-opacity"
                        title="삭제"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
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
                    <>
                      <div className="w-3 h-3 border border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      화면 추가
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadScreen}
                    className="hidden"
                    disabled={uploadingScreen}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Tab Nav */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setActiveTab('generate')}
              className={`flex-1 py-3 text-xs font-medium transition-colors ${activeTab === 'generate' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
            >
              목업 생성
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-3 text-xs font-medium transition-colors ${activeTab === 'history' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
            >
              버전 히스토리 ({mockups.length})
            </button>
          </div>

          {/* Generate Form */}
          {activeTab === 'generate' && (
            <div className="p-5 flex-1">
              <form onSubmit={handleGenerate} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    화면 설명/버전 메모 (선택)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="예: 로그인 화면 v1, 대시보드 개선안"
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
                    placeholder={`화면에 대한 기획안을 입력하세요.\n\n예시:\n- 화면명: 고객 대시보드\n- 화면 목적: 고객이 본인의 구매 내역, 적립 포인트, 배송 현황을 한눈에 볼 수 있는 메인 화면\n- 주요 구성 요소:\n  1) 상단: 환영 메시지 + 포인트 요약\n  2) 중단: 최근 주문 목록 (3건)\n  3) 하단: 배송 추적 현황`}
                    rows={12}
                    className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                {generateError && (
                  <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{generateError}</p>
                )}
                <button
                  type="submit"
                  disabled={generating}
                  className={`w-full py-2.5 text-sm font-medium rounded-lg transition-all ${
                    generating
                      ? 'bg-indigo-400 text-white cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {generating ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      AI 목업 생성 중...
                    </span>
                  ) : (
                    '목업 생성하기'
                  )}
                </button>
                {refScreens.length > 0 && (
                  <p className="text-xs text-indigo-600 text-center">
                    참조 화면 {refScreens.length}개 스타일 반영
                  </p>
                )}
              </form>
            </div>
          )}

          {/* Version History */}
          {activeTab === 'history' && (
            <div className="flex-1 overflow-y-auto">
              {mockups.length === 0 ? (
                <div className="p-5 text-center text-xs text-slate-400">
                  아직 생성된 목업이 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {mockups.map((mockup) => (
                    <div
                      key={mockup.id}
                      className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${selectedMockup?.id === mockup.id ? 'bg-indigo-50 border-l-2 border-indigo-600' : ''}`}
                      onClick={() => loadMockupDetail(mockup.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-indigo-600">v{mockup.version}</span>
                            {mockup.description && (
                              <span className="text-xs text-slate-700 truncate">{mockup.description}</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-2">{mockup.proposal_content}</p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {new Date(mockup.created_at).toLocaleString('ko-KR')}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteMockup(mockup.id); }}
                          className="p-1 text-slate-300 hover:text-red-500 transition-colors shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Main Content - Mockup Viewer */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-100">
          {generating ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-600 font-medium">AI가 목업을 생성하고 있습니다...</p>
                <p className="text-slate-400 text-sm mt-1">
                  {refScreens.length > 0
                    ? `참조 화면 ${refScreens.length}개의 스타일을 분석 중입니다.`
                    : '잠시만 기다려주세요.'}
                </p>
              </div>
            </div>
          ) : selectedMockup ? (
            <>
              {/* Mockup Toolbar */}
              <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    v{selectedMockup.version}
                  </span>
                  {selectedMockup.description && (
                    <span className="text-sm font-medium text-slate-700">{selectedMockup.description}</span>
                  )}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('desktop')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${viewMode === 'desktop' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                    >
                      데스크톱
                    </button>
                    <button
                      onClick={() => setViewMode('mobile')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${viewMode === 'mobile' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                    >
                      모바일
                    </button>
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
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    HTML 다운로드
                  </button>
                </div>
              </div>

              {/* Mockup Preview */}
              <div className="flex-1 overflow-auto flex items-start justify-center p-6">
                <div
                  className={`bg-white shadow-xl rounded-lg overflow-hidden transition-all duration-300 ${
                    viewMode === 'mobile' ? 'w-[390px]' : 'w-full max-w-5xl'
                  }`}
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
                  왼쪽에서 기획안을 입력하고<br />
                  &apos;목업 생성하기&apos;를 클릭하세요.<br />
                  또는 히스토리에서 버전을 선택하세요.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
