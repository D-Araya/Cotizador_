import React, { useState, useEffect } from 'react';
import { Quotation } from '../../modules/types.ts';
import { Modal } from '../components/Modal.tsx';
import { getLocalDateString, extractDateOnly } from '../components/FollowUpView.tsx';

interface NextActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation | null;
  onSave: (date: string, note: string) => Promise<{ success: boolean; error?: string }>;
}

export function NextActionModal({
  isOpen,
  onClose,
  quotation,
  onSave,
}: NextActionModalProps) {
  const getDefaultDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return getLocalDateString(d);
  };

  const [date, setDate] = useState<string>(getDefaultDate());
  const [note, setNote] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (quotation) {
      if (quotation.nextActionAt) {
        setDate(extractDateOnly(quotation.nextActionAt));
      } else {
        setDate(getDefaultDate());
      }
      setNote(quotation.nextActionNote || '');
      setError(null);
    }
  }, [quotation]);

  if (!quotation) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !note.trim()) return;

    setSaving(true);
    setError(null);
    const res = await onSave(date, note.trim());
    setSaving(false);

    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Error al programar próxima acción');
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Programar Próxima Acción — ${quotation.quotationNumber}`}
      titleId="next-action-modal-title"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
          Defina la fecha y detalle descriptivo del próximo contacto o tarea de seguimiento con el cliente.
        </p>

        {error && (
          <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-800 dark:text-rose-200 text-xs" aria-live="polite">
            {error}
          </div>
        )}

        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <label htmlFor="next-action-date" className="font-semibold text-slate-700 dark:text-slate-300 block">
              Fecha de Próxima Acción *
            </label>
            <input
              id="next-action-date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="next-action-note" className="font-semibold text-slate-700 dark:text-slate-300 block">
              Nota Descriptiva *
            </label>
            <textarea
              id="next-action-note"
              rows={3}
              required
              placeholder="Ej: Llamar a jefe de operaciones para revisar condiciones técnicas..."
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
            disabled={saving || !date || !note.trim()}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer shadow-sm disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar Próxima Acción'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default NextActionModal;
