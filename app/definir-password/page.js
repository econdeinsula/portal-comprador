'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function DefinirPassword() {
  const [password, setPassword] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const router = useRouter()

  async function guardar(e) {
    e.preventDefault()
    setErro('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setErro(error.message); return }
    setSucesso(true)
    setTimeout(() => router.push('/anomalias'), 1500)
  }

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Definir password</h1>
      {sucesso ? (
        <p>Password guardada! A entrar...</p>
      ) : (
        <form onSubmit={guardar}>
          <input
            type="password"
            placeholder="Nova password (mínimo 6 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{ width: '100%', padding: 10, marginBottom: 10 }}
          />
          {erro && <p style={{ color: 'red', fontSize: 13 }}>{erro}</p>}
          <button type="submit" style={{ padding: 10, width: '100%' }}>
            Guardar
          </button>
        </form>
      )}
    </main>
  )
}