// Entrega o PDF de um link curto (/d/<codigo>) — público, mas só com o código certo e dentro da validade.
import { createClient } from 'npm:@supabase/supabase-js@2'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const pagina = (titulo: string, texto: string, status: number) => new Response(
  `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DBAESSE</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#F4F4F2;font-family:system-ui,sans-serif;color:#151515">
<div style="text-align:center;padding:24px"><div style="letter-spacing:.4em;font-size:20px;margin-bottom:18px">D B A E S S E</div>
<h1 style="font-size:18px;font-weight:600;margin:0 0 8px">${titulo}</h1><p style="color:#6b6b66;margin:0">${texto}</p></div></body></html>`,
  { status, headers: { 'content-type': 'text/html; charset=utf-8' } })

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const codigo = (url.searchParams.get('c') || url.pathname.split('/').pop() || '').replace(/[^A-Za-z0-9]/g, '')
  if (codigo.length < 6) return pagina('Link inválido', 'Confira o link recebido.', 404)
  const { data: link } = await admin.from('documentos_links').select('caminho,nome,expira_em').eq('codigo', codigo).maybeSingle()
  if (!link) return pagina('Documento não encontrado', 'Confira o link recebido.', 404)
  if (new Date(link.expira_em) < new Date()) return pagina('Este link expirou', 'Peça um novo envio à DBAESSE.', 410)
  const { data: arq, error } = await admin.storage.from('documentos').download(link.caminho)
  if (error || !arq) return pagina('Documento indisponível', 'Peça um novo envio à DBAESSE.', 404)
  return new Response(arq, { headers: {
    'content-type': 'application/pdf',
    'content-disposition': `inline; filename="${link.nome.replace(/"/g, '')}"`,
    'cache-control': 'private, max-age=300',
  } })
})
