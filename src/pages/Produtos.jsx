import { useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { CORES, PRODUTOS, STATUS_PRODUTO, estoquePorNumero, gerarSku } from '../data/mock.js'

const FILTROS = ['Todos', 'Mocassim', 'Papete', 'Fisherman', 'Rasteira', 'Sapatilha', 'Salto']
const ABAS = ['Grade e SKUs', 'Dados', 'Preços', 'Ficha técnica']

export default function Produtos() {
  const [filtro, setFiltro] = useState('Todos')
  const [busca, setBusca] = useState('')
  const [selRef, setSelRef] = useState(PRODUTOS[0].ref)
  const [corSel, setCorSel] = useState(null)
  const [aba, setAba] = useState(ABAS[0])

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return PRODUTOS.filter((p) =>
      (filtro === 'Todos' || p.tipo === filtro) &&
      (!q || `${p.ref} ${p.nome} ${p.cores.map((c) => CORES[c].nome).join(' ')}`.toLowerCase().includes(q))
    )
  }, [filtro, busca])

  const sel = PRODUTOS.find((p) => p.ref === selRef) || PRODUTOS[0]
  const cor = corSel && sel.cores.includes(corSel) ? corSel : sel.cores[0]
  const grade = estoquePorNumero(sel)
  const totalSkus = PRODUTOS.reduce((t, p) => t + p.cores.length * 6, 0)

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Cadastro · {PRODUTOS.length} modelos · {totalSkus} SKUs</div>
          <h1>Produtos</h1>
        </div>
        <div className="actions">
          <button className="btn">Importar planilha</button>
          <button className="btn btn-dark"><Icon name="mais" size={16} stroke={2} />Novo modelo</button>
        </div>
      </header>

      <div className="actions">
        <label className="search">
          <Icon name="busca" size={16} />
          <span className="sr-only">Buscar produto</span>
          <input type="search" placeholder="Buscar por REF, nome ou cor" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <div className="chips">
          {FILTROS.map((f) => (
            <button key={f} className={`chip ${f === filtro ? 'on' : ''}`} onClick={() => setFiltro(f)}>{f}</button>
          ))}
        </div>
      </div>

      <div className="split">
        <section className="card card-flush list" aria-label="Lista de produtos">
          <div className="table-wrap">
            <table style={{ minWidth: 580 }}>
              <thead className="tinted">
                <tr><th>Modelo</th><th>Cores</th><th>Grade</th><th className="r">Estoque</th><th>Situação</th></tr>
              </thead>
              <tbody>
                {lista.map((p) => {
                  const st = STATUS_PRODUTO[p.status]
                  return (
                    <tr key={p.ref} className={`clickable ${p.ref === sel.ref ? 'selected' : ''}`}
                      onClick={() => { setSelRef(p.ref); setCorSel(null) }}>
                      <td>
                        <div className="prod-cell">
                          <div className="thumb"><Icon name="sapato" size={30} stroke={1.3} /></div>
                          <div><b>{p.nome}</b><span>REF {p.ref} · {p.tipo}</span></div>
                        </div>
                      </td>
                      <td><div className="dots">{p.cores.map((c) => <span key={c} className="dot" title={CORES[c].nome} style={{ background: CORES[c].hex }} />)}</div></td>
                      <td style={{ color: 'var(--ink-2)' }}>34 ao 39</td>
                      <td className="r"><b style={{ fontWeight: 600 }}>{p.estoque}</b></td>
                      <td><span className={`pill ${st.tom}`}>{st.label}</span></td>
                    </tr>
                  )
                })}
                {lista.length === 0 && (
                  <tr><td colSpan={5} style={{ color: 'var(--muted)', padding: 32 }}>Nenhum modelo encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card detail" aria-label="Detalhe do produto">
          <div className="detail-head">
            <div className="thumb lg"><Icon name="sapato" size={72} stroke={1.1} /></div>
            <div style={{ minWidth: 0 }}>
              <div className="eyebrow">REF {sel.ref} · {sel.tipo}</div>
              <h2>{sel.nome}</h2>
              <div className="card-sub">Grade 34 ao 39 · {sel.cores.length} cores</div>
            </div>
          </div>

          <div className="chips">
            {sel.cores.map((c) => (
              <button key={c} className={`color-tag ${c === cor ? 'on' : ''}`} onClick={() => setCorSel(c)}>
                <span className="dot" style={{ background: CORES[c].hex }} />{CORES[c].nome}
              </button>
            ))}
          </div>

          <div className="tabs" role="tablist">
            {ABAS.map((a) => (
              <button key={a} role="tab" aria-selected={a === aba} className={a === aba ? 'on' : ''} onClick={() => setAba(a)}>{a}</button>
            ))}
          </div>

          {aba === 'Grade e SKUs' ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Nº</th><th>SKU</th><th>EAN</th><th className="r">Estoque</th></tr></thead>
                <tbody>
                  {grade.map((g) => (
                    <tr key={g.numero}>
                      <td className="size">{g.numero}</td>
                      <td className="mono">{gerarSku(sel.ref, cor, g.numero)}</td>
                      <td style={{ color: 'var(--muted)' }}>Aguardando GS1</td>
                      <td className="r" style={{ fontWeight: 700, color: g.qtd === 0 ? 'var(--bad)' : g.qtd < 20 ? 'var(--accent)' : 'var(--ink)' }}>{g.qtd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="card-sub" style={{ margin: 0 }}>Esta aba entra nas próximas etapas.</p>
          )}

          <div className="actions">
            <button className="btn" style={{ flex: 1 }}>Imprimir etiquetas</button>
            <button className="btn btn-dark" style={{ flex: 1, justifyContent: 'center' }}>Editar modelo</button>
          </div>
        </section>
      </div>

      <p className="footnote">Valores ilustrativos — o cadastro real será importado do ETIQUETAS-V2 e da planilha do catálogo.</p>
    </>
  )
}
