'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Link from 'next/link'

export default function ListaAnomalias() {
  const [anomalias, setAnomalias] = useState([])
  const [carregando, setCarregando] = useState(true)

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
          categorias ( nome )
        `)
        .in('fracao_id', fracaoIds)
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
      {anomalias.length === 0 && <p>Ainda não tens reclamações associadas à tua fração.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {anomalias.map((a) => (
          <li key={a.id} style={{ marginTop: 10 }}>
            <Link href={`/anomalias/${a.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 14, cursor: 'pointer' }}>
                <strong>{a.categorias?.nome ? `${a.categorias.nome} — ${a.elementos?.nome}` : 'Por classificar'}</strong>
                <div>{a.descricao}</div>
                <span style={{ fontSize: 12, color: '#666' }}>{a.estados?.nome}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}