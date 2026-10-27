import Icon from './Icon.jsx'
import { desenhoDoTipo } from '../lib/produtos.js'

// Foto do modelo; sem foto, usa o desenho do tipo; sem desenho, o ícone
export function FotoProduto({ p, size = 22, className = '' }) {
  const src = p?.foto_url || desenhoDoTipo(p?.tipo)
  return (
    <div className={`thumb ${className}`}>
      {src ? <img src={src} alt="" loading="lazy" className={p?.foto_url ? '' : 'desenho'} /> : <Icon name="sapato" size={size} stroke={1.2} />}
    </div>
  )
}

// Célula padrão "foto + REF · nome + linha de baixo" usada nas listas
export default function ProdutoCelula({ p, linha2, extra, tamanho = 'sm' }) {
  return (
    <div className="prod-cell">
      <FotoProduto p={p} className={tamanho} size={18} />
      <div>
        <b>{p?.ref} · {p?.nome}</b>{extra}
        {linha2 && <span>{linha2}</span>}
      </div>
    </div>
  )
}
