import { useEffect, useMemo, useState } from 'react'
import { listarSaldos } from '../lib/estoque.js'
import { listarTitulos } from '../lib/financeiro.js'
import { brl, brlCurto, inteiro } from '../lib/format.js'
import { totaisPedido, listarPedidos } from '../lib/pedidos.js'
import { listarOPs, listarSetores, paresOP } from '../lib/producao.js'
import { listarProdutos } from '../lib/produtos.js'

const PERIODOS = [
  { id: 'mes', label: 'Este mês' }, { id: '30', label: '30 dias' }, { id: '90', label: '90 dias' },
  { id: 'ano', label: 'Este ano' }, { id: 'tudo', label: 'Tudo' },
]
function inicioPeriodo(id) {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  if (id === 'mes') return new Date(d.getFullYear(), d.getMonth(), 1)
  if (id === 'ano') return new Date(d.getFullYear(), 0, 1)
  if (id === 'tudo') return new Date(2000, 0, 1)
  d.setDate(d.getDate() - Number(id)); return d
}

function Barras({ itens, fmt = inteiro, vazio = 'Sem dados no período.' }) {
  if (!itens.length) return <p className="card-sub" style={{ margin: 0 }}>{vazio}</p>
  const max = Math.max(...itens.map((i) => i.valor), 1)
  return (
    <div className="barras-h">
      {itens.map((i) => (
        <div key={i.rotulo} className="barra-h">
          <span className="barra-rot" title={i.rotulo}>{i.rotulo}</span>
          <div className="barra-trilho"><i style={{ width: `${(i.valor / max) * 100}%`, background: i.cor || undefined }} /></div>
          <span className="barra-val">{fmt(i.valor)}{i.extra ? <small> {i.extra}</small> : null}</span>
        </div>
      ))}
    </div>
  )
}

