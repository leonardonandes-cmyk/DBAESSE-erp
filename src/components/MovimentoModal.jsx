import { useState } from 'react'
import SeletorGrade from './SeletorGrade.jsx'
import { LOCAIS, registrarMovimentos, transferirEstoque } from '../lib/estoque.js'

const CONFIG = {
  entrada: { titulo: 'Entrada de produção', eyebrow: 'Estoque · entrada', motivo: 'producao', botao: 'Lançar entrada', local: 'bulk' },
  inventario: { titulo: 'Inventário / ajuste', eyebrow: 'Estoque · contagem', motivo: 'inventario', botao: 'Salvar ajustes', local: 'bulk' },
  transferencia: { titulo: 'Replenishment', eyebrow: 'Estoque · Bulk → Pick', motivo: 'replenishment', botao: 'Transferir', local: 'bulk' },
}

// saldos = { total: {sku: n}, bulk: {sku: n}, pick: {sku: n} }
export default function MovimentoModal({ modo, produtos, cores, saldos, onFechar, onSalvo }) {
  const cfg = CONFIG[modo]
  const transf = modo === 'transferencia'
  const [local, setLocal] = useState(cfg.local) // no replenishment = local de ORIGEM
  const destino = local === 'bulk' ? 'pick' : 'bulk'
  const [linhas, setLinhas] = useState([])
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const saldoLocal = saldos[local] || {}

  function adicionar(novas) {
    const mapa = Object.fromEntries(linhas.map((l) => [l.sku_id, l]))
    novas.forEach((n) => {
      if (modo !== 'inventario' && mapa[n.sku_id]) mapa[n.sku_id] = { ...n, quantidade: mapa[n.sku_id].quantidade + n.quantidade }
      else mapa[n.sku_id] = n
    })
    setLinhas(Object.values(mapa))
  }

  // no inventário a quantidade é o CONTADO; o movimento é a diferença para o saldo daquele local
  const efetivas = linhas.map((l) => {
    const saldo = saldoLocal[l.sku_id] ?? 0
    const delta = modo === 'inventario' ? l.quantidade - saldo : transf ? -l.quantidade : l.quantidade
    return { ...l, saldo, delta }
  })
  const totalDelta = efetivas.reduce((t, l) => t + Math.abs(l.delta), 0)
  const semSaldo = transf ? efetivas.filter((l) => l.quantidade > Math.max(0, l.saldo)) : []

  async function salvar() {
    setErro('')
    if (transf) {
      if (!efetivas.length) return setErro('Adicione as quantidades.')
      if (semSaldo.length) return setErro(`Não há saldo suficiente no ${LOCAIS[local].label} para: ${semSaldo.map((l) => l.sku).join(', ')}.`)
      setSalvando(true)
      try { await transferirEstoque(efetivas, local, destino, obs); onSalvo() } catch (e) { setErro(e.message); setSalvando(false) }
      return
    }
    const mov = efetivas.filter((l) => l.delta !== 0).map((l) => ({
      sku_id: l.sku_id,
      tipo: modo === 'entrada' ? 'entrada' : 'ajuste',
      quantidade: l.delta,
      motivo: cfg.motivo,
      observacao: obs || null,
      local,
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

  function trocarLocal(l) { setLocal(l); if (modo === 'inventario') setLinhas([]) }

  const seletorLocal = (
    <div className="field">
      <span>{transf ? 'Mover de → para' : 'Local'}</span>
      <div className="chips">
        {transf ? (
          <>
            <button type="button" className={`chip ${local === 'bulk' ? 'on' : ''}`} onClick={() => trocarLocal('bulk')}>Bulk → Pick</button>
            <button type="button" className={`chip ${local === 'pick' ? 'on' : ''}`} onClick={() => trocarLocal('pick')}>Pick → Bulk</button>
          </>
        ) : Object.entries(LOCAIS).map(([k, v]) => (
          <button type="button" key={k} className={`chip ${local === k ? 'on' : ''}`} onClick={() => trocarLocal(k)} title={v.desc}>{v.label}</button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="modal-bg" onClick={onFechar}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">{transf ? `Estoque · ${LOCAIS[local].label} → ${LOCAIS[destino].label}` : cfg.eyebrow}</div>
            <h2>{cfg.titulo}</h2>
            {transf && <p className="card-sub" style={{ margin: '6px 0 0' }}>Abriu caixa master? Passe os pares do Bulk para o Pick para separar pedido variado.</p>}
          </div>
          <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
        </div>

        <SeletorGrade produtos={produtos} cores={cores} saldos={saldoLocal} onAdicionar={adicionar}
          modo={modo === 'inventario' ? 'contagem' : 'quantidade'} rotulo="Adicionar à lista" extra={seletorLocal} />

        {efetivas.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>SKU</th>
                <th className="r">Saldo {LOCAIS[local].label}</th>
                <th className="r">{modo === 'inventario' ? 'Contado' : transf ? 'Transferir' : 'Entrada'}</th>
                <th className="r">{transf ? `Fica no ${LOCAIS[local].label}` : 'Novo saldo'}</th><th />
              </tr></thead>
              <tbody>
                {efetivas.map((l) => (
                  <tr key={l.sku_id}>
                    <td className="mono">{l.sku}</td>
                    <td className="r">{l.saldo}</td>
                    <td className="r"><b>{l.quantidade}</b></td>
                    <td className="r" style={{ color: l.saldo + l.delta < 0 ? 'var(--bad)' : l.delta > 0 ? 'var(--ok)' : 'var(--muted)', fontWeight: 600 }}>
                      {l.saldo + l.delta} <span style={{ fontWeight: 400 }}>({l.delta > 0 ? '+' : ''}{l.delta})</span>
                    </td>
                    <td className="r"><button type="button" className="link-btn" onClick={() => setLinhas(linhas.filter((x) => x.sku_id !== l.sku_id))}>remover</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <label className="field"><span>Observação</span><input value={obs} onChange={(e) => setObs(e.target.value)} placeholder={modo === 'entrada' ? 'Ex.: lote UFZ, OP 0187' : transf ? 'Ex.: abri 2 masters da 801 nude' : 'Ex.: contagem de fim de mês'} /></label>

        {erro && <p className="form-error" role="alert">{erro}</p>}

        <div className="actions" style={{ justifyContent: 'space-between' }}>
          <span className="card-sub" style={{ margin: 0 }}>{efetivas.length} SKUs · {transf ? `${totalDelta} pares para o ${LOCAIS[destino].label}` : `${totalDelta} pares`}</span>
          <div className="actions">
            <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
            <button type="button" className="btn btn-dark" disabled={salvando || !efetivas.length} onClick={salvar}>{salvando ? 'Salvando…' : cfg.botao}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
