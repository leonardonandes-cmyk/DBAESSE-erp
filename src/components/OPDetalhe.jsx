import { useState } from 'react'
import ProdutoCelula, { FotoProduto } from './FotoProduto.jsx'
import { dataBR, dataHoraBR, numeroPedido } from '../lib/format.js'
import { STATUS_OP, atrasadaOP, atualizarEtapa, cancelarOP, concluirOP, numeroOP, paresOP } from '../lib/producao.js'

const ST_ETAPA = { pendente: { label: 'Pendente', tom: 'neutral' }, em_curso: { label: 'Em curso', tom: 'warn' }, concluida: { label: 'Concluída', tom: 'ok' } }

export default function OPDetalhe({ op, setores, onFechar, onMudou }) {
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [apont, setApont] = useState(null) // { etapa, qtd_ok, qtd_perda, responsavel }
  const setorPorId = Object.fromEntries(setores.map((s) => [s.id, s]))
  const pares = paresOP(op)
  const st = STATUS_OP[op.status]
  const aberta = ['aberta', 'em_producao'].includes(op.status)

  async function rodar(fn) {
    setErro(''); setOcupado(true)
    try { await fn(); await onMudou(true) } catch (e) { setErro(e.message) } finally { setOcupado(false) }
  }

  const iniciar = (e) => rodar(() => atualizarEtapa(e.id, { status: 'em_curso', inicio: new Date().toISOString() }))
  const reabrir = (e) => rodar(() => atualizarEtapa(e.id, { status: 'em_curso', fim: null }))
  const salvarApont = () => rodar(async () => {
    await atualizarEtapa(apont.etapa.id, {
      status: 'concluida', fim: new Date().toISOString(), inicio: apont.etapa.inicio || new Date().toISOString(),
      qtd_ok: Number(apont.qtd_ok) || 0, qtd_perda: Number(apont.qtd_perda) || 0, responsavel: apont.responsavel || null,
    })
    setApont(null)
  })

  function imprimir() {
    const cor = op.cores?.nome || ''
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${numeroOP(op.numero)}</title>
<style>body{font-family:Arial,sans-serif;margin:28px;color:#111}h1{font-size:26px;margin:0}h2{font-size:15px;margin:22px 0 8px;text-transform:uppercase;letter-spacing:.1em}
.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px}
.info{font-size:14px;line-height:1.6}table{border-collapse:collapse;width:100%;font-size:14px}td,th{border:1px solid #444;padding:8px;text-align:center}
th{background:#eee}.set td{height:34px}.mark{font-size:11px;color:#555}</style></head><body>
<div class="top"><div><div class="mark">DBAESSE · ORDEM DE PRODUÇÃO</div><h1>${numeroOP(op.numero)}</h1></div>
<div class="info"><b>Prazo:</b> ${op.prazo ? dataBR(op.prazo) : '—'}<br><b>Prioridade:</b> ${op.prioridade === 'urgente' ? 'URGENTE' : 'Normal'}<br>${op.pedidos ? `<b>Pedido:</b> ${numeroPedido(op.pedidos.numero)}` : 'Estoque'}</div></div>
<h2>${op.produtos.ref} · ${op.produtos.nome} · ${cor}</h2>
<table><tr>${op.op_itens.map((i) => `<th>${i.skus.numero}</th>`).join('')}<th>Total</th></tr>
<tr>${op.op_itens.map((i) => `<td><b>${i.quantidade}</b></td>`).join('')}<td><b>${pares}</b></td></tr></table>
${op.observacao ? `<p><b>Obs.:</b> ${op.observacao}</p>` : ''}
<h2>Setores</h2><table class="set"><tr><th>Setor</th><th>Início</th><th>Fim</th><th>Pares OK</th><th>Perda</th><th>Responsável</th></tr>
${op.op_etapas.map((e) => `<tr><td style="text-align:left"><b>${setorPorId[e.setor_id]?.nome || ''}</b></td><td></td><td></td><td></td><td></td><td></td></tr>`).join('')}</table>
<script>window.onload=()=>window.print()</script></body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  return (
    <div className="modal-bg" onClick={onFechar}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">{op.pedidos ? `Pedido ${numeroPedido(op.pedidos.numero)}` : 'Estoque / reposição'} · criada em {dataBR(op.criado_em)}</div>
            <div className="prod-cell">
              <FotoProduto p={op.produtos} corId={op.cor_id} />
              <div>
                <h2>{numeroOP(op.numero)} · {op.produtos.ref} {op.produtos.nome}</h2>
                <span><i className="dot-cor" style={{ background: op.cores?.hex || '#ddd' }} />{op.cores?.nome}</span>
            <div className="chips" style={{ marginTop: 8 }}>
              <span className={`pill ${st.tom}`}>{st.label}</span>
              {op.prioridade === 'urgente' && <span className="pill bad">Urgente</span>}
              {atrasadaOP(op) && <span className="pill bad">Atrasada</span>}
              {op.estoque_lancado && <span className="pill neutral">Entrou no estoque</span>}
            </div>
              </div>
            </div>
          </div>
          <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
        </div>

        <div className="preview" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
          <span className="dot" style={{ background: op.cores?.hex || '#ddd', width: 16, height: 16 }} /><b>{op.cores?.nome}</b>
          <div className="grade-mini">{op.op_itens.map((i) => <span key={i.id}><small>{i.skus.numero}</small>{i.quantidade}</span>)}</div>
          <span><b>{pares}</b> pares · prazo {op.prazo ? dataBR(op.prazo) : '—'}</span>
        </div>
        {op.observacao && <p className="card-sub" style={{ margin: 0 }}>{op.observacao}</p>}

        <div className="table-wrap">
          <table style={{ minWidth: 620 }}>
            <thead><tr><th>Setor</th><th>Situação</th><th>Início</th><th>Fim</th><th className="r">OK</th><th className="r">Perda</th><th>Responsável</th><th /></tr></thead>
            <tbody>
              {op.op_etapas.map((e) => {
                const s = ST_ETAPA[e.status]
                return (
                  <tr key={e.id}>
                    <td><b>{setorPorId[e.setor_id]?.nome || '—'}</b></td>
                    <td><span className={`pill ${s.tom}`}>{s.label}</span></td>
                    <td style={{ color: 'var(--muted)' }}>{e.inicio ? dataHoraBR(e.inicio) : '—'}</td>
                    <td style={{ color: 'var(--muted)' }}>{e.fim ? dataHoraBR(e.fim) : '—'}</td>
                    <td className="r">{e.qtd_ok ?? '—'}</td>
                    <td className="r" style={{ color: e.qtd_perda ? 'var(--bad)' : undefined }}>{e.qtd_perda || '—'}</td>
                    <td>{e.responsavel || '—'}</td>
                    <td className="r" style={{ whiteSpace: 'nowrap' }}>
                      {aberta && e.status === 'pendente' && <button className="btn btn-sm" disabled={ocupado} onClick={() => iniciar(e)}>Iniciar</button>}
                      {aberta && e.status !== 'concluida' && (
                        <button className="btn btn-sm btn-dark" disabled={ocupado} style={{ marginLeft: 6 }}
                          onClick={() => setApont({ etapa: e, qtd_ok: pares, qtd_perda: 0, responsavel: e.responsavel || '' })}>Concluir</button>
                      )}
                      {aberta && e.status === 'concluida' && <button className="link-btn" disabled={ocupado} onClick={() => reabrir(e)}>reabrir</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {apont && (
          <div className="seletor">
            <b>Concluir {setorPorId[apont.etapa.setor_id]?.nome}</b>
            <div className="form-grid">
              <label className="field"><span>Pares OK</span><input type="number" min="0" value={apont.qtd_ok} onChange={(e) => setApont({ ...apont, qtd_ok: e.target.value })} /></label>
              <label className="field"><span>Perda / retrabalho</span><input type="number" min="0" value={apont.qtd_perda} onChange={(e) => setApont({ ...apont, qtd_perda: e.target.value })} /></label>
              <label className="field"><span>Responsável</span><input value={apont.responsavel} onChange={(e) => setApont({ ...apont, responsavel: e.target.value })} placeholder="Nome ou equipe" /></label>
            </div>
            <div className="actions" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setApont(null)}>Voltar</button>
              <button className="btn btn-dark" disabled={ocupado} onClick={salvarApont}>Salvar apontamento</button>
            </div>
          </div>
        )}

        {erro && <p className="form-error" role="alert">{erro}</p>}

        <div className="pedido-rodape">
          <button type="button" className="btn" onClick={imprimir}>Imprimir ficha da OP</button>
          <div className="actions">
            {aberta && <button type="button" className="btn btn-perigo" disabled={ocupado} onClick={() => window.confirm(`Cancelar ${numeroOP(op.numero)}?`) && rodar(() => cancelarOP(op.id))}>Cancelar OP</button>}
            {aberta && (
              <button type="button" className="btn btn-dark" disabled={ocupado}
                onClick={() => window.confirm(`Concluir ${numeroOP(op.numero)}? Os ${pares} pares entram no estoque e os materiais da ficha de consumo são baixados.`) && rodar(() => concluirOP(op.id))}>
                Concluir OP · entrar no estoque
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
