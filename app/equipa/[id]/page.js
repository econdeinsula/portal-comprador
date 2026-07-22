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

function EtiquetaEstado({ nome }) {
  const cores = {
    'Aberta': { bg: '#F6E4DF', cor: '#B4462F' },
    'Resolvida': { bg: '#E5EEE6', cor: '#4B7A51' },
    'Em análise': { bg: '#F7EBD6', cor: '#C8862B' },
    'Agendada': { bg: '#E4EEF3', cor: '#2B5876' },
  }
  const c = cores[nome] || { bg: '#F3F1EA', cor: '#6B7178' }
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap',
      background: c.bg, color: c.cor,
    }}>
      {nome}
    </span>
  )
}

const cartao = {
  background: '#fff', border: '1px solid #E7E4DA', borderRadius: 14, padding: 18, marginBottom: 18,
  boxShadow: '0 1px 3px rgba(20,41,58,0.05)',
}
const rotulo = { fontSize: 11, color: '#6B7178', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }
const campo = { padding: '8px 10px', border: '1px solid #E7E4DA', borderRadius: 8, fontSize: 13, width: '100%', marginBottom: 10 }

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
  const [plantaUrl, setPlantaUrl] = useState(null)
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
  const [descricaoEditavel, setDescricaoEditavel] = useState('')
  const [urgenciaEditavel, setUrgenciaEditavel] = useState('')
  const [sucessoDescricao, setSucessoDescricao] = useState('')

  async function carregar() {
    const { data: a } = await supabase
      .from('anomalias')
      .select(`
        id, descricao, urgencia, estado_id, categoria_id, elemento_id, tipo_anomalia_id, fracao_id, pin_x, pin_y,
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
    setDescricaoEditavel(a?.descricao || '')
    setUrgenciaEditavel(a?.urgencia || 'Baixa')

    if (a?.fracao_id) {
      const { data: docPlanta } = await supabase
        .from('documentos')
        .select('ficheiro_url')
        .eq('fracao_id', a.fracao_id)
        .eq('tipo', 'planta')
        .order('carregado_em', { ascending: false })
        .limit(1)
        .maybeSingle()
      setPlantaUrl(docPlanta?.ficheiro_url || null)
    }

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

  async function notificarConclusao() {
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
          assunto: 'A tua reclamação foi resolvida',
          mensagem: `A tua reclamação "${descricaoEditavel}" foi marcada como resolvida.\n\nGuarda este email como comprovativo. Consulta os detalhes em https://portal-comprador.vercel.app/anomalias/${id}`,
        }),
      })
    } catch {
      // notificação é um extra -- nunca deve travar o fluxo principal
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

    if (novoEstadoNome === 'Resolvida') {
      await notificarConclusao()
    }

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

  async function guardarDescricao(e) {
    e.preventDefault()
    setErro('')
    setSucessoDescricao('')
    const { error } = await supabase
      .from('anomalias')
      .update({
        descricao: descricaoEditavel,
        urgencia: urgenciaEditavel,
      })
      .eq('id', id)
    if (error) { setErro(error.message); return }
    setSucessoDescricao('Descrição e urgência atualizadas.')
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

  if (carregando) return <p style={{ padding: 40 }}>A carregar...</p>
  if (!anomalia) return <p style={{ padding: 40 }}>Reclamação não encontrada (ou sem acesso).</p>

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
    <main style={{ maxWidth: 720, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 2 }}>
        <h1 style={{ marginBottom: 2 }}>
          {anomalia.categorias?.nome ? `${anomalia.categorias.nome} — ${anomalia.elementos?.nome}` : 'Reclamação por classificar'}
        </h1>
        <span style={{ fontSize: 12, background: '#E4EEF3', color: '#2B5876', padding: '4px 10px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {anomalia.fracoes?.codigo_fracao}
        </span>
      </div>
      <p style={{ fontSize: 13, fontWeight: 700, color: corGarantia, marginTop: 0, marginBottom: 18 }}>
        {textoGarantia}
      </p>

      {anomalia.pin_x != null && (
        <div style={{ position: 'relative', maxWidth: 320, ...cartao, padding: 0, overflow: 'hidden' }}>
          {plantaUrl ? (
            <img src={plantaUrl} alt="Planta da fração" style={{ width: '100%', display: 'block' }} />
          ) : (
            <PlantaSVG />
          )}
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

      <div style={cartao}>
        <h3 style={{ fontSize: 13, marginTop: 0, marginBottom: 12, color: '#6B7178', textTransform: 'uppercase', letterSpacing: 0.3 }}>Descrição e urgência</h3>
        <form onSubmit={guardarDescricao}>
          <label style={rotulo}>Descrição</label>
          <textarea
            value={descricaoEditavel}
            onChange={(e) => setDescricaoEditavel(e.target.value)}
            style={{ ...campo, minHeight: 80 }}
          />
          <label style={rotulo}>Urgência</label>
          <select
            value={urgenciaEditavel}
            onChange={(e) => setUrgenciaEditavel(e.target.value)}
            style={{ ...campo, width: 'auto' }}
          >
            <option>Baixa</option>
            <option>Média</option>
            <option>Alta</option>
            <option>Emergência</option>
          </select>
          {sucessoDescricao && <p style={{ color: '#4B7A51', fontSize: 13 }}>{sucessoDescricao}</p>}
          <button type="submit">Guardar alterações</button>
        </form>
      </div>

      <div style={{ ...cartao, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={rotulo}>Estado</div>
          <EtiquetaEstado nome={estados.find((e) => e.id === anomalia.estado_id)?.nome} />
        </div>
        <select
          value={anomalia.estado_id}
          onChange={(e) => mudarEstado(e.target.value)}
          style={{ ...campo, width: 'auto', margin: 0 }}
        >
          {estados.map((e) => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>
      </div>

      <div style={cartao}>
        <h3 style={{ fontSize: 13, marginTop: 0, marginBottom: 12, color: '#6B7178', textTransform: 'uppercase', letterSpacing: 0.3 }}>Classificação</h3>
        <form onSubmit={guardarClassificacao}>
          <label style={rotulo}>Categoria</label>
          <select
            value={categoriaId}
            onChange={(e) => { setCategoriaId(e.target.value); setElementoId('') }}
            style={campo}
          >
            <option value="">Por classificar</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>

          <label style={rotulo}>Elemento</label>
          <select
            value={elementoId}
            onChange={(e) => setElementoId(e.target.value)}
            disabled={!categoriaId}
            style={campo}
          >
            <option value="">—</option>
            {elementosFiltrados.map((el) => <option key={el.id} value={el.id}>{el.nome}</option>)}
          </select>

          <label style={rotulo}>Tipo de anomalia</label>
          <select
            value={tipoId}
            onChange={(e) => setTipoId(e.target.value)}
            style={campo}
          >
            <option value="">—</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>

          {sucesso && <p style={{ color: '#4B7A51', fontSize: 13 }}>{sucesso}</p>}
          <button type="submit">Guardar classificação</button>
        </form>
      </div>

      <div style={cartao}>
        <h3 style={{ fontSize: 13, marginTop: 0, marginBottom: 12, color: '#6B7178', textTransform: 'uppercase', letterSpacing: 0.3 }}>Empresa(s) responsável(eis)</h3>
        {empresasDaAnomalia.length === 0 && <p style={{ fontSize: 13, color: '#6B7178' }}>Nenhuma empresa atribuída ainda.</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {empresasDaAnomalia.map((e) => (
            <span key={e.id} style={{ background: '#E4EEF3', color: '#2B5876', padding: '5px 12px', borderRadius: 20, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
              {e.nome}
              <button
                type="button"
                onClick={() => removerEmpresa(e.id)}
                style={{ background: 'transparent', color: '#2B5876', padding: 0, fontSize: 14, lineHeight: 1, boxShadow: 'none' }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        {!aCriarEmpresa ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={empresaParaAdicionar} onChange={(e) => setEmpresaParaAdicionar(e.target.value)} style={{ ...campo, marginBottom: 0, flex: 1 }}>
              <option value="">Escolhe uma empresa...</option>
              {empresas
                .filter((e) => !empresasDaAnomalia.some((ea) => ea.id === e.id))
                .map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            <button type="button" onClick={adicionarEmpresa}>Adicionar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Nome da nova empresa"
              value={novaEmpresaNome}
              onChange={(e) => setNovaEmpresaNome(e.target.value)}
              style={{ ...campo, marginBottom: 0, flex: 1 }}
            />
            <button type="button" onClick={criarEEmpresa}>Criar e adicionar</button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setACriarEmpresa((v) => !v)}
          style={{ background: 'transparent', color: '#2B5876', padding: 0, fontSize: 12, marginTop: 10, boxShadow: 'none' }}
        >
          {aCriarEmpresa ? '← Escolher de entre as existentes' : '+ Empresa não está na lista? Criar nova'}
        </button>
      </div>

      <div style={cartao}>
        <h3 style={{ fontSize: 13, marginTop: 0, marginBottom: 12, color: '#6B7178', textTransform: 'uppercase', letterSpacing: 0.3 }}>Visita</h3>
        {visita ? (
          <>
            <p style={{ fontSize: 13 }}>
              {visita.estado === 'confirmada' ? 'Confirmada' : visita.estado === 'recusada' ? 'Recusada' : visita.estado === 'cancelada' ? 'Cancelada' : 'Proposta'} para{' '}
              <strong>{new Date(visita.data_proposta).toLocaleString('pt-PT')}</strong>
              {visita.tecnico ? ` com ${visita.tecnico}` : ''}
              {visita.proposta_por === 'proprietario' && visita.estado === 'proposta' ? ' (data proposta pelo proprietário)' : ''}
            </p>
            {visita.estado === 'proposta' && visita.proposta_por === 'proprietario' && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button type="button" onClick={() => responderVisitaProprietario('confirmada')}>Aceitar</button>
                <button type="button" onClick={() => responderVisitaProprietario('recusada')} style={{ background: '#B4462F' }}>Recusar</button>
              </div>
            )}
            {visita.estado === 'confirmada' && (
              <button type="button" onClick={cancelarVisita} style={{ background: 'transparent', color: '#B4462F', padding: 0, fontSize: 12, marginBottom: 12, boxShadow: 'none' }}>
                Cancelar visita
              </button>
            )}
          </>
        ) : (
          <p style={{ fontSize: 13, color: '#6B7178' }}>Nenhuma visita agendada ainda.</p>
        )}
        <form onSubmit={agendarVisita} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="datetime-local"
            value={dataVisita}
            onChange={(e) => setDataVisita(e.target.value)}
            required
            style={{ ...campo, marginBottom: 0, width: 'auto' }}
          />
          <input
            type="text"
            placeholder="Técnico (opcional)"
            value={tecnico}
            onChange={(e) => setTecnico(e.target.value)}
            style={{ ...campo, marginBottom: 0, flex: 1, minWidth: 120 }}
          />
          <button type="submit">Propor visita</button>
        </form>
      </div>

      <h2 style={{ fontSize: 16 }}>Histórico</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
        {eventos.map((ev) => (
          <div
            key={ev.id}
            style={{
              alignSelf: ev.autor_tipo === 'proprietario' ? 'flex-start' : ev.autor_tipo === 'equipa' ? 'flex-end' : 'center',
              background: ev.autor_tipo === 'proprietario' ? '#E4EEF3' : ev.autor_tipo === 'equipa' ? '#E5EEE6' : 'transparent',
              border: ev.autor_tipo === 'sistema' ? '1px dashed #D8D5CB' : 'none',
              borderRadius: 12,
              padding: '10px 14px',
              maxWidth: '80%',
              fontSize: 13,
            }}
          >
            {ev.autor_tipo !== 'sistema' && (
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.65, marginBottom: 2 }}>
                {ev.autor_tipo === 'proprietario' ? 'Proprietário' : (ev.autor_nome || 'Equipa')}
              </div>
            )}
            <div>{ev.texto}</div>
            {ev.tipo_evento === 'anexo' && ev.anexo_url && (
              <img src={ev.anexo_url} alt="Anexo" style={{ maxWidth: 200, borderRadius: 8, marginTop: 6, display: 'block' }} />
            )}
            <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
              {new Date(ev.ocorrido_em).toLocaleString('pt-PT')}
              {ev.reconstruido ? ' · reconstruído do histórico' : ''}
            </div>
          </div>
        ))}
      </div>

      {erro && <p style={{ color: 'red', fontSize: 13 }}>{erro}</p>}
      {anexo && (
        <p style={{ fontSize: 12, color: '#6B7178', marginTop: 8, marginBottom: 0 }}>
          📎 {anexo.name} <a href="#" onClick={(e) => { e.preventDefault(); setAnexo(null) }}>remover</a>
        </p>
      )}
      <form onSubmit={enviarMensagem} style={{
        display: 'flex', gap: 8, marginTop: 8, alignItems: 'center',
        background: '#fff', border: '1px solid #E7E4DA', borderRadius: 12, padding: 8,
      }}>
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
          style={{ flex: 1, padding: 10, border: 'none' }}
        />
        <button type="submit" disabled={aEnviar || (!texto && !anexo)} style={{ padding: '8px 18px' }}>
          {aEnviar ? 'A enviar...' : 'Enviar'}
        </button>
      </form>
    </main>
  )
}