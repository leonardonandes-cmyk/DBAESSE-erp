import { supabase, todas } from './supabase.js'

/*
  Margem por loja (Shopee, TikTok Shop, Mercado Livre…)
  preço da loja = preço próprio do modelo naquela loja OU o preço de varejo
  taxa da loja  = % + taxa fixa da FAIXA em que o preço cai
  despesas      = Σ(% × preço + R$)  (imposto, embalagem, etiqueta, perda, ADS, afiliado, frete…)
  lucro = preço − custo − taxa − despesas        margem = lucro ÷ preço
*/

export async function listarCanais() {
  const { data, error } = await supabase.from('canais_venda')
    .select('id,codigo,nome,cor,faixas,despesas,margem_alvo,observacao,ativo,ordem').order('ordem')
  if (error) throw error
  return data
}

export async function salvarCanal(id, { faixas, despesas, margem_alvo, observacao, ativo }) {
  const { error } = await supabase.from('canais_venda').update({ faixas, despesas, margem_alvo, observacao: observacao || null, ativo }).eq('id', id)
  if (error) throw error
}

export async function listarPrecosCanal() {
  return todas(() => supabase.from('precos_canal').select('id,produto_id,canal_id,preco').order('id'))
}

// preco vazio/nulo = volta a seguir o varejo
export async function salvarPrecoCanal(produtoId, canalId, preco) {
  if (preco == null || preco === '' || !(Number(preco) > 0)) {
    const { error } = await supabase.from('precos_canal').delete().eq('produto_id', produtoId).eq('canal_id', canalId)
    if (error) throw error
    return null
  }
  const { data, error } = await supabase.from('precos_canal')
    .upsert({ produto_id: produtoId, canal_id: canalId, preco: Number(preco), atualizado_em: new Date().toISOString() }, { onConflict: 'produto_id,canal_id' })
    .select('id,produto_id,canal_id,preco').single()
  if (error) throw error
  return data
}

const ordenadas = (canal) => [...(canal?.faixas || [])].sort((a, b) => (a.ate == null ? 1 : b.ate == null ? -1 : a.ate - b.ate))

export function faixaDe(canal, preco) {
  const fs = ordenadas(canal)
  return fs.find((f) => f.ate == null || preco <= Number(f.ate)) || fs[fs.length - 1] || { pct: 0, fixo: 0 }
}

const somas = (canal) => {
  const d = Array.isArray(canal?.despesas) ? canal.despesas : []
  return { pct: d.reduce((t, x) => t + Number(x.pct || 0), 0), rs: d.reduce((t, x) => t + Number(x.rs || 0), 0) }
}

export function calcCanal(custo, preco, canal) {
  const p = Number(preco || 0)
  const f = faixaDe(canal, p)
  const s = somas(canal)
  const taxa = p * Number(f.pct || 0) + Number(f.fixo || 0)
  const despesas = p * s.pct + s.rs
  const lucro = p - Number(custo || 0) - taxa - despesas
  return { preco: p, faixa: f, taxa, despesas, lucro, margem: p > 0 ? lucro / p : null }
}

// menor preço que bate a margem-alvo, respeitando as faixas (a taxa muda de uma faixa para outra)
export function precoMeta(custo, canal, meta = Number(canal?.margem_alvo || 0)) {
  if (!(custo > 0)) return null
  const s = somas(canal)
  let lo = 0, melhor = null
  for (const f of ordenadas(canal)) {
    const hi = f.ate == null ? Infinity : Number(f.ate)
    const div = 1 - Number(f.pct || 0) - s.pct - meta
    if (div > 0) {
      const p = Math.max(Math.ceil(((custo + Number(f.fixo || 0) + s.rs) / div) * 100) / 100, lo)
      if (p <= hi && (melhor == null || p < melhor)) melhor = p
    }
    lo = hi === Infinity ? lo : Math.round((hi + 0.01) * 100) / 100
  }
  return melhor
}

// preço logo acima de uma virada de faixa pode lucrar MENOS que o teto da faixa de baixo (ex.: Shopee R$ 80 x R$ 79,99)
export function alertaFaixa(custo, preco, canal) {
  const p = Number(preco || 0)
  if (!(p > 0)) return null
  const fs = ordenadas(canal)
  const i = fs.indexOf(faixaDe(canal, p))
  if (i <= 0) return null
  const teto = Number(fs[i - 1].ate)
  const abaixo = calcCanal(custo, teto, canal)
  const atual = calcCanal(custo, p, canal)
  if (abaixo.lucro > atual.lucro + 0.009) return { teto, ganho: abaixo.lucro - atual.lucro }
  return null
}

// cor da margem relativa à meta: +10 pts acima = azul · na meta = verde · até 10 abaixo = amarelo · 10+ abaixo = vermelho
export function tomMeta(margem, meta) {
  if (margem == null) return 'neutral'
  if (margem >= meta + 0.1) return 'info'
  if (margem >= meta) return 'ok'
  if (margem > meta - 0.1) return 'warn'
  return 'bad'
}

export const resumoFaixa = (f) => `${(Number(f.pct || 0) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%${Number(f.fixo) ? ` + R$ ${Number(f.fixo).toFixed(2).replace('.', ',')}` : ''}`
