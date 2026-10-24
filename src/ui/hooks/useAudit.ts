import { useState, useEffect, useCallback } from 'react';
import { AuditLog } from '../../modules/types.ts';
import { api } from '../api.ts';

export function useAudit() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<AuditLog[]>('/api/v1/audit-logs');
    setLoading(false);

    if (res.data) {
      setLogs(res.data);
    } else if (res.error) {
      setError((res.error as any).detail || 'Error al cargar registros de auditoría');
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    loading,
    error,
    refreshLogs: fetchLogs,
  };
}
