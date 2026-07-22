'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const TIPOS_NOME = {
  planta: 'Planta',
  certificado_energetico: 'Certificado energético',
  certificado_garantia: 'Certificado de garantia',
  licenca: 'Licença',
  outro: 'Outro',
}

export default function DocumentosProprietario() {
  const [documentos, setDocumentos] = useState([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setCarregando(false); return }

      const { data: proprietario } = await supabase
        .from('proprietarios').select('id').eq('email', user.email).maybeSingle()
      if (!proprietario) { setCarregando(false); return }

      const { data: ligacoes } = await supabase
        .from('fracao_proprietarios').select('fracao_id').eq('proprietario_id', proprietario.id)
      const fracaoIds = (ligacoes || []).map((l) => l.fracao_id)

      const { data: docsFracao } = await supabase
        .from('documentos')
        .select('id, tipo, nome, ficheiro_url, carregado_em')
        .in('fracao_id', fracaoIds)

      const { data: docsGerais } = await supabase
        .from('documentos')
        .select('id, tipo, nome, ficheiro_url, carregado_em')
        .not('empreendimento_id', 'is', null)

      setDocumentos([...(docsFracao || []), ...(docsGerais || [])])
      setCarregando(false)
    }
    carregar()
  }, [])

  if (carregando) return <p style={{ padding: 40 }}>A carregar...</p>

  return (
    <main style={{ maxWidth: 620, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Documentos</h1>
      {documentos.length === 0 && (
        <div style={{
          background: '#fff', border: '1px solid #E7E4DA', borderRadius: 14, padding: 32, textAlign: 'center',
        }}>
          <p style={{ color: '#6B7178' }}>Ainda não há documentos disponíveis.</p>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {documentos.map((d) => (
          <div key={d.id} style={{
            background: '#fff', border: '1px solid #E7E4DA', borderRadius: 12, padding: '14px 18px',
            boxShadow: '0 1px 3px rgba(20,41,58,0.05)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 11, color: '#6B7178', textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 600, marginBottom: 2 }}>
                {TIPOS_NOME[d.tipo] || d.tipo}
              </div>
              <div style={{ fontSize: 14, color: '#16344A', fontWeight: 500 }}>{d.nome}</div>
            </div>
            
              href={d.ficheiro_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: '7px 16px', background: '#2B5876', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              Abrir
            </a>
          </div>
        ))}
      </div>
    </main>
  )
}