import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Search, Users, Briefcase, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Customer, Contact, User } from '../../../modules/types.ts';
import { hasPermission } from '../../../shared-kernel/permissions.ts';
import { TableSkeleton } from '../../components/Skeleton.tsx';
import { CustomerModal } from '../../modals/CustomerModal.tsx';
import { CustomerContactsModal } from '../../modals/CustomerContactsModal.tsx';
import { useCustomers } from '../../hooks/useCustomers.ts';
import { api } from '../../api.ts';
import { InternalOutletContext } from '../../layouts/AppLayout.tsx';

const PAGE_SIZE = 30;

interface CustomersPageProps {
  user?: User;
  usersList?: User[];
}

export function CustomersPage(props: CustomersPageProps) {
  const context = (useOutletContext<InternalOutletContext>() || {}) as Partial<InternalOutletContext>;
  const user = props.user || context.user;
  const usersList = props.usersList || [];
  const {
    customers,
    loading,
    error,
    refreshCustomers,
    updateCustomerInList,
    addCustomerToList,
    removeCustomerFromList,
    fetchContacts,
  } = useCustomers();

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Contacts Modal
  const [activeCustForContacts, setActiveCustForContacts] = useState<Customer | null>(null);
  const [custContacts, setCustContacts] = useState<Contact[]>([]);

  async function handleOpenContacts(c: Customer) {
    setActiveCustForContacts(c);
    const contacts = await fetchContacts(c.id);
    setCustContacts(contacts);
  }

  async function handleDeleteCustomer(c: Customer) {
    if (!window.confirm(`¿Confirma dar de baja al cliente ${c.businessName}?`)) return;
    const res = await api.delete(`/api/v1/customers/${c.id}`);
    if (res.status === 200 || res.status === 204) {
      removeCustomerFromList(c.id);
    } else {
      alert((res.error as any)?.detail || 'Error al dar de baja al cliente');
    }
  }

  if (!user || (loading && customers.length === 0)) {
    return <TableSkeleton rows={6} cols={5} />;
  }

  const filteredCusts = customers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.businessName.toLowerCase().includes(q) ||
      c.taxId.toLowerCase().includes(q) ||
      (c.address && c.address.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredCusts.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const paginatedCusts = filteredCusts.slice(startIndex, startIndex + PAGE_SIZE);

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
              Cartera Corporativa de Clientes & Contactos
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 shrink-0">
              Gestión Compartida
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Administración y el Personal Comercial pueden registrar, actualizar y vincular contactos con trazabilidad completa.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingCustomer(null);
            setCustomerModalOpen(true);
          }}
          className="px-3.5 py-2 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nuevo Cliente</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <label htmlFor="customer-search-input" className="sr-only">Buscar clientes</label>
            <input
              id="customer-search-input"
              type="text"
              placeholder="Buscar por Razón Social, RUT o dirección..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCurrentPage(1);
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer shrink-0"
            >
              Limpiar
            </button>
          )}
        </div>

        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 self-end sm:self-auto">
          Mostrando{' '}
          <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
            {filteredCusts.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, filteredCusts.length)}
          </span>{' '}
          de{' '}
          <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
            {filteredCusts.length}
          </span>{' '}
          clientes
        </span>
      </div>

      {/* Customers Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {filteredCusts.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 space-y-2">
            <Users className="w-8 h-8 mx-auto text-slate-400" />
            <p className="font-semibold text-xs">No se encontraron clientes registrados</p>
            <p className="text-[11px]">Intente con otro término o registre un nuevo cliente en el sistema.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Razón Social</th>
                  <th className="py-2.5 px-3">RUT</th>
                  <th className="py-2.5 px-3">Dirección Fiscal</th>
                  <th className="py-2.5 px-3">Asesor Asignado</th>
                  <th className="py-2.5 px-3 text-center">Contactos</th>
                  <th className="py-2.5 px-3 text-center w-28">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedCusts.map((c) => {
                  const rep = usersList.find((u) => u.id === c.salesRepId);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                        {c.businessName}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400 font-semibold">
                        {c.taxId}
                      </td>
                      <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                        {c.address || 'Sin dirección registrada'}
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-medium">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                          <Briefcase className="w-3 h-3 text-indigo-500" />
                          {rep ? rep.name : 'Asesor Comercial'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenContacts(c)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-semibold text-xs cursor-pointer border border-indigo-200 dark:border-indigo-800/50 shadow-2xs"
                          title="Gestionar contactos y credenciales"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Contactos &rarr;</span>
                        </button>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCustomer(c);
                              setCustomerModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 cursor-pointer shadow-xs"
                            title="Editar datos del cliente"
                            aria-label={`Editar cliente ${c.businessName}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {hasPermission(user, 'customers:deactivate') && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomer(c)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 cursor-pointer shadow-xs"
                              title="Dar de baja cliente"
                              aria-label={`Dar de baja cliente ${c.businessName}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls (30 per page) */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Página{' '}
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {safeCurrentPage}
            </span>{' '}
            de{' '}
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {totalPages}
            </span>{' '}
            <span className="text-slate-400 dark:text-slate-500">
              ({PAGE_SIZE} por página)
            </span>
          </span>

          <div className="flex items-center gap-1" role="navigation" aria-label="Paginación de clientes">
            <button
              type="button"
              onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
              disabled={safeCurrentPage <= 1}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors inline-flex items-center gap-1"
              aria-label="Página anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>

            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => setCurrentPage(pageNum)}
                aria-current={pageNum === safeCurrentPage ? 'page' : undefined}
                className={`min-w-[30px] h-[30px] px-2 rounded-lg font-mono font-bold text-xs transition-colors cursor-pointer ${
                  pageNum === safeCurrentPage
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors inline-flex items-center gap-1"
              aria-label="Página siguiente"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Customer Modal (Create & Edit) */}
      <CustomerModal
        isOpen={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        customer={editingCustomer}
        usersList={usersList}
        onSave={async (data) => {
          if (editingCustomer) {
            const res = await api.put<Customer>(`/api/v1/customers/${editingCustomer.id}`, data);
            if (res.data) {
              updateCustomerInList(res.data);
              return { success: true };
            }
            return { success: false, error: (res.error as any)?.detail || 'Error al actualizar cliente' };
          } else {
            const res = await api.post<Customer>('/api/v1/customers', data);
            if (res.data) {
              addCustomerToList(res.data);
              return { success: true };
            }
            return { success: false, error: (res.error as any)?.detail || 'Error al crear cliente' };
          }
        }}
      />

      {/* Contacts Modal */}
      <CustomerContactsModal
        isOpen={Boolean(activeCustForContacts)}
        onClose={() => setActiveCustForContacts(null)}
        customer={activeCustForContacts}
        contacts={custContacts}
        currentUser={user}
        onAddContact={async (contactData) => {
          if (!activeCustForContacts) return { success: false };
          const res = await api.post<Contact>(`/api/v1/customers/${activeCustForContacts.id}/contacts`, contactData);
          if (res.data) {
            setCustContacts((prev) => [...prev, res.data!]);
            return { success: true };
          }
          return { success: false, error: (res.error as any)?.detail || 'Error al agregar contacto' };
        }}
        onUpdateContact={async (contactId, contactData) => {
          if (!activeCustForContacts) return { success: false };
          const res = await api.put<Contact>(`/api/v1/customers/${activeCustForContacts.id}/contacts/${contactId}`, contactData);
          if (res.data) {
            setCustContacts((prev) => prev.map((c) => (c.id === contactId ? res.data! : c)));
            return { success: true };
          }
          return { success: false, error: (res.error as any)?.detail || 'Error al actualizar contacto' };
        }}
        onDeleteContact={async (contactId) => {
          if (!activeCustForContacts) return { success: false };
          const res = await api.delete(`/api/v1/customers/${activeCustForContacts.id}/contacts/${contactId}`);
          if (res.status === 200 || res.status === 204) {
            setCustContacts((prev) => prev.filter((c) => c.id !== contactId));
            return { success: true };
          }
          return { success: false, error: (res.error as any)?.detail || 'Error al eliminar contacto' };
        }}
        onSendMagicLink={async (contact) => {
          const res = await api.post(`/api/v1/contacts/${contact.id}/magic-link`);
          if (res.data) {
            alert(`Enlace mágico generado y puesto en bandeja de salida para ${contact.name}`);
          } else {
            alert((res.error as any)?.detail || 'Error al generar enlace');
          }
        }}
        onRevokeAccess={async (contact) => {
          const res = await api.post(`/api/v1/contacts/${contact.id}/revoke-token`);
          if (res.data) {
            setCustContacts((prev) =>
              prev.map((c) => (c.id === contact.id ? { ...c, portalTokenRevoked: true } : c))
            );
          } else {
            alert((res.error as any)?.detail || 'Error al revocar acceso');
          }
        }}
      />
    </div>
  );
}

export default CustomersPage;
