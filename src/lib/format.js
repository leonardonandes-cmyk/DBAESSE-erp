export const brl = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const brlCurto = (v) => {
  const n = Number(v) || 0
  if (n >= 1000) return `R$ ${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return brl(n)
}

export const inteiro = (v) => (Number(v) || 0).toLocaleString('pt-BR')

export const dataBR = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export const dataHoraBR = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

export const numeroPedido = (n) => `PV-${String(n).padStart(4, '0')}`

export const hojeISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const soDigitos = (s) => String(s || '').replace(/\D/g, '')

export function linkWhats(tel) {
  let d = soDigitos(tel)
  if (!d) return null
  if (d.length <= 11) d = `55${d}`
  return `https://wa.me/${d}`
}
