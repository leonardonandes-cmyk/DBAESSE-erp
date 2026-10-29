import AvisoLista from '../components/AvisoLista.jsx'
import { listaDoSegmento } from '../lib/modalidades.js'
import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import Leitor from '../components/Leitor.jsx'
import { FotoProduto } from '../components/FotoProduto.jsx'
import ParceiroForm from '../components/ParceiroForm.jsx'
import { listarSaldos } from '../lib/estoque.js'
import { brl, numeroPedido, rotuloNum } from '../lib/format.js'
import { acharSku, avisar, criarIndice } from '../lib/leitura.js'
import { CANAIS, listarParceiros } from '../lib/parceiros.js'
import { carregarItens, criarPedido, listarPedidos, separarItem } from '../lib/pedidos.js'
import { listaSugerida, listarListas, precoNaLista } from '../lib/precos.js'
import { listarCores, listarProdutos } from '../lib/produtos.js'

/*
  App de vendas / expedição (celular):
  - Separar pedido: bipa cada par; risca o que já foi; apita no par errado.
  - Novo pedido bipando: escolhe o cliente e bipa os pares; já nasce separado.
  - Consultar: bipa ou busca e vê foto + saldo por número.
*/
const PARA_SEPARAR = ['aprovado', 'producao', 'separacao']

