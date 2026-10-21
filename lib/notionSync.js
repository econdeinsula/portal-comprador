// Sincronização portal (Supabase) → Notion.
// Cada função recebe o ID de uma linha do Supabase, cria ou atualiza a página correspondente
// no Notion e guarda o ID da página na coluna notion_page_id.

import sharp from 'sharp'
import { supabaseAdmin } from './supabaseAdmin'
import {
  prop, bloco, criarPagina, atualizarPagina, apagarPagina, procurarPorIdPortal,
  esperarTemplate, listarBlocos, inserirDepois, carregarFicheiro,
} from './notion'

const SITE = process.env.SITE_URL || 'https://portal-comprador.vercel.app'
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
const db = () => supabaseAdmin()

// ─── Traduções dos valores do portal para as opções do Notion ───
const AUTOR = { proprietario: 'Proprietário', equipa: 'Equipa', sistema: 'Sistema' }
const TIPO_EVENTO = { mensagem: 'Mensagem', mudanca_estado: 'Mudança de estado', agendamento: 'Agendamento', anexo: 'Anexo' }
const ESTADO_VISITA = { proposta: 'Proposta', confirmada: 'Confirmada', realizada: 'Realizada', cancelada: 'Cancelada', recusada: 'Recusada' }
const PROPOSTA_POR = { equipa: 'Equipa', proprietario: 'Proprietário' }

const formatoData = new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'short', timeStyle: 'short' })
const dataCurta = (v) => (v ? formatoData.format(new Date(v)) : '')

// ─── Utilitários de ficheiros (Storage privado) ───
const EXTENSOES_IMAGEM = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg']
const MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  avif: 'image/avif', svg: 'image/svg+xml', pdf: 'application/pdf',
}
const MAX_BYTES = 20 * 1024 * 1024

