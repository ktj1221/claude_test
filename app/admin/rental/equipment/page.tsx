'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  created_at: string;
}

const EMPTY_FORM = { name: '', description: '', category: '', serial_number: '' };

export default function AdminEquipmentPage() {
  const router = useRouter();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Equipment | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photo, setPhoto] = useState<{ data: string; mime: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchEquipment = useCallback(async () => {
    setFetchError('');
    setLoading(true);
    try {
      const res = await fetch('/api/rental/equipment');
      if (res.status === 401) { router.push('/admin/rental/login'); return; }
      if (!res.ok) { setFetchError('목록을 불러오지 못했습니다.'); return; }
      const data = await res.json();
      setEquipment(Array.isArray(data) ? data : []);
    } catch {
      setFetchError('목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Single fetch — 401 redirects to login, no redundant auth check
  useEffect(() => { fetchEquipment(); }, [fetchEquipment]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (deleteConfirm) { setDeleteConfirm(null); }
        else if (showForm && !saving) { setShowForm(false); }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteConfirm, showForm, saving]);

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setPhoto(null);
    setError('');
    setShowForm(true);
  }

  function openEdit(eq: Equipment) {
    setEditTarget(eq);
    setForm({
      name: eq.name,
      description: eq.description || '',
      category: eq.category || '',
      serial_number: eq.serial_number || '',
    });
    setPhoto(eq.image_data ? { data: eq.image_data, mime: eq.image_mime } : null);
    setError('');
    setShowForm(true);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('사진은 5MB 이하여야 합니다.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      setPhoto({ data: src.split(',')[1], mime: file.type });
      setError('');
    };
    reader.readAsDataURL(file);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('장비 이름을 입력해주세요.'); return; }
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        image_data: photo?.data ?? null,
        image_mime: photo?.mime ?? 'image/jpeg',
        // Preserve current availability when editing (don't reset via PUT default)
        is_available: editTarget ? editTarget.is_available : 1,
      };
      const url = editTarget ? `/api/rental/equipment/${editTarget.id}` : '/api/rental/equipment';
      const method = editTarget ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) { router.push('/admin/rental/login'); return; }
      const data = await res.json();
      if (!res.ok) { setError(data.error || '저장 실패'); return; }
      setShowForm(false);
      fetchEquipment();
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleteError('');
    setDeleting(true);
    try {
      const res = await fetch(`/api/rental/equipment/${id}`, { method: 'DELETE' });
      if (res.status === 401) { router.push('/admin/rental/login'); return; }
      const data = await res.json();
      if (!res.ok) { setDeleteError(data.error || '삭제 실패'); return; }
      setDeleteConfirm(null);
      fetchEquipment();
    } catch {
      setDeleteError('네트워크 오류가 발생했습니다.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/rental/auth', { method: 'DELETE' });
    router.push('/admin/rental/login');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
              <span className="hidden sm:inline">아이디어 그라운드 </span>장비 관리
            </h1>
            <nav className="flex items-center gap-1">
              <Link href="/admin/rental" className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 text-xs sm:text-sm rounded-lg transition-colors">
                대여
              </Link>
              <span className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 text-xs sm:text-sm font-medium rounded-lg">장비</span>
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 min-h-[40px]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">장비 추가</span>
              <span className="sm:hidden">추가</span>
            </button>
            <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-red-500 transition-colors py-1">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 sm:py-6">
        {fetchError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-3">
            <p className="text-sm text-red-700">{fetchError}</p>
            <button onClick={fetchEquipment} className="text-xs text-red-600 font-medium underline shrink-0">다시 시도</button>
          </div>
        )}
        {!loading && !fetchError && equipment.length > 0 && (
          <p className="text-xs text-slate-400 mb-3">
            전체 {equipment.length}개 · 대여 가능 {equipment.filter(e => e.is_available).length}개 · 대여 중 {equipment.filter(e => !e.is_available).length}개
          </p>
        )}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {[1, 2, 3].map(i => <div key={i} className="bg-white rounded-xl h-52 border border-slate-200 animate-pulse" />)}
          </div>
        ) : equipment.length === 0 ? (
          <div className="text-center py-20">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-slate-400 mb-4">등록된 장비가 없습니다.</p>
            <button onClick={openAdd} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 min-h-[44px]">
              첫 장비 추가
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {equipment.map(eq => (
              <div key={eq.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                {eq.image_data ? (
                  <img
                    src={`data:${eq.image_mime};base64,${eq.image_data}`}
                    alt={eq.name}
                    className="w-full h-40 sm:h-44 object-cover"
                  />
                ) : (
                  <div className="w-full h-40 sm:h-44 bg-slate-100 flex items-center justify-center">
                    <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-1 gap-2">
                    <h3 className="font-semibold text-slate-900 min-w-0 truncate">{eq.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${eq.is_available ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {eq.is_available ? '대여 가능' : '대여 중'}
                    </span>
                  </div>
                  {eq.category && <p className="text-xs text-slate-400 mb-1">{eq.category}</p>}
                  {eq.description && <p className="text-sm text-slate-500 line-clamp-2 mb-2">{eq.description}</p>}
                  {eq.serial_number && <p className="text-xs text-slate-400">S/N: {eq.serial_number}</p>}

                  <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                    {!eq.is_available && (
                      <Link
                        href={`/admin/rental?q=${encodeURIComponent(eq.name)}`}
                        className="flex-1 py-2 text-xs font-medium text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 text-center min-h-[40px] flex items-center justify-center"
                      >
                        대여 현황
                      </Link>
                    )}
                    <button
                      onClick={() => openEdit(eq)}
                      className="flex-1 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 min-h-[40px]"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => { setDeleteConfirm(eq.id); setDeleteError(''); }}
                      className="flex-1 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 min-h-[40px]"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add/Edit form — bottom sheet on mobile, centered on desktop */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
          onClick={() => { if (!saving) setShowForm(false); }}
        >
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-slate-900">{editTarget ? '장비 수정' : '장비 추가'}</h2>
              <button onClick={() => setShowForm(false)} aria-label="닫기" className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">장비명 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="예: Canon EOS R5"
                  autoFocus
                  maxLength={100}
                  style={{ fontSize: '16px' }}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">카테고리</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="예: 카메라, 노트북, 마이크"
                  maxLength={50}
                  style={{ fontSize: '16px' }}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">설명</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="장비에 대한 설명"
                  rows={3}
                  maxLength={1000}
                  style={{ fontSize: '16px' }}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">시리얼 번호</label>
                <input
                  type="text"
                  value={form.serial_number}
                  onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
                  placeholder="장비 시리얼 번호"
                  maxLength={100}
                  style={{ fontSize: '16px' }}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">장비 사진</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-400 active:border-indigo-600 transition-colors"
                >
                  {photo ? (
                    <img
                      src={`data:${photo.mime};base64,${photo.data}`}
                      alt="장비 사진"
                      className="max-h-44 mx-auto rounded-lg object-contain"
                    />
                  ) : (
                    <div className="text-slate-400 py-3">
                      <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-sm font-medium">카메라 촬영 또는 사진 선택</p>
                      <p className="text-xs mt-1">최대 5MB</p>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                {photo && (
                  <button type="button" onClick={() => setPhoto(null)} className="text-xs text-red-500 mt-1.5 hover:underline">
                    사진 제거
                  </button>
                )}
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2.5 rounded-lg">{error}</p>}

              <div className="flex gap-3 pb-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-3 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 min-h-[48px]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60 min-h-[48px]"
                >
                  {saving ? '저장 중...' : (editTarget ? '수정 완료' : '장비 추가')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => { if (!deleting) setDeleteConfirm(null); }}
        >
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900 mb-2">장비 삭제</h3>
            <p className="text-sm text-slate-500 mb-4">이 장비를 삭제하시겠습니까? 진행 중인 대여가 있으면 삭제할 수 없습니다.</p>
            {deleteError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">{deleteError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 min-h-[48px]"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="flex-1 py-3 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-60 min-h-[48px]"
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
