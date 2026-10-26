import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import { CARGA_SETORES } from '../data/mock.js'
import { listarSaldos } from '../lib/estoque.js'
import { brl, brlCurto, dataBR, inteiro, numeroPedido } from '../lib/format.js'
import { listarParceiros } from '../lib/parceiros.js'
import { ABERTOS, STATUS_PEDIDO, atrasado, listarPedidos, totaisPedido } from '../lib/pedidos.js'
import { listarProdutos } from '../lib/produtos.js'

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
// segunda-feira da semana de uma data
function inicioSemana(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

export default function Painel({ usuario }) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    Promise.all([listarPedidos(), listarSaldos(), listarProdutos(), listarParceiros()])
      .then(([pedidos, saldos, produtos, parceiros]) => setDados({ pedidos, saldos, produtos, parceiros }))
      .catch((e) => setErro(e.message))
  }, [])

  const calc = useMemo(() => {
    if (!dados) return null
    const { pedidos, saldos, produtos, parceiros } = dados
    const abertos = pedidos.filter((p) => ABERTOS.includes(p.status))
    const vendidos = pedidos.filter((p) => ['faturado', 'entregue'].includes(p.status))
    const agora = new Date()
    const mesAtual = vendidos.filter((p) => {
      const d = new Date(p.criado_em)
      return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear()
    })

    // 12 semanas de pares faturados
    const base = inicioSemana(agora)
    const semanas = Array.from({ length: 12 }, (_, i) => {
      const ini = new Date(base); ini.setDate(ini.getDate() - 7 * (11 - i))
      return { ini, pares: 0, rotulo: `${String(ini.getDate()).padStart(2, '0')}/${String(ini.getMonth() + 1).padStart(2, '0')}` }
    })
    vendidos.forEach((p) => {
      const s = inicioSemana(p.criado_em).getTime()
      const alvo = semanas.find((w) => w.ini.getTime() === s)
      if (alvo) alvo.pares += totaisPedido(p).pares
    })

    const atrasados = pedidos.filter(atrasado)
    const rascunhos = produtos.filter((p) => p.status === 'rascunho').length
    const ativos = produtos.filter((p) => p.status === 'ativo')
    const skusAtivos = new Set(ativos.flatMap((p) => p.skus.map((s) => s.id)))
    const zerados = saldos.filter((s) => skusAtivos.has(s.sku_id) && s.saldo <= 0).length
    const clientes = parceiros.filter((p) => p.tipos.includes('cliente') || p.tipos.includes('revendedora')).length

    const alertas = [
      atrasados.length && { n: atrasados.length, titulo: 'Pedidos atrasados', sub: 'Previsão de entrega já passou', tom: 'bad', para: '/pedidos' },
      zerados && { n: zerados, titulo: 'SKUs sem estoque', sub: 'Modelos ativos com saldo zerado', tom: 'warn', para: '/estoque' },
      rascunhos && { n: rascunhos, titulo: 'Modelos em rascunho', sub: 'Faltam nome e cores para ativar', tom: 'neutral', para: '/produtos' },
      !clientes && { n: 0, titulo: 'Nenhum cliente cadastrado', sub: 'Cadastre para lançar pedidos', tom: 'neutral', para: '/clientes' },
    ].filter(Boolean)

    return {
      abertos,
      paresAbertos: abertos.reduce((t, p) => t + totaisPedido(p).pares, 0),
      valorAbertos: abertos.reduce((t, p) => t + totaisPedido(p).total, 0),
      faturadoMes: mesAtual.reduce((t, p) => t + totaisPedido(p).total, 0),
      paresMes: mesAtual.reduce((t, p) => t + totaisPedido(p).pares, 0),
      emEstoque: saldos.reduce((t, s) => t + Math.max(0, s.saldo), 0),
      ativos: ativos.length,
      semanas,
      alertas,
      recentes: pedidos.slice(0, 6),
      atrasados: atrasados.length,
    }
  }, [dados])

  const maxSemana = calc ? Math.max(1, ...calc.semanas.map((s) => s.pares)) : 1
  const semVendas = calc && calc.semanas.every((s) => s.pares === 0)

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{hoje()}</div>
          <h1>{saudacao()}, {usuario}</h1>
        </div>
        <div className="actions">
          <Link to="/estoque" className="btn">Entrada de produção</Link>
          <Link to="/pedidos" className="btn btn-dark"><Icon name="mais" size={16} stroke={2} />Novo pedido</Link>
        </div>
      </header>

      {erro && <p className="form-error" role="alert">Não consegui ler o banco: {erro}</p>}

      <section className="grid-kpi" aria-label="Indicadores">
        <div className="card kpi">
          <span className="kpi-label">Faturado no mês</span>
          <span className="kpi-value">{calc ? brlCurto(calc.faturadoMes) : '—'}</span>
          <span className="kpi-note">{calc ? `${inteiro(calc.paresMes)} pares` : ' '}</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Pedidos em aberto</span>
          <span className="kpi-value">{calc ? inteiro(calc.abertos.length) : '—'}</span>
          <span className={`kpi-note ${calc?.atrasados ? 'bad' : ''}`}>{calc ? (calc.atrasados ? `${calc.atrasados} atrasados` : `${inteiro(calc.paresAbertos)} pares`) : ' '}</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">A faturar</span>
          <span className="kpi-value">{calc ? brlCurto(calc.valorAbertos) : '—'}</span>
          <span className="kpi-note">pedidos em aberto</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Em estoque</span>
          <span className="kpi-value">{calc ? `${inteiro(calc.emEstoque)} pares` : '—'}</span>
          <span className="kpi-note">{calc ? `${calc.ativos} modelos ativos` : ' '}</span>
        </div>
      </section>

      <section className="grid-3">
        <div className="card span-2">
          <div className="card-head">
            <div>
              <h2>Pares faturados por semana</h2>
              <div className="card-sub">Últimas 12 semanas, todos os canais</div>
            </div>
          </div>
          <div className="bars" style={{ position: 'relative' }}>
            {calc?.semanas.map((s, i) => (
              <div className="bar-col" key={i}>
                <span>{s.pares || ''}</span>
                <div className={`bar ${i === 11 ? 'last' : ''}`} style={{ height: `${(s.pares / maxSemana) * 100}%`, minHeight: s.pares ? 4 : 0 }} />
              </div>
            ))}
            {semVendas && <div className="bars-vazio">O gráfico começa a aparecer quando o primeiro pedido for faturado.</div>}
          </div>
          <div className="bar-labels">
            {calc?.semanas.map((s, i) => <span key={i}>{s.rotulo}</span>)}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Precisa da sua atenção</h2></div>
          {calc && calc.alertas.length === 0 && <p className="card-sub" style={{ margin: 0 }}>Tudo em dia por aqui.</p>}
          {calc?.alertas.map((a) => (
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
            <span className="pill neutral">Exemplo · fase 5</span>
          </div>
          {CARGA_SETORES.map((s) => (
            <div className="meter-row" key={s.setor} style={{ opacity: 0.55 }}>
              <div><b style={{ fontWeight: 600 }}>{s.setor}</b><span style={{ color: 'var(--muted)' }}>{s.pares.toLocaleString('pt-BR')} pares</span></div>
              <div className="meter"><i style={{ width: `${s.ocupacao}%` }} /></div>
            </div>
          ))}
        </div>

        <div className="card span-2">
          <div className="card-head">
            <h2>Pedidos recentes</h2>
            <Link to="/pedidos" className="link">Ver todos</Link>
          </div>
          {calc && calc.recentes.length === 0 ? (
            <p className="card-sub" style={{ margin: 0 }}>Nenhum pedido ainda. <Link to="/pedidos" className="link">Lançar o primeiro</Link></p>
          ) : (
            <div className="table-wrap">
              <table style={{ minWidth: 600 }}>
                <thead>
                  <tr><th>Pedido</th><th>Cliente</th><th>Canal</th><th className="r">Pares</th><th className="r">Valor</th><th>Situação</th><th className="r">Previsão</th></tr>
                </thead>
                <tbody>
                  {calc?.recentes.map((p) => {
                    const st = STATUS_PEDIDO[p.status]
                    const t = totaisPedido(p)
                    return (
                      <tr key={p.id}>
                        <td><b>{numeroPedido(p.numero)}</b></td>
                        <td>{p.parceiros?.nome || '—'}</td>
                        <td style={{ color: 'var(--muted)' }}>{p.canal}</td>
                        <td className="r">{t.pares}</td>
                        <td className="r">{brl(t.total)}</td>
                        <td><span className={`pill ${atrasado(p) ? 'bad' : st.tom}`}>{atrasado(p) ? 'Atrasado' : st.label}</span></td>
                        <td className="r" style={{ color: 'var(--muted)' }}>{dataBR(p.previsao)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
