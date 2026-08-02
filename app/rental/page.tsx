'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Equipment {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  serial_number: string | null;
  image_data: string | null;
  image_mime: string;
  is_available: number;
}

export default function RentalPage() {
  const router = useRouter();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [form, setForm] = useState({
    requester_name: '',
    requester_phone: '',
    requester_email: '',
    purpose: '',
    rental_start_date: '',
    rental_end_date: '',
    requester_notes: '',
  });
  const [photo, setPhoto] = useState<{ data: string; mime: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ request_number: string } | null>(null);
  const [searchNumber, setSearchNumber] = useState('');
  const [copied, setCopied] = useState(false);
  const [equipError, setEquipError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().slice(0, 10);

  const fetchEquipment = useCallback(async () => {
    setEquipError(false);
    setLoading(true);
    try {
      const res = await fetch('/api/rental/equipment?available=true');
      if (!res.ok) { setEquipError(true); return; }
      const data = await res.json();
      setEquipment(Array.isArray(data) ? data : []);
    } catch {
      setEquipError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEquipment(); }, [fetchEquipment]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('사진 크기는 5MB 이하여야 합니다.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setPhoto({ data: base64, mime: file.type });
      setError('');
    };
    reader.readAsDataURL(file);
  }

  async function submitForm() {
    if (!selected) return;
    setError('');

    if (!form.requester_name.trim() || !form.requester_phone.trim() || !form.purpose.trim()) {
      setError('이름, 연락처, 사용 목적은 필수 입력 항목입니다.');
      return;
    }
    if (form.rental_start_date && form.rental_end_date && form.rental_end_date < form.rental_start_date) {
      setError('반납 예정일은 대여 시작일 이후여야 합니다.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/rental/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipment_id: selected.id,
          ...form,
          request_photo: photo?.data || null,
          request_photo_mime: photo?.mime || 'image/jpeg',
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '신청 실패'); return; }
      setResult({ request_number: data.request_number });
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitForm();
  }

  function resetForm() {
    setResult(null);
    setSelected(null);
    setPhoto(null);
    setError('');
    setForm({ requester_name: '', requester_phone: '', requester_email: '', purpose: '', rental_start_date: '', rental_end_date: '', requester_notes: '' });
    fetchEquipment();
  }

  if (result) {
    const statusUrl = typeof window !== 'undefined' ? `${window.location.origin}/rental/${result.request_number}` : `/rental/${result.request_number}`;
    function copyLink() {
      navigator.clipboard.writeText(statusUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">신청 완료!</h2>
          <p className="text-slate-500 mb-5 text-sm">관리자 승인 후 이용 가능합니다.</p>
          <div className="bg-slate-50 rounded-xl p-4 mb-4">
            <p className="text-xs text-slate-400 mb-1">신청 번호</p>
            <p className="text-2xl font-bold text-indigo-600 tracking-wider">{result.request_number}</p>
          </div>
          <p className="text-xs text-slate-400 mb-4">아래 링크를 저장하면 언제든지 현황을 확인할 수 있습니다.</p>
          {/* Copy status URL */}
          <button
            onClick={copyLink}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 mb-4 border rounded-xl text-sm font-medium transition-all ${
              copied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {copied ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                링크가 복사됐습니다
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                현황 링크 복사
              </>
            )}
          </button>
          <div className="space-y-3">
            <Link
              href={`/rental/${result.request_number}`}
              className="block w-full px-4 py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors text-base"
            >
              현황 확인하기
            </Link>
            <button
              onClick={resetForm}
              className="block w-full px-4 py-3.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors text-base"
            >
              다른 장비 신청
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base sm:text-xl font-bold text-slate-900">아이디어 그라운드</h1>
            <p className="text-xs text-slate-400 hidden sm:block">장비 대여 신청</p>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); if (searchNumber.trim()) router.push(`/rental/${encodeURIComponent(searchNumber.trim())}`); }}
            className="flex gap-2 flex-1 max-w-xs sm:max-w-sm"
          >
            <input
              value={searchNumber}
              onChange={(e) => setSearchNumber(e.target.value)}
              placeholder="신청번호 조회"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-0 text-base"
              style={{ fontSize: '16px' }}
            />
            <button type="submit" className="px-3 py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-800 shrink-0">
              조회
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        {!selected ? (
          <>
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-800 mb-1">대여 가능한 장비</h2>
              <p className="text-sm text-slate-500">대여할 장비를 선택하세요.</p>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 animate-pulse h-36 sm:h-44" />
                ))}
              </div>
            ) : equipError ? (
              <div className="text-center py-20 text-slate-400">
                <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="font-medium text-slate-500 mb-3">목록을 불러오지 못했습니다.</p>
                <button onClick={fetchEquipment} className="text-sm text-indigo-600 font-medium underline">다시 시도</button>
              </div>
            ) : equipment.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p className="font-medium">현재 대여 가능한 장비가 없습니다.</p>
                <p className="text-sm mt-1">잠시 후 다시 확인해주세요.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {equipment.map(eq => (
                  <button
                    key={eq.id}
                    onClick={() => setSelected(eq)}
                    className="group bg-white rounded-xl p-4 border border-slate-200 hover:border-indigo-400 hover:shadow-md active:scale-[0.99] transition-all text-left"
                  >
                    {eq.image_data && (
                      <img
                        src={`data:${eq.image_mime};base64,${eq.image_data}`}
                        alt={eq.name}
                        className="w-full h-32 sm:h-36 object-cover rounded-lg mb-3"
                      />
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 group-hover:text-indigo-700 truncate">{eq.name}</h3>
                        {eq.category && <p className="text-xs text-slate-400 mt-0.5">{eq.category}</p>}
                        {eq.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{eq.description}</p>}
                      </div>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full shrink-0">대여 가능</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => { setSelected(null); setPhoto(null); setError(''); }}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-5 py-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              장비 목록으로
            </button>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 mb-24 sm:mb-0">
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
                {selected.image_data ? (
                  <img
                    src={`data:${selected.image_mime};base64,${selected.image_data}`}
                    alt={selected.name}
                    className="w-14 h-14 object-cover rounded-xl shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-slate-900">{selected.name}</h3>
                  {selected.category && <p className="text-xs text-slate-400">{selected.category}</p>}
                </div>
              </div>

              <h2 className="text-base font-semibold text-slate-800 mb-4">대여 신청서</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      이름 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.requester_name}
                      onChange={e => setForm(f => ({ ...f, requester_name: e.target.value }))}
                      placeholder="홍길동"
                      maxLength={100}
                      autoComplete="name"
                      style={{ fontSize: '16px' }}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      연락처 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={form.requester_phone}
                      onChange={e => setForm(f => ({ ...f, requester_phone: e.target.value }))}
                      placeholder="010-0000-0000"
                      maxLength={20}
                      autoComplete="tel"
                      style={{ fontSize: '16px' }}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">이메일</label>
                  <input
                    type="email"
                    value={form.requester_email}
                    onChange={e => setForm(f => ({ ...f, requester_email: e.target.value }))}
                    placeholder="example@email.com"
                    maxLength={200}
                    autoComplete="email"
                    style={{ fontSize: '16px' }}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    사용 목적 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={form.purpose}
                    onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                    placeholder="장비 사용 목적을 간략히 설명해주세요."
                    rows={3}
                    maxLength={1000}
                    style={{ fontSize: '16px' }}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">대여 시작일</label>
                    <input
                      type="date"
                      value={form.rental_start_date}
                      min={today}
                      onChange={e => setForm(f => ({ ...f, rental_start_date: e.target.value }))}
                      style={{ fontSize: '16px' }}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">반납 예정일</label>
                    <input
                      type="date"
                      value={form.rental_end_date}
                      min={form.rental_start_date || today}
                      onChange={e => setForm(f => ({ ...f, rental_end_date: e.target.value }))}
                      style={{ fontSize: '16px' }}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">신청 사진</label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-400 active:border-indigo-600 transition-colors"
                  >
                    {photo ? (
                      <img
                        src={`data:${photo.mime};base64,${photo.data}`}
                        alt="신청 사진"
                        className="max-h-44 mx-auto rounded-lg object-contain"
                      />
                    ) : (
                      <div className="text-slate-400 py-2">
                        <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-sm font-medium">카메라로 촬영 또는 사진 선택</p>
                        <p className="text-xs mt-1">최대 5MB</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                  {photo && (
                    <button type="button" onClick={() => setPhoto(null)} className="text-xs text-red-500 mt-1.5 hover:underline">
                      사진 제거
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">기타 메모</label>
                  <textarea
                    value={form.requester_notes}
                    onChange={e => setForm(f => ({ ...f, requester_notes: e.target.value }))}
                    placeholder="추가 전달 사항"
                    rows={2}
                    maxLength={500}
                    style={{ fontSize: '16px' }}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2.5 rounded-lg">{error}</p>}

                {/* Desktop submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="hidden sm:block w-full py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors text-base"
                >
                  {submitting ? '신청 중...' : '대여 신청하기'}
                </button>
              </form>
            </div>

            {/* Mobile sticky submit */}
            <div className="fixed bottom-0 left-0 right-0 sm:hidden bg-white border-t border-slate-200 p-4 z-20">
              {error && <p className="text-sm text-red-600 mb-3 text-center">{error}</p>}
              <button
                onClick={submitForm}
                disabled={submitting}
                className="w-full py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors text-base"
              >
                {submitting ? '신청 중...' : '대여 신청하기'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
