import { useMemo, useState } from 'react'
import { FotoProduto } from './FotoProduto.jsx'
import { criarMapa } from '../lib/mapas.js'
import { hojeISO, inteiro } from '../lib/format.js'

/*
  Novo mapa de programação — mesmo jeito da planilha:
  cabeçalho (pedido, cliente, marca, data, previsão) + referências, cada uma com OBS e cores × grade.
  Ao salvar, cada cor vira uma OP ligada ao mapa.
*/
const novaCor = () => ({ k: Math.random().toString(36).slice(2), cor_id: '', grade: {} })

export default function NovoMapa({ produtos, cores, parceiros = [], onFechar, onSalvo }) {
  const [cab, setCab] = useState({ pedido: '', cliente: '', parceiro_id: '', marca: 'SEM LOGO', data: hojeISO(), previsao: '', prioridade: 'normal', observacao: '' })
  const [blocos, setBlocos] = useState([])
  const [escolha, setEscolha] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const corPorId = useMemo(() => Object.fromEntries(cores.map((c) => [c.id, c])), [cores])
  const ativos = useMemo(() => produtos.filter((p) => p.status !== 'inativo' && p.skus.length).sort((a, b) => a.ref.localeCompare(b.ref, 'pt-BR', { numeric: true })), [produtos])
  const clientes = parceiros.filter((p) => p.ativo !== false && (p.tipos || []).some((t) => t === 'cliente' || t === 'revendedora'))

  const setC = (k) => (e) => setCab({ ...cab, [k]: e.target.value })
  const mudarBloco = (i, fn) => setBlocos((bs) => bs.map((b, j) => (j === i ? fn(b) : b)))

  function adicionarRef(id) {
    const p = produtos.find((x) => x.id === id); if (!p) return
    setBlocos((bs) => [...bs, { k: Math.random().toString(36).slice(2), produto: p, obs: (p.tipo || '').toUpperCase(), cores: [novaCor()] }])
    setEscolha('')
  }

  const numerosDe = (p) => [...new Set(p.skus.map((s) => s.numero))].sort((a, b) => a - b)
  const coresDe = (p) => [...new Set(p.skus.map((s) => s.cor_id))].map((id) => corPorId[id]).filter(Boolean)
  const totalLinha = (c) => Object.values(c.grade).reduce((t, q) => t + (Number(q) || 0), 0)
  const totalBloco = (b) => b.cores.reduce((t, c) => t + totalLinha(c), 0)
  const totalGeral = blocos.reduce((t, b) => t + totalBloco(b), 0)

  async function salvar() {
    setErro(''); setSalvando(true)
    try {
      const cli = clientes.find((c) => c.nome.toLowerCase() === cab.cliente.trim().toLowerCase())
      const r = await criarMapa({ cab: { ...cab, parceiro_id: cli?.id || null }, blocos })
      onSalvo(r)
    } catch (e) { setErro(e.message); setSalvando(false) }
  }

  return (
    <div className="modal-bg" onClick={onFechar}>
      <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div><div className="eyebrow">Produção · programação</div><h2>Novo mapa de programação</h2></div>
          <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
        </div>

        <div className="mapa-cab">
          <label className="field"><span>Pedido / código</span><input value={cab.pedido} onChange={setC('pedido')} placeholder="PE82" /></label>
          <label className="field"><span>Cliente</span><input list="mapa-clientes" value={cab.cliente} onChange={setC('cliente')} placeholder="PRONTA ENTREGA" /></label>
          <datalist id="mapa-clientes">{clientes.map((c) => <option key={c.id} value={c.nome} />)}</datalist>
          <label className="field"><span>Marca</span><input value={cab.marca} onChange={setC('marca')} placeholder="SEM LOGO" /></label>
          <label className="field"><span>Data</span><input type="date" value={cab.data} onChange={setC('data')} /></label>
          <label className="field"><span>Prev. entrega</span><input type="date" value={cab.previsao} onChange={setC('previsao')} /></label>
          <label className="field"><span>Prioridade</span>
            <select className="input" value={cab.prioridade} onChange={setC('prioridade')}><option value="normal">Normal</option><option value="urgente">Urgente</option></select>
          </label>
        </div>

        {blocos.map((b, i) => {
          const nums = numerosDe(b.produto)
          const cs = coresDe(b.produto)
          return (
            <section key={b.k} className="mapa-bloco">
              <header className="mapa-bloco-head">
                <FotoProduto p={b.produto} size={52} />
                <div className="mapa-bloco-tit">
                  <span className="eyebrow">Referência {i + 1}</span>
                  <b>{b.produto.ref} · {b.produto.nome}</b>
                  <label className="mapa-obs"><span>OBS</span><input value={b.obs} onChange={(e) => mudarBloco(i, (x) => ({ ...x, obs: e.target.value }))} placeholder="Ex.: SALTO BLOCO · SOLA CRAVINHO · GOTA NA COR" /></label>
                </div>
                <div className="mapa-bloco-tot"><small>Pares</small><b>{inteiro(totalBloco(b))}</b></div>
                <button type="button" className="btn btn-sm icon-btn" aria-label="Tirar referência" onClick={() => setBlocos((bs) => bs.filter((_, j) => j !== i))}>✕</button>
              </header>
              <div className="table-wrap">
                <table className="mapa-grade">
                  <thead><tr><th>Cor</th>{nums.map((n) => <th key={n} className="c">{n}</th>)}<th className="r">Total</th><th /></tr></thead>
                  <tbody>
                    {b.cores.map((c, ci) => (
                      <tr key={c.k}>
                        <td>
                          <select className="input input-sm mapa-cor" value={c.cor_id} onChange={(e) => mudarBloco(i, (x) => ({ ...x, cores: x.cores.map((y) => (y.k === c.k ? { ...y, cor_id: e.target.value } : y)) }))} aria-label="Cor">
                            <option value="">Escolha a cor…</option>
                            {cs.map((co) => <option key={co.id} value={co.id}>{co.nome}</option>)}
                          </select>
                        </td>
                        {nums.map((n) => (
                          <td key={n} className="c">
                            <input className="input input-sm mapa-q" inputMode="numeric" value={c.grade[n] ?? ''} aria-label={`Número ${n}`}
                              onChange={(e) => mudarBloco(i, (x) => ({ ...x, cores: x.cores.map((y) => (y.k === c.k ? { ...y, grade: { ...y.grade, [n]: e.target.value.replace(/\D/g, '') } } : y)) }))} />
                          </td>
                        ))}
                        <td className="r"><b>{inteiro(totalLinha(c))}</b></td>
                        <td className="r mapa-acoes">
                          {ci > 0 && <button type="button" className="link-btn" title="Copiar a grade da linha de cima" onClick={() => mudarBloco(i, (x) => ({ ...x, cores: x.cores.map((y, yi) => (yi === ci ? { ...y, grade: { ...x.cores[ci - 1].grade } } : y)) }))}>↑ grade</button>}
                          <button type="button" className="link-btn" onClick={() => mudarBloco(i, (x) => ({ ...x, cores: x.cores.filter((y) => y.k !== c.k) }))}>tirar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr><td><b>Total</b></td>{nums.map((n) => <td key={n} className="c"><b>{inteiro(b.cores.reduce((t, c) => t + (Number(c.grade[n]) || 0), 0))}</b></td>)}<td className="r"><b>{inteiro(totalBloco(b))}</b></td><td /></tr>
                  </tfoot>
                </table>
              </div>
              <button type="button" className="fb-add" onClick={() => mudarBloco(i, (x) => ({ ...x, cores: [...x.cores, { ...novaCor(), grade: { ...(x.cores[x.cores.length - 1]?.grade || {}) } }] }))}>+ adicionar cor (já vem com a grade da linha de cima)</button>
            </section>
          )
        })}

        <div className="mapa-add">
          <select className="input" value={escolha} onChange={(e) => adicionarRef(e.target.value)} aria-label="Adicionar referência">
            <option value="">+ Adicionar referência ao mapa…</option>
            {ativos.map((p) => <option key={p.id} value={p.id}>{p.ref} · {p.nome}{p.tipo ? ` · ${p.tipo}` : ''}</option>)}
          </select>
        </div>

        {erro && <p className="form-error" role="alert">{erro}</p>}
        <div className="mapa-rodape">
          <span><b>{blocos.length}</b> referências · <b>{inteiro(totalGeral)}</b> pares · <b>{blocos.reduce((t, b) => t + b.cores.filter((c) => totalLinha(c) > 0).length, 0)}</b> OPs (uma por cor)</span>
          <span className="actions">
            <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
            <button type="button" className="btn btn-dark" disabled={salvando || !totalGeral} onClick={salvar}>{salvando ? 'Criando as OPs…' : 'Salvar mapa e criar OPs'}</button>
          </span>
        </div>
      </div>
    </div>
  )
}
