import { useEffect, useMemo, useState } from 'react'
import { brl, dataBR, numeroPedido } from '../lib/format.js'
import { FLUXO, STATUS_PEDIDO, atrasado, carregarItens, mudarStatus, salvarDadosPedido, totaisPedido } from '../lib/pedidos.js'

export default function PedidoDetalhe({ pedido, produtos, cores, onFechar, onMudou }) {
  const [itens, setItens] = useState(null)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [dados, setDados] = useState({ previsao: pedido.previsao || '', observacoes: pedido.observacoes || '', desconto: pedido.desconto || 0 })
  const [editando, setEditando] = useState(false)

  useEffect(() => { carregarItens(pedido.id).then(setItens).catch((e) => setErro(e.message)) }, [pedido.id])

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

  async function acao(status, confirmar) {
    if (confirmar && !window.confirm(confirmar)) return
    setErro(''); setOcupado(true)
    try { await mudarStatus(pedido.id, status); await onMudou(true) } catch (e) { setErro(e.message) } finally { setOcupado(false) }
  }

  async function salvarDados() {
    setErro(''); setOcupado(true)
    try { await salvarDadosPedido(pedido.id, dados); setEditando(false); await onMudou(true) } catch (e) { setErro(e.message) } finally { setOcupado(false) }
  }

  function copiarResumo() {
    const linhas = [
      `*Pedido ${numeroPedido(pedido.numero)}* · ${pedido.parceiros?.nome || 'Sem cliente'}`,
      ...grupos.map((g) => `${g.produto?.ref} ${g.produto?.nome} · ${g.cor?.nome}: ${g.itens.map((i) => `${i.skus.numero}/${i.quantidade}`).join('  ')}`),
      `Total: ${pares} pares · ${brl(total)}`,
      pedido.previsao ? `Previsão: ${dataBR(pedido.previsao)}` : null,
    ].filter(Boolean)
    navigator.clipboard?.writeText(linhas.join('\n')).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000) })
  }

  return (
    <div className="modal-bg" onClick={onFechar}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">{pedido.canal} · criado em {dataBR(pedido.criado_em)}</div>
            <h2>{numeroPedido(pedido.numero)} · {pedido.parceiros?.nome || 'Sem cliente'}</h2>
            <div className="chips" style={{ marginTop: 8 }}>
              <span className={`pill ${st.tom}`}>{st.label}</span>
              {atrasado(pedido) && <span className="pill bad">Atrasado</span>}
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
                      <td><b>{g.produto?.ref} · {g.produto?.nome}</b><br /><span className="card-sub">{g.cor?.nome}</span></td>
                      <td><div className="grade-mini">{g.itens.map((i) => <span key={i.id}><small>{i.skus.numero}</small>{i.quantidade}</span>)}</div></td>
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
            <label className="field span-3"><span>Observações</span><input value={dados.observacoes} onChange={(e) => setDados({ ...dados, observacoes: e.target.value })} /></label>
          </div>
        ) : (
          <dl className="dados">
            <dt>Previsão</dt><dd>{pedido.previsao ? dataBR(pedido.previsao) : '—'}</dd>
            <dt>Observações</dt><dd>{pedido.observacoes || '—'}</dd>
          </dl>
        )}

        {erro && <p className="form-error" role="alert">{erro}</p>}

        <div className="pedido-rodape">
          <div className="pedido-totais">
            <span>{pares} pares</span>
            {Number(pedido.desconto) > 0 && <span>Bruto {brl(bruto)} · desconto −{brl(pedido.desconto)}</span>}
            <b>{brl(total)}</b>
          </div>
          <div className="actions">
            <button type="button" className="btn" onClick={copiarResumo}>{copiado ? 'Copiado ✓' : 'Copiar p/ WhatsApp'}</button>
            {editando
              ? <button type="button" className="btn" disabled={ocupado} onClick={salvarDados}>Salvar dados</button>
              : !fechado && <button type="button" className="btn" onClick={() => setEditando(true)}>Editar dados</button>}
            {pedido.status !== 'cancelado' && pedido.status !== 'entregue' && (
              <button type="button" className="btn btn-perigo" disabled={ocupado}
                onClick={() => acao('cancelado', pedido.estoque_baixado ? 'Cancelar este pedido? O estoque volta automaticamente.' : 'Cancelar este pedido?')}>Cancelar pedido</button>
            )}
            {proximo && proximo !== 'faturado' && (
              <button type="button" className="btn btn-dark" disabled={ocupado} onClick={() => acao(proximo)}>Avançar: {STATUS_PEDIDO[proximo].label}</button>
            )}
            {!fechado && pedido.status !== 'orcamento' && (
              <button type="button" className="btn btn-dark" disabled={ocupado}
                onClick={() => acao('faturado', `Faturar ${numeroPedido(pedido.numero)}? Vai dar baixa de ${pares} pares no estoque.`)}>Faturar</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
