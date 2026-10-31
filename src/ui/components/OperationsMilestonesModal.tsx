import React, { useState, useEffect, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import { OperationOrder, OperationMilestone, OperationDeliverable } from '../../modules/types.ts';
import { apiRequest } from '../api.ts';

interface OperationsMilestonesModalProps {
  isOpen: boolean;
  onClose: () => void;
  operation: OperationOrder | null;
  onOperationUpdated: (updatedOperation?: OperationOrder) => void;
}

/**
 * Recalcula de forma pura e inmutable el avance y estado de una orden a partir de sus hitos.
 */
function computeImmutableOperationState(
  baseOp: OperationOrder,
  nextMilestones: OperationMilestone[],
  nextDeliverables?: OperationDeliverable[]
): OperationOrder {
  const safeMilestones = nextMilestones.map((m) => ({ ...m }));
  const safeDeliverables = (nextDeliverables ?? baseOp.deliverables ?? []).map((d) => ({ ...d }));
  const total = safeMilestones.length;
  const completed = safeMilestones.filter((m) => m.status === 'COMPLETED').length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  let status: OperationOrder['status'] = 'SCHEDULED';
  let completedDate = baseOp.completedDate;
  if (total > 0 && progressPct === 100) {
    status = 'COMPLETED';
    completedDate = completedDate || new Date().toISOString();
  } else if (progressPct > 0 || safeMilestones.some((m) => m.status === 'IN_PROGRESS')) {
    status = 'IN_PROGRESS';
    completedDate = undefined;
  } else {
    status = 'SCHEDULED';
    completedDate = undefined;
  }

  return {
    ...baseOp,
    milestones: safeMilestones,
    deliverables: safeDeliverables,
    progressPct,
    status,
    completedDate,
  };
}

/**
 * Genera y descarga directamente un documento técnico oficial en formato PDF (.pdf)
 * para el entregable seleccionado de la orden de trabajo.
 */
export function downloadTechnicalDeliverableFile(
  operation: OperationOrder,
  deliverable: OperationDeliverable
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const milestones = operation.milestones || [];
  const completedMs = milestones.filter((m) => m.status === 'COMPLETED').length;
  const statusLabel =
    deliverable.status === 'DELIVERED'
      ? 'ENTREGADO CONFORME'
      : deliverable.status === 'READY'
      ? 'LISTO PARA REVISIÓN'
      : 'EN ELABORACIÓN TÉCNICA';

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 16;
  const contentWidth = pageWidth - marginX * 2;

  // Encabezado corporativo
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 34, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('M&L INGENIERÍA NAVAL Y SERVICIOS MARÍTIMOS SPA', marginX, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(199, 210, 254); // indigo-200
  doc.text('CERTIFICADO Y EXPEDIENTE TÉCNICO DE ENTREGABLE DOCUMENTAL', marginX, 21);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Puerto Montt, Región de Los Lagos — Folio Operativo: ${operation.orderNumber}`, marginX, 27.5);

  let y = 44;

  // Bloque 1: Datos de la Orden de Trabajo
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, y, contentWidth, 42, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('1. IDENTIFICACIÓN DE LA ORDEN DE TRABAJO', marginX + 4, y + 7);

  doc.setFontSize(8.5);
  const col1X = marginX + 4;
  const col2X = marginX + contentWidth / 2 + 2;

  doc.setFont('helvetica', 'bold');
  doc.text('N.º Orden Operativa:', col1X, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(operation.orderNumber, col1X + 35, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.text('Cotización Asociada:', col2X, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(operation.quotationNumber || 'N/A', col2X + 35, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.text('Cliente / Mandante:', col1X, y + 20.5);
  doc.setFont('helvetica', 'normal');
  doc.text(doc.splitTextToSize(operation.customerBusinessName || '-', 52)[0], col1X + 35, y + 20.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Fecha Programada:', col2X, y + 20.5);
  doc.setFont('helvetica', 'normal');
  doc.text(operation.scheduledDate || '-', col2X + 35, y + 20.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Responsable Técnico:', col1X, y + 27);
  doc.setFont('helvetica', 'normal');
  doc.text(doc.splitTextToSize(operation.assignedStaff || '-', 52)[0], col1X + 35, y + 27);

  doc.setFont('helvetica', 'bold');
  doc.text('Guía / Destino:', col2X, y + 27);
  doc.setFont('helvetica', 'normal');
  const guideOrDest = operation.guideNumber
    ? `${operation.guideNumber} — ${operation.deliveryAddress || ''}`
    : operation.deliveryAddress || 'Instalaciones del cliente';
  doc.text(doc.splitTextToSize(guideOrDest, 52)[0], col2X + 35, y + 27);

  doc.setFont('helvetica', 'bold');
  doc.text('Proyecto:', col1X, y + 34.5);
  doc.setFont('helvetica', 'normal');
  doc.text(doc.splitTextToSize(operation.title || '-', contentWidth - 28)[0], col1X + 20, y + 34.5);

  y += 50;

  // Bloque 2: Certificación del Entregable
  doc.setFillColor(238, 242, 255); // indigo-50
  doc.setDrawColor(165, 180, 252); // indigo-300
  doc.roundedRect(marginX, y, contentWidth, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(49, 46, 129); // indigo-900
  doc.text('2. FICHA DEL ENTREGABLE DOCUMENTAL Y TÉCNICO', marginX + 4, y + 7);

  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Documento Entregable:', col1X, y + 14.5);
  doc.setFont('helvetica', 'bold');
  doc.text(doc.splitTextToSize(deliverable.name, contentWidth - 48)[0], col1X + 40, y + 14.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Código de Trazabilidad:', col1X, y + 21.5);
  doc.setFont('helvetica', 'normal');
  doc.text(deliverable.id, col1X + 40, y + 21.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Estado Documental:', col2X, y + 21.5);
  doc.setFont('helvetica', 'normal');
  doc.text(statusLabel, col2X + 33, y + 21.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Avance Físico de la Orden:', col1X, y + 28);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${operation.progressPct}% (${completedMs} de ${milestones.length} hitos verificados)`,
    col1X + 44,
    y + 28
  );

  y += 40;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > 272) {
      doc.addPage();
      y = 20;
    }
  };

  // Bloque 3: Hitos de Ejecución Verificados
  ensureSpace(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('3. HITOS DE EJECUCIÓN VERIFICADOS EN LA ORDEN', marginX, y);
  y += 3;
  doc.setDrawColor(203, 213, 225);
  doc.line(marginX, y, marginX + contentWidth, y);
  y += 6;

  doc.setFontSize(8.5);
  if (milestones.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text('Sin hitos registrados en esta orden.', marginX + 2, y);
    y += 7;
  } else {
    milestones.forEach((m, idx) => {
      ensureSpace(10);
      const badge =
        m.status === 'COMPLETED'
          ? '[COMPLETADO]'
          : m.status === 'IN_PROGRESS'
          ? '[EN PROCESO]'
          : '[PENDIENTE]';
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(m.status === 'COMPLETED' ? 5 : 51, m.status === 'COMPLETED' ? 122 : 65, m.status === 'COMPLETED' ? 85 : 85);
      doc.text(`${idx + 1}. ${badge}`, marginX + 2, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      const msLine = `${m.name} (Fecha prog.: ${m.date})`;
      const wrappedMs = doc.splitTextToSize(msLine, contentWidth - 36);
      doc.text(wrappedMs, marginX + 34, y);
      y += Math.max(6, wrappedMs.length * 4.5);
    });
  }

  y += 5;

  // Bloque 4: Alcance y Suministros Comprendidos
  ensureSpace(22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('4. ALCANCE TÉCNICO Y SUMINISTROS COMPRENDIDOS', marginX, y);
  y += 3;
  doc.setDrawColor(203, 213, 225);
  doc.line(marginX, y, marginX + contentWidth, y);
  y += 6;

  const items =
    operation.itemsIncluded && operation.itemsIncluded.length > 0
      ? operation.itemsIncluded
      : ['Servicios de ingeniería naval y documentación técnica según cotización aprobada.'];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  items.forEach((item) => {
    const wrappedItem = doc.splitTextToSize(`• ${item}`, contentWidth - 4);
    ensureSpace(wrappedItem.length * 5 + 3);
    doc.text(wrappedItem, marginX + 2, y);
    y += wrappedItem.length * 4.8 + 1.5;
  });

  // Pie de página oficial
  const footerY = 280;
  doc.setDrawColor(203, 213, 225);
  doc.line(marginX, footerY - 5, marginX + contentWidth, footerY - 5);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Documento PDF emitido electrónicamente por Sistema Operativo M&L Ingeniería Naval SpA — Fecha: ${new Date().toLocaleString('es-CL')}`,
    marginX,
    footerY
  );

  const safeFileName = `${operation.orderNumber}_${
    deliverable.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'Entregable_Tecnico'
  }.pdf`;

  doc.save(safeFileName);
}

export function OperationsMilestonesModal({
  isOpen,
  onClose,
  operation,
  onOperationUpdated,
}: OperationsMilestonesModalProps) {
  // Todos los hooks se declaran al inicio respetando estrictamente las Rules of Hooks de React
  const [localOp, setLocalOp] = useState<OperationOrder | null>(operation);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Nuevo hito
  const [newMsName, setNewMsName] = useState<string>('');
  const [newMsDate, setNewMsDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Edición en línea de hito existente
  const [editingMsId, setEditingMsId] = useState<string | null>(null);
  const [editMsName, setEditMsName] = useState<string>('');
  const [editMsDate, setEditMsDate] = useState<string>('');

  // Nuevo entregable
  const [newDelName, setNewDelName] = useState<string>('');

  // Edición en línea de entregable existente
  const [editingDelId, setEditingDelId] = useState<string | null>(null);
  const [editDelName, setEditDelName] = useState<string>('');

  // Sincronizar localOp cada vez que cambie la prop operation desde el padre o sincronización externa
  useEffect(() => {
    setLocalOp(operation ? {
      ...operation,
      milestones: (operation.milestones || []).map((m) => ({ ...m })),
      deliverables: (operation.deliverables || []).map((d) => ({ ...d })),
    } : null);
  }, [operation]);

  // Limpiar estados temporales al abrir/cerrar el modal o al cambiar de orden de trabajo
  const resetTransientState = useCallback(() => {
    setErrorMsg(null);
    setSaving(false);
    setNewMsName('');
    setNewMsDate(new Date().toISOString().split('T')[0]);
    setEditingMsId(null);
    setEditMsName('');
    setEditMsDate('');
    setNewDelName('');
    setEditingDelId(null);
    setEditDelName('');
  }, []);

  useEffect(() => {
    resetTransientState();
  }, [isOpen, operation?.id, resetTransientState]);

  const handleSafeClose = useCallback(() => {
    if (saving) return;
    resetTransientState();
    onClose();
  }, [saving, resetTransientState, onClose]);

  // Cerrar con tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleSafeClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleSafeClose]);

  if (!isOpen || !localOp) return null;

  const milestones = localOp.milestones || [];
  const deliverables = localOp.deliverables || [];
  const completedCount = milestones.filter((m) => m.status === 'COMPLETED').length;

  const syncUpdatedOp = (updated: OperationOrder) => {
    setLocalOp(updated);
    onOperationUpdated(updated);
  };

  const handleToggleMilestone = async (milestone: OperationMilestone) => {
    const previousOp = localOp;
    const nextStatus: OperationMilestone['status'] =
      milestone.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';

    const optimisticMilestones = (localOp.milestones || []).map((m) =>
      m.id === milestone.id
        ? {
            ...m,
            status: nextStatus,
            completedAt: nextStatus === 'COMPLETED' ? new Date().toISOString() : undefined,
          }
        : { ...m }
    );
    const optimisticOp = computeImmutableOperationState(localOp, optimisticMilestones);
    syncUpdatedOp(optimisticOp);

    try {
      setSaving(true);
      setErrorMsg(null);
      const res = await apiRequest<OperationOrder>(
        `/api/v1/operations/${localOp.id}/milestones/${milestone.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      if (res.error) {
        setLocalOp(previousOp);
        onOperationUpdated(previousOp);
        setErrorMsg(res.error.detail || 'Error al actualizar estado del hito');
        return;
      }
      if (res.data) {
        syncUpdatedOp(res.data);
      }
    } catch (err: any) {
      setLocalOp(previousOp);
      onOperationUpdated(previousOp);
      setErrorMsg(err.message || 'Error al actualizar estado del hito');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newMsName.trim();
    const safeDate = newMsDate.trim() || new Date().toISOString().split('T')[0];
    if (!trimmedName) return;

    const previousOp = localOp;
    const tempId = `ms-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimisticMilestone: OperationMilestone = {
      id: tempId,
      name: trimmedName,
      date: safeDate,
      status: 'PENDING',
    };
    const optimisticOp = computeImmutableOperationState(localOp, [
      ...(localOp.milestones || []),
      optimisticMilestone,
    ]);
    syncUpdatedOp(optimisticOp);
    setNewMsName('');

    try {
      setSaving(true);
      setErrorMsg(null);
      const res = await apiRequest<OperationOrder>(`/api/v1/operations/${localOp.id}/milestones`, {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          date: safeDate,
          status: 'PENDING',
        }),
      });
      if (res.error) {
        setLocalOp(previousOp);
        onOperationUpdated(previousOp);
        setNewMsName(trimmedName);
        setErrorMsg(res.error.detail || 'Error al agregar hito');
        return;
      }
      if (res.data) {
        syncUpdatedOp(res.data);
      }
    } catch (err: any) {
      setLocalOp(previousOp);
      onOperationUpdated(previousOp);
      setNewMsName(trimmedName);
      setErrorMsg(err.message || 'Error al agregar hito');
    } finally {
      setSaving(false);
    }
  };

  const startEditingMilestone = (m: OperationMilestone) => {
    setEditingMsId(m.id);
    setEditMsName(m.name);
    setEditMsDate(m.date);
    setErrorMsg(null);
  };

  const handleSaveMilestoneEdit = async (milestoneId: string) => {
    const trimmedName = editMsName.trim();
    const trimmedDate = editMsDate.trim() || new Date().toISOString().split('T')[0];
    if (!trimmedName) {
      setErrorMsg('El nombre del hito no puede estar vacío.');
      return;
    }

    const previousOp = localOp;
    const optimisticMilestones = (localOp.milestones || []).map((m) =>
      m.id === milestoneId ? { ...m, name: trimmedName, date: trimmedDate } : { ...m }
    );
    const optimisticOp = computeImmutableOperationState(localOp, optimisticMilestones);
    syncUpdatedOp(optimisticOp);
    setEditingMsId(null);

    try {
      setSaving(true);
      setErrorMsg(null);
      const res = await apiRequest<OperationOrder>(
        `/api/v1/operations/${localOp.id}/milestones/${milestoneId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ name: trimmedName, date: trimmedDate }),
        }
      );
      if (res.error) {
        setLocalOp(previousOp);
        onOperationUpdated(previousOp);
        setErrorMsg(res.error.detail || 'Error al editar el hito');
        return;
      }
      if (res.data) {
        syncUpdatedOp(res.data);
      }
    } catch (err: any) {
      setLocalOp(previousOp);
      onOperationUpdated(previousOp);
      setErrorMsg(err.message || 'Error al editar el hito');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    const previousOp = localOp;
    const optimisticMilestones = (localOp.milestones || []).filter((m) => m.id !== milestoneId);
    const optimisticOp = computeImmutableOperationState(localOp, optimisticMilestones);
    syncUpdatedOp(optimisticOp);
    if (editingMsId === milestoneId) setEditingMsId(null);

    try {
      setSaving(true);
      setErrorMsg(null);
      const res = await apiRequest<OperationOrder>(
        `/api/v1/operations/${localOp.id}/milestones/${milestoneId}`,
        {
          method: 'DELETE',
        }
      );
      if (res.error) {
        setLocalOp(previousOp);
        onOperationUpdated(previousOp);
        setErrorMsg(res.error.detail || 'Error al eliminar el hito');
        return;
      }
      if (res.data) {
        syncUpdatedOp(res.data);
      }
    } catch (err: any) {
      setLocalOp(previousOp);
      onOperationUpdated(previousOp);
      setErrorMsg(err.message || 'Error al eliminar el hito');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newDelName.trim();
    if (!trimmedName) return;

    // Evitar redundancia de entregables con el mismo nombre dentro de la misma orden
    const alreadyExists = (localOp.deliverables || []).some(
      (d) => d.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (alreadyExists) {
      setErrorMsg('Ya existe un entregable con ese nombre en esta orden de trabajo.');
      return;
    }

    const generatedPdfUri = `https://docs.mlingenieria.cl/${localOp.orderNumber.toLowerCase()}/${encodeURIComponent(
      trimmedName.toLowerCase().replace(/\s+/g, '-')
    )}.pdf`;

    const previousOp = localOp;
    const tempId = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimisticDel: OperationDeliverable = {
      id: tempId,
      name: trimmedName,
      status: 'PENDING',
      link: generatedPdfUri,
    };
    const optimisticOp = computeImmutableOperationState(
      localOp,
      localOp.milestones || [],
      [...(localOp.deliverables || []), optimisticDel]
    );
    syncUpdatedOp(optimisticOp);
    setNewDelName('');

    try {
      setSaving(true);
      setErrorMsg(null);
      const res = await apiRequest<OperationOrder>(`/api/v1/operations/${localOp.id}/deliverables`, {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          status: 'PENDING',
          link: generatedPdfUri,
        }),
      });
      if (res.error) {
        setLocalOp(previousOp);
        onOperationUpdated(previousOp);
        setNewDelName(trimmedName);
        setErrorMsg(res.error.detail || 'Error al agregar entregable');
        return;
      }
      if (res.data) {
        syncUpdatedOp(res.data);
      }
    } catch (err: any) {
      setLocalOp(previousOp);
      onOperationUpdated(previousOp);
      setNewDelName(trimmedName);
      setErrorMsg(err.message || 'Error al agregar entregable');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDeliverableStatus = async (deliverable: OperationDeliverable) => {
    const previousOp = localOp;
    const nextStatus: OperationDeliverable['status'] =
      deliverable.status === 'PENDING'
        ? 'READY'
        : deliverable.status === 'READY'
        ? 'DELIVERED'
        : 'PENDING';

    const optimisticDeliverables = (localOp.deliverables || []).map((d) =>
      d.id === deliverable.id ? { ...d, status: nextStatus } : { ...d }
    );
    const optimisticOp = computeImmutableOperationState(
      localOp,
      localOp.milestones || [],
      optimisticDeliverables
    );
    syncUpdatedOp(optimisticOp);

    try {
      setSaving(true);
      setErrorMsg(null);
      const res = await apiRequest<OperationOrder>(
        `/api/v1/operations/${localOp.id}/deliverables/${deliverable.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      if (res.error) {
        setLocalOp(previousOp);
        onOperationUpdated(previousOp);
        setErrorMsg(res.error.detail || 'Error al actualizar entregable');
        return;
      }
      if (res.data) {
        syncUpdatedOp(res.data);
      }
    } catch (err: any) {
      setLocalOp(previousOp);
      onOperationUpdated(previousOp);
      setErrorMsg(err.message || 'Error al actualizar entregable');
    } finally {
      setSaving(false);
    }
  };

  const startEditingDeliverable = (d: OperationDeliverable) => {
    setEditingDelId(d.id);
    setEditDelName(d.name);
    setErrorMsg(null);
  };

  const handleSaveDeliverableEdit = async (deliverableId: string) => {
    const trimmedName = editDelName.trim();
    if (!trimmedName) {
      setErrorMsg('El nombre del entregable no puede estar vacío.');
      return;
    }

    const duplicateExists = (localOp.deliverables || []).some(
      (d) => d.id !== deliverableId && d.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicateExists) {
      setErrorMsg('Ya existe otro entregable con ese mismo nombre en esta orden.');
      return;
    }

    const previousOp = localOp;
    const optimisticDeliverables = (localOp.deliverables || []).map((d) =>
      d.id === deliverableId ? { ...d, name: trimmedName } : { ...d }
    );
    const optimisticOp = computeImmutableOperationState(
      localOp,
      localOp.milestones || [],
      optimisticDeliverables
    );
    syncUpdatedOp(optimisticOp);
    setEditingDelId(null);

    try {
      setSaving(true);
      setErrorMsg(null);
      const res = await apiRequest<OperationOrder>(
        `/api/v1/operations/${localOp.id}/deliverables/${deliverableId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ name: trimmedName }),
        }
      );
      if (res.error) {
        setLocalOp(previousOp);
        onOperationUpdated(previousOp);
        setErrorMsg(res.error.detail || 'Error al editar entregable');
        return;
      }
      if (res.data) {
        syncUpdatedOp(res.data);
      }
    } catch (err: any) {
      setLocalOp(previousOp);
      onOperationUpdated(previousOp);
      setErrorMsg(err.message || 'Error al editar entregable');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDeliverable = async (deliverableId: string) => {
    const previousOp = localOp;
    const optimisticDeliverables = (localOp.deliverables || []).filter((d) => d.id !== deliverableId);
    const optimisticOp = computeImmutableOperationState(
      localOp,
      localOp.milestones || [],
      optimisticDeliverables
    );
    syncUpdatedOp(optimisticOp);
    if (editingDelId === deliverableId) setEditingDelId(null);

    try {
      setSaving(true);
      setErrorMsg(null);
      const res = await apiRequest<OperationOrder>(
        `/api/v1/operations/${localOp.id}/deliverables/${deliverableId}`,
        {
          method: 'DELETE',
        }
      );
      if (res.error) {
        setLocalOp(previousOp);
        onOperationUpdated(previousOp);
        setErrorMsg(res.error.detail || 'Error al eliminar entregable');
        return;
      }
      if (res.data) {
        syncUpdatedOp(res.data);
      }
    } catch (err: any) {
      setLocalOp(previousOp);
      onOperationUpdated(previousOp);
      setErrorMsg(err.message || 'Error al eliminar entregable');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleSafeClose();
        }
      }}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-6 my-8 text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🛠️</span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Gestión de Hitos y Entregables ({localOp.orderNumber})
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {localOp.title} — {localOp.customerBusinessName}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSafeClose}
            aria-label="Cerrar modal"
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xl font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between" role="alert">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-rose-600 dark:text-rose-300 font-bold ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Barra de Avance Calculado Automáticamente */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Avance Físico Calculado ({completedCount} de {milestones.length} hitos completados)
            </span>
            <span className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400">
              {localOp.progressPct}%
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-300 dark:border-slate-700">
            <div
              className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${localOp.progressPct}%` }}
            />
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block italic">
            * El avance se calcula exclusivamente a partir de los hitos completados. El control libre de porcentaje ha sido eliminado.
          </span>
        </div>

        {/* Sección 1: Hitos de Trabajo */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span>🚩</span> Hitos de la Orden
            </h4>
            <span className="text-xs text-slate-500 dark:text-slate-400">Marque el hito al completarlo</span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {milestones.length === 0 ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs text-slate-500 dark:text-slate-400 text-center italic border border-slate-200 dark:border-slate-800">
                No hay hitos registrados en esta orden.
              </div>
            ) : (
              milestones.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-lg border flex items-center justify-between gap-3 transition ${
                    m.status === 'COMPLETED'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-100'
                      : m.status === 'IN_PROGRESS'
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-700/60 text-amber-900 dark:text-amber-100'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {editingMsId === m.id ? (
                    <div className="flex-1 flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={editMsName}
                        onChange={(e) => setEditMsName(e.target.value)}
                        className="flex-1 min-w-[180px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100"
                      />
                      <input
                        type="date"
                        value={editMsDate}
                        onChange={(e) => setEditMsDate(e.target.value)}
                        className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveMilestoneEdit(m.id)}
                        disabled={saving || !editMsName.trim()}
                        className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold cursor-pointer"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingMsId(null)}
                        className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <>
                      <label className="flex items-center gap-3 flex-1 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={m.status === 'COMPLETED'}
                          onChange={() => handleToggleMilestone(m)}
                          disabled={saving}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 cursor-pointer"
                        />
                        <div>
                          <span className={`text-xs font-semibold block ${m.status === 'COMPLETED' ? 'line-through text-slate-400' : ''}`}>
                            {m.name}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            Fecha: {m.date} {m.completedAt ? `(Completado: ${new Date(m.completedAt).toLocaleDateString('es-CL')})` : ''}
                          </span>
                        </div>
                      </label>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            m.status === 'COMPLETED'
                              ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-600'
                              : m.status === 'IN_PROGRESS'
                              ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-600'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {m.status === 'COMPLETED' ? 'COMPLETADO' : m.status === 'IN_PROGRESS' ? 'EN PROCESO' : 'PENDIENTE'}
                        </span>
                        <button
                          type="button"
                          onClick={() => startEditingMilestone(m)}
                          disabled={saving}
                          title="Editar hito"
                          className="px-1.5 py-0.5 rounded text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-xs cursor-pointer"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMilestone(m.id)}
                          disabled={saving}
                          title="Eliminar hito"
                          className="px-1.5 py-0.5 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-100/60 dark:hover:bg-rose-950/50 text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Formulario rápido para añadir hito */}
          <form onSubmit={handleAddMilestone} className="flex gap-2 pt-1">
            <input
              type="text"
              placeholder="Nombre del nuevo hito (ej: Medición de espesores en varadero)..."
              value={newMsName}
              onChange={(e) => setNewMsName(e.target.value)}
              className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <input
              type="date"
              value={newMsDate}
              onChange={(e) => setNewMsDate(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={saving || !newMsName.trim()}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 cursor-pointer"
            >
              + Añadir Hito
            </button>
          </form>
        </div>

        {/* Sección 2: Entregables Documentales y Técnicos (Sin redundancias de entrega, formato PDF directo) */}
        <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span>📦</span> Entregables Documentales y Técnicos
            </h4>
            <span className="text-xs text-slate-500 dark:text-slate-400">Descarga oficial en formato PDF</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {deliverables.length === 0 ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs text-slate-500 dark:text-slate-400 text-center italic border border-slate-200 dark:border-slate-800">
                No hay entregables configurados en esta orden.
              </div>
            ) : (
              deliverables.map((d) => (
                <div
                  key={d.id}
                  className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                >
                  {editingDelId === d.id ? (
                    <div className="flex-1 flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={editDelName}
                        onChange={(e) => setEditDelName(e.target.value)}
                        placeholder="Nombre del entregable"
                        className="flex-1 min-w-[200px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveDeliverableEdit(d.id)}
                        disabled={saving || !editDelName.trim()}
                        className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold cursor-pointer"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingDelId(null)}
                        className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 block truncate">
                          📄 {d.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => downloadTechnicalDeliverableFile(localOp, d)}
                          className="mt-1 inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline text-[11px] font-semibold cursor-pointer"
                        >
                          ⬇ Descargar PDF
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleDeliverableStatus(d)}
                          disabled={saving}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold border transition cursor-pointer ${
                            d.status === 'DELIVERED'
                              ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-600'
                              : d.status === 'READY'
                              ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-600'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {d.status === 'DELIVERED' ? 'ENTREGADO' : d.status === 'READY' ? 'LISTO' : 'PENDIENTE'}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditingDeliverable(d)}
                          disabled={saving}
                          title="Editar entregable"
                          className="px-1.5 py-0.5 rounded text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-xs cursor-pointer"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDeliverable(d.id)}
                          disabled={saving}
                          title="Eliminar entregable"
                          className="px-1.5 py-0.5 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-100/60 dark:hover:bg-rose-950/50 text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Formulario rápido para añadir entregable */}
          <form onSubmit={handleAddDeliverable} className="flex gap-2 pt-1">
            <input
              type="text"
              placeholder="Nombre del entregable técnico (ej: Planos de Disposición General Visados)..."
              value={newDelName}
              onChange={(e) => setNewDelName(e.target.value)}
              className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={saving || !newDelName.trim()}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 cursor-pointer"
            >
              + Añadir Entregable
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={handleSafeClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}


