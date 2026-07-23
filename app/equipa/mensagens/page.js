'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import Link from 'next/link'

const cartao = {
  background: '#fff', border: '1px solid #E7E4DA', borderRadius: 12, padding: '14px 18px',
  boxShadow: '0 1px 3px rgba(20,41,58,0.05)',
}

export default function MensagensEquipa() {
  const [mensagens, setMensagens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregar() {
      const { data, error } = await supabase
        .from('timeline_eventos')
        .select(`
          id, texto, tipo_evento, anexo_url, ocorrido_em,
          anomalias (
            id, descricao,
            categorias ( nome ),
            elementos ( nome ),
            fracoes ( codigo_fracao )
          )
        `)
        .eq('autor_tipo', 'proprietario')
        .order('ocorrido_em', { ascending: false })
        .limit(100)

      if (error) { setErro(error.message); setCarregando(false); return }
      setMensagens(data || [])
      setCarregando(false)
    }
    carregar()
  }, [])

  if (carregando) return <p style={{ padding: 40 }}>A carregar...</p>
  if (erro) return <p style={{ padding: 40, color: 'red' }}>{erro}</p>

  return (
    <main style={{ maxWidth: 780, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Mensagens</h1>
      <p style={{ color: '#6B7178', marginTop: 0, marginBottom: 24, fontSize: 14 }}>
        Últimas {mensagens.length} mensagens recebidas de proprietários, das mais recentes às mais antigas.
      </p>

      {mensagens.length === 0 && (
        <div style={{ ...cartao, textAlign: 'center', padding: 32 }}>
          <p style={{ color: '#6B7178', margin: 0 }}>Ainda não há mensagens de proprietários.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {mensagens.map((m) => (
          <Link key={m.id} href={`/equipa/${m.anomalias?.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={cartao}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, background: '#E4EEF3', color: '#2B5876', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                      {m.anomalias?.fracoes?.codigo_fracao}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#16344A' }}>
                      {m.anomalias?.categorias?.nome ? `${m.anomalias.categorias.nome} — ${m.anomalias.elementos?.nome}` : 'Por classificar'}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#6B7178', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.tipo_evento === 'anexo' ? '📎 ' : ''}{m.texto}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>
                  {new Date(m.ocorrido_em).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}