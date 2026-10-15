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

  const [pessoas, setPessoas] = useState([])
  const [painelApagar, setPainelApagar] = useState(null)
  const [confirmacao, setConfirmacao] = useState('')
  const [incluirReclamacoes, setIncluirReclamacoes] = useState(false)
  const [msgRgpd, setMsgRgpd] = useState('')
  const [erroRgpd, setErroRgpd] = useState('')
  const [aTrabalhar, setATrabalhar] = useState(false)

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

    const { data: todos } = await supabase
      .from('proprietarios')
      .select('id, nome, email')
      .order('nome')
    setPessoas(todos || [])
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

  // ---------- RGPD ----------

  async function chamarRgpd(corpo) {
    const { data: { session } } = await supabase.auth.getSession()
    const resposta = await fetch('/api/rgpd', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify(corpo),
    })
    const dados = await resposta.json().catch(() => ({}))
    if (!resposta.ok) throw new Error(dados.erro || 'Erro no pedido')
    return dados
  }

  async function exportar(pessoa) {
    setErroRgpd('')
    setMsgRgpd('')
    setATrabalhar(true)
    try {
      const dados = await chamarRgpd({ acao: 'exportar', proprietarioId: pessoa.id })
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dados-proprietario-${pessoa.id.slice(0, 8)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMsgRgpd('Dados exportados. Os links dos ficheiros dentro do ficheiro descarregado expiram em 24 horas.')
    } catch (e) {
      setErroRgpd(e.message)
    }
    setATrabalhar(false)
  }

  function abrirPainelApagar(pessoa) {
    setErroRgpd('')
    setMsgRgpd('')
    setConfirmacao('')
    setIncluirReclamacoes(false)
    setPainelApagar(painelApagar === pessoa.id ? null : pessoa.id)
  }

  async function apagar(pessoa) {
    setErroRgpd('')
    setMsgRgpd('')
    if (confirmacao.trim().toLowerCase() !== (pessoa.email || '').toLowerCase()) {
      setErroRgpd('O email escrito não coincide com o do proprietário.')
      return
    }
    setATrabalhar(true)
    try {
      const dados = await chamarRgpd({ acao: 'apagar', proprietarioId: pessoa.id, incluirReclamacoes })
      const r = dados.relatorio
      const partes = [
        'Dados apagados.',
        incluirReclamacoes ? `Reclamações apagadas: ${r.reclamacoes_apagadas}. Ficheiros apagados: ${r.ficheiros_apagados}.` : 'As reclamações das frações foram mantidas.',
        r.conta_apagada ? 'Conta de login apagada.' : r.conta_mantida_motivo,
        r.fracoes_partilhadas_ignoradas > 0 ? `${r.fracoes_partilhadas_ignoradas} fração(ões) com mais proprietários mantiveram as reclamações.` : null,
      ].filter(Boolean)
      setMsgRgpd(partes.join(' '))
      setPainelApagar(null)
      setConfirmacao('')
      setIncluirReclamacoes(false)
      carregar()
    } catch (e) {
      setErroRgpd(e.message)
    }
    setATrabalhar(false)
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
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

      <h2 style={{ fontSize: 16 }}>Dados pessoais (RGPD)</h2>
      <p style={{ fontSize: 13, color: '#6B7178', marginTop: 0, marginBottom: 14 }}>
        Exporta os dados de um proprietário (pedido de acesso) ou apaga-os (pedido de eliminação).
        Usa só quando houver um pedido da própria pessoa ou indicação de quem trata da proteção de dados.
      </p>

      {msgRgpd && <p style={{ color: '#4B7A51', fontSize: 13 }}>{msgRgpd}</p>}
      {erroRgpd && <p style={{ color: '#B4462F', fontSize: 13 }}>{erroRgpd}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pessoas.length === 0 && <p style={{ fontSize: 13, color: '#6B7178' }}>Ainda não há proprietários registados.</p>}
        {pessoas.map((p) => (
          <div key={p.id} style={{
            background: '#fff', border: '1px solid #E7E4DA', borderRadius: 12, padding: '12px 16px',
            boxShadow: '0 1px 3px rgba(20,41,58,0.05)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#16344A' }}>{p.nome}</div>
                <div style={{ fontSize: 12, color: '#6B7178' }}>{p.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => exportar(p)}
                  disabled={aTrabalhar}
                  style={{ fontSize: 12, padding: '6px 12px' }}
                >
                  Exportar dados
                </button>
                <button
                  type="button"
                  onClick={() => abrirPainelApagar(p)}
                  style={{ background: 'transparent', color: '#B4462F', padding: 0, fontSize: 12, boxShadow: 'none' }}
                >
                  {painelApagar === p.id ? 'Cancelar' : 'Apagar dados…'}
                </button>
              </div>
            </div>

            {painelApagar === p.id && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F0EEE7' }}>
                <p style={{ fontSize: 13, color: '#16344A', marginTop: 0 }}>
                  Vai apagar o registo de <strong>{p.nome}</strong>, as ligações às frações e a conta de login.
                  Esta ação não se pode desfazer. Faz primeiro a exportação, se for preciso guardar uma cópia.
                </p>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, marginBottom: 12 }}>
                  <input
                    type="checkbox"
                    checked={incluirReclamacoes}
                    onChange={(e) => setIncluirReclamacoes(e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    Apagar também as reclamações, mensagens e fotos das frações onde esta pessoa é a <strong>única</strong> proprietária.
                    Se ficar desmarcado, as reclamações mantêm-se associadas à fração. As frações com mais proprietários nunca são apagadas.
                  </span>
                </label>

                <label style={rotulo}>Para confirmar, escreve o email do proprietário</label>
                <input
                  type="text"
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                  placeholder={p.email}
                  style={campo}
                />
                <button
                  type="button"
                  onClick={() => apagar(p)}
                  disabled={aTrabalhar}
                  style={{ background: '#B4462F', fontSize: 13, padding: '8px 14px' }}
                >
                  {aTrabalhar ? 'A apagar...' : 'Apagar definitivamente'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  )
}