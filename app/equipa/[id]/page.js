'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'

export default function DetalheEquipa() {
  const { id } = useParams()
  const [anomalia, setAnomalia] = useState(null)
  const [eventos, setEventos] = useState([])
  const [estados, setEstados] = useState([])
  const [categorias, setCategorias] = useState([])
  const [elementos, setElementos] = useState([])
  const [tipos, setTipos] = useState([])
  const [visita, setVisita] = useState(null)
  const [garantia, setGarantia] = useState(null)
  const [texto, setTexto] = useState('')
  const [anexo, setAnexo] = useState(null)
  const [aEnviar, setAEnviar] = useState(false)
  const [dataVisita, setDataVisita] = useState('')
  const [tecnico, setTecnico] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [elementoId, setElementoId] = useState('')
  const [tipoId, setTipoId] = useState('')
  const [empresas, setEmpresas] = useState([])
  const [empresasDaAnomalia, setEmpresasDaAnomalia] = useState([])
  const [empresaParaAdicionar, setEmpresaParaAdicionar] = useState('')
  const [novaEmpresaNome, setNovaEmpresaNome] = useState('')
  const [aCriarEmpresa, setACriarEmpresa] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  async function carregar() {
    const { data: a } = await supabase
      .from('anomalias')
      .select(`
        id, descricao, urgencia, estado_id, categoria_id, elemento_id, tipo_anomalia_id, fracao_id,
        estados ( nome ),
        elementos ( nome ),
        categorias ( nome ),
        fracoes ( codigo_fracao )
      `)
      .eq('id', id)
      .single()
    setAnomalia(a)
    setCategoriaId(a?.categoria_id || '')
    setElementoId(a?.elemento_id || '')
    setTipoId(a?.tipo_anomalia_id || '')

    const { data: evs } = await supabase
      .from('timeline_eventos')
      .select('id, autor_tipo, autor_id, tipo_evento, texto, anexo_url, reconstruido, ocorrido_em')
      .eq('anomalia_id', id)
      .order('ocorrido_em', { ascending: true })

    const { data: membros } = await supabase.from('membros_equipa').select('email, auth_user_id')
    const nomesPorId = {}
    for (const m of membros || []) {
      if (m.auth_user_id) nomesPorId[m.auth_user_id] = m.email
    }
    const eventosComNome = (evs || []).map((ev) => ({
      ...ev,
      autor_nome: ev.autor_id ? (nomesPorId[ev.autor_id] || 'Equipa') : null,
    }))
    setEventos(eventosComNome)

    const { data: ests } = await supabase.from('estados').select('id, nome').order('ordem')
    setEstados(ests || [])

    const { data: cats } = await supabase.from('categorias').select('id, nome').order('nome')
    setCategorias(cats || [])

    const { data: elems } = await supabase.from('elementos').select('id, nome, categoria_id').order('nome')
    setElementos(elems || [])

    const { data: tps } = await supabase.from('tipos_anomalia').select('id, nome').order('ordem')
    setTipos(tps || [])

    const { data: todasEmpresas } = await supabase.from('empresas').select('id, nome').order('nome')
    setEmpresas(todasEmpresas || [])

    const { data: ligacoesEmpresa } = await supabase
      .from('anomalia_empresas')
      .select('empresa_id, empresas ( id, nome )')
      .eq('anomalia_id', id)
    setEmpresasDaAnomalia((ligacoesEmpresa || []).map((l) => l.empresas).filter(Boolean))

    const { data: v } = await supabase
      .from('visitas')
      .select('id, data_proposta, data_confirmada, tecnico, estado, proposta_por')
      .eq('anomalia_id', id)
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle()
    setVisita(v)

    const { data: g } = await supabase
      .from('v_garantia_restante')
      .select('dias_restantes, data_fim_garantia')
      .eq('anomalia_id', id)
      .maybeSingle()
    setGarantia(g)

    setCarregando(false)
  }

  useEffect(() => { carregar() }, [id])

  const elementosFiltrados = elementos.filter((e) => e.categoria_id === categoriaId)

  async function notificarProprietario(mensagemTexto) {
    try {
      if (!anomalia?.fracao_id) return

      const { data: ligacao } = await supabase
        .from('fracao_proprietarios')
        .select('proprietarios ( email )')
        .eq('fracao_id', anomalia.fracao_id)
        .limit(1)
        .maybeSingle()

      const emailProprietario = ligacao?.proprietarios?.email
      if (!emailProprietario) return

      await fetch('/api/notificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinatario: emailProprietario,
          assunto: 'Nova resposta na tua reclamação',
          mensagem: `A equipa respondeu à tua reclamação: "${mensagemTexto}". Consulta em https://portal-comprador.vercel.app/anomalias/${id}`,
        }),
      })
    } catch {
      // notificação é um extra -- uma falha aqui nunca deve travar o fluxo principal
    }
  }

  async function enviarMensagem(e) {
    e.preventDefault()
    setErro('')
    setAEnviar(true)

    const { data: { user } } = await supabase.auth.getUser()

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
      autor_tipo: 'equipa',
      autor_id: user?.id || null,
      tipo_evento: anexoUrl ? 'anexo' : 'mensagem',
      texto: textoFinal,
      anexo_url: anexoUrl,
      ocorrido_em: new Date().toISOString(),
    })
    if (error) { setErro(error.message); setAEnviar(false); return }

    await notificarProprietario(textoFinal)

    setTexto('')
    setAnexo(null)
    setAEnviar(false)
    carregar()
  }

  async function mudarEstado(novoEstadoId) {
    setErro('')
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('anomalias').update({ estado_id: novoEstadoId }).eq('id', id)
    if (error) { setErro(error.message); return }
    const novoEstadoNome = estados.find((e) => e.id === novoEstadoId)?.nome
    await supabase.from('timeline_eventos').insert({
      anomalia_id: id,
      autor_tipo: 'sistema',
      autor_id: user?.id || null,
      tipo_evento: 'mudanca_estado',
      texto: `Estado alterado para "${novoEstadoNome}"${user?.user_metadata?.full_name ? ` por ${user.user_metadata.full_name}` : ''}`,
      ocorrido_em: new Date().toISOString(),
    })
    carregar()
  }

  async function guardarClassificacao(e) {
    e.preventDefault()
    setErro('')
    setSucesso('')
    const { error } = await supabase
      .from('anomalias')
      .update({
        categoria_id: categoriaId || null,
        elemento_id: elementoId || null,
        tipo_anomalia_id: tipoId || null,
      })
      .eq('id', id)
    if (error) { setErro(error.message); return }
    setSucesso('Classificação guardada.')
    carregar()
  }

  async function adicionarEmpresa() {
    if (!empresaParaAdicionar) return
    setErro('')
    const { error } = await supabase
      .from('anomalia_empresas')
      .insert({ anomalia_id: id, empresa_id: empresaParaAdicionar })
    if (error) { setErro(error.message); return }
    setEmpresaParaAdicionar('')
    carregar()
  }

  async function criarEEmpresa() {
    if (!novaEmpresaNome.trim()) return
    setErro('')

    const { data: novaEmpresa, error } = await supabase
      .from('empresas')
      .insert({ nome: novaEmpresaNome.trim() })
      .select()
      .single()

    if (error) { setErro('Erro ao criar empresa: ' + error.message); return }

    const { error: erroLigacao } = await supabase
      .from('anomalia_empresas')
      .insert({ anomalia_id: id, empresa_id: novaEmpresa.id })

    if (erroLigacao) { setErro(erroLigacao.message); return }

    setNovaEmpresaNome('')
    setACriarEmpresa(false)
    carregar()
  }

  async function removerEmpresa(empresaId) {
    setErro('')
    const { error } = await supabase
      .from('anomalia_empresas')
      .delete()
      .eq('anomalia_id', id)
      .eq('empresa_id', empresaId)
    if (error) { setErro(error.message); return }
    carregar()
  }

  async function responderVisitaProprietario(novoEstado) {
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
        ? `Equipa aceitou a data proposta pelo proprietário: ${new Date(visita.data_proposta).toLocaleString('pt-PT')}`
        : `Equipa recusou a data proposta pelo proprietário`,
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
      texto: `Visita de ${new Date(visita.data_proposta).toLocaleString('pt-PT')} cancelada pela equipa`,
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
      proposta_por: 'equipa',
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
      <p>Fração: <strong>{anomalia.fracoes?.codigo_fracao}</strong></p>
      <p>{anomalia.descricao}</p>
      <p style={{ fontSize: 13, fontWeight: 'bold', color: corGarantia }}>
        {textoGarantia}
      </p>

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
        <h3 style={{ fontSize: 14, marginTop: 0 }}>Classificação</h3>
        <form onSubmit={guardarClassificacao}>
          <label style={{ fontSize: 12, display: 'block' }}>Categoria</label>
          <select
            value={categoriaId}
            onChange={(e) => { setCategoriaId(e.target.value); setElementoId('') }}
            style={{ padding: 6, marginBottom: 8, display: 'block', width: '100%' }}
          >
            <option value="">Por classificar</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>

          <label style={{ fontSize: 12, display: 'block' }}>Elemento</label>
          <select
            value={elementoId}
            onChange={(e) => setElementoId(e.target.value)}
            disabled={!categoriaId}
            style={{ padding: 6, marginBottom: 8, display: 'block', width: '100%' }}
          >
            <option value="">—</option>
            {elementosFiltrados.map((el) => <option key={el.id} value={el.id}>{el.nome}</option>)}
          </select>

          <label style={{ fontSize: 12, display: 'block' }}>Tipo de anomalia</label>
          <select
            value={tipoId}
            onChange={(e) => setTipoId(e.target.value)}
            style={{ padding: 6, marginBottom: 8, display: 'block', width: '100%' }}
          >
            <option value="">—</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>

          {sucesso && <p style={{ color: 'green', fontSize: 13 }}>{sucesso}</p>}
          <button type="submit" style={{ padding: '8px 16px' }}>Guardar classificação</button>
        </form>
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 14, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, marginTop: 0 }}>Empresa(s) responsável(eis)</h3>
        {empresasDaAnomalia.length === 0 && <p style={{ fontSize: 13, color: '#888' }}>Nenhuma empresa atribuída ainda.</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {empresasDaAnomalia.map((e) => (
            <span key={e.id} style={{ background: '#DCEAF0', color: '#2B5876', padding: '4px 10px', borderRadius: 20, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              {e.nome}
              <button
                type="button"
                onClick={() => removerEmpresa(e.id)}
                style={{ background: 'transparent', color: '#2B5876', padding: 0, fontSize: 13, lineHeight: 1 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        {!aCriarEmpresa ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={empresaParaAdicionar} onChange={(e) => setEmpresaParaAdicionar(e.target.value)} style={{ padding: 8, flex: 1 }}>
              <option value="">Escolhe uma empresa...</option>
              {empresas
                .filter((e) => !empresasDaAnomalia.some((ea) => ea.id === e.id))
                .map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            <button type="button" onClick={adicionarEmpresa} style={{ padding: '8px 16px' }}>Adicionar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Nome da nova empresa"
              value={novaEmpresaNome}
              onChange={(e) => setNovaEmpresaNome(e.target.value)}
              style={{ padding: 8, flex: 1 }}
            />
            <button type="button" onClick={criarEEmpresa} style={{ padding: '8px 16px' }}>Criar e adicionar</button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setACriarEmpresa((v) => !v)}
          style={{ background: 'transparent', color: '#2B5876', padding: 0, fontSize: 12, marginTop: 8 }}
        >
          {aCriarEmpresa ? '← Escolher de entre as existentes' : '+ Empresa não está na lista? Criar nova'}
        </button>
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 14, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, marginTop: 0 }}>Visita</h3>
        {visita ? (
          <>
            <p style={{ fontSize: 13 }}>
              {visita.estado === 'confirmada' ? 'Confirmada' : visita.estado === 'recusada' ? 'Recusada' : visita.estado === 'cancelada' ? 'Cancelada' : 'Proposta'} para{' '}
              <strong>{new Date(visita.data_proposta).toLocaleString('pt-PT')}</strong>
              {visita.tecnico ? ` com ${visita.tecnico}` : ''}
              {visita.proposta_por === 'proprietario' && visita.estado === 'proposta' ? ' (data proposta pelo proprietário)' : ''}
            </p>
            {visita.estado === 'proposta' && visita.proposta_por === 'proprietario' && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button type="button" onClick={() => responderVisitaProprietario('confirmada')}>Aceitar</button>
                <button type="button" onClick={() => responderVisitaProprietario('recusada')} style={{ background: '#B4462F' }}>Recusar</button>
              </div>
            )}
            {visita.estado === 'confirmada' && (
              <button type="button" onClick={cancelarVisita} style={{ background: 'transparent', color: '#B4462F', padding: 0, fontSize: 12, marginBottom: 10 }}>
                Cancelar visita
              </button>
            )}
          </>
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
                {ev.autor_tipo === 'proprietario' ? 'Proprietário' : (ev.autor_nome || 'Equipa')}
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
          placeholder="Responder como equipa..."
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