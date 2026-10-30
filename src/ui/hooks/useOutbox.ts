import { useState, useEffect, useCallback, useRef } from 'react';
import { OutboxNotification } from '../../modules/types.ts';
import { api, subscribeToDomainSync, subscribeToAuthUserChange, notifyDomainSync } from '../api.ts';

export function useOutbox() {
  const [notifications, setNotifications] = useState<OutboxNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchOutbox = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    setError(null);
    const res = await api.get<OutboxNotification[]>('/api/v1/notifications/outbox');
    if (!isMountedRef.current) return;
    if (!isBackground) {
      setLoading(false);
    }

    if (res.data) {
      setNotifications(res.data);
    } else if (res.error && !isBackground) {
      setError((res.error as any).detail || 'Error al cargar bandeja de salida');
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchOutbox(false);

    const unsubSync = subscribeToDomainSync(['outbox', 'quotations', 'customers'], () => {
      fetchOutbox(true);
    });

    const unsubAuth = subscribeToAuthUserChange(() => {
      fetchOutbox(false);
    });

    return () => {
      isMountedRef.current = false;
      unsubSync();
      unsubAuth();
    };
  }, [fetchOutbox]);

  const updateNotificationInList = useCallback((updated: OutboxNotification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === updated.id ? updated : n))
    );
    notifyDomainSync('outbox', updated.id);
  }, []);

  return {
    notifications,
    loading,
    error,
    refreshOutbox: () => fetchOutbox(false),
    updateNotificationInList,
  };
}

