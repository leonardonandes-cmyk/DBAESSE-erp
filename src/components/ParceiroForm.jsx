import { useState } from 'react'
import { CANAIS, TIPOS_PARCEIRO, salvarParceiro } from '../lib/parceiros.js'

export default function ParceiroForm({ parceiro, tipoInicial, onFechar, onSalvo }) {
  const editando = Boolean(parceiro)
  const [f, setF] = useState(() => ({
    nome: parceiro?.nome || '',
    tipos: parceiro?.tipos || [tipoInicial || 'cliente'],
    documento: parceiro?.documento || '',
    telefone: parceiro?.telefone || '',
    email: parceiro?.email || '',
    cep: parceiro?.cep || '',
    endereco: parceiro?.endereco || '',
    cidade: parceiro?.cidade || '',
    uf: parceiro?.uf || '',
    canal: parceiro?.canal || '',
    observacoes: parceiro?.observacoes || '',
    ativo: parceiro?.ativo ?? true,
  }))
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  function alternarTipo(t) {
    const tem = f.tipos.includes(t)
    if (tem && f.tipos.length === 1) return
    setF({ ...f, tipos: tem ? f.tipos.filter((x) => x !== t) : [...f.tipos, t] })
  }

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (f.uf && !/^[A-Za-z]{2}$/.test(f.uf.trim())) return setErro('UF com 2 letras (ex.: MG).')
    setSalvando(true)
    try {
      const salvo = await salvarParceiro(f, parceiro?.id)
      onSalvo(salvo)
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
            <h2>{editando ? f.nome || 'Editar cadastro' : 'Novo cadastro'}</h2>
          </div>
          <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
        </div>

        <div className="field">
          <span>Tipo (pode marcar mais de um)</span>
          <div className="chips">
            {TIPOS_PARCEIRO.map((t) => (
              <button type="button" key={t.valor} className={`chip ${f.tipos.includes(t.valor) ? 'on' : ''}`} onClick={() => alternarTipo(t.valor)}>{t.label}</button>
            ))}
          </div>
        </div>

        <div className="form-grid">
          <label className="field span-2"><span>Nome / razão social *</span><input required value={f.nome} onChange={set('nome')} placeholder="Loja Primavera" /></label>
          <label className="field"><span>CPF / CNPJ</span><input value={f.documento} onChange={set('documento')} inputMode="numeric" /></label>
          <label className="field"><span>Telefone / WhatsApp</span><input value={f.telefone} onChange={set('telefone')} placeholder="(37) 99999-0000" inputMode="tel" /></label>
          <label className="field span-2"><span>E-mail</span><input type="email" value={f.email} onChange={set('email')} /></label>
          <label className="field span-2"><span>Endereço</span><input value={f.endereco} onChange={set('endereco')} placeholder="Rua, número, bairro" /></label>
          <label className="field"><span>CEP</span><input value={f.cep} onChange={set('cep')} inputMode="numeric" /></label>
          <label className="field"><span>Cidade</span><input value={f.cidade} onChange={set('cidade')} /></label>
          <label className="field"><span>UF</span><input value={f.uf} onChange={set('uf')} maxLength={2} placeholder="MG" /></label>
          <label className="field">
            <span>Canal principal</span>
            <select className="input" value={f.canal} onChange={set('canal')}>
              <option value="">—</option>
              {CANAIS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="field span-3"><span>Observações</span><input value={f.observacoes} onChange={set('observacoes')} placeholder="Prazo combinado, preferências, transportadora…" /></label>
        </div>

        {editando && (
          <label className="check">
            <input type="checkbox" checked={!f.ativo} onChange={(e) => setF({ ...f, ativo: !e.target.checked })} />
            Inativo (não aparece na hora de fazer pedido)
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
