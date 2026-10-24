import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Search,
  Plus,
  ExternalLink,
  History,
  RotateCcw,
  Copy,
  ShieldCheck,
  Bell,
  AlertTriangle,
  Edit3,
  Paperclip,
  Layers,
  CheckCircle,
} from 'lucide-react';
import {
  Quotation,
  User,
  Customer,
  CompanySettings,
  QuotationTemplate,
} from '../../../modules/types.ts';
import { formatMoney } from '../../../shared-kernel/formatMoney.ts';
import { StatusBadge, MarginExceptionBadge, statusLabels, getEffectiveQuotationStatus } from '../../components/CommonBadges.tsx';
import { TableSkeleton } from '../../components/Skeleton.tsx';
import { PipelineKanbanView } from '../../components/PipelineKanbanView.tsx';
import { FollowUpView } from '../../components/FollowUpView.tsx';
import { QuotationWizard } from '../../components/QuotationWizard.tsx';
import { TemplatesModal } from '../../components/TemplatesModal.tsx';
import { RevisionsModal } from '../../modals/RevisionsModal.tsx';
import { OfflineAcceptModal } from '../../modals/OfflineAcceptModal.tsx';
import { NextActionModal } from '../../modals/NextActionModal.tsx';
import { StaffRejectModal } from '../../modals/StaffRejectModal.tsx';
import { AttachmentsModal } from '../../modals/AttachmentsModal.tsx';
import { useQuotations } from '../../hooks/useQuotations.ts';
import { api, apiRequest } from '../../api.ts';
import { InternalOutletContext } from '../../layouts/AppLayout.tsx';

interface QuotationsPageProps {
  user?: User;
  company?: CompanySettings | null;
  customers?: Customer[];
  usersList?: User[];
  onOpenPublicLink?: (token: string) => void;
  onRefreshRelatedData?: () => void;
}

