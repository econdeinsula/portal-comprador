import { BASES, fonteDeDados, notion } from '../../../lib/notion'

export const dynamic = 'force-dynamic'

// Teste de ligação: confirma que o portal chega às 6 bases e lista as propriedades de cada uma.
// Uso: /api/notion-teste?segredo=<NOTION_SYNC_SECRET>
export async function GET(req) {
  const segredo = new URL(req.url).searchParams.get('segredo')
  if (!process.env.NOTION_SYNC_SECRET || segredo !== process.env.NOTION_SYNC_SECRET) {
    return Response.json({ erro: 'Sem permissão' }, { status: 401 })
  }

  const resultado = {}
  for (const base of Object.keys(BASES)) {
    try {
      const fonte = await fonteDeDados(base)
      const ds = await notion(`/data_sources/${fonte}`)
      resultado[base] = {
        ok: true,
        nome: (ds.title || []).map((t) => t.plain_text).join(''),
        propriedades: Object.keys(ds.properties || {}).sort(),
      }
    } catch (e) {
      resultado[base] = { ok: false, erro: e.message }
    }
  }
  return Response.json(resultado)
}