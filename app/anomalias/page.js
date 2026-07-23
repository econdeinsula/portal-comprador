'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Link from 'next/link'

function EtiquetaEstado({ nome }) {
  const cores = {
    'Aberta': { bg: '#F6E4DF', cor: '#B4462F' },
    'Resolvida': { bg: '#E5EEE6', cor: '#4B7A51' },
    'Em análise': { bg: '#F7EBD6', cor: '#C8862B' },
    'Agendada': { bg: '#E4EEF3', cor: '#2B5876' },
  }
  const c = cores[nome] || { bg: '#F3F1EA', cor: '#6B7178' }
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap',
      background: c.bg, color: c.cor,
    }}>
      {nome}
    </span>
  )
}

export default function ListaAnomalias() {
  const [anomalias, setAnomalias] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [mostrarFracao, setMostrarFracao] = useState(false)

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setCarregando(false); return }

      const { data: proprietario } = await supabase
        .from('proprietarios')
        .select('id')
        .eq('email', user.email)
        .single()

      if (!proprietario) { setCarregando(false); return }

      const { data: ligacoes } = await supabase
        .from('fracao_proprietarios')
        .select('fracao_id')
        .eq('proprietario_id', proprietario.id)

      const fracaoIds = (ligacoes || []).map((l) => l.fracao_id)

      const { data, error } = await supabase
        .from('anomalias')
        .select(`
          id,
          descricao,
          criado_em,
          estados ( nome ),
          elementos ( nome ),
          categorias ( nome ),
          fracoes ( codigo_fracao )
        `)
        .in('fracao_id', fracaoIds)
        .order('criado_em', { ascending: false })

      if (!error && data) {
        const comIndicador = []
        for (const a of data) {
          const { data: ultimoEvento } = await supabase
            .from('timeline_eventos')
            .select('ocorrido_em')
            .eq('anomalia_id', a.id)
            .order('ocorrido_em', { ascending: false })
            .limit(1)
            .maybeSingle()

          const visto = typeof window !== 'undefined' && window.localStorage.getItem(`visto_${a.id}`)
          const naoLida = ultimoEvento && (!visto || new Date(ultimoEvento.ocorrido_em) > new Date(visto))
          comIndicador.push({ ...a, naoLida })
        }
        setAnomalias(comIndicador)
      }
      setMostrarFracao(fracaoIds.length > 1)
      setCarregando(false)
    }
    carregar()
  }, [])

  if (carregando) return <p style={{ padding: 40 }}>A carregar...</p>

  return (
    <main style={{ maxWidth: 780, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h1 style={{ marginBottom: 2 }}>As minhas reclamações</h1>
        <Link
          href="/anomalias/nova"
          style={{ padding: '9px 18px', background: '#2B5876', color: '#fff', borderRadius: 9, textDecoration: 'none', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}
        >
          + Nova reclamação
        </Link>
      </div>
      <p style={{ color: '#6B7178', marginTop: 0, marginBottom: 24, fontSize: 14 }}>
        {anomalias.length} reclamaç{anomalias.length === 1 ? 'ão' : 'ões'} associada{anomalias.length === 1 ? '' : 's'} à tua fração.
      </p>

      {anomalias.length === 0 && (
        <div style={{
          background: '#fff', borderRadius: 14, padding: 32, textAlign: 'center',
          border: '1px solid #E7E4DA',
        }}>
          <p style={{ color: '#6B7178', marginBottom: 16 }}>Ainda não tens nenhuma reclamação registada.</p>
          <Link href="/anomalias/nova" style={{ color: '#2B5876', fontWeight: 600 }}>Criar a primeira →</Link>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {anomalias.map((a) => (
          <Link key={a.id} href={`/anomalias/${a.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{
              background: '#fff', border: '1px solid #E7E4DA', borderRadius: 12, padding: '16px 18px',
              boxShadow: '0 1px 3px rgba(20,41,58,0.05)', transition: 'box-shadow 0.15s ease, transform 0.15s ease',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  {a.naoLida && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#C8862B', flexShrink: 0 }} />
                  )}
                  <strong style={{ fontSize: 14 }}>
                    {a.categorias?.nome ? `${a.categorias.nome} — ${a.elementos?.nome}` : 'Por classificar'}
                  </strong>
                  {mostrarFracao && (
                    <span style={{ fontSize: 11, background: '#E4EEF3', color: '#2B5876', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                      {a.fracoes?.codigo_fracao}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#6B7178', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.descricao}
                </div>
              </div>
              <EtiquetaEstado nome={a.estados?.nome} />
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}