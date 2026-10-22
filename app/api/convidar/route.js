import { createClient } from '@supabase/supabase-js'
import { SITE, enviarEmails, emailsDosDonos, avisoMensagemEquipa, avisoResolvida } from '../../../lib/email'

const JANELA_MS = 5 * 60 * 1000

function clienteAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

async function utilizadorDoPedido(admin, req) {
  const cabecalho = req.headers.get('authorization') || ''
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : null
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user?.email) return null
  return data.user
}

// O texto da mensagem vem da base de dados (a mais recente do autor), nunca do pedido
async function mensagemRecente(admin, anomaliaId, autor) {
  const { data } = await admin
    .from('timeline_eventos')
    .select('texto, ocorrido_em')
    .eq('anomalia_id', anomaliaId)
    .eq('autor_tipo', autor)
    .order('ocorrido_em', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const idade = Date.now() - new Date(data.ocorrido_em).getTime()
  if (idade < -60000 || idade > JANELA_MS) return null
  return data.texto
}

export async function POST(req) {
  try {
    const admin = clienteAdmin()

    const utilizador = await utilizadorDoPedido(admin, req)
    if (!utilizador) return Response.json({ erro: 'Sem sessão válida' }, { status: 401 })
    const emailUtilizador = utilizador.email.toLowerCase()

    const { tipo, anomaliaId } = await req.json()
    const TIPOS = ['mensagem_proprietario', 'mensagem_equipa', 'resolvida', 'confirmacao']
    if (!anomaliaId || !TIPOS.includes(tipo)) {
      return Response.json({ erro: 'Pedido inválido' }, { status: 400 })
    }

    const { data: a } = await admin
      .from('anomalias')
      .select('id, descricao, fracao_id, criado_em, tipo_anomalia_id, estados ( nome ), categorias ( nome ), elementos ( nome ), fracoes ( codigo_fracao )')
      .eq('id', anomaliaId)
      .maybeSingle()
    if (!a) return Response.json({ erro: 'Reclamação não encontrada' }, { status: 404 })

    const { data: membros } = await admin.from('membros_equipa').select('email')
    const emailsEquipa = (membros || []).map((m) => (m.email || '').toLowerCase()).filter(Boolean)
    const eEquipa = emailsEquipa.includes(emailUtilizador)

    const emailsDonos = await emailsDosDonos(admin, a.fracao_id)
    const eDono = emailsDonos.includes(emailUtilizador)

    let destinatarios = []
    let assunto = ''
    let mensagem = ''

    if (tipo === 'mensagem_proprietario') {
      if (!eDono) return Response.json({ erro: 'Sem permissão' }, { status: 403 })
      const texto = await mensagemRecente(admin, a.id, 'proprietario')
      if (!texto) return Response.json({ ignorado: 'Sem mensagem recente' })
      destinatarios = emailsEquipa
      assunto = 'Nova mensagem de um proprietário'
      mensagem = `Fração ${a.fracoes?.codigo_fracao || ''}: um proprietário escreveu "${texto}".\n\nConsulta em ${SITE}/equipa/${a.id}`
    }

    if (tipo === 'mensagem_equipa') {
      if (!eEquipa) return Response.json({ erro: 'Sem permissão' }, { status: 403 })
      const texto = await mensagemRecente(admin, a.id, 'equipa')
      if (!texto) return Response.json({ ignorado: 'Sem mensagem recente' })
      destinatarios = emailsDonos
      ;({ assunto, mensagem } = avisoMensagemEquipa(a.id, texto))
    }

    if (tipo === 'resolvida') {
      if (!eEquipa) return Response.json({ erro: 'Sem permissão' }, { status: 403 })
      if (a.estados?.nome !== 'Resolvida') return Response.json({ ignorado: 'A reclamação não está resolvida' })
      destinatarios = emailsDonos
      ;({ assunto, mensagem } = avisoResolvida(a.id, a.descricao))
    }

    if (tipo === 'confirmacao') {
      if (!eDono) return Response.json({ erro: 'Sem permissão' }, { status: 403 })
      const idade = Date.now() - new Date(a.criado_em).getTime()
      if (idade < -60000 || idade > 15 * 60 * 1000) return Response.json({ ignorado: 'Reclamação antiga' })

      let nomeTipo = ''
      if (a.tipo_anomalia_id) {
        const { data: t } = await admin.from('tipos_anomalia').select('nome').eq('id', a.tipo_anomalia_id).maybeSingle()
        nomeTipo = t?.nome || ''
      }

      destinatarios = [emailUtilizador]
      assunto = 'Confirmação da tua reclamação'
      mensagem = `A tua reclamação foi registada com sucesso.\n\nCategoria: ${a.categorias?.nome || 'Por classificar'}\nElemento: ${a.elementos?.nome || ''}\nTipo: ${nomeTipo}\nDescrição: ${a.descricao}\n\nGuarda este email como comprovativo. Podes acompanhar o estado em ${SITE}/anomalias/${a.id}`
    }

    const enviados = await enviarEmails(destinatarios, assunto, mensagem)
    return Response.json({ sucesso: true, enviados })
  } catch (e) {
    return Response.json({ erro: e.message }, { status: 500 })
  }
}