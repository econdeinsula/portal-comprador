'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

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

function ItemMenu({ href, children, ativo }) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: '10px 16px',
        borderRadius: 8,
        fontSize: 14,
        fontWeight: ativo ? 600 : 500,
        color: ativo ? '#fff' : 'rgba(255,255,255,0.72)',
        background: ativo ? 'rgba(255,255,255,0.12)' : 'transparent',
        textDecoration: 'none',
        marginBottom: 2,
      }}
    >
      {children}
    </Link>
  )
}

export default function Nav() {
  const [user, setUser] = useState(null)
  const [ehEquipa, setEhEquipa] = useState(false)
  const [ehProprietario, setEhProprietario] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  async function verificarPerfis(currentUser) {
    if (!currentUser) { setEhEquipa(false); setEhProprietario(false); return }

    const { data: equipa } = await supabase
      .from('membros_equipa').select('email').eq('email', currentUser.email).maybeSingle()
    setEhEquipa(!!equipa)

    const { data: proprietario } = await supabase
      .from('proprietarios').select('id').eq('email', currentUser.email).maybeSingle()

    if (proprietario) {
      const { data: ligacao } = await supabase
        .from('fracao_proprietarios').select('fracao_id').eq('proprietario_id', proprietario.id).limit(1).maybeSingle()
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

  if (!user) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10,
        padding: '16px 24px', background: 'linear-gradient(135deg, #14293A, #0D1D29)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'sans-serif',
      }}>
        <Link href="/" style={{ color: '#fff', fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 18, textDecoration: 'none' }}>
          Portal do Comprador
        </Link>
        <Link href="/login" style={{ color: '#fff', fontSize: 14, textDecoration: 'none' }}>Entrar</Link>
      </div>
    )
  }

  return (
    <aside style={{
      width: 220, minHeight: '100vh', flexShrink: 0,
      background: 'linear-gradient(180deg, #14293A, #0D1D29)',
      display: 'flex', flexDirection: 'column', padding: '22px 14px',
      fontFamily: 'sans-serif', position: 'sticky', top: 0, alignSelf: 'flex-start',
    }}>
      <div style={{ padding: '0 8px 24px', fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 18, color: '#fff' }}>
        Portal do<br />Comprador
      </div>

      <nav style={{ flex: 1 }}>
        {ehProprietario && (
          <>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'rgba(255,255,255,0.4)', padding: '0 16px', marginBottom: 6 }}>
              Proprietário
            </div>
            <ItemMenu href="/anomalias" ativo={pathname === '/anomalias'}>As minhas reclamações</ItemMenu>
            <ItemMenu href="/anomalias/nova" ativo={pathname === '/anomalias/nova'}>+ Nova reclamação</ItemMenu>
            <div style={{ height: 16 }} />
          </>
        )}
        {ehEquipa && (
          <>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'rgba(255,255,255,0.4)', padding: '0 16px', marginBottom: 6 }}>
              Equipa
            </div>
            <ItemMenu href="/equipa" ativo={pathname === '/equipa'}>Painel</ItemMenu>
            <ItemMenu href="/equipa/dashboard" ativo={pathname === '/equipa/dashboard'}>Dashboard</ItemMenu>
            <ItemMenu href="/equipa/proprietarios" ativo={pathname === '/equipa/proprietarios'}>Gerir proprietários</ItemMenu>
          </>
        )}
      </nav>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href="/definicoes" style={{ textDecoration: 'none' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: '#C8862B', color: '#2A1D08',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
          }}>
            {Iniciais(user)}
          </div>
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.user_metadata?.full_name || user.email}
          </div>
          <button onClick={sair} style={{ background: 'transparent', boxShadow: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 11, padding: 0, fontWeight: 500 }}>
            Sair
          </button>
        </div>
      </div>
    </aside>
  )
}