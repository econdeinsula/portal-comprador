// Resumo diário e relatório semanal, publicados na base "Relatórios" do Notion.
// Os números vêm sempre do Supabase (fonte de verdade); o Notion só mostra.

import { supabaseAdmin } from './supabaseAdmin'
import { createHash } from 'crypto'
import { notion, fonteDeDados, prop, listarBlocos, inserirDepois } from './notion'

const db = () => supabaseAdmin()
const CONCLUIDOS = ['Resolvida', 'Fechada (fora de garantia)']
const DIA = 24 * 60 * 60 * 1000
const DIAS_SEM_ATIVIDADE = 15
const DIAS_GARANTIA = 30
const DIAS_GUARDAR_RESUMOS = 30

// ─── Datas em hora de Lisboa ───
const diaLisboa = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date(d))
const dataCurta = (d) => new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', day: '2-digit', month: '2-digit' }).format(new Date(d))
const horaCurta = (d) => new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
const dataLonga = (d) => new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d))

function haQuanto(iso) {
  const horas = (Date.now() - new Date(iso).getTime()) / 36e5
  if (horas < 24) return `há ${Math.max(1, Math.round(horas))} h`
  const dias = Math.floor(horas / 24)
  return `há ${dias} dia${dias === 1 ? '' : 's'}`
}
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null)
const umaCasa = (n) => (n === null ? '—' : n.toLocaleString('pt-PT', { maximumFractionDigits: 1 }))

// ─── Blocos do Notion ───
const txt = (content, anotacoes) => ({ type: 'text', text: { content: String(content).slice(0, 2000) }, ...(anotacoes ? { annotations: anotacoes } : {}) })
const titulo = (t) => ({ object: 'block', type: 'heading_2', heading_2: { rich_text: [txt(t)] } })
const paragrafo = (t, anot) => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: [txt(t, anot)] } })
const nada = () => paragrafo('Nada a assinalar.', { italic: true, color: 'gray' })
const destaque = (emoji, t, cor = 'blue_background') => ({
  object: 'block', type: 'callout', callout: { icon: { type: 'emoji', emoji }, color: cor, rich_text: [txt(t)] },
})
const tabela = (cabecalho, linhas) => ({
  object: 'block', type: 'table',
  table: {
    table_width: cabecalho.length, has_column_header: true, has_row_header: false,
    children: [cabecalho, ...linhas].map((l) => ({
      object: 'block', type: 'table_row', table_row: { cells: l.map((c) => [txt(c ?? '')]) },
    })),
  },
})

const rotulo = (r) => [r.fracao?.codigo_fracao, r.elemento?.nome || r.categoria?.nome, r.tipo?.nome].filter(Boolean).join(' · ') || 'Reclamação'

// Linha com ligação clicável para a página da reclamação
function itemReclamacao(r, detalhe) {
  const rt = []
  if (r.notion_page_id && !r.notion_page_id.startsWith('pendente:')) {
    rt.push({ type: 'mention', mention: { type: 'page', page: { id: r.notion_page_id } } })
  } else {
    rt.push(txt(rotulo(r)))
  }
  if (detalhe) rt.push(txt(` — ${detalhe}`))
  return { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: rt } }
}

function secao(nome, emoji, itens) {
  return [titulo(`${emoji} ${nome} (${itens.length})`), ...(itens.length ? itens : [nada()])]
}

// ─── Dados do Supabase ───
async function lerReclamacoes() {
  const { data, error } = await db().from('anomalias').select(`
    id, notion_page_id, criado_em, data_entrada, origem,
    estado:estados(nome), categoria:categorias(nome), elemento:elementos(nome), tipo:tipos_anomalia(nome),
    fracao:fracoes(codigo_fracao, empreendimento:empreendimentos(nome)),
    empresas:anomalia_empresas(empresa:empresas(nome))`)
  if (error) throw new Error(error.message)
  return data || []
}

async function lerEventos(ids, desde) {
  if (!ids.length) return []
  let q = db().from('timeline_eventos')
    .select('anomalia_id, autor_tipo, tipo_evento, texto, ocorrido_em')
    .in('anomalia_id', ids).order('ocorrido_em', { ascending: false })
  if (desde) q = q.gte('ocorrido_em', desde)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data || []
}

