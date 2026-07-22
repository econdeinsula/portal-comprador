'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

const cartao = {
  background: '#fff', border: '1px solid #E7E4DA', borderRadius: 14, padding: 20, marginBottom: 20,
  boxShadow: '0 1px 3px rgba(20,41,58,0.05)',
}
const rotulo = { fontSize: 11, color: '#6B7178', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }
const campo = { padding: '9px 12px', border: '1px solid #E7E4DA', borderRadius: 8, fontSize: 14, width: '100%', marginBottom: 12 }

export default function GerirProprietarios() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [codigoFracao, setCodigoFracao] = useState('')
  const [empreendimentos, setEmpreendimentos] = useState([])
  const [empreendimentoId, setEmpreendimentoId] = useState('')
  const [ligacoes, setLigacoes] = useState([])
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  async function carregar() {
    const { data } = await supabase
      .from('fracao_proprietarios')
      .select(`
        fracao_id,
        proprietario_id,
        proprietarios ( nome, email ),
        fracoes ( codigo_fracao, empreendimentos ( lote ) )
      `)
      .order('fracao_id')
    setLigacoes(data || [])

    const { data: emps } = await supabase
      .from('empreendimentos')
      .select('id, lote')
      .order('lote')
    setEmpreendimentos(emps || [])
  }

  useEffect(() => { carregar() }, [])

  async function adicionar(e) {
    e.preventDefault()
    setErro('')
    setSucesso('')

    if (!empreendimentoId) { setErro('Escolhe o empreendimento/lote.'); return }

    const { data: fracao, error: erroFracao } = await supabase
      .from('fracoes')
      .select('id')
      .eq('codigo_fracao', codigoFracao.trim().toUpperCase())
      .eq('empreendimento_id', empreendimentoId)
      .maybeSingle()

    if (erroFracao || !fracao) { setErro(`Fração "${codigoFracao}" não encontrada nesse empreendimento.`); return }

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

    let mensagemConvite = 'Convite enviado por email.'
    try {
      const respostaConvite = await fetch('/api/convidar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const dadosConvite = await respostaConvite.json()
      if (!respostaConvite.ok) {
        mensagemConvite = `Convite NÃO enviado: ${dadosConvite.erro}`
      }
    } catch (e) {
      mensagemConvite = `Convite NÃO enviado (erro de rede): ${e.message}`
    }

    setSucesso(`${nome} (${email}) ligado à fração ${codigoFracao.toUpperCase()}. ${mensagemConvite}`)
    setNome('')
    setEmail('')
    setCodigoFracao('')
    setEmpreendimentoId('')
    carregar()
  }

  async function removerLigacao(ligacao) {
    if (!confirm(`Remover ${ligacao.proprietarios?.nome} da fração ${ligacao.fracoes?.codigo_fracao}?`)) return

    const { error } = await supabase
      .from('fracao_proprietarios')
      .delete()
      .eq('fracao_id', ligacao.fracao_id)
      .eq('proprietario_id', ligacao.proprietario_id)

    if (error) { setErro(error.message); return }
    carregar()
  }

  return (
    <main style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Gerir proprietários</h1>

      <div style={cartao}>
        <h3 style={{ fontSize: 13, marginTop: 0, marginBottom: 14, color: '#6B7178', textTransform: 'uppercase', letterSpacing: 0.3 }}>Adicionar proprietário</h3>
        <form onSubmit={adicionar}>
          <label style={rotulo}>Nome</label>
          <input
            type="text" value={nome} onChange={(e) => setNome(e.target.value)} required
            style={campo}
          />
          <label style={rotulo}>Email</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            style={campo}
          />

          <label style={rotulo}>Empreendimento/Lote</label>
          <select
            value={empreendimentoId}
            onChange={(e) => setEmpreendimentoId(e.target.value)}
            required
            style={campo}
          >
            <option value="">Escolhe o empreendimento...</option>
            {empreendimentos.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.lote}</option>
            ))}
          </select>

          <label style={rotulo}>Código da fração (ex: BA, A, AB)</label>
          <input
            type="text" value={codigoFracao} onChange={(e) => setCodigoFracao(e.target.value)} required
            style={campo}
          />

          {erro && <p style={{ color: '#B4462F', fontSize: 13 }}>{erro}</p>}
          {sucesso && <p style={{ color: '#4B7A51', fontSize: 13 }}>{sucesso}</p>}
          <button type="submit">Adicionar e ligar à fração</button>
        </form>
      </div>

      <h2 style={{ fontSize: 16 }}>Proprietários já ligados</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ligacoes.map((l, i) => (
          <div key={i} style={{
            background: '#fff', border: '1px solid #E7E4DA', borderRadius: 12, padding: '12px 16px',
            boxShadow: '0 1px 3px rgba(20,41,58,0.05)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <span style={{ fontSize: 11, background: '#E4EEF3', color: '#2B5876', padding: '3px 9px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {l.fracoes?.codigo_fracao} · {l.fracoes?.empreendimentos?.lote}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#16344A' }}>{l.proprietarios?.nome}</div>
                <div style={{ fontSize: 12, color: '#6B7178' }}>{l.proprietarios?.email}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => removerLigacao(l)}
              style={{ background: 'transparent', color: '#B4462F', padding: 0, fontSize: 13, boxShadow: 'none', flexShrink: 0 }}
            >
              Remover
            </button>
          </div>
        ))}
      </div>
    </main>
  )
}