import { supabase } from './supabase.js'
import { soDigitos } from './format.js'

/*
  Documentos para o cliente (pedido / orçamento):
  - PDF gerado no navegador a partir da folha A4 (html2pdf, carregado só quando precisa).
  - WhatsApp: no celular compartilha o PDF direto (escolhe o WhatsApp e o contato);
    no computador salva o PDF no arquivo privado "documentos" e abre a conversa do cliente com o link (vale 30 dias).
*/
const LIB = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
let carregando = null
function carregarLib() {
  if (window.html2pdf) return Promise.resolve(window.html2pdf)
  if (!carregando) {
    carregando = new Promise((ok, falha) => {
      const s = document.createElement('script')
      s.src = LIB; s.async = true
      s.onload = () => ok(window.html2pdf)
      s.onerror = () => { carregando = null; falha(new Error('Não consegui carregar o gerador de PDF. Verifique a internet.')) }
      document.head.appendChild(s)
    })
  }
  return carregando
}

// el = a(s) folha(s) A4 · → Blob do PDF
export async function gerarPdf(el, nome) {
  const html2pdf = await carregarLib()
  return html2pdf().set({
    margin: 0, filename: nome,
    image: { type: 'jpeg', quality: 0.92 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'], after: '.folha-quebra' },
  }).from(el).outputPdf('blob')
}

export function baixar(blob, nome) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = nome; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

const numeroWhats = (tel) => { let d = soDigitos(tel); if (!d) return ''; if (d.length <= 11) d = `55${d}`; return d }

// → 'compartilhado' (celular) | 'link' (abriu o WhatsApp com o link)
export async function enviarWhats({ blob, nome, telefone, mensagem, pasta = 'pedidos' }) {
  const arquivo = new File([blob], nome, { type: 'application/pdf' })
  const celular = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  if (celular && navigator.canShare?.({ files: [arquivo] })) {
    try { await navigator.share({ files: [arquivo], text: mensagem }); return 'compartilhado' } catch (e) { if (e?.name === 'AbortError') return 'cancelado' }
  }
  // computador: guarda o PDF e manda o link
  const janela = window.open('about:blank', '_blank') // abre já (navegador bloqueia pop-up depois de esperar o upload)
  try {
    const { data: u } = await supabase.auth.getUser()
    const { data: perfil, error: e0 } = await supabase.from('perfis').select('empresa_id').eq('id', u.user.id).single()
    if (e0) throw e0
    const caminho = `${perfil.empresa_id}/${pasta}/${Date.now()}-${nome}`
    const { error: e1 } = await supabase.storage.from('documentos').upload(caminho, blob, { contentType: 'application/pdf', upsert: true })
    if (e1) throw e1
    const { data: s, error: e2 } = await supabase.storage.from('documentos').createSignedUrl(caminho, 60 * 60 * 24 * 30)
    if (e2) throw e2
    const texto = `${mensagem}\n\n📄 ${s.signedUrl}`
    const num = numeroWhats(telefone)
    const url = num ? `https://wa.me/${num}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`
    if (janela) janela.location.href = url; else window.open(url, '_blank')
    return 'link'
  } catch (e) {
    janela?.close()
    throw e
  }
}
