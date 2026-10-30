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

// COLETIVA (caixa master / Bulk): REF, tipo, cor | total de pares | grade número × pares | código da caixa
export function zplColetiva({ ref, tipo, cor, grade, codigo, quantidade = 1 }) {
  const nums = grade.filter((g) => g.pares > 0)
  const total = nums.reduce((s, g) => s + g.pares, 0)
  const x0 = 30
  const larg = 740
  const cel = Math.floor(larg / Math.max(nums.length, 1))
  const celulas = nums.map((g, i) => {
    const x = x0 + i * cel
    return [
      `^FO${x},218^GB${cel},92,2^FS`,
      `^FO${x},228^FB${cel},1,0,C^A0N,34,32^FD${t(g.numero)}^FS`,
      `^FO${x},268^FB${cel},1,0,C^A0N,32,30^FD${g.pares}^FS`,
    ].join('\n')
  })
  return [
    '^XA', '^CI28', `^PW${ETQ.largura}`, `^LL${ETQ.altura}`, '^LH0,0',
    `^FO30,24^A0N,80,80^FD${t(ref)}^FS`,
    tipo ? `^FO32,112^A0N,28,28^FD${cima(tipo)}^FS` : '',
    `^FO30,150^FB520,1,0,L^A0N,40,38^FD${cima(cor)}^FS`,
    '^FO575,20^GB3,180,3^FS',
    `^FO580,22^FB210,1,0,C^A0N,26,26^FDCAIXA^FS`,
    `^FO580,52^FB210,1,0,C^A0N,110,100^FD${total}^FS`,
    `^FO580,162^FB210,1,0,C^A0N,26,26^FDPARES^FS`,
    ...celulas,
    `^FO${xCentroBarras(codigo)},330^BY2,3^BCN,92,N,N,N^FD${t(codigo)}^FS`,
    `^FO0,436^FB${ETQ.largura},1,0,C^A0N,28,28^FD${t(codigo)}^FS`,
    `^PQ${Math.max(1, Number(quantidade) || 1)},0,1,Y`,
    '^XZ',
  ].filter(Boolean).join('\n')
}

// VOLUME (faturamento): cliente, cidade/UF, pedido, total de pares | VOLUME i/N grande | código do volume
export function zplVolume({ cliente, cidade, pedido, pares, volume, volumes, transportadora }) {
  const codigo = `${t(pedido)}-V${volume}`
  return [
    '^XA', '^CI28', `^PW${ETQ.largura}`, `^LL${ETQ.altura}`, '^LH0,0',
    `^FO30,24^FB520,2,4,L^A0N,46,44^FD${cima(cliente)}^FS`,
    cidade ? `^FO30,126^FB520,1,0,L^A0N,32,30^FD${cima(cidade)}^FS` : '',
    `^FO30,172^A0N,30,30^FDPEDIDO ${t(pedido)}^FS`,
    `^FO30,212^A0N,30,30^FD${pares} PARES NO PEDIDO^FS`,
    transportadora ? `^FO30,252^FB520,1,0,L^A0N,26,26^FDTRANSP.: ${cima(transportadora)}^FS` : '',
    '^FO575,20^GB3,290,3^FS',
    `^FO580,26^FB210,1,0,C^A0N,28,28^FDVOLUME^FS`,
    `^FO580,70^FB210,1,0,C^A0N,120,${volumes > 9 ? 70 : 100}^FD${volume}/${volumes}^FS`,
    '^FO20,322^GB760,3,3^FS',
    `^FO${xCentroBarras(codigo)},340^BY2,3^BCN,84,N,N,N^FD${codigo}^FS`,
    `^FO0,436^FB${ETQ.largura},1,0,C^A0N,28,28^FD${codigo}^FS`,
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
