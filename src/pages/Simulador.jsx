import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import { FotoProduto } from '../components/FotoProduto.jsx'
import { UN_CURTA, listarFichaConsumo, listarMateriais } from '../lib/compras.js'
import { SECOES, custosPorProduto, margemNaLista, pct, tomMargem } from '../lib/custos.js'
import { brl, dataBR } from '../lib/format.js'
import { listarListas, precoNaLista } from '../lib/precos.js'
import { listarProdutos } from '../lib/produtos.js'
import { custoSim, linhasDoModelo, listarSimulacoes, novaChave, removerSimulacao, salvarSimulacao, valorSim } from '../lib/simulacoes.js'

/*
  Simulador de custo: estudo de produto novo SEM cadastrar no catálogo.
  Parte da ficha de um modelo parecido (ou de outra simulação), troca o que muda
  e mostra custo do par, margem em cada lista e preço ideal.
*/
const dec = (v) => (v == null || v === '' ? '' : Number(v).toFixed(2))
const fmt = (v) => (v == null || v === '' ? '' : String(v).replace('.', ','))

export default function Simulador() {
  const [sims, setSims] = useState([])
  const [produtos, setProdutos] = useState([])
  const [materiais, setMateriais] = useState([])
  const [listas, setListas] = useState([])
  const [custoModelo, setCustoModelo] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [atual, setAtual] = useState(null)     // simulação em edição
  const [sujo, setSujo] = useState(false)
  const [nova, setNova] = useState(null)       // modal { nome, origem }
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    Promise.all([listarSimulacoes(), listarProdutos(), listarMateriais(), listarListas(), listarFichaConsumo()])
      .then(([s, p, m, l, f]) => { setSims(s); setProdutos(p); setMateriais(m); setListas(l); setCustoModelo(custosPorProduto(f)) })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [])

  const matPorId = useMemo(() => Object.fromEntries(materiais.map((m) => [m.id, m])), [materiais])
  const matPorNome = useMemo(() => Object.fromEntries(materiais.filter((m) => m.ativo).map((m) => [m.nome.toUpperCase(), m])), [materiais])
  const prodPorId = useMemo(() => Object.fromEntries(produtos.map((p) => [p.id, p])), [produtos])
  const atacado = listas.find((l) => l.codigo === 'atacado')

  function abrir(s) {
    if (sujo && !confirm('Há alterações não salvas nesta simulação. Descartar?')) return
    setAtual({ ...s, preco_atacado: dec(s.preco_atacado), preco_varejo: dec(s.preco_varejo), linhas: s.linhas.map((l) => ({ ...l, k: l.k || novaChave(), nome: matPorId[l.material_id]?.nome || '' })) })
    setSujo(false); setAviso(''); setErro('')
  }
  const mudar = (fn) => { setAtual((a) => fn(a)); setSujo(true); setAviso('') }
  const mudarLinha = (k, campos) => mudar((a) => ({ ...a, linhas: a.linhas.map((l) => (l.k === k ? { ...l, ...campos } : l)) }))

  async function criar(e) {
    e.preventDefault()
    if (sujo && !confirm('Há alterações não salvas nesta simulação. Descartar?')) return
    setOcupado(true); setErro('')
    try {
      const [tipo, id] = (nova.origem || 'zero:').split(':')
      let linhas = [], base = null, pa = '', pv = ''
      if (tipo === 'modelo') {
        linhas = await linhasDoModelo(id); base = id
        pa = dec(prodPorId[id]?.preco_atacado); pv = dec(prodPorId[id]?.preco_varejo)
      } else if (tipo === 'sim') {
        const s = sims.find((x) => x.id === id)
        linhas = s.linhas.map((l) => ({ ...l, k: novaChave() })); base = s.base_produto_id
        pa = dec(s.preco_atacado); pv = dec(s.preco_varejo)
      }
      setAtual({ id: null, nome: nova.nome || 'Nova simulação', base_produto_id: base, preco_atacado: pa, preco_varejo: pv, observacoes: '',
        linhas: linhas.map((l) => ({ ...l, nome: matPorId[l.material_id]?.nome || '' })) })
      setSujo(true); setNova(null); setAviso('')
    } catch (e2) { setErro(e2.message) } finally { setOcupado(false) }
  }

  async function salvar() {
    const invalida = atual.linhas.find((l) => !l.material_id)
    if (invalida) return setErro(`Escolha um material da lista na linha "${invalida.nome || 'em branco'}" (ou remova a linha).`)
    setOcupado(true); setErro('')
    try {
      const s = await salvarSimulacao(atual)
      setSims((lista) => [s, ...lista.filter((x) => x.id !== s.id)])
      setAtual((a) => ({ ...a, id: s.id })); setSujo(false); setAviso('✓ Simulação salva')
    } catch (e) { setErro(e.message) } finally { setOcupado(false) }
  }

  async function excluir() {
    if (!confirm(`Excluir a simulação "${atual.nome}"?`)) return
    try {
      if (atual.id) await removerSimulacao(atual.id)
      setSims((l) => l.filter((x) => x.id !== atual.id)); setAtual(null); setSujo(false)
    } catch (e) { setErro(e.message) }
  }

  function duplicar() {
    setAtual((a) => ({ ...a, id: null, nome: `${a.nome} (cópia)`, linhas: a.linhas.map((l) => ({ ...l, k: novaChave() })) }))
    setSujo(true); setAviso('Cópia criada — salve para guardar')
  }

  const resumo = useMemo(() => (atual ? custoSim(atual.linhas, matPorId) : null), [atual, matPorId])
  const produtoFicticio = atual && { preco_atacado: atual.preco_atacado === '' ? null : Number(String(atual.preco_atacado).replace(',', '.')), preco_varejo: atual.preco_varejo === '' ? null : Number(String(atual.preco_varejo).replace(',', '.')) }
  const base = atual?.base_produto_id ? prodPorId[atual.base_produto_id] : null
  const custoBase = base ? custoModelo[base.id] : null

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow"><Link className="link" to="/produtos">Produtos</Link> · estudo antes de lançar</div>
          <h1>Simulador de custo</h1>
        </div>
        <div className="actions">
          <button className="btn btn-dark" onClick={() => setNova({ nome: '', origem: '' })}><Icon name="mais" size={16} stroke={2} />Nova simulação</button>
        </div>
      </header>

      {erro && !atual && <p className="form-error" role="alert">{erro}</p>}

      <div className="split split-largo">
        <section className="card card-flush list" aria-label="Simulações salvas">
          <div className="sim-lista">
            {carregando && <p className="card-sub" style={{ padding: 20, margin: 0 }}>Carregando…</p>}
            {!carregando && sims.length === 0 && (
              <div className="sim-vazio">
                <b>Nenhuma simulação ainda</b>
                <p>Comece de um modelo parecido: a ficha dele vem copiada e você troca só o que muda. Nada aqui entra no catálogo.</p>
              </div>
            )}
            {sims.map((s) => {
              const c = custoSim(s.linhas, matPorId).total
              const m = atacado && s.preco_atacado ? margemNaLista(c, precoNaLista(s, atacado), atacado) : null
              const b = prodPorId[s.base_produto_id]
              return (
                <button key={s.id} className={`sim-item ${atual?.id === s.id ? 'on' : ''}`} onClick={() => abrir(s)}>
                  {b ? <FotoProduto p={b} size={38} /> : <span className="sim-ico"><Icon name="produtos" size={18} /></span>}
                  <span className="sim-item-txt">
                    <b>{s.nome}</b>
                    <small>{b ? `base ${b.ref}` : 'do zero'} · {dataBR(s.atualizado_em.slice(0, 10))}</small>
                  </span>
                  <span className="sim-item-num">
                    <b>{brl(c)}</b>
                    {m ? <span className={`pill ${tomMargem(m.margem)}`}>{pct(m.margem)}</span> : <small>sem preço</small>}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="card detail">
          {!atual ? (
            <div className="sim-vazio grande">
              <span className="alert-num" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', width: 56, height: 56, borderRadius: 14 }}><Icon name="relatorios" size={24} /></span>
              <h2>Quanto custa antes de lançar?</h2>
              <p>Escolha um modelo parecido como base, troque materiais e veja na hora o custo do par, a margem em cada lista e o preço ideal.</p>
              <button className="btn btn-dark" onClick={() => setNova({ nome: '', origem: '' })}>Nova simulação</button>
            </div>
          ) : (
            <div className="sim">
              <div className="sim-head">
                <input className="sim-nome" value={atual.nome} onChange={(e) => mudar((a) => ({ ...a, nome: e.target.value }))} aria-label="Nome da simulação" />
                <div className="actions">
                  {aviso && <small className={aviso.startsWith('✓') ? 'busca-ok' : 'card-sub'}>{aviso}</small>}
                  {sujo && !aviso && <small className="card-sub">não salvo</small>}
                  <button className="btn btn-sm" onClick={duplicar}>Duplicar</button>
                  <button className="btn btn-sm" onClick={excluir}>Excluir</button>
                  <button className="btn btn-sm btn-dark" onClick={salvar} disabled={ocupado || !sujo}>{ocupado ? 'Salvando…' : 'Salvar'}</button>
                </div>
              </div>

              <div className="sim-precos">
                <label className="field"><span>Preço atacado (R$)</span><input inputMode="decimal" value={fmt(atual.preco_atacado)} placeholder="0,00" onChange={(e) => mudar((a) => ({ ...a, preco_atacado: e.target.value.replace(',', '.') }))} /></label>
                <label className="field"><span>Preço varejo (R$)</span><input inputMode="decimal" value={fmt(atual.preco_varejo)} placeholder="0,00" onChange={(e) => mudar((a) => ({ ...a, preco_varejo: e.target.value.replace(',', '.') }))} /></label>
                {base && (
                  <div className="sim-base">
                    <FotoProduto p={base} size={40} />
                    <div><small>Base</small><b>{base.ref} · {base.nome}</b><span>custo {brl(custoBase || 0)}{custoBase ? <> → <b className={resumo.total > custoBase ? 'sobe' : 'desce'}>{resumo.total >= custoBase ? '+' : '−'}{brl(Math.abs(resumo.total - custoBase))}</b></> : null}</span></div>
                  </div>
                )}
              </div>

              <div className="ficha-topo">
                <div><span className="eyebrow">Custo do par</span><b className="ficha-total">{brl(resumo.total)}</b></div>
                <div className="ficha-barra" aria-label="Composição do custo">
                  {SECOES.map((s) => resumo.porSecao[s.id] > 0 && <i key={s.id} className={`sec-${s.id}`} style={{ width: `${(resumo.porSecao[s.id] / resumo.total) * 100}%` }} title={`${s.label}: ${brl(resumo.porSecao[s.id])}`} />)}
                </div>
                <div className="ficha-legenda">
                  {SECOES.map((s) => <span key={s.id}><i className={`sec-${s.id}`} />{s.label} <b>{brl(resumo.porSecao[s.id] || 0)}</b></span>)}
                </div>
              </div>

              <div className="table-wrap">
                <table className="margens">
                  <thead><tr><th>Lista</th><th className="r">Preço</th><th className="r">Despesas</th><th className="r">Lucro</th><th className="r">Margem</th><th className="r">Preço ideal</th></tr></thead>
                  <tbody>
                    {listas.map((l) => {
                      const preco = precoNaLista(produtoFicticio, l)
                      const m = resumo.total ? margemNaLista(resumo.total, preco, l) : null
                      return (
                        <tr key={l.codigo}>
                          <td><b>{l.nome}</b></td>
                          <td className="r"><b>{preco ? brl(preco) : '—'}</b></td>
                          <td className="r">{m && preco ? brl(m.despesas) : '—'}</td>
                          <td className="r" style={{ color: m && preco && m.lucro < 0 ? 'var(--bad)' : undefined }}>{m && preco ? brl(m.lucro) : '—'}</td>
                          <td className="r">{m && preco ? <span className={`pill ${tomMargem(m.margem)}`}>{pct(m.margem)}</span> : '—'}</td>
                          <td className="r" title={`Para margem de ${pct(l.margem_alvo)}`}>{m?.ideal ? <>{brl(m.ideal)}<small className="card-sub"> · {pct(l.margem_alvo)}</small></> : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <datalist id="sim-materiais">{materiais.filter((m) => m.ativo).map((m) => <option key={m.id} value={m.nome} />)}</datalist>
              {SECOES.map((s) => {
                const ls = atual.linhas.filter((l) => l.secao === s.id)
                return (
                  <section key={s.id} className="ficha-secao">
                    <header><h3><i className={`sec-${s.id}`} />{s.label}</h3><span>{brl(resumo.porSecao[s.id] || 0)}</span></header>
                    {ls.map((l) => {
                      const m = matPorId[l.material_id]
                      return (
                        <div key={l.k} className={`sim-linha ${!l.material_id ? 'invalida' : ''}`}>
                          <input className="input" list="sim-materiais" value={l.nome} placeholder="Material…" aria-label="Material"
                            onChange={(e) => { const achou = matPorNome[e.target.value.trim().toUpperCase()]; mudarLinha(l.k, { nome: e.target.value, material_id: achou?.id || null }) }} />
                          <select className="input" value={l.modo} onChange={(e) => mudarLinha(l.k, { modo: e.target.value })} aria-label="Como medir">
                            <option value="rendimento">rende (pares/{m ? UN_CURTA[m.unidade] : 'un'})</option>
                            <option value="consumo">gasta por par</option>
                          </select>
                          <input className="input" inputMode="decimal" value={fmt(l.qtd)} placeholder={l.modo === 'rendimento' ? 'pares' : 'qtd/par'} aria-label="Quantidade"
                            onChange={(e) => mudarLinha(l.k, { qtd: e.target.value.replace(',', '.') })} />
                          <input className="input" inputMode="decimal" value={fmt(l.custo_proprio)} placeholder={m?.custo != null ? `R$ ${fmt(m.custo)}` : 'custo R$'} aria-label="Custo (vazio = do cadastro)" title="Vazio = custo do cadastro do material. Digite para testar outro preço."
                            onChange={(e) => mudarLinha(l.k, { custo_proprio: e.target.value === '' ? null : e.target.value.replace(',', '.') })} />
                          <b className="sim-valor">{brl(valorSim(l, m))}</b>
                          <button className="btn icon-btn btn-sm" aria-label="Remover linha" onClick={() => mudar((a) => ({ ...a, linhas: a.linhas.filter((x) => x.k !== l.k) }))}>✕</button>
                        </div>
                      )
                    })}
                    <button className="link-btn ficha-add-btn" onClick={() => mudar((a) => ({ ...a, linhas: [...a.linhas, { k: novaChave(), material_id: null, nome: '', secao: s.id, modo: 'rendimento', qtd: '', custo_proprio: null }] }))}>+ adicionar em {s.label.toLowerCase()}</button>
                  </section>
                )
              })}

              <label className="field"><span>Anotações</span><textarea className="input" rows={2} value={atual.observacoes || ''} placeholder="Fornecedor do salto, ideia de cor, preço que o concorrente pratica…" onChange={(e) => mudar((a) => ({ ...a, observacoes: e.target.value }))} /></label>
              <p className="card-sub" style={{ margin: 0 }}>Custo do material vem do cadastro em Compras → Materiais; digite um custo na linha para testar outro preço sem mexer no cadastro. Nada desta tela entra no catálogo, no estoque ou na produção.</p>
              {erro && <p className="form-error" role="alert">{erro}</p>}
            </div>
          )}
        </section>
      </div>

      {nova && (
        <div className="modal-bg" onClick={() => setNova(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={criar}>
            <div className="modal-head">
              <div><div className="eyebrow">Simulador</div><h2>Nova simulação</h2></div>
              <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={() => setNova(null)}>✕</button>
            </div>
            <label className="field"><span>Nome do estudo</span><input autoFocus value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} placeholder="Ex.: Salto bloco com couro caramelo" /></label>
            <label className="field">
              <span>Começar a partir de</span>
              <select className="input" value={nova.origem} onChange={(e) => setNova({ ...nova, origem: e.target.value })}>
                <option value="">Do zero (ficha em branco)</option>
                <optgroup label="Copiar ficha de um modelo">
                  {produtos.filter((p) => custoModelo[p.id]).map((p) => <option key={p.id} value={`modelo:${p.id}`}>{p.ref} · {p.nome} — {brl(custoModelo[p.id])}</option>)}
                </optgroup>
                {sims.length > 0 && (
                  <optgroup label="Copiar outra simulação">
                    {sims.map((s) => <option key={s.id} value={`sim:${s.id}`}>{s.nome}</option>)}
                  </optgroup>
                )}
              </select>
            </label>
            <p className="card-sub" style={{ margin: 0 }}>A ficha original não é alterada — você mexe só na cópia.</p>
            {erro && <p className="form-error" role="alert">{erro}</p>}
            <div className="actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setNova(null)}>Cancelar</button>
              <button type="submit" className="btn btn-dark" disabled={ocupado}>{ocupado ? 'Copiando…' : 'Começar'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
