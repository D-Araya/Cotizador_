import { useState, useEffect, useCallback, useRef } from 'react';
import { AuditLog } from '../../modules/types.ts';
import { api, subscribeToDomainSync, subscribeToAuthUserChange } from '../api.ts';

export function useAudit() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchLogs = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    setError(null);
    const res = await api.get<AuditLog[]>('/api/v1/audit-logs');
    if (!isMountedRef.current) return;
    if (!isBackground) {
      setLoading(false);
    }

    if (res.data) {
      setLogs(res.data);
    } else if (res.error && !isBackground) {
      setError((res.error as any).detail || 'Error al cargar registros de auditoría');
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchLogs(false);

    const unsubSync = subscribeToDomainSync('all', () => {
      fetchLogs(true);
    });

    const unsubAuth = subscribeToAuthUserChange(() => {
      fetchLogs(false);
    });

    return () => {
      isMountedRef.current = false;
      unsubSync();
      unsubAuth();
    };
  }, [fetchLogs]);

  return {
    logs,
    loading,
    error,
    refreshLogs: () => fetchLogs(false),
  };
}

