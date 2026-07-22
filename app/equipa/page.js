'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Link from 'next/link'

function EtiquetaEstado({ nome }) {
  const cores = {
    'Aberta': { bg: '#F6E4DF', cor: '#B4462F' },
    'Resolvida': { bg: '#E5EEE6', cor: '#4B7A51' },
    'Em análise': { bg: '#F7EBD6', cor: '#C8862B' },
    'Agendada': { bg: '#E4EEF3', cor: '#2B5876' },
  }
  const c = cores[nome] || { bg: '#F3F1EA', cor: '#6B7178' }
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap',
      background: c.bg, color: c.cor,
    }}>
      {nome}
    </span>
  )
}

export default function PainelEquipa() {
  const [anomalias, setAnomalias] = useState([])
  const [categorias, setCategorias] = useState([])
  const [estados, setEstados] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [semAcesso, setSemAcesso] = useState(false)

  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroFracao, setFiltroFracao] = useState('')
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [filtroTexto, setFiltroTexto] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [pagina, setPagina] = useState(0)
  const [totalResultados, setTotalResultados] = useState(0)

  useEffect(() => {
    async function carregarListas() {
      const { data: cats } = await supabase.from('categorias').select('id, nome').order('nome')
      const { data: ests } = await supabase.from('estados').select('id, nome').order('ordem')
      const { data: emps } = await supabase.from('empresas').select('id, nome').order('nome')
      setCategorias(cats || [])
      setEstados(ests || [])
      setEmpresas(emps || [])
    }
    carregarListas()
  }, [])

  async function carregarAnomalias() {
    setCarregando(true)

    let idsFracao = null
    if (filtroFracao) {
      const { data: fracao } = await supabase
        .from('fracoes')
        .select('id')
        .ilike('codigo_fracao', filtroFracao.trim())
        .maybeSingle()
      idsFracao = fracao ? [fracao.id] : []
    }

    let idsAnomaliaEmpresa = null
    if (filtroEmpresa) {
      const { data: ligacoes } = await supabase
        .from('anomalia_empresas')
        .select('anomalia_id')
        .eq('empresa_id', filtroEmpresa)
      idsAnomaliaEmpresa = (ligacoes || []).map((l) => l.anomalia_id)
    }

    const POR_PAGINA = 50
    const inicio = pagina * POR_PAGINA
    const fim = inicio + POR_PAGINA - 1

    let query = supabase
      .from('anomalias')
      .select(`
        id,
        descricao,
        criado_em,
        estados ( id, nome ),
        elementos ( nome ),
        categorias ( id, nome ),
        fracoes ( codigo_fracao )
      `, { count: 'exact' })
      .order('criado_em', { ascending: false })
      .range(inicio, fim)

    if (filtroCategoria === 'sem') query = query.is('categoria_id', null)
    else if (filtroCategoria) query = query.eq('categoria_id', filtroCategoria)
    if (filtroEstado) query = query.eq('estado_id', filtroEstado)
    if (filtroTexto) query = query.ilike('descricao', `%${filtroTexto}%`)
    if (dataInicio) query = query.gte('criado_em', dataInicio)
    if (dataFim) query = query.lte('criado_em', dataFim + 'T23:59:59')
    if (idsFracao !== null) query = query.in('fracao_id', idsFracao)
    if (idsAnomaliaEmpresa !== null) query = query.in('id', idsAnomaliaEmpresa)

    const { data, error, count } = await query

    if (error || !data) {
      setSemAcesso(true)
      setAnomalias([])
    } else {
      setAnomalias(data)
      setTotalResultados(count || 0)
    }
    setCarregando(false)
  }

  useEffect(() => { carregarAnomalias() }, [filtroCategoria, filtroEstado, filtroEmpresa, filtroTexto, dataInicio, dataFim, pagina])

  useEffect(() => { setPagina(0) }, [filtroCategoria, filtroEstado, filtroEmpresa, filtroTexto, dataInicio, dataFim])

  function aplicarFiltroFracao(e) {
    e.preventDefault()
    setPagina(0)
    carregarAnomalias()
  }

  if (semAcesso) return <p style={{ padding: 40 }}>Sem acesso ao painel da equipa (não estás na lista de membros da equipa).</p>

  const estiloInput = { padding: '7px 10px', border: '1px solid #E7E4DA', borderRadius: 8, fontSize: 13 }
  const estiloLabel = { fontSize: 11, color: '#6B7178', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }

  return (
    <main style={{ maxWidth: 1000, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h1 style={{ marginBottom: 2 }}>Painel da equipa</h1>
        <Link href="/equipa/dashboard" style={{ fontSize: 14, fontWeight: 600 }}>Ver dashboard →</Link>
      </div>
      <p style={{ color: '#6B7178', marginTop: 0, marginBottom: 22, fontSize: 14 }}>
        {carregando ? 'A carregar...' : `${totalResultados} reclamações encontradas`}
      </p>

      <div style={{
        background: '#fff', border: '1px solid #E7E4DA', borderRadius: 14, padding: 18, marginBottom: 20,
        boxShadow: '0 1px 3px rgba(20,41,58,0.05)',
      }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={estiloLabel}>Categoria</label>
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} style={estiloInput}>
              <option value="">Todas</option>
              <option value="sem">Por classificar</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div>
            <label style={estiloLabel}>Estado</label>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={estiloInput}>
              <option value="">Todos</option>
              {estados.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>

          <div>
            <label style={estiloLabel}>Empresa</label>
            <select value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)} style={estiloInput}>
              <option value="">Todas</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>

          <form onSubmit={aplicarFiltroFracao}>
            <label style={estiloLabel}>Fração</label>
            <input
              type="text"
              value={filtroFracao}
              onChange={(e) => setFiltroFracao(e.target.value)}
              placeholder="ex: BA"
              style={{ ...estiloInput, width: 90 }}
            />
          </form>

          <div>
            <label style={estiloLabel}>De</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={estiloInput} />
          </div>

          <div>
            <label style={estiloLabel}>Até</label>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} style={estiloInput} />
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={estiloLabel}>Pesquisar</label>
            <input
              type="text"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="torneira, azulejo..."
              style={{ ...estiloInput, width: '100%' }}
            />
          </div>

          <button onClick={carregarAnomalias} style={{ padding: '8px 16px' }}>Filtrar</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {anomalias.map((a) => (
          <Link key={a.id} href={`/equipa/${a.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{
              background: '#fff', border: '1px solid #E7E4DA', borderRadius: 12, padding: '14px 18px',
              boxShadow: '0 1px 3px rgba(20,41,58,0.05)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <span style={{ fontSize: 11, background: '#E4EEF3', color: '#2B5876', padding: '3px 9px', borderRadius: 20, fontWeight: 600, flexShrink: 0 }}>
                  {a.fracoes?.codigo_fracao}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#16344A' }}>
                    {a.categorias?.nome || 'Por classificar'}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7178', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.descricao}
                  </div>
                </div>
              </div>
              <EtiquetaEstado nome={a.estados?.nome} />
            </div>
          </Link>
        ))}
      </div>

      {!carregando && totalResultados > 50 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 24 }}>
          <button
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
            disabled={pagina === 0}
            style={{ padding: '7px 16px' }}
          >
            ← Anterior
          </button>
          <span style={{ fontSize: 13, color: '#6B7178' }}>
            Página {pagina + 1} de {Math.ceil(totalResultados / 50)}
          </span>
          <button
            onClick={() => setPagina((p) => p + 1)}
            disabled={(pagina + 1) * 50 >= totalResultados}
            style={{ padding: '7px 16px' }}
          >
            Seguinte →
          </button>
        </div>
      )}
    </main>
  )
}