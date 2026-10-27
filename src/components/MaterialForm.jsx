import { useState } from 'react'
import { CATEGORIAS_MAT, TIPOS_MAT, UNIDADES, salvarMaterial } from '../lib/compras.js'

export default function MaterialForm({ material, fornecedores, onFechar, onSalvo }) {
  const [f, setF] = useState(() => ({
    nome: material?.nome || '', categoria: material?.categoria || '', unidade: material?.unidade || 'm',
    por_numero: material?.por_numero || false, custo: material?.custo ?? '', estoque_minimo: material?.estoque_minimo ?? '',
    fornecedor_id: material?.fornecedor_id || '', ativo: material?.ativo ?? true, tipo: material?.tipo || 'material',
  }))
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  function mudarCategoria(e) {
    const c = e.target.value
    const tipo = c === 'Mão de obra' ? 'mao_de_obra' : c === 'Custo fixo' ? 'custo_fixo' : f.tipo
    setF({ ...f, categoria: c, tipo })
  }

  async function salvar(e) {
    e.preventDefault(); setErro(''); setSalvando(true)
    try { await salvarMaterial(f, material?.id); onSalvo() } catch (e2) { setErro(e2.message); setSalvando(false) }
  }

  return (
    <div className="modal-bg" onClick={onFechar}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={salvar}>
        <div className="modal-head">
          <div><div className="eyebrow">Compras · materiais</div><h2>{material ? 'Editar material' : 'Novo material'}</h2></div>
          <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
        </div>
        <div className="form-grid">
          <label className="field span-2"><span>Nome *</span><input required value={f.nome} onChange={set('nome')} placeholder="Ex.: Sintético napa caramelo" /></label>
          <label className="field">
            <span>Categoria</span>
            <select className="input" value={f.categoria} onChange={mudarCategoria}>
              <option value="">—</option>
              {CATEGORIAS_MAT.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Unidade</span>
            <select className="input" value={f.unidade} onChange={set('unidade')}>
              {UNIDADES.map((u) => <option key={u.v} value={u.v}>{u.l}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Tipo</span>
            <select className="input" value={f.tipo} onChange={set('tipo')}>
              {Object.entries(TIPOS_MAT).map(([k, t]) => <option key={k} value={k}>{t.label} — {t.desc}</option>)}
            </select>
          </label>
          <label className="field"><span>Custo (R$ por unidade)</span><input type="number" step="0.0001" min="0" value={f.custo} onChange={set('custo')} /></label>
          <label className="field"><span>Estoque mínimo</span><input type="number" step="0.001" min="0" value={f.estoque_minimo} onChange={set('estoque_minimo')} /></label>
          <label className="field span-3">
            <span>Fornecedor principal</span>
            <select className="input" value={f.fornecedor_id} onChange={set('fornecedor_id')}>
              <option value="">{fornecedores.length ? '—' : 'Cadastre fornecedores em Clientes'}</option>
              {fornecedores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={f.por_numero} onChange={(e) => setF({ ...f, por_numero: e.target.checked })} />
          Controlado por numeração (ex.: solado e palmilha — um para cada número da grade)
        </label>
        {material && (
          <label className="check">
            <input type="checkbox" checked={!f.ativo} onChange={(e) => setF({ ...f, ativo: !e.target.checked })} />Inativo
          </label>
        )}
        {erro && <p className="form-error" role="alert">{erro}</p>}
        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="btn btn-dark" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  )
}
