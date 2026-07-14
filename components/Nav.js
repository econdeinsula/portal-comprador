'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

function Iniciais(user) {
  const nome = user?.user_metadata?.full_name
  if (nome) {
    const partes = nome.trim().split(/\s+/)
    const primeira = partes[0]?.[0] || ''
    const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
    return (primeira + ultima).toUpperCase()
  }
  return user?.email?.[0]?.toUpperCase() || '?'
}

export default function Nav() {
  const [user, setUser] = useState(null)
  const [ehEquipa, setEhEquipa] = useState(false)
  const [ehProprietario, setEhProprietario] = useState(false)
  const router = useRouter()

  async function verificarPerfis(currentUser) {
    if (!currentUser) { setEhEquipa(false); setEhProprietario(false); return }

    const { data: equipa } = await supabase
      .from('membros_equipa')
      .select('email')
      .eq('email', currentUser.email)
      .maybeSingle()
    setEhEquipa(!!equipa)

    const { data: proprietario } = await supabase
      .from('proprietarios')
      .select('id')
      .eq('email', currentUser.email)
      .maybeSingle()

    if (proprietario) {
      const { data: ligacao } = await supabase
        .from('fracao_proprietarios')
        .select('fracao_id')
        .eq('proprietario_id', proprietario.id)
        .limit(1)
        .maybeSingle()
      setEhProprietario(!!ligacao)
    } else {
      setEhProprietario(false)
    }
  }

  useEffect(() => {
    async function carregarInicial() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      verificarPerfis(user)
    }
    carregarInicial()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      verificarPerfis(session?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav style={{
      display: 'flex', gap: 16, alignItems: 'center', padding: '12px 24px',
      borderBottom: '1px solid #eee', fontFamily: 'sans-serif', fontSize: 14, flexWrap: 'wrap',
    }}>
      <Link href="/" style={{ fontWeight: 'bold', textDecoration: 'none', color: '#16344A' }}>
        Portal do Comprador
      </Link>
      {user && (
        <>
          {ehProprietario && <Link href="/anomalias">As minhas reclamações</Link>}
          {ehProprietario && <Link href="/anomalias/nova">Nova reclamação</Link>}
          {ehEquipa && <Link href="/equipa">Painel da equipa</Link>}
          {ehEquipa && <Link href="/equipa/proprietarios">Gerir proprietários</Link>}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/definicoes" title={user.email} style={{ textDecoration: 'none' }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', background: '#2B5876', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold',
              }}>
                {Iniciais(user)}
              </div>
            </Link>
            <button onClick={sair} style={{ padding: '4px 10px' }}>Sair</button>
          </div>
        </>
      )}
      {!user && <Link href="/login" style={{ marginLeft: 'auto' }}>Entrar</Link>}
    </nav>
  )
}