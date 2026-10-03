'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLanguage } from '@/components/language';

type ThemeChoice = 'system' | 'light' | 'dark';

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

export function ThemePicker() {
  const { choice, setChoice } = useContext(ThemeContext);
  const { t } = useLanguage();
  const choices: { value: ThemeChoice; label: string; icon: string }[] = [
    { value: 'system', label: t('Как в системе'), icon: '◐' },
    { value: 'light', label: t('Светлая'), icon: '☀' },
    { value: 'dark', label: t('Тёмная'), icon: '☾' },
  ];
  const icon = choices.find(item => item.value === choice)?.icon ?? '◐';

  return <details className="theme-picker">
    <summary aria-label={t('Тема оформления')} title={t('Тема оформления')}><span aria-hidden="true">{icon}</span></summary>
    <div className="language-options theme-options">
      {choices.map(item => <button type="button" key={item.value} aria-pressed={choice === item.value} onClick={event => {
        setChoice(item.value);
        event.currentTarget.closest('details')?.removeAttribute('open');
      }}><span aria-hidden="true">{item.icon}</span> {item.label}</button>)}
    </div>
  </details>;
}