const ativa = (r) => !CONCLUIDOS.includes(r.estado?.nome)

// "Aguarda resposta": a última mensagem da conversa é do proprietário
function aguardamResposta(ativas, eventos) {
  const ultimaMsg = new Map()
  for (const e of eventos) {
    if (e.tipo_evento === 'mensagem' && !ultimaMsg.has(e.anomalia_id)) ultimaMsg.set(e.anomalia_id, e)
  }
  return ativas
    .map((r) => ({ r, e: ultimaMsg.get(r.id) }))
    .filter(({ e }) => e?.autor_tipo === 'proprietario')
    .sort((a, b) => new Date(a.e.ocorrido_em) - new Date(b.e.ocorrido_em))
}

// ─── Base "Relatórios" ───
async function consultarRelatorios(filtro) {
  const fonte = await fonteDeDados('relatorios')
  const r = await notion(`/data_sources/${fonte}/query`, { method: 'POST', body: { filter: filtro, page_size: 100 } })
  return r.results || []
}

async function apagarPaginas(paginas) {
  for (const p of paginas) await notion(`/pages/${p.id}`, { method: 'PATCH', body: { in_trash: true } })
}

async function publicar(tipo, nome, numeros, blocos) {
  const hoje = diaLisboa()

  // Se já existir um relatório do mesmo tipo para hoje (cron repetido), substitui-o
  await apagarPaginas(await consultarRelatorios({
    and: [{ property: 'Tipo', select: { equals: tipo } }, { property: 'Data', date: { equals: hoje } }],
  }))

  const fonte = await fonteDeDados('relatorios')
  const pagina = await notion('/pages', {
    method: 'POST',
    body: {
      parent: { type: 'data_source_id', data_source_id: fonte },
      icon: { type: 'emoji', emoji: tipo === 'Diário' ? '📋' : '📈' },
      properties: {
        'Relatório': prop.titulo(nome),
        'Tipo': prop.selecao(tipo),
        'Data': prop.data(hoje),
        'Novas': prop.numero(numeros.novas),
        'Resolvidas': prop.numero(numeros.resolvidas),
        'Ativas': prop.numero(numeros.ativas),
        'Aguardam resposta': prop.numero(numeros.aguardam),
      },
      children: blocos.slice(0, 100),
    },
  })
  for (let i = 100; i < blocos.length; i += 100) {
    await notion(`/blocks/${pagina.id}/children`, { method: 'PATCH', body: { children: blocos.slice(i, i + 100) } })
  }
  return pagina.id
}

