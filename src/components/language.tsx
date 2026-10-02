'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { translate, type Locale } from '@/lib/translations';
const languages: { code: Locale; name: string; flag: string }[] = [{ code: 'ru', name: 'Русский', flag: '🇷🇺' }, { code: 'kk', name: 'Қазақша', flag: '🇰🇿' }, { code: 'en', name: 'English', flag: '🇬🇧' }];
const LanguageContext = createContext({ locale: 'ru' as Locale, setLocale: (_: Locale) => {}, t: (text: string) => text });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState<Locale>('ru');
  useEffect(() => { try { const saved = localStorage.getItem('sv-team.locale.v1'); if (saved === 'ru' || saved === 'kk' || saved === 'en') updateLocale(saved); } catch {} }, []);
  useEffect(() => { document.documentElement.lang = locale; document.title = `SV Team — ${translate('Контрольные старты и результаты', locale)}`; }, [locale]);
  const setLocale = (next: Locale) => { updateLocale(next); try { localStorage.setItem('sv-team.locale.v1', next); } catch {} };
  return <LanguageContext.Provider value={{ locale, setLocale, t: text => translate(text, locale) }}>{children}</LanguageContext.Provider>;
}
export const useLanguage = () => useContext(LanguageContext);
export function LanguagePicker() {
  const { locale, setLocale, t } = useLanguage(); const selected = languages.find(l => l.code === locale)!;
  return <details className="language-picker"><summary aria-label={t('Язык')} title={t('Язык')}><span aria-hidden="true">{selected.flag}</span><span>{locale === 'kk' ? 'ҚАЗ' : locale.toUpperCase()}</span><span aria-hidden="true">⌄</span></summary><div className="language-options">{languages.map(l => <button type="button" key={l.code} lang={l.code} aria-pressed={locale === l.code} onClick={e => { setLocale(l.code); e.currentTarget.closest('details')?.removeAttribute('open'); }}><span aria-hidden="true">{l.flag}</span> {l.name}</button>)}</div></details>;
}
