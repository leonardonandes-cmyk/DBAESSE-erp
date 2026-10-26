import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import TituloForm from '../components/TituloForm.jsx'
import { FORMAS, baixarTitulo, estornarTitulo, excluirTitulo, listarTitulos, situacao } from '../lib/financeiro.js'
import { brl, brlCurto, dataBR, hojeISO } from '../lib/format.js'
import { listarParceiros } from '../lib/parceiros.js'

const FILTROS = [
  { id: 'abertos', label: 'Em aberto', teste: (t) => !t.pago_em },
  { id: 'vencidos', label: 'Vencidos', teste: (t) => situacao(t).id === 'vencido' },
  { id: 'semana', label: 'Esta semana', teste: (t, s) => !t.pago_em && t.vencimento >= s.ini && t.vencimento <= s.fim },
  { id: 'pagos', label: 'Pagos', teste: (t) => Boolean(t.pago_em) },
  { id: 'todos', label: 'Todos', teste: () => true },
]

function semanaDe(iso) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  const ini = d.toISOString().slice(0, 10)
  d.setDate(d.getDate() + 6)
  return { ini, fim: d.toISOString().slice(0, 10) }
}
function proximasSemanas(qtd) {
  const out = []
  let { ini } = semanaDe(hojeISO())
  for (let i = 0; i < qtd; i++) {
    const s = semanaDe(ini)
    out.push(s)
    const d = new Date(`${s.fim}T12:00:00`); d.setDate(d.getDate() + 1)
    ini = d.toISOString().slice(0, 10)
  }
  return out
}

