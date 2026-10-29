import { supabase } from './supabase.js'

// Listas de preço: preço = preço-base do modelo (atacado ou varejo/FERALCCI) + acréscimo da lista
export async function listarListas() {
  const { data, error } = await supabase.from('listas_preco').select('id,codigo,nome,base,acrescimo,descricao,ordem,despesas,margem_alvo').order('ordem')
  if (error) throw error
  return data
}

export async function salvarLista(id, { acrescimo, descricao, despesas, margem_alvo }) {
  const n = (v) => Number(String(v ?? 0).replace(',', '.')) || 0
  const linha = { acrescimo: n(acrescimo), descricao: descricao || null }
  if (despesas) linha.despesas = despesas.filter((d) => d.nome?.trim()).map((d) => ({ nome: d.nome.trim(), pct: n(d.pct), rs: n(d.rs) }))
  if (margem_alvo != null) linha.margem_alvo = n(margem_alvo)
  const { error } = await supabase.from('listas_preco').update(linha).eq('id', id)
  if (error) throw error
}

// Lista sugerida para cada canal (o cliente pode ter a dele, que manda)
export const LISTA_POR_CANAL = {
  Atacado: 'atacado', Variado: 'variado', Drop: 'drop',
  Shopee: 'varejo', 'TikTok Shop': 'varejo', 'Mercado Livre': 'varejo', Instagram: 'varejo', 'Loja / varejo': 'varejo',
}
// a lista segue SEMPRE o segmento do pedido (a vendedora não troca)
// exceção: cliente com CONDIÇÃO ESPECIAL (ligada só pelo admin) usa a lista do cadastro em qualquer segmento
export const temCondicao = (cliente) => Boolean(cliente?.condicao_especial && cliente?.lista)
export const listaSugerida = (cliente, canal) => (temCondicao(cliente) ? cliente.lista : LISTA_POR_CANAL[canal] || 'atacado')
export const descontoPar = (cliente) => (temCondicao(cliente) ? Number(cliente.desconto_par) || 0 : 0)

// preço do par para ESTE cliente: lista − desconto por par da condição especial
export function precoCliente(produto, lista, cliente) {
  const p = precoNaLista(produto, lista)
  if (!p) return 0
  return Math.max(0, Math.round((p - descontoPar(cliente)) * 100) / 100)
}

// texto curto da condição: "Atacado − R$ 1,00/par"
export function textoCondicao(cliente, listas = []) {
  if (!temCondicao(cliente)) return ''
  const nome = listas.find((l) => l.codigo === cliente.lista)?.nome || cliente.lista
  const d = descontoPar(cliente)
  return d ? `${nome} − R$ ${d.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/par` : nome
}

export function precoNaLista(produto, lista) {
  if (!produto) return 0
  const base = lista?.base === 'varejo' ? (produto.preco_varejo ?? produto.preco_atacado) : produto.preco_atacado
  if (base == null) return 0
  return Math.round((Number(base) + Number(lista?.acrescimo || 0)) * 100) / 100
}
