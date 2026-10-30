import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  Layers,
  Settings,
  Mail,
  Receipt,
  Truck,
  UserCheck,
  History,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { User as UserType, CompanySettings, Customer } from '../../modules/types.ts';
import { hasPermission } from '../../shared-kernel/permissions.ts';
import { SidebarBottomActions } from '../theme.tsx';
import { useCompany } from '../hooks/useCompany.ts';
import { useCustomers } from '../hooks/useCustomers.ts';

export interface InternalOutletContext {
  user: UserType;
  company: CompanySettings | null;
  setCompany: (c: CompanySettings) => void;
  customers: Customer[];
  refreshCustomers: () => void;
  onOpenPublicLink: (token: string) => void;
  onSwitchUser?: (email: string) => void;
  onRefreshRelatedData?: () => void;
}

interface AppLayoutProps {
  user: UserType;
  onLogout: () => void;
  onOpenPublicLink?: (token: string) => void;
  onSwitchUser?: (email: string) => void;
  isDemoMode?: boolean;
}

export function AppLayout({
  user,
  onLogout,
  onOpenPublicLink = () => {},
  onSwitchUser,
  isDemoMode = false,
}: AppLayoutProps) {
  // Si el usuario es un cliente, nunca debe renderizar el layout interno del staff; redirigir al portal
  if (user.role === 'CUSTOMER_CONTACT') {
    return <Navigate to="/portal/dashboard" replace />;
  }

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const { company, setCompany, refreshCompany } = useCompany();
  const { customers, refreshCustomers } = useCustomers();

  const handleRefreshRelatedData = () => {
    refreshCompany();
    refreshCustomers();
  };

  const outletContext: InternalOutletContext = {
    user,
    company,
    setCompany,
    customers,
    refreshCustomers,
    onOpenPublicLink,
    onSwitchUser,
    onRefreshRelatedData: handleRefreshRelatedData,
  };

  const navItems = [
    {
      to: '/app/dashboard',
      label: 'Panel General',
      icon: LayoutDashboard,
      permission: 'dashboard:own' as const,
    },
    {
      to: '/app/quotations',
      label: 'Cotizaciones',
      icon: FileText,
      permission: 'quotations:read_own' as const,
    },
    {
      to: '/app/customers',
      label: 'Clientes',
      icon: Users,
      permission: 'customers:create' as const,
    },
    {
      to: '/app/catalog',
      label: 'Catálogo de Servicios',
      icon: Layers,
    },
    {
      to: '/app/invoices',
      label: 'Documentos de Cobro',
      icon: Receipt,
      permission: 'invoices:read_own' as const,
    },
    {
      to: '/app/operations',
      label: 'Órdenes de Trabajo',
      icon: Truck,
      permission: 'operations:read_own' as const,
    },
    {
      to: '/app/team',
      label: 'Equipo Comercial',
      icon: UserCheck,
      permission: 'users:manage' as const,
      adminOnly: true,
    },
    {
      to: '/app/audit',
      label: 'Auditoría',
      icon: History,
      permission: 'audit:read_own' as const,
    },
    {
      to: '/app/company',
      label: 'Empresa & Margen',
      icon: Settings,
      permission: 'company:read' as const,
    },
    {
      to: '/app/outbox',
      label: 'Bandeja Outbox',
      icon: Mail,
      permission: 'outbox:read_own' as const,
    },
  ];

  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly && user.role !== 'ADMIN') return false;
    if (item.permission && !hasPermission(user, item.permission)) return false;
    return true;
  });

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      {/* Skip link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none"
      >
        Saltar al contenido principal
      </a>

      {/* Demo mode banner */}
      {isDemoMode && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-800 dark:text-amber-200 px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 text-center shrink-0" role="status">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>Modo demostración: los datos no se guardan</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="shrink-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
              aria-expanded={mobileMenuOpen}
              aria-controls="app-sidebar"
              className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight">
                ML Ingeniería SpA
              </span>
              <span className="hidden sm:inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                Sistema de Cotización
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* User role info */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs text-left">
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                {(user?.name?.trim()?.charAt(0) || 'U').toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <span className="font-bold block leading-tight text-slate-800 dark:text-slate-200">
                  {user?.name || 'Usuario'}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  {user?.role === 'ADMIN' ? 'Administrador' : 'Comercial'}
                </span>
              </div>
            </div>

            {/* Quick Role / Portal Switcher */}
            {onSwitchUser && (
              <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-500 px-1 hidden md:inline">Portal:</span>
                <button
                  type="button"
                  onClick={() => onSwitchUser('admin@mlingenieria.cl')}
                  className={`px-2 py-0.5 rounded font-medium text-[11px] cursor-pointer transition-colors ${
                    user.role === 'ADMIN'
                      ? 'bg-indigo-600 text-white shadow-xs font-bold'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600'
                  }`}
                  title="Cambiar a Administrador (Victoria Villegas)"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchUser('smorales@mlingenieria.cl')}
                  className={`px-2 py-0.5 rounded font-medium text-[11px] cursor-pointer transition-colors ${
                    user.role === 'SALES_REP' && user.email === 'smorales@mlingenieria.cl'
                      ? 'bg-indigo-600 text-white shadow-xs font-bold'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600'
                  }`}
                  title="Cambiar a Asesor Comercial (Sebastián Morales)"
                >
                  Asesor
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchUser('mbarrientos@australsalmon.cl')}
                  className="px-2 py-0.5 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 font-medium text-[11px] cursor-pointer transition-colors"
                  title="Abrir Portal Cliente (Ing. Matías Barrientos)"
                >
                  Cliente
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Layout Body: Sidebar + Main Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sidebar for Desktop & Collapsible for Mobile */}
        <nav
          id="app-sidebar"
          aria-label="Menú principal de navegación"
          className={`
            fixed md:static inset-y-0 left-0 z-30
            w-64 md:w-60 md:h-full bg-white dark:bg-slate-900
            border-r border-slate-200 dark:border-slate-800
            flex flex-col justify-between p-4 overflow-hidden shrink-0 transition-transform duration-200 ease-in-out
            md:translate-x-0
            ${mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
          `}
        >
          <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
            <div className="md:hidden flex items-center justify-between pb-3 mb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-400">Navegación</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Cerrar menú"
                className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive: navActive }) => `
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold
                    transition-colors cursor-pointer
                    ${
                      navActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }
                  `}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}

            {/* Botón destacado "Chat IA" al final tras Bandeja Outbox (sin funcionalidad) */}
            <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 shadow-md shadow-indigo-500/25 border border-purple-400/30 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                <span>Chat IA</span>
              </button>
            </div>
          </div>

          {/* Botones inferiores compartidos entre los tres portales */}
          <SidebarBottomActions onLogout={onLogout} />
        </nav>

        {/* Mobile backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-20 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Main Content View */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 p-4 md:p-6 overflow-y-auto min-w-0 min-h-0 focus:outline-none"
        >
          <Outlet context={outletContext} />
        </main>
      </div>
    </div>
  );
}
