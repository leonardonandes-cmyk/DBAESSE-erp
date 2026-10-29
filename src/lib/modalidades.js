/*
  Modalidades de venda — o padrão do sistema inteiro (listas de preço, relatórios, custo, mapa):
  ATACADO · MESCLADO · DROP · MARKETPLACE · VAREJO
  O canal do pedido diz ONDE vendeu (Shopee, Instagram…); a modalidade agrupa os canais.
*/
export const MODALIDADES = [
  { id: 'atacado', label: 'Atacado', cor: '#6250d6', lista: 'atacado', canais: ['Atacado'], descricao: 'Grade fechada' },
  { id: 'mesclado', label: 'Mesclado', cor: '#d4537e', lista: 'mesclado', canais: ['Mesclado'], descricao: 'Pares avulsos, sem fechar grade' },
  { id: 'drop', label: 'Drop', cor: '#e8a10c', lista: 'drop', canais: ['Drop'], descricao: 'Dropshipping' },
  { id: 'marketplace', label: 'Marketplace', cor: '#1baf7a', lista: 'varejo', canais: ['Shopee', 'TikTok Shop', 'Mercado Livre'], descricao: 'Shopee, TikTok Shop, Mercado Livre' },
  { id: 'varejo', label: 'Varejo', cor: '#eb6834', lista: 'varejo', canais: ['Instagram', 'Loja / varejo'], descricao: 'Instagram e loja' },
]
export const MODALIDADE = Object.fromEntries(MODALIDADES.map((m) => [m.id, m]))

const POR_CANAL = Object.fromEntries(MODALIDADES.flatMap((m) => m.canais.map((c) => [c, m.id])))
// canal desconhecido/vazio → atacado
export const modalidadeDoCanal = (canal) => POR_CANAL[canal] || 'atacado'
