import { useState } from 'react'
import Icon from './Icon.jsx'
import { baixar, enviarWhats, gerarPdf } from '../lib/documentos.js'

/*
  Ações padrão de TODO documento do sistema: Imprimir · Baixar PDF · Enviar no WhatsApp.
  alvo = ref do elemento com a(s) folha(s) A4 · nome = nome do arquivo .pdf
  telefone (opcional) = abre direto a conversa daquele número · mensagem = texto que vai junto
*/
export default function AcoesDocumento({ alvo, nome, telefone, mensagem, pasta = 'documentos', onFechar, imprimirEscuro = false }) {
  const [ocupado, setOcupado] = useState('')
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const arquivo = nome.endsWith('.pdf') ? nome : `${nome}.pdf`

  async function pdf() {
    setErro(''); setMsg(''); setOcupado('pdf')
    try { baixar(await gerarPdf(alvo.current, arquivo), arquivo); setMsg('PDF baixado.') } catch (e) { setErro(e.message) } finally { setOcupado('') }
  }
  async function whats() {
    setErro(''); setMsg(''); setOcupado('whats')
    try {
      const blob = await gerarPdf(alvo.current, arquivo)
      const r = await enviarWhats({ blob, nome: arquivo, telefone, mensagem, pasta })
      if (r === 'link') setMsg(telefone ? 'WhatsApp aberto na conversa com o link do PDF.' : 'WhatsApp aberto com o link do PDF — escolha o contato.')
      if (r === 'compartilhado') setMsg('PDF enviado.')
    } catch (e) { setErro(e.message) } finally { setOcupado('') }
  }

  return (
    <span className="row-gap acoes-doc">
      {msg && <span className="doc-ok">{msg}</span>}
      {erro && <span className="doc-erro">{erro}</span>}
      <button className={`btn ${imprimirEscuro ? 'btn-dark' : ''}`} onClick={() => window.print()}>Imprimir</button>
      <button className="btn" onClick={pdf} disabled={!!ocupado}><Icon name="ficha" size={16} />{ocupado === 'pdf' ? 'Gerando…' : 'Baixar PDF'}</button>
      <button className="btn btn-whats" onClick={whats} disabled={!!ocupado}><Icon name="app" size={16} />{ocupado === 'whats' ? 'Preparando…' : 'Enviar no WhatsApp'}</button>
      {onFechar && <button className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>}
    </span>
  )
}
