'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

const cartao = {
  background: '#fff', border: '1px solid #E7E4DA', borderRadius: 14, padding: 20, marginBottom: 20,
  boxShadow: '0 1px 3px rgba(20,41,58,0.05)',
}
const rotulo = { fontSize: 11, color: '#6B7178', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }
const campo = { padding: '9px 12px', border: '1px solid #E7E4DA', borderRadius: 8, fontSize: 14, width: '100%', marginBottom: 12 }

export default function GerirEmpreendimentos() {
  const [empreendimentos, setEmpreendimentos] = useState([])
  const [fracoes, setFracoes] = useState([])

  const [loteNome, setLoteNome] = useState('')
  const [dataRececao, setDataRececao] = useState('')
  const [erroEmp, setErroEmp] = useState('')
  const [sucessoEmp, setSucessoEmp] = useState('')

  const [empreendimentoId, setEmpreendimentoId] = useState('')
  const [codigoFracaoNova, setCodigoFracaoNova] = useState('')
  const [erroFracao, setErroFracao] = useState('')
  const [sucessoFracao, setSucessoFracao] = useState('')

  async function carregar() {
    const { data: emps } = await supabase
      .from('empreendimentos')
      .select('id, lote, data_rececao_provisoria')
      .order('lote')
    setEmpreendimentos(emps || [])

    const { data: frs } = await supabase
      .from('fracoes')
      .select('id, codigo_fracao, empreendimentos ( lote )')
      .order('codigo_fracao')
    setFracoes(frs || [])
  }

  useEffect(() => { carregar() }, [])

  async function criarEmpreendimento(e) {
    e.preventDefault()
    setErroEmp('')
    setSucessoEmp('')

    const { error } = await supabase.from('empreendimentos').insert({
      lote: loteNome.trim(),
      data_rececao_provisoria: dataRececao,
    })

    if (error) { setErroEmp(error.message); return }
    setSucessoEmp(`"${loteNome}" criado com sucesso.`)
    setLoteNome('')
    setDataRececao('')
    carregar()
  }

  async function criarFracao(e) {
    e.preventDefault()
    setErroFracao('')
    setSucessoFracao('')

    if (!empreendimentoId) { setErroFracao('Escolhe o empreendimento.'); return }

    const { error } = await supabase.from('fracoes').insert({
      codigo_fracao: codigoFracaoNova.trim().toUpperCase(),
      empreendimento_id: empreendimentoId,
    })

    if (error) { setErroFracao(error.message); return }
    setSucessoFracao(`Fração "${codigoFracaoNova.toUpperCase()}" criada com sucesso.`)
    setCodigoFracaoNova('')
    carregar()
  }

  return (
    <main style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Empreendimentos e frações</h1>

      <div style={cartao}>
        <h3 style={{ fontSize: 13, marginTop: 0, marginBottom: 14, color: '#6B7178', textTransform: 'uppercase', letterSpacing: 0.3 }}>Criar novo empreendimento/lote</h3>
        <form onSubmit={criarEmpreendimento}>
          <label style={rotulo}>Nome (ex: Lote 3)</label>
          <input
            type="text"
            value={loteNome}
            onChange={(e) => setLoteNome(e.target.value)}
            required
            style={campo}
          />
          <label style={rotulo}>Data de receção provisória</label>
          <input
            type="date"
            value={dataRececao}
            onChange={(e) => setDataRececao(e.target.value)}
            required
            style={campo}
          />
          {erroEmp && <p style={{ color: '#B4462F', fontSize: 13 }}>{erroEmp}</p>}
          {sucessoEmp && <p style={{ color: '#4B7A51', fontSize: 13 }}>{sucessoEmp}</p>}
          <button type="submit">Criar empreendimento</button>
        </form>
      </div>

      <div style={cartao}>
        <h3 style={{ fontSize: 13, marginTop: 0, marginBottom: 14, color: '#6B7178', textTransform: 'uppercase', letterSpacing: 0.3 }}>Criar nova fração</h3>
        <form onSubmit={criarFracao}>
          <label style={rotulo}>Empreendimento</label>
          <select
            value={empreendimentoId}
            onChange={(e) => setEmpreendimentoId(e.target.value)}
            style={campo}
          >
            <option value="">Escolhe o empreendimento...</option>
            {empreendimentos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.lote} (receção: {new Date(e.data_rececao_provisoria).toLocaleDateString('pt-PT')})
              </option>
            ))}
          </select>
          <label style={rotulo}>Código da fração (ex: ACC)</label>
          <input
            type="text"
            value={codigoFracaoNova}
            onChange={(e) => setCodigoFracaoNova(e.target.value)}
            required
            style={campo}
          />
          {erroFracao && <p style={{ color: '#B4462F', fontSize: 13 }}>{erroFracao}</p>}
          {sucessoFracao && <p style={{ color: '#4B7A51', fontSize: 13 }}>{sucessoFracao}</p>}
          <button type="submit">Criar fração</button>
        </form>
      </div>

      <h2 style={{ fontSize: 16 }}>Empreendimentos existentes</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
        {empreendimentos.map((e) => (
          <div key={e.id} style={{
            background: '#fff', border: '1px solid #E7E4DA', borderRadius: 12, padding: '12px 16px',
            boxShadow: '0 1px 3px rgba(20,41,58,0.05)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#16344A' }}>{e.lote}</span>
            <span style={{ fontSize: 12, color: '#6B7178' }}>Receção: {new Date(e.data_rececao_provisoria).toLocaleDateString('pt-PT')}</span>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 16 }}>Frações existentes ({fracoes.length})</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {fracoes.map((f) => (
          <span key={f.id} style={{
            fontSize: 12, background: '#F3F1EA', color: '#16344A', padding: '5px 12px', borderRadius: 20, fontWeight: 500,
          }}>
            {f.codigo_fracao} <span style={{ color: '#6B7178' }}>· {f.empreendimentos?.lote}</span>
          </span>
        ))}
      </div>
    </main>
  )
}