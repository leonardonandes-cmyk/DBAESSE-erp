import { supabase } from './supabase.js'

// Cada aba do backup: nome da aba + tabela/visão + colunas
const ABAS = [
  ['Produtos', 'produtos', 'ref,nome,tipo,colecao,ncm,grade_de,grade_ate,status,preco_atacado,preco_varejo,foto_url'],
  ['SKUs e estoque', 'estoque_saldos', 'sku,numero,saldo,saldo_bulk,saldo_pick'],
  ['Cores', 'cores', 'nome,sigla,hex'],
  ['Clientes e fornecedores', 'parceiros', 'nome,tipos,documento,telefone,email,cep,endereco,cidade,uf,canal,observacoes,ativo'],
  ['Pedidos', 'pedidos', 'numero,canal,status,previsao,desconto,observacoes,criado_em,parceiros(nome)'],
  ['Itens dos pedidos', 'pedido_itens', 'quantidade,preco_unit,pedidos(numero),skus(sku)'],
  ['Movimentos de estoque', 'estoque_movimentos', 'criado_em,local,tipo,quantidade,motivo,observacao,skus(sku)'],
  ['Financeiro', 'titulos', 'tipo,descricao,categoria,valor,vencimento,parcela,pago_em,valor_pago,forma,observacao,parceiros(nome)'],
  ['Ordens de producao', 'ordens_producao', 'numero,status,prioridade,prazo,observacao,concluida_em,criado_em,produtos(ref),cores(nome)'],
  ['Materiais', 'materiais', 'nome,categoria,unidade,por_numero,custo,estoque_minimo,ativo'],
  ['Saldos de materiais', 'material_saldos', 'material_id,numero,saldo'],
  ['Ficha de consumo', 'ficha_consumo', 'consumo,perda_pct,produtos(ref),materiais(nome)'],
  ['Compras', 'compras', 'numero,status,previsao,observacao,recebido_em,parceiros(nome)'],
]

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// "parceiros(nome)" vira coluna "parceiros_nome"
function achatar(linha) {
  const out = {}
  Object.entries(linha).forEach(([k, v]) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.entries(v).forEach(([k2, v2]) => { out[`${k}_${k2}`] = v2 })
    else out[k] = Array.isArray(v) ? v.join(', ') : v
  })
  return out
}

function celula(v) {
  if (v == null) return '<Cell/>'
  if (typeof v === 'number') return `<Cell><Data ss:Type="Number">${v}</Data></Cell>`
  if (typeof v === 'boolean') return `<Cell><Data ss:Type="String">${v ? 'sim' : 'não'}</Data></Cell>`
  return `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`
}

// Gera um arquivo Excel (várias abas) com tudo do sistema e baixa no computador/celular
export async function baixarBackup(aoProgresso) {
  const folhas = []
  let total = 0
  for (const [nome, tabela, cols] of ABAS) {
    aoProgresso?.(`Lendo ${nome}…`)
    const todas = []
    for (let de = 0; ; de += 1000) {
      // ordem fixa para a paginação não pular nem repetir linhas
      let q = supabase.from(tabela).select(cols)
      q = tabela === 'estoque_saldos' ? q.order('sku') : tabela === 'material_saldos' ? q.order('material_id').order('numero') : q.order('id')
      const { data, error } = await q.range(de, de + 999)
      if (error) throw new Error(`${nome}: ${error.message}`)
      todas.push(...data.map(achatar))
      if (data.length < 1000) break
    }
    total += todas.length
    const cab = todas.length ? Object.keys(todas[0]) : cols.split(',')
    const linhas = [
      `<Row>${cab.map((c) => `<Cell ss:StyleID="h"><Data ss:Type="String">${esc(c)}</Data></Cell>`).join('')}</Row>`,
      ...todas.map((r) => `<Row>${cab.map((c) => celula(r[c])).join('')}</Row>`),
    ]
    folhas.push(`<Worksheet ss:Name="${esc(nome.slice(0, 31))}"><Table>${linhas.join('')}</Table></Worksheet>`)
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
    `<Styles><Style ss:ID="h"><Font ss:Bold="1"/><Interior ss:Color="#EFEEEB" ss:Pattern="Solid"/></Style></Styles>` +
    folhas.join('') + `</Workbook>`
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' })
  const d = new Date()
  const nomeArq = `backup-dbaesse-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.xls`
  const u = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = u; a.download = nomeArq
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(u), 4000)
  return { linhas: total, arquivo: nomeArq }
}
