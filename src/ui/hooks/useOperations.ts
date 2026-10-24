import { useState, useEffect, useCallback } from 'react';
import { OperationOrder } from '../../modules/types.ts';
import { api } from '../api.ts';

export function useOperations() {
  const [operations, setOperations] = useState<OperationOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOperations = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<OperationOrder[]>('/api/v1/operations');
    setLoading(false);

    if (res.data) {
      setOperations(res.data);
    } else if (res.error) {
      setError((res.error as any).detail || 'Error al cargar órdenes de trabajo');
    }
  }, []);

  useEffect(() => {
    fetchOperations();
  }, [fetchOperations]);

  const updateOperationInList = useCallback((updated: OperationOrder) => {
    setOperations((prev) =>
      prev.map((op) => (op.id === updated.id ? updated : op))
    );
  }, []);

  return {
    operations,
    loading,
    error,
    refreshOperations: fetchOperations,
    updateOperationInList,
  };
}
