'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Link from 'next/link'

export default function Definicoes() {
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [ehEquipa, setEhEquipa] = useState(false)
  const [fracoes, setFracoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [aGuardar, setAGuardar] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setCarregando(false); return }

      setEmail(user.email)
      setNome(user.user_metadata?.full_name || '')

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
          .select('fracoes ( codigo_fracao )')
          .eq('proprietario_id', proprietario.id)
        setFracoes((ligacoes || []).map((l) => l.fracoes?.codigo_fracao).filter(Boolean))
      }

      setCarregando(false)
    }
    carregar()
  }, [])

  async function guardarNome(e) {
    e.preventDefault()
    setErro('')
    setSucesso('')
    setAGuardar(true)
    const { error } = await supabase.auth.updateUser({ data: { full_name: nome } })
    setAGuardar(false)
    if (error) { setErro(error.message); return }
    setSucesso('Nome guardado.')
  }

  if (carregando) return <p style={{ padding: 40 }}>A carregar...</p>

  return (
    <main style={{ maxWidth: 500, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Definições</h1>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, marginTop: 0 }}>Perfil</h3>

        <label style={{ fontSize: 12, fontWeight: 'bold', display: 'block' }}>Email</label>
        <p style={{ marginTop: 2, color: '#666' }}>{email}</p>

        <form onSubmit={guardarNome}>
          <label style={{ fontSize: 12, fontWeight: 'bold', display: 'block' }}>Nome</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="O teu nome completo"
            style={{ width: '100%', padding: 8, marginTop: 4, marginBottom: 10 }}
          />
          {erro && <p style={{ color: 'red', fontSize: 13 }}>{erro}</p>}
          {sucesso && <p style={{ color: 'green', fontSize: 13 }}>{sucesso}</p>}
          <button type="submit" disabled={aGuardar} style={{ padding: '8px 16px' }}>
            {aGuardar ? 'A guardar...' : 'Guardar nome'}
          </button>
        </form>
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, marginTop: 0 }}>Acesso</h3>
        <p style={{ fontSize: 13 }}>
          Perfil: <strong>{ehEquipa ? 'Equipa' : 'Proprietário'}</strong>
        </p>
        {fracoes.length > 0 && (
          <p style={{ fontSize: 13 }}>
            Fração(ões) associada(s): <strong>{fracoes.join(', ')}</strong>
          </p>
        )}
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
        <h3 style={{ fontSize: 14, marginTop: 0 }}>Segurança</h3>
        <Link href="/login">Alterar a password (através do ecrã de login)</Link>
      </div>
    </main>
  )
}