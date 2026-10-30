import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

// Tela de nova senha: 1º acesso (senha provisória), link de "esqueci a senha" ou troca manual.
const TITULO = {
  primeiro: ['Primeiro acesso', 'Crie a sua senha. Só você vai saber.'],
  recuperar: ['Nova senha', 'Crie uma nova senha para entrar.'],
  manual: ['Trocar minha senha', 'Digite a nova senha duas vezes.'],
}

export default function NovaSenha({ motivo = 'manual', podeCancelar = false, onFim }) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [t, sub] = TITULO[motivo] || TITULO.manual

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (a.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.')
    if (a !== b) return setErro('As duas senhas não estão iguais.')
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: a })
    if (!error) await supabase.rpc('senha_trocada')
    setSalvando(false)
    if (error) return setErro(/different|same/i.test(error.message) ? 'A nova senha precisa ser diferente da atual.' : error.message)
    onFim?.()
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={salvar}>
        <div className="brand" style={{ padding: 0, alignItems: 'center' }}>
          <div className="brand-word">DBAESSE</div>
          <div className="brand-sub">{t}</div>
        </div>
        <p className="footnote" style={{ textAlign: 'center', margin: 0 }}>{sub}</p>
        <label className="field">
          <span>Nova senha</span>
          <input type="password" autoComplete="new-password" required value={a} onChange={(e) => setA(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>Repita a senha</span>
          <input type="password" autoComplete="new-password" required value={b} onChange={(e) => setB(e.target.value)} />
        </label>
        {erro && <p className="form-error" role="alert">{erro}</p>}
        <button className="btn btn-dark" type="submit" disabled={salvando} style={{ width: '100%' }}>
          {salvando ? 'Salvando…' : 'Salvar senha'}
        </button>
        {podeCancelar
          ? <button type="button" className="btn" onClick={onFim} style={{ width: '100%' }}>Cancelar</button>
          : <button type="button" className="btn" onClick={() => supabase.auth.signOut()} style={{ width: '100%' }}>Sair</button>}
      </form>
    </div>
  )
}
