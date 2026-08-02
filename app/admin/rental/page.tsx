'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface RentalRequest {
  id: string;
  request_number: string;
  equipment_name: string;
  equipment_category: string | null;
  requester_name: string;
  requester_phone: string;
  requester_email: string | null;
  purpose: string;
  rental_start_date: string | null;
  rental_end_date: string | null;
  status: string;
  requester_notes: string | null;
  approval_notes: string | null;
  rejection_notes: string | null;
  return_notes: string | null;
  completion_notes: string | null;
  request_photo: string | null;
  request_photo_mime: string;
  approval_photo: string | null;
  approval_photo_mime: string;
  return_photo: string | null;
  return_photo_mime: string;
  completion_photo: string | null;
  completion_photo_mime: string;
  approved_at: string | null;
  returned_at: string | null;
  completed_at: string | null;
  rejected_at: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: '검토 중',   color: 'text-yellow-800', bg: 'bg-yellow-100' },
  approved:  { label: '승인됨',    color: 'text-blue-800',   bg: 'bg-blue-100' },
  returned:  { label: '반납 완료', color: 'text-purple-800', bg: 'bg-purple-100' },
  completed: { label: '종료',      color: 'text-green-800',  bg: 'bg-green-100' },
  rejected:  { label: '거절됨',    color: 'text-red-800',    bg: 'bg-red-100' },
};

const ACTION_CONFIG: Record<string, { actions: string[]; label: Record<string, string> }> = {
  pending:   { actions: ['approve', 'reject'], label: { approve: '승인', reject: '거절' } },
  approved:  { actions: ['mark_returned'],     label: { mark_returned: '반납 처리' } },
  returned:  { actions: ['complete'],          label: { complete: '반납 승인' } },
  completed: { actions: [], label: {} },
  rejected:  { actions: [], label: {} },
};

const STATUS_FILTERS = ['all', 'pending', 'approved', 'returned', 'completed', 'rejected'] as const;

function parseDate(d: string): Date {
  // SQLite datetime('now') returns 'YYYY-MM-DD HH:MM:SS' without timezone — treat as UTC
  return new Date(d.includes('T') ? d : d.replace(' ', 'T') + 'Z');
}

