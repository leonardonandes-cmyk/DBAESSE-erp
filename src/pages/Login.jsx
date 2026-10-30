import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

// Login pelo USUÁRIO curto (leo, sabrina, pamela). Por trás, a conta usa o e-mail da empresa
// (calcadosdbaesse+usuario@gmail.com) — é para lá que vai o link de "esqueci a senha".
async function emailDe(login) {
  const v = login.trim().toLowerCase()
  if (v.includes('@')) return v
  const { data } = await supabase.rpc('email_do_usuario', { u: v })
  return data || null
}

export default function Login() {
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setErro(''); setAviso('')
    setCarregando(true)
    const email = await emailDe(usuario)
    if (!email) { setCarregando(false); return setErro('Usuário ou senha incorretos.') }
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setCarregando(false)
    if (error) setErro(error.message === 'Invalid login credentials' ? 'Usuário ou senha incorretos.' : error.message)
  }

  async function esqueci() {
    setErro(''); setAviso('')
    if (!usuario.trim()) return setErro('Digite o seu usuário e clique de novo em "Esqueci a senha".')
    setCarregando(true)
    const email = await emailDe(usuario)
    if (email) await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    setCarregando(false)
    setAviso('Pronto. O link para criar uma nova senha foi para o e-mail cadastrado. Equipe: o link chega no calcadosdbaesse@gmail.com — peça ao Leo.')
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={entrar}>
        <div className="brand" style={{ padding: 0, alignItems: 'center' }}>
          <div className="brand-word">DBAESSE</div>
          <div className="brand-sub">Gestão</div>
        </div>
        <label className="field">
          <span>Usuário</span>
          <input autoComplete="username" autoCapitalize="none" spellCheck={false} required value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="ex.: sabrina" />
        </label>
        <label className="field">
          <span>Senha</span>
          <input type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>
        {erro && <p className="form-error" role="alert">{erro}</p>}
        {aviso && <p className="footnote" role="status" style={{ color: 'var(--ink, #151515)' }}>{aviso}</p>}
        <button className="btn btn-dark" type="submit" disabled={carregando} style={{ width: '100%' }}>
          {carregando ? 'Aguarde…' : 'Entrar'}
        </button>
        <button type="button" className="btn" onClick={esqueci} disabled={carregando} style={{ width: '100%' }}>Esqueci a senha</button>
        <p className="footnote" style={{ textAlign: 'center' }}>Acesso liberado pelo administrador.</p>
      </form>
    </div>
  )
}
