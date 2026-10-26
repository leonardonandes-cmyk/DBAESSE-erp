// ============================================================
// DADOS DE EXEMPLO — valores ilustrativos.
// Na próxima etapa este arquivo é trocado pela leitura do banco (Supabase).
// As telas só conversam com estas funções/constantes, então a troca é num lugar só.
// ============================================================

export const EMPRESA = { nome: 'DBAESSE', usuario: 'Leo', papel: 'Administrador' }

export const SETORES = ['Corte', 'Pesponto', 'Montagem', 'Acabamento', 'Revisão', 'Embalagem']

export const CORES = {
  caramelo: { nome: 'Caramelo', hex: '#B07A4A', sigla: 'CAR' },
  preto: { nome: 'Preto', hex: '#1A1A1A', sigla: 'PRE' },
  off: { nome: 'Off white', hex: '#F2EEE6', sigla: 'OFF' },
  nude: { nome: 'Nude', hex: '#D9B99B', sigla: 'NUD' },
  ouro: { nome: 'Ouro', hex: '#C9A55A', sigla: 'OUR' },
  bordo: { nome: 'Bordô', hex: '#6E1F2B', sigla: 'BOR' },
  palha: { nome: 'Palha', hex: '#D8C7A0', sigla: 'PAL' },
}

export const GRADE_PADRAO = [34, 35, 36, 37, 38, 39]

export const PRODUTOS = [
  { ref: '500', nome: 'Mocassim Siena', tipo: 'Mocassim', cores: ['caramelo', 'preto', 'off'], estoque: 486, status: 'ativo' },
  { ref: 'PP7.214', nome: 'Papete Ibiza', tipo: 'Papete', cores: ['nude', 'preto', 'palha'], estoque: 92, status: 'ruptura' },
  { ref: 'FS6.330', nome: 'Fisherman Lisboa', tipo: 'Fisherman', cores: ['off', 'caramelo'], estoque: 318, status: 'ativo' },
  { ref: 'SP8.801', nome: 'Sapatilha Vienna', tipo: 'Sapatilha', cores: ['preto', 'nude', 'bordo'], estoque: 154, status: 'baixo' },
  { ref: 'RS5.118', nome: 'Rasteira Strass', tipo: 'Rasteira', cores: ['ouro', 'preto'], estoque: 402, status: 'ativo' },
  { ref: 'SB4.429', nome: 'Salto Bloco Milano', tipo: 'Salto', cores: ['preto', 'caramelo', 'nude'], estoque: 211, status: 'ativo' },
  { ref: 'PL3.072', nome: 'Plataforma Roma', tipo: 'Plataforma', cores: ['off'], estoque: 0, status: 'rascunho' },
]

export const STATUS_PRODUTO = {
  ativo: { label: 'Ativo', tom: 'ok' },
  baixo: { label: 'Estoque baixo', tom: 'warn' },
  ruptura: { label: 'Ruptura', tom: 'bad' },
  rascunho: { label: 'Rascunho', tom: 'neutral' },
}

// SKU = REF sem ponto + sigla da cor (3 letras) + número  → mesmo padrão do ETIQUETAS-V2
export function gerarSku(ref, corKey, numero) {
  return `${ref.replace(/\./g, '')}-${CORES[corKey].sigla}-${numero}`
}

// Estoque por número (exemplo): distribui o total do modelo na grade
export function estoquePorNumero(produto) {
  const peso = [42, 88, 120, 104, 76, 0]
  return GRADE_PADRAO.map((n, i) => ({
    numero: n,
    qtd: produto.estoque === 0 ? 0 : Math.round((peso[i] * produto.estoque) / 430),
  }))
}

export const KPIS = [
  { label: 'Faturamento do mês', valor: 'R$ 248,5 mil', nota: '+12,8% sobre setembro', tom: 'ok' },
  { label: 'Pedidos abertos', valor: '137', nota: '32 prioritários' },
  { label: 'Em produção', valor: '8.450 pares', nota: '64 ordens ativas' },
  { label: 'A receber · 7 dias', valor: 'R$ 86,2 mil', nota: '9 títulos vencidos', tom: 'bad' },
]

