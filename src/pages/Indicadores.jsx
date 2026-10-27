import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { FotoProduto } from '../components/FotoProduto.jsx'
import { brl, brlCurto, dataBR, inteiro } from '../lib/format.js'
import { listarPedidos, totaisPedido } from '../lib/pedidos.js'
import { listarProdutos } from '../lib/produtos.js'

/*
  Indicadores (BI interno). Aba Vendas: pedidos faturados ou entregues, pela data do pedido.
  Filtros valem para tudo na tela; clicar num canal filtra por ele.
*/
const ABAS = [
  { id: 'vendas', label: 'Vendas' },
  { id: 'margem', label: 'Produtos e margem', breve: true },
  { id: 'producao', label: 'Produção', breve: true },
  { id: 'estoque', label: 'Estoque', breve: true },
  { id: 'financeiro', label: 'Financeiro', breve: true },
]
const PERIODOS = [
  { id: 'mes', label: 'Este mês' }, { id: '30', label: '30 dias' }, { id: '90', label: '3 meses' },
  { id: '180', label: '6 meses' }, { id: '365', label: '12 meses' }, { id: 'ano', label: 'Este ano' },
]
const VENDIDO = ['faturado', 'entregue']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const dd = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`

function intervalo(id) {
  const agora = new Date()
  const fim = new Date(agora); fim.setHours(23, 59, 59, 999)
  let ini
  if (id === 'mes') ini = new Date(agora.getFullYear(), agora.getMonth(), 1)
  else if (id === 'ano') ini = new Date(agora.getFullYear(), 0, 1)
  else { ini = new Date(agora); ini.setHours(0, 0, 0, 0); ini.setDate(ini.getDate() - Number(id) + 1) }
  const dur = fim - ini
  return { ini, fim, antIni: new Date(ini - dur - 1), antFim: new Date(ini - 1) }
}

// barras: por semana até ~3 meses, por mês acima disso
function baldes(ini, fim) {
  const dias = (fim - ini) / 864e5
  const out = []
  if (dias <= 100) {
    const x = new Date(ini); x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
    while (x <= fim) { const f = new Date(x); f.setDate(f.getDate() + 7); out.push({ ini: new Date(x), fim: f, rotulo: dd(x), titulo: `Semana de ${dd(x)}` }); x.setDate(x.getDate() + 7) }
  } else {
    const x = new Date(ini.getFullYear(), ini.getMonth(), 1)
    while (x <= fim) { const f = new Date(x.getFullYear(), x.getMonth() + 1, 1); out.push({ ini: new Date(x), fim: f, rotulo: MESES[x.getMonth()], titulo: `${MESES[x.getMonth()]}/${x.getFullYear()}` }); x.setMonth(x.getMonth() + 1) }
  }
  return out.map((b) => ({ ...b, valor: 0, pares: 0, pedidos: 0 }))
}

function baixarCsv(nome, linhas) {
  const esc = (v) => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const csv = '﻿' + linhas.map((l) => l.map(esc).join(';')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
const num2 = (v) => Number(v || 0).toFixed(2).replace('.', ',')

export default function Indicadores() {
  const [pedidos, setPedidos] = useState([])
  const [produtos, setProdutos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState('vendas')
  const [periodo, setPeriodo] = useState('90')
  const [canal, setCanal] = useState('Todos')
  const [tipo, setTipo] = useState('Todos')
  const [medida, setMedida] = useState('valor')

  useEffect(() => {
    Promise.all([listarPedidos(), listarProdutos()])
      .then(([pe, pr]) => { setPedidos(pe); setProdutos(pr) })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [])

  const skuInfo = useMemo(() => {
    const m = {}
    produtos.forEach((p) => p.skus.forEach((s) => { m[s.id] = { produto: p, cor_id: s.cor_id } }))
    return m
  }, [produtos])
  const canais = useMemo(() => ['Todos', ...new Set(pedidos.map((p) => p.canal).filter(Boolean))], [pedidos])
  const tipos = useMemo(() => ['Todos', ...new Set(produtos.map((p) => p.tipo).filter(Boolean))], [produtos])

  const r = useMemo(() => {
    const { ini, fim, antIni, antFim } = intervalo(periodo)
    // pedido entra se for vendido, do canal, e (com filtro de tipo) só os itens daquele tipo contam
    const linhasDe = (p) => (p.pedido_itens || []).filter((i) => tipo === 'Todos' || skuInfo[i.sku_id]?.produto.tipo === tipo)
    const valorDe = (p, its) => {
      const bruto = its.reduce((t, i) => t + i.quantidade * Number(i.preco_unit), 0)
      const todo = totaisPedido(p)
      return todo.bruto ? bruto * (todo.total / todo.bruto) : 0 // desconto do pedido rateado
    }
    const vendidos = pedidos
      .filter((p) => VENDIDO.includes(p.status) && (canal === 'Todos' || p.canal === canal))
      .map((p) => { const its = linhasDe(p); return { p, its, d: new Date(p.criado_em), valor: valorDe(p, its), pares: its.reduce((t, i) => t + i.quantidade, 0) } })
      .filter((x) => x.its.length)
    const atual = vendidos.filter((x) => x.d >= ini && x.d <= fim)
    const anterior = vendidos.filter((x) => x.d >= antIni && x.d <= antFim)
    const tot = (l) => ({ valor: l.reduce((t, x) => t + x.valor, 0), pares: l.reduce((t, x) => t + x.pares, 0), pedidos: l.length })
    const a = tot(atual), b = tot(anterior)
    const varPct = (x, y) => (y > 0 ? (x - y) / y : null)

    const bs = baldes(ini, fim)
    atual.forEach((x) => { const alvo = bs.find((k) => x.d >= k.ini && x.d < k.fim); if (alvo) { alvo.valor += x.valor; alvo.pares += x.pares; alvo.pedidos += 1 } })

    const porCanal = {}
    // canais ignoram o filtro de canal (para comparar), mas respeitam período e tipo
    pedidos.filter((p) => VENDIDO.includes(p.status)).forEach((p) => {
      const d = new Date(p.criado_em); if (d < ini || d > fim) return
      const its = linhasDe(p); if (!its.length) return
      const c = (porCanal[p.canal || 'Sem canal'] ||= { canal: p.canal || 'Sem canal', valor: 0, pares: 0, pedidos: 0 })
      c.valor += valorDe(p, its); c.pares += its.reduce((t, i) => t + i.quantidade, 0); c.pedidos += 1
    })
    const totCanais = Object.values(porCanal).reduce((t, c) => t + c.valor, 0)

    const porModelo = {}, porCliente = {}
    atual.forEach((x) => {
      const fator = x.its.reduce((t, i) => t + i.quantidade * Number(i.preco_unit), 0)
      x.its.forEach((i) => {
        const info = skuInfo[i.sku_id]; if (!info) return
        const m = (porModelo[info.produto.id] ||= { produto: info.produto, pares: 0, valor: 0, pedidos: new Set() })
        m.pares += i.quantidade; m.valor += fator ? x.valor * (i.quantidade * Number(i.preco_unit)) / fator : 0; m.pedidos.add(x.p.id)
      })
      const nome = x.p.parceiros?.nome || 'Sem cliente'
      const c = (porCliente[nome] ||= { nome, pedidos: 0, pares: 0, valor: 0, ultimo: x.d, canal: x.p.canal })
      c.pedidos += 1; c.pares += x.pares; c.valor += x.valor; if (x.d > c.ultimo) c.ultimo = x.d
    })
    const modelos = Object.values(porModelo).sort((m1, m2) => m2.pares - m1.pares)
    const totParesModelos = modelos.reduce((t, m) => t + m.pares, 0)

    return {
      ini, fim, a, b, atual,
      varValor: varPct(a.valor, b.valor), varPares: varPct(a.pares, b.pares), varPedidos: varPct(a.pedidos, b.pedidos),
      ticket: a.pedidos ? a.valor / a.pedidos : 0, ticketAnt: b.pedidos ? b.valor / b.pedidos : 0,
      precoPar: a.pares ? a.valor / a.pares : 0, precoParAnt: b.pares ? b.valor / b.pares : 0,
      bs, max: Math.max(1, ...bs.map((k) => k[medida])),
      canais: Object.values(porCanal).sort((c1, c2) => c2.valor - c1.valor).map((c) => ({ ...c, pct: totCanais ? c.valor / totCanais : 0 })),
      modelos: modelos.slice(0, 10).map((m) => ({ ...m, pct: totParesModelos ? m.pares / totParesModelos : 0, pedidos: m.pedidos.size })),
      nModelos: modelos.length,
      clientes: Object.values(porCliente).sort((c1, c2) => c2.valor - c1.valor).slice(0, 10),
    }
  }, [pedidos, skuInfo, periodo, canal, tipo, medida])

  const fmtMedida = (v) => (medida === 'valor' ? brlCurto(v) : `${inteiro(v)} pares`)
  const descPeriodo = `${dataBR(r.ini.toISOString().slice(0, 10))} a ${dataBR(r.fim.toISOString().slice(0, 10))}`

  function exportar() {
    const linhas = [['Pedido', 'Data', 'Canal', 'Cliente', 'Situação', 'REF', 'Modelo', 'Tipo', 'Pares', 'Preço unit.', 'Valor (com desconto rateado)']]
    r.atual.forEach((x) => {
      const fator = x.its.reduce((t, i) => t + i.quantidade * Number(i.preco_unit), 0)
      x.its.forEach((i) => {
        const pr = skuInfo[i.sku_id]?.produto
        linhas.push([x.p.numero, dataBR(x.p.criado_em.slice(0, 10)), x.p.canal, x.p.parceiros?.nome || '', x.p.status, pr?.ref, pr?.nome, pr?.tipo, i.quantidade, num2(i.preco_unit), num2(fator ? x.valor * (i.quantidade * Number(i.preco_unit)) / fator : 0)])
      })
    })
    baixarCsv(`vendas-${periodo}-${new Date().toISOString().slice(0, 10)}.csv`, linhas)
  }

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Relatórios · {descPeriodo}</div>
          <h1>Indicadores</h1>
        </div>
        <div className="actions">
          <button className="btn" onClick={exportar} disabled={!r.atual.length}><Icon name="relatorios" size={16} />Exportar vendas (Excel)</button>
        </div>
      </header>

      <div className="segmented lojas-abas" role="tablist">
        {ABAS.map((x) => (
          <button key={x.id} role="tab" className={aba === x.id ? 'on' : ''} disabled={x.breve} title={x.breve ? 'Próxima etapa' : undefined} onClick={() => setAba(x.id)}>
            {x.label}{x.breve && <small className="aba-breve">em breve</small>}
          </button>
        ))}
      </div>

      <div className="ind-filtros card">
        <label className="field"><span>Período</span>
          <select className="input" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>{PERIODOS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        </label>
        <label className="field"><span>Canal</span>
          <select className="input" value={canal} onChange={(e) => setCanal(e.target.value)}>{canais.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label className="field"><span>Tipo de produto</span>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>{tipos.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
        {(canal !== 'Todos' || tipo !== 'Todos') && <button className="link-btn" onClick={() => { setCanal('Todos'); setTipo('Todos') }}>limpar filtros</button>}
      </div>

      {erro && <p className="form-error" role="alert">Não consegui ler o banco: {erro}</p>}

      <section className="painel-kpis">
        <KpiInd rotulo="Faturamento" valor={brl(r.a.valor)} v={r.varValor} />
        <KpiInd rotulo="Pares vendidos" valor={inteiro(r.a.pares)} v={r.varPares} />
        <KpiInd rotulo="Pedidos" valor={inteiro(r.a.pedidos)} v={r.varPedidos} />
        <KpiInd rotulo="Ticket médio" valor={brl(r.ticket)} v={r.ticketAnt ? (r.ticket - r.ticketAnt) / r.ticketAnt : null} nota="por pedido" />
        <KpiInd rotulo="Preço médio do par" valor={brl(r.precoPar)} v={r.precoParAnt ? (r.precoPar - r.precoParAnt) / r.precoParAnt : null} />
      </section>

      <section className="painel-linha">
        <div className="card card-grafico">
          <div className="card-head">
            <div><h2>Evolução das vendas</h2><div className="card-sub">por {r.bs.length && (r.fim - r.ini) / 864e5 <= 100 ? 'semana' : 'mês'}{canal !== 'Todos' ? ` · ${canal}` : ''}{tipo !== 'Todos' ? ` · ${tipo}` : ''}</div></div>
            <div className="segmented" role="group" aria-label="Medida">
              <button className={medida === 'valor' ? 'on' : ''} onClick={() => setMedida('valor')}>R$</button>
              <button className={medida === 'pares' ? 'on' : ''} onClick={() => setMedida('pares')}>Pares</button>
            </div>
          </div>
          <div className="vbars" role="img" aria-label="Evolução das vendas">
            {r.bs.map((k, i) => {
              const v = k[medida]; const ultimo = i === r.bs.length - 1
              return (
                <div className="vbar-col" key={i} tabIndex={0}>
                  <span className="vbar-tip"><b>{k.titulo}</b>{brl(k.valor)} · {inteiro(k.pares)} pares · {k.pedidos} pedidos</span>
                  {(ultimo || v === r.max) && v > 0 && r.bs.length <= 14 && <span className="vbar-val">{fmtMedida(v)}</span>}
                  <div className={`vbar ${ultimo ? 'ultimo' : ''}`} style={{ height: `${(v / r.max) * 100}%` }} />
                </div>
              )
            })}
            {!carregando && r.a.pedidos === 0 && <div className="bars-vazio">Sem vendas faturadas com esses filtros.</div>}
          </div>
          <div className="vbar-rotulos">{r.bs.map((k, i) => <span key={i}>{r.bs.length > 14 && i % 2 ? '' : k.rotulo}</span>)}</div>
        </div>

        <div className="card">
          <div className="card-head"><div><h2>Por canal</h2><div className="card-sub">clique para filtrar</div></div></div>
          <div className="canais-lista">
            {r.canais.length === 0 && <p className="card-sub" style={{ margin: 0 }}>Sem vendas no período.</p>}
            {r.canais.map((c) => (
              <button key={c.canal} className={`canal-linha canal-btn ${canal === c.canal ? 'on' : ''}`} onClick={() => setCanal(canal === c.canal ? 'Todos' : c.canal)}>
                <div className="canal-topo"><b>{c.canal}</b><span>{brlCurto(c.valor)} <em>{Math.round(c.pct * 100)}%</em></span></div>
                <div className="meter"><i style={{ width: `${(c.valor / r.canais[0].valor) * 100}%` }} /></div>
                <small>{c.pedidos} pedidos · {inteiro(c.pares)} pares · ticket {brl(c.valor / c.pedidos)}</small>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="painel-linha metade">
        <div className="card card-flush">
          <div className="card-head pad"><div><h2>Modelos mais vendidos</h2><div className="card-sub">{r.nModelos} modelos vendidos no período · por pares</div></div></div>
          <div className="table-wrap">
            <table>
              <thead className="tinted"><tr><th>#</th><th>Modelo</th><th className="r">Pares</th><th className="r">Faturamento</th><th className="r">Part.</th></tr></thead>
              <tbody>
                {r.modelos.map((m, i) => (
                  <tr key={m.produto.id}>
                    <td className="faint">{i + 1}</td>
                    <td><div className="prod-cell"><FotoProduto p={m.produto} size={34} /><div><b>{m.produto.ref}</b><span>{m.produto.nome}</span></div></div></td>
                    <td className="r"><b>{inteiro(m.pares)}</b></td>
                    <td className="r">{brl(m.valor)}</td>
                    <td className="r"><span className="part"><i style={{ width: `${m.pct * 100}%` }} /></span>{Math.round(m.pct * 100)}%</td>
                  </tr>
                ))}
                {r.modelos.length === 0 && <tr><td colSpan={5} className="vazio">Sem vendas no período.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card card-flush">
          <div className="card-head pad"><div><h2>Melhores clientes</h2><div className="card-sub">por faturamento</div></div></div>
          <div className="table-wrap">
            <table>
              <thead className="tinted"><tr><th>Cliente</th><th className="r">Pedidos</th><th className="r">Pares</th><th className="r">Faturamento</th><th className="r">Último</th></tr></thead>
              <tbody>
                {r.clientes.map((c) => (
                  <tr key={c.nome}>
                    <td><b>{c.nome}</b><br /><span className="card-sub">{c.canal}</span></td>
                    <td className="r">{c.pedidos}</td>
                    <td className="r">{inteiro(c.pares)}</td>
                    <td className="r"><b>{brl(c.valor)}</b></td>
                    <td className="r faint">{dataBR(c.ultimo.toISOString().slice(0, 10))}</td>
                  </tr>
                ))}
                {r.clientes.length === 0 && <tr><td colSpan={5} className="vazio">Sem vendas no período.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <p className="card-sub" style={{ margin: 0 }}>Vendas = pedidos faturados ou entregues, pela data do pedido. Setas comparam com o período anterior de mesmo tamanho. Desconto do pedido rateado entre os itens.</p>
    </>
  )
}

function KpiInd({ rotulo, valor, v, nota }) {
  return (
    <div className="card kpi2">
      <span className="kpi-label">{rotulo}</span>
      <span className="kpi2-valor">{valor}</span>
      <span className="kpi-note">
        {v != null ? <span className={v >= 0 ? 'sobe' : 'desce'}>{v >= 0 ? '↑' : '↓'} {Math.abs(Math.round(v * 100))}%</span> : <span className="faint">sem base</span>}
        <em> vs. período anterior{nota ? ` · ${nota}` : ''}</em>
      </span>
    </div>
  )
}