export function QuotationsPage(props: QuotationsPageProps) {
  const context = (useOutletContext<InternalOutletContext>() || {}) as Partial<InternalOutletContext>;
  const user = props.user || context.user;
  const company = props.company || context.company;
  const customers = props.customers || context.customers || [];
  const usersList = props.usersList || [];
  const onOpenPublicLink = props.onOpenPublicLink || context.onOpenPublicLink || ((token: string) => window.history.pushState({}, '', `/q/${token}`));
  const onRefreshRelatedData = props.onRefreshRelatedData || context.onRefreshRelatedData;
  const {
    quotations,
    loading,
    error,
    refreshQuotations,
    updateQuotationInList,
  } = useQuotations();

  const [subView, setSubView] = useState<'list' | 'kanban' | 'follow-up'>('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [selectedTemplateForWizard, setSelectedTemplateForWizard] = useState<QuotationTemplate | null>(null);

  // Modals state
  const [revisionsQuote, setRevisionsQuote] = useState<Quotation | null>(null);
  const [revisionsList, setRevisionsList] = useState<Quotation[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);

  const [offlineAcceptQuote, setOfflineAcceptQuote] = useState<Quotation | null>(null);
  const [nextActionQuote, setNextActionQuote] = useState<Quotation | null>(null);
  const [staffRejectQuote, setStaffRejectQuote] = useState<Quotation | null>(null);
  const [attachmentsQuote, setAttachmentsQuote] = useState<Quotation | null>(null);
  const [reminderSendingId, setReminderSendingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  async function handleOpenRevisions(quote: Quotation) {
    setRevisionsQuote(quote);
    setRevisionsList([]);
    setRevisionsLoading(true);
    const res = await api.get<{ quotationGroupId?: string; revisions?: Quotation[] } | Quotation[]>(
      `/api/v1/quotations/${quote.id}/revisions`
    );
    setRevisionsLoading(false);
    if (res.data) {
      if (Array.isArray(res.data)) {
        setRevisionsList(res.data);
      } else if (Array.isArray(res.data.revisions)) {
        setRevisionsList(res.data.revisions);
      } else {
        setRevisionsList([]);
      }
    } else {
      setRevisionsList([]);
    }
  }

  async function handleCreateRevision(quoteId: string) {
    const res = await api.post<Quotation>(`/api/v1/quotations/${quoteId}/revisions`);
    if (res.data) {
      refreshQuotations();
      onOpenPublicLink(res.data.publicToken);
    } else if (res.error) {
      setToastMessage((res.error as any).detail || 'Error al crear revisión');
    }
  }

  async function handleDuplicateQuote(quoteId: string) {
    const res = await api.post<Quotation>(`/api/v1/quotations/${quoteId}/duplicate`);
    if (res.data) {
      refreshQuotations();
      setToastMessage(`✓ Cotización duplicada con éxito: ${res.data.quotationNumber}`);
      setTimeout(() => setToastMessage(null), 5000);
    } else if (res.error) {
      setToastMessage((res.error as any).detail || 'Error al duplicar cotización');
    }
  }

  async function handleSendReminder(quoteId: string) {
    setReminderSendingId(quoteId);
    try {
      const res = await api.post(`/api/v1/quotations/${quoteId}/reminder`);
      if (res.data) {
        setToastMessage('✓ Recordatorio agregado con éxito a la bandeja de salida (Outbox)');
        setTimeout(() => setToastMessage(null), 5000);
      } else if (res.error) {
        setToastMessage(`Error: ${(res.error as any).detail || 'No se pudo enviar el recordatorio'}`);
      }
    } catch (err: any) {
      setToastMessage(`Error: ${err?.message || 'Error de conexión'}`);
    } finally {
      setReminderSendingId(null);
    }
  }

  if (!user || !company || (loading && quotations.length === 0)) {
    return <TableSkeleton rows={8} cols={6} />;
  }

  if (isWizardOpen) {
    return (
      <QuotationWizard
        company={company}
        salesRepId={user.id}
        currentUser={user}
        usersList={usersList}
        initialTemplate={selectedTemplateForWizard}
        onFinished={(qid) => {
          setIsWizardOpen(false);
          setSelectedTemplateForWizard(null);
          refreshQuotations();
          if (onRefreshRelatedData) onRefreshRelatedData();
        }}
        onCancel={() => {
          setIsWizardOpen(false);
          setSelectedTemplateForWizard(null);
        }}
      />
    );
  }

  const overdueFollowUps = quotations.filter(
    (q) =>
      q.nextActionAt &&
      new Date(q.nextActionAt).getTime() <= Date.now() &&
      q.status !== 'ACCEPTED' &&
      q.status !== 'REJECTED'
  ).length;

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs font-semibold" aria-live="polite">
          {error}
        </div>
      )}

      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:white cursor-pointer text-xs font-bold px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* View Switcher and Action Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => setSubView('list')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              subView === 'list'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            📄 Lista
          </button>
          <button
            type="button"
            onClick={() => setSubView('kanban')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              subView === 'kanban'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            📊 Pipeline Kanban
          </button>
          <button
            type="button"
            onClick={() => setSubView('follow-up')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              subView === 'follow-up'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            ⏰ Seguimiento
            {overdueFollowUps > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-500 text-white font-bold">
                {overdueFollowUps}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">

          <button
            type="button"
            onClick={() => setShowTemplatesModal(true)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer shadow-xs flex items-center gap-1.5"
            title="Gestionar plantillas de cotización"
          >
            <Layers className="w-3.5 h-3.5 text-purple-500" />
            <span className="hidden sm:inline">Plantillas</span>
          </button>

          <button
            type="button"
            onClick={() => setIsWizardOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva Cotización
          </button>
        </div>
      </div>

      {subView === 'kanban' ? (
        <PipelineKanbanView
          quotations={quotations}
          company={company}
          onRefresh={refreshQuotations}
          onOpenPublicLink={onOpenPublicLink}
          onOfflineAccept={(q) => setOfflineAcceptQuote(q)}
          onScheduleAction={(q) => setNextActionQuote(q)}
        />
      ) : subView === 'follow-up' ? (
        <FollowUpView
          currentUser={user}
          onOpenPublicLink={onOpenPublicLink}
          onSelectQuotation={(q) => setNextActionQuote(q)}
          onRefreshQuotations={refreshQuotations}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden space-y-4 p-5">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center pb-2">
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <label htmlFor="quote-search-input" className="sr-only">Buscar cotizaciones</label>
                <input
                  id="quote-search-input"
                  type="text"
                  placeholder="Buscar por N.º de cotización..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <label htmlFor="quote-status-filter" className="sr-only">Filtrar por estado</label>
              <select
                id="quote-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="">Todos los estados</option>
                <option value="DRAFT">{statusLabels.DRAFT}</option>
                <option value="SENT">{statusLabels.SENT}</option>
                <option value="VIEWED">{statusLabels.VIEWED}</option>
                <option value="ACCEPTED">{statusLabels.ACCEPTED}</option>
                <option value="REJECTED">{statusLabels.REJECTED}</option>
                <option value="EXPIRED">{statusLabels.EXPIRED}</option>
              </select>
            </div>

            <span className="text-xs text-slate-400 self-end">
              Mostrando {quotations.length} cotizaciones
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Número</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-2 text-center">Margen %</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {quotations
                  .filter((q) => {
                    const effectiveStatus = getEffectiveQuotationStatus(q);
                    if (statusFilter && effectiveStatus !== statusFilter) return false;
                    if (search && !q.quotationNumber.toLowerCase().includes(search.toLowerCase())) return false;
                    return true;
                  })
                  .map((q) => {
                    const cust = customers.find((c) => c.id === q.customerId);
                    const effectiveStatus = getEffectiveQuotationStatus(q);
                    return (
                      <tr key={q.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-700 dark:text-indigo-400">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{q.quotationNumber}</span>
                            {q.revision && q.revision > 1 && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                R{q.revision}
                              </span>
                            )}
                          </div>
                          {q.acceptedOffline && (
                            <span className="block text-[10px] font-sans font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                              OC: {q.offlinePurchaseOrderNumber || 'S/N'}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                          {new Date(q.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                            {cust?.businessName || q.customerBusinessName || 'Cliente'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatMoney(q.grandTotal ?? q.total ?? 0)}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              q.marginPct >= (company?.minMarginPct || 25)
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                            }`}
                          >
                            {q.marginPct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col gap-1 items-start">
                            <StatusBadge status={effectiveStatus} />
                            <MarginExceptionBadge
                              marginException={q.marginException}
                              marginApprovalStatus={q.marginApprovalStatus}
                              marginApprovedByName={q.marginApprovedByName}
                              marginApprovedAt={q.marginApprovedAt}
                            />
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                            <button
                              type="button"
                              onClick={() => setAttachmentsQuote(q)}
                              title={`Adjuntos (${q.attachments?.length || 0})`}
                              aria-label={`Adjuntos de ${q.quotationNumber}`}
                              className="p-1 rounded text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer relative"
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onOpenPublicLink(q.publicToken)}
                              title="Abrir enlace público cliente / Imprimir PDF"
                              aria-label={`Abrir cotización ${q.quotationNumber}`}
                              className="p-1 rounded text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenRevisions(q)}
                              title="Ver historial de revisiones"
                              aria-label={`Revisiones de ${q.quotationNumber}`}
                              className="p-1 rounded text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>

                            {q.status !== 'DRAFT' && (
                              <button
                                type="button"
                                onClick={() => handleCreateRevision(q.id)}
                                title="Crear nueva revisión"
                                className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 cursor-pointer inline-flex items-center gap-1"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Revisión</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDuplicateQuote(q.id)}
                              title="Duplicar como nueva cotización"
                              aria-label={`Duplicar cotización ${q.quotationNumber}`}
                              className="p-1 rounded text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            {q.status !== 'DRAFT' && q.status !== 'ACCEPTED' && q.status !== 'REJECTED' && (
                              <button
                                type="button"
                                onClick={() => setOfflineAcceptQuote(q)}
                                title="Registrar aceptación offline (con OC)"
                                className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 cursor-pointer inline-flex items-center gap-1"
                              >
                                <ShieldCheck className="w-3 h-3" />
                                <span>Aceptación OC</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setNextActionQuote(q)}
                              title="Programar próxima acción"
                              aria-label={`Programar próxima acción para ${q.quotationNumber}`}
                              className="p-1 rounded text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSendReminder(q.id)}
                              disabled={reminderSendingId === q.id}
                              title="Enviar recordatorio a la bandeja de salida"
                              aria-label={`Enviar recordatorio de ${q.quotationNumber}`}
                              className="p-1 rounded text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                            >
                              <Bell className="w-3.5 h-3.5" />
                            </button>

                            {q.status !== 'ACCEPTED' && q.status !== 'REJECTED' && (
                              <button
                                type="button"
                                onClick={() => setStaffRejectQuote(q)}
                                title="Desestimar cotización con motivo de pérdida"
                                aria-label={`Desestimar cotización ${q.quotationNumber}`}
                                className="p-1 rounded text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
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
        </div>
      )}

      {/* Modals */}
      <RevisionsModal
        isOpen={Boolean(revisionsQuote)}
        onClose={() => setRevisionsQuote(null)}
        quotation={revisionsQuote}
        revisionsList={revisionsList}
        revisionsLoading={revisionsLoading}
        onOpenPublicLink={onOpenPublicLink}
      />

      <OfflineAcceptModal
        isOpen={Boolean(offlineAcceptQuote)}
        onClose={() => setOfflineAcceptQuote(null)}
        quotation={offlineAcceptQuote}
        onConfirm={async (poNumber, notes) => {
          if (!offlineAcceptQuote) return { success: false };
          const res = await api.post<Quotation>(`/api/v1/quotations/${offlineAcceptQuote.id}/offline-accept`, {
            purchaseOrderNumber: poNumber,
            notes,
          });
          if (res.data) {
            updateQuotationInList(res.data);
            if (onRefreshRelatedData) onRefreshRelatedData();
            return { success: true };
          }
          return { success: false, error: (res.error as any)?.detail || 'Error al aceptar offline' };
        }}
      />

      <NextActionModal
        isOpen={Boolean(nextActionQuote)}
        onClose={() => setNextActionQuote(null)}
        quotation={nextActionQuote}
        onSave={async (date, note) => {
          if (!nextActionQuote) return { success: false };
          const res = await api.patch<Quotation>(`/api/v1/quotations/${nextActionQuote.id}/next-action`, {
            nextActionAt: date,
            nextActionNote: note,
          });
          if (res.data) {
            updateQuotationInList(res.data);
            setToastMessage(`✓ Próxima acción programada para ${nextActionQuote.quotationNumber} (${new Date(date).toLocaleDateString('es-CL')})`);
            if (onRefreshRelatedData) onRefreshRelatedData();
            return { success: true };
          }
          return { success: false, error: (res.error as any)?.detail || 'Error al guardar acción' };
        }}
      />

      <StaffRejectModal
        isOpen={Boolean(staffRejectQuote)}
        onClose={() => setStaffRejectQuote(null)}
        quotation={staffRejectQuote}
        company={company}
        onReject={async (lossReason, note) => {
          if (!staffRejectQuote) return { success: false };
          const res = await api.post<Quotation>(`/api/v1/quotations/${staffRejectQuote.id}/reject`, {
            lossReason,
            comment: note,
          });
          if (res.data) {
            updateQuotationInList(res.data);
            return { success: true };
          }
          return { success: false, error: (res.error as any)?.detail || 'Error al rechazar cotización' };
        }}
      />

      <AttachmentsModal
        isOpen={Boolean(attachmentsQuote)}
        onClose={() => setAttachmentsQuote(null)}
        quotation={attachmentsQuote}
        onAddAttachment={async (data) => {
          if (!attachmentsQuote) return { success: false };
          const res = await api.post(`/api/v1/quotations/${attachmentsQuote.id}/attachments`, data);
          if (res.data) {
            refreshQuotations();
            return { success: true };
          }
          return { success: false, error: (res.error as any)?.detail || 'Error al adjuntar' };
        }}
        onRemoveAttachment={async (attId) => {
          if (!attachmentsQuote) return;
          await api.delete(`/api/v1/quotations/${attachmentsQuote.id}/attachments/${attId}`);
          refreshQuotations();
        }}
      />

      <TemplatesModal
        isOpen={showTemplatesModal}
        onClose={() => setShowTemplatesModal(false)}
        onSelectTemplate={(template) => {
          setSelectedTemplateForWizard(template);
          setShowTemplatesModal(false);
          setIsWizardOpen(true);
        }}
      />


    </div>
  );
}

export default QuotationsPage;
