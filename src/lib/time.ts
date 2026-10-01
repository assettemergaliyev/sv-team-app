export function maskTime(value: string, hours: boolean) {
  const digits = value.replace(/\D/g, '').slice(0, hours ? 8 : 6);
  const cuts = hours ? [2, 4, 6] : [2, 4];
  return [...digits].map((d, i) => (cuts.includes(i) ? (i === (hours ? 6 : 4) ? '.' : ':') : '') + d).join('');
}
export function parseTime(value: string): number | null {
  const m = /^(?:(\d{2}):)?(\d{2}):(\d{2})[.,](\d{2})$/.exec(value.trim());
  if (!m || +(m[1] ?? 0) > 23 || +m[2] > 59 || +m[3] > 59) return null;
  const t = ((+(m[1] ?? 0) * 3600) + +m[2] * 60 + +m[3]) * 100 + +m[4];
  return t > 0 ? t : null;
}
export function formatTime(cs: number | null) {
  if (cs === null) return '—';
  const h = Math.floor(cs / 360000);
  return (h ? String(h).padStart(2, '0') + ':' : '') + String(Math.floor(cs / 6000) % 60).padStart(2, '0') + ':' + String(Math.floor(cs / 100) % 60).padStart(2, '0') + '.' + String(cs % 100).padStart(2, '0');
}
export function attemptsLabel(n: number) {
  const a = n % 100, b = n % 10;
  return `${n} ${a >= 11 && a <= 14 ? 'попыток' : b === 1 ? 'попытка' : b >= 2 && b <= 4 ? 'попытки' : 'попыток'}`;
}
export function dateLabel(date: string) {
  const [y, m, d] = date.split('-');
  return `${d}.${m}.${y}`;
}
