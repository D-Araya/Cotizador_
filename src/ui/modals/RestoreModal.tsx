import React from 'react';
import { Database, AlertCircle } from 'lucide-react';
import { Modal } from '../components/Modal.tsx';

interface RestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingData: any;
  onConfirm: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function RestoreModal({
  isOpen,
  onClose,
  pendingData,
  onConfirm,
  loading,
  error,
}: RestoreModalProps) {
  if (!pendingData) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="¿Restaurar Base de Datos del Sistema?"
      titleId="restore-modal-title"
      maxWidth="lg"
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
          Operación crítica autorizada exclusivamente para el Administrador
        </p>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-800 dark:text-rose-200 text-xs font-medium" aria-live="polite">
            {error}
          </div>
        )}

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2.5">
          <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
            <span className="font-bold">Origen del Respaldo:</span>
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {pendingData?.metadata?.exportedAt
                ? new Date(pendingData.metadata.exportedAt).toLocaleString('es-CL')
                : 'Copia JSON'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-center font-mono">
            <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-500 block">Cotizaciones</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {pendingData?.data?.quotations?.length ?? pendingData?.counts?.quotations ?? 0}
              </span>
            </div>
            <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-500 block">Clientes</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {pendingData?.data?.customers?.length ?? pendingData?.counts?.customers ?? 0}
              </span>
            </div>
            <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-500 block">Catálogo</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {pendingData?.data?.catalogItems?.length ?? pendingData?.counts?.catalogItems ?? 0}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-xs space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" /> Advertencia de Sobrescritura
            </p>
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              Esta acción sustituirá los datos actuales por el estado registrado en este respaldo. Se creará automáticamente un log de auditoría con la fecha y el usuario que ejecutó la restauración.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer shadow-sm flex items-center gap-1.5"
          >
            {loading ? 'Restaurando...' : 'Confirmar Restauración'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
