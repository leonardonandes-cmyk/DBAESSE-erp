import { useState } from 'react'
import Icon from './Icon.jsx'
import { desenhoDoTipo } from '../lib/produtos.js'

// Com cor: só a foto DAQUELA cor (nunca a de outra cor, para não confundir) → desenho do tipo → ícone.
// Sem cor (lista de modelos): foto principal do modelo.
export function fotoDe(p, corId) {
  if (corId) return p?.fotos?.[corId] || null
  return p?.foto_url || null
}

export function FotoProduto({ p, corId, size = 22, className = '' }) {
  const foto = fotoDe(p, corId)
  const desenho = desenhoDoTipo(p?.tipo)
  const [falhou, setFalhou] = useState(0) // 1 = foto quebrou, 2 = desenho também
  const src = falhou === 0 && foto ? foto : falhou <= 1 && desenho ? desenho : null
  const ehFoto = src && src === foto
  // sem classe de tamanho: a caixa segue o size (quadrada até 28px, 5:6 acima), e o ícone cabe dentro
  const livre = !className && size > 24
  const caixa = livre ? { width: size, height: size <= 28 ? size : Math.round(size * 1.2), borderRadius: size <= 28 ? '50%' : Math.max(6, Math.round(size / 7)) } : undefined
  return (
    <div className={`thumb ${className}`} style={caixa}>
      {src
        ? <img key={src} src={src} alt="" loading="lazy" className={ehFoto ? '' : 'desenho'} onError={() => setFalhou(ehFoto ? 1 : 2)} />
        : <Icon name="sapato" size={livre ? Math.round(size * 0.6) : size} stroke={1.2} />}
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
