'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function NovaAnomalia() {
  const [categorias, setCategorias] = useState([])
  const [elementos, setElementos] = useState([])
  const [tipos, setTipos] = useState([])

  const [categoriaId, setCategoriaId] = useState('')
  const [elementoId, setElementoId] = useState('')
  const [tipoId, setTipoId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [urgencia, setUrgencia] = useState('Baixa')
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

  async function submeter(e) {
    e.preventDefault()
    setErro('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setErro('Sessão não encontrada. Faz login outra vez.'); return }

    const { data: proprietario, error: erroProp } = await supabase
      .from('proprietarios')
      .select('id')
      .eq('email', user.email)
      .single()

    if (erroProp || !proprietario) { setErro('Não encontrei o teu registo de proprietário.'); return }

    const { data: ligacao, error: erroLig } = await supabase
      .from('fracao_proprietarios')
      .select('fracao_id')
      .eq('proprietario_id', proprietario.id)
      .limit(1)
      .single()

    if (erroLig || !ligacao) { setErro('Não encontrei nenhuma fração associada a ti.'); return }

    const { data: estado, error: erroEstado } = await supabase
      .from('estados').select('id').eq('nome', 'Aberta').single()
    if (erroEstado) { setErro('Erro ao ler estados: ' + erroEstado.message); return }

    const { error } = await supabase.from('anomalias').insert({
      fracao_id: ligacao.fracao_id,
      categoria_id: categoriaId || null,
      elemento_id: elementoId || null,
      tipo_anomalia_id: tipoId || null,
      descricao,
      urgencia,
      estado_id: estado.id,
      origem: 'novo',
    })

    if (error) { setErro('Erro ao criar anomalia: ' + error.message); return }
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

        <label style={{ fontSize: 13, fontWeight: 'bold' }}>Descrição</label>
        <textarea
          placeholder="Descreva o problema..."
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          required
          style={{ width: '100%', minHeight: 100, padding: 10, marginBottom: 10 }}
        />

        <label style={{ fontSize: 13, fontWeight: 'bold' }}>Urgência</label>
        <select value={urgencia} onChange={(e) => setUrgencia(e.target.value)} style={{ marginBottom: 10, display: 'block', padding: 10, width: '100%' }}>
          <option>Baixa</option>
          <option>Média</option>
          <option>Alta</option>
          <option>Emergência</option>
        </select>

        <button type="submit" style={{ padding: 10, width: '100%' }}>
          Submeter
        </button>
      </form>
    </main>
  )
}