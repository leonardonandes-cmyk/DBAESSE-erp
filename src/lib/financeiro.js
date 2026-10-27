import { supabase, todas } from './supabase.js'
import { hojeISO } from './format.js'

export const CATEGORIAS = {
  pagar: ['Material', 'Solado', 'Mão de obra / banca', 'Embalagem', 'Frete', 'Energia / água', 'Aluguel', 'Impostos', 'Marketing / anúncios', 'Marketplace / taxas', 'Outros'],
  receber: ['Venda atacado', 'Venda revenda', 'Venda drop', 'Marketplace', 'Venda varejo', 'Outros'],
}
export const FORMAS = ['Pix', 'Boleto', 'Transferência', 'Dinheiro', 'Cartão', 'Cheque']

export async function listarTitulos() {
  return todas(() => supabase
    .from('titulos')
    .select('id,tipo,descricao,parceiro_id,categoria,valor,vencimento,parcela,pago_em,valor_pago,forma,pedido_id,observacao,parceiros(nome)')
    .order('vencimento').order('id'))
}

export function situacao(t) {
  if (t.pago_em) return { id: 'pago', label: t.tipo === 'pagar' ? 'Pago' : 'Recebido', tom: 'ok' }
  const hoje = hojeISO()
  if (t.vencimento < hoje) return { id: 'vencido', label: 'Vencido', tom: 'bad' }
  if (t.vencimento === hoje) return { id: 'hoje', label: 'Vence hoje', tom: 'warn' }
  return { id: 'aberto', label: 'Em aberto', tom: 'neutral' }
}

function somaDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}
function somaMeses(iso, meses) {
  const d = new Date(`${iso}T12:00:00`)
  const dia = d.getDate()
  d.setDate(1); d.setMonth(d.getMonth() + meses)
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(dia, ultimo))
  return d.toISOString().slice(0, 10)
}

// Gera as parcelas: valor total dividido (centavos acertados na última)
export function montarParcelas({ valorTotal, parcelas, primeiroVencimento, intervalo }) {
  const n = Math.max(1, Number(parcelas) || 1)
  const totalCent = Math.round(Number(valorTotal) * 100)
  const base = Math.floor(totalCent / n)
  return Array.from({ length: n }, (_, i) => ({
    valor: (i === n - 1 ? totalCent - base * (n - 1) : base) / 100,
    vencimento: intervalo === 'semanal' ? somaDias(primeiroVencimento, 7 * i)
      : intervalo === 'quinzenal' ? somaDias(primeiroVencimento, 14 * i)
      : somaMeses(primeiroVencimento, i),
    parcela: n > 1 ? `${i + 1}/${n}` : null,
  }))
}

export async function criarTitulos({ tipo, descricao, parceiro_id, categoria, forma, observacao, pedido_id, parcelas }) {
  const linhas = parcelas.map((p) => ({
    tipo, descricao: descricao.trim(), parceiro_id: parceiro_id || null, categoria: categoria || null,
    forma: forma || null, observacao: observacao || null, pedido_id: pedido_id || null,
    valor: p.valor, vencimento: p.vencimento, parcela: p.parcela,
  }))
  const { error } = await supabase.from('titulos').insert(linhas)
  if (error) throw error
}

export async function atualizarTitulo(id, campos) {
  const { error } = await supabase.from('titulos').update(campos).eq('id', id)
  if (error) throw error
}

export async function baixarTitulo(id, { pago_em, valor_pago, forma }) {
  return atualizarTitulo(id, { pago_em, valor_pago: Number(valor_pago), forma: forma || null })
}

export async function estornarTitulo(id) {
  return atualizarTitulo(id, { pago_em: null, valor_pago: null })
}

export async function excluirTitulo(id) {
  const { error } = await supabase.from('titulos').delete().eq('id', id)
  if (error) throw error
}

export async function titulosDoPedido(pedidoId) {
  const { data, error } = await supabase.from('titulos').select('id,valor,vencimento,parcela,pago_em').eq('pedido_id', pedidoId).order('vencimento')
  if (error) throw error
  return data
}
