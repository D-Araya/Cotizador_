import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Calendar as CalendarIcon,
  History,
  Receipt,
  Truck,
  LogOut,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Building,
  User,
  Loader2,
  AlertCircle,
  ExternalLink,
  Package,
  Wrench,
  Download,
  Printer,
  CreditCard,
  MapPin,
  Check,
  MessageSquare,
  Send,
  RotateCcw,
} from 'lucide-react';
import { Quotation, User as UserType, Invoice, OperationOrder } from '../../modules/types.ts';
import { StatusBadge, statusLabels, getEffectiveQuotationStatus } from './CommonBadges.tsx';
import { ThemeSelector } from '../theme.tsx';
import {
  KpiGridSkeleton,
  TableSkeleton,
  CalendarSkeleton,
  TimelineSkeleton,
  InvoicesGridSkeleton,
  OperationsGridSkeleton,
} from './Skeleton.tsx';
import { apiRequest, subscribeToQuotationSync, notifyQuotationSync } from '../api.ts';
import { formatMoney } from '../../shared-kernel/formatMoney.ts';

const t = {
  portalTitle: 'Portal Corporativo del Cliente',
  welcomeBack: 'Bienvenido de nuevo',
  dashboard: 'Panel General',
  quotations: 'Mis Cotizaciones',
  calendar: 'Calendario Mensual',
  timeline: 'Línea de Tiempo',
  invoices: 'Facturación y Pagos',
  operations: 'Operaciones y Entregas',
  logout: 'Cerrar Sesión',
  accepted: 'Aceptadas',
  pending: 'Pendientes de Revisión',
  rejected: 'Rechazadas',
  totalQuotes: 'Total de Propuestas',
  number: 'N.º Cotización',
  date: 'Fecha',
  salesRep: 'Asesor Comercial',
  total: 'Importe Total',
  status: 'Estado',
  actions: 'Acciones',
  viewDetails: 'Ver Detalle',
  acceptQuote: 'Aceptar Cotización',
  rejectQuote: 'Rechazar',
  termsAcceptanceRequired: 'Debe aceptar los términos y condiciones para proceder.',
  acceptTermsLabel: 'He leído y acepto los términos y condiciones comerciales.',
  rejectionReasonPrompt: 'Indique el motivo del rechazo (opcional):',
  confirmAcceptance: '¿Está seguro de aceptar esta cotización?',
  quoteAcceptedSuccess: '¡Cotización aceptada con éxito!',
  quoteRejectedSuccess: 'Cotización rechazada.',
  downloadPdf: 'Descargar / Imprimir',
  noQuotesFound: 'No se encontraron cotizaciones registradas.',
  close: 'Cerrar',
  filterAll: 'Todos los estados',
  products: 'Productos',
  services: 'Servicios',
  extraCosts: 'Costos Adicionales (Informativos)',
  subtotal: 'Subtotal',
  tax: 'IVA (19%)',
  grandTotal: 'Total General',
  // Invoices translations
  invoicesTitle: 'Documentos de Cobro y Estado de Cuenta',
  totalBilled: 'Total Facturado',
  totalPaid: 'Total Pagado',
  totalDue: 'Saldo Pendiente',
  invoiceNumber: 'N.º Comprobante',
  issueDate: 'Fecha Emisión',
  dueDate: 'Fecha Vencimiento',
  paid: 'Pagada',
  pendingPayment: 'Pendiente',
  overdue: 'Vencida',
  paymentMethod: 'Medio de Pago',
  paymentTerms: 'Condición de Pago',
  viewInvoice: 'Ver Documento de Cobro',
  noInvoicesFound: 'No se registran documentos de cobro pendientes.',
  // Operations translations
  operationsTitle: 'Órdenes de Trabajo y Entregables',
  trackingTitle: 'Seguimiento en Tiempo Real',
  orderNumber: 'N.º Orden',
  operationType: 'Tipo de Operación',
  dispatch: 'Entrega de suministros',
  serviceExecution: 'Servicio de ingeniería y entregables',
  progress: 'Progreso',
  assignedStaff: 'Responsable Asignado',
  scheduledDate: 'Fecha Programada',
  trackingGuide: 'Guía de Despacho',
  deliveryAddress: 'Dirección de Entrega',
  noOperationsFound: 'No se registran órdenes operativas activas.',
};

