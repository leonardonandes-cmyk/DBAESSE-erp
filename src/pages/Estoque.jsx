import { useEffect, useMemo, useState } from 'react'
import ProdutoCelula, { FotoProduto } from '../components/FotoProduto.jsx'
import Icon from '../components/Icon.jsx'
import MovimentoModal from '../components/MovimentoModal.jsx'
import { LOCAIS, listarSaldos, saldoPorSku, ultimosMovimentos } from '../lib/estoque.js'
import { dataHoraBR, inteiro, rotuloNum } from '../lib/format.js'
import { listarCores, listarProdutos } from '../lib/produtos.js'

const TIPO_MOV = {
  entrada: { label: 'Entrada', tom: 'ok' },
  saida: { label: 'Saída', tom: 'warn' },
  ajuste: { label: 'Ajuste', tom: 'neutral' },
}
const MOTIVO = { producao: 'Produção', venda: 'Venda', inventario: 'Inventário', cancelamento: 'Pedido cancelado', replenishment: 'Replenishment' }

export default function Estoque() {
  const [produtos, setProdutos] = useState([])
  const [cores, setCores] = useState([])
  const [saldos, setSaldos] = useState([])
  const [movs, setMovs] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [soComSaldo, setSoComSaldo] = useState(false)
  const [vista, setVista] = useState('') // '' = total · 'bulk' · 'pick'
  const [modal, setModal] = useState(null)

  async function carregar() {
    try {
      const [p, c, s, m] = await Promise.all([listarProdutos(), listarCores(), listarSaldos(), ultimosMovimentos()])
      setProdutos(p); setCores(c); setSaldos(s); setMovs(m)
    } catch (e) { setErro(e.message) } finally { setCarregando(false) }
  }
  useEffect(() => { carregar() }, [])

  const mapaSaldo = useMemo(() => saldoPorSku(saldos, vista || undefined), [saldos, vista])
  const mapas = useMemo(() => ({ total: saldoPorSku(saldos), bulk: saldoPorSku(saldos, 'bulk'), pick: saldoPorSku(saldos, 'pick') }), [saldos])
  const corPorId = useMemo(() => Object.fromEntries(cores.map((c) => [c.id, c])), [cores])

  const numeros = useMemo(() => {
    const ns = new Set(saldos.map((s) => s.numero))
    return [...ns].sort((a, b) => a - b)
  }, [saldos])

  // uma linha por modelo + cor, com o saldo de cada número
  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const out = []
    produtos.filter((p) => p.skus.length).forEach((p) => {
      const porCor = {}
      p.skus.forEach((s) => { (porCor[s.cor_id] ||= {})[s.numero] = mapaSaldo[s.id] ?? 0 })
      Object.entries(porCor).forEach(([corId, grade]) => {
        const cor = corPorId[corId]
        const total = Object.values(grade).reduce((t, v) => t + v, 0)
        const texto = `${p.ref} ${p.nome} ${cor?.nome || ''}`.toLowerCase()
        if (q && !texto.includes(q)) return
        if (soComSaldo && total === 0) return
        out.push({ chave: `${p.id}-${corId}`, p, cor, grade, total })
      })
    })
    return out.sort((a, b) => a.p.ref.localeCompare(b.p.ref, 'pt-BR', { numeric: true }))
  }, [produtos, mapaSaldo, corPorId, busca, soComSaldo])

  const totalPares = saldos.reduce((t, s) => t + Math.max(0, s.saldo), 0)
  const paresBulk = saldos.reduce((t, s) => t + Math.max(0, s.saldo_bulk || 0), 0)
  const paresPick = saldos.reduce((t, s) => t + Math.max(0, s.saldo_pick || 0), 0)
  const negativos = saldos.filter((s) => s.saldo < 0).length

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Saldo por modelo, cor e número</div>
          <h1>Estoque</h1>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setModal('inventario')}>Inventário / ajuste</button>
          <button className="btn" onClick={() => setModal('transferencia')}>Replenishment</button>
          <button className="btn btn-dark" onClick={() => setModal('entrada')}><Icon name="mais" size={16} stroke={2} />Entrada de produção</button>
        </div>
      </header>

      {erro && <p className="form-error" role="alert">Não consegui ler o banco: {erro}</p>}

      <section className="grid-kpi">
        <div className="card kpi"><span className="kpi-label">Pares em estoque</span><span className="kpi-value">{inteiro(totalPares)}</span></div>
        <div className="card kpi"><span className="kpi-label">Bulk</span><span className="kpi-value">{inteiro(paresBulk)}</span><span className="kpi-note">{LOCAIS.bulk.desc}</span></div>
        <div className="card kpi"><span className="kpi-label">Pick</span><span className="kpi-value">{inteiro(paresPick)}</span><span className="kpi-note">{LOCAIS.pick.desc}</span></div>
        <div className="card kpi"><span className="kpi-label">Saldo negativo</span><span className="kpi-value" style={negativos ? { color: 'var(--bad)' } : undefined}>{inteiro(negativos)}</span><span className="kpi-note">vendeu sem ter lançado entrada</span></div>
      </section>

      <div className="actions">
        <label className="search">
          <Icon name="busca" size={16} />
          <span className="sr-only">Buscar</span>
          <input type="search" placeholder="Buscar por REF, nome ou cor" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <div className="segmented" role="tablist" aria-label="Local do estoque">
          {[['', 'Total'], ['bulk', 'Bulk'], ['pick', 'Pick']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={vista === k} className={vista === k ? 'on' : ''} onClick={() => setVista(k)}>{l}</button>
          ))}
        </div>
        <div className="chips">
          <button className={`chip ${!soComSaldo ? 'on' : ''}`} onClick={() => setSoComSaldo(false)}>Todos</button>
          <button className={`chip ${soComSaldo ? 'on' : ''}`} onClick={() => setSoComSaldo(true)}>Só com saldo</button>
        </div>
      </div>

      <section className="card card-flush">
        <div className="table-wrap">
          <table style={{ minWidth: 640 }}>
            <thead className="tinted">
              <tr>
                <th>Modelo · cor</th>
                {numeros.map((n) => <th key={n} className="c">{rotuloNum(n)}</th>)}
                <th className="r">Total</th>
              </tr>
            </thead>
            <tbody>
              {carregando && <tr><td colSpan={numeros.length + 2} style={{ color: 'var(--muted)', padding: 32 }}>Carregando…</td></tr>}
              {linhas.map((l) => (
                <tr key={l.chave}>
                  <td>
                    <ProdutoCelula p={l.p} cor={l.cor} linha2={<><i className="dot-cor" style={{ background: l.cor?.hex || '#ddd' }} />{l.cor?.nome}</>} />
                  </td>
                  {numeros.map((n) => {
                    const v = l.grade[n]
                    return (
                      <td key={n} className="c" style={{ fontWeight: v ? 600 : 400, color: v == null ? 'var(--line)' : v < 0 ? 'var(--bad)' : v === 0 ? 'var(--faint)' : 'var(--ink)' }}>
                        {v == null ? '·' : v}
                      </td>
                    )
                  })}
                  <td className="r"><b>{l.total}</b></td>
                </tr>
              ))}
              {!carregando && linhas.length === 0 && (
                <tr><td colSpan={numeros.length + 2} style={{ color: 'var(--muted)', padding: 32 }}>
                  {saldos.length === 0 ? 'Nenhum SKU ainda. Ative modelos com cores em Produtos.' : 'Nada encontrado.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Últimas movimentações</h2></div>
        {movs.length === 0 ? (
          <p className="card-sub" style={{ margin: 0 }}>Nenhuma movimentação ainda. Lance a primeira entrada de produção.</p>
        ) : (
          <div className="table-wrap">
            <table style={{ minWidth: 560 }}>
              <thead><tr><th>Quando</th><th>SKU</th><th>Local</th><th>Tipo</th><th className="r">Qtd</th><th>Motivo</th><th>Obs.</th></tr></thead>
              <tbody>
                {movs.map((m) => {
                  const t = TIPO_MOV[m.tipo]
                  const sinal = m.tipo === 'saida' ? -m.quantidade : m.quantidade
                  return (
                    <tr key={m.id}>
                      <td style={{ color: 'var(--muted)' }}>{dataHoraBR(m.criado_em)}</td>
                      <td className="mono">{m.skus?.sku}</td>
                      <td>{LOCAIS[m.local]?.label || '—'}</td>
                      <td><span className={`pill ${t.tom}`}>{t.label}</span></td>
                      <td className="r" style={{ fontWeight: 600, color: sinal < 0 ? 'var(--bad)' : 'var(--ok)' }}>{sinal > 0 ? '+' : ''}{sinal}</td>
                      <td>{MOTIVO[m.motivo] || m.motivo || '—'}</td>
                      <td style={{ color: 'var(--muted)' }}>{m.observacao || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal && (
        <MovimentoModal modo={modal} produtos={produtos} cores={cores} saldos={mapas}
          onFechar={() => setModal(null)} onSalvo={() => { setModal(null); carregar() }} />
      )}
    </>
  )
}
