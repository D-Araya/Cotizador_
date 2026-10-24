import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  Database,
  Download,
  Upload,
} from 'lucide-react';
import { CompanySettings, User } from '../../../modules/types.ts';
import { api } from '../../api.ts';
import { RestoreModal } from '../../modals/RestoreModal.tsx';
import { TableSkeleton } from '../../components/Skeleton.tsx';
import { InternalOutletContext } from '../../layouts/AppLayout.tsx';

interface CompanyPageProps {
  user?: User;
  company?: CompanySettings | null;
  loading?: boolean;
  onUpdateCompany?: (updated: CompanySettings) => void;
  onRefreshRelatedData?: () => void;
}

export function CompanyPage(props: CompanyPageProps) {
  const context = (useOutletContext<InternalOutletContext>() || {}) as Partial<InternalOutletContext>;
  const user = props.user || context.user;
  const company = props.company !== undefined ? props.company : context.company;
  const loading = props.loading || false;
  const onUpdateCompany = props.onUpdateCompany || context.setCompany;
  const onRefreshRelatedData = props.onRefreshRelatedData || context.onRefreshRelatedData;
  const [editMinMargin, setEditMinMargin] = useState<number>(company?.minMarginPct ?? 25);
  const [editHardMinMargin, setEditHardMinMargin] = useState<number>(company?.hardMinMarginPct ?? 18);
  const [editUfRate, setEditUfRate] = useState<number>(company?.ufRate ?? 38500);
  const [savingMargin, setSavingMargin] = useState(false);
  const [marginSuccess, setMarginSuccess] = useState<string | null>(null);
  const [marginError, setMarginError] = useState<string | null>(null);

  // Motivos de pérdida configurables (P2.h)
  const [configuredLossReasons, setConfiguredLossReasons] = useState<string[]>(
    company?.lossReasons || ['precio', 'plazo', 'competencia', 'proyecto aplazado', 'otro']
  );
  const [newReasonInput, setNewReasonInput] = useState('');

  // Probabilidades de pipeline (P2.i)
  const [configuredProbabilities, setConfiguredProbabilities] = useState<Record<string, number>>(
    company?.pipelineProbabilities || {
      DRAFT: 10,
      SENT: 40,
      VIEWED: 60,
      CHANGES_REQUESTED: 50,
    }
  );
  const [probSuccess, setProbSuccess] = useState<string | null>(null);

  // Backup & Restore
  const [backupLoading, setBackupLoading] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<any | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);

  if (!user || loading || !company) {
    return <TableSkeleton rows={4} cols={2} />;
  }

  async function handleUpdateCompanyMargin() {
    if (!user || user.role !== 'ADMIN') return;
    setSavingMargin(true);
    setMarginSuccess(null);
    setMarginError(null);

    const res = await api.put<CompanySettings>('/api/v1/company', {
      ...company,
      minMarginPct: editMinMargin,
      hardMinMarginPct: editHardMinMargin,
      ufRate: editUfRate,
    });

    setSavingMargin(false);
    if (res.data) {
      onUpdateCompany?.(res.data);
      setMarginSuccess('Parámetros corporativos actualizados correctamente.');
      setTimeout(() => setMarginSuccess(null), 4000);
    } else {
      setMarginError((res.error as any)?.detail || 'Error al actualizar parámetros');
    }
  }

  async function handleSaveConfiguredLossReasons(nextReasons: string[]) {
    if (!user || user.role !== 'ADMIN') return;
    setConfiguredLossReasons(nextReasons);
    const res = await api.put<CompanySettings>('/api/v1/company', {
      ...company,
      lossReasons: nextReasons,
    });
    if (res.data) {
      onUpdateCompany?.(res.data);
    }
  }

  async function handleSavePipelineProbabilities() {
    if (!user || user.role !== 'ADMIN') return;
    const res = await api.put<CompanySettings>('/api/v1/company', {
      ...company,
      pipelineProbabilities: configuredProbabilities,
    });
    if (res.data) {
      onUpdateCompany?.(res.data);
      setProbSuccess('Probabilidades de pipeline guardadas.');
      setTimeout(() => setProbSuccess(null), 3000);
    }
  }

  async function handleDownloadBackup() {
    setBackupLoading(true);
    try {
      const res = await api.get<any>('/api/v1/system/backup');
      if (res.data) {
        const jsonStr = JSON.stringify(res.data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-sistema-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } finally {
      setBackupLoading(false);
    }
  }

  function handleSelectRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        setPendingRestoreData(parsed);
        setShowRestoreModal(true);
        setRestoreError(null);
      } catch {
        setRestoreError('El archivo no es un JSON válido');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleConfirmRestore() {
    if (!pendingRestoreData) return;
    setRestoreLoading(true);
    setRestoreError(null);

    const res = await api.post<{ message?: string; restoredCounts?: any }>('/api/v1/system/restore', pendingRestoreData);
    setRestoreLoading(false);

    if (res.data) {
      setShowRestoreModal(false);
      setPendingRestoreData(null);
      setRestoreSuccess('Base de datos restaurada correctamente.');
      onRefreshRelatedData?.();
      setTimeout(() => setRestoreSuccess(null), 5000);
    } else {
      setRestoreError((res.error as any)?.detail || 'Error al restaurar respaldo');
    }
  }

  return (
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

      {marginSuccess && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 text-xs font-medium" aria-live="polite">
          {marginSuccess}
        </div>
      )}

      {marginError && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-300 text-xs font-medium" aria-live="assertive">
          {marginError}
        </div>
      )}

      {/* Role guidance */}
      {user.role === 'ADMIN' ? (
        <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Privilegio Exclusivo del Administrador</p>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
              Usted es la única entidad autorizada para modificar el margen corporativo. Toda modificación queda asentada automáticamente en los logs de auditoría.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-slate-900 dark:text-white">Sección Estática &mdash; Panel Comercial</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              El margen mínimo institucional y las credenciales empresariales solo pueden ser editadas desde el Portal de Administrador.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {user.role === 'ADMIN' ? (
          <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-4 col-span-full">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
              <div className="flex flex-col justify-between space-y-1.5">
                <label
                  htmlFor="min-margin-input"
                  className="text-xs font-extrabold text-indigo-950 dark:text-indigo-200 h-9 flex items-end leading-snug"
                >
                  MARGEN MÍNIMO CORPORATIVO (%)
                </label>
                <input
                  id="min-margin-input"
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
                <label
                  htmlFor="hard-floor-input"
                  className="text-xs font-extrabold text-amber-950 dark:text-amber-200 h-9 flex items-end leading-snug"
                >
                  PISO DURO DE MARGEN (%)
                </label>
                <input
                  id="hard-floor-input"
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
                <label
                  htmlFor="uf-rate-input"
                  className="text-xs font-extrabold text-cyan-950 dark:text-cyan-200 h-9 flex items-end leading-snug"
                >
                  VALOR UF DEL DÍA ($ CLP)
                </label>
                <input
                  id="uf-rate-input"
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
                type="button"
                onClick={handleUpdateCompanyMargin}
                disabled={savingMargin}
                className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors cursor-pointer shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                {savingMargin ? 'Guardando...' : 'Guardar Parámetros de Margen y UF'}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
              <div className="flex flex-col justify-between p-2.5 rounded-lg bg-white/60 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-xs text-slate-500 block">Margen Mínimo:</span>
                <span className="text-2xl font-bold font-mono text-indigo-700 dark:text-indigo-400 mt-1">
                  {company.minMarginPct.toFixed(2)}%
                </span>
              </div>
              <div className="flex flex-col justify-between p-2.5 rounded-lg bg-white/60 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-xs text-slate-500 block">Piso Duro:</span>
                <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                  {(company.hardMinMarginPct || 18).toFixed(2)}%
                </span>
              </div>
              <div className="flex flex-col justify-between p-2.5 rounded-lg bg-white/60 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-xs text-slate-500 block">Valor UF:</span>
                <span className="text-2xl font-bold font-mono text-cyan-600 dark:text-cyan-400 mt-1">
                  $ {(company.ufRate || 38500).toLocaleString('es-CL')}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="company-legal-name" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Razón Social</label>
          <input
            id="company-legal-name"
            type="text"
            disabled
            value={company.legalName}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-not-allowed"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="company-rut" className="text-xs font-semibold text-slate-700 dark:text-slate-300">RUT</label>
          <input
            id="company-rut"
            type="text"
            disabled
            value={company.rut || ''}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono cursor-not-allowed"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="company-currency" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Moneda / Impuesto</label>
          <input
            id="company-currency"
            type="text"
            disabled
            value={`${company.currency} - IVA ${company.taxRatePct}%`}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-not-allowed"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="company-timeout" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tiempo de Sesión</label>
          <input
            id="company-timeout"
            type="text"
            disabled
            value={`${company.sessionTimeoutMinutes} minutos`}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-not-allowed"
          />
        </div>
      </div>

      {/* Motivos de Pérdida */}
      {user.role === 'ADMIN' && (
        <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <h4 className="font-bold text-slate-900 dark:text-white text-sm">
            Motivos de Pérdida Formal
          </h4>
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
                    aria-label={`Eliminar motivo ${reason}`}
                    onClick={() => {
                      const next = configuredLossReasons.filter((r) => r !== reason);
                      handleSaveConfiguredLossReasons(next);
                    }}
                    className="text-slate-400 hover:text-rose-600 cursor-pointer text-[11px]"
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
              aria-label="Nuevo motivo de pérdida"
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
              + Añadir
            </button>
          </div>
        </div>
      )}

      {/* Probabilidades de Pipeline */}
      {user.role === 'ADMIN' && (
        <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">
              Probabilidades del Pipeline Ponderado
            </h4>
            <button
              type="button"
              onClick={handleSavePipelineProbabilities}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 cursor-pointer shadow-xs"
            >
              Guardar Probabilidades
            </button>
          </div>
          {probSuccess && (
            <div className="p-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium" aria-live="polite">
              {probSuccess}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {['DRAFT', 'SENT', 'VIEWED', 'CHANGES_REQUESTED'].map((st) => (
              <div key={st} className="space-y-1 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <label htmlFor={`prob-${st}`} className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                  {st === 'DRAFT' ? 'Borrador' : st === 'SENT' ? 'Enviada' : st === 'VIEWED' ? 'Vista' : 'Ajustes'}
                </label>
                <div className="flex items-center gap-1 font-mono font-bold">
                  <input
                    id={`prob-${st}`}
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

      {/* Backup & Restore */}
      {user.role === 'ADMIN' && (
        <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">
              Copia de Seguridad y Respaldo del Sistema
            </h4>
          </div>

          {restoreSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 text-xs font-medium" aria-live="polite">
              {restoreSuccess}
            </div>
          )}
          {restoreError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-300 text-xs font-medium" aria-live="assertive">
              {restoreError}
            </div>
          )}

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="space-y-0.5 text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                Instantánea Integral de Datos (.json)
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
                {backupLoading ? 'Generando...' : 'Descargar Backup'}
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

      {showRestoreModal && (
        <RestoreModal
          isOpen={showRestoreModal}
          onClose={() => {
            setShowRestoreModal(false);
            setPendingRestoreData(null);
          }}
          pendingData={pendingRestoreData}
          onConfirm={handleConfirmRestore}
          loading={restoreLoading}
          error={restoreError}
        />
      )}
    </div>
  );
}
