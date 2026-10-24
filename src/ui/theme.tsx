import React, { createContext, useContext, useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type EffectiveTheme = 'light' | 'dark';

interface ThemeContextType {
  themeMode: ThemeMode;
  effectiveTheme: EffectiveTheme;
  setThemeMode: (mode: ThemeMode) => void;
  // Backward compatibility aliases
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'system',
  effectiveTheme: 'light',
  setThemeMode: () => {},
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cotizador_theme_mode');
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    }
    return 'system';
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Listen to OS system theme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };

    try {
      mediaQuery.addEventListener('change', handleChange);
    } catch {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      try {
        mediaQuery.removeEventListener('change', handleChange);
      } catch {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  const effectiveTheme: EffectiveTheme =
    themeMode === 'system' ? (systemIsDark ? 'dark' : 'light') : themeMode;

  // Apply class and color-scheme to document root
  useEffect(() => {
    const root = document.documentElement;
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
  }, [effectiveTheme]);

  const setThemeMode = (newMode: ThemeMode) => {
    setThemeModeState(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cotizador_theme_mode', newMode);
    }
  };

  const toggleTheme = () => {
    setThemeMode(effectiveTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        effectiveTheme,
        setThemeMode,
        setTheme: setThemeMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Selector de tema visual (Claro / Oscuro) con respuesta automática
 * a la preferencia del sistema operativo si no se ha fijado una selección manual.
 */
export function ThemeSelector({ className = '' }: { className?: string }) {
  const { effectiveTheme, setThemeMode } = useTheme();

  return (
    <div
      role="group"
      aria-label="Selector de tema visual"
      className={`inline-flex items-center rounded-xl p-1 bg-slate-200/90 dark:bg-slate-800/95 border border-slate-300 dark:border-slate-700 text-xs shadow-xs transition-colors ${className}`}
    >
      <button
        type="button"
        onClick={() => setThemeMode('light')}
        aria-pressed={effectiveTheme === 'light'}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
          effectiveTheme === 'light'
            ? 'bg-white text-amber-600 shadow-sm font-bold ring-1 ring-slate-200 dark:ring-slate-700'
            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
        }`}
        title="Tema Claro"
      >
        <Sun className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Claro</span>
      </button>

      <button
        type="button"
        onClick={() => setThemeMode('dark')}
        aria-pressed={effectiveTheme === 'dark'}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
          effectiveTheme === 'dark'
            ? 'bg-indigo-600 text-white shadow-sm font-bold ring-1 ring-indigo-500'
            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
        }`}
        title="Tema Oscuro"
      >
        <Moon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Oscuro</span>
      </button>
    </div>
  );
}
