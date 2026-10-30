import { useState, useEffect, useCallback, useRef } from 'react';
import { Quotation, QuotationKpis } from '../../modules/types.ts';
import { api, subscribeToDomainSync, subscribeToAuthUserChange, notifyQuotationSync } from '../api.ts';

export function useQuotations() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [kpis, setKpis] = useState<QuotationKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchQuotations = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    } else {
      setIsSyncing(true);
    }
    setError(null);

    try {
      const [qRes, kRes] = await Promise.all([
        api.get<Quotation[]>('/api/v1/quotations'),
        api.get<QuotationKpis>('/api/v1/quotations/kpis').catch(() => ({ data: undefined, status: 500 })),
      ]);

      if (!isMountedRef.current) return;

      if (qRes.data) {
        setQuotations(qRes.data);
        setLastSyncTime(new Date());
      } else if (qRes.error && !isBackground) {
        setError((qRes.error as any).detail || 'Error al cargar cotizaciones');
      }

      if (kRes?.data) {
        setKpis(kRes.data);
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      if (!isBackground) {
        setError(err.message || 'Error de sincronización');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setIsSyncing(false);
      }
    }
  }, []);

  // Initial fetch and synchronization listeners
  useEffect(() => {
    isMountedRef.current = true;
    fetchQuotations(false);

    // Subscribe to cross-tab / cross-component sync events
    const unsubscribe = subscribeToDomainSync(['quotations', 'company'], () => {
      fetchQuotations(true);
    });

    // Re-hydrate immediately when active user/role changes in the tab
    const unsubscribeAuth = subscribeToAuthUserChange(() => {
      fetchQuotations(false);
    });

    // Auto-refresh when tab/window gains focus
    const handleFocus = () => {
      fetchQuotations(true);
    };
    window.addEventListener('focus', handleFocus);

    // Periodic synchronization polling (every 4 seconds) to ensure real-time status across portals
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchQuotations(true);
      }
    }, 4000);

    return () => {
      isMountedRef.current = false;
      unsubscribe();
      unsubscribeAuth();
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [fetchQuotations]);

  const updateQuotationInList = useCallback((updated: Quotation) => {
    setQuotations((prev) =>
      prev.map((q) => (q.id === updated.id ? updated : q))
    );
    notifyQuotationSync();
  }, []);

  const removeQuotationFromList = useCallback((id: string) => {
    setQuotations((prev) => prev.filter((q) => q.id !== id));
    notifyQuotationSync();
  }, []);

  return {
    quotations,
    setQuotations,
    kpis,
    loading,
    isSyncing,
    lastSyncTime,
    error,
    refreshQuotations: () => fetchQuotations(false),
    updateQuotationInList,
    removeQuotationFromList,
  };
}
