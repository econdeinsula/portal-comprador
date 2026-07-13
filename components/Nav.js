'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function Nav() {
  const [user, setUser] = useState(null)
  const [ehEquipa, setEhEquipa] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        const { data } = await supabase
          .from('membros_equipa')
          .select('email')
          .eq('email', user.email)
          .maybeSingle()
        setEhEquipa(!!data)
      }
    }
    carregar()
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
          <Link href="/anomalias">As minhas reclamações</Link>
          <Link href="/anomalias/nova">Nova reclamação</Link>
          {ehEquipa && <Link href="/equipa">Painel da equipa</Link>}
          {ehEquipa && <Link href="/equipa/proprietarios">Gerir proprietários</Link>}
          <span style={{ marginLeft: 'auto', color: '#666' }}>{user.email}</span>
          <button onClick={sair} style={{ padding: '4px 10px' }}>Sair</button>
        </>
      )}
      {!user && <Link href="/login" style={{ marginLeft: 'auto' }}>Entrar</Link>}
    </nav>
  )
}