import { supabase } from './supabase.js'

// Saldo de cada SKU (entradas − saídas ± ajustes)
export async function listarSaldos() {
  const { data, error } = await supabase
    .from('estoque_saldos')
    .select('sku_id,produto_id,cor_id,numero,sku,saldo')
  if (error) throw error
  return data
}

export function saldoPorSku(saldos) {
  return Object.fromEntries(saldos.map((s) => [s.sku_id, s.saldo]))
}

// linhas: [{ sku_id, tipo: 'entrada'|'saida'|'ajuste', quantidade, motivo, observacao }]
export async function registrarMovimentos(linhas) {
  const validas = linhas.filter((l) => l.quantidade && Number.isFinite(l.quantidade))
  if (!validas.length) throw new Error('Nenhuma quantidade informada.')
  const { error } = await supabase.from('estoque_movimentos').insert(validas)
  if (error) throw error
  return validas.length
}

export async function ultimosMovimentos(limite = 25) {
  const { data, error } = await supabase
    .from('estoque_movimentos')
    .select('id,tipo,quantidade,motivo,observacao,criado_em,pedido_id,skus(sku)')
    .order('criado_em', { ascending: false })
    .limit(limite)
  if (error) throw error
  return data
}
