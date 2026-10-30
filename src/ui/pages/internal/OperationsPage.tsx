import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Package, Wrench, ChevronLeft, ChevronRight } from 'lucide-react';
import { OperationOrder, User } from '../../../modules/types.ts';
import { OperationsGridSkeleton } from '../../components/Skeleton.tsx';
import { OperationsMilestonesModal } from '../../components/OperationsMilestonesModal.tsx';
import { useOperations } from '../../hooks/useOperations.ts';
import { InternalOutletContext } from '../../layouts/AppLayout.tsx';

const PAGE_SIZE = 16;

interface OperationsPageProps {
  user?: User;
}

export function OperationsPage(props: OperationsPageProps) {
  const context = (useOutletContext<InternalOutletContext>() || {}) as Partial<InternalOutletContext>;
  const user = props.user || context.user;
  const { operations, loading, error, refreshOperations, updateOperationInList } = useOperations();
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOpForMilestones, setSelectedOpForMilestones] = useState<OperationOrder | null>(null);

  if (!user || (loading && operations.length === 0)) {
    return <OperationsGridSkeleton />;
  }

  const completedCount = operations.filter((o) => o.status === 'COMPLETED').length;
  const productsCount = operations.filter((o) => o.type === 'PRODUCT_DELIVERY').length;
  const servicesCount = operations.filter((o) => o.type === 'SERVICE_EXECUTION').length;

  const totalPages = Math.max(1, Math.ceil(operations.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const paginatedOperations = operations.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs font-semibold" aria-live="polite">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Órdenes Totales
          </span>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono">
            {operations.length}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">En seguimiento operativo</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
            Entrega de Suministros
          </span>
          <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1 font-mono">
            {productsCount}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Guías de despacho navales</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
            Servicios de Ingeniería
          </span>
          <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-1 font-mono">
            {servicesCount}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Peritajes y planos</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
            Completadas
          </span>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
            {completedCount}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Con actas de recepción</p>
        </div>
      </div>

      {/* Header & Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
            Listado de Órdenes Operativas y Entregables
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Seguimiento de despachos físicos, servicios técnicos e hitos de ejecución
          </p>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 self-end sm:self-auto">
          Mostrando{' '}
          <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
            {operations.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, operations.length)}
          </span>{' '}
          de{' '}
          <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
            {operations.length}
          </span>{' '}
          órdenes
        </span>
      </div>

      {/* Orders Cards Grid */}
      {operations.length === 0 ? (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          No hay órdenes operativas activas. Se generan automáticamente al aceptar cotizaciones.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paginatedOperations.map((op) => (
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
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Avance calculado desde hitos:</span>
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
                    onClick={() => setSelectedOpForMilestones(op)}
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
                    <strong>Guía de Despacho:</strong> <span className="font-mono text-indigo-700 dark:text-indigo-400 font-bold">{op.guideNumber}</span>
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
      )}

      {/* Pagination Controls (16 per page) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <span className="text-slate-500 dark:text-slate-400">
          Página{' '}
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
            {safeCurrentPage}
          </span>{' '}
          de{' '}
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
            {totalPages}
          </span>{' '}
          <span className="text-slate-400 dark:text-slate-500">
            ({PAGE_SIZE} por página)
          </span>
        </span>

        <div className="flex items-center gap-1" role="navigation" aria-label="Paginación de órdenes de trabajo">
          <button
            type="button"
            onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
            disabled={safeCurrentPage <= 1}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors inline-flex items-center gap-1"
            aria-label="Página anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Anterior</span>
          </button>

          {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
            <button
              key={pageNum}
              type="button"
              onClick={() => setCurrentPage(pageNum)}
              aria-current={pageNum === safeCurrentPage ? 'page' : undefined}
              className={`min-w-[30px] h-[30px] px-2 rounded-lg font-mono font-bold text-xs transition-colors cursor-pointer ${
                pageNum === safeCurrentPage
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {pageNum}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))}
            disabled={safeCurrentPage >= totalPages}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors inline-flex items-center gap-1"
            aria-label="Página siguiente"
          >
            <span>Siguiente</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Milestones & Deliverables Modal */}
      <OperationsMilestonesModal
        isOpen={Boolean(selectedOpForMilestones)}
        operation={selectedOpForMilestones}
        onClose={() => setSelectedOpForMilestones(null)}
        onOperationUpdated={() => {
          refreshOperations();
        }}
      />
    </div>
  );
}

export default OperationsPage;
