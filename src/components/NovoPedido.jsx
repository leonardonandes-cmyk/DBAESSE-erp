import Icon from './Icon.jsx'
import { listarVendedoras, vendedoraPadrao, vendedorasDe } from '../lib/repasses.js'
import { useEffect, useMemo, useState } from 'react'
import ProdutoCelula, { FotoProduto } from './FotoProduto.jsx'
import SeletorGrade from './SeletorGrade.jsx'
import ParceiroForm from './ParceiroForm.jsx'
import { brl } from '../lib/format.js'
import { CANAIS, enderecoCompleto } from '../lib/parceiros.js'
import { atualizarPedido, carregarItens, criarPedido } from '../lib/pedidos.js'
import { numeroPedido, rotuloNum } from '../lib/format.js'
import { listaSugerida, listarListas, precoNaLista } from '../lib/precos.js'

// Serve para CRIAR (sem `pedido`) e para CORRIGIR um pedido aberto (com `pedido`)
export default function NovoPedido({ produtos, cores, parceiros, saldos, pedido, onFechar, onSalvo }) {
  const editando = Boolean(pedido)
  const [novos, setNovos] = useState([]) // clientes cadastrados agora, dentro da venda
  const [cadastrar, setCadastrar] = useState(false)
  const clientes = useMemo(
    () => [...novos, ...parceiros].filter((p, i, a) => p.ativo && (p.tipos.includes('cliente') || p.tipos.includes('revendedora')) && a.findIndex((x) => x.id === p.id) === i),
    [parceiros, novos]
  )
  const [f, setF] = useState(() => (pedido
    ? { vendedora: pedido.vendedora ?? '', parceiro_id: pedido.parceiro_id || '', canal: pedido.canal || 'Atacado', lista: pedido.lista || 'atacado', previsao: pedido.previsao || '', observacoes: pedido.observacoes || '', endereco_entrega: pedido.endereco_entrega || '', desconto: pedido.desconto || '', status: pedido.status }
    : { parceiro_id: '', canal: 'Atacado', lista: 'atacado', previsao: '', observacoes: '', endereco_entrega: '', desconto: '', status: 'orcamento' }))
  const [outroEndereco, setOutroEndereco] = useState(Boolean(pedido?.endereco_entrega))
  const [listas, setListas] = useState([])
  useEffect(() => { listarListas().then(setListas).catch(() => {}) }, [])
  // vendedora: sugerida pela modalidade do canal (Sabrina, Pamela…); dá para trocar ou deixar sem
  const [regras, setRegras] = useState([])
  const [vendManual, setVendManual] = useState(Boolean(pedido))
  useEffect(() => {
    listarVendedoras().then((rg) => {
      setRegras(rg)
      if (!pedido) setF((x) => (x.vendedora === undefined ? { ...x, vendedora: vendedoraPadrao(rg, x.canal) } : x))
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const listaAtual = listas.find((l) => l.codigo === f.lista)
  const [itens, setItens] = useState([]) // { sku_id, sku, numero, quantidade, preco_unit, produto, cor }
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  // corrigindo: carrega os itens do pedido
  useEffect(() => {
    if (!pedido) return
    const prodPorId = Object.fromEntries(produtos.map((p) => [p.id, p]))
    const corPorId = Object.fromEntries(cores.map((c) => [c.id, c]))
    carregarItens(pedido.id).then((lista) => setItens(lista.map((i) => ({
      sku_id: i.sku_id, sku: i.skus.sku, numero: i.skus.numero, quantidade: i.quantidade, preco_unit: i.preco_unit,
      produto: prodPorId[i.skus.produto_id], cor: corPorId[i.skus.cor_id],
    })))).catch((e) => setErro(e.message))
  }, [pedido?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // a lista de preço é travada no segmento: só muda trocando o canal
  const set = (k) => (e) => { if (k !== 'lista') aplicar(k, e.target.value) }
  const aplicar = (k, v) => {
    let novo = { ...f, [k]: v }
    if (k === 'parceiro_id') {
      const c = clientes.find((x) => x.id === v)
      novo = { ...novo, canal: c?.canal || f.canal, endereco_entrega: '' }
      setOutroEndereco(false)
      novo.lista = listaSugerida(c, novo.canal)
    }
    if (k === 'canal') novo.lista = listaSugerida(clientes.find((x) => x.id === f.parceiro_id), v)
    if (k === 'vendedora') setVendManual(true)
    else if (novo.canal !== f.canal && !vendManual && regras.length) novo.vendedora = vendedoraPadrao(regras, novo.canal)
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

  function mudarQtd(skuId, valor) {
    const q = Number(String(valor).replace(/\D/g, '')) || 0
    setItens(itens.map((i) => (i.sku_id === skuId ? { ...i, quantidade: q } : i)))
  }
  function removerGrupo(chave) {
    setItens(itens.filter((i) => `${i.produto.id}|${i.cor?.id}` !== chave))
  }

  // desconto só no pedido inteiro: em R$ ou em % (grava sempre o valor em R$)
  const [descModo, setDescModo] = useState('rs')
  const [descPct, setDescPct] = useState('')
  const pares = itens.reduce((t, i) => t + i.quantidade, 0)
  const bruto = itens.reduce((t, i) => t + i.quantidade * (Number(i.preco_unit) || 0), 0)
  const numero = (v) => Number(String(v ?? '').replace(',', '.')) || 0
  const descontoRS = Math.min(bruto, Math.max(0, descModo === 'pct' ? Math.round(bruto * numero(descPct)) / 100 : numero(f.desconto)))
  const total = Math.max(0, bruto - descontoRS)

  async function salvar() {
    setErro('')
    const validos = itens.filter((i) => i.quantidade > 0)
    if (!validos.length) return setErro('Adicione pelo menos um modelo ao pedido.')
    setSalvando(true)
    try {
      const dados = { ...f, desconto: descontoRS, itens: validos }
      const ped = editando ? await atualizarPedido(pedido.id, dados) : await criarPedido(dados)
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
            <div className="eyebrow">Pedidos{editando ? ` · ${numeroPedido(pedido.numero)}` : ''}</div>
            <h2>{editando ? 'Corrigir pedido' : 'Novo pedido'}</h2>
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
            <div className="input lista-travada" title="A lista segue o segmento do pedido. Para mudar, troque o canal.">
              <Icon name="cadeado" size={15} />{listas.find((l) => l.codigo === f.lista)?.nome || f.lista}<small>pelo segmento</small>
            </div>
          </label>
          <label className="field">
            <span>Vendedora</span>
            <select className="input" value={f.vendedora ?? ''} onChange={set('vendedora')}>
              <option value="">Sem vendedora</option>
              {[...new Set([...vendedorasDe(regras), ...(f.vendedora ? [f.vendedora] : [])])].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label className="field"><span>Previsão de entrega</span><input type="date" value={f.previsao} onChange={set('previsao')} /></label>
          {(!editando || pedido.status === 'orcamento') && <label className="field">
            <span>Situação inicial</span>
            <select className="input" value={f.status} onChange={set('status')}>
              <option value="orcamento">Orçamento</option>
              <option value="aprovado">Aprovado</option>
            </select>
          </label>}
          <div className="field">
            <span>Desconto no pedido</span>
            <div className="desc-campo">
              <div className="segmented" role="group" aria-label="Desconto em">
                <button type="button" className={descModo === 'rs' ? 'on' : ''} onClick={() => { if (descModo === 'pct') setF((x) => ({ ...x, desconto: descontoRS ? String(descontoRS) : '' })); setDescModo('rs') }}>R$</button>
                <button type="button" className={descModo === 'pct' ? 'on' : ''} onClick={() => { if (descModo === 'rs') setDescPct(bruto && descontoRS ? String(Math.round((descontoRS / bruto) * 10000) / 100) : ''); setDescModo('pct') }}>%</button>
              </div>
              {descModo === 'rs'
                ? <input className="input" inputMode="decimal" value={f.desconto} onChange={set('desconto')} placeholder="0,00" aria-label="Desconto em reais" />
                : <input className="input" inputMode="decimal" value={descPct} onChange={(e) => setDescPct(e.target.value)} placeholder="0" aria-label="Desconto em porcentagem" />}
            </div>
            {descontoRS > 0 && <small className="desc-conv">{descModo === 'pct' ? `= ${brl(descontoRS)}` : bruto ? `= ${(descontoRS / bruto * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do pedido` : ''}</small>}
          </div>
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
                        <div className="grade-mini grade-edit">{g.itens.map((i) => <label key={i.sku_id}><small>{rotuloNum(i.numero)}</small><input inputMode="numeric" enterKeyHint="next" data-grade value={i.quantidade || ''} onChange={(e) => mudarQtd(i.sku_id, e.target.value)} aria-label={`Número ${i.numero}`} /></label>)}</div>
                        {falta > 0 && <span className="pill warn" style={{ marginTop: 6 }}>Faltam {falta} em estoque · produzir</span>}
                      </td>
                      <td className="r"><b>{qt}</b></td>
                      <td className="r"><span className="preco-travado" title="Preço da lista do segmento">{brl(Number(preco) || 0)}</span></td>
                      <td className="r">{brl(qt * (Number(preco) || 0))}</td>
                      <td className="r"><button type="button" className="link-btn" onClick={() => removerGrupo(g.chave)}>remover</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {f.parceiro_id && (() => {
          const cliente = clientes.find((x) => x.id === f.parceiro_id)
          const doCadastro = enderecoCompleto(cliente)
          return (
            <div className="entrega">
              <div className="entrega-head">
                <span className="eyebrow">Entrega</span>
                <label className="check">
                  <input type="checkbox" checked={outroEndereco} onChange={(e) => {
                    setOutroEndereco(e.target.checked)
                    setF((x) => ({ ...x, endereco_entrega: e.target.checked ? doCadastro : '' }))
                  }} />
                  Entregar em outro endereço
                </label>
              </div>
              {outroEndereco
                ? <textarea className="input" rows={2} value={f.endereco_entrega} onChange={set('endereco_entrega')} aria-label="Endereço de entrega desta venda" placeholder="Rua, número, complemento, bairro, cidade/UF, CEP" autoFocus />
                : <p>{doCadastro || 'Cliente sem endereço no cadastro'} <small>· do cadastro</small></p>}
            </div>
          )
        })()}

        <label className="field"><span>Observações</span><input value={f.observacoes} onChange={set('observacoes')} placeholder="Forma de pagamento, transportadora, embalagem…" /></label>

        {erro && <p className="form-error" role="alert">{erro}</p>}

        <div className="pedido-rodape">
          <div className="pedido-totais">
            <span>{pares} pares</span>
            {descontoRS > 0 && <span>Desconto −{brl(descontoRS)}</span>}
            <b>{brl(total)}</b>
          </div>
          <div className="actions">
            <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
            <button type="button" className="btn btn-dark" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : editando ? 'Salvar correção' : 'Salvar pedido'}</button>
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
            setF((x) => ({ ...x, parceiro_id: novo.id, canal, lista, endereco_entrega: '' }))
            setOutroEndereco(false)
            const l = listas.find((x) => x.codigo === lista)
            setItens((atual) => atual.map((i) => ({ ...i, preco_unit: precoNaLista(i.produto, l) })))
          }} />
      )}
    </div>
  )
}