export default function Relatorios() {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [periodo, setPeriodo] = useState('mes')

  useEffect(() => {
    Promise.all([listarPedidos(), listarProdutos(), listarSaldos(), listarOPs(), listarSetores(), listarTitulos()])
      .then(([pedidos, produtos, saldos, ops, setores, titulos]) => setDados({ pedidos, produtos, saldos, ops, setores, titulos }))
      .catch((e) => setErro(e.message))
  }, [])

  const r = useMemo(() => {
    if (!dados) return null
    const ini = inicioPeriodo(periodo)
    const dentro = (iso) => iso && new Date(iso.length === 10 ? `${iso}T12:00:00` : iso) >= ini
    const { pedidos, produtos, saldos, ops, setores, titulos } = dados
    const skuProd = {}
    produtos.forEach((p) => p.skus.forEach((s) => { skuProd[s.id] = p }))

    const vendidos = pedidos.filter((p) => ['faturado', 'entregue'].includes(p.status) && dentro(p.criado_em))
    let fat = 0, pares = 0
    const canal = {}, modelo = {}, cliente = {}, tipo = {}, skusVendidos = new Set()
    vendidos.forEach((p) => {
      const t = totaisPedido(p)
      fat += t.total; pares += t.pares
      ;(canal[p.canal] ||= { v: 0, p: 0 }).v += t.total; canal[p.canal].p += t.pares
      const nomeCli = p.parceiros?.nome || 'Sem cliente'
      ;(cliente[nomeCli] ||= { v: 0, p: 0 }).v += t.total; cliente[nomeCli].p += t.pares
      const fatorDesc = t.bruto ? t.total / t.bruto : 1
      p.pedido_itens.forEach((i) => {
        skusVendidos.add(i.sku_id)
        const pr = skuProd[i.sku_id]; if (!pr) return
        const v = i.quantidade * Number(i.preco_unit) * fatorDesc
        const km = `${pr.ref} · ${pr.nome}`
        ;(modelo[km] ||= { v: 0, p: 0 }).v += v; modelo[km].p += i.quantidade
        ;(tipo[pr.tipo || 'Outros'] ||= { v: 0, p: 0 }).v += v; tipo[pr.tipo || 'Outros'].p += i.quantidade
      })
    })
    const ordena = (o) => Object.entries(o).map(([rotulo, x]) => ({ rotulo, valor: x.v, pares: x.p })).sort((a, b) => b.valor - a.valor)

    // curva ABC por valor
    const modelos = ordena(modelo)
    let acum = 0
    const abc = { A: 0, B: 0, C: 0 }
    modelos.forEach((m) => { const antes = fat ? acum / fat : 0; acum += m.valor; m.classe = antes < 0.8 ? 'A' : antes < 0.95 ? 'B' : 'C'; abc[m.classe]++ })

    // estoque
    let paresEst = 0, valorEst = 0
    const parado = {}
    saldos.forEach((s) => {
      if (s.saldo <= 0) return
      const pr = skuProd[s.sku_id]
      paresEst += s.saldo
      valorEst += s.saldo * Number(pr?.preco_atacado || 0)
      if (!skusVendidos.has(s.sku_id) && pr) { const k = `${pr.ref} · ${pr.nome}`; parado[k] = (parado[k] || 0) + s.saldo }
    })
    const paradoLista = Object.entries(parado).map(([rotulo, valor]) => ({ rotulo, valor })).sort((a, b) => b.valor - a.valor)

    // produção
    const concluidas = ops.filter((o) => o.status === 'concluida' && dentro(o.concluida_em))
    const paresProd = concluidas.reduce((t, o) => t + paresOP(o), 0)
    const leads = concluidas.map((o) => (new Date(o.concluida_em) - new Date(o.criado_em)) / 864e5)
    const leadMedio = leads.length ? leads.reduce((a, b) => a + b, 0) / leads.length : 0
    const perdaSetor = {}
    ops.forEach((o) => o.op_etapas.forEach((e) => { if (e.qtd_perda && dentro(e.fim)) perdaSetor[e.setor_id] = (perdaSetor[e.setor_id] || 0) + e.qtd_perda }))
    const nomeSetor = Object.fromEntries(setores.map((s) => [s.id, s.nome]))
    const perdas = Object.entries(perdaSetor).map(([id, valor]) => ({ rotulo: nomeSetor[id] || '—', valor })).sort((a, b) => b.valor - a.valor)
    const totalPerda = perdas.reduce((t, p) => t + p.valor, 0)

    // financeiro
    const recebido = titulos.filter((t) => t.tipo === 'receber' && t.pago_em && dentro(t.pago_em)).reduce((s, t) => s + Number(t.valor_pago ?? t.valor), 0)
    const pago = titulos.filter((t) => t.tipo === 'pagar' && t.pago_em && dentro(t.pago_em)).reduce((s, t) => s + Number(t.valor_pago ?? t.valor), 0)
    const despCat = {}
    titulos.filter((t) => t.tipo === 'pagar' && t.pago_em && dentro(t.pago_em)).forEach((t) => { const k = t.categoria || 'Outros'; despCat[k] = (despCat[k] || 0) + Number(t.valor_pago ?? t.valor) })

    return {
      fat, pares, pedidos: vendidos.length, ticket: vendidos.length ? fat / vendidos.length : 0, precoPar: pares ? fat / pares : 0,
      canais: ordena(canal), modelos, clientes: ordena(cliente).slice(0, 10), tipos: ordena(tipo), abc,
      paresEst, valorEst, parado: paradoLista.slice(0, 10), paradoTotal: paradoLista.reduce((t, x) => t + x.valor, 0),
      paresProd, opsConc: concluidas.length, leadMedio, perdas, totalPerda,
      recebido, pago, despesas: Object.entries(despCat).map(([rotulo, valor]) => ({ rotulo, valor })).sort((a, b) => b.valor - a.valor),
    }
  }, [dados, periodo])

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Vendas, estoque, produção e caixa</div>
          <h1>Relatórios</h1>
        </div>
        <div className="segmented">
          {PERIODOS.map((p) => <button key={p.id} className={periodo === p.id ? 'on' : ''} onClick={() => setPeriodo(p.id)}>{p.label}</button>)}
        </div>
      </header>

      {erro && <p className="form-error" role="alert">{erro}</p>}
      {!r && !erro && <p className="card-sub">Carregando…</p>}

      {r && (
        <>
          <section className="grid-kpi">
            <div className="card kpi"><span className="kpi-label">Faturado</span><span className="kpi-value">{brlCurto(r.fat)}</span><span className="kpi-note">{r.pedidos} {r.pedidos === 1 ? 'pedido' : 'pedidos'}</span></div>
            <div className="card kpi"><span className="kpi-label">Pares vendidos</span><span className="kpi-value">{inteiro(r.pares)}</span><span className="kpi-note">preço médio {brl(r.precoPar)}/par</span></div>
            <div className="card kpi"><span className="kpi-label">Ticket médio</span><span className="kpi-value">{brlCurto(r.ticket)}</span><span className="kpi-note">por pedido</span></div>
            <div className="card kpi"><span className="kpi-label">Estoque a preço de atacado</span><span className="kpi-value">{brlCurto(r.valorEst)}</span><span className="kpi-note">{inteiro(r.paresEst)} pares</span></div>
          </section>

          <section className="grid-2">
            <div className="card"><div className="card-head"><h2>Vendas por canal</h2></div>
              <Barras itens={r.canais.map((c) => ({ ...c, extra: `· ${c.pares} pares` }))} fmt={brlCurto} /></div>
            <div className="card"><div className="card-head"><h2>Vendas por tipo</h2></div>
              <Barras itens={r.tipos.map((c) => ({ ...c, extra: `· ${c.pares} pares` }))} fmt={brlCurto} /></div>
          </section>

          <section className="card">
            <div className="card-head">
              <div><h2>Modelos mais vendidos · curva ABC</h2><div className="card-sub">A = 80% do faturamento · B = próximos 15% · C = restante</div></div>
              <div className="chips"><span className="pill ok">A · {r.abc.A}</span><span className="pill info">B · {r.abc.B}</span><span className="pill neutral">C · {r.abc.C}</span></div>
            </div>
            {r.modelos.length === 0 ? <p className="card-sub" style={{ margin: 0 }}>Sem vendas faturadas no período.</p> : (
              <div className="table-wrap">
                <table style={{ minWidth: 520 }}>
                  <thead><tr><th>#</th><th>Modelo</th><th className="r">Pares</th><th className="r">Faturado</th><th className="r">%</th><th>Classe</th></tr></thead>
                  <tbody>
                    {r.modelos.slice(0, 20).map((m, i) => (
                      <tr key={m.rotulo}>
                        <td style={{ color: 'var(--muted)' }}>{i + 1}</td><td><b style={{ fontWeight: 600 }}>{m.rotulo}</b></td>
                        <td className="r">{m.pares}</td><td className="r">{brl(m.valor)}</td>
                        <td className="r" style={{ color: 'var(--muted)' }}>{r.fat ? ((m.valor / r.fat) * 100).toFixed(1).replace('.', ',') : 0}%</td>
                        <td><span className={`pill ${m.classe === 'A' ? 'ok' : m.classe === 'B' ? 'info' : 'neutral'}`}>{m.classe}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="grid-2">
            <div className="card"><div className="card-head"><h2>Maiores clientes</h2></div>
              <Barras itens={r.clientes.map((c) => ({ ...c, extra: `· ${c.pares} pares` }))} fmt={brlCurto} /></div>
            <div className="card"><div className="card-head"><div><h2>Estoque parado</h2><div className="card-sub">Pares em estoque sem venda no período · {inteiro(r.paradoTotal)} pares</div></div></div>
              <Barras itens={r.parado.map((p) => ({ ...p, cor: 'var(--accent)' }))} vazio="Nenhum estoque parado." /></div>
          </section>

          <section className="grid-2">
            <div className="card">
              <div className="card-head"><h2>Produção</h2></div>
              <dl className="dados">
                <dt>Pares produzidos</dt><dd><b>{inteiro(r.paresProd)}</b> em {r.opsConc} OPs</dd>
                <dt>Tempo médio</dt><dd>{r.opsConc ? `${r.leadMedio.toFixed(1).replace('.', ',')} dias da abertura à conclusão` : '—'}</dd>
                <dt>Perdas</dt><dd>{r.totalPerda ? `${r.totalPerda} pares (${r.paresProd ? ((r.totalPerda / (r.paresProd + r.totalPerda)) * 100).toFixed(1).replace('.', ',') : 0}%)` : 'nenhuma registrada'}</dd>
              </dl>
              {r.perdas.length > 0 && <><div className="divisor" style={{ margin: '14px 0 10px' }}><span>Perdas por setor</span></div><Barras itens={r.perdas.map((p) => ({ ...p, cor: 'var(--bad)' }))} /></>}
            </div>
            <div className="card">
              <div className="card-head"><h2>Caixa no período</h2></div>
              <dl className="dados">
                <dt>Recebido</dt><dd style={{ color: 'var(--ok)', fontWeight: 600 }}>{brl(r.recebido)}</dd>
                <dt>Pago</dt><dd style={{ color: 'var(--bad)', fontWeight: 600 }}>{brl(r.pago)}</dd>
                <dt>Resultado</dt><dd style={{ fontWeight: 700 }}>{brl(r.recebido - r.pago)}</dd>
              </dl>
              {r.despesas.length > 0 && <><div className="divisor" style={{ margin: '14px 0 10px' }}><span>Despesas por categoria</span></div><Barras itens={r.despesas.map((p) => ({ ...p, cor: 'var(--ink-2)' }))} fmt={brlCurto} /></>}
            </div>
          </section>
          <p className="footnote">Vendas = pedidos faturados ou entregues, pela data do pedido. Caixa = lançamentos baixados no Financeiro.</p>
        </>
      )}
    </>
  )
}
