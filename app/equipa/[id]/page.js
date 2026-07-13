'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'

export default function DetalheEquipa() {
  const { id } = useParams()
  const [anomalia, setAnomalia] = useState(null)
  const [eventos, setEventos] = useState([])
  const [estados, setEstados] = useState([])
  const [visita, setVisita] = useState(null)
  const [texto, setTexto] = useState('')
  const [dataVisita, setDataVisita] = useState('')
  const [tecnico, setTecnico] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  async function carregar() {
    const { data: a } = await supabase
      .from('anomalias')
      .select(`
        id, descricao, urgencia, estado_id,
        estados ( nome ),
        elementos ( nome ),
        categorias ( nome ),
        fracoes ( codigo_fracao )
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

    const { data: ests } = await supabase.from('estados').select('id, nome').order('ordem')
    setEstados(ests || [])

    const { data: v } = await supabase
      .from('visitas')
      .select('id, data_proposta, data_confirmada, tecnico, estado')
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
      autor_tipo: 'equipa',
      tipo_evento: 'mensagem',
      texto,
      ocorrido_em: new Date().toISOString(),
    })
    if (error) { setErro(error.message); return }
    setTexto('')
    carregar()
  }

  async function mudarEstado(novoEstadoId) {
    setErro('')
    const { error } = await supabase.from('anomalias').update({ estado_id: novoEstadoId }).eq('id', id)
    if (error) { setErro(error.message); return }
    const novoEstadoNome = estados.find((e) => e.id === novoEstadoId)?.nome
    await supabase.from('timeline_eventos').insert({
      anomalia_id: id,
      autor_tipo: 'sistema',
      tipo_evento: 'mudanca_estado',
      texto: `Estado alterado para "${novoEstadoNome}"`,
      ocorrido_em: new Date().toISOString(),
    })
    carregar()
  }

  async function agendarVisita(e) {
    e.preventDefault()
    setErro('')
    const { error } = await supabase.from('visitas').insert({
      anomalia_id: id,
      data_proposta: dataVisita,
      tecnico,
      estado: 'proposta',
    })
    if (error) { setErro(error.message); return }

    await supabase.from('timeline_eventos').insert({
      anomalia_id: id,
      autor_tipo: 'sistema',
      tipo_evento: 'agendamento',
      texto: `Visita proposta para ${new Date(dataVisita).toLocaleString('pt-PT')}${tecnico ? ` com ${tecnico}` : ''}`,
      ocorrido_em: new Date().toISOString(),
    })
    setDataVisita('')
    setTecnico('')
    carregar()
  }

  if (carregando) return <p>A carregar...</p>
  if (!anomalia) return <p>Reclamação não encontrada (ou sem acesso).</p>

  return (
    <main style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>{anomalia.categorias?.nome ? `${anomalia.categorias.nome} — ${anomalia.elementos?.nome}` : 'Reclamação por classificar'}</h1>
      <p>Fração: <strong>{anomalia.fracoes?.codigo_fracao}</strong></p>
      <p>{anomalia.descricao}</p>

      <label style={{ fontSize: 13, fontWeight: 'bold' }}>Estado</label>
      <select
        value={anomalia.estado_id}
        onChange={(e) => mudarEstado(e.target.value)}
        style={{ display: 'block', padding: 8, marginBottom: 20 }}
      >
        {estados.map((e) => (
          <option key={e.id} value={e.id}>{e.nome}</option>
        ))}
      </select>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 14, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, marginTop: 0 }}>Visita</h3>
        {visita ? (
          <p style={{ fontSize: 13 }}>
            {visita.estado === 'proposta' ? 'Proposta' : 'Confirmada'} para{' '}
            <strong>{new Date(visita.data_proposta).toLocaleString('pt-PT')}</strong>
            {visita.tecnico ? ` com ${visita.tecnico}` : ''}
          </p>
        ) : (
          <p style={{ fontSize: 13, color: '#888' }}>Nenhuma visita agendada ainda.</p>
        )}
        <form onSubmit={agendarVisita} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <input
            type="datetime-local"
            value={dataVisita}
            onChange={(e) => setDataVisita(e.target.value)}
            required
            style={{ padding: 8 }}
          />
          <input
            type="text"
            placeholder="Técnico (opcional)"
            value={tecnico}
            onChange={(e) => setTecnico(e.target.value)}
            style={{ padding: 8, flex: 1, minWidth: 120 }}
          />
          <button type="submit" style={{ padding: '8px 16px' }}>Propor visita</button>
        </form>
      </div>

      <h2 style={{ fontSize: 16 }}>Histórico</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                {ev.autor_tipo === 'proprietario' ? 'Proprietário' : 'Equipa'}
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
          placeholder="Responder como equipa..."
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