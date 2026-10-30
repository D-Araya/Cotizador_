import { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardSummary, SalesRepSummary, User } from '../../modules/types.ts';
import { hasPermission } from '../../shared-kernel/permissions.ts';
import { api, subscribeToDomainSync, subscribeToAuthUserChange } from '../api.ts';

export function useDashboard(user?: User | null) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [salesReps, setSalesReps] = useState<SalesRepSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const canViewBySalesRep = Boolean(
    user && user.role === 'ADMIN' && hasPermission(user, 'dashboard:by_sales_rep')
  );

  const fetchDashboard = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    setError(null);

    const sumPromise = api.get<DashboardSummary>('/api/v1/dashboard/summary');
    const repsPromise = canViewBySalesRep
      ? api
          .get<SalesRepSummary[]>('/api/v1/dashboard/by-sales-rep')
          .catch(() => ({ data: undefined, status: 500 }))
      : Promise.resolve({ data: [] as SalesRepSummary[], status: 200 });

    const [sumRes, repsRes] = await Promise.all([sumPromise, repsPromise]);

    if (!isMountedRef.current) return;

    if (!isBackground) {
      setLoading(false);
    }
    if (sumRes.data) {
      setSummary(sumRes.data);
    } else if (sumRes.error && !isBackground) {
      setError((sumRes.error as any).detail || 'Error al cargar resumen del dashboard');
    }

    if (canViewBySalesRep && repsRes?.data) {
      setSalesReps(repsRes.data);
    } else {
      setSalesReps([]);
    }
  }, [user?.id, user?.role, canViewBySalesRep]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchDashboard(false);

    const unsubSync = subscribeToDomainSync(['dashboard', 'quotations', 'invoices', 'operations', 'company', 'users'], () => {
      fetchDashboard(true);
    });

    const unsubAuth = subscribeToAuthUserChange(() => {
      fetchDashboard(false);
    });

    const handleFocus = () => {
      fetchDashboard(true);
    };
    window.addEventListener('focus', handleFocus);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchDashboard(true);
      }
    }, 4000);

    return () => {
      isMountedRef.current = false;
      unsubSync();
      unsubAuth();
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [fetchDashboard]);

  return {
    summary,
    salesReps,
    loading,
    error,
    refreshDashboard: () => fetchDashboard(false),
  };
}

