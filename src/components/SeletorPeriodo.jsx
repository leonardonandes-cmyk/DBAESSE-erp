/*
  Período livre para relatórios: atalhos rápidos, um mês, um ano ou datas de/até.
  valor = { modo, rapido, mes: 'AAAA-MM', ano: 'AAAA', de: 'AAAA-MM-DD', ate: 'AAAA-MM-DD' }
*/
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const RAPIDOS = [
  { id: 'hoje', label: 'Hoje' }, { id: '7', label: 'Últimos 7 dias' }, { id: 'mes', label: 'Este mês' }, { id: 'mesant', label: 'Mês passado' },
  { id: '30', label: 'Últimos 30 dias' }, { id: '90', label: 'Últimos 3 meses' }, { id: '180', label: 'Últimos 6 meses' },
  { id: '365', label: 'Últimos 12 meses' }, { id: 'ano', label: 'Este ano' }, { id: 'tudo', label: 'Desde o início' },
]
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const br = (d) => d.toLocaleDateString('pt-BR')

export function periodoPadrao(rapido = '90') {
  const h = new Date()
  return { modo: 'rapido', rapido, mes: iso(h).slice(0, 7), ano: String(h.getFullYear()), de: iso(new Date(h.getFullYear(), h.getMonth(), 1)), ate: iso(h) }
}

// → { ini, fim, rotulo, dias }  (fim = fim do último dia)
export function resolverPeriodo(v) {
  const h = new Date()
  const dia0 = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
  const dia1 = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }
  let ini, fim, rotulo
  if (v.modo === 'mes') {
    const [a, m] = v.mes.split('-').map(Number)
    ini = new Date(a, m - 1, 1); fim = dia1(new Date(a, m, 0)); rotulo = `${MESES[m - 1]} de ${a}`
  } else if (v.modo === 'ano') {
    const a = Number(v.ano); ini = new Date(a, 0, 1); fim = dia1(new Date(a, 11, 31)); rotulo = `ano de ${a}`
  } else if (v.modo === 'livre') {
    ini = dia0(new Date(`${v.de}T12:00:00`)); fim = dia1(new Date(`${v.ate}T12:00:00`))
    if (fim < ini) [ini, fim] = [dia0(fim), dia1(ini)]
    rotulo = `${br(ini)} a ${br(fim)}`
  } else {
    fim = dia1(h)
    const r = v.rapido
    if (r === 'hoje') ini = dia0(h)
    else if (r === 'mes') ini = new Date(h.getFullYear(), h.getMonth(), 1)
    else if (r === 'mesant') { ini = new Date(h.getFullYear(), h.getMonth() - 1, 1); fim = dia1(new Date(h.getFullYear(), h.getMonth(), 0)) }
    else if (r === 'ano') ini = new Date(h.getFullYear(), 0, 1)
    else if (r === 'tudo') ini = new Date(2023, 0, 1)
    else { ini = dia0(h); ini.setDate(ini.getDate() - Number(r) + 1) }
    rotulo = `${RAPIDOS.find((x) => x.id === r)?.label.toLowerCase()} · ${br(ini)} a ${br(fim)}`
  }
  return { ini, fim, rotulo, dias: Math.max(1, Math.round((fim - ini) / 864e5)) }
}

// período anterior de mesmo tamanho (para comparar)
export function periodoAnterior({ ini, fim }) {
  const dur = fim - ini
  return { ini: new Date(ini - dur - 1), fim: new Date(ini - 1) }
}

export default function SeletorPeriodo({ valor, onChange }) {
  const set = (patch) => onChange({ ...valor, ...patch })
  const anos = Array.from({ length: new Date().getFullYear() - 2022 }, (_, i) => String(new Date().getFullYear() - i))
  return (
    <div className="seletor-periodo">
      <div className="segmented" role="group" aria-label="Tipo de período">
        {[['rapido', 'Rápido'], ['mes', 'Mês'], ['ano', 'Ano'], ['livre', 'De / até']].map(([id, l]) => (
          <button key={id} type="button" className={valor.modo === id ? 'on' : ''} onClick={() => set({ modo: id })}>{l}</button>
        ))}
      </div>
      {valor.modo === 'rapido' && (
        <select className="input" value={valor.rapido} onChange={(e) => set({ rapido: e.target.value })} aria-label="Período">
          {RAPIDOS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      )}
      {valor.modo === 'mes' && <input className="input" type="month" value={valor.mes} onChange={(e) => e.target.value && set({ mes: e.target.value })} aria-label="Mês" />}
      {valor.modo === 'ano' && (
        <select className="input" value={valor.ano} onChange={(e) => set({ ano: e.target.value })} aria-label="Ano">
          {anos.map((a) => <option key={a}>{a}</option>)}
        </select>
      )}
      {valor.modo === 'livre' && (
        <span className="periodo-livre">
          <input className="input" type="date" value={valor.de} onChange={(e) => e.target.value && set({ de: e.target.value })} aria-label="De" />
          <span>até</span>
          <input className="input" type="date" value={valor.ate} onChange={(e) => e.target.value && set({ ate: e.target.value })} aria-label="Até" />
        </span>
      )}
    </div>
  )
}
