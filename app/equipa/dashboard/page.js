'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { exportarComoPDF } from '../../../lib/exportarPdf'
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

const cartao = {
  background: '#fff', border: '1px solid #E7E4DA', borderRadius: 14, padding: 20, marginBottom: 20,
  boxShadow: '0 1px 3px rgba(20,41,58,0.05)',
}
const rotuloFiltro = { fontSize: 11, color: '#6B7178', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }
const campoFiltro = { padding: '7px 10px', border: '1px solid #E7E4DA', borderRadius: 8, fontSize: 13 }

function BarraContagem({ itens, total }) {
  if (itens.length === 0) return <p style={{ fontSize: 13, color: '#6B7178' }}>Sem dados para os filtros escolhidos.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {itens.map((item, i) => (
        <div key={item.nome}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: '#16344A' }}>{item.nome}</span>
            <span style={{ color: '#6B7178' }}>{item.count}</span>
          </div>
          <div style={{ background: '#F3F1EA', borderRadius: 6, height: 8, overflow: 'hidden' }}>
            <div style={{
              width: `${total ? (item.count / total) * 100 : 0}%`,
              background: CORES[i % CORES.length],
              height: '100%',
              borderRadius: 6,
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Cartao({ titulo, valor, cor, fundo }) {
  return (
    <div style={{ flex: '1 1 140px', background: fundo, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: cor }}>{valor}</div>
      <div style={{ fontSize: 12, color: '#6B7178', marginTop: 4 }}>{titulo}</div>
    </div>
  )
}

function Painel({ titulo, children }) {
  return (
    <div style={cartao}>
      <h2 style={{ fontSize: 13, marginTop: 0, marginBottom: 16, color: '#6B7178', textTransform: 'uppercase', letterSpacing: 0.3 }}>{titulo}</h2>
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

    const contagensCategoria = []
    for (const cat of categorias) {
      const { count } = await aplicarFiltrosBase(
        supabase.from('anomalias').select('id', { count: 'exact', head: true }).eq('categoria_id', cat.id)
      )
      if (count > 0) contagensCategoria.push({ nome: cat.nome, count })
    }
    contagensCategoria.sort((a, b) => b.count - a.count)
    setPorCategoria(contagensCategoria)

    const contagensEstado = []
    for (const est of estados) {
      const { count } = await aplicarFiltrosBase(
        supabase.from('anomalias').select('id', { count: 'exact', head: true }).eq('estado_id', est.id)
      )
      if (count > 0) contagensEstado.push({ nome: est.nome, count })
    }
    setPorEstado(contagensEstado)

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

    let queryEmpresas = supabase
      .from('anomalia_empresas')
      .select('empresa_id, empresas ( nome ), anomalias!inner ( id, criado_em )')
      .limit(200000)
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

    let queryDesempenho = supabase
      .from('anomalia_empresas')
      .select('empresa_id, empresas ( nome ), anomalias!inner ( id, estado_id, criado_em )')
      .limit(200000)
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

    let queryMensal = supabase.from('anomalias').select('criado_em').limit(200000)
    if (dataInicio) queryMensal = queryMensal.gte('criado_em', dataInicio)
    if (dataFim) queryMensal = queryMensal.lte('criado_em', dataFim + 'T23:59:59')
    const { data: datasAnomalias } = await queryMensal

    const contagemMes = {}
    for (const a of datasAnomalias || []) {
      if (!a.criado_em) continue
      const chave = a.criado_em.slice(0, 7)
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
        <h1 style={{ marginBottom: 2 }}>Dashboard</h1>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <button onClick={() => setMostrarPersonalizar((v) => !v)} style={{ background: 'transparent', color: '#2B5876', padding: 0, fontSize: 14, boxShadow: 'none', fontWeight: 600 }}>
            ⚙ Personalizar
          </button>
          <button onClick={() => exportarComoPDF('conteudo-dashboard', 'dashboard.pdf')} style={{ fontSize: 13, padding: '8px 14px' }}>
            ⬇ Exportar PDF
          </button>
          <Link href="/equipa" style={{ fontSize: 14, fontWeight: 600 }}>← Ver lista de reclamações</Link>
        </div>
      </div>

      {mostrarPersonalizar && (
        <div style={{ ...cartao, borderStyle: 'dashed', display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, marginTop: 14, marginBottom: 4 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={widgets.kpis} onChange={() => alternarWidget('kpis')} /> Indicadores</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={widgets.categoria} onChange={() => alternarWidget('categoria')} /> Por categoria</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={widgets.estado} onChange={() => alternarWidget('estado')} /> Por estado</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={widgets.lote} onChange={() => alternarWidget('lote')} /> Por lote</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={widgets.empresas} onChange={() => alternarWidget('empresas')} /> Empresas</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={widgets.desempenhoEmpresas} onChange={() => alternarWidget('desempenhoEmpresas')} /> Desempenho por empresa</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={widgets.evolucao} onChange={() => alternarWidget('evolucao')} /> Evolução mensal</label>
        </div>
      )}

      <div style={{ ...cartao, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 18 }}>
        <div>
          <label style={rotuloFiltro}>Categoria</label>
          <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} style={campoFiltro}>
            <option value="">Todas</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={rotuloFiltro}>Estado</label>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={campoFiltro}>
            <option value="">Todos</option>
            {estados.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={rotuloFiltro}>Lote</label>
          <select value={filtroLote} onChange={(e) => setFiltroLote(e.target.value)} style={campoFiltro}>
            <option value="">Todos</option>
            <option value="Lote 1">Lote 1</option>
            <option value="Lote 2">Lote 2</option>
          </select>
        </div>
        <div>
          <label style={rotuloFiltro}>De</label>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={campoFiltro} />
        </div>
        <div>
          <label style={rotuloFiltro}>Até</label>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} style={campoFiltro} />
        </div>
      </div>

      {carregando ? (
        <p style={{ color: '#6B7178' }}>A carregar estatísticas...</p>
      ) : (
        <div id="conteudo-dashboard">
          {widgets.kpis && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <Cartao titulo="Total" valor={kpis.total} cor="#16344A" fundo="#F3F1EA" />
              <Cartao titulo="Abertas" valor={kpis.abertas} cor="#B4462F" fundo="#F6E4DF" />
              <Cartao titulo="Resolvidas" valor={kpis.resolvidas} cor="#4B7A51" fundo="#E5EEE6" />
              <Cartao titulo="Por classificar" valor={kpis.semClassificar} cor="#C8862B" fundo="#F7EBD6" />
              <Cartao titulo="Garantia a expirar (≤3 meses)" valor={kpis.aExpirar} cor="#C8862B" fundo="#F7EBD6" />
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
                <p style={{ fontSize: 13, color: '#6B7178' }}>Sem dados para os filtros escolhidos.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #F0EEE7' }}>
                      <th style={{ padding: '6px 8px 10px 0', color: '#6B7178', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Empresa</th>
                      <th style={{ padding: '6px 8px 10px', color: '#6B7178', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Total</th>
                      <th style={{ padding: '6px 8px 10px', color: '#6B7178', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Abertas</th>
                      <th style={{ padding: '6px 8px 10px', color: '#6B7178', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Resolvidas</th>
                      <th style={{ padding: '6px 8px 10px', color: '#6B7178', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Taxa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {desempenhoEmpresas.map((e) => (
                      <tr key={e.nome} style={{ borderBottom: '1px solid #F0EEE7' }}>
                        <td style={{ padding: '10px 8px 10px 0', color: '#16344A', fontWeight: 500 }}>{e.nome}</td>
                        <td style={{ padding: '10px 8px' }}>{e.total}</td>
                        <td style={{ padding: '10px 8px', color: '#B4462F' }}>{e.abertas}</td>
                        <td style={{ padding: '10px 8px', color: '#4B7A51' }}>{e.resolvidas}</td>
                        <td style={{ padding: '10px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, background: '#F3F1EA', borderRadius: 6, height: 6, maxWidth: 70 }}>
                              <div style={{ width: `${e.taxa}%`, background: '#4B7A51', height: '100%', borderRadius: 6 }} />
                            </div>
                            <span style={{ color: '#6B7178', fontSize: 12 }}>{e.taxa}%</span>
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
        </div>
      )}
    </main>
  )
}