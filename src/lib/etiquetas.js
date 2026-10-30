// Etiquetas de REPOSIÇÃO (reimprimir quando for preciso) — gera ZPL para a Zebra ZD230 (203 dpi = 8 pontos/mm).
// Padrão das duas etiquetas: 100×60 mm (800×480 pontos), o mesmo rolo para unitária e coletiva.
// A impressão vai para o ETIQUETAS-V2 rodando no PC da fábrica (o PC ligado na Zebra).
import { supabase } from './supabase.js'

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

// UNITÁRIA (caixa do par): REF grande, tipo, cor | número enorme + USA/EUR | código de barras do SKU
export function zplUnitaria({ ref, tipo, cor, numero, sku, usa, eur, quantidade = 1 }) {
  return [
    '^XA', '^CI28', `^PW${ETQ.largura}`, `^LL${ETQ.altura}`, '^LH0,0',
    `^FO30,28^A0N,96,96^FD${t(ref)}^FS`,
    tipo ? `^FO32,132^A0N,30,30^FD${cima(tipo)}^FS` : '',
    `^FO30,178^FB470,2,4,L^A0N,42,40^FD${cima(cor)}^FS`,
    '^FO515,20^GB3,295,3^FS',
    `^FO520,24^FB270,1,0,C^A0N,205,175^FD${t(numero)}^FS`,
    (usa || eur) ? `^FO520,250^FB270,1,0,C^A0N,32,30^FDUSA ${t(usa)} | EUR ${t(eur)}^FS` : '',
    '^FO20,328^GB760,3,3^FS',
    `^FO${xCentroBarras(sku)},346^BY2,3^BCN,78,N,N,N^FD${t(sku)}^FS`,
    `^FO0,436^FB${ETQ.largura},1,0,C^A0N,28,28^FDSKU: ${t(sku)}^FS`,
    `^PQ${Math.max(1, Number(quantidade) || 1)},0,1,Y`,
    '^XZ',
  ].filter(Boolean).join('\n')
}

export function codigoCaixa(ref, sigla, total) {
  return `CX-${t(ref)}-${t(sigla)}-${total}`
}

// COLETIVA — rolo 100×150 mm da Shopee, impressa na HORIZONTAL (lê-se deitada: 150 de largura × 100 de altura).
// Desenho em coordenadas "deitadas" (1200×800) e convertido para a Zebra (800×1200) com campos girados (R).
export const ETQ_COLETIVA = { largura: 1200, altura: 800 }
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

// Caixa master (reposição): REF, tipo, cor | CAIXA total PARES | grade número × pares | código da caixa
export function zplColetiva({ ref, tipo, cor, grade, codigo, quantidade = 1 }) {
  const nums = grade.filter((g) => g.pares > 0)
  const total = nums.reduce((s, g) => s + g.pares, 0)
  const cel = Math.floor(1120 / Math.max(nums.length, 1))
  const fn = nums.length > 8 ? 46 : 58
  const celulas = nums.flatMap((g, i) => {
    const x = 40 + i * cel
    return [B(x, 420, cel, 170, 3), T(x, 438, fn, fn - 4, t(g.numero), { bw: cel, al: 'C' }), T(x, 515, fn, fn - 4, String(g.pares), { bw: cel, al: 'C' })]
  })
  return [
    ...cab(),
    T(40, 30, 150, 150, t(ref)),
    tipo ? T(44, 190, 44, 44, cima(tipo)) : '',
    T(40, 248, 58, 54, cima(cor), { bw: 700, linhas: 2, esp: 6 }),
    B(770, 30, 3, 360, 3),
    T(790, 50, 44, 44, 'CAIXA', { bw: 380, al: 'C' }),
    T(790, 110, 200, 180, String(total), { bw: 380, al: 'C' }),
    T(790, 320, 44, 44, 'PARES', { bw: 380, al: 'C' }),
    B(30, 400, 1140, 3, 3),
    ...celulas,
    BAR(Math.max(40, Math.round((1200 - largBarras(codigo, 3)) / 2)), 615, 120, 3, t(codigo)),
    T(0, 748, 36, 36, t(codigo), { bw: 1200, al: 'C' }),
    `^PQ${Math.max(1, Number(quantidade) || 1)},0,1,Y`,
    '^XZ',
  ].filter(Boolean).join('\n')
}

// VOLUME do faturamento (dados do cliente), de cima para baixo:
// NOME DO CLIENTE em destaque → CIDADE - UF → PARES | VOLUME i/N | código pequeno p/ conferência
export function zplVolume({ cliente, cidade, uf, pedido, pares, volume, volumes }) {
  const codigo = `${t(pedido)}-V${volume}`
  const frac = `${volume}/${volumes}`
  const local = [cidade, uf].filter(Boolean).map(cima).join(' - ') || '—'
  const nome = cima(cliente)
  const hNome = nome.length > 40 ? 84 : 104
  return [
    ...cab(),
    T(40, 36, hNome, hNome - 6, nome, { bw: 1120, linhas: 2, esp: 10 }),
    T(40, 270, 72, 66, local, { bw: 1120 }),
    B(30, 372, 1140, 3, 3),
    T(30, 400, 36, 36, 'PARES', { bw: 370, al: 'C' }),
    T(30, 460, 170, String(pares).length > 3 ? 110 : 140, String(pares), { bw: 370, al: 'C' }),
    B(400, 400, 3, 360, 3),
    T(410, 400, 36, 36, 'VOLUME', { bw: 450, al: 'C' }),
    T(410, 460, 170, frac.length > 5 ? 90 : frac.length > 3 ? 115 : 140, frac, { bw: 450, al: 'C' }),
    B(860, 400, 3, 360, 3),
    BAR(890, 470, 120, 2, codigo),
    T(870, 610, 30, 28, codigo, { bw: 310, al: 'C' }),
    '^XZ',
  ].filter(Boolean).join('\n')
}

// Unitárias de um pedido: uma etiqueta por par, a partir dos itens (sku, número, quantidade)
export function zplDoPedido(linhas, tamanhos) {
  return linhas.filter((l) => l.quantidade > 0).map((l) => zplUnitaria({
    ref: l.produto?.ref, tipo: l.produto?.tipo, cor: l.cor?.nome, numero: l.numero, sku: l.sku,
    usa: tamanhos[l.numero]?.usa, eur: tamanhos[l.numero]?.eur, quantidade: l.quantidade,
  })).join('\n')
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
