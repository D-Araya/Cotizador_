import { useState, useEffect, useCallback } from 'react';
import { User } from '../../modules/types.ts';
import { api } from '../api.ts';

export function useTeam(isAdmin: boolean = false) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    const res = await api.get<User[]>('/api/v1/users');
    setLoading(false);

    if (res.data) {
      setUsers(res.data);
    } else if (res.error) {
      setError((res.error as any).detail || 'Error al cargar equipo');
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin, fetchUsers]);

  const updateUserInList = useCallback((updated: User) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updated.id ? updated : u))
    );
  }, []);

  const addUserToList = useCallback((newUser: User) => {
    setUsers((prev) => [newUser, ...prev]);
  }, []);

  const removeUserFromList = useCallback((id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }, []);

  return {
    users,
    loading,
    error,
    refreshUsers: fetchUsers,
    updateUserInList,
    addUserToList,
    removeUserFromList,
  };
}
