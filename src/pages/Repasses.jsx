import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import SeletorPeriodo, { periodoPadrao, resolverPeriodo } from '../components/SeletorPeriodo.jsx'
import { brl, dataBR, inteiro, numeroPedido } from '../lib/format.js'
import { listarPedidos } from '../lib/pedidos.js'
import { criarTitulos, listarTitulos } from '../lib/financeiro.js'
import { MODALIDADES, MODALIDADE } from '../lib/modalidades.js'
import { calcularComissoes, descreverRegra, excluirRegra, listarRegras, salvarRegra } from '../lib/repasses.js'

/*
  Financeiro › Repasses (só o dono: menu escondido + bloqueio no banco)
  Quanto pagar para cada pessoa no período (padrão: este mês), pedido a pedido, e lançar no contas a pagar.
  Regras editáveis no fim da tela.
*/
const CORES = ['#1f6fd6', '#d4537e', '#e8a10c', '#1baf7a', '#6250d6', '#eb6834']
const isoDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function Repasses() {
  const [pedidos, setPedidos] = useState(null)
  const [regras, setRegras] = useState([])
  const [titulos, setTitulos] = useState([])
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const [periodo, setPeriodo] = useState(() => ({ ...periodoPadrao('mes') }))
  const [filtro, setFiltro] = useState('todos')

  const carregar = () => Promise.all([listarPedidos(), listarRegras(), listarTitulos()])
    .then(([p, r, t]) => { setPedidos(p); setRegras(r); setTitulos(t) })
    .catch((e) => setErro(e.message))
  useEffect(() => { carregar() }, [])

  const per = useMemo(() => resolverPeriodo(periodo), [periodo])
  const calc = useMemo(() => (pedidos ? calcularComissoes(pedidos, regras, per) : null), [pedidos, regras, per])

  // cards por pessoa (uma pessoa pode ter mais de uma regra)
  const pessoas = useMemo(() => {
    if (!calc) return []
    const m = {}
    regras.filter((r) => r.ativo).forEach((r, i) => {
      const a = (m[r.beneficiario] ||= { nome: r.beneficiario, cor: CORES[Object.keys(m).length % CORES.length], regras: [], valor: 0, pedidos: 0, pares: 0, base: 0 })
      const x = calc.porRegra[r.id]
      a.regras.push(r); a.valor += x.valor; a.pedidos += x.pedidos; a.pares += x.pares; a.base += x.base
    })
    return Object.values(m)
  }, [calc, regras])
  const corDe = Object.fromEntries(pessoas.map((p) => [p.nome, p.cor]))
  const total = pessoas.reduce((t, p) => t + p.valor, 0)
  const rotuloPer = per.rotulo.split(' · ')[0]
  const descTitulo = (nome) => `Repasse ${nome} · ${rotuloPer}`
  const lancado = (nome) => titulos.find((t) => t.tipo === 'pagar' && t.descricao === descTitulo(nome))

  async function lancar(p) {
    setErro(''); setMsg('')
    const venc = new Date(per.fim); venc.setDate(1); venc.setMonth(venc.getMonth() + 1); venc.setDate(10)
    try {
      await criarTitulos({ tipo: 'pagar', descricao: descTitulo(p.nome), categoria: 'Repasse', observacao: `${p.pedidos} pedidos · ${p.pares} pares · ${p.regras.map(descreverRegra).join(' + ')}`, parcelas: [{ valor: Math.round(p.valor * 100) / 100, vencimento: isoDia(venc), parcela: '1/1' }] })
      setMsg(`Repasse de ${p.nome} lançado no contas a pagar (vence ${dataBR(isoDia(venc))}).`)
      setTitulos(await listarTitulos())
    } catch (e) { setErro(e.message) }
  }

  const regrasDe = (nome) => regras.filter((r) => r.ativo && r.beneficiario === nome).map((r) => r.id)
  const linhas = (calc?.linhas || []).filter((l) => filtro === 'todos' || regrasDe(filtro).some((id) => l.comissoes[id] != null))
    .sort((a, b) => new Date(b.pedido.criado_em) - new Date(a.pedido.criado_em))

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Financeiro · {per.rotulo}</div>
          <h1>Repasses</h1>
        </div>
      </header>

      <div className="ind-filtros card">
        <div className="field"><span>Período</span><SeletorPeriodo valor={periodo} onChange={setPeriodo} /></div>
      </div>

      {erro && <p className="form-error" role="alert">{erro}</p>}
      {msg && <p className="form-ok" role="status">{msg}</p>}
      {!calc && !erro && <p className="card-sub">Carregando…</p>}

      {calc && <>
        <section className="kpis-cor">
          <div className="card kpi-cor" style={{ '--kc': '#151515' }}>
            <span className="kpi-label">Total de repasses</span>
            <span className="kpi2-valor">{brl(total)}</span>
            <span className="kpi-note"><em>{pessoas.length} pessoa(s) · {calc.linhas.length} pedidos</em></span>
          </div>
          {pessoas.map((p) => {
            const ja = lancado(p.nome)
            return (
              <div key={p.nome} className={`card kpi-cor com-card ${filtro === p.nome ? 'on' : ''}`} style={{ '--kc': p.cor }}>
                <button className="com-card-topo" onClick={() => setFiltro(filtro === p.nome ? 'todos' : p.nome)} title="Ver só os pedidos desta pessoa">
                  <span className="kpi-label">{p.nome}</span>
                  <span className="kpi2-valor">{brl(p.valor)}</span>
                  <span className="kpi-note"><em>{p.regras.map(descreverRegra).join(' + ')}</em></span>
                  <span className="kpi-note"><em>{p.pedidos} pedidos · {inteiro(p.pares)} pares · base {brl(p.base)}</em></span>
                </button>
                {ja
                  ? <span className={`com-status ${ja.pago_em ? 'pago' : ''}`}>{ja.pago_em ? `Pago em ${dataBR(ja.pago_em)}` : `Lançado · vence ${dataBR(ja.vencimento)}`}</span>
                  : <button className="btn btn-sm" disabled={p.valor <= 0} onClick={() => lancar(p)}><Icon name="financeiro" size={14} />Lançar no contas a pagar</button>}
              </div>
            )
          })}
        </section>

        <section className="card card-flush">
          <div className="card-head pad">
            <div><h2>Pedidos com repasse</h2><div className="card-sub">{filtro === 'todos' ? 'todas as pessoas' : filtro} · faturados ou entregues · valor com desconto</div></div>
            {filtro !== 'todos' && <button className="link-btn" onClick={() => setFiltro('todos')}>ver todos</button>}
          </div>
          <div className="table-wrap">
            <table>
              <thead className="tinted">
                <tr><th>Pedido</th><th>Data</th><th>Cliente</th><th>Modalidade</th><th>Vendedora</th><th>Polo</th><th className="r">Pares</th><th className="r">Valor</th>
                  {pessoas.map((p) => <th key={p.nome} className="r"><span className="canal-tag"><i style={{ background: p.cor }} />{p.nome}</span></th>)}</tr>
              </thead>
              <tbody>
                {linhas.slice(0, 300).map((l) => (
                  <tr key={l.pedido.id}>
                    <td><b>{numeroPedido(l.pedido.numero)}</b></td>
                    <td className="faint">{dataBR(l.pedido.criado_em.slice(0, 10))}</td>
                    <td>{l.pedido.parceiros?.nome || '—'}</td>
                    <td><span className="canal-tag"><i style={{ background: MODALIDADE[l.modalidade]?.cor }} />{MODALIDADE[l.modalidade]?.label}</span></td>
                    <td>{l.pedido.vendedora || <span className="faint">—</span>}</td>
                    <td>{l.pedido.grupo || <span className="faint">—</span>}</td>
                    <td className="r">{inteiro(l.pares)}</td>
                    <td className="r">{brl(l.total)}</td>
                    {pessoas.map((p) => {
                      const v = p.regras.reduce((s, r) => s + (l.comissoes[r.id] || 0), 0)
                      return <td key={p.nome} className="r">{v ? <b>{brl(v)}</b> : <span className="faint">—</span>}</td>
                    })}
                  </tr>
                ))}
                {linhas.length === 0 && <tr><td colSpan={8 + pessoas.length} className="vazio">Nenhum pedido com repasse no período.</td></tr>}
              </tbody>
              {linhas.length > 0 && (
                <tfoot><tr><td colSpan={6}><b>Total</b></td><td className="r"><b>{inteiro(linhas.reduce((t, l) => t + l.pares, 0))}</b></td><td className="r"><b>{brl(linhas.reduce((t, l) => t + l.total, 0))}</b></td>
                  {pessoas.map((p) => <td key={p.nome} className="r"><b>{brl(linhas.reduce((t, l) => t + p.regras.reduce((s, r) => s + (l.comissoes[r.id] || 0), 0), 0))}</b></td>)}</tr></tfoot>
              )}
            </table>
          </div>
        </section>

        <Regras regras={regras} onMudou={carregar} setErro={setErro} />
      </>}
    </>
  )
}

