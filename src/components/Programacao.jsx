import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FotoProduto } from './FotoProduto.jsx'
import { UN_CURTA, calcularNecessidade, fmtQtd, listarCompras, listarFichaConsumo, listarMateriais, listarSaldosMateriais } from '../lib/compras.js'
import { dataBR, inteiro } from '../lib/format.js'
import { programar } from '../lib/pcp.js'
import { diasDeTrabalho, numeroOP, salvarSequencia } from '../lib/producao.js'

/*
  Programação (PCP): fila de OPs × capacidade diária do setor gargalo.
  Gera o CONSUMO de matéria-prima da programação (vale para OP de pedido e OP para estoque).
*/
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const HORIZONTES = [{ id: 1, label: 'Hoje' }, { id: 3, label: 'Próximos 3 dias' }, { id: 5, label: 'Próximos 5 dias' }, { id: 10, label: 'Próximos 10 dias' }, { id: 0, label: 'Toda a programação' }]

export default function Programacao({ ops, setores, onAbrir, onMudou }) {
  const [dt, setDt] = useState([1, 2, 3, 4, 5])
  const [mat, setMat] = useState(null) // { ficha, materiais, saldos, compras }
  const [horizonte, setHorizonte] = useState(5)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    diasDeTrabalho().then(setDt).catch(() => {})
    Promise.all([listarFichaConsumo(), listarMateriais(), listarSaldosMateriais(), listarCompras()])
      .then(([ficha, materiais, saldos, compras]) => setMat({ ficha, materiais, saldos, compras }))
      .catch((e) => setErro(e.message))
  }, [])

  const p = useMemo(() => programar({ ops, setores, diasTrabalho: dt }), [ops, setores, dt])
  const atrasam = p.fila.filter((o) => p.porOP[o.id].atraso > 0)

  // consumo: OPs que começam dentro do horizonte entram inteiras (o material é separado antes de começar)
  const consumo = useMemo(() => {
    if (!mat) return null
    const limite = horizonte ? p.dias[Math.min(horizonte, p.dias.length) - 1]?.data : null
    const dentro = p.fila.filter((o) => !limite || p.porOP[o.id].ini <= limite)
    const lista = calcularNecessidade({ ops: dentro, ...mat })
    const comFicha = new Set(mat.ficha.map((f) => f.produto_id))
    return { lista, ops: dentro, semFicha: dentro.filter((o) => !comFicha.has(o.produto_id)), faltando: lista.filter((n) => n.falta > 0).length }
  }, [mat, p, horizonte])

  async function mover(i, d) {
    const ids = p.fila.map((o) => o.id)
    const j = i + d; if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    setSalvando(true); setErro('')
    try { await salvarSequencia(ids); await onMudou() } catch (e) { setErro(e.message) } finally { setSalvando(false) }
  }

  const visiveis = p.dias.slice(0, Math.max(10, p.dias.findIndex((x) => x.data === p.fim) + 1))

  return (
    <>
      <section className="kpis-cor">
        <div className="card kpi-cor"><span className="kpi-label">Capacidade por dia</span><span className="kpi2-valor">{inteiro(p.cap)} pares</span><span className="kpi-note">gargalo: {p.gargalo?.nome || '—'} · ajuste em Configurações</span></div>
        <div className="card kpi-cor"><span className="kpi-label">Programado</span><span className="kpi2-valor">{inteiro(p.total)} pares</span><span className="kpi-note">{p.fila.length} OPs na fila (pares que ainda faltam)</span></div>
        <div className="card kpi-cor"><span className="kpi-label">Fábrica ocupada até</span><span className="kpi2-valor">{p.fim ? dataBR(p.fim) : '—'}</span><span className="kpi-note">{p.fim ? `${p.dias.findIndex((x) => x.data === p.fim) + 1} dias de produção` : 'fila vazia'}</span></div>
        <div className="card kpi-cor"><span className="kpi-label">Estouram o prazo</span><span className="kpi2-valor" style={atrasam.length ? { color: 'var(--bad)' } : undefined}>{atrasam.length}</span><span className="kpi-note">{atrasam.length ? 'mude a sequência ou a capacidade' : 'todas dentro do prazo'}</span></div>
      </section>

      {erro && <p className="form-error" role="alert">{erro}</p>}

      <section className="card">
        <div className="card-head"><div><h2>Calendário da produção</h2><div className="card-sub">carga de cada dia útil × capacidade · clique na OP para abrir</div></div></div>
        <div className="pcp-cal">
          {visiveis.map((d, i) => {
            const pctD = Math.min(1, d.carga / p.cap)
            return (
              <div key={d.data} className={`pcp-dia ${i === 0 ? 'hoje' : ''}`}>
                <div className="pcp-dia-topo"><b>{i === 0 ? 'Hoje' : SEMANA[d.dt.getDay()]}</b><span>{dataBR(d.data).slice(0, 5)}</span></div>
                <div className="pcp-carga" title={`${d.carga} de ${p.cap} pares`}><i style={{ width: `${pctD * 100}%` }} className={pctD >= 1 ? 'cheio' : ''} /></div>
                <small className="pcp-carga-txt">{inteiro(d.carga)} / {inteiro(p.cap)}</small>
                <div className="pcp-ops">
                  {d.ops.map(({ op, pares }) => (
                    <button key={op.id} type="button" className={`pcp-op ${p.porOP[op.id].atraso ? 'atrasa' : ''}`} onClick={() => onAbrir(op)}>
                      <FotoProduto p={op.produtos} corId={op.cor_id} size={26} />
                      <span><b>{numeroOP(op.numero)}</b><small>{op.produtos?.ref} · {op.cores?.nome}</small></span>
                      <em>{inteiro(pares)}</em>
                    </button>
                  ))}
                  {d.ops.length === 0 && <span className="pcp-livre">livre</span>}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="painel-linha">
        <div className="card card-flush">
          <div className="card-head pad"><div><h2>Fila de produção</h2><div className="card-sub">use ↑ ↓ para mudar a ordem · a programação recalcula na hora</div></div></div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead className="tinted"><tr><th>#</th><th>Ordem</th><th className="r">Faltam</th><th>Início</th><th>Termina</th><th>Prazo</th><th /></tr></thead>
              <tbody>
                {p.fila.map((o, i) => {
                  const r = p.porOP[o.id]
                  return (
                    <tr key={o.id}>
                      <td className="faint">{i + 1}</td>
                      <td>
                        <button type="button" className="prod-cell link-sem" onClick={() => onAbrir(o)}>
                          <FotoProduto p={o.produtos} corId={o.cor_id} size={34} />
                          <div><b>{numeroOP(o.numero)} · {o.produtos?.ref}</b><span>{o.cores?.nome}{o.pedidos?.numero ? ` · PV-${String(o.pedidos.numero).padStart(4, '0')}` : ' · para estoque'}{o.prioridade === 'urgente' ? ' · urgente' : ''}</span></div>
                        </button>
                      </td>
                      <td className="r"><b>{inteiro(r.pares)}</b></td>
                      <td>{dataBR(r.ini)}</td>
                      <td><b>{dataBR(r.fim)}</b></td>
                      <td>{o.prazo ? <span className={`pill ${r.atraso ? 'bad' : 'ok'}`}>{dataBR(o.prazo)}{r.atraso ? ` · +${r.atraso}d` : ''}</span> : <span className="faint">sem prazo</span>}</td>
                      <td className="r pcp-mover">
                        <button type="button" className="btn btn-sm icon-btn" disabled={salvando || i === 0} onClick={() => mover(i, -1)} aria-label="Subir">↑</button>
                        <button type="button" className="btn btn-sm icon-btn" disabled={salvando || i === p.fila.length - 1} onClick={() => mover(i, 1)} aria-label="Descer">↓</button>
                      </td>
                    </tr>
                  )
                })}
                {p.fila.length === 0 && <tr><td colSpan={7} className="vazio">Nenhuma OP aberta. Crie em “Nova ordem” ou “Gerar dos pedidos”.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div><h2>Consumo da programação</h2><div className="card-sub">matéria-prima para as OPs que começam no período</div></div>
          </div>
          <select className="input" value={horizonte} onChange={(e) => setHorizonte(Number(e.target.value))} aria-label="Período do consumo" style={{ marginBottom: 12 }}>
            {HORIZONTES.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
          </select>
          {!consumo ? <p className="card-sub" style={{ margin: 0 }}>Calculando…</p> : (
            <>
              <div className="pcp-cons-resumo">
                <span><b>{consumo.ops.length}</b> OPs</span>
                <span><b>{consumo.lista.length}</b> materiais</span>
                <span className={consumo.faltando ? 'falta' : 'ok'}><b>{consumo.faltando}</b> faltando</span>
              </div>
              <div className="pcp-cons">
                {consumo.lista.map((n) => (
                  <div key={`${n.material_id}|${n.numero ?? ''}`} className={`pcp-cons-linha ${n.falta > 0 ? 'falta' : ''}`}>
                    <span className="pcp-cons-nome"><b>{n.material.nome}{n.numero ? ` · nº ${n.numero}` : ''}</b><small>tem {fmtQtd(Math.max(0, n.saldo))}{n.emCompra ? ` · comprando ${fmtQtd(n.emCompra)}` : ''}</small></span>
                    <span className="pcp-cons-q">{fmtQtd(n.necessario)} <small>{UN_CURTA[n.material.unidade] || 'un'}</small></span>
                    <span className="pcp-cons-st">{n.falta > 0 ? <span className="pill bad">falta {fmtQtd(n.falta)}</span> : <span className="pill ok">ok</span>}</span>
                  </div>
                ))}
                {consumo.lista.length === 0 && <p className="card-sub" style={{ margin: 0 }}>Nenhum material para este período.</p>}
              </div>
              {consumo.semFicha.length > 0 && <p className="ft-aviso" style={{ margin: '10px 0 0' }}>⚠ {consumo.semFicha.length} OP(s) sem ficha técnica — o consumo delas não aparece.</p>}
              {consumo.faltando > 0 && <Link to="/compras" className="btn btn-dark" style={{ marginTop: 14, width: '100%' }}>Comprar o que falta</Link>}
            </>
          )}
        </div>
      </section>
    </>
  )
}
