import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import Icon from './components/Icon.jsx'
import { supabase } from './lib/supabase.js'
import Login from './pages/Login.jsx'
import Painel from './pages/Painel.jsx'
import Produtos from './pages/Produtos.jsx'
import Producao from './pages/Producao.jsx'
import Pedidos from './pages/Pedidos.jsx'
import Estoque from './pages/Estoque.jsx'
import Clientes from './pages/Clientes.jsx'
import Financeiro from './pages/Financeiro.jsx'
import Compras from './pages/Compras.jsx'
import Relatorios from './pages/Relatorios.jsx'
import Configuracoes from './pages/Configuracoes.jsx'
import EmBreve from './pages/EmBreve.jsx'
import AppVendas from './pages/AppVendas.jsx'
import Simulador from './pages/Simulador.jsx'

// Menu = mapa dos módulos. "fase" marca o que ainda não foi construído.
export const MODULOS = [
  { to: '/', icon: 'painel', label: 'Painel' },
  { to: '/pedidos', icon: 'pedidos', label: 'Pedidos' },
  { to: '/app', icon: 'leitor', label: 'App vendas' },
  { to: '/produtos', icon: 'produtos', label: 'Produtos' },
  { to: '/estoque', icon: 'estoque', label: 'Estoque' },
  { to: '/clientes', icon: 'clientes', label: 'Clientes' },
  { to: '/financeiro', icon: 'financeiro', label: 'Financeiro' },
  { to: '/producao', icon: 'producao', label: 'Produção' },
  { to: '/compras', icon: 'compras', label: 'Compras' },
  { to: '/relatorios', icon: 'relatorios', label: 'Relatórios' },
  { to: '/configuracoes', icon: 'config', label: 'Configurações' },
]

const TABBAR = ['/', '/pedidos', '/app', '/estoque']

const PAPEL = { admin: 'Administrador', gestor: 'Gestor', operador: 'Operador' }

export default function App() {
  const [sessao, setSessao] = useState(undefined)
  const [perfil, setPerfil] = useState(null)
  const [mais, setMais] = useState(false)

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
              {m.exemplo && <span className="soon">Exemplo</span>}
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
          <button className="btn" onClick={() => supabase.auth.signOut()}>Sair</button>
        </div>
        <Routes>
          <Route path="/" element={<Painel usuario={EMPRESA.usuario} />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/simulador" element={<Simulador />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/compras" element={<Compras />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/producao" element={<Producao />} />
          <Route path="/app" element={<AppVendas />} />
          {MODULOS.filter((m) => m.fase).map((m) => (
            <Route key={m.to} path={m.to} element={<EmBreve modulo={m} />} />
          ))}
          <Route path="*" element={<Painel usuario={EMPRESA.usuario} />} />
        </Routes>
      </main>

      <nav className="tabbar" aria-label="Menu">
        {MODULOS.filter((m) => TABBAR.includes(m.to)).map((m) => (
          <NavLink key={m.to} to={m.to} end={m.to === '/'}>
            <Icon name={m.icon} size={20} />
            {m.label}
          </NavLink>
        ))}
        <button type="button" className={mais ? 'active' : ''} onClick={() => setMais(true)}>
          <Icon name="menu" size={20} stroke={3} />
          Mais
        </button>
      </nav>

      {mais && (
        <div className="sheet-bg" onClick={() => setMais(false)}>
          <nav className="sheet" aria-label="Todos os módulos" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-alca" />
            {MODULOS.map((m) => (
              <NavLink key={m.to} to={m.to} end={m.to === '/'} onClick={() => setMais(false)}>
                <Icon name={m.icon} size={20} />
                <span>{m.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </div>
  )
}