// ═══════════════════ PENDENTES (usado pelo resumo diário e pelo ponto de situação) ═══════════════════
async function calcularPendentes() {
  const agora = Date.now()
  const reclamacoes = await lerReclamacoes()
  const ativas = reclamacoes.filter(ativa)
  const ids = ativas.map((r) => r.id)
  const eventos = await lerEventos(ids)
  const porId = new Map(ativas.map((r) => [r.id, r]))

  // Aguardam resposta
  const aguardam = aguardamResposta(ativas, eventos)

  // Sem atividade há 15+ dias
  const ultimoEvento = new Map()
  for (const e of eventos) if (!ultimoEvento.has(e.anomalia_id)) ultimoEvento.set(e.anomalia_id, e.ocorrido_em)
  const paradas = ativas
    .map((r) => ({ r, ultima: ultimoEvento.get(r.id) || r.criado_em }))
    .filter(({ ultima }) => agora - new Date(ultima).getTime() > DIAS_SEM_ATIVIDADE * DIA)
    .sort((a, b) => new Date(a.ultima) - new Date(b.ultima))

  // Garantia a expirar (ou já expirada) em reclamações ativas
  const { data: garantias } = ids.length
    ? await db().from('v_garantia_restante').select('anomalia_id, dias_restantes, data_fim_garantia').in('anomalia_id', ids)
    : { data: [] }
  const garantia = (garantias || [])
    .filter((g) => g.dias_restantes !== null && g.dias_restantes <= DIAS_GARANTIA)
    .sort((a, b) => a.dias_restantes - b.dias_restantes)

  // Visitas
  const { data: visitas } = ids.length
    ? await db().from('visitas')
      .select('anomalia_id, estado, proposta_por, data_proposta, data_confirmada, tecnico')
      .in('anomalia_id', ids).in('estado', ['proposta', 'confirmada'])
    : { data: [] }
  const hoje = diaLisboa()
  const amanha = diaLisboa(agora + DIA)
  const quando = (v) => v.data_confirmada || v.data_proposta
  const visitasProximas = (visitas || [])
    .filter((v) => v.estado === 'confirmada' && [hoje, amanha].includes(diaLisboa(quando(v))))
    .sort((a, b) => new Date(quando(a)) - new Date(quando(b)))
  const visitasSemana = (visitas || []).filter((v) => {
    const t = new Date(quando(v)).getTime()
    return t >= agora - 2 * 36e5 && t < agora + 7 * DIA
  })
  const porResponder = (visitas || []).filter((v) => v.estado === 'proposta' && v.proposta_por === 'proprietario')

  // Novas
  const novas = reclamacoes.filter((r) => agora - new Date(r.criado_em).getTime() < DIA)
  const novasSemana = reclamacoes.filter((r) => r.origem !== 'legado' && agora - new Date(r.criado_em).getTime() < 7 * DIA)
  const semEmpresa = ativas.filter((r) => !(r.empresas || []).length)

  return {
    agora, hoje, quando, porId, ativas, aguardam, paradas, garantia,
    visitasProximas, visitasSemana, porResponder, novas, novasSemana, semEmpresa,
  }
}

// ═══════════════════ RESUMO DIÁRIO ═══════════════════
export async function gerarResumoDiario() {
  const {
    agora, hoje, quando, porId, ativas, aguardam, paradas, garantia, visitasProximas, porResponder, novas,
  } = await calcularPendentes()

  const blocos = [
    destaque('📋',
      `${aguardam.length} aguardam resposta · ${visitasProximas.length} visitas hoje/amanhã · ` +
      `${porResponder.length} datas por aceitar · ${garantia.length} garantias a expirar · ` +
      `${paradas.length} sem atividade · ${novas.length} novas`),
    ...secao('Aguardam resposta', '💬', aguardam.map(({ r, e }) => itemReclamacao(r, `última mensagem ${haQuanto(e.ocorrido_em)}`))),
    ...secao('Visitas hoje e amanhã', '📅', visitasProximas.map((v) => itemReclamacao(porId.get(v.anomalia_id),
      `${diaLisboa(quando(v)) === hoje ? 'hoje' : 'amanhã'} às ${horaCurta(quando(v))}${v.tecnico ? ` com ${v.tecnico}` : ''}`))),
    ...secao('Datas propostas pelo proprietário por aceitar', '🗓️', porResponder.map((v) => itemReclamacao(porId.get(v.anomalia_id),
      `propôs ${dataCurta(v.data_proposta)} às ${horaCurta(v.data_proposta)}`))),
    ...secao(`Garantia a expirar (≤ ${DIAS_GARANTIA} dias)`, '⏳', garantia.map((g) => itemReclamacao(porId.get(g.anomalia_id),
      g.dias_restantes < 0 ? `garantia terminou há ${-g.dias_restantes} dias` : `faltam ${g.dias_restantes} dias (${dataCurta(g.data_fim_garantia)})`))),
    ...secao(`Sem atividade há mais de ${DIAS_SEM_ATIVIDADE} dias`, '🐢', paradas.map(({ r, ultima }) => itemReclamacao(r, `última atividade ${haQuanto(ultima)}`))),
    ...secao('Novas nas últimas 24 horas', '🆕', novas.map((r) => itemReclamacao(r, `registada às ${horaCurta(r.criado_em)}`))),
  ]

  const nome = `Resumo de ${dataLonga(agora)}`
  const pageId = await publicar('Diário', nome, {
    novas: novas.length, resolvidas: null, ativas: ativas.length, aguardam: aguardam.length,
  }, blocos)

  // Limpeza: resumos diários com mais de 30 dias vão para o lixo
  const limite = diaLisboa(agora - DIAS_GUARDAR_RESUMOS * DIA)
  await apagarPaginas(await consultarRelatorios({
    and: [{ property: 'Tipo', select: { equals: 'Diário' } }, { property: 'Data', date: { before: limite } }],
  }))

  return { publicado: nome, pageId }
}

