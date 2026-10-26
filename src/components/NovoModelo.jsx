import { useMemo, useState } from 'react'
import { atualizarProduto, codigoSku, criarCor, criarProduto } from '../lib/produtos.js'

const TIPOS = ['Papete', 'Salto bloco', 'Rasteira', 'Ana bela', 'Sapatilha', 'Mocassim', 'Fisherman', 'Plataforma', 'Sandália', 'Tênis', 'Bota']

// Serve para CRIAR (sem `produto`) e para EDITAR (com `produto`)
export default function NovoModelo({ produto, cores, onFechar, onSalvo, onCorCriada }) {
  const editando = Boolean(produto)
  const coresAtuais = useMemo(() => (produto ? [...new Set(produto.skus.map((s) => s.cor_id))] : []), [produto])
  const [f, setF] = useState(() => ({
    ref: produto?.ref || '',
    nome: produto?.nome || '',
    tipo: produto?.tipo || '',
    colecao: produto?.colecao || '',
    ncm: produto?.ncm || '',
    gradeDe: produto?.grade_de || 34,
    gradeAte: produto?.grade_ate || 39,
    status: produto?.status === 'rascunho' ? 'ativo' : produto?.status || 'ativo',
  }))
  const [sel, setSel] = useState(coresAtuais)
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

  const existentes = new Set((produto?.skus || []).map((s) => `${s.cor_id}|${s.numero}`))
  const novos = coresSel.reduce((t, c) => t + numeros.filter((n) => !existentes.has(`${c.id}|${n}`)).length, 0)
  const exemplo = f.ref && coresSel[0] && numeros[0] ? codigoSku(f.ref, coresSel[0].sigla, numeros[0]) : null

  function alternar(id) {
    if (coresAtuais.includes(id)) return // cor que já tem SKU não sai (pode estar em etiqueta)
    setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id])
  }

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
    if (!numeros.length) return setErro('Confira a grade (ex.: 34 até 39).')
    if (!editando && !coresSel.length) return setErro('Escolha pelo menos uma cor.')
    if (f.status === 'ativo' && !coresSel.length) return setErro('Para ficar Ativo, escolha pelo menos uma cor (ou salve como Rascunho).')
    setSalvando(true)
    try {
      const dados = { ...f, gradeDe: Number(f.gradeDe), gradeAte: Number(f.gradeAte), cores: coresSel }
      if (editando) await atualizarProduto(produto, dados)
      else await criarProduto(dados)
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
            <div className="eyebrow">{editando ? `REF ${produto.ref}` : 'Cadastro'}</div>
            <h2>{editando ? 'Editar modelo' : 'Novo modelo'}</h2>
          </div>
          <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>REF *</span>
            <input required value={f.ref} onChange={set('ref')} placeholder="801" disabled={editando} />
          </label>
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
          <label className="field">
            <span>Situação</span>
            <select className="input" value={f.status} onChange={set('status')}>
              <option value="ativo">Ativo</option>
              <option value="rascunho">Rascunho</option>
              <option value="inativo">Inativo</option>
            </select>
          </label>
        </div>

        <div className="field">
          <span>Cores {editando ? '(as que já têm SKU ficam travadas)' : '*'}</span>
          <div className="chips">
            {cores.map((c) => {
              const travada = coresAtuais.includes(c.id)
              return (
                <button type="button" key={c.id} className={`color-tag ${sel.includes(c.id) ? 'on' : ''}`}
                  onClick={() => alternar(c.id)} title={travada ? 'Já tem SKU criado' : c.sigla} style={travada ? { cursor: 'default' } : undefined}>
                  <span className="dot" style={{ background: c.hex || '#ddd' }} />{c.nome}
                </button>
              )
            })}
          </div>
          <div className="actions" style={{ marginTop: 10 }}>
            <input className="input" value={novaCor} onChange={(e) => setNovaCor(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarCor() } }}
              placeholder="Outra cor (ex.: Preto / Nude)" style={{ flex: 1 }} />
            <button type="button" className="btn" onClick={adicionarCor}>Adicionar cor</button>
          </div>
        </div>

        <div className="preview">
          <b>{novos} {novos === 1 ? 'SKU novo' : 'SKUs novos'}</b> {editando ? 'serão criados' : 'serão gerados'}
          {exemplo && <> · ex.: <span className="mono">{exemplo}</span></>}
        </div>

        {erro && <p className="form-error" role="alert">{erro}</p>}

        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="btn btn-dark" disabled={salvando}>{salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Salvar modelo'}</button>
        </div>
      </form>
    </div>
  )
}
