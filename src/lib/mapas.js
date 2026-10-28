import { supabase } from './supabase.js'
import { criarOP } from './producao.js'

/*
  Mapa de programação (planilha PROGRAMAÇÃO): cabeçalho (pedido, cliente, marca, datas)
  + referências; cada cor de cada referência vira uma OP ligada ao mapa.
  Saídas impressas: mapa geral · fichas de controle por cor · relação de palmilha.
*/
export const numeroMapa = (n) => `MP-${String(n).padStart(4, '0')}`

export async function listarMapas() {
  const { data, error } = await supabase.from('programacoes')
    .select('id,numero,pedido,parceiro_id,cliente,marca,data,previsao,observacao,criado_em').order('numero', { ascending: false })
  if (error) throw error
  return data
}

export async function regraPalmilha() {
  const { data } = await supabase.from('empresas').select('regra_palmilha').limit(1).maybeSingle()
  return Array.isArray(data?.regra_palmilha) && data.regra_palmilha.length ? data.regra_palmilha : [{ chave: 'SALTO BLOCO', posicao: 2 }, { chave: '*', posicao: 1 }]
}

// cor da palmilha: cor composta "PRETO/ NUDE/ CARAMELO" → parte pela regra (1 = última, 2 = penúltima); cor única = ela mesma
export function corDaPalmilha(nomeCor, textoModelo, regra) {
  const partes = String(nomeCor || '').split('/').map((x) => x.trim()).filter(Boolean)
  if (partes.length <= 1) return partes[0] || ''
  const alvo = String(textoModelo || '').toUpperCase()
  const r = regra.find((x) => x.chave !== '*' && alvo.includes(String(x.chave).toUpperCase())) || regra.find((x) => x.chave === '*') || { posicao: 1 }
  const pos = Math.max(1, partes.length - Number(r.posicao || 1) + 1)
  return partes[pos - 1]
}

export async function criarMapa({ cab, blocos }) {
  const linhas = blocos.flatMap((b) => b.cores.map((c) => ({ b, c }))).filter(({ c }) => Object.values(c.grade).some((q) => Number(q) > 0))
  if (!linhas.length) throw new Error('Preencha a grade de pelo menos uma cor.')
  const semCor = linhas.find(({ c }) => !c.cor_id)
  if (semCor) throw new Error(`Escolha a cor de todas as linhas preenchidas (ref. ${semCor.b.produto.ref}).`)
  const { data: mapa, error } = await supabase.from('programacoes').insert({
    pedido: cab.pedido?.trim() || null, parceiro_id: cab.parceiro_id || null, cliente: cab.cliente?.trim() || null,
    marca: cab.marca?.trim() || null, data: cab.data || undefined, previsao: cab.previsao || null, observacao: cab.observacao?.trim() || null,
  }).select('id,numero').single()
  if (error) throw error
  const criadas = []
  try {
    for (const { b, c } of linhas) {
      const itens = b.produto.skus.filter((s) => s.cor_id === c.cor_id && Number(c.grade[s.numero]) > 0).map((s) => ({ sku_id: s.id, quantidade: Number(c.grade[s.numero]) }))
      const op = await criarOP({ produto_id: b.produto.id, cor_id: c.cor_id, prazo: cab.previsao, prioridade: cab.prioridade, observacao: b.obs, itens, programacao_id: mapa.id })
      criadas.push(op.id)
    }
  } catch (e) {
    if (criadas.length) await supabase.from('ordens_producao').delete().in('id', criadas)
    await supabase.from('programacoes').delete().eq('id', mapa.id)
    throw e
  }
  return { ...mapa, ops: criadas.length }
}

// situação do mapa para os avisos: finalizado · em produção · vence logo · ATRASADO
export function situacaoMapa(mapa, ops) {
  const ativas = ops.filter((o) => o.programacao_id === mapa.id && o.status !== 'cancelada')
  const abertas = ativas.filter((o) => o.status !== 'concluida')
  if (!ativas.length) return { id: 'vazio', abertas: 0, total: 0 }
  if (!abertas.length) return { id: 'finalizado', abertas: 0, total: ativas.length }
  const h = new Date()
  const hoje = Date.UTC(h.getFullYear(), h.getMonth(), h.getDate())
  const [a, m, d] = (mapa.previsao || '').slice(0, 10).split('-').map(Number)
  const dias = a ? Math.round((Date.UTC(a, m - 1, d) - hoje) / 864e5) : null
  const id = dias == null ? 'producao' : dias < 0 ? 'atrasado' : dias <= 3 ? 'vence' : 'producao'
  return { id, dias, abertas: abertas.length, total: ativas.length }
}
