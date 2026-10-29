/*
  Produtos encalhados — giro de cada SKU (modelo · cor · numeração) com estoque.
  - Vendas = pedidos faturados ou entregues (data do pedido).
  - Dias sem vender = hoje − última venda daquele SKU (qualquer data).
  - Situação: ok (< 60 dias) · atenção (60–89) · ALERTA (90+) · nunca vendeu (tem estoque e nenhuma venda registrada).
  Usado pelo relatório (Relatórios › Produtos encalhados) e pelo alerta do Painel.
*/
export const VENDIDO = ['faturado', 'entregue']
export const LIMITE_ATENCAO = 60
export const LIMITE_ALERTA = 90

export const SITUACOES = {
  alerta: { label: '+90 dias', cor: '#c2321f', fundo: '#fbe7e3', ordem: 0 },
  nunca: { label: 'Nunca vendeu', cor: '#6b2fb3', fundo: '#efe7fb', ordem: 1 },
  atencao: { label: '60–89 dias', cor: '#b46b00', fundo: '#fdf0d9', ordem: 2 },
  ok: { label: 'Girando', cor: '#2f7a52', fundo: '#e5f3ea', ordem: 3 },
}

export function situacaoPorDias(dias) {
  if (dias == null) return 'nunca'
  if (dias >= LIMITE_ALERTA) return 'alerta'
  if (dias >= LIMITE_ATENCAO) return 'atencao'
  return 'ok'
}

const DIA = 864e5

// → { [sku_id]: { ultima: Date|null, v7, v30, vPer } }
export function vendasPorSku(pedidos, per) {
  const agora = new Date()
  const d7 = new Date(agora - 7 * DIA), d30 = new Date(agora - 30 * DIA)
  const m = {}
  pedidos.forEach((p) => {
    if (!VENDIDO.includes(p.status)) return
    const d = new Date(p.criado_em)
    ;(p.pedido_itens || []).forEach((i) => {
      const x = (m[i.sku_id] ||= { ultima: null, v7: 0, v30: 0, vPer: 0 })
      if (!x.ultima || d > x.ultima) x.ultima = d
      if (d >= d7) x.v7 += i.quantidade
      if (d >= d30) x.v30 += i.quantidade
      if (per && d >= per.ini && d <= per.fim) x.vPer += i.quantidade
    })
  })
  return m
}

// linhas por SKU com estoque > 0
export function linhasEncalhe({ saldos, produtos, pedidos, per, custos = {} }) {
  const skuInfo = {}
  produtos.forEach((p) => p.skus.forEach((s) => { skuInfo[s.id] = { produto: p, sku: s } }))
  const vend = vendasPorSku(pedidos, per)
  const hoje = new Date()
  return saldos.filter((s) => s.saldo > 0 && skuInfo[s.sku_id]).map((s) => {
    const { produto, sku } = skuInfo[s.sku_id]
    const v = vend[s.sku_id] || { ultima: null, v7: 0, v30: 0, vPer: 0 }
    const dias = v.ultima ? Math.floor((hoje - v.ultima) / DIA) : null
    const custoPar = custos[produto.id] ?? (produto.preco_atacado != null ? Number(produto.preco_atacado) : 0)
    return {
      sku_id: s.sku_id, produto, cor_id: sku.cor_id, numero: sku.numero, sku: sku.sku,
      saldo: s.saldo, ultima: v.ultima, dias, v7: v.v7, v30: v.v30, vPer: v.vPer,
      situacao: situacaoPorDias(dias), custoPar, comCusto: custos[produto.id] != null, valor: s.saldo * custoPar,
    }
  })
}

// agrupa as linhas por SKU em 'modelo' | 'cor' (modelo + cor) | 'sku' e recalcula a situação do grupo
export function agrupar(linhas, nivel = 'cor') {
  const g = {}
  linhas.forEach((x) => {
    const k = nivel === 'modelo' ? x.produto.id : nivel === 'cor' ? `${x.produto.id}|${x.cor_id}` : x.sku_id
    const a = (g[k] ||= { id: k, produto: x.produto, cor_id: nivel === 'modelo' ? null : x.cor_id, numero: nivel === 'sku' ? x.numero : null, sku: nivel === 'sku' ? x.sku : null, saldo: 0, v7: 0, v30: 0, vPer: 0, ultima: null, valor: 0, comCusto: x.comCusto, nums: new Set() })
    a.saldo += x.saldo; a.v7 += x.v7; a.v30 += x.v30; a.vPer += x.vPer; a.valor += x.valor
    if (x.ultima && (!a.ultima || x.ultima > a.ultima)) a.ultima = x.ultima
    if (nivel !== 'sku') a.nums.add(x.numero)
  })
  const hoje = new Date()
  return Object.values(g).map((a) => {
    const dias = a.ultima ? Math.floor((hoje - a.ultima) / DIA) : null
    const giroDia = a.v30 / 30
    return { ...a, dias, situacao: situacaoPorDias(dias), cobertura: giroDia > 0 ? a.saldo / giroDia : null, nums: [...a.nums].sort((m, n) => m - n) }
  })
}

// resumo (por modelo + cor) para o alerta do Painel
export function resumoEncalhe(args) {
  const l = agrupar(linhasEncalhe(args), 'cor')
  const graves = l.filter((x) => x.situacao === 'alerta' || x.situacao === 'nunca')
  return {
    itens: graves.length,
    modelos: new Set(graves.map((x) => x.produto.id)).size,
    pares: graves.reduce((t, x) => t + x.saldo, 0),
    valor: graves.reduce((t, x) => t + x.valor, 0),
  }
}