// ═══════════════════ RELATÓRIO SEMANAL ═══════════════════
const estadoDoEvento = (texto) => (texto || '').match(/Estado alterado para "([^"]+)"/)?.[1] || null

function resumoSemana(reclamacoes, eventos, inicio, fim) {
  const dentro = (d) => { const t = new Date(d).getTime(); return t >= inicio && t < fim }
  const porId = new Map(reclamacoes.map((r) => [r.id, r]))

  const novas = reclamacoes.filter((r) => r.origem !== 'legado' && dentro(r.criado_em))

  // Fechos: mudanças de estado para Resolvida/Fechada dentro do período (uma por reclamação)
  const fechos = new Map()
  for (const e of eventos) {
    if (e.tipo_evento !== 'mudanca_estado' || !dentro(e.ocorrido_em)) continue
    if (CONCLUIDOS.includes(estadoDoEvento(e.texto)) && !fechos.has(e.anomalia_id)) fechos.set(e.anomalia_id, e.ocorrido_em)
  }
  const diasAteFechar = [...fechos.entries()].map(([id, quando]) => {
    const r = porId.get(id)
    const inicioR = r?.data_entrada || r?.criado_em
    return inicioR ? (new Date(quando) - new Date(inicioR)) / DIA : null
  }).filter((n) => n !== null && n >= 0)

  // Tempo até à primeira resposta da equipa, nas reclamações novas do período
  const horasPrimeiraResposta = novas.map((r) => {
    const respostas = eventos
      .filter((e) => e.anomalia_id === r.id && e.autor_tipo === 'equipa' && e.tipo_evento === 'mensagem')
      .map((e) => new Date(e.ocorrido_em).getTime())
      .filter((t) => t >= new Date(r.criado_em).getTime())
    return respostas.length ? (Math.min(...respostas) - new Date(r.criado_em).getTime()) / 36e5 : null
  }).filter((n) => n !== null)

  return {
    novas: novas.length,
    fechadas: fechos.size,
    mediaDiasFecho: media(diasAteFechar),
    mediaHorasResposta: media(horasPrimeiraResposta),
    semResposta: novas.length - horasPrimeiraResposta.length,
  }
}

