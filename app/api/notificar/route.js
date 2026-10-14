function escapar(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function paraHtml(texto) {
  const seguro = escapar(texto)
  const comLinks = seguro.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1">$1</a>'
  )
  return comLinks.replace(/\n/g, '<br>')
}

export async function POST(req) {
  try {
    const { destinatario, assunto, mensagem } = await req.json()

    if (!destinatario || !assunto || !mensagem) {
      return Response.json({ erro: 'Faltam campos (destinatario, assunto, mensagem)' }, { status: 400 })
    }

    const chave = process.env.RESEND_API_KEY
    if (!chave) {
      return Response.json({ erro: 'Falta RESEND_API_KEY na Vercel' }, { status: 500 })
    }

    const from = process.env.EMAIL_FROM || 'Portal do Cliente <onboarding@resend.dev>'
    const replyTo = process.env.EMAIL_REPLY_TO || undefined

    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${chave}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [destinatario],
        subject: assunto,
        text: mensagem,
        html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#24292E;line-height:1.5">${paraHtml(mensagem)}</div>`,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    })

    const dados = await resposta.json().catch(() => ({}))

    if (!resposta.ok) {
      return Response.json(
        { erro: dados?.message || 'Erro ao enviar email' },
        { status: 500 }
      )
    }

    return Response.json({ sucesso: true, id: dados?.id })
  } catch (e) {
    return Response.json({ erro: 'Erro inesperado: ' + e.message }, { status: 500 })
  }
}