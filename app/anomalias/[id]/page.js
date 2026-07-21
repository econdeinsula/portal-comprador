'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'

const PlantaSVG = () => (
  <svg viewBox="0 0 400 260" style={{ width: '100%', display: 'block', background: '#fff' }}>
    <rect x="4" y="4" width="392" height="252" fill="none" stroke="#2B5876" strokeWidth="1.5" />
    <line x1="180" y1="4" x2="180" y2="150" stroke="#2B5876" strokeWidth="1" />
    <line x1="180" y1="150" x2="396" y2="150" stroke="#2B5876" strokeWidth="1" />
    <line x1="260" y1="150" x2="260" y2="256" stroke="#2B5876" strokeWidth="1" />
    <line x1="60" y1="150" x2="60" y2="256" stroke="#2B5876" strokeWidth="1" />
    <text x="18" y="24" fontSize="10" fill="#6E6A5E">SALA</text>
    <text x="198" y="24" fontSize="10" fill="#6E6A5E">COZINHA</text>
    <text x="198" y="168" fontSize="10" fill="#6E6A5E">WC</text>
    <text x="76" y="168" fontSize="10" fill="#6E6A5E">QUARTO 1</text>
    <text x="278" y="168" fontSize="10" fill="#6E6A5E">QUARTO 2</text>
  </svg>
)

