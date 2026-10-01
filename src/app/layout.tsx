import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'SV Team — результаты клуба', description: 'Контрольные старты и результаты SV Team' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><body>{children}</body></html>;
}
