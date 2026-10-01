import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Client-rendered portal: Supabase persists/refreshes the browser session.
// Every request uses the signed-in user's token and database RLS; no secret key.
export function browserDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Подключение к приложению ещё не настроено.');
  return createClient<Database>(url, key);
}
