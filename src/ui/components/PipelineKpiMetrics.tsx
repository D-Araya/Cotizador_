import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api.ts';
import { formatMoney } from '../../shared-kernel/formatMoney.ts';
import { CompanySettings, User as UserType } from '../../modules/types.ts';

interface PipelineKpiMetricsProps {
  currentUser: UserType;
  company: CompanySettings | null;
  onCompanyUpdated?: () => void;
}

export function PipelineKpiMetrics({
  currentUser,
  company,
  onCompanyUpdated,
}: PipelineKpiMetricsProps) {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Configuración de probabilidades por estado (Solo ADMIN)
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [probDraft, setProbDraft] = useState<number>(10);
  const [probSent, setProbSent] = useState<number>(30);
  const [probViewed, setProbViewed] = useState<number>(50);
  const [probChanges, setProbChanges] = useState<number>(40);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<any>('/api/v1/dashboard/pipeline-metrics');
      if (res.data) {
        setMetrics(res.data);
        if (res.data.weightedPipeline?.probabilities) {
          setProbDraft(res.data.weightedPipeline.probabilities.DRAFT ?? 10);
          setProbSent(res.data.weightedPipeline.probabilities.SENT ?? 30);
          setProbViewed(res.data.weightedPipeline.probabilities.VIEWED ?? 50);
          setProbChanges(res.data.weightedPipeline.probabilities.CHANGES_REQUESTED ?? 40);
        }
      } else if (res.error) {
        setError(res.error.detail || 'Error al obtener métricas del pipeline');
      }
    } catch (err: any) {
      setError(err.message || 'Error al obtener métricas del pipeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const handleSaveProbabilities = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingConfig(true);
      const updatedProbabilities = {
        DRAFT: probDraft,
        SENT: probSent,
        VIEWED: probViewed,
        CHANGES_REQUESTED: probChanges,
        ACCEPTED: 100,
        REJECTED: 0,
        EXPIRED: 0,
      };

      await apiRequest('/api/v1/company', {
        method: 'PUT',
        body: JSON.stringify({
          pipelineProbabilities: updatedProbabilities,
        }),
      });

      setShowConfigModal(false);
      await fetchMetrics();
      if (onCompanyUpdated) onCompanyUpdated();
    } catch (err: any) {
      alert(err.message || 'Error al guardar probabilidades del pipeline');
    } finally {
      setSavingConfig(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
        Calculando KPIs y métricas del pipeline en el servidor...
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm">
        {error || 'No fue posible cargar las métricas.'}
      </div>
    );
  }

  const {
    closeRate,
    salesCycle,
    timeToFirstView,
    weightedPipeline,
    sentAge,
    acceptedMargin,
    wonLostByCategory,
    wonLostBySalesRep,
  } = metrics;

  return (
    <div className="space-y-6">
      {/* Barra Superior con botón para configurar ponderaciones */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800/80 p-5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>📊</span> Métricas de Pipeline & KPIs Comerciales
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Todos los indicadores son calculados íntegramente por el servidor según datos auditados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentUser.role === 'ADMIN' && (
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>⚙️</span> Configurar Ponderaciones
            </button>
          )}
          <button
            onClick={fetchMetrics}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-700/80 dark:hover:bg-cyan-600 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer shadow-xs"
          >
            <span>🔄</span> Refrescar
          </button>
        </div>
      </div>

      {/* Grid de los 6 KPIs principales con Definición Explícita en Pantalla */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* KPI 1: Tasa de Cierre */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              1. Tasa de Cierre
            </span>
            <span className="text-2xl">🎯</span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
            {closeRate.value}%
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            {closeRate.acceptedCount} aceptadas de {closeRate.decidedCount} decididas
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/40 -mx-5 -mb-5 p-3 rounded-b-xl">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Definición en pantalla:</span>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">{closeRate.definition}</p>
          </div>
        </div>

        {/* KPI 2: Ciclo de Venta */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
              2. Ciclo de Venta
            </span>
            <span className="text-2xl">⏱️</span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
            {salesCycle.avgDays} <span className="text-lg font-normal text-slate-500 dark:text-slate-400">días</span>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            Promedio sobre {salesCycle.decidedCount} cotizaciones con decisión
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/40 -mx-5 -mb-5 p-3 rounded-b-xl">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Definición en pantalla:</span>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">{salesCycle.definition}</p>
          </div>
        </div>

        {/* KPI 3: Tiempo hasta Primera Vista */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              3. Tiempo Primera Vista
            </span>
            <span className="text-2xl">👁️</span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
            {timeToFirstView.avgHours} <span className="text-lg font-normal text-slate-500 dark:text-slate-400">hrs</span>
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-2">({timeToFirstView.avgDays} días)</span>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            Registrado en {timeToFirstView.viewedCount} cotizaciones abiertas
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/40 -mx-5 -mb-5 p-3 rounded-b-xl">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Definición en pantalla:</span>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">{timeToFirstView.definition}</p>
          </div>
        </div>

        {/* KPI 4: Pipeline Ponderado */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              4. Pipeline Ponderado
            </span>
            <span className="text-2xl">💰</span>
          </div>
          <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-300 font-mono">
            {formatMoney(weightedPipeline.amount)}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            De un total neto de {formatMoney(weightedPipeline.totalPipelineNet)} ({weightedPipeline.activeQuotesCount} cotizaciones activas)
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/40 -mx-5 -mb-5 p-3 rounded-b-xl">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Definición en pantalla:</span>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">{weightedPipeline.definition}</p>
          </div>
        </div>

        {/* KPI 5: Antigüedad de las Enviadas */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              5. Antigüedad Enviadas
            </span>
            <span className="text-2xl">⏳</span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
            {sentAge.avgDays} <span className="text-lg font-normal text-slate-500 dark:text-slate-400">días</span>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            Promedio de {sentAge.pendingCount} cotizaciones en espera
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/40 -mx-5 -mb-5 p-3 rounded-b-xl">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Definición en pantalla:</span>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">{sentAge.definition}</p>
          </div>
        </div>

        {/* KPI 6: Margen Aceptado vs Mínimo */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              6. Margen Aceptado vs Mínimo
            </span>
            <span className="text-2xl">📈</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
              {acceptedMargin.avgMarginPct}%
            </span>
            <span className={`text-sm font-bold ${acceptedMargin.deltaPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              ({acceptedMargin.deltaPct >= 0 ? `+${acceptedMargin.deltaPct}` : acceptedMargin.deltaPct}% vs mín. {acceptedMargin.minMarginPct}%)
            </span>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            Margen comercial efectivo sobre ventas cerradas
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/40 -mx-5 -mb-5 p-3 rounded-b-xl">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Definición en pantalla:</span>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">{acceptedMargin.definition}</p>
          </div>
        </div>
      </div>

      {/* Tablas de Ganadas/Perdidas por Categoría y por Asesor (P2.i 7) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ganadas / Perdidas por Categoría */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 shadow-xs space-y-4">
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>🏷️</span> Ganadas / Perdidas por Categoría Técnica
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
              {wonLostByCategory.definition}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-2 text-center text-emerald-600 dark:text-emerald-400">Ganadas</th>
                  <th className="py-2.5 px-2 text-center text-rose-600 dark:text-rose-400">Perdidas</th>
                  <th className="py-2.5 px-3 text-right">Monto Ganado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {wonLostByCategory.items.map((cat: any) => (
                  <tr key={cat.categoryId} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">{cat.categoryName}</td>
                    <td className="py-2.5 px-2 text-center font-bold text-emerald-600 dark:text-emerald-400">{cat.wonCount}</td>
                    <td className="py-2.5 px-2 text-center font-bold text-rose-600 dark:text-rose-400">{cat.lostCount}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-slate-100 font-mono">{formatMoney(cat.wonAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ganadas / Perdidas por Asesor */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 shadow-xs space-y-4">
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>👤</span> Ganadas / Perdidas por Asesor
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
              {wonLostBySalesRep.definition}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Asesor</th>
                  <th className="py-2.5 px-2 text-center text-emerald-600 dark:text-emerald-400">Ganadas</th>
                  <th className="py-2.5 px-2 text-center text-rose-600 dark:text-rose-400">Perdidas</th>
                  <th className="py-2.5 px-2 text-center">Cierre</th>
                  <th className="py-2.5 px-3 text-right">Total Ganado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {wonLostBySalesRep.items.map((rep: any) => (
                  <tr key={rep.salesRepId} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">{rep.salesRepName}</td>
                    <td className="py-2.5 px-2 text-center font-bold text-emerald-600 dark:text-emerald-400">{rep.wonCount}</td>
                    <td className="py-2.5 px-2 text-center font-bold text-rose-600 dark:text-rose-400">{rep.lostCount}</td>
                    <td className="py-2.5 px-2 text-center font-semibold text-cyan-600 dark:text-cyan-400">{rep.closeRatePct}%</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-slate-100 font-mono">{formatMoney(rep.wonAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal para configurar probabilidades del pipeline (ADMIN) */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
              Probabilidades por Estado (ADMIN)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Configure el porcentaje de probabilidad de cierre utilizado para el cálculo del pipeline ponderado.
            </p>

            <form onSubmit={handleSaveProbabilities} className="space-y-4">
              <div>
                <label className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Borrador (DRAFT)</span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-mono">{probDraft}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={probDraft}
                  onChange={(e) => setProbDraft(Number(e.target.value))}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Enviada (SENT)</span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-mono">{probSent}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={probSent}
                  onChange={(e) => setProbSent(Number(e.target.value))}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Vista por Cliente (VIEWED)</span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-mono">{probViewed}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={probViewed}
                  onChange={(e) => setProbViewed(Number(e.target.value))}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Ajuste Solicitado (CHANGES_REQUESTED)</span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-mono">{probChanges}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={probChanges}
                  onChange={(e) => setProbChanges(Number(e.target.value))}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  disabled={savingConfig}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {savingConfig ? 'Guardando...' : 'Guardar Configuración'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
