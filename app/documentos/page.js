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
    <main style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Documentos</h1>
      {documentos.length === 0 && <p style={{ color: '#666' }}>Ainda não há documentos disponíveis.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {documentos.map((d) => (
          <li key={d.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 14, marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{TIPOS_NOME[d.tipo] || d.tipo}</strong>
              <div style={{ fontSize: 13, color: '#666' }}>{d.nome}</div>
            </div>
            <a href={d.ficheiro_url} target="_blank" rel="noopener noreferrer">Abrir</a>
          </li>
        ))}
      </ul>
    </main>
  )
}