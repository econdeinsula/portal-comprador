'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Link from 'next/link'

export default function PainelEquipa() {
  const [anomalias, setAnomalias] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [semAcesso, setSemAcesso] = useState(false)

  useEffect(() => {
    async function carregar() {
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
        .order('criado_em', { ascending: false })
        .limit(50)

      if (error || !data || data.length === 0) {
        setSemAcesso(true)
      } else {
        setAnomalias(data)
      }
      setCarregando(false)
    }
    carregar()
  }, [])

  if (carregando) return <p>A carregar...</p>
  if (semAcesso) return <p style={{ padding: 40 }}>Sem acesso ao painel da equipa (não estás na lista de membros da equipa).</p>

  return (
    <main style={{ maxWidth: 900, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Painel da equipa</h1>
      <p style={{ fontSize: 13, color: '#666' }}>A mostrar as 50 reclamações mais recentes de todas as frações.</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: 8 }}>Fração</th>
            <th style={{ padding: 8 }}>Categoria</th>
            <th style={{ padding: 8 }}>Descrição</th>
            <th style={{ padding: 8 }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {anomalias.map((a) => (
            <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8 }}>{a.fracoes?.codigo_fracao}</td>
              <td style={{ padding: 8 }}>{a.categorias?.nome || 'Por classificar'}</td>
              <td style={{ padding: 8 }}>
                <Link href={`/equipa/${a.id}`}>{a.descricao}</Link>
              </td>
              <td style={{ padding: 8 }}>{a.estados?.nome}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}