import { useState, useEffect, useCallback } from 'react';
import { Invoice } from '../../modules/types.ts';
import { api } from '../api.ts';

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<Invoice[]>('/api/v1/invoices');
    setLoading(false);

    if (res.data) {
      setInvoices(res.data);
    } else if (res.error) {
      setError((res.error as any).detail || 'Error al cargar documentos de cobro');
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const updateInvoiceInList = useCallback((updated: Invoice) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === updated.id ? updated : inv))
    );
  }, []);

  return {
    invoices,
    loading,
    error,
    refreshInvoices: fetchInvoices,
    updateInvoiceInList,
  };
}
