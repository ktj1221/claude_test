'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:   { label: '검토 중',    color: 'bg-yellow-100 text-yellow-800' },
  approved:  { label: '승인됨',     color: 'bg-blue-100 text-blue-800' },
  returned:  { label: '반납 완료',  color: 'bg-purple-100 text-purple-800' },
  completed: { label: '대여 종료',  color: 'bg-green-100 text-green-800' },
  rejected:  { label: '거절됨',     color: 'bg-red-100 text-red-800' },
};

export default function RentalPage() {
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
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchEquipment = useCallback(async () => {
    try {
      const res = await fetch('/api/rental/equipment?available=true');
      setEquipment(await res.json());
    } catch {
      console.error('장비 목록 로드 실패');
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
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError('');

    if (!form.requester_name.trim() || !form.requester_phone.trim() || !form.purpose.trim()) {
      setError('이름, 연락처, 사용 목적은 필수 입력 항목입니다.');
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

  if (result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">신청 완료!</h2>
          <p className="text-slate-500 mb-6">대여 신청이 접수되었습니다. 관리자 승인 후 이용 가능합니다.</p>
          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <p className="text-xs text-slate-400 mb-1">신청 번호</p>
            <p className="text-2xl font-bold text-indigo-600 tracking-wider">{result.request_number}</p>
          </div>
          <div className="space-y-3">
            <Link
              href={`/rental/${result.request_number}`}
              className="block w-full px-4 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors"
            >
              현황 확인하기
            </Link>
            <button
              onClick={() => { setResult(null); setSelected(null); setPhoto(null); setForm({ requester_name: '', requester_phone: '', requester_email: '', purpose: '', rental_start_date: '', rental_end_date: '', requester_notes: '' }); fetchEquipment(); }}
              className="block w-full px-4 py-3 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
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
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">아이디어 그라운드 장비 대여</h1>
            <p className="text-xs text-slate-400 mt-0.5">Idea Ground Equipment Rental</p>
          </div>
          <div className="flex items-center gap-3">
            <form
              onSubmit={(e) => { e.preventDefault(); if (searchNumber.trim()) window.location.href = `/rental/${searchNumber.trim()}`; }}
              className="flex gap-2"
            >
              <input
                value={searchNumber}
                onChange={(e) => setSearchNumber(e.target.value)}
                placeholder="신청번호 조회 (IG-...)"
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52"
              />
              <button type="submit" className="px-3 py-1.5 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-800">
                조회
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {!selected ? (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-1">대여 가능한 장비</h2>
              <p className="text-sm text-slate-500">대여할 장비를 선택하세요.</p>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-white rounded-xl p-5 border border-slate-200 animate-pulse h-40" />
                ))}
              </div>
            ) : equipment.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p className="font-medium">현재 대여 가능한 장비가 없습니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {equipment.map(eq => (
                  <button
                    key={eq.id}
                    onClick={() => setSelected(eq)}
                    className="group bg-white rounded-xl p-5 border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all text-left"
                  >
                    {eq.image_data && (
                      <img
                        src={`data:${eq.image_mime};base64,${eq.image_data}`}
                        alt={eq.name}
                        className="w-full h-36 object-cover rounded-lg mb-3"
                      />
                    )}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900 group-hover:text-indigo-700">{eq.name}</h3>
                        {eq.category && <p className="text-xs text-slate-400 mt-0.5">{eq.category}</p>}
                        {eq.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{eq.description}</p>}
                        {eq.serial_number && <p className="text-xs text-slate-400 mt-1">S/N: {eq.serial_number}</p>}
                      </div>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full shrink-0 ml-2">대여 가능</span>
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
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              장비 목록으로
            </button>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-4">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                {selected.image_data ? (
                  <img
                    src={`data:${selected.image_mime};base64,${selected.image_data}`}
                    alt={selected.name}
                    className="w-16 h-16 object-cover rounded-xl"
                  />
                ) : (
                  <div className="w-16 h-16 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">이름 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={form.requester_name}
                      onChange={e => setForm(f => ({ ...f, requester_name: e.target.value }))}
                      placeholder="홍길동"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">연락처 <span className="text-red-500">*</span></label>
                    <input
                      type="tel"
                      value={form.requester_phone}
                      onChange={e => setForm(f => ({ ...f, requester_phone: e.target.value }))}
                      placeholder="010-0000-0000"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">이메일</label>
                  <input
                    type="email"
                    value={form.requester_email}
                    onChange={e => setForm(f => ({ ...f, requester_email: e.target.value }))}
                    placeholder="example@email.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">사용 목적 <span className="text-red-500">*</span></label>
                  <textarea
                    value={form.purpose}
                    onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                    placeholder="장비 사용 목적을 간략히 설명해주세요."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">대여 시작일</label>
                    <input
                      type="date"
                      value={form.rental_start_date}
                      onChange={e => setForm(f => ({ ...f, rental_start_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">반납 예정일</label>
                    <input
                      type="date"
                      value={form.rental_end_date}
                      onChange={e => setForm(f => ({ ...f, rental_end_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">신청 사진</label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-400 transition-colors"
                  >
                    {photo ? (
                      <img
                        src={`data:${photo.mime};base64,${photo.data}`}
                        alt="신청 사진"
                        className="max-h-40 mx-auto rounded-lg object-contain"
                      />
                    ) : (
                      <div className="text-slate-400">
                        <svg className="w-8 h-8 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-sm">사진 촬영 또는 업로드 (최대 5MB)</p>
                      </div>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
                  {photo && (
                    <button type="button" onClick={() => setPhoto(null)} className="text-xs text-red-500 mt-1 hover:underline">
                      사진 제거
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">기타 메모</label>
                  <textarea
                    value={form.requester_notes}
                    onChange={e => setForm(f => ({ ...f, requester_notes: e.target.value }))}
                    placeholder="추가 전달 사항이 있다면 입력해주세요."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                >
                  {submitting ? '신청 중...' : '대여 신청하기'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
