import { useEffect, useState } from 'react'
import Leitor from './Leitor.jsx'
import { FotoProduto } from './FotoProduto.jsx'
import { avisar } from '../lib/leitura.js'
import { avancarOP, buscarOPPorNumero, concluirOP, listarSetores, numeroDoCodigo, numeroOP, paresOP } from '../lib/producao.js'

/* Produção: bipa o QR da ficha (OP-0017) → conclui o setor atual e passa para o próximo */
export default function BiparProducao() {
  const [setores, setSetores] = useState([])
  const [res, setRes] = useState(null)   // { tipo: ok|aviso|erro|fim, op, texto, sub }
  const [ocupado, setOcupado] = useState(false)
  const [hist, setHist] = useState([])
  useEffect(() => { listarSetores().then(setSetores).catch(() => {}) }, [])
  const nomeSetor = (id) => setores.find((s) => s.id === id)?.nome || 'setor'

  async function ler(codigo, forcar = false) {
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
        <div><div className="eyebrow">Produção · operações</div><h1>Bipar fichas</h1><p className="painel-sub">Leia o QR da ficha ao sair de cada setor: a OP passa sozinha para o próximo.</p></div>
      </header>
      <Leitor onCodigo={(c) => !ocupado && ler(c)} rotulo="Bipar QR da ficha" />
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
          {hist.map((h, i) => <div key={i}><b>{numeroOP(h.op.numero)}</b> {h.op.produtos?.ref} {h.op.cores?.nome} · {h.de}{h.para ? ` → ${h.para}` : ' ✓ fim'}<small>{h.hora}</small></div>)}
        </div>
      )}
    </div>
  )
}
