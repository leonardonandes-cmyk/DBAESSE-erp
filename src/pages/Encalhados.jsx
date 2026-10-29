import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { FotoProduto } from '../components/FotoProduto.jsx'
import SeletorPeriodo, { periodoPadrao, resolverPeriodo } from '../components/SeletorPeriodo.jsx'
import { brl, brlCurto, dataBR, inteiro, rotuloNum } from '../lib/format.js'
import { listarPedidos } from '../lib/pedidos.js'
import { listarCores, listarProdutos } from '../lib/produtos.js'
import { listarSaldos } from '../lib/estoque.js'
import { listarFichaConsumo } from '../lib/compras.js'
import { custosPorProduto } from '../lib/custos.js'
import { LIMITE_ALERTA, SITUACOES, agrupar, linhasEncalhe } from '../lib/encalhe.js'

/*
  Relatórios › Produtos encalhados.
  Grade com vendas dos últimos 7 dias, 30 dias e do período escolhido, dias sem vender e capital parado.
  +90 dias sem venda (ou nunca vendeu) = ALERTA.
*/
const NIVEIS = [['modelo', 'Modelo'], ['cor', 'Modelo + cor'], ['sku', 'Numeração']]
const isoDia = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '')

export default function Encalhados() {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [periodo, setPeriodo] = useState(() => periodoPadrao('90'))
  const [nivel, setNivel] = useState('cor')
  const [filtro, setFiltro] = useState('todas')
  const [tipo, setTipo] = useState('Todos')
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState({ col: 'situacao', desc: false })

  useEffect(() => {
    Promise.all([listarSaldos(), listarProdutos(), listarPedidos(), listarCores(), listarFichaConsumo().catch(() => [])])
      .then(([saldos, produtos, pedidos, cores, ficha]) => setDados({ saldos, produtos, pedidos, cores, custos: custosPorProduto(ficha, produtos) }))
      .catch((e) => setErro(e.message))
  }, [])

  const per = useMemo(() => resolverPeriodo(periodo), [periodo])
  const corDe = useMemo(() => Object.fromEntries((dados?.cores || []).map((c) => [c.id, c])), [dados])
  const base = useMemo(() => (dados ? linhasEncalhe({ ...dados, per }) : []), [dados, per])
  const tipos = useMemo(() => ['Todos', ...[...new Set(base.map((x) => x.produto.tipo).filter(Boolean))].sort()], [base])

  // agrupa no nível escolhido
  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const filtradas = base.filter((x) => (tipo === 'Todos' || x.produto.tipo === tipo) && (!q || `${x.produto.ref} ${x.produto.nome} ${corDe[x.cor_id]?.nome || ''}`.toLowerCase().includes(q)))
    let l = agrupar(filtradas, nivel)
    if (filtro !== 'todas') l = l.filter((a) => (filtro === 'grave' ? ['alerta', 'nunca'].includes(a.situacao) : a.situacao === filtro))
    const k = ordem.col, dir = ordem.desc ? -1 : 1
    const valor = (a) => (k === 'situacao' ? SITUACOES[a.situacao].ordem * 1e6 - (a.dias ?? 1e5) : k === 'produto' ? a.produto.ref : k === 'dias' ? (a.dias ?? 1e5) : k === 'cobertura' ? (a.cobertura ?? 1e9) : k === 'ultima' ? (a.ultima?.getTime() ?? 0) : a[k])
    return l.sort((a, b) => { const x = valor(a), y = valor(b); return (x > y ? 1 : x < y ? -1 : 0) * dir })
  }, [base, nivel, filtro, tipo, busca, ordem, corDe])

  // KPIs e alerta olham MODELO + COR (uma numeração parada sozinha não acusa o modelo inteiro)
  const porCor = useMemo(() => agrupar(base, 'cor'), [base])
  const resumo = useMemo(() => {
    const s = { total: { pares: 0, valor: 0 }, alerta: { pares: 0, valor: 0, n: 0 }, nunca: { pares: 0, valor: 0, n: 0 }, atencao: { pares: 0, valor: 0, n: 0 }, ok: { pares: 0, valor: 0, n: 0 }, v7: 0, v30: 0 }
    porCor.forEach((x) => {
      s.total.pares += x.saldo; s.total.valor += x.valor
      s[x.situacao].pares += x.saldo; s[x.situacao].valor += x.valor; s[x.situacao].n += 1
      s.v7 += x.v7; s.v30 += x.v30
    })
    return s
  }, [porCor])
  const grave = { pares: resumo.alerta.pares + resumo.nunca.pares, valor: resumo.alerta.valor + resumo.nunca.valor, n: resumo.alerta.n + resumo.nunca.n }

  function exportar() {
    const esc = (v) => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
    const cab = ['REF', 'Modelo', 'Tipo', 'Cor', 'Numeração', 'Estoque (pares)', 'Vendas 7 dias', 'Vendas 30 dias', `Vendas ${per.rotulo}`, 'Última venda', 'Dias sem vender', 'Situação', 'Cobertura (dias)', 'Capital parado (R$)']
    const ls = linhas.map((a) => [a.produto.ref, a.produto.nome, a.produto.tipo || '', a.cor_id ? corDe[a.cor_id]?.nome || '' : '', a.numero ? rotuloNum(a.numero) : a.nums.map(rotuloNum).join(' '), a.saldo, a.v7, a.v30, a.vPer, a.ultima ? dataBR(isoDia(a.ultima)) : 'nunca', a.dias ?? '', SITUACOES[a.situacao].label, a.cobertura != null ? Math.round(a.cobertura) : '', a.valor.toFixed(2).replace('.', ',')])
    const csv = '﻿' + [cab, ...ls].map((l) => l.map(esc).join(';')).join('\n')
    const el = document.createElement('a')
    el.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    el.download = `produtos-encalhados-${isoDia(new Date())}.csv`; el.click(); setTimeout(() => URL.revokeObjectURL(el.href), 1000)
  }

  const Th = ({ col, children, r }) => (
    <th className={`${r ? 'r' : ''} th-ordem ${ordem.col === col ? 'on' : ''}`} onClick={() => setOrdem((o) => ({ col, desc: o.col === col ? !o.desc : !['produto', 'situacao', 'cobertura'].includes(col) }))}>
      {children}{ordem.col === col ? (ordem.desc ? ' ↓' : ' ↑') : ''}
    </th>
  )

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Estoque · giro dos produtos</div>
          <h1>Produtos encalhados</h1>
        </div>
        <div className="actions">
          <button className="btn" onClick={exportar} disabled={!linhas.length}><Icon name="relatorios" size={16} />Exportar (Excel)</button>
        </div>
      </header>

      {erro && <p className="form-error" role="alert">Não consegui carregar: {erro}</p>}
      {!dados && !erro && <p className="card-sub">Carregando…</p>}

      {dados && <>
        {grave.pares > 0 && (
          <button className="encalhe-alerta" onClick={() => { setFiltro('grave'); setOrdem({ col: 'valor', desc: true }) }}>
            <span className="encalhe-alerta-ic"><Icon name="alerta" size={20} /></span>
            <span><b>{grave.n} produto(s) (modelo + cor) sem venda há mais de {LIMITE_ALERTA} dias</b> ou que nunca venderam · {inteiro(grave.pares)} pares parados · {brl(grave.valor)} em estoque</span>
            <span className="encalhe-alerta-cta">ver lista <Icon name="seta" size={14} /></span>
          </button>
        )}

        <section className="kpis-cor">
          <Kpi cor="#151515" rotulo="Em estoque" valor={`${inteiro(resumo.total.pares)} pares`} nota={`${brl(resumo.total.valor)} em produtos`} />
          <Kpi cor="#c2321f" rotulo="Alerta · +90 dias" valor={`${inteiro(resumo.alerta.pares)} pares`} nota={`${resumo.alerta.n} modelo/cor · ${brlCurto(resumo.alerta.valor)}`} on={filtro === 'alerta'} onClick={() => setFiltro(filtro === 'alerta' ? 'todas' : 'alerta')} />
          <Kpi cor="#6b2fb3" rotulo="Nunca vendeu" valor={`${inteiro(resumo.nunca.pares)} pares`} nota={`${resumo.nunca.n} modelo/cor · ${brlCurto(resumo.nunca.valor)}`} on={filtro === 'nunca'} onClick={() => setFiltro(filtro === 'nunca' ? 'todas' : 'nunca')} />
          <Kpi cor="#b46b00" rotulo="Atenção · 60–89 dias" valor={`${inteiro(resumo.atencao.pares)} pares`} nota={`${resumo.atencao.n} modelo/cor · ${brlCurto(resumo.atencao.valor)}`} on={filtro === 'atencao'} onClick={() => setFiltro(filtro === 'atencao' ? 'todas' : 'atencao')} />
          <Kpi cor="#2f7a52" rotulo="Vendas recentes" valor={`${inteiro(resumo.v7)} pares`} nota={`7 dias · ${inteiro(resumo.v30)} em 30 dias`} />
        </section>

        <div className="ind-filtros card">
          <div className="field"><span>Período (coluna "Período")</span><SeletorPeriodo valor={periodo} onChange={setPeriodo} /></div>
          <div className="field livre"><span>Ver por</span>
            <div className="segmented" role="group">{NIVEIS.map(([k, l]) => <button key={k} className={nivel === k ? 'on' : ''} onClick={() => setNivel(k)}>{l}</button>)}</div>
          </div>
          <div className="field livre"><span>Situação</span>
            <div className="segmented" role="group">
              <button className={filtro === 'todas' ? 'on' : ''} onClick={() => setFiltro('todas')}>Todas</button>
              <button className={filtro === 'grave' ? 'on' : ''} onClick={() => setFiltro('grave')}><i className="ponto" style={{ background: SITUACOES.alerta.cor }} />Em alerta</button>
              <button className={filtro === 'atencao' ? 'on' : ''} onClick={() => setFiltro('atencao')}><i className="ponto" style={{ background: SITUACOES.atencao.cor }} />Atenção</button>
              <button className={filtro === 'ok' ? 'on' : ''} onClick={() => setFiltro('ok')}><i className="ponto" style={{ background: SITUACOES.ok.cor }} />Girando</button>
            </div>
          </div>
          <label className="field"><span>Tipo</span>
            <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>{tipos.map((t) => <option key={t}>{t}</option>)}</select>
          </label>
          <label className="field"><span>Buscar</span>
            <input className="input" type="search" placeholder="REF, modelo ou cor" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </label>
        </div>

        <section className="card card-flush">
          <div className="card-head pad">
            <div><h2>Giro por {nivel === 'modelo' ? 'modelo' : nivel === 'cor' ? 'modelo e cor' : 'numeração'}</h2>
              <div className="card-sub">{inteiro(linhas.length)} linhas com estoque · coluna Período = {per.rotulo} · clique no título para ordenar</div></div>
          </div>
          <div className="table-wrap">
            <table className="tabela-mapa tabela-encalhe">
              <thead className="tinted">
                <tr>
                  <Th col="produto">Produto</Th>
                  <Th col="saldo" r>Estoque</Th>
                  <Th col="v7" r>7 dias</Th>
                  <Th col="v30" r>30 dias</Th>
                  <Th col="vPer" r>Período</Th>
                  <Th col="ultima" r>Última venda</Th>
                  <Th col="situacao">Dias sem vender</Th>
                  <Th col="cobertura" r>Cobertura</Th>
                  <Th col="valor" r>Capital parado</Th>
                </tr>
              </thead>
              <tbody>
                {linhas.slice(0, 400).map((a) => {
                  const s = SITUACOES[a.situacao], cor = a.cor_id ? corDe[a.cor_id] : null
                  return (
                    <tr key={a.id} className={a.situacao === 'alerta' || a.situacao === 'nunca' ? 'linha-alerta' : ''}>
                      <td>
                        <div className="prod-cell"><FotoProduto p={a.produto} corId={a.cor_id || undefined} size={36} />
                          <div><b>{a.produto.ref}</b> <span className="faint">{a.produto.nome}</span>
                            <span className="enc-sub">
                              {cor && <><i className="enc-cor" style={{ background: cor.hex || '#ccc' }} />{cor.nome}</>}
                              {a.numero ? <> · nº {rotuloNum(a.numero)}</> : a.nums.length > 0 && <> · {a.nums.length} numeração(ões)</>}
                              {a.produto.tipo && <> · {a.produto.tipo}</>}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="r"><b>{inteiro(a.saldo)}</b></td>
                      <td className="r">{a.v7 ? inteiro(a.v7) : <span className="faint">0</span>}</td>
                      <td className="r">{a.v30 ? inteiro(a.v30) : <span className="faint">0</span>}</td>
                      <td className="r">{a.vPer ? inteiro(a.vPer) : <span className="faint">0</span>}</td>
                      <td className="r faint">{a.ultima ? dataBR(isoDia(a.ultima)) : '—'}</td>
                      <td><span className="enc-chip" style={{ color: s.cor, background: s.fundo }}>{a.dias == null ? 'nunca vendeu' : `${inteiro(a.dias)} dias`}</span></td>
                      <td className="r">{a.cobertura == null ? <span className="faint">sem giro</span> : `${inteiro(Math.round(a.cobertura))} dias`}</td>
                      <td className="r"><b>{brl(a.valor)}</b>{!a.comCusto && <span className="faint" title="Sem ficha técnica: usando o preço de atacado"> *</span>}</td>
                    </tr>
                  )
                })}
                {linhas.length === 0 && <tr><td colSpan={9} className="vazio">Nada nesta seleção.</td></tr>}
              </tbody>
            </table>
          </div>
          {linhas.length > 400 && <p className="card-sub" style={{ padding: '10px 22px' }}>Mostrando 400 de {inteiro(linhas.length)} linhas — use os filtros ou exporte para ver tudo.</p>}
        </section>
        <p className="card-sub" style={{ margin: 0 }}>Vendas = pedidos faturados ou entregues. Dias sem vender = desde a última venda daquele produto (qualquer data). Cobertura = quantos dias o estoque dura no ritmo dos últimos 30 dias. Capital parado = estoque × custo da ficha técnica (* sem ficha: preço de atacado). Alerta a partir de {LIMITE_ALERTA} dias.</p>
      </>}
    </>
  )
}

function Kpi({ cor, rotulo, valor, nota, on, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={`card kpi-cor ${onClick ? 'kpi-clicavel' : ''} ${on ? 'on' : ''}`} style={{ '--kc': cor }} onClick={onClick}>
      <span className="kpi-label">{rotulo}</span>
      <span className="kpi2-valor">{valor}</span>
      <span className="kpi-note"><em>{nota}</em></span>
    </Tag>
  )
}
