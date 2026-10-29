// /d/<codigo> — link curto do PDF enviado ao cliente.
// Robô de prévia (WhatsApp, Instagram…) → página com título, descrição e a capa DBAESSE.
// Pessoa → o PDF, servido aqui mesmo (o endereço continua sendo o do sistema).
const FN = 'https://etjdygbelgjqeodefjuw.supabase.co/functions/v1/doc'
const ROBO = /WhatsApp|facebookexternalhit|Facebot|meta-externalagent|TelegramBot|Twitterbot|Slackbot|LinkedInBot|Discordbot|SkypeUriPreview|Applebot|Googlebot|bingbot|Pinterest/i
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const MSG = {
  invalido: ['Link inválido', 'Confira o link recebido.'],
  nao_encontrado: ['Documento não encontrado', 'Confira o link recebido.'],
  expirado: ['Este link expirou', 'Peça um novo envio à DBAESSE.'],
  indisponivel: ['Documento indisponível', 'Peça um novo envio à DBAESSE.'],
}
const pagina = (res, status, [titulo, texto]) => {
  res.status(status).setHeader('content-type', 'text/html; charset=utf-8')
  res.send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DBAESSE</title><meta name="robots" content="noindex"></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#F4F4F2;font-family:system-ui,-apple-system,sans-serif;color:#151515">
<div style="text-align:center;padding:24px"><div style="letter-spacing:.45em;font-size:22px;font-weight:300;margin-bottom:22px">DBAESSE</div>
<div style="width:48px;height:1px;background:#8A5A32;margin:0 auto 22px"></div>
<h1 style="font-size:17px;font-weight:600;margin:0 0 8px">${titulo}</h1><p style="color:#6b6b66;margin:0;font-size:14px">${texto}</p></div></body></html>`)
}

export default async function handler(req, res) {
  const codigo = String(req.query.c || '').replace(/[^A-Za-z0-9]/g, '')
  if (codigo.length < 6) return pagina(res, 404, MSG.invalido)
  try {
    if (ROBO.test(req.headers['user-agent'] || '')) {
      const r = await fetch(`${FN}?c=${codigo}&meta=1`)
      const m = await r.json().catch(() => ({}))
      if (!r.ok) return pagina(res, r.status, MSG[m.erro] || MSG.indisponivel)
      const host = `https://${req.headers['x-forwarded-host'] || req.headers.host}`
      const titulo = esc(m.titulo || 'DBAESSE · Documento')
      const desc = esc(m.descricao || 'Calçados femininos · Nova Serrana, MG')
      res.status(200).setHeader('content-type', 'text/html; charset=utf-8')
      return res.send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title>
<meta property="og:site_name" content="DBAESSE"><meta property="og:type" content="website"><meta property="og:url" content="${host}/d/${codigo}">
<meta property="og:title" content="${titulo}"><meta property="og:description" content="${desc}">
<meta property="og:image" content="${host}/capa-pedido.jpg?v=1"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="robots" content="noindex"></head><body>${titulo}</body></html>`)
    }
    const r = await fetch(`${FN}?c=${codigo}`)
    if (!r.ok) { const m = await r.json().catch(() => ({})); return pagina(res, r.status, MSG[m.erro] || MSG.indisponivel) }
    const pdf = Buffer.from(await r.arrayBuffer())
    // a Vercel não devolve resposta maior que ~4,5 MB: PDF grande vai direto do arquivo
    if (pdf.length > 4 * 1024 * 1024) { res.setHeader('location', `${FN}?c=${codigo}`); return res.status(302).end() }
    res.status(200)
    res.setHeader('content-type', 'application/pdf')
    res.setHeader('content-disposition', r.headers.get('content-disposition') || 'inline')
    res.setHeader('cache-control', 'private, max-age=300')
    res.setHeader('x-robots-tag', 'noindex')
    return res.send(pdf)
  } catch {
    return pagina(res, 502, MSG.indisponivel)
  }
}
