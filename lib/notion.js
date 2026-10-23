// Cliente mínimo da API do Notion, sem dependências externas.
// Usado só do lado do servidor (rotas em app/api/...).

const NOTION_VERSION = '2026-03-11'
const API = 'https://api.notion.com/v1'

// IDs das bases (vêm das variáveis da Vercel)
export const BASES = {
  empresas: process.env.NOTION_DB_EMPRESAS,
  proprietarios: process.env.NOTION_DB_PROPRIETARIOS,
  fracoes: process.env.NOTION_DB_FRACOES,
  reclamacoes: process.env.NOTION_DB_RECLAMACOES,
  visitas: process.env.NOTION_DB_VISITAS,
  mensagens: process.env.NOTION_DB_MENSAGENS,
  relatorios: process.env.NOTION_DB_RELATORIOS,
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

function chaveApi() {
  const chave = process.env.NOTION_API_KEY
  if (!chave) throw new Error('Falta NOTION_API_KEY na Vercel')
  return chave
}

// ─── Pedido genérico, com novas tentativas em 429 (limite) e erros 5xx ───
export async function notion(caminho, { method = 'GET', body, tentativas = 4 } = {}) {
  for (let i = 0; ; i++) {
    const res = await fetch(`${API}${caminho}`, {
      method,
      headers: {
        Authorization: `Bearer ${chaveApi()}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    })

    if (res.ok) return res.status === 204 ? null : res.json()

    const repetir = res.status === 429 || res.status >= 500
    if (repetir && i < tentativas - 1) {
      const retryAfter = Number(res.headers.get('retry-after'))
      await esperar(retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** i)
      continue
    }

    let detalhe = ''
    try { detalhe = (await res.json()).message } catch {}
    throw new Error(`Notion ${method} ${caminho} → ${res.status}: ${detalhe}`)
  }
}

// ─── Fonte de dados de cada base (a API nova escreve nas "data sources") ───
const cacheFontes = {}

export async function fonteDeDados(base) {
  if (cacheFontes[base]) return cacheFontes[base]
  const dbId = BASES[base]
  if (!dbId) throw new Error(`Falta o ID da base "${base}" nas variáveis da Vercel`)
  const db = await notion(`/databases/${dbId}`)
  const id = db.data_sources?.[0]?.id
  if (!id) throw new Error(`A base "${base}" não tem fonte de dados`)
  cacheFontes[base] = id
  return id
}

// ─── Construtores de propriedades ───
const LIMITE_TEXTO = 2000

function fatiar(texto) {
  const s = String(texto ?? '')
  const partes = []
  for (let i = 0; i < s.length && partes.length < 100; i += LIMITE_TEXTO) {
    partes.push({ type: 'text', text: { content: s.slice(i, i + LIMITE_TEXTO) } })
  }
  return partes
}

export const prop = {
  titulo: (t) => ({ title: fatiar(t || 'Sem título') }),
  texto: (t) => ({ rich_text: t ? fatiar(t) : [] }),
  // as opções de seleção não podem ter vírgulas
  selecao: (v) => ({ select: v ? { name: String(v).replace(/,/g, ' ').slice(0, 100) } : null }),
  estado: (v) => ({ status: v ? { name: v } : null }),
  data: (v) => ({ date: v ? { start: String(v) } : null }),
  numero: (n) => ({ number: n === null || n === undefined || n === '' ? null : Number(n) }),
  caixa: (b) => ({ checkbox: !!b }),
  url: (u) => ({ url: u || null }),
  email: (e) => ({ email: e || null }),
  telefone: (t) => ({ phone_number: t || null }),
  relacao: (ids) => ({ relation: (ids || []).filter(Boolean).map((id) => ({ id })) }),
}

// ─── Páginas ───
export async function criarPagina(base, propriedades, { comTemplate = false } = {}) {
  const fonte = await fonteDeDados(base)
  const corpo = {
    parent: { type: 'data_source_id', data_source_id: fonte },
    properties: propriedades,
  }
  if (comTemplate) corpo.template = { type: 'default' }
  return notion('/pages', { method: 'POST', body: corpo })
}

export async function atualizarPagina(pageId, propriedades) {
  return notion(`/pages/${pageId}`, { method: 'PATCH', body: { properties: propriedades } })
}

export async function apagarPagina(pageId) {
  return notion(`/pages/${pageId}`, { method: 'PATCH', body: { in_trash: true } })
}

// Rede de segurança contra duplicados: procura uma página pelo ID do portal
export async function procurarPorIdPortal(base, idPortal) {
  const fonte = await fonteDeDados(base)
  const r = await notion(`/data_sources/${fonte}/query`, {
    method: 'POST',
    body: { filter: { property: 'ID Portal', rich_text: { equals: String(idPortal) } }, page_size: 1 },
  })
  return r.results?.[0] || null
}

// ─── Blocos (conteúdo das páginas) ───
export async function listarBlocos(blockId) {
  const todos = []
  let cursor = null
  do {
    const q = cursor ? `?page_size=100&start_cursor=${cursor}` : '?page_size=100'
    const r = await notion(`/blocks/${blockId}/children${q}`)
    todos.push(...r.results)
    cursor = r.has_more ? r.next_cursor : null
  } while (cursor)
  return todos
}

function textoDoBloco(b) {
  const dados = b?.[b.type]
  return (dados?.rich_text || []).map((t) => t.plain_text).join('').trim()
}

export function encontrarTitulo(blocos, titulo) {
  return blocos.find((b) => b.type?.startsWith('heading') && textoDoBloco(b) === titulo) || null
}

// O template é aplicado de forma assíncrona: espera até aparecer o título indicado
export async function esperarTemplate(pageId, { titulo = 'Descrição', tentativas = 10 } = {}) {
  for (let i = 0; i < tentativas; i++) {
    const blocos = await listarBlocos(pageId)
    if (encontrarTitulo(blocos, titulo)) return blocos
    await esperar(1000)
  }
  throw new Error(`O template não foi aplicado a tempo na página ${pageId}`)
}

// Insere blocos logo a seguir a um bloco (ex.: a seguir ao título "Descrição"), mantendo a ordem.
// Os lotes de 100 são inseridos do último para o primeiro, todos depois da mesma âncora,
// para não depender do que a API devolve. Devolve o ID do primeiro bloco inserido (ou null).
export async function inserirDepois(paginaId, depoisDeBlocoId, filhos) {
  const lotes = []
  for (let i = 0; i < filhos.length; i += 100) lotes.push(filhos.slice(i, i + 100))
  let primeiro = null
  for (let k = lotes.length - 1; k >= 0; k--) {
    const r = await notion(`/blocks/${paginaId}/children`, {
      method: 'PATCH',
      body: { children: lotes[k], position: { type: 'after_block', after_block: { id: depoisDeBlocoId } } },
    })
    if (k === 0 && r?.results?.length === lotes[0].length) primeiro = r.results[0].id
  }
  return primeiro
}

export const bloco = {
  paragrafo: (t) => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: fatiar(t) } }),
  imagem: (fileUploadId, legenda) => ({
    object: 'block',
    type: 'image',
    image: { type: 'file_upload', file_upload: { id: fileUploadId }, caption: legenda ? fatiar(legenda) : [] },
  }),
  ficheiro: (fileUploadId, legenda) => ({
    object: 'block',
    type: 'file',
    file: { type: 'file_upload', file_upload: { id: fileUploadId }, caption: legenda ? fatiar(legenda) : [] },
  }),
}

// ─── Carregar um ficheiro para o Notion (até 20 MB) e devolver o ID do upload ───
export async function carregarFicheiro(buffer, nome, tipo) {
  const criado = await notion('/file_uploads', {
    method: 'POST',
    body: { filename: nome, content_type: tipo },
  })

  const form = new FormData()
  form.append('file', new Blob([buffer], { type: tipo }), nome)

  const res = await fetch(`${API}/file_uploads/${criado.id}/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${chaveApi()}`, 'Notion-Version': NOTION_VERSION },
    body: form,
  })
  if (!res.ok) {
    let detalhe = ''
    try { detalhe = (await res.json()).message } catch {}
    throw new Error(`Falha ao carregar "${nome}" para o Notion → ${res.status}: ${detalhe}`)
  }
  return criado.id
}