import { supabase, todas } from './supabase.js'

export const TIPOS_PARCEIRO = [
  { valor: 'cliente', label: 'Cliente', plural: 'Clientes' },
  { valor: 'revendedora', label: 'Revendedora', plural: 'Revendedoras' },
  { valor: 'fornecedor', label: 'Fornecedor', plural: 'Fornecedores' },
  { valor: 'transportadora', label: 'Transportadora', plural: 'Transportadoras' },
]

export const CANAIS = ['Atacado', 'Variado', 'Drop', 'Shopee', 'TikTok Shop', 'Mercado Livre', 'Instagram', 'Loja / varejo']

export async function listarParceiros() {
  return todas(() => supabase
    .from('parceiros')
    .select('id,nome,tipos,documento,telefone,email,cep,endereco,numero,complemento,bairro,cidade,uf,canal,lista,observacoes,ativo')
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
    numero: dados.numero?.trim() || null,
    complemento: dados.complemento?.trim() || null,
    bairro: dados.bairro?.trim() || null,
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

// "Rua X, 120 – Sala 2 – Centro – Nova Serrana/MG – CEP 35520-000"
export function enderecoCompleto(p) {
  if (!p) return ''
  const rua = [p.endereco, p.numero].filter(Boolean).join(', ')
  const cid = p.cidade ? `${p.cidade}${p.uf ? `/${p.uf}` : ''}` : ''
  return [rua, p.complemento, p.bairro, cid, p.cep ? `CEP ${p.cep}` : ''].filter(Boolean).join(' – ')
}
