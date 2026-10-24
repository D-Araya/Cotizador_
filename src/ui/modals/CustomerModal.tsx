import React, { useState, useEffect } from 'react';
import { Customer, User } from '../../modules/types.ts';
import { Modal } from '../components/Modal.tsx';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: Customer | null;
  usersList?: User[];
  onSave: (data: {
    businessName: string;
    taxId: string;
    address?: string;
    salesRepId?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export function CustomerModal({
  isOpen,
  onClose,
  customer,
  usersList = [],
  onSave,
}: CustomerModalProps) {
  const isEditing = Boolean(customer);
  const [businessName, setBusinessName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [address, setAddress] = useState('');
  const [salesRepId, setSalesRepId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setBusinessName(customer.businessName || '');
      setTaxId(customer.taxId || '');
      setAddress(customer.address || '');
      setSalesRepId(customer.salesRepId || '');
    } else {
      setBusinessName('');
      setTaxId('');
      setAddress('');
      setSalesRepId(usersList.find((u) => u.role === 'SALES_REP')?.id || '');
    }
    setError(null);
  }, [customer, isOpen, usersList]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim() || !taxId.trim()) return;

    setLoading(true);
    setError(null);
    const res = await onSave({
      businessName: businessName.trim(),
      taxId: taxId.trim(),
      address: address.trim() || undefined,
      salesRepId: salesRepId || undefined,
    });
    setLoading(false);

    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Error al guardar el cliente');
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}
      titleId="customer-modal-title"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs font-medium" aria-live="polite">
            {error}
          </div>
        )}

        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <label htmlFor="cust-business-name" className="font-semibold text-slate-700 dark:text-slate-300 block">
              Razón Social *
            </label>
            <input
              id="cust-business-name"
              type="text"
              required
              placeholder="Ej. Austral Salmón & Mar SpA"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="cust-tax-id" className="font-semibold text-slate-700 dark:text-slate-300 block">
              RUT / RUN (ej. 76.543.210-4) *
            </label>
            <input
              id="cust-tax-id"
              type="text"
              required
              placeholder="76.543.210-4"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="cust-address" className="font-semibold text-slate-700 dark:text-slate-300 block">
              Dirección Comercial / Fiscal
            </label>
            <input
              id="cust-address"
              type="text"
              placeholder="Av. Angelmó 1450, Puerto Montt"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {usersList.length > 0 && (
            <div className="space-y-1">
              <label htmlFor="cust-sales-rep" className="font-semibold text-slate-700 dark:text-slate-300 block">
                Asesor Comercial Asignado
              </label>
              <select
                id="cust-sales-rep"
                value={salesRepId}
                onChange={(e) => setSalesRepId(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">(Sin asignar / General)</option>
                {usersList
                  .filter((u) => u.role === 'SALES_REP' || u.role === 'ADMIN')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !businessName.trim() || !taxId.trim()}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {loading ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Guardar Cliente'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
