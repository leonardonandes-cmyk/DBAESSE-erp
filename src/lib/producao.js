import { supabase } from './supabase.js'

export const STATUS_OP = {
  aberta: { label: 'Aberta', tom: 'neutral' },
  em_producao: { label: 'Em produção', tom: 'warn' },
  concluida: { label: 'Concluída', tom: 'ok' },
  cancelada: { label: 'Cancelada', tom: 'bad' },
}
export const OP_ABERTAS = ['aberta', 'em_producao']

export const numeroOP = (n) => `OP-${String(n).padStart(4, '0')}`

export async function listarSetores() {
  const { data, error } = await supabase.from('setores').select('id,nome,ordem,ativo').order('ordem')
  if (error) throw error
  return data
}

export async function salvarSetor({ id, nome, ordem, ativo }) {
  const linha = { nome: nome.trim(), ordem: Number(ordem) || 0, ativo: ativo ?? true }
  const q = id ? supabase.from('setores').update(linha).eq('id', id) : supabase.from('setores').insert(linha)
  const { error } = await q
  if (error) throw error
}

const CAMPOS = 'id,numero,status,prioridade,prazo,observacao,estoque_lancado,concluida_em,criado_em,produto_id,cor_id,pedido_id,' +
  'produtos(ref,nome,tipo,foto_url),cores(nome,hex,sigla),pedidos(numero),' +
  'op_itens(id,quantidade,sku_id,skus(numero,sku)),' +
  'op_etapas(id,setor_id,ordem,status,inicio,fim,qtd_ok,qtd_perda,responsavel,observacao)'

export async function listarOPs() {
  const { data, error } = await supabase.from('ordens_producao').select(CAMPOS).order('numero', { ascending: false })
  if (error) throw error
  return data.map((o) => ({
    ...o,
    op_itens: (o.op_itens || []).sort((a, b) => a.skus.numero - b.skus.numero),
    op_etapas: (o.op_etapas || []).sort((a, b) => a.ordem - b.ordem),
  }))
}

export const paresOP = (o) => (o.op_itens || []).reduce((t, i) => t + i.quantidade, 0)

export function atrasadaOP(o) {
  if (!o.prazo || !OP_ABERTAS.includes(o.status)) return false
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return new Date(`${o.prazo}T12:00:00`) < hoje
}

// setor onde a OP está agora (primeira etapa não concluída)
export function etapaAtual(o) {
  return (o.op_etapas || []).find((e) => e.status !== 'concluida') || null
}

export async function criarOP({ produto_id, cor_id, pedido_id, prazo, prioridade, observacao, itens }) {
  const validos = itens.filter((i) => i.quantidade > 0)
  if (!validos.length) throw new Error('Informe a quantidade de pelo menos um número.')
  const { data: op, error } = await supabase
    .from('ordens_producao')
    .insert({ produto_id, cor_id, pedido_id: pedido_id || null, prazo: prazo || null, prioridade: prioridade || 'normal', observacao: observacao || null })
    .select('id,numero')
    .single()
  if (error) throw error
  const { error: e2 } = await supabase.from('op_itens').insert(validos.map((i) => ({ op_id: op.id, sku_id: i.sku_id, quantidade: i.quantidade })))
  if (e2) {
    await supabase.from('ordens_producao').delete().eq('id', op.id)
    throw e2
  }
  return op
}

export async function atualizarEtapa(id, campos) {
  const { error } = await supabase.from('op_etapas').update(campos).eq('id', id)
  if (error) throw error
}

export async function concluirOP(id) {
  const { error } = await supabase.rpc('concluir_op', { p_op: id })
  if (error) throw error
}

export async function cancelarOP(id) {
  const { error } = await supabase.from('ordens_producao').update({ status: 'cancelada' }).eq('id', id)
  if (error) throw error
}

export async function salvarDadosOP(id, { prazo, prioridade, observacao }) {
  const { error } = await supabase.from('ordens_producao').update({ prazo: prazo || null, prioridade, observacao: observacao || null }).eq('id', id)
  if (error) throw error
}

/*
  Sugestão de OPs a partir dos pedidos em aberto:
  falta por SKU = demanda dos pedidos (aprovado/produção/separação) − saldo em estoque − já em OP aberta.
  Agrupa por modelo + cor. Retorna [{ produto, cor, itens:[{sku_id, numero, quantidade}], pedidos:[numeros] }]
*/
export function sugerirOPs({ pedidosAbertos, itensPedidos, saldos, ops, produtos, cores }) {
  const demanda = {}
  const origem = {}
  const idPorNumero = {}
  itensPedidos.forEach((i) => {
    demanda[i.sku_id] = (demanda[i.sku_id] || 0) + i.quantidade
    ;(origem[i.sku_id] ||= new Set()).add(i.pedido_numero)
    idPorNumero[i.pedido_numero] = i.pedido_id
  })
  const emOP = {}
  ops.filter((o) => OP_ABERTAS.includes(o.status)).forEach((o) => o.op_itens.forEach((i) => { emOP[i.sku_id] = (emOP[i.sku_id] || 0) + i.quantidade }))
  const skuInfo = {}
  produtos.forEach((p) => p.skus.forEach((s) => { skuInfo[s.id] = { ...s, produto: p } }))
  const corPorId = Object.fromEntries(cores.map((c) => [c.id, c]))
  const grupos = {}
  Object.entries(demanda).forEach(([skuId, qtd]) => {
    const falta = qtd - Math.max(0, saldos[skuId] || 0) - (emOP[skuId] || 0)
    if (falta <= 0 || !skuInfo[skuId]) return
    const s = skuInfo[skuId]
    const k = `${s.produto.id}|${s.cor_id}`
    const g = (grupos[k] ||= { chave: k, produto: s.produto, cor: corPorId[s.cor_id], itens: [], pedidos: new Set() })
    g.itens.push({ sku_id: skuId, numero: s.numero, quantidade: falta })
    origem[skuId].forEach((n) => g.pedidos.add(n))
  })
  void pedidosAbertos
  return Object.values(grupos).map((g) => {
    const pedidos = [...g.pedidos].sort((a, b) => a - b)
    return { ...g, itens: g.itens.sort((a, b) => a.numero - b.numero), pedidos, pedido_id: pedidos.length === 1 ? idPorNumero[pedidos[0]] : null }
  })
}

export async function itensDosPedidosAbertos() {
  const { data, error } = await supabase
    .from('pedido_itens')
    .select('sku_id,quantidade,pedidos!inner(id,numero,status)')
    .in('pedidos.status', ['aprovado', 'producao', 'separacao'])
  if (error) throw error
  return data.map((i) => ({ sku_id: i.sku_id, quantidade: i.quantidade, pedido_numero: i.pedidos.numero, pedido_id: i.pedidos.id }))
}
