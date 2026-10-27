import { useEffect, useState } from 'react'
import { FotoProduto } from './FotoProduto.jsx'
import ImprimirMapa from './ImprimirMapa.jsx'
import NovoMapa from './NovoMapa.jsx'
import Icon from './Icon.jsx'
import { dataBR, inteiro } from '../lib/format.js'
import { listarMapas, numeroMapa } from '../lib/mapas.js'
import { listarParceiros } from '../lib/parceiros.js'
import { OP_ABERTAS, paresOP } from '../lib/producao.js'

/* Mapas de programação: lista, novo mapa e impressão (mapa geral · fichas por cor · palmilha) */
export default function MapasLista({ ops, produtos, cores, onMudou }) {
  const [mapas, setMapas] = useState(null)
  const [parceiros, setParceiros] = useState([])
  const [novo, setNovo] = useState(false)
  const [imprimir, setImprimir] = useState(null) // { mapa, aba }
  const [erro, setErro] = useState('')

  async function carregar() {
    try { setMapas(await listarMapas()) } catch (e) { setErro(e.message) }
  }
  useEffect(() => { carregar(); listarParceiros().then(setParceiros).catch(() => {}) }, [])

  const opsDo = (m) => ops.filter((o) => o.programacao_id === m.id)

  return (
    <>
      <div className="mapas-topo">
        <p className="card-sub" style={{ margin: 0 }}>Monte o mapa como na planilha: pedido, cliente, marca e datas + as referências com cores e grade. Cada cor vira uma OP, e daqui saem o <b>mapa geral</b>, as <b>fichas por cor</b> e a <b>relação de palmilha</b> para imprimir.</p>
        <button className="btn btn-dark" onClick={() => setNovo(true)}><Icon name="mais" size={16} stroke={2} />Novo mapa</button>
      </div>
      {erro && <p className="form-error" role="alert">{erro}</p>}
      {!mapas && <p className="card-sub">Carregando…</p>}
      {mapas && mapas.length === 0 && (
        <section className="card empty"><h2>Nenhum mapa ainda</h2><p>Crie o primeiro mapa de programação — as OPs e as folhas de corte saem dele.</p><button className="btn btn-dark" onClick={() => setNovo(true)}>Novo mapa</button></section>
      )}
      <div className="mapas-grade">
        {mapas?.map((m) => {
          const os = opsDo(m)
          const pares = os.reduce((t, o) => t + paresOP(o), 0)
          const abertas = os.filter((o) => OP_ABERTAS.includes(o.status)).length
          const concl = os.filter((o) => o.status === 'concluida').length
          const refs = [...new Map(os.map((o) => [o.produto_id, o.produtos])).values()]
          return (
            <article key={m.id} className="card mapa-card">
              <header>
                <div><span className="eyebrow">{numeroMapa(m.numero)}{m.pedido ? ` · ${m.pedido}` : ''}</span><h3>{m.cliente || 'Sem cliente'}</h3></div>
                <div className="mapa-card-pares"><b>{inteiro(pares)}</b><small>pares</small></div>
              </header>
              <div className="mapa-card-refs">
                {refs.slice(0, 6).map((p) => <span key={p?.ref} title={`${p?.ref} · ${p?.nome}`}><FotoProduto p={p} size={40} /><small>{p?.ref}</small></span>)}
                {refs.length > 6 && <span className="mais">+{refs.length - 6}</span>}
              </div>
              <div className="mapa-card-dados">
                <span><small>Data</small>{dataBR(m.data)}</span>
                <span><small>Prev. entrega</small>{dataBR(m.previsao)}</span>
                <span><small>Marca</small>{m.marca || '—'}</span>
                <span><small>OPs</small>{os.length} · {concl} concluídas{abertas ? ` · ${abertas} abertas` : ''}</span>
              </div>
              <div className="mapa-card-acoes">
                <button className="btn btn-sm" onClick={() => setImprimir({ mapa: m, aba: 'mapa' })}>Mapa geral</button>
                <button className="btn btn-sm" onClick={() => setImprimir({ mapa: m, aba: 'fichas' })}>Fichas por cor</button>
                <button className="btn btn-sm" onClick={() => setImprimir({ mapa: m, aba: 'palmilha' })}>Palmilha</button>
                <button className="btn btn-sm btn-dark" onClick={() => setImprimir({ mapa: m, aba: 'tudo' })}>Imprimir tudo</button>
              </div>
            </article>
          )
        })}
      </div>

      {novo && <NovoMapa produtos={produtos} cores={cores} parceiros={parceiros} onFechar={() => setNovo(false)}
        onSalvo={async (r) => { setNovo(false); await onMudou(); const ms = await listarMapas(); setMapas(ms); const m = ms.find((x) => x.id === r.id); if (m) setImprimir({ mapa: m, aba: 'tudo' }) }} />}
      {imprimir && <ImprimirMapa mapa={imprimir.mapa} inicial={imprimir.aba} ops={opsDo(imprimir.mapa)} cores={cores} onFechar={() => setImprimir(null)} />}
    </>
  )
}
