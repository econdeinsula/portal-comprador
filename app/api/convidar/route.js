import { createClient } from '@supabase/supabase-js'

export async function POST(req) {
  const { email } = await req.json()

  if (!email) {
    return Response.json({ erro: 'Falta o email' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: 'https://portal-comprador.vercel.app/definir-password',
  })

  if (error) {
    return Response.json({ erro: error.message }, { status: 500 })
  }

  return Response.json({ sucesso: true })
}