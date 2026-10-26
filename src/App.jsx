import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import Icon from './components/Icon.jsx'
import { supabase } from './lib/supabase.js'
import Login from './pages/Login.jsx'
import Painel from './pages/Painel.jsx'
import Produtos from './pages/Produtos.jsx'
import Producao from './pages/Producao.jsx'
import EmBreve from './pages/EmBreve.jsx'

// Menu = mapa dos módulos. "fase" marca o que ainda não foi construído.
export const MODULOS = [
  { to: '/', icon: 'painel', label: 'Painel' },
  { to: '/pedidos', icon: 'pedidos', label: 'Pedidos', fase: 3 },
  { to: '/producao', icon: 'producao', label: 'Produção' },
  { to: '/produtos', icon: 'produtos', label: 'Produtos' },
  { to: '/estoque', icon: 'estoque', label: 'Estoque', fase: 4 },
  { to: '/clientes', icon: 'clientes', label: 'Clientes', fase: 2 },
  { to: '/compras', icon: 'compras', label: 'Compras', fase: 8 },
  { to: '/financeiro', icon: 'financeiro', label: 'Financeiro', fase: 6 },
  { to: '/relatorios', icon: 'relatorios', label: 'Relatórios', fase: 7 },
]

const TABBAR = ['/', '/pedidos', '/producao', '/produtos', '/estoque']

const PAPEL = { admin: 'Administrador', gestor: 'Gestor', operador: 'Operador' }

export default function App() {
  const [sessao, setSessao] = useState(undefined)
  const [perfil, setPerfil] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!sessao) { setPerfil(null); return }
    supabase.from('perfis').select('nome,papel,empresas(nome)').eq('id', sessao.user.id).maybeSingle()
      .then(({ data }) => setPerfil(data))
  }, [sessao])

  if (sessao === undefined) return null
  if (!sessao) return <Login />

  const EMPRESA = {
    nome: perfil?.empresas?.nome || 'DBAESSE',
    usuario: perfil?.nome || sessao.user.email.split('@')[0],
    papel: PAPEL[perfil?.papel] || 'Usuário',
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-word">{EMPRESA.nome}</div>
          <div className="brand-sub">Gestão</div>
        </div>
        <nav className="nav" aria-label="Menu principal">
          {MODULOS.map((m) => (
            <NavLink key={m.to} to={m.to} end={m.to === '/'}>
              <Icon name={m.icon} />
              <span>{m.label}</span>
              {m.fase && <span className="soon">Em breve</span>}
            </NavLink>
          ))}
        </nav>
        <div className="user">
          <div className="avatar">{EMPRESA.usuario[0]}</div>
          <div>
            <b>{EMPRESA.usuario}</b>
            <span>{EMPRESA.papel} · {EMPRESA.nome}</span>
          </div>
          <button onClick={() => supabase.auth.signOut()}>Sair</button>
        </div>
      </aside>

      <main className="main">
        <div className="mobile-top">
          <div className="brand-word">{EMPRESA.nome}</div>
          <button className="btn icon-btn" aria-label="Notificações"><Icon name="sino" /></button>
        </div>
        <Routes>
          <Route path="/" element={<Painel usuario={EMPRESA.usuario} />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/producao" element={<Producao />} />
          {MODULOS.filter((m) => m.fase).map((m) => (
            <Route key={m.to} path={m.to} element={<EmBreve modulo={m} />} />
          ))}
          <Route path="*" element={<Painel />} />
        </Routes>
      </main>

      <nav className="tabbar" aria-label="Menu">
        {MODULOS.filter((m) => TABBAR.includes(m.to)).map((m) => (
          <NavLink key={m.to} to={m.to} end={m.to === '/'}>
            <Icon name={m.icon} size={20} />
            {m.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
