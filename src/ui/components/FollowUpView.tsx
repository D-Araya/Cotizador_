import React, { useState, useEffect, useCallback } from 'react';
import { Quotation, User as UserType } from '../../modules/types.ts';
import { apiRequest, subscribeToDomainSync, subscribeToAuthUserChange } from '../api.ts';
import { formatMoney } from '../../shared-kernel/formatMoney.ts';
import { StatusBadge } from './CommonBadges.tsx';
import {
  Calendar,
  Clock,
  Bell,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Search,
  Eye,
  Check,
  Send,
} from 'lucide-react';

export interface FollowUpViewProps {
  currentUser: UserType;
  onOpenPublicLink?: (token: string) => void;
  onSelectQuotation?: (q: Quotation) => void;
  onRefreshQuotations?: () => void;
}

/**
 * Retorna fecha en formato YYYY-MM-DD según la zona horaria local del navegador
 * para evitar el desfase de 1 día que produce .toISOString() en husos horarios occidentales (ej. Chile UTC-3/4).
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Normaliza cualquier formato de fecha a YYYY-MM-DD sin alterar el día por UTC
 */
export function extractDateOnly(dateStr?: string | null): string {
  if (!dateStr) return '';
  if (dateStr.includes('T')) {
    return dateStr.split('T')[0];
  }
  return dateStr.substring(0, 10);
}

