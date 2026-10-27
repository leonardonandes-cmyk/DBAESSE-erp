import { useMemo, useState } from 'react'
import { FotoProduto } from './FotoProduto.jsx'
import { GraficoArea, Rosca, Sparkline } from './Graficos.jsx'
import { brl, brlCurto, inteiro } from '../lib/format.js'
import { totaisPedido } from '../lib/pedidos.js'
import { OP_ABERTAS, etapaAtual, paresOP } from '../lib/producao.js'
import { margemNaLista, pct, tomMargem } from '../lib/custos.js'
import { precoNaLista } from '../lib/precos.js'

/*
  Abas dos Indicadores além de Vendas: Produtos e margem · Estoque · Produção · Financeiro.
  Todas recebem o mesmo período ({ ini, fim }) e os dados já carregados.
*/
const PALETA = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const COR_ABC = { A: '#1baf7a', B: '#2a78d6', C: '#9a968f' }
const VENDIDO = ['faturado', 'entregue']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const dd = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
const dataDe = (iso) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso) : null)
const eixoR = (v) => (v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : inteiro(Math.round(v)))

function baldes(ini, fim) {
  const dias = (fim - ini) / 864e5, out = []
  if (dias <= 31) { const x = new Date(ini); x.setHours(0, 0, 0, 0); while (x <= fim) { const f = new Date(x); f.setDate(f.getDate() + 1); out.push({ ini: new Date(x), fim: f, rotulo: dd(x), titulo: x.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) }); x.setDate(x.getDate() + 1) } return out }
  if (dias <= 125) { const x = new Date(ini); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); while (x <= fim) { const f = new Date(x); f.setDate(f.getDate() + 7); out.push({ ini: new Date(x), fim: f, rotulo: dd(x), titulo: `Semana de ${dd(x)}` }); x.setDate(x.getDate() + 7) } return out }
  const x = new Date(ini.getFullYear(), ini.getMonth(), 1)
  while (x <= fim) { const f = new Date(x.getFullYear(), x.getMonth() + 1, 1); out.push({ ini: new Date(x), fim: f, rotulo: MESES[x.getMonth()], titulo: `${MESES[x.getMonth()]}/${x.getFullYear()}` }); x.setMonth(x.getMonth() + 1) }
  return out
}

export function KpiCor({ cor, rotulo, valor, nota, spark }) {
  return (
    <div className="card kpi-cor" style={{ '--kc': cor }}>
      <span className="kpi-label">{rotulo}</span>
      <span className="kpi2-valor">{valor}</span>
      {nota && <span className="kpi-note">{nota}</span>}
      {spark && <Sparkline valores={spark} cor={cor} />}
    </div>
  )
}

function HBarras({ itens, fmt = inteiro, vazio = 'Sem dados no período.', onClicar }) {
  if (!itens.length) return <p className="card-sub" style={{ margin: 0 }}>{vazio}</p>
  const max = Math.max(1, ...itens.map((i) => i.valor))
  return (
    <div className="hbars">
      {itens.map((t, i) => (
        <button key={t.nome} type="button" className="hbar" onClick={() => onClicar?.(t)} style={{ cursor: onClicar ? 'pointer' : 'default' }} title={t.dica || ''}>
          <span className="hbar-nome">{t.nome}</span>
          <span className="hbar-trilho"><i style={{ width: `${(t.valor / max) * 100}%`, background: t.cor || PALETA[i % PALETA.length] }} /></span>
          <b>{fmt(t.valor)}</b>
        </button>
      ))}
    </div>
  )
}

