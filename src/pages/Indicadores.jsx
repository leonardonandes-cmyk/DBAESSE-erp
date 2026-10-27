import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { FotoProduto } from '../components/FotoProduto.jsx'
import SeletorPeriodo, { periodoAnterior, periodoPadrao, resolverPeriodo } from '../components/SeletorPeriodo.jsx'
import { BarrasEmpilhadas, GraficoArea, Rosca, Sparkline, corCanal, ordenarCanais } from '../components/Graficos.jsx'
import { brl, brlCurto, dataBR, inteiro } from '../lib/format.js'
import { listarPedidos, totaisPedido } from '../lib/pedidos.js'
import { listarProdutos } from '../lib/produtos.js'

/*
  Indicadores (BI interno). Aba Vendas: pedidos faturados ou entregues, pela data do pedido.
  Período livre (rápido, mês, ano ou de/até); filtros valem para a tela toda; clicar num canal filtra.
*/
const ABAS = [
  { id: 'vendas', label: 'Vendas' },
  { id: 'margem', label: 'Produtos e margem', breve: true },
  { id: 'producao', label: 'Produção', breve: true },
  { id: 'estoque', label: 'Estoque', breve: true },
  { id: 'financeiro', label: 'Financeiro', breve: true },
]
const VENDIDO = ['faturado', 'entregue']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const CORES_TIPO = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const dd = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
const isoDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// agrupa por dia (até 31 dias), semana (até ~4 meses) ou mês
function baldes(ini, fim) {
  const dias = (fim - ini) / 864e5
  const out = []
  if (dias <= 31) {
    const x = new Date(ini); x.setHours(0, 0, 0, 0)
    while (x <= fim) { const f = new Date(x); f.setDate(f.getDate() + 1); out.push({ ini: new Date(x), fim: f, rotulo: dd(x), titulo: x.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) }); x.setDate(x.getDate() + 1) }
    return { tipo: 'dia', lista: out }
  }
  if (dias <= 125) {
    const x = new Date(ini); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
    while (x <= fim) { const f = new Date(x); f.setDate(f.getDate() + 7); out.push({ ini: new Date(x), fim: f, rotulo: dd(x), titulo: `Semana de ${dd(x)}` }); x.setDate(x.getDate() + 7) }
    return { tipo: 'semana', lista: out }
  }
  const x = new Date(ini.getFullYear(), ini.getMonth(), 1)
  while (x <= fim) { const f = new Date(x.getFullYear(), x.getMonth() + 1, 1); out.push({ ini: new Date(x), fim: f, rotulo: `${MESES[x.getMonth()]}${x.getMonth() === 0 || !out.length ? `/${String(x.getFullYear()).slice(2)}` : ''}`, titulo: `${MESES[x.getMonth()]}/${x.getFullYear()}` }); x.setMonth(x.getMonth() + 1) }
  return { tipo: 'mês', lista: out }
}

