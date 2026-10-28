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
  Download,
  ZoomIn,
  ZoomOut,
  X,
  Copy,
  Check,
} from 'lucide-react';
import { Quotation, CompanySettings, Customer, Contact, User } from '../../modules/types.ts';
import { StatusBadge, ItemTypeBadge, statusLabels, getEffectiveQuotationStatus } from './CommonBadges.tsx';
import { QuotationDocumentSkeleton } from './Skeleton.tsx';
import { apiRequest, getActiveApiUser, notifyQuotationSync } from '../api.ts';
import { formatMoney } from '../../shared-kernel/formatMoney.ts';
import { downloadQuotationPdf } from '../utils/quotationPdf.ts';

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
  const [showPdfPreview, setShowPdfPreview] = useState<boolean>(false);
  const [pdfZoom, setPdfZoom] = useState<number>(100);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);
  const [printing, setPrinting] = useState<boolean>(false);
  const [printNotice, setPrintNotice] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

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
        // Únicamente ante lectura genuina del cliente (o visitante público sin credenciales de staff)
        const activeUser = getActiveApiUser();
        const isStaff = activeUser && (activeUser.role === 'ADMIN' || activeUser.role === 'SALES_REP');
        if (res.data.quotation.status === 'SENT' && !isStaff) {
          apiRequest(`/api/v1/public/quotations/${token}/view`, { method: 'POST' }).then(() => {
            notifyQuotationSync();
          });
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
      notifyQuotationSync();
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
      notifyQuotationSync();
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
    notifyQuotationSync();
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

  const isProductItem = (t?: string) => {
    const norm = (t || '').toUpperCase().trim();
    return norm === 'PRODUCT' || norm === 'PRODUCTO' || norm === 'MATERIAL' || norm === 'EQUIPO';
  };
  const isServiceItem = (t?: string) => {
    const norm = (t || '').toUpperCase().trim();
    return norm === 'SERVICE' || norm === 'SERVICIO' || norm === 'MANO_OBRA';
  };

  const allLines = quotation.lines || [];
  const products = allLines.filter((l) => isProductItem(l.type));
  const services = allLines.filter((l) => isServiceItem(l.type));
  const fallbackLines = products.length === 0 && services.length === 0 ? allLines : allLines.filter((l) => !isProductItem(l.type) && !isServiceItem(l.type));

  const handleDownloadPdf = () => {
    if (!quotation || !company) return;
    setDownloadingPdf(true);
    try {
      downloadQuotationPdf({
        quotation,
        company,
        customer,
        contact,
        salesRep,
      });
    } catch (err) {
      console.error('Error al generar PDF:', err);
    } finally {
      setTimeout(() => setDownloadingPdf(false), 600);
    }
  };

  const handlePrint = () => {
    if (printing) return;
    setPrinting(true);
    setPrintNotice(null);

    try {
      const printSheet = document.querySelector('.a4-print-sheet');

      // 1. Si la hoja A4 está en el DOM, creamos un iframe aislado de impresión
      // Esto evita que el tema oscuro, barras de navegación o el zoom CSS afecten la impresión
      if (printSheet) {
        const existingFrame = document.getElementById('quotation-print-frame');
        if (existingFrame) {
          existingFrame.remove();
        }

        const iframe = document.createElement('iframe');
        iframe.id = 'quotation-print-frame';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);

        const frameDoc = iframe.contentWindow?.document;
        if (frameDoc) {
          // Extraemos los estilos de la página para que el diseño impreso sea idéntico
          const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
            .map((el) => el.outerHTML)
            .join('\n');

          frameDoc.open();
          frameDoc.write(`
            <!DOCTYPE html>
            <html lang="es">
              <head>
                <meta charset="utf-8">
                <title>${quotation?.quotationNumber || 'Cotizacion'} - Impresión Oficial</title>
                ${styles}
                <style>
                  @page {
                    size: A4 portrait;
                    margin: 12mm 10mm;
                  }
                  *, *::before, *::after {
                    box-sizing: border-box;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    color-adjust: exact !important;
                  }
                  body {
                    margin: 0;
                    padding: 0;
                    background-color: #ffffff !important;
                    color: #0f172a !important;
                    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  }
                  .a4-print-sheet {
                    width: 100% !important;
                    max-width: 100% !important;
                    min-height: auto !important;
                    margin: 0 auto !important;
                    padding: 0 !important;
                    box-shadow: none !important;
                    border: none !important;
                    transform: none !important;
                    background: #ffffff !important;
                    color: #0f172a !important;
                  }
                </style>
              </head>
              <body>
                <div class="a4-print-sheet">
                  ${printSheet.innerHTML}
                </div>
              </body>
            </html>
          `);
          frameDoc.close();

          setTimeout(() => {
            let printedOk = false;
            try {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
              printedOk = true;
              setPrintNotice('Diálogo de impresión iniciado. Si su navegador o entorno bloquea ventanas emergentes, use "Descargar PDF".');
            } catch (iframeErr) {
              console.warn('Iframe print falló o está bloqueado en sandbox:', iframeErr);
            }

            if (!printedOk) {
              try {
                window.print();
                printedOk = true;
                setPrintNotice('Diálogo de impresión solicitado.');
              } catch (winErr) {
                console.warn('window.print() bloqueado en sandbox:', winErr);
                handleDownloadPdf();
                setPrintNotice('El entorno del navegador restringió el diálogo directo; se descargó automáticamente el PDF para impresión directa.');
              }
            }

            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            }, 3000);
            setPrinting(false);
          }, 350);
          return;
        }
      }

      // 2. Fallback estándar si no se encontró la hoja
      try {
        window.print();
      } catch (winErr) {
        console.warn('window.print() bloqueado en sandbox:', winErr);
        handleDownloadPdf();
        setPrintNotice('El entorno del navegador restringió el diálogo directo; se descargó automáticamente el PDF para impresión directa.');
      }
    } catch (err) {
      console.error('Error general al imprimir:', err);
      handleDownloadPdf();
      setPrintNotice('Se descargó el archivo PDF para impresión directa.');
    } finally {
      setTimeout(() => setPrinting(false), 800);
    }
  };

  const effectiveStatus = getEffectiveQuotationStatus(quotation);

  const activeUser = getActiveApiUser();
  const isStaffUser = activeUser && (activeUser.role === 'ADMIN' || activeUser.role === 'SALES_REP');
  const isCustomerUser = activeUser && activeUser.role === 'CUSTOMER_CONTACT';

  const handleBack = () => {
    if (isCustomerUser) {
      navigate('/portal/quotations');
    } else if (isStaffUser) {
      navigate('/app/quotations');
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const isExpired = effectiveStatus === 'EXPIRED';
  const canDecide = (quotation.status === 'SENT' || quotation.status === 'VIEWED') && !isExpired;

  const handleCopyClientLink = () => {
    const url = `${window.location.origin}/q/${token}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => {
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2500);
        })
        .catch(() => {
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2500);
        });
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className={`min-h-screen bg-slate-100 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 text-slate-800 dark:text-slate-100 transition-colors ${showPdfPreview ? 'print:p-0 print:bg-white' : ''}`}>
      <div className={`max-w-4xl mx-auto space-y-6 ${showPdfPreview ? 'print:hidden' : ''}`}>
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
              onClick={() => setShowPdfPreview(true)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white text-xs font-semibold cursor-pointer transition-all shadow-xs active:scale-95 group"
              title="Previsualizar documento formal y descargar PDF"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:text-white transition-colors" />
              <span>Descargar PDF</span>
            </button>
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer transition-colors shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {isCustomerUser ? 'Volver al Portal' : isStaffUser ? 'Volver a Cotizaciones' : 'Volver'}
            </button>
          </div>
        </div>

        {/* STAFF PREVIEW BANNER */}
        {isStaffUser && (
          <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>
                <strong>Modo Vista Previa Interna ({activeUser?.role === 'ADMIN' ? 'Administrador' : 'Asesor Comercial'}):</strong> Está revisando la propuesta técnica en modo de consulta interna. Esta inspección técnica <strong>no activa</strong> el estado «Vista por Cliente».
              </span>
            </div>
            <button
              onClick={() => navigate('/app/quotations')}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 cursor-pointer"
            >
              Volver al Panel &rarr;
            </button>
          </div>
        )}

        {/* CUSTOMER PORTAL BANNER */}
        {isCustomerUser && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
            <div className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                Portal Mandante: <strong>{customer?.businessName || 'Austral Salmón & Mar SpA'}</strong>. Visualización y lectura registrada para trazabilidad comercial.
              </span>
            </div>
            <button
              onClick={() => navigate('/portal/quotations')}
              className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline shrink-0 cursor-pointer"
            >
              &larr; Volver al Portal de Clientes
            </button>
          </div>
        )}

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

            {/* FALLBACK GROUP: ALL LINES (if not categorized into products/services) */}
            {products.length === 0 && services.length === 0 && fallbackLines.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <ItemTypeBadge type="SERVICE" />
                    Detalle de Partidas, Servicios y Suministros
                  </h3>
                  <span className="text-slate-600 dark:text-slate-400 font-mono font-bold">
                    Subtotal: {formatMoney(quotation.subtotal, company.currency)}
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
                      {fallbackLines.map((item, idx) => {
                        const uPrice = item.price ?? (item as any).unitPrice ?? 0;
                        const sTotal = item.subtotal ?? (uPrice * (item.quantity || 1));
                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-3">
                              <p className="font-semibold text-slate-900 dark:text-white">{item.name || (item as any).description || 'Ítem Naval'}</p>
                              {(item.skuOrCode || (item as any).description) && (
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                                  Ref: {item.skuOrCode || (item as any).description}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-slate-500 dark:text-slate-400">{item.unit || 'UND'}</td>
                            <td className="py-2.5 px-2 text-center font-mono font-medium dark:text-slate-200">{item.quantity || 1}</td>
                            <td className="py-2.5 px-3 text-right font-mono dark:text-slate-200">
                              {formatMoney(uPrice, company.currency)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                              {formatMoney(sTotal, company.currency)}
                            </td>
                          </tr>
                        );
                      })}
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

            {/* SECCIÓN DE ACEPTACIÓN Y DECISIÓN EXCLUSIVA PARA EL CLIENTE */}
            {!isStaffUser && canDecide && (
              <div className="mt-8 p-6 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 space-y-4 print:hidden">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">
                    Aceptación y Decisión de la Propuesta Comercial
                  </h4>
                </div>
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

            {/* SECCIÓN INFORMATIVA DE ESTADO PARA EL PERSONAL COMERCIAL (ADMIN / ASESOR) */}
            {isStaffUser && canDecide && (
              <div className="mt-8 p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-4 print:hidden">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">
                        Estado de Decisión del Mandante
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Pendiente de resolución y firma digital por parte de <strong>{customer?.businessName || 'el mandante'}</strong>
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Esperando Decisión del Cliente
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                  <p>
                    <strong>Nota para el Asesor/Administrador:</strong> La aceptación formal, firma digital y solicitud de ajustes corresponden con exclusividad al cliente. Por este motivo, el formulario de firma se reserva únicamente para el portal del cliente o enlace público seguro del mandante.
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Puede compartir el enlace público directo con su contacto ({contact?.name || 'representante'}) para que revise y firme en línea. Si el cliente confirmó por vía telefónica o correo externo con Orden de Compra física, puede registrar la aprobación oficial desde el panel de cotizaciones usando la opción «Aceptar Offline».
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyClientLink}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs cursor-pointer transition-colors shadow-xs active:scale-95"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-white" />}
                    <span>{copiedLink ? '¡Enlace Copiado al Portapapeles!' : 'Copiar Enlace para el Cliente'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/app/quotations')}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Volver a Cotizaciones &rarr;
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

      {/* MODAL / PANEL DE PREVISUALIZACIÓN Y DESCARGA DE PDF */}
      {showPdfPreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/85 backdrop-blur-xs print:static print:bg-white print:p-0 print:m-0 animate-in fade-in duration-150">
          {/* Barra superior de herramientas (oculta durante la impresión) */}
          <div className="no-print print:hidden flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-slate-900 border-b border-slate-800 text-white shadow-lg shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    {quotation.quotationNumber}.pdf
                  </h3>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-indigo-300">
                    Formato A4 Oficial
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Previsualización de Documento &bull; {customer?.businessName || 'Mandante'}
                </p>
              </div>
            </div>

            {/* Controles de Zoom y Descarga */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-xs text-slate-300">
                <button
                  type="button"
                  onClick={() => setPdfZoom((z) => Math.max(50, z - 10))}
                  className="p-1.5 hover:text-white hover:bg-slate-700 rounded transition-colors cursor-pointer"
                  title="Reducir zoom (-10%)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="px-2 font-mono text-[11px] min-w-[44px] text-center font-medium">
                  {pdfZoom}%
                </span>
                <button
                  type="button"
                  onClick={() => setPdfZoom((z) => Math.min(150, z + 10))}
                  className="p-1.5 hover:text-white hover:bg-slate-700 rounded transition-colors cursor-pointer"
                  title="Aumentar zoom (+10%)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPdfZoom(100)}
                  className="px-2 py-1 text-[10px] font-semibold hover:text-white hover:bg-slate-700 rounded transition-colors cursor-pointer border-l border-slate-700 ml-0.5"
                  title="Restablecer tamaño normal (100%)"
                >
                  100%
                </button>
              </div>

              {/* Botón requerido dentro del nuevo panel: Descargar PDF */}
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-75 text-white text-xs font-bold shadow-sm shadow-indigo-950/50 transition-all cursor-pointer active:scale-95 group"
                title="Descargar archivo PDF oficial"
              >
                {downloadingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                )}
                <span>{downloadingPdf ? 'Generando PDF...' : 'Descargar PDF'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                disabled={printing}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-75 text-slate-200 text-xs font-medium transition-colors cursor-pointer active:scale-95"
                title="Imprimir documento formal A4"
              >
                {printing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                ) : (
                  <Printer className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span className="hidden sm:inline">{printing ? 'Imprimiendo...' : 'Imprimir'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPdfPreview(false)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Cerrar previsualización"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Aviso informativo de estado de impresión / sandbox */}
          {printNotice && (
            <div className="no-print print:hidden flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5 bg-indigo-950/90 border-b border-indigo-800/80 text-indigo-200 text-xs animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>{printNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setPrintNotice(null)}
                className="p-1 text-indigo-400 hover:text-white rounded hover:bg-indigo-900/60 transition-colors cursor-pointer"
                title="Descartar aviso"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Área de visualización del documento A4 */}
          <div className="flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-8 flex justify-center items-start bg-slate-950/95 print:p-0 print:m-0 print:overflow-visible print:bg-white">
            <div
              style={{
                transform: `scale(${pdfZoom / 100})`,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease-out',
                backgroundColor: '#ffffff',
                color: '#0f172a',
              }}
              className="a4-print-sheet w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 shadow-2xl rounded-sm ring-1 ring-slate-900/10 p-8 sm:p-14 space-y-6 print:shadow-none print:border-none print:p-0 print:transform-none my-4 mx-auto"
            >
              {/* Encabezado Membrete */}
              <div className="border-b-2 border-indigo-900 pb-5 flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-6 bg-indigo-700 rounded-xs" />
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">
                      {company.name}
                    </h1>
                  </div>
                  <p className="text-xs text-slate-600 font-semibold pl-4">RUT: {company.rut}</p>
                  <p className="text-xs text-slate-500 pl-4">{company.address}</p>
                  <p className="text-xs text-slate-500 pl-4">
                    Email: {company.email} | Teléfono: {company.phone}
                  </p>
                </div>

                <div className="sm:text-right space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 block">
                    Propuesta Técnico-Comercial
                  </span>
                  <div className="text-2xl font-black font-mono text-slate-900">
                    {quotation.quotationNumber}
                  </div>
                  <p className="text-xs text-slate-500">
                    Emisión: {new Date(quotation.createdAt).toLocaleDateString('es-CL')}
                  </p>
                  <p className="text-xs text-slate-600 font-medium">
                    Validez: {quotation.validityDays} días corridos
                  </p>
                  <div className="pt-1">
                    <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                      Estado: {statusLabels[effectiveStatus] || effectiveStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ficha Cliente y Comercial */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Mandante / Cliente:
                  </span>
                  <p className="font-extrabold text-slate-900 text-sm">
                    {customer?.businessName || (quotation as any).customerBusinessName || 'Cliente'}
                  </p>
                  <p className="text-slate-600">RUT: {customer?.taxId || (quotation as any).customerTaxId || 'S/R'}</p>
                  <p className="text-slate-600">{customer?.address || 'Chile'}</p>
                  <p className="text-slate-700 font-medium pt-0.5">
                    Atención: {contact?.name || 'Representante'} &mdash; {contact?.position || 'Operaciones'}
                  </p>
                  {contact?.email && <p className="text-slate-500 text-[11px]">{contact.email}</p>}
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Asesor Comercial Responsable:
                  </span>
                  <p className="font-bold text-slate-900 text-sm">
                    {salesRep?.name || company.name}
                  </p>
                  <p className="text-slate-600">Email: {salesRep?.email || company.email}</p>
                  <div className="pt-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Proyecto / Objeto del Servicio:
                    </span>
                    <p className="text-slate-800 font-medium">
                      {(quotation as any).projectName || quotation.title || 'Servicios y Suministros de Ingeniería Naval'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Texto de Presentación */}
              {quotation.presentationText && (
                <div className="p-3.5 rounded-lg bg-indigo-50/50 border-l-4 border-indigo-600 text-xs text-slate-700 italic">
                  &ldquo;{quotation.presentationText}&rdquo;
                </div>
              )}

              {/* Detalle de Productos */}
              {products.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1">
                    <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                      1. Suministro de Equipos y Materiales
                    </h3>
                    <span className="text-[11px] font-mono text-slate-600">
                      Subtotal: {formatMoney(products.reduce((acc, l) => acc + (l.subtotal ?? (Number(l.price ?? (l as any).unitPrice ?? 0) * (l.quantity || 1))), 0), company.currency)}
                    </span>
                  </div>
                  <table className="w-full text-left text-xs border border-slate-200">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Ítem / Especificación</th>
                        <th className="py-2 px-2 text-center w-16">Unidad</th>
                        <th className="py-2 px-2 text-center w-16">Cant.</th>
                        <th className="py-2 px-3 text-right w-28">P. Unitario</th>
                        <th className="py-2 px-3 text-right w-28">Total Neto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {products.map((p, idx) => {
                        const uPrice = p.price ?? (p as any).unitPrice ?? 0;
                        const sTotal = p.subtotal ?? (uPrice * (p.quantity || 1));
                        return (
                          <tr key={p.id || idx}>
                            <td className="py-2 px-3">
                              <span className="font-semibold text-slate-900">{p.name || (p as any).description}</span>
                              {(p.skuOrCode || (p as any).sku) && (
                                <span className="text-[10px] text-slate-400 font-mono block">
                                  SKU: {p.skuOrCode || (p as any).sku}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-slate-600">{p.unit || 'UND'}</td>
                            <td className="py-2 px-2 text-center font-mono font-medium">{p.quantity || 1}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatMoney(uPrice, company.currency)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatMoney(sTotal, company.currency)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Detalle de Servicios */}
              {services.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1">
                    <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                      {products.length > 0 ? '2. Servicios de Ingeniería, Maestranza y Terreno' : '1. Servicios de Ingeniería, Maestranza y Terreno'}
                    </h3>
                    <span className="text-[11px] font-mono text-slate-600">
                      Subtotal: {formatMoney(services.reduce((acc, l) => acc + (l.subtotal ?? (Number(l.price ?? (l as any).unitPrice ?? 0) * (l.quantity || 1))), 0), company.currency)}
                    </span>
                  </div>
                  <table className="w-full text-left text-xs border border-slate-200">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Descripción del Servicio</th>
                        <th className="py-2 px-2 text-center w-16">Unidad</th>
                        <th className="py-2 px-2 text-center w-16">Cant.</th>
                        <th className="py-2 px-3 text-right w-28">P. Unitario</th>
                        <th className="py-2 px-3 text-right w-28">Total Neto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {services.map((s, idx) => {
                        const uPrice = s.price ?? (s as any).unitPrice ?? 0;
                        const sTotal = s.subtotal ?? (uPrice * (s.quantity || 1));
                        return (
                          <tr key={s.id || idx}>
                            <td className="py-2 px-3">
                              <span className="font-semibold text-slate-900">{s.name || (s as any).description}</span>
                              {(s.skuOrCode || (s as any).code) && (
                                <span className="text-[10px] text-slate-400 font-mono block">
                                  Código: {s.skuOrCode || (s as any).code}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-slate-600">{s.unit || 'GL'}</td>
                            <td className="py-2 px-2 text-center font-mono font-medium">{s.quantity || 1}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatMoney(uPrice, company.currency)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatMoney(sTotal, company.currency)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Partidas Fallback (si la cotización no tiene diferenciado productos/servicios) */}
              {products.length === 0 && services.length === 0 && fallbackLines.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1">
                    <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                      Detalle de Partidas, Servicios y Suministros
                    </h3>
                    <span className="text-[11px] font-mono text-slate-600">
                      Subtotal: {formatMoney(quotation.subtotal, company.currency)}
                    </span>
                  </div>
                  <table className="w-full text-left text-xs border border-slate-200">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Ítem / Especificación Técnica</th>
                        <th className="py-2 px-2 text-center w-16">Unidad</th>
                        <th className="py-2 px-2 text-center w-16">Cant.</th>
                        <th className="py-2 px-3 text-right w-28">P. Unitario</th>
                        <th className="py-2 px-3 text-right w-28">Total Neto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fallbackLines.map((item, idx) => {
                        const uPrice = item.price ?? (item as any).unitPrice ?? 0;
                        const sTotal = item.subtotal ?? (uPrice * (item.quantity || 1));
                        return (
                          <tr key={item.id || idx}>
                            <td className="py-2 px-3">
                              <span className="font-semibold text-slate-900">{item.name || (item as any).description || 'Ítem Naval'}</span>
                              {(item.skuOrCode || (item as any).description) && (
                                <span className="text-[10px] text-slate-400 font-mono block">
                                  Ref: {item.skuOrCode || (item as any).description}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-slate-600">{item.unit || 'UND'}</td>
                            <td className="py-2 px-2 text-center font-mono font-medium">{item.quantity || 1}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatMoney(uPrice, company.currency)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatMoney(sTotal, company.currency)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Costos Adicionales Opcionales */}
              {quotation.extraCosts && quotation.extraCosts.length > 0 && (
                <div className="p-3 bg-amber-50/80 rounded border border-amber-200 text-xs space-y-1">
                  <span className="font-bold text-amber-900 text-[11px] block">
                    COSTOS ADICIONALES OPCIONALES (NO INCLUIDOS EN EL TOTAL):
                  </span>
                  <div className="divide-y divide-amber-200/50">
                    {quotation.extraCosts.map((ec, idx) => (
                      <div key={ec.id || idx} className="py-1 flex justify-between text-[11px]">
                        <span>• {ec.name} {ec.notes ? `(${ec.notes})` : ''}</span>
                        <span className="font-mono font-semibold">{formatMoney(ec.subtotal, company.currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resumen Económico */}
              <div className="flex justify-end pt-2">
                <div className="w-80 space-y-1.5 font-mono text-right text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal Neto:</span>
                    <span>{formatMoney(quotation.subtotal, company.currency)}</span>
                  </div>
                  {(quotation as any).totalSavings ? (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Descuento Comercial:</span>
                      <span>- {formatMoney((quotation as any).totalSavings, company.currency)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-slate-600">
                    <span>IVA ({company.taxRatePct}%):</span>
                    <span>{formatMoney(quotation.taxAmount, company.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-300 pt-2">
                    <span>TOTAL:</span>
                    {quotation.currency === 'UF' && (quotation as any).ufGrandTotal ? (
                      <div className="flex flex-col items-end">
                        <span className="text-base text-indigo-700">
                          UF {(quotation as any).ufGrandTotal.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] font-normal text-slate-500 font-sans">
                          Equiv: {formatMoney(quotation.grandTotal, 'CLP')}
                        </span>
                      </div>
                    ) : (
                      <span className="text-indigo-700 font-bold">
                        {formatMoney(quotation.grandTotal, company.currency)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Términos y Condiciones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                <div className="space-y-1">
                  <span className="font-bold text-slate-900 block">NOTAS TÉCNICAS:</span>
                  <p className="whitespace-pre-line text-slate-700">
                    {quotation.notes || 'Los planos y memorias técnicas se entregarán en formato DWG y PDF firmados por Ingeniero Naval colegiado para tramitación DIRECTEMAR.'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="font-bold text-slate-900 block">CONDICIONES COMERCIALES:</span>
                  <p className="whitespace-pre-line text-slate-700">
                    {quotation.terms || '1. Valores expresados en Pesos Chilenos (CLP) netos, más IVA (19%).\n2. Forma de pago: 50% de anticipo al inicio de los trabajos y 50% contra entrega conforme de planos visados o memoria técnica aprobada.\n3. Plazos de entrega: Según cronograma técnico acordado (habitual 2 a 6 semanas según envergadura del proyecto y revisiones).\n4. Entregables: Planos en formato digital DWG y PDF alta resolución firmados por Ingeniero Naval colegiado, memoria de cálculo y cuadernillo de estabilidad para tramitación DIRECTEMAR.\n5. Validez de la cotización: 15 días hábiles a contar de su fecha de emisión.'}
                  </p>
                </div>
              </div>

              {/* Cuadro de Firmas */}
              <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs">
                <div className="space-y-2">
                  <div className="h-16 border-b border-slate-400 flex items-end justify-center pb-1">
                    <span className="text-[10px] text-slate-400 font-mono">[Firma y Timbre Autorizado]</span>
                  </div>
                  <p className="font-bold text-slate-900">{salesRep?.name || company.name}</p>
                  <p className="text-[11px] text-slate-500">M&L Ingeniería Naval SpA</p>
                </div>

                <div className="space-y-2">
                  <div className="h-16 border-b border-slate-400 flex items-end justify-center pb-1">
                    {quotation.status === 'ACCEPTED' && (quotation as any).decision ? (
                      <div className="text-emerald-700 font-bold text-[11px]">
                        ✓ Aceptado Digitalmente por {(quotation as any).decision.signerName}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-mono">[Firma y Aceptación Mandante]</span>
                    )}
                  </div>
                  <p className="font-bold text-slate-900">{customer?.businessName || (quotation as any).customerBusinessName || 'Cliente'}</p>
                  <p className="text-[11px] text-slate-500">RUT: {customer?.taxId || (quotation as any).customerTaxId || '77.210.980-3'}</p>
                </div>
              </div>

              {/* Pie de Página A4 */}
              <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
                Documento oficial generado por Cotizador Online &bull; M&L Ingeniería Naval SpA &bull; Puerto Montt, Región de Los Lagos, Chile
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