/* ---------------- Produtos e margem ---------------- */
export function AbaMargem({ dados, per }) {
  const { pedidos, produtos, custos, listas } = dados
  const r = useMemo(() => {
    const skuProd = {}; produtos.forEach((p) => p.skus.forEach((s) => { skuProd[s.id] = p }))
    const modelo = {}; let fat = 0
    pedidos.filter((p) => VENDIDO.includes(p.status)).forEach((p) => {
      const d = new Date(p.criado_em); if (d < per.ini || d > per.fim) return
      const t = totaisPedido(p); const f = t.bruto ? t.total / t.bruto : 1
      p.pedido_itens.forEach((i) => {
        const pr = skuProd[i.sku_id]; if (!pr) return
        const v = i.quantidade * Number(i.preco_unit) * f; fat += v
        const m = (modelo[pr.id] ||= { produto: pr, valor: 0, pares: 0 }); m.valor += v; m.pares += i.quantidade
      })
    })
    const lista = Object.values(modelo).sort((a, b) => b.valor - a.valor)
    let acum = 0; const abc = { A: 0, B: 0, C: 0 }, fatAbc = { A: 0, B: 0, C: 0 }
    lista.forEach((m) => { const antes = fat ? acum / fat : 0; acum += m.valor; m.classe = antes < 0.8 ? 'A' : antes < 0.95 ? 'B' : 'C'; abc[m.classe]++; fatAbc[m.classe] += m.valor })
    const ativos = produtos.filter((p) => p.status === 'ativo')
    const comCusto = ativos.filter((p) => custos[p.id])
    const atac = listas.find((l) => l.codigo === 'atacado') || listas[0]
    const margens = comCusto.map((p) => { const preco = precoNaLista(p, atac); return preco ? margemNaLista(custos[p.id], preco, atac).margem : null }).filter((m) => m != null)
    return {
      lista, fat, abc, fatAbc, ativos: ativos.length, comCusto: comCusto.length,
      custoMedio: comCusto.length ? comCusto.reduce((t, p) => t + custos[p.id], 0) / comCusto.length : 0,
      margemMedia: margens.length ? margens.reduce((t, m) => t + m, 0) / margens.length : null,
      abaixo: margens.filter((m) => m < 0.2).length, atacNome: atac?.nome,
      vendidos: new Set(lista.map((m) => m.produto.id)),
    }
  }, [pedidos, produtos, custos, listas, per])

  return (
    <>
      <section className="kpis-cor">
        <KpiCor cor="#1baf7a" rotulo="Modelos classe A" valor={inteiro(r.abc.A)} nota={`${r.fat ? Math.round((r.fatAbc.A / r.fat) * 100) : 0}% do faturamento`} />
        <KpiCor cor="#2a78d6" rotulo="Modelos vendidos" valor={`${r.lista.length} de ${r.ativos}`} nota={`${r.ativos - r.vendidos.size > 0 ? r.ativos - r.vendidos.size : 0} ativos sem venda no período`} />
        <KpiCor cor="#8A5A32" rotulo="Custo médio do par" valor={brl(r.custoMedio)} nota={`${r.comCusto} de ${r.ativos} com ficha técnica`} />
        <KpiCor cor="#6250d6" rotulo={`Margem média · ${r.atacNome || 'atacado'}`} valor={pct(r.margemMedia)} nota="depois das despesas da lista" />
        <KpiCor cor="#e34948" rotulo="Abaixo de 20%" valor={inteiro(r.abaixo)} nota="modelos para rever preço ou custo" />
      </section>

      <section className="painel-linha">
        <div className="card">
          <div className="card-head">
            <div><h2>Curva ABC</h2><div className="card-sub">A = 80% do faturamento · B = próximos 15% · C = restante</div></div>
            <div className="legenda-graf" style={{ margin: 0 }}>{['A', 'B', 'C'].map((c) => <span key={c}><i style={{ background: COR_ABC[c] }} />{c} · {r.abc[c]} modelos</span>)}</div>
          </div>
          {r.lista.length === 0 ? <p className="card-sub" style={{ margin: 0 }}>Sem vendas no período.</p> : (
            <div className="abc-lista">
              {r.lista.slice(0, 15).map((m, i) => (
                <div key={m.produto.id} className="abc-linha">
                  <span className="abc-pos">{i + 1}</span>
                  <FotoProduto p={m.produto} size={40} />
                  <span className="abc-nome"><b>{m.produto.ref}</b> {m.produto.nome}</span>
                  <span className="hbar-trilho"><i style={{ width: `${(m.valor / r.lista[0].valor) * 100}%`, background: COR_ABC[m.classe] }} /></span>
                  <b className="abc-val">{brlCurto(m.valor)}</b>
                  <span className="abc-classe" style={{ background: COR_ABC[m.classe] }}>{m.classe}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-head"><div><h2>Faturamento por classe</h2><div className="card-sub">quanto cada grupo representa</div></div></div>
          <Rosca fmt={brlCurto} rotuloCentro="no período" fatias={['A', 'B', 'C'].map((c) => ({ id: c, nome: `Classe ${c} · ${r.abc[c]} modelos`, cor: COR_ABC[c], valor: r.fatAbc[c] }))} />
        </div>
      </section>
      <MargensModelos dados={dados} />
    </>
  )
}

// Margem de todos os modelos por lista (como a aba INICIO da planilha de ficha técnica)
function MargensModelos({ dados }) {
  const [ordem, setOrdem] = useState('margem')
  const [so, setSo] = useState('todos')
  const listas = dados.listas || []
  const linhas = dados.produtos.filter((p) => p.status === 'ativo').map((p) => {
    const custo = dados.custos[p.id] || 0
    const porLista = Object.fromEntries(listas.map((l) => { const preco = precoNaLista(p, l); return [l.codigo, { preco, ...(custo && preco ? margemNaLista(custo, preco, l) : {}) }] }))
    return { p, custo, porLista }
  })
  const ref = listas[0]?.codigo
  const filtradas = linhas.filter((x) => so === 'todos' || (so === 'baixa' ? (x.porLista[ref]?.margem ?? 1) < 0.2 : !x.custo))
  filtradas.sort((a, b) => (ordem === 'margem' ? (a.porLista[ref]?.margem ?? 9) - (b.porLista[ref]?.margem ?? 9) : a.p.ref.localeCompare(b.p.ref, 'pt-BR', { numeric: true })))
  const comCusto = linhas.filter((x) => x.custo)
  const media = (cod) => { const ms = comCusto.map((x) => x.porLista[cod]?.margem).filter((m) => m != null); return ms.length ? ms.reduce((t, m) => t + m, 0) / ms.length : null }
  return (
    <section className="card card-flush">
      <div className="card-head pad">
        <div><h2>Custo e margem por modelo</h2><div className="card-sub">preço de cada lista − custo da ficha − despesas da lista</div></div>
        <div className="chips">
          {[['todos', 'Todos'], ['baixa', 'Abaixo de 20%'], ['sem', 'Sem ficha']].map(([k, l]) => <button key={k} className={`chip ${so === k ? 'on' : ''}`} onClick={() => setSo(k)}>{l}</button>)}
          <button className="chip" onClick={() => setOrdem(ordem === 'margem' ? 'ref' : 'margem')}>Ordem: {ordem === 'margem' ? 'menor margem' : 'REF'}</button>
        </div>
      </div>
      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table style={{ minWidth: 760 }}>
          <thead className="tinted">
            <tr><th>Modelo</th><th className="r">Custo</th>{listas.map((l) => <th key={l.codigo} className="r">{l.nome}</th>)}</tr>
            <tr className="sub"><th>Média</th><th />{listas.map((l) => <th key={l.codigo} className="r">{pct(media(l.codigo))}</th>)}</tr>
          </thead>
          <tbody>
            {filtradas.map(({ p, custo, porLista }) => (
              <tr key={p.id}>
                <td><div className="prod-cell"><FotoProduto p={p} size={34} /><div><b>{p.ref} · {p.nome}</b><span>{p.tipo}</span></div></div></td>
                <td className="r">{custo ? brl(custo) : <span className="faint">sem ficha</span>}</td>
                {listas.map((l) => {
                  const x = porLista[l.codigo]
                  return <td key={l.codigo} className="r"><div>{x.preco ? brl(x.preco) : '—'}</div>{x.margem != null && <span className={`pill ${tomMargem(x.margem)}`} title={`Lucro ${brl(x.lucro)} · ideal ${x.ideal ? brl(x.ideal) : '—'}`}>{pct(x.margem)}</span>}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* ---------------- Estoque ---------------- */
export function AbaEstoque({ dados, per }) {
  const { saldos, produtos, pedidos, custos } = dados
  const r = useMemo(() => {
    const skuProd = {}; produtos.forEach((p) => p.skus.forEach((s) => { skuProd[s.id] = p }))
    const vendidos = new Set(); let paresVend = 0
    pedidos.filter((p) => VENDIDO.includes(p.status)).forEach((p) => {
      const d = new Date(p.criado_em); if (d < per.ini || d > per.fim) return
      p.pedido_itens.forEach((i) => { vendidos.add(i.sku_id); paresVend += i.quantidade })
    })
    let pares = 0, bulk = 0, pick = 0, valorAtac = 0, valorCusto = 0
    const porTipo = {}, parado = {}
    saldos.forEach((s) => {
      const pr = skuProd[s.sku_id]
      if (s.saldo <= 0 || !pr) return
      pares += s.saldo; bulk += Math.max(0, s.saldo_bulk || 0); pick += Math.max(0, s.saldo_pick || 0)
      valorAtac += s.saldo * Number(pr.preco_atacado || 0); valorCusto += s.saldo * (custos[pr.id] || 0)
      const t = pr.tipo || 'Sem tipo'; porTipo[t] = (porTipo[t] || 0) + s.saldo
      if (!vendidos.has(s.sku_id)) { const m = (parado[pr.id] ||= { produto: pr, pares: 0 }); m.pares += s.saldo }
    })
    const ativos = new Set(produtos.filter((p) => p.status === 'ativo').flatMap((p) => p.skus.map((s) => s.id)))
    const zerados = saldos.filter((s) => ativos.has(s.sku_id) && s.saldo <= 0).length
    const dias = Math.max(1, (per.fim - per.ini) / 864e5)
    const giroDia = paresVend / dias
    return {
      pares, bulk, pick, valorAtac, valorCusto, zerados, cobertura: giroDia ? pares / giroDia : null,
      tipos: Object.entries(porTipo).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor),
      parado: Object.values(parado).sort((a, b) => b.pares - a.pares), paradoTotal: Object.values(parado).reduce((t, m) => t + m.pares, 0),
    }
  }, [saldos, produtos, pedidos, custos, per])
  return (
    <>
      <section className="kpis-cor">
        <KpiCor cor="#2a78d6" rotulo="Pares em estoque" valor={inteiro(r.pares)} nota={`Bulk ${inteiro(r.bulk)} · Pick ${inteiro(r.pick)}`} />
        <KpiCor cor="#8A5A32" rotulo="Valor a preço de atacado" valor={brlCurto(r.valorAtac)} nota="o que o estoque vale vendido" />
        <KpiCor cor="#1baf7a" rotulo="Valor a custo" valor={brlCurto(r.valorCusto)} nota="pela ficha técnica" />
        <KpiCor cor="#6250d6" rotulo="Cobertura" valor={r.cobertura != null ? `${inteiro(Math.round(r.cobertura))} dias` : '—'} nota="no ritmo de venda do período" />
        <KpiCor cor="#e34948" rotulo="SKUs zerados" valor={inteiro(r.zerados)} nota="modelos ativos sem saldo" />
      </section>
      <section className="painel-linha">
        <div className="card">
          <div className="card-head"><div><h2>Estoque parado</h2><div className="card-sub">pares sem nenhuma venda no período · {inteiro(r.paradoTotal)} pares</div></div></div>
          {r.parado.length === 0 ? <p className="card-sub" style={{ margin: 0 }}>Nenhum estoque parado. 👏</p> : (
            <div className="abc-lista">
              {r.parado.slice(0, 12).map((m, i) => (
                <div key={m.produto.id} className="abc-linha">
                  <span className="abc-pos">{i + 1}</span>
                  <FotoProduto p={m.produto} size={40} />
                  <span className="abc-nome"><b>{m.produto.ref}</b> {m.produto.nome}</span>
                  <span className="hbar-trilho"><i style={{ width: `${(m.pares / r.parado[0].pares) * 100}%`, background: '#eb6834' }} /></span>
                  <b className="abc-val">{inteiro(m.pares)} pares</b>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-head"><div><h2>Estoque por tipo</h2><div className="card-sub">pares</div></div></div>
          <Rosca fmt={(v) => `${inteiro(v)}`} rotuloCentro="pares" fatias={r.tipos.map((t, i) => ({ id: t.nome, nome: t.nome, cor: PALETA[i % PALETA.length], valor: t.valor }))} />
        </div>
      </section>
    </>
  )
}

/* ---------------- Produção ---------------- */
export function AbaProducao({ dados, per }) {
  const { ops, setores } = dados
  const r = useMemo(() => {
    const dentro = (iso) => { const d = dataDe(iso); return d && d >= per.ini && d <= per.fim }
    const concluidas = ops.filter((o) => o.status === 'concluida' && dentro(o.concluida_em))
    const pares = concluidas.reduce((t, o) => t + paresOP(o), 0)
    const leads = concluidas.map((o) => (new Date(o.concluida_em) - new Date(o.criado_em)) / 864e5)
    const perdaSetor = {}
    ops.forEach((o) => o.op_etapas.forEach((e) => { if (e.qtd_perda && dentro(e.fim)) perdaSetor[e.setor_id] = (perdaSetor[e.setor_id] || 0) + e.qtd_perda }))
    const nome = Object.fromEntries(setores.map((s) => [s.id, s.nome]))
    const perdas = Object.entries(perdaSetor).map(([id, valor]) => ({ nome: nome[id] || '—', valor, cor: '#e34948' })).sort((a, b) => b.valor - a.valor)
    const abertas = ops.filter((o) => OP_ABERTAS.includes(o.status))
    const carga = setores.filter((s) => s.ativo).map((s, i) => ({ nome: s.nome, valor: abertas.filter((o) => etapaAtual(o)?.setor_id === s.id).reduce((t, o) => t + paresOP(o), 0), cor: PALETA[i % PALETA.length] }))
    const bs = baldes(per.ini, per.fim).map((b) => ({ ...b, valor: 0, ops: 0 }))
    concluidas.forEach((o) => { const d = new Date(o.concluida_em); const b = bs.find((k) => d >= k.ini && d < k.fim); if (b) { b.valor += paresOP(o); b.ops += 1 } })
    const totalPerda = perdas.reduce((t, p) => t + p.valor, 0)
    return { concluidas: concluidas.length, pares, lead: leads.length ? leads.reduce((a, b) => a + b, 0) / leads.length : null, perdas, totalPerda, pctPerda: pares + totalPerda ? totalPerda / (pares + totalPerda) : 0, carga, bs, abertas: abertas.length, paresAbertos: abertas.reduce((t, o) => t + paresOP(o), 0) }
  }, [ops, setores, per])
  return (
    <>
      <section className="kpis-cor">
        <KpiCor cor="#1baf7a" rotulo="Pares produzidos" valor={inteiro(r.pares)} nota={`${r.concluidas} OPs concluídas`} spark={r.bs.map((b) => b.valor)} />
        <KpiCor cor="#2a78d6" rotulo="Em produção agora" valor={`${inteiro(r.paresAbertos)} pares`} nota={`${r.abertas} OPs abertas`} />
        <KpiCor cor="#6250d6" rotulo="Tempo médio" valor={r.lead != null ? `${r.lead.toFixed(1).replace('.', ',')} dias` : '—'} nota="da abertura à conclusão da OP" />
        <KpiCor cor="#e34948" rotulo="Perdas" valor={`${inteiro(r.totalPerda)} pares`} nota={`${(r.pctPerda * 100).toFixed(1).replace('.', ',')}% do produzido`} />
      </section>
      <section className="painel-linha">
        <div className="card">
          <div className="card-head"><div><h2>Pares produzidos</h2><div className="card-sub">OPs concluídas no período</div></div></div>
          <GraficoArea cor="#1baf7a" altura={300} fmt={(v) => `${inteiro(v)} pares`} fmtEixo={inteiro} vazio="Nenhuma OP concluída no período."
            pontos={r.bs.map((b) => ({ rotulo: b.rotulo, titulo: b.titulo, valor: b.valor, detalhe: `${b.ops} OPs concluídas` }))} />
        </div>
        <div className="card">
          <div className="card-head"><div><h2>Onde está a produção</h2><div className="card-sub">pares em cada setor agora</div></div></div>
          <HBarras itens={r.carga} fmt={(v) => `${inteiro(v)}`} vazio="Nenhuma OP aberta." />
          {r.perdas.length > 0 && <>
            <div className="card-head" style={{ marginTop: 22 }}><div><h2>Perdas por setor</h2><div className="card-sub">no período</div></div></div>
            <HBarras itens={r.perdas} />
          </>}
        </div>
      </section>
    </>
  )
}

/* ---------------- Financeiro ---------------- */
export function AbaFinanceiro({ dados, per }) {
  const { titulos } = dados
  const r = useMemo(() => {
    const dentro = (iso) => { const d = dataDe(iso); return d && d >= per.ini && d <= per.fim }
    const pagos = titulos.filter((t) => t.pago_em && dentro(t.pago_em))
    const val = (t) => Number(t.valor_pago ?? t.valor)
    const recebido = pagos.filter((t) => t.tipo === 'receber').reduce((s, t) => s + val(t), 0)
    const pago = pagos.filter((t) => t.tipo === 'pagar').reduce((s, t) => s + val(t), 0)
    const abertos = titulos.filter((t) => !t.pago_em)
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const aReceber = abertos.filter((t) => t.tipo === 'receber'), aPagar = abertos.filter((t) => t.tipo === 'pagar')
    const vencRec = aReceber.filter((t) => dataDe(t.vencimento) < hoje)
    const cat = {}
    pagos.filter((t) => t.tipo === 'pagar').forEach((t) => { const k = t.categoria || 'Outros'; cat[k] = (cat[k] || 0) + val(t) })
    const bs = baldes(per.ini, per.fim).map((b) => ({ ...b, rec: 0, pag: 0 }))
    pagos.forEach((t) => { const d = dataDe(t.pago_em); const b = bs.find((k) => d >= k.ini && d < k.fim); if (b) b[t.tipo === 'receber' ? 'rec' : 'pag'] += val(t) })
    // próximos 30 dias
    const em30 = new Date(hoje); em30.setDate(em30.getDate() + 30)
    const prox = (l) => l.filter((t) => { const d = dataDe(t.vencimento); return d >= hoje && d <= em30 }).reduce((s, t) => s + Number(t.valor), 0)
    return {
      recebido, pago, resultado: recebido - pago,
      aReceber: aReceber.reduce((s, t) => s + Number(t.valor), 0), aPagar: aPagar.reduce((s, t) => s + Number(t.valor), 0),
      inadimplencia: vencRec.reduce((s, t) => s + Number(t.valor), 0), nInad: vencRec.length,
      prox30Rec: prox(aReceber), prox30Pag: prox(aPagar),
      cats: Object.entries(cat).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor), bs,
    }
  }, [titulos, per])
  return (
    <>
      <section className="kpis-cor">
        <KpiCor cor="#1baf7a" rotulo="Recebido" valor={brl(r.recebido)} nota="no período" spark={r.bs.map((b) => b.rec)} />
        <KpiCor cor="#e34948" rotulo="Pago" valor={brl(r.pago)} nota="no período" spark={r.bs.map((b) => b.pag)} />
        <KpiCor cor={r.resultado >= 0 ? '#2a78d6' : '#e34948'} rotulo="Resultado de caixa" valor={brl(r.resultado)} nota="recebido − pago" />
        <KpiCor cor="#eda100" rotulo="Em atraso para receber" valor={brl(r.inadimplencia)} nota={`${r.nInad} títulos vencidos`} />
        <KpiCor cor="#6250d6" rotulo="Próximos 30 dias" valor={brl(r.prox30Rec - r.prox30Pag)} nota={`entra ${brlCurto(r.prox30Rec)} · sai ${brlCurto(r.prox30Pag)}`} />
      </section>
      <section className="painel-linha">
        <div className="card">
          <div className="card-head"><div><h2>Entradas no caixa</h2><div className="card-sub">recebimentos baixados no Financeiro</div></div></div>
          <GraficoArea cor="#1baf7a" altura={280} fmt={brl} fmtEixo={eixoR} vazio="Nenhum recebimento baixado no período."
            pontos={r.bs.map((b) => ({ rotulo: b.rotulo, titulo: b.titulo, valor: b.rec, detalhe: `pago no período ${brl(b.pag)}` }))} />
        </div>
        <div className="card">
          <div className="card-head"><div><h2>Despesas por categoria</h2><div className="card-sub">contas pagas no período</div></div></div>
          {r.cats.length ? <Rosca fmt={brlCurto} rotuloCentro="pago" fatias={r.cats.map((c, i) => ({ id: c.nome, nome: c.nome, cor: PALETA[i % PALETA.length], valor: c.valor }))} />
            : <p className="card-sub" style={{ margin: 0 }}>Nenhuma conta paga no período.</p>}
        </div>
      </section>
      <section className="kpis-cor">
        <KpiCor cor="#1baf7a" rotulo="Total a receber (aberto)" valor={brl(r.aReceber)} />
        <KpiCor cor="#e34948" rotulo="Total a pagar (aberto)" valor={brl(r.aPagar)} />
      </section>
    </>
  )
}
