'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link'

export default function Home() {
  const [user, setUser] = useState(null)
  const [ehEquipa, setEhEquipa] = useState(false)
  const [ehProprietario, setEhProprietario] = useState(false)
  const [resumo, setResumo] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (!user) { setCarregando(false); return }

      const { data: equipa } = await supabase
        .from('membros_equipa')
        .select('email')
        .eq('email', user.email)
        .maybeSingle()
      setEhEquipa(!!equipa)

      const { data: proprietario } = await supabase
        .from('proprietarios')
        .select('id')
        .eq('email', user.email)
        .maybeSingle()

      if (proprietario) {
        const { data: ligacoes } = await supabase
          .from('fracao_proprietarios')
          .select('fracao_id')
          .eq('proprietario_id', proprietario.id)

        const fracaoIds = (ligacoes || []).map((l) => l.fracao_id)
        if (fracaoIds.length > 0) {
          setEhProprietario(true)

          const { count: total } = await supabase
            .from('anomalias')
            .select('id', { count: 'exact', head: true })
            .in('fracao_id', fracaoIds)

          const { data: estadoAberta } = await supabase.from('estados').select('id').eq('nome', 'Aberta').maybeSingle()
          const { count: abertas } = await supabase
            .from('anomalias')
            .select('id', { count: 'exact', head: true })
            .in('fracao_id', fracaoIds)
            .eq('estado_id', estadoAberta?.id)

          setResumo((r) => ({ ...r, totalProprietario: total || 0, abertasProprietario: abertas || 0 }))
        }
      }

      if (equipa) {
        const { count: totalEquipa } = await supabase
          .from('anomalias')
          .select('id', { count: 'exact', head: true })

        const { data: estadoAberta } = await supabase.from('estados').select('id').eq('nome', 'Aberta').maybeSingle()
        const { count: abertasEquipa } = await supabase
          .from('anomalias')
          .select('id', { count: 'exact', head: true })
          .eq('estado_id', estadoAberta?.id)

        setResumo((r) => ({ ...r, totalEquipa: totalEquipa || 0, abertasEquipa: abertasEquipa || 0 }))
      }

      setCarregando(false)
    }
    carregar()
  }, [])

  if (carregando) return <p style={{ padding: 40 }}>A carregar...</p>

  if (!user) {
    return (
      <main style={{ maxWidth: 600, margin: '80px auto', fontFamily: 'sans-serif', textAlign: 'center' }}>
        <h1>Portal do Comprador</h1>
        <p style={{ color: '#666', fontSize: 15 }}>
          Regista, acompanha e resolve reclamações de garantia da tua habitação —
          da abertura do processo até à visita técnica, tudo num só sítio.
        </p>
        <Link
          href="/login"
          style={{ display: 'inline-block', marginTop: 20, padding: '10px 24px', background: '#2B5876', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}
        >
          Entrar
        </Link>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Portal do Comprador</h1>

      {ehProprietario && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 18, marginBottom: 16 }}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>As tuas reclamações</h3>
          <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 'bold', color: '#16344A' }}>{resumo?.totalProprietario ?? 0}</div>
              <div style={{ fontSize: 12, color: '#666' }}>total</div>
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 'bold', color: '#B4462F' }}>{resumo?.abertasProprietario ?? 0}</div>
              <div style={{ fontSize: 12, color: '#666' }}>em aberto</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/anomalias/nova" style={{ padding: '8px 16px', background: '#2B5876', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 14 }}>
              + Nova reclamação
            </Link>
            <Link href="/anomalias" style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: 8, textDecoration: 'none', fontSize: 14, color: '#16344A' }}>
              Ver todas
            </Link>
          </div>
        </div>
      )}

      {ehEquipa && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 18 }}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>Visão geral (equipa)</h3>
          <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 'bold', color: '#16344A' }}>{resumo?.totalEquipa ?? 0}</div>
              <div style={{ fontSize: 12, color: '#666' }}>reclamações no total</div>
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 'bold', color: '#B4462F' }}>{resumo?.abertasEquipa ?? 0}</div>
              <div style={{ fontSize: 12, color: '#666' }}>em aberto</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/equipa/dashboard" style={{ padding: '8px 16px', background: '#2B5876', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 14 }}>
              Ver dashboard
            </Link>
            <Link href="/equipa" style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: 8, textDecoration: 'none', fontSize: 14, color: '#16344A' }}>
              Painel da equipa
            </Link>
          </div>
        </div>
      )}

      {!ehProprietario && !ehEquipa && (
        <p style={{ color: '#666' }}>A tua conta ainda não está associada a nenhuma fração nem à equipa.</p>
      )}
    </main>
  )
}