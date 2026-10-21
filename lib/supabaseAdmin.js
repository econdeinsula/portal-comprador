import { createClient } from '@supabase/supabase-js'

// Cliente Supabase com a service role — SÓ para usar em rotas de servidor (app/api/...)
let cliente = null

export function supabaseAdmin() {
  if (cliente) return cliente
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) throw new Error('Faltam as variáveis do Supabase na Vercel')
  cliente = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } })
  return cliente
}