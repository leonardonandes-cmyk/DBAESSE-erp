// Etiquetas de REPOSIÇÃO (reimprimir quando for preciso) — gera ZPL para a Zebra ZD230 (203 dpi = 8 pontos/mm).
// Padrão das duas etiquetas: 100×60 mm (800×480 pontos), o mesmo rolo para unitária e coletiva.
// A impressão vai para o ETIQUETAS-V2 rodando no PC da fábrica (o PC ligado na Zebra).
import { supabase } from './supabase.js'
import { desenhoDe, desenhoDoTipo } from './produtos.js'

export const ETQ = { largura: 800, altura: 480 }
const SERV_PADRAO = 'http://localhost:9192'

export function servidorEtiquetas() {
  try { return localStorage.getItem('etiquetas.servidor') || SERV_PADRAO } catch { return SERV_PADRAO }
}
export function salvarServidor(url) {
  try { localStorage.setItem('etiquetas.servidor', url.trim().replace(/\/+$/, '')) } catch { /* sem storage */ }
}

export async function listarTamanhos() {
  const { data, error } = await supabase.from('tamanhos').select('br,usa,eur').order('br')
  if (error) throw error
  return Object.fromEntries(data.map((t) => [t.br, t]))
}

// texto seguro para ^FD (ZPL usa ^ e ~ como comandos)
const t = (s) => String(s ?? '').replace(/[\^~]/g, ' ').trim()
const cima = (s) => t(s).toUpperCase()

// Code 128 com módulo 2 tem ~22 pontos por caractere + margens; centraliza na largura da etiqueta
function xCentroBarras(texto, modulo = 2) {
  const larg = (texto.length * 11 + 35) * modulo
  return Math.max(10, Math.round((ETQ.largura - larg) / 2))
}

// Desenho de linha do calçado → gráfico ZPL (^GFA, 1 bit). Converte no navegador; guarda em cache por URL.
const cacheGF = {}
export function desenhoParaZpl(url, maxW = 408, maxH = 190, girar = false) {
  if (!url) return Promise.resolve(null)
  const chave = `${url}|${maxW}|${maxH}|${girar}`
  if (cacheGF[chave]) return cacheGF[chave]
  cacheGF[chave] = new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // 1) corta a margem branca do desenho (para ele ocupar o quadro todo)
      const o = document.createElement('canvas'); o.width = img.width; o.height = img.height
      const og = o.getContext('2d'); og.fillStyle = '#fff'; og.fillRect(0, 0, o.width, o.height); og.drawImage(img, 0, 0)
      const od = og.getImageData(0, 0, o.width, o.height).data
      let x0 = o.width, y0 = o.height, x1 = -1, y1 = -1
      for (let y = 0; y < o.height; y++) for (let x = 0; x < o.width; x++) {
        const q = (y * o.width + x) * 4
        if ((od[q] * 299 + od[q + 1] * 587 + od[q + 2] * 114) / 1000 < 200) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
      }
      if (x1 < 0) { x0 = 0; y0 = 0; x1 = o.width - 1; y1 = o.height - 1 }
      const cw = x1 - x0 + 1, ch = y1 - y0 + 1
      // 2) encaixa no quadro o maior possível
      const k = Math.min(maxW / cw, maxH / ch)
      // deitada: a altura do desenho vira a largura na Zebra (múltiplo de 8)
      const dw = girar ? Math.max(1, Math.round(cw * k)) : Math.max(8, Math.floor((cw * k) / 8) * 8)
      const dh = girar ? Math.max(8, Math.floor((ch * k) / 8) * 8) : Math.max(1, Math.round(ch * k))
      const w = girar ? dh : dw
      const h = girar ? dw : dh
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h)
      if (girar) { g.translate(w, 0); g.rotate(Math.PI / 2) } // gira 90° no sentido do texto (R)
      g.drawImage(o, x0, y0, cw, ch, 0, 0, dw, dh)
      const px = g.getImageData(0, 0, w, h).data
      const bpr = w / 8
      let hex = ''
      for (let y = 0; y < h; y++) {
        for (let b = 0; b < bpr; b++) {
          let v = 0
          for (let bit = 0; bit < 8; bit++) {
            const o = (y * w + b * 8 + bit) * 4
            const lum = (px[o] * 299 + px[o + 1] * 587 + px[o + 2] * 114) / 1000
            if (px[o + 3] > 40 && lum < 150) v |= 0x80 >> bit
          }
          hex += v.toString(16).padStart(2, '0').toUpperCase()
        }
      }
      resolve({ w, h, lw: dw, lh: dh, gf: `^GFA,${bpr * h},${bpr * h},${bpr},${hex}` })
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
  return cacheGF[url]
}

