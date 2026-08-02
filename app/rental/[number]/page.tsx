'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { use } from 'react';

function formatRentalDate(d: string | null) {
  if (!d) return null;
  const [y, m, day] = d.split('-');
  return `${y}.${m}.${day}`;
}

interface RentalBasic {
  request_number: string;
  status: string;
  rental_start_date: string | null;
  rental_end_date: string | null;
  approved_at: string | null;
  returned_at: string | null;
  completed_at: string | null;
  rejected_at: string | null;
  created_at: string;
  equipment_name: string;
  equipment_category: string | null;
  equipment_image: string | null;
  equipment_image_mime: string;
  verified: boolean;
}

interface RentalFull extends RentalBasic {
  requester_name: string;
  purpose: string;
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
  return new Date(dateStr).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function PhotoBlock({ label, data, mime }: { label: string; data: string | null; mime: string }) {
  if (!data) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-slate-500 mb-1.5">{label}</p>
      <img
        src={`data:${mime};base64,${data}`}
        alt={label}
        className="max-h-52 w-full rounded-xl object-contain border border-slate-200 bg-slate-50"
      />
    </div>
  );
}

export default function RentalStatusPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const [data, setData] = useState<RentalBasic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchStatus = useCallback(async (verify?: string) => {
    try {
      const url = verify
        ? `/api/rental/status/${encodeURIComponent(number)}?verify=${encodeURIComponent(verify)}`
        : `/api/rental/status/${encodeURIComponent(number)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json();
        if (verify) {
          setVerifyError(err.error || '확인 실패');
        } else {
          setError(err.error || '조회 실패');
        }
        return;
      }
      setData(await res.json());
      setVerifyError('');
    } catch {
      if (verify) {
        setVerifyError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
      } else {
        setError('네트워크 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
      setVerifying(false);
    }
  }, [number]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const last4 = phoneInput.replace(/\D/g, '').slice(-4);
    if (last4.length < 4) {
      setVerifyError('연락처 뒷 4자리를 입력해주세요.');
      return;
    }
    setVerifying(true);
    setVerifyError('');
    await fetchStatus(last4);
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const steps: { label: string; icon: React.ReactNode }[] = [
    { label: '신청', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )},
    { label: '승인', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    )},
    { label: '반납', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
      </svg>
    )},
    { label: '반납 승인', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
  ];

  const full = data?.verified ? (data as RentalFull) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-30">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <Link href="/rental" className="text-indigo-600 text-sm font-medium flex items-center gap-1 py-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            대여 신청
          </Link>
          <h1 className="text-sm font-semibold text-slate-700">대여 현황 조회</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200 animate-pulse">
                <div className="h-5 bg-slate-200 rounded w-1/3 mb-3" />
                <div className="h-4 bg-slate-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-slate-600 font-medium">{error}</p>
            <Link href="/rental" className="text-indigo-600 text-sm mt-3 inline-block hover:underline">
              대여 신청 페이지로
            </Link>
          </div>
        ) : data && (
          <div className="space-y-3">
            {/* Status header card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-slate-400 mb-1">신청 번호</p>
                  <p className="text-lg sm:text-xl font-bold text-indigo-600 tracking-wider">{data.request_number}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyLink}
                    title="링크 복사"
                    className={`p-1.5 rounded-lg border transition-all ${copied ? 'bg-green-50 border-green-200 text-green-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'}`}
                  >
                    {copied ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full ${STATUS_CONFIG[data.status]?.bg} ${STATUS_CONFIG[data.status]?.color}`}>
                    {STATUS_CONFIG[data.status]?.label}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                {data.equipment_image ? (
                  <img src={`data:${data.equipment_image_mime};base64,${data.equipment_image}`} alt={data.equipment_name} className="w-12 h-12 object-cover rounded-lg shrink-0" />
                ) : (
                  <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{data.equipment_name}</p>
                  {data.equipment_category && <p className="text-xs text-slate-400 mt-0.5">{data.equipment_category}</p>}
                </div>
              </div>
            </div>

            {/* Progress steps */}
            {data.status !== 'rejected' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between relative">
                  {(() => {
                    const currentStep = STATUS_CONFIG[data.status]?.step ?? 0;
                    const pct = Math.max(0, (currentStep - 1) / (steps.length - 1) * 100);
                    return (
                      <div className="absolute top-5 left-5 right-5 h-0.5 bg-slate-200 z-0">
                        <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    );
                  })()}
                  {steps.map((step, i) => {
                    const currentStep = STATUS_CONFIG[data.status]?.step ?? 0;
                    const isActive = i + 1 <= currentStep;
                    const isCurrent = i + 1 === currentStep;
                    return (
                      <div key={step.label} className="flex flex-col items-center relative z-10">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base border-2 transition-all
                          ${isActive ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-slate-300'}
                          ${isCurrent ? 'ring-4 ring-indigo-100' : ''}`}>
                          {step.icon}
                        </div>
                        <span className={`text-xs mt-2 font-medium text-center ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Rejection notice — visible before verification */}
            {data.status === 'rejected' && !data.verified && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-red-800 text-sm">대여 신청이 거절되었습니다</p>
                    <p className="text-sm text-red-600 mt-1">거절 사유는 연락처 인증 후 확인하실 수 있습니다.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Phone verification gate */}
            {!data.verified && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-slate-700">상세 내용 확인</h3>
                </div>
                <p className="text-sm text-slate-500 mb-3">신청 시 입력한 연락처 뒷 4자리를 입력하면 상세 내용을 확인할 수 있습니다.</p>
                <form onSubmit={handleVerify} className="flex gap-2">
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={e => setPhoneInput(e.target.value)}
                    placeholder="뒷 4자리"
                    maxLength={4}
                    style={{ fontSize: '16px' }}
                    className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center tracking-widest"
                  />
                  <button
                    type="submit"
                    disabled={verifying}
                    className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {verifying ? '확인 중...' : '확인'}
                  </button>
                </form>
                {verifyError && <p className="text-sm text-red-600 mt-2">{verifyError}</p>}
              </div>
            )}

            {/* Full details */}
            {full && (
              <>
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                  <h3 className="font-semibold text-slate-800 text-sm">신청 내용</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">신청자</p>
                      <p className="font-medium text-slate-800">{full.requester_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">신청일</p>
                      <p className="text-slate-700">{formatDate(full.created_at)}</p>
                    </div>
                    {full.rental_start_date && (
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">대여 시작</p>
                        <p className="text-slate-700">{formatRentalDate(full.rental_start_date)}</p>
                      </div>
                    )}
                    {full.rental_end_date && (
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">반납 예정</p>
                        <p className="text-slate-700">{formatRentalDate(full.rental_end_date)}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">사용 목적</p>
                    <p className="text-sm text-slate-800 break-words">{full.purpose}</p>
                  </div>
                  {full.requester_notes && (
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">메모</p>
                      <p className="text-sm text-slate-700 break-words">{full.requester_notes}</p>
                    </div>
                  )}
                  <PhotoBlock label="신청 사진" data={full.request_photo} mime={full.request_photo_mime} />
                </div>

                {(full.approved_at || full.rejected_at || full.returned_at || full.completed_at) && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                    <h3 className="font-semibold text-slate-800 text-sm">처리 이력</h3>

                    {full.rejected_at && (
                      <div className="p-3 bg-red-50 rounded-xl">
                        <p className="text-xs text-red-500 font-medium mb-1">거절 — {formatDate(full.rejected_at)}</p>
                        {full.rejection_notes && <p className="text-sm text-red-800 break-words">{full.rejection_notes}</p>}
                      </div>
                    )}
                    {full.approved_at && (
                      <div className="p-3 bg-blue-50 rounded-xl">
                        <p className="text-xs text-blue-500 font-medium mb-1">승인 — {formatDate(full.approved_at)}</p>
                        {full.approval_notes && <p className="text-sm text-blue-800 mb-2 break-words">{full.approval_notes}</p>}
                        <PhotoBlock label="승인 사진" data={full.approval_photo} mime={full.approval_photo_mime} />
                      </div>
                    )}
                    {full.returned_at && (
                      <div className="p-3 bg-purple-50 rounded-xl">
                        <p className="text-xs text-purple-500 font-medium mb-1">반납 완료 — {formatDate(full.returned_at)}</p>
                        {full.return_notes && <p className="text-sm text-purple-800 mb-2 break-words">{full.return_notes}</p>}
                        <PhotoBlock label="반납 사진" data={full.return_photo} mime={full.return_photo_mime} />
                      </div>
                    )}
                    {full.completed_at && (
                      <div className="p-3 bg-green-50 rounded-xl">
                        <p className="text-xs text-green-500 font-medium mb-1">반납 승인 — {formatDate(full.completed_at)}</p>
                        {full.completion_notes && <p className="text-sm text-green-800 mb-2 break-words">{full.completion_notes}</p>}
                        <PhotoBlock label="완료 사진" data={full.completion_photo} mime={full.completion_photo_mime} />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
