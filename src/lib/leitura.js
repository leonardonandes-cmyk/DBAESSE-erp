// Leitura de código de barras → SKU do sistema.
// Aceita: SKU do sistema (801-NUD-34), código antigo da etiqueta com prefixo da produção
// (SP8801-NUD-34 → 801-NUD-34) e EAN (quando a GS1 sair).

export const normalizarCodigo = (c) => String(c || '').trim().toUpperCase().replace(/\s+/g, '')

// produtos: [{ ..., skus:[{id,sku,numero,cor_id,ean}] }], cores: [{id,...}]
export function criarIndice(produtos, cores) {
  const corPorId = Object.fromEntries(cores.map((c) => [c.id, c]))
  const porSku = new Map()
  const porEan = new Map()
  produtos.forEach((p) => p.skus.forEach((s) => {
    const item = { ...s, produto: p, cor: corPorId[s.cor_id] }
    porSku.set(s.sku.toUpperCase(), item)
    if (s.ean) porEan.set(String(s.ean), item)
  }))
  return { porSku, porEan, lista: [...porSku.entries()] }
}

export function acharSku(indice, bruto) {
  const c = normalizarCodigo(bruto)
  if (!c) return null
  if (indice.porSku.has(c)) return indice.porSku.get(c)
  if (/^\d{8,14}$/.test(c) && indice.porEan.has(c)) return indice.porEan.get(c)
  // código antigo: termina com o SKU do sistema (SP8801-NUD-34 termina com 801-NUD-34). Fica o mais longo.
  let melhor = null
  for (const [sku, item] of indice.lista) {
    if (sku.length >= 6 && c.endsWith(sku) && (!melhor || sku.length > melhor.sku.length)) melhor = item
  }
  return melhor
}

// Bip curto (ok) ou duplo grave (erro) + vibração
let ctx
export function avisar(ok) {
  try {
    navigator.vibrate?.(ok ? 40 : [80, 60, 80])
    ctx ||= new (window.AudioContext || window.webkitAudioContext)()
    const tocar = (freq, ini, dur) => {
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.frequency.value = freq; o.type = 'sine'
      g.gain.setValueAtTime(0.18, ctx.currentTime + ini)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ini + dur)
      o.connect(g); g.connect(ctx.destination)
      o.start(ctx.currentTime + ini); o.stop(ctx.currentTime + ini + dur)
    }
    if (ok) tocar(1320, 0, 0.09)
    else { tocar(220, 0, 0.14); tocar(220, 0.2, 0.14) }
  } catch { /* sem som: segue */ }
}
