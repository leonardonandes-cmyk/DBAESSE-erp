// Acesso ao banco para o cadastro de produtos — as telas só usam estas funções.
import { supabase } from './supabase.js'

export async function listarCores() {
  const { data, error } = await supabase.from('cores').select('id,nome,sigla,hex').order('nome')
  if (error) throw error
  return data
}

export async function listarProdutos() {
  const { data, error } = await supabase
    .from('produtos')
    .select('id,ref,nome,tipo,colecao,ncm,grade_de,grade_ate,status,foto_url,skus(id,cor_id,numero,sku,ean)')
    .order('ref')
  if (error) throw error
  return data
}

// Sigla de 3 letras a partir do nome (Preto/Nude/Caramelo → PNC; "Off white" → OFF)
export function siglaSugerida(nome, usadas = []) {
  const limpo = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  const partes = limpo.split(/[\/,+&-]/).map((p) => p.trim()).filter(Boolean)
  let base = partes.length > 1
    ? partes.map((p) => p[0]).join('').slice(0, 3)
    : limpo.replace(/[^A-Z]/g, '').slice(0, 3)
  base = (base + 'XXX').slice(0, 3)
  if (!usadas.includes(base)) return base
  const letras = limpo.replace(/[^A-Z]/g, '')
  for (const l of letras + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const s = base.slice(0, 2) + l
    if (!usadas.includes(s)) return s
  }
  return base
}

export async function criarCor(nome, hex, usadas) {
  const sigla = siglaSugerida(nome, usadas)
  const { data, error } = await supabase.from('cores').insert({ nome: nome.trim(), sigla, hex }).select().single()
  if (error) throw error
  return data
}

export function codigoSku(ref, sigla, numero) {
  return `${ref.replace(/[.\s]/g, '').toUpperCase()}-${sigla}-${numero}`
}

// Cria o modelo e gera todos os SKUs (cada cor × cada número da grade)
export async function criarProduto({ ref, nome, tipo, colecao, ncm, gradeDe, gradeAte, cores }) {
  const { data: prod, error } = await supabase
    .from('produtos')
    .insert({ ref: ref.trim().toUpperCase(), nome: nome.trim(), tipo, colecao: colecao || null, ncm: ncm || null, grade_de: gradeDe, grade_ate: gradeAte })
    .select()
    .single()
  if (error) {
    if (error.code === '23505') throw new Error(`A REF ${ref} já está cadastrada.`)
    throw error
  }
  const linhas = []
  for (const c of cores) {
    for (let n = gradeDe; n <= gradeAte; n++) {
      linhas.push({ produto_id: prod.id, cor_id: c.id, numero: n, sku: codigoSku(prod.ref, c.sigla, n) })
    }
  }
  if (linhas.length) {
    const { error: e2 } = await supabase.from('skus').insert(linhas)
    if (e2) {
      await supabase.from('produtos').delete().eq('id', prod.id)
      if (e2.code === '23505') throw new Error('Algum SKU desse modelo já existe. Confira a REF.')
      throw e2
    }
  }
  return prod
}
