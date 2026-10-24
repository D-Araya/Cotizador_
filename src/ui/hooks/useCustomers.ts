import { useState, useEffect, useCallback } from 'react';
import { Customer, Contact } from '../../modules/types.ts';
import { api } from '../api.ts';

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<Customer[]>('/api/v1/customers');
    setLoading(false);

    if (res.data) {
      setCustomers(res.data);
    } else if (res.error) {
      setError((res.error as any).detail || 'Error al cargar clientes');
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const updateCustomerInList = useCallback((updated: Customer) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  }, []);

  const addCustomerToList = useCallback((newCust: Customer) => {
    setCustomers((prev) => [newCust, ...prev]);
  }, []);

  const removeCustomerFromList = useCallback((id: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const fetchContacts = useCallback(async (customerId: string) => {
    const res = await api.get<Contact[]>(`/api/v1/customers/${customerId}/contacts`);
    return res.data || [];
  }, []);

  return {
    customers,
    loading,
    error,
    refreshCustomers: fetchCustomers,
    updateCustomerInList,
    addCustomerToList,
    removeCustomerFromList,
    fetchContacts,
  };
}
