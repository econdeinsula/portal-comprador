'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Link from 'next/link'

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
      `)
      .order('criado_em', { ascending: false })
      .limit(200)

    if (filtroCategoria === 'sem') query = query.is('categoria_id', null)
    else if (filtroCategoria) query = query.eq('categoria_id', filtroCategoria)
    if (filtroEstado) query = query.eq('estado_id', filtroEstado)
    if (filtroTexto) query = query.ilike('descricao', `%${filtroTexto}%`)
    if (dataInicio) query = query.gte('criado_em', dataInicio)
    if (dataFim) query = query.lte('criado_em', dataFim + 'T23:59:59')
    if (idsFracao !== null) query = query.in('fracao_id', idsFracao)
    if (idsAnomaliaEmpresa !== null) query = query.in('id', idsAnomaliaEmpresa)

    const { data, error } = await query

    if (error || !data) {
      setSemAcesso(true)
      setAnomalias([])
    } else {
      setAnomalias(data)
    }
    setCarregando(false)
  }

  useEffect(() => { carregarAnomalias() }, [filtroCategoria, filtroEstado, filtroEmpresa, filtroTexto, dataInicio, dataFim])

  function aplicarFiltroFracao(e) {
    e.preventDefault()
    carregarAnomalias()
  }

  if (semAcesso) return <p style={{ padding: 40 }}>Sem acesso ao painel da equipa (não estás na lista de membros da equipa).</p>

  return (
    <main style={{ maxWidth: 1000, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Painel da equipa</h1>
        <Link href="/equipa/dashboard" style={{ fontSize: 14 }}>Ver dashboard →</Link>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: 12, display: 'block' }}>Categoria</label>
          <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} style={{ padding: 6 }}>
            <option value="">Todas</option>
            <option value="sem">Por classificar</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, display: 'block' }}>Estado</label>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ padding: 6 }}>
            <option value="">Todos</option>
            {estados.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, display: 'block' }}>Empresa</label>
          <select value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)} style={{ padding: 6 }}>
            <option value="">Todas</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>

        <form onSubmit={aplicarFiltroFracao}>
          <label style={{ fontSize: 12, display: 'block' }}>Fração (código exato)</label>
          <input
            type="text"
            value={filtroFracao}
            onChange={(e) => setFiltroFracao(e.target.value)}
            placeholder="ex: BA"
            style={{ padding: 6, width: 90 }}
          />
        </form>

        <div>
          <label style={{ fontSize: 12, display: 'block' }}>De</label>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={{ padding: 6 }} />
        </div>

        <div>
          <label style={{ fontSize: 12, display: 'block' }}>Até</label>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} style={{ padding: 6 }} />
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ fontSize: 12, display: 'block' }}>Pesquisar na descrição</label>
          <input
            type="text"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="ex: torneira, azulejo..."
            style={{ padding: 6, width: '100%' }}
          />
        </div>

        <button onClick={carregarAnomalias} style={{ padding: '7px 14px' }}>Filtrar</button>
      </div>

      <p style={{ fontSize: 12, color: '#888' }}>
        {carregando ? 'A carregar...' : `${anomalias.length} reclamações encontradas (máximo 200 por página)`}
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: 8 }}>Fração</th>
            <th style={{ padding: 8 }}>Categoria</th>
            <th style={{ padding: 8 }}>Descrição</th>
            <th style={{ padding: 8 }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {anomalias.map((a) => (
            <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8 }}>{a.fracoes?.codigo_fracao}</td>
              <td style={{ padding: 8 }}>{a.categorias?.nome || 'Por classificar'}</td>
              <td style={{ padding: 8 }}>
                <Link href={`/equipa/${a.id}`}>{a.descricao}</Link>
              </td>
              <td style={{ padding: 8 }}>{a.estados?.nome}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}