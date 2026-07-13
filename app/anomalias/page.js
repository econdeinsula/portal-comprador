'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function ListaAnomalias() {
  const [anomalias, setAnomalias] = useState([])
  const [carregando, setCarregando] = useState(true)

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
          categorias ( nome )
        `)
        .order('criado_em', { ascending: false })

      if (!error) setAnomalias(data)
      setCarregando(false)
    }
    carregar()
  }, [])

  if (carregando) return <p>A carregar...</p>

  return (
    <main style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>As minhas reclamações</h1>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {anomalias.map((a) => (
          <li key={a.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 14, marginTop: 10 }}>
            <strong>{a.categorias?.nome ? `${a.categorias.nome} — ${a.elementos?.nome}` : 'Por classificar'}</strong>
            <div>{a.descricao}</div>
            <span style={{ fontSize: 12, color: '#666' }}>{a.estados?.nome}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}