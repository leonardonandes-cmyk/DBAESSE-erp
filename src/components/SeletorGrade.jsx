import { useMemo, useState } from 'react'
import { FotoProduto } from './FotoProduto.jsx'

/*
  Escolhe MODELO + COR e digita a quantidade por NÚMERO (grade).
  Usado em: entrada de produção, inventário e itens do pedido.
  produtos: [{ id, ref, nome, tipo, skus:[{id,cor_id,numero,sku}] }]
  saldos (opcional): { sku_id: saldo } — mostra o saldo embaixo de cada número
  rotulo: texto do botão; modo 'contagem' mostra "contado" em vez de "qtd"
*/
export default function SeletorGrade({ produtos, cores, saldos, onAdicionar, rotulo = 'Adicionar', modo = 'quantidade', extra }) {
  const [prodId, setProdId] = useState('')
  const [corId, setCorId] = useState('')
  const [qtd, setQtd] = useState({})

  const corPorId = useMemo(() => Object.fromEntries(cores.map((c) => [c.id, c])), [cores])
  const comSku = useMemo(() => produtos.filter((p) => p.skus.length > 0), [produtos])
  const grupos = useMemo(() => {
    const g = {}
    comSku.forEach((p) => { (g[p.tipo || 'Outros'] ||= []).push(p) })
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b))
  }, [comSku])

  const prod = comSku.find((p) => p.id === prodId)
  const coresProd = prod ? [...new Set(prod.skus.map((s) => s.cor_id))].map((id) => corPorId[id]).filter(Boolean) : []
  const skusCor = prod && corId ? prod.skus.filter((s) => s.cor_id === corId).sort((a, b) => a.numero - b.numero) : []

  function escolherProduto(id) {
    setProdId(id)
    const p = comSku.find((x) => x.id === id)
    const cs = p ? [...new Set(p.skus.map((s) => s.cor_id))] : []
    setCorId(cs.length === 1 ? cs[0] : '')
    setQtd({})
  }

  function adicionar() {
    const linhas = skusCor
      .map((s) => ({ sku_id: s.id, sku: s.sku, numero: s.numero, quantidade: qtd[s.id] === '' || qtd[s.id] == null ? null : Number(qtd[s.id]), produto: prod, cor: corPorId[corId] }))
      .filter((l) => l.quantidade !== null && !Number.isNaN(l.quantidade) && (modo === 'contagem' || l.quantidade > 0))
    if (!linhas.length) return
    onAdicionar(linhas)
    setQtd({})
  }

  const total = Object.values(qtd).reduce((t, v) => t + (Number(v) || 0), 0)

  return (
    <div className="seletor">
      <div className="form-grid">
        <label className="field span-2">
          <span>Modelo</span>
          <select className="input" value={prodId} onChange={(e) => escolherProduto(e.target.value)}>
            <option value="">Escolha o modelo…</option>
            {grupos.map(([tipo, ps]) => (
              <optgroup key={tipo} label={tipo}>
                {ps.map((p) => <option key={p.id} value={p.id}>{p.ref} · {p.nome}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        {extra}
      </div>

      {prod && (
        <div className="seletor-prod">
        <FotoProduto p={prod} />
        <div className="chips">
          {coresProd.map((c) => (
            <button type="button" key={c.id} className={`color-tag ${c.id === corId ? 'on' : ''}`} onClick={() => { setCorId(c.id); setQtd({}) }}>
              <span className="dot" style={{ background: c.hex || '#ddd' }} />{c.nome}
            </button>
          ))}
        </div>
        </div>
      )}

      {skusCor.length > 0 && (
        <>
          <div className="grade-input">
            {skusCor.map((s) => (
              <label key={s.id} className="grade-cel">
                <span className="grade-num">{s.numero}</span>
                <input type="number" inputMode="numeric" min={modo === 'contagem' ? 0 : 1} value={qtd[s.id] ?? ''}
                  onChange={(e) => setQtd({ ...qtd, [s.id]: e.target.value })} placeholder={modo === 'contagem' ? 'contado' : '0'} />
                {saldos && <span className="grade-saldo">saldo {saldos[s.id] ?? 0}</span>}
              </label>
            ))}
          </div>
          <div className="actions" style={{ justifyContent: 'space-between' }}>
            <span className="card-sub" style={{ margin: 0 }}>{modo === 'contagem' ? 'Digite o que foi contado; o sistema calcula a diferença.' : `${total} pares nesta cor`}</span>
            <button type="button" className="btn" onClick={adicionar}>{rotulo}</button>
          </div>
        </>
      )}
    </div>
  )
}
