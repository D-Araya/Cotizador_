import { useState, useEffect, useCallback } from 'react';
import { DashboardSummary, SalesRepSummary } from '../../modules/types.ts';
import { api } from '../api.ts';

export function useDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [salesReps, setSalesReps] = useState<SalesRepSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [sumRes, repsRes] = await Promise.all([
      api.get<DashboardSummary>('/api/v1/dashboard/summary'),
      api.get<SalesRepSummary[]>('/api/v1/dashboard/sales-reps').catch(() => ({ data: undefined, status: 500 })),
    ]);

    setLoading(false);
    if (sumRes.data) {
      setSummary(sumRes.data);
    } else if (sumRes.error) {
      setError((sumRes.error as any).detail || 'Error al cargar resumen del dashboard');
    }

    if (repsRes?.data) {
      setSalesReps(repsRes.data);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    summary,
    salesReps,
    loading,
    error,
    refreshDashboard: fetchDashboard,
  };
}
