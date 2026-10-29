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
import Configuracoes from './pages/Configuracoes.jsx'
import EmBreve from './pages/EmBreve.jsx'
import AppVendas from './pages/AppVendas.jsx'
import Simulador from './pages/Simulador.jsx'
import TabelaPrecos from './pages/TabelaPrecos.jsx'
import MargemLojas from './pages/MargemLojas.jsx'
import Indicadores from './pages/Indicadores.jsx'
import MapaClientes from './pages/MapaClientes.jsx'
import Encalhados from './pages/Encalhados.jsx'
import Repasses from './pages/Repasses.jsx'
import FichasTecnicas from './pages/FichasTecnicas.jsx'
import BiparProducao from './components/BiparProducao.jsx'

// Menu = mapa dos módulos. "fase" marca o que ainda não foi construído.
export const MODULOS = [
  { to: '/', icon: 'painel', label: 'Visão geral', curto: 'Painel' },
  { to: '/pedidos', icon: 'pedidos', label: 'Pedidos e vendas', curto: 'Pedidos', grupo: 'Comercial' },
  { to: '/clientes', icon: 'clientes', label: 'Clientes', grupo: 'Comercial' },
  { to: '/app', icon: 'leitor', label: 'App vendas', grupo: 'Comercial' },
  { to: '/precos', icon: 'precos', label: 'Tabela de preços', grupo: 'Comercial' },
  { to: '/lojas', icon: 'loja', label: 'Margem por loja', grupo: 'Comercial' },
  { to: '/producao', icon: 'producao', label: 'Produção', grupo: 'Operações', exato: true },
  { to: '/producao/mapas', icon: 'ficha', label: 'Mapas e corte', grupo: 'Operações', sub: true },
  { to: '/producao/palmilhas', icon: 'ficha', label: 'Palmilhas', grupo: 'Operações', sub: true },
  { to: '/producao/pcp', icon: 'relatorios', label: 'Programação (PCP)', grupo: 'Operações', sub: true },
  { to: '/producao/bipar', icon: 'leitor', label: 'Bipar fichas', grupo: 'Operações', sub: true },
  { to: '/estoque', icon: 'estoque', label: 'Estoque', grupo: 'Operações', exato: true },
  { to: '/estoque/encalhados', icon: 'alerta', label: 'Produtos encalhados', grupo: 'Operações', sub: true },
  { to: '/compras', icon: 'compras', label: 'Compras', grupo: 'Operações' },
  { to: '/produtos', icon: 'produtos', label: 'Produtos', grupo: 'Operações' },
  { to: '/fichas', icon: 'ficha', label: 'Fichas técnicas', grupo: 'Operações', sub: true },
  { to: '/financeiro', icon: 'financeiro', label: 'Financeiro', grupo: 'Financeiro', exato: true },
  { to: '/financeiro/repasses', icon: 'financeiro', label: 'Repasses', grupo: 'Financeiro', sub: true, soDono: true },
  { to: '/indicadores', icon: 'relatorios', label: 'Indicadores', grupo: 'Relatórios' },
  { to: '/mapa', icon: 'mapa', label: 'Mapa de clientes', grupo: 'Relatórios' },
  { to: '/configuracoes', icon: 'config', label: 'Configurações', grupo: 'Cadastros' },
]
const GRUPOS = [...new Set(MODULOS.map((m) => m.grupo || ''))]

const TABBAR = ['/', '/pedidos', '/app', '/estoque']

const PAPEL = { admin: 'Administrador', gestor: 'Gestor', operador: 'Operador' }

export default function App() {
  const [sessao, setSessao] = useState(undefined)
  const [perfil, setPerfil] = useState(null)
  const [souDono, setSouDono] = useState(false)
  const [mais, setMais] = useState(false)

  // Grade: Enter pula para o próximo número (em qualquer tela). No último, vai para o botão de confirmar.
  useEffect(() => {
    function aoTeclar(e) {
      const el = e.target
      if (e.key !== 'Enter' || !(el instanceof HTMLInputElement) || !el.hasAttribute('data-grade')) return
      e.preventDefault()
      const escopo = el.closest('.modal, .card, form, .print-root') || document.body
      const campos = [...escopo.querySelectorAll('input[data-grade]')].filter((x) => !x.disabled && x.offsetParent !== null)
      const prox = campos[campos.indexOf(el) + (e.shiftKey ? -1 : 1)]
      if (prox) { prox.focus(); prox.select?.() }
      else { const ok = escopo.querySelector('[data-grade-ok]'); if (ok) ok.focus(); else el.blur() }
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!sessao) { setPerfil(null); return }
    supabase.from('perfis').select('nome,papel,empresas(nome)').eq('id', sessao.user.id).maybeSingle()
      .then(({ data }) => setPerfil(data))
    supabase.rpc('sou_dono').then(({ data }) => setSouDono(Boolean(data)))
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
          {GRUPOS.map((g) => (
            <div className="nav-grupo" key={g || 'inicio'}>
              {g && <div className="nav-titulo">{g}</div>}
              {MODULOS.filter((m) => (m.grupo || '') === g && (!m.soDono || souDono)).map((m) => (
                <NavLink key={m.to} to={m.to} end={m.to === '/' || m.exato} className={m.sub ? 'sub' : undefined}>
                  <Icon name={m.icon} size={m.sub ? 16 : 18} />
                  <span>{m.label}</span>
                  {m.fase && <span className="soon">Em breve</span>}
                </NavLink>
              ))}
            </div>
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
          <Route path="/precos" element={<TabelaPrecos />} />
          <Route path="/lojas" element={<MargemLojas />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/financeiro" element={<Financeiro />} />
          {souDono && <Route path="/financeiro/repasses" element={<Repasses />} />}
          <Route path="/compras" element={<Compras />} />
          <Route path="/relatorios" element={<Indicadores />} />
          <Route path="/indicadores" element={<Indicadores />} />
          <Route path="/mapa" element={<MapaClientes />} />
          <Route path="/estoque/encalhados" element={<Encalhados />} />
          <Route path="/encalhados" element={<Encalhados />} />
          <Route path="/fichas" element={<FichasTecnicas />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/producao" element={<Producao visao="quadro" />} />
          <Route path="/producao/mapas" element={<Producao visao="mapas" />} />
          <Route path="/producao/palmilhas" element={<Producao visao="palmilhas" />} />
          <Route path="/producao/pcp" element={<Producao visao="pcp" />} />
          <Route path="/producao/bipar" element={<BiparProducao />} />
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
            {m.curto || m.label}
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
            {MODULOS.filter((m) => !m.soDono || souDono).map((m) => (
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
