'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'

export default function DetalheAnomalia() {
  const { id } = useParams()
  const [anomalia, setAnomalia] = useState(null)
  const [eventos, setEventos] = useState([])
  const [garantia, setGarantia] = useState(null)
  const [visita, setVisita] = useState(null)
  const [texto, setTexto] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  async function carregar() {
    const { data: a } = await supabase
      .from('anomalias')
      .select(`
        id, descricao, urgencia, criado_em,
        estados ( nome ),
        elementos ( nome ),
        categorias ( nome )
      `)
      .eq('id', id)
      .single()
    setAnomalia(a)

    const { data: evs } = await supabase
      .from('timeline_eventos')
      .select('id, autor_tipo, tipo_evento, texto, reconstruido, ocorrido_em')
      .eq('anomalia_id', id)
      .order('ocorrido_em', { ascending: true })
    setEventos(evs || [])

    const { data: g } = await supabase
      .from('v_garantia_restante')
      .select('dias_restantes, data_fim_garantia')
      .eq('anomalia_id', id)
      .maybeSingle()
    setGarantia(g)

    const { data: v } = await supabase
      .from('visitas')
      .select('id, data_proposta, tecnico, estado')
      .eq('anomalia_id', id)
      .order('data_proposta', { ascending: false })
      .limit(1)
      .maybeSingle()
    setVisita(v)

    setCarregando(false)
  }

  useEffect(() => { carregar() }, [id])

  async function enviarMensagem(e) {
    e.preventDefault()
    setErro('')
    const { error } = await supabase.from('timeline_eventos').insert({
      anomalia_id: id,
      autor_tipo: 'proprietario',
      tipo_evento: 'mensagem',
      texto,
      ocorrido_em: new Date().toISOString(),
    })
    if (error) { setErro(error.message); return }
    setTexto('')
    carregar()
  }

  if (carregando) return <p>A carregar...</p>
  if (!anomalia) return <p>Reclamação não encontrada (ou sem acesso).</p>

  let textoGarantia = 'Garantia por calcular (falta classificar por elemento construtivo)'
  let corGarantia = '#888'
  if (garantia) {
    const meses = Math.round(garantia.dias_restantes / 30)
    if (garantia.dias_restantes < 0) {
      textoGarantia = 'Garantia expirada'
      corGarantia = '#B4462F'
    } else if (meses <= 6) {
      textoGarantia = `Faltam ${meses} meses de garantia`
      corGarantia = '#B4462F'
    } else if (meses <= 18) {
      textoGarantia = `Faltam ${meses} meses de garantia`
      corGarantia = '#C8862B'
    } else {
      textoGarantia = `Faltam ${meses} meses de garantia`
      corGarantia = '#4B7A51'
    }
  }

  return (
    <main style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>{anomalia.categorias?.nome ? `${anomalia.categorias.nome} — ${anomalia.elementos?.nome}` : 'Reclamação por classificar'}</h1>
      <p>{anomalia.descricao}</p>
      <p style={{ fontSize: 13, color: '#666' }}>
        Estado: <strong>{anomalia.estados?.nome}</strong> · Urgência: {anomalia.urgencia || 'não definida'}
      </p>
      <p style={{ fontSize: 13, fontWeight: 'bold', color: corGarantia }}>
        {textoGarantia}
      </p>
      {visita && (
        <p style={{ fontSize: 13, background: '#F5E6CC', padding: 8, borderRadius: 6, display: 'inline-block' }}>
          Visita {visita.estado === 'proposta' ? 'proposta' : 'confirmada'} para{' '}
          <strong>{new Date(visita.data_proposta).toLocaleString('pt-PT')}</strong>
          {visita.tecnico ? ` com ${visita.tecnico}` : ''}
        </p>
      )}

      <h2 style={{ fontSize: 16, marginTop: 30 }}>Histórico</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {eventos.length === 0 && <p>Sem eventos registados ainda.</p>}
        {eventos.map((ev) => (
          <div
            key={ev.id}
            style={{
              alignSelf: ev.autor_tipo === 'proprietario' ? 'flex-start' : ev.autor_tipo === 'equipa' ? 'flex-end' : 'center',
              background: ev.autor_tipo === 'proprietario' ? '#DCEAF0' : ev.autor_tipo === 'equipa' ? '#DCE9DD' : 'transparent',
              border: ev.autor_tipo === 'sistema' ? '1px dashed #ccc' : 'none',
              borderRadius: 10,
              padding: '8px 12px',
              maxWidth: '80%',
              fontSize: 13,
            }}
          >
            {ev.autor_tipo !== 'sistema' && (
              <div style={{ fontSize: 11, fontWeight: 'bold', opacity: 0.7 }}>
                {ev.autor_tipo === 'proprietario' ? 'Tu' : 'Equipa'}
              </div>
            )}
            <div>{ev.texto}</div>
            <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
              {new Date(ev.ocorrido_em).toLocaleString('pt-PT')}
              {ev.reconstruido ? ' · reconstruído do histórico' : ''}
            </div>
          </div>
        ))}
      </div>

      {erro && <p style={{ color: 'red' }}>{erro}</p>}
      <form onSubmit={enviarMensagem} style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <input
          type="text"
          placeholder="Escreve uma mensagem..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          required
          style={{ flex: 1, padding: 10 }}
        />
        <button type="submit" style={{ padding: '0 16px' }}>Enviar</button>
      </form>
    </main>
  )
}