import { useMemo, useState } from 'react'
import { brl, dataBR, hojeISO } from '../lib/format.js'
import { CATEGORIAS, FORMAS, criarTitulos, montarParcelas } from '../lib/financeiro.js'

/* Lança conta a pagar/receber, já com parcelas. Também usado pelo pedido faturado (padrao). */
export default function TituloForm({ tipoInicial = 'pagar', parceiros, padrao, onFechar, onSalvo }) {
  const [f, setF] = useState(() => ({
    tipo: padrao?.tipo || tipoInicial,
    descricao: padrao?.descricao || '',
    parceiro_id: padrao?.parceiro_id || '',
    categoria: padrao?.categoria || '',
    valorTotal: padrao?.valorTotal ?? '',
    parcelas: padrao?.parcelas || 1,
    primeiroVencimento: padrao?.primeiroVencimento || hojeISO(),
    intervalo: 'mensal',
    forma: padrao?.forma || '',
    observacao: '',
  }))
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const lista = useMemo(() => parceiros.filter((p) => p.ativo &&
    (f.tipo === 'pagar' ? p.tipos.some((t) => t === 'fornecedor' || t === 'transportadora') : p.tipos.some((t) => t === 'cliente' || t === 'revendedora'))),
  [parceiros, f.tipo])

  const parcelas = useMemo(() => (Number(f.valorTotal) > 0 && f.primeiroVencimento
    ? montarParcelas(f) : []), [f])

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (!(Number(f.valorTotal) > 0)) return setErro('Informe o valor.')
    setSalvando(true)
    try {
      await criarTitulos({ ...f, pedido_id: padrao?.pedido_id, parcelas })
      onSalvo()
    } catch (e) { setErro(e.message); setSalvando(false) }
  }

  const pagar = f.tipo === 'pagar'

  return (
    <div className="modal-bg" onClick={onFechar}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={salvar}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">Financeiro</div>
            <h2>{pagar ? 'Nova conta a pagar' : 'Nova conta a receber'}</h2>
          </div>
          <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
        </div>

        {!padrao && (
          <div className="segmented" style={{ alignSelf: 'flex-start' }}>
            <button type="button" className={pagar ? 'on' : ''} onClick={() => setF({ ...f, tipo: 'pagar', categoria: '', parceiro_id: '' })}>A pagar</button>
            <button type="button" className={!pagar ? 'on' : ''} onClick={() => setF({ ...f, tipo: 'receber', categoria: '', parceiro_id: '' })}>A receber</button>
          </div>
        )}

        <div className="form-grid">
          <label className="field span-2"><span>Descrição *</span><input required value={f.descricao} onChange={set('descricao')} placeholder={pagar ? 'Ex.: Solados lote outubro' : 'Ex.: Pedido PV-0012'} /></label>
          <label className="field">
            <span>Categoria</span>
            <select className="input" value={f.categoria} onChange={set('categoria')}>
              <option value="">—</option>
              {CATEGORIAS[f.tipo].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="field span-2">
            <span>{pagar ? 'Fornecedor' : 'Cliente'}</span>
            <select className="input" value={f.parceiro_id} onChange={set('parceiro_id')}>
              <option value="">{lista.length ? '—' : pagar ? 'Cadastre fornecedores em Clientes' : 'Cadastre clientes em Clientes'}</option>
              {lista.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Forma</span>
            <select className="input" value={f.forma} onChange={set('forma')}>
              <option value="">—</option>
              {FORMAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="field"><span>Valor total (R$) *</span><input type="number" step="0.01" min="0.01" required value={f.valorTotal} onChange={set('valorTotal')} /></label>
          <label className="field"><span>Parcelas</span><input type="number" min="1" max="48" value={f.parcelas} onChange={set('parcelas')} /></label>
          <label className="field">
            <span>Intervalo</span>
            <select className="input" value={f.intervalo} onChange={set('intervalo')} disabled={Number(f.parcelas) <= 1}>
              <option value="mensal">Mensal</option>
              <option value="quinzenal">Quinzenal</option>
              <option value="semanal">Semanal</option>
            </select>
          </label>
          <label className="field"><span>{Number(f.parcelas) > 1 ? '1º vencimento' : 'Vencimento'}</span><input type="date" required value={f.primeiroVencimento} onChange={set('primeiroVencimento')} /></label>
          <label className="field span-2"><span>Observação</span><input value={f.observacao} onChange={set('observacao')} /></label>
        </div>

        {parcelas.length > 1 && (
          <div className="preview">
            {parcelas.map((p) => <span key={p.parcela} style={{ marginRight: 14, whiteSpace: 'nowrap' }}><b>{p.parcela}</b> {dataBR(p.vencimento)} · {brl(p.valor)}</span>)}
          </div>
        )}

        {erro && <p className="form-error" role="alert">{erro}</p>}

        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="btn btn-dark" disabled={salvando}>{salvando ? 'Salvando…' : 'Lançar'}</button>
        </div>
      </form>
    </div>
  )
}
