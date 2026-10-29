import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgramarPedido from './ProgramarPedido.jsx'
import { dataBR, inteiro, numeroPedido } from '../lib/format.js'
import { listarMapas } from '../lib/mapas.js'
import { listarParceiros } from '../lib/parceiros.js'
import { carregarItens, totaisPedido } from '../lib/pedidos.js'

/*
  Pedidos de ATACADO aguardando programação de cliente.
  Some da lista sozinho quando: ganha programação, é faturado/entregue ou cancelado.
  Orçamentos (cliente ainda não confirmou) ficam recolhidos para a lista não crescer.
*/
const CONFIRMADOS = ['aprovado', 'producao']
export default function PedidosAguardando({ pedidos, ops = [], produtos, cores, versao, onProgramado }) {
  const navigate = useNavigate()
  const [comProg, setComProg] = useState(null)
  const [verOrc, setVerOrc] = useState(false)
  const [abrindo, setAbrindo] = useState('')
  const [prog, setProg] = useState(null) // { pedido, cliente, itens }
  const [erro, setErro] = useState('')

  useEffect(() => { listarMapas().then((m) => setComProg(new Set(m.map((x) => x.pedido_id).filter(Boolean)))).catch(() => setComProg(new Set())) }, [versao])

  const comOP = useMemo(() => new Set(ops.map((o) => o.pedido_id).filter(Boolean)), [ops]) // já produzindo por OP avulsa
  const ordem = (a, b) => (a.previsao || '9999').localeCompare(b.previsao || '9999') || a.numero - b.numero
  const pend = useMemo(() => (comProg ? pedidos.filter((p) => p.canal === 'Atacado' && !comProg.has(p.id) && !comOP.has(p.id)) : []), [pedidos, comProg, comOP])
  const confirmados = pend.filter((p) => CONFIRMADOS.includes(p.status)).sort(ordem)
  const orcamentos = pend.filter((p) => p.status === 'orcamento').sort(ordem)
  const prodPorId = useMemo(() => Object.fromEntries(produtos.map((p) => [p.id, p])), [produtos])
  const corPorId = useMemo(() => Object.fromEntries(cores.map((c) => [c.id, c])), [cores])

  if (!comProg || (!confirmados.length && !orcamentos.length)) return null

  async function programar(p) {
    setErro(''); setAbrindo(p.id)
    try {
      const [its, parc] = await Promise.all([carregarItens(p.id), listarParceiros()])
      setProg({
        pedido: p, cliente: parc.find((x) => x.id === p.parceiro_id),
        itens: its.map((i) => ({ sku_id: i.sku_id, numero: i.skus.numero, quantidade: i.quantidade, produto: prodPorId[i.skus.produto_id], cor: corPorId[i.skus.cor_id] })),
      })
    } catch (e) { setErro(e.message) } finally { setAbrindo('') }
  }

  const hoje = new Date().toISOString().slice(0, 10)
  const linha = (p) => {
    const t = totaisPedido(p)
    const atras = p.previsao && p.previsao < hoje
    return (
      <div key={p.id} className="aguarda-linha">
        <div className="aguarda-num"><b>{numeroPedido(p.numero)}</b>{p.status === 'orcamento' && <span className="pill">Orçamento</span>}</div>
        <div className="aguarda-cli">{p.parceiros?.nome || 'Sem cliente'}{p.vendedora ? <small> · {p.vendedora}</small> : null}</div>
        <div className="aguarda-pares"><b>{inteiro(t.pares)}</b> pares</div>
        <div className={`aguarda-prev ${atras ? 'atras' : ''}`}>{p.previsao ? dataBR(p.previsao) : 'sem data'}</div>
        <div className="aguarda-acoes">
          <button type="button" className="link-btn" onClick={() => navigate(`/pedidos?abrir=${p.id}`)}>Ver pedido</button>
          <button type="button" className="btn btn-sm btn-dark" disabled={abrindo === p.id} onClick={() => programar(p)}>{abrindo === p.id ? 'Abrindo…' : 'Programar'}</button>
        </div>
      </div>
    )
  }

  return (
    <section className="card aguarda">
      <header className="aguarda-head">
        <div>
          <h2>Pedidos aguardando programação</h2>
          <p className="card-sub">Atacado confirmado e ainda sem programação. Some da lista ao programar, faturar ou cancelar.</p>
        </div>
        <span className="aguarda-cont">{confirmados.length}</span>
      </header>
      {confirmados.length ? confirmados.map(linha) : <p className="faint" style={{ margin: 0 }}>Nenhum pedido confirmado esperando.</p>}
      {orcamentos.length > 0 && (
        <>
          <button type="button" className="link-btn aguarda-orc" onClick={() => setVerOrc((v) => !v)}>
            {verOrc ? 'Esconder' : 'Ver'} {orcamentos.length} {orcamentos.length === 1 ? 'orçamento ainda não aprovado' : 'orçamentos ainda não aprovados'}
          </button>
          {verOrc && orcamentos.map(linha)}
        </>
      )}
      {erro && <p className="form-error" role="alert">{erro}</p>}
      {prog && (
        <ProgramarPedido pedido={prog.pedido} cliente={prog.cliente} previsao={prog.pedido.previsao} itens={prog.itens}
          onCorrigir={() => { const id = prog.pedido.id; setProg(null); navigate(`/pedidos?corrigir=${id}`) }}
          onAgoraNao={() => setProg(null)}
          onFinalizado={(r) => { setProg(null); onProgramado?.(r) }} />
      )}
    </section>
  )
}
