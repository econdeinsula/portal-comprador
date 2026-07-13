'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function ListaAnomalias() {
  const [anomalias, setAnomalias] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [debug, setDebug] = useState({})

  useEffect(() => {
    async function carregar() {
      const { data: { user }, error: erroUser } = await supabase.auth.getUser()
      setDebug((d) => ({ ...d, user: user?.email, erroUser: erroUser?.message }))

      if (!user) { setCarregando(false); return }

      const { data: proprietario, error: erroProp } = await supabase
        .from('proprietarios')
        .select('id')
        .eq('email', user.email)
        .single()
      setDebug((d) => ({ ...d, proprietario, erroProp: erroProp?.message }))

      if (!proprietario) { setCarregando(false); return }

      const { data: ligacoes, error: erroLig } = await supabase
        .from('fracao_proprietarios')
        .select('fracao_id')
        .eq('proprietario_id', proprietario.id)
      setDebug((d) => ({ ...d, ligacoes, erroLig: erroLig?.message }))

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
      setDebug((d) => ({ ...d, erroAnomalias: error?.message, numAnomalias: data?.length }))

      if (!error) setAnomalias(data)
      setCarregando(false)
    }
    carregar()
  }, [])

  if (carregando) return <p>A carregar...</p>

  return (
    <main style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>As minhas reclamações</h1>

      <pre style={{ background: '#f5f5f5', padding: 10, fontSize: 12, whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(debug, null, 2)}
      </pre>

      {anomalias.length === 0 && <p>Ainda não tens reclamações associadas à tua fração.</p>}
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