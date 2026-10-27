import { supabase, todas } from './supabase.js'

export const UNIDADES = [
  { v: 'par', l: 'par' }, { v: 'un', l: 'unidade' }, { v: 'm', l: 'metro linear' }, { v: 'm2', l: 'm²' },
  { v: 'kg', l: 'kg' }, { v: 'g', l: 'grama' }, { v: 'l', l: 'litro' }, { v: 'rolo', l: 'rolo' }, { v: 'folha', l: 'folha' },
]
export const UN_CURTA = { par: 'par', un: 'un', m: 'm', m2: 'm²', kg: 'kg', g: 'g', l: 'L', rolo: 'rolo', folha: 'fl' }
export const CATEGORIAS_MAT = ['Cabedal (couro/sintético)', 'Forro', 'Solado', 'Palmilha', 'Salto', 'Linha', 'Cola / química', 'Enfeite / fivela', 'Embalagem', 'Etiqueta', 'Outros']

export const STATUS_COMPRA = {
  rascunho: { label: 'Rascunho', tom: 'neutral' },
  enviado: { label: 'Enviado', tom: 'info' },
  recebido: { label: 'Recebido', tom: 'ok' },
  cancelado: { label: 'Cancelado', tom: 'bad' },
}
export const numeroCompra = (n) => `PC-${String(n).padStart(4, '0')}`

export const fmtQtd = (v) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })

// ---------- Materiais ----------
export async function listarMateriais() {
  const { data, error } = await supabase
    .from('materiais')
    .select('id,nome,categoria,unidade,por_numero,custo,estoque_minimo,fornecedor_id,ativo,parceiros(nome)')
    .order('nome')
  if (error) throw error
  return data
}

export async function salvarMaterial(d, id) {
  const linha = {
    nome: d.nome.trim(), categoria: d.categoria || null, unidade: d.unidade, por_numero: !!d.por_numero,
    custo: d.custo === '' || d.custo == null ? null : Number(d.custo),
    estoque_minimo: d.estoque_minimo === '' || d.estoque_minimo == null ? null : Number(d.estoque_minimo),
    fornecedor_id: d.fornecedor_id || null, ativo: d.ativo ?? true,
  }
  const q = id ? supabase.from('materiais').update(linha).eq('id', id) : supabase.from('materiais').insert(linha)
  const { error } = await q
  if (error) {
    if (error.code === '23505') throw new Error('Já existe um material com esse nome.')
    throw error
  }
}

// saldo por material (e por número, nos materiais por numeração)
export async function listarSaldosMateriais() {
  const data = await todas(() => supabase.from('material_saldos').select('material_id,numero,saldo').order('material_id').order('numero'))
  return data
}

export function saldoMaterial(saldos, materialId, numero) {
  return saldos.filter((s) => s.material_id === materialId && (numero == null || s.numero === numero))
    .reduce((t, s) => t + Number(s.saldo), 0)
}

export async function movimentarMaterial(linhas) {
  const { error } = await supabase.from('material_movimentos').insert(linhas)
  if (error) throw error
}

