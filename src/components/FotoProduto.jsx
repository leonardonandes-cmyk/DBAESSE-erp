import { useState } from 'react'
import Icon from './Icon.jsx'
import { desenhoDoTipo } from '../lib/produtos.js'

// Ordem: foto da COR (produtos.fotos[cor_id]) → foto principal do modelo → desenho do tipo → ícone
export function fotoDe(p, corId) {
  return (corId && p?.fotos?.[corId]) || p?.foto_url || null
}

export function FotoProduto({ p, corId, size = 22, className = '' }) {
  const foto = fotoDe(p, corId)
  const desenho = desenhoDoTipo(p?.tipo)
  const [falhou, setFalhou] = useState(0) // 1 = foto quebrou, 2 = desenho também
  const src = falhou === 0 && foto ? foto : falhou <= 1 && desenho ? desenho : null
  const ehFoto = src && src === foto
  return (
    <div className={`thumb ${className}`}>
      {src
        ? <img key={src} src={src} alt="" loading="lazy" className={ehFoto ? '' : 'desenho'} onError={() => setFalhou(ehFoto ? 1 : 2)} />
        : <Icon name="sapato" size={size} stroke={1.2} />}
    </div>
  )
}

// Célula padrão "foto + REF · nome + linha de baixo" usada nas listas
export default function ProdutoCelula({ p, cor, linha2, extra, tamanho = 'sm' }) {
  return (
    <div className="prod-cell">
      <FotoProduto p={p} corId={cor?.id} className={tamanho} size={18} />
      <div>
        <b>{p?.ref} · {p?.nome}</b>{extra}
        {linha2 && <span>{linha2}</span>}
      </div>
    </div>
  )
}
