'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  admin_notes: string | null;
  return_notes: string | null;
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
  pending:  { actions: ['approve', 'reject'], label: { approve: '승인', reject: '거절' } },
  approved: { actions: ['mark_returned'], label: { mark_returned: '반납 처리' } },
  returned: { actions: ['complete'], label: { complete: '반납 승인' } },
  completed:{ actions: [], label: {} },
  rejected: { actions: [], label: {} },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function PhotoUpload({ label, onChange }: { label: string; onChange: (data: string, mime: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      setPreview(src);
      onChange(src.split(',')[1], file.type);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div
        onClick={() => ref.current?.click()}
        className="border-2 border-dashed border-slate-200 rounded-xl p-3 text-center cursor-pointer hover:border-indigo-400 transition-colors"
      >
        {preview ? (
          <img src={preview} alt={label} className="max-h-32 mx-auto rounded-lg object-contain" />
        ) : (
          <div className="text-slate-400 py-2">
            <svg className="w-6 h-6 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-xs">사진 업로드</p>
          </div>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
    </div>
  );
}

export default function AdminRentalPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<RentalRequest | null>(null);
  const [actionState, setActionState] = useState<{ action: string; note: string; photo: string; photoMime: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [actionError, setActionError] = useState('');

  const checkAuth = useCallback(async () => {
    const res = await fetch('/api/rental/auth');
    const data = await res.json();
    if (!data.authenticated) router.push('/admin/rental/login');
  }, [router]);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch(`/api/rental/requests?status=${statusFilter}`);
      if (res.status === 401) { router.push('/admin/rental/login'); return; }
      setRequests(await res.json());
    } catch {
      console.error('목록 로드 실패');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, router]);

  useEffect(() => { checkAuth(); }, [checkAuth]);
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
      if (actionState.note) {
        if (['approve', 'reject', 'complete'].includes(actionState.action)) body.admin_notes = actionState.note;
        else body.return_notes = actionState.note;
      }
      if (actionState.photo) { body.photo = actionState.photo; body.photo_mime = actionState.photoMime; }

      const res = await fetch(`/api/rental/requests/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error || '처리 실패'); return; }

      setSelected(data);
      setActionState(null);
      fetchRequests();
    } catch {
      setActionError('네트워크 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  }

  const statusCounts = requests.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-base font-bold text-slate-900">아이디어 그라운드 장비 관리</h1>
            <nav className="flex items-center gap-1">
              <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-lg">대여 관리</span>
              <Link href="/admin/rental/equipment" className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 text-sm rounded-lg transition-colors">
                장비 관리
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/rental" target="_blank" className="text-xs text-slate-400 hover:text-slate-600">
              신청 페이지 →
            </Link>
            <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-red-500 transition-colors">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-5 gap-3 mb-6">
          {(['all', 'pending', 'approved', 'returned', 'completed', 'rejected'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`p-3 rounded-xl border text-sm font-medium transition-all ${statusFilter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
            >
              {s === 'all' ? '전체' : STATUS_CONFIG[s]?.label}
              {s !== 'all' && statusCounts[s] ? <span className="ml-1 text-xs opacity-70">({statusCounts[s]})</span> : null}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="bg-white rounded-xl p-4 border border-slate-200 h-20 animate-pulse" />)}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p>대여 신청이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map(req => (
              <button
                key={req.id}
                onClick={() => { setSelected(req); setActionState(null); setActionError(''); }}
                className={`w-full bg-white rounded-xl p-4 border text-left transition-all hover:shadow-md ${selected?.id === req.id ? 'border-indigo-400 shadow-md' : 'border-slate-200'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CONFIG[req.status]?.bg} ${STATUS_CONFIG[req.status]?.color}`}>
                      {STATUS_CONFIG[req.status]?.label}
                    </span>
                    <span className="font-mono text-xs text-slate-400">{req.request_number}</span>
                  </div>
                  <span className="text-xs text-slate-400">{formatDate(req.created_at)}</span>
                </div>
                <div className="mt-2 flex items-center gap-4">
                  <span className="font-semibold text-slate-800">{req.equipment_name}</span>
                  <span className="text-sm text-slate-500">{req.requester_name} · {req.requester_phone}</span>
                  <span className="text-sm text-slate-400 truncate">{req.purpose}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-end p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <div>
                <p className="font-mono text-xs text-slate-400">{selected.request_number}</p>
                <h2 className="font-bold text-slate-900">{selected.equipment_name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CONFIG[selected.status]?.bg} ${STATUS_CONFIG[selected.status]?.color}`}>
                  {STATUS_CONFIG[selected.status]?.label}
                </span>
                <button onClick={() => { setSelected(null); setActionState(null); }} className="p-1 text-slate-400 hover:text-slate-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto max-h-[80vh]">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-400 mb-0.5">신청자</p>
                  <p className="font-medium text-slate-800">{selected.requester_name}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-400 mb-0.5">연락처</p>
                  <p className="font-medium text-slate-800">{selected.requester_phone}</p>
                </div>
                {selected.requester_email && (
                  <div className="col-span-2 p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-400 mb-0.5">이메일</p>
                    <p className="font-medium text-slate-800">{selected.requester_email}</p>
                  </div>
                )}
                <div className="col-span-2 p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-400 mb-0.5">사용 목적</p>
                  <p className="text-slate-800">{selected.purpose}</p>
                </div>
                {selected.rental_start_date && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-400 mb-0.5">대여 시작일</p>
                    <p className="text-slate-800">{selected.rental_start_date}</p>
                  </div>
                )}
                {selected.rental_end_date && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-400 mb-0.5">반납 예정일</p>
                    <p className="text-slate-800">{selected.rental_end_date}</p>
                  </div>
                )}
                {selected.requester_notes && (
                  <div className="col-span-2 p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-400 mb-0.5">신청자 메모</p>
                    <p className="text-slate-800">{selected.requester_notes}</p>
                  </div>
                )}
              </div>

              {selected.request_photo && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">신청 사진</p>
                  <img src={`data:${selected.request_photo_mime};base64,${selected.request_photo}`} alt="신청 사진" className="max-h-40 rounded-xl object-contain border border-slate-200" />
                </div>
              )}

              {selected.approved_at && (
                <div className="p-3 bg-blue-50 rounded-xl">
                  <p className="text-xs text-blue-500 font-medium mb-1">승인 — {formatDate(selected.approved_at)}</p>
                  {selected.admin_notes && selected.status !== 'completed' && <p className="text-sm text-blue-800 mb-2">{selected.admin_notes}</p>}
                  {selected.approval_photo && <img src={`data:${selected.approval_photo_mime};base64,${selected.approval_photo}`} alt="승인 사진" className="max-h-32 rounded-lg object-contain" />}
                </div>
              )}

              {selected.returned_at && (
                <div className="p-3 bg-purple-50 rounded-xl">
                  <p className="text-xs text-purple-500 font-medium mb-1">반납 — {formatDate(selected.returned_at)}</p>
                  {selected.return_notes && <p className="text-sm text-purple-800 mb-2">{selected.return_notes}</p>}
                  {selected.return_photo && <img src={`data:${selected.return_photo_mime};base64,${selected.return_photo}`} alt="반납 사진" className="max-h-32 rounded-lg object-contain" />}
                </div>
              )}

              {selected.completed_at && (
                <div className="p-3 bg-green-50 rounded-xl">
                  <p className="text-xs text-green-500 font-medium mb-1">반납 승인 — {formatDate(selected.completed_at)}</p>
                  {selected.completion_photo && <img src={`data:${selected.completion_photo_mime};base64,${selected.completion_photo}`} alt="완료 사진" className="max-h-32 rounded-lg object-contain" />}
                </div>
              )}

              {selected.rejected_at && (
                <div className="p-3 bg-red-50 rounded-xl">
                  <p className="text-xs text-red-500 font-medium mb-1">거절 — {formatDate(selected.rejected_at)}</p>
                  {selected.admin_notes && <p className="text-sm text-red-800">{selected.admin_notes}</p>}
                </div>
              )}

              {ACTION_CONFIG[selected.status]?.actions.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                  {!actionState ? (
                    <div className="flex gap-2">
                      {ACTION_CONFIG[selected.status].actions.map(action => (
                        <button
                          key={action}
                          onClick={() => setActionState({ action, note: '', photo: '', photoMime: '' })}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${action === 'reject' ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                        >
                          {ACTION_CONFIG[selected.status].label[action]}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-slate-800">{ACTION_CONFIG[selected.status].label[actionState.action]}</h4>

                      <PhotoUpload
                        label="사진 (선택)"
                        onChange={(data, mime) => setActionState(s => s ? { ...s, photo: data, photoMime: mime } : s)}
                      />

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">메모 (선택)</label>
                        <textarea
                          value={actionState.note}
                          onChange={e => setActionState(s => s ? { ...s, note: e.target.value } : s)}
                          placeholder={actionState.action === 'reject' ? '거절 사유를 입력하세요.' : '관리자 메모를 입력하세요.'}
                          rows={2}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                      </div>

                      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

                      <div className="flex gap-2">
                        <button
                          onClick={() => { setActionState(null); setActionError(''); }}
                          className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50"
                        >
                          취소
                        </button>
                        <button
                          onClick={performAction}
                          disabled={processing}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60 ${actionState.action === 'reject' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                        >
                          {processing ? '처리 중...' : '확인'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100">
                <a
                  href={`/rental/${selected.request_number}`}
                  target="_blank"
                  className="text-xs text-indigo-500 hover:underline"
                >
                  현황 페이지 링크 열기 →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
