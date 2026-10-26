import { NavLink, Route, Routes } from 'react-router-dom'
import Icon from './components/Icon.jsx'
import { EMPRESA } from './data/mock.js'
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

export default function App() {
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
        </div>
      </aside>

      <main className="main">
        <div className="mobile-top">
          <div className="brand-word">{EMPRESA.nome}</div>
          <button className="btn icon-btn" aria-label="Notificações"><Icon name="sino" /></button>
        </div>
        <Routes>
          <Route path="/" element={<Painel />} />
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