function Regras({ regras, onMudou, setErro }) {
  const vazia = { beneficiario: '', criterio: 'vendedora', alvo: '', modalidades: ['atacado'], tipo: 'pct', valor: '1', ativo: true }
  const [edit, setEdit] = useState(null) // regra em edição (id ou 'nova')
  const [f, setF] = useState(vazia)
  const abrir = (r) => { setEdit(r ? r.id : 'nova'); setF(r ? { ...r, valor: String(Number(r.valor) * (r.tipo === 'pct' ? 100 : 1)).replace('.', ',') } : vazia) }
  async function salvar() {
    if (!f.beneficiario.trim() || (f.criterio === 'vendedora' ? !(f.modalidades || []).length : !String(f.alvo).trim()) || !(Number(String(f.valor).replace(',', '.')) >= 0)) { setErro('Preencha quem recebe, onde vale e o valor.'); return }
    try { await salvarRegra({ ...f, id: edit === 'nova' ? undefined : edit }); setEdit(null); onMudou() } catch (e) { setErro(e.message) }
  }
  async function alternar(r) { try { await salvarRegra({ ...r, valor: Number(r.valor) * (r.tipo === 'pct' ? 100 : 1), ativo: !r.ativo }); onMudou() } catch (e) { setErro(e.message) } }
  async function excluir(r) { if (!window.confirm(`Excluir a regra de ${r.beneficiario}?`)) return; try { await excluirRegra(r.id); onMudou() } catch (e) { setErro(e.message) } }

  const form = (
    <tr className="com-edit">
      <td><input className="input" value={f.beneficiario} onChange={(e) => setF({ ...f, beneficiario: e.target.value })} placeholder="Quem recebe" /></td>
      <td>
        <div className="com-onde">
          <select className="input" value={f.criterio} onChange={(e) => setF({ ...f, criterio: e.target.value, alvo: e.target.value === 'grupo' ? 'Fartura' : e.target.value === 'modalidade' ? 'atacado' : '', modalidades: f.modalidades?.length ? f.modalidades : ['atacado'] })}>
            <option value="vendedora">Vendedora (o que ela vende)</option><option value="grupo">Polo / grupo</option><option value="modalidade">Toda a modalidade</option>
          </select>
          {f.criterio === 'vendedora' ? (
            <div className="com-mods">{MODALIDADES.map((m) => (
              <label key={m.id} className="check"><input type="checkbox" checked={(f.modalidades || []).includes(m.id)} onChange={(e) => setF({ ...f, modalidades: e.target.checked ? [...(f.modalidades || []), m.id] : (f.modalidades || []).filter((x) => x !== m.id) })} />{m.label}</label>
            ))}</div>
          ) : f.criterio === 'modalidade'
            ? <select className="input" value={f.alvo} onChange={(e) => setF({ ...f, alvo: e.target.value })}>{MODALIDADES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
            : <input className="input" value={f.alvo} onChange={(e) => setF({ ...f, alvo: e.target.value })} placeholder="Fartura" />}
        </div>
      </td>
      <td>
        <div className="com-onde">
          <select className="input" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}><option value="pct">% do faturado</option><option value="par">R$ por par</option></select>
          <input className="input input-sm" inputMode="decimal" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} aria-label="Valor" />
        </div>
      </td>
      <td />
      <td className="r"><div className="row-gap" style={{ justifyContent: 'flex-end' }}><button className="btn btn-sm" onClick={() => setEdit(null)}>Cancelar</button><button className="btn btn-sm btn-dark" onClick={salvar}>Salvar</button></div></td>
    </tr>
  )

  return (
    <section className="card card-flush">
      <div className="card-head pad">
        <div><h2>Regras de repasse</h2><div className="card-sub">Vendedora: ganha nos pedidos em que ela é a vendedora · Polo: pela cliente · regras do mesmo pedido somam · marketplace não paga ninguém.</div></div>
        <button className="btn btn-sm" onClick={() => abrir(null)}><Icon name="mais" size={14} />Nova regra</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead className="tinted"><tr><th>Quem recebe</th><th>Onde vale</th><th>Quanto</th><th>Situação</th><th /></tr></thead>
          <tbody>
            {regras.map((r) => edit === r.id ? <Frag key={r.id}>{form}</Frag> : (
              <tr key={r.id} className={r.ativo ? '' : 'inativa'}>
                <td><b>{r.beneficiario}</b></td>
                <td>{r.criterio === 'vendedora' ? <span className="com-mods-tags">Pedidos dela em {(r.modalidades || []).map((m) => <span key={m} className="canal-tag"><i style={{ background: MODALIDADE[m]?.cor }} />{MODALIDADE[m]?.label || m}</span>)}</span> : r.criterio === 'grupo' ? <>Polo <b>{r.alvo}</b></> : <span className="canal-tag"><i style={{ background: MODALIDADE[r.alvo]?.cor }} />{MODALIDADE[r.alvo]?.label || r.alvo}</span>}</td>
                <td>{r.tipo === 'pct' ? `${(Number(r.valor) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% do faturado` : `${brl(Number(r.valor))} por par`}</td>
                <td><button className={`chip-var ${r.ativo ? 'sobe' : 'neutro'}`} style={{ border: 0, cursor: 'pointer' }} onClick={() => alternar(r)}>{r.ativo ? 'ativa' : 'pausada'}</button></td>
                <td className="r"><div className="row-gap" style={{ justifyContent: 'flex-end' }}><button className="btn btn-sm" onClick={() => abrir(r)}>Editar</button><button className="btn btn-sm btn-perigo" onClick={() => excluir(r)}>Excluir</button></div></td>
              </tr>
            ))}
            {edit === 'nova' && form}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Frag({ children }) { return children }
