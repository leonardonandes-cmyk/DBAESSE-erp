import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FotoProduto } from './FotoProduto.jsx'
import AcoesDocumento from './AcoesDocumento.jsx'
import { brl, inteiro, numeroPedido, rotuloNum } from '../lib/format.js'
import { MODALIDADE, modalidadeDoCanal } from '../lib/modalidades.js'
import { supabase } from '../lib/supabase.js'

/*
  Pedido / orçamento para o cliente: visualizar, imprimir, baixar PDF e enviar pelo WhatsApp.
  Folha A4 no padrão DBAESSE (clean, editorial). Sem custo, margem ou dado interno.
*/
export default function ImprimirPedido({ pedido, grupos, cliente, entrega, totais, onFechar }) {
  const folha = useRef(null)
  const [empresa, setEmpresa] = useState(null)
  useEffect(() => {
    supabase.from('empresas').select('nome,razao_social,cnpj,telefone,email,endereco,numero,bairro,cidade,uf,pix_chave,pagamento_instrucoes').limit(1).maybeSingle().then(({ data }) => setEmpresa(data || null)).catch(() => {})
    document.body.classList.add('imprimindo')
    return () => document.body.classList.remove('imprimindo')
  }, [])

  const orcamento = pedido.status === 'orcamento'
  const titulo = orcamento ? 'Orçamento' : 'Pedido de venda'
  const nomeArq = `${orcamento ? 'Orcamento' : 'Pedido'}-${numeroPedido(pedido.numero)}-${(cliente?.nome || 'cliente').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/-+$/, '')}.pdf`
  const dataLonga = (iso) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '')
  const seg = MODALIDADE[modalidadeDoCanal(pedido.canal)]?.label
  const nums = [...new Set(grupos.flatMap((g) => g.itens.map((i) => i.skus.numero)))].sort((a, b) => a - b)
  const linhaEmpresa = empresa ? [empresa.razao_social, empresa.cnpj && `CNPJ ${empresa.cnpj}`, empresa.telefone, empresa.email, empresa.cidade && `${empresa.cidade}${empresa.uf ? `/${empresa.uf}` : ''}`].filter(Boolean).join(' · ') : ''
  const mensagem = `Olá${cliente?.nome ? `, ${cliente.nome.split(' ')[0]}` : ''}! Segue ${orcamento ? 'o orçamento' : 'o pedido'} ${numeroPedido(pedido.numero)} da DBAESSE: ${inteiro(totais.pares)} pares · ${brl(totais.total)}${pedido.previsao ? ` · previsão ${dataLonga(pedido.previsao)}` : ''}.\n\nConfira os itens no PDF${empresa?.pix_chave || empresa?.pagamento_instrucoes ? ' e, estando tudo certo, o pagamento pode ser feito por aqui:' : '. Estando tudo certo, é só nos confirmar.'}${empresa?.pix_chave ? `\n💳 Pix: ${empresa.pix_chave}` : ''}${empresa?.pagamento_instrucoes ? `\n${empresa.pagamento_instrucoes}` : ''}`

  return createPortal(
    <div className="print-root">
      <div className="print-barra no-print">
        <div><b>{titulo} {numeroPedido(pedido.numero)}</b> <span className="faint">· {cliente?.nome || 'sem cliente'}</span></div>
        <AcoesDocumento alvo={folha} nome={nomeArq} telefone={cliente?.telefone} mensagem={mensagem} pasta="pedidos" onFechar={onFechar} />
      </div>

      <div className="print-folhas">
        <div className="folha doc-folha" ref={folha}>
          <header className="doc-cab">
            <div className="doc-logo"><b>DBAESSE</b>{linhaEmpresa && <small>{linhaEmpresa}</small>}</div>
            <div className="doc-tit"><small>{titulo}</small><b>{numeroPedido(pedido.numero)}</b><span>{dataLonga(pedido.criado_em)}</span></div>
          </header>

          <section className="doc-partes">
            <div>
              <small>Cliente</small>
              <b>{cliente?.nome || '—'}</b>
              {cliente?.documento && <span>CPF/CNPJ {cliente.documento}</span>}
              {cliente?.telefone && <span>{cliente.telefone}</span>}
            </div>
            <div>
              <small>Entrega</small>
              <span>{entrega || '—'}</span>
              {pedido.previsao && <span><b>Previsão: {dataLonga(pedido.previsao)}</b></span>}
            </div>
            <div>
              <small>Condição</small>
              <span>{seg}{pedido.vendedora ? ` · atendimento ${pedido.vendedora}` : ''}</span>
            </div>
          </section>

          <table className="doc-itens">
            <thead>
              <tr><th className="doc-col-prod">Modelo</th>{nums.map((n) => <th key={n} className="c">{rotuloNum(n)}</th>)}<th className="r">Pares</th><th className="r">Preço par</th><th className="r">Total</th></tr>
            </thead>
            <tbody>
              {grupos.map((g) => {
                const qt = g.itens.reduce((t, i) => t + i.quantidade, 0)
                const sub = g.itens.reduce((t, i) => t + i.quantidade * Number(i.preco_unit), 0)
                const q = (n) => g.itens.filter((i) => i.skus.numero === n).reduce((t, i) => t + i.quantidade, 0)
                return (
                  <tr key={g.chave} className="doc-item">
                    <td className="doc-col-prod">
                      <div className="doc-prod"><FotoProduto p={g.produto} corId={g.cor?.id} size={46} />
                        <div><b>{g.produto?.ref}</b> <span>{g.produto?.nome}</span><em><i style={{ background: g.cor?.hex || '#ddd' }} />{g.cor?.nome}</em></div>
                      </div>
                    </td>
                    {nums.map((n) => <td key={n} className="c">{q(n) || ''}</td>)}
                    <td className="r"><b>{qt}</b></td>
                    <td className="r">{brl(g.itens[0].preco_unit)}</td>
                    <td className="r"><b>{brl(sub)}</b></td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <section className="doc-fim">
            <div className="doc-obs">
              {pedido.observacoes && <><small>Observações</small><p>{pedido.observacoes}</p></>}
              {(empresa?.pix_chave || empresa?.pagamento_instrucoes) && <div className="doc-pag"><small>Pagamento</small>{empresa.pix_chave && <p><b>Pix:</b> {empresa.pix_chave}</p>}{empresa.pagamento_instrucoes && <p>{empresa.pagamento_instrucoes}</p>}</div>}
              {orcamento && <p className="doc-valid">Orçamento válido por 7 dias. Sujeito à disponibilidade de estoque.</p>}
            </div>
            <div className="doc-totais">
              <span><small>Pares</small><b>{inteiro(totais.pares)}</b></span>
              {totais.desconto > 0 && <span><small>Subtotal</small><b>{brl(totais.bruto)}</b></span>}
              {totais.desconto > 0 && <span><small>Desconto{totais.bruto ? ` (${(totais.desconto / totais.bruto * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)` : ''}</small><b>− {brl(totais.desconto)}</b></span>}
              <span className="doc-total"><small>Total</small><b>{brl(totais.total)}</b></span>
            </div>
          </section>

          <footer className="doc-rodape">Obrigada pela preferência · DBAESSE</footer>
        </div>
      </div>
    </div>,
    document.body,
  )
}
