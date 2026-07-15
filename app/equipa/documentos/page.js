'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

const TIPOS = [
  { valor: 'planta', nome: 'Planta' },
  { valor: 'certificado_energetico', nome: 'Certificado energético' },
  { valor: 'certificado_garantia', nome: 'Certificado de garantia' },
  { valor: 'licenca', nome: 'Licença' },
  { valor: 'outro', nome: 'Outro' },
]

export default function DocumentosEquipa() {
  const [documentos, setDocumentos] = useState([])
  const [fracoes, setFracoes] = useState([])
  const [tipo, setTipo] = useState('planta')
  const [nome, setNome] = useState('')
  const [ambito, setAmbito] = useState('fracao')
  const [fracaoId, setFracaoId] = useState('')
  const [ficheiro, setFicheiro] = useState(null)
  const [aEnviar, setAEnviar] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [filtroFracaoBusca, setFiltroFracaoBusca] = useState('')

  async function carregar() {
    const { data: docs, error } = await supabase
      .from('documentos')
      .select('id, tipo, nome, ficheiro_url, carregado_em, fracoes ( codigo_fracao )')
      .order('carregado_em', { ascending: false })

    if (error) { setErro(error.message); setCarregando(false); return }
    setDocumentos(docs || [])

    const { data: fr } = await supabase.from('fracoes').select('id, codigo_fracao').order('codigo_fracao')
    setFracoes(fr || [])

    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function enviar(e) {
    e.preventDefault()
    setErro('')
    setSucesso('')
    if (!ficheiro) { setErro('Escolhe um ficheiro.'); return }
    if (ambito === 'fracao' && !fracaoId) { setErro('Escolhe a fração.'); return }

    setAEnviar(true)
    const caminho = `${Date.now()}-${ficheiro.name}`
    const { error: erroUpload } = await supabase.storage.from('documentos').upload(caminho, ficheiro)
    if (erroUpload) { setErro('Erro ao enviar ficheiro: ' + erroUpload.message); setAEnviar(false); return }

    const { data: urlPublico } = supabase.storage.from('documentos').getPublicUrl(caminho)

    const { data: empreendimento } = await supabase.from('empreendimentos').select('id').limit(1).single()

    const { error } = await supabase.from('documentos').insert({
      tipo,
      nome: nome || ficheiro.name,
      ficheiro_url: urlPublico.publicUrl,
      fracao_id: ambito === 'fracao' ? fracaoId : null,
      empreendimento_id: ambito === 'empreendimento' ? empreendimento?.id : null,
    })

    setAEnviar(false)
    if (error) { setErro(error.message); return }
    setSucesso('Documento carregado.')
    setNome('')
    setFicheiro(null)
    carregar()
  }

  async function apagar(documento) {
    if (!confirm(`Apagar "${documento.nome}"? Esta ação não pode ser desfeita.`)) return

    // Extrai o caminho do ficheiro a partir do URL público, para o remover também do armazenamento
    const partes = documento.ficheiro_url.split('/documentos/')
    const caminho = partes[1]

    if (caminho) {
      await supabase.storage.from('documentos').remove([caminho])
    }

    const { error } = await supabase.from('documentos').delete().eq('id', documento.id)
    if (error) { setErro(error.message); return }
    carregar()
  }

  const documentosFiltrados = filtroFracaoBusca
    ? documentos.filter((d) =>
        d.fracoes?.codigo_fracao?.toLowerCase().includes(filtroFracaoBusca.trim().toLowerCase())
      )
    : documentos

  return (
    <main style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Documentos</h1>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <h3 style={{ marginTop: 0, fontSize: 14 }}>Carregar novo documento</h3>
        <form onSubmit={enviar}>
          <label style={{ fontSize: 12, fontWeight: 'bold', display: 'block' }}>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ padding: 8, marginBottom: 10, width: '100%' }}>
            {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.nome}</option>)}
          </select>

          <label style={{ fontSize: 12, fontWeight: 'bold', display: 'block' }}>Nome (opcional — usa o nome do ficheiro se vazio)</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            style={{ padding: 8, marginBottom: 10, width: '100%' }}
          />

          <label style={{ fontSize: 12, fontWeight: 'bold', display: 'block' }}>Aplica-se a</label>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 13 }}>
            <label>
              <input type="radio" checked={ambito === 'fracao'} onChange={() => setAmbito('fracao')} /> Uma fração específica
            </label>
            <label>
              <input type="radio" checked={ambito === 'empreendimento'} onChange={() => setAmbito('empreendimento')} /> Todo o empreendimento
            </label>
          </div>

          {ambito === 'fracao' && (
            <select value={fracaoId} onChange={(e) => setFracaoId(e.target.value)} style={{ padding: 8, marginBottom: 10, width: '100%' }}>
              <option value="">Escolhe a fração...</option>
              {fracoes.map((f) => <option key={f.id} value={f.id}>{f.codigo_fracao}</option>)}
            </select>
          )}

          <label style={{ fontSize: 12, fontWeight: 'bold', display: 'block' }}>Ficheiro</label>
          <input
            type="file"
            onChange={(e) => setFicheiro(e.target.files?.[0] || null)}
            style={{ marginBottom: 10, display: 'block' }}
          />

          {erro && <p style={{ color: 'red', fontSize: 13 }}>{erro}</p>}
          {sucesso && <p style={{ color: 'green', fontSize: 13 }}>{sucesso}</p>}
          <button type="submit" disabled={aEnviar} style={{ padding: '8px 16px' }}>
            {aEnviar ? 'A carregar...' : 'Carregar documento'}
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Documentos existentes</h2>
        <input
          type="text"
          placeholder="Procurar por fração (ex: BA)"
          value={filtroFracaoBusca}
          onChange={(e) => setFiltroFracaoBusca(e.target.value)}
          style={{ padding: 6, width: 200 }}
        />
      </div>
      {carregando ? <p>A carregar...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: 6 }}>Tipo</th>
              <th style={{ padding: 6 }}>Nome</th>
              <th style={{ padding: 6 }}>Âmbito</th>
              <th style={{ padding: 6 }}></th>
              <th style={{ padding: 6 }}></th>
            </tr>
          </thead>
          <tbody>
            {documentosFiltrados.map((d) => (
              <tr key={d.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 6 }}>{TIPOS.find((t) => t.valor === d.tipo)?.nome || d.tipo}</td>
                <td style={{ padding: 6 }}>{d.nome}</td>
                <td style={{ padding: 6 }}>{d.fracoes?.codigo_fracao || 'Todo o empreendimento'}</td>
                <td style={{ padding: 6 }}>
                  <a href={d.ficheiro_url} target="_blank" rel="noopener noreferrer">Abrir</a>
                </td>
                <td style={{ padding: 6 }}>
                  <button
                    type="button"
                    onClick={() => apagar(d)}
                    style={{ background: 'transparent', color: '#B4462F', padding: 0, fontSize: 13 }}
                  >
                    Apagar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}