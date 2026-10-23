// Tarefas periódicas do sync com o Notion:
//  - repararPendentes(): volta a tentar o que falhou ou ficou a meio (corre de 15 em 15 min)
//  - atualizarGarantias(): atualiza os dias de garantia das reclamações ativas (corre 1x por dia)

import { supabaseAdmin } from './supabaseAdmin'
import { prop, atualizarPagina } from './notion'
import { sincronizar, metricasDaReclamacao } from './notionSync'

const TEMPO_MAXIMO = 45 * 1000 // a função tem 60 s; paramos aos 45 para não ficar a meio
const ESTADOS_CONCLUIDOS = ['Resolvida', 'Fechada (fora de garantia)']

// Ordem importa: primeiro o que as reclamações referenciam, depois as reclamações, depois o resto
const TABELAS = ['empresas', 'proprietarios', 'fracoes', 'anomalias', 'timeline_eventos', 'visitas']

export async function repararPendentes({ limitePorTabela = 25 } = {}) {
  const db = supabaseAdmin()
  const inicio = Date.now()
  const resultado = { reparados: 0, erros: [] }

  for (const tabela of TABELAS) {
    const filtro = tabela === 'anomalias'
      ? 'notion_page_id.is.null,notion_page_id.like.pendente*,notion_conteudo_ok.eq.false,notion_synced_at.is.null'
      : tabela === 'timeline_eventos'
        ? 'notion_page_id.is.null,notion_page_id.like.pendente*,notion_bloco_id.is.null,notion_bloco_id.like.pendente*'
        : 'notion_page_id.is.null,notion_page_id.like.pendente*'

    let q = db.from(tabela).select('id').or(filtro).limit(limitePorTabela)
    if (tabela === 'timeline_eventos') q = q.order('ocorrido_em', { ascending: true })
    const { data: linhas, error } = await q
    if (error) { resultado.erros.push(`${tabela}: ${error.message}`); continue }

    for (const linha of linhas || []) {
      if (Date.now() - inicio > TEMPO_MAXIMO) return { ...resultado, interrompido: true }
      try {
        await sincronizar(tabela, linha)
        resultado.reparados++
      } catch (e) {
        resultado.erros.push(`${tabela} ${linha.id}: ${e.message}`)
      }
    }
  }
  return resultado
}

export async function atualizarGarantias() {
  const db = supabaseAdmin()
  const inicio = Date.now()

  const { data: reclamacoes, error } = await db.from('anomalias')
    .select('id, notion_page_id, estado:estados(nome)')
    .not('notion_page_id', 'is', null)
    .not('notion_page_id', 'like', 'pendente*')
  if (error) throw new Error(error.message)

  const ativas = (reclamacoes || []).filter((r) => !ESTADOS_CONCLUIDOS.includes(r.estado?.nome))
  if (!ativas.length) return { atualizadas: 0 }

  const { data: garantias } = await db.from('v_garantia_restante')
    .select('anomalia_id, data_fim_garantia, dias_restantes')
    .in('anomalia_id', ativas.map((r) => r.id))
  const porId = new Map((garantias || []).map((g) => [g.anomalia_id, g]))

  let atualizadas = 0
  const erros = []
  for (const r of ativas) {
    if (Date.now() - inicio > TEMPO_MAXIMO) return { atualizadas, erros, interrompido: true }
    const g = porId.get(r.id)
    try {
      await atualizarPagina(r.notion_page_id, {
        'Fim da garantia': prop.data(g?.data_fim_garantia),
        'Dias de garantia restantes': prop.numero(g?.dias_restantes),
      })
      atualizadas++
    } catch (e) {
      erros.push(`${r.id}: ${e.message}`)
    }
  }
  return { atualizadas, erros }
}


// Calcula as métricas de todas as reclamações já no Notion (usar uma vez; repetir até "falta: 0")
export async function recalcularMetricas() {
  const db = supabaseAdmin()
  const inicio = Date.now()
  const { data: reclamacoes, error } = await db.from('anomalias')
    .select('id, notion_page_id')
    .not('notion_page_id', 'is', null)
    .not('notion_page_id', 'like', 'pendente*')
    .order('id')
  if (error) throw new Error(error.message)

  // Continua de onde ficou na passagem anterior
  const { data: marca } = await db.from('notion_estado').select('valor').eq('chave', 'metricas_ultimo_id').maybeSingle()
  const ultimo = marca?.valor || ''
  const porFazer = (reclamacoes || []).filter((r) => r.id > ultimo)

  let feitas = 0
  const erros = []
  for (const r of porFazer) {
    if (Date.now() - inicio > TEMPO_MAXIMO) break
    try {
      await atualizarPagina(r.notion_page_id, await metricasDaReclamacao(r.id))
    } catch (e) {
      erros.push(`${r.id}: ${e.message}`)
    }
    feitas++
    await db.from('notion_estado').upsert({ chave: 'metricas_ultimo_id', valor: r.id, atualizado_em: new Date().toISOString() })
  }
  const falta = porFazer.length - feitas
  if (falta === 0) await db.from('notion_estado').delete().eq('chave', 'metricas_ultimo_id')
  return { feitas, falta, erros }
}