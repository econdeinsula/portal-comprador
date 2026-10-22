// Ações feitas no Notion que são aplicadas no portal (Supabase).
// Cada ação lê a página do Notion diretamente da API (não confia no conteúdo do pedido)
// e grava no portal exatamente os mesmos registos que o portal grava quando a equipa age lá.

import { supabaseAdmin } from './supabaseAdmin'
import { notion, fonteDeDados, atualizarPagina, prop, BASES } from './notion'
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