function baixarCsv(nome, linhas) {
  const esc = (v) => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const csv = '﻿' + linhas.map((l) => l.map(esc).join(';')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
const num2 = (v) => Number(v || 0).toFixed(2).replace('.', ',')
const eixoR = (v) => (v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : inteiro(Math.round(v)))

export default function Indicadores() {
  const [pedidos, setPedidos] = useState([])
  const [produtos, setProdutos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState('vendas')
  const [periodo, setPeriodo] = useState(() => periodoPadrao('90'))
  const [canal, setCanal] = useState('Todos')
  const [tipo, setTipo] = useState('Todos')
  const [medida, setMedida] = useState('valor')
  const [visao, setVisao] = useState('canal')

  useEffect(() => {
    Promise.all([listarPedidos(), listarProdutos()])
      .then(([pe, pr]) => { setPedidos(pe); setProdutos(pr) })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [])

  const skuInfo = useMemo(() => {
    const m = {}
    produtos.forEach((p) => p.skus.forEach((s) => { m[s.id] = p }))
    return m
  }, [produtos])
  const canais = useMemo(() => ['Todos', ...ordenarCanais([...new Set(pedidos.map((p) => p.canal).filter(Boolean))])], [pedidos])
  const tipos = useMemo(() => ['Todos', ...[...new Set(produtos.map((p) => p.tipo).filter(Boolean))].sort()], [produtos])
  const per = useMemo(() => resolverPeriodo(periodo), [periodo])

  const r = useMemo(() => {
    const { ini, fim } = per
    const ant = periodoAnterior(per)
    const itensDe = (p) => (p.pedido_itens || []).filter((i) => tipo === 'Todos' || skuInfo[i.sku_id]?.tipo === tipo)
    const montar = (p) => {
      const its = itensDe(p)
      const bruto = its.reduce((t, i) => t + i.quantidade * Number(i.preco_unit), 0)
      const todo = totaisPedido(p)
      return { p, its, bruto, d: new Date(p.criado_em), valor: todo.bruto ? bruto * (todo.total / todo.bruto) : 0, pares: its.reduce((t, i) => t + i.quantidade, 0), canal: p.canal || 'Sem canal' }
    }
    const todos = pedidos.filter((p) => VENDIDO.includes(p.status)).map(montar).filter((x) => x.its.length)
    const doCanal = todos.filter((x) => canal === 'Todos' || x.canal === canal)
    const atual = doCanal.filter((x) => x.d >= ini && x.d <= fim)
    const anterior = doCanal.filter((x) => x.d >= ant.ini && x.d <= ant.fim)
    const tot = (l) => ({ valor: l.reduce((t, x) => t + x.valor, 0), pares: l.reduce((t, x) => t + x.pares, 0), pedidos: l.length })
    const a = tot(atual), b = tot(anterior)
    const varia = (x, y) => (y > 0 ? (x - y) / y : null)

    const bs = baldes(ini, fim)
    const pts = bs.lista.map((k) => ({ ...k, valor: 0, pares: 0, pedidos: 0, partes: {}, partesPares: {} }))
    atual.forEach((x) => {
      const alvo = pts.find((k) => x.d >= k.ini && x.d < k.fim); if (!alvo) return
      alvo.valor += x.valor; alvo.pares += x.pares; alvo.pedidos += 1
      alvo.partes[x.canal] = (alvo.partes[x.canal] || 0) + x.valor
      alvo.partesPares[x.canal] = (alvo.partesPares[x.canal] || 0) + x.pares
    })

    // canais: respeitam período e tipo, ignoram o filtro de canal (para comparar)
    const porCanal = {}
    todos.filter((x) => x.d >= ini && x.d <= fim).forEach((x) => {
      const c = (porCanal[x.canal] ||= { id: x.canal, nome: x.canal, cor: corCanal(x.canal), valor: 0, pares: 0, pedidos: 0 })
      c.valor += x.valor; c.pares += x.pares; c.pedidos += 1
    })
    const listaCanais = ordenarCanais(Object.keys(porCanal)).map((k) => porCanal[k])

    const porModelo = {}, porCliente = {}, porTipo = {}
    atual.forEach((x) => {
      x.its.forEach((i) => {
        const pr = skuInfo[i.sku_id]; if (!pr) return
        const v = x.bruto ? x.valor * (i.quantidade * Number(i.preco_unit)) / x.bruto : 0
        const m = (porModelo[pr.id] ||= { produto: pr, pares: 0, valor: 0 }); m.pares += i.quantidade; m.valor += v
        const t = (porTipo[pr.tipo || 'Sem tipo'] ||= { nome: pr.tipo || 'Sem tipo', pares: 0, valor: 0 }); t.pares += i.quantidade; t.valor += v
      })
      const nome = x.p.parceiros?.nome || 'Sem cliente'
      const c = (porCliente[nome] ||= { nome, pedidos: 0, pares: 0, valor: 0, ultimo: x.d, canal: x.canal })
      c.pedidos += 1; c.pares += x.pares; c.valor += x.valor; if (x.d > c.ultimo) c.ultimo = x.d
    })
    const modelos = Object.values(porModelo).sort((m1, m2) => m2[medida] - m1[medida])
    const tiposV = Object.values(porTipo).sort((t1, t2) => t2[medida] - t1[medida])

    // dia da semana (onde a venda acontece)
    const semana = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((n) => ({ nome: n, valor: 0, pares: 0 }))
    atual.forEach((x) => { const k = (x.d.getDay() + 6) % 7; semana[k].valor += x.valor; semana[k].pares += x.pares })

    return {
      a, b, atual, pts, tipoBalde: bs.tipo,
      varValor: varia(a.valor, b.valor), varPares: varia(a.pares, b.pares), varPedidos: varia(a.pedidos, b.pedidos),
      ticket: a.pedidos ? a.valor / a.pedidos : 0, varTicket: varia(a.pedidos ? a.valor / a.pedidos : 0, b.pedidos ? b.valor / b.pedidos : 0),
      precoPar: a.pares ? a.valor / a.pares : 0, varPreco: varia(a.pares ? a.valor / a.pares : 0, b.pares ? b.valor / b.pares : 0),
      canais: listaCanais, modelos: modelos.slice(0, 10), nModelos: modelos.length, totModelos: modelos.reduce((t, m) => t + m[medida], 0),
      tipos: tiposV, clientes: Object.values(porCliente).sort((c1, c2) => c2.valor - c1.valor).slice(0, 10), semana,
    }
  }, [pedidos, skuInfo, per, canal, tipo, medida])

  const fmt = (v) => (medida === 'valor' ? brl(v) : `${inteiro(v)} pares`)
  const fmtEixo = (v) => (medida === 'valor' ? eixoR(v) : inteiro(Math.round(v)))
  const series = r.canais.map((c) => ({ id: c.id, nome: c.nome, cor: c.cor })).filter((s) => canal === 'Todos' || s.id === canal)
  const maxSemana = Math.max(1, ...r.semana.map((s) => s[medida]))
  const maxTipo = Math.max(1, ...r.tipos.map((t) => t[medida]))

  function exportar() {
    const linhas = [['Pedido', 'Data', 'Canal', 'Cliente', 'Situação', 'REF', 'Modelo', 'Tipo', 'Pares', 'Preço unit.', 'Valor (com desconto rateado)']]
    r.atual.forEach((x) => x.its.forEach((i) => {
      const pr = skuInfo[i.sku_id]
      linhas.push([x.p.numero, dataBR(x.p.criado_em.slice(0, 10)), x.canal, x.p.parceiros?.nome || '', x.p.status, pr?.ref, pr?.nome, pr?.tipo, i.quantidade, num2(i.preco_unit), num2(x.bruto ? x.valor * (i.quantidade * Number(i.preco_unit)) / x.bruto : 0)])
    }))
    baixarCsv(`vendas-${isoDia(per.ini)}-a-${isoDia(per.fim)}.csv`, linhas)
  }

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Relatórios · {per.rotulo}</div>
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
        <div className="field"><span>Período</span><SeletorPeriodo valor={periodo} onChange={setPeriodo} /></div>
        <label className="field"><span>Canal</span>
          <select className="input" value={canal} onChange={(e) => setCanal(e.target.value)}>{canais.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label className="field"><span>Tipo de produto</span>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>{tipos.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
        <div className="field"><span>Medir por</span>
          <div className="segmented" role="group" aria-label="Medida">
            <button className={medida === 'valor' ? 'on' : ''} onClick={() => setMedida('valor')}>R$</button>
            <button className={medida === 'pares' ? 'on' : ''} onClick={() => setMedida('pares')}>Pares</button>
          </div>
        </div>
        {(canal !== 'Todos' || tipo !== 'Todos') && <button className="link-btn" onClick={() => { setCanal('Todos'); setTipo('Todos') }}>limpar filtros</button>}
      </div>

      {erro && <p className="form-error" role="alert">Não consegui ler o banco: {erro}</p>}

      <section className="kpis-cor">
        <KpiCor cor="#8A5A32" rotulo="Faturamento" valor={brl(r.a.valor)} v={r.varValor} spark={r.pts.map((p) => p.valor)} />
        <KpiCor cor="#2a78d6" rotulo="Pares vendidos" valor={inteiro(r.a.pares)} v={r.varPares} spark={r.pts.map((p) => p.pares)} />
        <KpiCor cor="#1baf7a" rotulo="Pedidos" valor={inteiro(r.a.pedidos)} v={r.varPedidos} spark={r.pts.map((p) => p.pedidos)} />
        <KpiCor cor="#6250d6" rotulo="Ticket médio" valor={brl(r.ticket)} v={r.varTicket} spark={r.pts.map((p) => (p.pedidos ? p.valor / p.pedidos : 0))} />
        <KpiCor cor="#eb6834" rotulo="Preço médio do par" valor={brl(r.precoPar)} v={r.varPreco} spark={r.pts.map((p) => (p.pares ? p.valor / p.pares : 0))} />
      </section>

      <section className="painel-linha">
        <div className="card">
          <div className="card-head">
            <div><h2>Evolução das vendas</h2><div className="card-sub">por {r.tipoBalde}{canal !== 'Todos' ? ` · ${canal}` : ''}{tipo !== 'Todos' ? ` · ${tipo}` : ''}</div></div>
            <div className="segmented" role="group" aria-label="Visão">
              <button className={visao === 'canal' ? 'on' : ''} onClick={() => setVisao('canal')}>Por canal</button>
              <button className={visao === 'total' ? 'on' : ''} onClick={() => setVisao('total')}>Total</button>
            </div>
          </div>
          {visao === 'canal' ? (
            <>
              <div className="legenda-graf">{series.map((s) => <span key={s.id}><i style={{ background: s.cor }} />{s.nome}</span>)}</div>
              <BarrasEmpilhadas series={series} fmt={fmt} fmtEixo={fmtEixo} altura={330}
                periodos={r.pts.map((p) => ({ rotulo: p.rotulo, titulo: p.titulo, partes: medida === 'valor' ? p.partes : p.partesPares }))} />
            </>
          ) : (
            <GraficoArea fmt={fmt} fmtEixo={fmtEixo} altura={360} cor={canal !== 'Todos' ? corCanal(canal) : '#8A5A32'}
              pontos={r.pts.map((p) => ({ rotulo: p.rotulo, titulo: p.titulo, valor: p[medida], detalhe: `${brl(p.valor)} · ${inteiro(p.pares)} pares · ${p.pedidos} pedidos` }))} />
          )}
        </div>

        <div className="card">
          <div className="card-head"><div><h2>Participação por canal</h2><div className="card-sub">clique para filtrar a tela</div></div></div>
          <Rosca fatias={r.canais.map((c) => ({ id: c.id, nome: c.nome, cor: c.cor, valor: c[medida] }))}
            fmt={medida === 'valor' ? brlCurto : (v) => `${inteiro(v)} pares`} rotuloCentro={medida === 'valor' ? 'faturamento' : 'vendidos'}
            selecionada={canal !== 'Todos' ? canal : null} onClicar={(id) => setCanal(canal === id ? 'Todos' : id)} />
        </div>
      </section>

      <section className="painel-linha metade">
        <div className="card">
          <div className="card-head"><div><h2>Por tipo de produto</h2><div className="card-sub">{r.tipos.length} tipos vendidos</div></div></div>
          <div className="hbars">
            {r.tipos.map((t, i) => (
              <button key={t.nome} className={`hbar ${tipo === t.nome ? 'on' : ''}`} onClick={() => setTipo(tipo === t.nome ? 'Todos' : t.nome)} title="Clique para filtrar">
                <span className="hbar-nome">{t.nome}</span>
                <span className="hbar-trilho"><i style={{ width: `${(t[medida] / maxTipo) * 100}%`, background: CORES_TIPO[i % CORES_TIPO.length] }} /></span>
                <b>{medida === 'valor' ? brlCurto(t.valor) : inteiro(t.pares)}</b>
              </button>
            ))}
            {r.tipos.length === 0 && <p className="card-sub" style={{ margin: 0 }}>Sem vendas no período.</p>}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div><h2>Dia da semana</h2><div className="card-sub">quando as vendas acontecem</div></div></div>
          <div className="semana-graf">
            {r.semana.map((s) => (
              <div key={s.nome} className="semana-col" title={`${s.nome}: ${brl(s.valor)} · ${inteiro(s.pares)} pares`}>
                <span className="semana-val">{s[medida] ? (medida === 'valor' ? brlCurto(s.valor) : inteiro(s.pares)) : ''}</span>
                <div className="semana-trilho"><i style={{ height: `${(s[medida] / maxSemana) * 100}%` }} /></div>
                <span className="semana-nome">{s.nome}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="painel-linha metade">
        <div className="card card-flush">
          <div className="card-head pad"><div><h2>Modelos mais vendidos</h2><div className="card-sub">{r.nModelos} modelos vendidos · por {medida === 'valor' ? 'faturamento' : 'pares'}</div></div></div>
          <div className="table-wrap">
            <table>
              <thead className="tinted"><tr><th>#</th><th>Modelo</th><th className="r">Pares</th><th className="r">Faturamento</th><th className="r">Part.</th></tr></thead>
              <tbody>
                {r.modelos.map((m, i) => {
                  const part = r.totModelos ? m[medida] / r.totModelos : 0
                  return (
                    <tr key={m.produto.id}>
                      <td><span className={`rank r${i + 1}`}>{i + 1}</span></td>
                      <td><div className="prod-cell"><FotoProduto p={m.produto} size={36} /><div><b>{m.produto.ref}</b><span>{m.produto.nome}</span></div></div></td>
                      <td className="r"><b>{inteiro(m.pares)}</b></td>
                      <td className="r">{brl(m.valor)}</td>
                      <td className="r"><span className="part"><i style={{ width: `${part * 100}%` }} /></span>{Math.round(part * 100)}%</td>
                    </tr>
                  )
                })}
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
                    <td><b>{c.nome}</b><br /><span className="canal-tag"><i style={{ background: corCanal(c.canal) }} />{c.canal}</span></td>
                    <td className="r">{c.pedidos}</td>
                    <td className="r">{inteiro(c.pares)}</td>
                    <td className="r"><b>{brl(c.valor)}</b></td>
                    <td className="r faint">{dataBR(isoDia(c.ultimo))}</td>
                  </tr>
                ))}
                {r.clientes.length === 0 && <tr><td colSpan={5} className="vazio">Sem vendas no período.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <p className="card-sub" style={{ margin: 0 }}>Vendas = pedidos faturados ou entregues, pela data do pedido. As setas comparam com o período anterior de mesmo tamanho. Desconto do pedido rateado entre os itens.{carregando ? ' Carregando…' : ''}</p>
    </>
  )
}

function KpiCor({ cor, rotulo, valor, v, spark }) {
  return (
    <div className="card kpi-cor" style={{ '--kc': cor }}>
      <span className="kpi-label">{rotulo}</span>
      <span className="kpi2-valor">{valor}</span>
      <span className="kpi-note">
        {v != null ? <span className={`chip-var ${v >= 0 ? 'sobe' : 'desce'}`}>{v >= 0 ? '↑' : '↓'} {Math.abs(Math.round(v * 100))}%</span> : <span className="chip-var neutro">sem base</span>}
        <em> vs. período anterior</em>
      </span>
      <Sparkline valores={spark} cor={cor} />
    </div>
  )
}
