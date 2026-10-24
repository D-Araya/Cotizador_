import React from 'react';
import { Receipt } from 'lucide-react';
import { Invoice } from '../../modules/types.ts';
import { formatMoney } from '../../shared-kernel/formatMoney.ts';
import { Modal } from '../components/Modal.tsx';

interface InvoiceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
}

export function InvoiceDetailsModal({
  isOpen,
  onClose,
  invoice,
}: InvoiceDetailsModalProps) {
  if (!invoice) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Documento de Cobro: ${invoice.invoiceNumber}`}
      titleId="invoice-details-title"
      maxWidth="2xl"
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
          Cotización Ref: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{invoice.quotationNumber}</strong> | Cliente: {invoice.customerBusinessName}
        </p>

        {/* Balances summary */}
        <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-center">
          <div>
            <span className="text-slate-500 text-[11px] block">Total:</span>
            <p className="font-bold font-mono text-slate-900 dark:text-white">{formatMoney(invoice.total)}</p>
          </div>
          <div>
            <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold block">Total Pagado:</span>
            <p className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{formatMoney(invoice.paidAmount || 0)}</p>
          </div>
          <div>
            <span className="text-amber-600 dark:text-amber-400 text-[11px] font-semibold block">Saldo Pendiente:</span>
            <p className="font-bold font-mono text-amber-600 dark:text-amber-400">
              {formatMoney(invoice.balance !== undefined ? invoice.balance : invoice.total)}
            </p>
          </div>
        </div>

        {/* Payment Schedule Milestones */}
        <div className="space-y-2">
          <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
            Hitos de Cobro Programados (Payment Schedule):
          </span>
          {(!invoice.paymentSchedule || invoice.paymentSchedule.length === 0) ? (
            <p className="text-xs text-slate-400">No hay hitos generados.</p>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Hito / Etiqueta</th>
                    <th className="py-2 px-2 text-center">%</th>
                    <th className="py-2 px-3 text-right">Monto</th>
                    <th className="py-2 px-3 text-center">Vencimiento</th>
                    <th className="py-2 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invoice.paymentSchedule.map((ms) => (
                    <tr key={ms.id}>
                      <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">{ms.label}</td>
                      <td className="py-2 px-2 text-center font-mono">{ms.percentage}%</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{formatMoney(ms.amount)}</td>
                      <td className="py-2 px-3 text-center font-mono text-slate-500">{ms.dueDate}</td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            ms.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                              : ms.status === 'PARTIAL'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400'
                              : ms.status === 'OVERDUE'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                          }`}
                        >
                          {ms.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payments History */}
        <div className="space-y-2">
          <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
            Historial de Abonos y Pagos Registrados:
          </span>
          {(!invoice.payments || invoice.payments.length === 0) ? (
            <p className="text-xs text-slate-400 italic">No se han registrado pagos aún.</p>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Fecha</th>
                    <th className="py-2 px-3">Método</th>
                    <th className="py-2 px-3">Referencia</th>
                    <th className="py-2 px-3 text-right">Monto</th>
                    <th className="py-2 px-3">Registrado Por</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                  {invoice.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-400">{p.paymentDate}</td>
                      <td className="py-2 px-3 font-sans font-medium text-slate-800 dark:text-slate-200">{p.paymentMethod}</td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{p.reference}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(p.amount)}</td>
                      <td className="py-2 px-3 font-sans text-slate-500">{p.registeredBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
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
