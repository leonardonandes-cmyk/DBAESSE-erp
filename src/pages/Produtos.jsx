import { Link } from 'react-router-dom'
import { Fragment, useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import NovoModelo from '../components/NovoModelo.jsx'
import FichaConsumo from '../components/FichaConsumo.jsx'
import { listarCores, listarProdutos } from '../lib/produtos.js'
import { listarListas, precoNaLista } from '../lib/precos.js'
import { listarFichaConsumo } from '../lib/compras.js'
import { custosPorProduto, margemNaLista, pct, tomMargem } from '../lib/custos.js'
import { FotoProduto } from '../components/FotoProduto.jsx'
import { listarSaldos, saldoPorSku } from '../lib/estoque.js'
import { brl, rotuloNum } from '../lib/format.js'


const STATUS = {
  ativo: { label: 'Ativo', tom: 'ok' },
  rascunho: { label: 'Rascunho', tom: 'neutral' },
  inativo: { label: 'Inativo', tom: 'bad' },
}
const ABAS = ['Grade e SKUs', 'Dados', 'Preços e margem', 'Ficha técnica']

export default function Produtos() {
  const [produtos, setProdutos] = useState([])
  const [cores, setCores] = useState([])
  const [saldos, setSaldos] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('Todos')
  const [busca, setBusca] = useState('')
  const [listas, setListas] = useState([])
  useEffect(() => { listarListas().then(setListas).catch(() => {}) }, [])
  const [custos, setCustos] = useState({}) // produto_id -> custo do par (ficha técnica)
  useEffect(() => { Promise.all([listarFichaConsumo(), listarProdutos()]).then(([l, p]) => setCustos(custosPorProduto(l, p))).catch(() => {}) }, [])
  const [selRef, setSelRef] = useState(null)
  const [corSel, setCorSel] = useState(null)
  const [aba, setAba] = useState(ABAS[0])
  const [novo, setNovo] = useState(false)
  const [editar, setEditar] = useState(null)

  async function carregar(focoRef) {
    setErro('')
    try {
      const [p, c, sa] = await Promise.all([listarProdutos(), listarCores(), listarSaldos()])
      setProdutos(p)
      setCores(c)
      setSaldos(saldoPorSku(sa))
      if (focoRef) setSelRef(focoRef)
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }
  useEffect(() => { carregar() }, [])

  const corPorId = useMemo(() => Object.fromEntries(cores.map((c) => [c.id, c])), [cores])
  const tipos = useMemo(() => ['Todos', ...new Set(produtos.map((p) => p.tipo).filter(Boolean))], [produtos])

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return produtos.filter((p) => {
      if (filtro !== 'Todos' && p.tipo !== filtro) return false
      if (!q) return true
      const nomesCores = [...new Set(p.skus.map((s) => corPorId[s.cor_id]?.nome))].join(' ')
      return `${p.ref} ${p.nome} ${nomesCores} ${p.skus.map((s) => s.sku).join(' ')}`.toLowerCase().includes(q)
    })
  }, [produtos, filtro, busca, corPorId])

  const coresDo = (p) => [...new Set(p.skus.map((s) => s.cor_id))].map((id) => corPorId[id]).filter(Boolean)
  const sel = produtos.find((p) => p.ref === selRef) || lista[0]
  const coresSel = sel ? coresDo(sel) : []
  const cor = coresSel.find((c) => c.id === corSel) || coresSel[0]
  const grade = sel && cor ? sel.skus.filter((s) => s.cor_id === cor.id).sort((a, b) => a.numero - b.numero) : []
  const totalSkus = produtos.reduce((t, p) => t + p.skus.length, 0)

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Cadastro · {produtos.length} modelos · {totalSkus.toLocaleString('pt-BR')} SKUs</div>
          <h1>Produtos</h1>
        </div>
        <div className="actions">
          <Link className="btn" to="/simulador">Simular custo</Link>
          <button className="btn btn-dark" onClick={() => setNovo(true)}><Icon name="mais" size={16} stroke={2} />Novo modelo</button>
        </div>
      </header>

      {erro && <p className="form-error" role="alert">Não consegui ler o banco: {erro}</p>}

      {!carregando && produtos.length === 0 && !erro ? (
        <section className="card empty">
          <span className="alert-num" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', width: 56, height: 56, borderRadius: 14 }}>
            <Icon name="produtos" size={24} />
          </span>
          <h2>Nenhum modelo cadastrado ainda</h2>
          <p>Cadastre o primeiro modelo: os SKUs de cada cor e número são gerados automaticamente, no mesmo padrão das etiquetas.</p>
          <button className="btn btn-dark" onClick={() => setNovo(true)}>Cadastrar primeiro modelo</button>
        </section>
      ) : (
        <>
          <div className="actions">
            <label className="search">
              <Icon name="busca" size={16} />
              <span className="sr-only">Buscar produto</span>
              <input type="search" placeholder="Buscar por REF, nome, cor ou SKU" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </label>
            <div className="chips">
              {tipos.map((t) => (
                <button key={t} className={`chip ${t === filtro ? 'on' : ''}`} onClick={() => setFiltro(t)}>{t}</button>
              ))}
            </div>
          </div>

          <div className={`split ${['Ficha técnica', 'Preços e margem'].includes(aba) ? 'split-largo' : ''}`}>
            <section className="card card-flush list" aria-label="Lista de produtos">
              <div className="table-wrap">
                <table style={{ minWidth: 560 }}>
                  <thead className="tinted">
                    <tr><th>Modelo</th><th>Cores</th><th>Grade</th><th className="r">Custo</th><th className="r">Estoque</th><th>Situação</th></tr>
                  </thead>
                  <tbody>
                    {carregando && <tr><td colSpan={6} style={{ color: 'var(--muted)', padding: 32 }}>Carregando…</td></tr>}
                    {lista.map((p) => {
                      const st = STATUS[p.status] || STATUS.ativo
                      return (
                        <tr key={p.id} className={`clickable ${sel && p.id === sel.id ? 'selected' : ''}`}
                          onClick={() => { setSelRef(p.ref); setCorSel(null) }}>
                          <td>
                            <div className="prod-cell">
                              <FotoProduto key={p.id} p={p} size={30} className="padrao" />
                              <div><b>{p.nome}</b><span>REF {p.ref}{p.tipo ? ` · ${p.tipo}` : ''}</span></div>
                            </div>
                          </td>
                          <td><div className="dots">{coresDo(p).map((c) => <span key={c.id} className="dot" title={c.nome} style={{ background: c.hex || '#ddd' }} />)}</div></td>
                          <td style={{ color: 'var(--ink-2)' }}>{rotuloNum(p.grade_de)} ao {rotuloNum(p.grade_ate)}</td>
                          <td className="r" style={{ color: custos[p.id] ? 'var(--ink-2)' : 'var(--faint)' }}>{custos[p.id] ? brl(custos[p.id]) : '—'}</td>
                          <td className="r"><b style={{ fontWeight: 600 }}>{p.skus.reduce((t, s) => t + (saldos[s.id] || 0), 0)}</b></td>
                          <td><span className={`pill ${st.tom}`}>{st.label}</span></td>
                        </tr>
                      )
                    })}
                    {!carregando && lista.length === 0 && (
                      <tr><td colSpan={6} style={{ color: 'var(--muted)', padding: 32 }}>Nenhum modelo encontrado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {sel && (
              <section className="card detail" aria-label="Detalhe do produto">
                <div className="detail-head">
                  <FotoProduto key={`${sel.id}-${cor?.id}`} p={sel} corId={cor?.id} className="lg" size={72} />
                  <div style={{ minWidth: 0 }}>
                    <div className="eyebrow">REF {sel.ref}{sel.tipo ? ` · ${sel.tipo}` : ''}</div>
                    <h2>{sel.nome}</h2>
                    <div className="card-sub">Grade {rotuloNum(sel.grade_de)} ao {rotuloNum(sel.grade_ate)} · {coresSel.length} {coresSel.length === 1 ? 'cor' : 'cores'}</div>
                  </div>
                </div>

                <div className="chips">
                  {coresSel.map((c) => (
                    <button key={c.id} className={`color-tag ${cor && c.id === cor.id ? 'on' : ''}`} onClick={() => setCorSel(c.id)}>
                      <span className="dot" style={{ background: c.hex || '#ddd' }} />{c.nome}
                    </button>
                  ))}
                </div>

                <div className="tabs" role="tablist">
                  {ABAS.map((a) => (
                    <button key={a} role="tab" aria-selected={a === aba} className={a === aba ? 'on' : ''} onClick={() => setAba(a)}>{a}</button>
                  ))}
                </div>

                {aba === 'Grade e SKUs' && coresSel.length === 0 ? (
                  <p className="preview" style={{ margin: 0 }}>Este modelo ainda não tem cores. Clique em <b>Editar modelo</b> para escolher as cores e gerar os SKUs.</p>
                ) : aba === 'Grade e SKUs' ? (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Nº</th><th>SKU</th><th>EAN</th><th className="r">Estoque</th></tr></thead>
                      <tbody>
                        {grade.map((g) => (
                          <tr key={g.id}>
                            <td className="size">{rotuloNum(g.numero)}</td>
                            <td className="mono">{g.sku}</td>
                            <td style={{ color: 'var(--muted)' }}>{g.ean || 'Aguardando GS1'}</td>
                            <td className="r" style={{ fontWeight: 700, color: (saldos[g.id] || 0) < 0 ? 'var(--bad)' : (saldos[g.id] || 0) === 0 ? 'var(--faint)' : 'var(--ink)' }}>{saldos[g.id] || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : aba === 'Dados' ? (
                  <dl className="dados">
                    <dt>Coleção</dt><dd>{sel.colecao || '—'}</dd>
                    <dt>NCM</dt><dd>{sel.ncm || '—'}</dd>
                    <dt>Tipo</dt><dd>{sel.tipo || '—'}</dd>
                  </dl>
                ) : aba === 'Preços e margem' ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div className="preview" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <span>{sel.origem === 'revenda' ? 'Custo do par (compra de revenda)' : 'Custo do par (ficha técnica)'}: <b>{custos[sel.id] ? brl(custos[sel.id]) : 'sem ficha'}</b></span>
                      <button className="link-btn" onClick={() => setAba('Ficha técnica')}>ver ficha</button>
                    </div>
                    <div className="table-wrap">
                      <table className="margens">
                        <thead><tr><th>Lista</th><th className="r">Preço</th><th className="r">Despesas</th><th className="r">Lucro</th><th className="r">Margem</th><th className="r">Preço ideal</th></tr></thead>
                        <tbody>
                          {listas.map((l) => {
                            const preco = precoNaLista(sel, l)
                            const c = custos[sel.id] || 0
                            const m = c ? margemNaLista(c, preco, l) : null
                            return (
                              <tr key={l.codigo}>
                                <td><b>{l.nome}</b><br /><span className="card-sub">{Number(l.acrescimo) > 0 ? `atacado + ${brl(l.acrescimo)}` : l.base === 'varejo' ? 'preço FERALCCI' : 'preço base'}</span></td>
                                <td className="r"><b>{preco ? brl(preco) : '—'}</b></td>
                                <td className="r" title={(l.despesas || []).map((d) => `${d.nome}: ${d.pct ? pct(d.pct) : ''}${d.rs ? ` R$ ${d.rs}` : ''}`).join('\n')}>{m ? brl(m.despesas) : '—'}</td>
                                <td className="r" style={{ color: m && m.lucro < 0 ? 'var(--bad)' : undefined }}>{m ? brl(m.lucro) : '—'}</td>
                                <td className="r">{m && preco ? <span className={`pill ${tomMargem(m.margem)}`}>{pct(m.margem)}</span> : '—'}</td>
                                <td className="r" title={`Para margem de ${pct(l.margem_alvo)}`}>{m?.ideal ? brl(m.ideal) : '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="card-sub" style={{ margin: 0 }}>Lucro = preço − custo − despesas da lista (imposto, comissão, frete, perda, investimento…). Preço ideal = o que daria a margem-alvo da lista. Despesas e margem-alvo em Configurações → Listas de preço.</p>
                  </div>
                ) : (
                  <>
                    {sel.ficha && Object.values(sel.ficha).some((v) => v != null) ? (
                      <div className="ft-specs">
                        <span className="ft-specs-tit">Especificação</span>
                        <div className="ft-specs-grade">
                          {[['cabedal', 'Cabedal'], ['solado', 'Solado'], ['salto', 'Salto'], ['forma', 'Forma'], ['peso_kg', 'Peso (kg)'], ['caixa', 'Caixa'], ['medidas', 'Medidas']]
                            .filter(([k]) => sel.ficha[k] != null)
                            .map(([k, l]) => <span key={k} className="ft-spec"><small>{l}</small><b>{String(sel.ficha[k]).replace('.', ',')}</b></span>)}
                        </div>
                      </div>
                    ) : null}
                    <FichaConsumo produto={sel} produtos={produtos} onCusto={(v) => setCustos((c) => (Math.abs((c[sel.id] || 0) - v) > 0.001 ? { ...c, [sel.id]: v } : c))} />
                  </>
                )}

                <div className="actions">
                  <button className="btn" style={{ flex: 1 }}>Imprimir etiquetas</button>
                  <button className="btn btn-dark" style={{ flex: 1 }} onClick={() => setEditar(sel)}>Editar modelo</button>
                </div>
              </section>
            )}
          </div>
        </>
      )}

      {editar && (
        <NovoModelo
          produto={editar}
          cores={cores}
          onFechar={() => setEditar(null)}
          onCorCriada={(c) => setCores([...cores, c].sort((a, b) => a.nome.localeCompare(b.nome)))}
          onSalvo={(ref) => { setEditar(null); carregar(ref) }}
        />
      )}

      {novo && (
        <NovoModelo
          cores={cores}
          onFechar={() => setNovo(false)}
          onCorCriada={(c) => setCores([...cores, c].sort((a, b) => a.nome.localeCompare(b.nome)))}
          onSalvo={(ref) => { setNovo(false); carregar(ref) }}
        />
      )}
    </>
  )
}
