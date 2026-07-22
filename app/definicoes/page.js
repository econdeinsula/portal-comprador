'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Link from 'next/link'

const cartao = {
  background: '#fff', border: '1px solid #E7E4DA', borderRadius: 14, padding: 20, marginBottom: 18,
  boxShadow: '0 1px 3px rgba(20,41,58,0.05)',
}
const rotulo = { fontSize: 11, color: '#6B7178', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }
const campo = { padding: '9px 12px', border: '1px solid #E7E4DA', borderRadius: 8, fontSize: 14, width: '100%', marginBottom: 12 }

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
    <main style={{ maxWidth: 520, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Definições</h1>

      <div style={cartao}>
        <h3 style={{ fontSize: 13, marginTop: 0, marginBottom: 14, color: '#6B7178', textTransform: 'uppercase', letterSpacing: 0.3 }}>Perfil</h3>

        <label style={rotulo}>Email</label>
        <p style={{ marginTop: 0, marginBottom: 14, fontSize: 14, color: '#16344A' }}>{email}</p>

        <form onSubmit={guardarNome}>
          <label style={rotulo}>Nome</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="O teu nome completo"
            style={campo}
          />
          {erro && <p style={{ color: '#B4462F', fontSize: 13 }}>{erro}</p>}
          {sucesso && <p style={{ color: '#4B7A51', fontSize: 13 }}>{sucesso}</p>}
          <button type="submit" disabled={aGuardar}>
            {aGuardar ? 'A guardar...' : 'Guardar nome'}
          </button>
        </form>
      </div>

      <div style={cartao}>
        <h3 style={{ fontSize: 13, marginTop: 0, marginBottom: 14, color: '#6B7178', textTransform: 'uppercase', letterSpacing: 0.3 }}>Acesso</h3>
        <p style={{ fontSize: 14 }}>
          Perfil: <strong style={{ color: '#16344A' }}>{ehEquipa ? 'Equipa' : 'Proprietário'}</strong>
        </p>
        {fracoes.length > 0 && (
          <p style={{ fontSize: 14, marginBottom: 0 }}>
            Fração(ões) associada(s): <strong style={{ color: '#16344A' }}>{fracoes.join(', ')}</strong>
          </p>
        )}
      </div>

      <div style={cartao}>
        <h3 style={{ fontSize: 13, marginTop: 0, marginBottom: 10, color: '#6B7178', textTransform: 'uppercase', letterSpacing: 0.3 }}>Segurança</h3>
        <Link href="/login" style={{ fontSize: 14, fontWeight: 600 }}>Alterar a password (através do ecrã de login)</Link>
      </div>
    </main>
  )
}