export async function gerarRelatorioSemanal() {
  const agora = Date.now()
  const fim = agora
  const inicio = agora - 7 * DIA
  const inicioAnterior = inicio - 7 * DIA

  const reclamacoes = await lerReclamacoes()
  const ativas = reclamacoes.filter(ativa)
  const eventos = await lerEventos(reclamacoes.map((r) => r.id), new Date(inicioAnterior - 60 * DIA).toISOString())

  const semana = resumoSemana(reclamacoes, eventos, inicio, fim)
  const anterior = resumoSemana(reclamacoes, eventos, inicioAnterior, inicio)
  const aguardam = aguardamResposta(ativas, eventos)

  const variacao = (a, b) => (a === b ? '=' : a > b ? `▲ ${a - b}` : `▼ ${b - a}`)

  // Ativas por estado e por empreendimento
  const contar = (lista, chave) => {
    const m = new Map()
    for (const x of lista) { const k = chave(x) || '—'; m.set(k, (m.get(k) || 0) + 1) }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }
  const porEstado = contar(ativas, (r) => r.estado?.nome)
  const porEmpreendimento = contar(ativas, (r) => r.fracao?.empreendimento?.nome)
  const porCategoria = contar(ativas, (r) => r.categoria?.nome)

  // Empresas com mais reclamações ativas
  const empresas = new Map()
  for (const r of ativas) for (const e of r.empresas || []) {
    const nome = e.empresa?.nome
    if (nome) empresas.set(nome, (empresas.get(nome) || 0) + 1)
  }
  const rankingEmpresas = [...empresas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  const semEmpresa = ativas.filter((r) => !(r.empresas || []).length).length

  const periodo = `${dataCurta(inicio)} a ${dataCurta(fim - DIA)}`
  const blocos = [
    destaque('📈',
      `Semana de ${periodo}: ${semana.novas} novas, ${semana.fechadas} resolvidas/fechadas, ` +
      `${ativas.length} ativas no fim da semana, ${aguardam.length} a aguardar resposta.`),

    titulo('📊 A semana em números'),
    tabela(['Indicador', 'Esta semana', 'Semana anterior', 'Variação'], [
      ['Reclamações novas', semana.novas, anterior.novas, variacao(semana.novas, anterior.novas)],
      ['Resolvidas ou fechadas', semana.fechadas, anterior.fechadas, variacao(semana.fechadas, anterior.fechadas)],
      ['Tempo médio até fechar (dias)', umaCasa(semana.mediaDiasFecho), umaCasa(anterior.mediaDiasFecho), ''],
      ['Tempo médio até 1.ª resposta (horas)', umaCasa(semana.mediaHorasResposta), umaCasa(anterior.mediaHorasResposta), ''],
      ['Novas ainda sem resposta da equipa', semana.semResposta, anterior.semResposta, ''],
    ].map((l) => l.map(String))),

    titulo(`📌 Ativas por estado (${ativas.length})`),
    porEstado.length ? tabela(['Estado', 'Reclamações'], porEstado.map(([k, v]) => [k, String(v)])) : nada(),

    titulo('🏢 Ativas por empreendimento'),
    porEmpreendimento.length ? tabela(['Empreendimento', 'Reclamações'], porEmpreendimento.map(([k, v]) => [k, String(v)])) : nada(),

    titulo('🧩 Ativas por categoria'),
    porCategoria.length ? tabela(['Categoria', 'Reclamações'], porCategoria.map(([k, v]) => [k, String(v)])) : nada(),

    titulo('🏗️ Empresas com mais reclamações ativas'),
    rankingEmpresas.length ? tabela(['Empresa', 'Ativas'], rankingEmpresas.map(([k, v]) => [k, String(v)])) : nada(),
    paragrafo(`${semEmpresa} reclamações ativas ainda sem empresa atribuída.`, { color: 'gray' }),

    ...secao('A aguardar resposta neste momento', '💬', aguardam.map(({ r, e }) => itemReclamacao(r, `última mensagem ${haQuanto(e.ocorrido_em)}`))),
  ]

  const nome = `Relatório semanal · ${periodo}`
  const pageId = await publicar('Semanal', nome, {
    novas: semana.novas, resolvidas: semana.fechadas, ativas: ativas.length, aguardam: aguardam.length,
  }, blocos)
  return { publicado: nome, pageId }
}


// ═══════════════════ PONTO DE SITUAÇÃO (página inicial) ═══════════════════
// O portal escreve os blocos entre o título "Ponto de situação" e o título seguinte da página inicial.
// Só reescreve tudo quando os dados mudam; caso contrário atualiza apenas a hora.

const TITULO_SITUACAO = 'Ponto de situação'
const MAX_ITENS_ATENCAO = 12

async function lerEstado(chave) {
  const { data } = await db().from('notion_estado').select('valor').eq('chave', chave).maybeSingle()
  return data?.valor ?? null
}
async function gravarEstado(chave, valor) {
  const { error } = await db().from('notion_estado').upsert({ chave, valor, atualizado_em: new Date().toISOString() })
  if (error) throw new Error(`notion_estado: ${error.message}`)
}

function cartao(emoji, numero, legenda, cor) {
  return {
    object: 'block', type: 'column',
    column: {
      children: [{
        object: 'block', type: 'callout',
        callout: {
          icon: { type: 'emoji', emoji },
          color: cor,
          rich_text: [txt(String(numero), { bold: true }), txt(`\n${legenda}`)],
        },
      }],
    },
  }
}

function itemAtencao(emoji, r, detalhe) {
  const rt = [txt(`${emoji} `)]
  if (r?.notion_page_id && !r.notion_page_id.startsWith('pendente:')) {
    rt.push({ type: 'mention', mention: { type: 'page', page: { id: r.notion_page_id } } })
  } else {
    rt.push(txt(r ? rotulo(r) : 'Reclamação'))
  }
  if (detalhe) rt.push(txt(` — ${detalhe}`))
  return { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: rt } }
}