export default function AppVendas() {
  const [tela, setTela] = useState({ id: 'inicio' })
  const [produtos, setProdutos] = useState([])
  const [cores, setCores] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [parceiros, setParceiros] = useState([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    try {
      const [p, c, ped, par] = await Promise.all([listarProdutos(), listarCores(), listarPedidos(), listarParceiros()])
      setProdutos(p); setCores(c); setPedidos(ped); setParceiros(par)
    } catch (e) { setErro(e.message) } finally { setCarregando(false) }
  }
  useEffect(() => { carregar() }, [])

  const indice = useMemo(() => criarIndice(produtos, cores), [produtos, cores])
  const abertos = pedidos.filter((p) => PARA_SEPARAR.includes(p.status))
  const faltaSeparar = abertos.filter((p) => !p.separado_em)
  const voltar = () => { setTela({ id: 'inicio' }); carregar() }

  if (tela.id === 'separar') return <Separar pedido={tela.pedido} indice={indice} produtos={produtos} cores={cores} onVoltar={() => setTela({ id: 'lista' })} />
  if (tela.id === 'novo') return <NovoBipando indice={indice} parceiros={parceiros} onVoltar={voltar} />
  if (tela.id === 'consulta') return <Consulta indice={indice} produtos={produtos} cores={cores} onVoltar={voltar} />

  if (tela.id === 'lista') return (
    <div className="appv">
      <Topo titulo="Separar pedido" sub={`${faltaSeparar.length} para separar`} onVoltar={voltar} />
      {abertos.length === 0 && <p className="card-sub">Nenhum pedido aprovado para separar.</p>}
      <div className="appv-lista">
        {abertos.map((p) => {
          const pares = p.pedido_itens.reduce((t, i) => t + i.quantidade, 0)
          const sep = p.pedido_itens.reduce((t, i) => t + (i.separado || 0), 0)
          return (
            <button key={p.id} className="appv-pedido" onClick={() => setTela({ id: 'separar', pedido: p })}>
              <div>
                <b>{numeroPedido(p.numero)} · {p.parceiros?.nome || 'Sem cliente'}</b>
                <span>{p.canal} · {pares} pares</span>
              </div>
              <div className="appv-prog-mini">
                {p.separado_em ? <span className="pill ok">Separado</span> : <span className="pill neutral">{sep}/{pares}</span>}
                <Icon name="seta" size={16} />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="appv">
      <div className="appv-hero">
        <div className="eyebrow">DBAESSE · App</div>
        <h1>Vendas e expedição</h1>
      </div>
      {erro && <p className="form-error" role="alert">{erro}</p>}
      <div className="appv-acoes">
        <button className="appv-acao escuro" onClick={() => setTela({ id: 'lista' })} disabled={carregando}>
          <Icon name="leitor" size={28} />
          <b>Separar pedido</b>
          <span>{carregando ? 'Carregando…' : `${faltaSeparar.length} ${faltaSeparar.length === 1 ? 'pedido esperando' : 'pedidos esperando'}`}</span>
        </button>
        <button className="appv-acao" onClick={() => setTela({ id: 'novo' })} disabled={carregando}>
          <Icon name="mais" size={28} />
          <b>Novo pedido bipando</b>
          <span>Escolha o cliente e bipe os pares</span>
        </button>
        <button className="appv-acao" onClick={() => setTela({ id: 'consulta' })} disabled={carregando}>
          <Icon name="busca" size={28} />
          <b>Consultar estoque</b>
          <span>Bipe ou busque: foto e saldo por número</span>
        </button>
      </div>
      <p className="appv-dica">Dica: no celular, toque em <b>Compartilhar → Adicionar à tela de início</b> para usar como app.</p>
    </div>
  )
}

function Topo({ titulo, sub, onVoltar }) {
  return (
    <div className="appv-topo">
      <button className="btn icon-btn" onClick={onVoltar} aria-label="Voltar"><span style={{ transform: 'scaleX(-1)', display: 'inline-flex' }}><Icon name="seta" size={18} /></span></button>
      <div><h2>{titulo}</h2>{sub && <span>{sub}</span>}</div>
    </div>
  )
}

function Retorno({ r }) {
  if (!r) return null
  return (
    <div className={`appv-retorno ${r.ok ? 'ok' : 'bad'}`} role="status" aria-live="assertive">
      {r.item && <FotoProduto p={r.item.produto} corId={r.item.cor_id} className="sm" />}
      <div>
        <b>{r.titulo}</b>
        {r.texto && <span>{r.texto}</span>}
      </div>
    </div>
  )
}

const descr = (item) => `${item.produto.ref} · ${item.cor?.nome || ''} · nº ${item.numero}`

// ---------------- Separar pedido ----------------
function Separar({ pedido, indice, produtos, cores, onVoltar }) {
  const [itens, setItens] = useState([])
  const [retorno, setRetorno] = useState(null)
  const [historico, setHistorico] = useState([]) // sku_ids bipados, para desfazer
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => { carregarItens(pedido.id).then(setItens).catch((e) => setRetorno({ ok: false, titulo: e.message })) }, [pedido.id])

  const prodPorId = useMemo(() => Object.fromEntries(produtos.map((p) => [p.id, p])), [produtos])
  const corPorId = useMemo(() => Object.fromEntries(cores.map((c) => [c.id, c])), [cores])
  const grupos = useMemo(() => {
    const g = {}
    itens.forEach((i) => {
      const k = `${i.skus.produto_id}|${i.skus.cor_id}`
      ;(g[k] ||= { chave: k, produto: prodPorId[i.skus.produto_id], corId: i.skus.cor_id, cor: corPorId[i.skus.cor_id], itens: [] }).itens.push(i)
    })
    return Object.values(g).map((x) => ({ ...x, itens: x.itens.sort((a, b) => a.skus.numero - b.skus.numero) }))
  }, [itens, prodPorId, corPorId])
  const total = itens.reduce((t, i) => t + i.quantidade, 0)
  const feito = itens.reduce((t, i) => t + i.separado, 0)
  const completo = total > 0 && feito === total

  function aplicar(skuId, delta) {
    setItens((atual) => {
      let resto = Math.abs(delta)
      return atual.map((i) => {
        if (i.sku_id !== skuId || !resto) return i
        if (delta > 0 && i.separado < i.quantidade) { resto--; return { ...i, separado: i.separado + 1 } }
        if (delta < 0 && i.separado > 0) { resto--; return { ...i, separado: i.separado - 1 } }
        return i
      })
    })
  }

  async function bipou(codigo) {
    if (ocupado) return
    const item = acharSku(indice, codigo)
    if (!item) { avisar(false); setRetorno({ ok: false, titulo: 'Código não cadastrado', texto: codigo }); return }
    setOcupado(true)
    try {
      const r = await separarItem(pedido.id, item.id, 1)
      aplicar(item.id, 1)
      setHistorico((h) => [...h, item])
      avisar(true)
      setRetorno({ ok: true, item, titulo: descr(item), texto: r.falta_pedido === 0 ? 'Pedido completo!' : `${r.separado} de ${r.quantidade} deste número · faltam ${r.falta_pedido} no pedido` })
    } catch (e) {
      avisar(false)
      setRetorno({ ok: false, item, titulo: e.message, texto: descr(item) })
    } finally { setOcupado(false) }
  }

  async function desfazer() {
    const item = historico[historico.length - 1]
    if (!item) return
    try {
      await separarItem(pedido.id, item.id, -1)
      aplicar(item.id, -1)
      setHistorico((h) => h.slice(0, -1))
      setRetorno({ ok: true, item, titulo: 'Desfeito', texto: descr(item) })
    } catch (e) { setRetorno({ ok: false, titulo: e.message }) }
  }

  return (
    <div className="appv">
      <Topo titulo={`${numeroPedido(pedido.numero)} · ${pedido.parceiros?.nome || 'Sem cliente'}`} sub={`${feito} de ${total} pares separados`} onVoltar={onVoltar} />
      <div className="appv-prog" aria-hidden="true"><i style={{ width: `${total ? (feito / total) * 100 : 0}%` }} /></div>

      {completo
        ? <div className="appv-retorno ok grande"><Icon name="leitor" size={26} /><div><b>Pedido separado</b><span>Já pode faturar no sistema.</span></div></div>
        : <Leitor onCodigo={bipou} rotulo="Bipar par" />}
      <Retorno r={retorno} />
      {historico.length > 0 && !completo && <button className="link-btn" onClick={desfazer}>Desfazer último</button>}

      <div className="appv-itens">
        {grupos.map((g) => {
          const qt = g.itens.reduce((t, i) => t + i.quantidade, 0)
          const sp = g.itens.reduce((t, i) => t + i.separado, 0)
          return (
            <div key={g.chave} className={`appv-item ${sp === qt ? 'feito' : ''}`}>
              <FotoProduto p={g.produto} corId={g.corId} />
              <div className="appv-item-info">
                <b>{g.produto?.ref} · {g.produto?.nome}</b>
                <span><i className="dot-cor" style={{ background: g.cor?.hex || '#ddd' }} />{g.cor?.nome} · {sp}/{qt}</span>
                <div className="appv-nums">
                  {g.itens.map((i) => (
                    <span key={i.id} className={i.separado === i.quantidade ? 'ok' : i.separado > 0 ? 'meio' : ''}>
                      <small>{rotuloNum(i.skus.numero)}</small>{i.separado}/{i.quantidade}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------- Novo pedido bipando ----------------
function NovoBipando({ indice, parceiros: parceirosBase, onVoltar }) {
  const [novos, setNovos] = useState([])
  const [cadastrar, setCadastrar] = useState(false)
  const parceiros = [...novos, ...parceirosBase]
  const clientes = parceiros.filter((p) => p.ativo && p.tipos.some((t) => t === 'cliente' || t === 'revendedora'))
  const [cliente, setCliente] = useState('')
  const [canal, setCanal] = useState('Atacado')
  const [listas, setListas] = useState([])
  const [codLista, setCodLista] = useState('atacado')
  const [avisoLista, setAvisoLista] = useState(null)
  useEffect(() => { listarListas().then(setListas).catch(() => {}) }, [])
  const listaPreco = listas.find((l) => l.codigo === codLista)
  const preco = (p) => precoNaLista(p, listaPreco)
  const [lista, setLista] = useState([]) // { item, quantidade }
  const [retorno, setRetorno] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [criado, setCriado] = useState(null)

  function escolherCliente(id) {
    setCliente(id)
    const c = parceiros.find((p) => p.id === id)
    const novoCanal = c?.canal || canal
    setCanal(novoCanal)
    setCodLista(listaSugerida(c, novoCanal))
  }

  function bipou(codigo) {
    const item = acharSku(indice, codigo)
    if (!item) { avisar(false); setRetorno({ ok: false, titulo: 'Código não cadastrado', texto: codigo }); return }
    avisar(true)
    setLista((l) => {
      const i = l.findIndex((x) => x.item.id === item.id)
      if (i < 0) return [{ item, quantidade: 1 }, ...l]
      const n = [...l]; n[i] = { ...n[i], quantidade: n[i].quantidade + 1 }; return n
    })
    setRetorno({ ok: true, item, titulo: descr(item), texto: 'Adicionado' })
  }
  const mudar = (id, d) => setLista((l) => l.map((x) => (x.item.id === id ? { ...x, quantidade: x.quantidade + d } : x)).filter((x) => x.quantidade > 0))

  const pares = lista.reduce((t, x) => t + x.quantidade, 0)
  const valor = lista.reduce((t, x) => t + x.quantidade * preco(x.item.produto), 0)

  async function salvar() {
    setSalvando(true)
    try {
      const ped = await criarPedido({
        parceiro_id: cliente, canal, lista: codLista, status: 'separacao', separado: true,
        observacoes: 'Pedido montado no app (bipado)',
        itens: lista.map((x) => ({ sku_id: x.item.id, quantidade: x.quantidade, preco_unit: preco(x.item.produto) })),
      })
      setCriado(ped)
    } catch (e) { setRetorno({ ok: false, titulo: e.message }); setSalvando(false) }
  }

  if (criado) return (
    <div className="appv">
      <div className="appv-retorno ok grande"><Icon name="pedidos" size={26} /><div><b>{numeroPedido(criado.numero)} criado</b><span>{pares} pares · {brl(valor)} · já separado</span></div></div>
      <button className="btn btn-dark appv-full" onClick={onVoltar}>Voltar ao início</button>
    </div>
  )

  return (
    <div className="appv">
      <Topo titulo="Novo pedido" sub={`${pares} pares · ${brl(valor)}`} onVoltar={onVoltar} />
      <div className="appv-campos">
        <label className="field"><span style={{ display: 'flex', justifyContent: 'space-between' }}>Cliente <button type="button" className="link-btn" onClick={() => setCadastrar(true)}>+ Novo</button></span>
          <select className="input" value={cliente} onChange={(e) => escolherCliente(e.target.value)}>
            <option value="">Escolha o cliente…</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label className="field"><span>Canal</span>
          <select className="input" value={canal} onChange={(e) => { setCanal(e.target.value); setCodLista(listaSugerida(parceiros.find((p) => p.id === cliente), e.target.value)) }}>
            {CANAIS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="field"><span>Lista de preço</span>
          <select className="input" value={codLista} onChange={(e) => (e.target.value !== listaDoSegmento(canal) ? setAvisoLista(e.target.value) : setCodLista(e.target.value))}>
            {listas.map((l) => <option key={l.codigo} value={l.codigo}>{l.nome}</option>)}
          </select>
        </label>
      </div>
      {avisoLista && (
        <AvisoLista canal={canal} escolhida={avisoLista} esperada={listaDoSegmento(canal)} listas={listas}
          onVoltar={() => { setAvisoLista(null); setCodLista(listaDoSegmento(canal)) }}
          onSeguir={() => { setCodLista(avisoLista); setAvisoLista(null) }} />
      )}
      {cadastrar && (
        <ParceiroForm tipoInicial="cliente" onFechar={() => setCadastrar(false)}
          onSalvo={(novo) => {
            setCadastrar(false)
            if (!novo?.id) return
            setNovos((n) => [novo, ...n]); setCliente(novo.id)
            const c = novo.canal || canal; setCanal(c); setCodLista(listaSugerida(novo, c))
          }} />
      )}
      <Leitor onCodigo={bipou} rotulo="Bipar par" />
      <Retorno r={retorno} />
      <div className="appv-itens">
        {lista.map(({ item, quantidade }) => (
          <div key={item.id} className="appv-item">
            <FotoProduto p={item.produto} corId={item.cor_id} />
            <div className="appv-item-info">
              <b>{item.produto.ref} · {item.produto.nome}</b>
              <span><i className="dot-cor" style={{ background: item.cor?.hex || '#ddd' }} />{item.cor?.nome} · nº {item.numero}</span>
              <span>{brl(preco(item.produto))} o par</span>
            </div>
            <div className="appv-qtd">
              <button className="btn icon-btn" onClick={() => mudar(item.id, -1)} aria-label="Menos um">−</button>
              <b>{quantidade}</b>
              <button className="btn icon-btn" onClick={() => mudar(item.id, 1)} aria-label="Mais um">+</button>
            </div>
          </div>
        ))}
      </div>
      <div className="appv-rodape">
        <div><b>{pares} pares</b><span>{brl(valor)}</span></div>
        <button className="btn btn-dark" disabled={!cliente || !pares || salvando} onClick={salvar}>{salvando ? 'Salvando…' : !cliente ? 'Escolha o cliente' : 'Salvar pedido'}</button>
      </div>
    </div>
  )
}

// ---------------- Consultar estoque ----------------
function Consulta({ indice, produtos, cores, onVoltar }) {
  const [saldos, setSaldos] = useState({})
  const [achado, setAchado] = useState(null) // { produto, corId, numero? }
  const [busca, setBusca] = useState('')
  const [retorno, setRetorno] = useState(null)
  useEffect(() => { listarSaldos().then((s) => setSaldos(Object.fromEntries(s.map((x) => [x.sku_id, x])))).catch(() => {}) }, [])
  const corPorId = useMemo(() => Object.fromEntries(cores.map((c) => [c.id, c])), [cores])

  function bipou(codigo) {
    const item = acharSku(indice, codigo)
    if (!item) { avisar(false); setRetorno({ ok: false, titulo: 'Código não cadastrado', texto: codigo }); return }
    avisar(true); setRetorno(null)
    setAchado({ produto: item.produto, corId: item.cor_id, numero: item.numero })
  }

  const q = busca.trim().toLowerCase()
  const resultados = q.length < 2 ? [] : produtos.filter((p) => `${p.ref} ${p.nome}`.toLowerCase().includes(q)).slice(0, 8)

  const skusCor = achado ? achado.produto.skus.filter((s) => s.cor_id === achado.corId).sort((a, b) => a.numero - b.numero) : []
  const coresDoProd = achado ? [...new Set(achado.produto.skus.map((s) => s.cor_id))] : []

  return (
    <div className="appv">
      <Topo titulo="Consultar estoque" onVoltar={onVoltar} />
      <Leitor onCodigo={bipou} rotulo="Bipar produto" />
      <label className="search"><Icon name="busca" size={16} /><input type="search" placeholder="ou busque por REF / nome" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
      {resultados.length > 0 && (
        <div className="appv-lista">
          {resultados.map((p) => (
            <button key={p.id} className="appv-pedido" onClick={() => { setAchado({ produto: p, corId: p.skus[0]?.cor_id }); setBusca('') }}>
              <div className="prod-cell"><FotoProduto p={p} className="sm" /><div><b>{p.ref} · {p.nome}</b><span>{p.tipo}</span></div></div>
            </button>
          ))}
        </div>
      )}
      <Retorno r={retorno} />
      {achado && (
        <div className="appv-consulta">
          <FotoProduto key={achado.corId} p={achado.produto} corId={achado.corId} className="xl" size={64} />
          <div className="eyebrow">REF {achado.produto.ref} · {achado.produto.tipo}</div>
          <h2>{achado.produto.nome}</h2>
          <div className="chips">
            {coresDoProd.map((id) => (
              <button key={id} className={`color-tag ${id === achado.corId ? 'on' : ''}`} onClick={() => setAchado({ ...achado, corId: id, numero: null })}>
                <span className="dot" style={{ background: corPorId[id]?.hex || '#ddd' }} />{corPorId[id]?.nome}
              </button>
            ))}
          </div>
          <div className="appv-grade">
            {skusCor.map((s) => {
              const x = saldos[s.id]
              return (
                <div key={s.id} className={s.numero === achado.numero ? 'on' : ''}>
                  <small>{rotuloNum(s.numero)}</small>
                  <b>{x?.saldo ?? 0}</b>
                  <span>B {x?.saldo_bulk ?? 0} · P {x?.saldo_pick ?? 0}</span>
                </div>
              )
            })}
          </div>
          <p className="card-sub" style={{ margin: 0 }}>Atacado {brl(achado.produto.preco_atacado)} · Varejo {brl(achado.produto.preco_varejo)}</p>
        </div>
      )}
    </div>
  )
}