interface ClientPortalProps {
  user: UserType;
  onLogout: () => void;
  onOpenPublicLink: (token: string) => void;
  onSwitchUser?: (email: string) => void;
}

export function ClientPortal({ user, onLogout, onOpenPublicLink, onSwitchUser }: ClientPortalProps) {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  const validTabs = ['dashboard', 'quotations', 'calendar', 'timeline', 'invoices', 'operations'] as const;
  type PortalTab = typeof validTabs[number];

  const initialTab: PortalTab = (tab && (validTabs as readonly string[]).includes(tab)) ? (tab as PortalTab) : 'dashboard';

  const [activeTab, setActiveTabState] = useState<PortalTab>(initialTab);

  useEffect(() => {
    if (tab && (validTabs as readonly string[]).includes(tab)) {
      setActiveTabState(tab as PortalTab);
    }
  }, [tab]);

  const setActiveTab = (newTab: PortalTab) => {
    setActiveTabState(newTab);
    navigate(`/portal/${newTab}`);
  };

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [operations, setOperations] = useState<OperationOrder[]>([]);
  const [summary, setSummary] = useState<{ total: number; accepted: number; pending: number; rejected: number }>({
    total: 0,
    accepted: 0,
    pending: 0,
    rejected: 0,
  });
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // Calendar month state
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 8, 1)); // Sep 2026

  // Selected invoice modal
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Selected quote for adjustment request modal
  const [selectedQuoteForAdjustment, setSelectedQuoteForAdjustment] = useState<Quotation | null>(null);
  const [portalAdjustmentMessage, setPortalAdjustmentMessage] = useState<string>('');
  const [portalActionLoading, setPortalActionLoading] = useState<boolean>(false);
  const [portalToast, setPortalToast] = useState<string | null>(null);

  useEffect(() => {
    loadPortalData(false);

    // Suscribirse a sincronizaciones automáticas en tiempo real
    const unsubscribe = subscribeToQuotationSync(() => {
      loadPortalData(true);
    });

    const handleFocus = () => {
      loadPortalData(true);
    };
    window.addEventListener('focus', handleFocus);

    // Sondeo de sincronización periódica cada 4 segundos
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadPortalData(true);
      }
    }, 4000);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [user]);

  async function handleSendPortalAdjustment() {
    if (!selectedQuoteForAdjustment || !portalAdjustmentMessage.trim()) return;
    setPortalActionLoading(true);
    const res = await apiRequest<{ success: boolean; message: string }>(
      `/api/v1/portal/quotations/${selectedQuoteForAdjustment.id}/request-adjustment`,
      {
        method: 'POST',
        body: JSON.stringify({ message: portalAdjustmentMessage.trim() }),
      }
    );
    setPortalActionLoading(false);
    if (!res.error) {
      setSelectedQuoteForAdjustment(null);
      setPortalAdjustmentMessage('');
      setPortalToast('Solicitud de ajuste remitida con éxito al equipo de ingeniería.');
      notifyQuotationSync();
      await loadPortalData(true);
    }
  }

  async function handleOpenClientQuote(quote: Quotation) {
    if (quote.status === 'SENT') {
      try {
        await apiRequest(`/api/v1/portal/quotations/${quote.id}/view`, { method: 'POST' });
        notifyQuotationSync();
        setQuotations((prev) =>
          prev.map((item) => (item.id === quote.id ? { ...item, status: 'VIEWED' } : item))
        );
      } catch (e) {
        console.error(e);
      }
    }
    if (quote.publicToken) {
      onOpenPublicLink(quote.publicToken);
    }
  }

  async function loadPortalData(isBackground = false) {
    if (!isBackground) {
      setLoading(true);
    } else {
      setIsSyncing(true);
    }

    try {
      const [sumRes, quotRes, timeRes, invRes, opRes] = await Promise.all([
        apiRequest<{ total: number; accepted: number; pending: number; rejected: number }>(
          '/api/v1/portal/summary'
        ),
        apiRequest<Quotation[]>('/api/v1/portal/quotations'),
        apiRequest<any[]>('/api/v1/portal/timeline'),
        apiRequest<Invoice[]>('/api/v1/portal/invoices'),
        apiRequest<OperationOrder[]>('/api/v1/portal/operations'),
      ]);

      if (sumRes.data) setSummary(sumRes.data);
      if (quotRes.data) setQuotations(quotRes.data);
      if (timeRes.data) setTimeline(timeRes.data);
      if (invRes.data) setInvoices(invRes.data);
      if (opRes.data) setOperations(opRes.data);
      setLastSyncTime(new Date());
    } finally {
      if (!isBackground) {
        setLoading(false);
      } else {
        setIsSyncing(false);
      }
    }
  }

  // Invoice calculations
  const totalBilled = invoices.reduce((acc, inv) => acc + (inv.total || 0), 0);
  const totalPaid = invoices.filter((i) => i.status === 'PAID').reduce((acc, inv) => acc + (inv.total || 0), 0);
  const totalDue = invoices.filter((i) => i.status !== 'PAID').reduce((acc, inv) => acc + (inv.total || 0), 0);

  // Calendar helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('es-CL', {
    month: 'long',
    year: 'numeric',
  });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row transition-colors">
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between shrink-0 text-slate-800 dark:text-slate-100 transition-colors">
        <div className="space-y-6">
          {/* Brand */}
          <div className="flex items-center gap-3 h-12 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-extrabold text-slate-950 shadow-md shrink-0">
              C
            </div>
            <div className="min-w-0">
              <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white block truncate">
                {t.portalTitle}
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium block truncate">Autoservicio B2B</span>
            </div>
          </div>

          {/* User profile */}
          <div className="h-[68px] flex flex-col justify-center p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1 shrink-0">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">{user.name}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full h-10 min-h-[40px] max-h-[40px] flex items-center gap-3 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>{t.dashboard}</span>
            </button>

            <button
              onClick={() => setActiveTab('quotations')}
              className={`w-full h-10 min-h-[40px] max-h-[40px] flex items-center gap-3 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                activeTab === 'quotations'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>{t.quotations}</span>
              {summary.pending > 0 && (
                <span className="ml-auto shrink-0 bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full font-bold text-[10px]">
                  {summary.pending}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('calendar')}
              className={`w-full h-10 min-h-[40px] max-h-[40px] flex items-center gap-3 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                activeTab === 'calendar'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
              }`}
            >
              <CalendarIcon className="w-4 h-4 shrink-0" />
              <span>{t.calendar}</span>
            </button>

            <button
              onClick={() => setActiveTab('timeline')}
              className={`w-full h-10 min-h-[40px] max-h-[40px] flex items-center gap-3 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                activeTab === 'timeline'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
              }`}
            >
              <History className="w-4 h-4 shrink-0" />
              <span>{t.timeline}</span>
            </button>

            {/* Invoices tab (ENABLED) */}
            <button
              onClick={() => setActiveTab('invoices')}
              className={`w-full h-10 min-h-[40px] max-h-[40px] flex items-center gap-3 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                activeTab === 'invoices'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
              }`}
            >
              <Receipt className={`w-4 h-4 shrink-0 ${activeTab === 'invoices' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
              <span>{t.invoices}</span>
              <span className={`ml-auto shrink-0 px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                activeTab === 'invoices'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-50 dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
              }`}>
                {invoices.length}
              </span>
            </button>

            {/* Operations tab (ENABLED) */}
            <button
              onClick={() => setActiveTab('operations')}
              className={`w-full h-10 min-h-[40px] max-h-[40px] flex items-center gap-3 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                activeTab === 'operations'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
              }`}
            >
              <Truck className={`w-4 h-4 shrink-0 ${activeTab === 'operations' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
              <span>{t.operations}</span>
              <span className={`ml-auto shrink-0 px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                activeTab === 'operations'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-50 dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
              }`}>
                {operations.length}
              </span>
            </button>
          </nav>
        </div>

        {/* Footer with theme and logout */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-2">
          {/* Theme Selector */}
          <div className="flex justify-center">
            <ThemeSelector className="w-full justify-center" />
          </div>

          <button
            onClick={onLogout}
            className="w-full h-10 min-h-[40px] max-h-[40px] flex items-center justify-center gap-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-900/50 hover:bg-rose-50/60 dark:hover:bg-rose-950/20 text-xs font-medium cursor-pointer transition-colors shrink-0"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>{t.logout}</span>
          </button>
        </div>
      </aside>

      {/* MAIN VIEW */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white capitalize">
              {activeTab === 'dashboard' && t.dashboard}
              {activeTab === 'quotations' && t.quotations}
              {activeTab === 'calendar' && t.calendar}
              {activeTab === 'timeline' && t.timeline}
              {activeTab === 'invoices' && t.invoicesTitle}
              {activeTab === 'operations' && t.operationsTitle}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t.welcomeBack}, <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{user.name}</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-mono">
              Austral Salmón &amp; Mar SpA
            </span>

            {/* Sincronización en Vivo */}
            <button
              onClick={() => loadPortalData(false)}
              disabled={isSyncing}
              title={`Última sincronización: ${lastSyncTime.toLocaleTimeString('es-CL')}`}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
              <span className="hidden sm:inline">Sincronizado</span>
            </button>

            {/* Selector Rápido para Alternar entre Portales */}
            {onSwitchUser && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-500 px-1 hidden md:inline">Ver como:</span>
                <button
                  onClick={() => onSwitchUser('admin@mlingenieria.cl')}
                  className="px-2 py-0.5 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium hover:text-indigo-600 shadow-xs cursor-pointer text-[11px]"
                  title="Cambiar a Portal Admin (Victoria Villegas)"
                >
                  Admin
                </button>
                <button
                  onClick={() => onSwitchUser('smorales@mlingenieria.cl')}
                  className="px-2 py-0.5 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium hover:text-sky-600 shadow-xs cursor-pointer text-[11px]"
                  title="Cambiar a Portal Asesor (Sebastián Morales)"
                >
                  Asesor
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Portal Toast Banner */}
        {portalToast && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{portalToast}</span>
            </div>
            <button
              onClick={() => setPortalToast(null)}
              className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-white cursor-pointer text-xs font-bold px-2 py-0.5"
            >
              ✕
            </button>
          </div>
        )}

        {/* SKELETON LOADING STATE */}
        {loading ? (
          <div className="mt-6 space-y-6">
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <KpiGridSkeleton count={3} />
                <TableSkeleton rows={4} cols={5} />
              </div>
            )}
            {activeTab === 'quotations' && <TableSkeleton rows={6} cols={5} />}
            {activeTab === 'calendar' && <CalendarSkeleton />}
            {activeTab === 'timeline' && <TimelineSkeleton />}
            {activeTab === 'invoices' && <InvoicesGridSkeleton />}
            {activeTab === 'operations' && <OperationsGridSkeleton />}
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* ======================================================== */}
            {/* TAB: DASHBOARD                                          */}
            {/* ======================================================== */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-950 border border-emerald-500/30 relative overflow-hidden shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                        {t.accepted}
                      </span>
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    </div>
                    <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2 font-mono">{summary.accepted}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Cotizaciones aprobadas y conformes</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-950 border border-amber-500/30 relative overflow-hidden shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                        {t.pending}
                      </span>
                      <Clock className="w-5 h-5 text-amber-500" />
                    </div>
                    <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2 font-mono">{summary.pending}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Requieren su revisión o decisión</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-950 border border-rose-500/30 relative overflow-hidden shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                        {t.rejected}
                      </span>
                      <XCircle className="w-5 h-5 text-rose-500" />
                    </div>
                    <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2 font-mono">{summary.rejected}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Desestimadas o postergadas</p>
                  </div>
                </div>

                {/* Quick overview of Invoices & Operations */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                        {t.invoices}
                      </span>
                      <button
                        onClick={() => setActiveTab('invoices')}
                        className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                      >
                        Ver todas &rarr;
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Saldo pendiente de pago:{' '}
                      <strong className="text-amber-600 dark:text-amber-400 font-mono">{formatMoney(totalDue)}</strong>
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Truck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                        {t.operations}
                      </span>
                      <button
                        onClick={() => setActiveTab('operations')}
                        className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                      >
                        Ver seguimiento &rarr;
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Órdenes activas en curso:{' '}
                      <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                        {operations.filter((o) => o.status !== 'COMPLETED').length} en proceso
                      </strong>
                    </p>
                  </div>
                </div>

                {/* Recent Quotes */}
                <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">Cotizaciones Recientes</h3>
                    <button
                      onClick={() => setActiveTab('quotations')}
                      className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                    >
                      Ver todas &rarr;
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {quotations.slice(0, 5).map((q) => (
                      <div
                        key={q.id}
                        className="py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50 px-2 rounded-lg transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                              {q.quotationNumber}
                            </span>
                            <StatusBadge status={q.status} />
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Fecha: {new Date(q.createdAt).toLocaleDateString()} | Total: {formatMoney(q.grandTotal)}
                          </p>
                        </div>

                        <button
                          onClick={() => handleOpenClientQuote(q)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-transparent hover:bg-emerald-600 hover:text-white transition-colors text-xs font-medium cursor-pointer flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          {t.viewDetails}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB: FACTURAS / INVOICES (ENABLED)                     */}
            {/* ======================================================== */}
            {activeTab === 'invoices' && (
              <div className="space-y-6">
                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.totalBilled}</span>
                    <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono">
                      {formatMoney(totalBilled)}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{invoices.length} facturas emitidas</p>
                  </div>

                  <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-emerald-500/30 shadow-xs">
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{t.totalPaid}</span>
                    <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                      {formatMoney(totalPaid)}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Comprobantes cancelados</p>
                  </div>

                  <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-amber-500/30 shadow-xs">
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{t.totalDue}</span>
                    <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 font-mono">
                      {formatMoney(totalDue)}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Saldo pendiente o por vencer</p>
                  </div>
                </div>

                {/* Invoices Table */}
                <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">{t.invoicesTitle}</h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Vinculadas a cotizaciones aprobadas</span>
                  </div>

                  {invoices.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      {t.noInvoicesFound}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-3 px-4">{t.invoiceNumber}</th>
                            <th className="py-3 px-3">Cotización Ref.</th>
                            <th className="py-3 px-3">{t.issueDate}</th>
                            <th className="py-3 px-3">{t.dueDate}</th>
                            <th className="py-3 px-3 text-right">Importe Total</th>
                            <th className="py-3 px-3 text-center">{t.status}</th>
                            <th className="py-3 px-4 text-right">{t.actions}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {invoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                                {inv.invoiceNumber}
                              </td>
                              <td className="py-3 px-3 font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                {inv.quotationNumber}
                              </td>
                              <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{inv.issueDate}</td>
                              <td className="py-3 px-3 text-slate-500 dark:text-slate-400">{inv.dueDate}</td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                {formatMoney(inv.total)}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {inv.status === 'PAID' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/40">
                                    <Check className="w-3 h-3" /> {t.paid}
                                  </span>
                                ) : inv.status === 'PARTIAL' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400 border border-blue-300 dark:border-blue-500/40">
                                    <Clock className="w-3 h-3" /> Pago Parcial
                                  </span>
                                ) : inv.status === 'OVERDUE' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-400 border border-rose-300 dark:border-rose-500/40">
                                    <AlertCircle className="w-3 h-3" /> {t.overdue}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-500/40">
                                    <Clock className="w-3 h-3" /> {t.pendingPayment}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => setSelectedInvoice(inv)}
                                  className="px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-transparent hover:bg-emerald-600 hover:text-white transition-colors text-xs font-medium cursor-pointer inline-flex items-center gap-1.5"
                                >
                                  <Receipt className="w-3.5 h-3.5" />
                                  {t.viewInvoice}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB: OPERACIONES Y ENTREGAS (ENABLED)                   */}
            {/* ======================================================== */}
            {activeTab === 'operations' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">{t.operationsTitle}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Supervise en tiempo real el despacho de equipamiento físico y la ejecución de servicios especializados.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {operations.map((op) => (
                    <div
                      key={op.id}
                      className="p-5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              {op.orderNumber}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                              Cotiz: {op.quotationNumber}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                            {op.type === 'PRODUCT_DELIVERY' ? (
                              <Package className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                            ) : (
                              <Wrench className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                            )}
                            {op.title}
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{op.description}</p>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                            op.status === 'COMPLETED'
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30'
                              : op.status === 'IN_PROGRESS'
                              ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400 border border-blue-300 dark:border-blue-500/30'
                              : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30'
                          }`}
                        >
                          {op.status === 'COMPLETED'
                            ? 'Entregado / Conforme'
                            : op.status === 'IN_PROGRESS'
                            ? 'En Ruta / En Proceso'
                            : 'Programado'}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500 dark:text-slate-400">{t.progress}</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{op.progressPct}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                            style={{ width: `${op.progressPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Details list */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-500">{t.assignedStaff}:</span>
                          <span className="font-medium text-slate-800 dark:text-slate-200">{op.assignedStaff}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">{t.scheduledDate}:</span>
                          <span className="font-mono text-slate-700 dark:text-slate-300">{op.scheduledDate}</span>
                        </div>
                        {op.guideNumber && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">{t.trackingGuide}:</span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{op.guideNumber}</span>
                          </div>
                        )}
                        {op.deliveryAddress && (
                          <div className="flex items-start gap-1.5 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span>{op.deliveryAddress}</span>
                          </div>
                        )}
                      </div>

                      {/* Items */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Ítems comprendidos:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {op.itemsIncluded.map((item, idx) => (
                            <span
                              key={idx}
                              className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                            >
                              • {item}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Hitos de la Orden (Solo Lectura - P2.k) */}
                      {op.milestones && op.milestones.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                            Hitos del Proyecto (Solo Lectura):
                          </span>
                          <div className="space-y-1">
                            {op.milestones.map((ms) => (
                              <div
                                key={ms.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                              >
                                <div>
                                  <span className={`font-medium block ${ms.status === 'COMPLETED' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-200'}`}>
                                    {ms.status === 'COMPLETED' ? '✓ ' : '○ '}{ms.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    Fecha programada: {ms.date}
                                  </span>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    ms.status === 'COMPLETED'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : ms.status === 'IN_PROGRESS'
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                  }`}
                                >
                                  {ms.status === 'COMPLETED' ? 'COMPLETADO' : ms.status === 'IN_PROGRESS' ? 'EN PROCESO' : 'PENDIENTE'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Entregables Técnicos (Solo Lectura - P2.k) */}
                      {op.deliverables && op.deliverables.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                            Entregables y Documentación Técnica (Solo Lectura):
                          </span>
                          <div className="space-y-1">
                            {op.deliverables.map((del) => (
                              <div
                                key={del.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                              >
                                <div>
                                  <span className="font-medium text-slate-800 dark:text-slate-200 block">
                                    📄 {del.name}
                                  </span>
                                  {del.link && (
                                    <a
                                      href={del.link}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-indigo-600 dark:text-indigo-400 hover:underline text-[11px] block"
                                    >
                                      Descargar / Ver entregable
                                    </a>
                                  )}
                                  {(del as any).attachments && (del as any).attachments.length > 0 && (
                                    <div className="flex flex-col gap-0.5 mt-1">
                                      {((del as any).attachments as any[]).map((att) => (
                                        <a
                                          key={att.id}
                                          href={att.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-indigo-600 dark:text-indigo-400 hover:underline text-[11px] flex items-center gap-1"
                                        >
                                          🔗 {att.name}
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    del.status === 'DELIVERED'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : del.status === 'READY'
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                  }`}
                                >
                                  {del.status === 'DELIVERED' ? 'ENTREGADO' : del.status === 'READY' ? 'DISPONIBLE' : 'PENDIENTE'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB: QUOTATIONS LIST                                     */}
            {/* ======================================================== */}
            {activeTab === 'quotations' && (
              <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">{t.quotations}</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{quotations.length} propuestas registradas</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-4">{t.number}</th>
                        <th className="py-3 px-3">{t.date}</th>
                        <th className="py-3 px-3">{t.total}</th>
                        <th className="py-3 px-3">{t.status}</th>
                        <th className="py-3 px-4 text-right">{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {quotations.map((q) => (
                        <tr key={q.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
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
                              <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-sans font-normal mt-0.5">
                                Registrada por personal (OC: {q.offlinePurchaseOrderNumber || 'S/N'})
                              </span>
                            )}
                            {!q.acceptedOffline && (q as any).clientSignerName && (
                              <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-sans font-normal mt-0.5">
                                Firmada por {(q as any).clientSignerName}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                            {new Date(q.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatMoney(q.grandTotal ?? q.total)}
                          </td>
                          <td className="py-3 px-3">
                            <StatusBadge status={getEffectiveQuotationStatus(q)} />
                          </td>
                          <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                            <button
                              onClick={() => setSelectedQuoteForAdjustment(q)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-xs hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors inline-flex items-center gap-1 shadow-2xs"
                              title="Solicitar modificaciones o ajustes a esta cotización"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Pedir Ajuste</span>
                            </button>
                            <button
                              onClick={() => handleOpenClientQuote(q)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium text-xs hover:bg-emerald-500 cursor-pointer transition-colors inline-flex items-center gap-1.5"
                              title="Ver documento completo o imprimir PDF"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              {t.viewDetails} / PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB: CALENDAR                                            */}
            {/* ======================================================== */}
            {activeTab === 'calendar' && (
              <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base capitalize">{monthName}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Haga clic en una cotización del calendario para ver sus detalles.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={prevMonth}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:text-white border border-slate-200 dark:border-slate-800 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={nextMonth}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:text-white border border-slate-200 dark:border-slate-800 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <span>Dom</span>
                  <span>Lun</span>
                  <span>Mar</span>
                  <span>Mié</span>
                  <span>Jue</span>
                  <span>Vie</span>
                  <span>Sáb</span>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: firstDayIndex }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-24 rounded-lg bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-900" />
                  ))}

                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const quotesOfDay = quotations.filter((q) => q.createdAt.startsWith(dateStr));

                    return (
                      <div
                        key={`day-${day}`}
                        className="h-24 p-1.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between overflow-hidden"
                      >
                        <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 font-semibold self-start">
                          {day}
                        </span>

                        <div className="space-y-1 overflow-y-auto">
                          {quotesOfDay.map((qd) => (
                            <button
                              key={qd.id}
                              onClick={() => handleOpenClientQuote(qd)}
                              className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-mono font-bold truncate block cursor-pointer transition-opacity hover:opacity-80 ${
                                qd.status === 'ACCEPTED'
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50'
                                  : qd.status === 'REJECTED'
                                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700/50'
                                  : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700/50'
                              }`}
                              title={`${qd.quotationNumber} - ${qd.status}`}
                            >
                              {qd.quotationNumber}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB: TIMELINE                                            */}
            {/* ======================================================== */}
            {activeTab === 'timeline' && (
              <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xs">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Historial Cronológico de Cotizaciones</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Trazabilidad completa de las propuestas enviadas, visualizaciones y decisiones registradas.
                </p>

                <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                  {timeline.map((entry, idx) => (
                    <div key={idx} className="relative space-y-1">
                      <div className="absolute -left-[22px] top-1 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-slate-950" />
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                          {entry.quotationNumber}
                        </span>
                        <StatusBadge status={entry.status} />
                        <span className="text-[11px] text-slate-500 font-mono">
                          {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ''}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        {entry.comment} &mdash; <span className="text-slate-500 dark:text-slate-400">Por {entry.actor}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL: VIEW INVOICE */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-6 overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">
                  Documento de Cobro Oficial
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white font-mono">
                  {selectedInvoice.invoiceNumber}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Referencia Cotización: <strong>{selectedInvoice.quotationNumber}</strong>
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    selectedInvoice.status === 'PAID'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                      : selectedInvoice.status === 'PARTIAL'
                      ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                      : selectedInvoice.status === 'OVERDUE'
                      ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                      : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {selectedInvoice.status === 'PAID'
                    ? 'PAGADO'
                    : selectedInvoice.status === 'PARTIAL'
                    ? 'PAGO PARCIAL'
                    : selectedInvoice.status === 'OVERDUE'
                    ? 'VENCIDO'
                    : 'PENDIENTE DE PAGO'}
                </span>
                <p className="text-[11px] text-slate-400 mt-1">
                  Vence: {selectedInvoice.dueDate}
                </p>
              </div>
            </div>

            {/* Customer & Issue info */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl text-xs space-y-1 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
              <p>
                <strong>Cliente:</strong> {selectedInvoice.customerBusinessName}
              </p>
              <p>
                <strong>Condición de pago:</strong> {selectedInvoice.paymentTerms}
              </p>
              {selectedInvoice.paymentMethod && (
                <p>
                  <strong>Medio de pago registrado:</strong> {selectedInvoice.paymentMethod}
                </p>
              )}
            </div>

            {/* Payment Schedule (Hitos) */}
            {selectedInvoice.paymentSchedule && selectedInvoice.paymentSchedule.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Cronograma de Cobro por Hitos:
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Condición: {selectedInvoice.paymentTerms}
                  </span>
                </div>
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2 px-3">Hito / Etiqueta</th>
                        <th className="py-2 px-2 text-center">%</th>
                        <th className="py-2 px-3 text-right">Monto</th>
                        <th className="py-2 px-3">Vencimiento</th>
                        <th className="py-2 px-3 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                      {selectedInvoice.paymentSchedule.map((ms) => (
                        <tr key={ms.id}>
                          <td className="py-2 px-3 font-sans font-medium text-slate-800 dark:text-slate-200">
                            {ms.label}
                          </td>
                          <td className="py-2 px-2 text-center text-slate-600 dark:text-slate-400">
                            {ms.percentage}%
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                            {formatMoney(ms.amount)}
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-400">
                            {ms.dueDate}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                ms.status === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : ms.status === 'PARTIAL'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  : ms.status === 'OVERDUE'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {ms.status === 'PAID'
                                ? 'PAGADO'
                                : ms.status === 'PARTIAL'
                                ? 'PARCIAL'
                                : ms.status === 'OVERDUE'
                                ? 'VENCIDO'
                                : 'PENDIENTE'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payments History */}
            {selectedInvoice.payments && selectedInvoice.payments.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Abonos y Pagos Recibidos:
                </span>
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2 px-3">Fecha</th>
                        <th className="py-2 px-3">Método</th>
                        <th className="py-2 px-3">Referencia / Comprobante</th>
                        <th className="py-2 px-3 text-right">Monto Abonado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                      {selectedInvoice.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-300">
                            {p.paymentDate}
                          </td>
                          <td className="py-2 px-3 font-sans font-medium text-slate-800 dark:text-slate-200">
                            {p.paymentMethod}
                          </td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                            {p.reference}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {formatMoney(p.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Line items */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Detalle de Ítems Comprendidos:</span>
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2 px-3">Descripción</th>
                      <th className="py-2 px-2 text-center">Cant.</th>
                      <th className="py-2 px-3 text-right">P. Unit</th>
                      <th className="py-2 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {(selectedInvoice.items || []).map((it) => (
                      <tr key={it.id}>
                        <td className="py-2 px-3 font-sans font-medium text-slate-800 dark:text-slate-200">{it.description}</td>
                        <td className="py-2 px-2 text-center text-slate-700 dark:text-slate-300">{it.quantity}</td>
                        <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">{formatMoney(it.unitPrice)}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {formatMoney(it.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals & Balance */}
            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="w-72 space-y-1.5 font-mono text-right text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Subtotal Neto:</span>
                  <span>{formatMoney(selectedInvoice.subtotal ?? selectedInvoice.netSubtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>IVA (19%):</span>
                  <span>{formatMoney(selectedInvoice.taxAmount)}</span>
                </div>
                <div className="flex justify-between font-extrabold text-sm text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-800 pt-1">
                  <span>TOTAL DOCUMENTO:</span>
                  <span className="text-slate-900 dark:text-white">{formatMoney(selectedInvoice.total)}</span>
                </div>
                {selectedInvoice.paidAmount !== undefined && selectedInvoice.paidAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                    <span>Total Abonado:</span>
                    <span>- {formatMoney(selectedInvoice.paidAmount)}</span>
                  </div>
                )}
                {selectedInvoice.balance !== undefined && (
                  <div className="flex justify-between text-amber-700 dark:text-amber-400 font-extrabold text-sm pt-1 border-t border-dashed border-slate-300 dark:border-slate-700">
                    <span>SALDO PENDIENTE:</span>
                    <span>{formatMoney(selectedInvoice.balance)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal actions */}
            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Descargar PDF
              </button>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-white cursor-pointer"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADJUSTMENT REQUEST MODAL */}
      {selectedQuoteForAdjustment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <MessageSquare className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Pedir Ajuste: {selectedQuoteForAdjustment.quotationNumber}
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Escriba a continuación las observaciones, modificaciones de alcance, cantidades o condiciones comerciales que requiere ajustar.
            </p>
            <textarea
              rows={4}
              value={portalAdjustmentMessage}
              onChange={(e) => setPortalAdjustmentMessage(e.target.value)}
              placeholder="Describa el requerimiento de ajuste..."
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedQuoteForAdjustment(null)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                {t.close}
              </button>
              <button
                type="button"
                onClick={handleSendPortalAdjustment}
                disabled={portalActionLoading || !portalAdjustmentMessage.trim()}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {portalActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Enviar Requerimiento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
