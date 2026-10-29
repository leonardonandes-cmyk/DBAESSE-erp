/*
  Geografia do Brasil para o Mapa de clientes.
  - /geo/estados.json: contorno dos 27 estados (malha IBGE simplificada), já projetado em SVG (largura 1000).
  - /geo/municipios.json: [nome, UF, x, y, capital] dos 5.571 municípios (lat/long IBGE projetados na mesma escala).
  Arquivos estáticos (sem custo de API); carregados uma vez só.
*/
export const REGIOES = {
  N: ['AC', 'AM', 'RR', 'RO', 'PA', 'AP', 'TO'],
  NE: ['MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA'],
  CO: ['MT', 'MS', 'GO', 'DF'],
  SE: ['MG', 'SP', 'RJ', 'ES'],
  S: ['PR', 'SC', 'RS'],
}
export const NOME_REGIAO = { BR: 'Brasil', N: 'Norte', NE: 'Nordeste', CO: 'Centro-Oeste', SE: 'Sudeste', S: 'Sul' }
export const regiaoDe = (uf) => Object.keys(REGIOES).find((k) => REGIOES[k].includes(uf)) || null

// "São João del-Rei" → "sao joao del rei"
export const chaveCidade = (nome, uf) =>
  `${String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}|${String(uf || '').toUpperCase().trim()}`

let cache = null
export function carregarGeo() {
  if (!cache) {
    cache = Promise.all([fetch('/geo/estados.json').then((r) => r.json()), fetch('/geo/municipios.json').then((r) => r.json())])
      .then(([est, mun]) => {
        const cidades = {}
        mun.forEach(([nome, uf, x, y, capital]) => { cidades[chaveCidade(nome, uf)] = { nome, uf, x, y, capital: !!capital } })
        // caixa de cada estado (para zoom e rótulos)
        const caixa = {}
        Object.entries(est.estados).forEach(([uf, e]) => {
          const n = e.d.match(/-?\d+(\.\d+)?/g).map(Number)
          let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
          for (let i = 0; i < n.length; i += 2) { x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]) }
          caixa[uf] = { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }
        })
        return { estados: est.estados, viewBox: est.viewBox, cidades, caixa }
      })
      .catch((e) => { cache = null; throw e })
  }
  return cache
}
