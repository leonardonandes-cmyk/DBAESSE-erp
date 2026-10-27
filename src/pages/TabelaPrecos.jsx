import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { FotoProduto } from '../components/FotoProduto.jsx'
import { listarFichaConsumo } from '../lib/compras.js'
import { custosPorProduto, margemNaLista, pct, tomMargem } from '../lib/custos.js'
import { brl } from '../lib/format.js'
import { listarListas, precoNaLista } from '../lib/precos.js'
import { listarProdutos } from '../lib/produtos.js'

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
                  <tr key={p.id} style={p.status === 'inativo' ? { opacity: 0.5 } : undefined}>
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
        Preços calculados pelas regras de Configurações → Listas de preço{semPreco ? ` · ${semPreco} modelo(s) sem preço de atacado cadastrado` : ''}.
        {interno && ' Margem já descontando as despesas de cada lista (imposto, comissão, frete, perda…).'}
      </p>
    </>
  )
}
