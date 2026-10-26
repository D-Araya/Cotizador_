import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  Layers,
  Building,
  Bell,
  Sparkles,
  LogOut,
  Plus,
  Send,
  Search,
  Filter,
  Copy,
  Edit3,
  ExternalLink,
  Phone,
  Mail,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  BookOpen,
  DollarSign,
  TrendingUp,
  Package,
  Wrench,
  Receipt,
  Truck,
  Check,
  Pencil,
  Trash2,
  ArrowRightLeft,
  ShieldCheck,
  AlertCircle,
  UserPlus,
  UserCheck,
  UserX,
  History,
  Lock,
  Unlock,
  RefreshCw,
  KeyRound,
  ShieldAlert,
  Briefcase,
  Download,
  Link as LinkIcon,
  Upload,
  Database,
  FileDown,
  Paperclip,
} from 'lucide-react';
import {
  User as UserType,
  Quotation,
  Customer,
  Contact,
  CatalogItem,
  Category,
  CompanySettings,
  OutboxMessage,
  QuotationStatus,
  Invoice,
  OperationOrder,
  AuditLog,
  AuditLogEntity,
} from '../../modules/types.ts';
import { StatusBadge, ItemTypeBadge, statusLabels, getEffectiveQuotationStatus, MarginExceptionBadge } from './CommonBadges.tsx';
import { QuotationWizard } from './QuotationWizard.tsx';
import { AiAssistant } from './AiAssistant.tsx';
import { ThemeSelector } from '../theme.tsx';
import {
  KpiGridSkeleton,
  TableSkeleton,
  InvoicesGridSkeleton,
  OperationsGridSkeleton,
} from './Skeleton.tsx';
import { FollowUpView } from './FollowUpView.tsx';
import { PipelineKanbanView } from './PipelineKanbanView.tsx';
import { PipelineKpiMetrics } from './PipelineKpiMetrics.tsx';
import { OperationsMilestonesModal } from './OperationsMilestonesModal.tsx';
import { apiRequest, setActiveApiUser, getAuthToken } from '../api.ts';
import { formatMoney } from '../../shared-kernel/formatMoney.ts';
import { hasPermission } from '../../shared-kernel/permissions.ts';

interface InternalAppProps {
  user: UserType;
  onLogout: () => void;
  onOpenPublicLink: (token: string) => void;
  onSwitchUser?: (email: string) => void;
}

