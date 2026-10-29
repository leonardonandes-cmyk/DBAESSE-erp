import { supabase } from './supabase.js'
import { criarOP, listarOPs } from './producao.js'

/*
  Mapa de programação (planilha PROGRAMAÇÃO): cabeçalho (pedido, cliente, marca, datas)
  + referências; cada cor de cada referência vira uma OP ligada ao mapa.
  Saídas impressas: mapa geral · fichas de controle por cor · relação de palmilha.
*/
export const numeroMapa = (n) => `MP-${String(n).padStart(4, '0')}`

export async function listarMapas() {
  const { data, error } = await supabase.from('programacoes')
    .select('id,numero,pedido,pedido_id,parceiro_id,cliente,marca,data,previsao,observacao,criado_em').order('numero', { ascending: false })
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
    pedido: cab.pedido?.trim() || null, pedido_id: cab.pedido_id || null, parceiro_id: cab.parceiro_id || null, cliente: cab.cliente?.trim() || null,
    marca: cab.marca?.trim() || null, data: cab.data || undefined, previsao: cab.previsao || null, observacao: cab.observacao?.trim() || null,
  }).select('id,numero').single()
  if (error) throw error
  const criadas = []
  try {
    for (const { b, c } of linhas) {
      const itens = b.produto.skus.filter((s) => s.cor_id === c.cor_id && Number(c.grade[s.numero]) > 0).map((s) => ({ sku_id: s.id, quantidade: Number(c.grade[s.numero]) }))
      const op = await criarOP({ produto_id: b.produto.id, cor_id: c.cor_id, pedido_id: cab.pedido_id, prazo: cab.previsao, prioridade: cab.prioridade, observacao: b.obs, itens, programacao_id: mapa.id })
      criadas.push(op.id)
    }
  } catch (e) {
    if (criadas.length) await supabase.from('ordens_producao').delete().in('id', criadas)
    await supabase.from('programacoes').delete().eq('id', mapa.id)
    throw e
  }
  return { ...mapa, ops: criadas.length }
}

// OP que já começou (saiu do setor inicial ou não está mais aberta) fica travada na correção
export const opTravada = (o) => o.status !== 'aberta' || (o.op_etapas || []).some((e) => e.status !== 'pendente')

/*
  Corrigir uma programação salva: cabeçalho + cores/grades.
  OP que ainda não começou: muda cor/grade/OBS ou sai do mapa. Cor nova vira OP nova.
  OP que já começou fica como está (só recebe a nova previsão).
*/
export async function atualizarMapa({ mapa, opsAtuais, cab, blocos }) {
  const linhas = blocos.flatMap((b) => b.cores.map((c) => ({ b, c })))
  const preenchidas = linhas.filter(({ c }) => Object.values(c.grade).some((q) => Number(q) > 0))
  if (!preenchidas.length) throw new Error('Preencha a grade de pelo menos uma cor.')
  const semCor = preenchidas.find(({ c }) => !c.cor_id && !c.travada)
  if (semCor) throw new Error(`Escolha a cor de todas as linhas preenchidas (ref. ${semCor.b.produto.ref}).`)

  const { error } = await supabase.from('programacoes').update({
    pedido: cab.pedido?.trim() || null, parceiro_id: cab.parceiro_id || null, cliente: cab.cliente?.trim() || null,
    marca: cab.marca?.trim() || null, data: cab.data || undefined, previsao: cab.previsao || null, observacao: cab.observacao?.trim() || null,
  }).eq('id', mapa.id)
  if (error) throw error

  const ficam = new Set(linhas.filter(({ c }) => c.op_id).map(({ c }) => c.op_id))
  // OPs livres que saíram do mapa (linha tirada ou zerada)
  const sair = opsAtuais.filter((o) => !opTravada(o) && (!ficam.has(o.id) || linhas.some(({ c }) => c.op_id === o.id && !Object.values(c.grade).some((q) => Number(q) > 0))))
  if (sair.length) {
    const { error: e } = await supabase.from('ordens_producao').delete().in('id', sair.map((o) => o.id))
    if (e) throw e
  }
  const saiu = new Set(sair.map((o) => o.id))

  for (const { b, c } of preenchidas) {
    if (c.travada) continue
    const itens = b.produto.skus.filter((s) => s.cor_id === c.cor_id && Number(c.grade[s.numero]) > 0).map((s) => ({ sku_id: s.id, quantidade: Number(c.grade[s.numero]) }))
    if (c.op_id && !saiu.has(c.op_id)) {
      const { error: e1 } = await supabase.from('ordens_producao').update({ cor_id: c.cor_id, prazo: cab.previsao || null, prioridade: cab.prioridade || 'normal', observacao: b.obs || null }).eq('id', c.op_id)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('op_itens').delete().eq('op_id', c.op_id)
      if (e2) throw e2
      const { error: e3 } = await supabase.from('op_itens').insert(itens.map((i) => ({ ...i, op_id: c.op_id })))
      if (e3) throw e3
    } else {
      await criarOP({ produto_id: b.produto.id, cor_id: c.cor_id, pedido_id: mapa.pedido_id || cab.pedido_id, prazo: cab.previsao, prioridade: cab.prioridade, observacao: b.obs, itens, programacao_id: mapa.id })
    }
  }
  // OPs já em produção: só acompanham a nova previsão
  const travadas = opsAtuais.filter((o) => opTravada(o) && OP_EM_ABERTO.includes(o.status)).map((o) => o.id)
  if (travadas.length) await supabase.from('ordens_producao').update({ prazo: cab.previsao || null }).in('id', travadas)
  return { id: mapa.id }
}
const OP_EM_ABERTO = ['aberta', 'em_producao']

