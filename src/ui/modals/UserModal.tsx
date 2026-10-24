import React, { useState, useEffect } from 'react';
import { UserPlus, ShieldCheck, Trash2 } from 'lucide-react';
import { User } from '../../modules/types.ts';
import { Modal } from '../components/Modal.tsx';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSave: (userData: { name: string; email: string; phone?: string; role: 'SALES_REP' }) => Promise<{ success: boolean; error?: string }>;
  onDelete?: (userId: string) => void;
}

export function UserModal({
  isOpen,
  onClose,
  user,
  onSave,
  onDelete,
}: UserModalProps) {
  const isCreate = !user;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
    } else {
      setName('');
      setEmail('');
      setPhone('');
    }
    setError(null);
  }, [user, isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setSaving(true);
    setError(null);

    const res = await onSave({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
      role: 'SALES_REP',
    });
    setSaving(false);

    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Error al guardar el asesor comercial');
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isCreate ? 'Asignar Nuevo Asesor Comercial' : 'Editar Asesor Comercial'}
      titleId="user-modal-title"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs" aria-live="polite">
            {error}
          </div>
        )}

        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <label htmlFor="user-form-name" className="font-semibold text-slate-700 dark:text-slate-300 block">
              Nombre Completo *
            </label>
            <input
              id="user-form-name"
              type="text"
              required
              placeholder="Ej. Marina Salas"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="user-form-email" className="font-semibold text-slate-700 dark:text-slate-300 block">
              Correo Electrónico (Usuario de Acceso) *
            </label>
            <input
              id="user-form-email"
              type="email"
              required
              placeholder="ejemplo@mlingenieria.cl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="user-form-phone" className="font-semibold text-slate-700 dark:text-slate-300 block">
              Teléfono / WhatsApp
            </label>
            <input
              id="user-form-phone"
              type="tel"
              placeholder="+56 9 8765 4321"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Rol Asignado: Asesor Comercial
            </p>
            <p>
              Tendrá acceso al Panel Comercial para gestionar sus cotizaciones, clientes y consultar el catálogo técnico.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          {!isCreate && user && onDelete ? (
            <button
              type="button"
              onClick={() => {
                onDelete(user.id);
                onClose();
              }}
              className="text-rose-600 dark:text-rose-400 hover:text-rose-700 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Dar de baja</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim() || !email.trim()}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer shadow-sm disabled:opacity-50"
            >
              {saving ? 'Guardando...' : isCreate ? 'Asignar Asesor' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
