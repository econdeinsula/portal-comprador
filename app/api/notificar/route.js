export async function POST(req) {
  const { destinatario, assunto, mensagem } = await req.json()

  if (!destinatario || !assunto || !mensagem) {
    return Response.json({ erro: 'Faltam dados' }, { status: 400 })
  }

  try {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Portal do Comprador <onboarding@resend.dev>',
        to: destinatario,
        subject: assunto,
        text: mensagem,
      }),
    })

    if (!resposta.ok) {
      const erroTexto = await resposta.text()
      return Response.json({ erro: erroTexto }, { status: 500 })
    }

    return Response.json({ sucesso: true })
  } catch (e) {
    return Response.json({ erro: e.message }, { status: 500 })
  }
}