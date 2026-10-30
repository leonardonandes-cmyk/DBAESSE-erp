import { useEffect, useMemo, useState } from 'react'
import ProdutoCelula, { FotoProduto } from './FotoProduto.jsx'
import TituloForm from './TituloForm.jsx'
import ImprimirPedido from './ImprimirPedido.jsx'
import ProgramarPedido from './ProgramarPedido.jsx'
import EtiquetasPedido from './EtiquetasPedido.jsx'
import { useNavigate } from 'react-router-dom'
import { programacaoDoPedido, numeroMapa } from '../lib/mapas.js'
import { titulosDoPedido } from '../lib/financeiro.js'
import { brl, dataBR, hojeISO, numeroPedido, rotuloNum } from '../lib/format.js'
import { EXIGE_CADASTRO, enderecoCompleto, pendenciasCadastro } from '../lib/parceiros.js'
import ParceiroForm from './ParceiroForm.jsx'
import { FLUXO, STATUS_PEDIDO, atrasado, carregarItens, mudarStatus, salvarDadosPedido, totaisPedido } from '../lib/pedidos.js'

export default function PedidoDetalhe({ pedido, produtos, cores, parceiros = [], onFechar, onMudou, onCorrigir, abrirDocumento = false }) {
  const [itens, setItens] = useState(null)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [dados, setDados] = useState({ previsao: pedido.previsao || '', observacoes: pedido.observacoes || '', endereco_entrega: pedido.endereco_entrega || '', desconto: pedido.desconto || 0 })
  const [editando, setEditando] = useState(false)
  const [titulos, setTitulos] = useState(null)
  const [gerar, setGerar] = useState(false)
  const [imprimir, setImprimir] = useState(false)
  // programação de cliente (atacado): gerar depois que o cliente conferiu/pagou
  const navigate = useNavigate()
  const [prog, setProg] = useState(undefined) // undefined = carregando · null = não tem
  const [programar, setProgramar] = useState(false)
  const [etiquetas, setEtiquetas] = useState(null) // 'unitaria' | 'volumes'
  useEffect(() => { programacaoDoPedido(pedido.id).then(setProg).catch(() => setProg(null)) }, [pedido.id])

  useEffect(() => { titulosDoPedido(pedido.id).then(setTitulos).catch(() => setTitulos([])) }, [pedido.id, pedido.status])

  useEffect(() => { carregarItens(pedido.id).then(setItens).catch((e) => setErro(e.message)) }, [pedido.id])
  // vindo do atalho da lista (imprimir / enviar): abre o documento assim que os itens chegam
  useEffect(() => { if (abrirDocumento && itens) setImprimir(true) }, [abrirDocumento, itens])

  const prodPorId = useMemo(() => Object.fromEntries(produtos.map((p) => [p.id, p])), [produtos])
  const corPorId = useMemo(() => Object.fromEntries(cores.map((c) => [c.id, c])), [cores])

  const grupos = useMemo(() => {
    if (!itens) return []
    const g = {}
    itens.forEach((i) => {
      const k = `${i.skus.produto_id}|${i.skus.cor_id}`
      ;(g[k] ||= { chave: k, produto: prodPorId[i.skus.produto_id], cor: corPorId[i.skus.cor_id], itens: [] }).itens.push(i)
    })
    return Object.values(g).map((x) => ({ ...x, itens: x.itens.sort((a, b) => a.skus.numero - b.skus.numero) }))
  }, [itens, prodPorId, corPorId])

  const st = STATUS_PEDIDO[pedido.status]
  const { pares, bruto, total } = totaisPedido(pedido)
  const idx = FLUXO.indexOf(pedido.status)
  const proximo = idx >= 0 && idx < FLUXO.length - 1 ? FLUXO[idx + 1] : null
  const fechado = ['faturado', 'entregue', 'cancelado'].includes(pedido.status)
  const clienteCad = parceiros.find((x) => x.id === pedido.parceiro_id)
  const faltaCad = !fechado && EXIGE_CADASTRO.includes(pedido.canal) ? pendenciasCadastro(clienteCad) : []
  const [completar, setCompletar] = useState(false)

  async function acao(status, confirmar) {
    if (confirmar && !window.confirm(confirmar)) return
    setErro(''); setOcupado(true)
    try {
      await mudarStatus(pedido.id, status)
      await onMudou(true)
      if (status === 'faturado') setEtiquetas('volumes') // faturou → pergunta quantos volumes e imprime o romaneio de envio
    } catch (e) { setErro(e.message) } finally { setOcupado(false) }
  }

  async function salvarDados() {
    setErro(''); setOcupado(true)
    try { await salvarDadosPedido(pedido.id, dados); setEditando(false); await onMudou(true) } catch (e) { setErro(e.message) } finally { setOcupado(false) }
  }

  const enderecoCadastro = enderecoCompleto(parceiros.find((x) => x.id === pedido.parceiro_id))
  const entrega = pedido.endereco_entrega || enderecoCadastro

  function copiarResumo() {
    const linhas = [
      `*Pedido ${numeroPedido(pedido.numero)}* · ${pedido.parceiros?.nome || 'Sem cliente'}`,
      ...grupos.map((g) => `${g.produto?.ref} ${g.produto?.nome} · ${g.cor?.nome}: ${g.itens.map((i) => `${i.skus.numero}/${i.quantidade}`).join('  ')}`),
      `Total: ${pares} pares · ${brl(total)}`,
      pedido.previsao ? `Previsão: ${dataBR(pedido.previsao)}` : null,
      entrega ? `Entrega: ${entrega}` : null,
    ].filter(Boolean)
    navigator.clipboard?.writeText(linhas.join('\n')).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000) })
  }

  return (
    <div className="modal-bg" onClick={onFechar}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">{pedido.canal}{pedido.vendedora ? ` · vendedora ${pedido.vendedora}` : ''}{pedido.grupo ? ` · polo ${pedido.grupo}` : ''} · criado em {dataBR(pedido.criado_em)}</div>
            <h2>{numeroPedido(pedido.numero)} · {pedido.parceiros?.nome || 'Sem cliente'}</h2>
            <div className="chips" style={{ marginTop: 8 }}>
              <span className={`pill ${st.tom}`}>{st.label}</span>
              {atrasado(pedido) && <span className="pill bad">Atrasado</span>}
              {pedido.separado_em && <span className="pill ok">Separado no app</span>}
              {pedido.estoque_baixado && <span className="pill neutral">Estoque baixado</span>}
            </div>
          </div>
          <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
        </div>

        {pedido.status !== 'cancelado' && (
          <ol className="fluxo">
            {FLUXO.map((s, i) => (
              <li key={s} className={i < idx ? 'feito' : i === idx ? 'atual' : ''}>{STATUS_PEDIDO[s].label}</li>
            ))}
          </ol>
        )}

        {!itens ? <p className="card-sub">Carregando itens…</p> : (
          <div className="table-wrap">
            <table style={{ minWidth: 520 }}>
              <thead><tr><th>Modelo · cor</th><th>Grade</th><th className="r">Pares</th><th className="r">Preço</th><th className="r">Subtotal</th></tr></thead>
              <tbody>
                {grupos.map((g) => {
                  const qt = g.itens.reduce((t, i) => t + i.quantidade, 0)
                  const sub = g.itens.reduce((t, i) => t + i.quantidade * Number(i.preco_unit), 0)
                  return (
                    <tr key={g.chave}>
                      <td><ProdutoCelula p={g.produto} cor={g.cor} linha2={<><i className="dot-cor" style={{ background: g.cor?.hex || '#ddd' }} />{g.cor?.nome}</>} /></td>
                      <td><div className="grade-mini">{g.itens.map((i) => <span key={i.id}><small>{rotuloNum(i.skus.numero)}</small>{i.quantidade}</span>)}</div></td>
                      <td className="r"><b>{qt}</b></td>
                      <td className="r">{brl(g.itens[0].preco_unit)}</td>
                      <td className="r">{brl(sub)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {editando ? (
          <div className="form-grid">
            <label className="field"><span>Previsão</span><input type="date" value={dados.previsao} onChange={(e) => setDados({ ...dados, previsao: e.target.value })} /></label>
            <label className="field"><span>Desconto (R$)</span><input type="number" step="0.01" min="0" value={dados.desconto} onChange={(e) => setDados({ ...dados, desconto: e.target.value })} /></label>
            <label className="field span-3"><span>Endereço de entrega <small style={{ color: 'var(--muted)' }}>(vazio = endereço do cadastro)</small></span><textarea className="input" rows={2} value={dados.endereco_entrega} placeholder={enderecoCadastro} onChange={(e) => setDados({ ...dados, endereco_entrega: e.target.value })} /></label>
            <label className="field span-3"><span>Observações</span><input value={dados.observacoes} onChange={(e) => setDados({ ...dados, observacoes: e.target.value })} /></label>
          </div>
        ) : (
          <dl className="dados">
            <dt>Previsão</dt><dd>{pedido.previsao ? dataBR(pedido.previsao) : '—'}</dd>
            <dt>Entrega</dt><dd>{entrega || '—'}{pedido.endereco_entrega ? <span className="pill warn" style={{ marginLeft: 8 }}>diferente do cadastro</span> : entrega ? <small style={{ color: 'var(--muted)' }}> · do cadastro</small> : null}</dd>
            <dt>Transportadora</dt><dd>{pedido.transp?.nome || '—'}{pedido.frete_por ? <small style={{ color: 'var(--muted)' }}> · frete {pedido.frete_por === 'empresa' ? 'da DBAESSE (CIF)' : 'do cliente (FOB)'}</small> : null}</dd>
            <dt>Observações</dt><dd>{pedido.observacoes || '—'}</dd>
          </dl>
        )}

        {['faturado', 'entregue'].includes(pedido.status) && titulos && (
          titulos.length ? (
            <div className="preview">
              <b>Contas a receber:</b>{' '}
              {titulos.map((t) => <span key={t.id} style={{ marginRight: 12, whiteSpace: 'nowrap' }}>{t.parcela || 'única'} · {dataBR(t.vencimento)} · {brl(t.valor)}{t.pago_em ? ' ✓' : ''}</span>)}
            </div>
          ) : (
            <div className="preview" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span>Este pedido ainda não tem contas a receber lançadas no Financeiro.</span>
              <button type="button" className="btn btn-sm" onClick={() => setGerar(true)}>Gerar contas a receber</button>
            </div>
          )
        )}

        {erro && <p className="form-error" role="alert">{erro}</p>}

        <div className="pedido-rodape">
          <div className="pedido-totais">
            <span>{pares} pares</span>
            {Number(pedido.desconto) > 0 && <span>Bruto {brl(bruto)} · desconto −{brl(pedido.desconto)}</span>}
            <b>{brl(total)}</b>
          </div>
          {faltaCad.length > 0 && (
            <div className="falta-cad" role="status">
              <span><b>Para faturar, complete o cadastro do cliente.</b> Falta: {faltaCad.join(', ')}.</span>
              {clienteCad && <button type="button" className="btn btn-sm" onClick={() => setCompletar(true)}>Completar cadastro</button>}
            </div>
          )}
          <div className="actions">
            <button type="button" className="btn btn-dark" onClick={() => setImprimir(true)} disabled={!itens}>Visualizar · PDF · WhatsApp</button>
            {pedido.canal === 'Atacado' && pedido.status !== 'cancelado' && prog === null && itens && (
              <button type="button" className="btn" onClick={() => setProgramar(true)}>Gerar programação</button>
            )}
            {prog && <button type="button" className="btn" onClick={() => navigate(`/producao/mapas?imprimir=${prog.id}`)}>Programação {numeroMapa(prog.numero)}</button>}
            {prog && itens && pedido.status !== 'cancelado' && <button type="button" className="btn" onClick={() => setEtiquetas('unitaria')}>Etiquetas unitárias</button>}
            {['faturado', 'entregue'].includes(pedido.status) && itens && <button type="button" className="btn" onClick={() => setEtiquetas('volumes')}>Romaneio de envio</button>}
            <button type="button" className="btn" onClick={copiarResumo}>{copiado ? 'Copiado ✓' : 'Copiar resumo'}</button>
            {editando
              ? <button type="button" className="btn" disabled={ocupado} onClick={salvarDados}>Salvar dados</button>
              : !fechado && !pedido.estoque_baixado && onCorrigir ? <button type="button" className="btn" onClick={onCorrigir}>Corrigir pedido</button>
              : !fechado && <button type="button" className="btn" onClick={() => setEditando(true)}>Editar dados</button>}
            {pedido.status !== 'cancelado' && pedido.status !== 'entregue' && (
              <button type="button" className="btn btn-perigo" disabled={ocupado}
                onClick={() => acao('cancelado', pedido.estoque_baixado ? 'Cancelar este pedido? O estoque volta automaticamente.' : 'Cancelar este pedido?')}>Cancelar pedido</button>
            )}
            {proximo && proximo !== 'faturado' && (
              <button type="button" className="btn btn-dark" disabled={ocupado} onClick={() => acao(proximo)}>Avançar: {STATUS_PEDIDO[proximo].label}</button>
            )}
            {!fechado && pedido.status !== 'orcamento' && (
              <button type="button" className="btn btn-dark" disabled={ocupado || faltaCad.length > 0} title={faltaCad.length ? `Falta no cadastro: ${faltaCad.join(', ')}` : undefined}
                onClick={() => acao('faturado', `Faturar ${numeroPedido(pedido.numero)}? Vai dar baixa de ${pares} pares no estoque.`)}>Faturar</button>
            )}
          </div>
        </div>
            </div>
      {programar && itens && (
        <div onClick={(e) => e.stopPropagation()}>
          <ProgramarPedido pedido={pedido} cliente={parceiros.find((x) => x.id === pedido.parceiro_id)} previsao={pedido.previsao}
            itens={itens.map((i) => ({ sku_id: i.sku_id, numero: i.skus.numero, quantidade: i.quantidade, produto: prodPorId[i.skus.produto_id], cor: corPorId[i.skus.cor_id] }))}
            onCorrigir={() => { setProgramar(false); onCorrigir?.() }}
            onAgoraNao={() => setProgramar(false)}
            onFinalizado={(r) => { setProgramar(false); onMudou?.(); navigate(`/producao/mapas?imprimir=${r.id}`) }} />
        </div>
      )}
      {etiquetas && itens && (
        <div onClick={(e) => e.stopPropagation()}>
          <EtiquetasPedido modo={etiquetas} pedido={pedido} grupos={grupos} cliente={clienteCad} pares={pares} onFechar={() => setEtiquetas(null)} />
        </div>
      )}
      {completar && clienteCad && (
        <div onClick={(e) => e.stopPropagation()}>
          <ParceiroForm parceiro={clienteCad} onFechar={() => setCompletar(false)} onSalvo={async () => { setCompletar(false); await onMudou(true) }} />
        </div>
      )}
      {imprimir && (
        <ImprimirPedido pedido={pedido} grupos={grupos} cliente={parceiros.find((x) => x.id === pedido.parceiro_id)} entrega={entrega}
          totais={{ pares, bruto, total, desconto: Number(pedido.desconto) || 0 }} onFechar={() => { setImprimir(false); if (abrirDocumento) onFechar() }} />
      )}
      {gerar && (
        <div onClick={(e) => e.stopPropagation()}>
          <TituloForm parceiros={parceiros}
            padrao={{ tipo: 'receber', descricao: `Pedido ${numeroPedido(pedido.numero)}`, parceiro_id: pedido.parceiro_id, valorTotal: total.toFixed(2),
              categoria: pedido.canal === 'Variado' ? 'Venda variado' : pedido.canal === 'Drop' ? 'Venda drop' : pedido.canal === 'Atacado' ? 'Venda atacado' : ['Shopee', 'TikTok Shop', 'Mercado Livre'].includes(pedido.canal) ? 'Marketplace' : 'Venda varejo',
              primeiroVencimento: hojeISO(), pedido_id: pedido.id }}
            onFechar={() => setGerar(false)}
            onSalvo={() => { setGerar(false); titulosDoPedido(pedido.id).then(setTitulos) }} />
        </div>
      )}
    </div>
  )
}
