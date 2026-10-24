import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Search, Package, Wrench, Layers, Pencil, Trash2 } from 'lucide-react';
import { CatalogItem, User, CompanySettings } from '../../../modules/types.ts';
import { formatMoney } from '../../../shared-kernel/formatMoney.ts';
import { hasPermission } from '../../../shared-kernel/permissions.ts';
import { ItemTypeBadge } from '../../components/CommonBadges.tsx';
import { TableSkeleton } from '../../components/Skeleton.tsx';
import { CatalogItemModal } from '../../modals/CatalogItemModal.tsx';
import { useCatalog } from '../../hooks/useCatalog.ts';
import { api } from '../../api.ts';
import { InternalOutletContext } from '../../layouts/AppLayout.tsx';

interface CatalogPageProps {
  user?: User;
  company?: CompanySettings | null;
}

export function CatalogPage(props: CatalogPageProps) {
  const context = (useOutletContext<InternalOutletContext>() || {}) as Partial<InternalOutletContext>;
  const user = props.user || context.user;
  const company = props.company !== undefined ? props.company : context.company;
  const {
    catalogItems,
    categories,
    loading,
    error,
    refreshCatalog,
    updateItemInList,
    addItemToList,
    removeItemFromList,
  } = useCatalog();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PRODUCT' | 'SERVICE'>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);

  async function handleDelete(item: CatalogItem) {
    if (!window.confirm(`¿Confirma eliminar el ítem "${item.name}" del catálogo?`)) return;
    const res = await api.delete(`/api/v1/catalog-items/${item.id}`);
    if (res.status === 200 || res.status === 204) {
      removeItemFromList(item.id);
    } else {
      alert((res.error as any)?.detail || 'Error al eliminar ítem');
    }
  }

  if (!user || !company || (loading && catalogItems.length === 0)) {
    return <TableSkeleton rows={8} cols={5} />;
  }

  const filteredItems = catalogItems.filter((item) => {
    if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      ((item as any).sku && (item as any).sku.toLowerCase().includes(q)) ||
      ((item as any).code && (item as any).code.toLowerCase().includes(q))
    );
  });

  const avgMargin = catalogItems.length > 0
    ? (
        catalogItems.reduce((acc, i) => {
          const m = i.listPrice > 0 ? ((i.listPrice - i.unitCost) / i.listPrice) * 100 : 0;
          return acc + m;
        }, 0) / catalogItems.length
      ).toFixed(1)
    : '0.0';

  const canCreate = hasPermission(user, 'catalog:create');
  const canEdit = hasPermission(user, 'catalog:edit');
  const canDeactivate = hasPermission(user, 'catalog:deactivate');

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs font-semibold" aria-live="polite">
          {error}
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-extrabold text-sm text-slate-900 dark:text-white">
              Catálogo Maestro de Productos y Servicios Navales
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 shrink-0">
              Sincronización Bidireccional
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {canCreate
              ? 'Administre productos físicos y servicios profesionales, calculando costos unitarios, márgenes sobre venta y precios de lista.'
              : 'Consulte costos unitarios y precios de lista para el cálculo de márgenes en cotizaciones (Modo solo lectura para Comercial).'}
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={() => {
              setSelectedItem(null);
              setModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors flex items-center gap-2 cursor-pointer shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Ítem</span>
          </button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Catálogo</span>
          <p className="text-xl font-extrabold font-mono text-slate-900 dark:text-white mt-1">
            {catalogItems.length}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">ítems activos</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block flex items-center gap-1">
            <Package className="w-3.5 h-3.5" /> Productos
          </span>
          <p className="text-xl font-extrabold font-mono text-blue-700 dark:text-blue-400 mt-1">
            {catalogItems.filter((i) => i.type === 'PRODUCT').length}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">físicos con SKU</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block flex items-center gap-1">
            <Wrench className="w-3.5 h-3.5" /> Servicios
          </span>
          <p className="text-xl font-extrabold font-mono text-purple-700 dark:text-purple-400 mt-1">
            {catalogItems.filter((i) => i.type === 'SERVICE').length}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">con tarifas técnicas</span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Margen Promedio</span>
          <p className="text-xl font-extrabold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
            {avgMargin}%
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Mínimo exigido: {company?.minMarginPct || 25}%
          </span>
        </div>
      </div>

      {/* Filter and Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <label htmlFor="catalog-search-input" className="sr-only">Buscar ítems de catálogo</label>
            <input
              id="catalog-search-input"
              type="text"
              placeholder="Buscar por nombre, SKU o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                typeFilter === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Todos ({catalogItems.length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('PRODUCT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                typeFilter === 'PRODUCT'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Productos ({catalogItems.filter((i) => i.type === 'PRODUCT').length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('SERVICE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                typeFilter === 'SERVICE'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Servicios ({catalogItems.filter((i) => i.type === 'SERVICE').length})
            </button>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 space-y-2">
            <Layers className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-500" />
            <p className="font-semibold text-xs">No se encontraron productos ni servicios</p>
            <p className="text-[11px]">Intente con otro término o registre un nuevo ítem.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-2 text-center">Identificador</th>
                  <th className="py-2.5 px-3">Nombre</th>
                  <th className="py-2.5 px-2 text-center">Unidad</th>
                  <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                  <th className="py-2.5 px-3 text-right">P. Lista</th>
                  <th className="py-2.5 px-2 text-center">Margen %</th>
                  <th className="py-2.5 px-3 text-center w-28">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((item) => {
                  const itemMargin = item.listPrice > 0
                    ? ((item.listPrice - item.unitCost) / item.listPrice) * 100
                    : 0;
                  const meetsMargin = itemMargin >= (company?.minMarginPct || 25);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-2.5 px-3">
                        <ItemTypeBadge type={item.type} />
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {item.type === 'PRODUCT' ? (
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] text-blue-700 dark:text-blue-300 border border-slate-200 dark:border-slate-700">
                            {(item as any).sku || 'N/A'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] text-purple-700 dark:text-purple-300 border border-slate-200 dark:border-slate-700">
                            {(item as any).code || 'N/A'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-slate-900 dark:text-white">{item.name}</p>
                        {item.description && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{item.description}</p>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-medium text-slate-700 dark:text-slate-300">
                        <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          {item.unit || 'UND'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        {formatMoney(item.unitCost)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatMoney(item.listPrice)}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                          meetsMargin
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
                        }`}>
                          {itemMargin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {canEdit || canDeactivate ? (
                          <div className="flex items-center justify-center gap-1.5">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer shadow-xs"
                                title="Editar producto o servicio"
                                aria-label={`Editar ${item.name}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canDeactivate && (
                              <button
                                type="button"
                                onClick={() => handleDelete(item)}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer shadow-xs"
                                title="Eliminar del catálogo"
                                aria-label={`Eliminar ${item.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Solo lectura</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Item Modal */}
      <CatalogItemModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        item={selectedItem}
        categories={categories}
        company={company}
        user={user}
        onSave={async (itemData) => {
          if (selectedItem) {
            const res = await api.put<CatalogItem>(`/api/v1/catalog-items/${selectedItem.id}`, itemData);
            if (res.data) {
              updateItemInList(res.data);
              return { success: true };
            }
            return { success: false, error: (res.error as any)?.detail || 'Error al actualizar ítem' };
          } else {
            const res = await api.post<CatalogItem>('/api/v1/catalog-items', itemData);
            if (res.data) {
              addItemToList(res.data);
              return { success: true };
            }
            return { success: false, error: (res.error as any)?.detail || 'Error al crear ítem' };
          }
        }}
      />
    </div>
  );
}

export default CatalogPage;
