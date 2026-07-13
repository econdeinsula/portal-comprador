'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)

  async function enviarLink(e) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (!error) setEnviado(true)
  }

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Portal do Comprador</h1>
      {enviado ? (
        <p>Enviámos um link de acesso para {email}. Verifica o teu email.</p>
      ) : (
        <form onSubmit={enviarLink}>
          <input
            type="email"
            placeholder="o-teu-email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: 10, marginBottom: 10 }}
          />
          <button type="submit" style={{ padding: 10, width: '100%' }}>
            Entrar
          </button>
        </form>
      )}
    </main>
  )
}