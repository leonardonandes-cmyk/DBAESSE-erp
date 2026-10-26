import { useMemo, useState } from 'react'
import { codigoSku, criarCor, criarProduto } from '../lib/produtos.js'

const TIPOS = ['Mocassim', 'Papete', 'Fisherman', 'Rasteira', 'Sapatilha', 'Salto bloco', 'Plataforma', 'Sandália', 'Tênis', 'Bota']

export default function NovoModelo({ cores, onFechar, onSalvo, onCorCriada }) {
  const [f, setF] = useState({ ref: '', nome: '', tipo: '', colecao: '', ncm: '', gradeDe: 34, gradeAte: 39 })
  const [sel, setSel] = useState([])
  const [novaCor, setNovaCor] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const coresSel = cores.filter((c) => sel.includes(c.id))
  const numeros = useMemo(() => {
    const de = Number(f.gradeDe), ate = Number(f.gradeAte)
    if (!de || !ate || ate < de || ate - de > 15) return []
    return Array.from({ length: ate - de + 1 }, (_, i) => de + i)
  }, [f.gradeDe, f.gradeAte])
  const total = coresSel.length * numeros.length
  const exemplo = f.ref && coresSel[0] && numeros[0] ? codigoSku(f.ref, coresSel[0].sigla, numeros[0]) : null

  async function adicionarCor() {
    const nome = novaCor.trim()
    if (!nome) return
    const existe = cores.find((c) => c.nome.toLowerCase() === nome.toLowerCase())
    if (existe) { setSel([...new Set([...sel, existe.id])]); setNovaCor(''); return }
    try {
      const c = await criarCor(nome, null, cores.map((x) => x.sigla))
      onCorCriada(c)
      setSel([...sel, c.id])
      setNovaCor('')
    } catch (e) { setErro(e.message) }
  }

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (!coresSel.length) return setErro('Escolha pelo menos uma cor.')
    if (!numeros.length) return setErro('Confira a grade (ex.: 34 até 39).')
    setSalvando(true)
    try {
      await criarProduto({ ...f, gradeDe: Number(f.gradeDe), gradeAte: Number(f.gradeAte), cores: coresSel })
      onSalvo(f.ref.trim().toUpperCase())
    } catch (e) {
      setErro(e.message)
      setSalvando(false)
    }
  }

  return (
    <div className="modal-bg" onClick={onFechar}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={salvar}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">Cadastro</div>
            <h2>Novo modelo</h2>
          </div>
          <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
        </div>

        <div className="form-grid">
          <label className="field"><span>REF *</span><input required value={f.ref} onChange={set('ref')} placeholder="SP8.801" /></label>
          <label className="field span-2"><span>Nome *</span><input required value={f.nome} onChange={set('nome')} placeholder="Sapatilha Vienna" /></label>
          <label className="field">
            <span>Tipo</span>
            <input list="tipos" value={f.tipo} onChange={set('tipo')} placeholder="Sapatilha" />
            <datalist id="tipos">{TIPOS.map((t) => <option key={t} value={t} />)}</datalist>
          </label>
          <label className="field"><span>Coleção</span><input value={f.colecao} onChange={set('colecao')} placeholder="Verão 27" /></label>
          <label className="field"><span>NCM</span><input value={f.ncm} onChange={set('ncm')} placeholder="6402.99.90" /></label>
          <label className="field"><span>Grade de</span><input type="number" value={f.gradeDe} onChange={set('gradeDe')} /></label>
          <label className="field"><span>até</span><input type="number" value={f.gradeAte} onChange={set('gradeAte')} /></label>
        </div>

        <div className="field">
          <span>Cores *</span>
          <div className="chips">
            {cores.map((c) => (
              <button type="button" key={c.id} className={`color-tag ${sel.includes(c.id) ? 'on' : ''}`}
                onClick={() => setSel(sel.includes(c.id) ? sel.filter((x) => x !== c.id) : [...sel, c.id])}>
                <span className="dot" style={{ background: c.hex || '#ddd' }} />{c.nome}
              </button>
            ))}
          </div>
          <div className="actions" style={{ marginTop: 10 }}>
            <input className="input" value={novaCor} onChange={(e) => setNovaCor(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarCor() } }}
              placeholder="Outra cor (ex.: Preto/Nude)" style={{ flex: 1 }} />
            <button type="button" className="btn" onClick={adicionarCor}>Adicionar cor</button>
          </div>
        </div>

        <div className="preview">
          <b>{total} SKUs</b> serão gerados{exemplo && <> · ex.: <span className="mono">{exemplo}</span></>}
        </div>

        {erro && <p className="form-error" role="alert">{erro}</p>}

        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="btn btn-dark" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar modelo'}</button>
        </div>
      </form>
    </div>
  )
}
