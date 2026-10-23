import { after } from 'next/server'
import { repararPendentes, atualizarGarantias, recalcularMetricas } from '../../../lib/notionCron'
import { gerarResumoDiario, gerarRelatorioSemanal, gerarPontoDeSituacao, gerarEstatisticas } from '../../../lib/notionRelatorios'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function autorizado(req) {
  const segredo = process.env.NOTION_SYNC_SECRET
  if (!segredo) return false
  const cabecalho = req.headers.get('x-sync-secret')
  const query = new URL(req.url).searchParams.get('segredo')
  return cabecalho === segredo || query === segredo
}

const MODOS = {
  reparar: repararPendentes,
  diario: atualizarGarantias,
  resumo: gerarResumoDiario,
  semanal: gerarRelatorioSemanal,
  situacao: gerarPontoDeSituacao,
  estatisticas: gerarEstatisticas,
  metricas: recalcularMetricas,
}
const correr = (modo) => {
  const f = MODOS[modo]
  if (!f) throw new Error(`Modo desconhecido: ${modo}`)
  return f()
}

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
//   /api/notion-cron?segredo=...&modo=resumo
//   /api/notion-cron?segredo=...&modo=semanal
//   /api/notion-cron?segredo=...&modo=situacao
//   /api/notion-cron?segredo=...&modo=estatisticas
//   /api/notion-cron?segredo=...&modo=metricas   (passagem única)
export async function GET(req) {
  if (!autorizado(req)) return Response.json({ erro: 'Sem permissão' }, { status: 401 })
  const modo = new URL(req.url).searchParams.get('modo') || 'reparar'
  try {
    return Response.json({ ok: true, modo, ...(await correr(modo)) })
  } catch (e) {
    return Response.json({ ok: false, erro: e.message }, { status: 500 })
  }
}