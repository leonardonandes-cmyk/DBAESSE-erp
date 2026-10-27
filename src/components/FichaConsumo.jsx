import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { UN_CURTA, copiarFicha, listarFichaConsumo, listarMateriais, removerLinhaFicha, salvarLinhaFicha } from '../lib/compras.js'
import { SECOES, custoFicha, pct, valorLinha } from '../lib/custos.js'
import { brl } from '../lib/format.js'

/*
  Ficha técnica do modelo (padrão da planilha FICHA TÉCNICA):
  seções Cabedal · Solado/palmilha · Acabamento · Mão de obra · Custo fixo (rateio).
  Cada linha: material + consumo por par OU "rende X pares" por unidade → valor por par.
*/
const vazio = (secao) => ({ secao, nome: '', modo: 'rendimento', qtd: '', custo_proprio: '' })
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
  const resumo = useMemo(() => custoFicha(linhas), [linhas])
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
        <input className="input" list="ficha-materiais" placeholder="Material…" value={l.nome} autoFocus
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
    <div className="ficha">
      <datalist id="ficha-materiais">{materiais.map((m) => <option key={m.id} value={m.nome} />)}</datalist>

      <div className="ficha-topo">
        <div>
          <span className="eyebrow">Custo do par</span>
          <b className="ficha-total">{brl(resumo.total)}</b>
        </div>
        <div className="ficha-barra" aria-label="Composição do custo">
          {SECOES.map((s) => resumo.porSecao[s.id] > 0 && (
            <i key={s.id} className={`sec-${s.id}`} style={{ width: `${(resumo.porSecao[s.id] / resumo.total) * 100}%` }} title={`${s.label}: ${brl(resumo.porSecao[s.id])}`} />
          ))}
        </div>
        <div className="ficha-legenda">
          {SECOES.map((s) => (
            <span key={s.id}><i className={`sec-${s.id}`} />{s.label} <b>{brl(resumo.porSecao[s.id])}</b> <small>{resumo.total ? pct(resumo.porSecao[s.id] / resumo.total) : ''}</small></span>
          ))}
        </div>
      </div>

      {materiais.length === 0 && (
        <p className="card-sub" style={{ margin: 0 }}>Cadastre os materiais em <Link className="link" to="/compras">Compras → Materiais</Link> para montar a ficha.</p>
      )}

      {SECOES.map((s) => {
        const ls = linhas.filter((l) => l.secao === s.id)
        return (
          <section key={s.id} className="ficha-secao">
            <header>
              <h3><i className={`sec-${s.id}`} />{s.label}</h3>
              <span>{brl(resumo.porSecao[s.id])}</span>
            </header>
            {ls.length > 0 && (
              <table className="ficha-tab">
                <thead><tr><th>Material</th><th className="r">Custo</th><th className="r">Consumo</th><th className="r">Por par</th><th /></tr></thead>
                <tbody>
                  {ls.map((l) => edit?.id === l.id ? (
                    <tr key={l.id}><td colSpan={5}>{formLinha(edit, setEdit, () => salvar(edit, l.id), () => setEdit(null))}</td></tr>
                  ) : (
                    <Fragment key={l.id}>
                      <tr>
                        <td>
                          {l.materiais?.nome}
                          {l.observacao && <span className="ficha-aviso" title={l.observacao}> ⚠</span>}
                        </td>
                        <td className="r" title={l.custo_proprio != null ? 'Custo próprio desta linha' : 'Custo do cadastro'}>
                          {brl(l.custo_proprio ?? l.materiais?.custo)}{l.custo_proprio != null && <sup>*</sup>}
                          <small> /{UN_CURTA[l.materiais?.unidade] || 'un'}</small>
                        </td>
                        <td className="r">{l.modo === 'rendimento' ? <>rende <b>{fmt(l.rendimento)}</b> pares</> : <><b>{fmt(l.consumo)}</b> {UN_CURTA[l.materiais?.unidade]}/par</>}</td>
                        <td className="r"><b>{brl(valorLinha(l))}</b></td>
                        <td className="r ficha-acoes">
                          <button className="link-btn" onClick={() => { setNova(null); setEdit({ id: l.id, secao: l.secao, nome: l.materiais?.nome || '', modo: l.modo, qtd: fmt(l.modo === 'rendimento' ? l.rendimento : l.consumo), custo_proprio: l.custo_proprio ?? '', perda_pct: l.perda_pct, observacao: l.observacao }) }}>editar</button>
                          <button className="link-btn" onClick={() => remover(l.id)}>remover</button>
                        </td>
                      </tr>
                      {l.observacao && <tr className="ficha-obs"><td colSpan={5}>⚠ {l.observacao}</td></tr>}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
            {nova?.secao === s.id
              ? formLinha(nova, setNova, () => salvar(nova), () => setNova(null))
              : <button className="link-btn ficha-add-btn" onClick={() => { setEdit(null); setNova(vazio(s.id)) }}>+ adicionar em {s.label.toLowerCase()}</button>}
          </section>
        )
      })}

      <div className="actions" style={{ justifyContent: 'space-between' }}>
        <span className="card-sub" style={{ margin: 0 }}>* custo próprio da linha (diferente do cadastro do material)</span>
        <span className="actions">
          <select className="input input-sm" style={{ width: 190, textAlign: 'left' }} value={copiarDe} onChange={(e) => setCopiarDe(e.target.value)} aria-label="Copiar ficha de">
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
