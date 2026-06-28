'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useUser } from '../contexts/UserContext';
import { Avatar } from './Avatar';

interface HeaderProps {
  breadcrumb?: { label: string; href?: string }[];
}

export function Header({ breadcrumb }: HeaderProps) {
  const { currentUser, allUsers, setCurrentUser, refreshUsers } = useUser();
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, role: newRole }),
      });
      const user = await res.json();
      if (res.ok) {
        await refreshUsers();
        setCurrentUser(user);
        setNewName('');
        setNewRole('');
        setShowCreateUser(false);
        setShowUserPanel(false);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="px-6 h-14 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="font-bold text-slate-900 text-sm">MockupGen</span>
        </Link>

        {breadcrumb && breadcrumb.length > 0 && (
          <>
            {breadcrumb.map((item, i) => (
              <span key={i} className="flex items-center gap-2 min-w-0">
                <span className="text-slate-300 text-sm">/</span>
                {item.href ? (
                  <Link href={item.href} className="text-sm text-slate-500 hover:text-slate-900 truncate max-w-[200px]">
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-sm font-medium text-slate-800 truncate max-w-[200px]">{item.label}</span>
                )}
              </span>
            ))}
          </>
        )}

        <div className="ml-auto relative">
          <button
            onClick={() => setShowUserPanel(!showUserPanel)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            {currentUser ? (
              <>
                <Avatar name={currentUser.name} color={currentUser.color} size="sm" />
                <span className="text-sm font-medium text-slate-700 hidden sm:block">{currentUser.name}</span>
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="text-sm text-slate-500 hidden sm:block">사용자 선택</span>
              </>
            )}
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showUserPanel && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
              <div className="p-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">사용자 전환</p>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {allUsers.length === 0 ? (
                  <p className="text-xs text-slate-400 px-3 py-2">등록된 사용자가 없습니다.</p>
                ) : (
                  allUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => { setCurrentUser(user); setShowUserPanel(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition-colors text-left ${currentUser?.id === user.id ? 'bg-indigo-50' : ''}`}
                    >
                      <Avatar name={user.name} color={user.color} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
                        {user.role && user.role !== 'member' && (
                          <p className="text-xs text-slate-400 truncate">{user.role}</p>
                        )}
                      </div>
                      {currentUser?.id === user.id && (
                        <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))
                )}
              </div>
              <div className="p-2 border-t border-slate-100">
                {showCreateUser ? (
                  <form onSubmit={handleCreateUser} className="space-y-2">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="이름"
                      autoFocus
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      placeholder="직책/부서 (선택)"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowCreateUser(false)}
                        className="flex-1 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        disabled={creating}
                        className="flex-1 py-1.5 text-xs text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {creating ? '...' : '추가'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowCreateUser(true)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    새 사용자 추가
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
