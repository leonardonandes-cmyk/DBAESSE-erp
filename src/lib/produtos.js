// Acesso ao banco para o cadastro de produtos — as telas só usam estas funções.
import { supabase, todas } from './supabase.js'
import { numerosDaGrade } from './format.js'

export async function listarCores() {
  const { data, error } = await supabase.from('cores').select('id,nome,sigla,hex').order('nome')
  if (error) throw error
  return data
}

export async function listarProdutos() {
  return todas(() => supabase
    .from('produtos')
    .select('id,ref,nome,tipo,colecao,ncm,grade_de,grade_ate,status,foto_url,fotos,desenho_url,preco_atacado,preco_varejo,ficha,origem,custo_compra,fornecedor_id,skus(id,cor_id,numero,sku,ean)')
    .order('ref'))
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
const preco = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')))

export async function criarProduto({ ref, nome, tipo, colecao, ncm, gradeDe, gradeAte, status, precoAtacado, precoVarejo, origem, custoCompra, cores }) {
  const { data: prod, error } = await supabase
    .from('produtos')
    .insert({ ref: ref.trim().toUpperCase(), nome: nome.trim(), tipo, colecao: colecao || null, ncm: ncm || null, grade_de: gradeDe, grade_ate: gradeAte, status: status || 'ativo', preco_atacado: preco(precoAtacado), preco_varejo: preco(precoVarejo), origem: origem || 'propria', custo_compra: origem === 'revenda' ? preco(custoCompra) : null })
    .select()
    .single()
  if (error) {
    if (error.code === '23505') throw new Error(`A REF ${ref} já está cadastrada.`)
    throw error
  }
  const linhas = []
  for (const c of cores) {
    for (const n of numerosDaGrade(gradeDe, gradeAte)) {
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

// Atualiza o modelo e cria só os SKUs que faltam (nunca apaga SKU — ele pode já estar em etiqueta)
export async function atualizarProduto(produto, { nome, tipo, colecao, ncm, gradeDe, gradeAte, status, precoAtacado, precoVarejo, origem, custoCompra, cores }) {
  const { error } = await supabase
    .from('produtos')
    .update({ nome: nome.trim(), tipo, colecao: colecao || null, ncm: ncm || null, grade_de: gradeDe, grade_ate: gradeAte, status, preco_atacado: preco(precoAtacado), preco_varejo: preco(precoVarejo), origem: origem || 'propria', custo_compra: origem === 'revenda' ? preco(custoCompra) : null })
    .eq('id', produto.id)
  if (error) throw error
  const existentes = new Set(produto.skus.map((s) => `${s.cor_id}|${s.numero}`))
  const linhas = []
  for (const c of cores) {
    for (const n of numerosDaGrade(gradeDe, gradeAte)) {
      if (!existentes.has(`${c.id}|${n}`)) {
        linhas.push({ produto_id: produto.id, cor_id: c.id, numero: n, sku: codigoSku(produto.ref, c.sigla, n) })
      }
    }
  }
  if (linhas.length) {
    const { error: e2 } = await supabase.from('skus').insert(linhas)
    if (e2) throw e2
  }
  return linhas.length
}

// Desenho padrão pelo tipo (public/desenhos/<tipo>.png), igual à regra das etiquetas
export function desenhoDoTipo(tipo) {
  if (!tipo) return null
  const slug = tipo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, '-')
  return DESENHOS.includes(slug) ? `/desenhos/${slug}.png` : null
}
const DESENHOS = ['mocassim', 'fisherman']

// Desenho da ETIQUETA de uma referência: o desenho próprio da REF → o desenho padrão do tipo → nenhum (quadro em branco)
export function desenhoDe(p) {
  return p?.desenho_url || desenhoDoTipo(p?.tipo) || null
}

// Sobe (ou substitui) o desenho da REF no armazenamento 'desenhos' e grava no produto
export async function subirDesenho(produto, arquivo) {
  const ext = (arquivo.name.split('.').pop() || 'png').toLowerCase().replace('jpeg', 'jpg')
  const caminho = `${String(produto.ref).replace(/[^\w-]/g, '_')}.${ext}`
  const { error } = await supabase.storage.from('desenhos').upload(caminho, arquivo, { upsert: true, contentType: arquivo.type || 'image/png', cacheControl: '60' })
  if (error) throw error
  const { data } = supabase.storage.from('desenhos').getPublicUrl(caminho)
  const url = `${data.publicUrl}?v=${Date.now()}` // muda a cada troca → etiqueta e prévia pegam o novo na hora
  const { error: e2 } = await supabase.from('produtos').update({ desenho_url: url }).eq('id', produto.id)
  if (e2) throw e2
  return url
}

// Correção rápida de preço (Tabela de preços) — as outras listas recalculam sozinhas
export async function salvarPrecosModelo(id, { precoAtacado, precoVarejo }) {
  const { error } = await supabase.from('produtos').update({ preco_atacado: preco(precoAtacado), preco_varejo: preco(precoVarejo) }).eq('id', id)
  if (error) throw error
}
