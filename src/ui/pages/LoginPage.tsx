import React, { useState } from 'react';
import {
  User,
  Lock,
  ArrowRight,
  ExternalLink,
  AlertTriangle,
  ShieldCheck,
  Briefcase,
  Building2,
  Sparkles,
} from 'lucide-react';
import { ThemeSelector } from '../theme.tsx';

interface LoginPageProps {
  onLogin: (email: string, password?: string) => Promise<void>;
  onMagicLogin?: (token: string) => Promise<void>;
  isDemoMode?: boolean;
  loginError?: string | null;
  loading?: boolean;
}

interface DemoAccount {
  role: 'ADMIN' | 'SALES_REP' | 'CUSTOMER_CONTACT';
  roleLabel: string;
  name: string;
  desc: string;
  email: string;
  password: string;
  icon: React.ElementType;
  iconColor: string;
  badgeClass: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: 'ADMIN',
    roleLabel: 'Admin / Gerencia',
    name: 'Victoria Villegas C.',
    desc: 'Gerente General & Ingeniera Naval',
    email: 'admin@mlingenieria.cl',
    password: 'admin123',
    icon: ShieldCheck,
    iconColor: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800',
    badgeClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700/60',
  },
  {
    role: 'SALES_REP',
    roleLabel: 'Asesor Comercial',
    name: 'Sebastián Morales',
    desc: 'Ingeniero Naval de Proyectos',
    email: 'smorales@mlingenieria.cl',
    password: 'admin123',
    icon: Briefcase,
    iconColor: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800',
    badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300 border-sky-200 dark:border-sky-700/60',
  },
  {
    role: 'CUSTOMER_CONTACT',
    roleLabel: 'Portal Cliente',
    name: 'Ing. Matías Barrientos',
    desc: 'Flota Austral Salmon S.A.',
    email: 'mbarrientos@australsalmon.cl',
    password: 'admin123',
    icon: Building2,
    iconColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/60',
  },
];

export function LoginPage({
  onLogin,
  onMagicLogin,
  isDemoMode = false,
  loginError = null,
  loading = false,
}: LoginPageProps) {
  const [emailInput, setEmailInput] = useState<string>('admin@mlingenieria.cl');
  const [passwordInput, setPasswordInput] = useState<string>('admin123');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onLogin(emailInput, passwordInput);
  }

  function handleQuickAccess(email: string, password: string) {
    setEmailInput(email);
    setPasswordInput(password);
    onLogin(email, password);
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors">
      {isDemoMode && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-800 dark:text-amber-200 px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 text-center" role="status">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>Modo demostración: los datos no se guardan</span>
        </div>
      )}

      <div className="p-4 sm:p-6 lg:p-8 flex-1 flex flex-col justify-between">
        {/* Top Brand Bar */}
        <header className="max-w-6xl mx-auto w-full flex items-center justify-between pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-extrabold text-white text-lg shadow-lg">
              C
            </div>
            <div>
              <span className="font-extrabold text-lg text-slate-900 dark:text-white tracking-tight block">
                Cotizador Online
              </span>
              <span className="text-xs text-slate-600 dark:text-indigo-300">
                Plataforma de Ingeniería y Servicios Marítimos &bull; Chile
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeSelector />

            <a
              href="/api-docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3 py-1.5 rounded-xl shadow-xs"
            >
              <span>Swagger API</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </header>

        {/* Main Login Card */}
        <div className="max-w-md mx-auto w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto transition-colors">
          <div className="p-8 space-y-6">
            <div className="text-center space-y-1.5">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Iniciar Sesión</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Acceso unificado para ingenieros de proyectos, gerencia y clientes.
              </p>
            </div>

            {loginError && (
              <div
                className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-xs font-semibold"
                aria-live="assertive"
                role="alert"
              >
                {loginError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="login-email" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Email Corporativo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="ej. smorales@mlingenieria.cl"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="login-password" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    id="login-password"
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
              >
                {loading ? 'Accediendo...' : 'Ingresar al Sistema'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Bloque de Cuentas Demo (Acceso Rápido con Cuentas Demo) */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Acceso Rápido con Cuentas Demo
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  1-clic
                </span>
              </div>

              <div className="space-y-2" aria-label="Cuentas demo para acceso rápido">
                {DEMO_ACCOUNTS.map((account) => {
                  const Icon = account.icon;
                  return (
                    <button
                      key={account.email}
                      type="button"
                      disabled={loading}
                      onClick={() => handleQuickAccess(account.email, account.password)}
                      className="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-indigo-50/70 dark:bg-slate-800/60 dark:hover:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/60 transition-all group cursor-pointer flex items-center justify-between shadow-2xs disabled:opacity-50"
                      title={`Ingresar como ${account.name} (${account.roleLabel})`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${account.iconColor}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                              {account.name}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border shrink-0 ${account.badgeClass}`}>
                              {account.roleLabel}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                            <span>{account.email}</span>
                            <span>&bull;</span>
                            <span className="font-mono text-slate-400 dark:text-slate-500 text-[10px]">{account.password}</span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors pl-2">
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <footer className="text-center text-xs text-slate-500 py-4">
          M&L Ingeniería Naval SpA &bull; Servicios de Ingeniería, Peritajes DIRECTEMAR y Suministros Técnicos &bull; Chile
        </footer>
      </div>
    </div>
  );
}
