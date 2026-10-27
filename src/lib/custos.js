// Custo do par e margem por lista de preço — mesmas contas da planilha FICHA TÉCNICA

export const SECOES = [
  { id: 'cabedal', label: 'Cabedal' },
  { id: 'solado', label: 'Solado / palmilha' },
  { id: 'acabamento', label: 'Acabamento' },
  { id: 'mao_de_obra', label: 'Mão de obra' },
  { id: 'rateio', label: 'Custo fixo (rateio)' },
]

// valor por par de uma linha da ficha
export function valorLinha(l) {
  const custo = l.custo_proprio != null ? Number(l.custo_proprio) : Number(l.materiais?.custo || 0)
  return custo * Number(l.consumo || 0) * (1 + Number(l.perda_pct || 0) / 100)
}

export function custoFicha(linhas) {
  const porSecao = Object.fromEntries(SECOES.map((s) => [s.id, 0]))
  let total = 0
  ;(linhas || []).forEach((l) => { const v = valorLinha(l); porSecao[l.secao] = (porSecao[l.secao] || 0) + v; total += v })
  return { total, porSecao }
}

// custo por produto (mapa produto_id -> custo) a partir de TODAS as linhas de ficha
export function custosPorProduto(linhas) {
  const m = {}
  ;(linhas || []).forEach((l) => { m[l.produto_id] = (m[l.produto_id] || 0) + valorLinha(l) })
  return m
}

/*
  Margem na lista:
  despesas = Σ(pct × preço + R$)            (comissão, imposto, frete, perda, investimento…)
  lucro    = preço − custo − despesas         margem = lucro ÷ preço
  preço ideal = (custo + Σ R$) ÷ (1 − Σ pct − margem-alvo)
*/
export function margemNaLista(custo, preco, lista) {
  const desp = Array.isArray(lista?.despesas) ? lista.despesas : []
  const somaPct = desp.reduce((t, d) => t + Number(d.pct || 0), 0)
  const somaRs = desp.reduce((t, d) => t + Number(d.rs || 0), 0)
  const p = Number(preco || 0)
  const despesas = p * somaPct + somaRs
  const lucro = p - custo - despesas
  const margem = p > 0 ? lucro / p : null
  const div = 1 - somaPct - Number(lista?.margem_alvo || 0)
  const ideal = div > 0 && custo > 0 ? (custo + somaRs) / div : null
  return { despesas, lucro, margem, ideal, somaPct, somaRs }
}

// semáforo igual ao da planilha (ML baixa < 10%, alerta < 20%)
export const tomMargem = (m) => (m == null ? 'neutral' : m < 0.1 ? 'bad' : m < 0.2 ? 'warn' : 'ok')
export const pct = (v) => (v == null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
