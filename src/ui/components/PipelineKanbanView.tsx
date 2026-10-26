import React, { useState } from 'react';
import { Quotation, QuotationStatus, CompanySettings } from '../../modules/types.ts';
import { apiRequest } from '../api.ts';
import { formatMoney } from '../../shared-kernel/formatMoney.ts';
import { getEffectiveQuotationStatus, statusLabels } from './CommonBadges.tsx';
import { Search, Eye, AlertCircle, CheckCircle2, Calendar, FileCheck2, ArrowRight } from 'lucide-react';

export interface PipelineKanbanViewProps {
  quotations: Quotation[];
  company: CompanySettings | null;
  onRefresh: () => void;
  onOpenPublicLink?: (token: string) => void;
  onOfflineAccept?: (quote: Quotation) => void;
  onScheduleAction?: (quote: Quotation) => void;
}

interface ColumnConfig {
  status: QuotationStatus;
  label: string;
  badgeBg: string;
  badgeText: string;
  columnBg: string;
  columnBorder: string;
}

export const KANBAN_COLUMNS: ColumnConfig[] = [
  {
    status: 'DRAFT',
    label: 'Borrador',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-700 dark:text-slate-300',
    columnBg: 'bg-slate-50/70 dark:bg-slate-900/60',
    columnBorder: 'border-slate-200 dark:border-slate-800',
  },
  {
    status: 'PENDING_APPROVAL',
    label: 'Pendiente Aprobación',
    badgeBg: 'bg-amber-100 dark:bg-amber-950/70',
    badgeText: 'text-amber-800 dark:text-amber-300',
    columnBg: 'bg-amber-50/40 dark:bg-amber-950/20',
    columnBorder: 'border-amber-200 dark:border-amber-900/60',
  },
  {
    status: 'SENT',
    label: 'Enviada',
    badgeBg: 'bg-blue-100 dark:bg-blue-950/70',
    badgeText: 'text-blue-800 dark:text-blue-300',
    columnBg: 'bg-blue-50/40 dark:bg-blue-950/20',
    columnBorder: 'border-blue-200 dark:border-blue-900/60',
  },
  {
    status: 'VIEWED',
    label: 'Vista por Cliente',
    badgeBg: 'bg-indigo-100 dark:bg-indigo-950/70',
    badgeText: 'text-indigo-800 dark:text-indigo-300',
    columnBg: 'bg-indigo-50/40 dark:bg-indigo-950/20',
    columnBorder: 'border-indigo-200 dark:border-indigo-900/60',
  },
  {
    status: 'CHANGES_REQUESTED',
    label: 'Ajuste Solicitado',
    badgeBg: 'bg-purple-100 dark:bg-purple-950/70',
    badgeText: 'text-purple-800 dark:text-purple-300',
    columnBg: 'bg-purple-50/40 dark:bg-purple-950/20',
    columnBorder: 'border-purple-200 dark:border-purple-900/60',
  },
  {
    status: 'ACCEPTED',
    label: 'Aceptada',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-950/70',
    badgeText: 'text-emerald-800 dark:text-emerald-300',
    columnBg: 'bg-emerald-50/40 dark:bg-emerald-950/20',
    columnBorder: 'border-emerald-200 dark:border-emerald-900/60',
  },
  {
    status: 'REJECTED',
    label: 'Perdida / Rechazada',
    badgeBg: 'bg-rose-100 dark:bg-rose-950/70',
    badgeText: 'text-rose-800 dark:text-rose-300',
    columnBg: 'bg-rose-50/40 dark:bg-rose-950/20',
    columnBorder: 'border-rose-200 dark:border-rose-900/60',
  },
  {
    status: 'EXPIRED',
    label: 'Vencida',
    badgeBg: 'bg-orange-100 dark:bg-orange-950/70',
    badgeText: 'text-orange-800 dark:text-orange-300',
    columnBg: 'bg-orange-50/40 dark:bg-orange-950/20',
    columnBorder: 'border-orange-200 dark:border-orange-900/60',
  },
];

