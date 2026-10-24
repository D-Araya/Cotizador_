import { useState, useEffect, useCallback } from 'react';
import { CompanySettings } from '../../modules/types.ts';
import { api } from '../api.ts';

export function useCompany() {
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompany = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<CompanySettings>('/api/v1/company');
    setLoading(false);

    if (res.data) {
      setCompany(res.data);
    } else if (res.error) {
      setError((res.error as any).detail || 'Error al cargar configuración de empresa');
    }
  }, []);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  return {
    company,
    setCompany,
    loading,
    error,
    refreshCompany: fetchCompany,
  };
}
