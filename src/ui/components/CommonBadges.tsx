import React from 'react';
import { Package, Wrench, Clock, CheckCircle2, XCircle, Eye, FileText, Send, AlertTriangle } from 'lucide-react';
import { QuotationStatus, CatalogItemType } from '../../modules/types.ts';

export const statusLabels: Record<QuotationStatus, string> = {
  DRAFT: 'Borrador',
  PENDING_APPROVAL: 'Pendiente de Aprobación',
  SENT: 'Enviada / Pendiente',
  VIEWED: 'Vista por Cliente',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  EXPIRED: 'Vencida',
  CHANGES_REQUESTED: 'Ajuste Solicitado',
};

export function getEffectiveQuotationStatus<
  T extends {
    status: QuotationStatus;
    createdAt?: string;
    sentAt?: string;
    validityDays?: number;
    validUntil?: string;
  }
>(quotation: T): QuotationStatus {
  if (quotation.status === 'ACCEPTED' || quotation.status === 'REJECTED') {
    return quotation.status;
  }
  if (quotation.status === 'EXPIRED') {
    return 'EXPIRED';
  }

  // Comprobar fecha de vencimiento según validUntil o sentAt + validityDays
  if (quotation.validUntil) {
    const validUntilDate = new Date(quotation.validUntil).getTime();
    if (!isNaN(validUntilDate) && Date.now() > validUntilDate) {
      return 'EXPIRED';
    }
  } else if (quotation.sentAt) {
    const sentDate = new Date(quotation.sentAt).getTime();
    const validity = quotation.validityDays ?? 15;
    if (!isNaN(sentDate) && Date.now() > sentDate + validity * 24 * 60 * 60 * 1000) {
      return 'EXPIRED';
    }
  } else if (quotation.createdAt) {
    const validity = quotation.validityDays ?? 15;
    const createdDate = new Date(quotation.createdAt).getTime();
    if (!isNaN(createdDate) && Date.now() > createdDate + validity * 24 * 60 * 60 * 1000) {
      return 'EXPIRED';
    }
  }

  return quotation.status;
}

export function StatusBadge({ status }: { status: QuotationStatus }) {
  switch (status) {
    case 'DRAFT':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
          <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          {statusLabels.DRAFT}
        </span>
      );
    case 'PENDING_APPROVAL':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          {statusLabels.PENDING_APPROVAL}
        </span>
      );
    case 'SENT':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
          <Send className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          {statusLabels.SENT}
        </span>
      );
    case 'VIEWED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
          <Eye className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          {statusLabels.VIEWED}
        </span>
      );
    case 'ACCEPTED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          {statusLabels.ACCEPTED}
        </span>
      );
    case 'REJECTED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
          <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          {statusLabels.REJECTED}
        </span>
      );
    case 'EXPIRED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
          <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          {statusLabels.EXPIRED}
        </span>
      );
    case 'CHANGES_REQUESTED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60">
          <AlertTriangle className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
          {statusLabels.CHANGES_REQUESTED}
        </span>
      );
    default:
      return null;
  }
}

export function RevisionBadge({
  revision = 1,
  isLatest,
}: {
  revision?: number;
  isLatest?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold border ${
        revision > 1
          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800/60'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
      }`}
      title={isLatest === false ? `Revisión histórica R${revision}` : `Revisión vigente R${revision}`}
    >
      R{revision}
      {isLatest === false && (
        <span className="text-[9px] text-rose-500 font-sans font-bold">(Antigua)</span>
      )}
    </span>
  );
}

export function ItemTypeBadge({ type }: { type: CatalogItemType }) {
  if (type === 'PRODUCT') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
        <Package className="w-3 h-3 text-blue-500 dark:text-blue-400" />
        Producto
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
      <Wrench className="w-3 h-3 text-purple-500 dark:text-purple-400" />
      Servicio
    </span>
  );
}

export function MarginExceptionBadge({
  marginException,
  marginApprovalStatus,
  marginApprovedByName,
  marginApprovedAt,
}: {
  marginException?: boolean;
  marginApprovalStatus?: string;
  marginApprovedByName?: string;
  marginApprovedAt?: string;
}) {
  if (marginException || marginApprovalStatus === 'APPROVED') {
    return (
      <span
        title={
          marginApprovedByName
            ? `Excepción aprobada por ${marginApprovedByName} el ${marginApprovedAt ? new Date(marginApprovedAt).toLocaleDateString('es-CL') : ''}`
            : 'Excepción de margen autorizada por Administración'
        }
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-mono"
      >
        <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
        Excepción Margen
      </span>
    );
  }
  return null;
}
