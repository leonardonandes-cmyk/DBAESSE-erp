import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import MapaBrasil from '../components/MapaBrasil.jsx'
import { FotoProduto } from '../components/FotoProduto.jsx'
import SeletorPeriodo, { periodoAnterior, periodoPadrao, resolverPeriodo } from '../components/SeletorPeriodo.jsx'
import { brl, brlCurto, dataBR, inteiro } from '../lib/format.js'
import { listarPedidos, totaisPedido } from '../lib/pedidos.js'
import { listarParceiros } from '../lib/parceiros.js'
import { listarProdutos } from '../lib/produtos.js'
import { NOME_REGIAO, REGIOES, carregarGeo, chaveCidade, regiaoDe } from '../lib/geo.js'
import { MODALIDADES, modalidadeDoCanal } from '../lib/modalidades.js'

/*
  Relatórios › Mapa de clientes.
  Onde estão os clientes (cadastro: cidade/UF) e quanto cada praça compra (pedidos faturados ou entregues, pela data do pedido).
  - Ativo = comprou nos últimos N dias (N editável, padrão 90) · Inativo = já comprou, parou há mais de N dias · Nunca comprou = cadastrado sem pedido.
  - Modalidade (Atacado, Variado, Drop, Marketplace, Varejo): do cliente pelo canal do cadastro; da venda pelo canal do pedido.
*/
const VENDIDO = ['faturado', 'entregue']
const TIPOS_CLIENTE = Object.fromEntries(MODALIDADES.map((m) => [m.id, m]))
const COR_TODOS = '#1f6fd6'
const tipoDoParceiro = (p) => (p?.canal ? modalidadeDoCanal(p.canal) : p?.tipos?.includes('revendedora') ? 'variado' : 'atacado')
const tipoDaVenda = (canal, p) => (canal ? modalidadeDoCanal(canal) : tipoDoParceiro(p))
const ehCliente = (p) => p.tipos?.some((t) => t === 'cliente' || t === 'revendedora')
const DIAS_INATIVO = [60, 90, 120, 180]
const lerInativo = () => { try { return Number(localStorage.getItem('mapa.inativo')) || 90 } catch { return 90 } }
const isoDia = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '')

function novoAgg(id, nome, extra = {}) {
  return { id, nome, ...extra, clientes: 0, ativos: 0, inativos: 0, nunca: 0, compradores: new Set(), pedidos: 0, pares: 0, valor: 0, valorAnt: 0, ultima: null, tiposProd: {}, modelos: {}, canais: {}, listaInativos: [] }
}

