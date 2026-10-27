import { supabase } from './supabase.js'

// Listas de preço: preço = preço-base do modelo (atacado ou varejo/FERALCCI) + acréscimo da lista
export async function listarListas() {
  const { data, error } = await supabase.from('listas_preco').select('id,codigo,nome,base,acrescimo,descricao,ordem').order('ordem')
  if (error) throw error
  return data
}

export async function salvarLista(id, { acrescimo, descricao }) {
  const { error } = await supabase.from('listas_preco')
    .update({ acrescimo: Number(String(acrescimo).replace(',', '.')) || 0, descricao: descricao || null }).eq('id', id)
  if (error) throw error
}

// Lista sugerida para cada canal (o cliente pode ter a dele, que manda)
export const LISTA_POR_CANAL = {
  Atacado: 'atacado', Revenda: 'variado', Drop: 'drop',
  Shopee: 'varejo', 'TikTok Shop': 'varejo', 'Mercado Livre': 'varejo', Instagram: 'varejo', 'Loja / varejo': 'varejo',
}
export const listaSugerida = (cliente, canal) => cliente?.lista || LISTA_POR_CANAL[canal] || 'atacado'

export function precoNaLista(produto, lista) {
  if (!produto) return 0
  const base = lista?.base === 'varejo' ? (produto.preco_varejo ?? produto.preco_atacado) : produto.preco_atacado
  if (base == null) return 0
  return Math.round((Number(base) + Number(lista?.acrescimo || 0)) * 100) / 100
}
