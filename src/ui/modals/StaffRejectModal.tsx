import React, { useState } from 'react';
import { Quotation, CompanySettings } from '../../modules/types.ts';
import { Modal } from '../components/Modal.tsx';

interface StaffRejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation | null;
  company?: CompanySettings;
  onReject: (lossReason: string, note?: string) => Promise<{ success: boolean; error?: string }>;
}

export function StaffRejectModal({
  isOpen,
  onClose,
  quotation,
  company,
  onReject,
}: StaffRejectModalProps) {
  const [lossReason, setLossReason] = useState<string>('precio');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!quotation) return null;

  const lossReasons = company?.lossReasons || ['precio', 'plazo', 'competencia', 'proyecto aplazado', 'otro'];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await onReject(lossReason, note.trim() || undefined);
    setSaving(false);

    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Error al desestimar cotización');
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Desestimar Cotización — ${quotation.quotationNumber}`}
      titleId="staff-reject-modal-title"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
          Seleccione obligatoriamente el motivo de pérdida formal para alimentar las métricas y reportes.
        </p>

        {error && (
          <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-800 dark:text-rose-200 text-xs" aria-live="polite">
            {error}
          </div>
        )}

        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <label htmlFor="staff-reject-reason" className="font-semibold text-slate-700 dark:text-slate-300 block">
              Motivo de Pérdida *
            </label>
            <select
              id="staff-reject-reason"
              value={lossReason}
              onChange={(e) => setLossReason(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              {lossReasons.map((r) => (
                <option key={r} value={r}>
                  {r.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="staff-reject-note" className="font-semibold text-slate-700 dark:text-slate-300 block">
              Observaciones Adicionales
            </label>
            <textarea
              id="staff-reject-note"
              rows={3}
              placeholder="Detalle o justificación adicional del rechazo..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer shadow-sm disabled:opacity-50"
          >
            {saving ? 'Registrando...' : 'Confirmar Rechazo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
