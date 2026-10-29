// Link curto (/d/<codigo>) — público, mas só com o código certo e dentro da validade.
// Quem mostra a página/prévia é o /api/d da Vercel (o Supabase não serve HTML); aqui sai só o PDF ou um JSON.
//   ?c=<codigo>          → o PDF
//   ?c=<codigo>&meta=1   → { titulo, descricao } para a prévia do link
import { createClient } from 'npm:@supabase/supabase-js@2'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const json = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const codigo = (url.searchParams.get('c') || '').replace(/[^A-Za-z0-9]/g, '')
  if (codigo.length < 6) return json({ erro: 'invalido' }, 404)
  const { data: link } = await admin.from('documentos_links').select('caminho,nome,expira_em,titulo,descricao').eq('codigo', codigo).maybeSingle()
  if (!link) return json({ erro: 'nao_encontrado' }, 404)
  if (new Date(link.expira_em) < new Date()) return json({ erro: 'expirado' }, 410)
  if (url.searchParams.get('meta')) return json({ titulo: link.titulo, descricao: link.descricao, nome: link.nome })
  const { data: arq, error } = await admin.storage.from('documentos').download(link.caminho)
  if (error || !arq) return json({ erro: 'indisponivel' }, 404)
  return new Response(arq, { headers: {
    'content-type': 'application/pdf',
    'content-disposition': `inline; filename="${link.nome.replace(/"/g, '')}"`,
    'cache-control': 'private, max-age=300',
  } })
})
