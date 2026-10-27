import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import { FotoProduto } from '../components/FotoProduto.jsx'
import { OP_ABERTAS, atrasadaOP, listarOPs, numeroOP, paresOP } from '../lib/producao.js'
import { listarSaldos } from '../lib/estoque.js'
import { brl, brlCurto, inteiro, numeroPedido } from '../lib/format.js'
import { listarParceiros } from '../lib/parceiros.js'
import { ABERTOS, STATUS_PEDIDO, atrasado, listarPedidos, totaisPedido } from '../lib/pedidos.js'
import { listarProdutos } from '../lib/produtos.js'
import { listarTitulos, situacao } from '../lib/financeiro.js'
import { BarrasEmpilhadas, Rosca, Sparkline, corCanal, ordenarCanais } from '../components/Graficos.jsx'

const TOM_ALERTA = {
  bad: { background: 'var(--bad-soft)', color: 'var(--bad)' },
  warn: { background: 'var(--accent-soft)', color: 'var(--accent)' },
  neutral: { background: 'var(--neutral-soft)', color: 'var(--ink-2)' },
}
const VENDIDO = ['faturado', 'entregue']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const saudacao = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite' }
const hoje = () => { const s = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1) }
function inicioSemana(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
const dd = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// períodos do gráfico: 12 semanas ou 6 meses (pela data do pedido, como nos Relatórios)
function montarPeriodos(tipo) {
  const agora = new Date()
  if (tipo === 'semanas') {
    const base = inicioSemana(agora)
    return Array.from({ length: 12 }, (_, i) => {
      const ini = new Date(base); ini.setDate(ini.getDate() - 7 * (11 - i))
      const fim = new Date(ini); fim.setDate(fim.getDate() + 7)
      return { ini, fim, rotulo: dd(ini), titulo: `Semana de ${dd(ini)}` }
    })
  }
  return Array.from({ length: 6 }, (_, i) => {
    const ini = new Date(agora.getFullYear(), agora.getMonth() - (5 - i), 1)
    const fim = new Date(ini.getFullYear(), ini.getMonth() + 1, 1)
    return { ini, fim, rotulo: MESES[ini.getMonth()], titulo: `${MESES[ini.getMonth()]}/${ini.getFullYear()}` }
  })
}

export default function Painel({ usuario }) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [periodo, setPeriodo] = useState('semanas')
  const [medida, setMedida] = useState('valor')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    Promise.all([listarPedidos(), listarSaldos(), listarProdutos(), listarParceiros(), listarTitulos(), listarOPs()])
      .then(([pedidos, saldos, produtos, parceiros, titulos, ops]) => setDados({ pedidos, saldos, produtos, parceiros, titulos, ops }))
      .catch((e) => setErro(e.message))
  }, [])

  const calc = useMemo(() => {
    if (!dados) return null
    const { pedidos, saldos, produtos, parceiros, titulos, ops } = dados
    const agora = new Date()
    const vendidos = pedidos.filter((p) => VENDIDO.includes(p.status))
    const doMes = (m, a) => vendidos.filter((p) => { const d = new Date(p.criado_em); return d.getMonth() === m && d.getFullYear() === a })
    const mesAtual = doMes(agora.getMonth(), agora.getFullYear())
    const ant = new Date(agora.getFullYear(), agora.getMonth() - 1, 1)
    // mês anterior até o mesmo dia, para comparar igual com igual
    const mesAnt = doMes(ant.getMonth(), ant.getFullYear()).filter((p) => new Date(p.criado_em).getDate() <= agora.getDate())
    const soma = (l, k) => l.reduce((t, p) => t + totaisPedido(p)[k], 0)
    const fatMes = soma(mesAtual, 'total'), fatAnt = soma(mesAnt, 'total')

    const abertos = pedidos.filter((p) => ABERTOS.includes(p.status))
    const opsAbertas = ops.filter((o) => OP_ABERTAS.includes(o.status))
    const fimSemana = inicioSemana(agora); fimSemana.setDate(fimSemana.getDate() + 7)
    const entregaSemana = abertos.filter((p) => p.previsao && new Date(`${p.previsao}T12:00:00`) < fimSemana)

    const vencidos = titulos.filter((t) => !t.pago_em && ['vencido', 'hoje'].includes(situacao(t).id))
    const pagarVenc = vencidos.filter((t) => t.tipo === 'pagar')
    const receberVenc = vencidos.filter((t) => t.tipo === 'receber')
    const somaV = (l) => l.reduce((x, t) => x + Number(t.valor), 0)
    const atrasados = pedidos.filter(atrasado)
    const opsAtrasadas = opsAbertas.filter(atrasadaOP)
    const ativos = produtos.filter((p) => p.status === 'ativo')
    const skusAtivos = new Set(ativos.flatMap((p) => p.skus.map((s) => s.id)))
    const zerados = saldos.filter((s) => skusAtivos.has(s.sku_id) && s.saldo <= 0).length
    const rascunhos = produtos.filter((p) => p.status === 'rascunho').length

    const alertas = [
      pagarVenc.length && { n: pagarVenc.length, titulo: 'Contas a pagar vencendo', sub: `${brl(somaV(pagarVenc))} vencidas ou para hoje`, tom: 'bad', para: '/financeiro' },
      receberVenc.length && { n: receberVenc.length, titulo: 'Recebimentos em atraso', sub: `${brl(somaV(receberVenc))} para cobrar`, tom: 'warn', para: '/financeiro' },
      atrasados.length && { n: atrasados.length, titulo: 'Pedidos atrasados', sub: 'Previsão de entrega já passou', tom: 'bad', para: '/pedidos' },
      opsAtrasadas.length && { n: opsAtrasadas.length, titulo: 'OPs fora do prazo', sub: 'Ordens de produção atrasadas', tom: 'bad', para: '/producao' },
      zerados && { n: zerados, titulo: 'SKUs sem estoque', sub: 'Modelos ativos com saldo zerado', tom: 'warn', para: '/estoque' },
      rascunhos && { n: rascunhos, titulo: 'Modelos em rascunho', sub: 'Faltam nome e cores para ativar', tom: 'neutral', para: '/produtos' },
    ].filter(Boolean)

    return {
      pedidos, produtos, parceiros, vendidos, fatMes, fatAnt, paresMes: soma(mesAtual, 'pares'),
      abertos, paresAbertos: soma(abertos, 'pares'), valorAbertos: soma(abertos, 'total'),
      opsAbertas, paresProducao: opsAbertas.reduce((t, o) => t + paresOP(o), 0),
      emEstoque: saldos.reduce((t, s) => t + Math.max(0, s.saldo), 0), ativos: ativos.length,
      entregaSemana, alertas,
    }
  }, [dados])

  // gráfico + canais, no período escolhido
  const serie = useMemo(() => {
    if (!calc) return null
    const ps = montarPeriodos(periodo).map((x) => ({ ...x, valor: 0, pares: 0, pedidos: 0, partes: {}, partesPares: {} }))
    const ini = ps[0].ini, fim = ps[ps.length - 1].fim
    const canais = {}
    calc.vendidos.forEach((p) => {
      const d = new Date(p.criado_em)
      if (d < ini || d >= fim) return
      const t = totaisPedido(p)
      const alvo = ps.find((x) => d >= x.ini && d < x.fim)
      if (alvo) {
        alvo.valor += t.total; alvo.pares += t.pares; alvo.pedidos += 1
        const k = p.canal || 'Sem canal'
        alvo.partes[k] = (alvo.partes[k] || 0) + t.total; alvo.partesPares[k] = (alvo.partesPares[k] || 0) + t.pares
      }
      const c = (canais[p.canal || 'Sem canal'] ||= { canal: p.canal || 'Sem canal', valor: 0, pares: 0, pedidos: 0 })
      c.valor += t.total; c.pares += t.pares; c.pedidos += 1
    })
    const total = Object.values(canais).reduce((t, c) => t + c.valor, 0)
    return {
      ps, max: Math.max(1, ...ps.map((x) => x[medida])),
      total, totalPares: ps.reduce((t, x) => t + x.pares, 0), totalPedidos: ps.reduce((t, x) => t + x.pedidos, 0),
      canais: ordenarCanais(Object.keys(canais)).map((k) => ({ ...canais[k], cor: corCanal(k), pct: total ? canais[k].valor / total : 0 })),
    }
  }, [calc, periodo, medida])

  const resultados = useMemo(() => {
    const q = semAcento(busca.trim())
    if (!calc || q.length < 2) return []
    const r = []
    calc.pedidos.forEach((p) => {
      if (semAcento(`${numeroPedido(p.numero)} ${p.numero} ${p.parceiros?.nome} ${p.canal}`).includes(q))
        r.push({ tipo: 'Pedido', titulo: `${numeroPedido(p.numero)} · ${p.parceiros?.nome || 'Sem cliente'}`, sub: `${STATUS_PEDIDO[p.status]?.label} · ${brl(totaisPedido(p).total)}`, para: '/pedidos' })
    })
    calc.produtos.forEach((p) => {
      const skus = p.skus.filter((s) => semAcento(s.sku).includes(q) || (s.ean && s.ean.includes(q)))
      if (semAcento(`${p.ref} ${p.nome} ${p.tipo}`).includes(q) || skus.length)
        r.push({ tipo: 'Produto', titulo: `${p.ref} · ${p.nome}`, sub: `${p.preco_atacado != null ? `atacado ${brl(p.preco_atacado)}` : ''}${p.preco_varejo != null ? ` · varejo ${brl(p.preco_varejo)}` : ''}${skus.length && !semAcento(`${p.ref} ${p.nome}`).includes(q) ? ` · ${skus[0].sku}` : ''}`, para: '/produtos', produto: p })
    })
    calc.parceiros.forEach((p) => {
      if (semAcento(`${p.nome} ${p.documento} ${p.cidade} ${p.telefone}`).includes(q))
        r.push({ tipo: 'Cliente', titulo: p.nome, sub: [p.cidade && `${p.cidade}/${p.uf || ''}`, p.telefone, p.canal].filter(Boolean).join(' · '), para: '/clientes' })
    })
    return r.slice(0, 8)
  }, [calc, busca])

  const variacao = calc && calc.fatAnt > 0 ? (calc.fatMes - calc.fatAnt) / calc.fatAnt : null
  const fmtMedida = (v) => (medida === 'valor' ? brlCurto(v) : `${inteiro(v)} pares`)

  return (
    <>
      <header className="page-head painel-head">
        <div>
          <div className="eyebrow">{hoje()}</div>
          <h1>{saudacao()}, {usuario}</h1>
          <p className="painel-sub">Aqui está o resumo da fábrica hoje.</p>
        </div>
        <div className="actions">
          <Link to="/pedidos" className="btn btn-dark"><Icon name="mais" size={16} stroke={2} />Novo pedido</Link>
        </div>
      </header>

      <div className="busca-geral">
        <label className="search">
          <Icon name="busca" size={16} />
          <span className="sr-only">Buscar no sistema</span>
          <input type="search" placeholder="Buscar pedidos, produtos, clientes, códigos…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        {busca.trim().length >= 2 && (
          <div className="busca-resultados card" role="listbox">
            {resultados.length === 0 && <p className="card-sub" style={{ margin: 0, padding: '10px 14px' }}>Nada encontrado para “{busca}”.</p>}
            {resultados.map((r, i) => (
              <Link key={i} to={r.para} className="busca-item" role="option" onClick={() => setBusca('')}>
                {r.produto ? <FotoProduto p={r.produto} size={32} /> : <span className="busca-ico"><Icon name={r.tipo === 'Pedido' ? 'pedidos' : 'clientes'} size={16} /></span>}
                <span className="busca-txt"><b>{r.titulo}</b><small>{r.sub}</small></span>
                <span className="busca-tipo">{r.tipo}</span>
              </Link>
            ))}
          </div>
        )}
      </div>


      {erro && <p className="form-error" role="alert">Não consegui ler o banco: {erro}</p>}

      <section className="painel-kpis" aria-label="Indicadores">
        <Kpi spark={serie?.ps.map((x) => x.valor)} icone="financeiro" rotulo="Faturamento no mês" valor={calc ? brl(calc.fatMes) : '—'}
          nota={calc && (variacao != null
            ? <span className={variacao >= 0 ? 'sobe' : 'desce'}>{variacao >= 0 ? '↑' : '↓'} {Math.abs(Math.round(variacao * 100))}% <em>vs. mês anterior até hoje</em></span>
            : `${inteiro(calc.paresMes)} pares faturados`)} />
        <Kpi icone="pedidos" rotulo="Pedidos em aberto" valor={calc ? inteiro(calc.abertos.length) : '—'} nota={calc && `${inteiro(calc.paresAbertos)} pares · ${brlCurto(calc.valorAbertos)}`} para="/pedidos" link="Ver pedidos" />
        <Kpi icone="producao" rotulo="Produção em andamento" valor={calc ? `${inteiro(calc.paresProducao)} pares` : '—'} nota={calc && `${calc.opsAbertas.length} ordens abertas`} para="/producao" link="Ver produção" />
        <Kpi icone="estoque" rotulo="Em estoque" valor={calc ? `${inteiro(calc.emEstoque)} pares` : '—'} nota={calc && `${calc.ativos} modelos ativos`} para="/estoque" link="Ver estoque" />
        <Kpi icone="entrega" rotulo="Entregas da semana" valor={calc ? `${calc.entregaSemana.length} pedidos` : '—'} nota={calc && `${inteiro(calc.entregaSemana.reduce((t, p) => t + totaisPedido(p).pares, 0))} pares com previsão até domingo`} para="/pedidos" link="Ver detalhes" />
      </section>

      <section className="painel-linha">
        <div className="card card-grafico">
          <div className="card-head">
            <div>
              <h2>Vendas faturadas</h2>
              <div className="card-sub">{serie ? `${fmtMedida(medida === 'valor' ? serie.total : serie.totalPares)} em ${serie.totalPedidos} pedidos · ${periodo === 'semanas' ? 'últimas 12 semanas' : 'últimos 6 meses'}` : ' '}</div>
            </div>
            <div className="painel-filtros">
              <div className="segmented" role="group" aria-label="Medida">
                <button className={medida === 'valor' ? 'on' : ''} onClick={() => setMedida('valor')}>R$</button>
                <button className={medida === 'pares' ? 'on' : ''} onClick={() => setMedida('pares')}>Pares</button>
              </div>
              <div className="segmented" role="group" aria-label="Período">
                <button className={periodo === 'semanas' ? 'on' : ''} onClick={() => setPeriodo('semanas')}>12 semanas</button>
                <button className={periodo === 'meses' ? 'on' : ''} onClick={() => setPeriodo('meses')}>6 meses</button>
              </div>
            </div>
          </div>
          <div className="legenda-graf">{serie?.canais.map((c) => <span key={c.canal}><i style={{ background: c.cor }} />{c.canal}</span>)}</div>
          {serie && <BarrasEmpilhadas altura={330} fmt={medida === 'valor' ? brl : (v) => `${inteiro(v)} pares`} fmtEixo={medida === 'valor' ? (v) => (v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : inteiro(v)) : inteiro}
            series={serie.canais.map((c) => ({ id: c.canal, nome: c.canal, cor: c.cor }))}
            periodos={serie.ps.map((x) => ({ rotulo: x.rotulo, titulo: x.titulo, partes: medida === 'valor' ? x.partes : x.partesPares }))}
            vazio="O gráfico aparece quando houver pedidos faturados no período." />}
        </div>

        <div className="card">
          <div className="card-head">
            <div><h2>Vendas por canal</h2><div className="card-sub">mesmo período do gráfico</div></div>
            <Link to="/indicadores" className="link">Ver mais</Link>
          </div>
          {serie && <Rosca tamanho={170} fmt={medida === 'valor' ? brlCurto : (v) => `${inteiro(v)} pares`} rotuloCentro={medida === 'valor' ? 'faturado' : 'pares'}
            fatias={serie.canais.map((c) => ({ id: c.canal, nome: c.canal, cor: c.cor, valor: medida === 'valor' ? c.valor : c.pares }))} />}
        </div>
      </section>


      <nav className="atalhos" aria-label="Atalhos">
        {[
          ['pedidos', 'Novo pedido', '/pedidos'], ['producao', 'Nova OP', '/producao'], ['estoque', 'Entrada estoque', '/estoque'],
          ['produtos', 'Novo produto', '/produtos'], ['clientes', 'Novo cliente', '/clientes'], ['leitor', 'App vendas', '/app'],
        ].map(([ic, t, to]) => (
          <Link key={t} to={to} className="atalho"><span className="atalho-ico"><Icon name={ic} size={18} /></span>{t}<Icon name="seta" size={14} /></Link>
        ))}
      </nav>

      <section className="painel-linha tres">
        <div className="card">
          <div className="card-head">
            <div><h2>Produção agora</h2><div className="card-sub">{calc ? `${inteiro(calc.paresProducao)} pares em ${calc.opsAbertas.length} OPs` : ' '}</div></div>
            <Link to="/producao" className="link">Ver todas</Link>
          </div>
          {calc && calc.opsAbertas.length === 0 && <p className="card-sub" style={{ margin: 0 }}>Nenhuma OP em aberto. <Link to="/producao" className="link">Criar ordem</Link></p>}
          {calc?.opsAbertas.slice(0, 5).map((o) => {
            const total = o.op_etapas.length || 1
            const feitas = o.op_etapas.filter((e) => e.status === 'concluida').length
            const pct = Math.round((feitas / total) * 100)
            return (
              <div className="op-linha" key={o.id}>
                <FotoProduto p={o.produtos} corId={o.cor_id} size={40} />
                <div className="op-txt"><b>{numeroOP(o.numero)}</b><small>{o.produtos?.ref} · {o.cores?.nome || o.produtos?.nome}</small></div>
                <div className="op-prog">
                  <div className="meter"><i style={{ width: `${pct}%` }} /></div>
                  <small>{pct}% · {inteiro(paresOP(o))} pares{atrasadaOP(o) ? ' · atrasada' : ''}</small>
                </div>
              </div>
            )
          })}
        </div>

        <div className="card">
          <div className="card-head"><h2>Pedidos recentes</h2><Link to="/pedidos" className="link">Ver todos</Link></div>
          {calc && calc.pedidos.length === 0 && <p className="card-sub" style={{ margin: 0 }}>Nenhum pedido ainda. <Link to="/pedidos" className="link">Lançar o primeiro</Link></p>}
          <div className="recentes">
            {calc?.pedidos.slice(0, 6).map((p) => {
              const st = STATUS_PEDIDO[p.status]
              return (
                <Link to="/pedidos" className="recente" key={p.id}>
                  <span className="recente-txt"><b>{numeroPedido(p.numero)}</b><small>{p.parceiros?.nome || 'Sem cliente'} · {p.canal}</small></span>
                  <span className="recente-dir"><b>{brl(totaisPedido(p).total)}</b><span className={`pill ${atrasado(p) ? 'bad' : st?.tom}`}>{atrasado(p) ? 'Atrasado' : st?.label}</span></span>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Alertas e pendências</h2></div>
          {calc && calc.alertas.length === 0 && <p className="card-sub" style={{ margin: 0 }}>Tudo em dia por aqui.</p>}
          {calc?.alertas.map((a) => (
            <Link to={a.para} className="alert-row" key={a.titulo}>
              <span className="alert-num" style={TOM_ALERTA[a.tom]}>{a.n}</span>
              <span style={{ flex: 1 }}><span className="alert-title">{a.titulo}</span><br /><span className="alert-sub">{a.sub}</span></span>
              <Icon name="seta" size={16} />
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}

function Kpi({ icone, rotulo, valor, nota, para, link, spark }) {
  return (
    <div className="card kpi2">
      <span className="kpi2-ico"><Icon name={icone} size={18} /></span>
      <span className="kpi-label">{rotulo}</span>
      <span className="kpi2-valor">{valor}</span>
      <span className="kpi-note">{nota || ' '}</span>
      {spark && <Sparkline valores={spark} cor="#8A5A32" />}
      {para && <Link to={para} className="kpi2-link">{link} →</Link>}
    </div>
  )
}
