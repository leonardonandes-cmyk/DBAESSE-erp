import { useEffect, useMemo, useState } from 'react'
import ProdutoCelula, { FotoProduto } from './FotoProduto.jsx'
import SeletorGrade from './SeletorGrade.jsx'
import ParceiroForm from './ParceiroForm.jsx'
import { brl } from '../lib/format.js'
import { CANAIS } from '../lib/parceiros.js'
import { criarPedido } from '../lib/pedidos.js'
import { listaSugerida, listarListas, precoNaLista } from '../lib/precos.js'

export default function NovoPedido({ produtos, cores, parceiros, saldos, onFechar, onSalvo }) {
  const [novos, setNovos] = useState([]) // clientes cadastrados agora, dentro da venda
  const [cadastrar, setCadastrar] = useState(false)
  const clientes = useMemo(
    () => [...novos, ...parceiros].filter((p, i, a) => p.ativo && (p.tipos.includes('cliente') || p.tipos.includes('revendedora')) && a.findIndex((x) => x.id === p.id) === i),
    [parceiros, novos]
  )
  const [f, setF] = useState({ parceiro_id: '', canal: 'Atacado', lista: 'atacado', previsao: '', observacoes: '', desconto: '', status: 'orcamento' })
  const [listas, setListas] = useState([])
  useEffect(() => { listarListas().then(setListas).catch(() => {}) }, [])
  const listaAtual = listas.find((l) => l.codigo === f.lista)
  const [itens, setItens] = useState([]) // { sku_id, sku, numero, quantidade, preco_unit, produto, cor }
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const set = (k) => (e) => {
    const v = e.target.value
    let novo = { ...f, [k]: v }
    if (k === 'parceiro_id') {
      const c = clientes.find((x) => x.id === v)
      novo = { ...novo, canal: c?.canal || f.canal }
      novo.lista = listaSugerida(c, novo.canal)
    }
    if (k === 'canal') novo.lista = listaSugerida(clientes.find((x) => x.id === f.parceiro_id), v)
    setF(novo)
    // trocou a lista: reprecifica os itens já lançados
    if (novo.lista !== f.lista) {
      const l = listas.find((x) => x.codigo === novo.lista)
      setItens((atual) => atual.map((i) => ({ ...i, preco_unit: precoNaLista(i.produto, l) })))
    }
  }

  const precoPadrao = (p) => precoNaLista(p, listaAtual)

  function adicionar(linhas) {
    const mapa = Object.fromEntries(itens.map((i) => [i.sku_id, i]))
    linhas.forEach((l) => {
      const atual = mapa[l.sku_id]
      mapa[l.sku_id] = { ...l, quantidade: (atual?.quantidade || 0) + l.quantidade, preco_unit: atual?.preco_unit ?? precoPadrao(l.produto) }
    })
    setItens(Object.values(mapa))
  }

  // agrupa por modelo + cor para mostrar em grade
  const grupos = useMemo(() => {
    const g = {}
    itens.forEach((i) => {
      const k = `${i.produto.id}|${i.cor?.id}`
      ;(g[k] ||= { chave: k, produto: i.produto, cor: i.cor, itens: [] }).itens.push(i)
    })
    return Object.values(g).map((x) => ({ ...x, itens: x.itens.sort((a, b) => a.numero - b.numero) }))
  }, [itens])

  function precoGrupo(chave, valor) {
    setItens(itens.map((i) => (`${i.produto.id}|${i.cor?.id}` === chave ? { ...i, preco_unit: valor } : i)))
  }
  function removerGrupo(chave) {
    setItens(itens.filter((i) => `${i.produto.id}|${i.cor?.id}` !== chave))
  }

  const pares = itens.reduce((t, i) => t + i.quantidade, 0)
  const bruto = itens.reduce((t, i) => t + i.quantidade * (Number(i.preco_unit) || 0), 0)
  const total = Math.max(0, bruto - (Number(f.desconto) || 0))

  async function salvar() {
    setErro('')
    if (!itens.length) return setErro('Adicione pelo menos um modelo ao pedido.')
    setSalvando(true)
    try {
      const ped = await criarPedido({ ...f, itens })
      onSalvo(ped)
    } catch (e) {
      setErro(e.message)
      setSalvando(false)
    }
  }

  return (
    <div className="modal-bg" onClick={onFechar}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">Pedidos</div>
            <h2>Novo pedido</h2>
          </div>
          <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
        </div>

        <div className="form-grid">
          <label className="field span-2">
            <span style={{ display: 'flex', justifyContent: 'space-between' }}>Cliente <button type="button" className="link-btn" onClick={() => setCadastrar(true)}>+ Novo cliente</button></span>
            <select className="input" value={f.parceiro_id} onChange={set('parceiro_id')}>
              <option value="">{clientes.length ? 'Escolha o cliente…' : 'Sem cliente (cadastre em Clientes)'}</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.cidade ? ` · ${c.cidade}` : ''}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Canal</span>
            <select className="input" value={f.canal} onChange={set('canal')}>
              {CANAIS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Lista de preço</span>
            <select className="input" value={f.lista} onChange={set('lista')}>
              {listas.map((l) => <option key={l.codigo} value={l.codigo}>{l.nome}{Number(l.acrescimo) ? ` (+${Number(l.acrescimo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})` : ''}</option>)}
            </select>
          </label>
          <label className="field"><span>Previsão de entrega</span><input type="date" value={f.previsao} onChange={set('previsao')} /></label>
          <label className="field">
            <span>Situação inicial</span>
            <select className="input" value={f.status} onChange={set('status')}>
              <option value="orcamento">Orçamento</option>
              <option value="aprovado">Aprovado</option>
            </select>
          </label>
          <label className="field"><span>Desconto (R$)</span><input type="number" step="0.01" min="0" value={f.desconto} onChange={set('desconto')} /></label>
        </div>

        <div className="divisor"><span>Itens</span></div>
        <SeletorGrade produtos={produtos.filter((p) => p.status !== 'inativo')} cores={cores} saldos={saldos} onAdicionar={adicionar} rotulo="Adicionar ao pedido" />

        {grupos.length > 0 && (
          <div className="table-wrap">
            <table style={{ minWidth: 560 }}>
              <thead><tr><th>Modelo · cor</th><th>Grade</th><th className="r">Pares</th><th className="r">Preço par</th><th className="r">Subtotal</th><th /></tr></thead>
              <tbody>
                {grupos.map((g) => {
                  const qt = g.itens.reduce((t, i) => t + i.quantidade, 0)
                  const preco = g.itens[0].preco_unit
                  const falta = g.itens.reduce((t, i) => t + Math.max(0, i.quantidade - Math.max(0, saldos?.[i.sku_id] ?? 0)), 0)
                  return (
                    <tr key={g.chave}>
                      <td><ProdutoCelula p={g.produto} cor={g.cor} linha2={<><i className="dot-cor" style={{ background: g.cor?.hex || '#ddd' }} />{g.cor?.nome}</>} /></td>
                      <td>
                        <div className="grade-mini">{g.itens.map((i) => <span key={i.sku_id}><small>{i.numero}</small>{i.quantidade}</span>)}</div>
                        {falta > 0 && <span className="pill warn" style={{ marginTop: 6 }}>Faltam {falta} em estoque · produzir</span>}
                      </td>
                      <td className="r"><b>{qt}</b></td>
                      <td className="r"><input className="input input-sm" type="number" step="0.01" min="0" value={preco} onChange={(e) => precoGrupo(g.chave, e.target.value)} aria-label="Preço por par" /></td>
                      <td className="r">{brl(qt * (Number(preco) || 0))}</td>
                      <td className="r"><button type="button" className="link-btn" onClick={() => removerGrupo(g.chave)}>remover</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <label className="field"><span>Observações</span><input value={f.observacoes} onChange={set('observacoes')} placeholder="Forma de pagamento, transportadora, embalagem…" /></label>

        {erro && <p className="form-error" role="alert">{erro}</p>}

        <div className="pedido-rodape">
          <div className="pedido-totais">
            <span>{pares} pares</span>
            {Number(f.desconto) > 0 && <span>Desconto −{brl(f.desconto)}</span>}
            <b>{brl(total)}</b>
          </div>
          <div className="actions">
            <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
            <button type="button" className="btn btn-dark" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar pedido'}</button>
          </div>
        </div>
      </div>
      {cadastrar && (
        <ParceiroForm tipoInicial="cliente" onFechar={() => setCadastrar(false)}
          onSalvo={(novo) => {
            setCadastrar(false)
            if (!novo?.id) return
            setNovos((n) => [novo, ...n])
            const canal = novo.canal || f.canal
            const lista = listaSugerida(novo, canal)
            setF((x) => ({ ...x, parceiro_id: novo.id, canal, lista }))
            const l = listas.find((x) => x.codigo === lista)
            setItens((atual) => atual.map((i) => ({ ...i, preco_unit: precoNaLista(i.produto, l) })))
          }} />
      )}
    </div>
  )
}