export const VENDAS_SEMANA = [212, 248, 231, 275, 302, 288, 264, 319, 341, 326, 358, 384]

export const ALERTAS = [
  { n: 7, titulo: 'Ordens atrasadas', sub: 'Pesponto concentra 5 delas', tom: 'bad', para: '/producao' },
  { n: 12, titulo: 'Itens em ruptura', sub: 'Papete Ibiza nude 36 e 37 zerados', tom: 'warn', para: '/produtos' },
  { n: 9, titulo: 'Títulos vencidos', sub: 'R$ 14,3 mil em aberto', tom: 'bad', para: '/financeiro' },
  { n: 3, titulo: 'Pedidos do drop a separar', sub: 'Etiquetas recebidas hoje', tom: 'neutral', para: '/pedidos' },
]

export const CARGA_SETORES = [
  { setor: 'Corte', pares: 1920, ocupacao: 82 },
  { setor: 'Pesponto', pares: 2340, ocupacao: 96 },
  { setor: 'Montagem', pares: 1680, ocupacao: 68 },
  { setor: 'Acabamento', pares: 1210, ocupacao: 54 },
  { setor: 'Revisão', pares: 760, ocupacao: 38 },
  { setor: 'Embalagem', pares: 540, ocupacao: 30 },
]

export const STATUS_PEDIDO = {
  aguardando: { label: 'Aguardando', tom: 'neutral' },
  producao: { label: 'Em produção', tom: 'warn' },
  separacao: { label: 'Separação', tom: 'info' },
  faturado: { label: 'Faturado', tom: 'ok' },
  atrasado: { label: 'Atrasado', tom: 'bad' },
}

export const PEDIDOS = [
  { id: 'PV-1046', cliente: 'Revenda Mineira', canal: 'Atacado', pares: 72, status: 'producao', previsao: '30/10' },
  { id: 'PV-1045', cliente: 'Cliente varejo', canal: 'TikTok Shop', pares: 1, status: 'faturado', previsao: '26/10' },
  { id: 'PV-1044', cliente: 'Moda Nova', canal: 'Atacado', pares: 96, status: 'aguardando', previsao: '31/10' },
  { id: 'PV-1043', cliente: 'Cliente drop', canal: 'Shopee · Drop', pares: 6, status: 'separacao', previsao: '27/10' },
  { id: 'PV-1042', cliente: 'Loja Primavera', canal: 'Atacado', pares: 144, status: 'atrasado', previsao: '25/10' },
]

// etapas: ok | cur | late | pend  (uma por setor, na ordem de SETORES)
export const ORDENS = [
  { id: 'OP-0190', modelo: 'Rasteira Strass ouro', origem: 'Pedido PV-1046 · Revenda Mineira', pares: 72, etapas: ['ok', 'ok', 'ok', 'cur', 'pend', 'pend'], prazo: '28/10' },
  { id: 'OP-0189', modelo: 'Fisherman Lisboa off white', origem: 'Estoque · grade 34–39', pares: 240, etapas: ['cur', 'pend', 'pend', 'pend', 'pend', 'pend'], prazo: '31/10' },
  { id: 'OP-0188', modelo: 'Papete Ibiza preta', origem: 'Pedido PV-1042 · Loja Primavera', pares: 144, etapas: ['ok', 'late', 'pend', 'pend', 'pend', 'pend'], prazo: '25/10', atrasada: true },
  { id: 'OP-0187', modelo: 'Papete Ibiza nude', origem: 'Reposição · ruptura 36 e 37', pares: 120, etapas: ['ok', 'ok', 'cur', 'pend', 'pend', 'pend'], prazo: '30/10' },
  { id: 'OP-0186', modelo: 'Mocassim Siena caramelo', origem: 'Pedido PV-1044 · Moda Nova', pares: 96, etapas: ['ok', 'ok', 'ok', 'ok', 'cur', 'pend'], prazo: '27/10' },
  { id: 'OP-0185', modelo: 'Sapatilha Vienna preta', origem: 'Estoque · drop', pares: 180, etapas: ['ok', 'ok', 'ok', 'ok', 'ok', 'cur'], prazo: '26/10' },
]
