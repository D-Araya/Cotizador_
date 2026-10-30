import { useState, useEffect, useCallback, useRef } from 'react';
import { OperationOrder } from '../../modules/types.ts';
import { api, subscribeToDomainSync, subscribeToAuthUserChange, notifyDomainSync } from '../api.ts';

export function useOperations() {
  const [operations, setOperations] = useState<OperationOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchOperations = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    setError(null);
    const res = await api.get<OperationOrder[]>('/api/v1/operations');
    if (!isMountedRef.current) return;
    if (!isBackground) {
      setLoading(false);
    }

    if (res.data) {
      setOperations(res.data);
    } else if (res.error && !isBackground) {
      setError((res.error as any).detail || 'Error al cargar órdenes de trabajo');
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchOperations(false);

    const unsubSync = subscribeToDomainSync(['operations', 'quotations'], () => {
      fetchOperations(true);
    });

    const unsubAuth = subscribeToAuthUserChange(() => {
      fetchOperations(false);
    });

    const handleFocus = () => {
      fetchOperations(true);
    };
    window.addEventListener('focus', handleFocus);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchOperations(true);
      }
    }, 5000);

    return () => {
      isMountedRef.current = false;
      unsubSync();
      unsubAuth();
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [fetchOperations]);

  const updateOperationInList = useCallback((updated: OperationOrder) => {
    setOperations((prev) =>
      prev.map((op) => (op.id === updated.id ? updated : op))
    );
    notifyDomainSync('operations', updated.id);
  }, []);

  return {
    operations,
    loading,
    error,
    refreshOperations: () => fetchOperations(false),
    updateOperationInList,
  };
}

