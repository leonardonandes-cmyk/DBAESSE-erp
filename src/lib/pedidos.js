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

const CAMPOS = 'id,numero,canal,lista,grupo,vendedora,status,previsao,desconto,observacoes,endereco_entrega,transportadora_id,frete_por,transp:parceiros!pedidos_transportadora_id_fkey(nome,telefone),estoque_baixado,criado_em,separado_em,parceiro_id,parceiros!pedidos_parceiro_id_fkey(nome),pedido_itens(quantidade,preco_unit,sku_id,separado)'

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
// vendedora: undefined = o banco escolhe pela modalidade · '' = ninguém · nome = quem vendeu
export async function criarPedido({ parceiro_id, canal, lista, previsao, observacoes, endereco_entrega, desconto, status, itens, separado = false, vendedora, transportadora_id, frete_por }) {
  if (!itens.length) throw new Error('Adicione pelo menos um item ao pedido.')
  const { data: ped, error } = await supabase
    .from('pedidos')
    .insert({ parceiro_id: parceiro_id || null, canal, lista: lista || null, previsao: previsao || null, observacoes: observacoes || null, endereco_entrega: endereco_entrega?.trim() || null, desconto: Number(desconto) || 0, status: status || 'orcamento', separado_em: separado ? new Date().toISOString() : null, transportadora_id: transportadora_id || null, frete_por: frete_por || null, ...(vendedora !== undefined ? { vendedora } : {}) })
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

// Corrigir um pedido ainda aberto: cabeçalho + itens (grade, preço, cliente, lista).
// Mantém o que já foi separado no app (até a nova quantidade).
export async function atualizarPedido(pedidoId, { parceiro_id, canal, lista, previsao, observacoes, endereco_entrega, desconto, status, itens, vendedora, transportadora_id, frete_por }) {
  if (!itens.length) throw new Error('O pedido precisa ter pelo menos um item.')
  const { data: atual, error: e0 } = await supabase.from('pedidos').select('status,estoque_baixado').eq('id', pedidoId).single()
  if (e0) throw e0
  if (atual.estoque_baixado || ['faturado', 'entregue', 'cancelado'].includes(atual.status)) throw new Error('Pedido faturado, entregue ou cancelado não pode ser corrigido.')
  const { data: antigos, error: e1 } = await supabase.from('pedido_itens').select('sku_id,quantidade,preco_unit,separado').eq('pedido_id', pedidoId)
  if (e1) throw e1
  const sep = Object.fromEntries(antigos.map((i) => [i.sku_id, Number(i.separado) || 0]))
  const campos = { parceiro_id: parceiro_id || null, canal, lista: lista || null, previsao: previsao || null, observacoes: observacoes || null, endereco_entrega: endereco_entrega?.trim() || null, desconto: Number(desconto) || 0, transportadora_id: transportadora_id || null, frete_por: frete_por || null }
  if (vendedora !== undefined) campos.vendedora = vendedora
  if (status && atual.status === 'orcamento') campos.status = status
  const { error: e2 } = await supabase.from('pedidos').update(campos).eq('id', pedidoId)
  if (e2) throw e2
  const { error: e3 } = await supabase.from('pedido_itens').delete().eq('pedido_id', pedidoId)
  if (e3) throw e3
  const novos = itens.filter((i) => Number(i.quantidade) > 0).map((i) => ({ pedido_id: pedidoId, sku_id: i.sku_id, quantidade: Number(i.quantidade), preco_unit: Number(i.preco_unit) || 0, separado: Math.min(sep[i.sku_id] || 0, Number(i.quantidade)) }))
  const { error: e4 } = await supabase.from('pedido_itens').insert(novos)
  if (e4) {
    // devolve como estava
    await supabase.from('pedido_itens').insert(antigos.map((i) => ({ ...i, pedido_id: pedidoId })))
    throw e4
  }
  return { id: pedidoId }
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

export async function salvarDadosPedido(pedidoId, { previsao, observacoes, desconto, endereco_entrega }) {
  const { error } = await supabase
    .from('pedidos')
    .update({ previsao: previsao || null, observacoes: observacoes || null, endereco_entrega: endereco_entrega?.trim() || null, desconto: Number(desconto) || 0 })
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
