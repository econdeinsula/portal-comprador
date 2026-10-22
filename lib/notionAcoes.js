// Ações feitas no Notion que são aplicadas no portal (Supabase).
// Cada ação lê a página do Notion diretamente da API (não confia no conteúdo do pedido)
// e grava no portal exatamente os mesmos registos que o portal grava quando a equipa age lá.

import { supabaseAdmin } from './supabaseAdmin'
import { notion, fonteDeDados, atualizarPagina, listarBlocos, prop, BASES } from './notion'
import { enviarEmails, emailsDosDonos, avisoMensagemEquipa, avisoResolvida } from './email'

const db = () => supabaseAdmin()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const semHifens = (s) => String(s || '').replace(/-/g, '')

// Erro "esperado" (dados inválidos): responde 200 para o Notion não repetir o pedido
export class ErroAcao extends Error {}

const textoDe = (p) => (p?.rich_text || p?.title || []).map((t) => t.plain_text).join('').trim()

async function lerReclamacao(pageId) {
  if (!pageId) throw new ErroAcao('Pedido sem página')
  const pagina = await notion(`/pages/${pageId}`)
  const fonte = await fonteDeDados('reclamacoes')
  const daBase = semHifens(pagina.parent?.data_source_id) === semHifens(fonte)
    || semHifens(pagina.parent?.database_id) === semHifens(BASES.reclamacoes)
  if (!daBase) throw new ErroAcao('A página não pertence à base Reclamações')

  const anomaliaId = textoDe(pagina.properties?.['ID Portal'])
  if (!UUID.test(anomaliaId)) throw new ErroAcao('Reclamação sem ID Portal válido (foi criada à mão no Notion?)')
  return { anomaliaId, props: pagina.properties }
}

// ═══════════ Enviar a resposta escrita em "Resposta a enviar" ═══════════
export async function enviarResposta(pageId) {
  const { anomaliaId, props } = await lerReclamacao(pageId)
  const texto = textoDe(props['Resposta a enviar'])
  if (!texto) return { ignorado: 'O campo "Resposta a enviar" está vazio' }

  // Proteção contra duplo clique: a mesma mensagem nos últimos 2 minutos não é enviada outra vez
  const desde = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const { data: repetida } = await db().from('timeline_eventos')
    .select('id').eq('anomalia_id', anomaliaId).eq('autor_tipo', 'equipa')
    .eq('texto', texto).gte('ocorrido_em', desde).limit(1)

  if (!repetida?.length) {
    const { error } = await db().from('timeline_eventos').insert({
      anomalia_id: anomaliaId,
      autor_tipo: 'equipa',
      autor_id: null,
      tipo_evento: 'mensagem',
      texto,
      ocorrido_em: new Date().toISOString(),
    })
    if (error) throw new Error(`Falha ao gravar a mensagem: ${error.message}`)
  }

  // Limpa o campo no Notion (o balão azul aparece pelo sync normal)
  await atualizarPagina(pageId, { 'Resposta a enviar': prop.texto(''), 'Enviar agora': prop.caixa(false) })

  if (repetida?.length) return { ignorado: 'Mensagem igual enviada há menos de 2 minutos' }

  // Aviso por email ao proprietário (uma falha aqui não desfaz o envio)
  try {
    const { data: a } = await db().from('anomalias').select('fracao_id').eq('id', anomaliaId).single()
    const { assunto, mensagem } = avisoMensagemEquipa(anomaliaId, texto)
    await enviarEmails(await emailsDosDonos(db(), a.fracao_id), assunto, mensagem)
  } catch (e) {
    console.error('[notion-acao] email da resposta', anomaliaId, e)
  }
  return { enviado: true }
}

// ═══════════ Mudança de Estado ═══════════
export async function mudarEstado(pageId) {
  const { anomaliaId, props } = await lerReclamacao(pageId)
  const novo = props['Estado']?.status?.name
  if (!novo) return { ignorado: 'Estado vazio' }

  const { data: a, error } = await db().from('anomalias')
    .select('id, descricao, fracao_id, estado:estados(nome)').eq('id', anomaliaId).single()
  if (error || !a) throw new ErroAcao('Reclamação não encontrada no portal')

  // Se já está igual, a alteração veio do próprio portal (sync) — nada a fazer
  if (a.estado?.nome === novo) return { ignorado: 'O estado já é este no portal' }

  const { data: estado } = await db().from('estados').select('id').eq('nome', novo).maybeSingle()
  if (!estado) throw new ErroAcao(`Estado "${novo}" não existe no portal`)

  const { error: erroUpdate } = await db().from('anomalias').update({ estado_id: estado.id }).eq('id', anomaliaId)
  if (erroUpdate) throw new Error(`Falha ao mudar o estado: ${erroUpdate.message}`)

  await db().from('timeline_eventos').insert({
    anomalia_id: anomaliaId,
    autor_tipo: 'sistema',
    autor_id: null,
    tipo_evento: 'mudanca_estado',
    texto: `Estado alterado para "${novo}"`,
    ocorrido_em: new Date().toISOString(),
  })

  if (novo === 'Resolvida') {
    try {
      const { assunto, mensagem } = avisoResolvida(anomaliaId, a.descricao)
      await enviarEmails(await emailsDosDonos(db(), a.fracao_id), assunto, mensagem)
    } catch (e) {
      console.error('[notion-acao] email de resolvida', anomaliaId, e)
    }
  }
  return { estado: novo }
}

