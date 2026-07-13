'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function GerirProprietarios() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [codigoFracao, setCodigoFracao] = useState('')
  const [ligacoes, setLigacoes] = useState([])
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  async function carregar() {
    const { data } = await supabase
      .from('fracao_proprietarios')
      .select(`
        fracao_id,
        proprietarios ( nome, email ),
        fracoes ( codigo_fracao )
      `)
      .order('fracao_id')
    setLigacoes(data || [])
  }

  useEffect(() => { carregar() }, [])

  async function adicionar(e) {
    e.preventDefault()
    setErro('')
    setSucesso('')

    const { data: fracao, error: erroFracao } = await supabase
      .from('fracoes')
      .select('id')
      .eq('codigo_fracao', codigoFracao.trim().toUpperCase())
      .maybeSingle()

    if (erroFracao || !fracao) { setErro(`Fração "${codigoFracao}" não encontrada.`); return }

    const { data: proprietario, error: erroProp } = await supabase
      .from('proprietarios')
      .upsert({ nome, email: email.trim().toLowerCase() }, { onConflict: 'email' })
      .select()
      .single()

    if (erroProp) { setErro('Erro ao criar proprietário: ' + erroProp.message); return }

    const { error: erroLigacao } = await supabase
      .from('fracao_proprietarios')
      .insert({ fracao_id: fracao.id, proprietario_id: proprietario.id })

    if (erroLigacao) { setErro('Erro ao ligar à fração: ' + erroLigacao.message); return }

    setSucesso(`${nome} (${email}) ligado à fração ${codigoFracao.toUpperCase()}.`)
    setNome('')
    setEmail('')
    setCodigoFracao('')
    carregar()
  }

  return (
    <main style={{ maxWidth: 600, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Gerir proprietários</h1>

      <form onSubmit={adicionar} style={{ marginBottom: 30 }}>
        <label style={{ fontSize: 13, fontWeight: 'bold' }}>Nome</label>
        <input
          type="text" value={nome} onChange={(e) => setNome(e.target.value)} required
          style={{ width: '100%', padding: 8, marginBottom: 8 }}
        />
        <label style={{ fontSize: 13, fontWeight: 'bold' }}>Email</label>
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
          style={{ width: '100%', padding: 8, marginBottom: 8 }}
        />
        <label style={{ fontSize: 13, fontWeight: 'bold' }}>Código da fração (ex: BA, A, AB)</label>
        <input
          type="text" value={codigoFracao} onChange={(e) => setCodigoFracao(e.target.value)} required
          style={{ width: '100%', padding: 8, marginBottom: 8 }}
        />
        <button type="submit" style={{ padding: 8, width: '100%' }}>Adicionar e ligar à fração</button>
      </form>

      {erro && <p style={{ color: 'red' }}>{erro}</p>}
      {sucesso && <p style={{ color: 'green' }}>{sucesso}</p>}

      <h2 style={{ fontSize: 16 }}>Proprietários já ligados</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: 6 }}>Fração</th>
            <th style={{ padding: 6 }}>Nome</th>
            <th style={{ padding: 6 }}>Email</th>
          </tr>
        </thead>
        <tbody>
          {ligacoes.map((l, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 6 }}>{l.fracoes?.codigo_fracao}</td>
              <td style={{ padding: 6 }}>{l.proprietarios?.nome}</td>
              <td style={{ padding: 6 }}>{l.proprietarios?.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}