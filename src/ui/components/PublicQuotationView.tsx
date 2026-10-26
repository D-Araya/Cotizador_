import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  Printer,
  ShieldCheck,
  Building2,
  Calendar,
  AlertCircle,
  Loader2,
  FileText,
  Clock,
  Send,
  MessageSquare,
  Paperclip,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react';
import { Quotation, CompanySettings, Customer, Contact, User } from '../../modules/types.ts';
import { StatusBadge, ItemTypeBadge, statusLabels, getEffectiveQuotationStatus } from './CommonBadges.tsx';
import { QuotationDocumentSkeleton } from './Skeleton.tsx';
import { apiRequest } from '../api.ts';
import { formatMoney } from '../../shared-kernel/formatMoney.ts';

interface PublicViewProps {
  token?: string;
}

export function PublicQuotationView({ token: propToken }: PublicViewProps) {
  const navigate = useNavigate();
  const params = useParams<{ token: string }>();
  const token = propToken || params.token || '';
  const [loading, setLoading] = useState<boolean>(true);
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [salesRep, setSalesRep] = useState<User | null>(null);

  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [signerName, setSignerName] = useState<string>('');
  const [signerPosition, setSignerPosition] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [showAdjustmentModal, setShowAdjustmentModal] = useState<boolean>(false);
  const [adjustmentMessage, setAdjustmentMessage] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadQuotation() {
      setLoading(true);
      const res = await apiRequest<{
        quotation: Quotation;
        customer: Customer;
        contact: Contact;
        company: CompanySettings;
        salesRep: User;
      }>(`/api/v1/public/quotations/${token}`);

      setLoading(false);
      if (res.data) {
        setQuotation(res.data.quotation);
        setCustomer(res.data.customer);
        setContact(res.data.contact);
        setCompany(res.data.company);
        setSalesRep(res.data.salesRep);
        if (res.data.contact?.name) {
          setSignerName(res.data.contact.name);
          setSignerPosition(res.data.contact.position || 'Representante');
        }

        // Notificar que la cotización fue vista de manera explícita (POST separado)
        if (res.data.quotation.status === 'SENT') {
          apiRequest(`/api/v1/public/quotations/${token}/view`, { method: 'POST' });
        }
      } else {
        setErrorMsg('No se pudo encontrar la cotización o el enlace ha expirado.');
      }
    }
    loadQuotation();
  }, [token]);

  async function handleAccept() {
    if (!termsAccepted) {
      setErrorMsg('Debe marcar la casilla de aceptación de los términos y condiciones.');
      return;
    }
    if (!signerName.trim() || signerName.trim().length < 2) {
      setErrorMsg('Debe ingresar su nombre completo como firmante.');
      return;
    }
    if (!signerPosition.trim() || signerPosition.trim().length < 2) {
      setErrorMsg('Debe ingresar su cargo o representación en la empresa.');
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);

    const res = await apiRequest(`/api/v1/public/quotations/${token}/accept`, {
      method: 'POST',
      body: JSON.stringify({
        termsAccepted: true,
        signerName: signerName.trim(),
        signerPosition: signerPosition.trim(),
      }),
    });

    setActionLoading(false);
    if (res.error) {
      setErrorMsg(res.error.detail || 'Error al aceptar la cotización');
      return;
    }

    if (res.data?.quotation) {
      setQuotation(res.data.quotation);
      setSuccessMsg('¡Muchas gracias! Su aceptación ha sido registrada formalmente con evidencia digital.');
    }
  }

  async function handleReject() {
    setActionLoading(true);
    setErrorMsg(null);

    const res = await apiRequest(`/api/v1/public/quotations/${token}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: rejectionReason.trim() }),
    });

    setActionLoading(false);
    setShowRejectModal(false);

    if (res.error) {
      setErrorMsg(res.error.detail || 'Error al registrar el rechazo');
      return;
    }

    if (res.data?.quotation) {
      setQuotation(res.data.quotation);
      setSuccessMsg('Su respuesta de rechazo ha sido registrada.');
    }
  }

  async function handleRequestAdjustment() {
    if (!adjustmentMessage.trim()) {
      setErrorMsg('Debe escribir el detalle del ajuste o comentario.');
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);

    const res = await apiRequest<{ success: boolean; message: string; quotation: Quotation }>(
      `/api/v1/public/quotations/${token}/request-adjustment`,
      {
        method: 'POST',
        body: JSON.stringify({ message: adjustmentMessage.trim() }),
      }
    );

    setActionLoading(false);
    setShowAdjustmentModal(false);

    if (res.error) {
      setErrorMsg(res.error.detail || 'Error al enviar la solicitud de ajuste');
      return;
    }

    if (res.data?.quotation) {
      setQuotation(res.data.quotation);
    }
    setSuccessMsg('Su solicitud de ajuste ha sido enviada al asesor comercial.');
    setAdjustmentMessage('');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 text-slate-800 dark:text-slate-100 transition-colors">
        <QuotationDocumentSkeleton />
      </div>
    );
  }

  if (!quotation || !company) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800">Enlace no disponible</h2>
          <p className="text-xs text-slate-500">{errorMsg || 'Esta cotización no existe.'}</p>
        </div>
      </div>
    );
  }

  const products = quotation.lines.filter((l) => l.type === 'PRODUCT');
  const services = quotation.lines.filter((l) => l.type === 'SERVICE');
  const effectiveStatus = getEffectiveQuotationStatus(quotation);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/app/quotations');
    }
  };

  const isExpired = effectiveStatus === 'EXPIRED';
  const canDecide = (quotation.status === 'SENT' || quotation.status === 'VIEWED') && !isExpired;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 text-slate-800 dark:text-slate-100 transition-colors">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top bar with quick actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 px-6 py-3 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 transition-colors">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-slate-900 dark:text-white tracking-tight">
              {company.name}
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded">
              {quotation.quotationNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Descargar PDF
            </button>
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer transition-colors shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver
            </button>
          </div>
        </div>

        {/* REVISION NOTICE (P1.a) */}
        {(quotation as any).hasNewerRevision && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 flex items-start justify-between gap-3 text-amber-950 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">
                  ⚠️ Versión anterior (Revisión {(quotation as any).revision || 1})
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                  Esta cotización ha sido actualizada por una revisión vigente más reciente:{' '}
                  <strong>{(quotation as any).latestRevisionNumber}</strong>.
                </p>
              </div>
            </div>
            {(quotation as any).latestRevisionToken && (
              <a
                href={`?token=${(quotation as any).latestRevisionToken}`}
                className="px-3.5 py-1.5 rounded-lg bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700 transition-colors shrink-0"
              >
                Ver versión vigente
              </a>
            )}
          </div>
        )}

        {/* DECISION BANNERS */}
        {quotation.status === 'ACCEPTED' && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 flex items-start gap-3 text-emerald-900 dark:text-emerald-200">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-sm">
                {(quotation as any).acceptedOffline
                  ? '✓ Aceptación Registrada por el Personal'
                  : '✓ Cotización Aceptada y Firmada'}
              </p>
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                {(quotation as any).acceptedOffline ? (
                  <>
                    Aceptación registrada por el personal comercial bajo <strong>Orden de Compra / Ref: {(quotation as any).offlinePurchaseOrderNumber || 'S/N'}</strong>.
                    {(quotation as any).offlineNote && <span className="block mt-0.5 italic text-[11px]">Nota: {(quotation as any).offlineNote}</span>}
                  </>
                ) : (
                  <>
                    Propuesta formalmente aceptada por <strong>{(quotation as any).clientSignerName || 'el cliente'}</strong> ({(quotation as any).clientSignerPosition || 'Representante Legal'})
                    {quotation.acceptedAt ? ` el ${new Date(quotation.acceptedAt).toLocaleString('es-CL')}` : ''}.
                    {(quotation as any).acceptanceHash && (
                      <span className="block mt-1 font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                        Firma digital SHA-256: {(quotation as any).acceptanceHash.slice(0, 24)}...
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {quotation.status === 'REJECTED' && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900/60 flex items-start gap-3 text-rose-900 dark:text-rose-200">
            <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Cotización Rechazada</p>
              <p className="text-xs text-rose-800 dark:text-rose-300 mt-0.5">
                {quotation.rejectionReason
                  ? `Motivo: ${quotation.rejectionReason}`
                  : 'Esta propuesta fue marcada como rechazada por el cliente.'}
              </p>
            </div>
          </div>
        )}

        {isExpired && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 flex items-start gap-3 text-amber-900 dark:text-amber-200">
            <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Cotización Vencida</p>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                Esta cotización ha sobrepasado su período de validez comercial de {quotation.validityDays} días. Por favor, comuníquese con su asesor comercial ({salesRep?.name || company.name}) para solicitar una actualización.
              </p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* MAIN DOCUMENT CARD */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden print:border-none print:shadow-none transition-colors">
          {/* Header */}
          <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between gap-6 bg-slate-50/50 dark:bg-slate-800/40">
            <div className="space-y-1">
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">{company.name}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">RUT: {company.rut}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{company.address}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Email: {company.email} | Tel: {company.phone}
              </p>
            </div>

            <div className="sm:text-right space-y-1">
              <div className="inline-block">
                <StatusBadge status={effectiveStatus} />
              </div>
              <h2 className="text-xl font-bold font-mono text-indigo-700 dark:text-indigo-400">
                {quotation.quotationNumber}
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Fecha de Emisión: {new Date(quotation.createdAt).toLocaleDateString('es-CL')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Validez: {quotation.validityDays} días calendario
              </p>
            </div>
          </div>

          <div className="p-8 space-y-8 text-xs text-slate-800 dark:text-slate-200">
            {/* Customer & Sales Rep Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Dirigido a:
                </span>
                <p className="font-extrabold text-slate-900 dark:text-white text-sm">
                  {customer?.businessName}
                </p>
                <p className="text-slate-600 dark:text-slate-300">RUT: {customer?.taxId}</p>
                <p className="text-slate-600 dark:text-slate-300">{customer?.address}</p>
                <p className="text-slate-700 dark:text-slate-200 font-medium pt-1">
                  Atención: {contact?.name} &mdash; {contact?.position}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Emitido por:
                </span>
                <p className="font-bold text-slate-900 dark:text-white text-sm">{salesRep?.name || 'Asesor Comercial / Ing. Proyectos'}</p>
                <p className="text-slate-600 dark:text-slate-300">{company.name}</p>
                <p className="text-slate-600 dark:text-slate-300">Email: {salesRep?.email || company.email}</p>
                <p className="text-slate-600 dark:text-slate-300">WhatsApp: {salesRep?.phone || company.phone}</p>
              </div>
            </div>

            {/* Presentation Text */}
            <div className="p-4 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-slate-700 dark:text-indigo-200 leading-relaxed italic">
              &ldquo;{quotation.presentationText}&rdquo;
            </div>

            {/* GROUP 1: PRODUCTS */}
            {products.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <ItemTypeBadge type="PRODUCT" />
                    Productos y Equipamiento
                  </h3>
                  <span className="text-slate-600 dark:text-slate-400 font-mono font-bold">
                    Subtotal Productos: {formatMoney(products.reduce((acc, l) => acc + l.subtotal, 0), company.currency)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                      <tr>
                        <th className="py-2 px-3">Ítem / Especificación</th>
                        <th className="py-2 px-2 text-center">Unidad</th>
                        <th className="py-2 px-2 text-center">Cant.</th>
                        <th className="py-2 px-3 text-right">P. Unitario</th>
                        <th className="py-2 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {products.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-slate-900 dark:text-white">{p.name}</p>
                            {p.skuOrCode && (
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                                SKU: {p.skuOrCode}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono text-slate-500 dark:text-slate-400">{p.unit}</td>
                          <td className="py-2.5 px-2 text-center font-mono font-medium dark:text-slate-200">{p.quantity}</td>
                          <td className="py-2.5 px-3 text-right font-mono dark:text-slate-200">
                            {formatMoney(p.price, company.currency)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {formatMoney(p.subtotal, company.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* GROUP 2: SERVICES */}
            {services.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <ItemTypeBadge type="SERVICE" />
                    Servicios Especializados y Soporte
                  </h3>
                  <span className="text-slate-600 dark:text-slate-400 font-mono font-bold">
                    Subtotal Servicios: {formatMoney(services.reduce((acc, l) => acc + l.subtotal, 0), company.currency)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                      <tr>
                        <th className="py-2 px-3">Descripción del Servicio</th>
                        <th className="py-2 px-2 text-center">Unidad</th>
                        <th className="py-2 px-2 text-center">Cant.</th>
                        <th className="py-2 px-3 text-right">P. Unitario</th>
                        <th className="py-2 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {services.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-slate-900 dark:text-white">{s.name}</p>
                            {s.skuOrCode && (
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                                Código: {s.skuOrCode}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono text-slate-500 dark:text-slate-400">{s.unit}</td>
                          <td className="py-2.5 px-2 text-center font-mono font-medium dark:text-slate-200">{s.quantity}</td>
                          <td className="py-2.5 px-3 text-right font-mono dark:text-slate-200">
                            {formatMoney(s.price, company.currency)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {formatMoney(s.subtotal, company.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Extra Costs (Non included) */}
            {quotation.extraCosts && quotation.extraCosts.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-2">
                <span className="font-bold text-amber-900 dark:text-amber-300 text-xs block">
                  DETALLE NO INCLUIDO EN LA COTIZACIÓN (COSTOS ADICIONALES OPCIONALES):
                </span>
                <p className="text-[11px] text-amber-800 dark:text-amber-400">
                  Los siguientes conceptos se presentan a título informativo para su evaluación y no han sido
                  sumados al importe total de la presente oferta:
                </p>
                <div className="divide-y divide-amber-200/60 dark:divide-amber-900/40 pt-1">
                  {quotation.extraCosts.map((ec) => (
                    <div key={ec.id} className="py-1.5 flex justify-between items-center text-slate-800 dark:text-slate-200">
                      <div>
                        <span className="font-medium">• {ec.name}</span>
                        {ec.notes && <span className="text-[11px] text-slate-500 dark:text-slate-400 block">({ec.notes})</span>}
                      </div>
                      <span className="font-mono font-semibold">
                        {formatMoney(ec.subtotal, company.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TOTALS SUMMARY */}
            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="w-80 space-y-2 font-mono text-right text-xs">
                {(quotation as any).grossSubtotal && (quotation as any).totalSavings ? (
                  <>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Subtotal Bruto:</span>
                      <span>{formatMoney((quotation as any).grossSubtotal, company.currency)}</span>
                    </div>
                    {(quotation as any).discountPct ? (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                        <span>Descuento Comercial ({(quotation as any).discountPct}%):</span>
                        <span>- {formatMoney((quotation as any).totalSavings, company.currency)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded text-right">
                      <span>Ahorro para su empresa:</span>
                      <span>{formatMoney((quotation as any).totalSavings, company.currency)}</span>
                    </div>
                  </>
                ) : null}
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Subtotal Neto:</span>
                  <span>{formatMoney(quotation.subtotal, company.currency)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>IVA ({company.taxRatePct}%):</span>
                  <span>{formatMoney(quotation.taxAmount, company.currency)}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-slate-900 dark:text-white border-t border-slate-300 dark:border-slate-700 pt-2">
                  <span>IMPORTE TOTAL:</span>
                  {quotation.currency === 'UF' && (quotation as any).ufGrandTotal ? (
                    <div className="flex flex-col items-end">
                      <span className="text-xl font-black text-indigo-700 dark:text-indigo-400">
                        UF {(quotation as any).ufGrandTotal.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 font-sans">
                        Equivalente: {formatMoney(quotation.grandTotal, 'CLP')} (1 UF = {formatMoney((quotation as any).ufRate || 38500, 'CLP')})
                      </span>
                    </div>
                  ) : (
                    <span className="text-indigo-700 dark:text-indigo-400">
                      {formatMoney(quotation.grandTotal, company.currency)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Terms and Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
              <div className="space-y-1">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">NOTAS IMPORTANTES:</span>
                <p className="whitespace-pre-line leading-relaxed">{quotation.notes}</p>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">TÉRMINOS Y CONDICIONES:</span>
                <p className="whitespace-pre-line leading-relaxed">{quotation.terms}</p>
              </div>
            </div>

            {/* Documentos y Enlaces Adjuntos (P3.n) */}
            {(quotation as any).attachments && (quotation as any).attachments.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Paperclip className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Documentos Técnicos y Enlaces Adjuntos
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {((quotation as any).attachments as any[]).map((att) => (
                    <a
                      key={att.id}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-slate-800/30 transition-colors group"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                          {att.name}
                        </p>
                        {att.description && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {att.description}
                          </p>
                        )}
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* DECISION ACTION SECTION (When Sent or Viewed) */}
            {canDecide && (
              <div className="mt-8 p-6 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 space-y-4 print:hidden">
                <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">
                  Aceptación y Decisión de la Propuesta Comercial
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Para formalizar la aceptación de la propuesta, indique el nombre y cargo del firmante autorizado por el mandante.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nombre Completo del Firmante *
                    </label>
                    <input
                      type="text"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="Ej. Marcelo Barrientos"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Cargo / Representación *
                    </label>
                    <input
                      type="text"
                      value={signerPosition}
                      onChange={(e) => setSignerPosition(e.target.value)}
                      placeholder="Ej. Gerente de Operaciones"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none pt-1">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer bg-white dark:bg-slate-800"
                  />
                  <span>
                    He leído y acepto formalmente los <strong>términos y condiciones comerciales</strong> señalados en la presente cotización técnica y económica.
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={!termsAccepted || !signerName.trim() || !signerPosition.trim() || actionLoading}
                    className="px-6 py-2.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Aceptar y Firmar Cotización
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAdjustmentModal(true)}
                    disabled={actionLoading}
                    className="px-5 py-2.5 rounded-lg border border-indigo-300 dark:border-indigo-800 bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-semibold text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Solicitar Ajuste
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRejectModal(true)}
                    disabled={actionLoading}
                    className="px-5 py-2.5 rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-400 font-semibold text-xs hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    Rechazar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* REJECT MODAL */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Indicar motivo de rechazo (Opcional)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nos ayuda a mejorar nuestras propuestas futuras si nos comparte la razón de su decisión.
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ej. Postergación presupuestaria, cambio en el alcance..."
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer"
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADJUSTMENT REQUEST MODAL */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <MessageSquare className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Solicitar Ajustes o Comentarios</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Indique los requerimientos técnicos, modificaciones en cantidades, plazos de entrega o condiciones que desea ajustar. Nuestro asesor comercial recibirá su solicitud de inmediato.
            </p>
            <textarea
              rows={4}
              value={adjustmentMessage}
              onChange={(e) => setAdjustmentMessage(e.target.value)}
              placeholder="Describa los cambios requeridos..."
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAdjustmentModal(false)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRequestAdjustment}
                disabled={actionLoading || !adjustmentMessage.trim()}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Enviar Solicitud
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
