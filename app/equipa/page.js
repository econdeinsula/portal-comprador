'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Link from 'next/link'

export default function PainelEquipa() {
  const [anomalias, setAnomalias] = useState([])
  const [categorias, setCategorias] = useState([])
  const [estados, setEstados] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [semAcesso, setSemAcesso] = useState(false)

  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroFracao, setFiltroFracao] = useState('')
  const [filtroTexto, setFiltroTexto] = useState('')

  useEffect(() => {
    async function carregarListas() {
      const { data: cats } = await supabase.from('categorias').select('id, nome').order('nome')
      const { data: ests } = await supabase.from('estados').select('id, nome').order('ordem')
      setCategorias(cats || [])
      setEstados(ests || [])
    }
    carregarListas()
  }, [])

  async function carregarAnomalias() {
    setCarregando(true)
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

    if (filtroCategoria) query = query.eq('categoria_id', filtroCategoria)
    if (filtroEstado) query = query.eq('estado_id', filtroEstado)
    if (filtroTexto) query = query.ilike('descricao', `%${filtroTexto}%`)

    const { data, error } = await query

    if (error || !data) {
      setSemAcesso(true)
      setAnomalias([])
    } else {
      // O filtro de fração é feito aqui, porque a coluna real (codigo_fracao)
      // está numa tabela ligada, não diretamente em anomalias.
      const filtradas = filtroFracao
        ? data.filter((a) => a.fracoes?.codigo_fracao?.toUpperCase() === filtroFracao.toUpperCase())
        : data
      setAnomalias(filtradas)
    }
    setCarregando(false)
  }

  useEffect(() => { carregarAnomalias() }, [filtroCategoria, filtroEstado, filtroTexto])

  function aplicarFiltroFracao(e) {
    e.preventDefault()
    carregarAnomalias()
  }

  if (semAcesso) return <p style={{ padding: 40 }}>Sem acesso ao painel da equipa (não estás na lista de membros da equipa).</p>

  return (
    <main style={{ maxWidth: 1000, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Painel da equipa</h1>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: 12, display: 'block' }}>Categoria</label>
          <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} style={{ padding: 6 }}>
            <option value="">Todas</option>
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