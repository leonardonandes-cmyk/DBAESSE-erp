import { supabase } from './supabase.js'
import { totaisPedido } from './pedidos.js'
import { MODALIDADE, modalidadeDoCanal } from './modalidades.js'

/*
  Comissões
  - Regra por MODALIDADE do pedido (atacado, variado, drop, marketplace, varejo) ou por POLO/GRUPO da cliente (ex.: Fartura).
  - tipo 'pct' = % do valor faturado (já com desconto) · 'par' = R$ por par.
  - Regras que valem para o mesmo pedido SOMAM (ex.: pedido de atacado do polo Fartura paga Fartura + Sabrina).
  - Base: pedidos faturados ou entregues, pela data do pedido.
*/
export const VENDIDO = ['faturado', 'entregue']

export async function listarRegras() {
  const { data, error } = await supabase.from('comissao_regras').select('id,beneficiario,parceiro_id,criterio,alvo,tipo,valor,ativo,ordem').order('ordem').order('criado_em')
  if (error) throw error
  return data
}

export async function salvarRegra(r) {
  const linha = {
    beneficiario: r.beneficiario.trim(), criterio: r.criterio, alvo: String(r.alvo).trim(), tipo: r.tipo,
    valor: Number(String(r.valor).replace(',', '.')) / (r.tipo === 'pct' ? 100 : 1), ativo: r.ativo ?? true, ordem: r.ordem ?? 0,
  }
  const q = r.id ? supabase.from('comissao_regras').update(linha).eq('id', r.id) : supabase.from('comissao_regras').insert(linha)
  const { error } = await q
  if (error) throw error
}

export async function excluirRegra(id) {
  const { error } = await supabase.from('comissao_regras').delete().eq('id', id)
  if (error) throw error
}

export const descreverRegra = (r) =>
  `${r.tipo === 'pct' ? `${(Number(r.valor) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% do faturado` : `R$ ${Number(r.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} por par`} · ${r.criterio === 'grupo' ? `polo ${r.alvo}` : MODALIDADE[r.alvo]?.label || r.alvo}`

const mesmo = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()
export const regraVale = (r, pedido) => r.ativo && (r.criterio === 'grupo' ? mesmo(pedido.grupo, r.alvo) : modalidadeDoCanal(pedido.canal) === r.alvo)

// → { linhas: [{ pedido, total, pares, modalidade, comissoes: { regraId: valor } }], porRegra: { regraId: { valor, pedidos, pares, base } } }
export function calcularComissoes(pedidos, regras, per) {
  const ativas = regras.filter((r) => r.ativo)
  const porRegra = Object.fromEntries(ativas.map((r) => [r.id, { valor: 0, pedidos: 0, pares: 0, base: 0 }]))
  const linhas = []
  pedidos.forEach((p) => {
    if (!VENDIDO.includes(p.status)) return
    const d = new Date(p.criado_em)
    if (per && (d < per.ini || d > per.fim)) return
    const t = totaisPedido(p)
    const comissoes = {}
    ativas.forEach((r) => {
      if (!regraVale(r, p)) return
      const v = r.tipo === 'pct' ? t.total * Number(r.valor) : t.pares * Number(r.valor)
      comissoes[r.id] = Math.round(v * 100) / 100
      const a = porRegra[r.id]; a.valor += comissoes[r.id]; a.pedidos += 1; a.pares += t.pares; a.base += t.total
    })
    if (Object.keys(comissoes).length) linhas.push({ pedido: p, total: t.total, pares: t.pares, modalidade: modalidadeDoCanal(p.canal), comissoes })
  })
  return { linhas, porRegra }
}

// comissão total de UM pedido (para mostrar no pedido / na margem)
export function comissaoDoPedido(pedido, regras) {
  const t = totaisPedido(pedido)
  return regras.filter((r) => regraVale(r, pedido)).reduce((s, r) => s + (r.tipo === 'pct' ? t.total * Number(r.valor) : t.pares * Number(r.valor)), 0)
}
