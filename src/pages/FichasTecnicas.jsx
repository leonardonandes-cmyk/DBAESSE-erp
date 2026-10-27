import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import { FotoProduto } from '../components/FotoProduto.jsx'
import { Rosca } from '../components/Graficos.jsx'
import { UN_CURTA, listarFichaConsumo } from '../lib/compras.js'
import { BLOCOS, blocoDe, margemNaLista, pct, tomMargem, valorLinha } from '../lib/custos.js'
import { brl } from '../lib/format.js'
import { listarListas, precoNaLista } from '../lib/precos.js'
import { listarProdutos } from '../lib/produtos.js'

/*
  Fichas técnicas: custo do par aberto por bloco, material por material.
  Blocos: Cabedal · Solado e palmilha · Acabamento · MDI (mão de obra interna) · MDE (mão de obra externa) · Rateio.
  MDI/MDE saem do nome do material ("MDI - ..." / "MDE- ..."), como na planilha.
  Busca por modelo; até 4 lado a lado para comparar.
*/
const COR_MODELO = ['#2a78d6', '#eb6834', '#1baf7a', '#6250d6']
const fmtN = (v) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const consumoTxt = (l) => (l.modo === 'rendimento' ? `rende ${fmtN(l.rendimento)} pares` : `${fmtN(l.consumo)} ${UN_CURTA[l.materiais?.unidade] || 'un'}/par`)
const custoUnit = (l) => (l.custo_proprio != null ? Number(l.custo_proprio) : Number(l.materiais?.custo || 0))
const lerSel = () => { try { return JSON.parse(localStorage.getItem('fichas.sel') || '[]') } catch { return [] } }

