import { createClient } from '@supabase/supabase-js'

function clienteAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

function verificar(resultado, etiqueta) {
  if (resultado.error) throw new Error(`${etiqueta}: ${resultado.error.message}`)
}

function blocos(lista, tamanho = 100) {
  const partes = []
  for (let i = 0; i < lista.length; i += tamanho) partes.push(lista.slice(i, i + tamanho))
  return partes
}

async function buscarEmBlocos(admin, tabela, coluna, ids, campos) {
  const resultado = []
  for (const bloco of blocos(ids)) {
    const r = await admin.from(tabela).select(campos).in(coluna, bloco)
    verificar(r, tabela)
    resultado.push(...(r.data || []))
  }
  return resultado
}

// Só deixa passar membros da equipa (o token vem do browser de quem faz o pedido)
async function verificarEquipa(admin, req) {
  const cabecalho = req.headers.get('authorization') || ''
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : null
  if (!token) return null

  const { data, error } = await admin.auth.getUser(token)
  const email = data?.user?.email
  if (error || !email) return null

  const { data: membro } = await admin
    .from('membros_equipa').select('email').eq('email', email.toLowerCase()).maybeSingle()
  return membro ? data.user : null
}

async function procurarUtilizador(admin, email) {
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 1000 })
    if (error) return null
    const encontrado = data.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase())
    if (encontrado) return encontrado
    if (data.users.length < 1000) return null
  }
  return null
}

async function linksTemporarios(admin, bucket, caminhos) {
  const unicos = [...new Set(caminhos.filter(Boolean))]
  if (unicos.length === 0) return {}
  const { data } = await admin.storage.from(bucket).createSignedUrls(unicos, 60 * 60 * 24)
  const mapa = {}
  for (const item of data || []) if (item.signedUrl) mapa[item.path] = item.signedUrl
  return mapa
}

async function anomaliasDe(admin, fracaoIds) {
  return buscarEmBlocos(
    admin, 'anomalias', 'fracao_id', fracaoIds,
    'id, fracao_id, descricao, criado_em, pin_x, pin_y, estados ( nome ), categorias ( nome ), elementos ( nome )'
  )
}

