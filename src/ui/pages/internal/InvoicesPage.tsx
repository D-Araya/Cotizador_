import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Invoice, User } from '../../../modules/types.ts';
import { formatMoney } from '../../../shared-kernel/formatMoney.ts';
import { InvoicesGridSkeleton } from '../../components/Skeleton.tsx';
import { PaymentModal } from '../../modals/PaymentModal.tsx';
import { InvoiceDetailsModal } from '../../modals/InvoiceDetailsModal.tsx';
import { useInvoices } from '../../hooks/useInvoices.ts';
import { api } from '../../api.ts';
import { InternalOutletContext } from '../../layouts/AppLayout.tsx';

interface InvoicesPageProps {
  user?: User;
}

export function InvoicesPage(props: InvoicesPageProps) {
  const context = (useOutletContext<InternalOutletContext>() || {}) as Partial<InternalOutletContext>;
  const user = props.user || context.user;
  const { invoices, loading, error, refreshInvoices, updateInvoiceInList } = useInvoices();
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [selectedInvoiceDetails, setSelectedInvoiceDetails] = useState<Invoice | null>(null);

  if (!user || (loading && invoices.length === 0)) {
    return <InvoicesGridSkeleton />;
  }

  const totalBilled = invoices.reduce((acc, i) => acc + (i.total || 0), 0);
  const totalPaid = invoices.reduce((acc, i) => {
    if (i.status === 'PAID') return acc + (i.total || 0);
    return acc + (i.paidAmount || 0);
  }, 0);
  const totalPending = Math.max(0, totalBilled - totalPaid);

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs font-semibold" aria-live="polite">
          {error}
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Total en Documentos de Cobro
          </span>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono">
            {formatMoney(totalBilled)}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{invoices.length} documentos emitidos</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/30 shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
            Total Cobrado / Abonado
          </span>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
            {formatMoney(totalPaid)}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Comprobantes confirmados</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/30 shadow-xs">
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
            Saldo Pendiente de Cobro
          </span>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 font-mono">
            {formatMoney(totalPending)}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Saldo por cobrar según hitos</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
            Documentos de Cobro Emitidos (Chile)
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Generados automáticamente a partir de cotizaciones aceptadas
          </span>
        </div>

        {invoices.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
            No hay documentos de cobro emitidos aún en el sistema.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">N.º Documento</th>
                  <th className="py-2.5 px-3">Cotización Ref.</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-2 text-right">Total</th>
                  <th className="py-2.5 px-2 text-right">Abonado</th>
                  <th className="py-2.5 px-2 text-right">Saldo</th>
                  <th className="py-2.5 px-2 text-center">Estado</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {invoices.map((inv) => {
                  const isPaid = inv.status === 'PAID';
                  const paidAmount = inv.paidAmount || (isPaid ? inv.total : 0);
                  const balance = inv.balance !== undefined ? inv.balance : Math.max(0, (inv.total || 0) - paidAmount);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                        {inv.quotationNumber}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                        {inv.customerBusinessName}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatMoney(inv.total)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatMoney(paidAmount)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                        {formatMoney(balance)}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                              : inv.status === 'PARTIAL'
                              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50'
                              : inv.status === 'OVERDUE'
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50'
                          }`}
                        >
                          {inv.status === 'PAID'
                            ? 'PAGADA'
                            : inv.status === 'PARTIAL'
                            ? 'PAGO PARCIAL'
                            : inv.status === 'OVERDUE'
                            ? 'VENCIDA'
                            : 'PENDIENTE'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoiceDetails(inv)}
                            className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                            title="Ver hitos y detalle de abonos"
                          >
                            Hitos & Pagos
                          </button>
                          {inv.status !== 'PAID' && (
                            <button
                              type="button"
                              onClick={() => setSelectedInvoiceForPayment(inv)}
                              className="px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold text-[11px] hover:bg-emerald-700 transition-colors cursor-pointer shadow-xs"
                              title="Registrar abono o pago"
                            >
                              Registrar Pago
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
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={Boolean(selectedInvoiceForPayment)}
        onClose={() => setSelectedInvoiceForPayment(null)}
        invoice={selectedInvoiceForPayment}
        onRecordPayment={async (paymentData) => {
          if (!selectedInvoiceForPayment) return { success: false };
          const res = await api.post<Invoice>(`/api/v1/invoices/${selectedInvoiceForPayment.id}/payments`, paymentData);
          if (res.data) {
            updateInvoiceInList(res.data);
            return { success: true };
          }
          return { success: false, error: (res.error as any)?.detail || 'Error al registrar pago' };
        }}
      />

      {/* Invoice Details Modal */}
      <InvoiceDetailsModal
        isOpen={Boolean(selectedInvoiceDetails)}
        onClose={() => setSelectedInvoiceDetails(null)}
        invoice={selectedInvoiceDetails}
      />
    </div>
  );
}

export default InvoicesPage;
