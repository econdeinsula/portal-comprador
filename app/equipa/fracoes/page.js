'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import Link from 'next/link'

const TIPOS_DOC = {
  planta: 'Planta',
  certificado_energetico: 'Certificado energético',
  certificado_garantia: 'Certificado de garantia',
  licenca: 'Licença',
  outro: 'Outro',
}

const cartao = {
  background: '#fff', border: '1px solid #E7E4DA', borderRadius: 14, padding: 20, marginBottom: 20,
  boxShadow: '0 1px 3px rgba(20,41,58,0.05)',
}

function EtiquetaEstado({ nome }) {
  const cores = {
    'Aberta': { bg: '#F6E4DF', cor: '#B4462F' },
    'Resolvida': { bg: '#E5EEE6', cor: '#4B7A51' },
    'Em análise': { bg: '#F7EBD6', cor: '#C8862B' },
    'Agendada': { bg: '#E4EEF3', cor: '#2B5876' },
  }
  const c = cores[nome] || { bg: '#F3F1EA', cor: '#6B7178' }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap', background: c.bg, color: c.cor }}>
      {nome}
    </span>
  )
}

function ConteudoDetalheFracao() {
  const searchParams = useSearchParams()
  const [codigo, setCodigo] = useState('')
  const [fracao, setFracao] = useState(null)
  const [proprietarios, setProprietarios] = useState([])
  const [anomalias, setAnomalias] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const codigoUrl = searchParams.get('codigo')
    if (codigoUrl) {
      setCodigo(codigoUrl)
      procurar(null, codigoUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function procurar(e, codigoForcado) {
    if (e) e.preventDefault()
    const codigoAProcurar = codigoForcado || codigo
    setErro('')
    setCarregando(true)
    setFracao(null)

    const { data: f, error: erroFracao } = await supabase
      .from('fracoes')
      .select('id, codigo_fracao, empreendimentos ( lote )')
      .ilike('codigo_fracao', codigoAProcurar.trim())
      .maybeSingle()

    if (erroFracao || !f) {
      setErro(`Fração "${codigoAProcurar}" não encontrada.`)
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
    <main style={{ maxWidth: 780, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Consultar fração</h1>

      <form onSubmit={procurar} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Código da fração (ex: BA)"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          required
          style={{ padding: '10px 14px', border: '1px solid #E7E4DA', borderRadius: 8, fontSize: 14, flex: 1 }}
        />
        <button type="submit">Procurar</button>
      </form>

      {erro && <p style={{ color: '#B4462F', fontSize: 13 }}>{erro}</p>}
      {carregando && <p style={{ color: '#6B7178' }}>A carregar...</p>}

      {fracao && !carregando && (
        <>
          <div style={cartao}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h2 style={{ marginTop: 0, marginBottom: 14, fontSize: 18 }}>
                Fração {fracao.codigo_fracao} <span style={{ fontSize: 13, color: '#6B7178', fontWeight: 'normal' }}>({fracao.empreendimentos?.lote})</span>
              </h2>
            </div>

            <div style={{ fontSize: 11, color: '#6B7178', textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 600, marginBottom: 6 }}>Proprietário(s)</div>
            {proprietarios.length === 0 && <p style={{ fontSize: 13, color: '#6B7178' }}>Nenhum proprietário ligado a esta fração.</p>}
            {proprietarios.map((p, i) => (
              <p key={i} style={{ fontSize: 13, margin: '2px 0', color: '#16344A' }}>{p.nome} — {p.email}</p>
            ))}

            <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
              <div><strong style={{ fontSize: 22, color: '#16344A' }}>{anomalias.length}</strong><div style={{ fontSize: 12, color: '#6B7178' }}>reclamações</div></div>
              <div><strong style={{ fontSize: 22, color: '#B4462F' }}>{abertas}</strong><div style={{ fontSize: 12, color: '#6B7178' }}>abertas</div></div>
              <div><strong style={{ fontSize: 22, color: '#4B7A51' }}>{resolvidas}</strong><div style={{ fontSize: 12, color: '#6B7178' }}>resolvidas</div></div>
            </div>
          </div>

          {planta && (
            <div style={cartao}>
              <h3 style={{ fontSize: 13, marginTop: 0, marginBottom: 14, color: '#6B7178', textTransform: 'uppercase', letterSpacing: 0.3 }}>Planta</h3>
              <img src={planta.ficheiro_url} alt="Planta da fração" style={{ maxWidth: '100%', borderRadius: 10 }} />
            </div>
          )}

          <div style={cartao}>
            <h3 style={{ fontSize: 13, marginTop: 0, marginBottom: 14, color: '#6B7178', textTransform: 'uppercase', letterSpacing: 0.3 }}>Outros documentos</h3>
            {outrosDocumentos.length === 0 && <p style={{ fontSize: 13, color: '#6B7178' }}>Nenhum documento adicional.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {outrosDocumentos.map((d) => (
                <div key={d.id} style={{ fontSize: 13, display: 'flex', gap: 8 }}>
                  <span style={{ color: '#6B7178' }}>{TIPOS_DOC[d.tipo] || d.tipo}</span>
                  <a href={d.ficheiro_url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>{d.nome}</a>
                </div>
              ))}
            </div>
          </div>

          <div style={cartao}>
            <h3 style={{ fontSize: 13, marginTop: 0, marginBottom: 14, color: '#6B7178', textTransform: 'uppercase', letterSpacing: 0.3 }}>Reclamações</h3>
            {anomalias.length === 0 && <p style={{ fontSize: 13, color: '#6B7178' }}>Sem reclamações registadas.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {anomalias.map((a) => (
                <Link
                  key={a.id}
                  href={`/equipa/${a.id}`}
                  style={{
                    textDecoration: 'none', color: 'inherit', padding: '10px 4px',
                    borderTop: '1px solid #F0EEE7',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#16344A' }}>
                      {a.categorias?.nome ? `${a.categorias.nome} — ${a.elementos?.nome}` : 'Por classificar'}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7178', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.descricao}</div>
                  </div>
                  <EtiquetaEstado nome={a.estados?.nome} />
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  )
}

export default function DetalheFracao() {
  return (
    <Suspense fallback={<p style={{ padding: 40 }}>A carregar...</p>}>
      <ConteudoDetalheFracao />
    </Suspense>
  )
}