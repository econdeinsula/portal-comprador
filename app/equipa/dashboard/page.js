'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import Link from 'next/link'

const CORES = ['#2B5876', '#4B7A51', '#C8862B', '#B4462F', '#6E6A5E', '#8E6BAF', '#3C8DAD', '#A1683A']

function BarraContagem({ itens, total }) {
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

export default function Dashboard() {
  const [porCategoria, setPorCategoria] = useState([])
  const [porEstado, setPorEstado] = useState([])
  const [total, setTotal] = useState(0)
  const [semClassificar, setSemClassificar] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [semAcesso, setSemAcesso] = useState(false)

  useEffect(() => {
    async function carregar() {
      const { count: totalCount, error: erroTotal } = await supabase
        .from('anomalias')
        .select('id', { count: 'exact', head: true })

      if (erroTotal) { setSemAcesso(true); setCarregando(false); return }
      setTotal(totalCount || 0)

      const { count: semClassCount } = await supabase
        .from('anomalias')
        .select('id', { count: 'exact', head: true })
        .is('categoria_id', null)
      setSemClassificar(semClassCount || 0)

      const { data: categorias } = await supabase.from('categorias').select('id, nome')
      const contagensCategoria = []
      for (const cat of categorias || []) {
        const { count } = await supabase
          .from('anomalias')
          .select('id', { count: 'exact', head: true })
          .eq('categoria_id', cat.id)
        if (count > 0) contagensCategoria.push({ nome: cat.nome, count })
      }
      contagensCategoria.sort((a, b) => b.count - a.count)
      setPorCategoria(contagensCategoria)

      const { data: estados } = await supabase.from('estados').select('id, nome').order('ordem')
      const contagensEstado = []
      for (const est of estados || []) {
        const { count } = await supabase
          .from('anomalias')
          .select('id', { count: 'exact', head: true })
          .eq('estado_id', est.id)
        if (count > 0) contagensEstado.push({ nome: est.nome, count })
      }
      setPorEstado(contagensEstado)

      setCarregando(false)
    }
    carregar()
  }, [])

  if (semAcesso) return <p style={{ padding: 40 }}>Sem acesso ao dashboard (não estás na lista de membros da equipa).</p>
  if (carregando) return <p style={{ padding: 40 }}>A carregar estatísticas...</p>

  return (
    <main style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Dashboard</h1>
        <Link href="/equipa" style={{ fontSize: 14 }}>← Ver lista de reclamações</Link>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 30 }}>
        <div style={{ flex: 1, background: '#F3F1EA', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#16344A' }}>{total}</div>
          <div style={{ fontSize: 12, color: '#666' }}>Total de reclamações</div>
        </div>
        <div style={{ flex: 1, background: '#F5E6CC', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#C8862B' }}>{semClassificar}</div>
          <div style={{ fontSize: 12, color: '#666' }}>Por classificar</div>
        </div>
      </div>

      <h2 style={{ fontSize: 16 }}>Por categoria</h2>
      <div style={{ marginBottom: 30 }}>
        <BarraContagem itens={porCategoria} total={total} />
      </div>

      <h2 style={{ fontSize: 16 }}>Por estado</h2>
      <BarraContagem itens={porEstado} total={total} />
    </main>
  )
}