export function InternalApp({ user, onLogout, onOpenPublicLink, onSwitchUser }: InternalAppProps) {
  const [currentNav, setCurrentNav] = useState<
    | 'dashboard'
    | 'quotations'
    | 'customers'
    | 'catalog'
    | 'company'
    | 'notifications'
    | 'invoices'
    | 'operations'
    | 'sales-team'
    | 'audit-logs'
  >('dashboard');

  // Master Data
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [outbox, setOutbox] = useState<OutboxMessage[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [operations, setOperations] = useState<OperationOrder[]>([]);
  const [usersList, setUsersList] = useState<UserType[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<any>(null);
  const [salesRepReport, setSalesRepReport] = useState<any[]>([]);
  const [itemTypeReport, setItemTypeReport] = useState<any>(null);

  // Filter States
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<string>('');
  const [quoteSearch, setQuoteSearch] = useState<string>('');

  // Sub-views & Modals (P2)
  const [quotationSubView, setQuotationSubView] = useState<'list' | 'kanban' | 'follow-up'>('list');
  const [dashboardSubView, setDashboardSubView] = useState<'general' | 'kpis'>('general');
  const [selectedOpForMilestones, setSelectedOpForMilestones] = useState<OperationOrder | null>(null);
  const [showMilestonesModal, setShowMilestonesModal] = useState<boolean>(false);

  // Next Action Modal State (P2.h)
  const [showNextActionModal, setShowNextActionModal] = useState<boolean>(false);
  const [selectedQuoteForNextAction, setSelectedQuoteForNextAction] = useState<Quotation | null>(null);
  const [formNextActionDate, setFormNextActionDate] = useState<string>('');
  const [formNextActionNote, setFormNextActionNote] = useState<string>('');
  const [nextActionSaving, setNextActionSaving] = useState<boolean>(false);

  // Staff Rejection with Loss Reason Modal State (P2.h)
  const [showStaffRejectModal, setShowStaffRejectModal] = useState<boolean>(false);
  const [selectedQuoteForStaffReject, setSelectedQuoteForStaffReject] = useState<Quotation | null>(null);
  const [formLossReason, setFormLossReason] = useState<string>('precio');
  const [formStaffRejectNote, setFormStaffRejectNote] = useState<string>('');
  const [staffRejectSaving, setStaffRejectSaving] = useState<boolean>(false);

  // Reminder Sending State (P2.h)
  const [reminderSendingId, setReminderSendingId] = useState<string | null>(null);

  // Modals & Sub-views
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [isAiOpen, setIsAiOpen] = useState<boolean>(false);
  const [selectedQuotationForStatus, setSelectedQuotationForStatus] = useState<Quotation | null>(null);
  const [manualStatus, setManualStatus] = useState<QuotationStatus>('SENT');
  const [manualComment, setManualComment] = useState<string>('');
  const [manualError, setManualError] = useState<string | null>(null);

  // Revisions Modal State
  const [showRevisionsModal, setShowRevisionsModal] = useState<boolean>(false);
  const [selectedQuoteForRevisions, setSelectedQuoteForRevisions] = useState<Quotation | null>(null);
  const [revisionsList, setRevisionsList] = useState<Quotation[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState<boolean>(false);

  // Offline Acceptance Modal State (P1.d)
  const [showOfflineAcceptModal, setShowOfflineAcceptModal] = useState<boolean>(false);
  const [selectedQuoteForOfflineAccept, setSelectedQuoteForOfflineAccept] = useState<Quotation | null>(null);
  const [offlinePO, setOfflinePO] = useState<string>('');
  const [offlineNote, setOfflineNote] = useState<string>('');
  const [offlineAcceptLoading, setOfflineAcceptLoading] = useState<boolean>(false);
  const [offlineAcceptError, setOfflineAcceptError] = useState<string | null>(null);

  // Payments & Invoices Modal State (P1.e)
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('TRANSFERENCIA_BANCARIA');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentLoading, setPaymentLoading] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [selectedInvoiceDetails, setSelectedInvoiceDetails] = useState<Invoice | null>(null);

  // Customer Management Modals & Search
  const [custSearch, setCustSearch] = useState<string>('');
  const [showNewCustModal, setShowNewCustModal] = useState<boolean>(false);
  const [newCustName, setNewCustName] = useState<string>('');
  const [newCustRut, setNewCustRut] = useState<string>('');
  const [newCustAddress, setNewCustAddress] = useState<string>('');
  const [newCustSalesRepId, setNewCustSalesRepId] = useState<string>('usr-sales-01');

  const [showEditCustModal, setShowEditCustModal] = useState<boolean>(false);
  const [editingCustId, setEditingCustId] = useState<string | null>(null);
  const [editCustName, setEditCustName] = useState<string>('');
  const [editCustRut, setEditCustRut] = useState<string>('');
  const [editCustAddress, setEditCustAddress] = useState<string>('');
  const [editCustSalesRepId, setEditCustSalesRepId] = useState<string>('');
  const [custSaving, setCustSaving] = useState<boolean>(false);
  const [custToDelete, setCustToDelete] = useState<Customer | null>(null);
  const [custDeleting, setCustDeleting] = useState<boolean>(false);

  // Contact Drawer & Management
  const [activeCustForContacts, setActiveCustForContacts] = useState<Customer | null>(null);
  const [custContacts, setCustContacts] = useState<Contact[]>([]);
  const [newContactName, setNewContactName] = useState<string>('');
  const [newContactEmail, setNewContactEmail] = useState<string>('');
  const [newContactPhone, setNewContactPhone] = useState<string>('');
  const [newContactPosition, setNewContactPosition] = useState<string>('');

  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editContactName, setEditContactName] = useState<string>('');
  const [editContactEmail, setEditContactEmail] = useState<string>('');
  const [editContactPhone, setEditContactPhone] = useState<string>('');
  const [editContactPosition, setEditContactPosition] = useState<string>('');
  const [contactSaving, setContactSaving] = useState<boolean>(false);

  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [contactDeleting, setContactDeleting] = useState<boolean>(false);

  // Sales Rep (Equipo Comercial) Management States (Admin Only)
  const [showUserModal, setShowUserModal] = useState<boolean>(false);
  const [userModalMode, setUserModalMode] = useState<'create' | 'edit'>('create');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formUserName, setFormUserName] = useState<string>('');
  const [formUserEmail, setFormUserEmail] = useState<string>('');
  const [formUserPhone, setFormUserPhone] = useState<string>('');
  const [formUserRole, setFormUserRole] = useState<'SALES_REP' | 'ADMIN'>('SALES_REP');
  const [formUserActive, setFormUserActive] = useState<boolean>(true);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [userSaving, setUserSaving] = useState<boolean>(false);
  const [userToDelete, setUserToDelete] = useState<UserType | null>(null);
  const [userDeleting, setUserDeleting] = useState<boolean>(false);

  // Audit Logs States
  const [auditEntityFilter, setAuditEntityFilter] = useState<string>('ALL');
  const [auditRoleFilter, setAuditRoleFilter] = useState<string>('ALL');
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditLoading, setAuditLoading] = useState<boolean>(false);

  // Catalog Management States
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<'ALL' | 'PRODUCT' | 'SERVICE'>('ALL');
  const [showItemModal, setShowItemModal] = useState<boolean>(false);
  const [itemModalMode, setItemModalMode] = useState<'create' | 'edit'>('create');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Item Form Fields
  const [formItemType, setFormItemType] = useState<'PRODUCT' | 'SERVICE'>('PRODUCT');
  const [formItemName, setFormItemName] = useState<string>('');
  const [formItemSkuOrCode, setFormItemSkuOrCode] = useState<string>('');
  const [formItemDescription, setFormItemDescription] = useState<string>('');
  const [formItemUnit, setFormItemUnit] = useState<string>('UND');
  const [formItemUnitCost, setFormItemUnitCost] = useState<number>(100);
  const [formItemListPrice, setFormItemListPrice] = useState<number>(142.86);
  const [formItemMarginPct, setFormItemMarginPct] = useState<number>(30);
  const [formItemCategoryId, setFormItemCategoryId] = useState<string>('cat-01');
  const [itemFormError, setItemFormError] = useState<string | null>(null);
  const [itemSaving, setItemSaving] = useState<boolean>(false);

  // Item Deletion State
  const [itemToDelete, setItemToDelete] = useState<CatalogItem | null>(null);
  const [itemDeleting, setItemDeleting] = useState<boolean>(false);

  // Backup & Restore System States
  const [backupLoading, setBackupLoading] = useState<boolean>(false);
  const [restoreLoading, setRestoreLoading] = useState<boolean>(false);
  const [showRestoreModal, setShowRestoreModal] = useState<boolean>(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<any | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [exportingCsv, setExportingCsv] = useState<boolean>(false);

  // Company Settings form
  const [editMinMargin, setEditMinMargin] = useState<number>(25);
  const [editHardMinMargin, setEditHardMinMargin] = useState<number>(18);
  const [editUfRate, setEditUfRate] = useState<number>(38500);
  const [configuredLossReasons, setConfiguredLossReasons] = useState<string[]>(['precio', 'plazo', 'competencia', 'proyecto aplazado', 'otro']);
  const [newReasonInput, setNewReasonInput] = useState<string>('');
  const [configuredProbabilities, setConfiguredProbabilities] = useState<Record<string, number>>({
    DRAFT: 10,
    SENT: 30,
    VIEWED: 50,
    CHANGES_REQUESTED: 40,
    ACCEPTED: 100,
    REJECTED: 0,
    EXPIRED: 0,
  });

  // P3.l Excepción de margen modal
  const [marginApprovalQuote, setMarginApprovalQuote] = useState<Quotation | null>(null);
  const [marginAdminComment, setMarginAdminComment] = useState<string>('');
  const [marginProcessing, setMarginProcessing] = useState<boolean>(false);

  // P3.n Adjuntos modal
  const [attachmentsModalQuote, setAttachmentsModalQuote] = useState<Quotation | null>(null);
  const [attNameInput, setAttNameInput] = useState<string>('');
  const [attUrlInput, setAttUrlInput] = useState<string>('');
  const [attDescInput, setAttDescInput] = useState<string>('');
  const [attSaving, setAttSaving] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    setActiveApiUser({ id: user.id, role: user.role, name: user.name });
    if (user.role !== 'ADMIN' && currentNav === 'sales-team') {
      setCurrentNav('dashboard');
    }
    loadAllData();
  }, [user.id, user.role]);

  async function loadAllData() {
    setLoading(true);
    const [qRes, cRes, catRes, itemRes, compRes, outRes, dashRes, srRes, itRes, invRes, opRes, uRes, auditRes] =
      await Promise.all([
        apiRequest<Quotation[]>('/api/v1/quotations'),
        apiRequest<Customer[]>('/api/v1/customers'),
        apiRequest<Category[]>('/api/v1/categories'),
        apiRequest<CatalogItem[]>('/api/v1/catalog-items'),
        apiRequest<CompanySettings>('/api/v1/company'),
        apiRequest<OutboxMessage[]>('/api/v1/notifications'),
        apiRequest<any>('/api/v1/dashboard/summary'),
        apiRequest<any[]>('/api/v1/dashboard/by-sales-rep'),
        apiRequest<any>('/api/v1/dashboard/by-item-type'),
        apiRequest<Invoice[]>('/api/v1/invoices'),
        apiRequest<OperationOrder[]>('/api/v1/operations'),
        apiRequest<UserType[]>('/api/v1/users'),
        apiRequest<AuditLog[]>('/api/v1/audit-logs'),
      ]);

    if (qRes.data) setQuotations(qRes.data);
    if (cRes.data) setCustomers(cRes.data);
    if (catRes.data) setCategories(catRes.data);
    if (itemRes.data) setCatalogItems(itemRes.data);
    if (compRes.data) {
      setCompany(compRes.data);
      setEditMinMargin(compRes.data.minMarginPct);
      if (compRes.data.hardMinMarginPct !== undefined) setEditHardMinMargin(compRes.data.hardMinMarginPct);
      if (compRes.data.ufRate !== undefined) setEditUfRate(compRes.data.ufRate);
      if (compRes.data.lossReasons) setConfiguredLossReasons(compRes.data.lossReasons);
      if (compRes.data.pipelineProbabilities) setConfiguredProbabilities(compRes.data.pipelineProbabilities);
    }
    if (outRes.data) setOutbox(outRes.data);
    if (dashRes.data) setDashboardSummary(dashRes.data);
    if (srRes.data) setSalesRepReport(srRes.data);
    if (itRes.data) setItemTypeReport(itRes.data);
    if (invRes.data) setInvoices(invRes.data);
    if (opRes.data) setOperations(opRes.data);
    if (uRes.data) setUsersList(uRes.data);
    if (auditRes.data) setAuditLogs(auditRes.data);
    setLoading(false);
  }

  async function handleRefreshAuditLogs() {
    setAuditLoading(true);
    const res = await apiRequest<AuditLog[]>('/api/v1/audit-logs');
    if (res.data) setAuditLogs(res.data);
    setAuditLoading(false);
  }

  // Invoice Actions
  async function handleMarkInvoicePaid(invId: string) {
    const res = await apiRequest(`/api/v1/invoices/${invId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'PAID', paymentMethod: 'Transferencia Bancaria Confirmada' }),
    });
    if (res.data) {
      await loadAllData();
    }
  }

  // Operation Actions
  async function handleUpdateOperationProgress(opId: string, status: string, progressPct: number) {
    const res = await apiRequest(`/api/v1/operations/${opId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, progressPct }),
    });
    if (res.data) {
      await loadAllData();
    }
  }

  // Duplicate quote
  async function handleDuplicateQuote(quoteId: string) {
    const res = await apiRequest(`/api/v1/quotations/${quoteId}/duplicate`, { method: 'POST' });
    if (res.data) {
      await loadAllData();
      setIsWizardOpen(false);
      setToastMessage(`Cotización duplicada con éxito como ${res.data.quotationNumber}`);
    }
  }

  // Create new revision from sent/existing quote (P1.a)
  async function handleCreateRevision(quoteId: string) {
    const res = await apiRequest(`/api/v1/quotations/${quoteId}/revisions`, { method: 'POST' });
    if (res.data) {
      await loadAllData();
      setToastMessage(`✓ Nueva revisión creada: ${res.data.quotationNumber} (Borrador para edición)`);
    } else if (res.error) {
      setToastMessage(`Error: ${res.error.detail || 'No se pudo crear la revisión'}`);
    }
  }

  // Open revisions history for group (P1.a)
  async function handleOpenRevisionsHistory(quote: Quotation) {
    setSelectedQuoteForRevisions(quote);
    setRevisionsLoading(true);
    setShowRevisionsModal(true);
    const res = await apiRequest<{ quotationGroupId: string; revisions: Quotation[] }>(
      `/api/v1/quotations/${quote.id}/revisions`
    );
    setRevisionsLoading(false);
    if (res.data?.revisions) {
      setRevisionsList(res.data.revisions);
    }
  }

  // Next Action Handlers (P2.h)
  function handleOpenNextAction(quote: Quotation) {
    setSelectedQuoteForNextAction(quote);
    const existingDate = quote.nextActionAt ? quote.nextActionAt.split('T')[0] : new Date().toISOString().split('T')[0];
    setFormNextActionDate(existingDate);
    setFormNextActionNote(quote.nextActionNote || '');
    setShowNextActionModal(true);
  }

  async function handleSubmitNextAction() {
    if (!selectedQuoteForNextAction) return;
    if (!formNextActionDate || !formNextActionNote.trim()) {
      alert('Debe ingresar la fecha programada y la nota descriptiva.');
      return;
    }
    setNextActionSaving(true);
    const res = await apiRequest(`/api/v1/quotations/${selectedQuoteForNextAction.id}/next-action`, {
      method: 'PATCH',
      body: JSON.stringify({
        nextActionAt: formNextActionDate,
        nextActionNote: formNextActionNote.trim(),
      }),
    });
    setNextActionSaving(false);
    if (res.data) {
      setShowNextActionModal(false);
      setSelectedQuoteForNextAction(null);
      setToastMessage(`✓ Próxima acción programada para ${new Date(formNextActionDate).toLocaleDateString('es-CL')}`);
      await loadAllData();
    } else if (res.error) {
      alert(res.error.detail || 'Error al programar próxima acción');
    }
  }

  // Staff Rejection with Loss Reason Handlers (P2.h)
  function handleOpenStaffReject(quote: Quotation) {
    setSelectedQuoteForStaffReject(quote);
    const reasons = company?.lossReasons || ['precio', 'plazo', 'competencia', 'proyecto aplazado', 'otro'];
    setFormLossReason(reasons[0] || 'precio');
    setFormStaffRejectNote('');
    setShowStaffRejectModal(true);
  }

  async function handleSubmitStaffReject() {
    if (!selectedQuoteForStaffReject) return;
    setStaffRejectSaving(true);
    const res = await apiRequest(`/api/v1/quotations/${selectedQuoteForStaffReject.id}/reject`, {
      method: 'POST',
      body: JSON.stringify({
        lossReason: formLossReason,
        note: formStaffRejectNote.trim() || undefined,
      }),
    });
    setStaffRejectSaving(false);
    if (res.data) {
      setShowStaffRejectModal(false);
      setSelectedQuoteForStaffReject(null);
      setToastMessage(`✓ Cotización ${selectedQuoteForStaffReject.quotationNumber} desestimada por motivo: ${formLossReason}`);
      await loadAllData();
    } else if (res.error) {
      alert(res.error.detail || 'Error al registrar rechazo');
    }
  }

  // Follow-up Reminder in Outbox Handler (P2.h)
  async function handleSendFollowUpReminder(quoteId: string, channel: 'EMAIL' | 'WHATSAPP' = 'EMAIL') {
    try {
      setReminderSendingId(quoteId);
      const res = await apiRequest(`/api/v1/quotations/${quoteId}/reminder`, {
        method: 'POST',
        body: JSON.stringify({ channel }),
      });
      if (res.data) {
        setToastMessage('✓ Recordatorio de seguimiento encolado con éxito en la bandeja de salida (Outbox)');
        await loadAllData();
      } else if (res.error) {
        alert(res.error.detail || 'Error al encolar recordatorio');
      }
    } catch (err: any) {
      alert(err.message || 'Error al enviar recordatorio');
    } finally {
      setReminderSendingId(null);
    }
  }

  // Offline Acceptance Handlers (P1.d)
  function handleOpenOfflineAccept(quote: Quotation) {
    setSelectedQuoteForOfflineAccept(quote);
    setOfflinePO('');
    setOfflineNote('');
    setOfflineAcceptError(null);
    setShowOfflineAcceptModal(true);
  }

  async function handleSubmitOfflineAccept() {
    if (!selectedQuoteForOfflineAccept) return;
    if (!offlinePO.trim()) {
      setOfflineAcceptError('Debe ingresar el N.º de Orden de Compra o referencia comercial.');
      return;
    }
    if (!offlineNote.trim()) {
      setOfflineAcceptError('Debe ingresar el comentario justificatorio de la recepción.');
      return;
    }
    setOfflineAcceptLoading(true);
    setOfflineAcceptError(null);
    const res = await apiRequest(`/api/v1/quotations/${selectedQuoteForOfflineAccept.id}/accept-offline`, {
      method: 'POST',
      body: JSON.stringify({
        purchaseOrderNumber: offlinePO.trim(),
        offlineNote: offlineNote.trim(),
      }),
    });
    setOfflineAcceptLoading(false);
    if (res.error) {
      setOfflineAcceptError(res.error.detail || 'Error al registrar aceptación offline');
      return;
    }
    setShowOfflineAcceptModal(false);
    setToastMessage(`✓ Aceptación offline registrada para ${selectedQuoteForOfflineAccept.quotationNumber}. Documento de cobro generado.`);
    await loadAllData();
  }

  // Payment Recording Handlers (P1.e)
  function handleOpenRecordPayment(inv: Invoice) {
    setSelectedInvoiceForPayment(inv);
    setPaymentAmount(inv.balance !== undefined ? inv.balance : (inv.total || 0));
    setPaymentMethod('TRANSFERENCIA_BANCARIA');
    setPaymentRef('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNotes('');
    setPaymentError(null);
    setShowPaymentModal(true);
  }

  async function handleSubmitPayment() {
    if (!selectedInvoiceForPayment) return;
    if (paymentAmount <= 0) {
      setPaymentError('El monto abonado debe ser mayor a 0.');
      return;
    }
    if (!paymentRef.trim()) {
      setPaymentError('Debe ingresar la referencia o comprobante de pago.');
      return;
    }
    setPaymentLoading(true);
    setPaymentError(null);
    const res = await apiRequest(`/api/v1/invoices/${selectedInvoiceForPayment.id}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        amount: paymentAmount,
        paymentMethod,
        reference: paymentRef.trim(),
        paymentDate: paymentDate || new Date().toISOString().split('T')[0],
        notes: paymentNotes.trim() || undefined,
      }),
    });
    setPaymentLoading(false);
    if (res.error) {
      setPaymentError(res.error.detail || 'Error al registrar el pago');
      return;
    }
    setShowPaymentModal(false);
    setToastMessage(`✓ Pago de $${paymentAmount.toLocaleString('es-CL')} registrado con éxito para el documento ${selectedInvoiceForPayment.invoiceNumber}.`);
    await loadAllData();
  }

  // Manual Status Change with mandatory comment
  async function handleApplyManualStatus() {
    if (!selectedQuotationForStatus) return;
    if (!manualComment.trim()) {
      setManualError('El comentario justificatorio es estrictamente obligatorio.');
      return;
    }

    setManualError(null);
    const res = await apiRequest(`/api/v1/quotations/${selectedQuotationForStatus.id}/status`, {
      method: 'POST',
      body: JSON.stringify({
        status: manualStatus,
        comment: manualComment.trim(),
      }),
    });

    if (res.error) {
      setManualError(res.error.detail || 'Error al cambiar estado');
      return;
    }

    setSelectedQuotationForStatus(null);
    setManualComment('');
    await loadAllData();
  }

  // ==========================================
  // CUSTOMER CRUD (ADMIN & COMMERCIAL)
  // ==========================================
  async function handleCreateCustomer() {
    if (!newCustName || !newCustRut) return;
    const res = await apiRequest('/api/v1/customers', {
      method: 'POST',
      body: JSON.stringify({
        businessName: newCustName,
        taxId: newCustRut,
        address: newCustAddress,
        salesRepId: newCustSalesRepId || user.id,
      }),
    });
    if (res.data) {
      setShowNewCustModal(false);
      setNewCustName('');
      setNewCustRut('');
      setNewCustAddress('');
      setToastMessage(`✓ Cliente "${res.data.businessName}" creado exitosamente.`);
      await loadAllData();
    } else if (res.error) {
      setToastMessage(`Error: ${res.error.detail || 'No se pudo crear el cliente'}`);
    }
  }

  function handleOpenEditCustomer(cust: Customer) {
    setEditingCustId(cust.id);
    setEditCustName(cust.businessName);
    setEditCustRut(cust.taxId);
    setEditCustAddress(cust.address || '');
    setEditCustSalesRepId(cust.salesRepId || 'usr-sales-01');
    setShowEditCustModal(true);
  }

  async function handleSaveEditCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCustId || !editCustName.trim() || !editCustRut.trim()) return;

    setCustSaving(true);
    const res = await apiRequest<Customer>(`/api/v1/customers/${editingCustId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        businessName: editCustName.trim(),
        taxId: editCustRut.trim(),
        address: editCustAddress.trim(),
        salesRepId: editCustSalesRepId,
      }),
    });
    setCustSaving(false);

    if (res.data) {
      setShowEditCustModal(false);
      setToastMessage(`✓ Cliente "${res.data.businessName}" actualizado correctamente.`);
      await loadAllData();
    } else if (res.error) {
      setToastMessage(`Error: ${res.error.detail || 'No se pudo actualizar el cliente'}`);
    }
  }

  async function handleDeleteCustomer() {
    if (!custToDelete) return;
    setCustDeleting(true);

    const res = await apiRequest(`/api/v1/customers/${custToDelete.id}`, {
      method: 'DELETE',
    });
    setCustDeleting(false);

    if (res.status === 204 || res.status === 200) {
      setToastMessage(`✓ Cliente "${custToDelete.businessName}" eliminado.`);
      setCustToDelete(null);
      await loadAllData();
    } else {
      setToastMessage(`Error: No se pudo eliminar el cliente.`);
    }
  }

  // ==========================================
  // CONTACT CRUD (ADMIN & COMMERCIAL)
  // ==========================================
  async function handleOpenContacts(cust: Customer) {
    setActiveCustForContacts(cust);
    setEditingContact(null);
    const res = await apiRequest<Contact[]>(`/api/v1/customers/${cust.id}/contacts`);
    if (res.data) setCustContacts(res.data);
  }

  async function handleCreateContact() {
    if (!activeCustForContacts || !newContactName || !newContactEmail || !newContactPhone) return;
    const res = await apiRequest(`/api/v1/customers/${activeCustForContacts.id}/contacts`, {
      method: 'POST',
      body: JSON.stringify({
        name: newContactName,
        email: newContactEmail,
        phone: newContactPhone,
        position: newContactPosition || 'Contacto Principal',
      }),
    });
    if (res.data) {
      setNewContactName('');
      setNewContactEmail('');
      setNewContactPhone('');
      setNewContactPosition('');
      setToastMessage(`✓ Contacto "${res.data.name}" añadido y credenciales generadas.`);
      await handleOpenContacts(activeCustForContacts);
      const auditRes = await apiRequest<AuditLog[]>('/api/v1/audit-logs');
      if (auditRes.data) setAuditLogs(auditRes.data);
    }
  }

  function handleOpenEditContact(contact: Contact) {
    setEditingContact(contact);
    setEditContactName(contact.name);
    setEditContactPosition(contact.position || '');
    setEditContactEmail(contact.email);
    setEditContactPhone(contact.phone || '');
  }

  async function handleSaveEditContact(e: React.FormEvent) {
    e.preventDefault();
    if (!editingContact || !editContactName.trim() || !editContactEmail.trim()) return;

    setContactSaving(true);
    const res = await apiRequest<Contact>(`/api/v1/contacts/${editingContact.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: editContactName.trim(),
        position: editContactPosition.trim(),
        email: editContactEmail.trim(),
        phone: editContactPhone.trim(),
      }),
    });
    setContactSaving(false);

    if (res.data && activeCustForContacts) {
      setEditingContact(null);
      setToastMessage(`✓ Contacto "${res.data.name}" actualizado.`);
      await handleOpenContacts(activeCustForContacts);
      const auditRes = await apiRequest<AuditLog[]>('/api/v1/audit-logs');
      if (auditRes.data) setAuditLogs(auditRes.data);
    }
  }

  async function handleDeleteContact() {
    if (!contactToDelete || !activeCustForContacts) return;
    setContactDeleting(true);

    const res = await apiRequest(`/api/v1/contacts/${contactToDelete.id}`, {
      method: 'DELETE',
    });
    setContactDeleting(false);

    if (res.status === 204 || res.status === 200) {
      setToastMessage(`✓ Contacto "${contactToDelete.name}" eliminado.`);
      setContactToDelete(null);
      await handleOpenContacts(activeCustForContacts);
      const auditRes = await apiRequest<AuditLog[]>('/api/v1/audit-logs');
      if (auditRes.data) setAuditLogs(auditRes.data);
    }
  }

  async function handleGenerateContactMagicLink(contact: Contact) {
    const res = await apiRequest<{ success: boolean; magicToken: string; magicUrl: string; expiresAt: string }>(
      `/api/v1/contacts/${contact.id}/magic-link`,
      { method: 'POST' }
    );
    if (res.data) {
      const fullUrl = `${window.location.origin}${res.data.magicUrl}`;
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(fullUrl);
        } catch {}
      }
      setToastMessage(`✓ Enlace Mágico generado y copiado para "${contact.name}". Válido por 30 días.`);
      if (activeCustForContacts) {
        await handleOpenContacts(activeCustForContacts);
      }
    } else {
      setToastMessage('Error al generar enlace mágico para el cliente.');
    }
  }

  async function handleRevokeContactAccess(contact: Contact) {
    const res = await apiRequest(`/api/v1/contacts/${contact.id}/revoke-access`, {
      method: 'POST',
    });
    if (res.data) {
      setToastMessage(`✓ Acceso al portal revocado para "${contact.name}".`);
      if (activeCustForContacts) {
        await handleOpenContacts(activeCustForContacts);
      }
    }
  }

  // ==========================================
  // SALES TEAM CRUD (ADMIN ONLY)
  // ==========================================
  function handleOpenCreateUser() {
    setUserModalMode('create');
    setEditingUserId(null);
    setFormUserName('');
    setFormUserEmail('');
    setFormUserPhone('+56 9 ');
    setFormUserRole('SALES_REP');
    setFormUserActive(true);
    setUserFormError(null);
    setShowUserModal(true);
  }

  function handleOpenEditUser(u: UserType) {
    setUserModalMode('edit');
    setEditingUserId(u.id);
    setFormUserName(u.name);
    setFormUserEmail(u.email);
    setFormUserPhone(u.phone || '');
    setFormUserRole(u.role as any);
    setFormUserActive(u.active);
    setUserFormError(null);
    setShowUserModal(true);
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!formUserName.trim() || !formUserEmail.trim()) {
      setUserFormError('Nombre y correo electrónico son obligatorios.');
      return;
    }

    setUserSaving(true);
    setUserFormError(null);

    if (userModalMode === 'create') {
      const res = await apiRequest<UserType>('/api/v1/users', {
        method: 'POST',
        body: JSON.stringify({
          name: formUserName.trim(),
          email: formUserEmail.trim().toLowerCase(),
          phone: formUserPhone.trim(),
          role: formUserRole,
        }),
      });
      setUserSaving(false);

      if (res.error) {
        setUserFormError(res.error.detail || 'Error al registrar asesor comercial.');
        return;
      }

      setShowUserModal(false);
      setToastMessage(`✓ Asesor Comercial "${res.data?.name}" creado y asignado con acceso al Panel Comercial.`);
      await loadAllData();
    } else if (editingUserId) {
      const res = await apiRequest<UserType>(`/api/v1/users/${editingUserId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: formUserName.trim(),
          email: formUserEmail.trim().toLowerCase(),
          phone: formUserPhone.trim(),
          active: formUserActive,
        }),
      });
      setUserSaving(false);

      if (res.error) {
        setUserFormError(res.error.detail || 'Error al actualizar usuario.');
        return;
      }

      setShowUserModal(false);
      setToastMessage(`✓ Datos de "${res.data?.name}" actualizados correctamente.`);
      await loadAllData();
    }
  }

  async function handleToggleUserAccess(u: UserType) {
    const res = await apiRequest<UserType>(`/api/v1/users/${u.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !u.active }),
    });
    if (res.data) {
      setToastMessage(
        res.data.active
          ? `✓ Acceso concedido al Panel Comercial para ${res.data.name}`
          : `⚠️ Acceso suspendido para ${res.data.name}`
      );
      await loadAllData();
    }
  }

  async function handleDeleteUser() {
    if (!userToDelete) return;
    setUserDeleting(true);

    const res = await apiRequest(`/api/v1/users/${userToDelete.id}`, {
      method: 'DELETE',
    });
    setUserDeleting(false);

    if (res.status === 204 || res.status === 200) {
      setToastMessage(`✓ Asesor Comercial "${userToDelete.name}" eliminado definitivamente del equipo.`);
      setUserToDelete(null);
      await loadAllData();
    } else {
      setToastMessage('Error al eliminar asesor comercial');
    }
  }

  async function handleSaveConfiguredLossReasons(reasons: string[]) {
    const res = await apiRequest('/api/v1/company', {
      method: 'PUT',
      body: JSON.stringify({ lossReasons: reasons }),
    });
    if (res.data) {
      setConfiguredLossReasons(reasons);
      setToastMessage('✓ Motivos de pérdida actualizados con éxito.');
      await loadAllData();
    } else if (res.error) {
      alert(res.error.detail || 'Error al guardar motivos de pérdida');
    }
  }

  async function handleSavePipelineProbabilities() {
    const res = await apiRequest('/api/v1/company', {
      method: 'PUT',
      body: JSON.stringify({ pipelineProbabilities: configuredProbabilities }),
    });
    if (res.data) {
      setToastMessage('✓ Probabilidades de pipeline guardadas con éxito.');
      await loadAllData();
    } else if (res.error) {
      alert(res.error.detail || 'Error al guardar probabilidades');
    }
  }

  async function handleUpdateCompanyMargin() {
    if (!company) return;
    if (user.role !== 'ADMIN') {
      setToastMessage('Solo el Administrador puede modificar los datos de la empresa y el margen.');
      return;
    }
    if (editHardMinMargin >= editMinMargin) {
      alert(`El piso duro de margen (${editHardMinMargin}%) debe ser menor que el margen corporativo mínimo (${editMinMargin}%).`);
      return;
    }
    const res = await apiRequest('/api/v1/company', {
      method: 'PUT',
      body: JSON.stringify({
        ...company,
        minMarginPct: editMinMargin,
        hardMinMarginPct: editHardMinMargin,
        ufRate: editUfRate,
      }),
    });
    if (res.data) {
      setCompany(res.data);
      setToastMessage(`✓ Configuración corporativa actualizada (Mín: ${res.data.minMarginPct}%, Piso duro: ${res.data.hardMinMarginPct}%, UF: $ ${res.data.ufRate})`);
      const auditRes = await apiRequest<AuditLog[]>('/api/v1/audit-logs');
      if (auditRes.data) setAuditLogs(auditRes.data);
    } else if (res.error) {
      alert(res.error.detail || 'Error al actualizar configuración');
    }
  }

  // P3.l Excepción de margen handlers
  async function handleApproveMargin() {
    if (!marginApprovalQuote) return;
    setMarginProcessing(true);
    const res = await apiRequest(`/api/v1/quotations/${marginApprovalQuote.id}/approve-margin`, {
      method: 'POST',
      body: JSON.stringify({
        comment: marginAdminComment.trim() || 'Aprobada excepción de margen por Gerencia/Administración',
      }),
    });
    setMarginProcessing(false);
    if (res.data) {
      setToastMessage(`✓ Excepción de margen aprobada para cotización ${marginApprovalQuote.quotationNumber}.`);
      setMarginApprovalQuote(null);
      setMarginAdminComment('');
      await loadAllData();
    } else if (res.error) {
      alert(res.error.detail || 'Error al aprobar margen');
    }
  }

  async function handleRejectMargin() {
    if (!marginApprovalQuote) return;
    if (!marginAdminComment.trim()) {
      alert('Debe ingresar un comentario explicando el motivo del rechazo.');
      return;
    }
    setMarginProcessing(true);
    const res = await apiRequest(`/api/v1/quotations/${marginApprovalQuote.id}/reject-margin`, {
      method: 'POST',
      body: JSON.stringify({
        comment: marginAdminComment.trim(),
      }),
    });
    setMarginProcessing(false);
    if (res.data) {
      setToastMessage(`Cotización ${marginApprovalQuote.quotationNumber}: Excepción de margen rechazada.`);
      setMarginApprovalQuote(null);
      setMarginAdminComment('');
      await loadAllData();
    } else if (res.error) {
      alert(res.error.detail || 'Error al rechazar margen');
    }
  }

  // P3.n Adjuntos handlers
  async function handleAddQuotationAttachment() {
    if (!attachmentsModalQuote || !attNameInput.trim() || !attUrlInput.trim()) return;
    setAttSaving(true);
    const res = await apiRequest(`/api/v1/quotations/${attachmentsModalQuote.id}/attachments`, {
      method: 'POST',
      body: JSON.stringify({
        name: attNameInput.trim(),
        url: attUrlInput.trim(),
        description: attDescInput.trim() || undefined,
      }),
    });
    setAttSaving(false);
    if (res.data) {
      const updatedAttachments = [...(attachmentsModalQuote.attachments || []), res.data];
      setAttachmentsModalQuote({
        ...attachmentsModalQuote,
        attachments: updatedAttachments,
      });
      setAttNameInput('');
      setAttUrlInput('');
      setAttDescInput('');
      setToastMessage('✓ Enlace adjunto agregado a la cotización.');
      await loadAllData();
    } else if (res.error) {
      alert(res.error.detail || 'Error al agregar archivo adjunto');
    }
  }

  async function handleRemoveQuotationAttachment(attId: string) {
    if (!attachmentsModalQuote) return;
    await apiRequest(`/api/v1/quotations/${attachmentsModalQuote.id}/attachments/${attId}`, {
      method: 'DELETE',
    });
    const updatedAttachments = (attachmentsModalQuote.attachments || []).filter((a) => a.id !== attId);
    setAttachmentsModalQuote({
      ...attachmentsModalQuote,
      attachments: updatedAttachments,
    });
    setToastMessage('Enlace adjunto eliminado.');
    await loadAllData();
  }

  // ==========================================
  // CATALOG MANAGEMENT HANDLERS (ADMIN & COMMERCIAL)
  // ==========================================
  function handleCostOrMarginChange(cost: number, margin: number) {
    setFormItemUnitCost(cost);
    setFormItemMarginPct(margin);
    if (cost > 0 && margin < 100 && margin >= 0) {
      const price = cost / (1 - margin / 100);
      setFormItemListPrice(parseFloat(price.toFixed(2)));
    }
  }

  function handlePriceChange(price: number) {
    setFormItemListPrice(price);
    if (price > 0 && formItemUnitCost >= 0) {
      const margin = ((price - formItemUnitCost) / price) * 100;
      setFormItemMarginPct(parseFloat(margin.toFixed(2)));
    }
  }

  function handleItemTypeChange(type: 'PRODUCT' | 'SERVICE') {
    setFormItemType(type);
    if (type === 'PRODUCT') {
      if (['HORA', 'GLOBAL', 'MES', 'VISITA', 'SERVICIO'].includes(formItemUnit)) {
        setFormItemUnit('UND');
      }
      if (!formItemSkuOrCode || formItemSkuOrCode.startsWith('SRV-')) {
        setFormItemSkuOrCode(`PROD-${Date.now().toString().slice(-4)}`);
      }
    } else {
      if (['UND', 'PAQUETE', 'CAJA', 'METRO', 'PIEZA'].includes(formItemUnit)) {
        setFormItemUnit('HORA');
      }
      if (!formItemSkuOrCode || formItemSkuOrCode.startsWith('PROD-')) {
        setFormItemSkuOrCode(`SRV-${Date.now().toString().slice(-4)}`);
      }
    }
  }

  function handleOpenCreateItem() {
    setItemModalMode('create');
    setEditingItemId(null);
    setFormItemType('PRODUCT');
    setFormItemName('');
    setFormItemSkuOrCode(`PROD-${Date.now().toString().slice(-4)}`);
    setFormItemDescription('');
    setFormItemUnit('UND');
    setFormItemUnitCost(100);
    setFormItemMarginPct(30);
    setFormItemListPrice(142.86);
    setFormItemCategoryId('cat-01');
    setItemFormError(null);
    setShowItemModal(true);
  }

  function handleOpenEditItem(item: CatalogItem) {
    setItemModalMode('edit');
    setEditingItemId(item.id);
    setFormItemType(item.type);
    setFormItemName(item.name);
    setFormItemDescription(item.description || '');
    setFormItemUnit((item as any).unit || (item.type === 'PRODUCT' ? 'UND' : 'SERVICIO'));
    setFormItemSkuOrCode(item.type === 'PRODUCT' ? (item as any).sku || '' : (item as any).code || '');
    setFormItemUnitCost(item.unitCost);
    setFormItemListPrice(item.listPrice);
    setFormItemCategoryId(item.categoryId || 'cat-01');
    const margin = item.listPrice > 0 ? ((item.listPrice - item.unitCost) / item.listPrice) * 100 : 0;
    setFormItemMarginPct(parseFloat(margin.toFixed(2)));
    setItemFormError(null);
    setShowItemModal(true);
  }

  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!formItemName.trim()) {
      setItemFormError('El nombre del producto o servicio es obligatorio.');
      return;
    }
    if (formItemType === 'PRODUCT' && !formItemSkuOrCode.trim()) {
      setItemFormError('El SKU es obligatorio para registrar un producto.');
      return;
    }
    if (formItemUnitCost < 0) {
      setItemFormError('El costo unitario no puede ser negativo.');
      return;
    }
    if (formItemListPrice < formItemUnitCost) {
      setItemFormError('El precio de lista no puede ser menor al costo unitario.');
      return;
    }

    setItemSaving(true);
    setItemFormError(null);

    const payload: any = {
      name: formItemName.trim(),
      type: formItemType,
      description: formItemDescription.trim(),
      unit: formItemUnit.trim(),
      unitCost: Number(formItemUnitCost),
      listPrice: Number(formItemListPrice),
      categoryId: formItemCategoryId || 'cat-01',
    };

    if (formItemType === 'PRODUCT') {
      payload.sku = formItemSkuOrCode.trim().toUpperCase();
    } else {
      payload.code = formItemSkuOrCode.trim().toUpperCase() || `SRV-${Date.now().toString().slice(-4)}`;
    }

    const endpoint = itemModalMode === 'create'
      ? '/api/v1/catalog-items'
      : `/api/v1/catalog-items/${editingItemId}`;
    const method = itemModalMode === 'create' ? 'POST' : 'PUT';

    const res = await apiRequest<CatalogItem>(endpoint, {
      method,
      body: JSON.stringify(payload),
    });

    setItemSaving(false);

    if (res.error) {
      setItemFormError(res.error.detail || 'Ocurrió un error al guardar el ítem.');
      return;
    }

    if (res.data) {
      if (itemModalMode === 'create') {
        setCatalogItems(prev => [res.data!, ...prev]);
        setToastMessage(`✓ ${formItemType === 'PRODUCT' ? 'Producto' : 'Servicio'} "${res.data.name}" añadido exitosamente al catálogo.`);
      } else {
        setCatalogItems(prev => prev.map(item => item.id === res.data!.id ? res.data! : item));
        setToastMessage(`✓ Ítem "${res.data.name}" actualizado correctamente en el catálogo.`);
      }
      setShowItemModal(false);
    }
  }

  async function handleDeleteItem() {
    if (!itemToDelete) return;
    setItemDeleting(true);

    const res = await apiRequest(`/api/v1/catalog-items/${itemToDelete.id}`, {
      method: 'DELETE',
    });

    setItemDeleting(false);

    if (res.error) {
      setToastMessage(`Error al eliminar: ${res.error.detail || 'No se pudo eliminar el ítem'}`);
      return;
    }

    setCatalogItems(prev => prev.filter(i => i.id !== itemToDelete.id));
    setToastMessage(`✓ Ítem "${itemToDelete.name}" retirado del catálogo.`);
    setItemToDelete(null);
  }

  // Handler for Exporting Audit Logs to CSV
  async function handleExportAuditLogsCsv() {
    setExportingCsv(true);
    try {
      const params = new URLSearchParams();
      if (auditEntityFilter !== 'ALL') params.set('entity', auditEntityFilter);
      if (auditRoleFilter !== 'ALL') params.set('actorRole', auditRoleFilter);
      if (auditSearch.trim()) params.set('q', auditSearch.trim());

      const url = `/api/v1/audit-logs/export.csv?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Error al descargar el archivo CSV');
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `logs-auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setToastMessage('✓ Archivo .csv de logs descargado exitosamente.');
    } catch (err: any) {
      console.error('Error exporting logs CSV:', err);
      setToastMessage('Error al exportar los logs a CSV.');
    } finally {
      setExportingCsv(false);
    }
  }

  // Handler for Downloading Full Application Backup (.json)
  async function handleDownloadBackup() {
    setBackupLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch('/api/v1/system/backup', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error('Error al generar la copia de respaldo');
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `cotizador-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setToastMessage('✓ Copia de respaldo (.json) descargada exitosamente.');
      // Refresh audit logs
      handleRefreshAuditLogs();
    } catch (err: any) {
      console.error('Error downloading backup:', err);
      setToastMessage('Error al generar la copia de seguridad.');
    } finally {
      setBackupLoading(false);
    }
  }

  // Handler for Selecting a Backup File to Restore
  function handleSelectRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreError(null);
    setRestoreSuccess(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const data = parsed?.data || parsed;
        if (!data || typeof data !== 'object') {
          setRestoreError('El archivo no contiene un formato de respaldo JSON válido.');
          return;
        }
        setPendingRestoreData(parsed);
        setShowRestoreModal(true);
      } catch (err) {
        setRestoreError('Error al leer el archivo JSON. Verifique que no esté dañado.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // Handler for Confirming System Restore
  async function handleConfirmRestore() {
    if (!pendingRestoreData) return;
    setRestoreLoading(true);
    setRestoreError(null);

    const res = await apiRequest<{ success: boolean; message: string; restoredCounts: any }>(
      '/api/v1/system/restore',
      {
        method: 'POST',
        body: JSON.stringify(pendingRestoreData),
      }
    );

    setRestoreLoading(false);
    if (res.error) {
      setRestoreError(res.error.detail || 'Fallo al restaurar el sistema.');
      return;
    }

    setRestoreSuccess(res.data?.message || 'Sistema restaurado con éxito.');
    setShowRestoreModal(false);
    setPendingRestoreData(null);
    setToastMessage('✓ Base de datos y estado del sistema restaurados con éxito.');
    // Reload all system data
    await loadAllData();
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row text-slate-800 dark:text-slate-100 transition-colors">
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 p-5 flex flex-col justify-between shrink-0 border-r border-slate-800">
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-3 h-12 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-extrabold text-white text-base shadow-md shrink-0">
              C
            </div>
            <div className="min-w-0">
              <h1 className="font-extrabold text-sm text-white tracking-tight truncate">
                {user.role === 'ADMIN' ? 'Portal Administrador' : 'Panel Comercial'}
              </h1>
              <span className={`text-[10px] font-mono font-medium block truncate ${
                user.role === 'ADMIN' ? 'text-amber-400' : 'text-indigo-400'
              }`}>
                {user.role === 'ADMIN' ? 'Control Corporativo • Maestro' : 'Ventas y Cotizaciones • v1.0'}
              </span>
            </div>
          </div>

          {/* User badge */}
          <div className="h-[68px] flex flex-col justify-center p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-1 shrink-0">
            <span className="text-xs font-bold text-white block truncate">{user.name}</span>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-block truncate ${
                user.role === 'ADMIN'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30'
              }`}>
                {user.role === 'ADMIN' ? '🛡️ ADMINISTRADOR GLOBAL' : '💼 ASESOR COMERCIAL'}
              </span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="space-y-1">
            <button
              onClick={() => {
                setIsWizardOpen(false);
                setCurrentNav('dashboard');
                setDashboardSubView('general');
              }}
              className={`w-full h-10 min-h-[40px] max-h-[40px] flex items-center gap-3 px-3 rounded-lg text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                currentNav === 'dashboard' && dashboardSubView === 'general' && !isWizardOpen
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Resumen General</span>
            </button>

            <button
              onClick={() => {
                setIsWizardOpen(false);
                setCurrentNav('dashboard');
                setDashboardSubView('kpis');
              }}
              className={`w-full h-10 min-h-[40px] max-h-[40px] flex items-center gap-3 px-3 rounded-lg text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                currentNav === 'dashboard' && dashboardSubView === 'kpis' && !isWizardOpen
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span>Métricas & KPIs (P2.i)</span>
            </button>

            <button
              onClick={() => {
                setIsWizardOpen(false);
                setCurrentNav('quotations');
                setQuotationSubView('list');
              }}
              className={`w-full h-10 min-h-[40px] max-h-[40px] flex items-center gap-3 px-3 rounded-lg text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                currentNav === 'quotations' && quotationSubView === 'list' && !isWizardOpen
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>Cotizaciones (Lista)</span>
              <span className="ml-auto shrink-0 bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-mono">
                {quotations.length}
              </span>
            </button>

            <button
              onClick={() => {
                setIsWizardOpen(false);
                setCurrentNav('quotations');
                setQuotationSubView('kanban');
              }}
              className={`w-full h-10 min-h-[40px] max-h-[40px] flex items-center gap-3 px-3 rounded-lg text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                currentNav === 'quotations' && quotationSubView === 'kanban' && !isWizardOpen
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span>Pipeline Kanban (P2.i)</span>
            </button>

            <button
              onClick={() => {
                setIsWizardOpen(false);
                setCurrentNav('quotations');
                setQuotationSubView('follow-up');
              }}
              className={`w-full h-10 min-h-[40px] max-h-[40px] flex items-center gap-3 px-3 rounded-lg text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                currentNav === 'quotations' && quotationSubView === 'follow-up' && !isWizardOpen
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <History className="w-4 h-4 shrink-0" />
              <span>Hoy / Atrasadas (P2.h)</span>
              {quotations.filter((q) => q.nextActionAt && new Date(q.nextActionAt).getTime() <= Date.now() && q.status !== 'ACCEPTED' && q.status !== 'REJECTED').length > 0 && (
                <span className="ml-auto shrink-0 bg-rose-500 text-white px-2 py-0.5 rounded-full text-[10px] font-mono font-bold animate-pulse">
                  {quotations.filter((q) => q.nextActionAt && new Date(q.nextActionAt).getTime() <= Date.now() && q.status !== 'ACCEPTED' && q.status !== 'REJECTED').length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setIsWizardOpen(false);
                setCurrentNav('customers');
              }}
              className={`w-full h-10 min-h-[40px] max-h-[40px] flex items-center gap-3 px-3 rounded-lg text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                currentNav === 'customers' && !isWizardOpen
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Clientes y Contactos</span>
              <span className="ml-auto shrink-0 bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-mono">
                {customers.length}
              </span>
            </button>

            <button
              onClick={() => {
                setIsWizardOpen(false);
                setCurrentNav('catalog');
              }}
              className={`w-full h-10 min-h-[40px] max-h-[40px] flex items-center gap-3 px-3 rounded-lg text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                currentNav === 'catalog' && !isWizardOpen
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span>Catálogo (Prod. y Serv.)</span>
              <span className="ml-auto shrink-0 bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-mono">
                {catalogItems.length}
              </span>
            </button>

            {/* SECCIÓN ASIGNACIÓN EQUIPO COMERCIAL (SOLO ADMIN) */}
            {hasPermission(user, 'users:manage') && (
              <button
                onClick={() => {
                  setIsWizardOpen(false);
                  setCurrentNav('sales-team');
                }}
                className={`w-full h-10 min-h-[40px] max-h-[40px] flex items-center gap-3 px-3 rounded-lg text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                  currentNav === 'sales-team' && !isWizardOpen
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <UserCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Equipo Comercial (Asesores)</span>
                <span className="ml-auto shrink-0 bg-amber-500/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.2 rounded text-[10px] font-bold">
                  {usersList.filter((u) => u.role === 'SALES_REP').length}
                </span>
              </button>
            )}

            {/* SECCIÓN LOGS DE AUDITORÍA & TRAZABILIDAD (ADMIN Y COMERCIAL) */}
            <button
              onClick={() => {
                setIsWizardOpen(false);
                setCurrentNav('audit-logs');
              }}
              className={`w-full h-10 min-h-[40px] max-h-[40px] flex items-center gap-3 px-3 rounded-lg text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                currentNav === 'audit-logs' && !isWizardOpen
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <History className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Logs de Auditoría</span>
              <span className="ml-auto shrink-0 bg-slate-800 text-cyan-300 px-2 py-0.5 rounded-full text-[10px] font-mono">
                {auditLogs.length}
              </span>
            </button>

            <button
              onClick={() => {
                setIsWizardOpen(false);
                setCurrentNav('company');
              }}
              className={`w-full h-10 min-h-[40px] max-h-[40px] flex items-center gap-3 px-3 rounded-lg text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                currentNav === 'company' && !isWizardOpen
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Building className="w-4 h-4 shrink-0" />
              <span>Empresa & Margen Mínimo</span>
              {!hasPermission(user, 'company:edit') && (
                <span title="Solo lectura para Comercial" className="ml-auto shrink-0">
                  <Lock className="w-3 h-3 text-slate-500" />
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setIsWizardOpen(false);
                setCurrentNav('invoices');
              }}
              className={`w-full h-10 min-h-[40px] max-h-[40px] flex items-center gap-3 px-3 rounded-lg text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                currentNav === 'invoices' && !isWizardOpen
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Receipt className="w-4 h-4 shrink-0" />
              <span>Facturación & Cobranzas</span>
              <span className="ml-auto shrink-0 bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-mono">
                {invoices.length}
              </span>
            </button>

            <button
              onClick={() => {
                setIsWizardOpen(false);
                setCurrentNav('operations');
              }}
              className={`w-full h-10 min-h-[40px] max-h-[40px] flex items-center gap-3 px-3 rounded-lg text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                currentNav === 'operations' && !isWizardOpen
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Truck className="w-4 h-4 shrink-0" />
              <span>Operaciones & Despacho</span>
              <span className="ml-auto shrink-0 bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-mono">
                {operations.length}
              </span>
            </button>

            <button
              onClick={() => {
                setIsWizardOpen(false);
                setCurrentNav('notifications');
              }}
              className={`w-full h-10 min-h-[40px] max-h-[40px] flex items-center gap-3 px-3 rounded-lg text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                currentNav === 'notifications' && !isWizardOpen
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Bell className="w-4 h-4 shrink-0" />
              <span>Bandeja Outbox</span>
              <span className="ml-auto shrink-0 bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-mono">
                {outbox.length}
              </span>
            </button>
          </nav>

          {/* AI Assistant Banner */}
          <div className="pt-2">
            <button
              onClick={() => setIsAiOpen(true)}
              className="w-full h-10 min-h-[40px] max-h-[40px] px-3 rounded-lg bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 text-white text-xs font-bold shadow-md hover:opacity-95 transition-opacity flex items-center justify-between cursor-pointer shrink-0"
            >
              <span className="flex items-center gap-2 truncate">
                <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                Asistente IA Gemini
              </span>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded shrink-0">Chat • TTS</span>
            </button>
          </div>
        </div>

        {/* Bottom logout and Swagger link */}
        <div className="pt-6 border-t border-slate-800 space-y-2">
          <a
            href="/api-docs"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-10 min-h-[40px] max-h-[40px] flex items-center justify-center gap-2 px-3 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-medium cursor-pointer transition-colors shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Swagger API Docs (/api-docs)</span>
          </a>

          <button
            onClick={onLogout}
            className="w-full h-10 min-h-[40px] max-h-[40px] flex items-center justify-center gap-2 px-3 rounded-lg border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-900/50 text-xs font-medium cursor-pointer transition-colors shrink-0"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* MAIN VIEW CONTAINER */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        {/* Top action header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              {isWizardOpen
                ? 'Nueva Cotización'
                : currentNav === 'dashboard'
                ? 'Resumen General del Sistema'
                : currentNav === 'quotations'
                ? 'Listado de Cotizaciones y Estados'
                : currentNav === 'customers'
                ? 'Mantenimiento de Clientes y Contactos'
                : currentNav === 'catalog'
                ? 'Catálogo de Productos y Servicios'
                : currentNav === 'sales-team'
                ? 'Equipo Comercial & Asignación de Asesores'
                : currentNav === 'audit-logs'
                ? 'Registro de Actividades & Auditoría (Logs)'
                : currentNav === 'company'
                ? 'Configuración de Empresa y Margen'
                : currentNav === 'invoices'
                ? 'Facturación & Cobranzas'
                : currentNav === 'operations'
                ? 'Operaciones & Despacho'
                : 'Bandeja Outbox (Email & WhatsApp)'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {company?.name} &bull; Margen corporativo mínimo:{' '}
              <strong className="text-indigo-600 dark:text-indigo-400">{company?.minMarginPct}%</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {(import.meta.env?.DEV ?? process.env.NODE_ENV !== 'production') && onSwitchUser && (
              <button
                type="button"
                onClick={() => {
                  if (user.role === 'ADMIN') {
                    const activeRep = usersList.find((u) => u.role === 'SALES_REP' && !u.deletedAt && u.active);
                    const fallbackRep = usersList.find((u) => u.role === 'SALES_REP' && !u.deletedAt);
                    const targetEmail = activeRep?.email || fallbackRep?.email || 'smorales@mlingenieria.cl';
                    onSwitchUser(targetEmail);
                  } else {
                    const adminUser = usersList.find((u) => u.role === 'ADMIN' && !u.deletedAt);
                    const targetEmail = adminUser?.email || 'admin@mlingenieria.cl';
                    onSwitchUser(targetEmail);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors ${
                  user.role === 'ADMIN'
                    ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                    : 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                }`}
                title={
                  user.role === 'ADMIN'
                    ? 'Probar Panel Comercial (Simular vista de asesor de ventas)'
                    : 'Volver al Portal Administrador (Victoria Villegas C.)'
                }
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>
                  {user.role === 'ADMIN' ? 'Probar Panel Comercial' : '← Volver como Admin'}
                </span>
              </button>
            )}

            <ThemeSelector />

            {!isWizardOpen && (
              <button
                onClick={() => setIsWizardOpen(true)}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Nueva Cotización
              </button>
            )}
          </div>
        </div>

        {/* In-app Toast Banner */}
        {toastMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-white cursor-pointer text-xs font-bold px-2 py-0.5"
            >
              ✕
            </button>
          </div>
        )}

        {/* RENDER WIZARD OR CURRENT VIEW */}
        <div className="mt-6">
          {isWizardOpen ? (
            company && (
              <QuotationWizard
                company={company}
                salesRepId={user.id}
                currentUser={user}
                usersList={usersList}
                onFinished={async () => {
                  setIsWizardOpen(false);
                  await loadAllData();
                  setCurrentNav('quotations');
                }}
                onCancel={() => setIsWizardOpen(false)}
              />
            )
          ) : loading ? (
            <div className="space-y-6">
              {currentNav === 'dashboard' && (
                <div className="space-y-6">
                  <KpiGridSkeleton count={4} />
                  <TableSkeleton rows={4} cols={5} />
                </div>
              )}
              {currentNav === 'quotations' && <TableSkeleton rows={8} cols={6} />}
              {currentNav === 'customers' && <TableSkeleton rows={6} cols={5} />}
              {currentNav === 'catalog' && <TableSkeleton rows={8} cols={5} />}
              {currentNav === 'company' && <TableSkeleton rows={4} cols={2} />}
              {currentNav === 'invoices' && <InvoicesGridSkeleton />}
              {currentNav === 'operations' && <OperationsGridSkeleton />}
              {currentNav === 'notifications' && <TableSkeleton rows={6} cols={4} />}
            </div>
          ) : (
            <>
              {/* =================================================== */}
              {/* 1. DASHBOARD                                       */}
              {/* =================================================== */}
              {currentNav === 'dashboard' && dashboardSummary && (
                <div className="space-y-6">
                  {/* Dashboard Subview Switcher */}
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
                    <button
                      type="button"
                      onClick={() => setDashboardSubView('general')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                        dashboardSubView === 'general'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      📊 Resumen Ejecutivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setDashboardSubView('kpis')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                        dashboardSubView === 'kpis'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      📈 Métricas & KPIs del Pipeline (P2.i)
                    </button>
                  </div>

                  {dashboardSubView === 'kpis' ? (
                    <PipelineKpiMetrics
                      currentUser={user}
                      company={company}
                      onCompanyUpdated={loadAllData}
                    />
                  ) : (
                    <div className="space-y-8">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Aceptadas
                      </span>
                      <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                        {dashboardSummary.totalAccepted}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        Tasa de éxito: {dashboardSummary.acceptanceRate}%
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Enviadas / Vistas
                      </span>
                      <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
                        {dashboardSummary.totalSent + dashboardSummary.totalViewed}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {dashboardSummary.totalViewed} abiertas por clientes
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Venta Aceptada
                      </span>
                      <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono">
                        {formatMoney(dashboardSummary.totalAcceptedSales ?? dashboardSummary.acceptedValue ?? 0)}
                      </p>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                        Margen prom: {dashboardSummary.avgMargin ?? dashboardSummary.avgMarginPct ?? 0}%
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Rechazadas
                      </span>
                      <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1 font-mono">
                        {dashboardSummary.totalRejected ?? dashboardSummary.rejected ?? 0}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Con posibilidad de re-cotizar</p>
                    </div>
                  </div>

                  {/* Sales Rep Report (ADMIN: global y por asesor; SALES_REP: no ve a los demás asesores) */}
                  {hasPermission(user, 'dashboard:by_sales_rep') && (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                        Rendimiento y Control por Asesor Comercial / Ingeniero
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                            <tr>
                              <th className="py-2.5 px-3">Asesor / Ingeniero</th>
                              <th className="py-2.5 px-2 text-center">Total Cotiz.</th>
                              <th className="py-2.5 px-2 text-center">Aceptadas</th>
                              <th className="py-2.5 px-2 text-center">Rechazadas</th>
                              <th className="py-2.5 px-2 text-center">Vistas / Env.</th>
                              <th className="py-2.5 px-3 text-right">Ventas Aceptadas</th>
                              <th className="py-2.5 px-2 text-center">Margen Prom.</th>
                              <th className="py-2.5 px-2 text-center">Tasa Cierre</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {salesRepReport.map((sr) => (
                              <tr key={sr.salesRepId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{sr.name || sr.salesRepName}</td>
                                <td className="py-2.5 px-2 text-center font-mono text-slate-700 dark:text-slate-300">{sr.totalQuotes ?? sr.totalQuotations ?? 0}</td>
                                <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  {sr.accepted ?? sr.acceptedQuotations ?? 0}
                                </td>
                                <td className="py-2.5 px-2 text-center font-mono text-rose-600 dark:text-rose-400">
                                  {sr.rejected ?? 0}
                                </td>
                                <td className="py-2.5 px-2 text-center font-mono text-amber-600 dark:text-amber-400">
                                  {(sr.viewed ?? 0) + (sr.sent ?? 0)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                                  {formatMoney(sr.totalSales ?? sr.totalAmount ?? 0)}
                                </td>
                                <td className="py-2.5 px-2 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                  {sr.avgMarginPct ?? 0}%
                                </td>
                                <td className="py-2.5 px-2 text-center font-mono">
                                  <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 font-bold">
                                    {sr.acceptanceRate ?? 0}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Products vs Services Breakdown */}
                  {itemTypeReport && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                            <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            Suministros Navales y Materiales (Bienes Físicos)
                          </span>
                          <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/50 px-2 py-0.5 rounded">
                            Margen: {itemTypeReport.products?.marginPct ?? 0}%
                          </span>
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 font-mono">
                          <div className="flex justify-between">
                            <span>Ventas Facturadas:</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {formatMoney(itemTypeReport.products?.sales ?? itemTypeReport.products?.revenue ?? 0)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Costo de Adquisición:</span>
                            <span>{formatMoney(itemTypeReport.products?.cost ?? 0)}</span>
                          </div>
                          <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-bold border-t border-slate-200 dark:border-slate-800 pt-1">
                            <span>Ganancia Bruta:</span>
                            <span>{formatMoney(itemTypeReport.products?.profit ?? 0)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            Servicios Profesionales de Ingeniería
                          </span>
                          <span className="text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/50 px-2 py-0.5 rounded">
                            Margen: {itemTypeReport.services?.marginPct ?? 0}%
                          </span>
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 font-mono">
                          <div className="flex justify-between">
                            <span>Ventas Facturadas:</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {formatMoney(itemTypeReport.services?.sales ?? itemTypeReport.services?.revenue ?? 0)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Costo de Ejecución:</span>
                            <span>{formatMoney(itemTypeReport.services?.cost ?? 0)}</span>
                          </div>
                          <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-bold border-t border-slate-200 dark:border-slate-800 pt-1">
                            <span>Ganancia Bruta:</span>
                            <span>{formatMoney(itemTypeReport.services?.profit ?? 0)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                    </div>
                  )}
                </div>
              )}

              {/* =================================================== */}
              {/* 2. QUOTATIONS / KANBAN / SEGUIMIENTO               */}
              {/* =================================================== */}
              {currentNav === 'quotations' && (
                <div className="space-y-4">
                  {/* View Mode Switcher (P2.h & P2.i) */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setQuotationSubView('list')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          quotationSubView === 'list'
                            ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        📄 Lista de Cotizaciones
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuotationSubView('kanban')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          quotationSubView === 'kanban'
                            ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        📊 Pipeline Kanban (P2.i)
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuotationSubView('follow-up')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          quotationSubView === 'follow-up'
                            ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        ⏰ Hoy / Atrasadas (P2.h)
                        {quotations.filter((q) => q.nextActionAt && new Date(q.nextActionAt).getTime() <= Date.now() && q.status !== 'ACCEPTED' && q.status !== 'REJECTED').length > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-500 text-white font-bold">
                            {quotations.filter((q) => q.nextActionAt && new Date(q.nextActionAt).getTime() <= Date.now() && q.status !== 'ACCEPTED' && q.status !== 'REJECTED').length}
                          </span>
                        )}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsWizardOpen(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nueva Cotización
                    </button>
                  </div>

                  {quotationSubView === 'kanban' ? (
                    <PipelineKanbanView
                      quotations={quotations}
                      company={company}
                      onRefresh={loadAllData}
                      onOpenPublicLink={onOpenPublicLink}
                      onOfflineAccept={(q) => handleOpenOfflineAccept(q)}
                      onScheduleAction={(q) => handleOpenNextAction(q)}
                    />
                  ) : quotationSubView === 'follow-up' ? (
                    <FollowUpView
                      currentUser={user}
                      onOpenPublicLink={onOpenPublicLink}
                      onSelectQuotation={(q) => handleOpenNextAction(q)}
                      onRefreshQuotations={loadAllData}
                    />
                  ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden space-y-4 p-5">
                      {/* Filters bar */}
                      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center pb-2">
                    <div className="flex gap-2 w-full sm:w-auto">
                      <div className="relative flex-1 sm:w-64">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar por N.º de cotización..."
                          value={quoteSearch}
                          onChange={(e) => setQuoteSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <select
                        value={quoteStatusFilter}
                        onChange={(e) => setQuoteStatusFilter(e.target.value)}
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

                  {/* Quotations Table */}
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="py-2.5 px-3">Número</th>
                          <th className="py-2.5 px-3">Fecha</th>
                          <th className="py-2.5 px-3">Cliente / Contacto</th>
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
                            if (quoteStatusFilter && effectiveStatus !== quoteStatusFilter) return false;
                            if (quoteSearch && !q.quotationNumber.toLowerCase().includes(quoteSearch.toLowerCase()))
                              return false;
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
                                    {(q as any).hasNewerRevision && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                        Superada
                                      </span>
                                    )}
                                  </div>
                                  {q.acceptedOffline && (
                                    <span className="block text-[10px] font-sans font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                                      Registrada por personal (OC: {q.offlinePurchaseOrderNumber || 'S/N'})
                                    </span>
                                  )}
                                  {!q.acceptedOffline && (q as any).clientSignerName && (
                                    <span className="block text-[10px] font-sans font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                                      Firma digital: {(q as any).clientSignerName}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                                  {new Date(q.createdAt).toLocaleDateString()}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                                    {cust?.businessName || 'Cliente'}
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
                                  {q.lossReason && (
                                    <span className="block text-[10px] font-sans text-rose-600 dark:text-rose-400 mt-0.5 font-semibold">
                                      Pérdida: {q.lossReason}
                                    </span>
                                  )}
                                  {q.marginExceptionReason && q.status === 'PENDING_APPROVAL' && (
                                    <span className="block text-[10px] text-amber-700 dark:text-amber-300 mt-0.5 italic" title={q.marginExceptionReason}>
                                      Motivo: {q.marginExceptionReason}
                                    </span>
                                  )}
                                  {q.nextActionAt && (
                                    <span className="block text-[10px] font-mono text-indigo-600 dark:text-indigo-400 mt-0.5" title={q.nextActionNote}>
                                      ⏰ {new Date(q.nextActionAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                                    {/* Revisar Excepción de Margen (P3.l) para ADMIN */}
                                    {q.status === 'PENDING_APPROVAL' && user.role === 'ADMIN' && (
                                      <button
                                        onClick={() => {
                                          setMarginApprovalQuote(q);
                                          setMarginAdminComment('');
                                        }}
                                        title="Revisar y Aprobar/Rechazar Excepción de Margen"
                                        className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500 text-white hover:bg-amber-600 cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                      >
                                        <ShieldAlert className="w-3 h-3" />
                                        <span>Aprobar/Rechazar</span>
                                      </button>
                                    )}

                                    {/* Adjuntos y Enlaces (P3.n) */}
                                    <button
                                      onClick={() => {
                                        setAttachmentsModalQuote(q);
                                        setAttNameInput('');
                                        setAttUrlInput('');
                                        setAttDescInput('');
                                      }}
                                      title={`Documentos y enlaces adjuntos (${q.attachments?.length || 0})`}
                                      className="p-1 rounded text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer relative"
                                    >
                                      <Paperclip className="w-3.5 h-3.5" />
                                      {q.attachments && q.attachments.length > 0 && (
                                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-indigo-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                                          {q.attachments.length}
                                        </span>
                                      )}
                                    </button>

                                    {/* Open Public link button / Print */}
                                    <button
                                      onClick={() => onOpenPublicLink(q.publicToken)}
                                      title="Abrir enlace público cliente / Imprimir PDF"
                                      className="p-1 rounded text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Historial de revisiones */}
                                    <button
                                      onClick={() => handleOpenRevisionsHistory(q)}
                                      title="Ver historial de revisiones del grupo"
                                      className="p-1 rounded text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                    >
                                      <History className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Crear revisión (para cotizaciones no-borrador) */}
                                    {q.status !== 'DRAFT' && (
                                      <button
                                        onClick={() => handleCreateRevision(q.id)}
                                        title={effectiveStatus === 'EXPIRED' ? 'Reactivar (Crear revisión)' : 'Crear nueva revisión'}
                                        className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                        <span>{effectiveStatus === 'EXPIRED' ? 'Reactivar' : 'Crear Revisión'}</span>
                                      </button>
                                    )}

                                    {/* Duplicar desde cero */}
                                    <button
                                      onClick={() => handleDuplicateQuote(q.id)}
                                      title="Duplicar como nueva desde cero"
                                      className="p-1 rounded text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Aceptación Offline con Orden de Compra */}
                                    {q.status !== 'DRAFT' && q.status !== 'ACCEPTED' && q.status !== 'REJECTED' && (
                                      <button
                                        onClick={() => handleOpenOfflineAccept(q)}
                                        title="Registrar aceptación offline por el personal (con OC)"
                                        className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                      >
                                        <ShieldCheck className="w-3 h-3" />
                                        <span>Aceptación Offline</span>
                                      </button>
                                    )}

                                    {/* Programar Próxima Acción (P2.h) */}
                                    <button
                                      onClick={() => handleOpenNextAction(q)}
                                      title="Programar Próxima Acción (Fecha y Nota de Seguimiento)"
                                      className="p-1 rounded text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                    >
                                      <History className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Recordatorio en Bandeja de Salida (P2.h) */}
                                    <button
                                      onClick={() => handleSendFollowUpReminder(q.id)}
                                      disabled={reminderSendingId === q.id}
                                      title="Enviar recordatorio de seguimiento a bandeja de salida (Outbox)"
                                      className="p-1 rounded text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                                    >
                                      <Bell className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Desestimar con Motivo de Pérdida (P2.h) */}
                                    {q.status !== 'ACCEPTED' && q.status !== 'REJECTED' && (
                                      <button
                                        onClick={() => handleOpenStaffReject(q)}
                                        title="Desestimar cotización con motivo de pérdida formal"
                                        className="p-1 rounded text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                      >
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                      </button>
                                    )}

                                    {/* Manual Status change */}
                                    <button
                                      onClick={() => setSelectedQuotationForStatus(q)}
                                      title="Cambiar estado internamente (con comentario)"
                                      className="p-1 rounded text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
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
                </div>
              )}

              {/* =================================================== */}
              {/* 3. CUSTOMERS & CONTACTS                             */}
              {/* =================================================== */}
              {currentNav === 'customers' && (
                <div className="space-y-6">
                  {/* Top Info Banner */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                          Cartera Corporativa de Clientes & Contactos
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 shrink-0">
                          Gestión Compartida: Admin & Comercial
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Administración y el Panel Comercial pueden crear, modificar y dar de baja clientes y sus contactos con trazabilidad en los logs de auditoría.
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        onClick={() => {
                          setNewCustName('');
                          setNewCustRut('');
                          setNewCustAddress('');
                          setNewCustSalesRepId(user.id || 'usr-sales-01');
                          setShowNewCustModal(true);
                        }}
                        className="px-3.5 py-2 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Nuevo Cliente</span>
                      </button>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Buscar por Razón Social, RUT o dirección..."
                        value={custSearch}
                        onChange={(e) => setCustSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    {custSearch && (
                      <button
                        type="button"
                        onClick={() => setCustSearch('')}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>

                  {/* Customers Table */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                    {(() => {
                      const filteredCusts = customers.filter((c) => {
                        if (!custSearch.trim()) return true;
                        const q = custSearch.toLowerCase();
                        return (
                          c.businessName.toLowerCase().includes(q) ||
                          c.taxId.includes(q) ||
                          (c.address && c.address.toLowerCase().includes(q))
                        );
                      });

                      if (filteredCusts.length === 0) {
                        return (
                          <div className="p-8 text-center text-slate-500 dark:text-slate-400 space-y-2">
                            <Users className="w-8 h-8 mx-auto text-slate-400" />
                            <p className="font-semibold text-xs">No se encontraron clientes registrados</p>
                            <p className="text-[11px]">Intente con otro término o registre un nuevo cliente en el sistema.</p>
                          </div>
                        );
                      }

                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                              <tr>
                                <th className="py-2.5 px-3">Razón Social</th>
                                <th className="py-2.5 px-3">RUT</th>
                                <th className="py-2.5 px-3">Dirección Fiscal</th>
                                <th className="py-2.5 px-3">Asesor Asignado</th>
                                <th className="py-2.5 px-3 text-center">Contactos</th>
                                <th className="py-2.5 px-3 text-center w-28">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {filteredCusts.map((c) => {
                                const rep = usersList.find((u) => u.id === c.salesRepId);
                                return (
                                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                                      {c.businessName}
                                    </td>
                                    <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400 font-semibold">
                                      {c.taxId}
                                    </td>
                                    <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                                      {c.address || 'Sin dirección registrada'}
                                    </td>
                                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-medium">
                                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                                        <Briefcase className="w-3 h-3 text-indigo-500" />
                                        {rep ? rep.name : 'Asesor Comercial'}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenContacts(c)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-semibold text-xs cursor-pointer border border-indigo-200 dark:border-indigo-800/50 shadow-2xs"
                                        title="Gestionar contactos y credenciales"
                                      >
                                        <Users className="w-3.5 h-3.5" />
                                        <span>Contactos &rarr;</span>
                                      </button>
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEditCustomer(c)}
                                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 cursor-pointer shadow-xs"
                                          title="Editar datos del cliente"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        {hasPermission(user, 'customers:deactivate') && (
                                          <button
                                            type="button"
                                            onClick={() => setCustToDelete(c)}
                                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 cursor-pointer shadow-xs"
                                            title="Dar de baja cliente (Solo Administrador)"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
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
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* =================================================== */}
              {/* 4. CATALOG (PRODUCTS & SERVICES)                    */}
              {/* =================================================== */}
              {currentNav === 'catalog' && (
                <div className="space-y-6">
                  {/* Top Info Banner on Portal Relation */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                          Catálogo Maestro de Productos y Servicios
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 shrink-0">
                          Sincronización Bidireccional Activa
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {hasPermission(user, 'catalog:create')
                          ? 'Como Administrador, usted administra el catálogo central. Puede añadir nuevos productos o servicios, editar precios y dar de baja ítems con impacto inmediato en el cotizador.'
                          : 'Como Asesor Comercial, usted tiene acceso de solo lectura al catálogo central. Puede consultar los costos unitarios y precios de lista para el cálculo de márgenes en sus cotizaciones. La creación, edición o baja de ítems es exclusiva de la Administración.'}
                      </p>
                    </div>

                    {hasPermission(user, 'catalog:create') && (
                      <div className="shrink-0 self-start md:self-auto">
                        <button
                          type="button"
                          onClick={handleOpenCreateItem}
                          className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors flex items-center gap-2 cursor-pointer shadow-sm shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Nuevo Ítem (Prod. / Serv.)</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Catálogo</span>
                      <p className="text-xl font-extrabold font-mono text-slate-900 dark:text-white mt-1">
                        {catalogItems.length}
                      </p>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">ítems activos disponibles</span>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                      <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" /> Productos Físicos
                      </span>
                      <p className="text-xl font-extrabold font-mono text-blue-700 dark:text-blue-400 mt-1">
                        {catalogItems.filter((i) => i.type === 'PRODUCT').length}
                      </p>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">con SKU y unidad física</span>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                      <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block flex items-center gap-1">
                        <Wrench className="w-3.5 h-3.5" /> Servicios
                      </span>
                      <p className="text-xl font-extrabold font-mono text-purple-700 dark:text-purple-400 mt-1">
                        {catalogItems.filter((i) => i.type === 'SERVICE').length}
                      </p>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">con código y tarifas</span>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Margen Promedio</span>
                      <p className="text-xl font-extrabold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                        {catalogItems.length > 0
                          ? (
                              catalogItems.reduce((acc, i) => {
                                const m = i.listPrice > 0 ? ((i.listPrice - i.unitCost) / i.listPrice) * 100 : 0;
                                return acc + m;
                              }, 0) / catalogItems.length
                            ).toFixed(1)
                          : '0.0'}
                        %
                      </p>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Mínimo exigido: {company?.minMarginPct || 25}%
                      </span>
                    </div>
                  </div>

                  {/* Filter and Table Card */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
                    {/* Filter bar */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                      <div className="relative w-full sm:w-80">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar por nombre, SKU o código..."
                          value={catalogSearch}
                          onChange={(e) => setCatalogSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setCatalogTypeFilter('ALL')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                            catalogTypeFilter === 'ALL'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          Todos ({catalogItems.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCatalogTypeFilter('PRODUCT')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                            catalogTypeFilter === 'PRODUCT'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          Productos ({catalogItems.filter((i) => i.type === 'PRODUCT').length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCatalogTypeFilter('SERVICE')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                            catalogTypeFilter === 'SERVICE'
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          Servicios ({catalogItems.filter((i) => i.type === 'SERVICE').length})
                        </button>
                      </div>
                    </div>

                    {/* Table */}
                    {(() => {
                      const filteredItems = catalogItems.filter((item) => {
                        if (catalogTypeFilter !== 'ALL' && item.type !== catalogTypeFilter) return false;
                        if (!catalogSearch.trim()) return true;
                        const q = catalogSearch.toLowerCase();
                        return (
                          item.name.toLowerCase().includes(q) ||
                          (item.description && item.description.toLowerCase().includes(q)) ||
                          ((item as any).sku && (item as any).sku.toLowerCase().includes(q)) ||
                          ((item as any).code && (item as any).code.toLowerCase().includes(q))
                        );
                      });

                      if (filteredItems.length === 0) {
                        return (
                          <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 space-y-2">
                            <Layers className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-500" />
                            <p className="font-semibold text-xs">No se encontraron productos ni servicios</p>
                            <p className="text-[11px]">Intente con otro término de búsqueda o registre un nuevo ítem en el catálogo.</p>
                            <button
                              type="button"
                              onClick={handleOpenCreateItem}
                              className="mt-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer"
                            >
                              + Crear Nuevo Ítem
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                              <tr>
                                <th className="py-2.5 px-3">Tipo</th>
                                <th className="py-2.5 px-2 text-center">Identificador</th>
                                <th className="py-2.5 px-3">Nombre & Especificación</th>
                                <th className="py-2.5 px-2 text-center">Unidad</th>
                                <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                                <th className="py-2.5 px-3 text-right">P. Lista</th>
                                <th className="py-2.5 px-2 text-center">Margen %</th>
                                <th className="py-2.5 px-3 text-center w-28">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {filteredItems.map((item) => {
                                const marginPct = item.listPrice > 0 
                                  ? ((item.listPrice - item.unitCost) / item.listPrice) * 100 
                                  : 0;
                                const meetsMargin = marginPct >= (company?.minMarginPct || 25);

                                return (
                                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="py-2.5 px-3">
                                      <ItemTypeBadge type={item.type} />
                                    </td>
                                    <td className="py-2.5 px-2 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                                      {item.type === 'PRODUCT' ? (
                                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] text-blue-700 dark:text-blue-300 border border-slate-200 dark:border-slate-700">
                                          {(item as any).sku || 'N/A'}
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] text-purple-700 dark:text-purple-300 border border-slate-200 dark:border-slate-700">
                                          {(item as any).code || 'N/A'}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <p className="font-semibold text-slate-900 dark:text-white">{item.name}</p>
                                      {item.description && (
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{item.description}</p>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-2 text-center font-mono font-medium text-slate-700 dark:text-slate-300">
                                      <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                        {(item as any).unit || 'UND'}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                                      {formatMoney(item.unitCost)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                      {formatMoney(item.listPrice)}
                                    </td>
                                    <td className="py-2.5 px-2 text-center">
                                      <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                                        meetsMargin
                                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                                          : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
                                      }`}>
                                        {marginPct.toFixed(1)}%
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      {hasPermission(user, 'catalog:edit') || hasPermission(user, 'catalog:deactivate') ? (
                                        <div className="flex items-center justify-center gap-1.5">
                                          {hasPermission(user, 'catalog:edit') && (
                                            <button
                                              type="button"
                                              onClick={() => handleOpenEditItem(item)}
                                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 cursor-pointer shadow-xs"
                                              title="Editar producto o servicio"
                                            >
                                              <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                          {hasPermission(user, 'catalog:deactivate') && (
                                            <button
                                              type="button"
                                              onClick={() => setItemToDelete(item)}
                                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 cursor-pointer shadow-xs"
                                              title="Eliminar del catálogo"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-[11px] text-slate-400 font-medium italic">
                                          Solo lectura
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* =================================================== */}
              {/* 5. COMPANY SETTINGS & MIN MARGIN                   */}
              {/* =================================================== */}
              {currentNav === 'company' && company && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 max-w-3xl shadow-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">Datos de la Empresa y Margen Mínimo</h3>
                      {user.role === 'ADMIN' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Edición Autorizada (Admin)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Estático &bull; Solo Lectura
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {user.role === 'ADMIN'
                        ? 'Configuración institucional única. Como Administrador, usted puede calibrar el margen corporativo mínimo exigido para toda la fuerza comercial.'
                        : 'Parámetros institucionales definidos por la Administración. En el Panel Comercial esta configuración es estática y no modificable.'}
                    </p>
                  </div>

                  {/* Role-based Guidance Banner */}
                  {user.role === 'ADMIN' ? (
                    <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Privilegio Exclusivo del Administrador</p>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                          Usted es la única entidad autorizada para modificar el margen corporativo. Toda modificación queda asentada automáticamente en los logs de auditoría para conocimiento de todo el equipo comercial.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs flex items-start gap-2.5">
                      <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">Sección Estática &mdash; Panel Comercial</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          El margen mínimo institucional y las credenciales empresariales solo pueden ser editadas desde el <strong>Portal de Administrador</strong>. Cualquier cotización con margen inferior al fijado requerirá aprobación especial o será bloqueada.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Minimum Margin, Hard Floor, and UF Rate Section */}
                    {user.role === 'ADMIN' ? (
                      <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-4 col-span-full">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
                          <div className="flex flex-col justify-between space-y-1.5">
                            <label className="text-xs font-extrabold text-indigo-950 dark:text-indigo-200 h-9 flex items-end leading-snug">
                              MARGEN MÍNIMO CORPORATIVO (%)
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="99"
                              value={editMinMargin}
                              onChange={(e) => setEditMinMargin(parseFloat(e.target.value) || 25)}
                              className="w-full h-11 px-3 py-2 text-base font-bold font-mono rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 text-indigo-900 dark:text-indigo-200 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                            />
                            <p className="text-[11px] text-indigo-800 dark:text-indigo-300 min-h-[1.5rem] flex items-start">
                              Mínimo regular ({company.minMarginPct}%).
                            </p>
                          </div>

                          <div className="flex flex-col justify-between space-y-1.5">
                            <label className="text-xs font-extrabold text-amber-950 dark:text-amber-200 h-9 flex items-end leading-snug">
                              PISO DURO DE MARGEN (%)
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="99"
                              value={editHardMinMargin}
                              onChange={(e) => setEditHardMinMargin(parseFloat(e.target.value) || 18)}
                              className="w-full h-11 px-3 py-2 text-base font-bold font-mono rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 text-center focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                            />
                            <p className="text-[11px] text-amber-800 dark:text-amber-300 min-h-[1.5rem] flex items-start">
                              Piso duro no negociable.
                            </p>
                          </div>

                          <div className="flex flex-col justify-between space-y-1.5">
                            <label className="text-xs font-extrabold text-cyan-950 dark:text-cyan-200 h-9 flex items-end leading-snug">
                              VALOR UF DEL DÍA ($ CLP)
                            </label>
                            <input
                              type="number"
                              step="1"
                              min="1"
                              value={editUfRate}
                              onChange={(e) => setEditUfRate(parseFloat(e.target.value) || 38500)}
                              className="w-full h-11 px-3 py-2 text-base font-bold font-mono rounded-lg border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-slate-800 text-cyan-900 dark:text-cyan-200 text-center focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs"
                            />
                            <p className="text-[11px] text-cyan-800 dark:text-cyan-300 min-h-[1.5rem] flex items-start">
                              Conversión diaria de CLP a UF.
                            </p>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-indigo-200/60 dark:border-indigo-800/40 flex justify-end">
                          <button
                            onClick={handleUpdateCompanyMargin}
                            className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors cursor-pointer shadow-sm flex items-center gap-2"
                          >
                            <ShieldCheck className="w-4 h-4" />
                            Guardar Parámetros de Margen y UF
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3 col-span-full">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                            POLÍTICA DE PRECIOS Y MARGEN (ESTÁTICA)
                          </label>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1 font-mono">
                            <Lock className="w-3 h-3" /> Fijo &bull; No editable
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <span className="text-xs text-slate-500 block">Margen Mínimo:</span>
                            <span className="text-2xl font-bold font-mono text-indigo-700 dark:text-indigo-400">
                              {company.minMarginPct.toFixed(2)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500 block">Piso Duro (P3.l):</span>
                            <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                              {(company.hardMinMarginPct || 18).toFixed(2)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500 block">Valor UF (P3.m):</span>
                            <span className="text-2xl font-bold font-mono text-cyan-600 dark:text-cyan-400">
                              $ {(company.ufRate || 38500).toLocaleString('es-CL')}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Razón Social</label>
                      <input
                        type="text"
                        disabled
                        value={company.legalName}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">RUT</label>
                      <input
                        type="text"
                        disabled
                        value={company.rut || ''}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Moneda / Impuesto</label>
                      <input
                        type="text"
                        disabled
                        value={`${company.currency} - IVA ${company.taxRatePct}%`}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tiempo de Sesión (Minutos)</label>
                      <input
                        type="text"
                        disabled
                        value={`${company.sessionTimeoutMinutes} minutos`}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Motivos de Pérdida Configurables (P2.h) */}
                  {user.role === 'ADMIN' && (
                    <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                            <span>🚫</span> Motivos de Pérdida Formal (P2.h)
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Lista institucional configurable por el ADMIN para desestimación de cotizaciones.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {configuredLossReasons.map((reason) => (
                          <span
                            key={reason}
                            className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
                          >
                            <span>{reason}</span>
                            {configuredLossReasons.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const next = configuredLossReasons.filter((r) => r !== reason);
                                  handleSaveConfiguredLossReasons(next);
                                }}
                                className="text-slate-400 hover:text-rose-600 cursor-pointer text-[11px]"
                                title="Eliminar motivo"
                              >
                                ✕
                              </button>
                            )}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Añadir nuevo motivo de pérdida..."
                          value={newReasonInput}
                          onChange={(e) => setNewReasonInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newReasonInput.trim()) {
                              e.preventDefault();
                              const next = [...configuredLossReasons, newReasonInput.trim().toLowerCase()];
                              setNewReasonInput('');
                              handleSaveConfiguredLossReasons(next);
                            }
                          }}
                          className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newReasonInput.trim()) {
                              const next = [...configuredLossReasons, newReasonInput.trim().toLowerCase()];
                              setNewReasonInput('');
                              handleSaveConfiguredLossReasons(next);
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 cursor-pointer shadow-xs"
                        >
                          + Añadir Motivo
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Probabilidades de Pipeline por Estado (P2.i) */}
                  {user.role === 'ADMIN' && (
                    <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                            <span>📈</span> Probabilidades del Pipeline Ponderado (P2.i)
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Calibración de la probabilidad de cierre para cada estado en proceso.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleSavePipelineProbabilities}
                          className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 cursor-pointer shadow-xs"
                        >
                          Guardar Probabilidades
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        {['DRAFT', 'SENT', 'VIEWED', 'CHANGES_REQUESTED'].map((st) => (
                          <div key={st} className="space-y-1 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                              {st === 'DRAFT' ? 'Borrador' : st === 'SENT' ? 'Enviada' : st === 'VIEWED' ? 'Vista por Cliente' : 'Ajustes Solicitados'}
                            </span>
                            <div className="flex items-center gap-1 font-mono font-bold">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={configuredProbabilities[st] ?? 10}
                                onChange={(e) => {
                                  const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                  setConfiguredProbabilities((prev) => ({ ...prev, [st]: val }));
                                }}
                                className="w-16 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-right"
                              />
                              <span>%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* System Backup & Restore Section (Solo disponible en Portal Admin) */}
                  {user.role === 'ADMIN' && (
                    <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                              Copia de Seguridad y Respaldo del Sistema (Backup & Restore)
                            </h4>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Descargue una copia completa de la base de datos (catálogo, clientes, cotizaciones, facturas y auditoría) o restaure un respaldo previo.
                          </p>
                        </div>
                      </div>

                      {restoreSuccess && (
                        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
                          {restoreSuccess}
                        </div>
                      )}
                      {restoreError && (
                        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-300 text-xs font-medium">
                          {restoreError}
                        </div>
                      )}

                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="space-y-0.5 text-xs">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                            Instantánea Integral de Datos
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                            Archivo .json con todas las entidades del sistema y metadatos de exportación.
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={handleDownloadBackup}
                            disabled={backupLoading}
                            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors disabled:opacity-50"
                          >
                            <Download className="w-3.5 h-3.5" />
                            {backupLoading ? 'Generando...' : 'Descargar Backup (.json)'}
                          </button>

                          <label className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors">
                            <Upload className="w-3.5 h-3.5 text-amber-500" />
                            <span>Restaurar Copia...</span>
                            <input
                              type="file"
                              accept=".json,application/json"
                              onChange={handleSelectRestoreFile}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* =================================================== */}
              {/* 6. NOTIFICATIONS OUTBOX                             */}
              {/* =================================================== */}
              {currentNav === 'notifications' && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Bandeja transaccional Outbox. Registra todos los correos electrónicos y mensajes de WhatsApp emitidos.
                  </p>

                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="py-2.5 px-3">Canal</th>
                          <th className="py-2.5 px-3">Destinatario</th>
                          <th className="py-2.5 px-3">Mensaje / Asunto</th>
                          <th className="py-2.5 px-2 text-center">Estado</th>
                          <th className="py-2.5 px-3 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {outbox.map((msg) => (
                          <tr key={msg.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="py-2.5 px-3 font-semibold">
                              {msg.channel === 'WHATSAPP' ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                                  <Phone className="w-3.5 h-3.5" /> WhatsApp
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-indigo-700 dark:text-indigo-400 font-bold">
                                  <Mail className="w-3.5 h-3.5" /> Email
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-800 dark:text-slate-200 block">{msg.recipientName}</span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{msg.recipient}</span>
                            </td>
                            <td className="py-2.5 px-3 max-w-sm truncate text-slate-600 dark:text-slate-300">
                              {msg.subject ? <strong>{msg.subject}: </strong> : null}
                              {msg.body}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                                {msg.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {msg.channel === 'WHATSAPP' && msg.recipient && (
                                <a
                                  href={`https://wa.me/${msg.recipient.replace(/\D/g, '')}?text=${encodeURIComponent(
                                    msg.body
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold text-[11px] hover:bg-emerald-700 cursor-pointer shadow-xs"
                                >
                                  Abrir en WhatsApp &rarr;
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* =================================================== */}
              {/* 7. FACTURACIÓN Y COBRANZAS                          */}
              {/* =================================================== */}
              {currentNav === 'invoices' && (
                <div className="space-y-6">
                  {/* Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Total Facturación
                      </span>
                      <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono">
                        {formatMoney(invoices.reduce((acc, i) => acc + (i.total || 0), 0))}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{invoices.length} facturas emitidas</p>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/30 shadow-xs">
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                        Total Cobrado
                      </span>
                      <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                        {formatMoney(invoices.filter((i) => i.status === 'PAID').reduce((acc, i) => acc + (i.total || 0), 0))}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Comprobantes cancelados</p>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/30 shadow-xs">
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                        Pendiente de Cobro
                      </span>
                      <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 font-mono">
                        {formatMoney(invoices.filter((i) => i.status !== 'PAID').reduce((acc, i) => acc + (i.total || 0), 0))}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Saldo por cobrar</p>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">Registro de Facturas Emitidas</h3>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Generadas a partir de cotizaciones aceptadas</span>
                    </div>

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
                                      onClick={() => setSelectedInvoiceDetails(inv)}
                                      className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                                      title="Ver hitos y detalle de abonos"
                                    >
                                      Hitos & Pagos
                                    </button>
                                    {inv.status !== 'PAID' && (
                                      <button
                                        onClick={() => handleOpenRecordPayment(inv)}
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
                  </div>
                </div>
              )}

              {/* =================================================== */}
              {/* 8. OPERACIONES Y DESPACHO                           */}
              {/* =================================================== */}
              {currentNav === 'operations' && (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Órdenes Totales
                      </span>
                      <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono">
                        {operations.length}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">En seguimiento logístico</p>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                        Entrega de suministros
                      </span>
                      <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1 font-mono">
                        {operations.filter((o) => o.type === 'PRODUCT_DELIVERY').length}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Guías de despacho</p>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                      <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                        Servicio de ingeniería y entregables
                      </span>
                      <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-1 font-mono">
                        {operations.filter((o) => o.type === 'SERVICE_EXECUTION').length}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Ingenieros asignados</p>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                        Completadas
                      </span>
                      <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                        {operations.filter((o) => o.status === 'COMPLETED').length}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Con actas de entrega</p>
                    </div>
                  </div>

                  {/* Orders Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {operations.map((op) => (
                      <div
                        key={op.id}
                        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs"
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-400">
                                {op.orderNumber}
                              </span>
                              <span className="text-[11px] font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {op.quotationNumber}
                              </span>
                            </div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm mt-1 flex items-center gap-1.5">
                              {op.type === 'PRODUCT_DELIVERY' ? (
                                <Package className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                              ) : (
                                <Wrench className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                              )}
                              {op.title}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Cliente: {op.customerBusinessName}</p>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                              op.status === 'COMPLETED'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                                : op.status === 'IN_PROGRESS'
                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50'
                                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50'
                            }`}
                          >
                            {op.status === 'COMPLETED' ? 'Completado' : op.status === 'IN_PROGRESS' ? 'En Proceso' : 'Programado'}
                          </span>
                        </div>

                        {/* Progress Bar & Slider */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Avance calculado desde hitos (P2.k):</span>
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {op.progressPct}% ({op.milestones?.filter((m) => m.status === 'COMPLETED').length || 0}/{op.milestones?.length || 0} hitos)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
                              style={{ width: `${op.progressPct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-slate-400">
                              {op.deliverables?.length || 0} entregable(s) técnicos
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOpForMilestones(op);
                                setShowMilestonesModal(true);
                              }}
                              className="px-2.5 py-1 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] hover:bg-indigo-100 dark:hover:bg-indigo-900/60 cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                            >
                              <span>📋 Hitos y Entregables &rarr;</span>
                            </button>
                          </div>
                        </div>

                        {/* Logistics details */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs space-y-1 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          <p>
                            <strong>Responsable / Transporte:</strong> {op.assignedStaff}
                          </p>
                          <p>
                            <strong>Fecha Programada:</strong> {op.scheduledDate}
                          </p>
                          {op.guideNumber && (
                            <p>
                              <strong>Guía de Remisión:</strong> <span className="font-mono text-indigo-700 dark:text-indigo-400 font-bold">{op.guideNumber}</span>
                            </p>
                          )}
                          {op.deliveryAddress && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              <strong>Destino:</strong> {op.deliveryAddress}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* =================================================== */}
              {/* 9. SALES TEAM & COMMERCIAL ADVISOR ASSIGNMENT       */}
              {/* (ADMIN ONLY: Asignar personas con acceso al Panel)  */}
              {/* =================================================== */}
              {currentNav === 'sales-team' && user.role === 'ADMIN' && (
                <div className="space-y-6">
                  {/* Top Info Banner */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                          Gestión y Asignación del Equipo Comercial
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 flex items-center gap-1 shrink-0">
                          <ShieldCheck className="w-3 h-3" /> Control del Administrador
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Asigne las personas (asesores comerciales) que trabajarán en la empresa y tendrán acceso al <strong>Panel Comercial</strong> para cotizar y atender clientes.
                      </p>
                    </div>

                    <div className="shrink-0 self-start md:self-auto">
                      <button
                        type="button"
                        onClick={handleOpenCreateUser}
                        className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors shrink-0"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>+ Asignar Nuevo Asesor Comercial</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Total Asesores Comerciales
                      </span>
                      <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono">
                        {usersList.filter((u) => u.role === 'SALES_REP').length}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Asignados al equipo de ventas</p>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/30 shadow-xs">
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                        Acceso Comercial Activo
                      </span>
                      <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                        {usersList.filter((u) => u.role === 'SALES_REP' && u.active).length}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Pueden ingresar al panel comercial</p>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/30 shadow-xs">
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                        Accesos Suspendidos
                      </span>
                      <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 font-mono">
                        {usersList.filter((u) => u.role === 'SALES_REP' && !u.active).length}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Temporalmente inhabilitados</p>
                    </div>
                  </div>

                  {/* Users Table */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                        Asesores con Acceso al Panel Comercial
                      </h4>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Cada asesor asignado puede cotizar y atender a sus clientes
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="py-2.5 px-3">Asesor Comercial</th>
                            <th className="py-2.5 px-3">Correo / Usuario Acceso</th>
                            <th className="py-2.5 px-3">Teléfono / WhatsApp</th>
                            <th className="py-2.5 px-3 text-center">Clientes Asignados</th>
                            <th className="py-2.5 px-3 text-center">Acceso al Panel</th>
                            <th className="py-2.5 px-3 text-center w-48">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {usersList
                            .filter((u) => u.role === 'SALES_REP')
                            .map((advisor) => {
                              const assignedCount = customers.filter((c) => c.salesRepId === advisor.id).length;
                              return (
                                <tr key={advisor.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                  <td className="py-3 px-3">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center">
                                        {advisor.name.charAt(0)}
                                      </div>
                                      <div>
                                        <span className="font-semibold text-slate-900 dark:text-white block">
                                          {advisor.name}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-mono">ID: {advisor.id}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300 font-medium">
                                    {advisor.email}
                                  </td>
                                  <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-mono">
                                    {advisor.phone || 'No registrado'}
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {assignedCount} clientes
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleUserAccess(advisor)}
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-all border ${
                                        advisor.active
                                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100'
                                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/50 hover:bg-rose-100'
                                      }`}
                                      title={advisor.active ? 'Clic para suspender acceso al panel' : 'Clic para habilitar acceso al panel'}
                                    >
                                      {advisor.active ? (
                                        <>
                                          <UserCheck className="w-3 h-3 text-emerald-600" />
                                          <span>Acceso Habilitado</span>
                                        </>
                                      ) : (
                                        <>
                                          <UserX className="w-3 h-3 text-rose-600" />
                                          <span>Acceso Suspendido</span>
                                        </>
                                      )}
                                    </button>
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      {/* Quick simulate login as this advisor */}
                                      {onSwitchUser && (
                                        <button
                                          type="button"
                                          onClick={() => onSwitchUser(advisor.email)}
                                          className="px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 cursor-pointer shadow-xs transition-colors flex items-center gap-1 text-[11px] font-bold shrink-0"
                                          title={`Probar Panel Comercial como ${advisor.name}`}
                                        >
                                          <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                          <span>Probar Panel</span>
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditUser(advisor)}
                                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer shadow-xs transition-colors"
                                        title="Editar datos del asesor"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setUserToDelete(advisor)}
                                        className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-800/60 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer shadow-xs transition-colors"
                                        title="Eliminar asesor comercial del equipo"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* =================================================== */}
              {/* 10. AUDIT LOGS & DECISION REGISTRY                  */}
              {/* (Accessible by BOTH Admin and Commercial Panel)     */}
              {/* =================================================== */}
              {currentNav === 'audit-logs' && (
                <div className="space-y-6">
                  {/* Top Info Banner */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                          Registro de Auditoría y Trazabilidad de Decisiones Compartidas
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800/50 flex items-center gap-1 font-mono shrink-0">
                          <History className="w-3 h-3" /> Transparencia Total
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Bitácora viva que permite al Administrador y al Panel Comercial conocer con exactitud quién tomó cada decisión en Catálogo, Clientes, Contactos, Políticas de Margen y Equipo Comercial.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleExportAuditLogsCsv}
                        disabled={exportingCsv}
                        className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0 disabled:opacity-50"
                        title="Exportar registros filtrados a formato .csv para Microsoft Excel o Google Sheets"
                      >
                        <FileDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{exportingCsv ? 'Exportando...' : 'Exportar a CSV (.csv)'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRefreshAuditLogs}
                        disabled={auditLoading}
                        className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${auditLoading ? 'animate-spin' : ''} shrink-0`} />
                        <span>Actualizar Logs</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter Pills and Search */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {/* Entity Filters */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
                          <Filter className="w-3 h-3" /> Ámbito:
                        </span>
                        {[
                          { key: 'ALL', label: 'Todos' },
                          { key: 'CATALOG', label: 'Catálogo' },
                          { key: 'CUSTOMERS', label: 'Clientes' },
                          { key: 'CONTACTS', label: 'Contactos' },
                          { key: 'COMPANY', label: 'Empresa & Margen' },
                          { key: 'USERS', label: 'Equipo Comercial' },
                        ].map((f) => (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => setAuditEntityFilter(f.key)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                              auditEntityFilter === f.key
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>

                      {/* Role Filters */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">
                          Actor:
                        </span>
                        {[
                          { key: 'ALL', label: 'Todos' },
                          { key: 'ADMIN', label: 'Administrador' },
                          { key: 'SALES_REP', label: 'Comercial' },
                        ].map((r) => (
                          <button
                            key={r.key}
                            type="button"
                            onClick={() => setAuditRoleFilter(r.key)}
                            className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
                              auditRoleFilter === r.key
                                ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 font-bold'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Search inside logs */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Buscar por descripción, ítem, cliente o autor del cambio..."
                        value={auditSearch}
                        onChange={(e) => setAuditSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Audit Logs Table */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                    {(() => {
                      const filteredLogs = auditLogs.filter((log) => {
                        if (auditEntityFilter !== 'ALL' && log.entity !== auditEntityFilter) return false;
                        if (auditRoleFilter !== 'ALL' && log.actorRole !== auditRoleFilter) return false;
                        if (!auditSearch.trim()) return true;
                        const q = auditSearch.toLowerCase();
                        return (
                          ((log.description || log.summary || '').toLowerCase().includes(q)) ||
                          ((log.entityName || log.entityId || '').toLowerCase().includes(q)) ||
                          ((log.actorName || log.userName || '').toLowerCase().includes(q))
                        );
                      });

                      if (filteredLogs.length === 0) {
                        return (
                          <div className="p-8 text-center text-slate-500 dark:text-slate-400 space-y-2">
                            <History className="w-8 h-8 mx-auto text-slate-400" />
                            <p className="font-semibold text-xs">No se encontraron registros de auditoría</p>
                            <p className="text-[11px]">Intente ajustando los filtros o realice acciones en Catálogo o Clientes para ver los eventos.</p>
                          </div>
                        );
                      }

                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                              <tr>
                                <th className="py-2.5 px-3">Fecha y Hora</th>
                                <th className="py-2.5 px-3">Actor / Decisor</th>
                                <th className="py-2.5 px-3">Ámbito</th>
                                <th className="py-2.5 px-2 text-center">Acción</th>
                                <th className="py-2.5 px-3">Detalle de la Decisión / Modificación</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {filteredLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                  <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap text-[11px]">
                                    {log.timestamp
                                      ? new Date(log.timestamp).toLocaleString('es-CL', {
                                          month: 'short',
                                          day: '2-digit',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          second: '2-digit',
                                        })
                                      : '-'}
                                  </td>
                                  <td className="py-3 px-3">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                        log.actorRole === 'ADMIN'
                                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
                                          : log.actorRole === 'SALES_REP'
                                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50'
                                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                                      }`}>
                                        {log.actorRole === 'ADMIN' ? 'Admin' : log.actorRole === 'SALES_REP' ? 'Comercial' : 'Cliente'}
                                      </span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                                        {log.actorName}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 font-medium">
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                      {log.entity === 'CATALOG' && <Layers className="w-3 h-3 text-purple-500" />}
                                      {log.entity === 'CUSTOMERS' && <Building className="w-3 h-3 text-blue-500" />}
                                      {log.entity === 'CONTACTS' && <Users className="w-3 h-3 text-emerald-500" />}
                                      {log.entity === 'COMPANY' && <DollarSign className="w-3 h-3 text-amber-500" />}
                                      {log.entity === 'USERS' && <UserCheck className="w-3 h-3 text-indigo-500" />}
                                      {log.entity}
                                    </span>
                                  </td>
                                  <td className="py-3 px-2 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                      log.action === 'CREATE'
                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                                        : log.action === 'UPDATE'
                                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50'
                                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                                    }`}>
                                      {log.action}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-medium">
                                    <p>{log.description}</p>
                                    {log.entityName && (
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        Elemento: {log.entityName}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* MODAL: Manual Status Change with mandatory comment */}
      {selectedQuotationForStatus && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Cambio Manual de Estado &mdash; {selectedQuotationForStatus.quotationNumber}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              El cambio manual de estado por parte de un comercial exige registrar un comentario justificado que quedará en el historial de trazabilidad.
            </p>

            {manualError && (
              <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs font-medium">
                {manualError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nuevo Estado:</label>
              <select
                value={manualStatus}
                onChange={(e) => setManualStatus(e.target.value as QuotationStatus)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
              >
                <option value="SENT">Enviada / Pendiente</option>
                <option value="CHANGES_REQUESTED">Ajustes Solicitados</option>
                <option value="DRAFT">Borrador</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Nota: El estado <strong>Vista por Cliente</strong> solo se activa automáticamente cuando el cliente abre y lee la propuesta. No se permite forzar ACEPTADA o RECHAZADA arbitrariamente; para registrar una compra física use <strong>Aceptación Offline</strong>.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Comentario Justificatorio *:</label>
              <textarea
                rows={3}
                placeholder="Indique el motivo detallado de esta modificación manual..."
                value={manualComment}
                onChange={(e) => setManualComment(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedQuotationForStatus(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyManualStatus}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer shadow-sm"
              >
                Aplicar Cambio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Revisions History (P1.a) */}
      {showRevisionsModal && selectedQuoteForRevisions && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="space-y-0.5">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Historial de Revisiones &mdash; {selectedQuoteForRevisions.rootQuotationNumber || selectedQuoteForRevisions.quotationNumber.replace(/-R\d+$/, '')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Grupo: <span className="font-mono text-[11px]">{selectedQuoteForRevisions.quotationGroupId || selectedQuoteForRevisions.id}</span>
                </p>
              </div>
              <button
                onClick={() => setShowRevisionsModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {revisionsLoading ? (
              <div className="py-8 text-center text-xs text-slate-400">Cargando revisiones...</div>
            ) : revisionsList.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">No se encontraron otras revisiones.</div>
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
                    {revisionsList.map((rev) => (
                      <tr
                        key={rev.id}
                        className={rev.id === selectedQuoteForRevisions.id ? 'bg-indigo-50/50 dark:bg-indigo-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}
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
                            onClick={() => {
                              setShowRevisionsModal(false);
                              onOpenPublicLink(rev.publicToken);
                            }}
                            className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1"
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
                onClick={() => setShowRevisionsModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Offline Acceptance (P1.d) */}
      {showOfflineAcceptModal && selectedQuoteForOfflineAccept && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
                Registrar Aceptación Offline por el Personal
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cotización: <strong className="font-mono text-slate-800 dark:text-slate-200">{selectedQuoteForOfflineAccept.quotationNumber}</strong>
              </p>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Exige registrar el número de orden de compra o referencia formal remitida por el mandante, junto con observaciones. El estado cambiará a <strong>ACEPTADA</strong> y se generará automáticamente el documento de cobro con sus hitos.
            </p>

            {offlineAcceptError && (
              <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs font-medium">
                {offlineAcceptError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  N.º de Orden de Compra o Referencia *
                </label>
                <input
                  type="text"
                  placeholder="Ej. OC-2026-8842 / HES-991"
                  value={offlinePO}
                  onChange={(e) => setOfflinePO(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Comentario / Observaciones de la Aprobación *
                </label>
                <textarea
                  rows={3}
                  placeholder="Ej. Recepción conforme de OC vía correo electrónico por Gerencia de Operaciones..."
                  value={offlineNote}
                  onChange={(e) => setOfflineNote(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowOfflineAcceptModal(false)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={offlineAcceptLoading || !offlinePO.trim() || !offlineNote.trim()}
                onClick={handleSubmitOfflineAccept}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {offlineAcceptLoading ? 'Registrando...' : 'Confirmar Aceptación Offline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Record Payment / Abono (P1.e) */}
      {showPaymentModal && selectedInvoiceForPayment && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="space-y-0.5">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Receipt className="w-5 h-5" />
                Registrar Pago / Abono
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Documento: <strong className="font-mono text-slate-800 dark:text-slate-200">{selectedInvoiceForPayment.invoiceNumber}</strong>
              </p>
            </div>

            {/* Balances overview */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500 text-[11px]">Total Documento:</span>
                <p className="font-bold font-mono text-slate-800 dark:text-slate-200">{formatMoney(selectedInvoiceForPayment.total)}</p>
              </div>
              <div>
                <span className="text-amber-600 dark:text-amber-400 text-[11px] font-semibold">Saldo Pendiente:</span>
                <p className="font-bold font-mono text-amber-600 dark:text-amber-400">
                  {formatMoney(selectedInvoiceForPayment.balance !== undefined ? selectedInvoiceForPayment.balance : selectedInvoiceForPayment.total)}
                </p>
              </div>
            </div>

            {paymentError && (
              <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs font-medium">
                {paymentError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Monto a Abonar (CLP) *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Método de Pago *</label>
                <select
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
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Referencia / N.º Comprobante / Transacción *
                </label>
                <input
                  type="text"
                  placeholder="Ej. Transf. Banco Santander Nro 8847102"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Fecha del Pago *</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Notas u Observaciones (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. Abono correspondiente a anticipo 50%"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={paymentLoading || paymentAmount <= 0 || !paymentRef.trim()}
                onClick={handleSubmitPayment}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {paymentLoading ? 'Registrando...' : 'Registrar Pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Invoice Details with Payment Milestones & History (P1.e) */}
      {selectedInvoiceDetails && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  Documento de Cobro: {selectedInvoiceDetails.invoiceNumber}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cotización Ref: <strong className="font-mono text-indigo-600">{selectedInvoiceDetails.quotationNumber}</strong> | Cliente: {selectedInvoiceDetails.customerBusinessName}
                </p>
              </div>
              <button
                onClick={() => setSelectedInvoiceDetails(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Balances summary */}
            <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-center">
              <div>
                <span className="text-slate-500 text-[11px]">Total:</span>
                <p className="font-bold font-mono text-slate-900 dark:text-white">{formatMoney(selectedInvoiceDetails.total)}</p>
              </div>
              <div>
                <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">Total Pagado:</span>
                <p className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{formatMoney(selectedInvoiceDetails.paidAmount || 0)}</p>
              </div>
              <div>
                <span className="text-amber-600 dark:text-amber-400 text-[11px] font-semibold">Saldo Pendiente:</span>
                <p className="font-bold font-mono text-amber-600 dark:text-amber-400">
                  {formatMoney(selectedInvoiceDetails.balance !== undefined ? selectedInvoiceDetails.balance : selectedInvoiceDetails.total)}
                </p>
              </div>
            </div>

            {/* Payment Schedule Milestones (P1.e) */}
            <div className="space-y-2">
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                Hitos de Cobro Programados (Payment Schedule):
              </span>
              {(!selectedInvoiceDetails.paymentSchedule || selectedInvoiceDetails.paymentSchedule.length === 0) ? (
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
                      {selectedInvoiceDetails.paymentSchedule.map((ms) => (
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
              {(!selectedInvoiceDetails.payments || selectedInvoiceDetails.payments.length === 0) ? (
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
                      {selectedInvoiceDetails.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2 px-3 font-sans text-slate-600">{p.paymentDate}</td>
                          <td className="py-2 px-3 font-sans font-medium text-slate-800 dark:text-slate-200">{p.paymentMethod}</td>
                          <td className="py-2 px-3 text-slate-600">{p.reference}</td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-600">{formatMoney(p.amount)}</td>
                          <td className="py-2 px-3 font-sans text-slate-500">{p.registeredBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setSelectedInvoiceDetails(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {showNewCustModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Registrar Nuevo Cliente</h3>
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Razón Social *</label>
                <input
                  type="text"
                  placeholder="Ej. Austral Salmón & Mar SpA"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">RUT / RUN (ej. 76.543.210-4) *</label>
                <input
                  type="text"
                  placeholder="76.543.210-4"
                  value={newCustRut}
                  onChange={(e) => setNewCustRut(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Dirección Comercial</label>
                <input
                  type="text"
                  placeholder="Av. Angelmó 1450, Puerto Montt"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewCustModal(false)}
                className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateCustomer}
                disabled={!newCustName || !newCustRut}
                className="px-4 py-1.5 rounded bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer shadow-sm disabled:opacity-50"
              >
                Guardar Cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER: Manage Contacts for Customer */}
      {activeCustForContacts && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-xl w-full max-h-[85vh] flex flex-col p-6 space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Contactos de {activeCustForContacts.businessName}
                </h3>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  RUT: {activeCustForContacts.taxId}
                </span>
              </div>
              <button
                onClick={() => setActiveCustForContacts(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer font-bold text-base"
              >
                &times;
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 max-h-64 space-y-1">
              {custContacts.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No hay contactos registrados aún para este cliente.
                </div>
              ) : (
                custContacts.map((contact) => (
                  <div key={contact.id} className="py-2.5 text-xs">
                    {editingContact?.id === contact.id ? (
                      /* Inline Contact Edit Form */
                      <form onSubmit={handleSaveEditContact} className="p-3 rounded-lg bg-indigo-50/50 dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-900 dark:text-indigo-200 text-xs">Editar Contacto</span>
                          <button
                            type="button"
                            onClick={() => setEditingContact(null)}
                            className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <input
                            type="text"
                            placeholder="Nombre y Apellido"
                            value={editContactName}
                            onChange={(e) => setEditContactName(e.target.value)}
                            className="p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            required
                          />
                          <input
                            type="text"
                            placeholder="Cargo"
                            value={editContactPosition}
                            onChange={(e) => setEditContactPosition(e.target.value)}
                            className="p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          />
                          <input
                            type="email"
                            placeholder="Email corporativo"
                            value={editContactEmail}
                            onChange={(e) => setEditContactEmail(e.target.value)}
                            className="p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            required
                          />
                          <input
                            type="tel"
                            placeholder="WhatsApp"
                            value={editContactPhone}
                            onChange={(e) => setEditContactPhone(e.target.value)}
                            className="p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingContact(null)}
                            className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={contactSaving}
                            className="px-3 py-1 rounded bg-indigo-600 text-white font-bold text-[11px] hover:bg-indigo-700 cursor-pointer shadow-xs disabled:opacity-50"
                          >
                            {contactSaving ? 'Guardando...' : 'Guardar Cambios'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* Display Contact Item */
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {contact.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                              {contact.position}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono block">
                            {contact.email} &bull; {contact.phone}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                              contact.portalTokenRevoked
                                ? 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/50'
                                : 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/50'
                            }`}
                            title="Estado de acceso con Enlace Mágico al portal"
                          >
                            {contact.portalTokenRevoked ? 'Acceso Revocado' : 'Portal: Enlace Activo'}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleGenerateContactMagicLink(contact)}
                            className="p-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                            title="Enviar enlace de acceso al portal (usa la bandeja de salida)"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>

                          {!contact.portalTokenRevoked && (
                            <button
                              type="button"
                              onClick={() => handleRevokeContactAccess(contact)}
                              className="p-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer"
                              title="Revocar acceso al portal"
                            >
                              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenEditContact(contact)}
                            className="p-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                            title="Editar datos del contacto"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {hasPermission(user, 'contacts:deactivate') && (
                            <button
                              type="button"
                              onClick={() => setContactToDelete(contact)}
                              className="p-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                              title="Dar de baja contacto (Solo Administrador)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add contact form */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg space-y-2 border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Agregar Nuevo Contacto:</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Nombre y Apellido"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
                <input
                  type="text"
                  placeholder="Cargo (ej: Jefe TI)"
                  value={newContactPosition}
                  onChange={(e) => setNewContactPosition(e.target.value)}
                  className="p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
                <input
                  type="email"
                  placeholder="Email corporativo"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  className="p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
                <input
                  type="tel"
                  placeholder="WhatsApp (+56 9...)"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  className="p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <button
                type="button"
                onClick={handleCreateContact}
                disabled={!newContactName || !newContactEmail || !newContactPhone}
                className="w-full py-1.5 rounded bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                + Guardar Contacto y Generar Acceso al Portal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create / Edit Catalog Item */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                    {itemModalMode === 'create'
                      ? 'Añadir Nuevo Ítem al Catálogo'
                      : 'Editar Ítem del Catálogo'}
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    user.role === 'ADMIN'
                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
                      : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50'
                  }`}>
                    {user.role === 'ADMIN' ? '🛡️ Admin' : '💼 Comercial'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {user.role === 'ADMIN'
                    ? 'Los cambios se sincronizan en tiempo real con el panel Comercial y el Asistente de Cotizaciones.'
                    : 'Los cambios se guardan en la base central y se reflejan instantáneamente en el Portal del Administrador.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 text-lg font-bold cursor-pointer transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveItem} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {itemFormError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{itemFormError}</span>
                </div>
              )}

              {/* Item Type Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Tipo de Ítem *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleItemTypeChange('PRODUCT')}
                    className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all text-left ${
                      formItemType === 'PRODUCT'
                        ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-xs">Producto Físico</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Bienes tangibles con SKU y control de stock
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleItemTypeChange('SERVICE')}
                    className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all text-left ${
                      formItemType === 'SERVICE'
                        ? 'border-purple-500 bg-purple-50/70 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 ring-2 ring-purple-500/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0">
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-xs">Servicio Profesional</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Consultoría, mano de obra, horas y soporte
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Identifier and Category Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>
                      {formItemType === 'PRODUCT' ? 'Código SKU *' : 'Código de Servicio *'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Identificador único</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={formItemType === 'PRODUCT' ? 'Ej. PROD-5010' : 'Ej. SRV-7020'}
                    value={formItemSkuOrCode}
                    onChange={(e) => setFormItemSkuOrCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Categoría *
                  </label>
                  <select
                    value={formItemCategoryId}
                    onChange={(e) => setFormItemCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    {categories.length > 0 ? (
                      categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="cat-01">Hardware & Servidores</option>
                        <option value="cat-02">Redes & Telecomunicaciones</option>
                        <option value="cat-03">Servicios de Soporte</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Item Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Nombre del Ítem *
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    formItemType === 'PRODUCT'
                      ? 'Ej. Kit de Ánodos de Sacrificio de Zinc para Casco 5.5 kg'
                      : 'Ej. Estudio de Estabilidad y Cuadernillo Técnico DIRECTEMAR'
                  }
                  value={formItemName}
                  onChange={(e) => setFormItemName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Unit of Measure */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Unidad de Medida *</span>
                  <span className="text-[10px] text-slate-400 font-mono">{formItemUnit}</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(formItemType === 'PRODUCT'
                    ? ['UND', 'PAQUETE', 'CAJA', 'METRO', 'KG', 'PIEZA', 'SET', 'ROLLO']
                    : ['HORA', 'MES', 'GLOBAL', 'VISITA', 'PROYECTO', 'SESION', 'SERVICIO', 'DIA']
                  ).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setFormItemUnit(u)}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold cursor-pointer transition-colors ${
                        formItemUnit === u
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="O escriba una unidad personalizada..."
                  value={formItemUnit}
                  onChange={(e) => setFormItemUnit(e.target.value.toUpperCase())}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Descripción / Alcance Técnico
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalle especificaciones técnicas, marca, garantía, alcance o requisitos de entrega..."
                  value={formItemDescription}
                  onChange={(e) => setFormItemDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Financial & Margin Calculator Card */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Calculadora Financiera de Costo, Margen y Precio
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Mínimo exigido: <strong>{company?.minMarginPct || 25}%</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                      Costo Unitario (CLP) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formItemUnitCost}
                      onChange={(e) =>
                        handleCostOrMarginChange(
                          parseFloat(e.target.value) || 0,
                          formItemMarginPct
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                      Margen sobre Venta (%)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="99"
                      value={formItemMarginPct}
                      onChange={(e) =>
                        handleCostOrMarginChange(
                          formItemUnitCost,
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                      Precio de Lista (CLP) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={formItemUnitCost}
                      value={formItemListPrice}
                      onChange={(e) =>
                        handlePriceChange(parseFloat(e.target.value) || 0)
                      }
                      className="w-full px-3 py-2 rounded-lg border border-indigo-400 dark:border-indigo-600 bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-mono font-extrabold text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border font-mono ${
                      formItemMarginPct >= (company?.minMarginPct || 25)
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
                    }`}>
                      {formItemMarginPct >= (company?.minMarginPct || 25)
                        ? '✓ Cumple margen corporativo'
                        : '⚠️ Margen por debajo del sugerido'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Ganancia unitaria: <strong className="font-mono text-slate-900 dark:text-white">{formatMoney((formItemListPrice || 0) - (formItemUnitCost || 0))}</strong>
                  </span>
                </div>
              </div>

              {/* Form Footer Buttons */}
              <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={itemSaving || !formItemName.trim()}
                  className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer transition-colors shadow-sm flex items-center gap-1.5"
                >
                  {itemSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : itemModalMode === 'create' ? (
                    'Añadir al Catálogo'
                  ) : (
                    'Guardar Cambios'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirm Delete Catalog Item */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
                  ¿Retirar Ítem del Catálogo?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Acción autorizada para Administrador y Comercial
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white">{itemToDelete.name}</span>
                <ItemTypeBadge type={itemToDelete.type} />
              </div>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Identificador: {(itemToDelete as any).sku || (itemToDelete as any).code || itemToDelete.id} &bull; Precio: {formatMoney(itemToDelete?.listPrice)}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                El ítem se marcará como inactivo. No podrá ser seleccionado en nuevas cotizaciones comerciales, pero se preservará su historial en cotizaciones previas.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={itemDeleting}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                disabled={itemDeleting}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50 cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                {itemDeleting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  'Confirmar Eliminación'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Customer */}
      {showEditCustModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Editar Cliente</h3>
              <button
                type="button"
                onClick={() => setShowEditCustModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEditCustomer} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Razón Social *</label>
                <input
                  type="text"
                  value={editCustName}
                  onChange={(e) => setEditCustName(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">RUT / RUN (ej. 76.543.210-4) *</label>
                <input
                  type="text"
                  value={editCustRut}
                  onChange={(e) => setEditCustRut(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Dirección Fiscal</label>
                <input
                  type="text"
                  value={editCustAddress}
                  onChange={(e) => setEditCustAddress(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Asesor Comercial Asignado</label>
                <select
                  value={editCustSalesRepId}
                  onChange={(e) => setEditCustSalesRepId(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                >
                  {usersList
                    .filter((u) => u.role === 'SALES_REP')
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditCustModal(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={custSaving || !editCustName.trim() || !editCustRut.trim()}
                  className="px-4 py-1.5 rounded bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {custSaving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirm Delete Customer */}
      {custToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
                  ¿Dar de Baja al Cliente?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Acción compartida: Administrador & Comercial
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <span className="font-bold text-slate-900 dark:text-white block">{custToDelete.businessName}</span>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                RUT: {custToDelete.taxId} &bull; ID: {custToDelete.id}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                El cliente se marcará como inactivo y no aparecerá en nuevas cotizaciones. Se mantendrá el historial de cotizaciones previas.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCustToDelete(null)}
                disabled={custDeleting}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteCustomer}
                disabled={custDeleting}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50 cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                {custDeleting ? 'Eliminando...' : 'Confirmar Baja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirm Delete Contact */}
      {contactToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
                  ¿Eliminar Contacto?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Se revocará el acceso al portal de este contacto
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <span className="font-bold text-slate-900 dark:text-white block">{contactToDelete.name}</span>
              <p className="text-slate-500 text-[11px] font-mono">{contactToDelete.position} &bull; {contactToDelete.email}</p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setContactToDelete(null)}
                disabled={contactDeleting}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteContact}
                disabled={contactDeleting}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {contactDeleting ? 'Eliminando...' : 'Confirmar Eliminación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create / Edit Commercial Advisor (Admin Only) */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  {userModalMode === 'create' ? 'Asignar Nuevo Asesor Comercial' : 'Editar Asesor Comercial'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {userFormError && (
              <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-800 dark:text-rose-200 text-xs">
                {userFormError}
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Nombre Completo *</label>
                <input
                  type="text"
                  placeholder="Ej. Marina Salas"
                  value={formUserName}
                  onChange={(e) => setFormUserName(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Correo Electrónico (Usuario de Acceso) *</label>
                <input
                  type="email"
                  placeholder="ejemplo@cotizador.com"
                  value={formUserEmail}
                  onChange={(e) => setFormUserEmail(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Teléfono / WhatsApp</label>
                <input
                  type="tel"
                  placeholder="+56 9 8765 4321"
                  value={formUserPhone}
                  onChange={(e) => setFormUserPhone(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /> Rol Asignado: Asesor Comercial
                </p>
                <p>
                  Tendrá acceso completo al Panel Comercial para gestionar cotizaciones, clientes y el catálogo maestro.
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                {userModalMode === 'edit' && editingUserId ? (
                  <button
                    type="button"
                    onClick={() => {
                      const u = usersList.find((usr) => usr.id === editingUserId);
                      setShowUserModal(false);
                      if (u) setUserToDelete(u);
                    }}
                    className="text-rose-600 dark:text-rose-400 hover:text-rose-700 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar Asesor</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowUserModal(false)}
                    className="px-3.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={userSaving || !formUserName.trim() || !formUserEmail.trim()}
                    className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {userSaving ? 'Guardando...' : userModalMode === 'create' ? 'Asignar Asesor' : 'Guardar Cambios'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirm Delete Commercial Advisor */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                  ¿Eliminar Asesor Comercial?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Esta acción eliminará al asesor definitivamente del equipo y del sistema
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block text-sm">{userToDelete.name}</span>
                  <p className="text-slate-500 text-[11px] font-mono">{userToDelete.email}</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
                  Asesor Comercial
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5 text-slate-600 dark:text-slate-300">
                <p className="text-[11px] flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Reasignación automática de cartera:
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-5">
                  Los <strong>{customers.filter((c) => c.salesRepId === userToDelete.id).length} clientes</strong> asignados a este asesor serán transferidos automáticamente al resto del equipo comercial disponible.
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-5">
                  La eliminación se registrará en los logs de auditoría institucional con fecha y usuario ejecutor.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={userDeleting}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={userDeleting}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{userDeleting ? 'Eliminando...' : 'Sí, Eliminar Asesor'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirm System Restore */}
      {showRestoreModal && pendingRestoreData && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                  ¿Restaurar Base de Datos del Sistema?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Operación crítica autorizada exclusivamente para el Administrador
                </p>
              </div>
            </div>

            {restoreError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-800 dark:text-rose-200 text-xs font-medium">
                {restoreError}
              </div>
            )}

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2.5">
              <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                <span className="font-bold">Origen del Respaldo:</span>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {pendingRestoreData?.metadata?.exportedAt
                    ? new Date(pendingRestoreData.metadata.exportedAt).toLocaleString('es-CL')
                    : 'Copia JSON'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-center font-mono">
                <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 block">Cotizaciones</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {pendingRestoreData?.data?.quotations?.length ?? pendingRestoreData?.counts?.quotations ?? 0}
                  </span>
                </div>
                <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 block">Clientes</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {pendingRestoreData?.data?.customers?.length ?? pendingRestoreData?.counts?.customers ?? 0}
                  </span>
                </div>
                <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 block">Catálogo</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {pendingRestoreData?.data?.catalogItems?.length ?? pendingRestoreData?.counts?.catalogItems ?? 0}
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
                onClick={() => {
                  setShowRestoreModal(false);
                  setPendingRestoreData(null);
                }}
                disabled={restoreLoading}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={restoreLoading}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                {restoreLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Restaurando Base de Datos...</span>
                  </>
                ) : (
                  'Confirmar y Restaurar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OPERATIONS MILESTONES & DELIVERABLES MODAL (P2.k) */}
      <OperationsMilestonesModal
        isOpen={showMilestonesModal}
        onClose={() => {
          setShowMilestonesModal(false);
          setSelectedOpForMilestones(null);
        }}
        operation={selectedOpForMilestones}
        onOperationUpdated={loadAllData}
      />

      {/* NEXT ACTION MODAL (P2.h) */}
      {showNextActionModal && selectedQuoteForNextAction && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <span>⏰</span> Programar Próxima Acción &mdash; {selectedQuoteForNextAction.quotationNumber}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Defina la fecha y detalle descriptivo del próximo contacto o tarea de seguimiento con el cliente.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Fecha de Próxima Acción *:</label>
              <input
                type="date"
                value={formNextActionDate}
                onChange={(e) => setFormNextActionDate(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nota Descriptiva *:</label>
              <textarea
                rows={3}
                placeholder="Ej: Llamar a jefe de máquinas para revisar condiciones técnicas..."
                value={formNextActionNote}
                onChange={(e) => setFormNextActionNote(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNextActionModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitNextAction}
                disabled={nextActionSaving}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer shadow-sm"
              >
                {nextActionSaving ? 'Guardando...' : 'Guardar Próxima Acción'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAFF REJECT WITH LOSS REASON MODAL (P2.h) */}
      {showStaffRejectModal && selectedQuoteForStaffReject && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <span>🚫</span> Desestimar Cotización &mdash; {selectedQuoteForStaffReject.quotationNumber}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Seleccione obligatoriamente el motivo de pérdida formal para alimentar las métricas y KPIs.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Motivo de Pérdida *:</label>
              <select
                value={formLossReason}
                onChange={(e) => setFormLossReason(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold"
              >
                {(company?.lossReasons || ['precio', 'plazo', 'competencia', 'proyecto aplazado', 'otro']).map((r) => (
                  <option key={r} value={r}>
                    {r.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Observaciones Adicionales:</label>
              <textarea
                rows={3}
                placeholder="Detalle o justificación adicional del rechazo..."
                value={formStaffRejectNote}
                onChange={(e) => setFormStaffRejectNote(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowStaffRejectModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitStaffReject}
                disabled={staffRejectSaving}
                className="px-4 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer shadow-sm"
              >
                {staffRejectSaving ? 'Registrando...' : 'Confirmar Rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: P3.l APROBACIÓN DE EXCEPCIÓN DE MARGEN POR ADMIN */}
      {marginApprovalQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  Resolución de Excepción de Margen (P3.l)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cotización {marginApprovalQuote.quotationNumber} &bull; {marginApprovalQuote.customerBusinessName}
                </p>
              </div>
              <button
                onClick={() => setMarginApprovalQuote(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Margin comparison stats */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-center border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Margen Propuesto</span>
                <span className="text-base font-extrabold font-mono text-amber-600 dark:text-amber-400">
                  {marginApprovalQuote.marginPct.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Mínimo Corporativo</span>
                <span className="text-base font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
                  {company?.minMarginPct || 28}%
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Piso Duro</span>
                <span className="text-base font-extrabold font-mono text-rose-600 dark:text-rose-400">
                  {company?.hardMinMarginPct || 18}%
                </span>
              </div>
            </div>

            {/* Motivo escrito por el asesor */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Motivo del Asesor ({marginApprovalQuote.salesRepName}):
              </label>
              <div className="p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 italic">
                {marginApprovalQuote.marginExceptionReason || 'No se detalló motivo.'}
              </div>
            </div>

            {/* Comentario del Administrador */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Comentario de Resolución de Administración:
              </label>
              <textarea
                rows={3}
                placeholder="Escriba su justificación de aprobación o rechazo (obligatorio para rechazar)..."
                value={marginAdminComment}
                onChange={(e) => setMarginAdminComment(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMarginApprovalQuote(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRejectMargin}
                disabled={marginProcessing}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {marginProcessing ? 'Procesando...' : 'Rechazar Excepción'}
              </button>
              <button
                type="button"
                onClick={handleApproveMargin}
                disabled={marginProcessing}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {marginProcessing ? 'Procesando...' : 'Aprobar Excepción (marginException)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: P3.n ENLACES Y ARCHIVOS ADJUNTOS EN COTIZACIÓN */}
      {attachmentsModalQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Paperclip className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Archivos y Enlaces Adjuntos (P3.n)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cotización {attachmentsModalQuote.quotationNumber} &bull; {attachmentsModalQuote.customerBusinessName}
                </p>
              </div>
              <button
                onClick={() => setAttachmentsModalQuote(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Lista actual de adjuntos */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Documentos Vinculados:</label>
              {!attachmentsModalQuote.attachments || attachmentsModalQuote.attachments.length === 0 ? (
                <p className="text-xs text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-center">
                  No hay enlaces o archivos adjuntos en esta cotización.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                  {attachmentsModalQuote.attachments.map((att) => (
                    <div key={att.id} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-900 dark:text-white block truncate">{att.name}</span>
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 text-[11px] truncate"
                          >
                            {att.url} <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveQuotationAttachment(att.id)}
                        className="text-rose-600 hover:text-rose-700 font-semibold text-xs cursor-pointer shrink-0"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Formulario para agregar enlace */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Vincular Nuevo Archivo o Enlace Externo:
              </span>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Nombre descriptivo (ej. Memoria de Cálculo Hidrostática)"
                  value={attNameInput}
                  onChange={(e) => setAttNameInput(e.target.value)}
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
                <input
                  type="url"
                  placeholder="URL del archivo (ej. https://drive.google.com/...)"
                  value={attUrlInput}
                  onChange={(e) => setAttUrlInput(e.target.value)}
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Descripción o nota opcional"
                    value={attDescInput}
                    onChange={(e) => setAttDescInput(e.target.value)}
                    className="flex-1 p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                  <button
                    onClick={handleAddQuotationAttachment}
                    disabled={attSaving || !attNameInput.trim() || !attUrlInput.trim()}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 cursor-pointer disabled:opacity-50"
                  >
                    {attSaving ? 'Guardando...' : '+ Vincular'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAttachmentsModalQuote(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GEMINI AI ASSISTANT MODAL */}
      <AiAssistant isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} />
    </div>
  );
}
