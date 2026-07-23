'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function PesquisaGlobal() {
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState(null)
  const [aberto, setAberto] = useState(false)
  const [aProcurar, setAProcurar] = useState(false)
  const containerRef = useRef(null)
  const router = useRouter()

  useEffect(() => {
    function fecharSeClicarFora(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', fecharSeClicarFora)
    return () => document.removeEventListener('mousedown', fecharSeClicarFora)
  }, [])

  async function procurar(texto) {
    setTermo(texto)
    if (texto.trim().length < 2) {
      setResultados(null)
      return
    }

    setAProcurar(true)
    setAberto(true)

    const [proprietarios, anomalias, documentos, fracoes] = await Promise.all([
      supabase
        .from('proprietarios')
        .select('id, nome, email')
        .or(`nome.ilike.%${texto}%,email.ilike.%${texto}%`)
        .limit(5),
      supabase
        .from('anomalias')
        .select('id, descricao, fracoes ( codigo_fracao )')
        .ilike('descricao', `%${texto}%`)
        .limit(5),
      supabase
        .from('documentos')
        .select('id, nome, tipo')
        .ilike('nome', `%${texto}%`)
        .limit(5),
      supabase
        .from('fracoes')
        .select('id, codigo_fracao')
        .ilike('codigo_fracao', `%${texto}%`)
        .limit(5),
    ])

    setResultados({
      proprietarios: proprietarios.data || [],
      anomalias: anomalias.data || [],
      documentos: documentos.data || [],
      fracoes: fracoes.data || [],
    })
    setAProcurar(false)
  }

  function irPara(caminho) {
    setAberto(false)
    setTermo('')
    setResultados(null)
    router.push(caminho)
  }

  const semResultados = resultados &&
    resultados.proprietarios.length === 0 &&
    resultados.anomalias.length === 0 &&
    resultados.documentos.length === 0 &&
    resultados.fracoes.length === 0

  return (
    <div ref={containerRef} style={{ position: 'relative', marginBottom: 16 }}>
      <input
        type="text"
        placeholder="Pesquisar..."
        value={termo}
        onChange={(e) => procurar(e.target.value)}
        onFocus={() => termo.length >= 2 && setAberto(true)}
        style={{
          width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
          border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)',
          color: '#fff', boxSizing: 'border-box',
        }}
      />

      {aberto && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 50,
          background: '#fff', borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
          maxHeight: 400, overflowY: 'auto', padding: 8,
        }}>
          {aProcurar && <p style={{ fontSize: 12, color: '#6B7178', padding: 8, margin: 0 }}>A procurar...</p>}

          {!aProcurar && semResultados && (
            <p style={{ fontSize: 12, color: '#6B7178', padding: 8, margin: 0 }}>Sem resultados para "{termo}".</p>
          )}

          {!aProcurar && resultados && (
            <>
              {resultados.proprietarios.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 10, color: '#6B7178', textTransform: 'uppercase', fontWeight: 700, padding: '4px 8px' }}>Proprietários</div>
                  {resultados.proprietarios.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => irPara('/equipa/proprietarios')}
                      style={{ padding: '8px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F3F1EA'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontWeight: 600, color: '#16344A' }}>{p.nome}</div>
                      <div style={{ fontSize: 11, color: '#6B7178' }}>{p.email}</div>
                    </div>
                  ))}
                </div>
              )}

              {resultados.anomalias.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 10, color: '#6B7178', textTransform: 'uppercase', fontWeight: 700, padding: '4px 8px' }}>Reclamações</div>
                  {resultados.anomalias.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => irPara(`/equipa/${a.id}`)}
                      style={{ padding: '8px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F3F1EA'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontWeight: 600, color: '#16344A' }}>{a.fracoes?.codigo_fracao} — {a.descricao}</div>
                    </div>
                  ))}
                </div>
              )}

              {resultados.documentos.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 10, color: '#6B7178', textTransform: 'uppercase', fontWeight: 700, padding: '4px 8px' }}>Documentos</div>
                  {resultados.documentos.map((d) => (
                    <div
                      key={d.id}
                      onClick={() => irPara('/equipa/documentos')}
                      style={{ padding: '8px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F3F1EA'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontWeight: 600, color: '#16344A' }}>{d.nome}</div>
                    </div>
                  ))}
                </div>
              )}

              {resultados.fracoes.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: '#6B7178', textTransform: 'uppercase', fontWeight: 700, padding: '4px 8px' }}>Frações</div>
                  {resultados.fracoes.map((f) => (
                    <div
                      key={f.id}
                      onClick={() => irPara('/equipa/fracoes')}
                      style={{ padding: '8px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F3F1EA'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontWeight: 600, color: '#16344A' }}>{f.codigo_fracao}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}