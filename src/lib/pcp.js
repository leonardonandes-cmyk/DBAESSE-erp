import { OP_ABERTAS, paresOP } from './producao.js'

/*
  PCP — programação das OPs abertas pela capacidade da fábrica.
  Capacidade do dia = setor gargalo (menor capacidade entre os setores ativos).
  A fila segue a sequência definida (↑↓); sem sequência: urgente primeiro, depois prazo, depois número.
  Cada OP ocupa os pares que ainda faltam (descontando as etapas já concluídas) e pode atravessar dias.
*/
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function filaPCP(ops) {
  return ops.filter((o) => OP_ABERTAS.includes(o.status)).sort((a, b) => {
    const sa = a.sequencia ?? 1e9, sb = b.sequencia ?? 1e9
    if (sa !== sb) return sa - sb
    const ua = a.prioridade === 'urgente' ? 0 : 1, ub = b.prioridade === 'urgente' ? 0 : 1
    if (ua !== ub) return ua - ub
    const pa = a.prazo || '9999', pb = b.prazo || '9999'
    if (pa !== pb) return pa < pb ? -1 : 1
    return a.numero - b.numero
  })
}

export function paresRestantes(o) {
  const tot = o.op_etapas?.length || 0
  const feitas = (o.op_etapas || []).filter((e) => e.status === 'concluida').length
  return Math.max(0, Math.round(paresOP(o) * (tot ? 1 - feitas / tot : 1)))
}

export function programar({ ops, setores, diasTrabalho = [1, 2, 3, 4, 5], minDias = 10 }) {
  const ativos = setores.filter((s) => s.ativo !== false)
  const gargalo = ativos.reduce((m, s) => (!m || (s.capacidade_dia || 600) < (m.capacidade_dia || 600) ? s : m), null)
  const cap = gargalo?.capacidade_dia || 600
  const fila = filaPCP(ops)
  const dias = []
  const novoDia = (base) => {
    const d = new Date(base); d.setHours(12, 0, 0, 0)
    while (!diasTrabalho.includes(d.getDay())) d.setDate(d.getDate() + 1)
    const dia = { data: iso(d), dt: d, carga: 0, ops: [] }
    dias.push(dia); return dia
  }
  let dia = novoDia(new Date())
  const porOP = {}
  fila.forEach((o) => {
    let falta = paresRestantes(o)
    const reg = { ini: null, fim: null, pares: falta }
    if (falta === 0) { reg.ini = reg.fim = dia.data }
    while (falta > 0) {
      if (dia.carga >= cap) { const prox = new Date(dia.dt); prox.setDate(prox.getDate() + 1); dia = novoDia(prox) }
      const q = Math.min(falta, cap - dia.carga)
      dia.carga += q; dia.ops.push({ op: o, pares: q }); falta -= q
      reg.ini ||= dia.data; reg.fim = dia.data
    }
    const atraso = o.prazo && reg.fim > o.prazo ? Math.round((new Date(`${reg.fim}T12:00:00`) - new Date(`${o.prazo}T12:00:00`)) / 864e5) : 0
    porOP[o.id] = { ...reg, atraso }
  })
  while (dias.length < minDias) { const prox = new Date(dias[dias.length - 1].dt); prox.setDate(prox.getDate() + 1); novoDia(prox) }
  const total = fila.reduce((t, o) => t + porOP[o.id].pares, 0)
  return { cap, gargalo, fila, dias, porOP, total, fim: fila.length ? porOP[fila[fila.length - 1].id].fim : null }
}
