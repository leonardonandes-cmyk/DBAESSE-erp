import { useEffect, useMemo, useState } from 'react'
import { FotoProduto } from '../components/FotoProduto.jsx'
import SeletorPeriodo, { periodoPadrao, resolverPeriodo } from '../components/SeletorPeriodo.jsx'
import { MODALIDADES, modalidadeDoCanal } from '../lib/modalidades.js'
import { useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import NovoPedido from '../components/NovoPedido.jsx'
import PedidoDetalhe from '../components/PedidoDetalhe.jsx'
import { listarSaldos, saldoPorSku } from '../lib/estoque.js'
import { brl, brlCurto, dataBR, inteiro, numeroPedido } from '../lib/format.js'
import { DOCUMENTOS, listarParceiros } from '../lib/parceiros.js'
import { ABERTOS, STATUS_PEDIDO, atrasado, listarPedidos, marcarNotaEmitida, totaisPedido } from '../lib/pedidos.js'
import { listarCores, listarProdutos } from '../lib/produtos.js'

const programado = (p) => p.status === 'producao' || (p.programacoes?.length > 0 && ABERTOS.includes(p.status))
const FILTROS = [
  { id: 'abertos', label: 'Não faturados', teste: (p) => ABERTOS.includes(p.status) },
  { id: 'orcamento', label: 'Orçamentos', teste: (p) => p.status === 'orcamento' },
  { id: 'aprovado', label: 'Aprovados', teste: (p) => p.status === 'aprovado' && !programado(p) },
  { id: 'programados', label: 'Programados', teste: programado },
  { id: 'separacao', label: 'Separação', teste: (p) => p.status === 'separacao' },
  { id: 'atrasados', label: 'Atrasados', teste: atrasado, tom: 'bad' },
  { id: 'faturados', label: 'Faturados', teste: (p) => p.status === 'faturado' },
  { id: 'notas', label: 'Notas a emitir', teste: (p) => ['faturado', 'entregue'].includes(p.status) && !p.nota_emitida, tom: 'warn' },
  { id: 'entregues', label: 'Entregues', teste: (p) => p.status === 'entregue' },
  { id: 'cancelados', label: 'Cancelados', teste: (p) => p.status === 'cancelado' },
  { id: 'todos', label: 'Todos', teste: () => true },
]
const FECHADO = ['faturado', 'entregue', 'cancelado']

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
  const [documento, setDocumento] = useState(false) // abriu pelo atalho Imprimir / Enviar
  const [modalidade, setModalidade] = useState('')
  const [vendedora, setVendedora] = useState('')
  const [periodo, setPeriodo] = useState(() => periodoPadrao('tudo'))

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

  // filtros de cima (modalidade, vendedora, período, busca) valem para todas as abas e para as contagens
  const base = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const per = resolverPeriodo(periodo)
    return pedidos.filter((p) => {
      if (modalidade && modalidadeDoCanal(p.canal) !== modalidade) return false
      if (vendedora && (p.vendedora || '') !== (vendedora === '—' ? '' : vendedora)) return false
      const d = new Date(p.criado_em)
      if (per && (d < per.ini || d > per.fim)) return false
      return !q || `${numeroPedido(p.numero)} ${p.numero} ${p.parceiros?.nome || ''} ${p.canal} ${p.vendedora || ''}`.toLowerCase().includes(q)
    })
  }, [pedidos, busca, modalidade, vendedora, periodo])
  const visiveis = useMemo(() => base.filter(FILTROS.find((x) => x.id === filtro).teste), [base, filtro])
  const somaVis = visiveis.reduce((a, p) => { const t = totaisPedido(p); return { pares: a.pares + t.pares, total: a.total + t.total } }, { pares: 0, total: 0 })
  const vendedoras = [...new Set(pedidos.map((p) => p.vendedora || '—'))].sort()
  const prodPorId = useMemo(() => Object.fromEntries(produtos.map((p) => [p.id, p])), [produtos])
  // até 3 modelos (foto da cor) por pedido
  const fotosDe = (p) => {
    const vistos = new Map()
    ;(p.pedido_itens || []).forEach((i) => { const k = i.skus?.produto_id; if (k && !vistos.has(k)) vistos.set(k, i.skus.cor_id) })
    return [...vistos].map(([pid, cor]) => ({ produto: prodPorId[pid], cor }))
  }
  const abrirCom = (p, doc = false) => (e) => { e?.stopPropagation(); setDocumento(doc); setAberto(p) }

  const abertos = pedidos.filter((p) => ABERTOS.includes(p.status))
  const paresAbertos = abertos.reduce((t, p) => t + totaisPedido(p).pares, 0)
  const valorAbertos = abertos.reduce((t, p) => t + totaisPedido(p).total, 0)
  const qtdAtrasados = pedidos.filter(atrasado).length
  const contagem = Object.fromEntries(FILTROS.map((f) => [f.id, base.filter(f.teste).length]))

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

      <div className="ped-abas" role="tablist">
        {FILTROS.map((f) => (
          <button key={f.id} role="tab" aria-selected={f.id === filtro} className={`ped-aba ${f.id === filtro ? 'on' : ''} ${f.tom === 'bad' && contagem[f.id] ? 'alerta' : ''}`} onClick={() => setFiltro(f.id)}>
            {f.label}<b>{contagem[f.id]}</b>
          </button>
        ))}
      </div>

      <div className="ped-filtros">
        <label className="search">
          <Icon name="busca" size={16} />
          <span className="sr-only">Buscar pedido</span>
          <input type="search" placeholder="Número, cliente, canal ou vendedora" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <select className="input" value={modalidade} onChange={(e) => setModalidade(e.target.value)} aria-label="Modalidade">
          <option value="">Todas as modalidades</option>
          {MODALIDADES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <select className="input" value={vendedora} onChange={(e) => setVendedora(e.target.value)} aria-label="Vendedora">
          <option value="">Todas as vendedoras</option>
          {vendedoras.map((v) => <option key={v} value={v}>{v === '—' ? 'Sem vendedora' : v}</option>)}
        </select>
        <SeletorPeriodo valor={periodo} onChange={setPeriodo} />
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
            <table className="ped-tabela" style={{ minWidth: 980 }}>
              <thead className="tinted">
                <tr><th>Pedido</th><th>Cliente</th><th>Modelos</th><th>Modalidade</th><th className="r">Pares</th><th className="r">Valor</th><th>Situação</th><th className="r">Previsão</th><th className="r">Ações</th></tr>
              </thead>
              <tbody>
                {carregando && <tr><td colSpan={9} style={{ color: 'var(--muted)', padding: 32 }}>Carregando…</td></tr>}
                {visiveis.map((p) => {
                  const st = STATUS_PEDIDO[p.status]
                  const t = totaisPedido(p)
                  const late = atrasado(p)
                  const fotos = fotosDe(p)
                  const mod = MODALIDADES.find((m) => m.id === modalidadeDoCanal(p.canal))
                  const prog = p.programacoes?.[0]
                  return (
                    <tr key={p.id} className="clickable" onClick={abrirCom(p)}>
                      <td><b>{numeroPedido(p.numero)}</b><small className="ped-sub">{dataBR(p.criado_em)}</small></td>
                      <td>{p.parceiros?.nome || <span style={{ color: 'var(--muted)' }}>Sem cliente</span>}{p.vendedora && <small className="ped-sub">{p.vendedora}</small>}</td>
                      <td>
                        <div className="ped-fotos">
                          {fotos.slice(0, 3).map((f, i) => <FotoProduto key={i} p={f.produto} corId={f.cor} size={30} />)}
                          {fotos.length > 3 && <span className="ped-mais">+{fotos.length - 3}</span>}
                        </div>
                      </td>
                      <td><span className="ped-mod"><i style={{ background: mod?.cor }} />{mod?.label}</span>{p.canal !== mod?.label && <small className="ped-sub">{p.canal}</small>}</td>
                      <td className="r">{inteiro(t.pares)}</td>
                      <td className="r"><b>{brl(t.total)}</b></td>
                      <td>
                        <span className={`pill ${st.tom}`}>{st.label}</span>
                        {late && <span className="pill bad" style={{ marginLeft: 6 }}>Atrasado</span>}
                        {prog && p.status !== 'producao' && ABERTOS.includes(p.status) && <small className="ped-sub">programado</small>}
                        <small className={`ped-sub doc-${p.documento || 'nfe'}`}>{DOCUMENTOS[p.documento || 'nfe']}{['faturado', 'entregue'].includes(p.status) ? (p.nota_emitida ? ` · nota ${p.nota_numero || 'emitida'}` : ' · nota pendente') : ''}</small>
                      </td>
                      <td className="r" style={{ color: late ? 'var(--bad)' : 'var(--muted)', fontWeight: late ? 600 : 400 }}>{dataBR(p.previsao)}</td>
                      <td className="r">
                        <div className="ped-acoes" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="btn btn-sm" title="Visualizar, imprimir, PDF ou enviar no WhatsApp" onClick={abrirCom(p, true)}>Imprimir · Enviar</button>
                          {!FECHADO.includes(p.status) && !p.estoque_baixado && <button type="button" className="btn btn-sm" onClick={() => setCorrigir(p)}>Editar</button>}
                          {['faturado', 'entregue'].includes(p.status) && !p.nota_emitida && (
                            <button type="button" className="btn btn-sm btn-dark" title="Marcar que a nota já foi emitida (UpSeller)"
                              onClick={async () => {
                                const n = window.prompt(`Nota de ${numeroPedido(p.numero)} (${DOCUMENTOS[p.documento || 'nfe']}) emitida. Número da nota (opcional):`, '')
                                if (n === null) return
                                try { await marcarNotaEmitida(p.id, n); await carregar() } catch (e) { alert(e.message) }
                              }}>Nota emitida</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!carregando && pedidos.length > 0 && visiveis.length === 0 && (
                  <tr><td colSpan={9} style={{ color: 'var(--muted)', padding: 32 }}>Nenhum pedido neste filtro.</td></tr>
                )}
              </tbody>
              {visiveis.length > 1 && (
                <tfoot>
                  <tr className="ped-total"><td colSpan={4}>{inteiro(visiveis.length)} pedidos</td><td className="r">{inteiro(somaVis.pares)}</td><td className="r">{brl(somaVis.total)}</td><td colSpan={3} /></tr>
                </tfoot>
              )}
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
          abrirDocumento={documento} onFechar={() => { setAberto(null); setDocumento(false) }} onMudou={depoisDeMudar} onCorrigir={() => setCorrigir(aberto)} />
      )}
      {corrigir && (
        <NovoPedido pedido={corrigir} produtos={produtos} cores={cores} parceiros={parceiros} saldos={saldos}
          onFechar={() => setCorrigir(null)}
          onSalvo={async () => { const id = corrigir.id; setCorrigir(null); const lista = await carregar(); setAberto(lista?.find((p) => p.id === id) || null) }} />
      )}
    </>
  )
}