export default function DetalheAnomalia() {
  const { id } = useParams()
  const [anomalia, setAnomalia] = useState(null)
  const [eventos, setEventos] = useState([])
  const [visita, setVisita] = useState(null)
  const [aContrapropor, setAContrapropor] = useState(false)
  const [novaDataProposta, setNovaDataProposta] = useState('')
  const [empresasDaAnomalia, setEmpresasDaAnomalia] = useState([])
  const [texto, setTexto] = useState('')
  const [anexo, setAnexo] = useState(null)
  const [aEnviar, setAEnviar] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  async function carregar() {
    const { data: a } = await supabase
      .from('anomalias')
      .select(`
        id, descricao, urgencia, criado_em, pin_x, pin_y,
        estados ( nome ),
        elementos ( nome ),
        categorias ( nome )
      `)
      .eq('id', id)
      .single()
    setAnomalia(a)

    const { data: evs } = await supabase
      .from('timeline_eventos')
      .select('id, autor_tipo, tipo_evento, texto, anexo_url, reconstruido, ocorrido_em')
      .eq('anomalia_id', id)
      .order('ocorrido_em', { ascending: true })
    setEventos(evs || [])

    const { data: v } = await supabase
      .from('visitas')
      .select('id, data_proposta, tecnico, estado, proposta_por')
      .eq('anomalia_id', id)
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle()
    setVisita(v)

    const { data: ligacoesEmpresa } = await supabase
      .from('anomalia_empresas')
      .select('empresas ( nome )')
      .eq('anomalia_id', id)
    setEmpresasDaAnomalia((ligacoesEmpresa || []).map((l) => l.empresas?.nome).filter(Boolean))

    setCarregando(false)
  }

  useEffect(() => { carregar() }, [id])

  async function notificarEquipa(mensagemTexto) {
    try {
      const { data: membros } = await supabase.from('membros_equipa').select('email')
      for (const m of membros || []) {
        fetch('/api/notificar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destinatario: m.email,
            assunto: 'Nova mensagem de um proprietário',
            mensagem: `Um proprietário escreveu: "${mensagemTexto}". Consulta em https://portal-comprador.vercel.app/equipa/${id}`,
          }),
        })
      }
    } catch {
      // notificação é um extra -- uma falha aqui nunca deve travar o fluxo principal
    }
  }

  async function enviarMensagem(e) {
    e.preventDefault()
    setErro('')
    setAEnviar(true)

    let anexoUrl = null
    if (anexo) {
      const extensao = anexo.name.split('.').pop()
      const caminho = `${id}/${Date.now()}.${extensao}`
      const { error: erroUpload } = await supabase.storage.from('anexos').upload(caminho, anexo)
      if (erroUpload) { setErro('Erro ao enviar anexo: ' + erroUpload.message); setAEnviar(false); return }
      const { data: urlPublico } = supabase.storage.from('anexos').getPublicUrl(caminho)
      anexoUrl = urlPublico.publicUrl
    }

    const textoFinal = texto || (anexoUrl ? 'Anexo enviado' : '')

    const { error } = await supabase.from('timeline_eventos').insert({
      anomalia_id: id,
      autor_tipo: 'proprietario',
      tipo_evento: anexoUrl ? 'anexo' : 'mensagem',
      texto: textoFinal,
      anexo_url: anexoUrl,
      ocorrido_em: new Date().toISOString(),
    })
    if (error) { setErro(error.message); setAEnviar(false); return }

    await notificarEquipa(textoFinal)

    setTexto('')
    setAnexo(null)
    setAEnviar(false)
    carregar()
  }

  async function responderVisita(novoEstado) {
    setErro('')
    const { error } = await supabase
      .from('visitas')
      .update({ estado: novoEstado })
      .eq('id', visita.id)
    if (error) { setErro(error.message); return }

    await supabase.from('timeline_eventos').insert({
      anomalia_id: id,
      autor_tipo: 'sistema',
      tipo_evento: 'agendamento',
      texto: novoEstado === 'confirmada'
        ? `Visita de ${new Date(visita.data_proposta).toLocaleString('pt-PT')} aceite pelo proprietário`
        : `Visita de ${new Date(visita.data_proposta).toLocaleString('pt-PT')} recusada pelo proprietário`,
      ocorrido_em: new Date().toISOString(),
    })
    carregar()
  }

  async function cancelarVisita() {
    if (!confirm('Cancelar esta visita?')) return
    setErro('')
    const { error } = await supabase
      .from('visitas')
      .update({ estado: 'cancelada' })
      .eq('id', visita.id)
    if (error) { setErro(error.message); return }

    await supabase.from('timeline_eventos').insert({
      anomalia_id: id,
      autor_tipo: 'sistema',
      tipo_evento: 'agendamento',
      texto: `Visita de ${new Date(visita.data_proposta).toLocaleString('pt-PT')} cancelada pelo proprietário`,
      ocorrido_em: new Date().toISOString(),
    })
    carregar()
  }

  async function enviarContraproposta(e) {
    e.preventDefault()
    setErro('')
    const { error } = await supabase.from('visitas').insert({
      anomalia_id: id,
      data_proposta: novaDataProposta,
      tecnico: visita?.tecnico || null,
      estado: 'proposta',
      proposta_por: 'proprietario',
    })
    if (error) { setErro(error.message); return }

    await supabase.from('timeline_eventos').insert({
      anomalia_id: id,
      autor_tipo: 'sistema',
      tipo_evento: 'agendamento',
      texto: `Proprietário propôs nova data para a visita: ${new Date(novaDataProposta).toLocaleString('pt-PT')}`,
      ocorrido_em: new Date().toISOString(),
    })

    setNovaDataProposta('')
    setAContrapropor(false)
    carregar()
  }

  if (carregando) return <p>A carregar...</p>
  if (!anomalia) return <p>Reclamação não encontrada (ou sem acesso).</p>

  return (
    <main style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>{anomalia.categorias?.nome ? `${anomalia.categorias.nome} — ${anomalia.elementos?.nome}` : 'Reclamação por classificar'}</h1>
      <p>{anomalia.descricao}</p>
      <p style={{ fontSize: 13, color: '#666' }}>
        Estado: <strong>{anomalia.estados?.nome}</strong> · Urgência: {anomalia.urgencia || 'não definida'}
      </p>

      {visita && (
        <div style={{ fontSize: 13, background: '#F5E6CC', padding: 10, borderRadius: 6, marginBottom: 10 }}>
          {visita.estado === 'confirmada' && new Date(visita.data_proposta) >= new Date() && (
            <div>
              <p style={{ margin: '0 0 8px' }}>
                Visita marcada para <strong>{new Date(visita.data_proposta).toLocaleString('pt-PT')}</strong>
                {visita.tecnico ? ` com ${visita.tecnico}` : ''}
              </p>
              <button type="button" onClick={cancelarVisita} style={{ background: 'transparent', color: '#B4462F', padding: 0, fontSize: 12 }}>
                Cancelar visita
              </button>
            </div>
          )}

          {visita.estado === 'cancelada' && (
            <p style={{ margin: 0, color: '#B4462F' }}>Visita cancelada. A equipa vai propor uma nova data.</p>
          )}

          {visita.estado === 'proposta' && visita.proposta_por === 'equipa' && (
            <>
              <p style={{ margin: '0 0 8px' }}>
                Visita proposta para <strong>{new Date(visita.data_proposta).toLocaleString('pt-PT')}</strong>
                {visita.tecnico ? ` com ${visita.tecnico}` : ''}
              </p>
              {!aContrapropor ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => responderVisita('confirmada')}>Aceitar</button>
                  <button type="button" onClick={() => responderVisita('recusada')} style={{ background: '#B4462F' }}>Recusar</button>
                  <button type="button" onClick={() => setAContrapropor(true)} style={{ background: 'transparent', color: '#2B5876', padding: '8px 0' }}>
                    Propor outra data
                  </button>
                </div>
              ) : (
                <form onSubmit={enviarContraproposta} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="datetime-local"
                    value={novaDataProposta}
                    onChange={(e) => setNovaDataProposta(e.target.value)}
                    required
                    style={{ padding: 8 }}
                  />
                  <button type="submit">Enviar</button>
                  <button type="button" onClick={() => setAContrapropor(false)} style={{ background: 'transparent', color: '#2B5876' }}>
                    Cancelar
                  </button>
                </form>
              )}
            </>
          )}

          {visita.estado === 'proposta' && visita.proposta_por === 'proprietario' && (
            <p style={{ margin: 0 }}>
              Aguardas resposta da equipa à data que propuseste: <strong>{new Date(visita.data_proposta).toLocaleString('pt-PT')}</strong>
            </p>
          )}

          {visita.estado === 'recusada' && (
            <p style={{ margin: 0, color: '#B4462F' }}>Recusaste a última data proposta. A equipa vai propor outra.</p>
          )}
        </div>
      )}

      {empresasDaAnomalia.length > 0 && (
        <p style={{ fontSize: 13, color: '#666' }}>
          Empresa(s) responsável(eis): <strong>{empresasDaAnomalia.join(', ')}</strong>
        </p>
      )}

      {anomalia.pin_x != null && (
        <div style={{ position: 'relative', maxWidth: 300, border: '1px solid #ddd', borderRadius: 8, marginTop: 16 }}>
          <PlantaSVG />
          <div
            style={{
              position: 'absolute',
              left: `${anomalia.pin_x}%`,
              top: `${anomalia.pin_y}%`,
              width: 16,
              height: 16,
              marginLeft: -8,
              marginTop: -16,
              background: '#2B5876',
              borderRadius: '50% 50% 50% 0',
              transform: 'rotate(45deg)',
              border: '2px solid #fff',
            }}
          />
        </div>
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
            {ev.tipo_evento === 'anexo' && ev.anexo_url && (
              <img src={ev.anexo_url} alt="Anexo" style={{ maxWidth: 200, borderRadius: 6, marginTop: 6, display: 'block' }} />
            )}
            <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
              {new Date(ev.ocorrido_em).toLocaleString('pt-PT')}
              {ev.reconstruido ? ' · reconstruído do histórico' : ''}
            </div>
          </div>
        ))}
      </div>

      {erro && <p style={{ color: 'red' }}>{erro}</p>}
      {anexo && (
        <p style={{ fontSize: 12, color: '#666', marginTop: 12, marginBottom: 0 }}>
          📎 {anexo.name} <a href="#" onClick={(e) => { e.preventDefault(); setAnexo(null) }}>remover</a>
        </p>
      )}
      <form onSubmit={enviarMensagem} style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <label style={{ cursor: 'pointer', fontSize: 20, padding: '4px 8px' }}>
          📎
          <input
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            onChange={(e) => setAnexo(e.target.files?.[0] || null)}
            style={{ display: 'none' }}
          />
        </label>
        <input
          type="text"
          placeholder="Escreve uma mensagem..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          style={{ flex: 1, padding: 10 }}
        />
        <button type="submit" disabled={aEnviar || (!texto && !anexo)} style={{ padding: '0 16px' }}>
          {aEnviar ? 'A enviar...' : 'Enviar'}
        </button>
      </form>
    </main>
  )
}