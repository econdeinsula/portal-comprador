'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link'

function Icone({ children }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 18, background: '#F3F1EA', flexShrink: 0,
    }}>
      {children}
    </div>
  )
}

function CartaoKpi({ titulo, valor, cor, icone }) {
  return (
    <div style={{
      flex: '1 1 140px', background: '#fff', borderRadius: 12, padding: '18px 20px',
      display: 'flex', alignItems: 'center', gap: 14,
      border: '1px solid #E7E4DA', boxShadow: '0 1px 3px rgba(20,41,58,0.06)',
    }}>
      <Icone>{icone}</Icone>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color: cor, lineHeight: 1.1 }}>{valor}</div>
        <div style={{ fontSize: 12, color: '#6B7178', marginTop: 2 }}>{titulo}</div>
      </div>
    </div>
  )
}

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
        const { data: estadoResolvida } = await supabase.from('estados').select('id').eq('nome', 'Resolvida').maybeSingle()

        const { count: abertasEquipa } = await supabase
          .from('anomalias')
          .select('id', { count: 'exact', head: true })
          .eq('estado_id', estadoAberta?.id)

        const { count: resolvidasEquipa } = await supabase
          .from('anomalias')
          .select('id', { count: 'exact', head: true })
          .eq('estado_id', estadoResolvida?.id)

        const { count: semClassEquipa } = await supabase
          .from('anomalias')
          .select('id', { count: 'exact', head: true })
          .is('categoria_id', null)

        setResumo((r) => ({
          ...r,
          totalEquipa: totalEquipa || 0,
          abertasEquipa: abertasEquipa || 0,
          resolvidasEquipa: resolvidasEquipa || 0,
          semClassEquipa: semClassEquipa || 0,
        }))

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
          .limit(6)
        setResumo((r) => ({ ...r, recentesEquipa: recentes || [] }))
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

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 19 ? 'Boa tarde' : 'Boa noite'
  const primeiroNome = (user.user_metadata?.full_name || user.email).split(' ')[0].split('@')[0]

  return (
    <main style={{ maxWidth: 780, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ marginBottom: 2 }}>{saudacao}, {primeiroNome}</h1>
      <p style={{ color: '#6B7178', marginTop: 0, marginBottom: 28, fontSize: 14 }}>
        Aqui tens um resumo do que se passa hoje.
      </p>

      {ehProprietario && (
        <div style={{
          background: '#fff', borderRadius: 14, padding: 22, marginBottom: 24,
          border: '1px solid #E7E4DA', boxShadow: '0 1px 3px rgba(20,41,58,0.06)',
        }}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>As tuas reclamações</h3>
          <div style={{ display: 'flex', gap: 28, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#16344A' }}>{resumo?.totalProprietario ?? 0}</div>
              <div style={{ fontSize: 12, color: '#6B7178' }}>total</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#B4462F' }}>{resumo?.abertasProprietario ?? 0}</div>
              <div style={{ fontSize: 12, color: '#6B7178' }}>em aberto</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/anomalias/nova" style={{ padding: '9px 18px', background: '#2B5876', color: '#fff', borderRadius: 9, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
              + Nova reclamação
            </Link>
            <Link href="/anomalias" style={{ padding: '9px 18px', border: '1px solid #E7E4DA', borderRadius: 9, textDecoration: 'none', fontSize: 14, color: '#16344A', fontWeight: 500 }}>
              Ver todas
            </Link>
          </div>
        </div>
      )}

      {ehEquipa && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <CartaoKpi titulo="Total" valor={resumo?.totalEquipa ?? 0} cor="#16344A" icone="📋" />
            <CartaoKpi titulo="Abertas" valor={resumo?.abertasEquipa ?? 0} cor="#B4462F" icone="🔴" />
            <CartaoKpi titulo="Resolvidas" valor={resumo?.resolvidasEquipa ?? 0} cor="#4B7A51" icone="✅" />
            <CartaoKpi titulo="Por classificar" valor={resumo?.semClassEquipa ?? 0} cor="#C8862B" icone="🏷️" />
          </div>

          <div style={{
            background: '#fff', borderRadius: 14, padding: 22,
            border: '1px solid #E7E4DA', boxShadow: '0 1px 3px rgba(20,41,58,0.06)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>Atividade recente</h3>
              <div style={{ display: 'flex', gap: 14 }}>
                <Link href="/equipa/dashboard" style={{ fontSize: 13, fontWeight: 500 }}>Dashboard →</Link>
                <Link href="/equipa" style={{ fontSize: 13, fontWeight: 500 }}>Painel completo →</Link>
              </div>
            </div>
            {(!resumo?.recentesEquipa || resumo.recentesEquipa.length === 0) && (
              <p style={{ fontSize: 13, color: '#888' }}>Sem reclamações registadas ainda.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {resumo?.recentesEquipa?.map((a, i) => (
                <Link
                  key={a.id}
                  href={`/equipa/${a.id}`}
                  style={{
                    textDecoration: 'none', color: 'inherit', padding: '12px 4px',
                    borderTop: i === 0 ? 'none' : '1px solid #F0EEE7',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#16344A' }}>
                      {a.fracoes?.codigo_fracao} · {a.categorias?.nome ? `${a.categorias.nome} — ${a.elementos?.nome}` : 'Por classificar'}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7178', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.descricao}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap',
                    background: a.estados?.nome === 'Aberta' ? '#F6E4DF' : a.estados?.nome === 'Resolvida' ? '#E5EEE6' : '#F3F1EA',
                    color: a.estados?.nome === 'Aberta' ? '#B4462F' : a.estados?.nome === 'Resolvida' ? '#4B7A51' : '#6B7178',
                  }}>
                    {a.estados?.nome}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {!ehProprietario && !ehEquipa && (
        <p style={{ color: '#666' }}>A tua conta ainda não está associada a nenhuma fração nem à equipa.</p>
      )}
    </main>
  )
}