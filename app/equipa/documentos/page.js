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

const cartao = {
  background: '#fff', border: '1px solid #E7E4DA', borderRadius: 14, padding: 20, marginBottom: 20,
  boxShadow: '0 1px 3px rgba(20,41,58,0.05)',
}
const rotulo = { fontSize: 11, color: '#6B7178', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }
const campo = { padding: '9px 12px', border: '1px solid #E7E4DA', borderRadius: 8, fontSize: 14, width: '100%', marginBottom: 12 }

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
    <main style={{ maxWidth: 760, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Documentos</h1>

      <div style={cartao}>
        <h3 style={{ fontSize: 13, marginTop: 0, marginBottom: 14, color: '#6B7178', textTransform: 'uppercase', letterSpacing: 0.3 }}>Carregar novo documento</h3>
        <form onSubmit={enviar}>
          <label style={rotulo}>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={campo}>
            {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.nome}</option>)}
          </select>

          <label style={rotulo}>Nome (opcional — usa o nome do ficheiro se vazio)</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            style={campo}
          />

          <label style={rotulo}>Aplica-se a</label>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 13 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="radio" checked={ambito === 'fracao'} onChange={() => setAmbito('fracao')} /> Uma fração específica
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="radio" checked={ambito === 'empreendimento'} onChange={() => setAmbito('empreendimento')} /> Todo o empreendimento
            </label>
          </div>

          {ambito === 'fracao' && (
            <select value={fracaoId} onChange={(e) => setFracaoId(e.target.value)} style={campo}>
              <option value="">Escolhe a fração...</option>
              {fracoes.map((f) => <option key={f.id} value={f.id}>{f.codigo_fracao}</option>)}
            </select>
          )}

          <label style={rotulo}>Ficheiro</label>
          <input
            type="file"
            onChange={(e) => setFicheiro(e.target.files?.[0] || null)}
            style={{ marginBottom: 12, display: 'block', fontSize: 13 }}
          />

          {erro && <p style={{ color: '#B4462F', fontSize: 13 }}>{erro}</p>}
          {sucesso && <p style={{ color: '#4B7A51', fontSize: 13 }}>{sucesso}</p>}
          <button type="submit" disabled={aEnviar}>
            {aEnviar ? 'A carregar...' : 'Carregar documento'}
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Documentos existentes</h2>
        <input
          type="text"
          placeholder="Procurar por fração (ex: BA)"
          value={filtroFracaoBusca}
          onChange={(e) => setFiltroFracaoBusca(e.target.value)}
          style={{ ...campo, width: 200, marginBottom: 0 }}
        />
      </div>

      {carregando ? <p style={{ color: '#6B7178' }}>A carregar...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {documentosFiltrados.length === 0 && (
            <p style={{ color: '#6B7178', fontSize: 13 }}>Nenhum documento encontrado.</p>
          )}
          {documentosFiltrados.map((d) => (
            <div key={d.id} style={{
              background: '#fff', border: '1px solid #E7E4DA', borderRadius: 12, padding: '12px 16px',
              boxShadow: '0 1px 3px rgba(20,41,58,0.05)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <span style={{ fontSize: 11, background: '#F3F1EA', color: '#6B7178', padding: '3px 9px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {TIPOS.find((t) => t.valor === d.tipo)?.nome || d.tipo}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#16344A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nome}</div>
                  <div style={{ fontSize: 12, color: '#6B7178' }}>{d.fracoes?.codigo_fracao || 'Todo o empreendimento'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                <a href={d.ficheiro_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600 }}>Abrir</a>
                <button
                  type="button"
                  onClick={() => apagar(d)}
                  style={{ background: 'transparent', color: '#B4462F', padding: 0, fontSize: 13, boxShadow: 'none' }}
                >
                  Apagar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}