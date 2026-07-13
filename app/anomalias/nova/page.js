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
  const [foto, setFoto] = useState(null)
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
    }
    carregarListas()
  }, [])

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

    const { data: { user } } = await supabase.auth.getUser()
    let fracaoIdFinal = fracao.id
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

    if (foto) {
      const extensao = foto.name.split('.').pop()
      const caminho = `${novaAnomalia.id}/${Date.now()}.${extensao}`
      const { error: erroUpload } = await supabase.storage.from('anexos').upload(caminho, foto)

      if (!erroUpload) {
        const { data: urlPublico } = supabase.storage.from('anexos').getPublicUrl(caminho)
        await supabase.from('timeline_eventos').insert({
          anomalia_id: novaAnomalia.id,
          autor_tipo: 'proprietario',
          tipo_evento: 'anexo',
          texto: 'Foto anexada',
          anexo_url: urlPublico.publicUrl,
          ocorrido_em: new Date().toISOString(),
        })
      }
    }

    router.push('/anomalias')
  }

  return (
    <main style={{ maxWidth: 500, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Nova reclamação</h1>
      {erro && <p style={{ color: 'red' }}>{erro}</p>}
      <form onSubmit={submeter}>
        <label style={{ fontSize: 13, fontWeight: 'bold' }}>Categoria</label>
        <select
          value={categoriaId}
          onChange={(e) => { setCategoriaId(e.target.value); setElementoId('') }}
          required
          style={{ width: '100%', padding: 10, marginBottom: 10, display: 'block' }}
        >
          <option value="">Escolhe uma categoria...</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>

        <label style={{ fontSize: 13, fontWeight: 'bold' }}>Elemento</label>
        <select
          value={elementoId}
          onChange={(e) => setElementoId(e.target.value)}
          required
          disabled={!categoriaId}
          style={{ width: '100%', padding: 10, marginBottom: 10, display: 'block' }}
        >
          <option value="">Escolhe um elemento...</option>
          {elementosFiltrados.map((el) => (
            <option key={el.id} value={el.id}>{el.nome}</option>
          ))}
        </select>

        <label style={{ fontSize: 13, fontWeight: 'bold' }}>Tipo de anomalia</label>
        <select
          value={tipoId}
          onChange={(e) => setTipoId(e.target.value)}
          required
          style={{ width: '100%', padding: 10, marginBottom: 10, display: 'block' }}
        >
          <option value="">Escolhe o tipo...</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>{t.nome}</option>
          ))}
        </select>

        <label style={{ fontSize: 13, fontWeight: 'bold' }}>Onde ocorreu — clica na planta</label>
        <div
          onClick={clicarPlanta}
          style={{ position: 'relative', border: '1px solid #ddd', borderRadius: 8, cursor: 'crosshair', marginBottom: 6 }}
        >
          <PlantaSVG />
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
        <p style={{ fontSize: 11, color: '#888', marginTop: 0, marginBottom: 14 }}>
          {pin ? 'Local selecionado — clica outra vez para ajustar.' : 'Ainda não selecionaste um local (opcional).'}
        </p>

        <label style={{ fontSize: 13, fontWeight: 'bold' }}>Descrição</label>
        <textarea
          placeholder="Descreva o problema..."
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          required
          style={{ width: '100%', minHeight: 100, padding: 10, marginBottom: 10 }}
        />

        <label style={{ fontSize: 13, fontWeight: 'bold' }}>Foto (opcional)</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFoto(e.target.files?.[0] || null)}
          style={{ display: 'block', marginBottom: 10 }}
        />

        <label style={{ fontSize: 13, fontWeight: 'bold' }}>Urgência</label>
        <select value={urgencia} onChange={(e) => setUrgencia(e.target.value)} style={{ marginBottom: 10, display: 'block', padding: 10, width: '100%' }}>
          <option>Baixa</option>
          <option>Média</option>
          <option>Alta</option>
          <option>Emergência</option>
        </select>

        <button type="submit" disabled={aEnviar} style={{ padding: 10, width: '100%' }}>
          {aEnviar ? 'A submeter...' : 'Submeter'}
        </button>
      </form>
    </main>
  )
}