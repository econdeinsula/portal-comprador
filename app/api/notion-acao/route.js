import { enviarResposta, mudarEstado, atualizarEmpresas, ErroAcao } from '../../../lib/notionAcoes'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function autorizado(req) {
  const segredo = process.env.NOTION_SYNC_SECRET
  if (!segredo) return false
  const cabecalho = req.headers.get('x-sync-secret')
  const query = new URL(req.url).searchParams.get('segredo')
  return cabecalho === segredo || query === segredo
}

const ACOES = {
  enviar: enviarResposta,
  estado: mudarEstado,
  empresas: atualizarEmpresas,
}

// Chamado pelos botões e automações do Notion ("Enviar webhook").
// O URL indica a ação: /api/notion-acao?acao=enviar | estado | empresas
export async function POST(req) {
  if (!autorizado(req)) return Response.json({ erro: 'Sem permissão' }, { status: 401 })

  const acao = new URL(req.url).searchParams.get('acao')
  const executar = ACOES[acao]
  if (!executar) return Response.json({ erro: `Ação desconhecida: ${acao}` }, { status: 400 })

  const corpo = await req.json().catch(() => null)
  const pageId = corpo?.data?.id

  try {
    const resultado = await executar(pageId)
    return Response.json({ ok: true, acao, ...resultado })
  } catch (e) {
    console.error('[notion-acao]', acao, pageId, e)
    // Erros de dados: 200 para o Notion não repetir. Erros técnicos: 500 (o Notion volta a tentar).
    if (e instanceof ErroAcao) return Response.json({ ok: false, acao, erro: e.message })
    return Response.json({ ok: false, acao, erro: e.message }, { status: 500 })
  }
}