import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import { ALERTAS, CARGA_SETORES, EMPRESA, KPIS, PEDIDOS, STATUS_PEDIDO, VENDAS_SEMANA } from '../data/mock.js'

const TOM_ALERTA = {
  bad: { background: 'var(--bad-soft)', color: 'var(--bad)' },
  warn: { background: 'var(--accent-soft)', color: 'var(--accent)' },
  neutral: { background: 'var(--neutral-soft)', color: 'var(--ink-2)' },
}

function saudacao() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

function hoje() {
  const s = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function Painel({ usuario }) {
  const [periodo, setPeriodo] = useState('12s')
  const max = Math.max(...VENDAS_SEMANA) * 1.05

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{hoje()}</div>
          <h1>{saudacao()}, {usuario}</h1>
        </div>
        <div className="actions">
          <label className="search">
            <Icon name="busca" size={16} />
            <span className="sr-only">Buscar</span>
            <input type="search" placeholder="Buscar pedido, REF, cliente…" />
          </label>
          <button className="btn btn-dark"><Icon name="mais" size={16} stroke={2} />Novo pedido</button>
        </div>
      </header>

      <section className="grid-kpi" aria-label="Indicadores">
        {KPIS.map((k) => (
          <div className="card kpi" key={k.label}>
            <span className="kpi-label">{k.label}</span>
            <span className="kpi-value">{k.valor}</span>
            <span className={`kpi-note ${k.tom || ''}`}>{k.nota}</span>
          </div>
        ))}
      </section>

      <section className="grid-3">
        <div className="card span-2">
          <div className="card-head">
            <div>
              <h2>Vendas por semana</h2>
              <div className="card-sub">Pares vendidos, todos os canais</div>
            </div>
            <div className="segmented">
              <button className={periodo === '12s' ? 'on' : ''} onClick={() => setPeriodo('12s')}>12 semanas</button>
              <button className={periodo === 'ano' ? 'on' : ''} onClick={() => setPeriodo('ano')}>Ano</button>
            </div>
          </div>
          <div className="bars">
            {VENDAS_SEMANA.map((v, i) => (
              <div className="bar-col" key={i}>
                <span>{v}</span>
                <div className={`bar ${i === VENDAS_SEMANA.length - 1 ? 'last' : ''}`} style={{ height: `${(v / max) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="bar-labels">
            {VENDAS_SEMANA.map((_, i) => <span key={i}>S{i + 32}</span>)}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Precisa da sua atenção</h2></div>
          {ALERTAS.map((a) => (
            <Link to={a.para} className="alert-row" key={a.titulo}>
              <span className="alert-num" style={TOM_ALERTA[a.tom]}>{a.n}</span>
              <span style={{ flex: 1 }}>
                <span className="alert-title">{a.titulo}</span><br />
                <span className="alert-sub">{a.sub}</span>
              </span>
              <Icon name="seta" size={16} />
            </Link>
          ))}
        </div>
      </section>

      <section className="grid-3">
        <div className="card">
          <div className="card-head">
            <h2>Produção agora</h2>
            <Link to="/producao" className="link">Ver ordens</Link>
          </div>
          {CARGA_SETORES.map((s) => (
            <div className="meter-row" key={s.setor}>
              <div><b style={{ fontWeight: 600 }}>{s.setor}</b><span style={{ color: 'var(--muted)' }}>{s.pares.toLocaleString('pt-BR')} pares</span></div>
              <div className="meter"><i className={s.ocupacao >= 90 ? 'bad' : ''} style={{ width: `${s.ocupacao}%` }} /></div>
            </div>
          ))}
        </div>

        <div className="card span-2">
          <div className="card-head">
            <h2>Pedidos recentes</h2>
            <Link to="/pedidos" className="link">Ver todos</Link>
          </div>
          <div className="table-wrap">
            <table style={{ minWidth: 600 }}>
              <thead>
                <tr><th>Pedido</th><th>Cliente</th><th>Canal</th><th className="r">Pares</th><th>Situação</th><th className="r">Previsão</th></tr>
              </thead>
              <tbody>
                {PEDIDOS.map((p) => {
                  const st = STATUS_PEDIDO[p.status]
                  return (
                    <tr key={p.id}>
                      <td><b>{p.id}</b></td>
                      <td>{p.cliente}</td>
                      <td style={{ color: 'var(--muted)' }}>{p.canal}</td>
                      <td className="r">{p.pares}</td>
                      <td><span className={`pill ${st.tom}`}>{st.label}</span></td>
                      <td className="r" style={{ color: 'var(--muted)' }}>{p.previsao}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <p className="footnote">Valores ilustrativos — na próxima etapa a tela passa a ler os dados reais da fábrica.</p>
    </>
  )
}
