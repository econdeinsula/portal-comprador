'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

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
    const { error } = await supabase
      .from('membros_equipa')
      .insert({ email: email.trim().toLowerCase() })

    if (error) { setErro(error.message); return }
    setSucesso(`${email} adicionado à equipa.`)
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
    <main style={{ maxWidth: 500, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Membros da equipa</h1>

      <form onSubmit={adicionar} style={{ marginBottom: 30 }}>
        <label style={{ fontSize: 13, fontWeight: 'bold' }}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: '100%', padding: 8, marginBottom: 8 }}
        />
        {erro && <p style={{ color: 'red', fontSize: 13 }}>{erro}</p>}
        {sucesso && <p style={{ color: 'green', fontSize: 13 }}>{sucesso}</p>}
        <button type="submit" style={{ padding: 8, width: '100%' }}>Adicionar à equipa</button>
      </form>

      <h2 style={{ fontSize: 16 }}>Membros atuais</h2>
      {carregando ? <p>A carregar...</p> : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {membros.map((m) => (
            <li key={m.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee' }}>
              <span style={{ fontSize: 14 }}>{m.email}</span>
              <button
                type="button"
                onClick={() => remover(m.email)}
                style={{ background: 'transparent', color: '#B4462F', padding: 0, fontSize: 13 }}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}