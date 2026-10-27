import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { UN_CURTA, copiarFicha, listarFichaConsumo, listarMateriais, removerLinhaFicha, salvarLinhaFicha } from '../lib/compras.js'
import { BLOCOS, blocoDe, ehMDE, pct, valorLinha } from '../lib/custos.js'
import { brl } from '../lib/format.js'

/*
  Ficha técnica do modelo (padrão da planilha FICHA TÉCNICA):
  seções Cabedal · Solado/palmilha · Acabamento · Mão de obra · Custo fixo (rateio).
  Cada linha: material + consumo por par OU "rende X pares" por unidade → valor por par.
*/
const vazio = (bloco) => ({ bloco, secao: BLOCOS.find((b) => b.id === bloco)?.secao || bloco, nome: '', modo: bloco === 'mdi' || bloco === 'mde' || bloco === 'rateio' ? 'consumo' : 'rendimento', qtd: bloco === 'mdi' || bloco === 'mde' || bloco === 'rateio' ? '1' : '', custo_proprio: '' })
const fmt = (v) => String(Number(v)).replace('.', ',')

export default function FichaConsumo({ produto, produtos, onCusto }) {
  const [linhas, setLinhas] = useState(null)
  const [materiais, setMateriais] = useState([])
  const [nova, setNova] = useState(null)        // linha sendo adicionada { secao, ... }
  const [edit, setEdit] = useState(null)        // linha sendo editada { id, ... }
  const [copiarDe, setCopiarDe] = useState('')
  const [erro, setErro] = useState('')

  async function carregar() {
    try {
      const [l, m] = await Promise.all([listarFichaConsumo(produto.id), listarMateriais()])
      setLinhas(l); setMateriais(m.filter((x) => x.ativo))
    } catch (e) { setErro(e.message) }
  }
  useEffect(() => { setLinhas(null); setNova(null); setEdit(null); carregar() }, [produto.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const matPorNome = useMemo(() => Object.fromEntries(materiais.map((m) => [m.nome.toUpperCase(), m])), [materiais])
  const resumo = useMemo(() => {
    const porBloco = Object.fromEntries(BLOCOS.map((b) => [b.id, 0])); let total = 0
    ;(linhas || []).forEach((l) => { const v = valorLinha(l); porBloco[blocoDe(l)] = (porBloco[blocoDe(l)] || 0) + v; total += v })
    return { total, porBloco }
  }, [linhas])
  // materiais sugeridos em cada bloco (o tipo certo aparece primeiro na lista)
  const sugeridos = (bloco) => materiais.filter((m) => (bloco === 'mdi' ? m.tipo === 'mao_de_obra' && !ehMDE(m.nome) : bloco === 'mde' ? m.tipo === 'mao_de_obra' && ehMDE(m.nome) : bloco === 'rateio' ? m.tipo === 'custo_fixo' : m.tipo === 'material'))
  useEffect(() => { if (linhas) onCusto?.(resumo.total) }, [resumo.total]) // eslint-disable-line react-hooks/exhaustive-deps

  async function salvar(l, id) {
    setErro('')
    const m = matPorNome[l.nome.trim().toUpperCase()]
    if (!m) return setErro('Escolha um material da lista (cadastre novos em Compras → Materiais).')
    try {
      const ordem = id ? undefined : (linhas.reduce((t, x) => Math.max(t, x.ordem || 0), 0) + 1)
      await salvarLinhaFicha({ id, produto_id: produto.id, material_id: m.id, secao: l.secao, modo: l.modo, qtd: l.qtd, custo_proprio: l.custo_proprio, perda_pct: l.perda_pct, observacao: l.observacao, ordem })
      setNova(null); setEdit(null); carregar()
    } catch (e) { setErro(e.message) }
  }
  async function remover(id) { if (!confirm('Remover esta linha da ficha?')) return; try { await removerLinhaFicha(id); carregar() } catch (e) { setErro(e.message) } }
  async function copiar() {
    if (!copiarDe) return
    try { const n = await copiarFicha(copiarDe, produto.id); setErro(n ? '' : 'Nada novo para copiar.'); carregar() } catch (e) { setErro(e.message) }
  }

  if (!linhas) return <p className="card-sub" style={{ margin: 0 }}>Carregando ficha técnica…</p>

  const formLinha = (l, setL, onSalvar, onCancelar) => {
    const m = matPorNome[l.nome.trim().toUpperCase()]
    return (
      <div className="ficha-form">
        <input className="input" list={`ficha-mat-${l.bloco || 'todos'}`} placeholder="Material…" value={l.nome} autoFocus
          onChange={(e) => setL({ ...l, nome: e.target.value })} aria-label="Material" />
        <select className="input" value={l.modo} onChange={(e) => setL({ ...l, modo: e.target.value })} aria-label="Como medir">
          <option value="rendimento">rende (pares por {m ? UN_CURTA[m.unidade] : 'unid.'})</option>
          <option value="consumo">gasta por par</option>
        </select>
        <input className="input" inputMode="decimal" placeholder={l.modo === 'rendimento' ? 'pares' : 'qtd/par'} value={l.qtd} onChange={(e) => setL({ ...l, qtd: e.target.value })} aria-label="Quantidade" />
        <input className="input" inputMode="decimal" placeholder={m?.custo != null ? `R$ ${fmt(m.custo)}` : 'custo R$'} value={l.custo_proprio ?? ''} onChange={(e) => setL({ ...l, custo_proprio: e.target.value })} aria-label="Custo próprio desta linha (opcional)" title="Deixe vazio para usar o custo do cadastro" />
        <button className="btn btn-sm btn-dark" onClick={onSalvar}>Salvar</button>
        <button className="btn btn-sm" onClick={onCancelar}>Cancelar</button>
      </div>
    )
  }

  return (
    <div className="ficha2">
      {BLOCOS.map((b) => <datalist key={b.id} id={`ficha-mat-${b.id}`}>{sugeridos(b.id).map((m) => <option key={m.id} value={m.nome} />)}</datalist>)}

      <div className="fc-resumo">
        <div className="fc-total">
          <span>Custo do par</span>
          <b>{brl(resumo.total)}</b>
        </div>
        <div className="fc-comp">
          <div className="ft-barra">
            {BLOCOS.map((b) => resumo.porBloco[b.id] > 0 && <i key={b.id} style={{ width: `${(resumo.porBloco[b.id] / resumo.total) * 100}%`, background: b.cor }} title={`${b.nome}: ${brl(resumo.porBloco[b.id])}`} />)}
          </div>
          <div className="fc-tiles">
            {BLOCOS.map((b) => (
              <span key={b.id} className="fc-tile"><i style={{ background: b.cor }} /><span>{b.curto || b.nome}</span><b>{brl(resumo.porBloco[b.id])}</b><em>{resumo.total ? pct(resumo.porBloco[b.id] / resumo.total) : '—'}</em></span>
            ))}
          </div>
        </div>
      </div>

      {materiais.length === 0 && (
        <p className="card-sub" style={{ margin: 0 }}>Cadastre os materiais em <Link className="link" to="/compras">Compras → Materiais</Link> para montar a ficha.</p>
      )}

      {BLOCOS.map((b) => {
        const ls = linhas.filter((l) => blocoDe(l) === b.id)
        const max = Math.max(0.0001, ...ls.map(valorLinha))
        return (
          <section key={b.id} className="fb" style={{ '--bc': b.cor }}>
            <header className="fb-head">
              <h4><i />{b.nome}</h4>
              <span className="fb-pct">{resumo.total ? pct(resumo.porBloco[b.id] / resumo.total) : ''}</span>
              <b>{brl(resumo.porBloco[b.id])}</b>
            </header>
            {ls.map((l) => edit?.id === l.id ? (
              <div key={l.id} className="fb-edit">{formLinha(edit, setEdit, () => salvar(edit, l.id), () => setEdit(null))}</div>
            ) : (
              <Fragment key={l.id}>
                <div className="fb-linha">
                  <div className="fb-mat">
                    <b>{l.materiais?.nome}{l.observacao && <span className="ficha-aviso" title={l.observacao}> ⚠</span>}</b>
                    <small>
                      {l.modo === 'rendimento' ? <>rende {fmt(l.rendimento)} pares</> : <>{fmt(l.consumo)} {UN_CURTA[l.materiais?.unidade] || 'un'}/par</>}
                      {' · '}{brl(l.custo_proprio ?? l.materiais?.custo)}/{UN_CURTA[l.materiais?.unidade] || 'un'}{l.custo_proprio != null && <span title="Custo próprio desta linha"> *</span>}
                    </small>
                  </div>
                  <span className="fb-bar"><i style={{ width: `${(valorLinha(l) / max) * 100}%` }} /></span>
                  <b className="fb-val">{brl(valorLinha(l))}</b>
                  <span className="fb-acoes">
                    <button type="button" title="Editar" aria-label={`Editar ${l.materiais?.nome}`} onClick={() => { setNova(null); setEdit({ id: l.id, bloco: b.id, secao: l.secao, nome: l.materiais?.nome || '', modo: l.modo, qtd: fmt(l.modo === 'rendimento' ? l.rendimento : l.consumo), custo_proprio: l.custo_proprio ?? '', perda_pct: l.perda_pct, observacao: l.observacao }) }}>✎</button>
                    <button type="button" title="Remover" aria-label={`Remover ${l.materiais?.nome}`} onClick={() => remover(l.id)}>✕</button>
                  </span>
                </div>
                {l.observacao && <div className="fb-obs">⚠ {l.observacao}</div>}
              </Fragment>
            ))}
            {nova?.bloco === b.id
              ? <div className="fb-edit">{formLinha(nova, setNova, () => salvar(nova), () => setNova(null))}</div>
              : <button type="button" className="fb-add" onClick={() => { setEdit(null); setNova(vazio(b.id)) }}>+ adicionar em {b.curto && b.curto.length <= 6 ? b.curto : (b.curto || b.nome).toLowerCase()}</button>}
          </section>
        )
      })}

      <div className="fc-rodape">
        <span className="card-sub" style={{ margin: 0 }}>* custo próprio da linha · <Link className="link" to="/fichas">ver nas Fichas técnicas</Link></span>
        <span className="actions">
          <select className="input input-sm" style={{ width: 200, textAlign: 'left' }} value={copiarDe} onChange={(e) => setCopiarDe(e.target.value)} aria-label="Copiar ficha de">
            <option value="">Copiar de outro modelo…</option>
            {produtos.filter((p) => p.id !== produto.id).map((p) => <option key={p.id} value={p.id}>{p.ref} · {p.nome}</option>)}
          </select>
          <button className="btn btn-sm" onClick={copiar} disabled={!copiarDe}>Copiar</button>
        </span>
      </div>
      {erro && <p className="form-error" role="alert">{erro}</p>}
    </div>
  )
}