// UNITÁRIA (caixa do par) — layout APROVADO e impresso no ETIQUETAS-V2, 100×60:
// esquerda: DESENHO em quadro largo · "REF 500" · linha · "COR: …" | direita: NÚMERO enorme · linha · USA | EUR · linha · TIPO
// rodapé: código de barras + "SKU: …" centralizados · "FAB. xxx" pequeno no canto (lote, quando houver)
export function zplUnitaria({ ref, tipo, cor, numero, sku, usa, eur, quantidade = 1, desenho, lote }) {
  const corTxt = cima(cor).replace(/\s*\/\s*/g, ' / ')
  return [
    '^XA', '^CI28', `^PW${ETQ.largura}`, `^LL${ETQ.altura}`, '^LH0,0',
    '^FO20,20^GB420,200,2^FS',
    desenho ? `^FO${20 + Math.round((420 - desenho.w) / 2)},${20 + Math.round((200 - desenho.h) / 2)}${desenho.gf}^FS` : '',
    `^FO22,234^A0N,58,56^FDREF ${t(ref)}^FS`,
    '^FO20,300^GB420,2,2^FS',
    `^FO22,314^FB420,2,4,L^A0N,${corTxt.length > 26 ? 28 : 32},${corTxt.length > 26 ? 26 : 30}^FDCOR: ${corTxt}^FS`,
    '^FO455,20^GB2,370,2^FS',
    `^FO460,36^FB340,1,0,C^A0N,180,150^FD${t(numero)}^FS`,
    '^FO480,236^GB300,2,2^FS',
    (usa || eur) ? `^FO460,252^FB340,1,0,C^A0N,30,28^FDUSA ${t(usa)}  |  EUR ${t(eur)}^FS` : '',
    '^FO480,296^GB300,2,2^FS',
    tipo ? `^FO460,312^FB340,1,0,C^A0N,26,24^FD${cima(tipo)}^FS` : '',
    `^FO${xCentroBarras(sku)},400^BY2,3^BCN,44,N,N,N^FD${t(sku)}^FS`,
    `^FO0,450^FB${ETQ.largura},1,0,C^A0N,22,22^FDSKU: ${t(sku)}^FS`,
    lote ? `^FO690,454^A0N,18,18^FDFAB. ${t(lote)}^FS` : '',
    `^PQ${Math.max(1, Number(quantidade) || 1)},0,1,Y`,
    '^XZ',
  ].filter(Boolean).join('\n')
}

// Monta as unitárias já com o desenho de cada tipo (mocassim, fisherman…). Sem desenho do tipo = sai sem quadro.
export async function zplUnitarias(linhas) {
  const out = []
  for (const l of linhas) {
    const desenho = await desenhoParaZpl(l.desenhoUrl !== undefined ? l.desenhoUrl : desenhoDoTipo(l.tipo)) // sem desenho = quadro em branco
    out.push(zplUnitaria({ ...l, desenho }))
  }
  return out.join('\n')
}

export function codigoCaixa(ref, sigla, total) {
  return `${t(ref)}-${t(sigla)}-C${total}` // ex.: 801-NUD-C12 (C = caixa com 12 pares)
}

