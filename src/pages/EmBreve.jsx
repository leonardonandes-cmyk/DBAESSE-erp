import { Link } from 'react-router-dom'
import Icon from '../components/Icon.jsx'

export default function EmBreve({ modulo }) {
  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Fase {modulo.fase} do plano</div>
          <h1>{modulo.label}</h1>
        </div>
      </header>
      <section className="card empty">
        <span className="alert-num" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', width: 56, height: 56, borderRadius: 14 }}>
          <Icon name={modulo.icon} size={24} />
        </span>
        <h2>Em construção</h2>
        <p>Este módulo entra na fase {modulo.fase}. Começamos pelos cadastros e pela produção, e cada parte nova entra em uso assim que fica pronta.</p>
        <Link to="/" className="btn">Voltar ao painel</Link>
      </section>
    </>
  )
}