function formatDate(d: string | null) {
  if (!d) return '-';
  const dt = parseDate(d);
  const now = new Date();
  const sameYear = dt.getFullYear() === now.getFullYear();
  return sameYear
    ? dt.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    : dt.toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatRentalDate(d: string | null) {
  if (!d) return null;
  const [y, m, day] = d.split('-');
  return `${y}.${m}.${day}`;
}

function PhotoUpload({ label, onChange, onRemove }: { label: string; onChange: (data: string, mime: string) => void; onRemove?: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState('');

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setSizeError('사진은 5MB 이하여야 합니다.'); return; }
    setSizeError('');
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      setPreview(src);
      onChange(src.split(',')[1], file.type);
    };
    reader.readAsDataURL(file);
  }

  function handleRemove() {
    setPreview(null);
    if (ref.current) ref.current.value = '';
    onRemove?.();
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div
        onClick={() => ref.current?.click()}
        className="border-2 border-dashed border-slate-200 rounded-xl p-3 text-center cursor-pointer hover:border-indigo-400 active:border-indigo-600 transition-colors min-h-[80px] flex items-center justify-center"
      >
        {preview ? (
          <img src={preview} alt={label} className="max-h-36 mx-auto rounded-lg object-contain" />
        ) : (
          <div className="text-slate-400">
            <svg className="w-7 h-7 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-xs">사진 업로드 (선택)</p>
          </div>
        )}
      </div>
      {sizeError && <p className="text-xs text-red-600 mt-1">{sizeError}</p>}
      {preview && (
        <button type="button" onClick={handleRemove} className="text-xs text-red-500 mt-1.5 py-1 hover:underline">
          사진 제거
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

export default function AdminRentalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected] = useState<RentalRequest | null>(null);
  const [actionState, setActionState] = useState<{ action: string; note: string; photo: string; photoMime: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [fetchError, setFetchError] = useState('');
  const [countCache, setCountCache] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const [copiedNum, setCopiedNum] = useState('');
  const [copiedContact, setCopiedContact] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const currentDetailId = useRef<string>('');

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (actionState && !processing) {
        setActionState(null);
        setActionError('');
      } else if (selected && !processing) {
        setSelected(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, actionState, processing]);

  const fetchRequests = useCallback(async (silent = false) => {
    setFetchError('');
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/rental/requests?status=${statusFilter}`);
      if (res.status === 401) { router.push('/admin/rental/login'); return; }
      if (!res.ok) {
        setFetchError('목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setRequests(list);
      if (statusFilter === 'all') {
        setCountCache(list.reduce((acc: Record<string, number>, r: RentalRequest) => {
          acc[r.status] = (acc[r.status] || 0) + 1;
          return acc;
        }, {}));
      }
    } catch {
      setFetchError('목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [statusFilter, router]);

  // Single fetch on mount — fetchRequests already handles 401 redirect
  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  async function handleLogout() {
    await fetch('/api/rental/auth', { method: 'DELETE' });
    router.push('/admin/rental/login');
  }

  async function performAction() {
    if (!selected || !actionState) return;
    setProcessing(true);
    setActionError('');
    try {
      const body: Record<string, string> = { action: actionState.action };
      if (actionState.note) body.note = actionState.note;
      if (actionState.photo) { body.photo = actionState.photo; body.photo_mime = actionState.photoMime; }

      const res = await fetch(`/api/rental/requests/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { router.push('/admin/rental/login'); return; }
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || '처리 실패'); return; }

      setSelected(data);
      setActionState(null);
      fetchRequests(true);
      // Keep badge counts fresh when filtered to a specific status
      if (statusFilter !== 'all') {
        fetch('/api/rental/requests?status=all')
          .then(r => r.ok ? r.json() : [])
          .then(list => {
            if (Array.isArray(list)) {
              setCountCache(list.reduce((acc: Record<string, number>, r: RentalRequest) => {
                acc[r.status] = (acc[r.status] || 0) + 1;
                return acc;
              }, {}));
            }
          })
          .catch(() => {});
      }
    } catch {
      setActionError('네트워크 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  }

  async function selectRequest(req: RentalRequest) {
    setSelected(req);
    setActionState(null);
    setActionError('');
    setCopiedContact('');
    setDetailLoading(true);
    currentDetailId.current = req.id;
    const myId = req.id;
    try {
      const res = await fetch(`/api/rental/requests/${req.id}`);
      if (currentDetailId.current !== myId) return;
      if (res.ok) {
        setSelected(await res.json());
      } else if (res.status === 401) {
        router.push('/admin/rental/login');
      } else {
        setActionError('상세 정보를 불러오지 못했습니다. 기본 정보만 표시됩니다.');
      }
    } catch {
      if (currentDetailId.current !== myId) return;
      setActionError('네트워크 오류로 상세 정보를 불러오지 못했습니다.');
    } finally {
      if (currentDetailId.current === myId) setDetailLoading(false);
    }
  }

  function copyStatusUrl(num: string) {
    const url = `${window.location.origin}/rental/${num}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedNum(num);
      setTimeout(() => setCopiedNum(''), 2000);
    }).catch(() => {});
  }

  function copyContact(value: string, key: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedContact(key);
      setTimeout(() => setCopiedContact(''), 2000);
    }).catch(() => {});
  }

  const todaySeoul = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

  // Use cached counts so badges persist across filter changes
  const statusCounts = statusFilter === 'all'
    ? requests.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {} as Record<string, number>)
    : countCache;

  // Total count across all statuses for the "all" filter button
  const totalCount = statusFilter === 'all'
    ? requests.length
    : Object.values(countCache).reduce((a, b) => a + b, 0);

  const q = searchQuery.trim().toLowerCase();
  const filteredRequests = q
    ? requests.filter(r =>
        r.requester_name.toLowerCase().includes(q) ||
        r.equipment_name.toLowerCase().includes(q) ||
        r.request_number.toLowerCase().includes(q) ||
        r.requester_phone.includes(q) ||
        (r.requester_email && r.requester_email.toLowerCase().includes(q))
      )
    : requests;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
              <span className="hidden sm:inline">아이디어 그라운드 </span>장비 관리
            </h1>
            <nav className="flex items-center gap-1">
              <span className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 text-xs sm:text-sm font-medium rounded-lg">대여</span>
              <Link href="/admin/rental/equipment" className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 text-xs sm:text-sm rounded-lg transition-colors">
                장비
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link href="/rental" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-slate-600 hidden sm:block">
              신청 페이지 →
            </Link>
            <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-red-500 transition-colors py-1">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
        {/* Scrollable filter bar — works on mobile */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 sm:mb-6 scrollbar-none">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all shrink-0 min-h-[40px] ${
                statusFilter === s
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}
            >
              {s === 'all' ? '전체' : STATUS_CONFIG[s]?.label}
              {s === 'all' && totalCount > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === 'all' ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                  {totalCount}
                </span>
              )}
              {s !== 'all' && statusCounts[s] ? (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === s ? 'bg-white/20' : STATUS_CONFIG[s]?.bg + ' ' + STATUS_CONFIG[s]?.color}`}>
                  {statusCounts[s]}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="신청자 · 장비명 · 신청번호 · 연락처 검색"
            autoComplete="off"
            style={{ fontSize: '16px' }}
            className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="검색어 지우기"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Result count */}
        {!loading && !fetchError && (
          <p className="text-xs text-slate-400 mb-2">
            {q
              ? `${filteredRequests.length}건 검색됨 (${statusFilter === 'all' ? '전체' : STATUS_CONFIG[statusFilter]?.label} ${requests.length}건 중)`
              : `총 ${requests.length}건`}
          </p>
        )}

        {fetchError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-3">
            <p className="text-sm text-red-700">{fetchError}</p>
            <button onClick={fetchRequests} className="text-xs text-red-600 font-medium underline shrink-0">다시 시도</button>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="bg-white rounded-xl p-4 border border-slate-200 h-20 animate-pulse" />)}
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="font-medium text-slate-500">{q ? '검색 결과가 없습니다.' : '대여 신청이 없습니다.'}</p>
            {q && statusFilter !== 'all' && (
              <p className="text-xs mt-1">
                <button onClick={() => setStatusFilter('all')} className="text-indigo-500 hover:underline">전체 상태로 검색</button>하거나 다른 검색어를 입력해 보세요.
              </p>
            )}
            {q && statusFilter === 'all' && <p className="text-xs mt-1">다른 검색어를 입력해 보세요.</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRequests.map(req => {
              const startDate = formatRentalDate(req.rental_start_date);
              const endDate = formatRentalDate(req.rental_end_date);
              const lastActivityDate = req.rejected_at || req.completed_at || req.returned_at || req.approved_at || req.created_at;
              return (
                <button
                  key={req.id}
                  onClick={() => selectRequest(req)}
                  className={`w-full bg-white rounded-xl p-3.5 sm:p-4 border text-left transition-all hover:shadow-md active:scale-[0.99] ${
                    selected?.id === req.id ? 'border-indigo-400 shadow-md' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CONFIG[req.status]?.bg} ${STATUS_CONFIG[req.status]?.color}`}>
                        {STATUS_CONFIG[req.status]?.label}
                      </span>
                      {req.rental_end_date && req.rental_end_date < todaySeoul && (req.status === 'approved' || req.status === 'returned') && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">기한 초과</span>
                      )}
                      {req.equipment_category && (
                        <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md">{req.equipment_category}</span>
                      )}
                      <span className="font-mono text-xs text-slate-400">{req.request_number}</span>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0 ml-2">{formatDate(lastActivityDate)}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <span className="font-semibold text-slate-800 text-sm">{req.equipment_name}</span>
                    <span className="text-sm text-slate-500">{req.requester_name}</span>
                    {startDate && (
                      <span className="text-xs text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                        {startDate}{endDate ? ` ~ ${endDate}` : ''}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail panel — full screen on mobile, side drawer on desktop */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-start sm:justify-end"
          onClick={() => { if (!actionState && !processing) { setSelected(null); setActionState(null); } }}
        >
          <div
            className="bg-white w-full sm:w-[420px] sm:h-full rounded-t-2xl sm:rounded-none shadow-2xl flex flex-col max-h-[92vh] sm:max-h-screen"
            onClick={e => e.stopPropagation()}
          >
            {/* Panel header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="min-w-0">
                <p className="font-mono text-xs text-slate-400">{selected.request_number}</p>
                <h2 className="font-bold text-slate-900 truncate">{selected.equipment_name}</h2>
                {selected.equipment_category && (
                  <p className="text-xs text-slate-400 truncate">{selected.equipment_category}</p>
                )}
              </div>
              <div className="flex items-center gap-2 ml-3 shrink-0 flex-wrap justify-end">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CONFIG[selected.status]?.bg} ${STATUS_CONFIG[selected.status]?.color}`}>
                  {STATUS_CONFIG[selected.status]?.label}
                </span>
                {selected.rental_end_date && selected.rental_end_date < todaySeoul && (selected.status === 'approved' || selected.status === 'returned') && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">기한 초과</span>
                )}
                <button
                  onClick={() => { if (!processing) { setSelected(null); setActionState(null); } }}
                  aria-label="닫기"
                  disabled={processing}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-40"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 relative">
              {detailLoading && (
                <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2.5 text-sm">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-400 mb-0.5">신청자</p>
                  <p className="font-medium text-slate-800 text-sm">{selected.requester_name}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-400 mb-0.5">연락처</p>
                  <div className="flex items-center gap-1.5">
                    <a href={`tel:${selected.requester_phone}`} className="font-medium text-indigo-600 text-sm hover:underline break-all flex-1">
                      {selected.requester_phone}
                    </a>
                    <button
                      onClick={() => copyContact(selected.requester_phone, 'phone')}
                      aria-label="연락처 복사"
                      className={`shrink-0 p-1 rounded transition-colors ${copiedContact === 'phone' ? 'text-green-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {copiedContact === 'phone'
                        ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      }
                    </button>
                  </div>
                </div>
                {selected.requester_email && (
                  <div className="col-span-2 p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-400 mb-0.5">이메일</p>
                    <div className="flex items-center gap-1.5">
                      <a href={`mailto:${selected.requester_email}`} className="font-medium text-indigo-600 text-sm hover:underline break-all flex-1">
                        {selected.requester_email}
                      </a>
                      <button
                        onClick={() => copyContact(selected.requester_email!, 'email')}
                        aria-label="이메일 복사"
                        className={`shrink-0 p-1 rounded transition-colors ${copiedContact === 'email' ? 'text-green-600' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {copiedContact === 'email'
                          ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        }
                      </button>
                    </div>
                  </div>
                )}
                {[
                  { label: '신청일', value: formatDate(selected.created_at) },
                  ...(selected.rental_start_date ? [{ label: '대여 시작', value: formatRentalDate(selected.rental_start_date) ?? selected.rental_start_date }] : []),
                  ...(selected.rental_end_date ? [{ label: '반납 예정', value: formatRentalDate(selected.rental_end_date) ?? selected.rental_end_date }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                    <p className="font-medium text-slate-800 text-sm break-all">{value}</p>
                  </div>
                ))}
                <div className="col-span-2 p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-400 mb-0.5">사용 목적</p>
                  <p className="text-slate-800 text-sm break-words">{selected.purpose}</p>
                </div>
                {selected.requester_notes && (
                  <div className="col-span-2 p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-400 mb-0.5">신청자 메모</p>
                    <p className="text-slate-700 text-sm break-words">{selected.requester_notes}</p>
                  </div>
                )}
              </div>

              {!actionState && actionError && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                  {actionError}
                </p>
              )}

              {selected.request_photo && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5">신청 사진</p>
                  <img src={`data:${selected.request_photo_mime};base64,${selected.request_photo}`} alt="신청 사진" className="max-h-44 w-full rounded-xl object-contain border border-slate-200 bg-slate-50" />
                </div>
              )}

              {selected.approved_at && (
                <div className="p-3 bg-blue-50 rounded-xl">
                  <p className="text-xs text-blue-500 font-medium mb-1">승인 — {formatDate(selected.approved_at)}</p>
                  {selected.approval_notes && <p className="text-sm text-blue-800 mb-2 break-words">{selected.approval_notes}</p>}
                  {selected.approval_photo && <img src={`data:${selected.approval_photo_mime};base64,${selected.approval_photo}`} alt="승인 사진" className="max-h-36 rounded-lg object-contain w-full bg-white" />}
                </div>
              )}

              {selected.returned_at && (
                <div className="p-3 bg-purple-50 rounded-xl">
                  <p className="text-xs text-purple-500 font-medium mb-1">반납 — {formatDate(selected.returned_at)}</p>
                  {selected.return_notes && <p className="text-sm text-purple-800 mb-2 break-words">{selected.return_notes}</p>}
                  {selected.return_photo && <img src={`data:${selected.return_photo_mime};base64,${selected.return_photo}`} alt="반납 사진" className="max-h-36 rounded-lg object-contain w-full bg-white" />}
                </div>
              )}

              {selected.completed_at && (
                <div className="p-3 bg-green-50 rounded-xl">
                  <p className="text-xs text-green-500 font-medium mb-1">반납 승인 — {formatDate(selected.completed_at)}</p>
                  {selected.completion_notes && <p className="text-sm text-green-800 mb-2 break-words">{selected.completion_notes}</p>}
                  {selected.completion_photo && <img src={`data:${selected.completion_photo_mime};base64,${selected.completion_photo}`} alt="완료 사진" className="max-h-36 rounded-lg object-contain w-full bg-white" />}
                </div>
              )}

              {selected.rejected_at && (
                <div className="p-3 bg-red-50 rounded-xl">
                  <p className="text-xs text-red-500 font-medium mb-1">거절 — {formatDate(selected.rejected_at)}</p>
                  {selected.rejection_notes && <p className="text-sm text-red-800 break-words">{selected.rejection_notes}</p>}
                </div>
              )}

              {ACTION_CONFIG[selected.status]?.actions.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                  {!actionState ? (
                    <div className="flex gap-2">
                      {ACTION_CONFIG[selected.status].actions.map(action => (
                        <button
                          key={action}
                          onClick={() => { setActionState({ action, note: '', photo: '', photoMime: '' }); setActionError(''); }}
                          disabled={detailLoading}
                          className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors min-h-[48px] disabled:opacity-50 ${
                            action === 'reject'
                              ? 'bg-red-50 text-red-700 hover:bg-red-100'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          {ACTION_CONFIG[selected.status].label[action]}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-slate-800">
                        {ACTION_CONFIG[selected.status].label[actionState.action]}
                      </h4>

                      {actionState.action !== 'reject' && (
                        <PhotoUpload
                          label="사진 (선택)"
                          onChange={(data, mime) => setActionState(s => s ? { ...s, photo: data, photoMime: mime } : s)}
                          onRemove={() => setActionState(s => s ? { ...s, photo: '', photoMime: '' } : s)}
                        />
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-sm font-medium text-slate-700">
                            메모{actionState.action === 'reject' ? ' (권장)' : ' (선택)'}
                          </label>
                          {actionState.note.length > 400 && (
                            <span className="text-xs text-orange-500">{actionState.note.length}/500</span>
                          )}
                        </div>
                        <textarea
                          value={actionState.note}
                          onChange={e => setActionState(s => s ? { ...s, note: e.target.value } : s)}
                          placeholder={actionState.action === 'reject' ? '거절 사유를 입력하세요.' : '관리자 메모'}
                          rows={2}
                          maxLength={500}
                          autoFocus={actionState.action === 'reject'}
                          style={{ fontSize: '16px' }}
                          className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none ${
                            actionState.action === 'reject' && !actionState.note.trim()
                              ? 'border-orange-300 bg-orange-50'
                              : 'border-slate-200'
                          }`}
                        />
                        {actionState.action === 'reject' && !actionState.note.trim() && (
                          <p className="text-xs text-orange-600 mt-1">거절 사유를 입력하면 신청자에게 도움이 됩니다.</p>
                        )}
                      </div>

                      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

                      <div className="flex gap-2">
                        <button
                          onClick={() => { setActionState(null); setActionError(''); }}
                          disabled={processing}
                          className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 disabled:opacity-50 min-h-[48px]"
                        >
                          취소
                        </button>
                        <button
                          onClick={performAction}
                          disabled={processing}
                          className={`flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-60 min-h-[48px] ${
                            actionState.action === 'reject'
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          {processing ? '처리 중...' : ACTION_CONFIG[selected.status]?.label[actionState.action] ?? '확인'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <a href={`/rental/${selected.request_number}`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:underline">
                  현황 페이지 열기 →
                </a>
                <button
                  onClick={() => copyStatusUrl(selected.request_number)}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                    copiedNum === selected.request_number
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {copiedNum === selected.request_number ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      복사됨
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      링크 복사
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
