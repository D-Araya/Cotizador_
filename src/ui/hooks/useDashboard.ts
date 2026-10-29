import { useState, useEffect, useCallback } from 'react';
import { DashboardSummary, SalesRepSummary, User } from '../../modules/types.ts';
import { hasPermission } from '../../shared-kernel/permissions.ts';
import { api } from '../api.ts';

export function useDashboard(user?: User | null) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [salesReps, setSalesReps] = useState<SalesRepSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canViewBySalesRep = Boolean(
    user && user.role === 'ADMIN' && hasPermission(user, 'dashboard:by_sales_rep')
  );

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    const sumPromise = api.get<DashboardSummary>('/api/v1/dashboard/summary');
    const repsPromise = canViewBySalesRep
      ? api
          .get<SalesRepSummary[]>('/api/v1/dashboard/by-sales-rep')
          .catch(() => ({ data: undefined, status: 500 }))
      : Promise.resolve({ data: [] as SalesRepSummary[], status: 200 });

    const [sumRes, repsRes] = await Promise.all([sumPromise, repsPromise]);

    setLoading(false);
    if (sumRes.data) {
      setSummary(sumRes.data);
    } else if (sumRes.error) {
      setError((sumRes.error as any).detail || 'Error al cargar resumen del dashboard');
    }

    if (canViewBySalesRep && repsRes?.data) {
      setSalesReps(repsRes.data);
    } else {
      setSalesReps([]);
    }
  }, [user?.id, user?.role, canViewBySalesRep]);

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
