import { createClient } from '@supabase/supabase-js'

// Lê credenciais do supabase-config.js do portal (window globals),
// com fallback para variáveis Vite em .env.local
const supabaseUrl = window.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL
const supabaseKey = window.SUPABASE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Credenciais Supabase não encontradas. ' +
    'Verifique se supabase-config.js está carregado ou se .env.local tem VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
})