// Excluir a programação inteira — só se nenhuma OP começou
export async function excluirMapa(mapa, opsAtuais) {
  if (opsAtuais.filter((o) => o.status !== 'cancelada').some(opTravada)) throw new Error('Esta programação já tem ficha em produção — corrija as cores livres ou cancele as OPs no quadro.')
  if (opsAtuais.length) {
    const { error } = await supabase.from('ordens_producao').delete().in('id', opsAtuais.map((o) => o.id))
    if (error) throw error
  }
  const { error } = await supabase.from('programacoes').delete().eq('id', mapa.id)
  if (error) throw error
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

/* ---------------- Programação de cliente a partir do PEDIDO (atacado) ---------------- */
const chaveK = () => Math.random().toString(36).slice(2)

// itens do pedido [{ sku_id, numero, quantidade, produto, cor }] → blocos do mapa (uma referência por modelo, uma linha por cor)
export function blocosDoPedido(itens, obsPorProduto = {}) {
  const porProd = new Map()
  itens.filter((i) => i.quantidade > 0 && i.produto).forEach((i) => {
    if (!porProd.has(i.produto.id)) porProd.set(i.produto.id, { k: chaveK(), produto: i.produto, obs: obsPorProduto[i.produto.id] ?? (i.produto.tipo || '').toUpperCase(), cores: new Map() })
    const b = porProd.get(i.produto.id)
    const corId = i.cor?.id || i.cor_id
    if (!b.cores.has(corId)) b.cores.set(corId, { k: chaveK(), cor_id: corId, grade: {} })
    const c = b.cores.get(corId)
    c.grade[i.numero] = String((Number(c.grade[i.numero]) || 0) + i.quantidade)
  })
  return [...porProd.values()].map((b) => ({ ...b, cores: [...b.cores.values()] }))
}

export async function programacaoDoPedido(pedidoId) {
  if (!pedidoId) return null
  const { data, error } = await supabase.from('programacoes').select('id,numero,pedido,pedido_id,parceiro_id,cliente,marca,data,previsao,observacao').eq('pedido_id', pedidoId).maybeSingle()
  if (error) throw error
  return data
}

/*
  Pedido corrigido → programação atrelada acompanha.
  Cores ainda não iniciadas: recebem a nova grade (ou saem). Cores já em produção: ficam como estão (travadas) e voltam no aviso.
  → null (sem programação) | { mapa, travadas: [{ ref, cor }] } quando alguma cor travada ficou diferente do pedido
*/
export async function sincronizarProgramacao(pedidoId, itens, { previsao } = {}) {
  const mapa = await programacaoDoPedido(pedidoId)
  if (!mapa) return null
  const ops = (await listarOPs()).filter((o) => o.programacao_id === mapa.id && o.status !== 'cancelada')
  const obs = Object.fromEntries(ops.map((o) => [o.produto_id, o.observacao || '']))
  const blocos = blocosDoPedido(itens, obs)
  const diferentes = []
  blocos.forEach((b) => b.cores.forEach((c) => {
    const op = ops.find((o) => o.produto_id === b.produto.id && o.cor_id === c.cor_id)
    if (!op) return
    c.op_id = op.id
    if (opTravada(op)) {
      c.travada = true
      const antes = Object.fromEntries((op.op_itens || []).map((i) => [i.skus?.numero, i.quantidade]))
      const mudou = Object.keys({ ...antes, ...c.grade }).some((n) => (Number(antes[n]) || 0) !== (Number(c.grade[n]) || 0))
      if (mudou) diferentes.push({ ref: b.produto.ref, cor: op.cores?.nome || '' })
    }
  }))
  // cor travada que saiu do pedido continua no mapa (já está em produção)
  ops.filter(opTravada).forEach((op) => {
    const existe = blocos.some((b) => b.cores.some((c) => c.op_id === op.id))
    if (!existe) diferentes.push({ ref: op.produtos?.ref || '', cor: op.cores?.nome || '' })
  })
  const cab = { ...mapa, previsao: previsao || mapa.previsao, prioridade: ops[0]?.prioridade || 'normal' }
  await atualizarMapa({ mapa, opsAtuais: ops, cab, blocos })
  return { mapa, travadas: diferentes }
}
