import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ProdutoCelula, { FotoProduto } from '../components/FotoProduto.jsx'
import Icon from '../components/Icon.jsx'
import GerarOPs from '../components/GerarOPs.jsx'
import OPDetalhe from '../components/OPDetalhe.jsx'
import OPForm from '../components/OPForm.jsx'
import Programacao from '../components/Programacao.jsx'
import MapasLista from '../components/MapasLista.jsx'
import ProgPalmilhas from '../components/ProgPalmilhas.jsx'
import NovoMapa from '../components/NovoMapa.jsx'
import ImprimirMapa from '../components/ImprimirMapa.jsx'
import { listarMapas } from '../lib/mapas.js'
import { listarParceiros } from '../lib/parceiros.js'
import { listarSaldos, saldoPorSku } from '../lib/estoque.js'
import { dataBR, inteiro } from '../lib/format.js'
import { ABERTOS, listarPedidos } from '../lib/pedidos.js'
import { OP_ABERTAS, STATUS_OP, atrasadaOP, etapaAtual, itensDosPedidosAbertos, listarOPs, listarSetores, numeroOP, paresOP, sugerirOPs } from '../lib/producao.js'
import { listarCores, listarProdutos } from '../lib/produtos.js'

const FILTROS = [
  { id: 'abertas', label: 'Em aberto', teste: (o) => OP_ABERTAS.includes(o.status) },
  { id: 'atrasadas', label: 'Atrasadas', teste: atrasadaOP },
  { id: 'concluidas', label: 'Concluídas', teste: (o) => o.status === 'concluida' },
  { id: 'canceladas', label: 'Canceladas', teste: (o) => o.status === 'cancelada' },
  { id: 'todas', label: 'Todas', teste: () => true },
]
const CEL = { concluida: { cls: 'ok', txt: 'OK' }, em_curso: { cls: 'cur', txt: 'Em curso' }, pendente: { cls: 'pend', txt: '—' } }

