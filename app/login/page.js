'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [erro, setErro] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [aRecuperar, setARecuperar] = useState(false)
  const router = useRouter()

  async function entrarComPassword(e) {
    e.preventDefault()
    setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setErro(error.message); return }
    router.push('/')
  }

  async function pedirRecuperacao(e) {
    e.preventDefault()
    setErro('')

    const emailNormalizado = email.trim().toLowerCase()

    const { data: proprietario } = await supabase
      .from('proprietarios').select('id').eq('email', emailNormalizado).maybeSingle()
    const { data: membro } = await supabase
      .from('membros_equipa').select('email').eq('email', emailNormalizado).maybeSingle()

    if (!proprietario && !membro) {
      setErro('Este email não está registado. Contacta a equipa se achas que devia ter acesso.')
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(emailNormalizado, {
      redirectTo: `${window.location.origin}/definir-password`,
    })
    if (error) { setErro(error.message); return }
    setEnviado(true)
  }

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Portal do Comprador</h1>

      {!aRecuperar ? (
        <>
          <form onSubmit={entrarComPassword}>
            <input
              type="email"
              placeholder="o-teu-email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: 10, marginBottom: 10 }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%', padding: 10, marginBottom: 10 }}
            />
            {erro && <p style={{ color: 'red', fontSize: 13 }}>{erro}</p>}
            <button type="submit" style={{ padding: 10, width: '100%' }}>
              Entrar
            </button>
          </form>
          <p style={{ fontSize: 13, marginTop: 12 }}>
            <a href="#" onClick={(e) => { e.preventDefault(); setARecuperar(true); setErro('') }}>
              Esqueci-me da password
            </a>
          </p>
        </>
      ) : (
        <>
          {enviado ? (
            <p>Enviámos um link para {email} — abre-o para definires a tua password.</p>
          ) : (
            <form onSubmit={pedirRecuperacao}>
              <p style={{ fontSize: 13, color: '#666' }}>
                Escreve o teu email — vais receber um link para definires (ou repores) a tua password.
              </p>
              <input
                type="email"
                placeholder="o-teu-email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%', padding: 10, marginBottom: 10 }}
              />
              {erro && <p style={{ color: 'red', fontSize: 13 }}>{erro}</p>}
              <button type="submit" style={{ padding: 10, width: '100%' }}>
                Enviar link
              </button>
            </form>
          )}
          <p style={{ fontSize: 13, marginTop: 12 }}>
            <a href="#" onClick={(e) => { e.preventDefault(); setARecuperar(false); setErro('') }}>
              Voltar ao login
            </a>
          </p>
        </>
      )}
    </main>
  )
}