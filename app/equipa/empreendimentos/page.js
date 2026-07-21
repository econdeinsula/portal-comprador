'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

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

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <h3 style={{ marginTop: 0, fontSize: 14 }}>Criar novo empreendimento/lote</h3>
        <form onSubmit={criarEmpreendimento}>
          <label style={{ fontSize: 12, fontWeight: 'bold', display: 'block' }}>Nome (ex: Lote 3)</label>
          <input
            type="text"
            value={loteNome}
            onChange={(e) => setLoteNome(e.target.value)}
            required
            style={{ width: '100%', padding: 8, marginBottom: 8 }}
          />
          <label style={{ fontSize: 12, fontWeight: 'bold', display: 'block' }}>Data de receção provisória</label>
          <input
            type="date"
            value={dataRececao}
            onChange={(e) => setDataRececao(e.target.value)}
            required
            style={{ width: '100%', padding: 8, marginBottom: 8 }}
          />
          {erroEmp && <p style={{ color: 'red', fontSize: 13 }}>{erroEmp}</p>}
          {sucessoEmp && <p style={{ color: 'green', fontSize: 13 }}>{sucessoEmp}</p>}
          <button type="submit" style={{ padding: 8, width: '100%' }}>Criar empreendimento</button>
        </form>
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <h3 style={{ marginTop: 0, fontSize: 14 }}>Criar nova fração</h3>
        <form onSubmit={criarFracao}>
          <label style={{ fontSize: 12, fontWeight: 'bold', display: 'block' }}>Empreendimento</label>
          <select
            value={empreendimentoId}
            onChange={(e) => setEmpreendimentoId(e.target.value)}
            style={{ width: '100%', padding: 8, marginBottom: 8 }}
          >
            <option value="">Escolhe o empreendimento...</option>
            {empreendimentos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.lote} (receção: {new Date(e.data_rececao_provisoria).toLocaleDateString('pt-PT')})
              </option>
            ))}
          </select>
          <label style={{ fontSize: 12, fontWeight: 'bold', display: 'block' }}>Código da fração (ex: ACC)</label>
          <input
            type="text"
            value={codigoFracaoNova}
            onChange={(e) => setCodigoFracaoNova(e.target.value)}
            required
            style={{ width: '100%', padding: 8, marginBottom: 8 }}
          />
          {erroFracao && <p style={{ color: 'red', fontSize: 13 }}>{erroFracao}</p>}
          {sucessoFracao && <p style={{ color: 'green', fontSize: 13 }}>{sucessoFracao}</p>}
          <button type="submit" style={{ padding: 8, width: '100%' }}>Criar fração</button>
        </form>
      </div>

      <h2 style={{ fontSize: 16 }}>Empreendimentos existentes</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: 6 }}>Lote</th>
            <th style={{ padding: 6 }}>Data de receção</th>
          </tr>
        </thead>
        <tbody>
          {empreendimentos.map((e) => (
            <tr key={e.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 6 }}>{e.lote}</td>
              <td style={{ padding: 6 }}>{new Date(e.data_rececao_provisoria).toLocaleDateString('pt-PT')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 16 }}>Frações existentes ({fracoes.length})</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: 6 }}>Código</th>
            <th style={{ padding: 6 }}>Empreendimento</th>
          </tr>
        </thead>
        <tbody>
          {fracoes.map((f) => (
            <tr key={f.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 6 }}>{f.codigo_fracao}</td>
              <td style={{ padding: 6 }}>{f.empreendimentos?.lote}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}