// ═══════════ Empresas atribuídas ═══════════
// Converte uma página da base Empresas no ID da empresa no portal.
// Se a empresa foi criada à mão no Notion, cria-a também no portal.
async function empresaDaPagina(pageId) {
  const { data: ligada } = await db().from('empresas').select('id').eq('notion_page_id', pageId).maybeSingle()
  if (ligada) return ligada.id

  const pagina = await notion(`/pages/${pageId}`)
  const idPortal = textoDe(pagina.properties?.['ID Portal'])
  if (UUID.test(idPortal)) {
    const { data: existe } = await db().from('empresas').select('id').eq('id', idPortal).maybeSingle()
    if (existe) return existe.id
  }

  const nome = textoDe(pagina.properties?.['Empresa'])
  if (!nome) throw new ErroAcao('Empresa sem nome no Notion')

  const { data: mesmoNome } = await db().from('empresas').select('id').ilike('nome', nome).limit(1)
  if (mesmoNome?.length) return mesmoNome[0].id

  const { data: nova, error } = await db().from('empresas')
    .insert({ nome, notion_page_id: pageId }).select('id').single()
  if (error) throw new Error(`Falha ao criar a empresa "${nome}": ${error.message}`)
  return nova.id
}

export async function atualizarEmpresas(pageId) {
  const { anomaliaId, props } = await lerReclamacao(pageId)
  const paginas = (props['Empresas']?.relation || []).map((r) => r.id)

  const desejadas = new Set()
  for (const p of paginas) desejadas.add(await empresaDaPagina(p))

  const { data: atuais } = await db().from('anomalia_empresas').select('empresa_id').eq('anomalia_id', anomaliaId)
  const atuaisSet = new Set((atuais || []).map((x) => x.empresa_id))

  const adicionar = [...desejadas].filter((id) => !atuaisSet.has(id))
  const remover = [...atuaisSet].filter((id) => !desejadas.has(id))
  if (!adicionar.length && !remover.length) return { ignorado: 'Empresas já iguais no portal' }

  if (adicionar.length) {
    const { error } = await db().from('anomalia_empresas')
      .insert(adicionar.map((empresa_id) => ({ anomalia_id: anomaliaId, empresa_id })))
    if (error) throw new Error(`Falha ao adicionar empresas: ${error.message}`)
  }
  for (const empresaId of remover) {
    await db().from('anomalia_empresas').delete().eq('anomalia_id', anomaliaId).eq('empresa_id', empresaId)
  }
  return { adicionadas: adicionar.length, removidas: remover.length }
}


// ═══════════════════════════════════════════════════════════════
// FASE 3 — Visitas e criação de reclamações a partir do Notion
// ═══════════════════════════════════════════════════════════════

const AVISO = 'Aviso do portal'
const quando = (iso) => new Date(iso).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })
const hojeLisboa = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date())

// Escreve (ou limpa) a mensagem de erro visível na página da reclamação
async function escreverAviso(paginaReclamacao, texto) {
  if (!paginaReclamacao) return
  try {
    await atualizarPagina(paginaReclamacao, { [AVISO]: prop.texto(texto ? `⚠️ ${texto}` : '') })
  } catch (e) {
    console.error('[notion-acao] aviso', e)
  }
}

// Corre uma ação; se falhar por dados inválidos, explica o problema em "Aviso do portal"
async function comAviso(paginaReclamacao, acao) {
  try {
    const r = await acao()
    await escreverAviso(paginaReclamacao, '')
    return r
  } catch (e) {
    if (e instanceof ErroAcao) await escreverAviso(paginaReclamacao, e.message)
    throw e
  }
}

