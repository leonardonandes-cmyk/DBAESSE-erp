import { supabase, todas } from './supabase.js'

export const TIPOS_PARCEIRO = [
  { valor: 'cliente', label: 'Cliente', plural: 'Clientes' },
  { valor: 'revendedora', label: 'Revendedora', plural: 'Revendedoras' },
  { valor: 'fornecedor', label: 'Fornecedor', plural: 'Fornecedores' },
  { valor: 'transportadora', label: 'Transportadora', plural: 'Transportadoras' },
]

export const CANAIS = ['Atacado', 'Revenda', 'Drop', 'Shopee', 'TikTok Shop', 'Mercado Livre', 'Instagram', 'Loja / varejo']

export async function listarParceiros() {
  return todas(() => supabase
    .from('parceiros')
    .select('id,nome,tipos,documento,telefone,email,cep,endereco,cidade,uf,canal,lista,observacoes,ativo')
    .order('nome').order('id'))
}

export async function salvarParceiro(dados, id) {
  const linha = {
    nome: dados.nome.trim(),
    tipos: dados.tipos,
    documento: dados.documento?.trim() || null,
    telefone: dados.telefone?.trim() || null,
    email: dados.email?.trim() || null,
    cep: dados.cep?.trim() || null,
    endereco: dados.endereco?.trim() || null,
    cidade: dados.cidade?.trim() || null,
    uf: dados.uf?.trim().toUpperCase() || null,
    canal: dados.canal || null,
    lista: dados.lista || null,
    observacoes: dados.observacoes?.trim() || null,
    ativo: dados.ativo ?? true,
  }
  const q = id
    ? supabase.from('parceiros').update(linha).eq('id', id).select().single()
    : supabase.from('parceiros').insert(linha).select().single()
  const { data, error } = await q
  if (error) {
    if (error.code === '23505') throw new Error('Já existe um cadastro com esse CPF/CNPJ.')
    throw error
  }
  return data
}
