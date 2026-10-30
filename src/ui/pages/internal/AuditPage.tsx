import React, { useState } from 'react';
import {
  History,
  FileDown,
  RefreshCw,
  Filter,
  Search,
  Layers,
  Building,
  Users,
  DollarSign,
  UserCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AuditLog } from '../../../modules/types.ts';
import { useAudit } from '../../hooks/useAudit.ts';
import { TableSkeleton } from '../../components/Skeleton.tsx';

const PAGE_SIZE = 30;

interface AuditPageProps {
  logs?: AuditLog[];
  loading?: boolean;
}

export function AuditPage({ logs: propLogs, loading: propLoading }: AuditPageProps) {
  const hookData = useAudit();
  const logs = propLogs || hookData.logs;
  const loading = propLoading !== undefined ? propLoading : hookData.loading;
  const { error, refreshLogs } = hookData;

  const [auditEntityFilter, setAuditEntityFilter] = useState<string>('ALL');
  const [auditRoleFilter, setAuditRoleFilter] = useState<string>('ALL');
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [exportingCsv, setExportingCsv] = useState<boolean>(false);

  function handleExportCsv() {
    setExportingCsv(true);
    try {
      const filtered = logs.filter((log) => {
        if (auditEntityFilter !== 'ALL' && log.entity !== auditEntityFilter) return false;
        if (auditRoleFilter !== 'ALL' && log.actorRole !== auditRoleFilter) return false;
        if (!auditSearch.trim()) return true;
        const q = auditSearch.toLowerCase();
        return (
          (log.description || '').toLowerCase().includes(q) ||
          (log.entityName || log.entityId || '').toLowerCase().includes(q) ||
          (log.actorName || '').toLowerCase().includes(q)
        );
      });

      const headers = ['Fecha', 'Actor', 'Rol', 'Ámbito', 'Acción', 'Descripción', 'Elemento'];
      const rows = filtered.map((l) => [
        l.timestamp ? new Date(l.timestamp).toISOString() : '',
        `"${(l.actorName || '').replace(/"/g, '""')}"`,
        l.actorRole,
        l.entity,
        l.action,
        `"${(l.description || '').replace(/"/g, '""')}"`,
        `"${(l.entityName || l.entityId || '').replace(/"/g, '""')}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExportingCsv(false);
    }
  }

  if (loading && logs.length === 0) {
    return <TableSkeleton rows={8} cols={5} />;
  }

  const filteredLogs = logs.filter((log) => {
    if (auditEntityFilter !== 'ALL' && log.entity !== auditEntityFilter) return false;
    if (auditRoleFilter !== 'ALL' && log.actorRole !== auditRoleFilter) return false;
    if (!auditSearch.trim()) return true;
    const q = auditSearch.toLowerCase();
    return (
      (log.description || '').toLowerCase().includes(q) ||
      (log.entityName || log.entityId || '').toLowerCase().includes(q) ||
      (log.actorName || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
              Registro de Auditoría y Trazabilidad de Decisiones Compartidas
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800/50 flex items-center gap-1 font-mono shrink-0">
              <History className="w-3 h-3" /> Transparencia Total
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Bitácora viva de todas las decisiones en Catálogo, Clientes, Contactos, Políticas de Margen y Equipo Comercial.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0 disabled:opacity-50"
          >
            <FileDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{exportingCsv ? 'Exportando...' : 'Exportar a CSV (.csv)'}</span>
          </button>

          <button
            type="button"
            onClick={() => refreshLogs()}
            disabled={loading}
            className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''} shrink-0`} />
            <span>Actualizar Logs</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-300 text-xs font-medium" aria-live="assertive">
          {error}
        </div>
      )}

      {/* Filter and Search */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Entity Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Ámbito:
            </span>
            {[
              { key: 'ALL', label: 'Todos' },
              { key: 'CATALOG', label: 'Catálogo' },
              { key: 'CUSTOMERS', label: 'Clientes' },
              { key: 'CONTACTS', label: 'Contactos' },
              { key: 'COMPANY', label: 'Empresa & Margen' },
              { key: 'USERS', label: 'Equipo Comercial' },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setAuditEntityFilter(f.key);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  auditEntityFilter === f.key
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Role Filters */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">
              Actor:
            </span>
            {[
              { key: 'ALL', label: 'Todos' },
              { key: 'ADMIN', label: 'Administrador' },
              { key: 'SALES_REP', label: 'Comercial' },
            ].map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => {
                  setAuditRoleFilter(r.key);
                  setCurrentPage(1);
                }}
                className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
                  auditRoleFilter === r.key
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search inside logs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Buscar en registros de auditoría"
              placeholder="Buscar por descripción, ítem, cliente o autor del cambio..."
              value={auditSearch}
              onChange={(e) => {
                setAuditSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 self-end sm:self-auto">
            Mostrando{' '}
            <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
              {filteredLogs.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, filteredLogs.length)}
            </span>{' '}
            de{' '}
            <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
              {filteredLogs.length}
            </span>{' '}
            registros
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 space-y-2">
            <History className="w-8 h-8 mx-auto text-slate-400" />
            <p className="font-semibold text-xs">No se encontraron registros de auditoría</p>
            <p className="text-[11px]">Intente ajustando los filtros o realice acciones para ver los eventos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Fecha y Hora</th>
                  <th className="py-2.5 px-3">Actor / Decisor</th>
                  <th className="py-2.5 px-3">Ámbito</th>
                  <th className="py-2.5 px-2 text-center">Acción</th>
                  <th className="py-2.5 px-3">Detalle de la Decisión / Modificación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap text-[11px]">
                      {log.timestamp
                        ? new Date(log.timestamp).toLocaleString('es-CL', {
                            month: 'short',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : '-'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            log.actorRole === 'ADMIN'
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
                              : log.actorRole === 'SALES_REP'
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50'
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                          }`}
                        >
                          {log.actorRole === 'ADMIN' ? 'Admin' : log.actorRole === 'SALES_REP' ? 'Comercial' : 'Cliente'}
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {log.actorName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-medium">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {log.entity === 'CATALOG' && <Layers className="w-3 h-3 text-purple-500" />}
                        {log.entity === 'CUSTOMERS' && <Building className="w-3 h-3 text-blue-500" />}
                        {log.entity === 'CONTACTS' && <Users className="w-3 h-3 text-emerald-500" />}
                        {log.entity === 'COMPANY' && <DollarSign className="w-3 h-3 text-amber-500" />}
                        {log.entity === 'USERS' && <UserCheck className="w-3 h-3 text-indigo-500" />}
                        {log.entity}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          log.action === 'CREATE'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                            : log.action === 'UPDATE'
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-medium">
                      <p>{log.description}</p>
                      {log.entityName && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          Elemento: {log.entityName}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls (30 per page) */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
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

          <div className="flex items-center gap-1" role="navigation" aria-label="Paginación de auditoría">
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
      </div>
    </div>
  );
}
