import { Fragment, useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import LojaLogo from '../components/LojaLogo.jsx'
import { FotoProduto } from '../components/FotoProduto.jsx'
import { listarFichaConsumo } from '../lib/compras.js'
import { custosPorProduto, pct } from '../lib/custos.js'
import { brl } from '../lib/format.js'
import { listarProdutos } from '../lib/produtos.js'
import { alertaFaixa, calcCanal, listarCanais, listarPrecosCanal, precoMeta, resumoFaixa, salvarCanal, salvarPrecoCanal, tomMeta } from '../lib/canais.js'

/*
  Margem por loja: Shopee, TikTok Shop, Mercado Livre.
  Custo real da ficha técnica × preço da loja (varejo ou preço próprio) × taxa da faixa + despesas.
*/
const num = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')))
const fmt2 = (v) => (v == null || v === '' ? '' : Number(v).toFixed(2).replace('.', ','))

export default function MargemLojas() {
  const [produtos, setProdutos] = useState([])
  const [canais, setCanais] = useState([])
  const [proprios, setProprios] = useState({}) // `${produto}|${canal}` -> preço
  const [custos, setCustos] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState('geral')
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState('Todos')
  const [soAbaixo, setSoAbaixo] = useState(false)
  const [regras, setRegras] = useState(null) // canal em edição
  const [salvando, setSalvando] = useState('')

  async function carregar() {
    try {
      const [p, c, pc, f] = await Promise.all([listarProdutos(), listarCanais(), listarPrecosCanal(), listarFichaConsumo()])
      setProdutos(p.filter((x) => x.status !== 'inativo'))
      setCanais(c.filter((x) => x.ativo))
      setProprios(Object.fromEntries(pc.map((x) => [`${x.produto_id}|${x.canal_id}`, Number(x.preco)])))
      setCustos(custosPorProduto(f, p))
    } catch (e) { setErro(e.message) } finally { setCarregando(false) }
  }
  useEffect(() => { carregar() }, [])

  const precoLoja = (p, c) => proprios[`${p.id}|${c.id}`] ?? (p.preco_varejo != null ? Number(p.preco_varejo) : null)
  const tipos = useMemo(() => ['Todos', ...new Set(produtos.map((p) => p.tipo).filter(Boolean))], [produtos])
  const canal = canais.find((c) => c.codigo === aba)

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return produtos
      .filter((p) => (tipo === 'Todos' || p.tipo === tipo) && (!q || `${p.ref} ${p.nome}`.toLowerCase().includes(q)))
      .sort((a, b) => a.ref.localeCompare(b.ref, 'pt-BR', { numeric: true }))
      .map((p) => {
        const custo = custos[p.id] || 0
        const porCanal = Object.fromEntries(canais.map((c) => {
          const preco = precoLoja(p, c)
          return [c.id, custo && preco ? { ...calcCanal(custo, preco, c), proprio: proprios[`${p.id}|${c.id}`] != null, meta: Number(c.margem_alvo) } : null]
        }))
        const validos = canais.filter((c) => porCanal[c.id])
        const melhor = validos.length > 1 ? validos.reduce((a, b) => (porCanal[b.id].lucro > porCanal[a.id].lucro ? b : a)) : null
        return { p, custo, porCanal, melhor: melhor?.id }
      })
  }, [produtos, canais, custos, proprios, busca, tipo]) // eslint-disable-line react-hooks/exhaustive-deps

  const kpis = useMemo(() => canais.map((c) => {
    const v = linhas.map((l) => l.porCanal[c.id]).filter(Boolean)
    const fat = v.reduce((t, x) => t + x.preco, 0)
    return {
      c, n: v.length,
      margem: fat ? v.reduce((t, x) => t + x.lucro, 0) / fat : null,
      abaixo: v.filter((x) => x.margem < Number(c.margem_alvo)).length,
      lucroMedio: v.length ? v.reduce((t, x) => t + x.lucro, 0) / v.length : null,
    }
  }), [canais, linhas])
  const semFicha = linhas.filter((l) => !l.custo).length

  async function definirPreco(p, c, valor) {
    const atual = proprios[`${p.id}|${c.id}`] ?? null
    const novo = num(valor)
    if ((novo || null) === atual || (novo != null && Number(p.preco_varejo) === novo && atual == null)) return
    setSalvando(`${p.id}|${c.id}`); setErro('')
    try {
      const r = await salvarPrecoCanal(p.id, c.id, novo)
      setProprios((m) => { const n = { ...m }; if (r) n[`${p.id}|${c.id}`] = Number(r.preco); else delete n[`${p.id}|${c.id}`]; return n })
    } catch (e) { setErro(e.message) } finally { setSalvando('') }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Custo da ficha técnica × preço de cada loja · CNPJ</div>
          <h1>Margem por loja</h1>
        </div>
        <div className="actions">
          {canal && <button className="btn" onClick={() => setRegras(canal)}>Taxas e despesas · {canal.nome}</button>}
        </div>
      </header>

      {erro && <p className="form-error" role="alert">{erro}</p>}

      <div className="segmented lojas-abas" role="tablist">
        <button role="tab" className={aba === 'geral' ? 'on' : ''} onClick={() => setAba('geral')}>Visão geral</button>
        {canais.map((c) => (
          <button key={c.id} role="tab" className={aba === c.codigo ? 'on' : ''} onClick={() => setAba(c.codigo)}>
            <LojaLogo canal={c} size={18} />{c.nome}
          </button>
        ))}
      </div>

      <div className="grid-kpi lojas-kpi">
        {(canal ? kpis.filter((k) => k.c.id === canal.id) : kpis).map((k) => (
          <Fragment key={k.c.id}>
            <div className="card kpi">
              <span className="kpi-label"><LojaLogo canal={k.c} size={20} />{canal ? 'Margem média' : k.c.nome}</span>
              <span className="kpi-value"><span className={`pill ${tomMeta(k.margem, Number(k.c.margem_alvo))} pill-lg`}>{pct(k.margem)}</span></span>
              <span className="kpi-note">meta {pct(Number(k.c.margem_alvo))} · {k.abaixo} de {k.n} abaixo</span>
            </div>
            {canal && <>
              <div className="card kpi"><span className="kpi-label">Lucro médio por par</span><span className="kpi-value">{k.lucroMedio != null ? brl(k.lucroMedio) : '—'}</span><span className="kpi-note">depois de taxa, imposto e despesas</span></div>
              <div className="card kpi"><span className="kpi-label">Abaixo da meta</span><span className="kpi-value" style={k.abaixo ? { color: 'var(--bad)' } : undefined}>{k.abaixo}</span><span className="kpi-note">modelos para corrigir o preço</span></div>
              <div className="card kpi"><span className="kpi-label">Taxa da loja</span><span className="kpi-value kpi-faixas">{(canal.faixas || []).map((f, i) => <small key={i}>{f.ate == null ? 'acima' : `até ${brl(f.ate)}`}: <b>{resumoFaixa(f)}</b></small>)}</span></div>
            </>}
          </Fragment>
        ))}
      </div>

      <div className="actions">
        <label className="search">
          <Icon name="busca" size={16} />
          <span className="sr-only">Buscar</span>
          <input type="search" placeholder="Buscar por REF ou nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <div className="chips">{tipos.map((t) => <button key={t} className={`chip ${t === tipo ? 'on' : ''}`} onClick={() => setTipo(t)}>{t}</button>)}</div>
        {canal && <label className="check"><input type="checkbox" checked={soAbaixo} onChange={(e) => setSoAbaixo(e.target.checked)} />Só abaixo da meta</label>}
      </div>

      <section className="card card-flush">
        <div className="table-wrap">
          {!canal ? (
            <table className="lojas-tab">
              <thead className="tinted">
                <tr><th>Modelo</th><th className="r">Custo</th><th className="r">Varejo</th>{canais.map((c) => <th key={c.id} className="r"><LojaLogo canal={c} size={18} />{c.nome}</th>)}</tr>
              </thead>
              <tbody>
                {carregando && <tr><td colSpan={canais.length + 3} className="vazio">Carregando…</td></tr>}
                {linhas.map((l) => (
                  <tr key={l.p.id}>
                    <td><div className="prod-cell"><FotoProduto p={l.p} size={36} /><div><b>{l.p.ref}</b><span>{l.p.nome}</span></div></div></td>
                    <td className="r">{l.custo ? brl(l.custo) : <span className="faint">sem ficha</span>}</td>
                    <td className="r">{l.p.preco_varejo != null ? brl(l.p.preco_varejo) : <span className="faint">—</span>}</td>
                    {canais.map((c) => {
                      const r = l.porCanal[c.id]
                      return (
                        <td key={c.id} className={`r ${l.melhor === c.id ? 'melhor' : ''}`} title={l.melhor === c.id ? 'Loja que mais lucra com este modelo' : undefined}>
                          {r ? <>
                            {l.melhor === c.id && <span className="melhor-tag" aria-label="Loja que mais lucra">★</span>}
                            <span className={`pill ${tomMeta(r.margem, r.meta)}`}>{pct(r.margem)}</span>
                            <small>{brl(r.lucro)}/par{r.proprio ? ' · preço próprio' : ''}</small>
                          </> : <span className="faint">—</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="lojas-tab">
              <thead className="tinted">
                <tr><th>Modelo</th><th className="r">Custo</th><th className="r">Preço na loja</th><th className="r">Taxa {canal.nome}</th><th className="r">Imposto e despesas</th><th className="r">Lucro</th><th className="r">Margem</th><th className="r">Preço p/ meta</th></tr>
              </thead>
              <tbody>
                {carregando && <tr><td colSpan={8} className="vazio">Carregando…</td></tr>}
                {linhas.filter((l) => !soAbaixo || (l.porCanal[canal.id] && l.porCanal[canal.id].margem < Number(canal.margem_alvo))).map((l) => {
                  const r = l.porCanal[canal.id]
                  const meta = l.custo ? precoMeta(l.custo, canal) : null
                  const alerta = r ? alertaFaixa(l.custo, r.preco, canal) : null
                  const chave = `${l.p.id}|${canal.id}`
                  return (
                    <tr key={l.p.id}>
                      <td><div className="prod-cell"><FotoProduto p={l.p} size={36} /><div><b>{l.p.ref}</b><span>{l.p.nome}</span></div></div></td>
                      <td className="r">{l.custo ? brl(l.custo) : <span className="faint">sem ficha</span>}</td>
                      <td className="r">
                        <input key={`${chave}|${proprios[chave] ?? ''}`} className={`input input-sm preco-loja ${r?.proprio ? 'proprio' : ''}`} inputMode="decimal"
                          defaultValue={r?.proprio ? fmt2(proprios[chave]) : ''} placeholder={l.p.preco_varejo != null ? fmt2(l.p.preco_varejo) : '—'}
                          aria-label={`Preço do ${l.p.ref} na ${canal.nome}`} disabled={salvando === chave}
                          onBlur={(e) => definirPreco(l.p, canal, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
                        <small className="preco-origem">{salvando === chave ? 'salvando…' : r?.proprio ? 'preço próprio' : 'varejo'}</small>
                      </td>
                      <td className="r">{r ? <>{brl(r.taxa)}<small>{resumoFaixa(r.faixa)}</small></> : '—'}</td>
                      <td className="r">{r ? brl(r.despesas) : '—'}</td>
                      <td className="r" style={{ color: r && r.lucro < 0 ? 'var(--bad)' : undefined }}><b>{r ? brl(r.lucro) : '—'}</b></td>
                      <td className="r">{r ? <span className={`pill ${tomMeta(r.margem, r.meta)}`}>{pct(r.margem)}</span> : '—'}</td>
                      <td className="r">
                        {meta ? <button className="link-btn" title="Usar este preço nesta loja" onClick={() => definirPreco(l.p, canal, meta)}>{brl(meta)}</button> : '—'}
                        {alerta && <small className="alerta-faixa">⚠ a {brl(alerta.teto)} lucra +{brl(alerta.ganho)}</small>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
      <p className="card-sub" style={{ margin: 0 }}>
        {canal
          ? <>Preço vazio = segue o varejo. Digite um preço para usar só nesta loja (apagar volta ao varejo). Clique no <b>preço p/ meta</b> para aplicá-lo. {canal.observacao && <>· {canal.observacao}</>}</>
          : <>Margem por loja já descontando taxa da faixa, imposto 8,5% e despesas. ★ = loja que mais lucra com o modelo. Cores em relação à meta: <span className="pill ok">na meta ou acima</span> <span className="pill warn">até 10 abaixo</span> <span className="pill bad">10+ abaixo</span></>}
        {semFicha ? ` · ${semFicha} modelo(s) sem ficha técnica ficam sem margem.` : ''}
      </p>

      {regras && <RegrasLoja canal={regras} onFechar={() => setRegras(null)} onSalvo={async () => { setRegras(null); await carregar() }} />}
    </>
  )
}

function RegrasLoja({ canal, onFechar, onSalvo }) {
  const p100 = (v) => Math.round(Number(v || 0) * 10000) / 100
  const [f, setF] = useState(() => ({
    faixas: (canal.faixas || []).map((x) => ({ ate: x.ate ?? '', pct: p100(x.pct), fixo: x.fixo ?? 0 })),
    despesas: (canal.despesas || []).map((d) => ({ nome: d.nome, pct: p100(d.pct), rs: d.rs || 0 })),
    meta: p100(canal.margem_alvo), observacao: canal.observacao || '',
  }))
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const setFx = (i, patch) => setF({ ...f, faixas: f.faixas.map((x, k) => (k === i ? { ...x, ...patch } : x)) })
  const setD = (i, patch) => setF({ ...f, despesas: f.despesas.map((x, k) => (k === i ? { ...x, ...patch } : x)) })

  async function salvar(e) {
    e.preventDefault(); setErro(''); setOcupado(true)
    try {
      const faixas = f.faixas.map((x) => ({ ate: num(x.ate), pct: (num(x.pct) || 0) / 100, fixo: num(x.fixo) || 0 }))
      if (faixas.filter((x) => x.ate == null).length !== 1) throw new Error('Deixe exatamente uma faixa com "até" vazio (a última, sem limite).')
      await salvarCanal(canal.id, {
        faixas, despesas: f.despesas.filter((d) => d.nome.trim()).map((d) => ({ nome: d.nome.trim(), pct: (num(d.pct) || 0) / 100, rs: num(d.rs) || 0 })),
        margem_alvo: (num(f.meta) || 0) / 100, observacao: f.observacao, ativo: canal.ativo,
      })
      onSalvo()
    } catch (e2) { setErro(e2.message); setOcupado(false) }
  }

  return (
    <div className="modal-bg" onClick={onFechar}>
      <form className="modal modal-lg" onClick={(e) => e.stopPropagation()} onSubmit={salvar}>
        <div className="modal-head">
          <div><div className="eyebrow">Taxas e despesas</div><h2><LojaLogo canal={canal} size={28} />{canal.nome}</h2></div>
          <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
        </div>

        <div>
          <h3 className="regras-tit">Taxa da loja por faixa de preço</h3>
          <table className="lista-cfg-desp">
            <thead><tr><th>Preço até (R$)</th><th className="r">Comissão %</th><th className="r">Taxa fixa R$</th><th /></tr></thead>
            <tbody>
              {f.faixas.map((x, i) => (
                <tr key={i}>
                  <td><input className="input input-sm" inputMode="decimal" style={{ width: 120, textAlign: 'left' }} value={x.ate} placeholder="sem limite" onChange={(e) => setFx(i, { ate: e.target.value })} aria-label="Preço até" /></td>
                  <td className="r"><input className="input input-sm" inputMode="decimal" value={x.pct} onChange={(e) => setFx(i, { pct: e.target.value })} aria-label="Comissão %" /></td>
                  <td className="r"><input className="input input-sm" inputMode="decimal" value={x.fixo} onChange={(e) => setFx(i, { fixo: e.target.value })} aria-label="Taxa fixa" /></td>
                  <td className="r"><button type="button" className="link-btn" onClick={() => setF({ ...f, faixas: f.faixas.filter((_, k) => k !== i) })}>remover</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="link-btn" onClick={() => setF({ ...f, faixas: [...f.faixas, { ate: '', pct: 0, fixo: 0 }] })}>+ faixa</button>
        </div>

        <div>
          <h3 className="regras-tit">Imposto e despesas da venda</h3>
          <table className="lista-cfg-desp">
            <thead><tr><th>Despesa</th><th className="r">% do preço</th><th className="r">R$ por par</th><th /></tr></thead>
            <tbody>
              {f.despesas.map((d, i) => (
                <tr key={i}>
                  <td><input className="input input-sm" style={{ textAlign: 'left', width: '100%' }} value={d.nome} onChange={(e) => setD(i, { nome: e.target.value })} aria-label="Nome da despesa" /></td>
                  <td className="r"><input className="input input-sm" inputMode="decimal" value={d.pct} onChange={(e) => setD(i, { pct: e.target.value })} aria-label="Percentual" /></td>
                  <td className="r"><input className="input input-sm" inputMode="decimal" value={d.rs} onChange={(e) => setD(i, { rs: e.target.value })} aria-label="Valor por par" /></td>
                  <td className="r"><button type="button" className="link-btn" onClick={() => setF({ ...f, despesas: f.despesas.filter((_, k) => k !== i) })}>remover</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="link-btn" onClick={() => setF({ ...f, despesas: [...f.despesas, { nome: '', pct: 0, rs: 0 }] })}>+ despesa</button>
        </div>

        <div className="form-grid">
          <label className="field"><span>Margem-alvo (%)</span><input inputMode="decimal" value={f.meta} onChange={(e) => setF({ ...f, meta: e.target.value })} /></label>
          <label className="field span-2"><span>Observação</span><input value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} placeholder="De onde veio a taxa, data da última conferência…" /></label>
        </div>
        {erro && <p className="form-error" role="alert">{erro}</p>}
        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="btn btn-dark" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar regras'}</button>
        </div>
      </form>
    </div>
  )
}
