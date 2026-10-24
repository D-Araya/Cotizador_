import { useState, useEffect, useCallback } from 'react';
import { CatalogItem, Category } from '../../modules/types.ts';
import { api } from '../api.ts';

export function useCatalog() {
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [itemRes, catRes] = await Promise.all([
      api.get<CatalogItem[]>('/api/v1/catalog-items'),
      api.get<Category[]>('/api/v1/categories'),
    ]);

    setLoading(false);
    if (itemRes.data) setCatalogItems(itemRes.data);
    else if (itemRes.error) setError((itemRes.error as any).detail || 'Error al cargar catálogo');

    if (catRes.data) setCategories(catRes.data);
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const updateItemInList = useCallback((updated: CatalogItem) => {
    setCatalogItems((prev) =>
      prev.map((i) => (i.id === updated.id ? updated : i))
    );
  }, []);

  const addItemToList = useCallback((newItem: CatalogItem) => {
    setCatalogItems((prev) => [newItem, ...prev]);
  }, []);

  const removeItemFromList = useCallback((id: string) => {
    setCatalogItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  return {
    catalogItems,
    categories,
    loading,
    error,
    refreshCatalog: fetchCatalog,
    updateItemInList,
    addItemToList,
    removeItemFromList,
  };
}
