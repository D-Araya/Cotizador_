import { useState, useEffect, useCallback } from 'react';
import { OutboxNotification } from '../../modules/types.ts';
import { api } from '../api.ts';

export function useOutbox() {
  const [notifications, setNotifications] = useState<OutboxNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOutbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<OutboxNotification[]>('/api/v1/notifications/outbox');
    setLoading(false);

    if (res.data) {
      setNotifications(res.data);
    } else if (res.error) {
      setError((res.error as any).detail || 'Error al cargar bandeja de salida');
    }
  }, []);

  useEffect(() => {
    fetchOutbox();
  }, [fetchOutbox]);

  const updateNotificationInList = useCallback((updated: OutboxNotification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === updated.id ? updated : n))
    );
  }, []);

  return {
    notifications,
    loading,
    error,
    refreshOutbox: fetchOutbox,
    updateNotificationInList,
  };
}
