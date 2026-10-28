import { supabase } from './supabase.js'
import { corDaPalmilha } from './mapas.js'

// Programação de PALMILHA para estoque — relação que vai para o prestador de serviço
export const TIPOS_PALMILHA = ['PALMILHA RASTEIRA', 'PALMILHA SALTO', 'PALMILHA PAPETE CONFORT', 'PALMILHA RASTEIRA CONFORT']
export const NUMEROS_PALMILHA = [33, 34, 35, 36, 37, 38, 39, 40]
export const numeroPalmilha = (n) => `PL-${String(n).padStart(4, '0')}`
export const STATUS_PALMILHA = { aberta: { label: 'Com o prestador', tom: 'warn' }, recebida: { label: 'Recebida', tom: 'ok' }, cancelada: { label: 'Cancelada', tom: 'neutro' } }

export const totalItem = (it) => Object.values(it.grade || {}).reduce((t, q) => t + (Number(q) || 0), 0)
export const totalProg = (p) => (p.itens || []).reduce((t, it) => t + totalItem(it), 0)

export async function listarProgPalmilha() {
  const { data, error } = await supabase.from('programacoes_palmilha')
    .select('id,numero,prestador_id,prestador,data,previsao,observacao,itens,insumos,status,criado_em')
    .order('numero', { ascending: false })
  if (error) throw error
  return data
}

function montarLinha({ cab, itens, insumos, corPorId: corPorIdAtual }) {
  const limpos = itens
    .map((it) => ({ tipo: it.tipo, cor_id: it.cor_id, obs: (it.obs || '').trim(), grade: Object.fromEntries(Object.entries(it.grade).filter(([, q]) => Number(q) > 0).map(([n, q]) => [n, Number(q)])) }))
    .filter((it) => totalItem(it) > 0)
  if (!limpos.length) throw new Error('Digite a grade de pelo menos uma palmilha.')
  if (limpos.some((it) => !it.cor_id)) throw new Error('Escolha a cor de todas as linhas com quantidade.')
  if (corPorIdAtual && limpos.some((it) => corComposta(corPorIdAtual[it.cor_id]?.nome))) throw new Error('Palmilha é de uma cor só — troque as cores compostas (com "/") por uma cor única.')
  return {
    prestador_id: cab.prestador_id || null, prestador: cab.prestador?.trim() || null,
    data: cab.data, previsao: cab.previsao || null, observacao: cab.observacao?.trim() || null,
    itens: limpos, insumos: insumos.filter((i) => i.descricao?.trim()).map((i) => ({ descricao: i.descricao.trim(), quantidade: (i.quantidade || '').trim() })),
  }
}

export async function criarProgPalmilha(dados) {
  const { data, error } = await supabase.from('programacoes_palmilha').insert(montarLinha(dados)).select('id,numero').single()
  if (error) throw error
  return data
}

// Corrigir uma programação já salva (mantém o número PL-0001)
export async function atualizarProgPalmilha(id, dados) {
  const { error } = await supabase.from('programacoes_palmilha').update(montarLinha(dados)).eq('id', id)
  if (error) throw error
  return { id }
}

export async function excluirProgPalmilha(id) {
  const { error } = await supabase.from('programacoes_palmilha').delete().eq('id', id)
  if (error) throw error
}

export async function mudarStatusPalmilha(id, status) {
  const { error } = await supabase.from('programacoes_palmilha').update({ status }).eq('id', id)
  if (error) throw error
}

/*
  Cor da PALMILHA a partir da cor escolhida (mesma regra do mapa):
  cor composta "AZUL / CARAMELO / VERMELHO" → salto = penúltima · demais = última · cor única = ela mesma.
*/
export function corPalmilhaDoItem(item, corPorId, regra) {
  const c = corPorId[item.cor_id]
  if (!c) return { nome: '', hex: '#FFFFFF', composta: false }
  const tipo = String(item.tipo || '').toUpperCase()
  const nome = corDaPalmilha(c.nome, tipo.includes('SALTO') ? 'SALTO BLOCO' : tipo, regra)
  const achada = Object.values(corPorId).find((x) => x.nome.trim().toLowerCase() === nome.trim().toLowerCase())
  return { nome, hex: achada?.hex || (nome === c.nome ? c.hex : '#FFFFFF'), composta: nome !== c.nome, original: c.nome }
}

// junta linhas de mesma palmilha (tipo + cor da palmilha + OBS) somando a grade
export function agruparPalmilha(itens, corPorId, regra) {
  const g = new Map()
  itens.forEach((it) => {
    const cp = corPalmilhaDoItem(it, corPorId, regra)
    const k = `${it.tipo}|${cp.nome.toLowerCase()}|${(it.obs || '').trim().toUpperCase()}`
    const atual = g.get(k) || { tipo: it.tipo, obs: it.obs, cor: cp, origens: [], grade: {} }
    if (cp.composta) atual.origens.push(cp.original)
    Object.entries(it.grade || {}).forEach(([n, q]) => { atual.grade[n] = (Number(atual.grade[n]) || 0) + (Number(q) || 0) })
    g.set(k, atual)
  })
  return [...g.values()]
}

export const corComposta = (nome) => String(nome || '').includes('/')

// programação antiga com cor composta: ao corrigir, já troca pela cor única da palmilha (pela regra)
export function corUnicaDoItem(item, cores, regra) {
  const corPorId = Object.fromEntries(cores.map((c) => [c.id, c]))
  const c = corPorId[item.cor_id]
  if (!c || !corComposta(c.nome)) return item.cor_id || ''
  const nome = corPalmilhaDoItem(item, corPorId, regra).nome.trim().toLowerCase()
  return cores.find((x) => x.nome.trim().toLowerCase() === nome)?.id || ''
}
