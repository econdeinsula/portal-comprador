import { supabase } from './supabaseClient'

export function extensaoSegura(nome) {
  const ext = (nome.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return ext && ext.length <= 8 ? ext : 'bin'
}

// Extensão de um caminho ou URL já guardado
export function extensaoDe(valor) {
  const limpo = (valor || '').split('?')[0]
  const i = limpo.lastIndexOf('.')
  return i >= 0 ? limpo.slice(i + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
}

const EXTENSOES_IMAGEM = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg']

export function eImagem(valor) {
  return EXTENSOES_IMAGEM.includes(extensaoDe(valor))
}

// Nome gerado: nenhum dado do utilizador entra no caminho
export function novoCaminho(pasta, nomeOriginal) {
  return `${pasta}/${crypto.randomUUID()}.${extensaoSegura(nomeOriginal)}`
}

// Aceita o caminho novo ou um URL público antigo
export function normalizarCaminho(bucket, valor) {
  if (!valor) return null
  if (!valor.startsWith('http')) return valor
  const marcador = `/${bucket}/`
  const i = valor.indexOf(marcador)
  return i >= 0 ? decodeURIComponent(valor.slice(i + marcador.length).split('?')[0]) : null
}

const cache = new Map()

export async function linkTemporario(bucket, valor, segundos = 3600) {
  const caminho = normalizarCaminho(bucket, valor)
  if (!caminho) return null

  const chave = `${bucket}:${caminho}`
  const guardado = cache.get(chave)
  if (guardado && guardado.expira > Date.now()) return guardado.url

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(caminho, segundos)
  if (error || !data?.signedUrl) return null

  cache.set(chave, { url: data.signedUrl, expira: Date.now() + (segundos - 60) * 1000 })
  return data.signedUrl
}