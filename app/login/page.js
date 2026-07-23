'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'

const campo = { padding: '11px 14px', border: '1px solid #E7E4DA', borderRadius: 9, fontSize: 14, width: '100%', marginBottom: 12, boxSizing: 'border-box' }

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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 20% 20%, #E4EEF3 0%, #F7F5F0 45%)',
      fontFamily: 'sans-serif',
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: '#fff',
        borderRadius: 18,
        padding: '38px 36px',
        boxShadow: '0 12px 32px rgba(20,41,58,0.12)',
        border: '1px solid #E7E4DA',
      }}>
        <img src="/logo.png" alt="Portal do Cliente" style={{ height: 90, marginBottom: 24, display: 'block' }} />

        <h1 style={{
          fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, color: '#16344A',
          margin: '0 0 4px', fontWeight: 600,
        }}>
          Portal do Cliente
        </h1>
        <p style={{ color: '#6B7178', fontSize: 13, margin: '0 0 28px' }}>
          {aRecuperar ? 'Recupera o acesso à tua conta.' : 'Entra para acompanhar as tuas reclamações.'}
        </p>

        {!aRecuperar ? (
          <>
            <form onSubmit={entrarComPassword}>
              <label style={{ fontSize: 11, color: '#6B7178', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, display: 'block', marginBottom: 4 }}>Email</label>
              <input
                type="email"
                placeholder="o-teu-email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={campo}
              />
              <label style={{ fontSize: 11, color: '#6B7178', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, display: 'block', marginBottom: 4 }}>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={campo}
              />
              {erro && <p style={{ color: '#B4462F', fontSize: 13, marginTop: -4 }}>{erro}</p>}
              <button type="submit" style={{ width: '100%', padding: 12, marginTop: 6, fontSize: 14 }}>
                Entrar
              </button>
            </form>
            <p style={{ fontSize: 13, marginTop: 18, textAlign: 'center' }}>
              <a href="#" onClick={(e) => { e.preventDefault(); setARecuperar(true); setErro('') }} style={{ color: '#2B5876', fontWeight: 500 }}>
                Esqueci-me da password
              </a>
            </p>
          </>
        ) : (
          <>
            {enviado ? (
              <p style={{ fontSize: 14, color: '#16344A' }}>Enviámos um link para <strong>{email}</strong> — abre-o para definires a tua password.</p>
            ) : (
              <form onSubmit={pedirRecuperacao}>
                <p style={{ fontSize: 13, color: '#6B7178', marginTop: 0 }}>
                  Escreve o teu email — vais receber um link para definires (ou repores) a tua password.
                </p>
                <label style={{ fontSize: 11, color: '#6B7178', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, display: 'block', marginBottom: 4 }}>Email</label>
                <input
                  type="email"
                  placeholder="o-teu-email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={campo}
                />
                {erro && <p style={{ color: '#B4462F', fontSize: 13, marginTop: -4 }}>{erro}</p>}
                <button type="submit" style={{ width: '100%', padding: 12, marginTop: 6, fontSize: 14 }}>
                  Enviar link
                </button>
              </form>
            )}
            <p style={{ fontSize: 13, marginTop: 18, textAlign: 'center' }}>
              <a href="#" onClick={(e) => { e.preventDefault(); setARecuperar(false); setErro('') }} style={{ color: '#2B5876', fontWeight: 500 }}>
                ← Voltar ao login
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}