function extensaoDe(valor) {
  const limpo = (valor || '').split('?')[0]
  const i = limpo.lastIndexOf('.')
  return i >= 0 ? limpo.slice(i + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
}
const eImagem = (valor) => EXTENSOES_IMAGEM.includes(extensaoDe(valor))
const mimeDe = (valor) => MIME[extensaoDe(valor)] || 'application/octet-stream'

function normalizarCaminho(bucket, valor) {
  if (!valor) return null
  if (!valor.startsWith('http')) return valor
  const marcador = `/${bucket}/`
  const i = valor.indexOf(marcador)
  return i >= 0 ? decodeURIComponent(valor.slice(i + marcador.length).split('?')[0]) : null
}

async function descarregar(bucket, valor) {
  const caminho = normalizarCaminho(bucket, valor)
  if (!caminho) throw new Error(`Caminho inválido no bucket ${bucket}: ${valor}`)
  const { data, error } = await db().storage.from(bucket).download(caminho)
  if (error || !data) throw new Error(`Falha ao descarregar ${bucket}/${caminho}: ${error?.message}`)
  return Buffer.from(await data.arrayBuffer())
}

// ─── Garante que existe UMA página no Notion para esta linha (sem duplicados) ───
// Reserva a linha com "pendente:<hora>" antes de criar; quem não conseguir reservar espera.
const PENDENTE = 'pendente:'
const PRAZO_PENDENTE = 2 * 60 * 1000

async function garantirPagina(tabela, id, base, criar) {
  for (let tentativa = 0; tentativa < 15; tentativa++) {
    const { data: linha, error } = await db().from(tabela).select('notion_page_id').eq('id', id).single()
    if (error) throw new Error(`${tabela} ${id}: ${error.message}`)
    const atual = linha.notion_page_id

    if (atual && !atual.startsWith(PENDENTE)) return { pageId: atual, nova: false }

    const expirado = atual && Date.now() - Number(atual.slice(PENDENTE.length)) > PRAZO_PENDENTE
    if (!atual || expirado) {
      const marca = PENDENTE + Date.now()
      let q = db().from(tabela).update({ notion_page_id: marca }).eq('id', id)
      q = atual ? q.eq('notion_page_id', atual) : q.is('notion_page_id', null)
      const { data: reservado } = await q.select('id')

      if (reservado?.length) {
        try {
          const existente = await procurarPorIdPortal(base, id)
          const pageId = existente ? existente.id : (await criar()).id
          await db().from(tabela).update({ notion_page_id: pageId }).eq('id', id)
          return { pageId, nova: !existente }
        } catch (e) {
          await db().from(tabela).update({ notion_page_id: null }).eq('id', id).eq('notion_page_id', marca)
          throw e
        }
      }
    }
    await esperar(1500)
  }
  throw new Error(`Tempo esgotado à espera da página de ${tabela} ${id}`)
}

async function marcarSincronizado(tabela, id, extra = {}) {
  await db().from(tabela).update({ notion_synced_at: new Date().toISOString(), ...extra }).eq('id', id)
}

async function lerLinha(tabela, id, colunas) {
  const { data, error } = await db().from(tabela).select(colunas).eq('id', id).single()
  if (error || !data) throw new Error(`${tabela} ${id} não encontrado: ${error?.message}`)
  return data
}

// A página foi apagada no Notion (está no lixo)?
const paginaApagada = (e) => /archived|in_trash|in trash/i.test(e?.message || '')

// Esquece a ligação a uma página apagada no Notion, para ser criada de novo
async function esquecerPagina(tabela, id, pageId) {
  const extra = tabela === 'anomalias' ? { notion_conteudo_ok: false } : {}
  await db().from(tabela).update({ notion_page_id: null, ...extra }).eq('id', id).eq('notion_page_id', pageId)
  // Reclamação recriada: a conversa tem de ser reescrita na página nova
  if (tabela === 'anomalias') {
    await db().from('timeline_eventos').update({ notion_bloco_id: null }).eq('anomalia_id', id)
  }
}

// Cria ou atualiza e devolve o ID da página (recria-a se alguém a tiver apagado no Notion)
async function gravar(tabela, id, base, propriedades, opcoes = {}, tentativa = 0) {
  const { pageId, nova } = await garantirPagina(tabela, id, base, () => criarPagina(base, propriedades, opcoes))
  if (!nova) {
    try {
      await atualizarPagina(pageId, propriedades)
    } catch (e) {
      if (!paginaApagada(e) || tentativa > 0) throw e
      await esquecerPagina(tabela, id, pageId)
      return gravar(tabela, id, base, propriedades, opcoes, tentativa + 1)
    }
  }
  return { pageId, nova }
}

// ═══════════════════ EMPRESAS ═══════════════════
export async function sincronizarEmpresa(id) {
  const e = await lerLinha('empresas', id, 'id, nome')
  const { pageId } = await gravar('empresas', id, 'empresas', {
    'Empresa': prop.titulo(e.nome),
    'ID Portal': prop.texto(e.id),
  })
  await marcarSincronizado('empresas', id)
  return pageId
}

// ═══════════════════ PROPRIETÁRIOS ═══════════════════
export async function sincronizarProprietario(id) {
  const p = await lerLinha('proprietarios', id, 'id, nome, email, telefone, morada, auth_user_id')
  const { pageId } = await gravar('proprietarios', id, 'proprietarios', {
    'Nome': prop.titulo(p.nome),
    'ID Portal': prop.texto(p.id),
    'Email': prop.email(p.email),
    'Telefone': prop.telefone(p.telefone),
    'Morada': prop.texto(p.morada),
    'Conta no portal': prop.caixa(!!p.auth_user_id),
  })
  await marcarSincronizado('proprietarios', id)
  return pageId
}

// ═══════════════════ FRAÇÕES ═══════════════════
export async function sincronizarFracao(id) {
  const f = await lerLinha('fracoes', id, `
    id, codigo_fracao, bloco, piso, apartamento, data_escritura, data_rececao_provisoria,
    empreendimento:empreendimentos(nome, lote),
    donos:fracao_proprietarios(proprietario_id)`)

  const proprietarios = []
  for (const d of f.donos || []) proprietarios.push(await sincronizarProprietario(d.proprietario_id))

  const { pageId } = await gravar('fracoes', id, 'fracoes', {
    'Fração': prop.titulo(f.codigo_fracao),
    'ID Portal': prop.texto(f.id),
    'Empreendimento': prop.selecao(f.empreendimento?.nome),
    'Lote': prop.selecao(f.empreendimento?.lote),
    'Bloco': prop.texto(f.bloco),
    'Piso': prop.texto(f.piso),
    'Apartamento': prop.texto(f.apartamento),
    'Data de escritura': prop.data(f.data_escritura),
    'Data de receção provisória': prop.data(f.data_rececao_provisoria),
    'Proprietários': prop.relacao(proprietarios),
  })
  await marcarSincronizado('fracoes', id)
  return pageId
}

// ═══════════════════ RECLAMAÇÕES ═══════════════════
const COLUNAS_RECLAMACAO = `
  id, fracao_id, descricao, pin_x, pin_y, origem, notion_conteudo_ok,
  data_entrada, data_vistoria, data_encomenda, data_correcao, criado_em, atualizado_em,
  categoria:categorias(nome), elemento:elementos(nome), tipo:tipos_anomalia(nome),
  estado:estados(nome), local:compartimentos(nome),
  fracao:fracoes(codigo_fracao, empreendimento:empreendimentos(nome, lote)),
  empresas:anomalia_empresas(papel, empresa_id, empresa:empresas(nome))`

export async function sincronizarReclamacao(id) {
  const a = await lerLinha('anomalias', id, COLUNAS_RECLAMACAO)
  const { data: g } = await db().from('v_garantia_restante')
    .select('data_fim_garantia, dias_restantes').eq('anomalia_id', id).maybeSingle()

  const fracaoPage = await sincronizarFracao(a.fracao_id)
  const empresasPages = []
  for (const e of a.empresas || []) empresasPages.push(await sincronizarEmpresa(e.empresa_id))

  const titulo = [a.fracao?.codigo_fracao, a.elemento?.nome || a.categoria?.nome, a.tipo?.nome]
    .filter(Boolean).join(' · ') || 'Reclamação'
  const papeis = (a.empresas || [])
    .map((e) => (e.papel ? `${e.empresa?.nome} — ${e.papel}` : e.empresa?.nome))
    .filter(Boolean).join('\n')

  const { pageId } = await gravar('anomalias', id, 'reclamacoes', {
    'Reclamação': prop.titulo(titulo),
    'ID Portal': prop.texto(a.id),
    'Estado': prop.estado(a.estado?.nome),
    'Fração': prop.relacao([fracaoPage]),
    'Empreendimento': prop.selecao(a.fracao?.empreendimento?.nome),
    'Categoria': prop.selecao(a.categoria?.nome),
    'Elemento': prop.selecao(a.elemento?.nome),
    'Tipo': prop.selecao(a.tipo?.nome),
    'Compartimento': prop.texto(a.local?.nome),
    'Empresas': prop.relacao(empresasPages),
    'Empresas e papéis': prop.texto(papeis),
    'Data de entrada': prop.data(a.data_entrada || a.criado_em?.slice(0, 10)),
    'Data de vistoria': prop.data(a.data_vistoria),
    'Data de encomenda': prop.data(a.data_encomenda),
    'Data de correção': prop.data(a.data_correcao),
    'Fim da garantia': prop.data(g?.data_fim_garantia),
    'Dias de garantia restantes': prop.numero(g?.dias_restantes),
    'Origem': prop.selecao(a.origem === 'legado' ? 'Legado' : 'Novo'),
    'Link portal': prop.url(`${SITE}/equipa/${a.id}`),
    'Criada em': prop.data(a.criado_em),
    'Atualizada em': prop.data(a.atualizado_em),
  }, { comTemplate: true })

  // Descrição e planta: escritas uma única vez, depois de o template estar aplicado
  if (!a.notion_conteudo_ok) {
    await escreverConteudo(a, pageId)
    await marcarSincronizado('anomalias', id, { notion_conteudo_ok: true })
  } else {
    await marcarSincronizado('anomalias', id)
  }
  return pageId
}

// Versão leve: só garante que a página existe e tem conteúdo (usada por mensagens e visitas)
async function paginaDaReclamacao(id) {
  const a = await lerLinha('anomalias', id, 'notion_page_id, notion_conteudo_ok')
  if (a.notion_page_id && !a.notion_page_id.startsWith(PENDENTE) && a.notion_conteudo_ok) return a.notion_page_id
  return sincronizarReclamacao(id)
}

// Último bloco de uma secção (o próprio título se a secção estiver vazia)
function fimDaSecao(blocos, titulo) {
  const texto = (b) => (b?.[b.type]?.rich_text || []).map((t) => t.plain_text).join('').trim()
  const i = blocos.findIndex((b) => b.type?.startsWith('heading') && texto(b) === titulo)
  if (i < 0) return null
  let j = i
  while (j + 1 < blocos.length && !blocos[j + 1].type?.startsWith('heading')) j++
  return blocos[j].id
}

async function escreverConteudo(a, pageId) {
  const blocos = await esperarTemplate(pageId)

  const fimDescricao = fimDaSecao(blocos, 'Descrição')
  if (fimDescricao) {
    await inserirDepois(pageId, fimDescricao, [bloco.paragrafo(a.descricao || '(sem descrição)')])
  }

  const fimLocalizacao = fimDaSecao(blocos, 'Localização')
  if (fimLocalizacao) {
    await inserirDepois(pageId, fimLocalizacao, await blocosDaLocalizacao(a))
  }
}

async function blocosDaLocalizacao(a) {
  if (a.pin_x == null || a.pin_y == null) {
    return [bloco.paragrafo('Sem localização marcada na planta.')]
  }
  const x = Number(a.pin_x)
  const y = Number(a.pin_y)
  const textoPin = `Pin a ${Math.round(x)}% da largura e ${Math.round(y)}% da altura da planta${a.local?.nome ? ` (${a.local.nome})` : ''}.`

  const { data: planta } = await db().from('documentos')
    .select('nome, ficheiro_url')
    .eq('fracao_id', a.fracao_id).eq('tipo', 'planta')
    .order('carregado_em', { ascending: false }).limit(1).maybeSingle()

  if (!planta) return [bloco.paragrafo(`Sem planta carregada para esta fração. ${textoPin}`)]

  try {
    const ficheiro = await descarregar('documentos', planta.ficheiro_url)
    if (eImagem(planta.ficheiro_url)) {
      const comPin = await desenharPin(ficheiro, x, y)
      const uploadId = await carregarFicheiro(comPin, 'localizacao.png', 'image/png')
      return [bloco.imagem(uploadId, textoPin)]
    }
    if (ficheiro.length > MAX_BYTES) return [bloco.paragrafo(`Planta demasiado grande para o Notion. ${textoPin}`)]
    const nome = `planta.${extensaoDe(planta.ficheiro_url) || 'pdf'}`
    const uploadId = await carregarFicheiro(ficheiro, nome, mimeDe(planta.ficheiro_url))
    return [bloco.ficheiro(uploadId, planta.nome), bloco.paragrafo(textoPin)]
  } catch (e) {
    console.error('[notion-sync] planta', a.id, e)
    return [bloco.paragrafo(`Não foi possível copiar a planta. ${textoPin}`)]
  }
}

// Desenha o pin (posição em %) sobre a planta e devolve um PNG
async function desenharPin(buffer, x, y) {
  const meta = await sharp(buffer, { density: 150 }).metadata()
  const largura = meta.width ? Math.min(meta.width, 2000) : 2000
  const base = await sharp(buffer, { density: 150 })
    .rotate()
    .resize({ width: largura, withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer({ resolveWithObject: true })

  const { width, height } = base.info
  const cx = (width * x) / 100
  const cy = (height * y) / 100
  const r = Math.max(10, Math.round(width * 0.012))
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${cx}" cy="${cy}" r="${r * 2.4}" fill="rgba(220,38,38,0.25)"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#dc2626" stroke="#ffffff" stroke-width="${Math.max(2, Math.round(r / 3))}"/>
  </svg>`

  return sharp(base.data).composite([{ input: Buffer.from(svg) }]).png().toBuffer()
}

// ═══════════════════ MENSAGENS (timeline) ═══════════════════
export async function sincronizarEvento(id, tentativa = 0) {
  const ev = await lerLinha('timeline_eventos', id,
    'id, anomalia_id, autor_tipo, tipo_evento, texto, anexo_url, ocorrido_em, notion_bloco_id')
  const reclamacaoPage = await paginaDaReclamacao(ev.anomalia_id)

  const propriedades = {
    'Mensagem': prop.titulo(`${AUTOR[ev.autor_tipo] || ev.autor_tipo} · ${dataCurta(ev.ocorrido_em)}`),
    'ID Portal': prop.texto(ev.id),
    'Reclamação': prop.relacao([reclamacaoPage]),
    'Texto': prop.texto(ev.texto),
    'Autor': prop.selecao(AUTOR[ev.autor_tipo]),
    'Tipo': prop.selecao(TIPO_EVENTO[ev.tipo_evento]),
    'Data': prop.data(ev.ocorrido_em),
  }

  const { pageId, nova } = await garantirPagina('timeline_eventos', id, 'mensagens', async () => {
    // O anexo só é copiado quando a mensagem é criada (nunca em atualizações)
    const comAnexo = { ...propriedades }
    if (ev.anexo_url) {
      try {
        Object.assign(comAnexo, await prepararAnexo(ev, reclamacaoPage))
      } catch (e) {
        console.error('[notion-sync] anexo', ev.id, e)
      }
    }
    return criarPagina('mensagens', comAnexo)
  })
  if (!nova) {
    try {
      await atualizarPagina(pageId, propriedades)
    } catch (e) {
      if (!paginaApagada(e) || tentativa > 0) throw e
      await esquecerPagina('timeline_eventos', id, pageId)
      return sincronizarEvento(id, tentativa + 1)
    }
  }

  await escreverBalao(ev, reclamacaoPage)
  await marcarSincronizado('timeline_eventos', id)
  await atualizarAguardaResposta(ev.anomalia_id, reclamacaoPage)
  return pageId
}

// ─── Conversa em formato chat, dentro da página da reclamação ───
// Proprietário: balão cinzento à esquerda · Equipa: balão azul à direita · Sistema: linha discreta
function textoRico(texto, anotacoes) {
  const s = String(texto ?? '')
  const partes = []
  for (let i = 0; i < s.length && partes.length < 90; i += 2000) {
    partes.push({ type: 'text', text: { content: s.slice(i, i + 2000) }, ...(anotacoes ? { annotations: anotacoes } : {}) })
  }
  return partes
}

async function blocoDoAnexo(ev) {
  try {
    const ficheiro = await descarregar('anexos', ev.anexo_url)
    if (ficheiro.length > MAX_BYTES) return bloco.paragrafo('📎 Anexo demasiado grande para o Notion (ver no portal).')
    const nome = `anexo.${extensaoDe(ev.anexo_url) || 'bin'}`
    const uploadId = await carregarFicheiro(ficheiro, nome, mimeDe(ev.anexo_url))
    return eImagem(ev.anexo_url) ? bloco.imagem(uploadId) : bloco.ficheiro(uploadId)
  } catch (e) {
    console.error('[notion-sync] anexo no chat', ev.id, e)
    return bloco.paragrafo('📎 Não foi possível copiar o anexo (ver no portal).')
  }
}

async function blocosDoBalao(ev) {
  const quando = dataCurta(ev.ocorrido_em)

  if (ev.autor_tipo === 'sistema') {
    const texto = ev.texto || TIPO_EVENTO[ev.tipo_evento] || 'Evento'
    return [{
      object: 'block', type: 'paragraph',
      paragraph: { rich_text: textoRico(`⚙️ ${texto} · ${quando}`, { italic: true, color: 'gray' }) },
    }]
  }

  const doProprietario = ev.autor_tipo === 'proprietario'
  const conteudo = [{
    object: 'block', type: 'callout',
    callout: {
      icon: { type: 'emoji', emoji: doProprietario ? '👤' : '🏢' },
      color: doProprietario ? 'gray_background' : 'blue_background',
      rich_text: [
        ...textoRico(`${AUTOR[ev.autor_tipo] || ev.autor_tipo} · ${quando}`, { bold: true }),
        ...(ev.texto ? [{ type: 'text', text: { content: '\n' } }, ...textoRico(ev.texto)] : []),
      ],
    },
  }]
  if (ev.anexo_url) conteudo.push(await blocoDoAnexo(ev))

  const vazio = [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [] } }]
  const colunas = doProprietario ? [conteudo, vazio] : [vazio, conteudo]

  return [{
    object: 'block', type: 'column_list',
    column_list: {
      children: colunas.map((filhos) => ({ object: 'block', type: 'column', column: { children: filhos } })),
    },
  }]
}

// Escreve o balão uma única vez (reserva a linha antes, como nas páginas)
async function escreverBalao(ev, reclamacaoPage) {
  const atual = ev.notion_bloco_id
  if (atual && !atual.startsWith(PENDENTE)) return
  if (atual && Date.now() - Number(atual.slice(PENDENTE.length)) <= PRAZO_PENDENTE) return

  const marca = PENDENTE + Date.now()
  let q = db().from('timeline_eventos').update({ notion_bloco_id: marca }).eq('id', ev.id)
  q = atual ? q.eq('notion_bloco_id', atual) : q.is('notion_bloco_id', null)
  const { data: reservado } = await q.select('id')
  if (!reservado?.length) return

  try {
    const blocos = await listarBlocos(reclamacaoPage)
    const fimConversa = fimDaSecao(blocos, 'Conversa')
    if (!fimConversa) throw new Error('Secção "Conversa" não encontrada na página da reclamação')
    const ultimo = await inserirDepois(reclamacaoPage, fimConversa, await blocosDoBalao(ev))
    await db().from('timeline_eventos').update({ notion_bloco_id: ultimo }).eq('id', ev.id)
  } catch (e) {
    await db().from('timeline_eventos').update({ notion_bloco_id: null }).eq('id', ev.id).eq('notion_bloco_id', marca)
    throw e
  }
}

// Copia o anexo para a mensagem e, se for imagem, acrescenta-o à secção "Fotos" da reclamação
async function prepararAnexo(ev, reclamacaoPage) {
  const ficheiro = await descarregar('anexos', ev.anexo_url)
  if (ficheiro.length > MAX_BYTES) return {}

  const ext = extensaoDe(ev.anexo_url) || 'bin'
  const nome = `anexo.${ext}`
  const tipo = mimeDe(ev.anexo_url)

  const idAnexo = await carregarFicheiro(ficheiro, nome, tipo)

  if (eImagem(ev.anexo_url)) {
    const idFoto = await carregarFicheiro(ficheiro, nome, tipo)
    const blocos = await listarBlocos(reclamacaoPage)
    const fimFotos = fimDaSecao(blocos, 'Fotos')
    if (fimFotos) {
      const legenda = `${AUTOR[ev.autor_tipo] || ''} · ${dataCurta(ev.ocorrido_em)}`
      await inserirDepois(reclamacaoPage, fimFotos, [bloco.imagem(idFoto, legenda)])
    }
  }

  return { 'Anexo': { files: [{ name: nome, type: 'file_upload', file_upload: { id: idAnexo } }] } }
}

// "Aguarda resposta" = a última mensagem da conversa é do proprietário
async function atualizarAguardaResposta(anomaliaId, reclamacaoPage) {
  const { data: ultima } = await db().from('timeline_eventos')
    .select('autor_tipo').eq('anomalia_id', anomaliaId).eq('tipo_evento', 'mensagem')
    .order('ocorrido_em', { ascending: false }).limit(1).maybeSingle()
  await atualizarPagina(reclamacaoPage, { 'Aguarda resposta': prop.caixa(ultima?.autor_tipo === 'proprietario') })
}

// ═══════════════════ VISITAS ═══════════════════
export async function sincronizarVisita(id) {
  const v = await lerLinha('visitas', id,
    'id, anomalia_id, data_proposta, data_confirmada, tecnico, empresa_id, estado, proposta_por')
  const reclamacaoPage = await paginaDaReclamacao(v.anomalia_id)
  const empresaPage = v.empresa_id ? await sincronizarEmpresa(v.empresa_id) : null
  const quando = v.data_confirmada || v.data_proposta

  const { pageId } = await gravar('visitas', id, 'visitas', {
    'Visita': prop.titulo(`Visita · ${dataCurta(quando) || 'sem data'}`),
    'ID Portal': prop.texto(v.id),
    'Reclamação': prop.relacao([reclamacaoPage]),
    'Data da visita': prop.data(quando),
    'Data proposta': prop.data(v.data_proposta),
    'Data confirmada': prop.data(v.data_confirmada),
    'Estado': prop.selecao(ESTADO_VISITA[v.estado]),
    'Proposta por': prop.selecao(PROPOSTA_POR[v.proposta_por]),
    'Técnico': prop.texto(v.tecnico),
    'Empresa': prop.relacao(empresaPage ? [empresaPage] : []),
  })
  await marcarSincronizado('visitas', id)
  return pageId
}

// ═══════════════════ RECLAMAÇÃO COMPLETA (testes e cargas iniciais) ═══════════════════
export async function sincronizarReclamacaoCompleta(id) {
  const pageId = await sincronizarReclamacao(id)
  const { data: eventos } = await db().from('timeline_eventos')
    .select('id').eq('anomalia_id', id).order('ocorrido_em', { ascending: true })
  for (const e of eventos || []) await sincronizarEvento(e.id)
  const { data: visitas } = await db().from('visitas').select('id').eq('anomalia_id', id)
  for (const v of visitas || []) await sincronizarVisita(v.id)
  return { pageId, eventos: eventos?.length || 0, visitas: visitas?.length || 0 }
}

// ═══════════════════ ENCAMINHAMENTO POR TABELA ═══════════════════
export async function sincronizar(tabela, registo) {
  switch (tabela) {
    case 'anomalias': return sincronizarReclamacao(registo.id)
    case 'timeline_eventos': return sincronizarEvento(registo.id)
    case 'visitas': return sincronizarVisita(registo.id)
    case 'fracoes': return sincronizarFracao(registo.id)
    case 'proprietarios': return sincronizarProprietario(registo.id)
    case 'empresas': return sincronizarEmpresa(registo.id)
    case 'fracao_proprietarios': return sincronizarFracao(registo.fracao_id)
    case 'anomalia_empresas': return sincronizarReclamacao(registo.anomalia_id)
    default: throw new Error(`Tabela não suportada: ${tabela}`)
  }
}

// Linha apagada no portal → página para o lixo no Notion
// (nas tabelas de ligação, volta a sincronizar a linha "mãe")
export async function apagarRegisto(tabela, antigo) {
  if (tabela === 'fracao_proprietarios' || tabela === 'anomalia_empresas') return sincronizar(tabela, antigo)
  const pageId = antigo?.notion_page_id
  if (pageId && !pageId.startsWith(PENDENTE)) await apagarPagina(pageId)
  return pageId || null
}