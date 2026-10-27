import { supabase, todas } from './supabase.js'

export const STATUS_PEDIDO = {
  orcamento: { label: 'Orçamento', tom: 'neutral', ordem: 0 },
  aprovado: { label: 'Aprovado', tom: 'info', ordem: 1 },
  producao: { label: 'Em produção', tom: 'warn', ordem: 2 },
  separacao: { label: 'Separação', tom: 'info', ordem: 3 },
  faturado: { label: 'Faturado', tom: 'ok', ordem: 4 },
  entregue: { label: 'Entregue', tom: 'ok', ordem: 5 },
  cancelado: { label: 'Cancelado', tom: 'bad', ordem: 9 },
}
export const FLUXO = ['orcamento', 'aprovado', 'producao', 'separacao', 'faturado', 'entregue']
export const ABERTOS = ['orcamento', 'aprovado', 'producao', 'separacao']

const CAMPOS = 'id,numero,canal,lista,status,previsao,desconto,observacoes,estoque_baixado,criado_em,separado_em,parceiro_id,parceiros(nome),pedido_itens(quantidade,preco_unit,sku_id,separado)'

export function totaisPedido(p) {
  const pares = (p.pedido_itens || []).reduce((t, i) => t + i.quantidade, 0)
  const bruto = (p.pedido_itens || []).reduce((t, i) => t + i.quantidade * Number(i.preco_unit), 0)
  return { pares, bruto, total: Math.max(0, bruto - Number(p.desconto || 0)) }
}

export function atrasado(p) {
  if (!p.previsao || !ABERTOS.includes(p.status)) return false
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return new Date(`${p.previsao}T12:00:00`) < hoje
}

export async function listarPedidos() {
  const data = await todas(() => supabase.from('pedidos').select(CAMPOS).order('numero', { ascending: false }))
  return data
}

export async function carregarItens(pedidoId) {
  const { data, error } = await supabase
    .from('pedido_itens')
    .select('id,quantidade,preco_unit,sku_id,separado,skus(sku,numero,cor_id,produto_id)')
    .eq('pedido_id', pedidoId)
  if (error) throw error
  return data
}

// itens: [{ sku_id, quantidade, preco_unit }]
// separado = true: pedido montado bipando os pares (app) — já nasce separado
export async function criarPedido({ parceiro_id, canal, lista, previsao, observacoes, desconto, status, itens, separado = false }) {
  if (!itens.length) throw new Error('Adicione pelo menos um item ao pedido.')
  const { data: ped, error } = await supabase
    .from('pedidos')
    .insert({ parceiro_id: parceiro_id || null, canal, lista: lista || null, previsao: previsao || null, observacoes: observacoes || null, desconto: Number(desconto) || 0, status: status || 'orcamento', separado_em: separado ? new Date().toISOString() : null })
    .select('id,numero')
    .single()
  if (error) throw error
  const { error: e2 } = await supabase
    .from('pedido_itens')
    .insert(itens.map((i) => ({ pedido_id: ped.id, sku_id: i.sku_id, quantidade: i.quantidade, preco_unit: Number(i.preco_unit) || 0, separado: separado ? i.quantidade : 0 })))
  if (e2) {
    await supabase.from('pedidos').delete().eq('id', ped.id)
    throw e2
  }
  return ped
}

export async function mudarStatus(pedidoId, status) {
  if (status === 'faturado') {
    const { error } = await supabase.rpc('faturar_pedido', { p_pedido: pedidoId })
    if (error) throw error
    return
  }
  if (status === 'cancelado') {
    const { error } = await supabase.rpc('cancelar_pedido', { p_pedido: pedidoId })
    if (error) throw error
    return
  }
  const { error } = await supabase.from('pedidos').update({ status }).eq('id', pedidoId)
  if (error) throw error
}

export async function salvarDadosPedido(pedidoId, { previsao, observacoes, desconto }) {
  const { error } = await supabase
    .from('pedidos')
    .update({ previsao: previsao || null, observacoes: observacoes || null, desconto: Number(desconto) || 0 })
    .eq('id', pedidoId)
  if (error) throw error
}

// App: bipou um par na separação (delta 1) ou desfez (delta -1)
const ERROS_SEPARACAO = {
  JA_COMPLETO: 'Esse par já está todo separado.',
  NAO_ESTA_NO_PEDIDO: 'Esse produto não está no pedido.',
  NADA_PARA_DESFAZER: 'Nada para desfazer.',
}
export async function separarItem(pedidoId, skuId, delta = 1) {
  const { data, error } = await supabase.rpc('separar_item', { p_pedido: pedidoId, p_sku: skuId, p_delta: delta })
  if (error) {
    const cod = Object.keys(ERROS_SEPARACAO).find((k) => error.message?.includes(k))
    const e = new Error(cod ? ERROS_SEPARACAO[cod] : error.message)
    e.codigo = cod
    throw e
  }
  return data
}
