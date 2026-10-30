import { useState, useEffect, useCallback, useRef } from 'react';
import { Customer, Contact } from '../../modules/types.ts';
import { api, subscribeToDomainSync, subscribeToAuthUserChange, notifyDomainSync } from '../api.ts';

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchCustomers = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    setError(null);
    const res = await api.get<Customer[]>('/api/v1/customers');
    if (!isMountedRef.current) return;
    if (!isBackground) {
      setLoading(false);
    }

    if (res.data) {
      setCustomers(res.data);
    } else if (res.error && !isBackground) {
      setError((res.error as any).detail || 'Error al cargar clientes');
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchCustomers(false);

    const unsubSync = subscribeToDomainSync(['customers'], () => {
      fetchCustomers(true);
    });

    const unsubAuth = subscribeToAuthUserChange(() => {
      fetchCustomers(false);
    });

    return () => {
      isMountedRef.current = false;
      unsubSync();
      unsubAuth();
    };
  }, [fetchCustomers]);

  const updateCustomerInList = useCallback((updated: Customer) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
    notifyDomainSync('customers', updated.id);
  }, []);

  const addCustomerToList = useCallback((newCust: Customer) => {
    setCustomers((prev) => [newCust, ...prev]);
    notifyDomainSync('customers', newCust.id);
  }, []);

  const removeCustomerFromList = useCallback((id: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    notifyDomainSync('customers', id);
  }, []);

  const fetchContacts = useCallback(async (customerId: string) => {
    const res = await api.get<Contact[]>(`/api/v1/customers/${customerId}/contacts`);
    return res.data || [];
  }, []);

  return {
    customers,
    loading,
    error,
    refreshCustomers: () => fetchCustomers(false),
    updateCustomerInList,
    addCustomerToList,
    removeCustomerFromList,
    fetchContacts,
  };
}

