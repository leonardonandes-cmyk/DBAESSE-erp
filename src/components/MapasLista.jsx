import { useEffect, useState } from 'react'
import { FotoProduto } from './FotoProduto.jsx'
import ImprimirMapa from './ImprimirMapa.jsx'
import Icon from './Icon.jsx'
import { dataBR, inteiro } from '../lib/format.js'
import { listarMapas, numeroMapa, situacaoMapa } from '../lib/mapas.js'
import { OP_ABERTAS, paresOP } from '../lib/producao.js'

/* Mapas de programação: lista, novo mapa e impressão (mapa geral · fichas por cor · palmilha) */
export default function MapasLista({ ops, cores, versao, onNovo }) {
  const [mapas, setMapas] = useState(null)
  const [imprimir, setImprimir] = useState(null) // { mapa, aba }
  const [erro, setErro] = useState('')

  async function carregar() {
    try { setMapas(await listarMapas()) } catch (e) { setErro(e.message) }
  }
  useEffect(() => { carregar() }, [versao])

  const opsDo = (m) => ops.filter((o) => o.programacao_id === m.id)

  return (
    <>
      <div className="mapas-topo">
        <p className="card-sub" style={{ margin: 0 }}>Monte o mapa como na planilha: pedido, cliente, marca e datas + as referências com cores e grade. Cada cor vira uma OP, e daqui saem o <b>mapa geral</b>, as <b>fichas por cor</b> e a <b>relação de palmilha</b> para imprimir.</p>
        <button className="btn btn-dark" onClick={onNovo}><Icon name="mais" size={16} stroke={2} />Nova programação</button>
      </div>
      {erro && <p className="form-error" role="alert">{erro}</p>}
      {mapas && (() => {
        const sits = mapas.map((m) => situacaoMapa(m, ops))
        const atras = sits.filter((x) => x.id === 'atrasado').length
        const abertos = sits.filter((x) => ['producao', 'vence', 'atrasado'].includes(x.id)).length
        return atras ? <div className="aviso-forte">⚠ {atras} {atras === 1 ? 'mapa ATRASADO' : 'mapas ATRASADOS'} — passou da previsão de entrega e ainda tem ficha em produção</div>
          : abertos ? <div className="aviso-leve">{abertos} {abertos === 1 ? 'mapa em produção' : 'mapas em produção'} — ainda não finalizados</div> : null
      })()}
      {!mapas && <p className="card-sub">Carregando…</p>}
      {mapas && mapas.length === 0 && (
        <section className="card empty"><h2>Nenhuma programação ainda</h2><p>Crie a primeira programação — as OPs, o mapa geral e as folhas de corte saem dela.</p><button className="btn btn-dark" onClick={onNovo}>Nova programação</button></section>
      )}
      <div className="mapas-grade">
        {mapas?.map((m) => {
          const os = opsDo(m)
          const pares = os.reduce((t, o) => t + paresOP(o), 0)
          const abertas = os.filter((o) => OP_ABERTAS.includes(o.status)).length
          const concl = os.filter((o) => o.status === 'concluida').length
          const refs = [...new Map(os.map((o) => [o.produto_id, o.produtos])).values()]
          return (
            <article key={m.id} className={`card mapa-card sit-${situacaoMapa(m, ops).id}`}>
              <FaixaMapa sit={situacaoMapa(m, ops)} />
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

      {imprimir && <ImprimirMapa mapa={imprimir.mapa} inicial={imprimir.aba} ops={opsDo(imprimir.mapa)} cores={cores} onFechar={() => setImprimir(null)} />}
    </>
  )
}

function FaixaMapa({ sit }) {
  if (sit.id === 'vazio') return null
  if (sit.id === 'finalizado') return <div className="mapa-faixa ok">✓ Mapa finalizado · {sit.total} {sit.total === 1 ? 'ficha concluída' : 'fichas concluídas'}</div>
  if (sit.id === 'atrasado') return <div className="mapa-faixa atrasado">⚠ ATRASADO há {Math.abs(sit.dias)} {Math.abs(sit.dias) === 1 ? 'dia' : 'dias'} · {sit.abertas} de {sit.total} fichas ainda em produção</div>
  if (sit.id === 'vence') return <div className="mapa-faixa vence">⏳ {sit.dias === 0 ? 'Vence HOJE' : `Vence em ${sit.dias} ${sit.dias === 1 ? 'dia' : 'dias'}`} · faltam {sit.abertas} de {sit.total} fichas</div>
  return <div className="mapa-faixa producao">Em produção · faltam {sit.abertas} de {sit.total} fichas{sit.dias != null ? ` · entrega em ${sit.dias} ${sit.dias === 1 ? 'dia' : 'dias'}` : ''}</div>
}
