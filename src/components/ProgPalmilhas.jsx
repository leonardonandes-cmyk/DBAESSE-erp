import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon.jsx'
import { dataBR, hojeISO, inteiro } from '../lib/format.js'
import { listarParceiros } from '../lib/parceiros.js'
import { supabase } from '../lib/supabase.js'
import { NUMEROS_PALMILHA, STATUS_PALMILHA, TIPOS_PALMILHA, criarProgPalmilha, listarProgPalmilha, mudarStatusPalmilha, numeroPalmilha, totalItem, totalProg } from '../lib/palmilhas.js'

/* Programação de PALMILHA para estoque: relação para o prestador (tipo · cor × grade + materiais que vão junto) */
export default function ProgPalmilhas({ cores }) {
  const [lista, setLista] = useState(null)
  const [nova, setNova] = useState(false)
  const [imprimir, setImprimir] = useState(null)
  const [erro, setErro] = useState('')
  async function carregar() { try { setLista(await listarProgPalmilha()) } catch (e) { setErro(e.message) } }
  useEffect(() => { carregar() }, [])
  const corPorId = useMemo(() => Object.fromEntries(cores.map((c) => [c.id, c])), [cores])

  async function status(p, s) {
    try { await mudarStatusPalmilha(p.id, s); await carregar() } catch (e) { setErro(e.message) }
  }

  return (
    <>
      <div className="mapas-topo">
        <p className="card-sub" style={{ margin: 0 }}>Programação <b>só de palmilha</b>, para ficar em estoque. Escolha o tipo, a cor e a grade; sai a <b>relação para o prestador</b> com a marca DBAESSE e os materiais que vão junto (palmilha, napa, EVA, gotas).</p>
        <button className="btn btn-dark" onClick={() => setNova(true)}><Icon name="mais" size={16} stroke={2} />Nova programação de palmilha</button>
      </div>
      {erro && <p className="form-error" role="alert">{erro}</p>}
      {!lista && <p className="card-sub">Carregando…</p>}
      {lista && lista.length === 0 && (
        <section className="card empty"><h2>Nenhuma programação de palmilha</h2><p>Monte a primeira e imprima a relação para o prestador.</p><button className="btn btn-dark" onClick={() => setNova(true)}>Nova programação de palmilha</button></section>
      )}
      <div className="mapas-grade">
        {lista?.map((p) => {
          const st = STATUS_PALMILHA[p.status] || STATUS_PALMILHA.aberta
          const tipos = [...new Set(p.itens.map((i) => i.tipo))]
          return (
            <article key={p.id} className="card mapa-card">
              <header>
                <div><span className="eyebrow">{numeroPalmilha(p.numero)} · <span className={`pill ${st.tom}`}>{st.label}</span></span><h3>{p.prestador || 'Sem prestador'}</h3></div>
                <div className="mapa-card-pares"><b>{inteiro(totalProg(p))}</b><small>pares</small></div>
              </header>
              <div className="palm-card-tipos">
                {tipos.map((t) => <span key={t}>{t.replace('PALMILHA ', '')}</span>)}
                <span className="palm-card-cores">{p.itens.map((i, k) => <i key={k} title={corPorId[i.cor_id]?.nome} style={{ background: corPorId[i.cor_id]?.hex || '#ddd' }} />)}</span>
              </div>
              <div className="mapa-card-dados">
                <span><small>Data</small>{dataBR(p.data)}</span>
                <span><small>Prev. entrega</small>{dataBR(p.previsao)}</span>
              </div>
              <div className="mapa-card-acoes">
                <button className="btn btn-sm btn-dark" onClick={() => setImprimir(p)}>Imprimir relação</button>
                {(p.status || 'aberta') === 'aberta' && <button className="btn btn-sm" onClick={() => status(p, 'recebida')}>Marcar recebida</button>}
                {p.status === 'recebida' && <button className="btn btn-sm" onClick={() => status(p, 'aberta')}>Desfazer</button>}
              </div>
            </article>
          )
        })}
      </div>
      {nova && <NovaProgPalmilha cores={cores} onFechar={() => setNova(false)} onSalvo={async (r) => { setNova(false); const l = await listarProgPalmilha(); setLista(l); const p = l.find((x) => x.id === r.id); if (p) setImprimir(p) }} />}
      {imprimir && <ImprimirPalmilha prog={imprimir} corPorId={corPorId} onFechar={() => setImprimir(null)} />}
    </>
  )
}

