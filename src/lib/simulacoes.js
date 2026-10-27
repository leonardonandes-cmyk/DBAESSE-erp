import { supabase } from './supabase.js'
import { listarFichaConsumo } from './compras.js'

/*
  Simulação de custo: um estudo de produto que NÃO entra no catálogo.
  linhas (jsonb): [{ k, material_id, secao, modo: 'consumo'|'rendimento', qtd, custo_proprio }]
  O custo do material vem sempre do cadastro atual (ou do custo próprio da linha).
*/
const CAMPOS = 'id,nome,base_produto_id,linhas,preco_atacado,preco_varejo,observacoes,criado_em,atualizado_em'
export const novaChave = () => Math.random().toString(36).slice(2, 10)
const num = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')))

export async function listarSimulacoes() {
  const { data, error } = await supabase.from('simulacoes').select(CAMPOS).order('atualizado_em', { ascending: false })
  if (error) throw error
  return data
}

export async function salvarSimulacao(s) {
  const linha = {
    nome: s.nome.trim() || 'Sem nome',
    base_produto_id: s.base_produto_id || null,
    linhas: s.linhas.map(({ k, material_id, secao, modo, qtd, custo_proprio }) => ({ k, material_id, secao, modo, qtd: num(qtd), custo_proprio: num(custo_proprio) })),
    preco_atacado: num(s.preco_atacado),
    preco_varejo: num(s.preco_varejo),
    observacoes: s.observacoes?.trim() || null,
    atualizado_em: new Date().toISOString(),
  }
  const q = s.id
    ? supabase.from('simulacoes').update(linha).eq('id', s.id).select(CAMPOS).single()
    : supabase.from('simulacoes').insert(linha).select(CAMPOS).single()
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function removerSimulacao(id) {
  const { error } = await supabase.from('simulacoes').delete().eq('id', id)
  if (error) throw error
}

// copia a ficha técnica de um modelo como ponto de partida
export async function linhasDoModelo(produtoId) {
  const ficha = await listarFichaConsumo(produtoId)
  return ficha.map((l) => ({
    k: novaChave(), material_id: l.material_id, secao: l.secao, modo: l.modo || 'consumo',
    qtd: l.modo === 'rendimento' ? Number(l.rendimento) : Number(l.consumo), custo_proprio: l.custo_proprio,
  }))
}

// valor por par de uma linha da simulação
export function valorSim(l, material) {
  const custo = l.custo_proprio != null && l.custo_proprio !== '' ? num(l.custo_proprio) : Number(material?.custo || 0)
  const q = num(l.qtd) || 0
  const consumo = l.modo === 'rendimento' ? (q > 0 ? 1 / q : 0) : q
  return custo * consumo
}

export function custoSim(linhas, matPorId) {
  const porSecao = {}
  let total = 0
  ;(linhas || []).forEach((l) => { const v = valorSim(l, matPorId[l.material_id]); porSecao[l.secao] = (porSecao[l.secao] || 0) + v; total += v })
  return { total, porSecao }
}