export default function Producao({ visao = 'quadro' }) {
  const [novaProg, setNovaProg] = useState(false)
  const [parceirosProg, setParceirosProg] = useState(null)
  const [imprimirProg, setImprimirProg] = useState(null)
  const [versaoMapas, setVersaoMapas] = useState(0)
  const [ops, setOps] = useState([])
  const [setores, setSetores] = useState([])
  const [produtos, setProdutos] = useState([])
  const [cores, setCores] = useState([])
  const [saldos, setSaldos] = useState({})
  const [pedidos, setPedidos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('abertas')
  const [busca, setBusca] = useState('')
  const [nova, setNova] = useState(false)
  const [sugestoes, setSugestoes] = useState(null)
  const [aberta, setAberta] = useState(null)

  async function carregar() {
    try {
      const [o, s, p, c, sa, pe] = await Promise.all([listarOPs(), listarSetores(), listarProdutos(), listarCores(), listarSaldos(), listarPedidos()])
      setOps(o); setSetores(s.filter((x) => x.ativo)); setProdutos(p); setCores(c); setSaldos(saldoPorSku(sa)); setPedidos(pe)
      return o
    } catch (e) { setErro(e.message) } finally { setCarregando(false) }
  }
  useEffect(() => { carregar() }, [])

  async function abrirSugestoes() {
    setErro('')
    try {
      const itens = await itensDosPedidosAbertos()
      setSugestoes(sugerirOPs({ pedidosAbertos: pedidos, itensPedidos: itens, saldos, ops, produtos, cores }))
    } catch (e) { setErro(e.message) }
  }

  async function depoisDeMudar(manter) {
    const lista = await carregar()
    if (manter && aberta && lista) setAberta(lista.find((o) => o.id === aberta.id) || null)
    else setAberta(null)
  }

  const visiveis = useMemo(() => {
    const f = FILTROS.find((x) => x.id === filtro)
    const q = busca.trim().toLowerCase()
    return ops.filter((o) => f.teste(o) &&
      (!q || `${numeroOP(o.numero)} ${o.produtos?.ref} ${o.produtos?.nome} ${o.cores?.nome}`.toLowerCase().includes(q)))
  }, [ops, filtro, busca])

  const abertas = ops.filter((o) => OP_ABERTAS.includes(o.status))
  const paresProd = abertas.reduce((t, o) => t + paresOP(o), 0)
  const atrasadas = ops.filter(atrasadaOP).length
  const semana = Date.now() - 7 * 864e5
  const prontos7 = ops.filter((o) => o.status === 'concluida' && o.concluida_em && new Date(o.concluida_em).getTime() > semana).reduce((t, o) => t + paresOP(o), 0)
  const contagem = Object.fromEntries(FILTROS.map((f) => [f.id, ops.filter(f.teste).length]))

  // carga: pares parados em cada setor (etapa atual das OPs abertas)
  const carga = setores.map((s) => {
    const pares = abertas.filter((o) => etapaAtual(o)?.setor_id === s.id).reduce((t, o) => t + paresOP(o), 0)
    return { ...s, pares }
  })
  const maxCarga = Math.max(1, ...carga.map((c) => c.pares))

  async function abrirProg() {
    if (!parceirosProg) setParceirosProg(await listarParceiros().catch(() => []))
    setNovaProg(true)
  }

  return (
    <>
      {novaProg && <NovoMapa produtos={produtos} cores={cores} parceiros={parceirosProg || []} onFechar={() => setNovaProg(false)}
        onSalvo={async (r) => { setNovaProg(false); await carregar(); setVersaoMapas((v) => v + 1); const m = (await listarMapas()).find((x) => x.id === r.id); if (m) setImprimirProg(m) }} />}
      {imprimirProg && <ImprimirMapa mapa={imprimirProg} inicial="tudo" ops={ops.filter((o) => o.programacao_id === imprimirProg.id)} cores={cores} onFechar={() => setImprimirProg(null)} />}
      <header className="page-head">
        <div>
          <div className="eyebrow">Ordens de produção por grade</div>
          <h1>Produção</h1>
        </div>
        <div className="actions">
          <button className="btn btn-sm" onClick={() => setNova(true)} title="Uma OP solta de um modelo e cor — para reposição ou exceção">OP avulsa</button>
          <button className="btn" onClick={abrirSugestoes}>Gerar dos pedidos</button>
          <button className="btn btn-dark" onClick={abrirProg}><Icon name="mais" size={16} stroke={2} />Nova programação</button>
        </div>
      </header>

      {erro && <p className="form-error" role="alert">{erro}</p>}

      <div className="segmented lojas-abas" role="tablist">
        <Link role="tab" to="/producao" className={`aba-link ${visao === 'quadro' ? 'on' : ''}`}>Quadro de ordens</Link>
        <Link role="tab" to="/producao/mapas" className={`aba-link ${visao === 'mapas' ? 'on' : ''}`}>Mapas e folhas de corte</Link>
        <Link role="tab" to="/producao/palmilhas" className={`aba-link ${visao === 'palmilhas' ? 'on' : ''}`}>Palmilhas</Link>
        <Link role="tab" to="/producao/pcp" className={`aba-link ${visao === 'pcp' ? 'on' : ''}`}>Programação (PCP)</Link>
        <Link role="tab" to="/producao/bipar" className="aba-link">Bipar fichas</Link>
      </div>

      {visao === 'palmilhas' ? <ProgPalmilhas cores={cores} />
        : visao === 'mapas' ? <MapasLista ops={ops} cores={cores} versao={versaoMapas} onNovo={abrirProg} />
        : visao === 'pcp' ? <Programacao ops={ops} setores={setores} onAbrir={setAberta} onMudou={carregar} /> : <>
      <section className="grid-kpi">
        <div className="card kpi"><span className="kpi-label">Ordens em aberto</span><span className="kpi-value">{inteiro(abertas.length)}</span></div>
        <div className="card kpi"><span className="kpi-label">Pares em produção</span><span className="kpi-value">{inteiro(paresProd)}</span></div>
        <div className="card kpi"><span className="kpi-label">Atrasadas</span><span className="kpi-value" style={atrasadas ? { color: 'var(--bad)' } : undefined}>{inteiro(atrasadas)}</span></div>
        <div className="card kpi"><span className="kpi-label">Prontos · 7 dias</span><span className="kpi-value">{inteiro(prontos7)}</span><span className="kpi-note">pares que entraram no estoque</span></div>
      </section>

      {abertas.length > 0 && (
        <section className="card">
          <div className="card-head"><div><h2>Onde está a produção</h2><div className="card-sub">Pares parados em cada setor agora</div></div></div>
          <div className="carga">
            {carga.map((c) => (
              <div key={c.id} className="carga-col">
                <span className="carga-num">{c.pares}</span>
                <div className="carga-bar"><i style={{ height: `${(c.pares / maxCarga) * 100}%` }} /></div>
                <span className="carga-nome">{c.nome}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="actions">
        <label className="search">
          <Icon name="busca" size={16} />
          <span className="sr-only">Buscar OP</span>
          <input type="search" placeholder="Buscar OP, REF, modelo ou cor" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <div className="chips">
          {FILTROS.map((f) => <button key={f.id} className={`chip ${f.id === filtro ? 'on' : ''}`} onClick={() => setFiltro(f.id)}>{f.label} · {contagem[f.id]}</button>)}
        </div>
      </div>

      {!carregando && ops.length === 0 && !erro ? (
        <section className="card empty">
          <span className="alert-num" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', width: 56, height: 56, borderRadius: 14 }}><Icon name="producao" size={24} /></span>
          <h2>Nenhuma ordem de produção ainda</h2>
          <p>Crie uma OP por modelo e cor com a grade, ou gere automaticamente o que falta para atender os pedidos. Ao concluir, os pares entram no estoque sozinhos.</p>
          <div className="actions" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={abrirSugestoes}>Gerar dos pedidos</button>
            <button className="btn btn-dark" onClick={abrirProg}>Nova programação</button>
          </div>
        </section>
      ) : (
        <section className="card card-flush">
          <div className="card-head" style={{ padding: '18px 20px', margin: 0, borderBottom: '1px solid var(--line-soft)' }}>
            <h2>Ordens</h2>
            <div className="legend">
              <span><i style={{ background: 'var(--ink)' }} />Concluído</span>
              <span><i style={{ background: 'var(--accent)' }} />Em curso</span>
              <span><i style={{ background: 'var(--bad)' }} />Atrasado</span>
              <span><i style={{ background: '#fff', border: '1px solid #CFCCC6' }} />Pendente</span>
            </div>
          </div>
          <div className="table-wrap">
            <table style={{ minWidth: 300 + setores.length * 96 }}>
              <thead className="tinted">
                <tr>
                  <th>Ordem · modelo</th>
                  <th className="r">Pares</th>
                  {setores.map((s) => <th key={s.id} className="c">{s.nome}</th>)}
                  <th className="r">Prazo</th>
                </tr>
              </thead>
              <tbody>
                {carregando && <tr><td colSpan={setores.length + 3} style={{ color: 'var(--muted)', padding: 32 }}>Carregando…</td></tr>}
                {visiveis.map((o) => {
                  const late = atrasadaOP(o)
                  const atual = etapaAtual(o)
                  const st = STATUS_OP[o.status]
                  return (
                    <tr key={o.id} className="clickable" onClick={() => setAberta(o)} style={o.status === 'cancelada' ? { opacity: 0.5 } : undefined}>
                      <td>
                        <div className="prod-cell">
                          <FotoProduto p={o.produtos} corId={o.cor_id} className="sm" size={18} />
                          <div>
                            <b>{numeroOP(o.numero)} · {o.produtos?.ref} {o.produtos?.nome}</b>
                            {o.prioridade === 'urgente' && <span className="pill bad" style={{ marginLeft: 6 }}>Urgente</span>}
                            <span><i className="dot-cor" style={{ background: o.cores?.hex || '#ddd' }} />{o.cores?.nome}{o.pedidos ? ` · PV-${String(o.pedidos.numero).padStart(4, '0')}` : ' · estoque'}{!OP_ABERTAS.includes(o.status) ? ` · ${st.label}` : ''}</span>
                          </div>
                        </div>
                      </td>
                      <td className="r"><b style={{ fontWeight: 600 }}>{paresOP(o)}</b></td>
                      {setores.map((s) => {
                        const e = o.op_etapas.find((x) => x.setor_id === s.id)
                        if (!e) return <td key={s.id} className="c" style={{ color: 'var(--line)' }}>·</td>
                        const atrasoAqui = late && atual?.id === e.id
                        const c = atrasoAqui ? { cls: 'late', txt: 'Atrasado' } : CEL[e.status]
                        return <td key={s.id}><div className={`step ${c.cls}`} title={`${s.nome}: ${c.txt}`}>{c.txt}</div></td>
                      })}
                      <td className="r" style={{ fontWeight: 600, color: late ? 'var(--bad)' : 'var(--ink)' }}>{o.prazo ? dataBR(o.prazo) : '—'}</td>
                    </tr>
                  )
                })}
                {!carregando && ops.length > 0 && visiveis.length === 0 && (
                  <tr><td colSpan={setores.length + 3} style={{ color: 'var(--muted)', padding: 32 }}>Nenhuma ordem neste filtro.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p className="footnote">Os setores são editáveis em Configurações. Concluir a OP lança os pares no estoque e baixa os materiais da ficha de consumo.</p>
      </>}

      {nova && (
        <OPForm produtos={produtos} cores={cores} saldos={saldos} pedidosAbertos={pedidos.filter((p) => ABERTOS.includes(p.status))}
          onFechar={() => setNova(false)} onSalvo={() => { setNova(false); setFiltro('abertas'); carregar() }} />
      )}
      {sugestoes && (
        <GerarOPs sugestoes={sugestoes} onFechar={() => setSugestoes(null)} onSalvo={() => { setSugestoes(null); setFiltro('abertas'); carregar() }} />
      )}
      {aberta && <OPDetalhe op={aberta} setores={setores} onFechar={() => setAberta(null)} onMudou={depoisDeMudar} />}
    </>
  )
}
