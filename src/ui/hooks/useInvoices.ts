import { useState, useEffect, useCallback, useRef } from 'react';
import { Invoice } from '../../modules/types.ts';
import { api, subscribeToDomainSync, subscribeToAuthUserChange, notifyDomainSync } from '../api.ts';

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchInvoices = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    setError(null);
    const res = await api.get<Invoice[]>('/api/v1/invoices');
    if (!isMountedRef.current) return;
    if (!isBackground) {
      setLoading(false);
    }

    if (res.data) {
      setInvoices(res.data);
    } else if (res.error && !isBackground) {
      setError((res.error as any).detail || 'Error al cargar documentos de cobro');
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchInvoices(false);

    const unsubSync = subscribeToDomainSync(['invoices', 'quotations'], () => {
      fetchInvoices(true);
    });

    const unsubAuth = subscribeToAuthUserChange(() => {
      fetchInvoices(false);
    });

    const handleFocus = () => {
      fetchInvoices(true);
    };
    window.addEventListener('focus', handleFocus);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchInvoices(true);
      }
    }, 5000);

    return () => {
      isMountedRef.current = false;
      unsubSync();
      unsubAuth();
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [fetchInvoices]);

  const updateInvoiceInList = useCallback((updated: Invoice) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === updated.id ? updated : inv))
    );
    notifyDomainSync('invoices', updated.id);
  }, []);

  return {
    invoices,
    loading,
    error,
    refreshInvoices: () => fetchInvoices(false),
    updateInvoiceInList,
  };
}