export async function POST(req) {
  try {
    const admin = clienteAdmin()

    const utilizador = await verificarEquipa(admin, req)
    if (!utilizador) return Response.json({ erro: 'Sem permissão' }, { status: 403 })

    const { acao, proprietarioId, incluirReclamacoes } = await req.json()
    if (!proprietarioId || !['exportar', 'apagar'].includes(acao)) {
      return Response.json({ erro: 'Pedido inválido' }, { status: 400 })
    }

    const { data: proprietario } = await admin
      .from('proprietarios').select('id, nome, email').eq('id', proprietarioId).maybeSingle()
    if (!proprietario) return Response.json({ erro: 'Proprietário não encontrado' }, { status: 404 })

    const { data: ligacoes } = await admin
      .from('fracao_proprietarios')
      .select('fracao_id, fracoes ( id, codigo_fracao, empreendimentos ( lote ) )')
      .eq('proprietario_id', proprietarioId)

    const fracaoIds = (ligacoes || []).map((l) => l.fracao_id)

    // quantos proprietários tem cada fração (para não apagar o que é partilhado)
    const contagemPorFracao = {}
    if (fracaoIds.length > 0) {
      const todas = await buscarEmBlocos(admin, 'fracao_proprietarios', 'fracao_id', fracaoIds, 'fracao_id')
      for (const l of todas) contagemPorFracao[l.fracao_id] = (contagemPorFracao[l.fracao_id] || 0) + 1
    }
    const exclusivas = fracaoIds.filter((id) => contagemPorFracao[id] === 1)
    const partilhadas = fracaoIds.filter((id) => contagemPorFracao[id] > 1)

    // ---------------- EXPORTAR ----------------
    if (acao === 'exportar') {
      const anomalias = await anomaliasDe(admin, fracaoIds)
      const idsAnomalias = anomalias.map((a) => a.id)

      const eventos = await buscarEmBlocos(
        admin, 'timeline_eventos', 'anomalia_id', idsAnomalias,
        'id, anomalia_id, autor_tipo, tipo_evento, texto, anexo_url, ocorrido_em'
      )
      const visitas = await buscarEmBlocos(
        admin, 'visitas', 'anomalia_id', idsAnomalias,
        'id, anomalia_id, data_proposta, tecnico, estado, proposta_por, criado_em'
      )
      const documentos = await buscarEmBlocos(
        admin, 'documentos', 'fracao_id', fracaoIds,
        'id, fracao_id, tipo, nome, ficheiro_url, carregado_em'
      )

      const linksAnexos = await linksTemporarios(admin, 'anexos', eventos.map((e) => e.anexo_url))
      const linksDocumentos = await linksTemporarios(admin, 'documentos', documentos.map((d) => d.ficheiro_url))

      const codigoPorFracao = {}
      for (const l of ligacoes || []) codigoPorFracao[l.fracao_id] = l.fracoes?.codigo_fracao

      const mensagensPor = {}
      for (const ev of eventos) (mensagensPor[ev.anomalia_id] ||= []).push(ev)
      const visitasPor = {}
      for (const v of visitas) (visitasPor[v.anomalia_id] ||= []).push(v)

      return Response.json({
        exportado_em: new Date().toISOString(),
        aviso: partilhadas.length > 0
          ? 'Algumas frações têm mais do que um proprietário. As reclamações dessas frações são partilhadas e incluem mensagens que podem ter sido escritas por outra pessoa.'
          : null,
        proprietario,
        fracoes: (ligacoes || []).map((l) => ({
          id: l.fracao_id,
          codigo: l.fracoes?.codigo_fracao,
          lote: l.fracoes?.empreendimentos?.lote,
          proprietarios_na_fracao: contagemPorFracao[l.fracao_id] || 1,
        })),
        reclamacoes: anomalias.map((a) => ({
          id: a.id,
          fracao: codigoPorFracao[a.fracao_id],
          criada_em: a.criado_em,
          categoria: a.categorias?.nome || null,
          elemento: a.elementos?.nome || null,
          estado: a.estados?.nome || null,
          descricao: a.descricao,
          posicao_na_planta: a.pin_x != null ? { x: a.pin_x, y: a.pin_y } : null,
          mensagens: (mensagensPor[a.id] || []).map((m) => ({
            data: m.ocorrido_em,
            autor: m.autor_tipo,
            tipo: m.tipo_evento,
            texto: m.texto,
            ficheiro: m.anexo_url
              ? { caminho: m.anexo_url, link_temporario_24h: linksAnexos[m.anexo_url] || null }
              : null,
          })),
          visitas: visitasPor[a.id] || [],
        })),
        documentos_das_fracoes: documentos.map((d) => ({
          tipo: d.tipo,
          nome: d.nome,
          carregado_em: d.carregado_em,
          link_temporario_24h: linksDocumentos[d.ficheiro_url] || null,
        })),
      })
    }

    // ---------------- APAGAR ----------------
    const relatorio = {
      reclamacoes_apagadas: 0,
      ficheiros_apagados: 0,
      fracoes_partilhadas_ignoradas: partilhadas.length,
      conta_apagada: false,
      conta_mantida_motivo: null,
    }

    // 1) opcional: reclamações, mensagens e fotos das frações onde é o único proprietário
    if (incluirReclamacoes && exclusivas.length > 0) {
      const anomalias = await anomaliasDe(admin, exclusivas)
      const idsAnomalias = anomalias.map((a) => a.id)

      for (const idAnomalia of idsAnomalias) {
        const { data: lista } = await admin.storage.from('anexos').list(idAnomalia, { limit: 1000 })
        const caminhos = (lista || [])
          .filter((f) => f.name && f.name !== '.emptyFolderPlaceholder')
          .map((f) => `${idAnomalia}/${f.name}`)
        if (caminhos.length > 0) {
          const { error } = await admin.storage.from('anexos').remove(caminhos)
          if (!error) relatorio.ficheiros_apagados += caminhos.length
        }
      }

      for (const bloco of blocos(idsAnomalias)) {
        verificar(await admin.from('timeline_eventos').delete().in('anomalia_id', bloco), 'timeline_eventos')
        verificar(await admin.from('visitas').delete().in('anomalia_id', bloco), 'visitas')
        verificar(await admin.from('anomalia_empresas').delete().in('anomalia_id', bloco), 'anomalia_empresas')
        verificar(await admin.from('anomalias').delete().in('id', bloco), 'anomalias')
      }
      relatorio.reclamacoes_apagadas = idsAnomalias.length
    }

    // 2) ligações e registo do proprietário
    verificar(await admin.from('fracao_proprietarios').delete().eq('proprietario_id', proprietarioId), 'fracao_proprietarios')
    verificar(await admin.from('proprietarios').delete().eq('id', proprietarioId), 'proprietarios')

    // 3) conta de login (nunca se for também membro da equipa)
    const emailProp = (proprietario.email || '').toLowerCase()
    const { data: eEquipa } = await admin
      .from('membros_equipa').select('email').eq('email', emailProp).maybeSingle()

    if (eEquipa) {
      relatorio.conta_mantida_motivo = 'O email também pertence a um membro da equipa, por isso a conta de login foi mantida.'
    } else {
      const conta = await procurarUtilizador(admin, emailProp)
      if (!conta) {
        relatorio.conta_mantida_motivo = 'Não existia conta de login para este email.'
      } else {
        const { error } = await admin.auth.admin.deleteUser(conta.id)
        if (error) relatorio.conta_mantida_motivo = 'Não foi possível apagar a conta de login: ' + error.message
        else relatorio.conta_apagada = true
      }
    }

    return Response.json({ sucesso: true, relatorio })
  } catch (e) {
    return Response.json({ erro: e.message }, { status: 500 })
  }
}