import React from 'react';
import { Mail, Phone, RefreshCw } from 'lucide-react';
import { OutboxNotification } from '../../../modules/types.ts';
import { useOutbox } from '../../hooks/useOutbox.ts';
import { TableSkeleton } from '../../components/Skeleton.tsx';

interface OutboxPageProps {
  notifications?: OutboxNotification[];
  loading?: boolean;
}

export function OutboxPage({ notifications: propNotifications, loading: propLoading }: OutboxPageProps) {
  const hookData = useOutbox();
  const notifications = propNotifications || hookData.notifications;
  const loading = propLoading !== undefined ? propLoading : hookData.loading;
  const { error, refreshOutbox } = hookData;

  if (loading && notifications.length === 0) {
    return <TableSkeleton rows={6} cols={4} />;
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-base">Bandeja de Salida (Outbox)</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Bandeja transaccional Outbox. Registra todos los correos electrónicos y mensajes de WhatsApp emitidos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refreshOutbox()}
          className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Actualizar</span>
        </button>
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
              {notifications.map((msg) => (
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
    </div>
  );
}
