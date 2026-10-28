import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { FotoProduto } from '../components/FotoProduto.jsx'
import { listarFichaConsumo } from '../lib/compras.js'
import { custosPorProduto, margemNaLista, pct, tomMargem } from '../lib/custos.js'
import { brl } from '../lib/format.js'
import { listarListas, precoNaLista } from '../lib/precos.js'
import { listarProdutos, salvarPrecosModelo } from '../lib/produtos.js'

/*
  Tabela de preços para consulta: todos os modelos × todas as listas.
  Custo e margem ficam escondidos por padrão (dado interno — pode ter cliente olhando a tela).
*/
const lerPref = (k, padrao) => { try { const v = localStorage.getItem(k); return v == null ? padrao : v === '1' } catch { return padrao } }
const gravarPref = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0') } catch { /* sem storage */ } }

export default function TabelaPrecos() {
  const [produtos, setProdutos] = useState([])
  const [listas, setListas] = useState([])
  const [custos, setCustos] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState('Todos')
  const [interno, setInterno] = useState(() => lerPref('precos.interno', false))
  const [inativos, setInativos] = useState(false)
  const [corrigir, setCorrigir] = useState(null)

  useEffect(() => {
    Promise.all([listarProdutos(), listarListas(), listarFichaConsumo()])
      .then(([p, l, f]) => { setProdutos(p); setListas(l); setCustos(custosPorProduto(f)) })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [])

  const tipos = useMemo(() => ['Todos', ...new Set(produtos.map((p) => p.tipo).filter(Boolean))].sort((a, b) => (a === 'Todos' ? -1 : b === 'Todos' ? 1 : a.localeCompare(b))), [produtos])
  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return produtos
      .filter((p) => (inativos || p.status !== 'inativo') && (tipo === 'Todos' || p.tipo === tipo) && (!q || `${p.ref} ${p.nome} ${p.tipo || ''}`.toLowerCase().includes(q)))
      .sort((a, b) => a.ref.localeCompare(b.ref, 'pt-BR', { numeric: true }))
  }, [produtos, busca, tipo, inativos])
  const semPreco = visiveis.filter((p) => p.preco_atacado == null).length

  function alternarInterno() { setInterno((v) => { gravarPref('precos.interno', !v); return !v }) }

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Consulta · {visiveis.length} modelos · {listas.length} listas</div>
          <h1>Tabela de preços</h1>
        </div>
        <div className="actions">
          <button className={`btn ${interno ? 'btn-dark' : ''}`} onClick={alternarInterno} aria-pressed={interno} title="Custo e margem são dados internos">
            {interno ? 'Esconder custo e margem' : 'Mostrar custo e margem'}
          </button>
          <button className="btn" onClick={() => window.print()}>Imprimir / PDF</button>
        </div>
      </header>

      {erro && <p className="form-error" role="alert">Não consegui ler o banco: {erro}</p>}

      <div className="actions no-print">
        <label className="search">
          <Icon name="busca" size={16} />
          <span className="sr-only">Buscar</span>
          <input type="search" placeholder="Buscar por REF ou nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <div className="chips">
          {tipos.map((t) => <button key={t} className={`chip ${t === tipo ? 'on' : ''}`} onClick={() => setTipo(t)}>{t}</button>)}
        </div>
        <label className="check"><input type="checkbox" checked={inativos} onChange={(e) => setInativos(e.target.checked)} />Incluir inativos</label>
      </div>

      <section className="card card-flush">
        <div className="table-wrap">
          <table className={`tabela-precos ${interno ? 'com-interno' : ''}`}>
            <thead className="tinted">
              <tr>
                <th>Modelo</th>
                {interno && <th className="r interno">Custo</th>}
                {listas.map((l) => (
                  <th key={l.codigo} className="r">
                    {l.nome}
                    <small>{Number(l.acrescimo) > 0 ? `atacado + ${brl(l.acrescimo)}` : l.base === 'varejo' ? 'FERALCCI' : 'base'}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {carregando && <tr><td colSpan={listas.length + 2} style={{ color: 'var(--muted)', padding: 32 }}>Carregando…</td></tr>}
              {visiveis.map((p) => {
                const c = custos[p.id]
                return (
                  <tr key={p.id} className="clickable" title="Clique para corrigir o preço" onClick={() => setCorrigir(p)} style={p.status === 'inativo' ? { opacity: 0.5 } : undefined}>
                    <td>
                      <div className="prod-cell">
                        <FotoProduto p={p} size={40} />
                        <div><b>{p.ref}</b><span>{p.nome}{p.tipo ? ` · ${p.tipo}` : ''}</span></div>
                      </div>
                    </td>
                    {interno && <td className="r interno">{c ? brl(c) : <span className="faint">sem ficha</span>}</td>}
                    {listas.map((l) => {
                      const preco = precoNaLista(p, l)
                      const m = interno && c && preco ? margemNaLista(c, preco, l) : null
                      return (
                        <td key={l.codigo} className="r">
                          {preco ? <b className="preco">{brl(preco)}</b> : <span className="faint">—</span>}
                          {m && <span className={`pill ${tomMargem(m.margem)}`}>{pct(m.margem)}</span>}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
              {!carregando && visiveis.length === 0 && <tr><td colSpan={listas.length + 2} style={{ color: 'var(--muted)', padding: 32 }}>Nada encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <p className="card-sub no-print" style={{ margin: 0 }}>
        Clique num modelo para corrigir o preço. Preços calculados pelas regras de Configurações → Listas de preço{semPreco ? ` · ${semPreco} modelo(s) sem preço de atacado cadastrado` : ''}.
        {interno && ' Margem já descontando as despesas de cada lista (imposto, comissão, frete, perda…).'}
      </p>
      {corrigir && <CorrigirPreco produto={corrigir} listas={listas} onFechar={() => setCorrigir(null)}
        onSalvo={(novo) => { setProdutos((ps) => ps.map((x) => (x.id === corrigir.id ? { ...x, ...novo } : x))); setCorrigir(null) }} />}
    </>
  )
}

function CorrigirPreco({ produto, listas, onFechar, onSalvo }) {
  const [f, setF] = useState({ precoAtacado: produto.preco_atacado ?? '', precoVarejo: produto.preco_varejo ?? '' })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const n = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')))
  const previa = { ...produto, preco_atacado: n(f.precoAtacado), preco_varejo: n(f.precoVarejo) }
  async function salvar(e) {
    e.preventDefault(); setErro(''); setSalvando(true)
    try { await salvarPrecosModelo(produto.id, f); onSalvo({ preco_atacado: previa.preco_atacado, preco_varejo: previa.preco_varejo }) } catch (er) { setErro(er.message); setSalvando(false) }
  }
  return (
    <div className="modal-bg" onClick={onFechar}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={salvar}>
        <div className="modal-head">
          <div className="prod-cell"><FotoProduto p={produto} size={48} /><div><div className="eyebrow">REF {produto.ref}</div><h2 style={{ margin: 0 }}>Corrigir preço</h2></div></div>
          <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
        </div>
        <div className="form-grid">
          <label className="field"><span>Preço atacado (R$)</span><input type="number" step="0.01" min="0" autoFocus value={f.precoAtacado} onChange={(e) => setF({ ...f, precoAtacado: e.target.value })} /></label>
          <label className="field"><span>Preço varejo · FERALCCI (R$)</span><input type="number" step="0.01" min="0" value={f.precoVarejo} onChange={(e) => setF({ ...f, precoVarejo: e.target.value })} /></label>
        </div>
        <div className="grade-mini" style={{ margin: '4px 0 12px' }}>
          {listas.map((l) => <span key={l.codigo} style={{ minWidth: 90 }}><small>{l.nome}</small>{brl(precoNaLista(previa, l))}</span>)}
        </div>
        {erro && <p className="form-error" role="alert">{erro}</p>}
        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="btn btn-dark" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar preço'}</button>
        </div>
      </form>
    </div>
  )
}
