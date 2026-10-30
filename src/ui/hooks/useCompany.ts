import { useState, useEffect, useCallback, useRef } from 'react';
import { CompanySettings } from '../../modules/types.ts';
import { api, subscribeToDomainSync, subscribeToAuthUserChange } from '../api.ts';

export function useCompany() {
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchCompany = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    setError(null);
    const res = await api.get<CompanySettings>('/api/v1/company');
    if (!isMountedRef.current) return;
    if (!isBackground) {
      setLoading(false);
    }

    if (res.data) {
      setCompany(res.data);
    } else if (res.error && !isBackground) {
      setError((res.error as any).detail || 'Error al cargar configuración de empresa');
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchCompany(false);

    const unsubSync = subscribeToDomainSync(['company'], () => {
      fetchCompany(true);
    });

    const unsubAuth = subscribeToAuthUserChange(() => {
      fetchCompany(false);
    });

    return () => {
      isMountedRef.current = false;
      unsubSync();
      unsubAuth();
    };
  }, [fetchCompany]);

  return {
    company,
    setCompany,
    loading,
    error,
    refreshCompany: () => fetchCompany(false),
  };
}

