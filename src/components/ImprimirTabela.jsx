import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import AcoesDocumento from './AcoesDocumento.jsx'
import { FotoProduto } from './FotoProduto.jsx'
import { brl } from '../lib/format.js'
import { precoNaLista } from '../lib/precos.js'
import { supabase } from '../lib/supabase.js'

/*
  Tabela de preços PARA O CLIENTE: uma lista só (Atacado, Variado, Drop ou Varejo), com fotos.
  Nunca mostra custo, margem nem as outras listas.
*/
export default function ImprimirTabela({ produtos, listas, onFechar }) {
  const folhas = useRef(null)
  const [codigo, setCodigo] = useState(listas.find((l) => l.codigo === 'atacado')?.codigo || listas[0]?.codigo)
  const [empresa, setEmpresa] = useState(null)
  useEffect(() => {
    supabase.from('empresas').select('razao_social,cnpj,telefone,email,cidade,uf').limit(1).maybeSingle().then(({ data }) => setEmpresa(data || null)).catch(() => {})
    document.body.classList.add('imprimindo'); return () => document.body.classList.remove('imprimindo')
  }, [])
  const lista = listas.find((l) => l.codigo === codigo)
  const itens = produtos.filter((p) => p.status !== 'inativo' && precoNaLista(p, lista) > 0)
  const hoje = new Date().toLocaleDateString('pt-BR')
  const contato = empresa ? [empresa.telefone, empresa.email, empresa.cidade && `${empresa.cidade}${empresa.uf ? `/${empresa.uf}` : ''}`].filter(Boolean).join(' · ') : ''

  return createPortal(
    <div className="print-root">
      <div className="print-barra no-print">
        <div className="segmented" role="group" aria-label="Lista de preço">
          {listas.map((l) => <button key={l.codigo} className={codigo === l.codigo ? 'on' : ''} onClick={() => setCodigo(l.codigo)}>{l.nome}</button>)}
        </div>
        <AcoesDocumento alvo={folhas} onFechar={onFechar} pasta="tabelas" nome={`Tabela-de-precos-DBAESSE-${lista?.nome || ''}-${hoje.replace(/\//g, '-')}`}
          mensagem={`Olá! Segue a tabela de preços ${lista?.nome ? `(${lista.nome}) ` : ''}da DBAESSE atualizada em ${hoje}, com ${itens.length} modelos. Qualquer dúvida, estamos por aqui.`} />
      </div>
      <div className="print-folhas" ref={folhas}>
        <div className="folha tp-folha">
          <header className="doc-cab">
            <div className="doc-logo"><b>DBAESSE</b>{contato && <small>{contato}</small>}</div>
            <div className="doc-tit"><small>Tabela de preços</small><b>{lista?.nome}</b><span>{hoje}</span></div>
          </header>
          <div className="tp-grid">
            {itens.map((p) => (
              <div key={p.id} className="tp-card">
                <div className="tp-foto"><FotoProduto p={p} size={150} /></div>
                <div className="tp-info"><b>{p.ref}</b><span>{p.nome}</span>{p.tipo && <em>{p.tipo}</em>}</div>
                <div className="tp-preco">{brl(precoNaLista(p, lista))}<small>o par</small></div>
              </div>
            ))}
          </div>
          <footer className="doc-rodape">Preços sujeitos a alteração sem aviso · DBAESSE</footer>
        </div>
      </div>
    </div>,
    document.body,
  )
}
