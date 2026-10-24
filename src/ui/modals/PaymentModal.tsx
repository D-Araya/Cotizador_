import React, { useState, useEffect } from 'react';
import { Receipt } from 'lucide-react';
import { Invoice } from '../../modules/types.ts';
import { formatMoney } from '../../shared-kernel/formatMoney.ts';
import { Modal } from '../components/Modal.tsx';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onRecordPayment: (data: {
    amount: number;
    paymentMethod: string;
    reference: string;
    paymentDate: string;
    notes?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export function PaymentModal({
  isOpen,
  onClose,
  invoice,
  onRecordPayment,
}: PaymentModalProps) {
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('TRANSFERENCIA_BANCARIA');
  const [reference, setReference] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (invoice) {
      const pendingBalance = invoice.balance !== undefined ? invoice.balance : invoice.total;
      setAmount(pendingBalance);
      setReference('');
      setNotes('');
      setError(null);
    }
  }, [invoice]);

  if (!invoice) return null;

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (amount <= 0 || !reference.trim()) return;

    setLoading(true);
    setError(null);
    const res = await onRecordPayment({
      amount,
      paymentMethod,
      reference: reference.trim(),
      paymentDate,
      notes: notes.trim() || undefined,
    });
    setLoading(false);

    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Error al registrar el pago');
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Pago / Abono"
      titleId="payment-modal-title"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
          Documento: <strong className="font-mono text-slate-800 dark:text-slate-200">{invoice.invoiceNumber}</strong>
        </p>

        {/* Balances overview */}
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-500 text-[11px] block">Total Documento:</span>
            <p className="font-bold font-mono text-slate-800 dark:text-slate-200">{formatMoney(invoice.total)}</p>
          </div>
          <div>
            <span className="text-amber-600 dark:text-amber-400 text-[11px] font-semibold block">Saldo Pendiente:</span>
            <p className="font-bold font-mono text-amber-600 dark:text-amber-400">
              {formatMoney(invoice.balance !== undefined ? invoice.balance : invoice.total)}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs font-medium" aria-live="polite">
            {error}
          </div>
        )}

        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <label htmlFor="payment-amount-input" className="font-semibold text-slate-700 dark:text-slate-300 block">
              Monto a Abonar (CLP) *
            </label>
            <input
              id="payment-amount-input"
              type="number"
              min="1"
              step="1"
              required
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="payment-method-select" className="font-semibold text-slate-700 dark:text-slate-300 block">
              Método de Pago *
            </label>
            <select
              id="payment-method-select"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="TRANSFERENCIA_BANCARIA">Transferencia Bancaria</option>
              <option value="CHEQUE">Cheque al Día / Plazo</option>
              <option value="EFECTIVO">Efectivo en Caja</option>
              <option value="TARJETA_CREDITO">Tarjeta de Crédito</option>
              <option value="WEBPAY">Webpay / Transbank</option>
              <option value="OTRO">Otro Medio de Pago</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="payment-ref-input" className="font-semibold text-slate-700 dark:text-slate-300 block">
              Referencia / N.º Comprobante / Transacción *
            </label>
            <input
              id="payment-ref-input"
              type="text"
              required
              placeholder="Ej. Transf. Banco Santander Nro 8847102"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="payment-date-input" className="font-semibold text-slate-700 dark:text-slate-300 block">
              Fecha del Pago *
            </label>
            <input
              id="payment-date-input"
              type="date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="payment-notes-input" className="font-semibold text-slate-700 dark:text-slate-300 block">
              Notas u Observaciones (Opcional)
            </label>
            <input
              id="payment-notes-input"
              type="text"
              placeholder="Ej. Abono correspondiente a anticipo 50%"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
            disabled={loading || amount <= 0 || !reference.trim()}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {loading ? 'Registrando...' : 'Registrar Pago'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
