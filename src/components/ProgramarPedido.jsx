import { useMemo, useState } from 'react'
import ProdutoCelula from './FotoProduto.jsx'
import { hojeISO, inteiro, numeroPedido, rotuloNum } from '../lib/format.js'
import { blocosDoPedido, criarMapa } from '../lib/mapas.js'
import { supabase } from '../lib/supabase.js'

/*
  Programação de CLIENTE gerada do pedido (atacado): produz o pedido inteiro (não mexe no estoque),
  com a marca do cliente e a data de entrega combinada.
  Nada é gravado até "Finalizar": se algo estiver errado, volta ao pedido, corrige e a prévia é refeita.
*/
export default function ProgramarPedido({ pedido, cliente, previsao, itens, onCorrigir, onFinalizado, onAgoraNao }) {
  const [blocos, setBlocos] = useState(() => blocosDoPedido(itens))
  const [cab, setCab] = useState({ marca: '', previsao: previsao || '', prioridade: 'normal', observacao: '' })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const set = (k) => (e) => setCab((c) => ({ ...c, [k]: e.target.value }))

  const nums = useMemo(() => [...new Set(itens.map((i) => i.numero))].sort((a, b) => a - b), [itens])
  const tot = (c) => Object.values(c.grade).reduce((t, q) => t + (Number(q) || 0), 0)
  const totalGeral = blocos.reduce((t, b) => t + b.cores.reduce((s, c) => s + tot(c), 0), 0)
  const nOps = blocos.reduce((t, b) => t + b.cores.length, 0)

  async function finalizar() {
    setErro('')
    if (!cab.previsao) return setErro('Informe a data de entrega combinada com o cliente.')
    if (!cab.marca.trim()) return setErro('Informe a marca (do cliente ou SEM LOGO).')
    setSalvando(true)
    try {
      const r = await criarMapa({
        cab: { pedido: numeroPedido(pedido.numero), pedido_id: pedido.id, parceiro_id: cliente?.id || null, cliente: cliente?.nome || '', marca: cab.marca, data: hojeISO(), previsao: cab.previsao, prioridade: cab.prioridade, observacao: cab.observacao },
        blocos,
      })
      const { error } = await supabase.from('pedidos').update({ status: 'producao', previsao: cab.previsao }).eq('id', pedido.id)
      if (error) throw error
      onFinalizado(r)
    } catch (e) { setErro(e.message); setSalvando(false) }
  }

  return (
    <div className="modal-bg">
      <div className="modal modal-xl prog-pedido">
        <div className="modal-head">
          <div>
            <div className="eyebrow">Programação de cliente · pedido {numeroPedido(pedido.numero)} · {cliente?.nome || 'sem cliente'}</div>
            <h2>Alguma correção?</h2>
            <p className="card-sub" style={{ margin: '6px 0 0' }}>Confira a programação montada a partir do pedido — <b>o pedido inteiro</b>, sem usar estoque. Se algo estiver errado, corrija o pedido: a programação é refeita.</p>
          </div>
        </div>

        <div className="form-grid">
          <label className="field"><span>Marca</span><input value={cab.marca} onChange={set('marca')} placeholder="Marca do cliente ou SEM LOGO" list="marcas-prog" /><datalist id="marcas-prog"><option value="SEM LOGO" /><option value="DBAESSE" /></datalist></label>
          <label className="field"><span>Entrega combinada</span><input type="date" value={cab.previsao} onChange={set('previsao')} /></label>
          <label className="field"><span>Prioridade</span><select className="input" value={cab.prioridade} onChange={set('prioridade')}><option value="normal">Normal</option><option value="urgente">Urgente</option></select></label>
          <label className="field"><span>Observação</span><input value={cab.observacao} onChange={set('observacao')} placeholder="Ex.: caixa personalizada" /></label>
        </div>

        <div className="prog-blocos">
          {blocos.map((b, i) => (
            <div key={b.k} className="prog-bloco">
              <div className="prog-bloco-head">
                <ProdutoCelula p={b.produto} linha2={<span>{b.produto.tipo}</span>} />
                <label className="mapa-obs"><span>OBS</span><input value={b.obs} onChange={(e) => setBlocos((bs) => bs.map((x, j) => (j === i ? { ...x, obs: e.target.value } : x)))} placeholder="Ex.: SALTO BLOCO · GOTA NA COR" /></label>
              </div>
              <table className="prog-grade">
                <thead><tr><th>Cor</th>{nums.map((n) => <th key={n} className="c">{rotuloNum(n)}</th>)}<th className="r">Pares</th></tr></thead>
                <tbody>
                  {b.cores.map((c) => {
                    const it = itens.find((x) => (x.cor?.id || x.cor_id) === c.cor_id && x.produto?.id === b.produto.id)
                    return (
                      <tr key={c.k}>
                        <td><span className="prog-cor"><i style={{ background: it?.cor?.hex || "#ddd" }} />{it?.cor?.nome || "—"}</span></td>
                        {nums.map((n) => <td key={n} className="c">{Number(c.grade[n]) ? c.grade[n] : <span className="faint">·</span>}</td>)}
                        <td className="r"><b>{inteiro(tot(c))}</b></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <div className="prog-resumo"><b>{blocos.length}</b> referências · <b>{inteiro(totalGeral)}</b> pares · <b>{nOps}</b> fichas (uma por cor)</div>
        {erro && <p className="form-error" role="alert">{erro}</p>}

        <div className="prog-acoes">
          <button type="button" className="link-btn" onClick={onAgoraNao} disabled={salvando}>Agora não (programar depois)</button>
          <div className="row-gap">
            <button type="button" className="btn" onClick={onCorrigir} disabled={salvando}>Sim, corrigir o pedido</button>
            <button type="button" className="btn btn-dark" onClick={finalizar} disabled={salvando}>{salvando ? 'Gerando…' : 'Não, finalizar programação'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
