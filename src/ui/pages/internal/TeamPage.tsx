import React, { useState } from 'react';
import { Navigate, useOutletContext } from 'react-router-dom';
import { UserPlus, ShieldCheck, UserCheck, UserX, Pencil, Trash2, ArrowRightLeft } from 'lucide-react';
import { User, Customer } from '../../../modules/types.ts';
import { hasPermission } from '../../../shared-kernel/permissions.ts';
import { TableSkeleton } from '../../components/Skeleton.tsx';
import { UserModal } from '../../modals/UserModal.tsx';
import { useTeam } from '../../hooks/useTeam.ts';
import { api } from '../../api.ts';
import { InternalOutletContext } from '../../layouts/AppLayout.tsx';

interface TeamPageProps {
  user?: User;
  customers?: Customer[];
  onSwitchUser?: (email: string) => void;
}

export function TeamPage(props: TeamPageProps) {
  const context = (useOutletContext<InternalOutletContext>() || {}) as Partial<InternalOutletContext>;
  const user = props.user || context.user;
  const customers = props.customers || context.customers || [];
  const onSwitchUser = props.onSwitchUser || context.onSwitchUser;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = user.role === 'ADMIN' || hasPermission(user, 'users:manage');

  // Authorization check: Sales rep navigating here must be redirected to /app/dashboard
  if (!isAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  const { users, loading, error, refreshUsers, updateUserInList, addUserToList, removeUserFromList } = useTeam(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  async function handleToggleAccess(advisor: User) {
    const nextActive = !advisor.active;
    const res = await api.patch<User>(`/api/v1/users/${advisor.id}`, { active: nextActive });
    if (res.data) {
      updateUserInList(res.data);
    } else {
      alert((res.error as any)?.detail || 'Error al cambiar estado de acceso');
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!window.confirm('¿Confirma eliminar este asesor del equipo comercial?')) return;
    const res = await api.delete(`/api/v1/users/${userId}`);
    if (res.status === 200 || res.status === 204) {
      removeUserFromList(userId);
    } else {
      alert((res.error as any)?.detail || 'Error al eliminar usuario');
    }
  }

  if (loading && users.length === 0) {
    return <TableSkeleton rows={5} cols={5} />;
  }

  const advisors = users.filter((u) => u.role === 'SALES_REP');

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs font-semibold" aria-live="polite">
          {error}
        </div>
      )}

      {/* Top Info Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-extrabold text-sm text-slate-900 dark:text-white">
              Gestión y Asignación del Equipo Comercial
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 flex items-center gap-1 shrink-0">
              <ShieldCheck className="w-3 h-3" /> Control del Administrador
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Asigne a los asesores comerciales que operan en la empresa y tendrán acceso al Panel Comercial para cotizar y atender clientes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedUser(null);
            setModalOpen(true);
          }}
          className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Asignar Nuevo Asesor</span>
        </button>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Total Asesores Comerciales
          </span>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono">
            {advisors.length}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Asignados al equipo de ventas</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/30 shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
            Acceso Comercial Activo
          </span>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
            {advisors.filter((u) => u.active).length}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Pueden ingresar al panel comercial</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/30 shadow-xs">
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
            Accesos Suspendidos
          </span>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 font-mono">
            {advisors.filter((u) => !u.active).length}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Inhabilitados temporalmente</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h4 className="font-bold text-slate-900 dark:text-white text-sm">
            Asesores con Acceso al Panel Comercial
          </h4>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Cada asesor asignado puede cotizar y atender a sus clientes
          </span>
        </div>

        {advisors.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
            No hay asesores comerciales registrados actualmente.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Asesor Comercial</th>
                  <th className="py-2.5 px-3">Correo / Usuario Acceso</th>
                  <th className="py-2.5 px-3">Teléfono / WhatsApp</th>
                  <th className="py-2.5 px-3 text-center">Clientes Asignados</th>
                  <th className="py-2.5 px-3 text-center">Acceso al Panel</th>
                  <th className="py-2.5 px-3 text-center w-48">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {advisors.map((advisor) => {
                  const assignedCount = customers.filter((c) => c.salesRepId === advisor.id).length;
                  return (
                    <tr key={advisor.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center">
                            {advisor.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white block">
                              {advisor.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">ID: {advisor.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300 font-medium">
                        {advisor.email}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-mono">
                        {advisor.phone || 'No registrado'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {assignedCount} clientes
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleAccess(advisor)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-all border ${
                            advisor.active
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 hover:bg-rose-100'
                          }`}
                        >
                          {advisor.active ? (
                            <>
                              <UserCheck className="w-3 h-3 text-emerald-600" />
                              <span>Habilitado</span>
                            </>
                          ) : (
                            <>
                              <UserX className="w-3 h-3 text-rose-600" />
                              <span>Suspendido</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {onSwitchUser && (
                            <button
                              type="button"
                              onClick={() => onSwitchUser(advisor.email)}
                              className="px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 cursor-pointer shadow-xs transition-colors flex items-center gap-1 text-[11px] font-bold"
                              title={`Probar Panel Comercial como ${advisor.name}`}
                              aria-label={`Simular ingreso como ${advisor.name}`}
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                              <span className="hidden sm:inline">Probar</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(advisor);
                              setModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer shadow-xs transition-colors"
                            title="Editar datos del asesor"
                            aria-label={`Editar ${advisor.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(advisor.id)}
                            className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-800/60 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer shadow-xs transition-colors"
                            title="Eliminar asesor del equipo"
                            aria-label={`Eliminar ${advisor.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Modal */}
      <UserModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        user={selectedUser}
        onSave={async (userData) => {
          if (selectedUser) {
            const res = await api.put<User>(`/api/v1/users/${selectedUser.id}`, userData);
            if (res.data) {
              updateUserInList(res.data);
              return { success: true };
            }
            return { success: false, error: (res.error as any)?.detail || 'Error al actualizar asesor' };
          } else {
            const res = await api.post<User>('/api/v1/users', userData);
            if (res.data) {
              addUserToList(res.data);
              return { success: true };
            }
            return { success: false, error: (res.error as any)?.detail || 'Error al crear asesor' };
          }
        }}
        onDelete={(uid) => handleDeleteUser(uid)}
      />
    </div>
  );
}

export default TeamPage;
