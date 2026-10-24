import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Quotation } from '../../modules/types.ts';
import { Modal } from '../components/Modal.tsx';

interface OfflineAcceptModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation | null;
  onConfirm: (poNumber: string, notes: string) => Promise<{ success: boolean; error?: string }>;
}

export function OfflineAcceptModal({
  isOpen,
  onClose,
  quotation,
  onConfirm,
}: OfflineAcceptModalProps) {
  const [offlinePO, setOfflinePO] = useState('');
  const [offlineNote, setOfflineNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!quotation) return null;

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!offlinePO.trim() || !offlineNote.trim()) return;

    setLoading(true);
    setError(null);
    const res = await onConfirm(offlinePO.trim(), offlineNote.trim());
    setLoading(false);

    if (res.success) {
      setOfflinePO('');
      setOfflineNote('');
      onClose();
    } else {
      setError(res.error || 'Error al registrar aceptación offline');
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Aceptación Offline por el Personal"
      titleId="offline-accept-title"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
          Cotización: <strong className="font-mono text-slate-800 dark:text-slate-200">{quotation.quotationNumber}</strong>
        </p>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Exige registrar el número de orden de compra o referencia formal remitida por el mandante, junto con observaciones. El estado cambiará a <strong>ACEPTADA</strong> y se generará automáticamente el documento de cobro con sus hitos.
        </p>

        {error && (
          <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs font-medium" aria-live="polite">
            {error}
          </div>
        )}

        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <label htmlFor="offline-po-input" className="font-semibold text-slate-700 dark:text-slate-300 block">
              N.º de Orden de Compra o Referencia *
            </label>
            <input
              id="offline-po-input"
              type="text"
              required
              placeholder="Ej. OC-2026-8842 / HES-991"
              value={offlinePO}
              onChange={(e) => setOfflinePO(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="offline-note-input" className="font-semibold text-slate-700 dark:text-slate-300 block">
              Comentario / Observaciones de la Aprobación *
            </label>
            <textarea
              id="offline-note-input"
              rows={3}
              required
              placeholder="Ej. Recepción conforme de OC vía correo electrónico por Gerencia de Operaciones..."
              value={offlineNote}
              onChange={(e) => setOfflineNote(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !offlinePO.trim() || !offlineNote.trim()}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {loading ? 'Registrando...' : 'Confirmar Aceptación Offline'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
