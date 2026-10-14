'use client'
import { useEffect, useState } from 'react'
import { linkTemporario } from '../lib/ficheirosPrivados'

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