// ROMANEIO — rolo 100×150 mm da Shopee, impresso na HORIZONTAL (lê-se deitado: 150 de largura × 100 de altura).
// Desenho em coordenadas "deitadas" (1200×800) e convertido para a Zebra (800×1200) com campos girados (R).
export const ETQ_ROMANEIO = { largura: 1200, altura: 800 }
const PW = 800
const cab = () => ['^XA', '^CI28', `^PW${PW}`, '^LL1200', '^LH0,0']
// texto: (x,y) canto de cima/esquerda na etiqueta deitada; h = altura da letra; bw = largura do bloco (centralizar/quebrar)
function T(x, y, h, w, texto, { bw, al = 'L', linhas = 1, esp = 0 } = {}) {
  const alt = linhas * h + (linhas - 1) * esp
  const fb = bw ? `^FB${bw},${linhas},${esp},${al}` : ''
  return `^FO${PW - y - alt},${x}${fb}^A0R,${h},${w}^FD${texto}^FS`
}
const B = (x, y, w, h, e = 3) => `^FO${PW - y - h},${x}^GB${h},${w},${e}^FS`
const BAR = (x, y, h, mod, texto) => `^FO${PW - y - h},${x}^BY${mod},3^BCR,${h},N,N,N^FD${texto}^FS`
const largBarras = (texto, mod) => (texto.length * 11 + 35) * mod

// COLETIVA (caixa master) — 100×60, MESMO tamanho e padrão da unitária:
// esquerda: DESENHO · "REF 801" · linha · "COR: …" | direita: TOTAL de pares · PARES · TIPO · código da caixa
// faixa de baixo: GRADE número × pares
export function zplColetiva({ ref, tipo, cor, grade, codigo, quantidade = 1, desenho }) {
  const nums = grade.filter((g) => g.pares > 0)
  const total = nums.reduce((s, g) => s + g.pares, 0)
  const corTxt = cima(cor).replace(/\s*\/\s*/g, ' / ')
  const cel = Math.floor(760 / Math.max(nums.length, 1))
  const fn = nums.length > 9 ? 32 : 40
  const celulas = nums.map((g, i) => {
    const x = 20 + i * cel
    return [
      `^FO${x},350^GB${cel},112,2^FS`,
      `^FO${x},362^FB${cel},1,0,C^A0N,${fn},${fn - 4}^FD${t(g.numero)}^FS`,
      `^FO${x},410^FB${cel},1,0,C^A0N,${fn},${fn - 4}^FD${g.pares}^FS`,
    ].join('\n')
  })
  const larg = (t(codigo).length * 11 + 35) * 2
  return [
    '^XA', '^CI28', `^PW${ETQ.largura}`, `^LL${ETQ.altura}`, '^LH0,0',
    '^FO20,20^GB420,170,2^FS',
    desenho ? `^FO${20 + Math.round((420 - desenho.w) / 2)},${20 + Math.round((170 - desenho.h) / 2)}${desenho.gf}^FS` : '',
    `^FO22,200^A0N,52,50^FDREF ${t(ref)}^FS`,
    '^FO20,258^GB420,2,2^FS',
    `^FO22,270^FB420,2,4,L^A0N,${corTxt.length > 26 ? 26 : 30},${corTxt.length > 26 ? 24 : 28}^FDCOR: ${corTxt}^FS`,
    '^FO455,20^GB2,316,2^FS',
    `^FO460,22^FB340,1,0,C^A0N,132,115^FD${total}^FS`,
    '^FO480,158^GB300,2,2^FS',
    `^FO460,168^FB340,1,0,C^A0N,28,28^FDPARES^FS`,
    '^FO480,204^GB300,2,2^FS',
    tipo ? `^FO460,214^FB340,1,0,C^A0N,24,22^FD${cima(tipo)}^FS` : '',
    `^FO${457 + Math.max(0, Math.round((343 - larg) / 2))},248^BY2,3^BCN,50,N,N,N^FD${t(codigo)}^FS`,
    `^FO460,306^FB340,1,0,C^A0N,22,22^FD${t(codigo)}^FS`,
    ...celulas,
    `^PQ${Math.max(1, Number(quantidade) || 1)},0,1,Y`,
    '^XZ',
  ].filter(Boolean).join('\n')
}

