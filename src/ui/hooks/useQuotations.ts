import { useState, useEffect, useCallback } from 'react';
import { Quotation, QuotationKpis } from '../../modules/types.ts';
import { api } from '../api.ts';

export function useQuotations() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [kpis, setKpis] = useState<QuotationKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [qRes, kRes] = await Promise.all([
      api.get<Quotation[]>('/api/v1/quotations'),
      api.get<QuotationKpis>('/api/v1/quotations/kpis').catch(() => ({ data: undefined, status: 500 })),
    ]);

    setLoading(false);
    if (qRes.data) {
      setQuotations(qRes.data);
    } else if (qRes.error) {
      setError((qRes.error as any).detail || 'Error al cargar cotizaciones');
    }

    if (kRes?.data) {
      setKpis(kRes.data);
    }
  }, []);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  const updateQuotationInList = useCallback((updated: Quotation) => {
    setQuotations((prev) =>
      prev.map((q) => (q.id === updated.id ? updated : q))
    );
  }, []);

  const removeQuotationFromList = useCallback((id: string) => {
    setQuotations((prev) => prev.filter((q) => q.id !== id));
  }, []);

  return {
    quotations,
    setQuotations,
    kpis,
    loading,
    error,
    refreshQuotations: fetchQuotations,
    updateQuotationInList,
    removeQuotationFromList,
  };
}
