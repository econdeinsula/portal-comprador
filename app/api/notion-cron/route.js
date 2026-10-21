import { after } from 'next/server'
import { repararPendentes, atualizarGarantias } from '../../../lib/notionCron'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function autorizado(req) {
  const segredo = process.env.NOTION_SYNC_SECRET
  if (!segredo) return false
  const cabecalho = req.headers.get('x-sync-secret')
  const query = new URL(req.url).searchParams.get('segredo')
  return cabecalho === segredo || query === segredo
}

const correr = (modo) => (modo === 'diario' ? atualizarGarantias() : repararPendentes())

// POST — chamado pelo pg_cron do Supabase. Responde logo e trabalha depois.
export async function POST(req) {
  if (!autorizado(req)) return Response.json({ erro: 'Sem permissão' }, { status: 401 })
  const modo = new URL(req.url).searchParams.get('modo') || 'reparar'

  after(async () => {
    try {
      const r = await correr(modo)
      if (r?.erros?.length) console.error('[notion-cron]', modo, r)
    } catch (e) {
      console.error('[notion-cron]', modo, e)
    }
  })
  return Response.json({ recebido: true, modo })
}

// GET — para testar à mão e ver o resultado:
//   /api/notion-cron?segredo=...&modo=reparar
//   /api/notion-cron?segredo=...&modo=diario
export async function GET(req) {
  if (!autorizado(req)) return Response.json({ erro: 'Sem permissão' }, { status: 401 })
  const modo = new URL(req.url).searchParams.get('modo') || 'reparar'
  try {
    return Response.json({ ok: true, modo, ...(await correr(modo)) })
  } catch (e) {
    return Response.json({ ok: false, erro: e.message }, { status: 500 })
  }
}