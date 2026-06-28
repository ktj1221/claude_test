'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface User {
  id: string;
  name: string;
  role: string;
  color: string;
}

interface UserContextValue {
  currentUser: User | null;
  allUsers: User[];
  setCurrentUser: (user: User | null) => void;
  refreshUsers: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  currentUser: null,
  allUsers: [],
  setCurrentUser: () => {},
  refreshUsers: async () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const refreshUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      const users = await res.json();
      setAllUsers(users);
    } catch {
      console.error('사용자 목록 로드 실패');
    }
  }, []);

  useEffect(() => {
    refreshUsers();
    const stored = localStorage.getItem('mockupgen_user');
    if (stored) {
      try {
        setCurrentUserState(JSON.parse(stored));
      } catch {
        localStorage.removeItem('mockupgen_user');
      }
    }
  }, [refreshUsers]);

  function setCurrentUser(user: User | null) {
    setCurrentUserState(user);
    if (user) {
      localStorage.setItem('mockupgen_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('mockupgen_user');
    }
  }

  return (
    <UserContext.Provider value={{ currentUser, allUsers, setCurrentUser, refreshUsers }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
