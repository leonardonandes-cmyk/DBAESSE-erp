import Icon from '../components/Icon.jsx'
import { ORDENS, SETORES } from '../data/mock.js'

const ETAPA = {
  ok: { cls: 'ok', txt: 'OK' },
  cur: { cls: 'cur', txt: 'Em curso' },
  late: { cls: 'late', txt: 'Atrasado' },
  pend: { cls: 'pend', txt: '—' },
}

export default function Producao() {
  const pares = ORDENS.reduce((t, o) => t + o.pares, 0)
  const atrasadas = ORDENS.filter((o) => o.atrasada).length
  const resumo = [
    { label: 'Pares programados', valor: pares.toLocaleString('pt-BR') },
    { label: 'Ordens ativas', valor: ORDENS.length },
    { label: 'Ordens atrasadas', valor: atrasadas, bad: true },
    { label: 'Perdas', valor: '1,4%' },
  ]

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Programação da semana</div>
          <h1>Produção</h1>
        </div>
        <div className="actions">
          <button className="btn">Apontar produção</button>
          <button className="btn btn-dark"><Icon name="mais" size={16} stroke={2} />Nova ordem</button>
        </div>
      </header>

      <section className="grid-kpi" aria-label="Resumo">
        {resumo.map((r) => (
          <div className="card kpi" key={r.label}>
            <span className="kpi-label">{r.label}</span>
            <span className="kpi-value" style={r.bad ? { color: 'var(--bad)' } : undefined}>{r.valor}</span>
          </div>
        ))}
      </section>

      <section className="card card-flush" aria-label="Ordens de produção">
        <div className="card-head" style={{ padding: '18px 20px', margin: 0, borderBottom: '1px solid var(--line-soft)' }}>
          <h2>Ordens em andamento</h2>
          <div className="legend">
            <span><i style={{ background: 'var(--ink)' }} />Concluído</span>
            <span><i style={{ background: 'var(--accent)' }} />Em curso</span>
            <span><i style={{ background: 'var(--bad)' }} />Atrasado</span>
            <span><i style={{ background: '#fff', border: '1px solid #CFCCC6' }} />Pendente</span>
          </div>
        </div>
        <div className="table-wrap">
          <table style={{ minWidth: 960 }}>
            <thead className="tinted">
              <tr>
                <th>Ordem · modelo</th>
                <th className="r">Pares</th>
                {SETORES.map((s) => <th key={s} className="c">{s}</th>)}
                <th className="r">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {ORDENS.map((o) => (
                <tr key={o.id}>
                  <td>
                    <b>{o.id} · {o.modelo}</b><br />
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{o.origem}</span>
                  </td>
                  <td className="r"><b style={{ fontWeight: 600 }}>{o.pares}</b></td>
                  {o.etapas.map((e, i) => (
                    <td key={i}><div className={`step ${ETAPA[e].cls}`} title={`${SETORES[i]}: ${ETAPA[e].txt}`}>{ETAPA[e].txt}</div></td>
                  ))}
                  <td className="r" style={{ fontWeight: 600, color: o.atrasada ? 'var(--bad)' : 'var(--ink)' }}>{o.prazo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="footnote">Setores de exemplo — trocaremos pelos setores reais da fábrica. Valores ilustrativos.</p>
    </>
  )
}
