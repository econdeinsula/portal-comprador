'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link'

export default function Home() {
  const [user, setUser] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setCarregando(false)
    }
    carregar()
  }, [])

  if (carregando) return <p style={{ padding: 40 }}>A carregar...</p>

  return (
    <main style={{ maxWidth: 600, margin: '60px auto', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>Portal do Comprador</h1>
      <p style={{ color: '#666' }}>Gestão de reclamações e garantias — Hera Residences</p>
      {!user ? (
        <Link
          href="/login"
          style={{ display: 'inline-block', marginTop: 20, padding: '10px 20px', background: '#2B5876', color: '#fff', borderRadius: 8, textDecoration: 'none' }}
        >
          Entrar
        </Link>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20, alignItems: 'center' }}>
          <Link href="/anomalias">Ver as minhas reclamações</Link>
          <Link href="/anomalias/nova">Criar nova reclamação</Link>
        </div>
      )}
    </main>
  )
}