import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Package, Wrench, CheckCircle2, Clock, DollarSign, XCircle, Send, Eye } from 'lucide-react';
import { User, CompanySettings } from '../../../modules/types.ts';
import { formatMoney } from '../../../shared-kernel/formatMoney.ts';
import { hasPermission } from '../../../shared-kernel/permissions.ts';
import { PipelineKpiMetrics } from '../../components/PipelineKpiMetrics.tsx';
import { KpiGridSkeleton, TableSkeleton } from '../../components/Skeleton.tsx';
import { useDashboard } from '../../hooks/useDashboard.ts';
import { InternalOutletContext } from '../../layouts/AppLayout.tsx';

interface DashboardPageProps {
  user?: User;
  company?: CompanySettings | null;
  onCompanyUpdated?: () => void;
}

export function DashboardPage(props: DashboardPageProps) {
  const context = (useOutletContext<InternalOutletContext>() || {}) as Partial<InternalOutletContext>;
  const user = props.user || context.user;
  const company = props.company !== undefined ? props.company : context.company;
  const onCompanyUpdated = props.onCompanyUpdated || context.onRefreshRelatedData;
  const [subView, setSubView] = useState<'general' | 'kpis'>('general');
  const { summary, salesReps, loading, error, refreshDashboard } = useDashboard();

  if (!user || (loading && !summary)) {
    return (
      <div className="space-y-6">
        <KpiGridSkeleton count={4} />
        <TableSkeleton rows={6} cols={6} />
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-sm flex items-center justify-between">
        <span>{error}</span>
        <button
          type="button"
          onClick={refreshDashboard}
          className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 cursor-pointer"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const s = summary || {
    totalAccepted: 0,
    acceptanceRate: 0,
    totalSent: 0,
    totalViewed: 0,
    totalAcceptedSales: 0,
    avgMargin: 0,
    totalRejected: 0,
    itemTypeBreakdown: null,
  };

  const itemTypeReport = (s as any).itemTypeBreakdown || (s as any).itemTypes;

  return (
    <div className="space-y-6">
      {/* Subview Switcher */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setSubView('general')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
            subView === 'general'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          📊 Resumen Ejecutivo
        </button>
        <button
          type="button"
          onClick={() => setSubView('kpis')}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
            subView === 'kpis'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          📈 Métricas & KPIs del Pipeline
        </button>
      </div>

      {subView === 'kpis' ? (
        <PipelineKpiMetrics
          currentUser={user}
          company={company || null}
          onCompanyUpdated={onCompanyUpdated || refreshDashboard}
        />
      ) : (
        <div className="space-y-8">
          {/* KPI Cards (Superiores) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-950 border border-emerald-500/40 dark:border-emerald-500/30 relative overflow-hidden shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Aceptadas
                </span>
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2 font-mono">
                {s.totalAccepted}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Tasa de éxito: {s.acceptanceRate}%
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-950 border border-amber-500/40 dark:border-amber-500/30 relative overflow-hidden shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  Enviadas
                </span>
                <Send className="w-5 h-5 text-amber-500 shrink-0" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2 font-mono">
                {s.totalSent ?? 0}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Esperando apertura
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-950 border border-sky-500/40 dark:border-sky-500/30 relative overflow-hidden shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                  Vistas
                </span>
                <Eye className="w-5 h-5 text-sky-500 shrink-0" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2 font-mono">
                {s.totalViewed ?? 0}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Abiertas por clientes
              </p>
            </div>

            {/* Rechazadas */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-950 border border-rose-500/40 dark:border-rose-500/30 relative overflow-hidden shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                  Rechazadas
                </span>
                <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2 font-mono">
                {(s as any).totalRejected ?? (s as any).rejected ?? 0}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Con posibilidad de re-cotizar
              </p>
            </div>
          </div>

          {/* Venta Aceptada (Ancho Completo) */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-950 border border-indigo-500/40 dark:border-indigo-500/30 relative overflow-hidden shadow-xs w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                <DollarSign className="w-6 h-6 text-indigo-500" />
              </div>
              <div>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  Venta Aceptada
                </span>
                <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono mt-0.5">
                  {formatMoney((s as any).totalAcceptedSales ?? (s as any).acceptedValue ?? 0)}
                </p>
              </div>
            </div>
            <div className="flex items-center sm:self-center">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                Margen prom: <strong className="font-bold font-mono">{(s as any).avgMargin ?? (s as any).avgMarginPct ?? 0}%</strong>
              </span>
            </div>
          </div>

          {/* Sales Rep Report */}
          {hasPermission(user, 'dashboard:by_sales_rep') && salesReps.length > 0 && (
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
                    {salesReps.map((sr) => (
                      <tr key={sr.salesRepId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                          {sr.name || (sr as any).salesRepName}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-slate-700 dark:text-slate-300">
                          {sr.totalQuotes ?? (sr as any).totalQuotations ?? 0}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {sr.accepted ?? (sr as any).acceptedQuotations ?? 0}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-rose-600 dark:text-rose-400">
                          {sr.rejected ?? 0}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-amber-600 dark:text-amber-400">
                          {((sr as any).viewed ?? 0) + ((sr as any).sent ?? 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {formatMoney(sr.totalSales ?? (sr as any).totalAmount ?? 0)}
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
  );
}

export default DashboardPage;
