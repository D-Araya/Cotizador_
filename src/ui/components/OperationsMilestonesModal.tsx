import React, { useState } from 'react';
import { OperationOrder, OperationMilestone, OperationDeliverable } from '../../modules/types.ts';
import { apiRequest } from '../api.ts';

interface OperationsMilestonesModalProps {
  isOpen: boolean;
  onClose: () => void;
  operation: OperationOrder | null;
  onOperationUpdated: () => void;
}

export function OperationsMilestonesModal({
  isOpen,
  onClose,
  operation,
  onOperationUpdated,
}: OperationsMilestonesModalProps) {
  if (!isOpen || !operation) return null;

  const [saving, setSaving] = useState<boolean>(false);

  // Nuevo hito
  const [newMsName, setNewMsName] = useState<string>('');
  const [newMsDate, setNewMsDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Nuevo entregable
  const [newDelName, setNewDelName] = useState<string>('');
  const [newDelLink, setNewDelLink] = useState<string>('');

  const handleToggleMilestone = async (milestone: OperationMilestone) => {
    try {
      setSaving(true);
      const nextStatus = milestone.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
      await apiRequest(`/api/v1/operations/${operation.id}/milestones/${milestone.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
        }),
      });
      onOperationUpdated();
    } catch (err: any) {
      alert(err.message || 'Error al actualizar estado del hito');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsName.trim()) return;

    try {
      setSaving(true);
      await apiRequest(`/api/v1/operations/${operation.id}/milestones`, {
        method: 'POST',
        body: JSON.stringify({
          name: newMsName.trim(),
          date: newMsDate,
          status: 'PENDING',
        }),
      });
      setNewMsName('');
      onOperationUpdated();
    } catch (err: any) {
      alert(err.message || 'Error al agregar hito');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDelName.trim()) return;

    try {
      setSaving(true);
      await apiRequest(`/api/v1/operations/${operation.id}/deliverables`, {
        method: 'POST',
        body: JSON.stringify({
          name: newDelName.trim(),
          status: 'PENDING',
          link: newDelLink.trim() || undefined,
        }),
      });
      setNewDelName('');
      setNewDelLink('');
      onOperationUpdated();
    } catch (err: any) {
      alert(err.message || 'Error al agregar entregable');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDeliverableStatus = async (deliverable: OperationDeliverable) => {
    try {
      setSaving(true);
      const nextStatus =
        deliverable.status === 'PENDING'
          ? 'READY'
          : deliverable.status === 'READY'
          ? 'DELIVERED'
          : 'PENDING';
      await apiRequest(`/api/v1/operations/${operation.id}/deliverables/${deliverable.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
        }),
      });
      onOperationUpdated();
    } catch (err: any) {
      alert(err.message || 'Error al actualizar entregable');
    } finally {
      setSaving(false);
    }
  };

  const milestones = operation.milestones || [];
  const deliverables = operation.deliverables || [];
  const completedCount = milestones.filter((m) => m.status === 'COMPLETED').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-6 my-8">
        {/* Header */}
        <div className="flex justify-between items-start pb-3 border-b border-slate-700">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🛠️</span>
              <h3 className="text-lg font-bold text-slate-100">
                Gestión de Hitos y Entregables ({operation.orderNumber})
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {operation.title} — {operation.customerBusinessName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* Barra de Avance Calculado Automáticamente */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-200">
              Avance Físico Calculado ({completedCount} de {milestones.length} hitos completados)
            </span>
            <span className="font-extrabold text-sm text-cyan-400">
              {operation.progressPct}%
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
            <div
              className="bg-cyan-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${operation.progressPct}%` }}
            />
          </div>
          <span className="text-[11px] text-slate-400 block italic">
            * El avance se calcula exclusivamente a partir de los hitos completados. El control libre de porcentaje ha sido eliminado.
          </span>
        </div>

        {/* Sección 1: Hitos de Trabajo */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <span>🚩</span> Hitos de la Orden
            </h4>
            <span className="text-xs text-slate-400">Marque el hito al completarlo</span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {milestones.length === 0 ? (
              <div className="p-4 bg-slate-900/40 rounded-lg text-xs text-slate-400 text-center italic">
                No hay hitos registrados en esta orden.
              </div>
            ) : (
              milestones.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-lg border flex items-center justify-between gap-3 transition ${
                    m.status === 'COMPLETED'
                      ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-100'
                      : m.status === 'IN_PROGRESS'
                      ? 'bg-amber-950/40 border-amber-700/60 text-amber-100'
                      : 'bg-slate-900/60 border-slate-700 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={m.status === 'COMPLETED'}
                      onChange={() => handleToggleMilestone(m)}
                      disabled={saving}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-600 bg-slate-800"
                    />
                    <div>
                      <span className={`text-xs font-semibold block ${m.status === 'COMPLETED' ? 'line-through text-slate-400' : ''}`}>
                        {m.name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Fecha: {m.date} {m.completedAt ? `(Completado: ${new Date(m.completedAt).toLocaleDateString('es-CL')})` : ''}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      m.status === 'COMPLETED'
                        ? 'bg-emerald-900/60 text-emerald-200 border-emerald-600'
                        : m.status === 'IN_PROGRESS'
                        ? 'bg-amber-900/60 text-amber-200 border-amber-600'
                        : 'bg-slate-800 text-slate-300 border-slate-600'
                    }`}
                  >
                    {m.status === 'COMPLETED' ? 'COMPLETADO' : m.status === 'IN_PROGRESS' ? 'EN PROCESO' : 'PENDIENTE'}
                  </span>
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
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            />
            <input
              type="date"
              value={newMsDate}
              onChange={(e) => setNewMsDate(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={saving || !newMsName.trim()}
              className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
            >
              + Añadir Hito
            </button>
          </form>
        </div>

        {/* Sección 2: Entregables (Deliverables) */}
        <div className="space-y-3 pt-3 border-t border-slate-700/80">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <span>📦</span> Entregables Documentales y Técnicos
            </h4>
            <span className="text-xs text-slate-400">Visibles para el cliente en solo lectura</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {deliverables.length === 0 ? (
              <div className="p-4 bg-slate-900/40 rounded-lg text-xs text-slate-400 text-center italic">
                No hay entregables configurados en esta orden.
              </div>
            ) : (
              deliverables.map((d) => (
                <div
                  key={d.id}
                  className="p-3 bg-slate-900/60 rounded-lg border border-slate-700 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-100 block">{d.name}</span>
                    {d.link && (
                      <a
                        href={d.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 text-[11px] underline"
                      >
                        Enlace de descarga / visor
                      </a>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleDeliverableStatus(d)}
                    disabled={saving}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold border transition ${
                      d.status === 'DELIVERED'
                        ? 'bg-emerald-900/60 text-emerald-200 border-emerald-600'
                        : d.status === 'READY'
                        ? 'bg-blue-900/60 text-blue-200 border-blue-600'
                        : 'bg-slate-800 text-slate-400 border-slate-600'
                    }`}
                  >
                    {d.status === 'DELIVERED' ? 'ENTREGADO' : d.status === 'READY' ? 'LISTO' : 'PENDIENTE'}
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Formulario rápido para añadir entregable */}
          <form onSubmit={handleAddDeliverable} className="flex gap-2 pt-1">
            <input
              type="text"
              placeholder="Nombre del entregable (ej: Planos DWG visados)..."
              value={newDelName}
              onChange={(e) => setNewDelName(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            />
            <input
              type="url"
              placeholder="https://enlace-opcional..."
              value={newDelLink}
              onChange={(e) => setNewDelLink(e.target.value)}
              className="w-48 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={saving || !newDelName.trim()}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
            >
              + Añadir Entregable
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
