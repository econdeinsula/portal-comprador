'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link'

export default function Home() {
  const [user, setUser] = useState(null)
  const [ehEquipa, setEhEquipa] = useState(false)
  const [ehProprietario, setEhProprietario] = useState(false)
  const [resumoProprietario, setResumoProprietario] = useState(null)
  const [kpisEquipa, setKpisEquipa] = useState(null)
  const [recentesEquipa, setRecentesEquipa] = useState([])
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

          setResumoProprietario({ total: total || 0, abertas: abertas || 0 })
        }
      }

      if (equipa) {
        const { count: total } = await supabase
          .from('anomalias')
          .select('id', { count: 'exact', head: true })

        const { data: estadoAberta } = await supabase.from('estados').select('id').eq('nome', 'Aberta').maybeSingle()
        const { count: abertas } = await supabase
          .from('anomalias')
          .select('id', { count: 'exact', head: true })
          .eq('estado_id', estadoAberta?.id)

        const { count: semClassificar } = await supabase
          .from('anomalias')
          .select('id', { count: 'exact', head: true })
          .is('categoria_id', null)

        const { count: aExpirar } = await supabase
          .from('v_garantia_restante')
          .select('anomalia_id', { count: 'exact', head: true })
          .gte('dias_restantes', 0)
          .lte('dias_restantes', 90)

        setKpisEquipa({
          total: total || 0,
          abertas: abertas || 0,
          semClassificar: semClassificar || 0,
          aExpirar: aExpirar || 0,
        })

        const { data: recentes } = await supabase
          .from('anomalias')
          .select(`
            id, descricao, criado_em,
            estados ( nome ),
            categorias ( nome ),
            elementos ( nome ),
            fracoes ( codigo_fracao )
          `)
          .order('criado_em', { ascending: false })
          .limit(5)
        setRecentesEquipa(recentes || [])
      }

      setCarregando(false)
    }
    carregar()
  }, [])

  if (carregando) return <p style={{ padding: 40 }}>A carregar...</p>

  if (!user) {
    return (
      <main style={{ maxWidth: 600, margin: '120px auto 80px', fontFamily: 'sans-serif', textAlign: 'center' }}>
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
    <main style={{ maxWidth: 800, margin: '30px auto', fontFamily: 'sans-serif' }}>
      <h1>Portal do Comprador</h1>

      {ehProprietario && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 18, marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>As tuas reclamações</h3>
          <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 'bold', color: '#16344A' }}>{resumoProprietario?.total ?? 0}</div>
              <div style={{ fontSize: 12, color: '#666' }}>total</div>
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 'bold', color: '#B4462F' }}>{resumoProprietario?.abertas ?? 0}</div>
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
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 140px', background: '#F3F1EA', borderRadius: 8, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#16344A' }}>{kpisEquipa?.total ?? 0}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Total</div>
            </div>
            <div style={{ flex: '1 1 140px', background: '#F4DFD8', borderRadius: 8, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#B4462F' }}>{kpisEquipa?.abertas ?? 0}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Abertas</div>
            </div>
            <div style={{ flex: '1 1 140px', background: '#F5E6CC', borderRadius: 8, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#C8862B' }}>{kpisEquipa?.semClassificar ?? 0}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Por classificar</div>
            </div>
            <div style={{ flex: '1 1 140px', background: '#F5E6CC', borderRadius: 8, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#C8862B' }}>{kpisEquipa?.aExpirar ?? 0}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Garantia a expirar</div>
            </div>
          </div>

          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Atividade recente</h3>
              <div style={{ display: 'flex', gap: 12 }}>
                <Link href="/equipa/dashboard" style={{ fontSize: 13 }}>Dashboard →</Link>
                <Link href="/equipa" style={{ fontSize: 13 }}>Painel completo →</Link>
              </div>
            </div>
            {recentesEquipa.length === 0 && <p style={{ fontSize: 13, color: '#888' }}>Sem reclamações registadas ainda.</p>}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {recentesEquipa.map((a) => (
                <li key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid #eee' }}>
                  <Link href={`/equipa/${a.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                      <span>
                        <strong>{a.fracoes?.codigo_fracao}</strong> · {a.categorias?.nome ? `${a.categorias.nome} — ${a.elementos?.nome}` : 'Por classificar'}
                      </span>
                      <span style={{ color: '#888', whiteSpace: 'nowrap' }}>{a.estados?.nome}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{a.descricao}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {!ehProprietario && !ehEquipa && (
        <p style={{ color: '#666' }}>A tua conta ainda não está associada a nenhuma fração nem à equipa.</p>
      )}
    </main>
  )
}