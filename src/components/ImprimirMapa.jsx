import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { FotoProduto } from './FotoProduto.jsx'
import { dataBR, inteiro } from '../lib/format.js'
import { corDaPalmilha, numeroMapa, regraPalmilha } from '../lib/mapas.js'
import { numeroOP, paresOP } from '../lib/producao.js'

/*
  Impressão do mapa de programação (A4):
  1) Mapa geral  2) Fichas de controle por cor (4 por folha, para recortar e circular)  3) Relação de palmilha (tiras por cor de palmilha + OBS)
*/
const POR_FOLHA_FICHAS = 4
const POR_FOLHA_PALM = 6
const fatiar = (lista, n) => Array.from({ length: Math.ceil(lista.length / n) || 0 }, (_, i) => lista.slice(i * n, i * n + n))
const textoEscuro = (hex) => { const h = (hex || '#ffffff').replace('#', ''); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return (r * 299 + g * 587 + b * 114) / 1000 > 140 }

export default function ImprimirMapa({ mapa, ops, cores, onFechar, inicial = 'mapa' }) {
  const [aba, setAba] = useState(inicial)
  const [regra, setRegra] = useState([{ chave: 'SALTO BLOCO', posicao: 2 }, { chave: '*', posicao: 1 }])
  useEffect(() => { regraPalmilha().then(setRegra).catch(() => {}) }, [])
  useEffect(() => { document.body.classList.add('imprimindo'); return () => document.body.classList.remove('imprimindo') }, [])

  const corPorNome = useMemo(() => Object.fromEntries(cores.map((c) => [c.nome.trim().toUpperCase(), c])), [cores])
  const lista = useMemo(() => ops.filter((o) => o.status !== 'cancelada').sort((a, b) => a.numero - b.numero), [ops])

  // referências (blocos) na ordem em que entraram no mapa
  const blocos = useMemo(() => {
    const m = new Map()
    lista.forEach((o) => {
      if (!m.has(o.produto_id)) m.set(o.produto_id, { produto: o.produtos, obs: o.observacao || '', ops: [] })
      m.get(o.produto_id).ops.push(o)
    })
    return [...m.values()].map((b) => {
      const nums = [...new Set(b.ops.flatMap((o) => o.op_itens.map((i) => i.skus.numero)))].sort((x, y) => x - y)
      return { ...b, nums, total: b.ops.reduce((t, o) => t + paresOP(o), 0) }
    })
  }, [lista])
  const numsGerais = useMemo(() => [...new Set(blocos.flatMap((b) => b.nums))].sort((a, b) => a - b), [blocos])
  const total = blocos.reduce((t, b) => t + b.total, 0)
  const qtd = (o, n) => o.op_itens.filter((i) => i.skus.numero === n).reduce((t, i) => t + i.quantidade, 0)
  const modelos = [...new Set(blocos.map((b) => (b.produto?.tipo || '').toUpperCase()).filter(Boolean))].join(' / ')

  // palmilha: agrupa por cor da palmilha + OBS
  const palmilhas = useMemo(() => {
    const g = new Map()
    blocos.forEach((b) => b.ops.forEach((o) => {
      const cor = corDaPalmilha(o.cores?.nome, `${b.produto?.tipo || ''} ${b.produto?.nome || ''}`, regra).toUpperCase()
      const k = `${cor}|${b.obs}`
      if (!g.has(k)) g.set(k, { cor, obs: b.obs, modelo: (b.produto?.tipo || '').toUpperCase(), grade: {}, total: 0, refs: new Set() })
      const x = g.get(k); x.refs.add(b.produto?.ref)
      o.op_itens.forEach((i) => { x.grade[i.skus.numero] = (x.grade[i.skus.numero] || 0) + i.quantidade; x.total += i.quantidade })
    }))
    return [...g.values()]
  }, [blocos, regra])

  const Cab = ({ titulo }) => (
    <header className="pr-cab">
      <div className="pr-marca">D B A E S S E<small>{titulo}</small></div>
      <div className="pr-cab-dados">
        <span><small>Mapa</small><b>{numeroMapa(mapa.numero)}</b></span>
        <span><small>Pedido</small><b>{mapa.pedido || '—'}</b></span>
        <span><small>Cliente</small><b>{mapa.cliente || '—'}</b></span>
        <span><small>Marca</small><b>{mapa.marca || '—'}</b></span>
        <span><small>Data</small><b>{dataBR(mapa.data)}</b></span>
        <span><small>Prev. entrega</small><b>{dataBR(mapa.previsao)}</b></span>
        <span className="pr-dest"><small>Qtd pares</small><b>{inteiro(total)}</b></span>
      </div>
    </header>
  )

  const Mapa = () => (
    <div className="folha">
      <Cab titulo="Programação de produção" />
      {blocos.map((b) => (
        <section key={b.produto?.ref} className="pr-bloco">
          <div className="pr-bloco-topo">
            <FotoProduto p={b.produto} size={64} />
            <div className="pr-ref"><small>Referência</small><b>{b.produto?.ref}</b><span>{(b.produto?.tipo || b.produto?.nome || '').toUpperCase()}</span></div>
            {b.obs && <div className="pr-obs">{b.obs}</div>}
            <div className="pr-ref-tot"><small>Pares</small><b>{inteiro(b.total)}</b></div>
          </div>
          <table className="pr-tab">
            <thead><tr><th>Cor</th>{b.nums.map((n) => <th key={n}>{n}</th>)}<th>Total</th><th>OP</th></tr></thead>
            <tbody>
              {b.ops.map((o) => (
                <tr key={o.id}><td className="pr-cor">{o.cores?.nome}</td>{b.nums.map((n) => <td key={n}>{qtd(o, n) || ''}</td>)}<td><b>{paresOP(o)}</b></td><td className="pr-op">{numeroOP(o.numero)}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><td>Total</td>{b.nums.map((n) => <td key={n}>{b.ops.reduce((t, o) => t + qtd(o, n), 0) || ''}</td>)}<td>{b.total}</td><td /></tr></tfoot>
          </table>
        </section>
      ))}
      <table className="pr-tab pr-resumo">
        <thead><tr><th>Resumo do mapa</th>{numsGerais.map((n) => <th key={n}>{n}</th>)}<th>Total</th></tr></thead>
        <tbody><tr><td>Todas as referências</td>{numsGerais.map((n) => <td key={n}>{blocos.reduce((t, b) => t + b.ops.reduce((s, o) => s + qtd(o, n), 0), 0) || ''}</td>)}<td><b>{total}</b></td></tr></tbody>
      </table>
      {mapa.observacao && <p className="pr-nota">Obs.: {mapa.observacao}</p>}
    </div>
  )

  const fichasOps = blocos.flatMap((b) => b.ops.map((o) => ({ o, b })))
  const Fichas = () => fatiar(fichasOps, POR_FOLHA_FICHAS).map((pagina, pi) => (
    <div key={pi} className="folha folha-fichas">
      {pagina.map(({ o, b }) => (
        <article key={o.id} className="pr-ficha">
          <div className="pr-ficha-topo">
            <b>CONTROLE DE PRODUÇÃO</b>
            <span className="pr-ficha-modelo">{(b.produto?.tipo || '').toUpperCase()}</span>
            <span className="pr-ficha-op">{numeroOP(o.numero)}</span>
          </div>
          <div className="pr-ficha-corpo">
            <FotoProduto p={b.produto} corId={o.cor_id} size={66} />
            <div className="pr-ficha-info">
              <span><small>Data</small><b>{dataBR(mapa.data)}</b></span>
              <span><small>Ref.</small><b className="grande">{b.produto?.ref}</b></span>
              <span><small>Marca</small><b>{mapa.marca || '—'}</b></span>
              <span><small>Mapa</small><b>{numeroMapa(mapa.numero)}</b></span>
              <span><small>Pedido(s)</small><b>{mapa.pedido || '—'}</b></span>
              <span><small>Prev. ent.</small><b>{dataBR(mapa.previsao)}</b></span>
              <span className="largo"><small>Cliente</small><b>{mapa.cliente || '—'}</b></span>
            </div>
          </div>
          <div className="pr-ficha-grade">
            <span className="pr-ficha-cor">{o.cores?.nome}</span>
            <table className="pr-tab"><thead><tr>{b.nums.map((n) => <th key={n}>{n}</th>)}<th>Total</th></tr></thead>
              <tbody><tr>{b.nums.map((n) => <td key={n}>{qtd(o, n) || ''}</td>)}<td><b>{paresOP(o)}</b></td></tr></tbody></table>
          </div>
          {b.obs && <div className="pr-ficha-obs">{b.obs}</div>}
          <div className="pr-corte">✂</div>
        </article>
      ))}
    </div>
  ))

  const totPalm = palmilhas.reduce((t, p) => t + p.total, 0)
  const Palmilha = () => fatiar(palmilhas, POR_FOLHA_PALM).map((pagina, pi) => (
    <div key={pi} className="folha">
      <header className="pr-cab pr-cab-palm">
        <div className="pr-marca">PALMILHA<small>{modelos}</small></div>
        <div className="pr-cab-dados">
          <span><small>Data</small><b>{dataBR(mapa.data)}</b></span>
          <span><small>Cliente</small><b>{mapa.cliente || '—'}</b></span>
          <span><small>Prev. entrega</small><b>{dataBR(mapa.previsao)}</b></span>
          <span><small>Pedido</small><b>{mapa.pedido || '—'}</b></span>
          <span><small>Mapa</small><b>{numeroMapa(mapa.numero)}</b></span>
          <span className="pr-dest"><small>Qtd pares</small><b>{inteiro(totPalm)}</b></span>
        </div>
        <table className="pr-tab pr-palm-total">
          <thead><tr><th>Grade</th>{numsGerais.map((n) => <th key={n}>{n}</th>)}<th>Total</th></tr></thead>
          <tbody><tr><td>Qtd pares</td>{numsGerais.map((n) => <td key={n}>{palmilhas.reduce((t, p) => t + (p.grade[n] || 0), 0) || ''}</td>)}<td><b>{totPalm}</b></td></tr></tbody>
        </table>
        <div className="pr-palm-receb"><span>Data de entrega: ____/____/______</span><span>Data de recebimento: ____/____/______</span></div>
      </header>
      {pagina.map((p) => {
        const c = corPorNome[p.cor]
        const hex = c?.hex || '#FFFFFF'
        return (
          <article key={`${p.cor}|${p.obs}`} className="pr-tira">
            <div className="pr-tira-topo"><span>{dataBR(mapa.data)}</span><b>PALMILHA {p.modelo}</b><span>Pedido {mapa.pedido || '—'} · Ref. {[...p.refs].join(', ')}</span></div>
            <table className="pr-tab">
              <tbody>
                <tr><th rowSpan={2} className="pr-tira-cor" style={{ background: hex, color: textoEscuro(hex) ? '#151515' : '#fff' }}>{p.cor}</th>{numsGerais.map((n) => <th key={n}>{n}</th>)}<th>Total</th></tr>
                <tr>{numsGerais.map((n) => <td key={n}>{p.grade[n] || ''}</td>)}<td><b>{p.total}</b></td></tr>
              </tbody>
            </table>
            {p.obs && <div className="pr-tira-obs">{p.obs}</div>}
            <div className="pr-corte">✂</div>
          </article>
        )
      })}
    </div>
  ))

  return createPortal(
    <div className="print-root">
      <div className="print-barra no-print">
        <div className="segmented" role="tablist">
          {[['mapa', 'Mapa geral'], ['fichas', `Fichas por cor · ${fichasOps.length}`], ['palmilha', `Palmilha · ${palmilhas.length}`], ['tudo', 'Tudo']].map(([id, l]) => (
            <button key={id} className={aba === id ? 'on' : ''} onClick={() => setAba(id)}>{l}</button>
          ))}
        </div>
        <span className="actions">
          <button className="btn btn-dark" onClick={() => window.print()}>Imprimir</button>
          <button className="btn" onClick={onFechar}>Fechar</button>
        </span>
      </div>
      <div className="print-folhas">
        {(aba === 'mapa' || aba === 'tudo') && <Mapa />}
        {(aba === 'fichas' || aba === 'tudo') && <Fichas />}
        {(aba === 'palmilha' || aba === 'tudo') && <Palmilha />}
        {lista.length === 0 && <div className="folha"><p>Este mapa não tem OPs ativas.</p></div>}
      </div>
    </div>,
    document.body,
  )
}
