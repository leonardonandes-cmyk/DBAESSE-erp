// Custo do par e margem por lista de preço — mesmas contas da planilha FICHA TÉCNICA

export const SECOES = [
  { id: 'cabedal', label: 'Cabedal' },
  { id: 'solado', label: 'Solado / palmilha' },
  { id: 'acabamento', label: 'Acabamento' },
  { id: 'mao_de_obra', label: 'Mão de obra' },
  { id: 'rateio', label: 'Custo fixo (rateio)' },
]

// Blocos de exibição da ficha (mão de obra separada em MDI/MDE pelo nome do material, como na planilha)
export const BLOCOS = [
  { id: 'cabedal', secao: 'cabedal', nome: 'Cabedal', cor: '#8A5A32' },
  { id: 'solado', secao: 'solado', nome: 'Solado e palmilha', curto: 'Solado e palmilha', cor: '#6B5E52' },
  { id: 'acabamento', secao: 'acabamento', nome: 'Acabamento', cor: '#C9A27E' },
  { id: 'mdi', secao: 'mao_de_obra', nome: 'MDI · mão de obra interna', curto: 'MDI', cor: '#2F5D46' },
  { id: 'mde', secao: 'mao_de_obra', nome: 'MDE · mão de obra externa', curto: 'MDE', cor: '#7FA38A' },
  { id: 'rateio', secao: 'rateio', nome: 'Rateio · custo fixo', curto: 'Rateio', cor: '#B9B3AA' },
]
export const ehMDE = (nome) => /^\s*MDE/i.test(nome || '')
export const blocoDe = (l) => (l.secao === 'mao_de_obra' ? (ehMDE(l.materiais?.nome) ? 'mde' : 'mdi') : l.secao)

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
