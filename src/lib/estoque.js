import { supabase } from './supabase.js'

// Saldo de cada SKU (entradas − saídas ± ajustes)
export async function listarSaldos() {
  const { data, error } = await supabase
    .from('estoque_saldos')
    .select('sku_id,produto_id,cor_id,numero,sku,saldo,saldo_bulk,saldo_pick')
  if (error) throw error
  return data
}

export const LOCAIS = {
  bulk: { label: 'Bulk', desc: 'caixas master fechadas' },
  pick: { label: 'Pick', desc: 'pares avulsos para separação' },
}

// local: undefined = total; 'bulk' | 'pick' = só aquele local
export function saldoPorSku(saldos, local) {
  const campo = local ? `saldo_${local}` : 'saldo'
  return Object.fromEntries(saldos.map((s) => [s.sku_id, s[campo] ?? 0]))
}

// Replenishment: move pares entre locais. itens: [{ sku_id, quantidade }]
export async function transferirEstoque(itens, de, para, obs) {
  const { data, error } = await supabase.rpc('transferir_estoque', {
    p_itens: itens.filter((i) => i.quantidade > 0).map((i) => ({ sku_id: i.sku_id, quantidade: i.quantidade })),
    p_de: de, p_para: para, p_obs: obs || null,
  })
  if (error) throw error
  return data
}

// linhas: [{ sku_id, tipo: 'entrada'|'saida'|'ajuste', quantidade, motivo, observacao, local }]
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
    .select('id,tipo,quantidade,motivo,observacao,local,criado_em,pedido_id,skus(sku)')
    .order('criado_em', { ascending: false })
    .limit(limite)
  if (error) throw error
  return data
}
