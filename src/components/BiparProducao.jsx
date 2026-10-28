import { useEffect, useState } from 'react'
import Leitor from './Leitor.jsx'
import { FotoProduto } from './FotoProduto.jsx'
import { avisar } from '../lib/leitura.js'
import { OP_ABERTAS, avancarOP, buscarMapaComOPs, buscarOPPorNumero, concluirOP, listarSetores, numeroDoCodigo, numeroMapaDoCodigo, numeroOP, paresOP } from '../lib/producao.js'
import { numeroMapa, situacaoMapa } from '../lib/mapas.js'

/* Produção: bipa o QR da ficha (OP-0017) → conclui o setor atual e passa para o próximo */
export default function BiparProducao() {
  const [setores, setSetores] = useState([])
  const [res, setRes] = useState(null)   // { tipo: ok|aviso|erro|fim, op, texto, sub }
  const [ocupado, setOcupado] = useState(false)
  const [hist, setHist] = useState([])
  useEffect(() => { listarSetores().then(setSetores).catch(() => {}) }, [])
  const nomeSetor = (id) => setores.find((s) => s.id === id)?.nome || 'setor'

  const [lote, setLote] = useState(null) // { mapa, ops } quando bipa o QR do mapa
  async function abrirMapa(n) {
    setOcupado(true)
    try {
      const r = await buscarMapaComOPs(n)
      if (!r) throw new Error(`${numeroMapa(n)} não encontrado.`)
      avisar(true); setRes(null); setLote(r)
    } catch (e) { avisar(false); setLote(null); setRes({ tipo: 'erro', texto: e.message }) } finally { setOcupado(false) }
  }
  async function concluirMapa() {
    setOcupado(true)
    try {
      const prontas = lote.ops.filter((o) => OP_ABERTAS.includes(o.status) && o.op_etapas.every((e) => e.status === 'concluida'))
      for (const o of prontas) await concluirOP(o.id)
      avisar(true)
      setHist((h) => [{ texto: `${numeroMapa(lote.mapa.numero)} · ${prontas.length} OPs concluídas · ${prontas.reduce((t, o) => t + paresOP(o), 0)} pares no estoque`, hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }, ...h].slice(0, 8))
      await abrirMapa(lote.mapa.numero)
    } catch (e) { setRes({ tipo: 'erro', texto: e.message }) } finally { setOcupado(false) }
  }

  async function ler(codigo, forcar = false) {
    const nm = numeroMapaDoCodigo(codigo)
    if (nm) return abrirMapa(nm)
    setLote(null)
    const n = numeroDoCodigo(codigo)
    if (!n) { avisar(false); setRes({ tipo: 'erro', texto: 'Código não é de uma ficha de produção', sub: codigo }); return }
    setOcupado(true)
    try {
      const op = await buscarOPPorNumero(n)
      if (!op) throw new Error(`${numeroOP(n)} não encontrada.`)
      const r = await avancarOP(op, { forcar })
      if (r.repetida) { avisar(false); setRes({ tipo: 'aviso', op, codigo, texto: `${nomeSetor(r.etapa.setor_id)} já foi registrado agora há pouco`, sub: 'Leitura repetida? Se for mesmo o próximo setor, toque em "Registrar mesmo assim".' }); return }
      if (r.fim && !r.concluiu) { avisar(true); setRes({ tipo: 'fim', op, texto: 'Todos os setores já concluídos', sub: 'Conclua a OP para dar entrada no estoque.' }); return }
      avisar(true)
      const linha = { op, de: nomeSetor(r.concluiu.setor_id), para: r.proxima ? nomeSetor(r.proxima.setor_id) : null, hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
      setHist((h) => [linha, ...h].slice(0, 8))
      setRes(r.fim
        ? { tipo: 'fim', op, texto: `${linha.de} concluído — último setor`, sub: 'Conclua a OP para dar entrada dos pares no estoque.' }
        : { tipo: 'ok', op, texto: `${linha.de} concluído`, sub: `Agora em ${linha.para}` })
    } catch (e) { avisar(false); setRes({ tipo: 'erro', texto: e.message }) } finally { setOcupado(false) }
  }

  async function concluir() {
    setOcupado(true)
    try { await concluirOP(res.op.id); avisar(true); setRes({ tipo: 'ok', op: res.op, texto: `${numeroOP(res.op.numero)} concluída`, sub: `${paresOP(res.op)} pares entraram no estoque` }) }
    catch (e) { setRes({ tipo: 'erro', texto: e.message }) } finally { setOcupado(false) }
  }

  return (
    <div className="appv bipar-pagina">
      <header className="page-head">
        <div><div className="eyebrow">Produção · operações</div><h1>Bipar fichas</h1><p className="painel-sub">Bipe a <b>ficha</b> ao sair de cada setor — a OP passa sozinha para o próximo. O QR do <b>mapa</b> é para consultar onde está cada ficha e, no fim, dar entrada no estoque.</p></div>
      </header>
      <Leitor onCodigo={(c) => !ocupado && ler(c)} rotulo="Bipar QR (ficha ou mapa)" />
      {lote && <PainelMapa lote={lote} nomeSetor={nomeSetor} setores={setores} ocupado={ocupado} onConcluir={concluirMapa} onFechar={() => setLote(null)} />}
      {res && (
        <div className={`appv-prod ${res.tipo}`}>
          {res.op && <FotoProduto p={res.op.produtos} corId={res.op.cor_id} size={64} />}
          <div>
            {res.op && <span className="appv-prod-op">{numeroOP(res.op.numero)} · {res.op.produtos?.ref} · {res.op.cores?.nome} · {paresOP(res.op)} pares</span>}
            <b>{res.texto}</b>
            {res.sub && <small>{res.sub}</small>}
            {res.tipo === 'aviso' && <button className="btn btn-sm" disabled={ocupado} onClick={() => ler(res.codigo, true)}>Registrar mesmo assim</button>}
            {res.tipo === 'fim' && res.op && <button className="btn btn-sm btn-dark" disabled={ocupado} onClick={concluir}>Concluir OP e dar entrada no estoque</button>}
          </div>
        </div>
      )}
      {hist.length > 0 && (
        <div className="appv-hist">
          <span className="eyebrow">Últimas leituras</span>
          {hist.map((h, i) => <div key={i}>{h.op ? <><b>{numeroOP(h.op.numero)}</b> {h.op.produtos?.ref} {h.op.cores?.nome} · {h.de}{h.para ? ` → ${h.para}` : ' ✓ fim'}</> : <b>{h.texto}</b>}<small>{h.hora}</small></div>)}
        </div>
      )}
    </div>
  )
}

function PainelMapa({ lote, nomeSetor, setores, ocupado, onConcluir, onFechar }) {
  const { mapa, ops } = lote
  const sit = situacaoMapa(mapa, ops)
  const abertas = ops.filter((o) => OP_ABERTAS.includes(o.status))
  const ondeEsta = (o) => (o.status === 'concluida' ? 'concluida' : o.status === 'cancelada' ? 'cancelada' : o.op_etapas.find((e) => e.status !== 'concluida')?.setor_id || 'pronta')
  const prontas = abertas.filter((o) => ondeEsta(o) === 'pronta')
  const porSetor = setores.map((s) => ({ s, ops: abertas.filter((o) => ondeEsta(o) === s.id) })).filter((x) => x.ops.length)
  const pares = (l) => l.reduce((t, o) => t + paresOP(o), 0)
  const concl = ops.filter((o) => o.status === 'concluida')
  return (
    <section className="mapa-lote">
      <header>
        <div><span className="eyebrow">Mapa</span><b>{numeroMapa(mapa.numero)}</b><small>{mapa.pedido || 'sem pedido'} · {mapa.cliente || 'sem cliente'} · {ops.length} fichas · {pares(ops)} pares</small></div>
        <button className="btn btn-sm" onClick={onFechar}>Fechar</button>
      </header>
      {sit.id === 'atrasado' && <div className="aviso-forte">⚠ MAPA ATRASADO há {Math.abs(sit.dias)} {Math.abs(sit.dias) === 1 ? 'dia' : 'dias'} — {sit.abertas} fichas ainda em produção</div>}
      {sit.id === 'vence' && <div className="aviso-leve">⏳ {sit.dias === 0 ? 'Vence HOJE' : `Vence em ${sit.dias} ${sit.dias === 1 ? 'dia' : 'dias'}`} — faltam {sit.abertas} fichas</div>}
      {sit.id === 'producao' && <div className="aviso-leve">Mapa em produção — faltam {sit.abertas} de {sit.total} fichas</div>}
      <div className="mapa-lote-prog">
        <i style={{ width: `${ops.length ? (concl.length / ops.length) * 100 : 0}%` }} />
        <span>{concl.length} de {ops.length} fichas concluídas</span>
      </div>
      {porSetor.map(({ s, ops: os }) => (
        <div key={s.id} className="mapa-lote-setor">
          <div><b>{s.nome}</b><small>{os.length} fichas · {pares(os)} pares</small>
            <span className="mapa-lote-ops">{os.map((o) => <span key={o.id} title={`${numeroOP(o.numero)} · ${o.produtos?.ref} ${o.cores?.nome}`}><FotoProduto p={o.produtos} corId={o.cor_id} size={26} /></span>)}</span>
          </div>
        </div>
      ))}
      {prontas.length > 0 && (
        <div className="mapa-lote-setor pronto">
          <div><b>Prontas para o estoque</b><small>{prontas.length} fichas · {pares(prontas)} pares passaram por todos os setores</small></div>
          <button className="btn btn-sm btn-dark" disabled={ocupado} onClick={onConcluir}>Concluir mapa · entrada no estoque</button>
        </div>
      )}
      {abertas.length === 0 && <p className="card-sub" style={{ margin: 0 }}>Todas as fichas deste mapa já foram concluídas.</p>}
    </section>
  )
}