export default function FichasTecnicas() {
  const [produtos, setProdutos] = useState([])
  const [linhas, setLinhas] = useState([])
  const [listas, setListas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [sel, setSel] = useState(lerSel)
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  const buscaRef = useRef(null)

  useEffect(() => {
    Promise.all([listarProdutos(), listarFichaConsumo(), listarListas()])
      .then(([p, f, l]) => { setProdutos(p); setLinhas(f); setListas(l) })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [])

  // ficha montada de cada modelo: blocos com materiais e totais
  const fichas = useMemo(() => {
    const m = {}
    linhas.forEach((l) => {
      const f = (m[l.produto_id] ||= { total: 0, blocos: Object.fromEntries(BLOCOS.map((b) => [b.id, { total: 0, itens: [] }])), avisos: 0 })
      const v = valorLinha(l); const b = blocoDe(l)
      if (!f.blocos[b]) return
      f.total += v; f.blocos[b].total += v
      f.blocos[b].itens.push({ id: l.id, material_id: l.material_id, nome: l.materiais?.nome || '—', consumo: consumoTxt(l), unit: custoUnit(l), un: UN_CURTA[l.materiais?.unidade] || 'un', valor: v, proprio: l.custo_proprio != null, obs: l.observacao })
      if (l.observacao) f.avisos++
    })
    Object.values(m).forEach((f) => Object.values(f.blocos).forEach((b) => b.itens.sort((a, z) => z.valor - a.valor)))
    return m
  }, [linhas])

  const comFicha = useMemo(() => produtos.filter((p) => fichas[p.id]).sort((a, b) => a.ref.localeCompare(b.ref, 'pt-BR', { numeric: true })), [produtos, fichas])
  useEffect(() => { if (!carregando && sel.length === 0 && comFicha.length) setSel([comFicha[0].id]) }, [carregando, comFicha]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem('fichas.sel', JSON.stringify(sel)) } catch { /* sem storage */ } }, [sel])

  const escolhidos = sel.map((id) => produtos.find((p) => p.id === id)).filter((p) => p && fichas[p.id])
  const atac = listas.find((l) => l.codigo === 'atacado') || listas[0]
  const resultados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return comFicha.filter((p) => !q || `${p.ref} ${p.nome} ${p.tipo || ''}`.toLowerCase().includes(q)).slice(0, 30)
  }, [comFicha, busca])

  function alternar(p) {
    setSel((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : s.length >= 4 ? [...s.slice(1), p.id] : [...s, p.id]))
  }

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow"><Link className="link" to="/produtos">Produtos</Link> · {comFicha.length} modelos com ficha</div>
          <h1>Fichas técnicas</h1>
        </div>
        <div className="actions"><Link to="/simulador" className="btn">Simular custo de um modelo novo</Link></div>
      </header>

      {erro && <p className="form-error" role="alert">Não consegui ler o banco: {erro}</p>}

      <div className="ft-busca card">
        <div className="ft-busca-linha">
          <label className="search" style={{ flex: '1 1 320px' }}>
            <Icon name="busca" size={16} />
            <span className="sr-only">Buscar modelo</span>
            <input ref={buscaRef} type="search" placeholder="Buscar modelo por REF, nome ou tipo — escolha até 4 para comparar" value={busca}
              onChange={(e) => { setBusca(e.target.value); setAberto(true) }} onFocus={() => setAberto(true)} />
          </label>
          <div className="ft-sel">
            {escolhidos.map((p, i) => (
              <span key={p.id} className="ft-chip" style={{ '--mc': COR_MODELO[i] }}>
                <FotoProduto p={p} size={26} /><b>{p.ref}</b>
                <button type="button" aria-label={`Tirar ${p.ref}`} onClick={() => alternar(p)}>✕</button>
              </span>
            ))}
            {escolhidos.length > 0 && escolhidos.length < 4 && <button type="button" className="link-btn" onClick={() => { setAberto(true); buscaRef.current?.focus() }}>+ comparar</button>}
          </div>
        </div>
        {aberto && (
          <div className="ft-resultados">
            {resultados.map((p) => {
              const on = sel.includes(p.id)
              return (
                <button key={p.id} type="button" className={`ft-res ${on ? 'on' : ''}`} onClick={() => alternar(p)}>
                  <FotoProduto p={p} size={36} />
                  <span><b>{p.ref}</b><small>{p.nome}</small></span>
                  <em>{brl(fichas[p.id].total)}</em>
                  <i>{on ? '✓' : '+'}</i>
                </button>
              )
            })}
            {resultados.length === 0 && <p className="card-sub" style={{ margin: 8 }}>Nenhum modelo com ficha para “{busca}”.</p>}
            <button type="button" className="link-btn ft-fechar" onClick={() => setAberto(false)}>fechar lista</button>
          </div>
        )}
      </div>

      {carregando && <p className="card-sub">Carregando fichas…</p>}
      {!carregando && escolhidos.length === 1 && <FichaUnica p={escolhidos[0]} f={fichas[escolhidos[0].id]} listas={listas} />}
      {!carregando && escolhidos.length > 1 && <Comparar modelos={escolhidos} fichas={fichas} atac={atac} />}
      {!carregando && escolhidos.length === 0 && <section className="card empty"><h2>Escolha um modelo na busca</h2><p>Você vê o custo do par aberto por bloco e material. Escolha até 4 modelos para comparar.</p></section>}
    </>
  )
}

