import { useEffect, useMemo, useState } from 'react'
import { listarParceiros } from '../lib/parceiros.js'
import { listarPedidos, totaisPedido, STATUS_PEDIDO } from '../lib/pedidos.js'
import { numeroPedido } from '../lib/format.js'
import { baixarZpl, enviarParaZebra, zplVolume } from '../lib/etiquetas.js'

/*
  ROMANEIO DE ENVIO avulso (Operações → Etiquetas → Romaneio): reimprimir quando for preciso.
  Escolhe o PEDIDO (puxa cliente e pares) ou, sem pedido, escolhe o CLIENTE e digita os pares.
  100×150 deitado (rolo da Shopee) · um por volume: nome do cliente, cidade - UF, VOL. i/N, pares.
*/
export default function RomaneioAvulso() {
  const [pedidos, setPedidos] = useState([])
  const [clientes, setClientes] = useState([])
  const [pedidoId, setPedidoId] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [paresMan, setParesMan] = useState('')
  const [volumes, setVolumes] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    Promise.all([listarPedidos(), listarParceiros()])
      .then(([ps, cs]) => {
        setPedidos((Array.isArray(ps) ? ps : ps?.data || []).filter((p) => p.status !== 'cancelado'))
        setClientes(cs.filter((c) => c.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome)))
      })
      .catch((e) => setErro(e.message))
  }, [])

  const pedido = pedidos.find((p) => p.id === pedidoId)
  const cliente = clientes.find((c) => c.id === (pedido ? pedido.parceiro_id : clienteId))
  const pares = pedido ? totaisPedido(pedido).pares : Number(paresMan) || 0
  const nVol = Math.max(0, Math.floor(Number(volumes) || 0))
  const nome = cliente?.nome || pedido?.parceiros?.nome || ''
  const codigoBase = pedido ? numeroPedido(pedido.numero) : 'ROM'
  const pronto = nome && nVol > 0

  const zpl = () => Array.from({ length: nVol }, (_, k) => zplVolume({
    cliente: nome, cidade: cliente?.cidade, uf: cliente?.uf, pedido: codigoBase, pares, volume: k + 1, volumes: nVol,
  })).join('\n')

  async function imprimir() {
    setErro(''); setOk(''); setEnviando(true)
    try { await enviarParaZebra(zpl()); setOk(`${nVol} romaneio(s) enviado(s) para a Zebra.`) } catch (e) { setErro(e.message) }
    setEnviando(false)
  }

  const opcoesPedido = useMemo(() => pedidos.slice(0, 300), [pedidos])

  return (
    <section className="etq-grid">
      <div className="card">
        <div className="card-head"><div>
          <h2>Romaneio de envio</h2>
          <div className="card-sub">Escolha o pedido (puxa cliente e pares) ou, sem pedido, o cliente. Um romaneio por volume.</div>
        </div></div>
        <div className="form-grid">
          <label className="field span-2">
            <span>Pedido</span>
            <select className="input" value={pedidoId} onChange={(e) => { setPedidoId(e.target.value); setOk('') }}>
              <option value="">Sem pedido (escolher o cliente)</option>
              {opcoesPedido.map((p) => (
                <option key={p.id} value={p.id}>
                  {numeroPedido(p.numero)} · {p.parceiros?.nome || 'Sem cliente'} · {totaisPedido(p).pares} pares · {STATUS_PEDIDO[p.status]?.label}
                </option>
              ))}
            </select>
          </label>
          {!pedido && (
            <>
              <label className="field span-2">
                <span>Cliente</span>
                <select className="input" value={clienteId} onChange={(e) => { setClienteId(e.target.value); setOk('') }}>
                  <option value="">Escolha o cliente…</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.cidade ? ` · ${c.cidade}${c.uf ? `/${c.uf}` : ''}` : ''}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Pares</span>
                <input className="input" type="number" min={0} inputMode="numeric" value={paresMan} onChange={(e) => setParesMan(e.target.value)} />
              </label>
            </>
          )}
          <label className="field">
            <span>Volumes</span>
            <input className="input" type="number" min={1} inputMode="numeric" value={volumes} onChange={(e) => { setVolumes(e.target.value); setOk('') }}
              onKeyDown={(e) => e.key === 'Enter' && pronto && imprimir()} />
          </label>
        </div>
        {cliente && (!cliente.cidade || !cliente.uf) && <p className="form-error" style={{ marginTop: 12 }}>O cadastro do cliente está sem cidade/estado — o romaneio sai com "—".</p>}
        {erro && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{erro}</p>}
        {ok && <p className="pill ok" role="status" style={{ display: 'inline-block', marginTop: 12 }}>{ok}</p>}
        <div className="actions" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn" disabled={!pronto} onClick={() => baixarZpl(zpl(), `romaneio-${codigoBase}.zpl`)}>Baixar .zpl</button>
          <button className="btn btn-dark" disabled={!pronto || enviando} onClick={imprimir}>{enviando ? 'Enviando…' : `Imprimir ${nVol || ''}`}</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div><h2>Prévia</h2><div className="card-sub">100×150 mm (rolo da Shopee) · horizontal</div></div></div>
        {nome ? (
          <div className="etq etq-deitada etq-volume">
            <div className="etq-vol-nome">{nome}</div>
            <div className="etq-vol-local">{[cliente?.cidade, cliente?.uf].filter(Boolean).join(' - ') || '—'}</div>
            <div className="etq-vol-base">
              <span style={{ fontSize: '1.7em', fontWeight: 800 }}>VOL. 1/{nVol || 1}</span>
              <span style={{ fontSize: '.8em' }}>{pares} PARES</span>
              <div className="etq-barras"><div className="etq-listras" style={{ width: '100%', height: '1.6em' }} /><span>{codigoBase}-V1</span></div>
            </div>
          </div>
        ) : <div className="etq etq-vazia etq-deitada">A prévia aparece aqui</div>}
      </div>
    </section>
  )
}
