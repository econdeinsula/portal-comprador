import { createClient } from '@supabase/supabase-js'

const SITE = process.env.SITE_URL || 'https://portal-comprador.vercel.app'

export async function POST(req) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !chave) {
      return Response.json({ erro: 'Faltam as variáveis do Supabase na Vercel' }, { status: 500 })
    }
    const admin = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } })

    // só um membro da equipa com sessão pode convidar
    const cabecalho = req.headers.get('authorization') || ''
    const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : null
    if (!token) return Response.json({ erro: 'Sem sessão válida' }, { status: 401 })

    const { data: dados, error: erroUser } = await admin.auth.getUser(token)
    const emailChamador = dados?.user?.email?.toLowerCase()
    if (erroUser || !emailChamador) return Response.json({ erro: 'Sem sessão válida' }, { status: 401 })

    const { data: membro } = await admin
      .from('membros_equipa').select('email').eq('email', emailChamador).maybeSingle()
    if (!membro) return Response.json({ erro: 'Sem permissão' }, { status: 403 })

    const { email } = await req.json()
    if (!email) return Response.json({ erro: 'Falta o email' }, { status: 400 })

    const { error } = await admin.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
      redirectTo: `${SITE}/definir-password`,
    })
    if (error) return Response.json({ erro: error.message }, { status: 500 })

    return Response.json({ sucesso: true })
  } catch (e) {
    return Response.json({ erro: 'Erro inesperado: ' + e.message }, { status: 500 })
  }
}