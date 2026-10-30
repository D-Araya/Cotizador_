import { useState, useEffect, useCallback, useRef } from 'react';
import { CatalogItem, Category } from '../../modules/types.ts';
import { api, subscribeToDomainSync, subscribeToAuthUserChange, notifyDomainSync } from '../api.ts';

export function useCatalog() {
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchCatalog = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    setError(null);
    const [itemRes, catRes] = await Promise.all([
      api.get<CatalogItem[]>('/api/v1/catalog-items'),
      api.get<Category[]>('/api/v1/categories'),
    ]);

    if (!isMountedRef.current) return;
    if (!isBackground) {
      setLoading(false);
    }
    if (itemRes.data) setCatalogItems(itemRes.data);
    else if (itemRes.error && !isBackground) setError((itemRes.error as any).detail || 'Error al cargar catálogo');

    if (catRes.data) setCategories(catRes.data);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchCatalog(false);

    const unsubSync = subscribeToDomainSync(['catalog', 'company'], () => {
      fetchCatalog(true);
    });

    const unsubAuth = subscribeToAuthUserChange(() => {
      fetchCatalog(false);
    });

    return () => {
      isMountedRef.current = false;
      unsubSync();
      unsubAuth();
    };
  }, [fetchCatalog]);

  const updateItemInList = useCallback((updated: CatalogItem) => {
    setCatalogItems((prev) =>
      prev.map((i) => (i.id === updated.id ? updated : i))
    );
    notifyDomainSync('catalog', updated.id);
  }, []);

  const addItemToList = useCallback((newItem: CatalogItem) => {
    setCatalogItems((prev) => [newItem, ...prev]);
    notifyDomainSync('catalog', newItem.id);
  }, []);

  const removeItemFromList = useCallback((id: string) => {
    setCatalogItems((prev) => prev.filter((i) => i.id !== id));
    notifyDomainSync('catalog', id);
  }, []);

  return {
    catalogItems,
    categories,
    loading,
    error,
    refreshCatalog: () => fetchCatalog(false),
    updateItemInList,
    addItemToList,
    removeItemFromList,
  };
}

