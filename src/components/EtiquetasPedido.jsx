import { useEffect, useState } from 'react'
import { FotoProduto } from './FotoProduto.jsx'
import { numeroPedido } from '../lib/format.js'
import { baixarZpl, enviarParaZebra, listarTamanhos, zplDoPedido, zplVolume } from '../lib/etiquetas.js'

/*
  Etiquetas do PEDIDO.
  modo 'unitaria' → pedido programado: uma etiqueta por par, gerada sozinha a partir dos itens.
  modo 'volumes'  → ROMANEIO DE ENVIO ao faturar: pergunta quantos volumes e imprime um por volume (1/N, 2/N…), com os dados do cliente. Sem caixa padrão.
*/
export default function EtiquetasPedido({ modo, pedido, grupos, cliente, pares, onFechar }) {
  const [tamanhos, setTamanhos] = useState({})
  const [volumes, setVolumes] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [enviando, setEnviando] = useState(false)
  useEffect(() => { listarTamanhos().then(setTamanhos).catch(() => {}) }, [])

  const num = numeroPedido(pedido.numero)
  const linhas = grupos.flatMap((g) => g.itens.map((i) => ({ produto: g.produto, cor: g.cor, numero: i.skus.numero, sku: i.skus.sku, quantidade: i.quantidade })))
  const nVol = Math.max(0, Math.floor(Number(volumes) || 0))

  async function zpl() {
    if (modo === 'unitaria') return zplDoPedido(linhas, tamanhos)
    return Array.from({ length: nVol }, (_, k) => zplVolume({
      cliente: pedido.parceiros?.nome || cliente?.nome || 'Cliente', cidade: cliente?.cidade, uf: cliente?.uf, pedido: num, pares,
      volume: k + 1, volumes: nVol,
    })).join('\n')
  }
  const qtd = modo === 'unitaria' ? linhas.reduce((s, l) => s + l.quantidade, 0) : nVol

  async function imprimir() {
    setErro(''); setOk(''); setEnviando(true)
    try { await enviarParaZebra(await zpl()); setOk(`${qtd} ${modo === 'unitaria' ? 'etiqueta(s)' : 'romaneio(s)'} enviado(s) para a Zebra.`) } catch (e) { setErro(e.message) }
    setEnviando(false)
  }

  return (
    <div className="modal-bg" onClick={onFechar}>
      <div className="modal" style={{ maxWidth: modo === 'unitaria' ? 640 : 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">{num} · {pedido.parceiros?.nome || 'Sem cliente'}</div>
            <h2>{modo === 'unitaria' ? 'Etiquetas unitárias' : 'Romaneio de envio'}</h2>
          </div>
          <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
        </div>

        {modo === 'unitaria' ? (
          <>
            <p className="card-sub" style={{ margin: 0 }}>Uma etiqueta por par, gerada a partir do pedido.</p>
            <table>
              <tbody>
                {grupos.map((g) => (
                  <tr key={g.chave}>
                    <td><div className="prod-cell"><FotoProduto p={g.produto} corId={g.cor?.id} className="sm" size={18} /><div><b>{g.produto?.ref} · {g.produto?.nome}</b><span>{g.cor?.nome}</span></div></div></td>
                    <td><div className="grade-mini">{g.itens.map((i) => <span key={i.sku_id}>{i.skus.numero}<small>{i.quantidade}</small></span>)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <>
            <p className="card-sub" style={{ margin: 0 }}>Pedido faturado ({pares} pares). Quantos volumes vão sair?</p>
            <label className="field" style={{ maxWidth: 200 }}>
              <span>Volumes</span>
              <input className="input" type="number" min={1} inputMode="numeric" autoFocus value={volumes}
                onChange={(e) => setVolumes(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && nVol > 0 && imprimir()} />
            </label>
            {nVol > 0 && <p className="card-sub" style={{ margin: 0 }}>Sai um romaneio por volume (100×150, rolo da Shopee): 1/{nVol} até {nVol}/{nVol}.</p>}
            {nVol > 0 && (
              <div className="etq etq-deitada etq-volume">
                <div className="etq-vol-nome">{pedido.parceiros?.nome || cliente?.nome}</div>
                <div className="etq-vol-local">{[cliente?.cidade, cliente?.uf].filter(Boolean).join(' - ') || '—'}</div>
                <div className="etq-vol-base">
                  <span>PARES: {pares}</span>
                  <span>VOLUME: 1/{nVol}</span>
                  <div className="etq-barras"><div className="etq-listras" style={{ width: '100%', height: '1.6em' }} /><span>{num}-V1</span></div>
                </div>
              </div>
            )}
            {cliente && (!cliente.cidade || !cliente.uf) && <p className="form-error" style={{ margin: 0 }}>O cadastro do cliente está sem cidade/estado — o romaneio sai com "—".</p>}
          </>
        )}

        {erro && <p className="form-error" role="alert">{erro}</p>}
        {ok && <p className="pill ok" role="status" style={{ alignSelf: 'flex-start' }}>{ok}</p>}

        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onFechar}>{ok ? 'Fechar' : 'Agora não'}</button>
          <button type="button" className="btn" disabled={!qtd} onClick={async () => baixarZpl(await zpl(), `${num}-${modo}.zpl`)}>Baixar .zpl</button>
          <button type="button" className="btn btn-dark" disabled={!qtd || enviando} onClick={imprimir}>{enviando ? 'Enviando…' : `Imprimir ${qtd || ''}`}</button>
        </div>
      </div>
    </div>
  )
}
