import { useState } from 'react'
import SeletorGrade from './SeletorGrade.jsx'
import { registrarMovimentos } from '../lib/estoque.js'

const CONFIG = {
  entrada: { titulo: 'Entrada de produção', eyebrow: 'Estoque · entrada', motivo: 'producao', botao: 'Lançar entrada' },
  inventario: { titulo: 'Inventário / ajuste', eyebrow: 'Estoque · contagem', motivo: 'inventario', botao: 'Salvar ajustes' },
}

export default function MovimentoModal({ modo, produtos, cores, saldos, onFechar, onSalvo }) {
  const cfg = CONFIG[modo]
  const [linhas, setLinhas] = useState([])
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  function adicionar(novas) {
    const mapa = Object.fromEntries(linhas.map((l) => [l.sku_id, l]))
    novas.forEach((n) => {
      if (modo === 'entrada' && mapa[n.sku_id]) mapa[n.sku_id] = { ...n, quantidade: mapa[n.sku_id].quantidade + n.quantidade }
      else mapa[n.sku_id] = n
    })
    setLinhas(Object.values(mapa))
  }

  // no inventário a quantidade é o CONTADO; o movimento é a diferença para o saldo
  const efetivas = linhas.map((l) => {
    const saldo = saldos[l.sku_id] ?? 0
    const delta = modo === 'inventario' ? l.quantidade - saldo : l.quantidade
    return { ...l, saldo, delta }
  })
  const totalDelta = efetivas.reduce((t, l) => t + l.delta, 0)

  async function salvar() {
    setErro('')
    const mov = efetivas.filter((l) => l.delta !== 0).map((l) => ({
      sku_id: l.sku_id,
      tipo: modo === 'entrada' ? 'entrada' : 'ajuste',
      quantidade: l.delta,
      motivo: cfg.motivo,
      observacao: obs || null,
    }))
    if (!mov.length) return setErro(modo === 'inventario' ? 'Nenhuma diferença entre o contado e o saldo.' : 'Adicione as quantidades.')
    setSalvando(true)
    try {
      await registrarMovimentos(mov)
      onSalvo()
    } catch (e) {
      setErro(e.message)
      setSalvando(false)
    }
  }

  return (
    <div className="modal-bg" onClick={onFechar}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">{cfg.eyebrow}</div>
            <h2>{cfg.titulo}</h2>
          </div>
          <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
        </div>

        <SeletorGrade produtos={produtos} cores={cores} saldos={saldos} onAdicionar={adicionar}
          modo={modo === 'inventario' ? 'contagem' : 'quantidade'} rotulo="Adicionar à lista" />

        {efetivas.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>SKU</th><th className="r">Saldo atual</th><th className="r">{modo === 'inventario' ? 'Contado' : 'Entrada'}</th><th className="r">Novo saldo</th><th /></tr></thead>
              <tbody>
                {efetivas.map((l) => (
                  <tr key={l.sku_id}>
                    <td className="mono">{l.sku}</td>
                    <td className="r">{l.saldo}</td>
                    <td className="r"><b>{l.quantidade}</b></td>
                    <td className="r" style={{ color: l.delta < 0 ? 'var(--bad)' : l.delta > 0 ? 'var(--ok)' : 'var(--muted)', fontWeight: 600 }}>
                      {l.saldo + l.delta} <span style={{ fontWeight: 400 }}>({l.delta > 0 ? '+' : ''}{l.delta})</span>
                    </td>
                    <td className="r"><button type="button" className="link-btn" onClick={() => setLinhas(linhas.filter((x) => x.sku_id !== l.sku_id))}>remover</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <label className="field"><span>Observação</span><input value={obs} onChange={(e) => setObs(e.target.value)} placeholder={modo === 'entrada' ? 'Ex.: lote UFZ, OP 0187' : 'Ex.: contagem de fim de mês'} /></label>

        {erro && <p className="form-error" role="alert">{erro}</p>}

        <div className="actions" style={{ justifyContent: 'space-between' }}>
          <span className="card-sub" style={{ margin: 0 }}>{efetivas.length} SKUs · {totalDelta > 0 ? '+' : ''}{totalDelta} pares</span>
          <div className="actions">
            <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
            <button type="button" className="btn btn-dark" disabled={salvando || !efetivas.length} onClick={salvar}>{salvando ? 'Salvando…' : cfg.botao}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