export async function gerarPontoDeSituacao() {
  const pagina = process.env.NOTION_PAGINA_INICIO
  if (!pagina) throw new Error('Falta NOTION_PAGINA_INICIO na Vercel')

  const d = await calcularPendentes()

  // Quatro números
  const cartoes = {
    object: 'block', type: 'column_list',
    column_list: {
      children: [
        cartao('💬', d.aguardam.length, 'por responder',
          d.aguardam.length ? 'red_background' : 'gray_background'),
        cartao('📋', d.ativas.length, `ativas · +${d.novasSemana.length} esta semana`, 'blue_background'),
        cartao('📅', d.visitasSemana.length, 'visitas em 7 dias', 'green_background'),
        cartao('⏳', d.garantia.length, 'garantias a expirar',
          d.garantia.length ? 'orange_background' : 'gray_background'),
      ],
    },
  }

  // Lista "Precisa de atenção", por prioridade
  const itens = [
    ...d.aguardam.map(({ r, e }) => itemAtencao('💬', r, `aguarda resposta ${haQuanto(e.ocorrido_em)}`)),
    ...d.porResponder.map((v) => itemAtencao('🗓️', d.porId.get(v.anomalia_id),
      `proprietário propôs ${dataCurta(v.data_proposta)} às ${horaCurta(v.data_proposta)}, por aceitar`)),
    ...d.visitasProximas.map((v) => itemAtencao('📅', d.porId.get(v.anomalia_id),
      `visita ${diaLisboa(d.quando(v)) === d.hoje ? 'hoje' : 'amanhã'} às ${horaCurta(d.quando(v))}${v.tecnico ? ` com ${v.tecnico}` : ''}`)),
    ...d.garantia.map((g) => itemAtencao('⏳', d.porId.get(g.anomalia_id),
      g.dias_restantes < 0 ? `garantia terminou há ${-g.dias_restantes} dias` : `garantia acaba em ${g.dias_restantes} dias (${dataCurta(g.data_fim_garantia)})`)),
    ...d.paradas.map(({ r, ultima }) => itemAtencao('🐢', r, `sem atividade ${haQuanto(ultima)}`)),
  ]

  const conteudo = [
    cartoes,
    paragrafo('✋ Precisa de atenção', { bold: true }),
    ...(itens.length
      ? itens.slice(0, MAX_ITENS_ATENCAO)
      : [paragrafo('✅ Nada pendente. Está tudo em dia.', { color: 'green' })]),
    ...(itens.length > MAX_ITENS_ATENCAO
      ? [paragrafo(`… e mais ${itens.length - MAX_ITENS_ATENCAO}. Ver o resumo diário em Relatórios.`, { color: 'gray' })]
      : []),
    ...(d.semEmpresa.length
      ? [paragrafo(`🏗️ ${d.semEmpresa.length} ${d.semEmpresa.length === 1 ? 'reclamação ativa ainda sem empresa atribuída' : 'reclamações ativas ainda sem empresa atribuída'}.`, { color: 'gray' })]
      : []),
  ]
  return escreverSecao(pagina, TITULO_SITUACAO, { antesDaHora: [conteudo[0]], depoisDaHora: conteudo.slice(1), chave: 'situacao', agora: d.agora, extra: { atencao: itens.length } })
}

// ─── Escrever uma secção de uma página: do título indicado até ao título seguinte ───
// Só reescreve quando o conteúdo muda; caso contrário atualiza apenas a hora.
const PREFIXO_HORA = 'Atualizado às'

