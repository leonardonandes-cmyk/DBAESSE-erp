import { useState } from 'react'
import SeletorGrade from './SeletorGrade.jsx'
import { criarOP } from '../lib/producao.js'
import { numeroPedido } from '../lib/format.js'

export default function OPForm({ produtos, cores, saldos, pedidosAbertos, onFechar, onSalvo }) {
  const [linhas, setLinhas] = useState([])
  const [f, setF] = useState({ prazo: '', prioridade: 'normal', pedido_id: '', observacao: '' })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const prod = linhas[0]?.produto
  const cor = linhas[0]?.cor
  const total = linhas.reduce((t, l) => t + l.quantidade, 0)

  async function salvar() {
    setErro('')
    if (!linhas.length) return setErro('Escolha o modelo, a cor e as quantidades e clique em "Usar esta grade".')
    setSalvando(true)
    try {
      await criarOP({ produto_id: prod.id, cor_id: cor.id, ...f, itens: linhas })
      onSalvo()
    } catch (e) { setErro(e.message); setSalvando(false) }
  }

  return (
    <div className="modal-bg" onClick={onFechar}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div><div className="eyebrow">Produção</div><h2>Nova ordem de produção</h2></div>
          <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
        </div>

        <SeletorGrade produtos={produtos.filter((p) => p.status === 'ativo')} cores={cores} saldos={saldos}
          onAdicionar={(ls) => setLinhas(ls)} rotulo="Usar esta grade" />

        {linhas.length > 0 && (
          <div className="preview" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <b>{prod.ref} · {prod.nome} · {cor?.nome}</b>
            <div className="grade-mini">{linhas.map((l) => <span key={l.sku_id}><small>{l.numero}</small>{l.quantidade}</span>)}</div>
            <span>{total} pares</span>
          </div>
        )}

        <div className="form-grid">
          <label className="field"><span>Prazo</span><input type="date" value={f.prazo} onChange={set('prazo')} /></label>
          <label className="field">
            <span>Prioridade</span>
            <select className="input" value={f.prioridade} onChange={set('prioridade')}>
              <option value="normal">Normal</option>
              <option value="urgente">Urgente</option>
            </select>
          </label>
          <label className="field">
            <span>Pedido (opcional)</span>
            <select className="input" value={f.pedido_id} onChange={set('pedido_id')}>
              <option value="">Estoque / reposição</option>
              {pedidosAbertos.map((p) => <option key={p.id} value={p.id}>{numeroPedido(p.numero)} · {p.parceiros?.nome || 'sem cliente'}</option>)}
            </select>
          </label>
          <label className="field span-3"><span>Observação</span><input value={f.observacao} onChange={set('observacao')} placeholder="Ex.: lote UFZ, cabedal já cortado" /></label>
        </div>

        {erro && <p className="form-error" role="alert">{erro}</p>}

        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button type="button" className="btn btn-dark" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Criar ordem'}</button>
        </div>
      </div>
    </div>
  )
}