// Monta as coletivas já com o desenho do tipo
export async function zplColetivas(itens) {
  const out = []
  for (const i of itens) {
    const desenho = await desenhoParaZpl(i.desenhoUrl !== undefined ? i.desenhoUrl : desenhoDoTipo(i.tipo), 408, 160)
    out.push(zplColetiva({ ...i, desenho }))
  }
  return out.join('\n')
}

// ROMANEIO DE ENVIO (ao faturar, um por volume). FOCO: NOME DO CLIENTE → CIDADE - ESTADO, bem grandes.
// Rodapé: VOLUME i/N (um pouco maior) · pares (bem menor) · código de conferência.
export function zplVolume({ cliente, cidade, uf, pedido, pares, volume, volumes }) {
  const codigo = `${t(pedido)}-V${volume}`
  const nome = cima(cliente)
  const local = [cidade, uf].filter(Boolean).map(cima).join(' - ') || '—'
  const hN = nome.length > 30 ? 118 : nome.length > 18 ? 140 : 160
  const hL = local.length > 30 ? 64 : local.length > 24 ? 74 : local.length > 16 ? 90 : 110 // cidade - UF numa linha só
  return [
    ...cab(),
    T(40, 40, hN, hN - 10, nome, { bw: 1120, linhas: 2, esp: 14 }),
    T(40, 40 + hN * 2 + 14 + 40, hL, hL - 6, local, { bw: 1120 }),
    B(30, 640, 1140, 3, 3),
    T(40, 664, 72, 66, `VOL. ${volume}/${volumes}`),
    T(610, 690, 32, 30, `${pares} PARES`),
    BAR(830, 662, 80, 2, codigo),
    T(810, 748, 26, 26, codigo, { bw: 370, al: 'C' }),
    '^XZ',
  ].filter(Boolean).join('\n')
}

// Unitárias de um pedido: uma etiqueta por par, a partir dos itens (sku, número, quantidade)
export function zplDoPedido(linhas, tamanhos) {
  return zplUnitarias(linhas.filter((l) => l.quantidade > 0).map((l) => ({
    ref: l.produto?.ref, tipo: l.produto?.tipo, cor: l.cor?.nome, numero: l.numero, sku: l.sku, desenhoUrl: desenhoDe(l.produto),
    usa: tamanhos[l.numero]?.usa, eur: tamanhos[l.numero]?.eur, quantidade: l.quantidade,
  })))
}

// Manda o ZPL para o servidor do ETIQUETAS-V2 (PC da Zebra)
export async function enviarParaZebra(zpl) {
  const base = servidorEtiquetas()
  let r
  try {
    r = await fetch(`${base}/imprimir`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zpl }) })
  } catch {
    throw new Error(`Não achei o servidor de etiquetas em ${base}. Imprima pelo PC da fábrica (o da Zebra) com o ETIQUETAS-V2 aberto.`)
  }
  if (!r.ok) throw new Error(`O servidor de etiquetas respondeu ${r.status}. ${await r.text().catch(() => '')}`.trim())
}

export function baixarZpl(zpl, nome = 'etiquetas.zpl') {
  const url = URL.createObjectURL(new Blob([zpl], { type: 'text/plain' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: nome })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// REFs sem desenho (para o aviso antes de imprimir — elas saem com o quadro em branco)
export function refsSemDesenho(produtos) {
  return [...new Set(produtos.filter((p) => p && !desenhoDe(p)).map((p) => p.ref))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true }))
}