async function escreverSecao(pagina, titulo, { antesDaHora = [], depoisDaHora = [], chave, agora = Date.now(), extra = {} }) {
  const hora = paragrafo(`${PREFIXO_HORA} ${horaCurta(agora)}`, { italic: true, color: 'gray' })
  const assinatura = createHash('sha1').update(JSON.stringify([antesDaHora, depoisDaHora])).digest('hex')

  const blocos = await listarBlocos(pagina)
  const textoDe = (b) => (b?.[b.type]?.rich_text || []).map((t) => t.plain_text).join('').trim()
  const i = blocos.findIndex((b) => b.type?.startsWith('heading') && textoDe(b).includes(titulo))
  if (i < 0) throw new Error(`Não encontrei o título "${titulo}" na página`)
  let j = i + 1
  while (j < blocos.length && !blocos[j].type?.startsWith('heading')) j++
  const existentes = blocos.slice(i + 1, j)
  const blocoHora = existentes.find((b) => b.type === 'paragraph' && textoDe(b).startsWith(PREFIXO_HORA))

  if (blocoHora && (await lerEstado(`${chave}_assinatura`)) === assinatura) {
    await notion(`/blocks/${blocoHora.id}`, { method: 'PATCH', body: { paragraph: hora.paragraph } })
    return { atualizado: 'hora', ...extra }
  }

  for (const b of existentes) await notion(`/blocks/${b.id}`, { method: 'DELETE' })
  await inserirDepois(pagina, blocos[i].id, [...antesDaHora, hora, ...depoisDaHora])
  await gravarEstado(`${chave}_assinatura`, assinatura)
  return { atualizado: 'tudo', ...extra }
}

// ═══════════════════ ESTATÍSTICAS: defeitos repetidos ═══════════════════
const TITULO_DEFEITOS = 'Defeitos repetidos'
const MIN_FRACOES = 2

export async function gerarEstatisticas() {
  const pagina = process.env.NOTION_PAGINA_ESTATISTICAS
  if (!pagina) throw new Error('Falta NOTION_PAGINA_ESTATISTICAS na Vercel')

  const reclamacoes = await lerReclamacoes()
  const grupos = new Map()
  for (const r of reclamacoes) {
    if (!r.elemento?.nome || !r.tipo?.nome) continue
    const chave = `${r.elemento.nome} · ${r.tipo.nome}`
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave).push(r)
  }

  const repetidos = [...grupos.entries()]
    .map(([defeito, lista]) => ({
      defeito,
      lista,
      fracoes: [...new Set(lista.map((r) => r.fracao?.codigo_fracao).filter(Boolean))].sort(),
      ativas: lista.filter(ativa).length,
      empreendimentos: [...new Set(lista.map((r) => r.fracao?.empreendimento?.nome).filter(Boolean))],
    }))
    .filter((g) => g.fracoes.length >= MIN_FRACOES)
    .sort((a, b) => b.fracoes.length - a.fracoes.length || b.ativas - a.ativas)

  const blocosDefeitos = repetidos.length
    ? repetidos.map((g) => ({
      object: 'block', type: 'toggle',
      toggle: {
        rich_text: [
          txt(`${g.defeito}`, { bold: true }),
          txt(` — ${g.fracoes.length} frações (${g.fracoes.join(', ')})`),
          txt(` · ${g.ativas} ${g.ativas === 1 ? 'ativa' : 'ativas'}`, { color: g.ativas ? 'orange' : 'gray' }),
          ...(g.empreendimentos.length > 1 ? [txt(` · ${g.empreendimentos.join(', ')}`, { color: 'gray' })] : []),
        ],
        children: g.lista.slice(0, 50).map((r) => itemReclamacao(r, r.estado?.nome)),
      },
    }))
    : [paragrafo('✅ Nenhum defeito repetido em mais do que uma fração.', { color: 'green' })]

  return escreverSecao(pagina, TITULO_DEFEITOS, {
    antesDaHora: [paragrafo(`O mesmo elemento com o mesmo tipo de problema em ${MIN_FRACOES} ou mais frações. Pode indicar um defeito de lote e não um caso isolado. Abra cada linha para ver as reclamações.`, { color: 'gray' })],
    depoisDaHora: blocosDefeitos,
    chave: 'defeitos',
    extra: { repetidos: repetidos.length },
  })
}