export default function Financeiro() {
  const [titulos, setTitulos] = useState([])
  const [parceiros, setParceiros] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState('pagar')
  const [filtro, setFiltro] = useState('abertos')
  const [busca, setBusca] = useState('')
  const [novo, setNovo] = useState(false)
  const [baixa, setBaixa] = useState(null)

  async function carregar() {
    try {
      const [t, p] = await Promise.all([listarTitulos(), listarParceiros()])
      setTitulos(t); setParceiros(p)
    } catch (e) { setErro(e.message) } finally { setCarregando(false) }
  }
  useEffect(() => { carregar() }, [])

  const semanaAtual = semanaDe(hojeISO())
  const abertos = titulos.filter((t) => !t.pago_em)
  const soma = (l) => l.reduce((s, t) => s + Number(t.valor), 0)
  const aPagar = soma(abertos.filter((t) => t.tipo === 'pagar'))
  const aReceber = soma(abertos.filter((t) => t.tipo === 'receber'))
  const vencidosPagar = abertos.filter((t) => t.tipo === 'pagar' && situacao(t).id === 'vencido')
  const vencidosReceber = abertos.filter((t) => t.tipo === 'receber' && situacao(t).id === 'vencido')

  // resumo semanal: vencidos + próximas 5 semanas
  const semanas = useMemo(() => {
    const hoje = hojeISO()
    const venc = abertos.filter((t) => t.vencimento < semanaAtual.ini)
    const linhas = [{ rotulo: 'Atrasados', pagar: soma(venc.filter((t) => t.tipo === 'pagar')), receber: soma(venc.filter((t) => t.tipo === 'receber')), atraso: true }]
    proximasSemanas(5).forEach((s, i) => {
      const da = abertos.filter((t) => t.vencimento >= s.ini && t.vencimento <= s.fim)
      linhas.push({ rotulo: i === 0 ? 'Esta semana' : `${dataBR(s.ini)} a ${dataBR(s.fim)}`, pagar: soma(da.filter((t) => t.tipo === 'pagar')), receber: soma(da.filter((t) => t.tipo === 'receber')), atual: i === 0, hoje })
    })
    return linhas
  }, [titulos]) // eslint-disable-line react-hooks/exhaustive-deps

  const visiveis = useMemo(() => {
    const f = FILTROS.find((x) => x.id === filtro)
    const q = busca.trim().toLowerCase()
    const lista = titulos.filter((t) => t.tipo === aba && f.teste(t, semanaAtual) &&
      (!q || `${t.descricao} ${t.parceiros?.nome || ''} ${t.categoria || ''}`.toLowerCase().includes(q)))
    return filtro === 'pagos' ? [...lista].sort((a, b) => (b.pago_em > a.pago_em ? 1 : -1)) : lista
  }, [titulos, aba, filtro, busca]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalVisivel = soma(visiveis)

  async function estornar(t) {
    if (!window.confirm('Desfazer a baixa deste lançamento?')) return
    try { await estornarTitulo(t.id); carregar() } catch (e) { setErro(e.message) }
  }
  async function excluir(t) {
    if (!window.confirm(`Excluir "${t.descricao}${t.parcela ? ` ${t.parcela}` : ''}"? Fica registrado no histórico.`)) return
    try { await excluirTitulo(t.id); carregar() } catch (e) { setErro(e.message) }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Contas a pagar e a receber</div>
          <h1>Financeiro</h1>
        </div>
        <div className="actions">
          <button className="btn btn-dark" onClick={() => setNovo(true)}><Icon name="mais" size={16} stroke={2} />Novo lançamento</button>
        </div>
      </header>

      {erro && <p className="form-error" role="alert">{erro}</p>}

      <section className="grid-kpi">
        <div className="card kpi"><span className="kpi-label">A pagar (aberto)</span><span className="kpi-value">{brl(aPagar)}</span>
          <span className={`kpi-note ${vencidosPagar.length ? 'bad' : ''}`}>{vencidosPagar.length ? `${vencidosPagar.length} vencidos · ${brl(soma(vencidosPagar))}` : 'nada vencido'}</span></div>
        <div className="card kpi"><span className="kpi-label">A receber (aberto)</span><span className="kpi-value">{brl(aReceber)}</span>
          <span className={`kpi-note ${vencidosReceber.length ? 'bad' : ''}`}>{vencidosReceber.length ? `${vencidosReceber.length} em atraso · ${brl(soma(vencidosReceber))}` : 'nada em atraso'}</span></div>
        <div className="card kpi"><span className="kpi-label">Saldo previsto</span><span className="kpi-value" style={{ color: aReceber - aPagar < 0 ? 'var(--bad)' : 'var(--ink)' }}>{brl(aReceber - aPagar)}</span><span className="kpi-note">a receber − a pagar</span></div>
        <div className="card kpi"><span className="kpi-label">Pagar esta semana</span><span className="kpi-value">{brl(semanas[1]?.pagar || 0)}</span><span className="kpi-note">{dataBR(semanaAtual.ini)} a {dataBR(semanaAtual.fim)}</span></div>
      </section>

      <section className="card">
        <div className="card-head"><div><h2>Resumo semanal</h2><div className="card-sub">Vencimentos em aberto por semana</div></div></div>
        <div className="semanas">
          {semanas.map((s) => (
            <div key={s.rotulo} className={`semana ${s.atual ? 'atual' : ''} ${s.atraso ? 'atraso' : ''}`}>
              <span className="semana-rot">{s.rotulo}</span>
              <span className="semana-pagar">− {brl(s.pagar)}</span>
              <span className="semana-receber">+ {brl(s.receber)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="actions" style={{ justifyContent: 'space-between' }}>
        <div className="segmented">
          <button className={aba === 'pagar' ? 'on' : ''} onClick={() => setAba('pagar')}>A pagar</button>
          <button className={aba === 'receber' ? 'on' : ''} onClick={() => setAba('receber')}>A receber</button>
        </div>
        <div className="chips">
          {FILTROS.map((f) => <button key={f.id} className={`chip ${filtro === f.id ? 'on' : ''}`} onClick={() => setFiltro(f.id)}>{f.label}</button>)}
        </div>
        <label className="search">
          <Icon name="busca" size={16} />
          <span className="sr-only">Buscar</span>
          <input type="search" placeholder="Buscar descrição, fornecedor, cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
      </div>

      <section className="card card-flush">
        <div className="table-wrap">
          <table style={{ minWidth: 760 }}>
            <thead className="tinted">
              <tr><th>Vencimento</th><th>Descrição</th><th>{aba === 'pagar' ? 'Fornecedor' : 'Cliente'}</th><th>Categoria</th><th className="r">Valor</th><th>Situação</th><th className="r" /></tr>
            </thead>
            <tbody>
              {carregando && <tr><td colSpan={7} style={{ color: 'var(--muted)', padding: 32 }}>Carregando…</td></tr>}
              {visiveis.map((t) => {
                const st = situacao(t)
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600, color: st.id === 'vencido' ? 'var(--bad)' : 'var(--ink)' }}>{dataBR(t.vencimento)}</td>
                    <td><b style={{ fontWeight: 600 }}>{t.descricao}</b>{t.parcela && <span className="card-sub"> · {t.parcela}</span>}{t.observacao && <><br /><span className="card-sub">{t.observacao}</span></>}</td>
                    <td>{t.parceiros?.nome || '—'}</td>
                    <td style={{ color: 'var(--muted)' }}>{t.categoria || '—'}</td>
                    <td className="r"><b style={{ fontWeight: 600 }}>{brl(t.valor)}</b></td>
                    <td><span className={`pill ${st.tom}`}>{st.label}</span>{t.pago_em && <span className="card-sub"> {dataBR(t.pago_em)}</span>}</td>
                    <td className="r" style={{ whiteSpace: 'nowrap' }}>
                      {t.pago_em
                        ? <button className="link-btn" onClick={() => estornar(t)}>desfazer</button>
                        : <button className="btn btn-sm" onClick={() => setBaixa(t)}>{aba === 'pagar' ? 'Pagar' : 'Receber'}</button>}
                      <button className="link-btn" onClick={() => excluir(t)}>excluir</button>
                    </td>
                  </tr>
                )
              })}
              {!carregando && visiveis.length === 0 && (
                <tr><td colSpan={7} style={{ color: 'var(--muted)', padding: 32 }}>
                  {titulos.length === 0 ? 'Nenhum lançamento ainda. Clique em "Novo lançamento" para lançar a primeira conta.' : 'Nada neste filtro.'}
                </td></tr>
              )}
            </tbody>
            {visiveis.length > 0 && (
              <tfoot><tr><td colSpan={4} style={{ color: 'var(--muted)' }}>{visiveis.length} lançamentos</td><td className="r"><b>{brl(totalVisivel)}</b></td><td colSpan={2} /></tr></tfoot>
            )}
          </table>
        </div>
      </section>

      {novo && <TituloForm tipoInicial={aba} parceiros={parceiros} onFechar={() => setNovo(false)} onSalvo={() => { setNovo(false); carregar() }} />}
      {baixa && <BaixaModal titulo={baixa} onFechar={() => setBaixa(null)} onSalvo={() => { setBaixa(null); carregar() }} />}
    </>
  )
}

function BaixaModal({ titulo, onFechar, onSalvo }) {
  const [f, setF] = useState({ pago_em: hojeISO(), valor_pago: titulo.valor, forma: titulo.forma || 'Pix' })
  const [erro, setErro] = useState('')
  const pagar = titulo.tipo === 'pagar'
  async function salvar(e) {
    e.preventDefault()
    try { await baixarTitulo(titulo.id, f); onSalvo() } catch (e) { setErro(e.message) }
  }
  return (
    <div className="modal-bg" onClick={onFechar}>
      <form className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()} onSubmit={salvar}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">{titulo.descricao}{titulo.parcela ? ` · ${titulo.parcela}` : ''}</div>
            <h2>{pagar ? 'Registrar pagamento' : 'Registrar recebimento'}</h2>
          </div>
          <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
        </div>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <label className="field"><span>Data</span><input type="date" required value={f.pago_em} onChange={(e) => setF({ ...f, pago_em: e.target.value })} /></label>
          <label className="field"><span>Valor (R$)</span><input type="number" step="0.01" min="0" required value={f.valor_pago} onChange={(e) => setF({ ...f, valor_pago: e.target.value })} /></label>
          <label className="field span-3">
            <span>Forma</span>
            <select className="input" value={f.forma} onChange={(e) => setF({ ...f, forma: e.target.value })}>
              {FORMAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        {erro && <p className="form-error" role="alert">{erro}</p>}
        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="btn btn-dark">Confirmar</button>
        </div>
      </form>
    </div>
  )
}
