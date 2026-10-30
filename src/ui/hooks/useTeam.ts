import { useState, useEffect, useCallback, useRef } from 'react';
import { User } from '../../modules/types.ts';
import { api, subscribeToDomainSync, subscribeToAuthUserChange, notifyDomainSync } from '../api.ts';

export function useTeam(isAdmin: boolean = false) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchUsers = useCallback(async (isBackground = false) => {
    if (!isAdmin) return;
    if (!isBackground) {
      setLoading(true);
    }
    setError(null);
    const res = await api.get<User[]>('/api/v1/users');
    if (!isMountedRef.current) return;
    if (!isBackground) {
      setLoading(false);
    }

    if (res.data) {
      setUsers(res.data);
    } else if (res.error && !isBackground) {
      setError((res.error as any).detail || 'Error al cargar equipo');
    }
  }, [isAdmin]);

  useEffect(() => {
    isMountedRef.current = true;
    if (isAdmin) {
      fetchUsers(false);
    }

    const unsubSync = subscribeToDomainSync(['users'], () => {
      if (isAdmin) fetchUsers(true);
    });

    const unsubAuth = subscribeToAuthUserChange(() => {
      if (isAdmin) fetchUsers(false);
    });

    return () => {
      isMountedRef.current = false;
      unsubSync();
      unsubAuth();
    };
  }, [isAdmin, fetchUsers]);

  const updateUserInList = useCallback((updated: User) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updated.id ? updated : u))
    );
    notifyDomainSync('users', updated.id);
  }, []);

  const addUserToList = useCallback((newUser: User) => {
    setUsers((prev) => [newUser, ...prev]);
    notifyDomainSync('users', newUser.id);
  }, []);

  const removeUserFromList = useCallback((id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    notifyDomainSync('users', id);
  }, []);

  return {
    users,
    loading,
    error,
    refreshUsers: () => fetchUsers(false),
    updateUserInList,
    addUserToList,
    removeUserFromList,
  };
}

