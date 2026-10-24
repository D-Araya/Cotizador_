import React from 'react';
import { History, ExternalLink } from 'lucide-react';
import { Quotation } from '../../modules/types.ts';
import { StatusBadge, getEffectiveQuotationStatus } from '../components/CommonBadges.tsx';
import { formatMoney } from '../../shared-kernel/formatMoney.ts';
import { Modal } from '../components/Modal.tsx';

interface RevisionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation | null;
  revisionsList: Quotation[];
  revisionsLoading: boolean;
  onOpenPublicLink: (token: string) => void;
}

export function RevisionsModal({
  isOpen,
  onClose,
  quotation,
  revisionsList,
  revisionsLoading,
  onOpenPublicLink,
}: RevisionsModalProps) {
  if (!quotation) return null;

  const safeRevisionsList: Quotation[] = Array.isArray(revisionsList)
    ? revisionsList
    : Array.isArray((revisionsList as any)?.revisions)
    ? (revisionsList as any).revisions
    : [];

  const titleText = `Historial de Revisiones — ${quotation.rootQuotationNumber || quotation.quotationNumber.replace(/-R\d+$/, '')}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={titleText}
      titleId="revisions-modal-title"
      maxWidth="2xl"
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
          Grupo: <span className="font-mono text-[11px]">{quotation.quotationGroupId || quotation.id}</span>
        </p>

        {revisionsLoading ? (
          <div className="py-8 text-center text-xs text-slate-400" aria-live="polite">
            Cargando revisiones...
          </div>
        ) : safeRevisionsList.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No se encontraron otras revisiones.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Rev.</th>
                  <th className="py-2.5 px-3">Folio Visible</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-2 text-center">Estado</th>
                  <th className="py-2.5 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {safeRevisionsList.map((rev) => (
                  <tr
                    key={rev.id}
                    className={
                      rev.id === quotation.id
                        ? 'bg-indigo-50/50 dark:bg-indigo-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }
                  >
                    <td className="py-2.5 px-3 font-bold font-mono text-indigo-600 dark:text-indigo-400">
                      R{rev.revision || 1}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                      {rev.quotationNumber}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                      {new Date(rev.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                      {formatMoney(rev.grandTotal ?? rev.total ?? 0)}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <StatusBadge status={getEffectiveQuotationStatus(rev)} />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenPublicLink(rev.publicToken);
                        }}
                        className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
