import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import ParceiroForm from '../components/ParceiroForm.jsx'
import { linkWhats } from '../lib/format.js'
import { TIPOS_PARCEIRO, listarParceiros } from '../lib/parceiros.js'

const LABEL = Object.fromEntries(TIPOS_PARCEIRO.map((t) => [t.valor, t.label]))
const TOM = { cliente: 'info', revendedora: 'warn', fornecedor: 'neutral', transportadora: 'neutral' }

export default function Clientes() {
  const [lista, setLista] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [busca, setBusca] = useState('')
  const [form, setForm] = useState(null) // null | { parceiro? }

  async function carregar() {
    try { setLista(await listarParceiros()) } catch (e) { setErro(e.message) } finally { setCarregando(false) }
  }
  useEffect(() => { carregar() }, [])

  const contagem = useMemo(() => {
    const c = { todos: lista.length }
    TIPOS_PARCEIRO.forEach((t) => { c[t.valor] = lista.filter((p) => p.tipos.includes(t.valor)).length })
    return c
  }, [lista])

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return lista.filter((p) =>
      (filtro === 'todos' || p.tipos.includes(filtro)) &&
      (!q || `${p.nome} ${p.documento || ''} ${p.cidade || ''} ${p.telefone || ''}`.toLowerCase().includes(q)))
  }, [lista, filtro, busca])

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{contagem.cliente || 0} clientes · {contagem.revendedora || 0} revendedoras · {contagem.fornecedor || 0} fornecedores</div>
          <h1>Clientes e fornecedores</h1>
        </div>
        <div className="actions">
          <button className="btn btn-dark" onClick={() => setForm({ tipo: filtro === 'todos' ? 'cliente' : filtro })}>
            <Icon name="mais" size={16} stroke={2} />Novo cadastro
          </button>
        </div>
      </header>

      {erro && <p className="form-error" role="alert">Não consegui ler o banco: {erro}</p>}

      <div className="actions">
        <label className="search">
          <Icon name="busca" size={16} />
          <span className="sr-only">Buscar</span>
          <input type="search" placeholder="Buscar por nome, CPF/CNPJ, cidade ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <div className="chips">
          <button className={`chip ${filtro === 'todos' ? 'on' : ''}`} onClick={() => setFiltro('todos')}>Todos · {contagem.todos}</button>
          {TIPOS_PARCEIRO.map((t) => (
            <button key={t.valor} className={`chip ${filtro === t.valor ? 'on' : ''}`} onClick={() => setFiltro(t.valor)}>{t.plural} · {contagem[t.valor] || 0}</button>
          ))}
        </div>
      </div>

      {!carregando && lista.length === 0 && !erro ? (
        <section className="card empty">
          <span className="alert-num" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', width: 56, height: 56, borderRadius: 14 }}>
            <Icon name="clientes" size={24} />
          </span>
          <h2>Nenhum cadastro ainda</h2>
          <p>Cadastre clientes, revendedoras, fornecedores e transportadoras. Uma mesma pessoa pode ter mais de um tipo.</p>
          <button className="btn btn-dark" onClick={() => setForm({ tipo: 'cliente' })}>Cadastrar o primeiro</button>
        </section>
      ) : (
        <section className="card card-flush">
          <div className="table-wrap">
            <table style={{ minWidth: 720 }}>
              <thead className="tinted">
                <tr><th>Nome</th><th>Tipo</th><th>Cidade</th><th>Contato</th><th>CPF / CNPJ</th><th>Canal</th></tr>
              </thead>
              <tbody>
                {carregando && <tr><td colSpan={6} style={{ color: 'var(--muted)', padding: 32 }}>Carregando…</td></tr>}
                {visiveis.map((p) => {
                  const zap = linkWhats(p.telefone)
                  return (
                    <tr key={p.id} className="clickable" onClick={() => setForm({ parceiro: p })} style={p.ativo ? undefined : { opacity: 0.5 }}>
                      <td><b>{p.nome}</b>{!p.ativo && <span className="pill neutral" style={{ marginLeft: 8 }}>Inativo</span>}</td>
                      <td><div className="chips" style={{ gap: 4 }}>{p.tipos.map((t) => <span key={t} className={`pill ${TOM[t]}`}>{LABEL[t]}</span>)}</div></td>
                      <td style={{ color: 'var(--ink-2)' }}>{p.cidade ? `${p.cidade}${p.uf ? ` / ${p.uf}` : ''}` : '—'}</td>
                      <td>
                        {zap ? <a className="link" href={zap} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{p.telefone}</a> : (p.email || '—')}
                      </td>
                      <td className="mono" style={{ color: 'var(--ink-2)' }}>{p.documento || '—'}</td>
                      <td style={{ color: 'var(--muted)' }}>{p.canal || '—'}</td>
                    </tr>
                  )
                })}
                {!carregando && lista.length > 0 && visiveis.length === 0 && (
                  <tr><td colSpan={6} style={{ color: 'var(--muted)', padding: 32 }}>Nada encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {form && (
        <ParceiroForm
          parceiro={form.parceiro}
          tipoInicial={form.tipo}
          onFechar={() => setForm(null)}
          onSalvo={() => { setForm(null); carregar() }}
        />
      )}
    </>
  )
}
