'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLanguage } from '@/components/language';

export type ThemeChoice = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'sv-team.theme.v1';
const ThemeContext = createContext({ choice: 'system' as ThemeChoice, setChoice: (_: ThemeChoice) => {} });

function isThemeChoice(value: string | null): value is ThemeChoice {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, updateChoice] = useState<ThemeChoice>('system');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (isThemeChoice(saved)) updateChoice(saved);
    } catch {}
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      document.documentElement.dataset.theme = choice === 'system' ? (media.matches ? 'dark' : 'light') : choice;
    };
    applyTheme();
    if (choice !== 'system') return;
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [choice]);

  useEffect(() => {
    const syncChoice = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) updateChoice(isThemeChoice(event.newValue) ? event.newValue : 'system');
    };
    window.addEventListener('storage', syncChoice);
    return () => window.removeEventListener('storage', syncChoice);
  }, []);

  const setChoice = (next: ThemeChoice) => {
    updateChoice(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  };

  return <ThemeContext.Provider value={{ choice, setChoice }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