export default function MapaClientes() {
  const [geo, setGeo] = useState(null)
  const [parceiros, setParceiros] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [produtos, setProdutos] = useState([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [periodo, setPeriodo] = useState(() => periodoPadrao('90'))
  const [reg, setReg] = useState('BR')
  const [tipo, setTipo] = useState('todos')
  const [medida, setMedida] = useState('valor')
  const [visao, setVisao] = useState('cidades')
  const [sel, setSel] = useState(null)
  const [nivel, setNivel] = useState('estado') // tabela: regiao | estado | cidade
  const [ufTabela, setUfTabela] = useState(null)
  const [ordem, setOrdem] = useState({ col: 'valor', desc: true })
  const [diasInativo, setDiasInativo] = useState(lerInativo)

  useEffect(() => {
    Promise.all([carregarGeo(), listarParceiros(), listarPedidos(), listarProdutos()])
      .then(([g, pa, pe, pr]) => { setGeo(g); setParceiros(pa); setPedidos(pe); setProdutos(pr) })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [])
  useEffect(() => { try { localStorage.setItem('mapa.inativo', String(diasInativo)) } catch { /* sem armazenamento */ } }, [diasInativo])
  useEffect(() => { setSel(null); setUfTabela(null) }, [reg])

  const per = useMemo(() => resolverPeriodo(periodo), [periodo])
  const cor = tipo === 'todos' ? COR_TODOS : TIPOS_CLIENTE[tipo].cor

  const r = useMemo(() => {
    if (!geo) return null
    const ant = periodoAnterior(per)
    const limiteAtivo = new Date(); limiteAtivo.setHours(0, 0, 0, 0); limiteAtivo.setDate(limiteAtivo.getDate() - diasInativo)
    const skuProd = {}; produtos.forEach((p) => p.skus.forEach((s) => { skuProd[s.id] = p }))
    const porId = {}; parceiros.forEach((p) => { porId[p.id] = p })

    // onde fica cada cliente
    const local = (p) => {
      if (!p?.cidade || !p?.uf) return null
      const c = geo.cidades[chaveCidade(p.cidade, p.uf)]
      return c ? { ...c, id: chaveCidade(c.nome, c.uf), reg: regiaoDe(c.uf) } : null
    }
    const naReg = (uf) => reg === 'BR' || REGIOES[reg].includes(uf)

    const cidades = {}, estados = {}, regioes = {}
    const aggsDe = (l) => [
      cidades[l.id] ||= novoAgg(l.id, l.nome, { uf: l.uf, reg: l.reg, x: l.x, y: l.y }),
      estados[l.uf] ||= novoAgg(l.uf, geo.estados[l.uf]?.nome || l.uf, { uf: l.uf, reg: l.reg }),
      regioes[l.reg] ||= novoAgg(l.reg, NOME_REGIAO[l.reg], { reg: l.reg }),
    ]
    const total = novoAgg('BR', NOME_REGIAO[reg])
    let semLocal = 0, semLocalValor = 0

    // última compra de cada cliente (qualquer data) — para ativo/inativo
    const ultimaDe = {}
    pedidos.forEach((pe) => {
      if (!VENDIDO.includes(pe.status) || !pe.parceiro_id) return
      const d = new Date(pe.criado_em)
      if (!ultimaDe[pe.parceiro_id] || d > ultimaDe[pe.parceiro_id]) ultimaDe[pe.parceiro_id] = d
    })

    // cadastro: clientes, ativos, inativos, nunca compraram
    parceiros.filter(ehCliente).forEach((p) => {
      if (p.ativo === false) return
      if (tipo !== 'todos' && tipoDoParceiro(p) !== tipo) return
      const l = local(p)
      if (!l) { if (naReg(p.uf)) semLocal += 1; return }
      if (!naReg(l.uf)) return
      const u = ultimaDe[p.id]
      const situ = !u ? 'nunca' : u >= limiteAtivo ? 'ativos' : 'inativos'
      ;[...aggsDe(l), total].forEach((a) => {
        a.clientes += 1; a[situ] += 1
        if (situ === 'inativos') a.listaInativos.push({ id: p.id, nome: p.nome, ultima: u, telefone: p.telefone, cidade: l.nome, uf: l.uf })
      })
    })

    // vendas do período (e do anterior, para o crescimento)
    pedidos.forEach((pe) => {
      if (!VENDIDO.includes(pe.status)) return
      const d = new Date(pe.criado_em)
      const noAtual = d >= per.ini && d <= per.fim, noAnt = d >= ant.ini && d <= ant.fim
      if (!noAtual && !noAnt) return
      const p = porId[pe.parceiro_id]
      const tv = tipoDaVenda(pe.canal, p)
      if (tipo !== 'todos' && tv !== tipo) return
      const t = totaisPedido(pe)
      const l = local(p)
      if (!l) { if (noAtual && (!p?.uf || naReg(p.uf))) semLocalValor += t.total; return }
      if (!naReg(l.uf)) return
      const alvos = [...aggsDe(l), total]
      if (noAnt) { alvos.forEach((a) => { a.valorAnt += t.total }); return }
      const f = t.bruto ? t.total / t.bruto : 1
      alvos.forEach((a) => {
        a.pedidos += 1; a.pares += t.pares; a.valor += t.total
        if (pe.parceiro_id) a.compradores.add(pe.parceiro_id)
        if (!a.ultima || d > a.ultima) a.ultima = d
        a.canais[tv] = (a.canais[tv] || 0) + t.total
        ;(pe.pedido_itens || []).forEach((i) => {
          const pr = skuProd[i.sku_id]; if (!pr) return
          const v = i.quantidade * Number(i.preco_unit) * f
          const tp = pr.tipo || 'Sem tipo'
          a.tiposProd[tp] = (a.tiposProd[tp] || 0) + i.quantidade
          const m = (a.modelos[pr.id] ||= { produto: pr, pares: 0, valor: 0 }); m.pares += i.quantidade; m.valor += v
        })
      })
    })

    const fim = (a) => {
      const comp = a.compradores.size
      return {
        ...a, compradores: comp,
        precoMedio: a.pares ? a.valor / a.pares : 0, ticket: a.pedidos ? a.valor / a.pedidos : 0, paresCliente: comp ? a.pares / comp : 0,
        cresc: a.valorAnt > 0 ? (a.valor - a.valorAnt) / a.valorAnt : null,
        part: total.valor ? a.valor / total.valor : 0,
      }
    }
    total.part = 1
    const T = fim(total); T.part = 1
    return {
      total: T, semLocal, semLocalValor,
      cidades: Object.values(cidades).map(fim), estados: Object.values(estados).map(fim), regioes: Object.values(regioes).map(fim),
    }
  }, [geo, parceiros, pedidos, produtos, per, reg, tipo, diasInativo])

  const val = (a) => (medida === 'valor' ? a.valor : medida === 'pares' ? a.pares : a.clientes)
  const fmt = (v) => (medida === 'valor' ? brlCurto(v) : medida === 'pares' ? `${inteiro(v)} pares` : `${inteiro(v)} clientes`)

  const pontos = useMemo(() => (r ? r.cidades.map((c) => ({ id: c.id, nome: c.nome, uf: c.uf, x: c.x, y: c.y, valor: val(c), detalhe: `${c.clientes} clientes (${c.ativos} ativos) · ${inteiro(c.pares)} pares` })) : []), [r, medida]) // eslint-disable-line react-hooks/exhaustive-deps
  const porUf = useMemo(() => { const o = {}; r?.estados.forEach((e) => { o[e.id] = val(e) }); return o }, [r, medida]) // eslint-disable-line react-hooks/exhaustive-deps
  const detalheUf = useMemo(() => { const o = {}; r?.estados.forEach((e) => { o[e.id] = `${e.clientes} clientes (${e.ativos} ativos) · ${inteiro(e.pares)} pares` }); return o }, [r]) // eslint-disable-line react-hooks/exhaustive-deps

  const selecionado = !r || !sel ? null : sel.tipo === 'cidade' ? r.cidades.find((c) => c.id === sel.id) : r.estados.find((e) => e.id === sel.id)
  const foco = selecionado || r?.total

  // tabela
  const linhas = useMemo(() => {
    if (!r) return []
    let l = nivel === 'regiao' ? r.regioes : nivel === 'estado' ? r.estados : r.cidades.filter((c) => !ufTabela || c.uf === ufTabela)
    const k = ordem.col
    return [...l].sort((a, b) => {
      const x = k === 'nome' ? a.nome : (a[k] ?? -Infinity), y = k === 'nome' ? b.nome : (b[k] ?? -Infinity)
      if (k === 'nome') return ordem.desc ? y.localeCompare(x) : x.localeCompare(y)
      return ordem.desc ? (y > x ? 1 : y < x ? -1 : 0) : (x > y ? 1 : x < y ? -1 : 0)
    })
  }, [r, nivel, ufTabela, ordem])

  function exportar() {
    const esc = (v) => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
    const n2 = (v) => Number(v || 0).toFixed(2).replace('.', ',')
    const cab = ['Local', 'UF', 'Região', 'Clientes', 'Ativos', 'Inativos', 'Nunca compraram', 'Pedidos', 'Pares', 'Faturamento', 'Participação %', 'Preço médio do par', 'Ticket médio', 'Pares por cliente', 'Crescimento %', 'Última compra']
    const ls = linhas.map((a) => [a.nome, a.uf || '', NOME_REGIAO[a.reg] || '', a.clientes, a.ativos, a.inativos, a.nunca, a.pedidos, a.pares, n2(a.valor), n2(a.part * 100), n2(a.precoMedio), n2(a.ticket), n2(a.paresCliente), a.cresc == null ? '' : n2(a.cresc * 100), a.ultima ? dataBR(isoDia(a.ultima)) : ''])
    const csv = '﻿' + [cab, ...ls].map((l) => l.map(esc).join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `mapa-clientes-${nivel}-${isoDia(per.ini)}-a-${isoDia(per.fim)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const Th = ({ col, children, r: dir }) => (
    <th className={`${dir ? 'r' : ''} th-ordem ${ordem.col === col ? 'on' : ''}`} onClick={() => setOrdem((o) => ({ col, desc: o.col === col ? !o.desc : col !== 'nome' }))}>
      {children}{ordem.col === col ? (ordem.desc ? ' ↓' : ' ↑') : ''}
    </th>
  )

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Relatórios · {per.rotulo}</div>
          <h1>Mapa de clientes</h1>
        </div>
        <div className="actions">
          <button className="btn" onClick={exportar} disabled={!linhas.length}><Icon name="relatorios" size={16} />Exportar tabela (Excel)</button>
        </div>
      </header>

      <div className="segmented lojas-abas" role="tablist" aria-label="Região">
        {['BR', 'N', 'NE', 'CO', 'SE', 'S'].map((k) => <button key={k} className={reg === k ? 'on' : ''} onClick={() => setReg(k)}>{NOME_REGIAO[k]}</button>)}
      </div>

      <div className="ind-filtros card">
        <div className="field"><span>Período</span><SeletorPeriodo valor={periodo} onChange={setPeriodo} /></div>
        <div className="field livre"><span>Modalidade</span>
          <div className="segmented" role="group" aria-label="Modalidade">
            <button className={tipo === 'todos' ? 'on' : ''} onClick={() => setTipo('todos')}>Todos</button>
            {Object.entries(TIPOS_CLIENTE).map(([k, t]) => <button key={k} className={tipo === k ? 'on' : ''} onClick={() => setTipo(k)}><i className="ponto" style={{ background: t.cor }} />{t.label}</button>)}
          </div>
        </div>
        <div className="field livre"><span>Medir por</span>
          <div className="segmented" role="group" aria-label="Medida">
            {[['valor', 'R$'], ['pares', 'Pares'], ['clientes', 'Clientes']].map(([k, l]) => <button key={k} className={medida === k ? 'on' : ''} onClick={() => setMedida(k)}>{l}</button>)}
          </div>
        </div>
        <label className="field"><span>Inativo após</span>
          <select className="input" value={diasInativo} onChange={(e) => setDiasInativo(Number(e.target.value))}>
            {DIAS_INATIVO.map((d) => <option key={d} value={d}>{d} dias sem comprar</option>)}
          </select>
        </label>
      </div>

      {erro && <p className="form-error" role="alert">Não consegui carregar: {erro}</p>}
      {carregando && <p className="card-sub">Carregando mapa…</p>}

      {r && <>
        <section className="kpis-cor">
          <Kpi cor="#1f6fd6" rotulo="Clientes" valor={inteiro(r.total.clientes)} nota={`${inteiro(r.total.ativos)} ativos · ${inteiro(r.total.inativos)} inativos · ${inteiro(r.total.nunca)} nunca compraram`} />
          <Kpi cor="#1baf7a" rotulo="Faturamento" valor={brl(r.total.valor)} v={r.total.cresc} />
          <Kpi cor="#6250d6" rotulo="Pares vendidos" valor={inteiro(r.total.pares)} nota={`${inteiro(r.total.pedidos)} pedidos`} />
          <Kpi cor="#eb6834" rotulo="Preço médio do par" valor={brl(r.total.precoMedio)} nota={`ticket médio ${brl(r.total.ticket)}`} />
          <Kpi cor="#8A5A32" rotulo="Presença" valor={`${r.cidades.filter((c) => c.clientes || c.pedidos).length} cidades`} nota={`${r.estados.filter((e) => e.clientes || e.pedidos).length} de ${reg === 'BR' ? 27 : REGIOES[reg].length} estados`} />
        </section>

        <section className="mapa-linha">
          <div className="card mapa-card">
            <div className="card-head">
              <div><h2>Onde estão os clientes</h2><div className="card-sub">{visao === 'cidades' ? `esfera = ${medida === 'valor' ? 'faturamento' : medida === 'pares' ? 'pares' : 'nº de clientes'} da cidade · relevo = estado · clique numa esfera` : `estado mais alto = mais ${medida === 'valor' ? 'venda' : medida === 'pares' ? 'pares' : 'clientes'} · clique num estado`}</div></div>
              <div className="segmented" role="group" aria-label="Visão do mapa">
                <button className={visao === 'cidades' ? 'on' : ''} onClick={() => { setVisao('cidades'); setSel(null) }}>Cidades</button>
                <button className={visao === 'estados' ? 'on' : ''} onClick={() => { setVisao('estados'); setSel(null) }}>Estados</button>
              </div>
            </div>
            <MapaBrasil geo={geo} reg={reg} visao={visao} pontos={pontos} porUf={porUf} detalheUf={detalheUf} cor={cor} sel={sel} onSel={setSel} fmt={fmt} />
            {(r.semLocal > 0 || r.semLocalValor > 0) && (
              <p className="card-sub mapa-aviso"><Icon name="alerta" size={14} /> {r.semLocal > 0 ? `${r.semLocal} cliente(s) sem cidade/UF válida no cadastro` : ''}{r.semLocal > 0 && r.semLocalValor > 0 ? ' · ' : ''}{r.semLocalValor > 0 ? `${brl(r.semLocalValor)} em vendas sem localização` : ''} — não aparecem no mapa.</p>
            )}
          </div>

          <Detalhe a={foco} titulo={selecionado ? (sel.tipo === 'cidade' ? `${selecionado.nome}/${selecionado.uf}` : selecionado.nome) : `Total · ${NOME_REGIAO[reg]}`}
            onFechar={selecionado ? () => setSel(null) : null} diasInativo={diasInativo} />
        </section>

        <section className="card card-flush">
          <div className="card-head pad">
            <div>
              <h2>Relatório por {nivel === 'regiao' ? 'região' : nivel === 'estado' ? 'estado' : 'cidade'}</h2>
              <div className="card-sub">{NOME_REGIAO[reg]}{ufTabela ? ` · ${r.estados.find((e) => e.id === ufTabela)?.nome}` : ''} · clique no título da coluna para ordenar{nivel !== 'cidade' ? ' · clique na linha para abrir' : ''}</div>
            </div>
            <div className="row-gap">
              {ufTabela && <button className="link-btn" onClick={() => setUfTabela(null)}>todas as cidades</button>}
              <div className="segmented" role="group" aria-label="Nível">
                {reg === 'BR' && <button className={nivel === 'regiao' ? 'on' : ''} onClick={() => { setNivel('regiao'); setUfTabela(null) }}>Regiões</button>}
                <button className={nivel === 'estado' ? 'on' : ''} onClick={() => { setNivel('estado'); setUfTabela(null) }}>Estados</button>
                <button className={nivel === 'cidade' ? 'on' : ''} onClick={() => setNivel('cidade')}>Cidades</button>
              </div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="tabela-mapa">
              <thead className="tinted">
                <tr>
                  <Th col="nome">{nivel === 'regiao' ? 'Região' : nivel === 'estado' ? 'Estado' : 'Cidade'}</Th>
                  <Th col="clientes" r>Clientes</Th><Th col="ativos" r>Ativos</Th><Th col="inativos" r>Inativos</Th><Th col="nunca" r>Nunca comp.</Th>
                  <Th col="pedidos" r>Pedidos</Th><Th col="pares" r>Pares</Th><Th col="valor" r>Faturamento</Th><Th col="part" r>Part.</Th>
                  <Th col="precoMedio" r>Preço médio</Th><Th col="ticket" r>Ticket</Th><Th col="paresCliente" r>Pares/cliente</Th><Th col="cresc" r>Cresc.</Th><Th col="ultima" r>Última compra</Th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((a) => (
                  <tr key={a.id} className={nivel !== 'cidade' ? 'clicavel' : ''} onClick={() => {
                    if (nivel === 'regiao') { setReg(a.id); setNivel('estado') }
                    else if (nivel === 'estado') { setUfTabela(a.id); setNivel('cidade'); setSel({ tipo: 'estado', id: a.id }); setVisao('estados') }
                    else { setVisao('cidades'); setSel({ tipo: 'cidade', id: a.id }) }
                  }}>
                    <td><b>{a.nome}</b>{nivel === 'cidade' && <span className="faint">/{a.uf}</span>}{nivel === 'estado' && <span className="faint"> · {NOME_REGIAO[a.reg]}</span>}</td>
                    <td className="r">{inteiro(a.clientes)}</td>
                    <td className="r"><span className="t-ok">{inteiro(a.ativos)}</span></td>
                    <td className="r">{a.inativos ? <span className="t-bad">{inteiro(a.inativos)}</span> : '0'}</td>
                    <td className="r faint">{inteiro(a.nunca)}</td>
                    <td className="r">{inteiro(a.pedidos)}</td>
                    <td className="r">{inteiro(a.pares)}</td>
                    <td className="r"><b>{brl(a.valor)}</b></td>
                    <td className="r"><span className="part"><i style={{ width: `${a.part * 100}%` }} /></span>{Math.round(a.part * 100)}%</td>
                    <td className="r">{a.pares ? brl(a.precoMedio) : '—'}</td>
                    <td className="r">{a.pedidos ? brl(a.ticket) : '—'}</td>
                    <td className="r">{a.compradores ? a.paresCliente.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'}</td>
                    <td className="r">{a.cresc == null ? <span className="faint">—</span> : <span className={`chip-var ${a.cresc >= 0 ? 'sobe' : 'desce'}`}>{a.cresc >= 0 ? '↑' : '↓'} {Math.abs(Math.round(a.cresc * 100))}%</span>}</td>
                    <td className="r faint">{a.ultima ? dataBR(isoDia(a.ultima)) : '—'}</td>
                  </tr>
                ))}
                {linhas.length === 0 && <tr><td colSpan={14} className="vazio">Nenhum cliente com cidade cadastrada nesta seleção.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <p className="card-sub" style={{ margin: 0 }}>Vendas = pedidos faturados ou entregues, pela data do pedido, no período escolhido. Clientes ativos/inativos olham a última compra de cada cliente (qualquer data). Crescimento compara com o período anterior de mesmo tamanho. Localização = cidade/UF do cadastro do cliente.</p>
      </>}
    </>
  )
}

function Kpi({ cor, rotulo, valor, nota, v }) {
  return (
    <div className="card kpi-cor" style={{ '--kc': cor }}>
      <span className="kpi-label">{rotulo}</span>
      <span className="kpi2-valor">{valor}</span>
      <span className="kpi-note">
        {v !== undefined ? (v != null ? <span className={`chip-var ${v >= 0 ? 'sobe' : 'desce'}`}>{v >= 0 ? '↑' : '↓'} {Math.abs(Math.round(v * 100))}%</span> : <span className="chip-var neutro">sem base</span>) : null}
        {v !== undefined ? <em> vs. período anterior</em> : <em>{nota}</em>}
      </span>
    </div>
  )
}

function Detalhe({ a, titulo, onFechar, diasInativo }) {
  if (!a) return null
  const canais = Object.entries(a.canais).sort((x, y) => y[1] - x[1])
  const totCan = canais.reduce((t, [, v]) => t + v, 0)
  const tiposP = Object.entries(a.tiposProd).sort((x, y) => y[1] - x[1]).slice(0, 4)
  const maxTp = Math.max(1, ...tiposP.map(([, v]) => v))
  const modelos = Object.values(a.modelos).sort((x, y) => y.pares - x.pares).slice(0, 3)
  const inativos = [...a.listaInativos].sort((x, y) => (y.ultima || 0) - (x.ultima || 0)).slice(0, 6)
  return (
    <aside className="card mapa-detalhe">
      <div className="card-head" style={{ marginBottom: 10 }}>
        <div><div className="eyebrow">{onFechar ? 'Selecionado' : 'Visão geral'}</div><h2 style={{ marginTop: 4 }}>{titulo}</h2></div>
        {onFechar && <button className="btn btn-sm icon-btn" onClick={onFechar} aria-label="Fechar"><Icon name="fechar" size={16} /></button>}
      </div>
      <div className="det-grande">{brl(a.valor)}{a.cresc != null && <span className={`chip-var ${a.cresc >= 0 ? 'sobe' : 'desce'}`}>{a.cresc >= 0 ? '↑' : '↓'} {Math.abs(Math.round(a.cresc * 100))}%</span>}</div>
      <div className="det-grid">
        <div><span>Pares</span><b>{inteiro(a.pares)}</b></div>
        <div><span>Pedidos</span><b>{inteiro(a.pedidos)}</b></div>
        <div><span>Preço médio</span><b>{a.pares ? brl(a.precoMedio) : '—'}</b></div>
        <div><span>Ticket</span><b>{a.pedidos ? brl(a.ticket) : '—'}</b></div>
      </div>

      <div className="det-bloco">
        <h3>Clientes</h3>
        <div className="det-situ">
          <div className="ok"><b>{a.ativos}</b><span>ativos</span></div>
          <div className="bad"><b>{a.inativos}</b><span>inativos</span></div>
          <div><b>{a.nunca}</b><span>nunca compraram</span></div>
        </div>
      </div>

      {canais.length > 0 && <div className="det-bloco">
        <h3>De onde vem a venda</h3>
        <div className="det-barra">{canais.map(([k, v]) => <i key={k} style={{ width: `${(v / totCan) * 100}%`, background: TIPOS_CLIENTE[k]?.cor }} title={`${TIPOS_CLIENTE[k]?.label}: ${brl(v)}`} />)}</div>
        <div className="det-leg">{canais.map(([k, v]) => <span key={k}><i style={{ background: TIPOS_CLIENTE[k]?.cor }} />{TIPOS_CLIENTE[k]?.label} {Math.round((v / totCan) * 100)}%</span>)}</div>
      </div>}

      {tiposP.length > 0 && <div className="det-bloco">
        <h3>O que mais sai (pares)</h3>
        {tiposP.map(([k, v]) => (
          <div key={k} className="det-tp"><span>{k}</span><span className="hbar-trilho"><i style={{ width: `${(v / maxTp) * 100}%`, background: '#1f6fd6' }} /></span><b>{inteiro(v)}</b></div>
        ))}
        {modelos.length > 0 && <div className="det-modelos">{modelos.map((m) => (
          <div key={m.produto.id} className="prod-cell"><FotoProduto p={m.produto} size={32} /><div><b>{m.produto.ref}</b><span>{inteiro(m.pares)} pares</span></div></div>
        ))}</div>}
      </div>}

      {inativos.length > 0 && <div className="det-bloco">
        <h3>Para reativar <small>sem comprar há mais de {diasInativo} dias</small></h3>
        <ul className="det-inativos">
          {inativos.map((c) => <li key={c.id}><b>{c.nome}</b><span>{c.cidade}/{c.uf} · última {c.ultima ? dataBR(isoDia(c.ultima)) : '—'}</span></li>)}
        </ul>
        {a.listaInativos.length > inativos.length && <p className="card-sub" style={{ margin: '6px 0 0' }}>+ {a.listaInativos.length - inativos.length} cliente(s) inativo(s)</p>}
      </div>}
    </aside>
  )
}
