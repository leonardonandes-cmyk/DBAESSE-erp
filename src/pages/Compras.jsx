import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import CompraForm from '../components/CompraForm.jsx'
import MaterialForm from '../components/MaterialForm.jsx'
import TituloForm from '../components/TituloForm.jsx'
import { STATUS_COMPRA, TIPOS_MAT, UN_CURTA, calcularNecessidade, fmtQtd, listarCompras, listarFichaConsumo, listarMateriais, listarSaldosMateriais,
  movimentarMaterial, mudarStatusCompra, numeroCompra, saldoMaterial, totalCompra } from '../lib/compras.js'
import { brl, dataBR, hojeISO } from '../lib/format.js'
import { listarParceiros } from '../lib/parceiros.js'
import { listarOPs } from '../lib/producao.js'

const ABAS = [{ id: 'necessidade', label: 'Necessidade' }, { id: 'compras', label: 'Pedidos de compra' }, { id: 'materiais', label: 'Materiais' }]

export default function Compras() {
  const [buscaMat, setBuscaMat] = useState('')
  const [tipoMat, setTipoMat] = useState('material')
  const [aba, setAba] = useState('necessidade')
  const [materiais, setMateriais] = useState([])
  const [saldos, setSaldos] = useState([])
  const [compras, setCompras] = useState([])
  const [parceiros, setParceiros] = useState([])
  const [ops, setOps] = useState([])
  const [ficha, setFicha] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [modal, setModal] = useState(null) // {tipo:'material'|'compra'|'mov'|'detalhe'|'conta', ...}

  async function carregar() {
    try {
      const [m, s, c, p, o, f] = await Promise.all([listarMateriais(), listarSaldosMateriais(), listarCompras(), listarParceiros(), listarOPs(), listarFichaConsumo()])
      setMateriais(m); setSaldos(s); setCompras(c); setParceiros(p); setOps(o); setFicha(f)
      return c
    } catch (e) { setErro(e.message) } finally { setCarregando(false) }
  }
  useEffect(() => { carregar() }, [])

  const fornecedores = parceiros.filter((p) => p.ativo && p.tipos.includes('fornecedor'))
  const necessidade = useMemo(() => calcularNecessidade({ ops, ficha, materiais, saldos, compras }), [ops, ficha, materiais, saldos, compras])
  const faltando = necessidade.filter((n) => n.falta > 0)
  const opsSemFicha = useMemo(() => {
    const comFicha = new Set(ficha.map((f) => f.produto_id))
    return ops.filter((o) => ['aberta', 'em_producao'].includes(o.status) && !comFicha.has(o.produto_id))
  }, [ops, ficha])
  const abaixoMin = materiais.filter((m) => m.ativo && m.estoque_minimo != null && saldoMaterial(saldos, m.id) < Number(m.estoque_minimo))
  const enviadas = compras.filter((c) => c.status === 'enviado')

  // faltas agrupadas por fornecedor: um pedido de compra para cada
  const gruposFalta = useMemo(() => {
    const g = {}
    faltando.forEach((n) => {
      const k = n.material.fornecedor_id || ''
      ;(g[k] ||= { fornecedor: k, nome: n.material.parceiros?.nome || 'Sem fornecedor', itens: [] }).itens.push({ material: n.material, numero: n.numero, quantidade: n.falta })
    })
    return Object.values(g)
  }, [faltando])

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Matéria-prima e insumos</div>
          <h1>Compras</h1>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setModal({ tipo: 'material' })}>Novo material</button>
          <button className="btn btn-dark" onClick={() => setModal({ tipo: 'compra' })}><Icon name="mais" size={16} stroke={2} />Pedido de compra</button>
        </div>
      </header>

      {erro && <p className="form-error" role="alert">{erro}</p>}

      <section className="grid-kpi">
        <div className="card kpi"><span className="kpi-label">Materiais faltando</span><span className="kpi-value" style={faltando.length ? { color: 'var(--bad)' } : undefined}>{faltando.length}</span><span className="kpi-note">para as OPs em aberto</span></div>
        <div className="card kpi"><span className="kpi-label">Abaixo do mínimo</span><span className="kpi-value" style={abaixoMin.length ? { color: 'var(--accent)' } : undefined}>{abaixoMin.length}</span></div>
        <div className="card kpi"><span className="kpi-label">Compras a receber</span><span className="kpi-value">{enviadas.length}</span><span className="kpi-note">{brl(enviadas.reduce((t, c) => t + totalCompra(c), 0))}</span></div>
        <div className="card kpi"><span className="kpi-label">Materiais cadastrados</span><span className="kpi-value">{materiais.filter((m) => m.ativo).length}</span></div>
      </section>

      <div className="segmented" style={{ alignSelf: 'flex-start' }}>
        {ABAS.map((a) => <button key={a.id} className={aba === a.id ? 'on' : ''} onClick={() => setAba(a.id)}>{a.label}</button>)}
      </div>

      {aba === 'necessidade' && (
        <section className="card card-flush">
          <div className="card-head" style={{ padding: '18px 20px', margin: 0, borderBottom: '1px solid var(--line-soft)' }}>
            <div><h2>Consumo das ordens em aberto</h2><div className="card-sub">Ficha de consumo × pares das OPs, menos o estoque e o que já foi pedido ao fornecedor</div></div>
            {gruposFalta.length > 0 && (
              <div className="chips">
                {gruposFalta.map((g) => (
                  <button key={g.fornecedor} className="btn btn-dark btn-sm" onClick={() => setModal({ tipo: 'compra', inicial: g.itens, fornecedor: g.fornecedor })}>
                    Comprar · {g.nome} ({g.itens.length})
                  </button>
                ))}
              </div>
            )}
          </div>
          {opsSemFicha.length > 0 && (
            <div className="preview" style={{ margin: 16 }}>
              {opsSemFicha.length} OP(s) de modelos <b>sem ficha de consumo</b> ({[...new Set(opsSemFicha.map((o) => o.produtos?.ref))].join(', ')}). Monte a ficha em Produtos → Ficha técnica para entrarem no cálculo.
            </div>
          )}
          <div className="table-wrap">
            <table style={{ minWidth: 640 }}>
              <thead className="tinted"><tr><th>Material</th><th>Nº</th><th className="r">Necessário</th><th className="r">Em estoque</th><th className="r">Já pedido</th><th className="r">Comprar</th></tr></thead>
              <tbody>
                {carregando && <tr><td colSpan={6} style={{ color: 'var(--muted)', padding: 32 }}>Carregando…</td></tr>}
                {necessidade.map((n) => (
                  <tr key={`${n.material_id}|${n.numero}`}>
                    <td><b style={{ fontWeight: 600 }}>{n.material.nome}</b><br /><span className="card-sub">{n.material.parceiros?.nome || 'sem fornecedor'}</span></td>
                    <td>{n.numero ?? '—'}</td>
                    <td className="r">{fmtQtd(n.necessario)} {UN_CURTA[n.material.unidade]}</td>
                    <td className="r" style={{ color: n.saldo < 0 ? 'var(--bad)' : undefined }}>{fmtQtd(n.saldo)}</td>
                    <td className="r" style={{ color: 'var(--muted)' }}>{n.emCompra ? fmtQtd(n.emCompra) : '—'}</td>
                    <td className="r" style={{ fontWeight: 700, color: n.falta > 0 ? 'var(--bad)' : 'var(--ok)' }}>{n.falta > 0 ? fmtQtd(n.falta) : 'OK'}</td>
                  </tr>
                ))}
                {!carregando && necessidade.length === 0 && (
                  <tr><td colSpan={6} style={{ color: 'var(--muted)', padding: 32 }}>Nada a calcular: não há OPs em aberto com ficha de consumo.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {aba === 'compras' && (
        <section className="card card-flush">
          <div className="table-wrap">
            <table style={{ minWidth: 640 }}>
              <thead className="tinted"><tr><th>Pedido</th><th>Fornecedor</th><th className="r">Itens</th><th className="r">Valor</th><th>Situação</th><th className="r">Previsão</th></tr></thead>
              <tbody>
                {compras.map((c) => {
                  const st = STATUS_COMPRA[c.status]
                  return (
                    <tr key={c.id} className="clickable" onClick={() => setModal({ tipo: 'detalhe', compra: c })}>
                      <td><b>{numeroCompra(c.numero)}</b></td>
                      <td>{c.parceiros?.nome || '—'}</td>
                      <td className="r">{c.compra_itens.length}</td>
                      <td className="r">{brl(totalCompra(c))}</td>
                      <td><span className={`pill ${st.tom}`}>{st.label}</span></td>
                      <td className="r" style={{ color: 'var(--muted)' }}>{dataBR(c.previsao)}</td>
                    </tr>
                  )
                })}
                {!carregando && compras.length === 0 && <tr><td colSpan={6} style={{ color: 'var(--muted)', padding: 32 }}>Nenhum pedido de compra ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {aba === 'materiais' && (
        <div className="actions">
          <label className="search">
            <Icon name="busca" size={16} />
            <input type="search" placeholder="Buscar material" value={buscaMat} onChange={(e) => setBuscaMat(e.target.value)} aria-label="Buscar material" />
          </label>
          <div className="chips">
            {[['', 'Todos'], ...Object.entries(TIPOS_MAT).map(([k, t]) => [k, t.label])].map(([k, l]) => (
              <button key={k} className={`chip ${tipoMat === k ? 'on' : ''}`} onClick={() => setTipoMat(k)}>{l} · {materiais.filter((m) => !k || (m.tipo || 'material') === k).length}</button>
            ))}
          </div>
        </div>
      )}
      {aba === 'materiais' && (
        <section className="card card-flush">
          <div className="table-wrap">
            <table style={{ minWidth: 720 }}>
              <thead className="tinted"><tr><th>Material</th><th>Categoria</th><th className="r">Saldo</th><th className="r">Mínimo</th><th className="r">Custo</th><th>Fornecedor</th><th /></tr></thead>
              <tbody>
                {materiais.filter((m) => (!tipoMat || (m.tipo || 'material') === tipoMat) && (!buscaMat.trim() || m.nome.toLowerCase().includes(buscaMat.trim().toLowerCase()))).map((m) => {
                  const ehMat = (m.tipo || 'material') === 'material'
                  const s = saldoMaterial(saldos, m.id)
                  const baixo = m.estoque_minimo != null && s < Number(m.estoque_minimo)
                  return (
                    <tr key={m.id} style={m.ativo ? undefined : { opacity: 0.5 }}>
                      <td className="clickable" onClick={() => setModal({ tipo: 'material', material: m })}><b style={{ fontWeight: 600 }}>{m.nome}</b>{m.por_numero && <span className="card-sub"> · por nº</span>}</td>
                      <td style={{ color: 'var(--muted)' }}>{m.categoria || '—'}{!ehMat && <span className="pill neutral" style={{ marginLeft: 6 }}>{TIPOS_MAT[m.tipo]?.label}</span>}</td>
                      <td className="r" style={{ fontWeight: 700, color: s < 0 ? 'var(--bad)' : baixo ? 'var(--accent)' : 'var(--ink)' }}>{ehMat ? `${fmtQtd(s)} ${UN_CURTA[m.unidade]}` : '—'}</td>
                      <td className="r" style={{ color: 'var(--muted)' }}>{m.estoque_minimo != null ? fmtQtd(m.estoque_minimo) : '—'}</td>
                      <td className="r">{m.custo != null ? brl(m.custo) : '—'}<small style={{ color: 'var(--faint)' }}> /{UN_CURTA[m.unidade]}</small></td>
                      <td>{m.parceiros?.nome || '—'}</td>
                      <td className="r" style={{ whiteSpace: 'nowrap' }}>
                        {ehMat && <button className="btn btn-sm" onClick={() => setModal({ tipo: 'mov', material: m })}>Entrada / ajuste</button>}
                      </td>
                    </tr>
                  )
                })}
                {!carregando && materiais.length === 0 && (
                  <tr><td colSpan={7} style={{ color: 'var(--muted)', padding: 32 }}>Cadastre os materiais (sintético, forro, solado por número, palmilha, linha, cola, caixa…). Depois monte a ficha de consumo de cada modelo em Produtos.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {modal?.tipo === 'material' && <MaterialForm material={modal.material} fornecedores={fornecedores} onFechar={() => setModal(null)} onSalvo={() => { setModal(null); carregar() }} />}
      {modal?.tipo === 'compra' && (
        <CompraForm materiais={materiais} fornecedores={fornecedores} inicial={modal.inicial} fornecedorInicial={modal.fornecedor}
          onFechar={() => setModal(null)} onSalvo={() => { setModal(null); setAba('compras'); carregar() }} />
      )}
      {modal?.tipo === 'mov' && <MovMaterial material={modal.material} saldos={saldos} onFechar={() => setModal(null)} onSalvo={() => { setModal(null); carregar() }} />}
      {modal?.tipo === 'detalhe' && (
        <CompraDetalhe compra={modal.compra} onFechar={() => setModal(null)}
          onConta={(c) => setModal({ tipo: 'conta', compra: c })}
          onMudou={async () => { const l = await carregar(); setModal((m) => (m ? { ...m, compra: l?.find((x) => x.id === m.compra.id) || m.compra } : m)) }} />
      )}
      {modal?.tipo === 'conta' && (
        <TituloForm parceiros={parceiros}
          padrao={{ tipo: 'pagar', descricao: `Compra ${numeroCompra(modal.compra.numero)}`, parceiro_id: modal.compra.fornecedor_id, valorTotal: totalCompra(modal.compra).toFixed(2), categoria: 'Material', primeiroVencimento: hojeISO() }}
          onFechar={() => setModal(null)} onSalvo={() => setModal(null)} />
      )}
    </>
  )
}

function MovMaterial({ material, saldos, onFechar, onSalvo }) {
  const [f, setF] = useState({ tipo: 'entrada', numero: '', quantidade: '', observacao: '' })
  const [erro, setErro] = useState('')
  const saldoAtual = saldoMaterial(saldos, material.id, material.por_numero && f.numero !== '' ? Number(f.numero) : null)
  async function salvar(e) {
    e.preventDefault(); setErro('')
    let q = Number(String(f.quantidade).replace(',', '.'))
    if (!q) return setErro('Informe a quantidade.')
    if (material.por_numero && f.numero === '') return setErro('Informe o número.')
    if (f.tipo === 'contagem') { q = q - saldoAtual; if (!q) return setErro('A contagem é igual ao saldo.') }
    try {
      await movimentarMaterial([{ material_id: material.id, numero: material.por_numero ? Number(f.numero) : null,
        tipo: f.tipo === 'contagem' ? 'ajuste' : f.tipo, quantidade: Math.round(q * 1000) / 1000, motivo: f.tipo === 'contagem' ? 'inventario' : f.tipo === 'entrada' ? 'compra' : 'uso', observacao: f.observacao || null }])
      onSalvo()
    } catch (e2) { setErro(e2.message) }
  }
  return (
    <div className="modal-bg" onClick={onFechar}>
      <form className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()} onSubmit={salvar}>
        <div className="modal-head">
          <div><div className="eyebrow">Estoque de material</div><h2>{material.nome}</h2></div>
          <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
        </div>
        <div className="segmented" style={{ alignSelf: 'flex-start' }}>
          {[['entrada', 'Entrada'], ['saida', 'Saída'], ['contagem', 'Contagem']].map(([v, l]) => (
            <button type="button" key={v} className={f.tipo === v ? 'on' : ''} onClick={() => setF({ ...f, tipo: v })}>{l}</button>
          ))}
        </div>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {material.por_numero && <label className="field"><span>Número</span><input type="number" value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} /></label>}
          <label className="field"><span>{f.tipo === 'contagem' ? `Contado (${UN_CURTA[material.unidade]})` : `Quantidade (${UN_CURTA[material.unidade]})`}</span><input inputMode="decimal" value={f.quantidade} onChange={(e) => setF({ ...f, quantidade: e.target.value })} /></label>
          <label className="field span-3"><span>Observação</span><input value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} /></label>
        </div>
        <p className="card-sub" style={{ margin: 0 }}>Saldo atual{material.por_numero && f.numero !== '' ? ` do nº ${f.numero}` : ''}: <b>{fmtQtd(saldoAtual)} {UN_CURTA[material.unidade]}</b></p>
        {erro && <p className="form-error" role="alert">{erro}</p>}
        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="btn btn-dark">Lançar</button>
        </div>
      </form>
    </div>
  )
}

function CompraDetalhe({ compra, onFechar, onMudou, onConta }) {
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const st = STATUS_COMPRA[compra.status]
  async function acao(status, msg) {
    if (msg && !window.confirm(msg)) return
    setErro(''); setOcupado(true)
    try { await mudarStatusCompra(compra.id, status); await onMudou() } catch (e) { setErro(e.message) } finally { setOcupado(false) }
  }
  function copiar() {
    const txt = [`*Pedido de compra ${numeroCompra(compra.numero)}* · DBAESSE`,
      ...compra.compra_itens.map((i) => `• ${i.materiais?.nome}${i.numero ? ` nº ${i.numero}` : ''}: ${fmtQtd(i.quantidade)} ${UN_CURTA[i.materiais?.unidade] || ''}`),
      compra.previsao ? `Entrega: ${dataBR(compra.previsao)}` : null].filter(Boolean).join('\n')
    navigator.clipboard?.writeText(txt)
  }
  return (
    <div className="modal-bg" onClick={onFechar}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">Criado em {dataBR(compra.criado_em)}{compra.recebido_em ? ` · recebido em ${dataBR(compra.recebido_em)}` : ''}</div>
            <h2>{numeroCompra(compra.numero)} · {compra.parceiros?.nome || 'Sem fornecedor'}</h2>
            <div className="chips" style={{ marginTop: 8 }}><span className={`pill ${st.tom}`}>{st.label}</span></div>
          </div>
          <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Material</th><th>Nº</th><th className="r">Qtd</th><th className="r">Custo</th><th className="r">Subtotal</th></tr></thead>
            <tbody>
              {compra.compra_itens.map((i) => (
                <tr key={i.id}>
                  <td>{i.materiais?.nome}</td><td>{i.numero ?? '—'}</td>
                  <td className="r">{fmtQtd(i.quantidade)} {UN_CURTA[i.materiais?.unidade]}</td>
                  <td className="r">{brl(i.custo_unit)}</td><td className="r">{brl(Number(i.quantidade) * Number(i.custo_unit))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {compra.observacao && <p className="card-sub" style={{ margin: 0 }}>{compra.observacao}</p>}
        {erro && <p className="form-error" role="alert">{erro}</p>}
        <div className="pedido-rodape">
          <div className="pedido-totais"><b>{brl(totalCompra(compra))}</b></div>
          <div className="actions">
            <button className="btn" onClick={copiar}>Copiar p/ WhatsApp</button>
            <button className="btn" onClick={() => onConta(compra)}>Lançar conta a pagar</button>
            {['rascunho', 'enviado'].includes(compra.status) && <button className="btn btn-perigo" disabled={ocupado} onClick={() => acao('cancelado', 'Cancelar este pedido de compra?')}>Cancelar</button>}
            {compra.status === 'rascunho' && <button className="btn btn-dark" disabled={ocupado} onClick={() => acao('enviado')}>Marcar como enviado</button>}
            {['rascunho', 'enviado'].includes(compra.status) && (
              <button className="btn btn-dark" disabled={ocupado} onClick={() => acao('recebido', 'Confirmar o recebimento? Os materiais entram no estoque e o custo é atualizado.')}>Receber · entrar no estoque</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
