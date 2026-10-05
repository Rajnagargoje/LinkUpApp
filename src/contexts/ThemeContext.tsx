import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type LinkUpTheme = 'light' | 'dark' | 'modern';
export type ThemePreference = LinkUpTheme | 'system';
interface ThemeContextValue { theme: LinkUpTheme; preference: ThemePreference; setTheme: (theme: ThemePreference) => void; }
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = 'linkup-theme';
const valid = (value: unknown): value is ThemePreference => ['light', 'dark', 'modern', 'system'].includes(value as string);
function readPreference(): ThemePreference {
  try { const stored = localStorage.getItem(STORAGE_KEY); return valid(stored) ? stored : 'system'; }
  catch { return 'system'; }
}
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const theme: LinkUpTheme = preference === 'system' ? systemDark ? 'dark' : 'light' : preference;
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const change = () => setSystemDark(media.matches);
    media.addEventListener('change', change);
    const storage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) setPreference(valid(event.newValue) ? event.newValue : 'system'); };
    window.addEventListener('storage', storage);
    return () => { media.removeEventListener('change', change); window.removeEventListener('storage', storage); };
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const setTheme = useCallback((next: ThemePreference) => {
    if (!valid(next)) return;
    setPreference(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Keep the selected theme for this session. */ }
  }, []);
  return <ThemeContext.Provider value={{ theme, preference, setTheme }}>{children}</ThemeContext.Provider>;
};
export const useLinkUpTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useLinkUpTheme must be used within a ThemeProvider');
  return context;
};
