// Envio de emails (Resend) e textos dos avisos — partilhado pelo portal e pelas ações do Notion.
// Só para usar do lado do servidor.

export const SITE = process.env.SITE_URL || 'https://portal-comprador.vercel.app'

function escapar(texto) {
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function paraHtml(texto) {
  const seguro = escapar(texto).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
  return seguro.replace(/\n/g, '<br>')
}

export async function enviarEmails(destinatarios, assunto, mensagem) {
  const chave = process.env.RESEND_API_KEY
  if (!chave) throw new Error('Falta RESEND_API_KEY na Vercel')

  const unicos = [...new Set(destinatarios.map((e) => (e || '').trim().toLowerCase()).filter(Boolean))]
  if (unicos.length === 0) return 0

  const from = process.env.EMAIL_FROM || 'Portal do Cliente <onboarding@resend.dev>'
  const replyTo = process.env.EMAIL_REPLY_TO || undefined
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#24292E;line-height:1.5">${paraHtml(mensagem)}</div>`

  const corpo = unicos.map((para) => ({
    from,
    to: [para],
    subject: assunto,
    text: mensagem,
    html,
    ...(replyTo ? { reply_to: replyTo } : {}),
  }))

  const resposta = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  if (!resposta.ok) {
    const dados = await resposta.json().catch(() => ({}))
    throw new Error(dados?.message || 'Erro ao enviar email')
  }
  return unicos.length
}

export async function emailsDosDonos(admin, fracaoId) {
  const { data: ligacoes } = await admin
    .from('fracao_proprietarios')
    .select('proprietarios ( email )')
    .eq('fracao_id', fracaoId)
  return (ligacoes || []).map((l) => (l.proprietarios?.email || '').toLowerCase()).filter(Boolean)
}

// ─── Textos dos avisos ao proprietário ───
export function avisoMensagemEquipa(anomaliaId, texto) {
  return {
    assunto: 'Nova resposta à sua reclamação',
    mensagem: `A equipa respondeu à sua reclamação: "${texto}".\n\nConsulte em ${SITE}/anomalias/${anomaliaId}`,
  }
}

export function avisoResolvida(anomaliaId, descricao) {
  return {
    assunto: 'A sua reclamação foi resolvida',
    mensagem: `A sua reclamação "${descricao}" foi marcada como resolvida.\n\nGuarde este email como comprovativo. Consulte os detalhes em ${SITE}/anomalias/${anomaliaId}`,
  }
}