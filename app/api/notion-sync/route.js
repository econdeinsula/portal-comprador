import { after } from 'next/server'
import { sincronizar, apagarRegisto, sincronizarReclamacaoCompleta } from '../../../lib/notionSync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function autorizado(req) {
  const segredo = process.env.NOTION_SYNC_SECRET
  if (!segredo) return false
  const cabecalho = req.headers.get('x-sync-secret')
  const query = new URL(req.url).searchParams.get('segredo')
  return cabecalho === segredo || query === segredo
}

// Atualizações feitas pelo próprio sync (colunas notion_*) não devem disparar novo sync
const IGNORAR = new Set(['notion_page_id', 'notion_synced_at', 'notion_conteudo_ok', 'atualizado_em'])
function soMudouNotion(novo, antigo) {
  if (!novo || !antigo) return false
  return Object.keys(novo).every((k) => IGNORAR.has(k) || JSON.stringify(novo[k]) === JSON.stringify(antigo[k]))
}

// POST — chamado pelos Database Webhooks do Supabase (configurados no dia 5)
export async function POST(req) {
  if (!autorizado(req)) return Response.json({ erro: 'Sem permissão' }, { status: 401 })

  const corpo = await req.json().catch(() => null)
  if (!corpo?.table) return Response.json({ erro: 'Pedido inválido' }, { status: 400 })

  const { type, table, record, old_record } = corpo
  if (type === 'UPDATE' && soMudouNotion(record, old_record)) return Response.json({ ignorado: true })

  // Responde já ao Supabase e trabalha depois (o Supabase não espera mais de alguns segundos)
  after(async () => {
    try {
      if (type === 'DELETE') await apagarRegisto(table, old_record)
      else await sincronizar(table, record)
    } catch (e) {
      console.error('[notion-sync]', type, table, record?.id || old_record?.id, e)
    }
  })
  return Response.json({ recebido: true })
}

// GET — sync manual para testes:
//   /api/notion-sync?segredo=...&tabela=anomalias&id=<uuid>            → só a reclamação
//   /api/notion-sync?segredo=...&tabela=anomalias&id=<uuid>&tudo=1     → reclamação + mensagens + visitas
export async function GET(req) {
  if (!autorizado(req)) return Response.json({ erro: 'Sem permissão' }, { status: 401 })

  const p = new URL(req.url).searchParams
  const tabela = p.get('tabela')
  const id = p.get('id')
  if (!tabela || !id) return Response.json({ erro: 'Faltam os parâmetros tabela e id' }, { status: 400 })

  try {
    if (tabela === 'anomalias' && p.get('tudo')) {
      return Response.json({ ok: true, ...(await sincronizarReclamacaoCompleta(id)) })
    }
    const pageId = await sincronizar(tabela, { id })
    return Response.json({ ok: true, notion_page_id: pageId })
  } catch (e) {
    console.error('[notion-sync] GET', tabela, id, e)
    return Response.json({ ok: false, erro: e.message }, { status: 500 })
  }
}