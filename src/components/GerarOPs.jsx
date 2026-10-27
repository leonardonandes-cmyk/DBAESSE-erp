import { useState } from 'react'
import ProdutoCelula, { FotoProduto } from './FotoProduto.jsx'
import { criarOP } from '../lib/producao.js'
import { numeroPedido } from '../lib/format.js'

/* Lista o que falta produzir para atender os pedidos e cria as OPs marcadas */
export default function GerarOPs({ sugestoes, onFechar, onSalvo }) {
  const [marcadas, setMarcadas] = useState(() => new Set(sugestoes.map((s) => s.chave)))
  const [prazo, setPrazo] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  function alternar(k) {
    const n = new Set(marcadas)
    n.has(k) ? n.delete(k) : n.add(k)
    setMarcadas(n)
  }

  async function criar() {
    setErro(''); setSalvando(true)
    try {
      for (const s of sugestoes.filter((x) => marcadas.has(x.chave))) {
        await criarOP({ produto_id: s.produto.id, cor_id: s.cor.id, pedido_id: s.pedido_id, prazo, prioridade: 'normal',
          observacao: `Para ${s.pedidos.map(numeroPedido).join(', ')}`, itens: s.itens })
      }
      onSalvo()
    } catch (e) { setErro(e.message); setSalvando(false) }
  }

  const total = sugestoes.filter((s) => marcadas.has(s.chave)).reduce((t, s) => t + s.itens.reduce((x, i) => x + i.quantidade, 0), 0)

  return (
    <div className="modal-bg" onClick={onFechar}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div><div className="eyebrow">Produção</div><h2>Gerar ordens a partir dos pedidos</h2></div>
          <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
        </div>
        <p className="card-sub" style={{ margin: 0 }}>
          Considera os pedidos <b>aprovados, em produção e em separação</b>. Para cada número: o que foi pedido, menos o que tem em estoque, menos o que já está em OP aberta.
        </p>

        {sugestoes.length === 0 ? (
          <div className="preview">Nada a produzir: o estoque e as OPs abertas já cobrem os pedidos.</div>
        ) : (
          <div className="table-wrap">
            <table style={{ minWidth: 560 }}>
              <thead><tr><th /><th>Modelo · cor</th><th>Grade a produzir</th><th className="r">Pares</th><th>Pedidos</th></tr></thead>
              <tbody>
                {sugestoes.map((s) => (
                  <tr key={s.chave} className="clickable" onClick={() => alternar(s.chave)}>
                    <td><input type="checkbox" checked={marcadas.has(s.chave)} onChange={() => alternar(s.chave)} onClick={(e) => e.stopPropagation()} aria-label="Gerar esta OP" /></td>
                    <td><ProdutoCelula p={s.produto} cor={s.cor} linha2={<><i className="dot-cor" style={{ background: s.cor?.hex || '#ddd' }} />{s.cor?.nome}</>} /></td>
                    <td><div className="grade-mini">{s.itens.map((i) => <span key={i.sku_id}><small>{i.numero}</small>{i.quantidade}</span>)}</div></td>
                    <td className="r"><b>{s.itens.reduce((t, i) => t + i.quantidade, 0)}</b></td>
                    <td style={{ color: 'var(--muted)' }}>{s.pedidos.map(numeroPedido).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="form-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
          <label className="field"><span>Prazo das OPs</span><input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></label>
        </div>

        {erro && <p className="form-error" role="alert">{erro}</p>}

        <div className="pedido-rodape">
          <div className="pedido-totais"><span>{marcadas.size} ordens</span><b>{total} pares</b></div>
          <div className="actions">
            <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
            <button type="button" className="btn btn-dark" disabled={salvando || !marcadas.size} onClick={criar}>{salvando ? 'Criando…' : 'Criar ordens marcadas'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