/* ---------- um modelo ---------- */
function FichaUnica({ p, f, listas }) {
  const ativos = BLOCOS.filter((b) => f.blocos[b.id].total > 0 || f.blocos[b.id].itens.length)
  return (
    <>
      <section className="ft-topo card">
        <FotoProduto p={p} size={132} />
        <div className="ft-topo-txt">
          <span className="eyebrow">REF {p.ref}{p.tipo ? ` · ${p.tipo}` : ''}</span>
          <h2 className="ft-nome">{p.nome}</h2>
          <span className="ft-custo-rot">Custo do par</span>
          <b className="ft-custo">{brl(f.total)}</b>
          {f.avisos > 0 && <span className="ft-aviso">⚠ {f.avisos} {f.avisos === 1 ? 'linha para revisar' : 'linhas para revisar'}</span>}
        </div>
        <div className="ft-precos">
          {listas.map((l) => {
            const preco = precoNaLista(p, l)
            const m = preco ? margemNaLista(f.total, preco, l) : null
            return (
              <div key={l.codigo} className="ft-preco">
                <span>{l.nome}</span><b>{preco ? brl(preco) : '—'}</b>
                {m && <span className={`pill ${tomMargem(m.margem)}`}>{pct(m.margem)}</span>}
              </div>
            )
          })}
        </div>
      </section>

      <section className="painel-linha">
        <div className="card">
          <div className="card-head"><div><h2>Composição do custo</h2><div className="card-sub">quanto cada bloco pesa no par</div></div></div>
          <div className="ft-barra">
            {ativos.map((b) => f.blocos[b.id].total > 0 && (
              <i key={b.id} style={{ width: `${(f.blocos[b.id].total / f.total) * 100}%`, background: b.cor }} title={`${b.nome}: ${brl(f.blocos[b.id].total)}`} />
            ))}
          </div>
          <div className="ft-resumo">
            {BLOCOS.map((b) => (
              <a key={b.id} href={`#bloco-${b.id}`} className="ft-resumo-item">
                <i style={{ background: b.cor }} />
                <span>{b.curto || b.nome}</span>
                <b>{brl(f.blocos[b.id].total)}</b>
                <em>{f.total ? Math.round((f.blocos[b.id].total / f.total) * 100) : 0}%</em>
              </a>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div><h2>Peso por bloco</h2><div className="card-sub">passe o mouse para ver</div></div></div>
          <Rosca tamanho={180} fmt={brl} rotuloCentro="custo do par" fatias={BLOCOS.map((b) => ({ id: b.id, nome: b.curto || b.nome, cor: b.cor, valor: f.blocos[b.id].total }))} />
        </div>
      </section>

      <section className="ft-blocos">
        {BLOCOS.map((b) => {
          const bl = f.blocos[b.id]
          const max = Math.max(0.0001, ...bl.itens.map((x) => x.valor))
          return (
            <div key={b.id} id={`bloco-${b.id}`} className="card ft-bloco" style={{ '--bc': b.cor }}>
              <div className="ft-bloco-head">
                <div><h3><i />{b.nome}</h3><small>{bl.itens.length} {bl.itens.length === 1 ? 'item' : 'itens'} · {f.total ? Math.round((bl.total / f.total) * 100) : 0}% do par</small></div>
                <b>{brl(bl.total)}</b>
              </div>
              {bl.itens.length === 0 ? <p className="card-sub" style={{ margin: 0 }}>Nada lançado neste bloco.</p> : (
                <div className="ft-itens">
                  {bl.itens.map((x) => (
                    <div key={x.id} className="ft-item" title={x.obs || ''}>
                      <div className="ft-item-topo">
                        <span className="ft-item-nome">{x.nome}{x.obs && <span className="ficha-aviso"> ⚠</span>}</span>
                        <b>{brl(x.valor)}</b>
                      </div>
                      <div className="ft-item-trilho"><i style={{ width: `${(x.valor / max) * 100}%` }} /></div>
                      <small>{x.consumo} · {brl(x.unit)}/{x.un}{x.proprio ? ' (custo da linha)' : ''}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </section>
      <p className="card-sub" style={{ margin: 0 }}>Para alterar materiais e consumos, abra o modelo em <Link className="link" to="/produtos">Produtos → Ficha técnica</Link>. Custos dos materiais em Compras → Materiais.</p>
    </>
  )
}

/* ---------- comparar 2 a 4 modelos ---------- */
function Comparar({ modelos, fichas, atac }) {
  const [abertos, setAbertos] = useState(() => new Set(['cabedal']))
  const fs = modelos.map((p) => fichas[p.id])
  const maxTotal = Math.max(...fs.map((f) => f.total))
  const menor = Math.min(...fs.map((f) => f.total))
  const alternar = (id) => setAbertos((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  return (
    <>
      <section className="ft-comp-topo" style={{ gridTemplateColumns: `repeat(${modelos.length}, minmax(0, 1fr))` }}>
        {modelos.map((p, i) => {
          const f = fs[i]
          const preco = precoNaLista(p, atac)
          const m = preco ? margemNaLista(f.total, preco, atac) : null
          return (
            <div key={p.id} className="card ft-comp-card" style={{ '--mc': COR_MODELO[i] }}>
              <FotoProduto p={p} size={64} />
              <div>
                <span className="eyebrow">REF {p.ref}</span>
                <b className="ft-comp-nome">{p.nome}</b>
                <b className="ft-comp-total">{brl(f.total)}{f.total === menor && <span className="pill ok" style={{ marginLeft: 8 }}>menor custo</span>}</b>
                {m && <small>{atac.nome} {brl(preco)} · margem <span className={`pill ${tomMargem(m.margem)}`}>{pct(m.margem)}</span></small>}
              </div>
            </div>
          )
        })}
      </section>

      <section className="card">
        <div className="card-head"><div><h2>Bloco a bloco</h2><div className="card-sub">cada barra é um modelo · clique no bloco para ver material por material</div></div>
          <div className="legenda-graf" style={{ margin: 0 }}>{modelos.map((p, i) => <span key={p.id}><i style={{ background: COR_MODELO[i] }} />{p.ref}</span>)}</div>
        </div>
        <div className="ft-comp">
          {[...BLOCOS, { id: 'total', nome: 'Custo total do par', cor: '#151515' }].map((b) => {
            const vals = fs.map((f) => (b.id === 'total' ? f.total : f.blocos[b.id].total))
            const max = b.id === 'total' ? maxTotal : Math.max(0.0001, ...vals)
            const minV = Math.min(...vals)
            const aberto = abertos.has(b.id)
            const nomes = b.id === 'total' ? [] : [...new Set(fs.flatMap((f) => f.blocos[b.id].itens.map((x) => x.nome)))]
            return (
              <Fragment key={b.id}>
                <button type="button" className={`ft-comp-bloco ${b.id === 'total' ? 'total' : ''}`} onClick={() => b.id !== 'total' && alternar(b.id)}>
                  <span className="ft-comp-rot"><i style={{ background: b.cor }} />{b.nome}{b.id !== 'total' && <em>{aberto ? '−' : '+'}</em>}</span>
                  <span className="ft-comp-barras">
                    {vals.map((v, i) => (
                      <span key={i} className="ft-comp-barra">
                        <span className="ft-comp-trilho"><i style={{ width: `${(v / max) * 100}%`, background: COR_MODELO[i] }} /></span>
                        <b className={vals.length > 1 && v === minV && v !== Math.max(...vals) ? 'menor' : ''}>{brl(v)}</b>
                      </span>
                    ))}
                  </span>
                </button>
                {aberto && nomes.length > 0 && (
                  <div className="table-wrap ft-comp-tab">
                    <table>
                      <thead><tr><th>Material</th>{modelos.map((p, i) => <th key={p.id} className="r" style={{ color: COR_MODELO[i] }}>{p.ref}</th>)}</tr></thead>
                      <tbody>
                        {nomes.map((n) => {
                          const vs = fs.map((f) => f.blocos[b.id].itens.find((x) => x.nome === n))
                          const nums = vs.filter(Boolean).map((x) => x.valor)
                          const dif = nums.length > 1 && Math.max(...nums) - Math.min(...nums) > 0.005
                          return (
                            <tr key={n} className={dif || nums.length < vs.length ? 'ft-dif' : ''}>
                              <td>{n}</td>
                              {vs.map((x, i) => <td key={i} className="r">{x ? <><b>{brl(x.valor)}</b><br /><small>{x.consumo}</small></> : <span className="faint">—</span>}</td>)}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Fragment>
            )
          })}
        </div>
        <p className="card-sub" style={{ margin: '14px 0 0' }}>Linhas destacadas = material que muda entre os modelos (valor diferente ou só em alguns).</p>
      </section>
    </>
  )
}