const novaLinha = (tipo = TIPOS_PALMILHA[1]) => ({ k: Math.random().toString(36).slice(2), tipo, cor_id: '', obs: '', grade: {} })

function NovaProgPalmilha({ cores, onFechar, onSalvo }) {
  const [cab, setCab] = useState({ prestador: '', data: hojeISO(), previsao: '', observacao: '' })
  const [linhas, setLinhas] = useState([novaLinha()])
  const [insumos, setInsumos] = useState([{ descricao: '', quantidade: '' }, { descricao: '', quantidade: '' }, { descricao: '', quantidade: '' }])
  const [parceiros, setParceiros] = useState([])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  useEffect(() => { listarParceiros().then(setParceiros).catch(() => {}) }, [])
  const ordenadas = useMemo(() => [...cores].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [cores])
  const mudar = (k, fn) => setLinhas((ls) => ls.map((l) => (l.k === k ? fn(l) : l)))
  const total = linhas.reduce((t, l) => t + totalItem(l), 0)

  async function salvar() {
    setErro(''); setSalvando(true)
    try {
      const p = parceiros.find((x) => x.nome.toLowerCase() === cab.prestador.trim().toLowerCase())
      onSalvo(await criarProgPalmilha({ cab: { ...cab, prestador_id: p?.id }, itens: linhas, insumos }))
    } catch (e) { setErro(e.message); setSalvando(false) }
  }

  return (
    <div className="modal-bg" onClick={onFechar}>
      <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div><div className="eyebrow">Produção · palmilha para estoque</div><h2>Nova programação de palmilha</h2></div>
          <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
        </div>
        <div className="mapa-cab palm-cab">
          <label className="field"><span>Prestador de serviço</span><input list="palm-prest" value={cab.prestador} onChange={(e) => setCab({ ...cab, prestador: e.target.value })} placeholder="Nome do prestador" /></label>
          <datalist id="palm-prest">{parceiros.filter((p) => p.ativo !== false && (p.tipos || []).includes('fornecedor')).map((p) => <option key={p.id} value={p.nome} />)}</datalist>
          <label className="field"><span>Data</span><input type="date" value={cab.data} onChange={(e) => setCab({ ...cab, data: e.target.value })} /></label>
          <label className="field"><span>Prev. entrega</span><input type="date" value={cab.previsao} onChange={(e) => setCab({ ...cab, previsao: e.target.value })} /></label>
        </div>

        <section className="mapa-bloco">
          <div className="table-wrap">
            <table className="mapa-grade palm-grade">
              <thead><tr><th>Palmilha</th><th>Cor</th>{NUMEROS_PALMILHA.map((n) => <th key={n} className="c">{n}</th>)}<th className="r">Total</th><th /></tr></thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={l.k}>
                    <td><select className="input input-sm" value={l.tipo} onChange={(e) => mudar(l.k, (x) => ({ ...x, tipo: e.target.value }))} aria-label="Tipo de palmilha">{TIPOS_PALMILHA.map((t) => <option key={t} value={t}>{t.replace('PALMILHA ', '')}</option>)}</select></td>
                    <td>
                      <select className="input input-sm mapa-cor" value={l.cor_id} onChange={(e) => mudar(l.k, (x) => ({ ...x, cor_id: e.target.value }))} aria-label="Cor">
                        <option value="">Cor…</option>
                        {ordenadas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                      <input className="input input-sm palm-obs" value={l.obs} onChange={(e) => mudar(l.k, (x) => ({ ...x, obs: e.target.value }))} placeholder="OBS (gota, napa…)" />
                    </td>
                    {NUMEROS_PALMILHA.map((n) => (
                      <td key={n} className="c"><input className="input input-sm mapa-q" inputMode="numeric" enterKeyHint="next" data-grade value={l.grade[n] ?? ''} aria-label={`Número ${n}`}
                        onChange={(e) => mudar(l.k, (x) => ({ ...x, grade: { ...x.grade, [n]: e.target.value.replace(/\D/g, '') } }))} /></td>
                    ))}
                    <td className="r"><b>{inteiro(totalItem(l))}</b></td>
                    <td className="r mapa-acoes">
                      {i > 0 && <button type="button" className="link-btn" title="Copiar a grade da linha de cima" onClick={() => mudar(l.k, (x) => ({ ...x, grade: { ...linhas[i - 1].grade } }))}>↑ grade</button>}
                      {linhas.length > 1 && <button type="button" className="link-btn" onClick={() => setLinhas((ls) => ls.filter((y) => y.k !== l.k))}>tirar</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={2}><b>Total</b></td>{NUMEROS_PALMILHA.map((n) => <td key={n} className="c"><b>{inteiro(linhas.reduce((t, l) => t + (Number(l.grade[n]) || 0), 0)) || ''}</b></td>)}<td className="r"><b>{inteiro(total)}</b></td><td /></tr></tfoot>
            </table>
          </div>
          <button type="button" className="fb-add" onClick={() => setLinhas((ls) => [...ls, { ...novaLinha(ls[ls.length - 1]?.tipo), grade: { ...(ls[ls.length - 1]?.grade || {}) } }])}>+ adicionar linha (já vem com o tipo e a grade da linha de cima)</button>
        </section>

        <section className="mapa-bloco">
          <header className="mapa-bloco-head"><div className="mapa-bloco-tit"><span className="eyebrow">Vai junto para o prestador</span><b>Materiais entregues</b></div></header>
          <div className="palm-insumos">
            {insumos.map((m, i) => (
              <div key={i} className="palm-insumo">
                <input className="input input-sm" value={m.descricao} onChange={(e) => setInsumos((xs) => xs.map((y, j) => (j === i ? { ...y, descricao: e.target.value } : y)))} placeholder={['Ex.: Palmilha base salto', 'Ex.: Napa Floater nude', 'Ex.: EVA 2mm'][i] || 'Material'} />
                <input className="input input-sm" value={m.quantidade} onChange={(e) => setInsumos((xs) => xs.map((y, j) => (j === i ? { ...y, quantidade: e.target.value } : y)))} placeholder="Qtd (ex.: 3 m, 120 pares)" />
              </div>
            ))}
          </div>
          <button type="button" className="fb-add" onClick={() => setInsumos((xs) => [...xs, { descricao: '', quantidade: '' }])}>+ adicionar material</button>
          <label className="field" style={{ marginTop: 10 }}><span>Observação</span><input value={cab.observacao} onChange={(e) => setCab({ ...cab, observacao: e.target.value })} placeholder="Ex.: gota na cor, costura reforçada…" /></label>
        </section>

        {erro && <p className="form-error" role="alert">{erro}</p>}
        <div className="mapa-rodape">
          <span><b>{linhas.filter((l) => totalItem(l) > 0).length}</b> linhas · <b>{inteiro(total)}</b> pares de palmilha</span>
          <span className="actions">
            <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
            <button type="button" className="btn btn-dark" data-grade-ok disabled={salvando || !total} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar e imprimir relação'}</button>
          </span>
        </div>
      </div>
    </div>
  )
}

const textoEscuro = (hex) => { const h = (hex || '#ffffff').replace('#', ''); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return (r * 299 + g * 587 + b * 114) / 1000 > 140 }

function ImprimirPalmilha({ prog, corPorId, onFechar }) {
  const [empresa, setEmpresa] = useState(null)
  useEffect(() => {
    supabase.from('empresas').select('nome,razao_social,cnpj,telefone,cidade,uf').limit(1).maybeSingle().then(({ data }) => setEmpresa(data || null)).catch(() => {})
    document.body.classList.add('imprimindo'); return () => document.body.classList.remove('imprimindo')
  }, [])
  const linhaEmpresa = empresa ? [empresa.razao_social, empresa.cnpj && `CNPJ ${empresa.cnpj}`, empresa.telefone, empresa.cidade && `${empresa.cidade}${empresa.uf ? `/${empresa.uf}` : ''}`].filter(Boolean).join(' · ') : ''
  const nums = [...new Set(prog.itens.flatMap((i) => Object.keys(i.grade).map(Number)))].sort((a, b) => a - b)
  const tipos = [...new Set(prog.itens.map((i) => i.tipo))]
  const total = totalProg(prog)

  return createPortal(
    <div className="print-root">
      <div className="print-barra no-print">
        <b>{numeroPalmilha(prog.numero)} · relação para o prestador</b>
        <span className="actions">
          <button className="btn btn-dark" onClick={() => window.print()}>Imprimir</button>
          <button className="btn" onClick={onFechar}>Fechar</button>
        </span>
      </div>
      <div className="print-folhas">
        <div className="folha">
          <header className="pr-cab pr-cab-palm">
            <div className="pr-marca">
              <div className="pr-logo"><b>DBAESSE</b>{linhaEmpresa && <small>{linhaEmpresa}</small>}</div>
              <div className="pr-doc"><b>Relação de palmilha</b><small>Programação para estoque · {tipos.map((t) => t.replace('PALMILHA ', '')).join(' · ')}</small></div>
            </div>
            <div className="pr-cab-dados">
              <span><small>Data</small><b>{dataBR(prog.data)}</b></span>
              <span><small>Prestador</small><b>{prog.prestador || '—'}</b></span>
              <span><small>Prev. entrega</small><b>{dataBR(prog.previsao)}</b></span>
              <span className="pr-cab-dest"><small>Programação</small><b>{numeroPalmilha(prog.numero)}</b></span>
              <span className="pr-dest"><small>Qtd pares</small><b>{inteiro(total)}</b></span>
            </div>
            <table className="pr-tab pr-palm-total">
              <thead><tr><th>Grade</th>{nums.map((n) => <th key={n}>{n}</th>)}<th>Total</th></tr></thead>
              <tbody><tr><td>Qtd pares</td>{nums.map((n) => <td key={n}>{prog.itens.reduce((t, i) => t + (Number(i.grade[n]) || 0), 0) || ''}</td>)}<td><b>{total}</b></td></tr></tbody>
            </table>
          </header>

          {tipos.map((tipo) => prog.itens.filter((i) => i.tipo === tipo).map((it, k) => {
            const c = corPorId[it.cor_id]; const hex = c?.hex || '#FFFFFF'
            return (
              <article key={`${tipo}${k}`} className="pr-tira">
                <div className="pr-tira-topo"><span>{dataBR(prog.data)}</span><b>{tipo}</b><span>{numeroPalmilha(prog.numero)} · {prog.prestador || ''}</span></div>
                <table className="pr-tab">
                  <tbody>
                    <tr><th rowSpan={2} className="pr-tira-cor" style={{ background: hex, color: textoEscuro(hex) ? '#151515' : '#fff' }}>{c?.nome || '—'}</th>{nums.map((n) => <th key={n}>{n}</th>)}<th>Total</th></tr>
                    <tr>{nums.map((n) => <td key={n}>{it.grade[n] || ''}</td>)}<td><b>{totalItem(it)}</b></td></tr>
                  </tbody>
                </table>
                {it.obs && <div className="pr-tira-obs">{it.obs}</div>}
              </article>
            )
          }))}

          <section className="pr-palm-mat">
            <b>Materiais entregues ao prestador</b>
            <table className="pr-tab">
              <thead><tr><th style={{ textAlign: 'left' }}>Material</th><th>Quantidade</th><th>Conferido</th></tr></thead>
              <tbody>
                {[...(prog.insumos || []), ...Array.from({ length: Math.max(0, 4 - (prog.insumos || []).length) }, () => ({ descricao: '', quantidade: '' }))].map((m, i) => (
                  <tr key={i}><td style={{ textAlign: 'left' }}>{m.descricao || ' '}</td><td>{m.quantidade}</td><td>☐</td></tr>
                ))}
              </tbody>
            </table>
            {prog.observacao && <p className="pr-tira-obs">{prog.observacao}</p>}
          </section>

          <div className="pr-palm-receb"><span>Data de entrega: ____/____/______</span><span>Data de recebimento: ____/____/______</span></div>
          <div className="pr-assin"><span>Entregue por (DBAESSE)</span><span>Recebido por (prestador)</span></div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
