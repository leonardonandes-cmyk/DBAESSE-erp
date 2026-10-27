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

const CAMPOS = 'id,numero,canal,status,previsao,desconto,observacoes,estoque_baixado,criado_em,parceiro_id,parceiros(nome),pedido_itens(quantidade,preco_unit,sku_id)'

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
    .select('id,quantidade,preco_unit,sku_id,skus(sku,numero,cor_id,produto_id)')
    .eq('pedido_id', pedidoId)
  if (error) throw error
  return data
}

// itens: [{ sku_id, quantidade, preco_unit }]
export async function criarPedido({ parceiro_id, canal, previsao, observacoes, desconto, status, itens }) {
  if (!itens.length) throw new Error('Adicione pelo menos um item ao pedido.')
  const { data: ped, error } = await supabase
    .from('pedidos')
    .insert({ parceiro_id: parceiro_id || null, canal, previsao: previsao || null, observacoes: observacoes || null, desconto: Number(desconto) || 0, status: status || 'orcamento' })
    .select('id,numero')
    .single()
  if (error) throw error
  const { error: e2 } = await supabase
    .from('pedido_itens')
    .insert(itens.map((i) => ({ pedido_id: ped.id, sku_id: i.sku_id, quantidade: i.quantidade, preco_unit: Number(i.preco_unit) || 0 })))
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
