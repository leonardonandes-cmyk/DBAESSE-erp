import { useEffect, useState } from 'react'
import { baixarBackup } from '../lib/backup.js'
import { listarSetores, salvarSetor } from '../lib/producao.js'
import { listarListas, salvarLista } from '../lib/precos.js'
import { brl } from '../lib/format.js'
import { supabase } from '../lib/supabase.js'

const PAPEIS = [
  { v: 'admin', l: 'Administrador', d: 'tudo, inclusive configurações' },
  { v: 'gestor', l: 'Gestor', d: 'tudo liberado, menos comissão' },
  { v: 'operador', l: 'Vendedora', d: 'pedidos, clientes, app, preços e estoque (consulta)' },
]

export default function Configuracoes() {
  const [setores, setSetores] = useState([])
  const [listas, setListas] = useState([])
  const [novoSetor, setNovoSetor] = useState('')
  const [usuarios, setUsuarios] = useState([])
  const [souAdmin, setSouAdmin] = useState(false)
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [backup, setBackup] = useState('')
  const [logins, setLogins] = useState({})
  const [novoU, setNovoU] = useState(null) // { nome, email, senha, papel }
  const [trocaSenha, setTrocaSenha] = useState(null) // { id, nome, senha }
  const [salvandoU, setSalvandoU] = useState(false)

  async function carregar() {
    try {
      const [s, u, eu, ls] = await Promise.all([
        listarSetores(),
        supabase.from('perfis').select('id,nome,papel,criado_em').order('criado_em'),
        supabase.rpc('sou_admin'),
        listarListas(),
      ])
      setSetores(s)
      setListas(ls)
      if (u.error) throw u.error
      setUsuarios(u.data)
      setSouAdmin(Boolean(eu.data))
      if (eu.data) {
        const r = await supabase.functions.invoke('equipe', { body: { acao: 'logins' } })
        if (r.data?.logins) setLogins(r.data.logins)
      }
    } catch (e) { setErro(e.message) }
  }
  useEffect(() => { carregar() }, [])

  async function salvarL(l, campos) {
    setErro('')
    try { await salvarLista(l.id, { ...l, ...campos }); aviso('Lista salva'); carregar() } catch (e) { setErro(e.message) }
  }
  const aviso = (t) => { setMsg(t); setTimeout(() => setMsg(''), 2500) }

  async function salvarS(s) {
    setErro('')
    try { await salvarSetor(s); aviso('Setor salvo'); carregar() } catch (e) { setErro(e.message) }
  }
  async function mover(i, dir) {
    const lista = [...setores]
    const j = i + dir
    if (j < 0 || j >= lista.length) return
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
    try { await Promise.all(lista.map((s, k) => salvarSetor({ ...s, ordem: k + 1 }))); carregar() } catch (e) { setErro(e.message) }
  }
  async function adicionarSetor() {
    if (!novoSetor.trim()) return
    await salvarS({ nome: novoSetor, ordem: setores.length + 1, ativo: true })
    setNovoSetor('')
  }
  async function mudarPapel(u, papel) {
    setErro('')
    const { data: eu } = await supabase.auth.getUser()
    if (u.id === eu?.user?.id && papel !== 'admin') return setErro('Você não pode tirar o seu próprio acesso de administrador (o sistema ficaria sem ninguém para gerenciar usuários).')
    const { error } = await supabase.from('perfis').update({ papel }).eq('id', u.id)
    if (error) setErro(error.message); else { aviso('Permissão atualizada'); carregar() }
  }
  async function equipe(body) {
    setErro(''); setMsg(''); setSalvandoU(true)
    const { data, error } = await supabase.functions.invoke('equipe', { body })
    setSalvandoU(false)
    let m = data?.erro
    if (!m && error) { try { m = (await error.context.json()).erro } catch { m = error.message } }
    if (m) { setErro(m); return false }
    return true
  }
  async function criarUsuario() {
    if (await equipe({ acao: 'criar', ...novoU })) { setMsg(`Acesso de ${novoU.nome} criado. Login: ${novoU.email}`); setNovoU(null); carregar() }
  }
  async function salvarSenhaDe() {
    if (await equipe({ acao: 'senha', id: trocaSenha.id, senha: trocaSenha.senha })) { setMsg(`Senha de ${trocaSenha.nome} trocada.`); setTrocaSenha(null) }
  }
  async function trocarMinhaSenha(senha) {
    setErro(''); setMsg('')
    if (!senha || senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.')
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) setErro(error.message); else setMsg('Sua senha foi trocada.')
  }

  async function fazerBackup() {
    setErro(''); setBackup('Preparando…')
    try { const r = await baixarBackup(setBackup); setBackup(`Pronto: ${r.arquivo} (${r.linhas.toLocaleString('pt-BR')} linhas)`) } catch (e) { setBackup(''); setErro(e.message) }
  }

  return (
    <>
      <header className="page-head">
        <div><div className="eyebrow">Sistema</div><h1>Configurações</h1></div>
        {msg && <span className="pill ok">{msg}</span>}
      </header>
      {erro && <p className="form-error" role="alert">{erro}</p>}

      <section className="grid-2">
        <div className="card">
          <div className="card-head"><div><h2>Setores da produção</h2><div className="card-sub">Na ordem do fluxo. Cada OP nova ganha uma etapa por setor ativo.</div></div></div>
          <div className="lista-setores">
            {setores.map((s, i) => (
              <div key={s.id} className="setor-linha" style={s.ativo ? undefined : { opacity: 0.5 }}>
                <span className="setor-ordem">{i + 1}</span>
                <input className="input" defaultValue={s.nome} onBlur={(e) => e.target.value.trim() && e.target.value !== s.nome && salvarS({ ...s, nome: e.target.value })} aria-label="Nome do setor" />
                <label className="setor-cap" title="Capacidade do setor em pares por dia (usada na Programação)">
                  <input className="input" inputMode="numeric" defaultValue={s.capacidade_dia ?? 600} aria-label={`Capacidade de ${s.nome} em pares por dia`}
                    onBlur={(e) => Number(e.target.value) > 0 && Number(e.target.value) !== s.capacidade_dia && salvarS({ ...s, capacidade_dia: e.target.value })} />
                  <small>pares/dia</small>
                </label>
                <button className="btn btn-sm icon-btn" onClick={() => mover(i, -1)} aria-label="Subir" disabled={i === 0}>↑</button>
                <button className="btn btn-sm icon-btn" onClick={() => mover(i, 1)} aria-label="Descer" disabled={i === setores.length - 1}>↓</button>
                <label className="check" style={{ whiteSpace: 'nowrap' }}><input type="checkbox" checked={s.ativo} onChange={(e) => salvarS({ ...s, ativo: e.target.checked })} />ativo</label>
              </div>
            ))}
          </div>
          <div className="actions" style={{ marginTop: 12 }}>
            <input className="input" style={{ flex: 1 }} placeholder="Novo setor (ex.: Banca de pesponto)" value={novoSetor} onChange={(e) => setNovoSetor(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && adicionarSetor()} />
            <button className="btn" onClick={adicionarSetor}>Adicionar</button>
          </div>
          <p className="footnote" style={{ marginTop: 10 }}>Mudanças valem para as OPs criadas daqui pra frente.</p>
        </div>

        <div className="card">
          <div className="card-head"><div><h2>Usuários e permissões</h2><div className="card-sub">Cada pessoa entra com o próprio e-mail e senha.</div></div></div>
          <table>
            <thead><tr><th>Nome</th>{souAdmin && <th>Login</th>}<th>Permissão</th>{souAdmin && <th></th>}</tr></thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td><b style={{ fontWeight: 600 }}>{u.nome || '—'}</b></td>
                  {souAdmin && <td className="muted">{logins[u.id] || '—'}</td>}
                  <td>
                    {souAdmin ? (
                      <select className="input input-sm" style={{ width: 170, textAlign: 'left' }} value={u.papel} onChange={(e) => mudarPapel(u, e.target.value)} aria-label="Permissão">
                        {PAPEIS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
                      </select>
                    ) : PAPEIS.find((p) => p.v === u.papel)?.l}
                  </td>
                  {souAdmin && <td style={{ textAlign: 'right' }}><button className="btn btn-sm" onClick={() => setTrocaSenha({ id: u.id, nome: u.nome, senha: '' })}>Trocar senha</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
          {souAdmin && (
            <div className="actions" style={{ marginTop: 14 }}>
              <button className="btn btn-dark" onClick={() => setNovoU({ nome: '', email: '', senha: '', papel: 'operador' })}>+ Novo usuário</button>
            </div>
          )}
          <MinhaSenha onTrocar={trocarMinhaSenha} />
        </div>
      </section>

      <section className="card">
        <div className="card-head"><div><h2>Listas de preço e despesas</h2><div className="card-sub">Preço = preço-base do modelo + acréscimo. As despesas (% do preço ou R$ por par) e a margem-alvo calculam o lucro, a margem e o preço ideal de cada modelo em Produtos → Preços e margem.</div></div></div>
        <div className="listas-cfg">
          {listas.map((l) => <ListaEditor key={l.id} lista={l} onSalvar={(campos) => salvarL(l, campos)} />)}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div><h2>Backup</h2><div className="card-sub">Baixa uma planilha Excel com tudo: produtos, SKUs e saldos, clientes, pedidos, estoque, financeiro, produção, materiais e compras.</div></div>
          <button className="btn btn-dark" onClick={fazerBackup}>Baixar backup</button>
        </div>
        {backup && <p className="card-sub" style={{ margin: 0 }}>{backup}</p>}
        <p className="footnote" style={{ marginTop: 8 }}>Guarde no OneDrive. No plano grátis do Supabase não há backup automático — faça pelo menos uma vez por semana.</p>
      </section>
      {novoU && (
        <div className="modal-bg" onClick={() => !salvandoU && setNovoU(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><div><div className="eyebrow">Equipe</div><h2>Novo usuário</h2></div></div>
            <label className="field"><span>Nome</span><input className="input" value={novoU.nome} onChange={(e) => setNovoU({ ...novoU, nome: e.target.value })} placeholder="Ex.: Sabrina" autoFocus /></label>
            <label className="field"><span>Login (e-mail)</span><input className="input" type="email" value={novoU.email} onChange={(e) => setNovoU({ ...novoU, email: e.target.value })} placeholder="sabrina@dbaesse.app" />
              <small className="muted">Pode ser um login interno (não precisa existir como e-mail).</small></label>
            <label className="field"><span>Senha inicial</span><input className="input" type="text" autoComplete="new-password" value={novoU.senha} onChange={(e) => setNovoU({ ...novoU, senha: e.target.value })} placeholder="mínimo 6 caracteres" /></label>
            <label className="field"><span>Permissão</span>
              <select className="input" value={novoU.papel} onChange={(e) => setNovoU({ ...novoU, papel: e.target.value })}>
                {PAPEIS.map((p) => <option key={p.v} value={p.v}>{p.l} — {p.d}</option>)}
              </select></label>
            {erro && <p className="form-error">{erro}</p>}
            <div className="actions" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setNovoU(null)} disabled={salvandoU}>Cancelar</button>
              <button className="btn btn-dark" onClick={criarUsuario} disabled={salvandoU}>{salvandoU ? 'Criando…' : 'Criar acesso'}</button>
            </div>
          </div>
        </div>
      )}
      {trocaSenha && (
        <div className="modal-bg" onClick={() => !salvandoU && setTrocaSenha(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><div><div className="eyebrow">Equipe</div><h2>Nova senha · {trocaSenha.nome}</h2></div></div>
            <label className="field"><span>Nova senha</span><input className="input" type="text" autoComplete="new-password" value={trocaSenha.senha} onChange={(e) => setTrocaSenha({ ...trocaSenha, senha: e.target.value })} placeholder="mínimo 6 caracteres" autoFocus /></label>
            {erro && <p className="form-error">{erro}</p>}
            <div className="actions" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setTrocaSenha(null)} disabled={salvandoU}>Cancelar</button>
              <button className="btn btn-dark" onClick={salvarSenhaDe} disabled={salvandoU}>{salvandoU ? 'Salvando…' : 'Salvar senha'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ListaEditor({ lista, onSalvar }) {
  const [f, setF] = useState(() => ({
    acrescimo: lista.acrescimo, margem_alvo: Math.round(Number(lista.margem_alvo || 0) * 1000) / 10,
    despesas: (lista.despesas || []).map((d) => ({ nome: d.nome, pct: Math.round(Number(d.pct || 0) * 10000) / 100, rs: d.rs || 0 })),
  }))
  const [mudou, setMudou] = useState(false)
  const set = (patch) => { setF({ ...f, ...patch }); setMudou(true) }
  const setD = (i, patch) => set({ despesas: f.despesas.map((d, k) => (k === i ? { ...d, ...patch } : d)) })
  const somaPct = f.despesas.reduce((t, d) => t + (Number(String(d.pct).replace(',', '.')) || 0), 0)
  function salvar() {
    onSalvar({
      acrescimo: f.acrescimo,
      margem_alvo: (Number(String(f.margem_alvo).replace(',', '.')) || 0) / 100,
      despesas: f.despesas.map((d) => ({ nome: d.nome, pct: (Number(String(d.pct).replace(',', '.')) || 0) / 100, rs: d.rs })),
    })
    setMudou(false)
  }
  return (
    <div className="lista-cfg">
      <div className="lista-cfg-head">
        <div><b>{lista.nome}</b><span>{lista.base === 'varejo' ? 'Preço varejo (FERALCCI)' : 'Preço atacado'}{Number(f.acrescimo) ? ` + R$ ${String(f.acrescimo).replace('.', ',')}` : ''}</span></div>
        {mudou && <button className="btn btn-sm btn-dark" onClick={salvar}>Salvar</button>}
      </div>
      <div className="lista-cfg-campos">
        <label className="field"><span>Acréscimo (R$/par)</span><input type="number" step="0.01" min="0" value={f.acrescimo} onChange={(e) => set({ acrescimo: e.target.value })} /></label>
        <label className="field"><span>Margem-alvo (%)</span><input type="number" step="0.5" min="0" value={f.margem_alvo} onChange={(e) => set({ margem_alvo: e.target.value })} /></label>
      </div>
      <table className="lista-cfg-desp">
        <thead><tr><th>Despesa</th><th className="r">% do preço</th><th className="r">R$ por par</th><th /></tr></thead>
        <tbody>
          {f.despesas.map((d, i) => (
            <tr key={i}>
              <td><input className="input input-sm" style={{ textAlign: 'left', width: '100%' }} value={d.nome} onChange={(e) => setD(i, { nome: e.target.value })} aria-label="Nome da despesa" /></td>
              <td className="r"><input className="input input-sm" inputMode="decimal" value={d.pct} onChange={(e) => setD(i, { pct: e.target.value })} aria-label="Percentual" /></td>
              <td className="r"><input className="input input-sm" inputMode="decimal" value={d.rs} onChange={(e) => setD(i, { rs: e.target.value })} aria-label="Valor por par" /></td>
              <td className="r"><button className="link-btn" onClick={() => set({ despesas: f.despesas.filter((_, k) => k !== i) })}>remover</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="actions" style={{ justifyContent: 'space-between' }}>
        <button className="link-btn" onClick={() => set({ despesas: [...f.despesas, { nome: '', pct: 0, rs: 0 }] })}>+ despesa</button>
        <span className="card-sub" style={{ margin: 0 }}>Despesas: {somaPct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% do preço</span>
      </div>
    </div>
  )
}

function MinhaSenha({ onTrocar }) {
  const [aberto, setAberto] = useState(false)
  const [senha, setSenha] = useState('')
  if (!aberto) return <div style={{ marginTop: 12 }}><button className="btn btn-sm" onClick={() => setAberto(true)}>Trocar minha senha</button></div>
  return (
    <div className="actions" style={{ marginTop: 12 }}>
      <input className="input" style={{ flex: 1 }} type="password" autoComplete="new-password" placeholder="Nova senha (mín. 6)" value={senha} onChange={(e) => setSenha(e.target.value)} />
      <button className="btn btn-dark" onClick={async () => { await onTrocar(senha); setSenha(''); setAberto(false) }}>Salvar</button>
      <button className="btn" onClick={() => setAberto(false)}>Cancelar</button>
    </div>
  )
}
