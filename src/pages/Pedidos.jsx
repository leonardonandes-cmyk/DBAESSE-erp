import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import NovoPedido from '../components/NovoPedido.jsx'
import PedidoDetalhe from '../components/PedidoDetalhe.jsx'
import { listarSaldos, saldoPorSku } from '../lib/estoque.js'
import { brl, brlCurto, dataBR, inteiro, numeroPedido } from '../lib/format.js'
import { listarParceiros } from '../lib/parceiros.js'
import { ABERTOS, STATUS_PEDIDO, atrasado, listarPedidos, totaisPedido } from '../lib/pedidos.js'
import { listarCores, listarProdutos } from '../lib/produtos.js'

const FILTROS = [
  { id: 'abertos', label: 'Em aberto', teste: (p) => ABERTOS.includes(p.status) },
  { id: 'atrasados', label: 'Atrasados', teste: atrasado },
  { id: 'faturados', label: 'Faturados', teste: (p) => ['faturado', 'entregue'].includes(p.status) },
  { id: 'cancelados', label: 'Cancelados', teste: (p) => p.status === 'cancelado' },
  { id: 'todos', label: 'Todos', teste: () => true },
]

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([])
  const [produtos, setProdutos] = useState([])
  const [cores, setCores] = useState([])
  const [parceiros, setParceiros] = useState([])
  const [saldos, setSaldos] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('abertos')
  const [busca, setBusca] = useState('')
  const [novo, setNovo] = useState(false)
  const [aberto, setAberto] = useState(null)
  const [corrigir, setCorrigir] = useState(null)

  async function carregar() {
    try {
      const [pe, pr, co, pa, sa] = await Promise.all([listarPedidos(), listarProdutos(), listarCores(), listarParceiros(), listarSaldos()])
      setPedidos(pe); setProdutos(pr); setCores(co); setParceiros(pa); setSaldos(saldoPorSku(sa))
      return pe
    } catch (e) { setErro(e.message) } finally { setCarregando(false) }
  }
  // vindo da Produção: ?abrir=<id> abre o pedido · ?corrigir=<id> abre a correção
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    carregar().then((lista) => {
      const id = params.get('abrir') || params.get('corrigir')
      const p = id && lista?.find((x) => x.id === id)
      if (p) (params.get('corrigir') ? setCorrigir : setAberto)(p)
      if (id) setParams({}, { replace: true })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const visiveis = useMemo(() => {
    const f = FILTROS.find((x) => x.id === filtro)
    const q = busca.trim().toLowerCase()
    return pedidos.filter((p) => f.teste(p) &&
      (!q || `${numeroPedido(p.numero)} ${p.numero} ${p.parceiros?.nome || ''} ${p.canal}`.toLowerCase().includes(q)))
  }, [pedidos, filtro, busca])

  const abertos = pedidos.filter((p) => ABERTOS.includes(p.status))
  const paresAbertos = abertos.reduce((t, p) => t + totaisPedido(p).pares, 0)
  const valorAbertos = abertos.reduce((t, p) => t + totaisPedido(p).total, 0)
  const qtdAtrasados = pedidos.filter(atrasado).length
  const contagem = Object.fromEntries(FILTROS.map((f) => [f.id, pedidos.filter(f.teste).length]))

  async function depoisDeMudar(manterAberto) {
    const lista = await carregar()
    if (manterAberto && aberto && lista) setAberto(lista.find((p) => p.id === aberto.id) || null)
    else setAberto(null)
  }

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Do orçamento à entrega</div>
          <h1>Pedidos</h1>
        </div>
        <div className="actions">
          <button className="btn btn-dark" onClick={() => setNovo(true)}><Icon name="mais" size={16} stroke={2} />Novo pedido</button>
        </div>
      </header>

      {erro && <p className="form-error" role="alert">Não consegui ler o banco: {erro}</p>}

      <section className="grid-kpi">
        <div className="card kpi"><span className="kpi-label">Pedidos em aberto</span><span className="kpi-value">{inteiro(abertos.length)}</span></div>
        <div className="card kpi"><span className="kpi-label">Pares em aberto</span><span className="kpi-value">{inteiro(paresAbertos)}</span></div>
        <div className="card kpi"><span className="kpi-label">Valor a faturar</span><span className="kpi-value">{brlCurto(valorAbertos)}</span></div>
        <div className="card kpi"><span className="kpi-label">Atrasados</span><span className="kpi-value" style={qtdAtrasados ? { color: 'var(--bad)' } : undefined}>{inteiro(qtdAtrasados)}</span></div>
      </section>

      <div className="actions">
        <label className="search">
          <Icon name="busca" size={16} />
          <span className="sr-only">Buscar pedido</span>
          <input type="search" placeholder="Buscar por número, cliente ou canal" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <div className="chips">
          {FILTROS.map((f) => (
            <button key={f.id} className={`chip ${f.id === filtro ? 'on' : ''}`} onClick={() => setFiltro(f.id)}>{f.label} · {contagem[f.id]}</button>
          ))}
        </div>
      </div>

      {!carregando && pedidos.length === 0 && !erro ? (
        <section className="card empty">
          <span className="alert-num" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', width: 56, height: 56, borderRadius: 14 }}>
            <Icon name="pedidos" size={24} />
          </span>
          <h2>Nenhum pedido ainda</h2>
          <p>Lance o primeiro pedido escolhendo o cliente, os modelos e a grade de cada cor. Ao faturar, o estoque baixa sozinho.</p>
          <button className="btn btn-dark" onClick={() => setNovo(true)}>Lançar primeiro pedido</button>
        </section>
      ) : (
        <section className="card card-flush">
          <div className="table-wrap">
            <table style={{ minWidth: 720 }}>
              <thead className="tinted">
                <tr><th>Pedido</th><th>Cliente</th><th>Canal</th><th className="r">Pares</th><th className="r">Valor</th><th>Situação</th><th className="r">Previsão</th></tr>
              </thead>
              <tbody>
                {carregando && <tr><td colSpan={7} style={{ color: 'var(--muted)', padding: 32 }}>Carregando…</td></tr>}
                {visiveis.map((p) => {
                  const st = STATUS_PEDIDO[p.status]
                  const t = totaisPedido(p)
                  const late = atrasado(p)
                  return (
                    <tr key={p.id} className="clickable" onClick={() => setAberto(p)}>
                      <td><b>{numeroPedido(p.numero)}</b></td>
                      <td>{p.parceiros?.nome || <span style={{ color: 'var(--muted)' }}>Sem cliente</span>}</td>
                      <td style={{ color: 'var(--muted)' }}>{p.canal}</td>
                      <td className="r">{t.pares}</td>
                      <td className="r">{brl(t.total)}</td>
                      <td><span className={`pill ${st.tom}`}>{st.label}</span>{late && <span className="pill bad" style={{ marginLeft: 6 }}>Atrasado</span>}</td>
                      <td className="r" style={{ color: late ? 'var(--bad)' : 'var(--muted)', fontWeight: late ? 600 : 400 }}>{dataBR(p.previsao)}</td>
                    </tr>
                  )
                })}
                {!carregando && pedidos.length > 0 && visiveis.length === 0 && (
                  <tr><td colSpan={7} style={{ color: 'var(--muted)', padding: 32 }}>Nenhum pedido neste filtro.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {novo && (
        <NovoPedido produtos={produtos} cores={cores} parceiros={parceiros} saldos={saldos}
          onFechar={() => setNovo(false)} onSalvo={() => { setNovo(false); setFiltro('abertos'); carregar() }} />
      )}
      {aberto && (
        <PedidoDetalhe pedido={aberto} produtos={produtos} cores={cores} parceiros={parceiros}
          onFechar={() => setAberto(null)} onMudou={depoisDeMudar} onCorrigir={() => setCorrigir(aberto)} />
      )}
      {corrigir && (
        <NovoPedido pedido={corrigir} produtos={produtos} cores={cores} parceiros={parceiros} saldos={saldos}
          onFechar={() => setCorrigir(null)}
          onSalvo={async () => { const id = corrigir.id; setCorrigir(null); const lista = await carregar(); setAberto(lista?.find((p) => p.id === id) || null) }} />
      )}
    </>
  )
}