// ---------- Ficha de consumo ----------
export async function listarFichaConsumo(produtoId) {
  let q = supabase.from('ficha_consumo').select('id,produto_id,material_id,consumo,perda_pct,observacao,materiais(nome,unidade,por_numero,custo)')
  if (produtoId) q = q.eq('produto_id', produtoId)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function salvarLinhaFicha({ id, produto_id, material_id, consumo, perda_pct, observacao }) {
  const linha = { produto_id, material_id, consumo: Number(String(consumo).replace(',', '.')), perda_pct: Number(String(perda_pct || 0).replace(',', '.')), observacao: observacao || null }
  const q = id ? supabase.from('ficha_consumo').update(linha).eq('id', id) : supabase.from('ficha_consumo').insert(linha)
  const { error } = await q
  if (error) {
    if (error.code === '23505') throw new Error('Esse material já está na ficha deste modelo.')
    throw error
  }
}

export async function removerLinhaFicha(id) {
  const { error } = await supabase.from('ficha_consumo').delete().eq('id', id)
  if (error) throw error
}

// copia a ficha de um modelo para outro (só os materiais que ainda não existem no destino)
export async function copiarFicha(deProdutoId, paraProdutoId) {
  const origem = await listarFichaConsumo(deProdutoId)
  const destino = await listarFichaConsumo(paraProdutoId)
  const ja = new Set(destino.map((d) => d.material_id))
  const novas = origem.filter((o) => !ja.has(o.material_id)).map((o) => ({ produto_id: paraProdutoId, material_id: o.material_id, consumo: o.consumo, perda_pct: o.perda_pct, observacao: o.observacao }))
  if (!novas.length) return 0
  const { error } = await supabase.from('ficha_consumo').insert(novas)
  if (error) throw error
  return novas.length
}

/*
  Necessidade de materiais para as OPs em aberto:
  para cada OP (ainda não lançada no estoque), consumo × pares × (1 + perda).
  Materiais por numeração são calculados por número da grade.
  Retorna linhas { material, numero, necessario, saldo, emCompra, falta }.
*/
export function calcularNecessidade({ ops, ficha, materiais, saldos, compras }) {
  const matPorId = Object.fromEntries(materiais.map((m) => [m.id, m]))
  const fichaPorProduto = {}
  ficha.forEach((f) => { (fichaPorProduto[f.produto_id] ||= []).push(f) })
  const nec = {}
  const add = (mid, num, q) => { const k = `${mid}|${num ?? ''}`; (nec[k] ||= { material_id: mid, numero: num, necessario: 0 }).necessario += q }
  ops.filter((o) => ['aberta', 'em_producao'].includes(o.status) && !o.estoque_lancado).forEach((o) => {
    const linhas = fichaPorProduto[o.produto_id] || []
    const pares = o.op_itens.reduce((t, i) => t + i.quantidade, 0)
    linhas.forEach((f) => {
      const m = matPorId[f.material_id]; if (!m) return
      const fator = Number(f.consumo) * (1 + Number(f.perda_pct) / 100)
      if (m.por_numero) o.op_itens.forEach((i) => add(m.id, i.skus.numero, fator * i.quantidade))
      else add(m.id, null, fator * pares)
    })
  })
  // compras já enviadas e ainda não recebidas
  const pend = {}
  compras.filter((c) => c.status === 'enviado').forEach((c) => c.compra_itens.forEach((i) => {
    const k = `${i.material_id}|${i.numero ?? ''}`; pend[k] = (pend[k] || 0) + Number(i.quantidade)
  }))
  return Object.entries(nec).map(([k, n]) => {
    const m = matPorId[n.material_id]
    const saldo = saldoMaterial(saldos, n.material_id, m.por_numero ? n.numero : null)
    const emCompra = pend[k] || 0
    const falta = Math.max(0, n.necessario - Math.max(0, saldo) - emCompra)
    return { ...n, material: m, saldo, emCompra, falta }
  }).sort((a, b) => a.material.nome.localeCompare(b.material.nome) || (a.numero || 0) - (b.numero || 0))
}

// ---------- Pedidos de compra ----------
export async function listarCompras() {
  return todas(() => supabase
    .from('compras')
    .select('id,numero,status,previsao,observacao,recebido_em,criado_em,fornecedor_id,parceiros(nome),compra_itens(id,material_id,numero,quantidade,custo_unit,materiais(nome,unidade))')
    .order('numero', { ascending: false }))
}

export const totalCompra = (c) => (c.compra_itens || []).reduce((t, i) => t + Number(i.quantidade) * Number(i.custo_unit), 0)

export async function criarCompra({ fornecedor_id, previsao, observacao, status, itens }) {
  if (!itens.length) throw new Error('Adicione pelo menos um material.')
  const { data: c, error } = await supabase.from('compras')
    .insert({ fornecedor_id: fornecedor_id || null, previsao: previsao || null, observacao: observacao || null, status: status || 'rascunho' })
    .select('id,numero').single()
  if (error) throw error
  const { error: e2 } = await supabase.from('compra_itens').insert(itens.map((i) => ({
    compra_id: c.id, material_id: i.material_id, numero: i.numero ?? null, quantidade: Number(i.quantidade), custo_unit: Number(i.custo_unit) || 0,
  })))
  if (e2) { await supabase.from('compras').delete().eq('id', c.id); throw e2 }
  return c
}

export async function mudarStatusCompra(id, status) {
  if (status === 'recebido') {
    const { error } = await supabase.rpc('receber_compra', { p_compra: id })
    if (error) throw error
    return
  }
  const { error } = await supabase.from('compras').update({ status }).eq('id', id)
  if (error) throw error
}
