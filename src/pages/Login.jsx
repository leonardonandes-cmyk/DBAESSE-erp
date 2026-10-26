import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    setCarregando(false)
    if (error) setErro(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message)
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={entrar}>
        <div className="brand" style={{ padding: 0, alignItems: 'center' }}>
          <div className="brand-word">DBAESSE</div>
          <div className="brand-sub">Gestão</div>
        </div>
        <label className="field">
          <span>E-mail</span>
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Senha</span>
          <input type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>
        {erro && <p className="form-error" role="alert">{erro}</p>}
        <button className="btn btn-dark" type="submit" disabled={carregando} style={{ width: '100%' }}>
          {carregando ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="footnote" style={{ textAlign: 'center' }}>Acesso liberado pelo administrador.</p>
      </form>
    </div>
  )
}
