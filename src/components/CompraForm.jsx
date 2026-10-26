import { useMemo, useState } from 'react'
import { UN_CURTA, criarCompra, fmtQtd } from '../lib/compras.js'
import { brl } from '../lib/format.js'

/* Novo pedido de compra. `inicial` (opcional) vem da tela de necessidade: [{material, numero, quantidade}] */
export default function CompraForm({ materiais, fornecedores, inicial, fornecedorInicial, onFechar, onSalvo }) {
  const ativos = materiais.filter((m) => m.ativo)
  const [f, setF] = useState({ fornecedor_id: fornecedorInicial || '', previsao: '', observacao: '', status: 'enviado' })
  const [itens, setItens] = useState(() => (inicial || []).map((i, k) => ({
    k, material_id: i.material.id, numero: i.numero ?? '', quantidade: Math.ceil(i.quantidade * 1000 - 1e-6) / 1000, custo_unit: i.material.custo ?? '',
  })))
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const matPorId = useMemo(() => Object.fromEntries(materiais.map((m) => [m.id, m])), [materiais])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const add = () => setItens([...itens, { k: Date.now(), material_id: '', numero: '', quantidade: '', custo_unit: '' }])
  const muda = (k, campo, v) => setItens(itens.map((i) => {
    if (i.k !== k) return i
    const n = { ...i, [campo]: v }
    if (campo === 'material_id') n.custo_unit = matPorId[v]?.custo ?? ''
    return n
  }))
  const total = itens.reduce((t, i) => t + (Number(i.quantidade) || 0) * (Number(i.custo_unit) || 0), 0)

  async function salvar() {
    setErro('')
    const validos = itens.filter((i) => i.material_id && Number(i.quantidade) > 0)
    for (const i of validos) if (matPorId[i.material_id]?.por_numero && !i.numero) return setErro(`Informe o número para ${matPorId[i.material_id].nome}.`)
    setSalvando(true)
    try {
      await criarCompra({ ...f, itens: validos.map((i) => ({ ...i, numero: i.numero === '' ? null : Number(i.numero) })) })
      onSalvo()
    } catch (e) { setErro(e.message); setSalvando(false) }
  }

  return (
    <div className="modal-bg" onClick={onFechar}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div><div className="eyebrow">Compras</div><h2>Novo pedido de compra</h2></div>
          <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
        </div>
        <div className="form-grid">
          <label className="field span-2">
            <span>Fornecedor</span>
            <select className="input" value={f.fornecedor_id} onChange={set('fornecedor_id')}>
              <option value="">—</option>
              {fornecedores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
          <label className="field"><span>Previsão de entrega</span><input type="date" value={f.previsao} onChange={set('previsao')} /></label>
          <label className="field">
            <span>Situação</span>
            <select className="input" value={f.status} onChange={set('status')}>
              <option value="rascunho">Rascunho</option>
              <option value="enviado">Enviado ao fornecedor</option>
            </select>
          </label>
          <label className="field span-2"><span>Observação</span><input value={f.observacao} onChange={set('observacao')} /></label>
        </div>

        <div className="table-wrap">
          <table style={{ minWidth: 640 }}>
            <thead><tr><th>Material</th><th>Nº</th><th className="r">Quantidade</th><th className="r">Custo unit.</th><th className="r">Subtotal</th><th /></tr></thead>
            <tbody>
              {itens.map((i) => {
                const m = matPorId[i.material_id]
                return (
                  <tr key={i.k}>
                    <td>
                      <select className="input" value={i.material_id} onChange={(e) => muda(i.k, 'material_id', e.target.value)} aria-label="Material">
                        <option value="">Escolha…</option>
                        {ativos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                      </select>
                    </td>
                    <td>{m?.por_numero ? <input className="input input-sm" style={{ width: 70 }} type="number" value={i.numero} onChange={(e) => muda(i.k, 'numero', e.target.value)} aria-label="Número" /> : <span style={{ color: 'var(--faint)' }}>—</span>}</td>
                    <td className="r"><input className="input input-sm" type="number" step="0.001" min="0" value={i.quantidade} onChange={(e) => muda(i.k, 'quantidade', e.target.value)} aria-label="Quantidade" /> <small>{m ? UN_CURTA[m.unidade] : ''}</small></td>
                    <td className="r"><input className="input input-sm" type="number" step="0.0001" min="0" value={i.custo_unit} onChange={(e) => muda(i.k, 'custo_unit', e.target.value)} aria-label="Custo unitário" /></td>
                    <td className="r">{brl((Number(i.quantidade) || 0) * (Number(i.custo_unit) || 0))}</td>
                    <td className="r"><button type="button" className="link-btn" onClick={() => setItens(itens.filter((x) => x.k !== i.k))}>remover</button></td>
                  </tr>
                )
              })}
              {itens.length === 0 && <tr><td colSpan={6} style={{ color: 'var(--muted)' }}>Nenhum material ainda.</td></tr>}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={add}>+ Adicionar material</button>

        {erro && <p className="form-error" role="alert">{erro}</p>}
        <div className="pedido-rodape">
          <div className="pedido-totais"><span>{itens.length} itens · {fmtQtd(itens.reduce((t, i) => t + (Number(i.quantidade) || 0), 0))} un.</span><b>{brl(total)}</b></div>
          <div className="actions">
            <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
            <button type="button" className="btn btn-dark" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar pedido de compra'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