export function PipelineKanbanView({
  quotations,
  company,
  onRefresh,
  onOpenPublicLink,
  onOfflineAccept,
  onScheduleAction,
}: PipelineKanbanViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [movingQuoteId, setMovingQuoteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal de Rechazo / Pérdida con motivo configurable
  const [rejectModalQuote, setRejectModalQuote] = useState<Quotation | null>(null);
  const [selectedLossReason, setSelectedLossReason] = useState<string>('precio');
  const [rejectNote, setRejectNote] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const lossReasons = company?.lossReasons && company.lossReasons.length > 0
    ? company.lossReasons
    : ['precio', 'plazo', 'competencia', 'proyecto aplazado', 'otro'];

  const openRejectModal = (quote: Quotation) => {
    setRejectModalQuote(quote);
    setSelectedLossReason(lossReasons[0] || 'precio');
    setRejectNote('');
    setRejectError(null);
  };

  const handleMoveStatus = async (quote: Quotation, targetStatus: QuotationStatus) => {
    if (targetStatus === 'REJECTED') {
      openRejectModal(quote);
      return;
    }

    try {
      setMovingQuoteId(quote.id);
      setFeedback(null);

      // Si se mueve DRAFT a SENT, preferir el endpoint formal /send que valida líneas, margen, genera token y encola Outbox
      const endpoint = (quote.status === 'DRAFT' && targetStatus === 'SENT')
        ? `/api/v1/quotations/${quote.id}/send`
        : `/api/v1/quotations/${quote.id}/status`;

      const res = await apiRequest(endpoint, {
        method: 'POST',
        body: endpoint.endsWith('/send')
          ? JSON.stringify({})
          : JSON.stringify({
              status: targetStatus,
              note: `Movida manualmente desde Pipeline Kanban a ${statusLabels[targetStatus] || targetStatus}`,
            }),
      });

      if (res.error) {
        const errorDetail = (res.error as any).detail || (res.error as any).title || 'No fue posible cambiar el estado';
        setFeedback({ type: 'error', message: errorDetail });
        return;
      }

      setFeedback({
        type: 'success',
        message: `✓ Cotización ${quote.quotationNumber} movida a ${statusLabels[targetStatus] || targetStatus}`,
      });
      onRefresh();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error de conexión al actualizar estado',
      });
    } finally {
      setMovingQuoteId(null);
    }
  };

  const handleConfirmRejection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalQuote) return;

    try {
      setIsRejecting(true);
      setRejectError(null);

      const res = await apiRequest(`/api/v1/quotations/${rejectModalQuote.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          lossReason: selectedLossReason,
          note: rejectNote.trim() || undefined,
        }),
      });

      if (res.error) {
        const detail = (res.error as any).detail || (res.error as any).title || 'Error al registrar pérdida';
        setRejectError(detail);
        return;
      }

      setFeedback({
        type: 'success',
        message: `✓ Cotización ${rejectModalQuote.quotationNumber} marcada como rechazada (${selectedLossReason})`,
      });
      setRejectModalQuote(null);
      onRefresh();
    } catch (err: any) {
      setRejectError(err.message || 'Error de conexión al registrar rechazo');
    } finally {
      setIsRejecting(false);
    }
  };

  // Filtrado por búsqueda en cliente
  const filteredQuotations = quotations.filter((q) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchesNumber = q.quotationNumber.toLowerCase().includes(term);
    const matchesClient = (q.customerBusinessName || '').toLowerCase().includes(term);
    const matchesRep = (q.salesRepName || '').toLowerCase().includes(term);
    return matchesNumber || matchesClient || matchesRep;
  });

  return (
    <div className="space-y-4">
      {/* Barra de Controles y Búsqueda */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
              Pipeline Comercial Kanban
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full font-mono font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {filteredQuotations.length} {filteredQuotations.length === 1 ? 'cotización' : 'cotizaciones'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Transiciones comerciales seguras. Valida automáticamente márgenes, líneas y vigencia.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              aria-label="Buscar cotizaciones en Kanban"
              placeholder="Buscar por N.º, cliente o asesor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Banner de Feedback (Errores / Éxitos) */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 ${
            feedback.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-bold hover:underline cursor-pointer opacity-80 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tablero Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x select-none">
        {KANBAN_COLUMNS.map((col) => {
          // Filtrado usando el estado efectivo (para reflejar vencimientos automáticos)
          const colQuotes = filteredQuotations.filter((q) => {
            const eff = getEffectiveQuotationStatus(q);
            return eff === col.status;
          });
          const colTotal = colQuotes.reduce((acc, q) => acc + (q.grandTotal || q.total || 0), 0);

          return (
            <div
              key={col.status}
              data-testid={`kanban-column-${col.status}`}
              className={`w-80 flex-shrink-0 flex flex-col rounded-xl border ${col.columnBorder} ${col.columnBg} shadow-xs max-h-[760px]`}
            >
              {/* Header de Columna */}
              <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">
                    {col.label}
                  </h4>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono font-medium">
                    {formatMoney(colTotal)}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${col.badgeBg} ${col.badgeText} border border-slate-200 dark:border-slate-700`}
                >
                  {colQuotes.length}
                </span>
              </div>

              {/* Lista de Tarjetas */}
              <div className="p-3 space-y-3 overflow-y-auto flex-1">
                {colQuotes.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500 italic">
                    Sin cotizaciones
                  </div>
                ) : (
                  colQuotes.map((q) => {
                    const isBusy = movingQuoteId === q.id;
                    const effectiveStatus = getEffectiveQuotationStatus(q);

                    return (
                      <div
                        key={q.id}
                        data-testid={`kanban-card-${q.id}`}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 shadow-xs hover:border-slate-400 dark:hover:border-slate-600 transition space-y-2.5"
                      >
                        {/* Cabecera Tarjeta */}
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-xs text-indigo-700 dark:text-indigo-400 block truncate">
                              {q.quotationNumber}
                              {q.revision && q.revision > 1 ? ` R${q.revision}` : ''}
                            </span>
                            <span
                              className="text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate"
                              title={q.customerBusinessName}
                            >
                              {q.customerBusinessName || 'Cliente'}
                            </span>
                          </div>
                          <span className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {formatMoney(q.grandTotal || q.total || 0)}
                          </span>
                        </div>

                        {/* Metadatos */}
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                          <div className="flex justify-between">
                            <span>Asesor:</span>
                            <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[140px]">
                              {q.salesRepName || 'Equipo M&L'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Margen:</span>
                            <span
                              className={`font-semibold ${
                                q.marginPct >= (company?.minMarginPct ?? 25)
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {q.marginPct}%
                            </span>
                          </div>

                          {q.nextActionAt && (
                            <div className="bg-amber-50 dark:bg-amber-950/40 rounded p-1.5 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
                              <span className="font-semibold block text-[10px]">Próxima acción:</span>
                              <span className="line-clamp-2 text-[11px]">{q.nextActionNote || 'Sin nota'}</span>
                            </div>
                          )}

                          {q.lossReason && (
                            <div className="bg-rose-50 dark:bg-rose-950/40 rounded p-1.5 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300">
                              <span className="font-semibold text-[10px]">Motivo de pérdida:</span>{' '}
                              <span className="capitalize">{q.lossReason}</span>
                            </div>
                          )}

                          {q.offlinePurchaseOrderNumber && (
                            <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded p-1.5 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[10px]">
                              <span className="font-semibold">OC Registrada:</span> {q.offlinePurchaseOrderNumber}
                            </div>
                          )}
                        </div>

                        {/* Botones de Transición y Acciones */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                          {/* Transiciones de Estado Permitidas */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] text-slate-400 font-semibold mr-0.5">Mover a:</span>

                            {effectiveStatus === 'DRAFT' && (
                              <button
                                type="button"
                                onClick={() => handleMoveStatus(q, 'SENT')}
                                disabled={isBusy}
                                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded transition cursor-pointer disabled:opacity-50"
                                title="Finalizar y enviar cotización formalmente"
                              >
                                {isBusy ? '...' : 'Enviada'}
                              </button>
                            )}

                            {effectiveStatus === 'PENDING_APPROVAL' && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 italic">
                                Requiere aprobación de margen
                              </span>
                            )}

                            {effectiveStatus === 'SENT' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleMoveStatus(q, 'VIEWED')}
                                  disabled={isBusy}
                                  className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded transition cursor-pointer disabled:opacity-50"
                                  title="Marcar que el cliente revisó la propuesta"
                                >
                                  {isBusy ? '...' : 'Vista'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveStatus(q, 'REJECTED')}
                                  disabled={isBusy}
                                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded transition cursor-pointer disabled:opacity-50"
                                  title="Registrar pérdida comercial"
                                >
                                  Rechazar
                                </button>
                              </>
                            )}

                            {effectiveStatus === 'VIEWED' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleMoveStatus(q, 'CHANGES_REQUESTED')}
                                  disabled={isBusy}
                                  className="px-2 py-0.5 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold rounded transition cursor-pointer disabled:opacity-50"
                                  title="Cliente solicitó cambios de alcance"
                                >
                                  {isBusy ? '...' : 'Ajuste'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveStatus(q, 'REJECTED')}
                                  disabled={isBusy}
                                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded transition cursor-pointer disabled:opacity-50"
                                  title="Registrar pérdida comercial"
                                >
                                  Rechazar
                                </button>
                              </>
                            )}

                            {effectiveStatus === 'CHANGES_REQUESTED' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleMoveStatus(q, 'SENT')}
                                  disabled={isBusy}
                                  className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded transition cursor-pointer disabled:opacity-50"
                                  title="Volver a enviar corregida"
                                >
                                  {isBusy ? '...' : 'Reenviar'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveStatus(q, 'REJECTED')}
                                  disabled={isBusy}
                                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded transition cursor-pointer disabled:opacity-50"
                                  title="Registrar pérdida comercial"
                                >
                                  Rechazar
                                </button>
                              </>
                            )}

                            {effectiveStatus === 'EXPIRED' && (
                              <button
                                type="button"
                                onClick={() => handleMoveStatus(q, 'REJECTED')}
                                disabled={isBusy}
                                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded transition cursor-pointer disabled:opacity-50"
                                title="Desestimar cotización vencida"
                              >
                                Desestimar
                              </button>
                            )}
                          </div>

                          {/* Acciones Secundarias (OC, Agendar, Ver Link) */}
                          <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-slate-800/60 text-[10px]">
                            <div className="flex items-center gap-1.5">
                              {/* Aceptación OC Offline */}
                              {onOfflineAccept && (effectiveStatus === 'SENT' || effectiveStatus === 'VIEWED' || effectiveStatus === 'CHANGES_REQUESTED') && (
                                <button
                                  type="button"
                                  onClick={() => onOfflineAccept(q)}
                                  className="text-emerald-700 dark:text-emerald-400 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                                  title="Registrar aceptación con Orden de Compra"
                                >
                                  <FileCheck2 className="w-3 h-3" />
                                  <span>OC</span>
                                </button>
                              )}

                              {/* Programar Próxima Acción */}
                              {onScheduleAction && effectiveStatus !== 'ACCEPTED' && effectiveStatus !== 'REJECTED' && (
                                <button
                                  type="button"
                                  onClick={() => onScheduleAction(q)}
                                  className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-0.5 cursor-pointer"
                                  title="Programar fecha y nota de seguimiento comercial"
                                >
                                  <Calendar className="w-3 h-3" />
                                  <span>Agendar</span>
                                </button>
                              )}
                            </div>

                            {/* Enlace Público */}
                            {q.publicToken && onOpenPublicLink && (
                              <button
                                type="button"
                                onClick={() => onOpenPublicLink(q.publicToken!)}
                                className="text-cyan-700 dark:text-cyan-400 hover:underline font-medium flex items-center gap-0.5 cursor-pointer ml-auto"
                                title="Ver vista pública de la propuesta"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Ver</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal para Registrar Pérdida / Rechazo con Motivo Configurable */}
      {rejectModalQuote && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 shadow-2xl">
            <h3 id="reject-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
              Registrar Motivo de Pérdida
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Cotización <strong className="font-mono text-indigo-600 dark:text-indigo-400">{rejectModalQuote.quotationNumber}</strong> — {rejectModalQuote.customerBusinessName}
            </p>

            {rejectError && (
              <div className="mb-4 p-2.5 rounded bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{rejectError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmRejection} className="space-y-4">
              <div>
                <label htmlFor="loss-reason-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Motivo de Pérdida (Configurado por Administración) *
                </label>
                <select
                  id="loss-reason-select"
                  value={selectedLossReason}
                  onChange={(e) => setSelectedLossReason(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 capitalize focus:outline-none focus:ring-1 focus:ring-rose-500"
                  required
                >
                  {lossReasons.map((reason) => (
                    <option key={reason} value={reason} className="capitalize">
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="loss-reason-note" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nota / Observaciones Adicionales
                </label>
                <textarea
                  id="loss-reason-note"
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Detalles sobre por qué el cliente decidió no avanzar..."
                  rows={3}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setRejectModalQuote(null)}
                  disabled={isRejecting}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isRejecting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {isRejecting ? 'Registrando...' : 'Confirmar Rechazo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PipelineKanbanView;
