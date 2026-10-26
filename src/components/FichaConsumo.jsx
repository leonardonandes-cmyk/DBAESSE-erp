import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UN_CURTA, copiarFicha, listarFichaConsumo, listarMateriais, removerLinhaFicha, salvarLinhaFicha } from '../lib/compras.js'
import { brl } from '../lib/format.js'

/* Ficha de consumo do modelo: quanto cada PAR gasta de cada material (+ % de perda) e o custo de material por par */
export default function FichaConsumo({ produto, produtos }) {
  const [linhas, setLinhas] = useState(null)
  const [materiais, setMateriais] = useState([])
  const [nova, setNova] = useState({ material_id: '', consumo: '', perda_pct: '' })
  const [copiarDe, setCopiarDe] = useState('')
  const [erro, setErro] = useState('')

  async function carregar() {
    try {
      const [l, m] = await Promise.all([listarFichaConsumo(produto.id), listarMateriais()])
      setLinhas(l); setMateriais(m.filter((x) => x.ativo))
    } catch (e) { setErro(e.message) }
  }
  useEffect(() => { setLinhas(null); carregar() }, [produto.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function adicionar() {
    setErro('')
    if (!nova.material_id || !(Number(String(nova.consumo).replace(',', '.')) > 0)) return setErro('Escolha o material e o consumo por par.')
    try { await salvarLinhaFicha({ produto_id: produto.id, ...nova }); setNova({ material_id: '', consumo: '', perda_pct: '' }); carregar() } catch (e) { setErro(e.message) }
  }
  async function remover(id) { try { await removerLinhaFicha(id); carregar() } catch (e) { setErro(e.message) } }
  async function copiar() {
    if (!copiarDe) return
    try { const n = await copiarFicha(copiarDe, produto.id); setErro(n ? '' : 'Nada novo para copiar.'); carregar() } catch (e) { setErro(e.message) }
  }

  if (!linhas) return <p className="card-sub" style={{ margin: 0 }}>Carregando ficha de consumo…</p>
  const usados = new Set(linhas.map((l) => l.material_id))
  const custoPar = linhas.reduce((t, l) => t + Number(l.consumo) * (1 + Number(l.perda_pct) / 100) * Number(l.materiais?.custo || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="divisor"><span>Consumo por par</span></div>
      {materiais.length === 0 ? (
        <p className="card-sub" style={{ margin: 0 }}>Cadastre os materiais em <Link className="link" to="/compras">Compras → Materiais</Link> para montar a ficha de consumo.</p>
      ) : (
        <>
          {linhas.length > 0 && (
            <table>
              <thead><tr><th>Material</th><th className="r">Por par</th><th className="r">Perda</th><th /></tr></thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id}>
                    <td>{l.materiais?.nome}{l.materiais?.por_numero && <span className="card-sub"> · por nº</span>}</td>
                    <td className="r">{String(l.consumo).replace('.', ',')} {UN_CURTA[l.materiais?.unidade]}</td>
                    <td className="r">{Number(l.perda_pct) ? `${String(l.perda_pct).replace('.', ',')}%` : '—'}</td>
                    <td className="r"><button className="link-btn" onClick={() => remover(l.id)}>remover</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="ficha-add">
            <select className="input" value={nova.material_id} onChange={(e) => setNova({ ...nova, material_id: e.target.value })} aria-label="Material">
              <option value="">+ Material…</option>
              {materiais.filter((m) => !usados.has(m.id)).map((m) => <option key={m.id} value={m.id}>{m.nome} ({UN_CURTA[m.unidade]})</option>)}
            </select>
            <input className="input" placeholder="por par" inputMode="decimal" value={nova.consumo} onChange={(e) => setNova({ ...nova, consumo: e.target.value })} aria-label="Consumo por par" />
            <input className="input" placeholder="perda %" inputMode="decimal" value={nova.perda_pct} onChange={(e) => setNova({ ...nova, perda_pct: e.target.value })} aria-label="Perda %" />
            <button className="btn" onClick={adicionar}>Adicionar</button>
          </div>
          <div className="actions" style={{ justifyContent: 'space-between' }}>
            <span className="card-sub" style={{ margin: 0 }}>Custo de material por par: <b style={{ color: 'var(--ink)' }}>{brl(custoPar)}</b></span>
            <span className="actions">
              <select className="input input-sm" style={{ width: 170, textAlign: 'left' }} value={copiarDe} onChange={(e) => setCopiarDe(e.target.value)} aria-label="Copiar ficha de">
                <option value="">Copiar de outro modelo…</option>
                {produtos.filter((p) => p.id !== produto.id).map((p) => <option key={p.id} value={p.id}>{p.ref} · {p.nome}</option>)}
              </select>
              <button className="btn btn-sm" onClick={copiar} disabled={!copiarDe}>Copiar</button>
            </span>
          </div>
        </>
      )}
      {erro && <p className="form-error" role="alert">{erro}</p>}
    </div>
  )
}
