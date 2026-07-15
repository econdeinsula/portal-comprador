'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import Link from 'next/link'

const TIPOS_DOC = {
  planta: 'Planta',
  certificado_energetico: 'Certificado energético',
  certificado_garantia: 'Certificado de garantia',
  licenca: 'Licença',
  outro: 'Outro',
}

export default function DetalheFracao() {
  const [codigo, setCodigo] = useState('')
  const [fracao, setFracao] = useState(null)
  const [proprietarios, setProprietarios] = useState([])
  const [anomalias, setAnomalias] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function procurar(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    setFracao(null)

    const { data: f, error: erroFracao } = await supabase
      .from('fracoes')
      .select('id, codigo_fracao, empreendimentos ( lote )')
      .ilike('codigo_fracao', codigo.trim())
      .maybeSingle()

    if (erroFracao || !f) {
      setErro(`Fração "${codigo}" não encontrada.`)
      setCarregando(false)
      return
    }
    setFracao(f)

    const { data: ligacoes } = await supabase
      .from('fracao_proprietarios')
      .select('proprietarios ( nome, email )')
      .eq('fracao_id', f.id)
    setProprietarios((ligacoes || []).map((l) => l.proprietarios).filter(Boolean))

    const { data: anos } = await supabase
      .from('anomalias')
      .select('id, descricao, criado_em, estados ( nome ), categorias ( nome ), elementos ( nome )')
      .eq('fracao_id', f.id)
      .order('criado_em', { ascending: false })
    setAnomalias(anos || [])

    const { data: docs } = await supabase
      .from('documentos')
      .select('id, tipo, nome, ficheiro_url')
      .eq('fracao_id', f.id)
    setDocumentos(docs || [])

    setCarregando(false)
  }

  const planta = documentos.find((d) => d.tipo === 'planta')
  const outrosDocumentos = documentos.filter((d) => d.tipo !== 'planta')

  const abertas = anomalias.filter((a) => a.estados?.nome === 'Aberta').length
  const resolvidas = anomalias.filter((a) => a.estados?.nome === 'Resolvida').length

  return (
    <main style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Consultar fração</h1>

      <form onSubmit={procurar} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Código da fração (ex: BA)"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          required
          style={{ padding: 10, flex: 1 }}
        />
        <button type="submit">Procurar</button>
      </form>

      {erro && <p style={{ color: 'red' }}>{erro}</p>}
      {carregando && <p>A carregar...</p>}

      {fracao && !carregando && (
        <>
          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 20 }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>
              Fração {fracao.codigo_fracao} <span style={{ fontSize: 13, color: '#888', fontWeight: 'normal' }}>({fracao.empreendimentos?.lote})</span>
            </h2>

            <h3 style={{ fontSize: 13, marginBottom: 6 }}>Proprietário(s)</h3>
            {proprietarios.length === 0 && <p style={{ fontSize: 13, color: '#888' }}>Nenhum proprietário ligado a esta fração.</p>}
            {proprietarios.map((p, i) => (
              <p key={i} style={{ fontSize: 13, margin: '2px 0' }}>{p.nome} — {p.email}</p>
            ))}

            <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
              <div><strong style={{ fontSize: 20 }}>{anomalias.length}</strong><div style={{ fontSize: 12, color: '#666' }}>reclamações</div></div>
              <div><strong style={{ fontSize: 20, color: '#B4462F' }}>{abertas}</strong><div style={{ fontSize: 12, color: '#666' }}>abertas</div></div>
              <div><strong style={{ fontSize: 20, color: '#4B7A51' }}>{resolvidas}</strong><div style={{ fontSize: 12, color: '#666' }}>resolvidas</div></div>
            </div>
          </div>

          {planta && (
            <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <h3 style={{ marginTop: 0, fontSize: 14 }}>Planta</h3>
              <img src={planta.ficheiro_url} alt="Planta da fração" style={{ maxWidth: '100%', borderRadius: 6 }} />
            </div>
          )}

          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 20 }}>
            <h3 style={{ marginTop: 0, fontSize: 14 }}>Outros documentos</h3>
            {outrosDocumentos.length === 0 && <p style={{ fontSize: 13, color: '#888' }}>Nenhum documento adicional.</p>}
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {outrosDocumentos.map((d) => (
                <li key={d.id} style={{ fontSize: 13, padding: '4px 0' }}>
                  {TIPOS_DOC[d.tipo] || d.tipo} — <a href={d.ficheiro_url} target="_blank" rel="noopener noreferrer">{d.nome}</a>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
            <h3 style={{ marginTop: 0, fontSize: 14 }}>Reclamações</h3>
            {anomalias.length === 0 && <p style={{ fontSize: 13, color: '#888' }}>Sem reclamações registadas.</p>}
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {anomalias.map((a) => (
                <li key={a.id} style={{ borderBottom: '1px solid #eee', padding: '8px 0' }}>
                  <Link href={`/equipa/${a.id}`} style={{ fontSize: 13 }}>
                    {a.categorias?.nome ? `${a.categorias.nome} — ${a.elementos?.nome}` : 'Por classificar'}
                  </Link>
                  <div style={{ fontSize: 12, color: '#666' }}>{a.descricao} · {a.estados?.nome}</div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </main>
  )
}