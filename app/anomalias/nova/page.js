'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { useRouter } from 'next/navigation'

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

function Planta({ url }) {
  if (url) {
    return <img src={url} alt="Planta da fração" style={{ width: '100%', display: 'block' }} />
  }
  return <PlantaSVG />
}

const cartao = {
  background: '#fff', border: '1px solid #E7E4DA', borderRadius: 14, padding: 22,
  boxShadow: '0 1px 3px rgba(20,41,58,0.05)',
}
const rotulo = { fontSize: 11, color: '#6B7178', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }
const campo = { padding: '10px 12px', border: '1px solid #E7E4DA', borderRadius: 9, fontSize: 14, width: '100%', marginBottom: 14, boxSizing: 'border-box' }

export default function NovaAnomalia() {
  const [categorias, setCategorias] = useState([])
  const [elementos, setElementos] = useState([])
  const [tipos, setTipos] = useState([])

  const [categoriaId, setCategoriaId] = useState('')
  const [elementoId, setElementoId] = useState('')
  const [tipoId, setTipoId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [urgencia, setUrgencia] = useState('Baixa')
  const [pin, setPin] = useState(null)
  const [fotos, setFotos] = useState([])
  const [fracoesDisponiveis, setFracoesDisponiveis] = useState([])
  const [fracaoEscolhida, setFracaoEscolhida] = useState('')
  const [plantaUrl, setPlantaUrl] = useState(null)
  const [aEnviar, setAEnviar] = useState(false)
  const [erro, setErro] = useState('')
  const router = useRouter()

  useEffect(() => {
    async function carregarListas() {
      const { data: cats } = await supabase.from('categorias').select('id, nome').order('nome')
      const { data: elems } = await supabase.from('elementos').select('id, nome, categoria_id').order('nome')
      const { data: tps } = await supabase.from('tipos_anomalia').select('id, nome').order('ordem')
      setCategorias(cats || [])
      setElementos(elems || [])
      setTipos(tps || [])

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: proprietario } = await supabase
          .from('proprietarios').select('id').eq('email', user.email).maybeSingle()
        if (proprietario) {
          const { data: ligacoes } = await supabase
            .from('fracao_proprietarios')
            .select('fracoes ( id, codigo_fracao )')
            .eq('proprietario_id', proprietario.id)
          const lista = (ligacoes || []).map((l) => l.fracoes).filter(Boolean)
          setFracoesDisponiveis(lista)
          if (lista.length === 1) {
            setFracaoEscolhida(lista[0].id)
            carregarPlanta(lista[0].id)
          }
        }
      }
    }
    carregarListas()
  }, [])

  async function carregarPlanta(fracaoId) {
    const { data } = await supabase
      .from('documentos')
      .select('ficheiro_url')
      .eq('fracao_id', fracaoId)
      .eq('tipo', 'planta')
      .order('carregado_em', { ascending: false })
      .limit(1)
      .maybeSingle()
    setPlantaUrl(data?.ficheiro_url || null)
  }

  const elementosFiltrados = elementos.filter((e) => e.categoria_id === categoriaId)

  function clicarPlanta(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPin({ x, y })
  }

  async function submeter(e) {
    e.preventDefault()
    setErro('')
    setAEnviar(true)

    let { data: fracao } = await supabase.from('fracoes').select('id').limit(1).single()

    if (!fracao) {
      const { data: empreendimento, error: erroEmp } = await supabase
        .from('empreendimentos').select('id').limit(1).single()
      if (erroEmp) { setErro('Erro ao ler empreendimentos: ' + erroEmp.message); setAEnviar(false); return }

      const { data: novaFracao, error: erroFracao } = await supabase
        .from('fracoes')
        .insert({ empreendimento_id: empreendimento.id, codigo_fracao: 'TESTE' })
        .select().single()
      if (erroFracao) { setErro('Erro ao criar fração: ' + erroFracao.message); setAEnviar(false); return }
      fracao = novaFracao
    }

    let fracaoIdFinal = fracao.id
    if (fracaoEscolhida) {
      fracaoIdFinal = fracaoEscolhida
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: proprietario } = await supabase
          .from('proprietarios').select('id').eq('email', user.email).single()
        if (proprietario) {
          const { data: ligacao } = await supabase
            .from('fracao_proprietarios').select('fracao_id')
            .eq('proprietario_id', proprietario.id).limit(1).single()
          if (ligacao) fracaoIdFinal = ligacao.fracao_id
        }
      }
    }

    const { data: estado, error: erroEstado } = await supabase
      .from('estados').select('id').eq('nome', 'Aberta').single()
    if (erroEstado) { setErro('Erro ao ler estados: ' + erroEstado.message); setAEnviar(false); return }

    const { data: novaAnomalia, error } = await supabase
      .from('anomalias')
      .insert({
        fracao_id: fracaoIdFinal,
        categoria_id: categoriaId || null,
        elemento_id: elementoId || null,
        tipo_anomalia_id: tipoId || null,
        descricao,
        urgencia,
        pin_x: pin?.x ?? null,
        pin_y: pin?.y ?? null,
        estado_id: estado.id,
        origem: 'novo',
      })
      .select()
      .single()

    if (error) { setErro('Erro ao criar anomalia: ' + error.message); setAEnviar(false); return }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        const nomeCategoria = categorias.find((c) => c.id === categoriaId)?.nome || 'Por classificar'
        const nomeElemento = elementos.find((e) => e.id === elementoId)?.nome || ''
        const nomeTipo = tipos.find((t) => t.id === tipoId)?.nome || ''

        fetch('/api/notificar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destinatario: user.email,
            assunto: 'Confirmação da tua reclamação',
            mensagem: `A tua reclamação foi registada com sucesso.\n\nCategoria: ${nomeCategoria}\nElemento: ${nomeElemento}\nTipo: ${nomeTipo}\nUrgência: ${urgencia}\nDescrição: ${descricao}\n\nGuarda este email como comprovativo. Podes acompanhar o estado em https://portal-comprador.vercel.app/anomalias/${novaAnomalia.id}`,
          }),
        })
      }
    } catch {
      // notificação é um extra -- nunca deve travar o fluxo principal
    }

    for (const foto of fotos) {
      const caminho = `${novaAnomalia.id}/${Date.now()}-${foto.name}`
      const { error: erroUpload } = await supabase.storage.from('anexos').upload(caminho, foto)

      if (!erroUpload) {
        const { data: urlPublico } = supabase.storage.from('anexos').getPublicUrl(caminho)
        await supabase.from('timeline_eventos').insert({
          anomalia_id: novaAnomalia.id,
          autor_tipo: 'proprietario',
          tipo_evento: 'anexo',
          texto: `Foto anexada: ${foto.name}`,
          anexo_url: urlPublico.publicUrl,
          ocorrido_em: new Date().toISOString(),
        })
      }
    }

    router.push('/anomalias')
  }

  return (
    <main style={{ maxWidth: 560, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Nova reclamação</h1>
      {erro && <p style={{ color: '#B4462F', fontSize: 13 }}>{erro}</p>}

      <div style={cartao}>
        <form onSubmit={submeter}>
          {fracoesDisponiveis.length > 1 && (
            <>
              <label style={rotulo}>Qual fração?</label>
              <select
                value={fracaoEscolhida}
                onChange={(e) => { setFracaoEscolhida(e.target.value); carregarPlanta(e.target.value) }}
                required
                style={campo}
              >
                <option value="">Escolhe a fração...</option>
                {fracoesDisponiveis.map((f) => (
                  <option key={f.id} value={f.id}>{f.codigo_fracao}</option>
                ))}
              </select>
            </>
          )}

          <label style={rotulo}>Categoria</label>
          <select
            value={categoriaId}
            onChange={(e) => { setCategoriaId(e.target.value); setElementoId('') }}
            required
            style={campo}
          >
            <option value="">Escolhe uma categoria...</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>

          <label style={rotulo}>Elemento</label>
          <select
            value={elementoId}
            onChange={(e) => setElementoId(e.target.value)}
            required
            disabled={!categoriaId}
            style={campo}
          >
            <option value="">Escolhe um elemento...</option>
            {elementosFiltrados.map((el) => (
              <option key={el.id} value={el.id}>{el.nome}</option>
            ))}
          </select>

          <label style={rotulo}>Tipo de anomalia</label>
          <select
            value={tipoId}
            onChange={(e) => setTipoId(e.target.value)}
            required
            style={campo}
          >
            <option value="">Escolhe o tipo...</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>

          <label style={rotulo}>Onde ocorreu — clica na planta</label>
          <div
            onClick={clicarPlanta}
            style={{ position: 'relative', border: '1px solid #E7E4DA', borderRadius: 10, cursor: 'crosshair', marginBottom: 6, overflow: 'hidden' }}
          >
            <Planta url={plantaUrl} />
            {pin && (
              <div
                style={{
                  position: 'absolute',
                  left: `${pin.x}%`,
                  top: `${pin.y}%`,
                  width: 16,
                  height: 16,
                  marginLeft: -8,
                  marginTop: -16,
                  background: '#C8862B',
                  borderRadius: '50% 50% 50% 0',
                  transform: 'rotate(45deg)',
                  border: '2px solid #fff',
                  boxShadow: '0 0 2px rgba(0,0,0,0.4)',
                }}
              />
            )}
          </div>
          <p style={{ fontSize: 11, color: '#6B7178', marginTop: 0, marginBottom: 16 }}>
            {pin ? 'Local selecionado — clica outra vez para ajustar.' : 'Ainda não selecionaste um local (opcional).'}
          </p>

          <label style={rotulo}>Descrição</label>
          <textarea
            placeholder="Descreva o problema..."
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            required
            style={{ ...campo, minHeight: 100 }}
          />

          <label style={rotulo}>Fotos (opcional, podes escolher várias)</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFotos(Array.from(e.target.files || []))}
            style={{ display: 'block', marginBottom: 6, fontSize: 13 }}
          />
          {fotos.length > 0 && (
            <ul style={{ fontSize: 12, color: '#6B7178', marginTop: 0, marginBottom: 14 }}>
              {fotos.map((f, i) => <li key={i}>{f.name}</li>)}
            </ul>
          )}

          <label style={rotulo}>Urgência</label>
          <select value={urgencia} onChange={(e) => setUrgencia(e.target.value)} style={campo}>
            <option>Baixa</option>
            <option>Média</option>
            <option>Alta</option>
            <option>Emergência</option>
          </select>

          <button type="submit" disabled={aEnviar} style={{ width: '100%', padding: 13, fontSize: 14, marginTop: 4 }}>
            {aEnviar ? 'A submeter...' : 'Submeter'}
          </button>
        </form>
      </div>
    </main>
  )
}