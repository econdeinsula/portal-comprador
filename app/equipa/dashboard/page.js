'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import Link from 'next/link'

const CORES = ['#2B5876', '#4B7A51', '#C8862B', '#B4462F', '#6E6A5E', '#8E6BAF', '#3C8DAD', '#A1683A']

const WIDGETS_DEFAULT = {
  kpis: true,
  categoria: true,
  estado: true,
  lote: true,
  empresas: true,
  desempenhoEmpresas: true,
  evolucao: true,
}

function BarraContagem({ itens, total }) {
  if (itens.length === 0) return <p style={{ fontSize: 13, color: '#888' }}>Sem dados para os filtros escolhidos.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {itens.map((item, i) => (
        <div key={item.nome}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>{item.nome}</span>
            <span style={{ color: '#888' }}>{item.count}</span>
          </div>
          <div style={{ background: '#eee', borderRadius: 4, height: 8, overflow: 'hidden' }}>
            <div style={{
              width: `${total ? (item.count / total) * 100 : 0}%`,
              background: CORES[i % CORES.length],
              height: '100%',
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Cartao({ titulo, valor, cor, fundo }) {
  return (
    <div style={{ flex: '1 1 140px', background: fundo, borderRadius: 8, padding: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 'bold', color: cor }}>{valor}</div>
      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{titulo}</div>
    </div>
  )
}

function Painel({ titulo, children }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 20 }}>
      <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 14 }}>{titulo}</h2>
      {children}
    </div>
  )
}

export default function Dashboard() {
  const [carregando, setCarregando] = useState(true)
  const [semAcesso, setSemAcesso] = useState(false)
  const [mostrarPersonalizar, setMostrarPersonalizar] = useState(false)
  const [widgets, setWidgets] = useState(WIDGETS_DEFAULT)

  const [categorias, setCategorias] = useState([])
  const [estados, setEstados] = useState([])

  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroLote, setFiltroLote] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const [kpis, setKpis] = useState({ total: 0, abertas: 0, resolvidas: 0, semClassificar: 0, aExpirar: 0 })
  const [porCategoria, setPorCategoria] = useState([])
  const [porEstado, setPorEstado] = useState([])
  const [porLote, setPorLote] = useState([])
  const [porEmpresa, setPorEmpresa] = useState([])
  const [desempenhoEmpresas, setDesempenhoEmpresas] = useState([])
  const [porMes, setPorMes] = useState([])

  // carregar preferências guardadas + listas de referência, uma vez
  useEffect(() => {
    const guardado = typeof window !== 'undefined' && window.localStorage.getItem('dashboardWidgets')
    if (guardado) {
      try { setWidgets(JSON.parse(guardado)) } catch { /* ignora se corrompido */ }
    }
    async function carregarListas() {
      const { data: cats } = await supabase.from('categorias').select('id, nome').order('nome')
      const { data: ests } = await supabase.from('estados').select('id, nome').order('ordem')
      setCategorias(cats || [])
      setEstados(ests || [])
    }
    carregarListas()
  }, [])

  function alternarWidget(chave) {
    setWidgets((atual) => {
      const novo = { ...atual, [chave]: !atual[chave] }
      window.localStorage.setItem('dashboardWidgets', JSON.stringify(novo))
      return novo
    })
  }

  async function idsFracoesDoLote(lote) {
    if (!lote) return null
    const { data: emp } = await supabase.from('empreendimentos').select('id').eq('lote', lote).maybeSingle()
    if (!emp) return []
    const { data: fracoes } = await supabase.from('fracoes').select('id').eq('empreendimento_id', emp.id)
    return (fracoes || []).map((f) => f.id)
  }

  async function carregarDashboard() {
    setCarregando(true)

    const fracaoIds = await idsFracoesDoLote(filtroLote)
    if (fracaoIds !== null && fracaoIds.length === 0) {
      // lote sem frações -- não há nada a mostrar, evita continuar com filtros inválidos
      setSemAcesso(false)
      setKpis({ total: 0, abertas: 0, resolvidas: 0, semClassificar: 0, aExpirar: 0 })
      setPorCategoria([]); setPorEstado([]); setPorLote([]); setPorEmpresa([]); setDesempenhoEmpresas([]); setPorMes([])
      setCarregando(false)
      return
    }

    function aplicarFiltrosBase(query) {
      if (filtroCategoria) query = query.eq('categoria_id', filtroCategoria)
      if (filtroEstado) query = query.eq('estado_id', filtroEstado)
      if (dataInicio) query = query.gte('criado_em', dataInicio)
      if (dataFim) query = query.lte('criado_em', dataFim + 'T23:59:59')
      if (fracaoIds) query = query.in('fracao_id', fracaoIds)
      return query
    }

    // --- KPIs ---
    const { count: totalCount, error: erroTotal } = await aplicarFiltrosBase(
      supabase.from('anomalias').select('id', { count: 'exact', head: true })
    )
    if (erroTotal) { setSemAcesso(true); setCarregando(false); return }

    const { data: estadoAberta } = await supabase.from('estados').select('id').eq('nome', 'Aberta').maybeSingle()
    const { data: estadoResolvida } = await supabase.from('estados').select('id').eq('nome', 'Resolvida').maybeSingle()

    const { count: abertasCount } = await aplicarFiltrosBase(
      supabase.from('anomalias').select('id', { count: 'exact', head: true }).eq('estado_id', estadoAberta?.id)
    )
    const { count: resolvidasCount } = await aplicarFiltrosBase(
      supabase.from('anomalias').select('id', { count: 'exact', head: true }).eq('estado_id', estadoResolvida?.id)
    )
    const { count: semClassCount } = await aplicarFiltrosBase(
      supabase.from('anomalias').select('id', { count: 'exact', head: true }).is('categoria_id', null)
    )
    const { count: expirarCount } = await supabase
      .from('v_garantia_restante')
      .select('anomalia_id', { count: 'exact', head: true })
      .gte('dias_restantes', 0)
      .lte('dias_restantes', 90)

    setKpis({
      total: totalCount || 0,
      abertas: abertasCount || 0,
      resolvidas: resolvidasCount || 0,
      semClassificar: semClassCount || 0,
      aExpirar: expirarCount || 0,
    })

    // --- por categoria ---
    const contagensCategoria = []
    for (const cat of categorias) {
      const { count } = await aplicarFiltrosBase(
        supabase.from('anomalias').select('id', { count: 'exact', head: true }).eq('categoria_id', cat.id)
      )
      if (count > 0) contagensCategoria.push({ nome: cat.nome, count })
    }
    contagensCategoria.sort((a, b) => b.count - a.count)
    setPorCategoria(contagensCategoria)

    // --- por estado ---
    const contagensEstado = []
    for (const est of estados) {
      const { count } = await aplicarFiltrosBase(
        supabase.from('anomalias').select('id', { count: 'exact', head: true }).eq('estado_id', est.id)
      )
      if (count > 0) contagensEstado.push({ nome: est.nome, count })
    }
    setPorEstado(contagensEstado)

    // --- por lote ---
    const { data: empreendimentos } = await supabase.from('empreendimentos').select('id, lote')
    const contagensLote = []
    for (const emp of empreendimentos || []) {
      const { data: fracoesLote } = await supabase.from('fracoes').select('id').eq('empreendimento_id', emp.id)
      const idsLote = (fracoesLote || []).map((f) => f.id)
      if (idsLote.length === 0) continue
      let q = supabase.from('anomalias').select('id', { count: 'exact', head: true }).in('fracao_id', idsLote)
      if (filtroCategoria) q = q.eq('categoria_id', filtroCategoria)
      if (filtroEstado) q = q.eq('estado_id', filtroEstado)
      if (dataInicio) q = q.gte('criado_em', dataInicio)
      if (dataFim) q = q.lte('criado_em', dataFim + 'T23:59:59')
      const { count } = await q
      if (count > 0) contagensLote.push({ nome: emp.lote, count })
    }
    setPorLote(contagensLote)

    // --- top empresas (respeita apenas o intervalo de datas, para simplificar) ---
    let queryEmpresas = supabase
      .from('anomalia_empresas')
      .select('empresa_id, empresas ( nome ), anomalias!inner ( id, criado_em )')
      .limit(3000)
    if (dataInicio) queryEmpresas = queryEmpresas.gte('anomalias.criado_em', dataInicio)
    if (dataFim) queryEmpresas = queryEmpresas.lte('anomalias.criado_em', dataFim + 'T23:59:59')
    const { data: ligacoesEmpresas, error: erroEmpresas } = await queryEmpresas

    if (!erroEmpresas) {
      const contagem = {}
      for (const l of ligacoesEmpresas || []) {
        const nome = l.empresas?.nome
        if (!nome) continue
        contagem[nome] = (contagem[nome] || 0) + 1
      }
      const lista = Object.entries(contagem)
        .map(([nome, count]) => ({ nome, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
      setPorEmpresa(lista)
    } else {
      setPorEmpresa([])
    }

    // --- desempenho por empresa: abertas vs resolvidas ---
    let queryDesempenho = supabase
      .from('anomalia_empresas')
      .select('empresa_id, empresas ( nome ), anomalias!inner ( id, estado_id, criado_em )')
      .limit(3000)
    if (dataInicio) queryDesempenho = queryDesempenho.gte('anomalias.criado_em', dataInicio)
    if (dataFim) queryDesempenho = queryDesempenho.lte('anomalias.criado_em', dataFim + 'T23:59:59')
    const { data: ligacoesDesempenho, error: erroDesempenho } = await queryDesempenho

    if (!erroDesempenho) {
      const porNome = {}
      for (const l of ligacoesDesempenho || []) {
        const nome = l.empresas?.nome
        if (!nome) continue
        if (!porNome[nome]) porNome[nome] = { nome, total: 0, abertas: 0, resolvidas: 0 }
        porNome[nome].total += 1
        if (l.anomalias?.estado_id === estadoAberta?.id) porNome[nome].abertas += 1
        if (l.anomalias?.estado_id === estadoResolvida?.id) porNome[nome].resolvidas += 1
      }
      const listaDesempenho = Object.values(porNome)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map((e) => ({ ...e, taxa: e.total ? Math.round((e.resolvidas / e.total) * 100) : 0 }))
      setDesempenhoEmpresas(listaDesempenho)
    } else {
      setDesempenhoEmpresas([])
    }

    // --- evolução mensal (respeita apenas o intervalo de datas) ---
    let queryMensal = supabase.from('anomalias').select('criado_em').limit(6000)
    if (dataInicio) queryMensal = queryMensal.gte('criado_em', dataInicio)
    if (dataFim) queryMensal = queryMensal.lte('criado_em', dataFim + 'T23:59:59')
    const { data: datasAnomalias } = await queryMensal

    const contagemMes = {}
    for (const a of datasAnomalias || []) {
      if (!a.criado_em) continue
      const chave = a.criado_em.slice(0, 7) // "AAAA-MM"
      contagemMes[chave] = (contagemMes[chave] || 0) + 1
    }
    const mesesOrdenados = Object.keys(contagemMes).sort().slice(-12)
    setPorMes(mesesOrdenados.map((m) => ({ nome: m, count: contagemMes[m] })))

    setCarregando(false)
  }

  useEffect(() => { carregarDashboard() }, [filtroCategoria, filtroEstado, filtroLote, dataInicio, dataFim, categorias, estados])

  if (semAcesso) return <p style={{ padding: 40 }}>Sem acesso ao dashboard (não estás na lista de membros da equipa).</p>

  return (
    <main style={{ maxWidth: 900, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ marginBottom: 0 }}>Dashboard</h1>
        <div style={{ display: 'flex', gap: 14 }}>
          <button onClick={() => setMostrarPersonalizar((v) => !v)} style={{ background: 'transparent', color: '#2B5876', padding: 0, fontSize: 14 }}>
            ⚙ Personalizar
          </button>
          <Link href="/equipa" style={{ fontSize: 14 }}>← Ver lista de reclamações</Link>
        </div>
      </div>

      {mostrarPersonalizar && (
        <div style={{ border: '1px dashed #ccc', borderRadius: 8, padding: 12, marginTop: 12, marginBottom: 10, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
          <label><input type="checkbox" checked={widgets.kpis} onChange={() => alternarWidget('kpis')} /> Indicadores</label>
          <label><input type="checkbox" checked={widgets.categoria} onChange={() => alternarWidget('categoria')} /> Por categoria</label>
          <label><input type="checkbox" checked={widgets.estado} onChange={() => alternarWidget('estado')} /> Por estado</label>
          <label><input type="checkbox" checked={widgets.lote} onChange={() => alternarWidget('lote')} /> Por lote</label>
          <label><input type="checkbox" checked={widgets.empresas} onChange={() => alternarWidget('empresas')} /> Empresas</label>
          <label><input type="checkbox" checked={widgets.desempenhoEmpresas} onChange={() => alternarWidget('desempenhoEmpresas')} /> Desempenho por empresa</label>
          <label><input type="checkbox" checked={widgets.evolucao} onChange={() => alternarWidget('evolucao')} /> Evolução mensal</label>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '16px 0', alignItems: 'flex-end' }}>
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
        <div>
          <label style={{ fontSize: 12, display: 'block' }}>Lote</label>
          <select value={filtroLote} onChange={(e) => setFiltroLote(e.target.value)} style={{ padding: 6 }}>
            <option value="">Todos</option>
            <option value="Lote 1">Lote 1</option>
            <option value="Lote 2">Lote 2</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, display: 'block' }}>De</label>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={{ padding: 6 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, display: 'block' }}>Até</label>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} style={{ padding: 6 }} />
        </div>
      </div>

      {carregando ? (
        <p>A carregar estatísticas...</p>
      ) : (
        <>
          {widgets.kpis && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <Cartao titulo="Total" valor={kpis.total} cor="#16344A" fundo="#F3F1EA" />
              <Cartao titulo="Abertas" valor={kpis.abertas} cor="#B4462F" fundo="#F4DFD8" />
              <Cartao titulo="Resolvidas" valor={kpis.resolvidas} cor="#4B7A51" fundo="#DCE9DD" />
              <Cartao titulo="Por classificar" valor={kpis.semClassificar} cor="#C8862B" fundo="#F5E6CC" />
              <Cartao titulo="Garantia a expirar (≤3 meses)" valor={kpis.aExpirar} cor="#C8862B" fundo="#F5E6CC" />
            </div>
          )}

          {widgets.categoria && (
            <Painel titulo="Por categoria">
              <BarraContagem itens={porCategoria} total={kpis.total} />
            </Painel>
          )}

          {widgets.estado && (
            <Painel titulo="Por estado">
              <BarraContagem itens={porEstado} total={kpis.total} />
            </Painel>
          )}

          {widgets.lote && (
            <Painel titulo="Por lote">
              <BarraContagem itens={porLote} total={kpis.total} />
            </Painel>
          )}

          {widgets.empresas && (
            <Painel titulo="Empresas com mais reclamações associadas">
              <BarraContagem itens={porEmpresa} total={porEmpresa.reduce((s, i) => s + i.count, 0)} />
            </Painel>
          )}

          {widgets.desempenhoEmpresas && (
            <Painel titulo="Desempenho por empresa">
              {desempenhoEmpresas.length === 0 ? (
                <p style={{ fontSize: 13, color: '#888' }}>Sem dados para os filtros escolhidos.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: 6 }}>Empresa</th>
                      <th style={{ padding: 6 }}>Total</th>
                      <th style={{ padding: 6 }}>Abertas</th>
                      <th style={{ padding: 6 }}>Resolvidas</th>
                      <th style={{ padding: 6 }}>Taxa de resolução</th>
                    </tr>
                  </thead>
                  <tbody>
                    {desempenhoEmpresas.map((e) => (
                      <tr key={e.nome} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: 6 }}>{e.nome}</td>
                        <td style={{ padding: 6 }}>{e.total}</td>
                        <td style={{ padding: 6, color: '#B4462F' }}>{e.abertas}</td>
                        <td style={{ padding: 6, color: '#4B7A51' }}>{e.resolvidas}</td>
                        <td style={{ padding: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, background: '#eee', borderRadius: 4, height: 6, maxWidth: 80 }}>
                              <div style={{ width: `${e.taxa}%`, background: '#4B7A51', height: '100%', borderRadius: 4 }} />
                            </div>
                            <span style={{ color: '#666' }}>{e.taxa}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Painel>
          )}

          {widgets.evolucao && (
            <Painel titulo="Evolução mensal (últimos 12 meses com dados)">
              <BarraContagem itens={porMes} total={Math.max(...porMes.map((m) => m.count), 1)} />
            </Painel>
          )}
        </>
      )}
    </main>
  )
}