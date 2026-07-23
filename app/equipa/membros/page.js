'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

const cartao = {
  background: '#fff', border: '1px solid #E7E4DA', borderRadius: 14, padding: 20, marginBottom: 20,
  boxShadow: '0 1px 3px rgba(20,41,58,0.05)',
}
const rotulo = { fontSize: 11, color: '#6B7178', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }
const campo = { padding: '9px 12px', border: '1px solid #E7E4DA', borderRadius: 8, fontSize: 14, width: '100%', marginBottom: 12 }

export default function GerirMembrosEquipa() {
  const [membros, setMembros] = useState([])
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    const { data } = await supabase.from('membros_equipa').select('email').order('email')
    setMembros(data || [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function adicionar(e) {
    e.preventDefault()
    setErro('')
    setSucesso('')
    const emailNormalizado = email.trim().toLowerCase()

    const { error } = await supabase
      .from('membros_equipa')
      .insert({ email: emailNormalizado })

    if (error) { setErro(error.message); return }

    let mensagemConvite = 'Convite enviado por email.'
    try {
      const respostaConvite = await fetch('/api/convidar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailNormalizado }),
      })
      const dadosConvite = await respostaConvite.json()
      if (!respostaConvite.ok) {
        mensagemConvite = `Convite NÃO enviado: ${dadosConvite.erro}`
      }
    } catch (e) {
      mensagemConvite = `Convite NÃO enviado (erro de rede): ${e.message}`
    }

    setSucesso(`${email} adicionado à equipa. ${mensagemConvite}`)
    setEmail('')
    carregar()
  }

  async function remover(emailMembro) {
    if (!confirm(`Remover ${emailMembro} da equipa? Deixa de ter acesso ao painel e ao dashboard.`)) return
    const { error } = await supabase.from('membros_equipa').delete().eq('email', emailMembro)
    if (error) { setErro(error.message); return }
    carregar()
  }

  return (
    <main style={{ maxWidth: 520, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Membros da equipa</h1>

      <div style={cartao}>
        <h3 style={{ fontSize: 13, marginTop: 0, marginBottom: 14, color: '#6B7178', textTransform: 'uppercase', letterSpacing: 0.3 }}>Adicionar membro</h3>
        <form onSubmit={adicionar}>
          <label style={rotulo}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={campo}
          />
          {erro && <p style={{ color: '#B4462F', fontSize: 13 }}>{erro}</p>}
          {sucesso && <p style={{ color: '#4B7A51', fontSize: 13 }}>{sucesso}</p>}
          <button type="submit">Adicionar à equipa</button>
        </form>
      </div>

      <h2 style={{ fontSize: 16 }}>Membros atuais</h2>
      {carregando ? <p style={{ color: '#6B7178' }}>A carregar...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {membros.map((m) => (
            <div key={m.email} style={{
              background: '#fff', border: '1px solid #E7E4DA', borderRadius: 12, padding: '12px 16px',
              boxShadow: '0 1px 3px rgba(20,41,58,0.05)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 14, color: '#16344A' }}>{m.email}</span>
              <button
                type="button"
                onClick={() => remover(m.email)}
                style={{ background: 'transparent', color: '#B4462F', padding: 0, fontSize: 13, boxShadow: 'none' }}
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}