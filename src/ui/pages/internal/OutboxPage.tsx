import React, { useState } from 'react';
import { Mail, Phone, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { OutboxNotification } from '../../../modules/types.ts';
import { useOutbox } from '../../hooks/useOutbox.ts';
import { TableSkeleton } from '../../components/Skeleton.tsx';

const PAGE_SIZE = 30;

interface OutboxPageProps {
  notifications?: OutboxNotification[];
  loading?: boolean;
}

export function OutboxPage({ notifications: propNotifications, loading: propLoading }: OutboxPageProps) {
  const hookData = useOutbox();
  const notifications = propNotifications || hookData.notifications;
  const loading = propLoading !== undefined ? propLoading : hookData.loading;
  const { error, refreshOutbox } = hookData;
  const [currentPage, setCurrentPage] = useState(1);

  if (loading && notifications.length === 0) {
    return <TableSkeleton rows={6} cols={4} />;
  }

  const totalPages = Math.max(1, Math.ceil(notifications.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const paginatedNotifications = notifications.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-base">Bandeja de Salida (Outbox)</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Bandeja transaccional Outbox. Registra todos los correos electrónicos y mensajes de WhatsApp emitidos.
          </p>
        </div>
        <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Mostrando{' '}
            <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
              {notifications.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, notifications.length)}
            </span>{' '}
            de{' '}
            <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
              {notifications.length}
            </span>{' '}
            notificaciones
          </span>
          <button
            type="button"
            onClick={() => refreshOutbox()}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-300 text-xs font-medium" aria-live="assertive">
          {error}
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400 space-y-2">
          <Mail className="w-8 h-8 mx-auto text-slate-400" />
          <p className="font-semibold text-xs">No hay notificaciones en la bandeja de salida</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3">Canal</th>
                <th className="py-2.5 px-3">Destinatario</th>
                <th className="py-2.5 px-3">Mensaje / Asunto</th>
                <th className="py-2.5 px-2 text-center">Estado</th>
                <th className="py-2.5 px-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedNotifications.map((msg) => (
                <tr key={msg.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-2.5 px-3 font-semibold">
                    {msg.channel === 'WHATSAPP' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                        <Phone className="w-3.5 h-3.5" /> WhatsApp
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-indigo-700 dark:text-indigo-400 font-bold">
                        <Mail className="w-3.5 h-3.5" /> Email
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block">{msg.recipientName}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{msg.recipient}</span>
                  </td>
                  <td className="py-2.5 px-3 max-w-sm truncate text-slate-600 dark:text-slate-300">
                    {msg.subject ? <strong>{msg.subject}: </strong> : null}
                    {msg.body}
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                      {msg.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {msg.channel === 'WHATSAPP' && msg.recipient && (
                      <a
                        href={`https://wa.me/${msg.recipient.replace(/\D/g, '')}?text=${encodeURIComponent(
                          msg.body
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold text-[11px] hover:bg-emerald-700 cursor-pointer shadow-xs"
                      >
                        Abrir en WhatsApp &rarr;
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls (30 per page) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
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

        <div className="flex items-center gap-1" role="navigation" aria-label="Paginación de bandeja de salida">
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
  );
}
