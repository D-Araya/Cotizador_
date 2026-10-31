import { useState, useEffect, useCallback, useRef } from 'react';
import { OperationOrder } from '../../modules/types.ts';
import { api, subscribeToDomainSync, subscribeToAuthUserChange, notifyDomainSync } from '../api.ts';

export const OPERATIONS_STORAGE_KEY = 'cotizador_operations_cache';

function readCachedOperations(): OperationOrder[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage?.getItem(OPERATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCachedOperations(list: OperationOrder[]): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage?.setItem(OPERATIONS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage quota errors
  }
}

export function useOperations() {
  const [operations, setOperations] = useState<OperationOrder[]>(() => readCachedOperations());
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

    if (res.data && Array.isArray(res.data)) {
      setOperations(res.data);
      writeCachedOperations(res.data);
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

    const handleStorage = (e: StorageEvent) => {
      if (e.key === OPERATIONS_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setOperations(parsed);
          }
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorage);

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
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [fetchOperations]);

  const updateOperationInList = useCallback((updated: OperationOrder) => {
    setOperations((prev) => {
      const exists = prev.some((op) => op.id === updated.id);
      const nextList = exists
        ? prev.map((op) => (op.id === updated.id ? { ...updated } : op))
        : [{ ...updated }, ...prev];
      writeCachedOperations(nextList);
      return nextList;
    });
    notifyDomainSync('operations', updated.id);
  }, []);

  return {
    operations,
    loading,
    error,
    refreshOperations: () => fetchOperations(true),
    updateOperationInList,
  };
}