async function paginaDaReclamacaoNoPortal(anomaliaId) {
  const { data } = await db().from('anomalias').select('notion_page_id').eq('id', anomaliaId).maybeSingle()
  const id = data?.notion_page_id
  return id && !id.startsWith('pendente:') ? id : null
}

// ═══════════ Propor visita (botão na reclamação) ═══════════
export async function proporVisita(pageId) {
  return comAviso(pageId, async () => {
    const { anomaliaId, props } = await lerReclamacao(pageId)
    const data = props['Propor visita em']?.date?.start
    const tecnico = textoDe(props['Técnico da visita'])

    if (!data) throw new ErroAcao('Preencha "Propor visita em" com a data e a hora da visita.')
    if (!data.includes('T')) throw new ErroAcao('Indique também a hora em "Propor visita em" (ative "Incluir hora").')
    const iso = new Date(data).toISOString()
    if (new Date(iso).getTime() < Date.now()) throw new ErroAcao('A data proposta para a visita já passou.')

    // Proteção contra duplo clique
    const { data: igual } = await db().from('visitas').select('id')
      .eq('anomalia_id', anomaliaId).eq('data_proposta', iso).eq('estado', 'proposta').limit(1)

    if (!igual?.length) {
      const { error } = await db().from('visitas').insert({
        anomalia_id: anomaliaId,
        data_proposta: iso,
        tecnico: tecnico || null,
        estado: 'proposta',
        proposta_por: 'equipa',
      })
      if (error) throw new Error(`Falha ao criar a visita: ${error.message}`)

      await db().from('timeline_eventos').insert({
        anomalia_id: anomaliaId,
        autor_tipo: 'sistema',
        tipo_evento: 'agendamento',
        texto: `Visita proposta para ${quando(iso)}${tecnico ? ` com ${tecnico}` : ''}`,
        ocorrido_em: new Date().toISOString(),
      })
    }

    await atualizarPagina(pageId, {
      'Propor visita em': prop.data(null),
      'Técnico da visita': prop.texto(''),
    })
    return igual?.length ? { ignorado: 'Visita igual já proposta' } : { visita: 'proposta' }
  })
}

// ═══════════ Botões na visita: aceitar, recusar, cancelar ═══════════
async function lerVisita(pageId) {
  if (!pageId) throw new ErroAcao('Pedido sem página')
  const pagina = await notion(`/pages/${pageId}`)
  const fonte = await fonteDeDados('visitas')
  const daBase = semHifens(pagina.parent?.data_source_id) === semHifens(fonte)
    || semHifens(pagina.parent?.database_id) === semHifens(BASES.visitas)
  if (!daBase) throw new ErroAcao('A página não pertence à base Visitas')

  const visitaId = textoDe(pagina.properties?.['ID Portal'])
  if (!UUID.test(visitaId)) throw new ErroAcao('Visita sem ID Portal válido (foi criada à mão no Notion? Use "Propor visita" na reclamação).')

  const { data: v } = await db().from('visitas')
    .select('id, anomalia_id, estado, proposta_por, data_proposta').eq('id', visitaId).maybeSingle()
  if (!v) throw new ErroAcao('Visita não encontrada no portal')
  return v
}

async function responderPropostaDoProprietario(pageId, novoEstado) {
  const v = await lerVisita(pageId)
  const paginaReclamacao = await paginaDaReclamacaoNoPortal(v.anomalia_id)

  return comAviso(paginaReclamacao, async () => {
    if (v.estado !== 'proposta' || v.proposta_por !== 'proprietario') {
      throw new ErroAcao('Só é possível aceitar ou recusar datas propostas pelo proprietário que ainda estejam pendentes.')
    }
    const { error } = await db().from('visitas').update({ estado: novoEstado }).eq('id', v.id)
    if (error) throw new Error(`Falha ao atualizar a visita: ${error.message}`)

    await db().from('timeline_eventos').insert({
      anomalia_id: v.anomalia_id,
      autor_tipo: 'sistema',
      tipo_evento: 'agendamento',
      texto: novoEstado === 'confirmada'
        ? `Equipa aceitou a data proposta pelo proprietário: ${quando(v.data_proposta)}`
        : 'Equipa recusou a data proposta pelo proprietário',
      ocorrido_em: new Date().toISOString(),
    })
    return { visita: novoEstado }
  })
}

export const aceitarVisita = (pageId) => responderPropostaDoProprietario(pageId, 'confirmada')
export const recusarVisita = (pageId) => responderPropostaDoProprietario(pageId, 'recusada')

