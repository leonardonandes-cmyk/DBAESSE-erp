// QR Code das fichas: biblioteca leve carregada do CDN só quando a impressão abre
const LIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'
let promessa
export function carregarQR() {
  if (window.qrcode) return Promise.resolve(window.qrcode)
  promessa ||= new Promise((ok, falha) => {
    const s = document.createElement('script')
    s.src = LIB; s.async = true
    s.onload = () => ok(window.qrcode)
    s.onerror = () => { promessa = null; falha(new Error('Não consegui carregar o gerador de QR Code.')) }
    document.head.appendChild(s)
  })
  return promessa
}
export function qrSvg(qrcode, texto) {
  const q = qrcode(0, 'M'); q.addData(texto); q.make()
  return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true })
}
