import { supabase } from './supabaseClient'

export async function cabecalhoAuth() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

export async function avisar(tipo, anomaliaId) {
  try {
    const auth = await cabecalhoAuth()
    if (!auth.Authorization) return
    await fetch('/api/avisar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ tipo, anomaliaId }),
    })
  } catch {
    // o aviso por email é um extra -- uma falha aqui nunca deve travar o fluxo principal
  }
}