export function FollowUpView({
  currentUser,
  onOpenPublicLink,
  onSelectQuotation,
  onRefreshQuotations,
}: FollowUpViewProps) {
  const [dueQuotes, setDueQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal para reprogramar o editar acción
  const [editingQuote, setEditingQuote] = useState<Quotation | null>(null);
  const [nextActionDate, setNextActionDate] = useState<string>('');
  const [nextActionNote, setNextActionNote] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Modal para marcar acción completada
  const [completingQuote, setCompletingQuote] = useState<Quotation | null>(null);
  const [completeResolutionNote, setCompleteResolutionNote] = useState<string>('');
  const [completing, setCompleting] = useState<boolean>(false);

  // Estado para envío de recordatorio a Outbox
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);

  const fetchDueQuotes = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      setError(null);
      const res = await apiRequest<Quotation[]>('/api/v1/quotations/follow-up/due');
      if (res.data) {
        setDueQuotes(res.data);
      } else if (res.error && !isBackground) {
        const detail = (res.error as any).detail || (res.error as any).title || 'Error al cargar seguimiento de cotizaciones';
        setError(detail);
      }
    } catch (err: any) {
      if (!isBackground) {
        setError(err.message || 'Error de conexión al cargar seguimiento');
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }, [currentUser.id, currentUser.role]);

  useEffect(() => {
    fetchDueQuotes(false);

    const unsubSync = subscribeToDomainSync(['quotations'], () => {
      fetchDueQuotes(true);
    });

    const unsubAuth = subscribeToAuthUserChange(() => {
      fetchDueQuotes(false);
    });

    return () => {
      unsubSync();
      unsubAuth();
    };
  }, [fetchDueQuotes]);

  const handleOpenEditModal = (q: Quotation) => {
    setEditingQuote(q);
    const existingDate = extractDateOnly(q.nextActionAt) || getLocalDateString();
    setNextActionDate(existingDate);
    setNextActionNote(q.nextActionNote || '');
    setModalError(null);
  };

  const handleSaveNextAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuote) return;
    if (!nextActionDate || !nextActionNote.trim()) {
      setModalError('Debe ingresar la fecha y una nota de seguimiento');
      return;
    }

    try {
      setSaving(true);
      setModalError(null);

      const res = await apiRequest(`/api/v1/quotations/${editingQuote.id}/next-action`, {
        method: 'PATCH',
        body: JSON.stringify({
          nextActionAt: `${nextActionDate}T12:00:00Z`,
          nextActionNote: nextActionNote.trim(),
        }),
      });

      if (res.error) {
        const detail = (res.error as any).detail || (res.error as any).title || 'Error al guardar acción';
        setModalError(detail);
        return;
      }

      setFeedback({
        type: 'success',
        message: `✓ Próxima acción reprogramada para ${editingQuote.quotationNumber} (${nextActionDate})`,
      });
      setEditingQuote(null);
      await fetchDueQuotes();
      if (onRefreshQuotations) onRefreshQuotations();
    } catch (err: any) {
      setModalError(err.message || 'Error de conexión al guardar acción');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingQuote) return;

    try {
      setCompleting(true);
      const res = await apiRequest(`/api/v1/quotations/${completingQuote.id}/next-action`, {
        method: 'PATCH',
        body: JSON.stringify({
          nextActionAt: null,
          nextActionNote: completeResolutionNote.trim() || 'Seguimiento completado exitosamente',
        }),
      });

      if (res.error) {
        const detail = (res.error as any).detail || 'Error al completar seguimiento';
        setFeedback({ type: 'error', message: detail });
        return;
      }

      setFeedback({
        type: 'success',
        message: `✓ Seguimiento completado y cerrado para ${completingQuote.quotationNumber}`,
      });
      setCompletingQuote(null);
      setCompleteResolutionNote('');
      await fetchDueQuotes();
      if (onRefreshQuotations) onRefreshQuotations();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error de conexión' });
    } finally {
      setCompleting(false);
    }
  };

  const handleSendReminderOutbox = async (q: Quotation) => {
    try {
      setSendingReminderId(q.id);
      setFeedback(null);

      const res = await apiRequest(`/api/v1/quotations/${q.id}/reminder`, {
        method: 'POST',
        body: JSON.stringify({
          channel: 'EMAIL',
          note: q.nextActionNote || 'Recordatorio de seguimiento técnico y comercial',
        }),
      });

      if (res.error) {
        const detail = (res.error as any).detail || (res.error as any).title || 'Error al encolar recordatorio';
        setFeedback({ type: 'error', message: detail });
        return;
      }

      setFeedback({
        type: 'success',
        message: `✓ Recordatorio para ${q.quotationNumber} encolado en Bandeja de Salida (Outbox)`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error de conexión' });
    } finally {
      setSendingReminderId(null);
    }
  };

  const todayStr = getLocalDateString();

  // Filtrado por búsqueda
  const filteredList = dueQuotes.filter((q) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchesNum = q.quotationNumber.toLowerCase().includes(term);
    const matchesClient = (q.customerBusinessName || '').toLowerCase().includes(term);
    const matchesNote = (q.nextActionNote || '').toLowerCase().includes(term);
    return matchesNum || matchesClient || matchesNote;
  });

  const overdueList = filteredList.filter((q) => {
    if (!q.nextActionAt) return false;
    const dStr = extractDateOnly(q.nextActionAt);
    return dStr < todayStr;
  });

  const todayList = filteredList.filter((q) => {
    if (!q.nextActionAt) return false;
    const dStr = extractDateOnly(q.nextActionAt);
    return dStr === todayStr;
  });

  return (
    <div className="space-y-5">
      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Calendar className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Seguimiento Comercial: Hoy y Atrasadas
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Control prioritario de llamadas, consultas técnicas y compromisos de seguimiento con armadores y clientes.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              aria-label="Buscar en seguimiento"
              placeholder="Buscar por N.º o cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => fetchDueQuotes(false)}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
            title="Refrescar lista"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Banner Informativo y Feedback */}
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

      {/* Banner de Estado General */}
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl p-4 flex items-start gap-3.5 text-amber-900 dark:text-amber-200 text-xs">
        <Bell className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div>
          <span className="font-bold block text-slate-900 dark:text-amber-100">
            Resumen de Acciones Prioritarias
          </span>
          <span className="text-slate-600 dark:text-amber-300">
            {dueQuotes.length > 0
              ? `Tiene ${overdueList.length} acción(es) atrasada(s) y ${todayList.length} acción(es) programada(s) para hoy (${todayStr}). Puede encolar recordatorios por correo a la Bandeja de Salida (Outbox) o marcar los compromisos como realizados.`
              : 'No hay acciones de seguimiento vencidas ni para hoy. ¡Todas las cotizaciones se encuentran al día!'}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          Cargando cotizaciones con seguimiento pendiente...
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECCIÓN: ATRASADAS */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
              <h3 className="text-xs font-bold text-rose-700 dark:text-rose-400">
                Atrasadas ({overdueList.length})
              </h3>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">— Acciones cuya fecha programada ya expiró</span>
            </div>

            {overdueList.length === 0 ? (
              <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 italic">
                No hay cotizaciones con acciones atrasadas.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {overdueList.map((q) => {
                  const dateStr = extractDateOnly(q.nextActionAt);
                  const isSendingReminder = sendingReminderId === q.id;

                  return (
                    <div
                      key={q.id}
                      data-testid={`follow-up-card-${q.id}`}
                      className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-xl p-4 shadow-xs hover:border-rose-400 dark:hover:border-rose-700 transition space-y-3"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-indigo-700 dark:text-indigo-400">
                              {q.quotationNumber}
                              {q.revision && q.revision > 1 ? ` R${q.revision}` : ''}
                            </span>
                            <StatusBadge status={q.status} />
                          </div>
                          <p className="text-xs text-slate-800 dark:text-slate-200 font-bold mt-1 line-clamp-1" title={q.customerBusinessName}>
                            {q.customerBusinessName || 'Cliente'}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-[11px] font-bold rounded-md border border-rose-200 dark:border-rose-800 whitespace-nowrap">
                          Venció: {dateStr || 'Atrasada'}
                        </span>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-2.5 border border-slate-200 dark:border-slate-700 text-xs">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                          Nota de seguimiento:
                        </span>
                        <p className="text-slate-800 dark:text-slate-200 font-medium">
                          {q.nextActionNote || 'Sin nota de seguimiento registrada'}
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-1 text-xs">
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                          Total: <strong className="font-mono text-slate-800 dark:text-slate-100">{formatMoney(q.grandTotal || q.total || 0)}</strong>
                        </span>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Recordatorio Outbox */}
                          <button
                            type="button"
                            onClick={() => handleSendReminderOutbox(q)}
                            disabled={isSendingReminder}
                            className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-xs font-semibold rounded-md border border-amber-200 dark:border-amber-800 flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                            title="Enviar recordatorio a la bandeja de salida (Outbox)"
                          >
                            <Send className="w-3 h-3" />
                            <span>{isSendingReminder ? 'Encolando...' : 'Recordatorio'}</span>
                          </button>

                          {/* Marcar Realizado */}
                          <button
                            type="button"
                            onClick={() => {
                              setCompletingQuote(q);
                              setCompleteResolutionNote('');
                            }}
                            className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs font-semibold rounded-md border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 transition cursor-pointer"
                            title="Marcar compromiso como realizado"
                          >
                            <Check className="w-3 h-3" />
                            <span>Realizado</span>
                          </button>

                          {/* Reprogramar */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(q)}
                            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 transition cursor-pointer"
                          >
                            Reprogramar
                          </button>

                          {/* Enlace Público */}
                          {onOpenPublicLink && q.publicToken && (
                            <button
                              type="button"
                              onClick={() => onOpenPublicLink(q.publicToken!)}
                              className="text-cyan-700 dark:text-cyan-400 hover:underline font-semibold text-xs ml-1 flex items-center gap-0.5 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Ver</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECCIÓN: HOY */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400">
                Para Hoy ({todayList.length})
              </h3>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">— Compromisos agendados para la jornada de hoy</span>
            </div>

            {todayList.length === 0 ? (
              <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 italic">
                No hay acciones agendadas para hoy.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {todayList.map((q) => {
                  const isSendingReminder = sendingReminderId === q.id;

                  return (
                    <div
                      key={q.id}
                      data-testid={`follow-up-card-${q.id}`}
                      className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 rounded-xl p-4 shadow-xs hover:border-amber-400 dark:hover:border-amber-700 transition space-y-3"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-indigo-700 dark:text-indigo-400">
                              {q.quotationNumber}
                              {q.revision && q.revision > 1 ? ` R${q.revision}` : ''}
                            </span>
                            <StatusBadge status={q.status} />
                          </div>
                          <p className="text-xs text-slate-800 dark:text-slate-200 font-bold mt-1 line-clamp-1" title={q.customerBusinessName}>
                            {q.customerBusinessName || 'Cliente'}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[11px] font-bold rounded-md border border-amber-200 dark:border-amber-800 whitespace-nowrap">
                          Hoy ({todayStr})
                        </span>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-2.5 border border-slate-200 dark:border-slate-700 text-xs">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                          Nota de seguimiento:
                        </span>
                        <p className="text-slate-800 dark:text-slate-200 font-medium">
                          {q.nextActionNote || 'Sin nota de seguimiento registrada'}
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-1 text-xs">
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                          Total: <strong className="font-mono text-slate-800 dark:text-slate-100">{formatMoney(q.grandTotal || q.total || 0)}</strong>
                        </span>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Recordatorio Outbox */}
                          <button
                            type="button"
                            onClick={() => handleSendReminderOutbox(q)}
                            disabled={isSendingReminder}
                            className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-xs font-semibold rounded-md border border-amber-200 dark:border-amber-800 flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                            title="Enviar recordatorio a la bandeja de salida (Outbox)"
                          >
                            <Send className="w-3 h-3" />
                            <span>{isSendingReminder ? 'Encolando...' : 'Recordatorio'}</span>
                          </button>

                          {/* Marcar Realizado */}
                          <button
                            type="button"
                            onClick={() => {
                              setCompletingQuote(q);
                              setCompleteResolutionNote('');
                            }}
                            className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs font-semibold rounded-md border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 transition cursor-pointer"
                            title="Marcar compromiso como realizado"
                          >
                            <Check className="w-3 h-3" />
                            <span>Realizado</span>
                          </button>

                          {/* Actualizar / Reprogramar */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(q)}
                            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 transition cursor-pointer"
                          >
                            Actualizar
                          </button>

                          {/* Enlace Público */}
                          {onOpenPublicLink && q.publicToken && (
                            <button
                              type="button"
                              onClick={() => onOpenPublicLink(q.publicToken!)}
                              className="text-cyan-700 dark:text-cyan-400 hover:underline font-semibold text-xs ml-1 flex items-center gap-0.5 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Ver</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal para Reprogramar o Actualizar Próxima Acción */}
      {editingQuote && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="followup-edit-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 shadow-2xl">
            <h3 id="followup-edit-title" className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
              Agendar Próxima Acción de Seguimiento
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Cotización <strong className="font-mono text-indigo-600 dark:text-indigo-400">{editingQuote.quotationNumber}</strong> — {editingQuote.customerBusinessName}
            </p>

            {modalError && (
              <div className="mb-4 p-2.5 rounded bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveNextAction} className="space-y-4">
              <div>
                <label htmlFor="followup-date-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Fecha de la Acción *
                </label>
                <input
                  id="followup-date-input"
                  type="date"
                  value={nextActionDate}
                  onChange={(e) => setNextActionDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="followup-note-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nota / Compromiso de Seguimiento *
                </label>
                <textarea
                  id="followup-note-input"
                  value={nextActionNote}
                  onChange={(e) => setNextActionNote(e.target.value)}
                  placeholder="Ej: Llamar a jefe de flota para confirmar recepción de planos visados..."
                  rows={3}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingQuote(null)}
                  disabled={saving}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !nextActionDate || !nextActionNote.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {saving ? 'Guardando...' : 'Guardar Acción'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Marcar Seguimiento Realizado */}
      {completingQuote && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="followup-complete-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 shadow-2xl">
            <h3 id="followup-complete-title" className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
              Confirmar Seguimiento Realizado
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Cotización <strong className="font-mono text-indigo-600 dark:text-indigo-400">{completingQuote.quotationNumber}</strong> — {completingQuote.customerBusinessName}
            </p>

            <form onSubmit={handleCompleteFollowUp} className="space-y-4">
              <div>
                <label htmlFor="complete-note-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nota de Cierre / Resultado de la Gestión (Opcional)
                </label>
                <textarea
                  id="complete-note-input"
                  value={completeResolutionNote}
                  onChange={(e) => setCompleteResolutionNote(e.target.value)}
                  placeholder="Ej: Se contactó a Don Juan Pérez, confirmó que presentará la cotización al directorio este viernes..."
                  rows={3}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCompletingQuote(null)}
                  disabled={completing}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={completing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {completing ? 'Guardando...' : 'Confirmar Realizado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default FollowUpView;