export async function cancelarVisita(pageId) {
  const v = await lerVisita(pageId)
  const paginaReclamacao = await paginaDaReclamacaoNoPortal(v.anomalia_id)

  return comAviso(paginaReclamacao, async () => {
    if (!['proposta', 'confirmada'].includes(v.estado)) {
      throw new ErroAcao(`Esta visita está "${v.estado}" e já não pode ser cancelada.`)
    }
    const { error } = await db().from('visitas').update({ estado: 'cancelada' }).eq('id', v.id)
    if (error) throw new Error(`Falha ao cancelar a visita: ${error.message}`)

    await db().from('timeline_eventos').insert({
      anomalia_id: v.anomalia_id,
      autor_tipo: 'sistema',
      tipo_evento: 'agendamento',
      texto: `Visita de ${quando(v.data_proposta)} cancelada pela equipa`,
      ocorrido_em: new Date().toISOString(),
    })
    return { visita: 'cancelada' }
  })
}

// ═══════════ Criar no portal uma reclamação feita à mão no Notion ═══════════
async function textoDaSecao(pageId, titulo) {
  const blocos = await listarBlocos(pageId)
  const texto = (b) => (b?.[b.type]?.rich_text || []).map((t) => t.plain_text).join('').trim()
  const i = blocos.findIndex((b) => b.type?.startsWith('heading') && texto(b) === titulo)
  if (i < 0) return ''
  const linhas = []
  for (let j = i + 1; j < blocos.length && !blocos[j].type?.startsWith('heading'); j++) {
    const t = texto(blocos[j])
    if (t) linhas.push(t)
  }
  return linhas.join('\n')
}

async function idPorNome(tabela, nome, filtro = {}) {
  if (!nome) return null
  let q = db().from(tabela).select('id').eq('nome', nome)
  for (const [coluna, valor] of Object.entries(filtro)) if (valor) q = q.eq(coluna, valor)
  const { data } = await q.limit(1)
  if (!data?.length) throw new ErroAcao(`"${nome}" não existe no portal (${tabela}). Escolha uma das opções existentes.`)
  return data[0].id
}

export async function criarReclamacao(pageId) {
  return comAviso(pageId, async () => {
    if (!pageId) throw new ErroAcao('Pedido sem página')
    const pagina = await notion(`/pages/${pageId}`)
    const fonte = await fonteDeDados('reclamacoes')
    const daBase = semHifens(pagina.parent?.data_source_id) === semHifens(fonte)
      || semHifens(pagina.parent?.database_id) === semHifens(BASES.reclamacoes)
    if (!daBase) throw new ErroAcao('A página não pertence à base Reclamações')

    const props = pagina.properties
    if (UUID.test(textoDe(props['ID Portal']))) return { ignorado: 'Esta reclamação já existe no portal' }

    const { data: jaLigada } = await db().from('anomalias').select('id').eq('notion_page_id', pageId).maybeSingle()
    if (jaLigada) return { ignorado: 'Esta reclamação já existe no portal' }

    // Fração
    const paginaFracao = props['Fração']?.relation?.[0]?.id
    if (!paginaFracao) throw new ErroAcao('Escolha a Fração antes de criar a reclamação no portal.')
    const { data: fracao } = await db().from('fracoes').select('id').eq('notion_page_id', paginaFracao).maybeSingle()
    if (!fracao) throw new ErroAcao('Essa fração não existe no portal. Escolha uma fração da lista.')

    // Classificação (opcional, mas tem de existir no portal)
    const categoriaId = await idPorNome('categorias', props['Categoria']?.select?.name)
    const elementoId = await idPorNome('elementos', props['Elemento']?.select?.name, { categoria_id: categoriaId })
    const tipoId = await idPorNome('tipos_anomalia', props['Tipo']?.select?.name)

    // Descrição: o texto escrito por baixo do título "Descrição"
    const descricao = await textoDaSecao(pageId, 'Descrição')
    if (!descricao) throw new ErroAcao('Escreva a descrição do problema por baixo do título "Descrição".')

    const { data: aberta } = await db().from('estados').select('id').eq('nome', 'Aberta').single()

    // A linha nasce já ligada a esta página: o sync atualiza-a em vez de criar outra
    const { error } = await db().from('anomalias').insert({
      fracao_id: fracao.id,
      categoria_id: categoriaId,
      elemento_id: elementoId,
      tipo_anomalia_id: tipoId,
      descricao,
      estado_id: aberta.id,
      origem: 'novo',
      data_entrada: hojeLisboa(),
      notion_page_id: pageId,
      notion_conteudo_ok: true,
    })
    if (error) throw new Error(`Falha ao criar a reclamação: ${error.message}`)
    return { criada: true }
  })
}