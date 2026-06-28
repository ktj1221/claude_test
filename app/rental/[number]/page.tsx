'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { use } from 'react';

interface RentalStatus {
  id: string;
  request_number: string;
  requester_name: string;
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
  equipment_name: string;
  equipment_category: string | null;
  equipment_image: string | null;
  equipment_image_mime: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; step: number }> = {
  pending:   { label: '검토 중',   color: 'text-yellow-700', bg: 'bg-yellow-100', step: 1 },
  approved:  { label: '승인됨',    color: 'text-blue-700',   bg: 'bg-blue-100',   step: 2 },
  returned:  { label: '반납 완료', color: 'text-purple-700', bg: 'bg-purple-100', step: 3 },
  completed: { label: '종료',      color: 'text-green-700',  bg: 'bg-green-100',  step: 4 },
  rejected:  { label: '거절됨',    color: 'text-red-700',    bg: 'bg-red-100',    step: -1 },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function PhotoBlock({ label, data, mime }: { label: string; data: string | null; mime: string }) {
  if (!data) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <img
        src={`data:${mime};base64,${data}`}
        alt={label}
        className="max-h-48 rounded-xl object-contain border border-slate-200"
      />
    </div>
  );
}

export default function RentalStatusPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const [data, setData] = useState<RentalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/rental/status/${encodeURIComponent(number)}`);
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || '조회 실패');
        return;
      }
      setData(await res.json());
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [number]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const steps = [
    { key: 'created',  label: '신청',     icon: '📋' },
    { key: 'approved', label: '승인',     icon: '✅' },
    { key: 'returned', label: '반납',     icon: '📦' },
    { key: 'completed',label: '반납 승인', icon: '🎉' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/rental" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            대여 신청
          </Link>
          <h1 className="text-base font-semibold text-slate-900">대여 현황 조회</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {loading ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-200 animate-pulse space-y-4">
            <div className="h-6 bg-slate-200 rounded w-1/3" />
            <div className="h-4 bg-slate-100 rounded w-2/3" />
            <div className="h-32 bg-slate-100 rounded" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-slate-600 font-medium">{error}</p>
            <Link href="/rental" className="text-indigo-600 text-sm mt-3 inline-block hover:underline">대여 신청 페이지로</Link>
          </div>
        ) : data && (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-slate-400 mb-1">신청 번호</p>
                  <p className="text-xl font-bold text-indigo-600 tracking-wider">{data.request_number}</p>
                </div>
                {data.status !== 'rejected' ? (
                  <span className={`text-sm font-medium px-3 py-1 rounded-full ${STATUS_CONFIG[data.status]?.bg} ${STATUS_CONFIG[data.status]?.color}`}>
                    {STATUS_CONFIG[data.status]?.label}
                  </span>
                ) : (
                  <span className="text-sm font-medium px-3 py-1 rounded-full bg-red-100 text-red-700">거절됨</span>
                )}
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                {data.equipment_image ? (
                  <img src={`data:${data.equipment_image_mime};base64,${data.equipment_image}`} alt={data.equipment_name} className="w-14 h-14 object-cover rounded-lg" />
                ) : (
                  <div className="w-14 h-14 bg-indigo-50 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-slate-900">{data.equipment_name}</p>
                  {data.equipment_category && <p className="text-xs text-slate-400">{data.equipment_category}</p>}
                </div>
              </div>
            </div>

            {data.status !== 'rejected' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-4">
                <div className="flex items-center justify-between relative">
                  <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200 z-0" />
                  {steps.map((step, i) => {
                    const currentStep = STATUS_CONFIG[data.status]?.step ?? 0;
                    const isActive = i + 1 <= currentStep;
                    const isCurrent = i + 1 === currentStep;
                    return (
                      <div key={step.key} className="flex flex-col items-center relative z-10">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 transition-all ${isActive ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-slate-400'} ${isCurrent ? 'ring-4 ring-indigo-100' : ''}`}>
                          {step.icon}
                        </div>
                        <span className={`text-xs mt-2 font-medium ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>{step.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-4 space-y-4">
              <h3 className="font-semibold text-slate-800">신청 내용</h3>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">신청자</p>
                  <p className="text-slate-800 font-medium">{data.requester_name}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">신청일</p>
                  <p className="text-slate-800">{formatDate(data.created_at)}</p>
                </div>
                {data.rental_start_date && (
                  <div>
                    <p className="text-slate-400 text-xs mb-0.5">대여 시작일</p>
                    <p className="text-slate-800">{data.rental_start_date}</p>
                  </div>
                )}
                {data.rental_end_date && (
                  <div>
                    <p className="text-slate-400 text-xs mb-0.5">반납 예정일</p>
                    <p className="text-slate-800">{data.rental_end_date}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-slate-400 text-xs mb-0.5">사용 목적</p>
                <p className="text-slate-800 text-sm">{data.purpose}</p>
              </div>

              {data.requester_notes && (
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">메모</p>
                  <p className="text-slate-800 text-sm">{data.requester_notes}</p>
                </div>
              )}

              <PhotoBlock label="신청 사진" data={data.request_photo} mime={data.request_photo_mime} />
            </div>

            {(data.approved_at || data.rejected_at || data.returned_at || data.completed_at) && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                <h3 className="font-semibold text-slate-800">처리 이력</h3>

                {data.rejected_at && (
                  <div className="p-3 bg-red-50 rounded-xl">
                    <p className="text-xs text-red-500 font-medium mb-0.5">거절 — {formatDate(data.rejected_at)}</p>
                    {data.admin_notes && <p className="text-sm text-red-700">{data.admin_notes}</p>}
                  </div>
                )}

                {data.approved_at && (
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <p className="text-xs text-blue-500 font-medium mb-0.5">승인 — {formatDate(data.approved_at)}</p>
                    {data.admin_notes && <p className="text-sm text-blue-800">{data.admin_notes}</p>}
                    <PhotoBlock label="승인 사진" data={data.approval_photo} mime={data.approval_photo_mime} />
                  </div>
                )}

                {data.returned_at && (
                  <div className="p-3 bg-purple-50 rounded-xl">
                    <p className="text-xs text-purple-500 font-medium mb-0.5">반납 완료 — {formatDate(data.returned_at)}</p>
                    {data.return_notes && <p className="text-sm text-purple-800">{data.return_notes}</p>}
                    <PhotoBlock label="반납 사진" data={data.return_photo} mime={data.return_photo_mime} />
                  </div>
                )}

                {data.completed_at && (
                  <div className="p-3 bg-green-50 rounded-xl">
                    <p className="text-xs text-green-500 font-medium mb-0.5">반납 승인 — {formatDate(data.completed_at)}</p>
                    <PhotoBlock label="완료 사진" data={data.completion_photo} mime={data.completion_photo_mime} />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
