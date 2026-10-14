'use client'
import { useEffect, useState } from 'react'
import { linkTemporario, eImagem, extensaoDe } from '../lib/ficheirosPrivados'

function useLinkPrivado(bucket, caminho) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let ativo = true
    linkTemporario(bucket, caminho).then((u) => { if (ativo) setUrl(u) })
    return () => { ativo = false }
  }, [bucket, caminho])
  return url
}

export function ImagemPrivada({ bucket, caminho, alt, style }) {
  const url = useLinkPrivado(bucket, caminho)
  if (!url) {
    return <div style={{ ...style, minHeight: style?.minHeight || 80, background: '#F3F1EA' }} />
  }
  return <img src={url} alt={alt} style={style} />
}

export function LinkPrivado({ bucket, caminho, children, style }) {
  const url = useLinkPrivado(bucket, caminho)
  if (!url) return <span style={{ ...style, opacity: 0.5 }}>{children}</span>
  return <a href={url} target="_blank" rel="noopener noreferrer" style={style}>{children}</a>
}

// Anexo do histórico: imagem aparece diretamente; os restantes ficheiros viram um botão
export function AnexoPrivado({ caminho }) {
  if (eImagem(caminho)) {
    return (
      <ImagemPrivada
        bucket="anexos"
        caminho={caminho}
        alt="Anexo"
        style={{ maxWidth: 200, borderRadius: 8, marginTop: 6, display: 'block' }}
      />
    )
  }
  const ext = extensaoDe(caminho).toUpperCase()
  return (
    <LinkPrivado
      bucket="anexos"
      caminho={caminho}
      style={{
        display: 'inline-block', marginTop: 6, padding: '6px 12px',
        background: '#fff', border: '1px solid #E7E4DA', borderRadius: 8,
        fontSize: 12, fontWeight: 600, color: '#2B5876', textDecoration: 'none',
      }}
    >
      📎 Abrir ficheiro{ext ? ` (${ext})` : ''}
    </LinkPrivado>
  )
}