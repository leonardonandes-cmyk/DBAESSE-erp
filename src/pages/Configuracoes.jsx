import { useEffect, useState } from 'react'
import { baixarBackup } from '../lib/backup.js'
import { listarSetores, salvarSetor } from '../lib/producao.js'
import { supabase } from '../lib/supabase.js'

const PAPEIS = [
  { v: 'admin', l: 'Administrador', d: 'tudo, inclusive configurações' },
  { v: 'gestor', l: 'Gestor', d: 'operação completa' },
  { v: 'operador', l: 'Operador', d: 'uso do dia a dia' },
]

export default function Configuracoes() {
  const [setores, setSetores] = useState([])
  const [novoSetor, setNovoSetor] = useState('')
  const [usuarios, setUsuarios] = useState([])
  const [souAdmin, setSouAdmin] = useState(false)
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [backup, setBackup] = useState('')

  async function carregar() {
    try {
      const [s, u, eu] = await Promise.all([
        listarSetores(),
        supabase.from('perfis').select('id,nome,papel,criado_em').order('criado_em'),
        supabase.rpc('sou_admin'),
      ])
      setSetores(s)
      if (u.error) throw u.error
      setUsuarios(u.data)
      setSouAdmin(Boolean(eu.data))
    } catch (e) { setErro(e.message) }
  }
  useEffect(() => { carregar() }, [])

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
    const { error } = await supabase.from('perfis').update({ papel }).eq('id', u.id)
    if (error) setErro(error.message); else { aviso('Permissão atualizada'); carregar() }
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
            <thead><tr><th>Nome</th><th>Permissão</th></tr></thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td><b style={{ fontWeight: 600 }}>{u.nome || '—'}</b></td>
                  <td>
                    {souAdmin ? (
                      <select className="input input-sm" style={{ width: 170, textAlign: 'left' }} value={u.papel} onChange={(e) => mudarPapel(u, e.target.value)} aria-label="Permissão">
                        {PAPEIS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
                      </select>
                    ) : PAPEIS.find((p) => p.v === u.papel)?.l}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="preview" style={{ marginTop: 14 }}>
            <b>Para cadastrar alguém:</b> no Supabase, abra <b>Authentication → Users → Add user → Create new user</b>, informe o e-mail e uma senha e marque <b>Auto Confirm User</b>. A pessoa aparece aqui como Operador.
          </div>
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
    </>
  )
}
