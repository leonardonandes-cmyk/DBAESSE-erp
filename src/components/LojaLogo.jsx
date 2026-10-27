import { useState } from 'react'

// Logo oficial da loja (public/logos/<codigo>.png); sem arquivo, cai para a bolinha na cor da loja
export default function LojaLogo({ canal, size = 18, className = '' }) {
  const [falhou, setFalhou] = useState(false)
  if (!canal) return null
  if (falhou) return <i className={`loja-dot ${className}`} style={{ background: canal.cor, width: size * 0.6, height: size * 0.6 }} />
  return <img className={`loja-logo ${className}`} src={`/logos/${canal.codigo}.png`} alt="" width={size} height={size} onError={() => setFalhou(true)} />
}
